import type { Server } from 'node:http';
import { createApp } from '../server/app.js';

/**
 * Deterministic GitHub seam for the E2E suite: same `createApp` the product
 * runs, with the GitHub client and identity stubbed — mirrors the seam used by
 * `test/app-api.test.ts`, so no real repo is touched.
 */

export interface StubIssue {
  number: number;
  title: string;
  body?: string | null;
  state: string;
  state_reason?: string | null;
  html_url: string;
  labels?: Array<{ name: string }>;
  user?: { login: string };
  created_at?: string;
  updated_at?: string;
}

export interface StubComment {
  id: number;
  body: string;
  user?: { login: string };
  created_at?: string;
  updated_at?: string;
  html_url?: string;
}

const NOW = '2026-10-07T12:00:00Z';

export function fixtureIssues(): StubIssue[] {
  return [
    {
      number: 7,
      title: 'Make the canvas respond to themes',
      body: 'Please add light and dark themes.',
      state: 'open',
      state_reason: null,
      html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/7',
      labels: [{ name: 'yolo:work' }, { name: 'yolo:state:active' }],
      user: { login: 'normzhou' },
      created_at: NOW,
      updated_at: NOW,
    },
    {
      number: 4,
      title: 'Tetris',
      body: 'Add a Tetris game.',
      state: 'closed',
      state_reason: 'completed',
      html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/4',
      labels: [{ name: 'yolo:work' }],
      user: { login: 'normzhou' },
      created_at: NOW,
      updated_at: NOW,
    },
    {
      number: 3,
      title: 'Conflicting states',
      body: '',
      state: 'open',
      state_reason: null,
      html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/3',
      labels: [{ name: 'yolo:work' }, { name: 'yolo:state:queued' }, { name: 'yolo:state:waiting' }],
      user: { login: 'normzhou' },
      created_at: NOW,
      updated_at: NOW,
    },
    {
      number: 2,
      title: 'A plain conversation',
      body: 'No workflow labels on this one.',
      state: 'open',
      state_reason: null,
      html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/2',
      labels: [],
      user: { login: 'normzhou' },
      created_at: NOW,
      updated_at: NOW,
    },
  ];
}

export function fixtureComments(number: number): StubComment[] {
  if (number !== 7) return [];
  return [
    {
      id: 101,
      body: 'First reply from the maintainer.',
      user: { login: 'normzhou' },
      created_at: NOW,
      updated_at: NOW,
      html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/7#issuecomment-101',
    },
    {
      id: 102,
      body: '## YOLO status\n\nOutcome: shipped themes. Source: #7.\nAcceptance: light and dark work.\nPlan / next: done.\nWork: merged.\nEvidence / result: verified.\n\nTiming: delivered 2026-10-07.',
      user: { login: 'normzhou' },
      created_at: NOW,
      updated_at: NOW,
      html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/7#issuecomment-102',
    },
  ];
}

export function makeStubGithub() {
  const issues = fixtureIssues();
  const comments = new Map<number, StubComment[]>([[7, fixtureComments(7)]]);
  let nextIssue = 100;
  return {
    listIssues: async (_target: unknown, { state, page, perPage }: { state: string; page: number; perPage: number }) => {
      const filtered = state === 'all' ? issues : issues.filter((issue) => issue.state === state);
      return filtered.slice((page - 1) * perPage, page * perPage);
    },
    getIssue: async (_target: unknown, number: string) => issues.find((issue) => issue.number === Number(number)) ?? null,
    createIssue: async (_target: unknown, { title, body }: { title: string; body: string }) => {
      const issue = {
        number: nextIssue++,
        title,
        body,
        state: 'open',
        state_reason: null,
        html_url: `https://github.com/normzhou/yolo-blank-canvas/issues/${nextIssue - 1}`,
        labels: [],
        user: { login: 'normzhou' },
        created_at: NOW,
        updated_at: NOW,
      };
      issues.unshift(issue);
      return issue;
    },
    listComments: async (_target: unknown, number: string, { page, perPage }: { page: number; perPage: number }) => {
      const items = comments.get(Number(number)) ?? [];
      return items.slice((page - 1) * perPage, page * perPage);
    },
    createComment: async (_target: unknown, number: string, { body }: { body: string }) => {
      const item = { id: 1000 + (comments.get(Number(number))?.length ?? 0), body, user: { login: 'normzhou' }, created_at: NOW, updated_at: NOW };
      const list = comments.get(Number(number)) ?? [];
      list.push(item);
      comments.set(Number(number), list);
      return item;
    },
  };
}

export interface RunningStub {
  base: string;
  server: Server;
}

export async function startStubApp(github = makeStubGithub()): Promise<RunningStub> {
  const app = createApp({
    target: { owner: 'normzhou', name: 'yolo-blank-canvas', slug: 'normzhou/yolo-blank-canvas' },
    github,
    identity: async () => ({ login: 'normzhou' }),
    repoAccess: async () => ({ fullName: 'normzhou/yolo-blank-canvas', hasIssues: true }),
  } as never);
  const server: Server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { base: `http://127.0.0.1:${port}`, server };
}
