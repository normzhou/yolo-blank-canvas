import { test, expect } from './fixtures';
import { startStubApp, type RunningStub } from './stub-server';

/**
 * 2-Player Puzzle Bobble / Bust-A-Move (#181, #183, #186).
 *
 * Player 1 uses ASDF (A/D fine 0.5° tap or smooth 60fps hold aim, S or F fire);
 * Player 2 uses Arrow keys (ArrowLeft/ArrowRight fine aim, ArrowUp/ArrowDown fire).
 */

async function closeStub(stub: RunningStub) {
  stub.server.closeAllConnections();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
}

test('home gallery opens 2-player Puzzle Bobble, aims with 0.5° taps, displays incoming attack indicators, and animates bubbles rising from the bottom', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    const gallery = page.getByRole('navigation', { name: 'Canvas gallery' });
    await gallery.getByRole('button', { name: 'Puzzle Bobble', exact: true }).click();

    await expect(page).toHaveURL(/\?app=puzzle-bobble$/);
    await expect(page.getByRole('heading', { name: 'Puzzle Bobble' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Player 1 bubble board' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toBeVisible();

    // #252: Game opens on the Game Menu first; clicking Continue starts the 3, 2, 1 car-race countdown
    // rendered as plain arcade text (no circle border) with countdown sound effects.
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByTestId('pause-menu-resume').click();
    await expect(page.getByTestId('arcade-countdown')).toBeVisible();
    await expect(page.getByTestId('arcade-countdown')).toHaveAttribute(
      'data-lang',
      /^(en|zh|hi|es|fr|ar|bn|pt|ru|ur)$/,
    );
    const countdownBorderStyle = await page
      .locator('.arcade-countdown-digit')
      .evaluate((el) => getComputedStyle(el).borderStyle);
    expect(countdownBorderStyle).toBe('none');
    await expect(page.getByTestId('p1-touch-controls')).toHaveCount(0);

    // #258: Gameplay inputs are strictly locked while countdown > 0, and unlock once countdown completes.
    await page.keyboard.press('d');
    await expect(page.getByTestId('p1-aim')).toHaveText('0°');
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });

    // Player 1 aims right with fine 0.5° taps on D and shoots with F.
    await expect(page.getByTestId('p1-aim')).toHaveText('0°');
    await page.keyboard.press('d');
    await expect(page.getByTestId('p1-aim')).toHaveText('+0.5°');
    await page.keyboard.press('d');
    await expect(page.getByTestId('p1-aim')).toHaveText('+1°');
    await page.keyboard.press('f');
    await expect(page.getByTestId('p1-shots')).toHaveText('1', { timeout: 5000 });

    // Queue 3 incoming attack bubbles sent to Player 2 and verify the on-board indicator
    // and bottom staging bubbles that are about to come up.
    const boxBefore = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.pb-player-card')).map((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
      });
      const sides = Array.from(document.querySelectorAll('.pb-side')).map((el) => {
        const r = el.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height) };
      });
      return { cards, sides };
    });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:puzzle-bobble:queue-garbage', {
          detail: { player: 1, colors: ['ruby', 'amber', 'emerald'] },
        }),
      );
    });
    const p2Indicator = page.getByTestId('p2-incoming-indicator');
    await expect(p2Indicator).toBeVisible();
    await expect(p2Indicator.locator('.pb-incoming-preview-bubble')).toHaveCount(3);
    await expect(page.getByTestId('p2-incoming')).toContainText('3');

    // Player 2 aims left with a fine 0.5° tap on ArrowLeft and resolves a shot ->
    // the 3 incoming bubbles rise from the bottom with `.pb-rise-bubble`!
    // Ensure the center target cells won't accidentally match 3 of a kind with Player 2's active bubble.
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('p2-aim')).toHaveText('-0.5°');
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:puzzle-bobble:fire-resolve', {
          detail: { player: 1, preventPop: true },
        }),
      );
    });
    await expect(page.getByTestId('p2-shots')).toHaveText('1');
    const p2Board = page.getByRole('img', { name: 'Player 2 bubble board' });
    await expect(p2Board.locator('.pb-rise-bubble')).toHaveCount(3);

    // #204: Players can select cute characters (Dragon, Cat, Dog, Bunny) independently.
    const p1Mascot = page.getByTestId('p1-mascot');
    const p2Mascot = page.getByTestId('p2-mascot');
    await expect(p1Mascot).toHaveAttribute('data-character', 'dragon');
    await expect(p2Mascot).toHaveAttribute('data-character', 'dragon');
    await expect(p1Mascot).toHaveAttribute('data-mood', /^(?:normal|cheer)$/);
    await expect(p2Mascot).toHaveAttribute('data-mood', 'normal');

    await page.getByTestId('p1-character-picker').getByRole('button', { name: 'Cat', exact: true }).click();
    await page.getByTestId('p2-character-picker').getByRole('button', { name: 'Dog', exact: true }).click();
    await expect(p1Mascot).toHaveAttribute('data-character', 'cat');
    await expect(p2Mascot).toHaveAttribute('data-character', 'dog');
    await expect(page.getByTestId('p1-title')).toHaveText('1P · Mochi');
    await expect(page.getByTestId('p2-title')).toHaveText('2P · Koro');

    // #204: When one side wins, the winning character celebrates (.pb-mascot-celebrate + sparkles)
    // and the losing character cries (.pb-mascot-cry + falling teardrops).
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:puzzle-bobble:round-outcome', {
          detail: { winner: 0 },
        }),
      );
    });
    await expect(p1Mascot).toHaveAttribute('data-mood', 'celebrate');
    await expect(p2Mascot).toHaveAttribute('data-mood', 'cry');
    await expect(p1Mascot.locator('.pb-mascot-sparkle').first()).toBeVisible();
    await expect(p2Mascot.locator('.pb-mascot-tear').first()).toBeVisible();

    // #195: Both player cards and side panels keep identical widths and horizontal positions
    // across aiming, character selection, incoming garbage orbs, shot resolution, and win/lose animations.
    const boxAfter = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.pb-player-card')).map((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
      });
      const sides = Array.from(document.querySelectorAll('.pb-side')).map((el) => {
        const r = el.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height) };
      });
      return { cards, sides };
    });
    expect(boxAfter).toEqual(boxBefore);

    // #248: Mode and Stage selection live inside the unified In-Game Menu (Pause / Escape),
    // and 2P Online is disabled when only 1 player is online.
    await page.getByTestId('pause-button').click();
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await expect(page.getByTestId('pb-2p-online-btn')).toBeDisabled();

    // Switch to 1 Player mode and back to 2 Players via the Pause Menu.
    await page.getByRole('button', { name: '1 Player', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toHaveCount(0);
    await page.getByTestId('pause-button').click();
    await page.getByRole('button', { name: '2 Players', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toBeVisible();

    // #210: Step through the 15 classic levels with Next stage / Previous stage inside the Pause Menu.
    await page.getByTestId('pause-button').click();
    const stageBtn = page.getByTestId('pb-stage-button');
    await expect(stageBtn).toHaveText('Wave: Random');
    await page.getByRole('button', { name: 'Next stage', exact: true }).click();
    await page.getByTestId('pause-button').click();
    await expect(stageBtn).toHaveText('Stage 1: Paired Blocks');
    await page.getByRole('button', { name: 'Previous stage', exact: true }).click();
    await page.getByTestId('pause-button').click();
    await expect(stageBtn).toHaveText('Wave: Random');
    await page.getByRole('button', { name: 'Previous stage', exact: true }).click();
    await page.getByTestId('pause-button').click();
    await expect(stageBtn).toHaveText("Stage 15: Emperor's Citadel");
    await page.getByTestId('pause-menu-resume').click();

    // #232, #234: Puzzle Bobble plays its own whimsical ~2-minute soundtrack verified via closed-loop Web Audio AnalyserNode,
    // and Escape back to the Selector Screen crossfades smoothly into the selector soundtrack!
    await page.getByRole('button', { name: /Music off/ }).click();
    await expect(page.locator('.tetris-scene')).toContainText(
      /Music: (?:Bubble Dragon March|Rainbow Island Carnival|Starlight Carousel|Candy Cloud Playground|Bubblegum Soda Pop)/,
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

    // Escape opens the in-game Pause Menu (#237), and Exit to menu returns to the selector screen.
    // Flipping the selector slide to Tetris crossfades to the Tetris soundtrack (#240).
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByRole('button', { name: 'Close Puzzle Bobble' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '');
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
    await page.getByRole('button', { name: 'Previous slide' }).click();
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
            Boolean(m.trackId && !m.trackId.startsWith('pb-')) &&
            m.sfxLog.includes('bubble-shoot') &&
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

test('Feedback on Puzzle Bobble carries app context and isolates ASDF/Arrow keys from the boards', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=puzzle-bobble`);
    await expect(page.getByRole('heading', { name: 'Puzzle Bobble' })).toBeVisible();

    const feedback = page.getByRole('button', { name: 'Feedback on Puzzle Bobble' });
    await feedback.click();
    await expect(page).toHaveURL(/\?app=puzzle-bobble&panel=new$/);
    await expect(page.locator('.request-context-summary')).toContainText(
      'App: Puzzle Bobble (?app=puzzle-bobble)',
    );

    // Typing ASDF and arrow keys inside the composer must not aim or fire either board underneath.
    await page.getByLabel('Title').fill('asdf arrows test');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/\?app=puzzle-bobble$/);
    await expect(page.getByTestId('p1-aim')).toHaveText('0°');
    await expect(page.getByTestId('p2-aim')).toHaveText('0°');
    await expect(page.getByTestId('p1-shots')).toHaveText('0');
    await expect(page.getByTestId('p2-shots')).toHaveText('0');
  } finally {
    await closeStub(stub);
  }
});

test('mobile and tablet touch support: phone (< 768px) enforces 1P mode, tablet (>= 768px) supports 2P side-by-side, and touch drag-to-aim + FIRE button and Tetris touch pad work without a keyboard (#212)', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    // 1. Phone viewport (390x844 < 768px): Puzzle Bobble opens in 1P mode on the Game Menu and hides 2P Local.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${stub.base}?app=puzzle-bobble`);
    await expect(page.getByRole('img', { name: 'Player 1 bubble board' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toHaveCount(0);
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await expect(page.getByRole('button', { name: '2 Players', exact: true })).toHaveCount(0);
    await page.getByTestId('pause-menu-resume').click();
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });

    // #258: Puzzle Bobble has no on-screen touch button bar (`p1-touch-controls` is removed);
    // touch play is 100% direct screen touch/drag-to-aim and release-to-shoot!
    await expect(page.getByTestId('p1-touch-controls')).toHaveCount(0);

    // #248, #258: Dragging on Player 1 board to aim and releasing (`mouse.up`) automatically fires the bubble!
    const p1Board = page.getByRole('img', { name: 'Player 1 bubble board' });
    const box = await p1Board.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.82, box!.y + box!.height * 0.35);
    await page.mouse.up();
    await expect(page.getByTestId('p1-aim')).toHaveText(/^\+\d+(\.5)?°$/);
    await expect(page.getByTestId('p1-shots')).toHaveText('1', { timeout: 5000 });

    // No horizontal or vertical page scroll overflow on 390px phone screen (#217 full-screen game stage),
    // the bare wiggling YOLO mark sits in the top-right with a transparent background (#228),
    // and the YouTube-style fullscreen icon sits in the bottom-right with a transparent background (#228, #230).
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
        fabTop: fab ? Math.round(fab.top) : 999,
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
    expect(phoneMetrics.fabWidth).toBeLessThanOrEqual(48);
    expect(phoneMetrics.fabHeight).toBeLessThanOrEqual(48);
    expect(phoneMetrics.fabTop).toBeLessThanOrEqual(24);
    expect(phoneMetrics.fabRight).toBeGreaterThanOrEqual(phoneMetrics.viewportWidth - 24);
    expect(phoneMetrics.fabBg).toBe('rgba(0, 0, 0, 0)');
    expect(phoneMetrics.fsRight).toBeGreaterThanOrEqual(phoneMetrics.viewportWidth - 24);
    expect(phoneMetrics.fsBottom).toBeGreaterThanOrEqual(phoneMetrics.viewportHeight - 24);
    expect(phoneMetrics.fsBg).toBe('rgba(0, 0, 0, 0)');
    expect(phoneMetrics.sndRight).toBeLessThan(phoneMetrics.fsRight);
    expect(phoneMetrics.sndBottom).toBe(phoneMetrics.fsBottom);
    expect(phoneMetrics.sndBg).toBe('rgba(0, 0, 0, 0)');

    // 2. Phone landscape viewport (844x390, short edge 390 < 560px): still a phone, so 1P mode is enforced.
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '2 Players', exact: true })).toHaveCount(0);

    // 3. Tablets across MS Edge / Safari / Chrome (600x960 Android portrait, 744x1133 iPad Mini 6 portrait,
    // 768x1024 iPad portrait, 960x480 landscape with MS Edge toolbars, 1024x768 landscape):
    // 2 Players side-by-side is available in the Pause Menu and fits side-by-side without wrapping (#212, #222, #248).
    for (const [w, h] of [
      [600, 960],
      [744, 1133],
      [768, 1024],
      [960, 480],
      [1024, 768],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.getByTestId('pause-button').click();
      await page.getByRole('button', { name: '2 Players', exact: true }).click();
      await expect(page.getByRole('img', { name: 'Player 1 bubble board' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toBeVisible();
      const cardTops = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.pb-player-card')).map((el) =>
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
    // Direct screen drag-to-aim and release-to-shoot on both Player 1 and Player 2 boards on 2P tablet (#258).
    const p1TabBox = await page.getByRole('img', { name: 'Player 1 bubble board' }).boundingBox();
    const p2TabBox = await page.getByRole('img', { name: 'Player 2 bubble board' }).boundingBox();
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

    // Site starts in fullscreen mode by default, controlled by the bottom-left YouTube-style icon (#222, #228).
    const fsBtn = page.getByTestId('fullscreen-button');
    await expect(fsBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(fsBtn).toHaveText('Exit full screen');
    await fsBtn.click();
    await expect(fsBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(fsBtn).toHaveText('Full screen');
    await fsBtn.click();
    await expect(fsBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(fsBtn).toHaveText('Exit full screen');

    // 4. Small Phone (360x640): 1P card and side panel are never clipped horizontally.
    await page.setViewportSize({ width: 360, height: 640 });
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toHaveCount(0);
    const smallPhoneClipped = await page.evaluate(() => {
      const side = document.querySelector('.pb-side')?.getBoundingClientRect();
      const card = document.querySelector('.pb-player-card')?.getBoundingClientRect();
      return side && card ? side.right > card.right + 1 : true;
    });
    expect(smallPhoneClipped).toBe(false);

    // 5. Tetris touch controls work on phone without a keyboard (after countdown finishes).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${stub.base}?app=tetris`);
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByTestId('pause-menu-resume').click();
    await expect(page.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    await expect(page.getByTestId('tetris-touch-controls')).toBeVisible();
    await page.getByTestId('tetris-touch-rotate').click();
    await page.getByTestId('tetris-touch-drop').click();
    await expect(page.locator('.tetris-side .tetris-value').first()).not.toHaveText('0');
  } finally {
    await closeStub(stub);
  }
});

test('2P Online networking (#236): 2 independent browser sessions discover presence, join via corner invite toast, exchange live garbage attacks and rising garbage, and update Opponent Mini-Radars in Puzzle Bobble and Tetris', async ({
  browser,
}) => {
  const stub = await startStubApp();
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // Disable BroadcastChannel in both contexts to simulate two completely different
  // browsers (e.g. Chrome and Safari) that can only communicate via `/api/netplay` (#244).
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

    // 1. Both isolated browser sessions register presence and see "2 online" (aria-label="2 players online").
    await expect(page1.getByTestId('online-presence-pill')).toContainText('2 online', {
      timeout: 6000,
    });
    await expect(page1.getByTestId('online-presence-pill')).toHaveAttribute(
      'aria-label',
      '2 players online',
    );
    await expect(page2.getByTestId('online-presence-pill')).toContainText('2 online', {
      timeout: 6000,
    });
    await expect(page2.getByTestId('deck-online-count')).toContainText('2 Online');

    // 2. Browser Session 1 opens Puzzle Bobble (entering directly on the Game Menu) and broadcasts an open 2P Online invite.
    await page1.goto(`${stub.base}?app=puzzle-bobble`);
    await expect(page1.getByRole('heading', { name: 'Puzzle Bobble' })).toBeVisible();
    await expect(page1.getByTestId('game-pause-menu')).toBeVisible();
    await expect(page1.getByTestId('pb-2p-online-btn')).toBeEnabled({ timeout: 6000 });
    await page1.getByTestId('pb-2p-online-btn').click();
    await expect(page1.getByTestId('pb-invite-waiting')).toBeVisible();
    await expect(page1.getByTestId('netplay-invite-countdown')).toContainText(/\d+s/);

    // Browser Session 2 (browsing the home canvas) sees the non-blocking corner invite toast and clicks Accept.
    const toast2 = page2.getByTestId('netplay-invite-toast');
    await expect(toast2).toBeVisible({ timeout: 6000 });
    await expect(toast2).toContainText('Puzzle Bobble');
    await page2.getByTestId('netplay-accept-invite').click();

    // Browser Session 2 automatically navigates to Puzzle Bobble, and BOTH sessions enter the Ready Check modal (#248)!
    await expect(page2).toHaveURL(/\?app=puzzle-bobble/);
    await expect(page1.getByTestId('netplay-ready-modal')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('netplay-ready-modal')).toBeVisible({ timeout: 6000 });

    // Both players click Ready! -> Ready Check closes and both sessions show their single local board + Opponent Mini-Radar.
    await page1.getByTestId('netplay-ready-btn').click();
    await page2.getByTestId('netplay-ready-btn').click();
    await expect(page1.getByTestId('netplay-ready-modal')).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByTestId('netplay-ready-modal')).toHaveCount(0, { timeout: 6000 });
    await expect(page1.getByTestId('pb-opponent-radar')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('pb-opponent-radar')).toBeVisible({ timeout: 6000 });
    await expect(page1.getByRole('img', { name: 'Player 2 bubble board' })).toHaveCount(0);
    await expect(page2.getByRole('img', { name: 'Player 2 bubble board' })).toHaveCount(0);

    // #256: Browser Session 1 aims right (after countdown completes) -> Browser Session 2's Opponent Mini-Radar aim needle (`pb-opponent-aim`)
    // smoothly rotates via ~2Hz (500ms) radar updates!
    await expect(page1.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    await page1.keyboard.press('d');
    await expect(page2.getByTestId('pb-opponent-aim')).toHaveAttribute(
      'style',
      /rotate\(0\.5deg\)/,
      { timeout: 6000 },
    );

    // Browser Session 1 pops a 5-bubble cluster (`forceClusterPop: true`) -> sends garbage attack + radar state
    // over `/api/netplay` to Browser Session 2!
    await page1.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:puzzle-bobble:fire-resolve', {
          detail: { player: 0, forceClusterPop: true },
        }),
      );
    });

    // Browser Session 2's Opponent Mini-Radar updates live with Session 1's score, AND Session 2's incoming
    // warning counter (`p1-incoming`) and bottom staging tray (`p1-incoming-indicator`) show the attack bubbles!
    await expect(page2.getByTestId('pb-opponent-score')).not.toHaveText('0 pts', {
      timeout: 6000,
    });
    await expect(page2.getByTestId('p1-incoming')).not.toHaveText('0', {
      timeout: 6000,
    });
    await expect(page2.getByTestId('p1-incoming-indicator')).toBeVisible();

    // Browser Session 2 resolves a non-popping shot -> those incoming attack bubbles rise from the bottom
    // of Session 2's board (`.pb-rise-bubble`), and Session 1's Opponent Mini-Radar updates with Session 2's state!
    await page2.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:puzzle-bobble:fire-resolve', {
          detail: { player: 0, preventPop: true },
        }),
      );
    });
    const p2BoardOnSession2 = page2.getByRole('img', { name: 'Player 1 bubble board' });
    await expect(p2BoardOnSession2.locator('.pb-rise-bubble').first()).toBeVisible();
    await page1.screenshot({ path: 'e2e/screenshots/15-netplay-pb-session1.png' });
    await page2.screenshot({ path: 'e2e/screenshots/15-netplay-pb-session2.png' });

    // 3. Now test 2P Online Tetris end-to-end across the two browser sessions.
    await page1.goto(`${stub.base}?app=tetris`);
    await expect(page1.getByRole('heading', { name: 'Tetris' })).toBeVisible();
    await expect(page1.getByTestId('game-pause-menu')).toBeVisible();
    await expect(page1.getByTestId('tetris-2p-online-btn')).toBeEnabled({ timeout: 6000 });
    await page1.getByTestId('tetris-2p-online-btn').click();
    await expect(page1.getByTestId('tetris-invite-waiting')).toBeVisible();

    // Browser Session 2 receives the Tetris corner invite toast, accepts, and both players click Ready!
    await expect(page2.getByTestId('netplay-invite-toast')).toContainText('Tetris', {
      timeout: 6000,
    });
    await page2.getByTestId('netplay-accept-invite').click();

    await expect(page2).toHaveURL(/\?app=tetris/);
    await expect(page1.getByTestId('netplay-ready-modal')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('netplay-ready-modal')).toBeVisible({ timeout: 6000 });
    await page1.getByTestId('netplay-ready-btn').click();
    await page2.getByTestId('netplay-ready-btn').click();
    await expect(page1.getByTestId('netplay-ready-modal')).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByTestId('netplay-ready-modal')).toHaveCount(0, { timeout: 6000 });
    await expect(page1.getByTestId('tetris-opponent-radar')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('tetris-opponent-radar')).toBeVisible({ timeout: 6000 });
    await expect(page1.getByTestId('tetris-garbage-meter')).toBeVisible();
    await expect(page2.getByTestId('tetris-garbage-meter')).toBeVisible();

    // #256: Browser Session 1 moves the active falling tetromino right -> Browser Session 2's Opponent Mini-Radar
    // active piece overlay (`tetris-opponent-active-piece`) smoothly translates via ~2Hz (500ms) radar updates!
    await expect(page1.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByTestId('arcade-countdown')).toHaveCount(0, { timeout: 6000 });
    const initialPieceStyle = await page2
      .getByTestId('tetris-opponent-active-piece')
      .getAttribute('style');
    await page1.keyboard.press('ArrowRight');
    await expect(page2.getByTestId('tetris-opponent-active-piece')).not.toHaveAttribute(
      'style',
      initialPieceStyle ?? '',
      { timeout: 6000 },
    );

    // Browser Session 1 clears a 4-line Tetris -> sends 4 garbage lines (`tetris_attack`) + radar state
    // over `/api/netplay` to Browser Session 2!
    await page1.evaluate(() => {
      window.dispatchEvent(new CustomEvent('yolo:tetris:four-line-clear'));
    });

    // Browser Session 2 sees Session 1's score (`800 pts`) and lines (`4L`) in the Opponent Mini-Radar,
    // AND Session 2's vertical incoming garbage meter lights up with 4 active segments!
    await expect(page2.getByTestId('tetris-opponent-score')).toHaveText('800 pts', {
      timeout: 6000,
    });
    await expect(page2.getByTestId('tetris-opponent-lines')).toHaveText('4L', {
      timeout: 6000,
    });
    await expect(
      page2.getByTestId('tetris-garbage-meter').locator('.tetris-garbage-segment.is-active'),
    ).toHaveCount(4, { timeout: 6000 });

    // Browser Session 2 presses Space (hard-drop without clearing a line) ->
    // the 4 incoming garbage lines rise from the bottom of Session 2's board as 36 grey `.tetromino-g` cells
    // (4 rows × 9 filled columns + 1 hole column per row), and Session 1's Opponent Mini-Radar renders
    // Session 2's risen `.tetris-radar-cell.tetromino-g` rows live!
    await page2.keyboard.press('Space');
    await expect(
      page2.getByTestId('tetris-garbage-meter').locator('.tetris-garbage-segment.is-active'),
    ).toHaveCount(0);
    await expect(page2.locator('.tetris-board .tetris-cell.tetromino-g')).toHaveCount(36);
    await expect(
      page1.getByTestId('tetris-opponent-radar').locator('.tetris-radar-cell.tetromino-g'),
    ).toHaveCount(36, { timeout: 6000 });

    // 4. Network Sync Keep-Alive: if Session 1 has network issues, BOTH Session 1 and Session 2
    // automatically pause with `netplay-sync-modal` and the 15s countdown (`netplay-sync-countdown`) (#250).
    await page1.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:netplay:simulate-lag', { detail: { lagging: true } }),
      );
    });
    await expect(page1.getByTestId('netplay-sync-modal')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('netplay-sync-modal')).toBeVisible({ timeout: 6000 });
    await expect(page2.getByTestId('netplay-sync-countdown')).toContainText(/Exiting in \d+s/);

    // When Session 1 reconnects before 15s, BOTH sides automatically close the sync modal and resume!
    await page1.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:netplay:simulate-lag', { detail: { lagging: false } }),
      );
    });
    await expect(page1.getByTestId('netplay-sync-modal')).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByTestId('netplay-sync-modal')).toHaveCount(0, { timeout: 6000 });

    // When a player cannot be re-synced within 15s, both sides automatically exit the match!
    await page1.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:netplay:simulate-lag', {
          detail: { lagging: true, forceElapsedMs: 15_500 },
        }),
      );
    });
    await expect(page1.getByRole('heading', { name: 'Tetris' })).toHaveCount(0, { timeout: 6000 });
    await expect(page2.getByRole('heading', { name: 'Tetris' })).toHaveCount(0, { timeout: 6000 });

    await page1.screenshot({ path: 'e2e/screenshots/16-netplay-tetris-session1.png' });
    await page2.screenshot({ path: 'e2e/screenshots/16-netplay-tetris-session2.png' });
  } finally {
    await ctx1.close();
    await ctx2.close();
    await closeStub(stub);
  }
});

