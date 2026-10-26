import { test, expect } from './fixtures';
import { startStubApp, type RunningStub } from './stub-server';

/**
 * Contextual feedback (#169) and guided three-intent request capture (#173, #175).
 *
 * Feedback in an app opens the composer with "Share feedback" preselected and
 * the visible `App: <title> (?app=<id>)` context; "Start a request" and "New
 * request" open with "Build or change" preselected. Users see all three intents
 * at the top of the composer and can switch at any time without losing their
 * title or primary answer.
 */

const APP_LINE = 'App: Tetris (?app=tetris)';
const APP_CONTEXT = `${APP_LINE}\n\n`;

/** Idle keep-alive sockets can keep `server.close()` waiting past the test timeout. */
async function closeStub(stub: RunningStub) {
  stub.server.closeAllConnections();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
}

test('Feedback opens the guided composer with Share feedback, app context, and returns focus on Escape', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=tetris`);
    const feedback = page.getByRole('button', { name: 'Feedback on Tetris' });
    await feedback.click();

    await expect(page).toHaveURL(/\?app=tetris&panel=new$/);
    await expect(page.getByLabel('Title')).toBeFocused();
    await expect(page.getByRole('radio', { name: /Share feedback/ })).toBeChecked();
    await expect(page.locator('.request-context-summary')).toContainText(APP_LINE);

    await page.getByLabel('Title').fill('Move the board left');
    await page.getByLabel('What would you like us to know?').fill('A ten-wide board feels cramped.');
    await expect(page.getByLabel('Generated issue body')).toContainText(
      `${APP_CONTEXT}Template: yolo.feedback@1.0.0\n\n## What would you like us to know?\nA ten-wide board feels cramped.`,
    );

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Requests' })).toHaveCount(0);
    await expect(page).toHaveURL(/\?app=tetris$/);
    await expect(feedback).toBeFocused();
  } finally {
    await closeStub(stub);
  }
});

test('a submitted feedback request carries the context and marker, has no labels, and resets cleanly', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?app=tetris`);
    await page.getByRole('button', { name: 'Feedback on Tetris' }).click();
    await page.getByLabel('Title').fill('A wider board');
    await page.getByLabel('What would you like us to know?').fill('Ten columns is tight.');

    const preview = await page.getByLabel('Generated issue body').textContent();
    expect(preview?.startsWith(`${APP_CONTEXT}Template: yolo.feedback@1.0.0`)).toBe(true);

    await page.getByRole('button', { name: 'Submit request' }).click();

    await expect(page.getByRole('heading', { name: /#100 A wider board/ })).toBeVisible();
    await expect(page.getByText(APP_LINE)).toBeVisible();
    await expect(page.getByText('Template: yolo.feedback@1.0.0')).toBeVisible();
    await expect(page.getByText('Ten columns is tight.')).toBeVisible();
    await expect(page.getByText('Request open')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Feedback on Tetris' }).click();
    await expect(page.getByLabel('Title')).toHaveValue('');
    await expect(page.getByLabel('What would you like us to know?')).toHaveValue('');
    await expect(page.locator('.request-context-summary')).toContainText(APP_LINE);
  } finally {
    await closeStub(stub);
  }
});

test('entry defaults, intent switching, validation focus, editable context, and freeform escape', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await page.getByRole('button', { name: 'Start a request', exact: true }).click();
    await expect(page.getByRole('radio', { name: /Build or change/ })).toBeChecked();

    // Validation focuses the first invalid field: Title first, then primary answer.
    await page.getByRole('button', { name: 'Submit request' }).click();
    await expect(page.getByText('A title is required.')).toBeVisible();
    await expect(page.getByLabel('Title')).toBeFocused();

    await page.getByLabel('Title').fill('Keyboard hold repeat feels inconsistent');
    await page.getByRole('button', { name: 'Submit request' }).click();
    await expect(page.getByText('An answer is required.')).toBeVisible();
    await expect(page.getByLabel('What would you like to build or change?')).toBeFocused();

    // Type primary and optional change details, then switch intents.
    await page.getByLabel('What would you like to build or change?').fill('Holding right sometimes pauses.');
    await page.getByLabel('Who would benefit, and how?').fill('Fast drop players.');

    await page.getByRole('radio', { name: /Report a problem/ }).check();
    await expect(page.getByRole('radio', { name: /Report a problem/ })).toBeChecked();
    await expect(page.getByLabel('Title')).toHaveValue('Keyboard hold repeat feels inconsistent');
    await expect(page.getByLabel('What happened?')).toHaveValue('Holding right sometimes pauses.');
    await page.getByLabel('How can we reproduce it?').fill('Hold ArrowRight for 2 seconds.');

    // Switching back to Build or change restores its keyed optional field.
    await page.getByRole('radio', { name: /Build or change/ }).check();
    await expect(page.getByLabel('Who would benefit, and how?')).toHaveValue('Fast drop players.');

    // Switch back to Report a problem and check More details + preview.
    await page.getByRole('radio', { name: /Report a problem/ }).check();
    await page.getByRole('button', { name: 'More details' }).click();
    await page.getByLabel('What did you expect?').fill('Smooth horizontal movement.');
    await expect(page.getByLabel('Generated issue body')).toContainText('Template: yolo.bug@1.0.0');
    await expect(page.getByLabel('Generated issue body')).toContainText('## How can we reproduce it?\nHold ArrowRight for 2 seconds.');
    await expect(page.getByLabel('Generated issue body')).toContainText('## What did you expect?\nSmooth horizontal movement.');

    // "Write freely instead" opens the freeform editor with the generated body preserved.
    await page.getByRole('button', { name: 'Write freely instead' }).click();
    const freeformBody = page.getByLabel('Description');
    await expect(freeformBody).toBeFocused();
    await expect(freeformBody).toHaveValue(/Template: yolo\.bug@1\.0\.0/);
    await expect(freeformBody).toHaveValue(/Smooth horizontal movement\./);
  } finally {
    await closeStub(stub);
  }
});

test('app and home drafts stay separate, v1 drafts migrate, and Requests -> New request defaults to Build or change with app context', async ({
  page,
}) => {
  const stub = await startStubApp();
  try {
    // Seed a legacy v1 {title, body} draft on the home key and verify migration to freeform.
    await page.goto(stub.base);
    await page.evaluate(() => {
      window.sessionStorage.setItem(
        'yolo.draft.new-request',
        JSON.stringify({ title: 'Migrated v1 draft', body: 'Legacy freeform body text.' }),
      );
    });
    await page.goto(`${stub.base}?panel=new`);
    await expect(page.getByLabel('Title')).toHaveValue('Migrated v1 draft');
    await expect(page.getByLabel('Description')).toHaveValue('Legacy freeform body text.');

    // App draft is separate from the home draft.
    await page.goto(`${stub.base}?app=tetris`);
    await page.getByRole('button', { name: 'Feedback on Tetris' }).click();
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page).toHaveURL(/\?app=tetris&panel$/);
    await page.getByRole('button', { name: 'New request' }).first().click();
    await expect(page).toHaveURL(/\?app=tetris&panel=new$/);
    await expect(page.getByRole('radio', { name: /Build or change/ })).toBeChecked();
    await expect(page.locator('.request-context-summary')).toContainText(APP_LINE);

    // Editable context line updates the generated body.
    await page.getByRole('button', { name: 'Edit context' }).dispatchEvent('click');
    await page.getByLabel('Context line').fill('App: Tetris (?app=tetris) — level 5');
    await page.getByLabel('Title').fill('App-only draft');
    await page.getByLabel('What would you like to build or change?').fill('Add hold piece.');
    await expect(page.getByLabel('Generated issue body')).toContainText(
      'App: Tetris (?app=tetris) — level 5\n\nTemplate: yolo.feature@1.0.0',
    );
    await page.keyboard.press('Escape');

    // Cold link back to app composer preserves the app draft; home composer keeps the migrated v1 draft.
    await page.goto(`${stub.base}?app=tetris&panel=new`);
    await expect(page.getByLabel('Title')).toHaveValue('App-only draft');
    await expect(page.getByLabel('What would you like to build or change?')).toHaveValue('Add hold piece.');

    await page.goto(`${stub.base}?panel=new`);
    await expect(page.getByLabel('Title')).toHaveValue('Migrated v1 draft');
    await expect(page.getByLabel('Description')).toHaveValue('Legacy freeform body text.');
  } finally {
    await closeStub(stub);
  }
});
