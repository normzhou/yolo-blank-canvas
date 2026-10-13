import { test, expect, listSettled, settled } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * `Disconnect` reads as an action, not navigation (#102).
 *
 * It used to be `button.link` — the accent link colour and an underline — so
 * the session-ending control looked like `Open in GitHub ↗`, which navigates.
 * It is now an ordinary secondary button, while the app's own anchors keep the
 * link token from #94.
 */

const LINK_TOKEN = 'rgb(11, 63, 143)'; // --accent-weak-text
const ACCENT = 'rgb(31, 111, 235)'; // --accent

test('the session-ending control is a button, not a link', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await listSettled(page);

    const disconnect = page.getByRole('button', { name: 'Disconnect' });
    await expect(disconnect).toBeVisible();
    const style = await disconnect.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName,
        textDecoration: cs.textDecorationLine,
        borderStyle: cs.borderTopStyle,
        borderWidth: cs.borderTopWidth,
        background: cs.backgroundColor,
        color: cs.color,
      };
    });

    expect(style.tag).toBe('BUTTON');
    expect(style.textDecoration, 'not underlined like a link').toBe('none');
    expect(style.borderStyle, 'a visible secondary control').toBe('solid');
    expect(style.borderWidth).toBe('1px');
    // Read the token rather than hardcoding its value. The palette is derived
    // from a nine-step ramp (#134), so a literal here is a test that breaks on
    // every re-skin while checking nothing about the design.
    const surface = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--surface').trim());
    const rgbOf = (hex: string) => {
      const n = Number.parseInt(hex.replace('#', ''), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    expect(surface, '--surface must be a literal for this comparison').toMatch(/^#[0-9a-f]{6}$/i);
    expect(style.background).toBe(rgbOf(surface.toLowerCase()));
    expect(style.color).not.toBe(LINK_TOKEN);
    expect(style.color).not.toBe(ACCENT);
    const textToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--text').trim());
    expect(textToken, '--text must be a literal for this comparison').toMatch(/^#[0-9a-f]{6}$/i);
    expect(style.color).toBe(rgbOf(textToken.toLowerCase()));

    // The anchors that navigate still take the link token (#94).
    await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
    await settled(page);
    const anchor = page.getByRole('link', { name: 'Open in GitHub ↗' });
    await expect(anchor).toBeVisible();
    await expect(anchor).toHaveCSS('color', LINK_TOKEN);
    await expect(anchor).toHaveCSS('text-decoration-line', 'underline');
  } finally {
    stub.server.close();
  }
});
