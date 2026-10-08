import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * The backdrop crossfade, measured in the running app rather than inferred from
 * the source.
 *
 * The outgoing layer used to be dropped by a `setTimeout(…, 700)` that repeated
 * the CSS animation's length in another file, so nothing guaranteed it went
 * after its own fade — only that both said 700. It is now removed on that
 * animation's `animationend`, with the CSS custom property as the single
 * duration.
 *
 * The threshold below is measured, not chosen for comfort: in the shipped build
 * the outgoing layer's last sampled opacity was **0.00017**, and in the
 * desynchronised case — CSS changed to 1400ms, JS left alone — it was
 * **0.115**, a visible pop. 0.05 sits between the two, so this check fails if
 * the removal drifts away from the fade again.
 *
 * Under `prefers-reduced-motion: reduce` the animation does not run at all, so
 * `animationend` cannot be the mechanism; the assertion there is that layers
 * still do not accumulate.
 */

const REMOVED_AT_OR_BELOW = 0.05;
const SETTLE_MS = 1600;

/**
 * Appends a stylesheet overriding only the animation duration — the exact edit
 * that used to break this. Run with the fix in place, the layer survives to
 * opacity 0 at t≈1476ms; run with the old timeout, it vanished at 0.115 around
 * t≈740ms. That difference is what makes the assertion below meaningful rather
 * than decorative.
 */
async function overrideFadeDuration(page: Page, duration: string) {
  await page.addStyleTag({
    content: `.tetris-art-layer.is-current, .tetris-art-layer.is-past { animation-duration: ${duration}; }`,
  });
}

interface Sample {
  t: number;
  layers: number;
  opacities: number[];
}

/** Sample layer count and opacity every animation frame across one change. */
async function sampleCrossfade(page: Page, settleMs = SETTLE_MS): Promise<Sample[]> {
  return page.evaluate(async (settleMs: number) => {
    const art = document.querySelector('.tetris-art');
    if (!art) throw new Error('no .tetris-art');
    const samples: Array<{ t: number; layers: number; opacities: number[] }> = [];
    const start = performance.now();
    const sample = () => {
      const layers = Array.from(art.querySelectorAll('.tetris-art-layer')) as HTMLElement[];
      samples.push({
        t: Math.round(performance.now() - start),
        layers: layers.length,
        opacities: layers.map((layer) => Number(getComputedStyle(layer).opacity)),
      });
    };
    sample();
    window.setTimeout(() => window.dispatchEvent(new Event('yolo:tetris:four-line-clear')), 50);
    await new Promise<void>((resolve) => {
      const loop = () => {
        sample();
        if (performance.now() - start > settleMs) {
          resolve();
          return;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    return samples;
  }, settleMs);
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`crossfade removal — reducedMotion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    test('drops the outgoing layer when its own fade ends, never mid-fade', async ({ page }) => {
      const stub = await startStubApp();
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(stub.base);
        await page.getByRole('button', { name: 'Play Tetris' }).click();
        await expect(page.locator('.tetris-scene')).toContainText('Scene 1/');

        const samples = await sampleCrossfade(page);
        expect(samples.length, 'no frames sampled').toBeGreaterThan(10);

        const peak = Math.max(...samples.map((sample) => sample.layers));
        expect(peak, 'a scene change should stack two layers').toBeGreaterThan(1);
        expect(samples.at(-1)?.layers, 'the transition should settle on one layer').toBe(1);

        const dropIndex = samples.findIndex((sample, index) => index > 0 && samples[index - 1].layers > sample.layers);
        expect(dropIndex, 'the outgoing layer was never removed').toBeGreaterThan(0);
        const lastPair = samples[dropIndex - 1];
        // The layer about to disappear is the oldest one.
        if (reducedMotion === 'no-preference') {
          expect(
            lastPair.opacities[0],
            `outgoing layer was removed at opacity ${lastPair.opacities[0]} (t=${lastPair.t}ms)`,
          ).toBeLessThanOrEqual(REMOVED_AT_OR_BELOW);
        } else {
          // No fade runs, so there is nothing to reach zero: the cut must be
          // immediate instead, with the layer hidden from the frame it turns past.
          expect(lastPair.opacities[0], 'the past layer should not be faded under reduce').toBeGreaterThan(0.9);
          // A layer on its way out must not be drawn over the new scene.
          await expect(page.locator('.tetris-art-layer.is-past')).toBeHidden();
        }

        await expect(page.locator('.tetris-scene')).toContainText('Scene 2/');
      } finally {
        stub.server.close();
      }
    });

    test('follows the fade when only the CSS duration changes', async ({ page }) => {
      // Under `reduce` there is no animation to lengthen, so this only means
      // something where a fade actually runs.
      test.skip(reducedMotion === 'reduce', 'needs an animated fade to override');
      const stub = await startStubApp();
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(stub.base);
        await page.getByRole('button', { name: 'Play Tetris' }).click();
        await expect(page.locator('.tetris-scene')).toContainText('Scene 1/');

        // The failure mode the duplicated literal allowed: one file edited, the
        // other left alone. The removal has to follow the fade regardless.
        await overrideFadeDuration(page, '1400ms');
        const samples = await sampleCrossfade(page, 2600);
        expect(samples.at(-1)?.layers, 'the longer fade should still settle on one layer').toBe(1);

        const dropIndex = samples.findIndex((sample, index) => index > 0 && samples[index - 1].layers > sample.layers);
        expect(dropIndex, 'the outgoing layer was never removed').toBeGreaterThan(0);
        const lastPair = samples[dropIndex - 1];
        expect(
          lastPair.opacities[0],
          `layer removed at opacity ${lastPair.opacities[0]} (t=${lastPair.t}ms) — mid-fade`,
        ).toBeLessThanOrEqual(REMOVED_AT_OR_BELOW);
        // A 1400ms fade must not be cut short at the old 700ms boundary.
        expect(lastPair.t, 'the fade was cut short').toBeGreaterThan(900);
      } finally {
        stub.server.close();
      }
    });

    test('does not accumulate layers across repeated scene changes', async ({ page }) => {
      const stub = await startStubApp();
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(stub.base);
        await page.getByRole('button', { name: 'Play Tetris' }).click();
        await expect(page.locator('.tetris-scene')).toContainText('Scene 1/');

        for (let change = 0; change < 3; change += 1) {
          await page.evaluate(() => window.dispatchEvent(new Event('yolo:tetris:four-line-clear')));
          await expect(page.locator('.tetris-scene')).toContainText(`Scene ${2 + change}/`);
          await page.waitForTimeout(1000);
          await expect(page.locator('.tetris-art-layer')).toHaveCount(1);
        }
      } finally {
        stub.server.close();
      }
    });
  });
}
