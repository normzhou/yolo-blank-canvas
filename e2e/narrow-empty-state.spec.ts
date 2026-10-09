import { test, expect } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * Narrow empty canvas (#101).
 *
 * The finding: at 390×844 the empty canvas was "Blank canvas", the identity
 * line, a prompt, then ~600px of grey that offered nothing to do. The fix is
 * option (a): pull the empty state up and give it a purpose by naming the
 * existing way in (the header's Requests action), on narrow only.
 *
 * The deeper option (b) — making Requests the default narrow home — is a
 * product-direction change and is not taken here.
 */

test('the narrow empty canvas names a next step', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(stub.base);
    await expect(page.getByText('What would you like to build or change?')).toBeVisible();

    const hint = page.locator('.canvas-empty-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Requests');

    // The purposeful content sits in the upper part of the first screen, not
    // floating below a wall of empty grey.
    const promptTop = await page.locator('.canvas-prompt').evaluate((el) => el.getBoundingClientRect().top);
    const hintBottom = await hint.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(promptTop, `prompt top ${promptTop} should be in the top half`).toBeLessThan(844 / 2);
    expect(hintBottom).toBeLessThan(844 / 2);

    // The named action works.
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
  } finally {
    stub.server.close();
  }
});

test('the hint stays out of the way on desktop', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await expect(page.getByText('What would you like to build or change?')).toBeVisible();
    await expect(page.locator('.canvas-empty-hint')).toBeHidden();
  } finally {
    stub.server.close();
  }
});
