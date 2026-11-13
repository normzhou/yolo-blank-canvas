import { test, expect, VIEWPORTS, type ViewportName, freezeClock, settled, listSettled, imagesLoaded } from './fixtures';
import { startStubApp, makeStubGithub, withoutSummaryGithub, densityIssues } from './stub-server';
import type { Page } from '@playwright/test';

/**
 * Visual capture for the UI review (#75): every surface at both viewports,
 * including the states the #71 suite does not cover — density, content stress,
 * narrow layout, and the states with no styling of their own.
 *
 * Capture only. Nothing here asserts that the UI looks right; the review does
 * that and files the findings. Artifacts land in `e2e/artifacts/visual/`.
 */

type Stub = ReturnType<typeof makeStubGithub>;
type Ctx = { page: Page; snap: (name: string) => Promise<string> };

function capture(name: string, github: () => Stub, body: (ctx: Ctx) => Promise<void>) {
  for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
    test(`${name} — ${viewport}`, async ({ page, snap, errors }) => {
      const stub = await startStubApp(github());
      try {
        await page.setViewportSize(VIEWPORTS[viewport]);
        await freezeClock(page);
        await page.goto(stub.base);
        await body({ page, snap: (n) => snap(`visual/${viewport}-${n}`) });
        // A capture that errored is not usable evidence.
        const relevant = errors.filter((entry) => !entry.includes('play()') && !entry.includes('Failed to load resource'));
        expect(relevant, `console errors during capture: ${relevant.join('\n')}`).toEqual([]);
      } finally {
        stub.server.close();
      }
    });
  }
}

const openPanel = async (page: Page) => {
  await page.getByRole('button', { name: 'Open requests', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
};

capture('canvas and list', makeStubGithub, async ({ page, snap }) => {
  await expect(page.getByText('What would you like to build or change?')).toBeVisible();
  await snap('01-canvas');
  await openPanel(page);
  await listSettled(page);
  // 6 fixtures, but the default filter is Open and #4 is closed.
  await expect(page.locator('.issue-row')).toHaveCount(5);
  await snap('02-list');
});

capture('list with 34 rows (density)', () => makeStubGithub({ issues: densityIssues() }), async ({ page, snap }) => {
  await openPanel(page);
  await expect(page.locator('.issue-row')).toHaveCount(30);
  await listSettled(page);
  await snap('03-list-density-30');
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('.issue-row')).toHaveCount(34);
  await listSettled(page);
  await snap('04-list-density-34');
  // At the end of the list the scroll affordance should be gone (#104).
  await page.locator('.panel-body').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await snap('04b-list-density-34-end');
});

capture('closed filter', makeStubGithub, async ({ page, snap }) => {
  await openPanel(page);
  await page.getByRole('button', { name: 'Closed', exact: true }).click();
  await listSettled(page);
  await expect(page.getByText('#4 Prism Stack')).toBeVisible();
  await snap('05-list-closed');
});

capture('detail with reported summary', makeStubGithub, async ({ page, snap }) => {
  await openPanel(page);
  await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
  await settled(page);
  await expect(page.getByText('Outcome: shipped themes.').first()).toBeVisible();
  await snap('06-detail-summary');
});

capture('detail without a summary comment', withoutSummaryGithub, async ({ page, snap }) => {
  await openPanel(page);
  await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
  await settled(page);
  await expect(page.getByText('No progress summary yet.')).toBeVisible();
  await expect(page.getByText('Delivery timing not yet estimated.')).toBeVisible();
  await snap('07-detail-no-summary');
});

capture('detail with content stress', makeStubGithub, async ({ page, snap }) => {
  await openPanel(page);
  await page.getByRole('button', { name: /^#1 A deliberately long issue title/ }).click();
  await settled(page);
  await snap('08-detail-content-stress');
});

capture('new request, empty then title-invalid', makeStubGithub, async ({ page, snap }) => {
  await openPanel(page);
  await page.getByRole('button', { name: 'New request' }).first().click();
  await snap('09-new-request-empty');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('A title is required.')).toBeVisible();
  await snap('10-new-request-invalid');
});

capture('version-changed banner', makeStubGithub, async ({ page, snap }) => {
  await page.route('**/api/version', (route) =>
    route.fulfill({ json: { name: 'yolo-blank-canvas', serverBuild: 'deadbeef', clientBuild: 'ffffffffffff' } }),
  );
  await page.goto(page.url());
  await expect(page.getByText('App version changed')).toBeVisible();
  await snap('11-version-banner');
});

capture('connection error surface', makeStubGithub, async ({ page, snap }) => {
  await page.route('**/api/session', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 401,
          json: { error: { kind: 'auth_required', message: 'GitHub CLI is not authenticated.', loginCommand: 'gh auth login --hostname github.com --web --skip-ssh-key' } },
        })
      : route.continue(),
  );
  await page.goto(page.url());
  await expect(page.getByRole('button', { name: 'Retry connection' })).toBeVisible();
  await snap('12-auth-error');
});

capture('prism stack stats legible on every backdrop', makeStubGithub, async ({ page, snap }) => {
  await page.getByRole('button', { name: 'Prism Stack', exact: true }).click();
  await page.getByTestId('deck-slide-card').click();
  await expect(page.getByRole('img', { name: 'Prism Stack board, 9 by 18' })).toBeVisible();
  await page.getByTestId('pause-button').click();
  await expect(page.getByTestId('game-pause-menu')).toBeVisible();
  await imagesLoaded(page);
  const titles = ['Night Sky', 'City at Night', 'Desert Dunes', 'Red Planet', 'Deep Space', 'Castle in the Dark'];
  for (let index = 0; index < titles.length; index += 1) {
    await expect(page.locator('.stack-scene')).toContainText(titles[index]);
    await snap(`15-prism-scene-${index + 1}-${titles[index].toLowerCase().replace(/[^a-z]+/g, '-')}`);
    if (index < titles.length - 1) {
      await page.evaluate(() => window.dispatchEvent(new Event('yolo:prism:quad-clear')));
      await expect(page.locator('.stack-scene')).toContainText(titles[index + 1]);
      await imagesLoaded(page);
    }
  }
});

capture('prism stack board and stats', makeStubGithub, async ({ page, snap }) => {
  await page.getByRole('button', { name: 'Prism Stack', exact: true }).click();
  await page.getByTestId('deck-slide-card').click();
  await expect(page.getByRole('img', { name: 'Prism Stack board, 9 by 18' })).toBeVisible();
  await page.getByTestId('pause-button').click();
  await expect(page.getByTestId('game-pause-menu')).toBeVisible();
  await imagesLoaded(page);
  await snap('13-prism-board');
  await page.getByRole('button', { name: /Music on|Music off/ }).click();
  await snap('14-prism-music');
});

capture('starlight burst 2-player arena', makeStubGithub, async ({ page, snap }) => {
  await page.getByTestId('deck-slide-card').click();
  await expect(page.getByRole('img', { name: 'Player 1 starlight board' })).toBeVisible();
  await page.getByTestId('pause-button').click();
  await expect(page.getByTestId('game-pause-menu')).toBeVisible();
  await imagesLoaded(page);
  await snap('16-starlight-burst-2p');
});

