import { describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../server/app.js';
import { GhError } from '../server/gh.js';
import { createGitHubRequestStore, type RequestStore } from '../server/request-store.js';
import { deriveIssueStatus, findSummaryComment } from '../src/shared/status.js';

const target = { owner: 'normzhou', name: 'yolo-blank-canvas', slug: 'normzhou/yolo-blank-canvas' };

function makeGithub() {
  return {
    listIssues: vi.fn(async () => ({ items: [{ number: 1 }], hasMore: false })),
    getIssue: vi.fn(async () => ({ number: 1, title: 'issue' })),
    createIssue: vi.fn(async () => ({ number: 2, title: 'created' })),
    listComments: vi.fn(async () => [{ id: 1, body: 'comment' }]),
    createComment: vi.fn(async () => ({ id: 2, body: 'reply' })),
  };
}

describe('GitHub request store', () => {
  it('describes the provider and exposes only fixed repository links', () => {
    const store = createGitHubRequestStore({ target, github: makeGithub() });

    expect(store.identity()).toEqual({
      provider: 'github',
      displayName: 'GitHub',
      repository: 'normzhou/yolo-blank-canvas',
      visibility: 'repository',
    });
    expect(store.capabilities()).toEqual({ comments: true, labels: true, externalLinks: true });
    expect(store.requestUrl(42)).toBe('https://github.com/normzhou/yolo-blank-canvas/issues/42');
    expect(store.requestsUrl()).toBe('https://github.com/normzhou/yolo-blank-canvas/issues');
  });

  it('maps the app-shaped port onto the GitHub client with the fixed target', async () => {
    const github = makeGithub();
    const store = createGitHubRequestStore({ target, github });

    await store.listRequests({ state: 'all', page: 2, perPage: 10 });
    await store.getRequest('7');
    await store.createRequest({ title: 'Title', body: 'Body' });
    await store.listComments('7', { page: 3, perPage: 5 });
    await store.createComment('7', { body: 'Reply' });

    expect(github.listIssues).toHaveBeenCalledWith(target, { state: 'all', page: 2, perPage: 10 });
    expect(github.getIssue).toHaveBeenCalledWith(target, '7');
    expect(github.createIssue).toHaveBeenCalledWith(target, { title: 'Title', body: 'Body' });
    expect(github.listComments).toHaveBeenCalledWith(target, '7', { page: 3, perPage: 5 });
    expect(github.createComment).toHaveBeenCalledWith(target, '7', { body: 'Reply' });
  });

  it('requires a target repository', () => {
    expect(() => createGitHubRequestStore({ github: makeGithub() } as never)).toThrow('target repository');
  });

  it('substitutes a non-GitHub fake store in createApp while preserving status evidence', async () => {
    const records = new Map<number, Record<string, unknown>>();
    const comments = new Map<number, Array<Record<string, unknown>>>();
    let nextNumber = 1;
    let nextCommentId = 1;
    let failWrites = false;

    const fakeStore: RequestStore = {
      identity: () => ({
        provider: 'memory',
        displayName: 'MemoryStore',
        repository: 'local/canvas',
        visibility: 'local',
      }),
      capabilities: () => ({ comments: true, labels: true, externalLinks: true }),
      requestUrl: (n) => `https://records.local/requests/${n}`,
      requestsUrl: () => 'https://records.local/requests',
      async listRequests() {
        return { items: Array.from(records.values()), hasMore: false };
      },
      async getRequest(n) {
        return records.get(Number(n)) ?? null;
      },
      async createRequest({ title, body }) {
        if (failWrites) throw new GhError('Store unavailable', 'github_unavailable', 503);
        const number = nextNumber++;
        const record = {
          number,
          title,
          body,
          state: 'open',
          labels: [{ name: 'yolo:work' }, { name: 'yolo:state:active' }],
          html_url: `https://records.local/requests/${number}`,
          updated_at: '2026-10-21T20:00:00Z',
        };
        records.set(number, record);
        return record;
      },
      async listComments(n) {
        return comments.get(Number(n)) ?? [];
      },
      async createComment(n, { body }) {
        const list = comments.get(Number(n)) ?? [];
        const comment = {
          id: nextCommentId++,
          body,
          updated_at: '2026-10-21T20:01:00Z',
        };
        list.push(comment);
        comments.set(Number(n), list);
        return comment;
      },
    };

    const app = createApp({
      target,
      requestStore: fakeStore,
      identity: async () => ({ login: 'normzhou' }),
      repoAccess: async () => ({ fullName: target.slug, hasIssues: true }),
    } as never);
    const server: Server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const base = `http://127.0.0.1:${port}`;

      const sessionRes = await fetch(`${base}/api/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin' },
        body: '{}',
      });
      const cookie = (sessionRes.headers.get('set-cookie') ?? '').split(';')[0];

      const createRes = await fetch(`${base}/api/issues`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: base,
          'sec-fetch-site': 'same-origin',
          cookie,
        },
        body: JSON.stringify({ title: 'Seam test', body: 'Template: blankcanvas.change@1' }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { issue: { number: number; state: string; labels: Array<{ name: string }> } };
      expect(deriveIssueStatus(created.issue).label).toBe('In progress');

      const commentRes = await fetch(`${base}/api/issues/1/comments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: base,
          'sec-fetch-site': 'same-origin',
          cookie,
        },
        body: JSON.stringify({ body: '## YOLO status\n\nOutcome: in flight.' }),
      });
      expect(commentRes.status).toBe(201);

      const listCommentsRes = await fetch(`${base}/api/issues/1/comments`, { headers: { cookie } });
      const listedComments = (await listCommentsRes.json()) as { items: Array<{ id: number; body: string }> };
      expect(findSummaryComment(listedComments.items)?.body).toContain('Outcome: in flight.');

      failWrites = true;
      const ambiguousRes = await fetch(`${base}/api/issues`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: base,
          'sec-fetch-site': 'same-origin',
          cookie,
        },
        body: JSON.stringify({ title: 'Uncertain', body: 'Body' }),
      });
      expect(ambiguousRes.status).toBe(502);
      const ambiguousBody = (await ambiguousRes.json()) as { error: { message: string; githubUrl: string } };
      expect(ambiguousBody.error.message).toContain('MemoryStore did not confirm this write');
      expect(ambiguousBody.error.githubUrl).toBe('https://records.local/requests');
    } finally {
      server.close();
    }
  });
});
