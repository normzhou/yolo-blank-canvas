import { test, expect, listSettled } from './fixtures';
import { startStubApp, makeStubGithub, densityIssues } from './stub-server';

/**
 * List treatment and density (#75, Q4).
 *
 * The finding: rows were white cards with a faint border, neither clearly
 * cards nor clean dividers. The chosen direction (`a-hairline-rows`) drops the
 * card chrome for hairline dividers, which measurably fits more rows before
 * the fold — the point of Goal B proxy 4 ("30+ issues can be scanned").
 *
 * The assertions are the two claims the choice rests on: the row chrome is a
 * divider rather than a card, and the density actually improved (measured as
 * rows visible in the panel, not asserted from the stylesheet).
 */

async function rowStyle(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.issue-row')) as HTMLElement[];
    const cs = getComputedStyle(rows[0]);
    const last = getComputedStyle(rows[rows.length - 1]);
    const body = document.querySelector('.panel-body') as HTMLElement;
    const bodyRect = body.getBoundingClientRect();
    const visible = rows.filter((row) => {
      const r = row.getBoundingClientRect();
      // At least 60% of the row inside the scroller counts as scannable.
      const visibleTop = Math.max(r.top, bodyRect.top);
      const visibleBottom = Math.min(r.bottom, bodyRect.bottom);
      return visibleBottom - visibleTop >= r.height * 0.6;
    }).length;
    return {
      borderTopWidth: cs.borderTopWidth,
      borderBottomWidth: cs.borderBottomWidth,
      borderRadius: cs.borderRadius,
      background: cs.backgroundColor,
      marginBottom: cs.marginBottom,
      lastBorderBottomWidth: last.borderBottomWidth,
      visible,
      total: rows.length,
    };
  });
}

test('list rows are hairline-divided and denser', async ({ page }) => {
  const stub = await startStubApp(makeStubGithub({ issues: densityIssues() }));
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await expect(page.locator('.issue-row')).toHaveCount(30);
    await listSettled(page);

    const style = await rowStyle(page);
    expect(style.borderTopWidth, 'no top border — rows are not cards').toBe('0px');
    expect(style.borderBottomWidth, 'a hairline divider').toBe('1px');
    expect(style.borderRadius, 'square corners').toBe('0px');
    expect(style.background).toBe('rgba(0, 0, 0, 0)');
    expect(style.lastBorderBottomWidth, 'the last row has no trailing divider').toBe('0px');

    // The density claim the choice was made on: ~11 rows scannable in a 900px
    // viewport, up from 8 with the card treatment.
    expect(
      style.visible,
      `${style.visible} of ${style.total} rows scannable in the panel`,
    ).toBeGreaterThanOrEqual(11);
  } finally {
    stub.server.close();
  }
});

test('the narrow list keeps the divider treatment', async ({ page }) => {
  const stub = await startStubApp(makeStubGithub());
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await listSettled(page);
    const style = await rowStyle(page);
    expect(style.borderBottomWidth).toBe('1px');
    expect(style.borderRadius).toBe('0px');
  } finally {
    stub.server.close();
  }
});

/**
 * #133: the whole row is the target.
 *
 * Before, only the title text was inside the button, so the status badge — the
 * thing a reader actually scans for — was dead to the pointer. These assertions
 * click the badge and the timestamp specifically, because a test that only clicks
 * the title cannot tell the difference between the old and new markup.
 */
test('the whole row is the target, not just the title', async ({ page }) => {
  const stub = await startStubApp(makeStubGithub());
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await listSettled(page);

    const row = page.locator('.issue-row').first();
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('button')).toHaveCount(1);

    // One accessible name covering number, title and status.
    const name = await row.locator('button.issue-title').evaluate((el) => el.textContent ?? '');
    expect(name).toContain('#7');
    expect(name).toContain('Make the canvas respond to themes');
    expect(name).toContain('In progress');

    // The badge is inside the target, and clicking it opens the request.
    await row.locator('.badge').click();
    await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();

    // So is the timestamp.
    await page.getByRole('button', { name: '← Back' }).click();
    await listSettled(page);
    await page.locator('.issue-row').first().locator('.issue-time').click();
    await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
  } finally {
    stub.server.close();
  }
});
