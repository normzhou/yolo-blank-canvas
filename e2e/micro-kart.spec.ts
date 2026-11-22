import { test, expect } from './fixtures';
import { startStubApp, type RunningStub } from './stub-server';

async function closeStub(stub: RunningStub) {
  stub.server.closeAllConnections();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
}

test('Micro Kart renders via static-VBO WebGL2 by default, supports Starlight Burst drivers, auto-throttle, turn Mini-Turbos, Down brake, and 2P Split-Screen (#344, #358, #360, #362, #364)', async ({
  page,
  errors,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);

    const card = page.getByTestId('deck-slide-card');
    await page.getByTestId('carousel-dot-micro-kart').click();
    await expect(card).toHaveAttribute('data-slide-id', 'micro-kart');
    await expect(card).toHaveAttribute('data-game-version', '2.0.0');
    await expect(page.locator('.deck-slide-title')).toHaveText('Micro Kart');

    await page.getByRole('button', { name: 'Play Micro Kart', exact: true }).click();
    await expect(page).toHaveURL(/\?app=micro-kart$/);
    await expect(page.getByRole('heading', { name: 'Micro Kart' })).toBeVisible();

    const canvas = page.getByTestId('kart-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl2');
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByTestId('kart-circuit-label')).toHaveText('Sunset Loop');
    await expect(page.getByTestId('kart-p1-driver')).toHaveText('Ren');
    await expect(page.getByTestId('kart-minimap')).toBeVisible();
    await expect(page.getByTestId('kart-p1-speedometer')).toBeVisible();
    await expect(page.getByTestId('kart-p1-f1-yoke')).toBeVisible();
    await expect(page.getByTestId('kart-p1-steer-slider')).toBeVisible();

    // 1. Hands-off (`left: false, right: false, brake: false`) launches rapidly via dual rockets (2s vacuum calibration)!
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 60, dtMs: 16.67, p1: { left: false, right: false } },
        }),
      );
    });
    const autoSpeed = parseInt((await page.getByTestId('kart-p1-speed').textContent()) ?? '0', 10);
    expect(autoSpeed).toBeGreaterThan(145);

    // 2. Carve right (`right: true`) -> right rocket scales down proportionally & F1 steering yoke rotates right!
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 36, dtMs: 16.67, p1: { left: false, right: true } },
        }),
      );
    });
    const rightThrottleDuringTurn = parseInt(
      (await page.getByTestId('kart-p1-turn-right').getAttribute('data-throttle')) ?? '100',
      10,
    );
    expect(rightThrottleDuringTurn).toBeLessThan(15);
    const yokeTurnDeg = parseFloat(
      (await page.getByTestId('kart-p1-f1-yoke').getAttribute('data-turn-deg')) ?? '0',
    );
    expect(yokeTurnDeg).toBeGreaterThan(10);

    // 3. Down (`S` / `brake: true`) brakes cleanly and lights the Brake HUD pill!
    const preBrakeSpeed = parseInt((await page.getByTestId('kart-p1-speed').textContent()) ?? '0', 10);
    await page.keyboard.down('ArrowDown');
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 24, dtMs: 16.67, p1: { left: false, right: false, brake: true } },
        }),
      );
    });
    await expect(page.getByTestId('kart-p1-brake')).toHaveClass(/is-braking/);
    const brakedSpeed = parseInt((await page.getByTestId('kart-p1-speed').textContent()) ?? '0', 10);
    await page.keyboard.up('ArrowDown');
    expect(brakedSpeed).toBeLessThan(preBrakeSpeed - 45);

    // Pause -> switch Starlight Burst driver to Mochi (Cat), circuit to Canyon Crest, and 2P Split-Screen
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByTestId('kart-driver-cat').click();
    await expect(page.getByTestId('kart-p1-driver')).toHaveText('Mochi');
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });

    await page.keyboard.press('Escape');
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

test('Micro Kart falls back cleanly to the 2D canvas renderer when WebGL2 is unavailable (#364)', async ({
  page,
  errors,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=micro-kart&renderer=2d`);
    const canvas = page.getByTestId('kart-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-renderer', 'canvas2d');
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });

    const has2DPixels = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx || c.width < 300) return false;
      const px = ctx.getImageData(Math.floor(c.width * 0.5), Math.floor(c.height * 0.65), 1, 1).data;
      return px[3] === 255 && (px[0] > 0 || px[1] > 0 || px[2] > 0);
    });
    expect(has2DPixels).toBe(true);
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

test('Micro Kart auto-pauses, opens Pause Menu, and pauses music when the window loses focus (#392)', async ({
  page,
  errors,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await page.getByTestId('carousel-dot-micro-kart').click();
    await page.getByRole('button', { name: 'Play Micro Kart', exact: true }).click();
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByTestId('game-pause-menu')).toHaveCount(0);

    // Confirm music is active during active gameplay
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const fn = (window as unknown as { __yoloAudioMetrics?: () => { active: boolean } })
            .__yoloAudioMetrics;
          return fn ? fn().active : false;
        }),
      )
      .toBe(true);

    // Losing screen/window focus must immediately open the Pause Menu and pause background music
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const fn = (window as unknown as { __yoloAudioMetrics?: () => { active: boolean } })
            .__yoloAudioMetrics;
          return fn ? fn().active : true;
        }),
      )
      .toBe(false);

    // Returning window focus must keep the game paused until the player explicitly resumes
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();

    // Clicking Resume closes the Pause Menu and resumes background music!
    await page.getByTestId('pause-menu-resume').click();
    await expect(page.getByTestId('game-pause-menu')).toHaveCount(0);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const fn = (window as unknown as { __yoloAudioMetrics?: () => { active: boolean } })
            .__yoloAudioMetrics;
          return fn ? fn().active : false;
        }),
      )
      .toBe(true);

    expect(errors).toEqual([]);
  } finally {
    await closeStub(stub);
  }
});

test('Micro Kart shows left-side emotional standings, in-game split finish banners, 5s next-track popover, and desktop-only 2P split screen (#400, #402, #406)', async ({
  page,
  browser,
  errors,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=micro-kart`);
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByTestId('kart-circuit-label')).toHaveText('Sunset Loop');

    // 1. Dynamic left-side standings rail shows all 4 character portraits with happy (1st) & anxious (4th) while racing!
    const rail = page.getByTestId('kart-standings-rail');
    await expect(rail).toBeVisible();
    await expect(rail.locator('[data-place="1"]')).toHaveAttribute('data-mood', 'happy');
    await expect(rail.locator('[data-place="4"]')).toHaveAttribute('data-mood', 'anxious');

    // 2. Finish 3 laps on Sunset Loop -> non-blocking in-game banner appears IMMEDIATELY, NOT the popover yet!
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 4500, dtMs: 20, autoPilotP1: true },
        }),
      );
    });

    await expect(page.getByTestId('kart-p1-finish-banner')).toBeVisible();
    await expect(page.getByTestId('kart-next-track-popover')).toHaveCount(0);
    // At race end, 4th place portrait switches to crying (`data-mood="cry"`)!
    await expect(rail.locator('[data-place="4"]')).toHaveAttribute('data-mood', 'cry');

    // 3. After 5 seconds, the separate "Continue to Next Track" popover appears cleanly!
    await expect(page.getByTestId('kart-next-track-popover')).toBeVisible({ timeout: 7500 });
    await expect(page.getByTestId('kart-next-track-btn')).toHaveText('Continue · Canyon Crest');
    await page.getByTestId('kart-next-track-btn').click();
    await expect(page.getByTestId('kart-circuit-label')).toHaveText('Canyon Crest');
    await expect(page.getByTestId('kart-next-track-popover')).toHaveCount(0);

    // 4. Switch to 2P Split-Screen on desktop & verify P1/P2 finish banners are divided into separate split halves!
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await expect(page.getByTestId('kart-2p-local-btn')).toBeVisible();
    await page.getByTestId('kart-2p-local-btn').click();
    await expect(page.getByTestId('micro-kart-stage')).toHaveAttribute('data-mode', '2p-local');
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 5500, dtMs: 20, autoPilotP1: true, autoPilotP2: true },
        }),
      );
    });
    const p1Banner = page.getByTestId('kart-p1-hud').getByTestId('kart-p1-finish-banner');
    const p2Banner = page.getByTestId('kart-p2-hud').getByTestId('kart-p2-finish-banner');
    await expect(p1Banner).toBeVisible();
    await expect(p2Banner).toBeVisible();
    const box1 = await p1Banner.boundingBox();
    const box2 = await p2Banner.boundingBox();
    expect(box1 && box2 && box1.y + box1.height < box2.y).toBe(true);

    // 5. Switch via Pause Menu to Track #4: Cloud Gate, finish it, and verify Cycle 2 flips to Sunset Loop ↺ Reverse! (#410)
    await page.keyboard.press('Escape');
    await page.getByTestId('kart-1p-btn').click();
    await page.keyboard.press('Escape');
    await page.getByTestId('kart-circuit-cloud-gate').click();
    await expect(page.getByTestId('kart-circuit-label')).toHaveText('Cloud Gate');
    await expect(page.getByTestId('micro-kart-stage')).toHaveAttribute('data-reversed', 'false');
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 5000, dtMs: 20, autoPilotP1: true },
        }),
      );
    });
    await expect(page.getByTestId('kart-next-track-popover')).toBeVisible({ timeout: 7500 });
    await expect(page.getByTestId('kart-next-track-btn')).toHaveText(
      'Continue · Sunset Loop ↺ Reverse',
    );
    await page.getByTestId('kart-next-track-btn').click();
    await expect(page.getByTestId('kart-circuit-label')).toHaveText('Sunset Loop ↺ Reverse');
    await expect(page.getByTestId('micro-kart-stage')).toHaveAttribute('data-reversed', 'true');
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 30, dtMs: 20, p1: { left: false, right: false } },
        }),
      );
    });

    // 5B. Switch to Portal Marathon Knockout mode (#412): 1 lap through the portal warps seamlessly into Canyon Crest!
    await page.keyboard.press('Escape');
    await page.getByTestId('kart-dir-forward').click();
    await page.keyboard.press('Escape');
    await page.getByTestId('kart-format-marathon').click();
    await expect(page.getByTestId('micro-kart-stage')).toHaveAttribute('data-format', 'marathon');
    await expect(page.getByTestId('kart-circuit-label')).toHaveText('🌀 #1 · Sunset Loop');
    await expect(page.getByTestId('kart-marathon-alive')).toHaveText('4/4');
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 8000 });
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:kart:step', {
          detail: { steps: 1450, dtMs: 20, autoPilotP1: true },
        }),
      );
    });
    await expect(page.getByTestId('micro-kart-stage')).toHaveAttribute('data-stage', '1');
    await expect(page.getByTestId('kart-circuit-label')).toHaveText('🌀 #2 · Canyon Crest');

    // 6. Verify 2P Split-Screen is NOT offered on mobile/touch viewports (desktop keyboard only!)
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const mobilePage = await mobileCtx.newPage();
    try {
      await mobilePage.goto(`${stub.base}?app=micro-kart`);
      await expect(mobilePage.getByTestId('kart-circuit-label')).toBeVisible();
      await mobilePage.keyboard.press('Escape');
      await expect(mobilePage.getByTestId('game-pause-menu')).toBeVisible();
      await expect(mobilePage.getByTestId('kart-2p-local-btn')).toHaveCount(0);
    } finally {
      await mobileCtx.close();
    }

    expect(errors).toEqual([]);
  } finally {
    await closeStub(stub);
  }
});
