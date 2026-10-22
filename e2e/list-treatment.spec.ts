import { test, expect, listSettled } from './fixtures';
import { startStubApp, makeStubGithub, densityIssues } from './stub-server';

/**
 * List treatment, density, scroll affordance, and responsive toolbar (#75, #104, #133, #150, consolidated in #201).
 */

async function rowStyle(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.issue-row')) as HTMLElement[];
    const cs = getComputedStyle(rows[0]);
    const last = getComputedStyle(rows[rows.length - 1]);
    const body = document.querySelector('.panel-body') as HTMLElement;
    const bodyCs = getComputedStyle(body);
    const bodyRect = body.getBoundingClientRect();
    const visible = rows.filter((row) => {
      const r = row.getBoundingClientRect();
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
      backgroundImage: bodyCs.backgroundImage,
      backgroundAttachment: bodyCs.backgroundAttachment,
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
    };
  });
}

test('list rows are hairline-divided, dense, and scrollable with scroll-shadow affordance', async ({ page }) => {
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
    expect(style.visible, `${style.visible} of ${style.total} rows scannable`).toBeGreaterThanOrEqual(11);

    // Scroll-shadow affordance (#104).
    expect(style.backgroundImage).toContain('radial-gradient');
    expect(style.backgroundAttachment).toBe('local, local, scroll, scroll');
    expect(style.scrollHeight).toBeGreaterThan(style.clientHeight);

    // Focusing a lower row scrolls the container (#104).
    await page.locator('.issue-row button.issue-title').nth(24).focus();
    const scrollTop = await page.locator('.panel-body').evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  } finally {
    stub.server.close();
  }
});

test('the narrow list keeps the divider treatment and places Refresh beside filters above New request', async ({
  page,
}) => {
  const stub = await startStubApp(makeStubGithub());
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await listSettled(page);
    const style = await rowStyle(page);
    expect(style.borderBottomWidth).toBe('1px');
    expect(style.borderRadius).toBe('0px');

    const box = await page.evaluate(() => {
      const rect = (el: Element | null | undefined) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      const toolbar = document.querySelector('.toolbar') as HTMLElement;
      const buttons = Array.from(toolbar.querySelectorAll('button'));
      return {
        filters: rect(document.querySelector('.toolbar .filter-group')),
        primary: rect(document.querySelector('.toolbar button.primary')),
        refresh: rect(buttons.find((b) => b.textContent?.trim() === 'Refresh')),
      };
    });
    expect(box.refresh!.top).toBeLessThan(box.filters!.bottom);
    expect(box.refresh!.left).toBeGreaterThan(box.filters!.right);
    expect(box.primary!.top).toBeGreaterThanOrEqual(box.refresh!.bottom);
  } finally {
    stub.server.close();
  }
});

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

    const name = await row.locator('button.issue-title').evaluate((el) => el.textContent ?? '');
    expect(name).toContain('#7');
    expect(name).toContain('Make the canvas respond to themes');
    expect(name).toContain('In progress');

    await row.locator('.badge').click();
    await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();

    await page.getByRole('button', { name: '← Back' }).click();
    await listSettled(page);
    await page.locator('.issue-row').first().locator('.issue-time').click();
    await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
  } finally {
    stub.server.close();
  }
});

test('switching filter mid-load still applies the new filter', async ({ page }) => {
  const stub = await startStubApp(makeStubGithub());
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await expect(page.locator('.issue-row').first()).toBeVisible();

    const gate: { release: (() => void) | null } = { release: null };
    await page.route('**/api/issues**', async (route) => {
      if (route.request().url().includes('state=open') && gate.release === null) {
        await new Promise<void>((resolve) => {
          gate.release = resolve;
        });
      }
      await route.continue();
    });

    await page.getByRole('button', { name: 'Refresh' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Closed', exact: true }).click();
    await page.waitForTimeout(200);
    gate.release?.();

    await page.waitForTimeout(800);
    await expect(page.getByRole('button', { name: 'Closed', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.issue-row')).not.toHaveCount(5);
  } finally {
    stub.server.close();
  }
});
