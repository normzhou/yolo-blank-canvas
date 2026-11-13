import { test, expect } from './fixtures';
import { startStubApp, type RunningStub } from './stub-server';

/**
 * Canvas content gallery (#165, #352).
 */

async function openPalette(page: import('@playwright/test').Page) {
  await page.keyboard.press('Control+k');
  return page.getByRole('dialog', { name: 'Canvas apps' });
}

async function closeStub(stub: RunningStub) {
  stub.server.closeAllConnections();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
}

test('the home gallery opens Prism Stack and the Pause Menu exits to the canvas (#237, #352)', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();

    const gallery = page.getByRole('navigation', { name: 'Canvas gallery' });
    await gallery.getByRole('button', { name: 'Prism Stack', exact: true }).click();
    await page.getByTestId('deck-slide-card').click();

    await expect(page).toHaveURL(/\?app=prism-stack$/);
    await expect(page.getByRole('heading', { name: 'Prism Stack' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Prism Stack board, 9 by 18' })).toBeVisible();

    await expect(page.getByTestId('arcade-countdown')).toBeVisible();
    await expect(page.getByTestId('game-pause-menu')).toHaveCount(0);

    await page.getByTestId('pause-button').click();
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByRole('button', { name: 'Close Prism Stack' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '');
    await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
  } finally {
    await closeStub(stub);
  }
});

test('an app is a cold deep link, and back returns to the canvas', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=prism-stack`);
    await expect(page.getByRole('heading', { name: 'Prism Stack' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Prism Stack board, 9 by 18' })).toBeVisible();

    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Prism Stack', exact: true }).click();
    await page.getByTestId('deck-slide-card').click();
    await expect(page).toHaveURL(/\?app=prism-stack$/);

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
    await page.goto(`${stub.base}?app=prism-stack`);
    await expect(page.getByRole('heading', { name: 'Prism Stack' })).toBeVisible();

    const palette = await openPalette(page);
    await expect(palette).toBeVisible();
    await expect(palette.getByRole('button', { name: 'Prism Stack', exact: true })).toHaveAttribute('aria-current', 'page');

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
    await page.goto(`${stub.base}?app=prism-stack`);
    await expect(page.getByRole('heading', { name: 'Prism Stack' })).toBeVisible();
    await expect(page.getByTestId('game-pause-menu')).toHaveCount(0);

    await page.keyboard.press('Shift+Backquote');
    const palette = page.getByRole('dialog', { name: 'Canvas apps' });
    await expect(palette).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Prism Stack' })).toBeVisible();
    await expect(page).toHaveURL(/\?app=prism-stack$/);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('game-pause-menu')).toBeVisible();
    await page.getByRole('button', { name: 'Close Prism Stack' }).click();
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
    await expect(card).toHaveAttribute('data-slide-id', 'starlight-burst');
    await expect(page.getByTestId('deck-live-preview')).toHaveAttribute(
      'data-preview-game',
      'starlight-burst',
    );

    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height * 0.5);
    await page.mouse.up();

    await expect(card).toHaveAttribute('data-slide-id', 'prism-stack');
    await expect(page.getByTestId('deck-live-preview')).toHaveAttribute(
      'data-preview-game',
      'prism-stack',
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

test('the game slide deck flips between slides via carousel dots and launches active games (#187, #264, #352)', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    const card = page.getByTestId('deck-slide-card');
    await expect(card).toHaveAttribute('data-slide-id', 'starlight-burst');
    await expect(page.getByRole('button', { name: 'Play Starlight Burst', exact: true })).toBeVisible();

    await page.getByTestId('carousel-dot-prism-stack').click();
    await expect(card).toHaveAttribute('data-slide-id', 'prism-stack');
    await expect(page.getByRole('button', { name: 'Play Prism Stack', exact: true })).toBeVisible();

    await page.getByTestId('carousel-dot-starlight-burst').click();
    await expect(card).toHaveAttribute('data-slide-id', 'starlight-burst');

    await page.getByRole('button', { name: 'Play Starlight Burst', exact: true }).click();
    await expect(page).toHaveURL(/\?app=starlight-burst$/);
    await expect(page.getByRole('heading', { name: 'Starlight Burst' })).toBeVisible();
  } finally {
    await closeStub(stub);
  }
});

test('carousel indicator dots, directional slide animations, ambient visual effects, and keyboard navigation work on the home deck (#198, #264, #352)', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await expect(page.getByTestId('canvas-ambient')).toBeVisible();

    const card = page.getByTestId('deck-slide-card');
    const sbDot = page.getByTestId('carousel-dot-starlight-burst');
    const prismDot = page.getByTestId('carousel-dot-prism-stack');

    await expect(card).toHaveAttribute('data-slide-id', 'starlight-burst');
    await expect(sbDot).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.deck-slide-actions')).toHaveCount(0);

    await prismDot.click();
    await expect(card).toHaveAttribute('data-slide-id', 'prism-stack');
    await expect(card).toHaveAttribute('data-slide-dir', 'next');
    await expect(card).toHaveClass(/is-sliding-next/);
    await expect(prismDot).toHaveAttribute('aria-current', 'true');

    await page.keyboard.press('ArrowLeft');
    await expect(card).toHaveAttribute('data-slide-id', 'starlight-burst');
    await expect(card).toHaveAttribute('data-slide-dir', 'prev');
    await expect(card).toHaveClass(/is-sliding-prev/);

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?app=starlight-burst$/);
    await expect(page.getByRole('heading', { name: 'Starlight Burst' })).toBeVisible();
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

    await expect(page.locator('.canvas-header')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.getByTestId('carousel-dot-prism-stack').click();
    await page.getByRole('button', { name: 'Play Prism Stack', exact: true }).click();
    await expect(page).toHaveURL(/\?app=prism-stack$/);
    await expect(page.getByRole('img', { name: 'Prism Stack board, 9 by 18' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.getByRole('button', { name: 'Feedback on Prism Stack' }).click();
    await expect(page.locator('yolo-feedback-v1')).toHaveCount(1);

    await page.goto(`${stub.base}?panel`);
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
