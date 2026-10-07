import { describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server/app.js';
import { GhError } from '../server/gh.js';

const target = { owner: 'normzhou', name: 'yolo-blank-canvas', slug: 'normzhou/yolo-blank-canvas' };

type GithubStub = {
  listIssues: ReturnType<typeof vi.fn>;
  getIssue: ReturnType<typeof vi.fn>;
  createIssue: ReturnType<typeof vi.fn>;
  listComments: ReturnType<typeof vi.fn>;
  createComment: ReturnType<typeof vi.fn>;
};

function makeGithubStub(overrides: Partial<GithubStub> = {}): GithubStub {
  return {
    listIssues: vi.fn(async () => []),
    getIssue: vi.fn(async () => ({ number: 1, title: 'issue' })),
    createIssue: vi.fn(async () => ({ number: 42, title: 'created', html_url: 'https://github.com/x/y/issues/42' })),
    listComments: vi.fn(async () => []),
    createComment: vi.fn(async () => ({ id: 9, body: 'ok' })),
    ...overrides,
  };
}

async function start(
  github = makeGithubStub(),
  identity = async () => ({ login: 'normzhou' }),
  repoAccess = async () => ({ fullName: target.slug, hasIssues: true }),
) {
  const app = createApp({
    target,
    github,
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
    const github = makeGithubStub();
    const { server, request, json } = await start(github);
    try {
      await request('/api/session', json({}));

      const crossSite = await request('/api/issues', {
        ...json({ title: 'from another site' }),
        headers: { 'content-type': 'application/json', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
      });
      expect(crossSite.status).toBe(403);
      expect(crossSite.body.error.kind).toBe('cross_site');
      expect(github.createIssue).not.toHaveBeenCalled();

      const foreignFetchSite = await request('/api/issues', {
        ...json({ title: 'same-site subdomain' }),
        headers: { 'content-type': 'application/json', origin: baseOrigin(server), 'sec-fetch-site': 'same-site' },
      });
      expect(foreignFetchSite.status).toBe(403);
      expect(github.createIssue).not.toHaveBeenCalled();
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
    const github = makeGithubStub();
    const first = await start(github);
    await first.request('/api/session', first.json({}));
    const cookie = first.cookieHeader();
    first.server.close();

    const second = await start(github);
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
    const github = makeGithubStub({
      listIssues: vi.fn(async () => {
        throw new GhError('GitHub CLI is not authenticated.', 'auth_required', 401);
      }),
    });
    const { server, request, json } = await start(github);
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
    const github = makeGithubStub({
      listIssues: vi.fn(async () => [{ number: 3 }, { number: 2 }]),
    });
    const { server, request, json } = await start(github);
    try {
      await request('/api/session', json({}));
      const result = await request(`/api/issues?state=all&per_page=${perPage}`);
      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(2);
      expect(result.body.hasMore).toBe(true);
    } finally {
      server.close();
    }
  });

  it('creates one issue with only the entered title and body', async () => {
    const github = makeGithubStub();
    const { server, request, json } = await start(github);
    try {
      await request('/api/session', json({}));
      const result = await request('/api/issues', json({ title: 'Add dark mode', body: 'Please add a toggle.' }));
      expect(result.status).toBe(201);
      expect(result.body.issue.number).toBe(42);
      expect(github.createIssue).toHaveBeenCalledTimes(1);
      expect(github.createIssue).toHaveBeenCalledWith(target, { title: 'Add dark mode', body: 'Please add a toggle.' });
    } finally {
      server.close();
    }
  });

  it('does not retry or confirm an ambiguous write', async () => {
    const github = makeGithubStub({
      createIssue: vi.fn(async () => {
        throw new GhError('GitHub is unreachable from this machine.', 'github_unavailable', 503);
      }),
    });
    const { server, request, json } = await start(github);
    try {
      await request('/api/session', json({}));
      const result = await request('/api/issues', json({ title: 'uncertain', body: '' }));
      expect(result.status).toBe(502);
      expect(result.body.error.kind).toBe('write_unconfirmed');
      expect(result.body.error.githubUrl).toBe('https://github.com/normzhou/yolo-blank-canvas/issues');
      expect(github.createIssue).toHaveBeenCalledTimes(1);
    } finally {
      server.close();
    }
  });

  it('rejects a validation failure without an ambiguous-write warning', async () => {
    const github = makeGithubStub({
      createComment: vi.fn(async () => {
        throw new GhError('Repository or resource not found.', 'not_found', 404);
      }),
    });
    const { server, request, json } = await start(github);
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
});

function baseOrigin(server: Server): string {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}