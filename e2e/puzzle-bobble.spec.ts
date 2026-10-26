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

    // Switch to 1 Player mode and back to 2 Players.
    await page.getByRole('button', { name: '1 Player', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toHaveCount(0);
    await page.getByRole('button', { name: '2 Players', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toBeVisible();

    // #210: Step through the 15 classic levels with Next stage / Previous stage and auto-advance on Next round.
    const stageBtn = page.getByTestId('pb-stage-button');
    await expect(stageBtn).toHaveText('Wave: Random');
    await page.getByRole('button', { name: 'Next stage', exact: true }).click();
    await expect(stageBtn).toHaveText('Stage 1: Paired Blocks');
    await page.getByRole('button', { name: 'Previous stage', exact: true }).click();
    await expect(stageBtn).toHaveText('Wave: Random');
    await page.getByRole('button', { name: 'Previous stage', exact: true }).click();
    await expect(stageBtn).toHaveText("Stage 15: Emperor's Citadel");

    // Escape closes Puzzle Bobble and returns to the blank canvas.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '');
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
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
    // 1. Phone viewport (390x844 < 768px): Puzzle Bobble opens in 1P mode only and hides 2P toggle.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${stub.base}?app=puzzle-bobble`);
    await expect(page.getByRole('img', { name: 'Player 1 bubble board' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '2 Players', exact: true })).toHaveCount(0);

    // Drag on Player 1 board to aim (does NOT fire on release), then tap FIRE button to shoot.
    const p1Board = page.getByRole('img', { name: 'Player 1 bubble board' });
    const box = await p1Board.boundingBox();
    expect(box).not.toBeNull();
    // Touch/drag toward the upper-right of the board -> positive aim angle, 0 shots fired.
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.82, box!.y + box!.height * 0.35);
    await page.mouse.up();
    await expect(page.getByTestId('p1-aim')).toHaveText(/^\+\d+(\.5)?°$/);
    await expect(page.getByTestId('p1-shots')).toHaveText('0');

    // Fine-tap touch button steps by +0.5°, and tapping FIRE shoots the bubble.
    await page.getByTestId('p1-touch-left').dispatchEvent('pointerdown', { pointerId: 1 });
    await page.getByTestId('p1-touch-left').dispatchEvent('pointerup', { pointerId: 1 });
    await page.getByTestId('p1-touch-fire').click();
    await expect(page.getByTestId('p1-shots')).toHaveText('1', { timeout: 5000 });

    // No horizontal or vertical page scroll overflow on 390px phone screen (#217 full-screen game stage),
    // the bare wiggling YOLO mark sits in the top-right with a transparent background (#228),
    // and the YouTube-style fullscreen icon sits in the bottom-left with a transparent background (#228).
    const phoneMetrics = await page.evaluate(() => {
      const fabEl = document.querySelector('[data-testid="yolo-feedback-fab"]');
      const fab = fabEl?.getBoundingClientRect();
      const fabBg = fabEl ? window.getComputedStyle(fabEl).backgroundColor : '';
      const fsEl = document.querySelector('[data-testid="fullscreen-button"]');
      const fs = fsEl?.getBoundingClientRect();
      const fsBg = fsEl ? window.getComputedStyle(fsEl).backgroundColor : '';
      const logo = document.querySelector('[data-testid="yolo-rotating-logo"]');
      const logoPaths = logo ? logo.querySelectorAll('path[d="M48 48v30"]').length : 0;
      const logoViewBox = logo ? logo.getAttribute('viewBox') : '';
      const logoColor = logo ? window.getComputedStyle(logo).color : '';
      const touchBar = document.querySelector('.pb-touch-bar');
      const touchBarBg = touchBar ? window.getComputedStyle(touchBar).backgroundColor : '';
      return {
        horizOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        vertOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        scrollY: window.scrollY,
        fabWidth: fab ? Math.round(fab.width) : 0,
        fabHeight: fab ? Math.round(fab.height) : 0,
        fabTop: fab ? Math.round(fab.top) : 999,
        fabRight: fab ? Math.round(fab.right) : 0,
        fabBg,
        fsLeft: fs ? Math.round(fs.left) : 999,
        fsBottom: fs ? Math.round(fs.bottom) : 0,
        fsBg,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        hasRotatingLogo: Boolean(logo),
        logoPaths,
        logoViewBox,
        logoColor,
        touchBarBg,
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
    expect(phoneMetrics.fsLeft).toBeLessThanOrEqual(24);
    expect(phoneMetrics.fsBottom).toBeGreaterThanOrEqual(phoneMetrics.viewportHeight - 24);
    expect(phoneMetrics.fsBg).toBe('rgba(0, 0, 0, 0)');
    expect(phoneMetrics.touchBarBg).toBe('rgba(0, 0, 0, 0)');

    // 2. Phone landscape viewport (844x390, short edge 390 < 560px): still a phone, so 1P mode is enforced.
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '2 Players', exact: true })).toHaveCount(0);

    // 3. Tablets across MS Edge / Safari / Chrome (600x960 Android portrait, 744x1133 iPad Mini 6 portrait,
    // 768x1024 iPad portrait, 960x480 landscape with MS Edge toolbars, 1024x768 landscape):
    // 2 Players side-by-side is available and fits side-by-side without wrapping (#212, #222).
    for (const [w, h] of [
      [600, 960],
      [744, 1133],
      [768, 1024],
      [960, 480],
      [1024, 768],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
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

    // Simultaneous 4-finger multi-touch on 2P tablet (#224): Player 1 holds AIM ▶ (pointerId 11)
    // while Player 2 holds ◀ AIM (pointerId 21), and both players tap ● FIRE with a second thumb
    // (pointerId 12 and 22, isPrimary: false) while aim fingers remain held down.
    await page.getByTestId('p1-touch-right').dispatchEvent('pointerdown', { pointerId: 11, isPrimary: true });
    await page.getByTestId('p2-touch-left').dispatchEvent('pointerdown', { pointerId: 21, isPrimary: false });
    await expect(page.getByTestId('p1-aim')).not.toHaveText('0°');
    await expect(page.getByTestId('p2-aim')).not.toHaveText('0°');
    await page.getByTestId('p1-touch-fire').dispatchEvent('pointerdown', { pointerId: 12, isPrimary: false });
    await page.getByTestId('p2-touch-fire').dispatchEvent('pointerdown', { pointerId: 22, isPrimary: false });
    await page.getByTestId('p1-touch-right').dispatchEvent('pointerup', { pointerId: 11 });
    await page.getByTestId('p2-touch-left').dispatchEvent('pointerup', { pointerId: 21 });
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

    // 5. Tetris touch controls work on phone without a keyboard.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${stub.base}?app=tetris`);
    await expect(page.getByTestId('tetris-touch-controls')).toBeVisible();
    await page.getByTestId('tetris-touch-rotate').click();
    await page.getByTestId('tetris-touch-drop').click();
    await expect(page.locator('.tetris-side .tetris-value').first()).not.toHaveText('0');
  } finally {
    await closeStub(stub);
  }
});

