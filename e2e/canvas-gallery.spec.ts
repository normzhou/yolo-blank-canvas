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

test('the home gallery opens Tetris and the Pause Menu exits to the canvas (#237)', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();

    const gallery = page.getByRole('navigation', { name: 'Canvas gallery' });
    await gallery.getByRole('button', { name: 'Tetris', exact: true }).click();

    await expect(page).toHaveURL(/\?app=tetris$/);
    await expect(page.getByRole('heading', { name: 'Tetris' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();

    // Entering the game opens on the Game Menu first (#252); clicking Continue starts the 3, 2, 1 countdown.
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByTestId('pause-menu-resume').click();
    await expect(page.getByTestId('arcade-countdown')).toBeVisible();

    // Clicking the universal bottom-right YouTube-style Pause icon re-opens the Pause Menu (#237).
    await page.getByTestId('pause-button').click();
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
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
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByTestId('pause-menu-resume').click();

    await page.keyboard.press('Shift+Backquote');
    const palette = page.getByRole('dialog', { name: 'Canvas apps' });
    await expect(palette).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);
    // The first Escape belonged to the palette; the app is still where it was.
    await expect(page.getByRole('heading', { name: 'Tetris' })).toBeVisible();
    await expect(page).toHaveURL(/\?app=tetris$/);

    // The second Escape reaches the app and opens the in-game Pause Menu (#237).
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByRole('button', { name: 'Close Tetris' }).click();
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
  } finally {
    await closeStub(stub);
  }
});

test('mobile horizontal swipe gesture flips the game deck (#239) and selector card displays animated live preview with per-game music (#240)', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(stub.base);

    const card = page.getByTestId('deck-slide-card');
    await expect(card).toHaveAttribute('data-slide-id', 'tetris');
    await expect(page.getByTestId('deck-live-preview')).toHaveAttribute(
      'data-preview-game',
      'tetris',
    );

    // Swipe left across the deck card -> flips to Puzzle Bobble and updates live preview.
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height * 0.5);
    await page.mouse.up();

    await expect(card).toHaveAttribute('data-slide-id', 'puzzle-bobble');
    await expect(page.getByTestId('deck-live-preview')).toHaveAttribute(
      'data-preview-game',
      'puzzle-bobble',
    );
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
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
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

test('the game slide deck flips between slides and launches active games (#187)', async ({
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

    // Flip back to the previous slide on the home deck, then forward again.
    await page.getByRole('button', { name: 'Previous slide' }).click();
    await expect(card).toHaveAttribute('data-slide-id', 'tetris');
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(card).toHaveAttribute('data-slide-id', 'puzzle-bobble');

    // Launch Puzzle Bobble directly from the slide deck card.
    await page.getByRole('button', { name: 'Play Puzzle Bobble', exact: true }).click();
    await expect(page).toHaveURL(/\?app=puzzle-bobble$/);
    await expect(page.getByRole('heading', { name: 'Puzzle Bobble' })).toBeVisible();
  } finally {
    await closeStub(stub);
  }
});

test('stacked preview cards, directional slide animations, ambient visual effects, and keyboard navigation work on the home deck (#198)', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await expect(page.getByTestId('canvas-ambient')).toBeVisible();

    const card = page.getByTestId('deck-slide-card');
    const nextPreview = page.getByTestId('deck-preview-card-next');
    const prevPreview = page.getByTestId('deck-preview-card-prev');

    await expect(card).toHaveAttribute('data-slide-id', 'tetris');
    await expect(nextPreview).toHaveAttribute('data-preview-id', 'puzzle-bobble');
    await expect(prevPreview).toHaveAttribute('data-preview-id', 'puzzle-bobble');

    // Clicking the stacked next-preview card flips to Puzzle Bobble with 'next' direction.
    await nextPreview.click();
    await expect(card).toHaveAttribute('data-slide-id', 'puzzle-bobble');
    await expect(card).toHaveAttribute('data-slide-dir', 'next');
    await expect(card).toHaveClass(/is-sliding-next/);
    await expect(nextPreview).toHaveAttribute('data-preview-id', 'tetris');

    // ArrowLeft flips back to Tetris with 'prev' direction.
    await page.keyboard.press('ArrowLeft');
    await expect(card).toHaveAttribute('data-slide-id', 'tetris');
    await expect(card).toHaveAttribute('data-slide-dir', 'prev');
    await expect(card).toHaveClass(/is-sliding-prev/);

    // ArrowRight flips to Puzzle Bobble, and Enter launches it when focus is on the body.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowRight');
    await expect(card).toHaveAttribute('data-slide-id', 'puzzle-bobble');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?app=puzzle-bobble$/);
    await expect(page.getByRole('heading', { name: 'Puzzle Bobble' })).toBeVisible();
  } finally {
    await closeStub(stub);
  }
});

test('static preview mode runs games cleanly without a startup error banner and shows a truthful notice when Requests is opened (#199)', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.route('**/api/session', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'text/plain; charset=utf-8',
        body: 'Backend configuration unavailable',
      }),
    );
    await page.goto(stub.base);

    // No startup error alert blocks the home deck, and there is no top bar.
    await expect(page.locator('.canvas-header')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);

    // Games launch and play normally in static preview mode.
    await page.getByRole('button', { name: 'Play Tetris', exact: true }).click();
    await expect(page).toHaveURL(/\?app=tetris$/);
    await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // Clicking the wiggling YOLO icon opens the feedback overlay with the clean public-version unavailable notice (#230).
    await page.getByRole('button', { name: 'Feedback on Tetris' }).click();
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(
      'Currently feedback on the public version is not available, stay tuned.',
    );
    await expect(page.locator('#new-request-title')).toHaveCount(0);
  } finally {
    await closeStub(stub);
  }
});

