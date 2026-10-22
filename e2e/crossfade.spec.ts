import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * The backdrop crossfade, measured in the running app (#76, #90, consolidated in #201).
 */

const REMOVED_AT_OR_BELOW = 0.05;
const SETTLE_MS = 1600;
const RESTING_ART_OPACITY = 0.55;

interface Sample {
  t: number;
  layers: number;
  opacities: number[];
}

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

    test('settles at resting opacity and drops the outgoing layer without mid-fade pop or accumulation', async ({
      page,
    }) => {
      const stub = await startStubApp();
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(stub.base);
        await page.getByRole('button', { name: 'Tetris', exact: true }).click();
        await expect(page.locator('.tetris-scene')).toContainText('Scene 1/');

        const samples = await sampleCrossfade(page);
        expect(samples.length, 'no frames sampled').toBeGreaterThan(10);

        const peak = Math.max(...samples.map((sample) => sample.layers));
        expect(peak, 'a scene change should stack two layers').toBeGreaterThan(1);
        expect(samples.at(-1)?.layers, 'the transition should settle on one layer').toBe(1);
        expect(samples.at(-1)?.opacities[0]).toBeCloseTo(RESTING_ART_OPACITY, 2);

        const dropIndex = samples.findIndex((sample, index) => index > 0 && samples[index - 1].layers > sample.layers);
        expect(dropIndex, 'the outgoing layer was never removed').toBeGreaterThan(0);
        const lastPair = samples[dropIndex - 1];
        if (reducedMotion === 'no-preference') {
          expect(
            lastPair.opacities[0],
            `outgoing layer was removed at opacity ${lastPair.opacities[0]} (t=${lastPair.t}ms)`,
          ).toBeLessThanOrEqual(REMOVED_AT_OR_BELOW);
        } else {
          expect(
            lastPair.opacities[0],
            'the past layer should be at rest, not mid-fade, under reduce',
          ).toBeCloseTo(RESTING_ART_OPACITY, 2);
          await expect(page.locator('.tetris-art-layer.is-past')).toBeHidden();
        }

        await expect(page.locator('.tetris-scene')).toContainText('Scene 2/');
      } finally {
        stub.server.close();
      }
    });
  });
}
