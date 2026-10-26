import { test, expect, listSettled } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * The workflow is addressable (#132).
 *
 * The app's central object — a request — had no address. It could not be linked,
 * bookmarked, reloaded into, or reached with browser back. For a project whose
 * first Charter constraint is "GitHub holds the record of work", that is a
 * structural contradiction, not a missing feature.
 *
 * The thing most likely to break this quietly is history. Typing into the composer
 * is the natural place to leak a history entry per keystroke, so that is asserted
 * directly rather than inferred.
 */

test('a request is linkable: the URL opens that request cold', async ({ page }) => {
  const stub = await startStubApp();
  try {
    // Land straight on a request with no prior history at all.
    await page.goto(`${stub.base}?panel=7`);
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
    // No list is involved, so there is no list to settle.
    await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
    await expect(page.getByText('Outcome: shipped themes.').first()).toBeVisible();
  } finally {
    stub.server.close();
  }
});

test('reload restores the location you were on', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await listSettled(page);
    await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
    await expect(page).toHaveURL(/\?panel=7$/);

    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
  } finally {
    stub.server.close();
  }
});

test('browser back and forward move through the workflow', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await expect(page).toHaveURL(/\?panel$/);
    await listSettled(page);
    await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
    await expect(page).toHaveURL(/\?panel=7$/);

    // Back returns to the list, not to a blank state.
    await page.goBack();
    await expect(page).toHaveURL(/\?panel$/);
    await expect(page.getByRole('button', { name: 'New request' }).first()).toBeVisible();

    // Back again closes the workflow: the canvas is the resting state again.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog', { name: 'Requests' })).toHaveCount(0);

    // Forward replays it.
    await page.goForward();
    await expect(page).toHaveURL(/\?panel$/);
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
  } finally {
    stub.server.close();
  }
});

test('typing in the composer does not push a history entry per keystroke', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await page.getByRole('button', { name: 'Start a request', exact: true }).click();
    await expect(page).toHaveURL(/\?panel=new$/);

    const before = await page.evaluate(() => history.length);
    await page.getByLabel('Title').fill('A long enough title to type out character by character');
    await page.getByLabel('What would you like to build or change?').fill('And a body, so the check covers more than one field.');
    const after = await page.evaluate(() => history.length);
    expect(after, 'typing must not grow the history stack').toBe(before);

    // Back steps from `?panel=new` to `?panel`, and one more back returns to `/`.
    await page.goBack();
    await expect(page).toHaveURL(/\?panel$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog', { name: 'Requests' })).toHaveCount(0);
  } finally {
    stub.server.close();
  }
});

test('the resting state is a clean URL and the composer is a short one', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog', { name: 'Requests' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await page.getByRole('button', { name: 'Start a request', exact: true }).click();
    await expect(page).toHaveURL(/\?panel=new$/);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog', { name: 'Requests' })).toHaveCount(0);
  } finally {
    stub.server.close();
  }
});