import { test, expect } from './fixtures';
import { startStubApp, type RunningStub } from './stub-server';

/**
 * Canvas content gallery (#165).
 *
 * The first modular canvas app, Tetris, is reachable from the home canvas, from
 * `?app=tetris`, and from a keyboard palette. The assertions below are about the
 * shell contract, not the game: navigation is addressable, the palette is
 * transient, and Escape belongs to the top overlay.
 */

async function openPalette(page: import('@playwright/test').Page) {
  await page.keyboard.press('Control+k');
  return page.getByRole('dialog', { name: 'Canvas apps' });
}

/** Idle keep-alive sockets can keep `server.close()` waiting past the test timeout. */
async function closeStub(stub: RunningStub) {
  stub.server.closeAllConnections();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
}

test('the home gallery opens Tetris and close returns to the canvas', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();

    const gallery = page.getByRole('navigation', { name: 'Canvas gallery' });
    await gallery.getByRole('button', { name: 'Tetris', exact: true }).click();

    await expect(page).toHaveURL(/\?app=tetris$/);
    await expect(page.getByRole('heading', { name: 'Tetris' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();

    await page.getByRole('button', { name: 'Close Tetris' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '');
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
  } finally {
    await closeStub(stub);
  }
});

test('an app is a cold deep link, and back returns to the canvas', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=tetris`);
    await expect(page.getByRole('heading', { name: 'Tetris' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();

    // A cold link has no same-document entry behind it, so exercise Back from a
    // real navigation instead of asserting that history invents a canvas.
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Tetris', exact: true }).click();
    await expect(page).toHaveURL(/\?app=tetris$/);

    // Evaluate in a task so the page's execution context survives the history
    // navigation; awaiting `history.back()` directly can race the context swap.
    await page.evaluate(() => { window.setTimeout(() => history.back(), 0); });
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '');
  } finally {
    await closeStub(stub);
  }
});

test('the palette switches from an app and restores focus on close', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=tetris`);
    await expect(page.getByRole('heading', { name: 'Tetris' })).toBeVisible();

    const palette = await openPalette(page);
    await expect(palette).toBeVisible();
    await expect(palette.getByRole('button', { name: 'Tetris', exact: true })).toHaveAttribute('aria-current', 'page');

    await palette.getByRole('button', { name: 'Blank canvas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '');

    const reopened = await openPalette(page);
    await expect(reopened).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(reopened).toHaveCount(0);
  } finally {
    await closeStub(stub);
  }
});

test('Escape closes the palette before the app, and the tilde alias opens it', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=tetris`);
    await expect(page.getByRole('heading', { name: 'Tetris' })).toBeVisible();

    await page.keyboard.press('Shift+Backquote');
    const palette = page.getByRole('dialog', { name: 'Canvas apps' });
    await expect(palette).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);
    // The first Escape belonged to the palette; the app is still where it was.
    await expect(page.getByRole('heading', { name: 'Tetris' })).toBeVisible();
    await expect(page).toHaveURL(/\?app=tetris$/);

    // The second Escape reaches the app and leaves it.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
  } finally {
    await closeStub(stub);
  }
});

test('opening the palette over Requests closes the panel first', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Requests' });
    await expect(panel).toBeVisible();

    const palette = await openPalette(page);
    await expect(palette).toBeVisible();
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '');
  } finally {
    await closeStub(stub);
  }
});

test('the tilde is not stolen from a text field', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Start a request', exact: true }).click();
    const title = page.getByLabel('Title');
    await expect(title).toBeVisible();
    await title.click();
    await page.keyboard.press('Shift+Backquote');
    await expect(page.getByRole('dialog', { name: 'Canvas apps' })).toHaveCount(0);
    await expect(title).toHaveValue('~');
  } finally {
    await closeStub(stub);
  }
});

test('the game slide deck flips between slides and switches active games in place (#187)', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    const card = page.getByTestId('deck-slide-card');
    await expect(card).toHaveAttribute('data-slide-id', 'tetris');
    await expect(page.getByRole('button', { name: 'Play Tetris', exact: true })).toBeVisible();

    // Flip to the next slide on the home deck.
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(card).toHaveAttribute('data-slide-id', 'puzzle-bobble');
    await expect(page.getByRole('button', { name: 'Play Puzzle Bobble', exact: true })).toBeVisible();

    // Launch Puzzle Bobble directly from the slide deck card.
    await page.getByRole('button', { name: 'Play Puzzle Bobble', exact: true }).click();
    await expect(page).toHaveURL(/\?app=puzzle-bobble$/);
    await expect(page.getByRole('heading', { name: 'Puzzle Bobble' })).toBeVisible();

    // Prev slide while a game is active flips directly to Tetris on stage.
    await page.getByRole('button', { name: 'Previous slide' }).click();
    await expect(page).toHaveURL(/\?app=tetris$/);
    await expect(page.getByRole('heading', { name: 'Tetris' })).toBeVisible();
  } finally {
    await closeStub(stub);
  }
});
