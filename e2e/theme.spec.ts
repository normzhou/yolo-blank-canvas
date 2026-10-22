import { test, expect, listSettled } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * The theme control (#110, #196).
 *
 * Lives in the Requests panel footer so the main application navbar is free of
 * raw theme-name buttons (#196):
 *
 * 1. Switching repaints the document from tokens — checked against the computed
 *    background of the document, not against "does it look different".
 * 2. The choice survives a reload, which is the whole point of storing it.
 * 3. Every theme actually paints. A theme block that fails to parse, or that
 *    omits a role, leaves one surface stranded in the default palette; the
 *    contrast test catches the values, this catches the wiring.
 */

const THEMES = ['Slate', 'Sand', 'Dusk'] as const;

test('the theme control switches the document and remembers the choice', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(`${stub.base}?panel`);
    await listSettled(page);
    const bodySurface = page.locator('body');

    const surfaces: Record<string, string> = {};
    for (const name of THEMES) {
      await page.getByRole('radio', { name }).click();
      await expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
      surfaces[name] = await bodySurface.evaluate((el) => getComputedStyle(el).backgroundColor);
    }

    // Distinct palettes, not three names for one palette.
    expect(new Set(Object.values(surfaces)).size, JSON.stringify(surfaces)).toBe(THEMES.length);

    // Dusk must genuinely be dark and Slate genuinely light.
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

test('the theme control is reachable inside the Requests footer and arrow-key navigable', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.goto(stub.base);
    // Main navbar has no raw theme buttons (#196).
    await expect(page.locator('.canvas-header').getByRole('radiogroup', { name: 'Theme' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Open requests' }).click();
    await listSettled(page);
    await expect(page.locator('.panel')).toBeVisible();
    await expect(page.locator('.issue-row').first()).toBeVisible();

    const group = page.getByRole('radiogroup', { name: 'Theme' });
    await expect(group).toBeVisible();

    await page.getByRole('radio', { name: 'Slate' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Sand' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Dusk' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Slate' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Slate' })).toBeFocused();
  } finally {
    stub.server.close();
  }
});

test('the header and panel footer do not crowd a narrow viewport', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(stub.base);
    const overflowHome = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowHome, 'the header pushed the page wider than the viewport').toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'Open requests' }).click();
    await listSettled(page);
    const group = page.getByRole('radiogroup', { name: 'Theme' });
    await expect(group).toBeVisible();
    const overflowPanel = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowPanel, 'the panel footer pushed the page wider than the viewport').toBeLessThanOrEqual(0);
  } finally {
    stub.server.close();
  }
});
