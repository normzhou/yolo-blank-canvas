import { test, expect } from './fixtures';
import { startStubApp, type RunningStub } from './stub-server';

async function closeStub(stub: RunningStub) {
  stub.server.closeAllConnections();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
}

test('Micro Kart launches from the Home slide deck, renders 3D circuits, triggers Mini-Turbo boosts, and supports 2P Split-Screen (#344, #358)', async ({
  page,
  errors,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);

    const card = page.getByTestId('deck-slide-card');
    await page.getByTestId('carousel-dot-micro-kart').click();
    await expect(card).toHaveAttribute('data-slide-id', 'micro-kart');
    await expect(card).toHaveAttribute('data-game-version', '1.0.0');
    await expect(page.locator('.deck-slide-title')).toHaveText('Micro Kart');

    await page.getByRole('button', { name: 'Play Micro Kart', exact: true }).click();
    await expect(page).toHaveURL(/\?app=micro-kart$/);
    await expect(page.getByRole('heading', { name: 'Micro Kart' })).toBeVisible();

    const canvas = page.getByTestId('kart-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByTestId('kart-circuit-label')).toHaveText('Sunset Loop');
    await expect(page.getByTestId('kart-minimap')).toBeVisible();

    // Verify non-blank 3D Hi-DPI canvas rasterization
    const has3DPixels = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      if (c.width < 300 || c.height < 200) return false;
      const ctx = c.getContext('2d');
      if (!ctx) return false;
      const sample = ctx.getImageData(
        Math.floor(c.width * 0.5),
        Math.floor(c.height * 0.65),
        1,
        1,
      ).data;
      return sample[3] === 255 && (sample[0] > 0 || sample[1] > 0 || sample[2] > 0);
    });
    expect(has3DPixels).toBe(true);

    // Accelerate with both thrusters -> carve right to charge drift -> snap back to both for Mini-Turbo!
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 32, dtMs: 16.67, p1: { left: true, right: true } },
        }),
      );
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 34, dtMs: 16.67, p1: { left: false, right: true } },
        }),
      );
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 2, dtMs: 16.67, p1: { left: true, right: true } },
        }),
      );
    });

    await expect(page.getByTestId('kart-p1-boost-banner')).toContainText('BOOST!');
    const speedText = await page.getByTestId('kart-p1-speed').textContent();
    expect(parseInt(speedText ?? '0', 10)).toBeGreaterThan(240);

    // Pause -> switch circuit to Canyon Crest and 2P Split-Screen
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByTestId('kart-circuit-canyon-crest').click();
    await expect(page.getByTestId('kart-circuit-label')).toHaveText('Canyon Crest');
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });

    await page.keyboard.press('Escape');
    await page.getByTestId('kart-2p-local-btn').click();
    await expect(page.getByTestId('micro-kart-stage')).toHaveAttribute('data-mode', '2p-local');
    await expect(page.getByTestId('kart-p2-hud')).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    await closeStub(stub);
  }
});

test('Micro Kart 2P Online pairs two browser contexts into a shared-circuit race (#344, #358)', async ({
  browser,
}) => {
  const stub = await startStubApp();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  try {
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await pageA.goto(`${stub.base}?app=micro-kart`);
    await pageB.goto(`${stub.base}?app=micro-kart`);
    await expect(pageA.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });
    await expect(pageB.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });

    await expect(pageA.locator('.online-presence-count')).toContainText('2 online', {
      timeout: 8000,
    });

    await pageA.keyboard.press('Escape');
    await pageA.getByTestId('kart-2p-online-btn').click();
    await expect(pageA.getByTestId('kart-invite-waiting')).toBeVisible();

    await expect(pageB.getByTestId('netplay-invite-toast')).toContainText('Micro Kart');
    await pageB.getByTestId('netplay-accept-invite').click();

    await pageA.getByTestId('kart-ready-btn').click();
    await pageB.getByTestId('kart-ready-btn').click();

    await expect(pageA.getByTestId('micro-kart-stage')).toHaveAttribute('data-mode', '2p-online');
    await expect(pageB.getByTestId('micro-kart-stage')).toHaveAttribute('data-mode', '2p-online');
  } finally {
    await ctxA.close();
    await ctxB.close();
    await closeStub(stub);
  }
});
