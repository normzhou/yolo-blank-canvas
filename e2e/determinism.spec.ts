import { test, expect, freezeClock, settled, listSettled } from './fixtures';
import { startStubApp, makeStubGithub, withoutSummaryGithub, densityIssues } from './stub-server';
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

/**
 * Reproducibility guard for the committed review evidence (#75).
 *
 * Committed review images are only useful if regenerating them produces no
 * diff. That failed twice before this test existed — once because the panel
 * footer renders a wall-clock time, and once because captures were taken before
 * loading finished and while `Math.random` was live. Each of those made
 * `e2e/review/visual/**` churn on every run, which defeats the point.
 *
 * This captures each representative surface twice in one run and requires the
 * bytes to match, so the next cause is caught by a failing test rather than by
 * a confusing diff.
 */

async function shoot(page: Page, url: string, steps: (p: Page) => Promise<void>) {
  await freezeClock(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(url);
  await steps(page);
  return createHash('sha256').update(await page.screenshot({ fullPage: true })).digest('hex');
}

const openPanel = async (page: Page) => {
  await page.getByRole('button', { name: 'Requests', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
};

test.describe('review evidence is reproducible', () => {
  const surfaces: Array<{ name: string; github: () => ReturnType<typeof makeStubGithub>; steps: (p: Page) => Promise<void> }> = [
    {
      name: 'list',
      github: makeStubGithub,
      steps: async (page) => {
        await openPanel(page);
        await listSettled(page);
        // 5 fixtures, but the default filter is Open and #4 is closed.
        await expect(page.locator('.issue-row')).toHaveCount(4);
      },
    },
    {
      name: 'density list',
      github: () => makeStubGithub({ issues: densityIssues() }),
      steps: async (page) => {
        await openPanel(page);
        await expect(page.locator('.issue-row')).toHaveCount(30);
        await listSettled(page);
      },
    },
    {
      name: 'detail with summary',
      github: makeStubGithub,
      steps: async (page) => {
        await openPanel(page);
        await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
        await settled(page);
      },
    },
    {
      name: 'detail without summary',
      github: withoutSummaryGithub,
      steps: async (page) => {
        await openPanel(page);
        await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
        await settled(page);
      },
    },
    {
      name: 'tetris board',
      github: makeStubGithub,
      steps: async (page) => {
        await page.getByRole('button', { name: 'Play Tetris' }).click();
        await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();
        // Gravity would otherwise move the piece between visibility and capture.
        await page.getByRole('button', { name: 'Pause' }).click();
        await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
      },
    },
  ];

  for (const surface of surfaces) {
    test(surface.name, async ({ browser }) => {
      const stub = await startStubApp(surface.github());
      try {
        const first = await shoot(await browser.newPage(), stub.base, surface.steps);
        const second = await shoot(await browser.newPage(), stub.base, surface.steps);
        expect(
          second,
          `review capture for "${surface.name}" is not reproducible — e2e/review/** will churn on every run`,
        ).toBe(first);
      } finally {
        stub.server.close();
      }
    });
  }
});
