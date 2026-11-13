import { test, expect } from './fixtures';
import { startStubApp, type RunningStub } from './stub-server';

/**
 * 2-Player Starlight Burst & Symmetric Online 2P (#181, #236, #347, #349, #352).
 *
 * Player 1 uses ASDF (A/D fine 0.5° tap or smooth 60fps hold aim, S or F launch);
 * Player 2 uses Arrow keys (ArrowLeft/ArrowRight fine aim, ArrowUp/ArrowDown launch).
 */

async function closeStub(stub: RunningStub) {
  stub.server.closeAllConnections();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
}

test('home gallery opens 2-player Starlight Burst, aims with 0.5° taps, channels the Starlight Ring with Fox/Cat/Dog/Bunny companions, and animates rising star-cores', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await page.getByTestId('deck-slide-card').click();

    await expect(page).toHaveURL(/\?app=starlight-burst$/);
    await expect(page.getByRole('heading', { name: 'Starlight Burst' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Player 1 starlight board' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Player 2 starlight board' })).toBeVisible();

    await expect(page.getByTestId('arcade-countdown')).toBeVisible();
    await page.getByTestId('pause-button').click();
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await expect(page.getByTestId('pause-menu-resume')).toHaveAttribute('data-menu-focused', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('pause-menu-restart')).toHaveAttribute('data-menu-focused', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('pause-menu-resume')).toHaveAttribute('data-menu-focused', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('arcade-countdown')).toBeVisible();
    await expect(page.getByTestId('arcade-countdown')).toHaveAttribute(
      'data-lang',
      /^(en|zh|hi|es|fr|ar|bn|pt|ru|ur|id|de|ja|pcm|sw|mr|te|tr|ta|yue|vi|ko)$/,
    );
    const countdownBorderStyle = await page
      .locator('.arcade-countdown-digit')
      .evaluate((el) => getComputedStyle(el).borderStyle);
    expect(countdownBorderStyle).toBe('none');
    await expect(page.getByTestId('p1-touch-controls')).toHaveCount(0);

    // Gameplay inputs are locked while countdown > 0, and unlock once countdown completes.
    await page.keyboard.press('d');
    await expect(page.getByTestId('p1-aim')).toHaveText('0°');
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });

    // Player 1 tilts right with fine 0.5° taps on D and launches with F.
    await expect(page.getByTestId('p1-aim')).toHaveText('0°');
    await page.keyboard.press('d');
    await expect(page.getByTestId('p1-aim')).toHaveText('+0.5°');
    await page.keyboard.press('d');
    await expect(page.getByTestId('p1-aim')).toHaveText('+1°');
    await page.keyboard.press('f');
    await expect(page.getByTestId('p1-shots')).toHaveText('1', { timeout: 5000 });

    const boxBefore = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.sb-player-card')).map((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
      });
      const sides = Array.from(document.querySelectorAll('.sb-side')).map((el) => {
        const r = el.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height) };
      });
      return { cards, sides };
    });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:starlight:queue-garbage', {
          detail: { player: 1, colors: ['ruby', 'amber', 'emerald'] },
        }),
      );
    });
    const p2Indicator = page.getByTestId('p2-incoming-indicator');
    await expect(p2Indicator).toBeVisible();
    await expect(p2Indicator.locator('.sb-incoming-preview-star')).toHaveCount(3);
    await expect(page.getByTestId('p2-incoming')).toContainText('3');

    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('p2-aim')).toHaveText('-0.5°');
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:starlight:fire-resolve', {
          detail: { player: 1, preventPop: true },
        }),
      );
    });
    await expect(page.getByTestId('p2-shots')).toHaveText('1');
    const p2Board = page.getByRole('img', { name: 'Player 2 starlight board' });
    await expect(p2Board.locator('.sb-rise-star')).toHaveCount(3);

    // Non-reptilian companions (`fox`, `cat`, `dog`, `bunny`) start as 1 Girl + 1 Boy of distinct species (#347, #349, #352).
    const p1Mascot = page.getByTestId('p1-mascot');
    const p2Mascot = page.getByTestId('p2-mascot');
    const initialP1Char = await p1Mascot.getAttribute('data-character');
    const initialP2Char = await p2Mascot.getAttribute('data-character');
    const initialP1Gender = await p1Mascot.getAttribute('data-gender');
    const initialP2Gender = await p2Mascot.getAttribute('data-gender');
    const initialP1Name = await p1Mascot.getAttribute('data-mascot-name');
    const initialP2Name = await p2Mascot.getAttribute('data-mascot-name');
    expect(['fox', 'cat', 'dog', 'bunny']).toContain(initialP1Char);
    expect(['fox', 'cat', 'dog', 'bunny']).toContain(initialP2Char);
    expect(initialP1Char).not.toBe(initialP2Char);
    expect([initialP1Gender, initialP2Gender].sort()).toEqual(['boy', 'girl']);
    await expect(page.getByTestId('p1-title')).toHaveText(`1P · ${initialP1Name}`);
    await expect(page.getByTestId('p2-title')).toHaveText(`2P · ${initialP2Name}`);
    await expect(p1Mascot).toHaveAttribute('data-mood', /^(?:normal|cheer)$/);
    await expect(p2Mascot).toHaveAttribute('data-mood', 'normal');

    // Even when cheering after a star-core burst, tilting continues to rotate the Orbital Focus Ring & Star-Wand (#342, #352)!
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:starlight:fire-resolve', {
          detail: { player: 0, forceClusterPop: true },
        }),
      );
    });
    await expect(p1Mascot).toHaveAttribute('data-mood', 'cheer');
    const wandBefore = await p1Mascot.getAttribute('data-wand-x');
    const ringBefore = await page.getByTestId('p1-sling-ring').getAttribute('data-sling-angle');
    await page.keyboard.press('d');
    await page.keyboard.press('d');
    await expect(p1Mascot).toHaveAttribute('data-mood', 'cheer');
    const wandAfter = await p1Mascot.getAttribute('data-wand-x');
    const ringAfter = await page.getByTestId('p1-sling-ring').getAttribute('data-sling-angle');
    expect(ringAfter).not.toBe(ringBefore);
    expect(wandAfter).not.toBe(wandBefore);

    // Clicking a companion switches to a distinct species excluding both sides (#349).
    let prevP1 = initialP1Char;
    let prevP2 = initialP2Char;
    for (let step = 0; step < 6; step++) {
      await p1Mascot.click();
      const nextP1Char = await p1Mascot.getAttribute('data-character');
      const nextP1Gender = await p1Mascot.getAttribute('data-gender');
      const nextP1Name = await p1Mascot.getAttribute('data-mascot-name');
      expect(nextP1Char).not.toBe(prevP1);
      expect(nextP1Char).not.toBe(prevP2);
      expect(['boy', 'girl']).toContain(nextP1Gender);
      await expect(page.getByTestId('p1-title')).toHaveText(`1P · ${nextP1Name}`);
      prevP1 = nextP1Char;

      await p2Mascot.click();
      const nextP2Char = await p2Mascot.getAttribute('data-character');
      const nextP2Gender = await p2Mascot.getAttribute('data-gender');
      const nextP2Name = await p2Mascot.getAttribute('data-mascot-name');
      expect(nextP2Char).not.toBe(prevP2);
      expect(nextP2Char).not.toBe(prevP1);
      expect(['boy', 'girl']).toContain(nextP2Gender);
      await expect(page.getByTestId('p2-title')).toHaveText(`2P · ${nextP2Name}`);
      prevP2 = nextP2Char;
    }

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:starlight:round-outcome', {
          detail: { winner: 0 },
        }),
      );
    });
    await expect(p1Mascot).toHaveAttribute('data-mood', 'celebrate');
    await expect(p2Mascot).toHaveAttribute('data-mood', 'cry');
    await expect(p1Mascot.locator('.sb-mascot-sparkle').first()).toBeVisible();
    await expect(p2Mascot.locator('.sb-mascot-tear').first()).toBeVisible();

    const boxAfter = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.sb-player-card')).map((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
      });
      const sides = Array.from(document.querySelectorAll('.sb-side')).map((el) => {
        const r = el.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height) };
      });
      return { cards, sides };
    });
    expect(boxAfter).toEqual(boxBefore);

    await page.getByTestId('pause-button').click();
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await expect(page.getByTestId('sb-2p-online-btn')).toBeDisabled();

    // Switch to 1 Player mode, clear the solo constellation, and verify Space/Next round flow.
    await page.getByRole('button', { name: '1 Player', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Player 2 starlight board' })).toHaveCount(0);
    await expect(page.getByTestId('arcade-countdown')).toBeVisible();
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:starlight:fire-resolve', {
          detail: { player: 0, clearStage: true },
        }),
      );
    });
    await expect(page.getByTestId('sb-round-banner')).toContainText('YOU WIN! Sky cleared');
    const bannerCenterDelta = await page.getByTestId('sb-round-banner').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        dx: Math.abs(r.left + r.width / 2 - window.innerWidth / 2),
        dy: Math.abs(r.top + r.height / 2 - window.innerHeight / 2),
      };
    });
    expect(bannerCenterDelta.dx).toBeLessThanOrEqual(24);
    expect(bannerCenterDelta.dy).toBeLessThanOrEqual(24);

    await page.keyboard.press('Space');
    await expect(page.getByTestId('sb-round-banner')).toHaveCount(0);
    await expect(page.getByTestId('arcade-countdown')).toBeVisible();
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:starlight:fire-resolve', {
          detail: { player: 0, clearStage: true },
        }),
      );
    });
    await expect(page.getByTestId('sb-round-banner')).toContainText('YOU WIN! Sky cleared');
    await page.getByTestId('sb-round-banner').getByRole('button', { name: 'Next round' }).click();
    await expect(page.getByTestId('sb-round-banner')).toHaveCount(0);
    await expect(page.getByTestId('arcade-countdown')).toBeVisible();
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    await page.getByTestId('pause-button').click();
    await page.getByRole('button', { name: '2 Player', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Player 2 starlight board' })).toBeVisible();

    // Step through the 15 constellations inside the Pause Menu.
    await page.getByTestId('pause-button').click();
    const stageBtn = page.getByTestId('sb-stage-button');
    await expect(stageBtn).toHaveText('Wave: Random');
    await page.getByRole('button', { name: 'Next constellation', exact: true }).click();
    await page.getByTestId('pause-button').click();
    await expect(stageBtn).toHaveText('Stage 1: Paired Blocks');
    await page.getByRole('button', { name: 'Previous constellation', exact: true }).click();
    await page.getByTestId('pause-button').click();
    await expect(stageBtn).toHaveText('Wave: Random');
    await page.getByRole('button', { name: 'Previous constellation', exact: true }).click();
    await page.getByTestId('pause-button').click();
    await expect(stageBtn).toHaveText("Stage 15: Emperor's Citadel");
    await page.getByTestId('pause-menu-resume').click();

    await expect(page.locator('.stack-scene')).toContainText(
      /Music: (?:Starlight Chime March|Overworld Rag & The Entertainer|Athletic Rag & Can-Can Galop|Spring Meadow & William Tell Galop|Csikós Post & Gladiators Galop)/,
    );
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const fn = (window as unknown as { __yoloAudioMetrics?: () => { durationSec: number; rms: number } })
            .__yoloAudioMetrics;
          const m = fn ? fn() : { durationSec: 0, rms: 0 };
          return m.durationSec >= 105 && m.rms > 0.005;
        }),
      )
      .toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByRole('button', { name: 'Close Starlight Burst' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '');
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
    await page.getByTestId('carousel-dot-prism-stack').click();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const fn = (
            window as unknown as {
              __yoloAudioMetrics?: () => { crossfadeCount: number; trackId: string | null; sfxLog: string[] };
            }
          ).__yoloAudioMetrics;
          const m = fn ? fn() : { crossfadeCount: 0, trackId: null, sfxLog: [] };
          return (
            m.crossfadeCount >= 1 &&
            Boolean(m.trackId && !m.trackId.startsWith('starlight-')) &&
            m.sfxLog.includes('star-shoot') &&
            m.sfxLog.includes('garbage-rise') &&
            m.sfxLog.includes('round-win')
          );
        }),
      )
      .toBe(true);
  } finally {
    await closeStub(stub);
  }
});

test('Feedback on Starlight Burst carries app context and isolates ASDF/Arrow keys from the boards', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=starlight-burst`);
    await expect(page.getByRole('heading', { name: 'Starlight Burst' })).toBeVisible();

    const feedback = page.getByRole('button', { name: 'Feedback on Starlight Burst' });
    await feedback.click();
    await expect(page).toHaveURL(/\?app=starlight-burst&panel=new$/);
    await expect(page.locator('.request-context-summary')).toContainText(
      'App: Starlight Burst (?app=starlight-burst)',
    );

    await page.getByLabel('Title').fill('asdf arrows test');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/\?app=starlight-burst$/);
    await expect(page.getByTestId('p1-aim')).toHaveText('0°');
    await expect(page.getByTestId('p2-aim')).toHaveText('0°');
    await expect(page.getByTestId('p1-shots')).toHaveText('0');
    await expect(page.getByTestId('p2-shots')).toHaveText('0');
  } finally {
    await closeStub(stub);
  }
});

test('mobile and tablet touch support: phone (< 560px) enforces 1P mode, tablet supports 2P side-by-side, and drag-to-aim + Prism Stack touch pad work without a keyboard (#212, #352)', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${stub.base}?app=starlight-burst`);
    await expect(page.getByRole('img', { name: 'Player 1 starlight board' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Player 2 starlight board' })).toHaveCount(0);
    await page.getByTestId('pause-button').click();
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await expect(page.getByRole('button', { name: '2 Player', exact: true })).toHaveCount(0);
    await page.getByTestId('pause-menu-resume').click();
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });

    // On coarse/phone viewports, direct drag-to-aim and release-to-launch works cleanly!
    const p1Board = page.getByRole('img', { name: 'Player 1 starlight board' });
    const box = await p1Board.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.82, box!.y + box!.height * 0.35);
    await page.mouse.up();
    await expect(page.getByTestId('p1-aim')).toHaveText(/^\+\d+(\.5)?°$/);
    await expect(page.getByTestId('p1-shots')).toHaveText('1', { timeout: 5000 });

    const phoneMetrics = await page.evaluate(() => {
      const fabEl = document.querySelector('[data-testid="yolo-feedback-fab"]');
      const fab = fabEl?.getBoundingClientRect();
      const fabBg = fabEl ? window.getComputedStyle(fabEl).backgroundColor : '';
      const fsEl = document.querySelector('[data-testid="fullscreen-button"]');
      const fs = fsEl?.getBoundingClientRect();
      const fsBg = fsEl ? window.getComputedStyle(fsEl).backgroundColor : '';
      const sndEl = document.querySelector('[data-testid="sound-button"]');
      const snd = sndEl?.getBoundingClientRect();
      const sndBg = sndEl ? window.getComputedStyle(sndEl).backgroundColor : '';
      const logo = document.querySelector('[data-testid="yolo-rotating-logo"]');
      const logoPaths = logo ? logo.querySelectorAll('path[d="M48 48v30"]').length : 0;
      const logoViewBox = logo ? logo.getAttribute('viewBox') : '';
      const logoColor = logo ? window.getComputedStyle(logo).color : '';
      return {
        horizOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        vertOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        scrollY: window.scrollY,
        fabWidth: fab ? Math.round(fab.width) : 0,
        fabHeight: fab ? Math.round(fab.height) : 0,
        fabBottom: fab ? Math.round(fab.bottom) : 0,
        fabRight: fab ? Math.round(fab.right) : 0,
        fabBg,
        fsRight: fs ? Math.round(fs.right) : 0,
        fsBottom: fs ? Math.round(fs.bottom) : 0,
        fsBg,
        sndRight: snd ? Math.round(snd.right) : 0,
        sndBottom: snd ? Math.round(snd.bottom) : 0,
        sndBg,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        hasRotatingLogo: Boolean(logo),
        logoPaths,
        logoViewBox,
        logoColor,
      };
    });
    expect(phoneMetrics.horizOverflow).toBeLessThanOrEqual(0);
    expect(phoneMetrics.vertOverflow).toBeLessThanOrEqual(0);
    expect(phoneMetrics.scrollY).toBe(0);
    expect(phoneMetrics.hasRotatingLogo).toBe(true);
    expect(phoneMetrics.logoPaths).toBe(3);
    expect(phoneMetrics.logoViewBox).toBe('0 0 96 96');
    expect(phoneMetrics.logoColor).toBe('rgb(216, 75, 39)');
    expect(phoneMetrics.fabBg).toBe('rgba(0, 0, 0, 0)');
    expect(phoneMetrics.fsBg).toBe('rgba(0, 0, 0, 0)');
    expect(phoneMetrics.sndBg).toBe('rgba(0, 0, 0, 0)');

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('img', { name: 'Player 2 starlight board' })).toHaveCount(0);

    for (const [w, h] of [
      [600, 960],
      [744, 1133],
      [768, 1024],
      [960, 480],
      [1024, 768],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.getByTestId('pause-button').click();
      await page.getByRole('button', { name: '2 Player', exact: true }).click();
      await expect(page.getByRole('img', { name: 'Player 1 starlight board' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Player 2 starlight board' })).toBeVisible();
      const cardTops = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.sb-player-card')).map((el) =>
          Math.round(el.getBoundingClientRect().top),
        ),
      );
      expect(cardTops, `Tablet ${w}x${h} should keep both 2P cards side-by-side`).toEqual([
        cardTops[0],
        cardTops[0],
      ]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `Tablet ${w}x${h} horizontal overflow`).toBeLessThanOrEqual(0);
    }

    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    const p1TabBox = await page.getByRole('img', { name: 'Player 1 starlight board' }).boundingBox();
    const p2TabBox = await page.getByRole('img', { name: 'Player 2 starlight board' }).boundingBox();
    expect(p1TabBox).not.toBeNull();
    expect(p2TabBox).not.toBeNull();
    await page.mouse.move(p1TabBox!.x + p1TabBox!.width * 0.5, p1TabBox!.y + p1TabBox!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(p1TabBox!.x + p1TabBox!.width * 0.78, p1TabBox!.y + p1TabBox!.height * 0.35);
    await page.mouse.up();
    await page.mouse.move(p2TabBox!.x + p2TabBox!.width * 0.5, p2TabBox!.y + p2TabBox!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(p2TabBox!.x + p2TabBox!.width * 0.22, p2TabBox!.y + p2TabBox!.height * 0.35);
    await page.mouse.up();
    await expect(page.getByTestId('p1-shots')).toHaveText('1', { timeout: 5000 });
    await expect(page.getByTestId('p2-shots')).toHaveText('1', { timeout: 5000 });

    const fsBtn = page.getByTestId('fullscreen-button');
    await expect(fsBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(fsBtn).toHaveText('Full screen');
    await fsBtn.click();
    await expect(fsBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(fsBtn).toHaveText('Exit full screen');
    await fsBtn.click();
    await expect(fsBtn).toHaveAttribute('aria-pressed', 'false');

    await page.setViewportSize({ width: 360, height: 640 });
    await expect(page.getByRole('img', { name: 'Player 2 starlight board' })).toHaveCount(0);
    const smallPhoneClipped = await page.evaluate(() => {
      const side = document.querySelector('.sb-side')?.getBoundingClientRect();
      const card = document.querySelector('.sb-player-card')?.getBoundingClientRect();
      return side && card ? side.right > card.right + 1 : true;
    });
    expect(smallPhoneClipped).toBe(false);

    // Prism Stack touch controls work on phone without a keyboard.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${stub.base}?app=prism-stack`);
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    await expect(page.getByTestId('prism-touch-controls')).toBeVisible();
    await page.getByTestId('prism-touch-rotate').click();
    await page.getByTestId('prism-touch-drop').click();
    await expect(page.getByTestId('prism-p1-score')).not.toHaveText('0');
  } finally {
    await closeStub(stub);
  }
});

test('2P Online networking (#236, #352): 2 independent browser sessions join via corner invite toast and render symmetric split-screen arenas in Starlight Burst and Prism Stack (9x18 + solid Hazard Lock Bars)', async ({
  browser,
}) => {
  const stub = await startStubApp();
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx1.addInitScript(() => {
    delete (window as { BroadcastChannel?: unknown }).BroadcastChannel;
  });
  await ctx2.addInitScript(() => {
    delete (window as { BroadcastChannel?: unknown }).BroadcastChannel;
  });
  try {
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto(stub.base);
    await page2.goto(stub.base);

    await expect(page1.getByTestId('online-presence-pill')).toContainText('2 online', {
      timeout: 6000,
    });
    await expect(page2.getByTestId('online-presence-pill')).toContainText('2 online', {
      timeout: 6000,
    });
    await expect(page2.getByTestId('deck-online-count')).toContainText('2 Online');

    // 1. Online 2P Starlight Burst with full symmetric split-screen opponent arena (#352)
    await page1.goto(`${stub.base}?app=starlight-burst`);
    await expect(page1.getByRole('heading', { name: 'Starlight Burst' })).toBeVisible();
    await page1.getByTestId('pause-button').click();
    await expect(page1.getByTestId('sb-2p-online-btn')).toBeEnabled({ timeout: 6000 });
    await page1.getByTestId('sb-2p-online-btn').click();
    await expect(page1.getByTestId('sb-invite-waiting')).toBeVisible();

    const toast2 = page2.getByTestId('netplay-invite-toast');
    await expect(toast2).toBeVisible({ timeout: 6000 });
    await expect(toast2).toContainText('Starlight Burst');
    await page2.getByTestId('netplay-accept-invite').click();

    await expect(page2).toHaveURL(/\?app=starlight-burst/);
    await expect(page1.getByTestId('netplay-ready-modal')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('netplay-ready-modal')).toBeVisible({ timeout: 6000 });

    await page1.getByTestId('netplay-ready-btn').click();
    await page2.getByTestId('netplay-ready-btn').click();
    await expect(page1.getByTestId('netplay-ready-modal')).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByTestId('netplay-ready-modal')).toHaveCount(0, { timeout: 6000 });
    await expect(page1.getByTestId('sb-online-opponent-arena')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('sb-online-opponent-arena')).toBeVisible({ timeout: 6000 });

    // Verify symmetric geometry: both Player 1 card and Online Opponent card have identical widths!
    const sbWidths = await page1.evaluate(() =>
      Array.from(document.querySelectorAll('.sb-player-card')).map((el) =>
        Math.round(el.getBoundingClientRect().width),
      ),
    );
    expect(sbWidths).toHaveLength(2);
    expect(sbWidths[0]).toBe(sbWidths[1]);

    await expect(page1.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    const aimPointsBefore = await page2.getByTestId('sb-opponent-aim').getAttribute('points');
    await page1.keyboard.press('d');
    await expect(page2.getByTestId('sb-opponent-aim')).not.toHaveAttribute(
      'points',
      aimPointsBefore ?? '',
      { timeout: 6000 },
    );

    await page1.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:starlight:fire-resolve', {
          detail: { player: 0, forceClusterPop: true },
        }),
      );
    });

    await expect(page2.getByTestId('sb-opponent-score')).not.toHaveText('0', {
      timeout: 6000,
    });
    await expect(page2.getByTestId('p1-incoming')).not.toHaveText('0', {
      timeout: 6000,
    });
    await expect(page2.getByTestId('p1-incoming-indicator')).toBeVisible();

    await page2.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:starlight:fire-resolve', {
          detail: { player: 0, preventPop: true },
        }),
      );
    });
    const p1BoardOnSession2 = page2.getByRole('img', { name: 'Player 1 starlight board' });
    await expect(p1BoardOnSession2.locator('.sb-rise-star').first()).toBeVisible();

    // 2. Online 2P Prism Stack with symmetric 9x18 split-screen & solid 36-cell Hazard Lock Bars (#352)
    await page1.goto(`${stub.base}?app=prism-stack`);
    await expect(page1.getByRole('heading', { name: 'Prism Stack' })).toBeVisible();
    await page1.getByTestId('pause-button').click();
    await expect(page1.getByTestId('prism-2p-online-btn')).toBeEnabled({ timeout: 6000 });
    await page1.getByTestId('prism-2p-online-btn').click();
    await expect(page1.getByTestId('prism-invite-waiting')).toBeVisible();

    await expect(page2.getByTestId('netplay-invite-toast')).toContainText('Prism Stack', {
      timeout: 6000,
    });
    await page2.getByTestId('netplay-accept-invite').click();

    await expect(page2).toHaveURL(/\?app=prism-stack/);
    await expect(page1.getByTestId('netplay-ready-modal')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('netplay-ready-modal')).toBeVisible({ timeout: 6000 });
    await page1.getByTestId('netplay-ready-btn').click();
    await page2.getByTestId('netplay-ready-btn').click();
    await expect(page1.getByTestId('netplay-ready-modal')).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByTestId('netplay-ready-modal')).toHaveCount(0, { timeout: 6000 });
    await expect(page1.getByTestId('prism-online-opponent-arena')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('prism-online-opponent-arena')).toBeVisible({ timeout: 6000 });
    await expect(page1.getByTestId('prism-hazard-meter')).toBeVisible();
    await expect(page2.getByTestId('prism-hazard-meter')).toBeVisible();

    // Verify symmetric 9x18 board widths in Online 2P!
    const prismWidths = await page1.evaluate(() =>
      Array.from(document.querySelectorAll('.stack-board')).map((el) =>
        Math.round(el.getBoundingClientRect().width),
      ),
    );
    expect(prismWidths).toHaveLength(2);
    expect(prismWidths[0]).toBe(prismWidths[1]);

    await expect(page1.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    const initialPieceX = await page2
      .getByTestId('prism-opponent-active-piece')
      .getAttribute('data-x');
    await page1.keyboard.press('ArrowRight');
    await expect(page2.getByTestId('prism-opponent-active-piece')).not.toHaveAttribute(
      'data-x',
      initialPieceX ?? '',
      { timeout: 6000 },
    );

    // Session 1 triggers a 4-line quad-clear -> sends 4 solid Hazard Lock Bars (`prism_attack`)
    await page1.evaluate(() => {
      window.dispatchEvent(new CustomEvent('yolo:prism:quad-clear'));
    });

    await expect(page2.getByTestId('prism-opponent-score')).toHaveText('800', {
      timeout: 6000,
    });
    await expect(page2.getByTestId('prism-opponent-lines')).toHaveText('4', {
      timeout: 6000,
    });
    await expect(
      page2.getByTestId('prism-hazard-meter').locator('.stack-hazard-segment.is-active'),
    ).toHaveCount(4, { timeout: 6000 });

    // Session 2 hard-drops -> 4 full-width solid Hazard Lock Bars rise (4 rows × 9 columns = 36 '.prism-cell-hazard' cells, ZERO holes!)
    await page2.keyboard.press('Space');
    await expect(
      page2.getByTestId('prism-hazard-meter').locator('.stack-hazard-segment.is-active'),
    ).toHaveCount(0);
    await expect(page2.getByTestId('prism-p1-board').locator('.prism-cell-hazard')).toHaveCount(36);
    await expect(
      page1.getByTestId('prism-opponent-board').locator('.prism-cell-hazard'),
    ).toHaveCount(36, { timeout: 6000 });

    // 3. Network Sync Keep-Alive modal & auto-exit
    await page1.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:netplay:simulate-lag', { detail: { lagging: true } }),
      );
    });
    await expect(page1.getByTestId('netplay-sync-modal')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('netplay-sync-modal')).toBeVisible({ timeout: 6000 });

    await page1.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:netplay:simulate-lag', { detail: { lagging: false } }),
      );
    });
    await expect(page1.getByTestId('netplay-sync-modal')).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByTestId('netplay-sync-modal')).toHaveCount(0, { timeout: 6000 });

    await page1.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:netplay:simulate-lag', {
          detail: { lagging: true, forceElapsedMs: 15_500 },
        }),
      );
    });
    await expect(page1.getByRole('heading', { name: 'Prism Stack' })).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByRole('heading', { name: 'Prism Stack' })).toHaveCount(0, { timeout: 6000 });
  } finally {
    await ctx1.close();
    await ctx2.close();
    await closeStub(stub);
  }
});
