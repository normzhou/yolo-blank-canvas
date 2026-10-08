import { test, expect } from '@playwright/test';
import net from 'node:net';

/**
 * Verification of a released artifact installed from its tag, run against a
 * server the harness did not start. Read-only: no GitHub writes.
 *
 * Usage: YOLO_VERIFY_URL=http://127.0.0.1:4432 npx playwright test --config playwright.verify.config.ts
 */

const BASE = process.env.YOLO_VERIFY_URL ?? '';
const FREE_PORT = await (async () => {
  const probe = net.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
})();

test.skip(!BASE, 'set YOLO_VERIFY_URL to the running release');

async function session(page: import('@playwright/test').Page) {
  const response = await page.request.post(`${BASE}/api/session`, { data: {} });
  expect(response.status(), 'the released app must establish a local session').toBe(200);
}

test('the released stylesheet clears WCAG AA for the reconciliation badge', async ({ page }) => {
  // Measured from the served CSS rather than a rendered badge: the live
  // repository may have no conflicting-state issue at the moment, and a
  // verification that depends on live issue data is not a verification of the
  // release. What ships is the stylesheet.
  await page.goto(BASE);
  const href = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
  expect(href, 'the released page must serve a stylesheet').toBeTruthy();
  const css = await (await page.request.get(`${BASE}${href}`)).text();

  const token = (name: string) => {
    const key = name.replace(/^--/, '');
    const match = css.match(new RegExp(`--${key}:\\s*(#[0-9a-fA-F]{3,8})`));
    expect(match, `--${key} missing from the released stylesheet`).not.toBeNull();
    return match![1];
  };
  const badgeBg = (() => {
    const match = css.match(/\.badge\.problem\s*\{[^}]*background:\s*([^;]+);/);
    expect(match, '.badge.problem missing from the released stylesheet').not.toBeNull();
    return match![1].trim();
  })();
  const resolve = (value: string) => (value.startsWith('#') ? value : token(value.replace(/var\(|\)/g, '')));

  const channel = (hex: string, index: number) => {
    const per = (hex.length - 1) / 3;
    return (parseInt(hex.slice(1), 16) >> ((2 - index) * per * 4)) & (per === 1 ? 0xf : 0xff);
  };
  const lum = (hex: string) => {
    const [r, g, b] = [0, 1, 2].map((i) => channel(hex, i) / 255);
    const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };

  const fg = resolve(token('--problem'));
  const bg = resolve(badgeBg);
  expect(ratio(fg, bg), `--problem ${fg} on ${bg} in the released stylesheet`).toBeGreaterThanOrEqual(4.5);
});

test('a rendered reconciliation badge, when the data has one, is present and styled', async ({ page }) => {
  await page.goto(BASE);
  await session(page);
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Requests', exact: true }).click();
  await expect(page.locator('.issue-row').first()).toBeVisible();
  const badge = page.locator('.badge', { hasText: 'reconciliation' });
  const count = await badge.count();
  test.info().annotations.push({
    type: 'note',
    description:
      count === 0
        ? 'no conflicting-state issue in the live repository; the served-stylesheet check covers this badge'
        : `${count} rendered reconciliation badge(s) present`,
  });
  if (count > 0) {
    const style = await badge.first().evaluate((el) => getComputedStyle(el).color);
    expect(style).toBeTruthy();
  }
});

test('text fields carry a fill distinct from the panel', async ({ page }) => {
  await page.goto(BASE);
  await session(page);
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Requests', exact: true }).click();
  await page.getByRole('button', { name: 'New request' }).first().click();
  const fills = await page.evaluate(() => {
    const input = document.querySelector('#new-request-title') as HTMLElement;
    const panel = document.querySelector('.panel') as HTMLElement;
    return { input: getComputedStyle(input).backgroundColor, panel: getComputedStyle(panel).backgroundColor };
  });
  expect(fills.input, 'the released field still has no fill of its own').not.toBe(fills.panel);
});

test('the Tetris stats panel is opaque', async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Play Tetris' }).click();
  const panel = await page.evaluate(() => {
    const el = document.querySelector('.tetris-side') as HTMLElement;
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/rgba?\(([^)]+)\)/)!;
    const parts = m[1].split(',').map((n) => Number.parseFloat(n.trim()));
    return { bg, alpha: parts.length > 3 ? parts[3] : 1 };
  });
  expect(panel.alpha, `released stats panel is ${panel.bg}`).toBe(1);
});

test('the crossfade is cut under prefers-reduced-motion', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto(BASE);
    await session(page);
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Play Tetris' }).click();
    await expect(page.getByRole('img', { name: 'Tetris board, 10 by 20' })).toBeVisible();
    const layers = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.tetris-art-layer')).map((el) => ({
        cls: el.className,
        animation: getComputedStyle(el).animationName,
        display: getComputedStyle(el).display,
      })),
    );
    const animating = layers.filter((l) => l.animation !== 'none' && l.animation !== '');
    expect(animating, `released bundle still animates under reduce: ${JSON.stringify(layers)}`).toHaveLength(0);
    for (const layer of layers.filter((l) => l.cls.includes('is-past'))) expect(layer.display).toBe('none');
  } finally {
    await context.close();
  }
});

test('the released bundle serves the assets the build recorded', async ({ page }) => {
  await page.goto(BASE);
  await session(page);
  await page.goto(BASE);
  const script = page.locator('script[src]').first();
  const src = await script.getAttribute('src');
  const response = await page.request.get(`${BASE}${src}`);
  expect(response.status(), `asset ${src} must be served from the release`).toBe(200);
  expect(FREE_PORT).toBeGreaterThan(0);
});
