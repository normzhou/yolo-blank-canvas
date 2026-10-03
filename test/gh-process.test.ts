import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGhApi } from '../server/gh.js';
import { createSessionStore } from '../server/session.js';
import { createGithubClient } from '../server/github.js';

/**
 * End-to-end check of the process boundary using a stand-in `gh` executable:
 * arguments must arrive as an argv array (never a shell string) and bodies must
 * arrive on stdin as JSON data.
 */
const originalBin = process.env.YOLO_GH_BIN;

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yolo-gh-'));
  const script = path.join(dir, 'gh');
  fs.writeFileSync(
    script,
    [
      '#!/bin/sh',
      'input=""',
      'case " $* " in *" --input "*) input=$(printf %s "$(cat)" | base64);; esac',
      'printf \'{"argv":"%s","stdinB64":"%s"}\' "$*" "$input"',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
  process.env.YOLO_GH_BIN = script;
});

afterAll(() => {
  if (originalBin === undefined) delete process.env.YOLO_GH_BIN;
  else process.env.YOLO_GH_BIN = originalBin;
});

describe('gh process boundary', () => {
  it('always invokes `gh api` with the path as a separate argument', async () => {
    const result = (await runGhApi(['repos/o/r/issues', '--method', 'GET'])) as { argv: string };
    expect(result.argv).toBe('api repos/o/r/issues --method GET');
  });

  it('passes JSON bodies on stdin so user text can never become a command', async () => {
    const github = createGithubClient();
    const result = (await github.createIssue(
      { owner: 'o', name: 'r', slug: 'o/r' },
      { title: 'title with $(id) and `id`', body: '; rm -rf /' },
    )) as { argv: string; stdinB64: string };
    expect(result.argv).toBe('api repos/o/r/issues --method POST --input -');
    expect(JSON.parse(Buffer.from(result.stdinB64, 'base64').toString('utf8'))).toEqual({
      title: 'title with $(id) and `id`',
      body: '; rm -rf /',
    });
    expect(result.argv).not.toContain('rm -rf');
  });

  it('reports a missing executable honestly', async () => {
    process.env.YOLO_GH_BIN = '/nonexistent/gh-binary';
    await expect(runGhApi(['user'])).rejects.toMatchObject({ kind: 'gh_missing' });
  });
});

describe('session store', () => {
  it('stores sessions in memory only', () => {
    const store = createSessionStore();
    const created = store.create({ identity: 'normzhou', repo: 'o/r' });
    expect(store.get(created.id)?.identity).toBe('normzhou');
    expect(store.destroy(created.id)).toBe(true);
    expect(store.get(created.id)).toBeUndefined();
    expect(store.get('short')).toBeUndefined();
  });
});