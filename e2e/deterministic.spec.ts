import { expect, test, expectClean } from './fixtures';
import { startStubApp, type RunningStub } from './stub-server';

let stub: RunningStub;

test.beforeAll(async () => {
  stub = await startStubApp();
});

test.afterAll(async () => {
  stub.server.close();
});

test('canvas empty state, Requests panel with issue-state variants, and refresh', async ({ page, errors, snap }) => {
  await page.goto(stub.base);
  await expect(page.getByText('What would you like to build or change?')).toBeVisible();
  await expect(page.getByText('normzhou/yolo-blank-canvas · signed in as normzhou')).toBeVisible();
  await snap('01-canvas');

  await page.getByRole('button', { name: 'Requests', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
  await expect(page.getByText('In progress').first()).toBeVisible();
  await expect(page.getByText('Status needs reconciliation')).toBeVisible();
  await expect(page.getByText('Request open')).toBeVisible();
  await snap('02-list');

  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText(/End of list/).first()).toBeVisible();

  // Closed filter shows the closed fixture.
  await page.getByRole('button', { name: 'Closed', exact: true }).click();
  await expect(page.getByText('#4 Tetris')).toBeVisible();
  await expect(page.getByText('Completed (reported)')).toBeVisible();
  await snap('03-closed-filter');

  // Panel closes with Escape and focus returns to the trigger.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Requests' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Requests', exact: true })).toBeFocused();
  expectClean(errors);
});

test('detail view renders the ## YOLO status summary', async ({ page, errors, snap }) => {
  await page.goto(stub.base);
  await page.getByRole('button', { name: 'Requests', exact: true }).click();
  await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
  await expect(page.getByRole('heading', { name: 'Reported summary' })).toBeVisible();
  await expect(page.getByText('Outcome: shipped themes.').first()).toBeVisible();
  await expect(page.getByText('Timing: delivered 2026-10-07.').first()).toBeVisible();
  await expect(page.getByText('First reply from the maintainer.').first()).toBeVisible();
  await snap('04-detail-summary');
  expectClean(errors);
});

test('new-request form creates via stubbed POST and persists a draft across panel close', async ({ page, errors, snap }) => {
  await page.goto(stub.base);
  await page.getByRole('button', { name: 'Requests', exact: true }).click();
  await page.getByRole('button', { name: 'New request' }).first().click();
  await page.getByLabel('Title').fill('A draft that survives');
  await snap('05-new-request-draft');

  // Close and reopen the panel: the typed draft must still be there (the
  // panel reopens on the same view it closed on).
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Requests', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('A draft that survives');

  // Submit the stubbed creation; the new row shows up in the list.
  await page.getByLabel('Description').fill('Created by the E2E stub.');
  await page.getByRole('button', { name: 'Submit' }).click();
  // Create confirms into the detail view; Back returns to the reconciled list.
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByText('#100 A draft that survives')).toBeVisible();
  await snap('06-created-issue');
  expectClean(errors);
});

test('version-changed banner appears when the server advertises a different client build', async ({ page, errors, snap }) => {
  await page.route('**/api/version', async (route) => {
    await route.fulfill({
      json: { name: 'yolo-blank-canvas', serverBuild: 'deadbeef', clientBuild: 'ffffffffffff' },
    });
  });
  await page.goto(stub.base);
  await expect(page.getByText('App version changed — reload to use the version this server is running.')).toBeVisible();
  await snap('07-version-banner');
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByText('App version changed')).toHaveCount(0);
  expectClean(errors);
});

test('session-required and auth-retry error surfaces are explicit', async ({ page, errors, snap }) => {
  // Force the connect call to fail with an auth_required surface.
  await page.route('**/api/session', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 401,
        json: { error: { kind: 'auth_required', message: 'GitHub CLI is not authenticated.', loginCommand: 'gh auth login --hostname github.com --web --skip-ssh-key' } },
      });
    } else {
      await route.continue();
    }
  });
  await page.goto(stub.base);
  await expect(page.getByText('GitHub CLI is not authenticated.')).toBeVisible();
  await expect(page.getByText('gh auth login --hostname github.com --web --skip-ssh-key')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry connection' })).toBeVisible();
  await snap('08-auth-retry');
  expectClean(errors);
});

test('Tetris: board renders, music toggles with a stable track label, scenes cycle on four-line clears', async ({ page, errors, snap }) => {
  await page.goto(stub.base);
  await page.getByRole('button', { name: 'Play Tetris' }).click();
  await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();
  await expect(page.getByText(/Scene 1\/\d+:/)).toBeVisible();
  await snap('09-tetris-board');

  // Music on: the track label appears and must not spin (the #67 CSP regression).
  await page.getByRole('button', { name: /Music off/ }).click();
  const sceneLine = page.locator('.tetris-scene');
  await expect(sceneLine).toContainText('Music:');
  const first = await sceneLine.textContent();
  await page.waitForTimeout(3000);
  expect(await sceneLine.textContent()).toBe(first);
  await snap('10-tetris-music');

  // A four-line clear advances the scene; the same tune keeps playing (no repeat spin).
  await page.evaluate(() => window.dispatchEvent(new Event('yolo:tetris:four-line-clear')));
  await expect(sceneLine).toContainText('Scene 2/');
  await snap('11-tetris-next-scene');

  // Keyboard: hard-drop works, Escape closes the view.
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toHaveCount(0);
  expectClean(errors);
});
