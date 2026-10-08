import { test as base, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Per-test console/page-error collection: a console error or uncaught
 * exception (including a CSP violation) fails the test unless the test opts
 * out. Full-page screenshots go to `e2e/artifacts/` for agent review; a
 * representative set is copied to `e2e/screenshots/`.
 */
export const ARTIFACTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'artifacts');

/** Artifacts the UI review commits for review rather than regenerating. */
export const REVIEW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'review');

/**
 * Viewports the UI is captured at: the README only promises the panel goes
 * full width on narrow screens, so narrow is a first-class review target.
 */
export const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  narrow: { width: 390, height: 844 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

export const test = base.extend<{ errors: string[]; snap: (name: string) => Promise<string> }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    await use(errors);
  },
  snap: async ({ page }, use) => {
    await use(async (name: string) => {
      // `visual/…` and `motion/…` are review evidence, committed under
      // e2e/review/; everything else is a scratch artifact.
      const review = name.startsWith('visual/') || name.startsWith('motion/');
      const file = path.join(review ? REVIEW_DIR : ARTIFACTS, `${name}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // CSS animations are fast-forwarded to their end state so a capture never
      // lands mid-fade. The motion strip is excluded: sampling mid-transition
      // is the whole point of it.
      const animations = name.startsWith('motion/') ? 'allow' : 'disabled';
      if (animations === 'disabled') await stableFrame(page);
      // `caret: 'hide'`: a focused text input blinks its caret, which is a
      // pixel-level difference unrelated to anything the review is looking at.
      await page.screenshot({ path: file, fullPage: true, animations, caret: 'hide' });
      return file;
    });
  },
});

export { expect };

/**
 * Make review evidence reproducible. Committed review images are only useful
 * if regenerating them produces no diff, which needs three things pinned:
 *
 * 1. **The clock** — the panel footer renders a wall-clock time.
 * 2. **Randomness** — the Tetris 7-bag and the music shuffle read
 *    `Math.random`, so the board and the playing track would differ per run.
 *    Seeded with a small deterministic PRNG rather than stubbing the product,
 *    which already takes an injectable `rng`.
 * 3. **Load completion** — callers must additionally wait for the content they
 *    intend to photograph; see `settled()`.
 */
export const FROZEN_TIME = new Date('2026-10-07T12:00:00Z');

/** mulberry32: small, fast, deterministic. */
const SEED_RNG = `(() => {
  let a = 0x9e3779b9;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})()`;

export async function freezeClock(page: Page) {
  await page.clock.install({ time: FROZEN_TIME });
  await page.addInitScript(SEED_RNG);
}

/**
 * Wait for the panel to have finished loading what it will show.
 *
 * The Reported summary box renders before its comments arrive, so a capture
 * taken on that heading alone photographs either state depending on timing.
 * Waiting for the discussion to report its end is the observable signal that
 * the view is complete.
 */
export async function settled(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/End of discussion|No comments yet\./)).toBeVisible();
}

/** Wait for the list to finish its first read, so a capture is not mid-load. */
export async function listSettled(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/End of list|Load more/).first()).toBeVisible();
}

/**
 * Wait for every image to finish decoding.
 *
 * The Tetris backdrops are `<img>` layers over the card. A capture taken before
 * they decode photographs a different panel from the one a warm cache produces,
 * which made the committed board capture churn between runs.
 */
export async function imagesLoaded(page: Page) {
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0));
}

/**
 * Wait for a frame that will not change: fonts resolved, then two animation
 * frames painted. Under load, a screenshot can otherwise land on a frame whose
 * layers have not finished rasterising, which shows up as a handful of stray
 * pixels and makes a byte comparison flaky.
 */
export async function stableFrame(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

/** Assert no console errors/page errors were seen on this page. */
export function expectClean(errors: string[]) {
  // Audio autoplay rejections are policy, not a defect; CSP media violations are errors we keep.
  const relevant = errors.filter((entry) => !entry.includes('play()') && !entry.includes('Failed to load resource'));
  expect(relevant, `console/page errors:\n${relevant.join('\n')}`).toEqual([]);
}
