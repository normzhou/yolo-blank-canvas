import { test, expect, listSettled } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * The theme control (#110).
 *
 * Three things are asserted, and the last is the one that matters most:
 *
 * 1. Switching repaints the document from tokens — checked against the computed
 *    background of the canvas, not against "does it look different".
 * 2. The choice survives a reload, which is the whole point of storing it.
 * 3. Every theme actually paints. A theme block that fails to parse, or that
 *    omits a role, leaves one surface stranded in the default palette; the
 *    contrast test catches the values, this catches the wiring.
 */

const THEMES = ['Slate', 'Sand', 'Dusk'] as const;

test('the theme control switches the document and remembers the choice', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    // `body` carries `--bg`; `.canvas` is transparent above it.
    const bodySurface = page.locator('body');

    const surfaces: Record<string, string> = {};
    for (const name of THEMES) {
      await page.getByRole('radio', { name }).click();
      await expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
      surfaces[name] = await bodySurface.evaluate((el) => getComputedStyle(el).backgroundColor);
    }

    // Distinct palettes, not three names for one palette.
    expect(new Set(Object.values(surfaces)).size, JSON.stringify(surfaces)).toBe(THEMES.length);

    // Dusk must genuinely be dark and Slate genuinely light. A theme block that
    // failed to apply would leave both light and still pass the test above.
    const lum = (rgb: string) => {
      const [r, g, b] = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    expect(lum(surfaces.Dusk), `Dusk surface ${surfaces.Dusk}`).toBeLessThan(0.25);
    expect(lum(surfaces.Slate), `Slate surface ${surfaces.Slate}`).toBeGreaterThan(0.85);

    // Every colour role resolves under a chosen theme, not just the canvas.
    await page.getByRole('radio', { name: 'Dusk' }).click();
    const rolesUnderDusk = await page.evaluate(() => {
      const roles = [
        '--surface', '--text', '--muted', '--border', '--accent',
        '--warning-weak', '--problem-weak', '--closed-weak', '--neutral-weak',
        '--cell-empty', '--board-gap', '--summary-bg',
      ];
      const cs = getComputedStyle(document.documentElement);
      return roles.map((r) => [r, cs.getPropertyValue(r).trim()] as const);
    });
    for (const [role, value] of rolesUnderDusk) {
      expect(value, `${role} is unset under Dusk`).not.toBe('');
    }

    // The choice survives a reload.
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Dusk' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dusk');
  } finally {
    stub.server.close();
  }
});

test('the theme control is reachable and arrow-key navigable', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    const group = page.getByRole('radiogroup', { name: 'Theme' });
    await expect(group).toBeVisible();

    await page.getByRole('radio', { name: 'Slate' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Sand' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Dusk' })).toHaveAttribute('aria-checked', 'true');
    // Wraps rather than dead-ending, as a radiogroup must.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Slate' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Slate' })).toBeFocused();

    // The panel is unaffected by the theme: its status text is derived from
    // issue records, not from any token.
    await page.getByRole('button', { name: 'Requests' }).click();
    await listSettled(page);
    await expect(page.locator('.panel')).toBeVisible();
    await expect(page.locator('.issue-row').first()).toBeVisible();
  } finally {
    stub.server.close();
  }
});

test('the header control does not crowd the narrow canvas', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(stub.base);
    const group = page.getByRole('radiogroup', { name: 'Theme' });
    await expect(group).toBeVisible();
    // No horizontal overflow at the width where the canvas prompt is tightest.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the theme control pushed the page wider than the viewport').toBeLessThanOrEqual(0);
  } finally {
    stub.server.close();
  }
});