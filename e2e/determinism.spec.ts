import { test, expect, freezeClock, settled, listSettled, imagesLoaded, stableFrame } from './fixtures';
import { startStubApp, makeStubGithub, withoutSummaryGithub, densityIssues } from './stub-server';
import type { Browser, Page } from '@playwright/test';

/**
 * Reproducibility guard for the committed review evidence (#75).
 *
 * Committed review images are only useful if regenerating them produces no
 * diff. That failed twice before this test existed — once because the panel
 * footer renders a wall-clock time, and once because captures were taken before
 * loading finished and while `Math.random` was live. Each of those made
 * `e2e/review/visual/**` churn on every run, which defeats the point.
 *
 * **Why this compares text, styles and geometry rather than image bytes.**
 * Full-page PNG byte-equality turned out not to be reliably achievable on this
 * machine: after the real causes were fixed, a handful of captures still
 * differed by a few hundred pixels, and *which* ones varied between runs. Text
 * and computed styles were byte-identical throughout, so the residue is
 * rasterization/compositor variance, not content. A guard that fails on that
 * noise is worse than no guard, because it teaches you to ignore it. So this
 * asserts the properties a review actually reads — and every cause of churn
 * found so far changes one of them.
 */

type Fingerprint = {
  text: string;
  styles: Record<string, string>;
  boxes: Record<string, string>;
};

const SELECTORS = [
  '.canvas-title',
  '.canvas-prompt',
  '.panel-repo',
  '.badge',
  '.issue-title',
  '.note',
  '.label',
  '.hint',
  'button.primary',
  '.summary-box',
  '.empty',
  '.error',
  '.banner',
];

async function fingerprint(page: Page): Promise<Fingerprint> {
  return page.evaluate((selectors) => {
    const styles: Record<string, string> = {};
    const boxes: Record<string, string> = {};
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const cs = getComputedStyle(el);
      styles[selector] = [
        cs.color,
        cs.backgroundColor,
        cs.fontSize,
        cs.fontWeight,
        cs.lineHeight,
        cs.opacity,
        cs.visibility,
        cs.borderColor,
        cs.borderTopWidth,
        cs.padding,
        cs.gap,
      ].join(' | ');
      const r = el.getBoundingClientRect();
      // Rounded: sub-pixel layout rounding is not what a review reads.
      boxes[selector] = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
    }
    return { text: document.body.innerText, styles, boxes };
  }, SELECTORS);
}

async function shoot(
  browser: Browser,
  github: () => ReturnType<typeof makeStubGithub>,
  steps: (p: Page) => Promise<void>,
): Promise<Fingerprint> {
  // A fresh stub per capture, as in the visual spec: the stub's issue counter is
  // per-server, so sharing one would make the second capture report #101.
  const stub = await startStubApp(github());
  // The page is closed before returning: an abandoned page keeps its 30s poll
  // loop running, and a dozen open pages made captures land on frames whose
  // layers had not finished rasterising.
  const page = await browser.newPage();
  try {
    await freezeClock(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await steps(page);
    await imagesLoaded(page);
    await stableFrame(page);
    return fingerprint(page);
  } finally {
    await page.close();
    stub.server.close();
  }
}

test.describe('review evidence is reproducible', () => {
  const openPanel = async (page: Page) => {
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
  };

  const surfaces: Array<{ name: string; github: () => ReturnType<typeof makeStubGithub>; steps: (p: Page) => Promise<void> }> = [
    {
      name: 'list',
      github: makeStubGithub,
      steps: async (page) => {
        await openPanel(page);
        await listSettled(page);
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
      name: 'new request',
      github: makeStubGithub,
      steps: async (page) => {
        await openPanel(page);
        await page.getByRole('button', { name: 'New request' }).first().click();
        await page.getByLabel('Title').fill('A draft that survives');
        await page.getByRole('button', { name: 'Submit' }).click();
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
      const first = await shoot(browser, surface.github, surface.steps);
      const second = await shoot(browser, surface.github, surface.steps);
      expect(second, `review capture for "${surface.name}" is not reproducible — e2e/review/** will churn`).toEqual(first);
    });
  }
});
