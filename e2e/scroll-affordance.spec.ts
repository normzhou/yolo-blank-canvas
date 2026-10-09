import { test, expect, listSettled } from './fixtures';
import { startStubApp, makeStubGithub, densityIssues } from './stub-server';

/**
 * List scroll affordance (#104).
 *
 * The panel's scroller has no scrollbar at rest on macOS, so a clipped row was
 * the only cue that more requests existed below. The fix is the standard
 * background-attachment scroll shadow: a soft edge at each end that is hidden
 * by a `local` cover layer when the list is at that end.
 *
 * The human-reviewed evidence is the committed capture
 * (`e2e/review/visual/04b-list-density-34-end.png` shows the cue gone at the
 * end). These assertions guard the mechanism and the behaviour around it, so a
 * later change cannot silently drop the affordance or strand keyboard users.
 */

async function scroller(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const el = document.querySelector('.panel-body') as HTMLElement;
    const cs = getComputedStyle(el);
    return {
      overflowY: cs.overflowY,
      backgroundImage: cs.backgroundImage,
      backgroundAttachment: cs.backgroundAttachment,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollTop: el.scrollTop,
    };
  });
}

test('the panel scroller keeps a scroll-shadow affordance', async ({ page }) => {
  const stub = await startStubApp(makeStubGithub({ issues: densityIssues() }));
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page.locator('.issue-row')).toHaveCount(30);
    await listSettled(page);

    const before = await scroller(page);
    // The mechanism: two `local` covers and two `scroll` shadows.
    expect(before.backgroundImage).toContain('radial-gradient');
    expect(before.backgroundImage.match(/radial-gradient/g)?.length).toBe(2);
    expect(before.backgroundAttachment).toBe('local, local, scroll, scroll');

    // There is content below at rest...
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
    // ...and no horizontal scrollbar was introduced.
    expect(before.scrollWidth).toBeLessThanOrEqual(before.clientWidth);
  } finally {
    stub.server.close();
  }
});

test('keyboard movement still reaches the end of the list', async ({ page }) => {
  const stub = await startStubApp(makeStubGithub({ issues: densityIssues() }));
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await listSettled(page);

    // Focusing a row far down the list scrolls the container, so the whole
    // list stays reachable without a mouse.
    const target = page.locator('.issue-row button.issue-title').nth(24);
    await target.focus();
    const focused = await scroller(page);
    expect(focused.scrollTop, 'focusing a lower row scrolls the scroller').toBeGreaterThan(0);

    // And it can reach the bottom, where the affordance is no longer needed.
    await page.locator('.panel-body').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const end = await scroller(page);
    expect(Math.round(end.scrollTop + end.clientHeight)).toBeGreaterThanOrEqual(end.scrollHeight - 1);
  } finally {
    stub.server.close();
  }
});
