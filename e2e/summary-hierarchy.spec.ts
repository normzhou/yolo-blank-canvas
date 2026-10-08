import { test, expect, settled, listSettled } from './fixtures';
import { startStubApp, withoutSummaryGithub } from './stub-server';

/**
 * App chrome vs issue content (#75, Q3).
 *
 * The finding: the issue body's own Markdown headings rendered around 20px
 * while the app's `Reported summary` label was 14px, so scanning for what the
 * app is reporting competed with the issue author's formatting. The chosen
 * direction (`b-summary-elevated`) leaves the author's Markdown untouched and
 * gives the app's own label a stronger, quieter treatment.
 *
 * The load-bearing assertion is the *absence* of a change: the author's heading
 * sizes are not capped. The rest checks the label actually changed, so this
 * cannot pass by doing nothing.
 */

async function styles(page: import('@playwright/test').Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {
      fontSize: cs.fontSize,
      textTransform: cs.textTransform,
      color: cs.color,
      letterSpacing: cs.letterSpacing,
      borderTopWidth: cs.borderTopWidth,
      padding: cs.padding,
      width: box.width,
    };
  }, selector);
}

test('the Reported summary label is elevated without reformatting the issue body', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await listSettled(page);

    // A detail with a Reported summary: the app's own label.
    await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
    await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
    await settled(page);
    const label = await styles(page, '.summary-box h3');
    expect(label, 'the Reported summary heading').not.toBeNull();
    expect(label!.textTransform).toBe('uppercase');
    expect(label!.fontSize).toBe('12px');
    expect(label!.color).toBe('rgb(89, 99, 110)'); // --muted
    expect(Number.parseFloat(label!.letterSpacing)).toBeGreaterThan(0);
    const boxed = await styles(page, '.summary-box');
    expect(boxed!.borderTopWidth).toBe('2px');
    expect(boxed!.padding).toBe('14px 16px');

    // A detail whose author wrote their own headings: unchanged by the app.
    await page.getByRole('button', { name: 'Back' }).click();
    await listSettled(page);
    await page.getByRole('button', { name: /^#1 A deliberately long issue title/ }).click();
    await expect(page.getByRole('heading', { name: 'Outcome', exact: true })).toBeVisible();
    await settled(page);
    const authorHeading = await styles(page, '.comment-body h2');
    expect(authorHeading, "the author's h2").not.toBeNull();
    expect(authorHeading!.textTransform).toBe('none');
    // The author's heading still outranks the app's 12px label: the hierarchy
    // win came from the label's treatment, not from shrinking the content.
    expect(
      Number.parseFloat(authorHeading!.fontSize),
      `author h2 ${authorHeading!.fontSize} should remain larger than the app label`,
    ).toBeGreaterThan(Number.parseFloat(label!.fontSize));
  } finally {
    stub.server.close();
  }
});

test('a detail with no summary still shows the honest fallback', async ({ page }) => {
  const stub = await startStubApp(withoutSummaryGithub());
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await listSettled(page);
    await page.getByRole('button', { name: /#7 Make the canvas respond/ }).click();
    await expect(page.getByText('No progress summary yet.')).toBeVisible();
    await expect(page.getByText('Delivery timing not yet estimated.')).toBeVisible();
    const label = await styles(page, '.summary-box h3');
    expect(label!.textTransform).toBe('uppercase');
    // Reachable, not hidden by the stronger label treatment.
    await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
  } finally {
    stub.server.close();
  }
});
