import { test, expect } from './fixtures';
import { startStubApp, type RunningStub } from './stub-server';

/**
 * 2-Player Puzzle Bobble / Bust-A-Move (#181).
 *
 * Player 1 uses ASDF (A/D aim, S or F fire); Player 2 uses Arrow keys
 * (ArrowLeft/ArrowRight aim, ArrowUp/ArrowDown fire).
 */

async function closeStub(stub: RunningStub) {
  stub.server.closeAllConnections();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
}

test('home gallery opens 2-player Puzzle Bobble and both players aim and fire with ASDF and Arrow keys', async ({
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

    // Player 1 aims right with D and shoots with S (or F).
    await expect(page.getByTestId('p1-aim')).toHaveText('0°');
    await page.keyboard.press('d');
    await expect(page.getByTestId('p1-aim')).toHaveText('+3°');
    await page.keyboard.press('f');
    await expect(page.getByTestId('p1-shots')).toHaveText('1', { timeout: 5000 });

    // Player 2 aims left with ArrowLeft and shoots with ArrowUp.
    await expect(page.getByTestId('p2-aim')).toHaveText('0°');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('p2-aim')).toHaveText('-3°');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('p2-shots')).toHaveText('1', { timeout: 5000 });

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
