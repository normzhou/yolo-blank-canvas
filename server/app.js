/**
 * The local same-origin API.
 *
 * Only the operations this app needs exist here: session/identity, list/get
 * issues, list/create comments, create issue. Records go through the fixed
 * request-store port; there is no generic GitHub proxy — the browser cannot
 * choose an endpoint, a command, a repository, or a storage backend.
 */
import express from 'express';
import { createSessionStore, sessionIdFrom, setSessionCookie, clearSessionCookie } from './session.js';
import { buildInfo, CLIENT_DIR } from './build.js';
import { hostGuard, sameOriginGuard, securityHeaders } from './security.js';
import { GhError, ValidationError, effectiveIdentity, checkRepoAccess } from './gh.js';
import { createNetplayHub } from './netplay.js';

export const LOGIN_COMMAND = 'gh auth login --hostname github.com --web --skip-ssh-key';
const IDENTITY_TTL_MS = 20_000;

export function createApp({
  target,
  requestStore,
  identity = effectiveIdentity,
  repoAccess = checkRepoAccess,
  store = createSessionStore(),
  now = () => Date.now(),
  netplayHub = createNetplayHub({ now }),
} = {}) {
  if (!requestStore) throw new TypeError('A requestStore is required.');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(express.json({ limit: '256kb' }));
  app.use(securityHeaders);
  app.use(hostGuard);
  app.use(sameOriginGuard);

  const identityCache = { at: 0, login: null };

  /** Ask `gh` who we are, with a short cache so a poll does not shell out each time. */
  async function currentIdentity({ force = false } = {}) {
    if (!force && identityCache.login && now() - identityCache.at < IDENTITY_TTL_MS) {
      return identityCache.login;
    }
    const user = await identity();
    if (identityCache.login !== user.login || now() - identityCache.at >= IDENTITY_TTL_MS) {
      identityCache.login = user.login;
      identityCache.at = now();
    }
    return user.login;
  }

  function attachSession(req, res, next) {
    const id = sessionIdFrom(req);
    const session = id ? store.get(id) : undefined;
    if (!session) {
      res.status(401).json({ error: { kind: 'session_required', message: 'Connect GitHub to continue.', loginCommand: LOGIN_COMMAND } });
      return;
    }
    req.sessionId = id;
    req.session = session;
    next();
  }

  async function handle(res, fn) {
    try {
      await fn();
    } catch (error) {
      sendError(res, error);
    }
  }

  function sendError(res, error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: { kind: 'invalid_request', message: error.message } });
      return;
    }
    if (error instanceof GhError) {
      res.status(error.statusCode || 502).json({
        error: {
          kind: error.kind,
          message: error.message,
          // Always show the exact recovery command when CLI auth is the problem.
          ...(error.kind === 'auth_required' ? { loginCommand: LOGIN_COMMAND } : {}),
        },
      });
      return;
    }
    res.status(500).json({ error: { kind: 'server_error', message: 'The local app hit an unexpected error.' } });
  }

  /** A write whose outcome is unknown is never retried and never reported as success. */
  function ambiguousWrite(res, number) {
    const provider = requestStore.identity().displayName;
    res.status(502).json({
      error: {
        kind: 'write_unconfirmed',
        message: `${provider} did not confirm this write. It may or may not have been created — check ${provider} before submitting again.`,
        githubUrl: number ? requestStore.requestUrl(number) : requestStore.requestsUrl(),
      },
    });
  }

  app.get('/api/version', (req, res) => {
    res.json(buildInfo());
  });

  app.get('/api/netplay', (req, res) => {
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : '';
    const afterSeq = Number.parseInt(String(req.query.afterSeq ?? '0'), 10) || 0;
    res.json(netplayHub.snapshotFor(clientId, afterSeq));
  });

  app.post('/api/netplay', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = netplayHub.handleAction(body);
    res.status(result.status).json(result.payload);
  });

  app.post('/api/session', (req, res) => {
    handle(res, async () => {
      const login = await currentIdentity({ force: true });
      await repoAccess(target);
      const session = store.create({ identity: login, repo: target.slug });
      setSessionCookie(res, session.id);
      res.json({ authenticated: true, identity: login, repo: target.slug });
    });
  });

  app.get('/api/session', attachSession, (req, res) => {
    handle(res, async () => {
      const login = await currentIdentity();
      if (login !== req.session.identity) {
        // Never keep showing an account we are no longer acting as.
        store.update(req.sessionId, { identity: login });
      }
      res.json({ authenticated: true, identity: login, repo: target.slug, loginCommand: LOGIN_COMMAND });
    });
  });

  app.post('/api/session/retry', attachSession, (req, res) => {
    handle(res, async () => {
      const login = await currentIdentity({ force: true });
      await repoAccess(target);
      store.update(req.sessionId, { identity: login, repo: target.slug });
      res.json({ authenticated: true, identity: login, repo: target.slug });
    });
  });

  app.post('/api/session/disconnect', attachSession, (req, res) => {
    // Ends the local session only. `gh` credentials are untouched.
    store.destroy(req.sessionId);
    clearSessionCookie(res);
    res.json({ authenticated: false });
  });

  app.get('/api/issues', attachSession, (req, res) => {
    handle(res, async () => {
      await currentIdentity();
      const state = typeof req.query.state === 'string' ? req.query.state : 'open';
      const page = Math.max(Number.parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
      const perPage = Math.min(Math.max(Number.parseInt(String(req.query.per_page ?? '30'), 10) || 30, 1), 100);
      const result = await requestStore.listRequests({ state, page, perPage });
      res.json({ items: result.items, page, perPage, hasMore: result.hasMore });
    });
  });

  app.post('/api/issues', attachSession, (req, res) => {
    handle(res, async () => {
      await currentIdentity();
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      try {
        const issue = await requestStore.createRequest({ title: body.title, body: body.body });
        res.status(201).json({ issue });
      } catch (error) {
        if (isAmbiguous(error)) ambiguousWrite(res, null);
        else throw error;
      }
    });
  });

  app.get('/api/issues/:number', attachSession, (req, res) => {
    handle(res, async () => {
      await currentIdentity();
      const issue = await requestStore.getRequest(req.params.number);
      res.json({ issue });
    });
  });

  app.get('/api/issues/:number/comments', attachSession, (req, res) => {
    handle(res, async () => {
      await currentIdentity();
      const page = Math.max(Number.parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
      const perPage = Math.min(Math.max(Number.parseInt(String(req.query.per_page ?? '30'), 10) || 30, 1), 100);
      const items = await requestStore.listComments(req.params.number, { page, perPage });
      res.json({ items, page, perPage, hasMore: items.length === perPage });
    });
  });

  app.post('/api/issues/:number/comments', attachSession, (req, res) => {
    handle(res, async () => {
      await currentIdentity();
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const number = Number.parseInt(req.params.number, 10);
      try {
        const comment = await requestStore.createComment(req.params.number, { body: body.body });
        res.status(201).json({ comment });
      } catch (error) {
        if (isAmbiguous(error)) ambiguousWrite(res, number);
        else throw error;
      }
    });
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { kind: 'not_found', message: 'Unknown endpoint.' } });
  });

  // The built UI. Committed to the repository so the one-command install needs no build.
  app.use(express.static(CLIENT_DIR, { index: 'index.html', etag: true, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile('index.html', { root: CLIENT_DIR }, (error) => {
      if (error) next();
    });
  });

  app.use((error, req, res, next) => {
    if (error) {
      sendError(res, error);
      return;
    }
    next();
  });

  app.locals.store = store;
  app.locals.requestStore = requestStore;
  return app;
}

/** Failures that leave the outcome unknown (timeouts, transport, 5xx). */
function isAmbiguous(error) {
  if (error instanceof ValidationError) return false;
  if (!(error instanceof GhError)) return true;
  return !['invalid_request', 'forbidden', 'not_found', 'gh_missing', 'auth_required'].includes(error.kind);
}