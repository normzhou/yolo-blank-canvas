import { test, expect } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * Motion as still frames (#75). Video is out of scope for the audit — no model
 * in this harness accepts video — so transitions are captured as frames at fixed
 * offsets, which is what settles whether the 700ms CSS fade and the 700ms
 * layer-removal timeout can race.
 *
 * Captured under both motion preferences, because the app currently has no
 * `prefers-reduced-motion` handling (see #76).
 *
 * Frame offsets are sampling points, not a stopwatch: they say what is visible
 * at that moment, and the timing claim itself comes from the CSS and the
 * layer-removal timeout in `TetrisView`.
 */

const OFFSETS = [
  { at: 0, label: 't000' },
  { at: 100, label: 't100' },
  { at: 250, label: 't250' },
  { at: 450, label: 't450' },
  { at: 700, label: 't700' },
  { at: 800, label: 't800' },
] as const;

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`crossfade frames — reducedMotion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    test('captures the backdrop crossfade as frames', async ({ page, snap }) => {
      const stub = await startStubApp();
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(stub.base);
        await page.getByRole('button', { name: 'Play Tetris' }).click();
        await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();
        await expect(page.locator('.tetris-scene')).toContainText('Scene 1/');

        // Start the transition, then sample. Elapsed time is only as good as
        // the sampling, so this is evidence about visible states, not timing.
        await page.evaluate(() => window.dispatchEvent(new Event('yolo:tetris:four-line-clear')));
        let previous = 0;
        for (const { at, label } of OFFSETS) {
          if (at > previous) await page.waitForTimeout(at - previous);
          previous = at;
          await snap(`motion/${reducedMotion}-${label}`);
        }

        const scene = await page.locator('.tetris-scene').textContent();
        expect(scene).toContain('Scene 2/');
      } finally {
        stub.server.close();
      }
    });
  });
}
