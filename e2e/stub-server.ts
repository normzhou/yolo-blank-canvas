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
    {
      number: 5,
      title: 'A summary that quotes the panel as an example',
      body: 'The summary body contains a fenced timing example.',
      state: 'open',
      state_reason: null,
      html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/5',
      labels: [],
      user: { login: 'normzhou' },
      created_at: NOW,
      updated_at: NOW,
    },
    // Content stress: a long title, nested Markdown with a table and a code
    // block, and unrelated labels long enough to wrap the row meta. Number 1
    // so it sorts to the top of the newest-updated list.
    {
      number: 1,
      title:
        'A deliberately long issue title that runs past one hundred characters to see how the row wraps and truncates',
      body: [
        '## Outcome',
        '',
        'A paragraph with **bold**, *italic*, `inline code` and a [link](https://example.com).',
        '',
        '### Nested detail',
        '',
        '1. first',
        '2. second',
        '',
        '| column | another column |',
        '| --- | --- |',
        '| a | b |',
        '',
        '```ts',
        'const x: number = 1;',
        'console.log(x);',
        '```',
      ].join('\n'),
      state: 'open',
      state_reason: null,
      html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/6',
      labels: [
        { name: 'enhancement' },
        { name: 'needs-design-review-before-anyone-picks-this-up' },
        { name: 'yolo:work' },
        { name: 'yolo:state:deferred' },
      ],
      user: { login: 'someone-else' },
      created_at: NOW,
      updated_at: NOW,
    },
  ];
}

/** Issues for the density check: 34 rows across all four managed states. */
export function densityIssues(): StubIssue[] {
  const states = ['yolo:state:queued', 'yolo:state:active', 'yolo:state:waiting', 'yolo:state:deferred'];
  return Array.from({ length: 34 }, (_, index) => ({
    number: 200 + index,
    title: `Request ${index + 1} with a title of a fairly typical length for this project`,
    body: '',
    state: 'open',
    state_reason: null,
    html_url: `https://github.com/normzhou/yolo-blank-canvas/issues/${200 + index}`,
    labels: index % 5 === 0 ? [] : [{ name: 'yolo:work' }, { name: states[index % states.length] }],
    user: { login: 'normzhou' },
    created_at: NOW,
    updated_at: NOW,
  }));
}

export function fixtureComments(number: number): StubComment[] {
  if (number === 5) {
    // The shape that produced the duplicated-timing defect: a summary that
    // quotes the panel's own output as an example. The panel must not read a
    // delivery date out of it.
    return [
      {
        id: 91,
        body: [
          '## YOLO status',
          '',
          'Outcome: not delivered yet.',
          '',
          '```text',
          'Timing: delivered 2026-10-07.',
          '```',
        ].join('\n'),
        user: { login: 'normzhou' },
        created_at: NOW,
        updated_at: NOW,
        html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/5#issuecomment-91',
      },
    ];
  }
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

export function makeStubGithub(overrides: { issues?: StubIssue[] } = {}) {
  const issues = overrides.issues ?? fixtureIssues();
  const comments = new Map<number, StubComment[]>([
    [5, fixtureComments(5)],
    [7, fixtureComments(7)],
  ]);
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

/** An issue whose comments contain no `## YOLO status` summary. */
export function withoutSummaryGithub() {
  const github = makeStubGithub();
  const inner = github.listComments;
  const plain: StubComment[] = [
    { id: 101, body: 'A reply with no summary heading.', user: { login: 'normzhou' }, created_at: NOW, updated_at: NOW },
  ];
  return {
    ...github,
    listComments: async (target: unknown, number: string, options: { page: number; perPage: number }): Promise<StubComment[]> =>
      Number(number) === 7 ? plain : inner(target, number, options),
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
