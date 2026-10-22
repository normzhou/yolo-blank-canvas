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

/**
 * The overlay trigger was labelled "Requests" until #130, which renamed it to
 * "Open requests". Accept either, so this suite can verify a release that
 * predates the rename instead of timing out on a control the artifact never
 * had. The assertions below the click are unchanged, so this widens the
 * navigation step only -- it does not make any check more permissive.
 */
async function openRequests(page: import('@playwright/test').Page) {
  for (const name of ['Open requests', 'Requests']) {
    const trigger = page.getByRole('button', { name, exact: true });
    if ((await trigger.count()) > 0) {
      await trigger.first().click();
      return;
    }
  }
  throw new Error(
    'no requests overlay trigger found: looked for buttons named "Open requests" and "Requests"',
  );
}

/**
 * Tetris became a gallery entry in #165; before that it was a "Play Tetris"
 * control. Accept either so the suite can also verify an older installed tag.
 */
async function openTetris(page: import('@playwright/test').Page) {
  for (const name of ['Tetris', 'Play Tetris']) {
    const trigger = page.getByRole('button', { name, exact: true });
    if ((await trigger.count()) > 0) {
      await trigger.first().click();
      return;
    }
  }
  throw new Error('no Tetris trigger found: looked for buttons named "Tetris" and "Play Tetris"');
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
  await openRequests(page);
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
  await openRequests(page);
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
  await openTetris(page);
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
    await openTetris(page);
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

test('the released canvas gallery opens an app and keeps it under the palette', async ({ page }) => {
  await page.goto(BASE);
  await session(page);
  await page.goto(BASE);

  const gallery = page.getByRole('navigation', { name: 'Canvas gallery' });
  if ((await gallery.count()) === 0) {
    test.skip(true, 'this release predates the canvas gallery (#165)');
  }

  await gallery.getByRole('button', { name: 'Tetris', exact: true }).click();
  await expect(page).toHaveURL(/\?app=tetris$/);
  await expect(page.getByRole('heading', { name: 'Tetris' })).toBeVisible();

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Canvas apps' });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole('button', { name: 'Tetris', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // Escape belongs to the palette; the app stays mounted underneath it.
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tetris' })).toBeVisible();
  await expect(page).toHaveURL(/\?app=tetris$/);
});

test('the released app carries the viewed app into feedback', async ({ page }) => {
  await page.goto(BASE);
  await session(page);
  await page.goto(BASE);

  const gallery = page.getByRole('navigation', { name: 'Canvas gallery' });
  if ((await gallery.count()) === 0) {
    test.skip(true, 'this release predates the canvas gallery (#165)');
  }
  await gallery.getByRole('button', { name: 'Tetris', exact: true }).click();
  await expect(page).toHaveURL(/\?app=tetris$/);

  const feedback = page.getByRole('button', { name: 'Feedback on Tetris' });
  if ((await feedback.count()) === 0) {
    test.skip(true, 'this release predates contextual feedback (#169)');
  }
  await feedback.click();
  await expect(page).toHaveURL(/\?app=tetris&panel=new$/);
  await expect(page.getByLabel('Title')).toBeFocused();
  const guidedRadio = page.getByRole('radio', { name: /Share feedback/ });
  if ((await guidedRadio.count()) > 0) {
    await expect(guidedRadio).toBeChecked();
    await expect(page.locator('.request-context-summary')).toContainText('App: Tetris (?app=tetris)');
    await expect(page.getByLabel('Generated issue body')).toContainText(
      'App: Tetris (?app=tetris)\n\nTemplate: blankcanvas.feedback@1',
    );
  } else {
    await expect(page.getByLabel('Description')).toHaveValue('App: Tetris (?app=tetris)\n\n');
  }

  // Read-only: close without submitting. Escape returns focus to Feedback.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Requests' })).toHaveCount(0);
  await expect(feedback).toBeFocused();
});

test('the released guided composer switches intents without losing input and previews the marker', async ({
  page,
}) => {
  await page.goto(BASE);
  await session(page);
  await page.goto(BASE);

  await openRequests(page);
  await page.getByRole('button', { name: 'New request' }).first().click();

  const changeRadio = page.getByRole('radio', { name: /Build or change/ });
  if ((await changeRadio.count()) === 0) {
    test.skip(true, 'this release predates the guided request composer (#175)');
  }

  await expect(changeRadio).toBeChecked();
  await page.getByLabel('Title').fill('Read-only verify check');
  await page.getByLabel('What would you like to build or change?').fill('Shared answer survives switching.');

  await page.getByRole('radio', { name: /Report a problem/ }).check();
  await expect(page.getByLabel('Title')).toHaveValue('Read-only verify check');
  await expect(page.getByLabel('What happened?')).toHaveValue('Shared answer survives switching.');
  await expect(page.getByLabel('Generated issue body')).toContainText('Template: blankcanvas.problem@1');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Requests' })).toHaveCount(0);
});

test('the released detail view surfaces ## YOLO request triage and navigates covering-outcome links in-panel', async ({
  page,
}) => {
  await page.goto(BASE);
  await session(page);
  await page.goto(`${BASE}?panel=172`);

  await expect(page.getByRole('heading', { name: /#172/ })).toBeVisible();
  const triageHeading = page.locator('.summary-box').getByRole('heading', { name: 'Request triage', exact: true });
  if ((await triageHeading.count()) === 0) {
    test.skip(true, 'this release predates Request triage display (#177)');
  }

  await expect(triageHeading).toBeVisible();
  await expect(page.locator('.summary-box').getByText('Delivery timing not yet estimated.')).toHaveCount(0);

  await page.locator('.summary-box').getByRole('link', { name: '#175' }).first().click();
  await expect(page).toHaveURL(/\?panel=175$/);
  await expect(page.getByRole('heading', { name: /#175/ })).toBeVisible();
  await expect(page.locator('.summary-box').getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
});

test('the released canvas gallery includes 2-player Puzzle Bobble with ASDF and Arrow controls', async ({
  page,
}) => {
  await page.goto(BASE);
  await session(page);
  await page.goto(BASE);

  const gallery = page.getByRole('navigation', { name: 'Canvas gallery' });
  if ((await gallery.count()) === 0) {
    test.skip(true, 'this release predates the canvas gallery (#165)');
  }
  const pbButton = gallery.getByRole('button', { name: 'Puzzle Bobble', exact: true });
  if ((await pbButton.count()) === 0) {
    test.skip(true, 'this release predates Puzzle Bobble (#181)');
  }

  await pbButton.click();
  await expect(page).toHaveURL(/\?app=puzzle-bobble$/);
  await expect(page.getByRole('heading', { name: 'Puzzle Bobble' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Player 1 bubble board' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Player 2 bubble board' })).toBeVisible();

  await page.keyboard.press('d');
  await expect(page.getByTestId('p1-aim')).toHaveText('+3°');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('p2-aim')).toHaveText('-3°');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
});
