import { test, expect, settled, listSettled } from './fixtures';
import { makeStubGithub, startStubApp, withoutSummaryGithub, type StubComment } from './stub-server';

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
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await listSettled(page);

    // A detail with a Reported summary: the app's own label.
    await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
    await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
    await settled(page);
    const label = await styles(page, '.summary-box h3');
    expect(label, 'the Reported summary heading').not.toBeNull();
    expect(label!.textTransform).toBe('uppercase');
    expect(label!.fontSize).toBe('12px');
    const muted = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--muted').trim());
    const rgbOf = (hex: string) => {
      const n = Number.parseInt(hex.replace('#', ''), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    expect(muted, '--muted must be a literal for this comparison').toMatch(/^#[0-9a-f]{6}$/i);
    expect(label!.color).toBe(rgbOf(muted.toLowerCase()));
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
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
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

test('a request with ## YOLO request shows Request triage without timing fallback, and covering-outcome links open in-panel', async ({
  page,
}) => {
  const base = makeStubGithub();
  const innerListComments = base.listComments;
  const triageComments: StubComment[] = [
    {
      id: 301,
      body: [
        '## YOLO request',
        '',
        'Admitted as part of covering outcome [#7](https://github.com/normzhou/yolo-blank-canvas/issues/7).',
      ].join('\n'),
      user: { login: 'normzhou' },
      created_at: '2026-10-07T12:00:00Z',
      updated_at: '2026-10-07T12:00:00Z',
      html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/2#issuecomment-301',
    },
  ];
  const promotedComments: StubComment[] = [
    ...triageComments,
    {
      id: 302,
      body: '## YOLO status\n\nOutcome: promoted in place and active.',
      user: { login: 'normzhou' },
      created_at: '2026-10-07T13:00:00Z',
      updated_at: '2026-10-07T13:00:00Z',
      html_url: 'https://github.com/normzhou/yolo-blank-canvas/issues/3#issuecomment-302',
    },
  ];

  const stub = await startStubApp({
    ...base,
    listComments: async (target: unknown, number: string, options: { page: number; perPage: number }) => {
      if (Number(number) === 2) return triageComments;
      if (Number(number) === 3) return promotedComments;
      return innerListComments(target, number, options);
    },
  });

  try {
    await page.goto(`${stub.base}?panel=2`);
    await expect(page.getByRole('heading', { name: '#2 A plain conversation' })).toBeVisible();
    await expect(page.getByText('Request open').first()).toBeVisible();

    const box = page.locator('.summary-box');
    await expect(box.getByRole('heading', { name: 'Request triage', exact: true })).toBeVisible();
    await expect(box.getByText(/Admitted as part of covering outcome/)).toBeVisible();
    await expect(box.getByText('Delivery timing not yet estimated.')).toHaveCount(0);
    await expect(box.getByText('No progress summary yet.')).toHaveCount(0);

    // Clicking the same-repo covering-outcome link navigates inside the panel.
    await box.getByRole('link', { name: '#7' }).click();
    await expect(page).toHaveURL(/\?panel=7$/);
    await expect(page.getByRole('heading', { name: '#7 Make the canvas respond to themes' })).toBeVisible();
    await expect(box.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();

    // Browser Back returns to the source request.
    await page.goBack();
    await expect(page).toHaveURL(/\?panel=2$/);
    await expect(box.getByRole('heading', { name: 'Request triage', exact: true })).toBeVisible();

    // On an issue that has both ## YOLO request and ## YOLO status, Reported summary wins
    // while the triage comment remains visible in the discussion below.
    await page.goto(`${stub.base}?panel=3`);
    await expect(box.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
    await expect(box.getByText('Outcome: promoted in place and active.')).toBeVisible();
    await expect(page.locator('.comment').getByText(/Admitted as part of covering outcome/)).toBeVisible();
  } finally {
    stub.server.close();
  }
});
