import { test, expect, freezeClock } from './fixtures';
import { startStubApp } from './stub-server';
import { BACKGROUNDS } from '../src/shared/tetrisBackgrounds';

/**
 * Legibility of the Tetris stat panel across every bundled backdrop (#76 row
 * 3), measured in the browser rather than asserted by eye.
 *
 * The stats panel used to sit on `rgba(255,255,255,0.6)`. Measured against the
 * bundled art that put the label at 1.06:1–2.38:1 on the dark scenes, and
 * raising the opacity made it worse — a veil pulls a dark pixel toward the
 * mid-tone where mid-tone text has no contrast. The panel is opaque now, so
 * this asserts the invariant that survives every backdrop: the stat text
 * contrast does not depend on the artwork underneath it.
 */

const OVER_ART = '.tetris-side';
const SCENE_LINE = '.tetris-scene';

async function contrastOnPanel(page: import('@playwright/test').Page, panelSel: string, textSel: string) {
  return page.evaluate(
    ({ panel, text }) => {
      const panelEl = document.querySelector(panel);
      const textEl = document.querySelector(text);
      if (!panelEl || !textEl) return null;
      const parse = (value: string) => {
        const m = value.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(',').map((n) => Number.parseFloat(n.trim()));
        return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
      };
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a: number[], b: number[]) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
      };
      const fg = parse(getComputedStyle(textEl).color)!;
      const bg = parse(getComputedStyle(panelEl).backgroundColor)!;
      return { ratio: ratio(fg.rgb, bg.rgb), bgAlpha: bg.a, color: fg.rgb, background: bg.rgb };
    },
    { panel: panelSel, text: textSel },
  );
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`stat legibility — reducedMotion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    test('holds on every bundled backdrop, whatever the art does', async ({ page }) => {
      const stub = await startStubApp();
      try {
        await freezeClock(page);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(stub.base);
        await page.getByRole('button', { name: 'Play Tetris' }).click();
        await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();

        const measured: Array<{ scene: string; label: number; line: number }> = [];
        for (let index = 0; index < BACKGROUNDS.length; index += 1) {
          const scene = BACKGROUNDS[index];
          await expect(page.locator(SCENE_LINE)).toContainText(scene.title);
          const side = await contrastOnPanel(page, OVER_ART, `${OVER_ART} .tetris-label`);
          const value = await contrastOnPanel(page, OVER_ART, `${OVER_ART} .tetris-value`);
          expect(side, `no stat label found for ${scene.title}`).not.toBeNull();
          // Opaque: this is what makes the contrast independent of the art.
          expect(side!.bgAlpha, `${scene.title}: stats panel must be opaque`).toBe(1);
          expect(side!.ratio, `${scene.title}: stat label contrast`).toBeGreaterThanOrEqual(4.5);
          expect(value!.ratio, `${scene.title}: stat value contrast`).toBeGreaterThanOrEqual(4.5);
          measured.push({ scene: scene.title, label: side!.ratio, line: value!.ratio });
          if (index < BACKGROUNDS.length - 1) {
            await page.evaluate(() => window.dispatchEvent(new Event('yolo:tetris:four-line-clear')));
            await expect(page.locator(SCENE_LINE)).toContainText(BACKGROUNDS[index + 1].title);
          }
        }
        // The invariant the fix buys: identical contrast on every scene.
        const distinct = new Set(measured.map((m) => m.label));
        expect([...distinct], `stat contrast varied by backdrop: ${JSON.stringify(measured)}`).toHaveLength(1);
      } finally {
        stub.server.close();
      }
    });

    test('the crossfade does not animate under reduce', async ({ page }) => {
      const stub = await startStubApp();
      try {
        await freezeClock(page);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(stub.base);
        await page.getByRole('button', { name: 'Play Tetris' }).click();
        await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();

        const layerState = () =>
          page.evaluate(() =>
            Array.from(document.querySelectorAll('.tetris-art-layer')).map((el) => {
              const cs = getComputedStyle(el);
              return { cls: el.className, opacity: cs.opacity, display: cs.display, animation: cs.animationName };
            }),
          );

        await page.evaluate(() => window.dispatchEvent(new Event('yolo:tetris:four-line-clear')));
        await expect(page.locator(SCENE_LINE)).toContainText(BACKGROUNDS[1].title);

        if (reducedMotion === 'reduce') {
          // The cut is instant: no layer is mid-fade and the old one is gone.
          const layers = await layerState();
          const fading = layers.filter((l) => l.animation !== 'none' && l.animation !== '');
          expect(fading, `layers still animating under reduce: ${JSON.stringify(layers)}`).toHaveLength(0);
          const past = layers.filter((l) => l.cls.includes('is-past'));
          for (const layer of past) expect(layer.display).toBe('none');
        } else {
          const layers = await layerState();
          const current = layers.find((l) => l.cls.includes('is-current'));
          expect(current?.animation, 'the crossfade should animate under no-preference').toBe('tetris-art-in');
        }
      } finally {
        stub.server.close();
      }
    });
  });
}
