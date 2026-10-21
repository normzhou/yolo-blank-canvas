import { test, expect } from './fixtures';
import { startStubApp, type RunningStub } from './stub-server';

/**
 * Contextual feedback (#169).
 *
 * Feedback is the direct path into the existing composer; Requests still
 * browses. The app context is a visible body line, drafts are scoped by app,
 * and the result is one ordinary GitHub issue.
 */

const APP_CONTEXT = 'App: Tetris (?app=tetris)\n\n';

/** Idle keep-alive sockets can keep `server.close()` waiting past the test timeout. */
async function closeStub(stub: RunningStub) {
  stub.server.closeAllConnections();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
}

test('Feedback opens the composer with app context, appends, and returns focus', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=tetris`);
    const feedback = page.getByRole('button', { name: 'Feedback on Tetris' });
    await feedback.click();

    await expect(page).toHaveURL(/\?app=tetris&panel=new$/);
    await expect(page.getByLabel('Title')).toBeFocused();
    const body = page.getByLabel('Description');
    await expect(body).toHaveValue(APP_CONTEXT);

    await page.getByLabel('Title').fill('Move the board left');
    await page.getByLabel('Title').press('Tab');
    await expect(body).toBeFocused();
    await page.keyboard.type('A ten-wide board feels cramped.');
    await expect(body).toHaveValue(`${APP_CONTEXT}A ten-wide board feels cramped.`);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Requests' })).toHaveCount(0);
    await expect(page).toHaveURL(/\?app=tetris$/);
    await expect(feedback).toBeFocused();
  } finally {
    await closeStub(stub);
  }
});

test('a submitted feedback request carries the context and resets to a fresh line', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=tetris`);
    await page.getByRole('button', { name: 'Feedback on Tetris' }).click();
    await page.getByLabel('Title').fill('A wider board');
    const body = page.getByLabel('Description');
    await body.focus();
    await page.keyboard.type('Ten columns is tight.');
    await expect(body).toHaveValue(`${APP_CONTEXT}Ten columns is tight.`);
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByRole('heading', { name: /#100 A wider board/ })).toBeVisible();
    await expect(page.getByText('App: Tetris (?app=tetris)')).toBeVisible();
    await expect(page.getByText('Ten columns is tight.')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Feedback on Tetris' }).click();
    await expect(page.getByLabel('Title')).toHaveValue('');
    await expect(page.getByLabel('Description')).toHaveValue(APP_CONTEXT);
  } finally {
    await closeStub(stub);
  }
});

test('app and home drafts stay separate, including cold links', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=tetris`);
    await page.getByRole('button', { name: 'Feedback on Tetris' }).click();
    await page.getByLabel('Title').fill('App-only draft');
    await expect(page.getByLabel('Description')).toHaveValue(APP_CONTEXT);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Close Tetris' }).click();
    await page.getByRole('button', { name: 'Start a request', exact: true }).click();
    await expect(page.getByLabel('Title')).toHaveValue('');
    await expect(page.getByLabel('Description')).toHaveValue('');
    await page.keyboard.press('Escape');

    await page.goto(`${stub.base}?app=tetris&panel=new`);
    await expect(page.getByLabel('Title')).toHaveValue('App-only draft');
    await expect(page.getByLabel('Description')).toHaveValue(APP_CONTEXT);

    await page.goto(`${stub.base}?panel=new`);
    await expect(page.getByLabel('Title')).toHaveValue('');
    await expect(page.getByLabel('Description')).toHaveValue('');
  } finally {
    await closeStub(stub);
  }
});

test('Requests still browses, and its New request carries the app context too', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=tetris`);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page).toHaveURL(/\?app=tetris&panel$/);
    const panel = page.getByRole('dialog', { name: 'Requests' });
    await expect(panel).toBeVisible();

    await page.getByRole('button', { name: 'New request' }).first().click();
    await expect(page).toHaveURL(/\?app=tetris&panel=new$/);
    await expect(page.getByLabel('Description')).toHaveValue(APP_CONTEXT);
  } finally {
    await closeStub(stub);
  }
});
