import { expect, test, expectClean } from './fixtures';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';

/**
 * Read-only live smoke against the real dev app: real `gh` credentials, no
 * writes to GitHub. Exercises the surfaces the deterministic suite cannot
 * (real data, real auth loss, `--repo` against a second repository).
 */

let server: ChildProcess | undefined;
let base = '';

async function freePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

async function launchApp(args: string[]): Promise<{ child: ChildProcess; base: string }> {
  const port = await freePort();
  const child = spawn(process.execPath, ['server/cli.js', '--no-open', '--port', String(port), ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      const response = await fetch(`${url}/api/version`);
      if (response.ok) return { child, base: url };
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error('app did not start in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

test.beforeAll(async () => {
  const launched = await launchApp([]);
  server = launched.child;
  base = launched.base;
});

test.afterAll(async () => {
  server?.kill();
});

test('canvas renders real data with the real identity, no console errors', async ({ page, errors, snap }) => {
  await page.goto(base);
  await expect(page.getByTestId('yolo-feedback-fab')).toBeVisible();
  await page.getByRole('button', { name: 'Open requests', exact: true }).click();
  await expect(page.getByText('signed in as normzhou')).toBeVisible();
  await snap('live-01-canvas');
  expectClean(errors);
});

test('Requests panel lists real issues and opens a real detail page', async ({ page, errors, snap }) => {
  await page.goto(base);
  await page.getByRole('button', { name: 'Open requests', exact: true }).click();
  const firstRow = page.locator('.issue-row .issue-title').first();
  await expect(firstRow).toBeVisible();
  await snap('live-02-list');
  await firstRow.click();
  // `exact`: real issue titles can contain the words "Reported summary".
  await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '← Back' })).toBeVisible();
  await snap('live-03-detail');
  expectClean(errors);
});

test('the Closed filter paginates against the real issue volume', async ({ page, errors, snap }) => {
  // Multi-page loading was a recorded live gap, misdiagnosed as "the live
  // repository has too few issues". It has 63 closed issues; the list was
  // silently truncating (#150). This observes the real thing: page one, then a
  // second page that keeps the first on screen.
  //
  // Read-only: filtering and paging are GETs and no write path is touched.
  await page.goto(base);
  await page.getByRole('button', { name: 'Open requests', exact: true }).click();

  // Let the first read settle. Switching while it is in flight used to be
  // dropped, which is #150's second defect and a real bug, not a test quirk —
  // so this waits rather than assuming the control is instant.
  await page.locator('.issue-row').first().waitFor({ timeout: 15_000 });
  await expect(page.getByText('End of list')).toBeVisible();

  await page.getByRole('button', { name: 'Closed', exact: true }).click();
  // The end-of-list note is only correct when there is no next page.
  await expect(page.getByText('End of list')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Load more' })).toBeVisible();

  const rows = page.locator('.issue-row');
  // Volume-independent: GitHub pages by repository object and the app filters
  // pull requests out, so page one holds fewer rows than `per_page`.
  const firstPage = await rows.count();
  expect(firstPage).toBeGreaterThan(0);
  await snap('live-04-closed-page-1');

  // Appending must keep earlier rows on screen rather than replacing them. Page
  // sizes differ — pull-request density varies per page — so this asserts
  // growth, not an exact doubling.
  const firstBefore = await rows.first().textContent();
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(rows).not.toHaveCount(firstPage);
  const afterSecondPage = await rows.count();
  expect(afterSecondPage, 'Load more must append, never replace').toBeGreaterThan(firstPage);
  await expect(rows.first()).toHaveText(firstBefore ?? '');
  await snap('live-05-closed-page-2');

  expectClean(errors);
});

test('mid-session auth loss surfaces the explicit retry state (no writes)', async ({ page, errors, snap }) => {
  await page.goto(base);
  await page.route('**/api/issues**', async (route) => {
    await route.fulfill({
      status: 401,
      json: { error: { kind: 'auth_required', message: 'GitHub CLI is not authenticated.', loginCommand: 'gh auth login --hostname github.com --web --skip-ssh-key' } },
    });
  });
  await page.getByRole('button', { name: 'Open requests', exact: true }).click();
  await expect(page.getByText('GitHub CLI is not authenticated.')).toBeVisible();
  await expect(page.getByText('gh auth login --hostname github.com --web --skip-ssh-key')).toBeVisible();
  await snap('live-04-auth-loss');
  expectClean(errors);
});

test('a second run against a different --repo serves that repository, read-only', async ({ page, errors, snap }) => {
  const launched = await launchApp(['--repo', 'normzhou/yolo-dev']);
  try {
    await page.goto(launched.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await expect(page.locator('.panel-repo')).toHaveText('normzhou/yolo-dev');
    await expect(page.getByText('signed in as normzhou')).toBeVisible();
    await expect(page.locator('.issue-row').first()).toBeVisible();
    await snap('live-05-second-repo');
    expectClean(errors);
  } finally {
    launched.child.kill();
  }
});
