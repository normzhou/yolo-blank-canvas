import { test, expect, listSettled } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * Narrow action emphasis (#75, Q2).
 *
 * The finding: at 390px the filter group and `New request` shared a line and
 * `Refresh` was pushed onto a line of its own, left-aligned. Refresh is what
 * recovers a stale list, so the most orphaned control was the recovery control.
 * The chosen direction (`a-refresh-joins-the-filters`) puts Refresh on the row
 * with the state filters it belongs to and gives the primary action the row
 * beneath.
 *
 * Asserted by geometry: filters and Refresh share a vertical band, Refresh is
 * right-aligned rather than stranded on the left, and the primary action is
 * below both.
 */

type Box = { left: number; right: number; top: number; bottom: number } | null;

async function toolbar(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rect = (selector: string): Box => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    const toolbar = document.querySelector('.toolbar') as HTMLElement;
    const buttons = Array.from(toolbar.querySelectorAll('button'));
    return {
      filters: rect('.toolbar .filter-group'),
      primary: rect('.toolbar button.primary'),
      refresh: (() => {
        const el = buttons.find((b) => b.textContent?.trim() === 'Refresh');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      })(),
      toolbarRight: toolbar.getBoundingClientRect().right,
    };
  });
}

test('at 390px Refresh joins the filters and the primary action takes its own row', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
    await listSettled(page);

    const box = await toolbar(page);
    expect(box.filters, 'filter group').not.toBeNull();
    expect(box.refresh, 'Refresh control').not.toBeNull();
    expect(box.primary, 'New request control').not.toBeNull();

    // Filters and Refresh share a row.
    expect(box.refresh!.top).toBeLessThan(box.filters!.bottom);
    expect(box.filters!.top).toBeLessThan(box.refresh!.bottom);

    // Refresh is right-aligned, not left stranded next to the filters.
    expect(box.refresh!.left).toBeGreaterThan(box.filters!.right);

    // The primary action is on its own row beneath both.
    expect(box.primary!.top).toBeGreaterThanOrEqual(box.refresh!.bottom);

    // Nothing spills past the panel's right edge.
    expect(box.refresh!.right).toBeLessThanOrEqual(box.toolbarRight + 0.5);
    expect(box.primary!.left).toBeGreaterThanOrEqual(box.filters!.left - 0.5);
  } finally {
    stub.server.close();
  }
});

test('the desktop toolbar order is unchanged', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await listSettled(page);

    const box = await toolbar(page);
    // Desktop keeps filters, then primary, then Refresh left-to-right on one row.
    expect(box.filters!.left).toBeLessThan(box.primary!.left);
    expect(box.primary!.left).toBeLessThan(box.refresh!.left);
  } finally {
    stub.server.close();
  }
});
