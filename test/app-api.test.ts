import { describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server/app.js';
import { GhError } from '../server/gh.js';

const target = { owner: 'normzhou', name: 'yolo-blank-canvas', slug: 'normzhou/yolo-blank-canvas' };

type RequestStoreStub = {
  identity: ReturnType<typeof vi.fn>;
  capabilities: ReturnType<typeof vi.fn>;
  requestUrl: ReturnType<typeof vi.fn>;
  requestsUrl: ReturnType<typeof vi.fn>;
  listRequests: ReturnType<typeof vi.fn>;
  getRequest: ReturnType<typeof vi.fn>;
  createRequest: ReturnType<typeof vi.fn>;
  listComments: ReturnType<typeof vi.fn>;
  createComment: ReturnType<typeof vi.fn>;
};

function makeStoreStub(overrides: Partial<RequestStoreStub> = {}): RequestStoreStub {
  return {
    identity: vi.fn(() => ({ provider: 'github', displayName: 'GitHub', repository: target.slug, visibility: 'repository' })),
    capabilities: vi.fn(() => ({ comments: true, labels: true, externalLinks: true })),
    requestUrl: vi.fn((number) => `https://github.com/${target.slug}/issues/${number}`),
    requestsUrl: vi.fn(() => `https://github.com/${target.slug}/issues`),
    listRequests: vi.fn(async () => ({ items: [], hasMore: false })),
    getRequest: vi.fn(async () => ({ number: 1, title: 'issue' })),
    createRequest: vi.fn(async () => ({ number: 42, title: 'created', html_url: 'https://github.com/x/y/issues/42' })),
    listComments: vi.fn(async () => []),
    createComment: vi.fn(async () => ({ id: 9, body: 'ok' })),
    ...overrides,
  };
}

async function start(
  requestStore = makeStoreStub(),
  identity = async () => ({ login: 'normzhou' }),
  repoAccess = async () => ({ fullName: target.slug, hasIssues: true }),
) {
  const app = createApp({
    target,
    requestStore,
    identity,
    repoAccess,
  } as never);
  const server: Server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const cookies = new Map<string, string>();
  const cookieHeader = () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');

  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (cookies.size) headers.set('cookie', cookieHeader());
    const response = await fetch(`${base}${path}`, { ...init, headers });
    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookie) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value) cookies.set(name, value);
      else cookies.delete(name);
    }
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
  }

  const json = (value: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });

  return { server, base, request, json, cookies, cookieHeader };
}

describe('local session protection', () => {
  it('requires a session for every GitHub operation', async () => {
    const { server, request } = await start();
    try {
      for (const path of ['/api/issues', '/api/issues/1', '/api/issues/1/comments']) {
        const result = await request(path);
        expect(result.status).toBe(401);
        expect(result.body.error.kind).toBe('session_required');
        expect(result.body.error.loginCommand).toContain('gh auth login');
      }
      const created = await request('/api/issues', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"title":"x"}' });
      expect(created.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it('rejects unauthenticated mutations and cross-site requests', async () => {
    const requests = makeStoreStub();
    const { server, request, json } = await start(requests);
    try {
      await request('/api/session', json({}));

      const crossSite = await request('/api/issues', {
        ...json({ title: 'from another site' }),
        headers: { 'content-type': 'application/json', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
      });
      expect(crossSite.status).toBe(403);
      expect(crossSite.body.error.kind).toBe('cross_site');
      expect(requests.createRequest).not.toHaveBeenCalled();

      const foreignFetchSite = await request('/api/issues', {
        ...json({ title: 'same-site subdomain' }),
        headers: { 'content-type': 'application/json', origin: baseOrigin(server), 'sec-fetch-site': 'same-site' },
      });
      expect(foreignFetchSite.status).toBe(403);
      expect(requests.createRequest).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });

  it('rejects requests that were not addressed to loopback', async () => {
    const { server, base } = await start();
    try {
      // `fetch` will not let us forge Host, so use a raw request (DNS-rebinding shape).
      const port = Number.parseInt(new URL(base).port, 10);
      const status = await new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          { host: '127.0.0.1', port, path: '/api/session', method: 'POST', headers: { host: 'evil.example' } },
          (res) => {
            res.resume();
            resolve(res.statusCode ?? 0);
          },
        );
        req.on('error', reject);
        req.end('{}');
      });
      expect(status).toBe(400);
    } finally {
      server.close();
    }
  });

  it('ends the local session on disconnect without touching gh credentials', async () => {
    const { server, request, json } = await start();
    try {
      await request('/api/session', json({}));
      const disconnected = await request('/api/session/disconnect', json({}));
      expect(disconnected.body.authenticated).toBe(false);
      const after = await request('/api/session');
      expect(after.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it('does not keep sessions across a restart', async () => {
    const requests = makeStoreStub();
    const first = await start(requests);
    await first.request('/api/session', first.json({}));
    const cookie = first.cookieHeader();
    first.server.close();

    const second = await start(requests);
    try {
      const result = await second.request('/api/session', { headers: { cookie } });
      expect(result.status).toBe(401);
    } finally {
      second.server.close();
    }
  });
});

describe('identity handling', () => {
  it('reports the effective CLI account and configured repository', async () => {
    const { server, request, json } = await start();
    try {
      const created = await request('/api/session', json({}));
      expect(created.body).toMatchObject({ authenticated: true, identity: 'normzhou', repo: 'normzhou/yolo-blank-canvas' });
      const read = await request('/api/session');
      expect(read.body.identity).toBe('normzhou');
    } finally {
      server.close();
    }
  });

  it('surfaces lost authentication as an explicit state with the login command', async () => {
    const requests = makeStoreStub({
      listRequests: vi.fn(async () => {
        throw new GhError('GitHub CLI is not authenticated.', 'auth_required', 401);
      }),
    });
    const { server, request, json } = await start(requests);
    try {
      await request('/api/session', json({}));
      const result = await request('/api/issues');
      expect(result.status).toBe(401);
      expect(result.body.error.kind).toBe('auth_required');
      expect(result.body.error.loginCommand).toContain('gh auth login');
    } finally {
      server.close();
    }
  });
});

describe('issue operations', () => {
  it('lists issues newest-updated first and reports whether more exist', async () => {
    const perPage = 2;
    const requests = makeStoreStub({
      listRequests: vi.fn(async () => ({ items: [{ number: 3 }, { number: 2 }], hasMore: true })),
    });
    const { server, request, json } = await start(requests);
    try {
      await request('/api/session', json({}));
      const result = await request(`/api/issues?state=all&per_page=${perPage}`);
      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(2);
      expect(result.body.hasMore).toBe(true);
      expect(requests.listRequests).toHaveBeenCalledWith({ state: 'all', page: 1, perPage });
    } finally {
      server.close();
    }
  });

  it('creates one issue with only the entered title and body', async () => {
    const requests = makeStoreStub();
    const { server, request, json } = await start(requests);
    try {
      await request('/api/session', json({}));
      const result = await request('/api/issues', json({ title: 'Add dark mode', body: 'Please add a toggle.' }));
      expect(result.status).toBe(201);
      expect(result.body.issue.number).toBe(42);
      expect(requests.createRequest).toHaveBeenCalledTimes(1);
      expect(requests.createRequest).toHaveBeenCalledWith({ title: 'Add dark mode', body: 'Please add a toggle.' });
    } finally {
      server.close();
    }
  });

  it('does not retry or confirm an ambiguous write', async () => {
    const requests = makeStoreStub({
      createRequest: vi.fn(async () => {
        throw new GhError('GitHub is unreachable from this machine.', 'github_unavailable', 503);
      }),
    });
    const { server, request, json } = await start(requests);
    try {
      await request('/api/session', json({}));
      const result = await request('/api/issues', json({ title: 'uncertain', body: '' }));
      expect(result.status).toBe(502);
      expect(result.body.error.kind).toBe('write_unconfirmed');
      expect(result.body.error.githubUrl).toBe('https://github.com/normzhou/yolo-blank-canvas/issues');
      expect(requests.createRequest).toHaveBeenCalledTimes(1);
    } finally {
      server.close();
    }
  });

  it('rejects a validation failure without an ambiguous-write warning', async () => {
    const requests = makeStoreStub({
      createComment: vi.fn(async () => {
        throw new GhError('Repository or resource not found.', 'not_found', 404);
      }),
    });
    const { server, request, json } = await start(requests);
    try {
      await request('/api/session', json({}));
      const result = await request('/api/issues/1/comments', json({ body: 'hello' }));
      expect(result.status).toBe(404);
      expect(result.body.error.kind).toBe('not_found');
    } finally {
      server.close();
    }
  });

  it('exposes only the operations this app needs', async () => {
    const { server, request, json } = await start();
    try {
      await request('/api/session', json({}));
      for (const path of ['/api/proxy', '/api/gh', '/api/exec', '/api/repos/other/other/issues']) {
        const result = await request(path);
        expect(result.status).toBe(404);
      }
    } finally {
      server.close();
    }
  });

  it('serves the UI with a CSP that permits same-origin media (Tetris audio)', async () => {
    const { server, base } = await start();
    try {
      const response = await fetch(`${base}/`);
      expect(response.status).toBe(200);
      const csp = response.headers.get('content-security-policy') ?? '';
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("media-src 'self'");
    } finally {
      server.close();
    }
  });

  it('reports non-secret build identity', async () => {
    const { server, request } = await start();
    try {
      const result = await request('/api/version');
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('serverBuild');
      expect(result.body).toHaveProperty('clientBuild');
      expect(JSON.stringify(result.body).toLowerCase()).not.toContain('token');
    } finally {
      server.close();
    }
  });

  it('tracks multi-user online presence, open 2P invites, and room event relay via /api/netplay (#236)', async () => {
    const { server, request, json } = await start();
    try {
      // Player 1 and Player 2 send heartbeats
      const p1Hb = await request(
        '/api/netplay',
        json({ action: 'heartbeat', clientId: 'p1-test', name: 'Alice', app: 'tetris' }),
      );
      expect(p1Hb.status).toBe(200);
      expect(p1Hb.body.onlineCount).toBe(1);

      const p2Hb = await request(
        '/api/netplay',
        json({ action: 'heartbeat', clientId: 'p2-test', name: 'Bob', app: 'home' }),
      );
      expect(p2Hb.status).toBe(200);
      expect(p2Hb.body.onlineCount).toBe(2);

      // Player 1 broadcasts an open 2P Tetris invite
      const invRes = await request(
        '/api/netplay',
        json({ action: 'invite', clientId: 'p1-test', name: 'Alice', gameId: 'tetris' }),
      );
      expect(invRes.status).toBe(200);
      expect(invRes.body.myPendingInvites[0]?.gameId).toBe('tetris');
      const inviteId = invRes.body.myPendingInvites[0].id as string;

      // Player 2 sees the open invite in their next heartbeat
      const p2SeeInv = await request(
        '/api/netplay',
        json({ action: 'heartbeat', clientId: 'p2-test', name: 'Bob', app: 'home' }),
      );
      expect(p2SeeInv.body.openInvites).toHaveLength(1);
      expect(p2SeeInv.body.openInvites[0].id).toBe(inviteId);
      expect(p2SeeInv.body.openInvites[0].hostName).toBe('Alice');

      // Player 2 accepts the invite -> room created with shared seed
      const p2Accept = await request(
        '/api/netplay',
        json({ action: 'accept_invite', clientId: 'p2-test', name: 'Bob', inviteId }),
      );
      expect(p2Accept.status).toBe(200);
      expect(p2Accept.body.activeRoom).not.toBeNull();
      expect(p2Accept.body.activeRoom.gameId).toBe('tetris');
      expect(p2Accept.body.activeRoom.players[0].name).toBe('Alice');
      expect(p2Accept.body.activeRoom.players[1].name).toBe('Bob');
      const roomId = p2Accept.body.activeRoom.id as string;

      // Player 1 sends a garbage attack event in the room
      const p1Attack = await request(
        '/api/netplay',
        json({
          action: 'room_event',
          clientId: 'p1-test',
          roomId,
          kind: 'tetris_attack',
          payload: { lines: 4, holeColumn: 3 },
          afterSeq: 0,
        }),
      );
      expect(p1Attack.status).toBe(200);

      // Player 2 receives the room event on poll
      const p2Poll = await request(
        '/api/netplay',
        json({ action: 'heartbeat', clientId: 'p2-test', name: 'Bob', app: 'tetris', afterSeq: 0 }),
      );
      const attackEvent = p2Poll.body.activeRoom.events.find(
        (ev: { kind: string }) => ev.kind === 'tetris_attack',
      );
      expect(attackEvent).toBeDefined();
      expect(attackEvent.payload).toEqual({ lines: 4, holeColumn: 3 });
    } finally {
      server.close();
    }
  });
});

function baseOrigin(server: Server): string {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}