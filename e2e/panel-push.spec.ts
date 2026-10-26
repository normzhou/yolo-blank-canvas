import { test, expect, listSettled } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * Canvas / panel relationship — **reversed from #75's Q1 direction by #131.**
 *
 * **What #75 chose and why it no longer holds.** The overlay panel truncated the
 * centred prompt mid-sentence ("What would you like to **build**"), so #75 picked
 * `b-panel-pushes-canvas`: the canvas gave up the panel's width and reflowed
 * beside it, and the scrim lost its tint. That made the prompt whole — and left
 * ~56% of a wide viewport showing a full-height, prompt-scale canvas that the
 * scrim made completely inert. It read as live working space that could not be
 * used. The 2019 removal of the tint was the defect, not the fix.
 *
 * **What #131 chose.** The workflow is genuinely modal — `aria-modal="true"` over
 * a canvas the scrim intercepts every event on — so it should *look* modal. A
 * visible scrim and a centred working surface. The canvas becomes the resting
 * state again rather than a permanent frame competing with the action it exists
 * to prompt.
 *
 * **#75's underlying finding survives and is still asserted here**, in the form
 * that still matters: the prompt is never left whole-looking but truncated. While
 * the panel is open the canvas is inert and covered, so there is no
 * truncated-but-live target; and with the panel closed the prompt is whole and on
 * screen. Both are checked geometrically, not by eye.
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
    const scrimEl = document.querySelector('.scrim') as HTMLElement | null;
    const panelEl = document.querySelector('.panel') as HTMLElement | null;
    const deckEl = document.querySelector('.deck-slide-card') as HTMLElement | null;

    // What actually receives a pointer at the deck card's own centre? If this is
    // the scrim or panel, the canvas behind it is inert and `aria-modal` is honest.
    let hitsPromptCentre: string | null = null;
    if (deckEl) {
      const r = deckEl.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      hitsPromptCentre = top ? top.className || top.tagName : null;
    }

    return {
      prompt: rect('.deck-slide-card'),
      panel: rect('.panel'),
      paddingRight: getComputedStyle(canvas).paddingRight,
      scrimBackground: scrimEl ? getComputedStyle(scrimEl).backgroundColor : 'rgba(0, 0, 0, 0)',
      scrimCovers: scrimEl
        ? (() => {
            const r = scrimEl.getBoundingClientRect();
            return r.width >= window.innerWidth - 0.5 && r.height >= window.innerHeight - 0.5;
          })()
        : false,
      ariaModal: panelEl ? panelEl.getAttribute('aria-modal') : null,
      hitsPromptCentre,
      panelShadow: panelEl ? getComputedStyle(panelEl).boxShadow : 'none',
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

test('the open workflow is a modal working surface, not a column beside an inert canvas', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await expect(page.getByTestId('deck-slide-card')).toBeVisible();
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
    await listSettled(page);

    const box = await geometry(page);
    expect(box.prompt, 'the deck card should still be rendered').not.toBeNull();
    expect(box.panel, 'the panel should be open').not.toBeNull();

    // #131: the scrim is visible. This is the assertion #75 asserted the
    // opposite of, and reversing it is the point of the change.
    expect(box.scrimBackground, 'the scrim is a real scrim again').not.toBe(TRANSPARENT);
    expect(box.scrimCovers, 'the scrim covers the viewport').toBe(true);

    // ...and the canvas is therefore genuinely inert, which is what makes
    // `aria-modal="true"` honest rather than merely present.
    expect(box.ariaModal).toBe('true');
    expect(
      box.hitsPromptCentre,
      'the deck card must not receive pointer events while the workflow is open',
    ).not.toContain('deck-slide-card');

    // The working surface is centred, not docked to an edge.
    const centreOffset = Math.abs((box.panel!.left + box.panel!.right) / 2 - box.viewportWidth / 2);
    expect(centreOffset, `panel centre offset ${centreOffset}`).toBeLessThanOrEqual(1);

    // It is raised, not a flat edge.
    expect(box.panelShadow).not.toBe('none');

    // No sideways overflow.
    expect(box.scrollWidth).toBeLessThanOrEqual(box.viewportWidth);
  } finally {
    stub.server.close();
  }
});

test('the prompt is whole and on screen whenever the canvas is the resting state', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    const box = await geometry(page);

    // #75's original finding, still protected: a centred prompt must never be
    // left half-covered by an open panel. With the panel shut there is nothing to
    // cover it, and it must fit the viewport on both edges.
    expect(box.panel, 'no panel when closed').toBeNull();
    expect(box.prompt!.left).toBeGreaterThanOrEqual(0);
    expect(box.prompt!.right).toBeLessThanOrEqual(box.viewportWidth);
    expect(box.scrollWidth).toBeLessThanOrEqual(box.viewportWidth);
  } finally {
    stub.server.close();
  }
});

test('on a narrow viewport the panel is full-bleed and does not scroll the page', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(stub.base);
    const closed = await geometry(page);
    await page.getByRole('button', { name: 'Open requests', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Requests' })).toBeVisible();
    await listSettled(page);

    const box = await geometry(page);
    expect(box.panel!.width).toBe(390);
    // No width is reserved for the panel at any width: the canvas padding is
    // identical closed and open. #75's old rule reserved the panel width and then
    // had to cancel it again below 640px; both halves are gone.
    expect(box.paddingRight, 'no width is reserved for the panel').toBe(closed.paddingRight);
    expect(box.scrollWidth).toBeLessThanOrEqual(box.viewportWidth);
  } finally {
    stub.server.close();
  }
});