import { describe, expect, it, vi } from 'vitest';
import { createGithubClient, isPullRequest } from '../server/github.js';
import { parseTarget, validateIssueNumber, ValidationError } from '../server/gh.js';

const target = { owner: 'normzhou', name: 'yolo-blank-canvas', slug: 'normzhou/yolo-blank-canvas' };

describe('target validation', () => {
  it('accepts owner/name and full URLs', () => {
    expect(parseTarget('normzhou/yolo-blank-canvas').slug).toBe('normzhou/yolo-blank-canvas');
    expect(parseTarget('https://github.com/normzhou/yolo-blank-canvas').slug).toBe('normzhou/yolo-blank-canvas');
  });

  it('rejects anything that could escape the repository path', () => {
    for (const bad of [
      '',
      'normzhou',
      'normzhou/repo/extra',
      'normzhou/re po',
      '../etc/passwd',
      'normzhou/../other',
      'normzhou/repo?x=1',
      'normzhou/-oProxy',
      'normzhou/.',
    ]) {
      expect(() => parseTarget(bad)).toThrow(ValidationError);
    }
  });

  it('rejects nonsensical issue numbers', () => {
    expect(validateIssueNumber('12')).toBe(12);
    expect(() => validateIssueNumber('0')).toThrow(ValidationError);
    expect(() => validateIssueNumber('../../issues/1')).toThrow(ValidationError);
    expect(() => validateIssueNumber('1; rm -rf /')).toThrow(ValidationError);
  });
});

describe('argument isolation', () => {
  it('keeps user text as JSON data on stdin, never in the argument list', async () => {
    const calls: Array<{ args: string[]; input?: string }> = [];
    const runner = vi.fn(async (args: string[], options?: { input?: string }) => {
      calls.push({ args, input: options?.input });
      return { number: 7 };
    });
    const github = createGithubClient({ runner: runner as never });
    await github.createIssue(target, { title: 'x"; rm -rf ~ #', body: '--input /etc/passwd $(whoami)' });

    const call = calls[0];
    expect(call.args).toEqual(['repos/normzhou/yolo-blank-canvas/issues', '--method', 'POST', '--input', '-']);
    expect(call.args.join(' ')).not.toContain('rm -rf');
    expect(JSON.parse(call.input as string)).toEqual({ title: 'x"; rm -rf ~ #', body: '--input /etc/passwd $(whoami)' });
  });

  it('builds fixed-host, repository-scoped paths for every operation', async () => {
    const runner = vi.fn(async () => []);
    const github = createGithubClient({ runner: runner as never });
    await github.listIssues(target, { state: 'all', page: 2, perPage: 10 });
    await github.getIssue(target, 5);
    await github.listComments(target, 5, { page: 3, perPage: 10 });
    await github.createComment(target, 5, { body: 'hi' });

    const paths = runner.mock.calls.map((call) => (call as unknown as [string[]])[0][0]);
    expect(paths).toEqual([
      'repos/normzhou/yolo-blank-canvas/issues?state=all&sort=updated&direction=desc&per_page=10&page=2',
      'repos/normzhou/yolo-blank-canvas/issues/5',
      'repos/normzhou/yolo-blank-canvas/issues/5/comments?per_page=10&page=3',
      'repos/normzhou/yolo-blank-canvas/issues/5/comments',
    ]);
    for (const path of paths) {
      expect(path.startsWith('repos/normzhou/yolo-blank-canvas/')).toBe(true);
      expect(path).not.toContain('://');
    }
  });

  it('clamps pagination instead of trusting arbitrary values', async () => {
    const runner = vi.fn(async () => []);
    const github = createGithubClient({ runner: runner as never });
    await github.listIssues(target, { page: -5, perPage: 5000 });
    expect((runner.mock.calls[0] as unknown as [string[]])[0][0]).toContain('per_page=100&page=1');
  });

  it('excludes pull requests from issue listings', async () => {
    const runner = vi.fn(async () => [
      { number: 1, title: 'an issue' },
      { number: 2, title: 'a pull request', pull_request: { url: 'https://api.github.com/…' } },
    ]);
    const github = createGithubClient({ runner: runner as never });
    const result = await github.listIssues(target, { perPage: 2 });
    expect(result.items.map((item) => item.number)).toEqual([1]);
    expect(isPullRequest({ pull_request: {} })).toBe(true);
  });

  it('reports hasMore from the raw page, not the filtered count (#150)', async () => {
    // GitHub pages by repository objects, so a page that is mostly pull requests
    // filters to fewer issues than perPage. Deciding hasMore from the filtered
    // count told the app "End of list" while later pages still held issues.
    const pr = { number: 2, pull_request: { url: 'https://api.github.com/…' } };
    const pr2 = { number: 3, pull_request: { url: 'https://api.github.com/…' } };
    // A full first page that filters down, and a short last page.
    const runner = vi.fn(async (path: string[]) =>
      path[0]?.includes('page=9') ? [{ number: 4 }] : [{ number: 1 }, pr, pr2],
    );
    const github = createGithubClient({ runner: runner as never });

    const short = await github.listIssues(target, { perPage: 3 });
    expect(short.items).toHaveLength(1);
    expect(short.hasMore).toBe(true);

    const complete = await github.listIssues(target, { perPage: 3, page: 9 });
    expect(complete.items).toHaveLength(1);
    expect(complete.hasMore).toBe(false);
  });

  it('requires a title and a non-empty body', async () => {
    const github = createGithubClient({ runner: (async () => ({})) as never });
    await expect(github.createIssue(target, { title: '   ', body: 'x' })).rejects.toBeInstanceOf(ValidationError);
    await expect(github.createComment(target, 1, { body: '  ' })).rejects.toBeInstanceOf(ValidationError);
  });
});