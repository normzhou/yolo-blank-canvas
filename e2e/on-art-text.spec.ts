import { test, expect, freezeClock } from './fixtures';
import { startStubApp } from './stub-server';
import { BACKGROUNDS } from '../src/shared/tetrisBackgrounds';

/**
 * Legibility of the Tetris text that sits directly on the backdrop (#90).
 *
 * The stat panel was fixed in #76 by making it opaque, on the reasoning that a
 * translucent fill pulls an arbitrary art pixel toward mid-grey — exactly where
 * mid-grey text has no contrast. That left `.tetris-title`, `.tetris-help` and
 * `.tetris-scene` still sitting on the artwork. Measured against the real
 * composited pixels, the 12px muted lines landed between 1.28:1 and 3.90:1 and
 * the 15px/600 title between 3.96:1 and 15.8:1 — the muted lines failed the
 * 4.5:1 AA floor on every bundled scene.
 *
 * Two invariants are asserted, and both are properties of the fix rather than
 * of the current artwork:
 *
 * 1. These elements carry their own opaque background, so their contrast cannot
 *    depend on the image underneath. That is checked on every scene under both
 *    motion preferences, and the measured ratios must not vary by scene — the
 *    same shape as the #76 stat assertion.
 * 2. The settled backdrop renders at the same strength under
 *    `prefers-reduced-motion: reduce` as under `no-preference`. It used not to:
 *    the 0.55 lived only in the fade-in's keyframe endpoint, so cancelling the
 *    animation under `reduce` left the layer at its initial opacity of 1.
 */

const OVER_ART = ['.tetris-title', '.tetris-help', '.tetris-scene'] as const;
const SETTLED_ART_OPACITY = 0.55;
const AA_NORMAL_TEXT = 4.5;

const parse = (value: string) => value.match(/rgba?\(([^)]+)\)/)![1].split(',').map((n) => Number.parseFloat(n.trim()));

const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};

async function onArtContrast(page: import('@playwright/test').Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const parseRgba = (v: string) => v.match(/rgba?\(([^)]+)\)/)![1].split(',').map((n) => Number.parseFloat(n.trim()));
    const color = parseRgba(cs.color);
    const background = parseRgba(cs.backgroundColor);
    return {
      color: color.slice(0, 3),
      background: background.slice(0, 3),
      alpha: background.length > 3 ? background[3] : 1,
      fontSize: Number.parseFloat(cs.fontSize),
      fontWeight: Number(cs.fontWeight) || 400,
    };
  }, selector);
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`on-art text — reducedMotion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    test('keeps the backdrop at the same strength either way', async ({ page }) => {
      const stub = await startStubApp();
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(stub.base);
        await page.getByRole('button', { name: 'Play Tetris' }).click();
        await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();

        const settled = await page.evaluate(async () => {
          // Wait past any fade so this reads the resting state.
          await new Promise((resolve) => setTimeout(resolve, 1200));
          const layer = document.querySelector('.tetris-art-layer');
          return layer ? Number(getComputedStyle(layer).opacity) : -1;
        });
        expect(settled, 'the settled backdrop opacity should be the same under both preferences').toBe(
          SETTLED_ART_OPACITY,
        );
      } finally {
        stub.server.close();
      }
    });

    test('is legible on every backdrop, whatever the art does', async ({ page }) => {
      const stub = await startStubApp();
      try {
        await freezeClock(page);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(stub.base);
        await page.getByRole('button', { name: 'Play Tetris' }).click();
        await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();

        const measured: Array<{ scene: string; element: string; ratio: number }> = [];
        for (let index = 0; index < BACKGROUNDS.length; index += 1) {
          const scene = BACKGROUNDS[index];
          if (index > 0) {
            await page.evaluate(() => window.dispatchEvent(new Event('yolo:tetris:four-line-clear')));
          }
          await expect(page.locator('.tetris-scene')).toContainText(scene.title);
          await page.waitForFunction(() =>
            Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
          );

          for (const selector of OVER_ART) {
            const measured_one = await onArtContrast(page, selector);
            expect(measured_one, `no ${selector} found for ${scene.title}`).not.toBeNull();
            // Opaque is what makes the contrast independent of the art; without
            // it the number below would vary by scene, which is the bug.
            expect(
              measured_one!.alpha,
              `${scene.title} ${selector}: must be opaque, otherwise the art reaches the text`,
            ).toBe(1);
            const ratio = contrast(measured_one!.color, measured_one!.background);
            expect(ratio, `${scene.title} ${selector}: contrast`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
            measured.push({ scene: scene.title, element: selector, ratio });
          }
        }

        // The invariant the fix buys: identical contrast on every scene, for
        // every one of these elements. Any drift means the art leaked through.
        for (const selector of OVER_ART) {
          const distinct = new Set(measured.filter((m) => m.element === selector).map((m) => m.ratio));
          expect(
            [...distinct],
            `${selector} contrast varied by backdrop: ${JSON.stringify(measured.filter((m) => m.element === selector))}`,
          ).toHaveLength(1);
        }
      } finally {
        stub.server.close();
      }
    });
  });
}
