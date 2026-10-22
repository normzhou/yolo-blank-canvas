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
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('p2-aim')).toHaveText('-0.5°');
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('yolo:puzzle-bobble:fire-resolve', {
          detail: { player: 1 },
        }),
      );
    });
    await expect(page.getByTestId('p2-shots')).toHaveText('1');
    const p2Board = page.getByRole('img', { name: 'Player 2 bubble board' });
    await expect(p2Board.locator('.pb-rise-bubble')).toHaveCount(3);

    // #195: Both player cards and side panels keep identical widths and horizontal positions
    // across aiming, incoming garbage orbs, and shot resolution (zero layout jitter).
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
