import { test, expect, listSettled } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * Canvas / panel relationship (#75, Q1).
 *
 * The finding: the prompt is centred in the viewport, so the overlay panel
 * truncated it mid-sentence ("What would you like to **build**"). The chosen
 * direction (`b-panel-pushes-canvas`) treats the panel as a column: the canvas
 * gives up the panel's width and reflows, so nothing is covered and the prompt
 * stays whole.
 *
 * The assertion is geometric rather than "does it look right": the prompt's box
 * must end before the panel begins, and the page must not overflow sideways.
 * The scrim also loses its tint — checked here so a later change cannot quietly
 * reintroduce a dimmed canvas.
 */

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

async function geometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
    };
    const canvas = document.querySelector('.canvas') as HTMLElement;
    const scrim = document.querySelector('.scrim') as HTMLElement;
    return {
      prompt: rect('.canvas-prompt'),
      panel: rect('.panel'),
      paddingRight: getComputedStyle(canvas).paddingRight,
      scrimBackground: getComputedStyle(scrim).backgroundColor,
      panelShadow: getComputedStyle(document.querySelector('.panel') as HTMLElement).boxShadow,
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

test('the open panel pushes the canvas instead of covering it', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await expect(page.getByText('What would you like to build or change?')).toBeVisible();
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
    await listSettled(page);

    const box = await geometry(page);
    expect(box.prompt, 'the prompt should still be rendered').not.toBeNull();
    expect(box.panel, 'the panel should be open').not.toBeNull();

    // Nothing is covered: the prompt's box ends at or before the panel's left edge.
    expect(
      box.prompt!.right,
      `prompt right ${box.prompt!.right} should not run under the panel at ${box.panel!.left}`,
    ).toBeLessThanOrEqual(box.panel!.left + 0.5);

    // ...and the prompt is wholly on screen.
    expect(box.prompt!.left).toBeGreaterThanOrEqual(0);
    expect(box.prompt!.right).toBeLessThanOrEqual(box.viewportWidth);

    // The panel is a raised column, not a flat edge.
    expect(box.panelShadow).not.toBe('none');

    // No tint: the scrim still exists to keep the modal behaviour, but it no
    // longer dims the canvas.
    expect(box.scrimBackground).toBe(TRANSPARENT);

    // The reservation does not overflow the viewport.
    expect(box.scrollWidth).toBeLessThanOrEqual(box.viewportWidth);
  } finally {
    stub.server.close();
  }
});

test('on a narrow viewport the full-width panel does not squeeze the canvas', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
    await listSettled(page);

    const box = await geometry(page);
    expect(box.panel!.width).toBe(390);
    // At this width the panel already covers the viewport; reserving its width
    // again would leave the canvas zero-wide and scroll the page sideways.
    expect(box.paddingRight).toBe('0px');
    expect(box.scrollWidth).toBeLessThanOrEqual(box.viewportWidth);
  } finally {
    stub.server.close();
  }
});
