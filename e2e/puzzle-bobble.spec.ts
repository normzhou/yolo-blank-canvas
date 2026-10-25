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
    await expect(p1Mascot).toHaveAttribute('data-mood', 'normal');
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

    // No horizontal overflow on 390px phone screen.
    const phoneOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(phoneOverflow).toBeLessThanOrEqual(0);

    // 2. Tablet / iPad viewport (1024x768 >= 768px): 2 Players side-by-side is available and fits side-by-side.
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.getByRole('button', { name: '2 Players', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Player 1 bubble board' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toBeVisible();
    const cardTops = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.pb-player-card')).map((el) =>
        Math.round(el.getBoundingClientRect().top),
      ),
    );
    expect(cardTops).toEqual([cardTops[0], cardTops[0]]);

    // 3. Tetris touch controls work on phone without a keyboard.
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

