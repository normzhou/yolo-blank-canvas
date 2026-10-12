import { test, expect } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * Narrow empty canvas (#101), extended by #130.
 *
 * The #101 finding: at 390×844 the empty canvas was "Blank canvas", the identity
 * line, a prompt, then ~600px of grey that offered nothing to do. It was fixed with
 * a narrow-only hint naming the header's Requests action, because that was then the
 * only way in.
 *
 * #130 replaced that with a better answer: the primary action now sits directly
 * under the prompt on **every** width, so the hint was redundant and was removed.
 * A phone no longer needs a special case — the thing #101 had to add is now the
 * default. These assertions therefore target the primary control rather than the
 * hint, and still hold it to #101's actual bar: the next step is named, it is on the
 * first screen, and it works.
 */

test('the narrow empty canvas names a next step', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(stub.base);
    await expect(page.getByText('What would you like to build or change?')).toBeVisible();

    // The next step is named, and it is the primary control rather than a hint.
    const primary = page.getByRole('button', { name: 'Start a request', exact: true });
    await expect(primary).toBeVisible();
    await expect(page.locator('.canvas-prompt-block .canvas-primary-action')).toHaveCount(1);

    // The purposeful content sits in the upper part of the first screen, not
    // floating below a wall of empty grey. The group is a flex child that fills
    // the column, so the extent measured is its last item — the content, not the
    // container's box.
    const promptTop = await page.locator('.canvas-prompt').evaluate((el) => el.getBoundingClientRect().top);
    const contentBottom = await page
      .locator('.canvas-secondary-actions')
      .evaluate((el) => el.getBoundingClientRect().bottom);
    expect(promptTop, `prompt top ${promptTop} should be in the top half`).toBeLessThan(844 / 2);
    expect(contentBottom, `content bottom ${contentBottom} should be in the top half`).toBeLessThan(844 / 2);

    // Exactly one primary control on the canvas.
    await expect(page.locator('.canvas button.primary')).toHaveCount(1);

    // The named action works, and it reaches the composer rather than the list:
    // filing a request costs no extra step (#130).
    await primary.click();
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
    await expect(page.getByLabel('Title')).toBeVisible();
  } finally {
    stub.server.close();
  }
});

test('the desktop empty canvas carries the same named next step', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await expect(page.getByText('What would you like to build or change?')).toBeVisible();
    // No width-dependent hint remains; the primary control is present everywhere.
    await expect(page.locator('.canvas-empty-hint')).toHaveCount(0);
    await expect(page.locator('.canvas-prompt-block .canvas-primary-action')).toBeVisible();
    await expect(page.locator('.canvas button.primary')).toHaveCount(1);
  } finally {
    stub.server.close();
  }
});