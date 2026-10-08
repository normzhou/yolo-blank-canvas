import { test, expect, listSettled } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * The app's own links (#94).
 *
 * `styles.css` styled Markdown links but had no rule for the anchors the app
 * renders itself, so those inherited the browser's default blue: a link inside
 * an issue author's Markdown and the app's own `source` link rendered in
 * different colours.
 *
 * Two things are asserted, and the second is the one that matters:
 *
 * 1. Every anchor takes its colour from a token. Checked against the computed
 *    value rather than "is it blue", so dropping the rule fails here instead of
 *    quietly passing on whatever the UA stylesheet happens to say.
 * 2. Each one clears 4.5:1 against the background it actually composites over.
 *    The background is resolved by walking up translucent layers, because
 *    `--accent` reaches 4.63:1 on white and 4.46:1 on the summary note — a rule
 *    that assumed white would pass while failing in the one place it matters.
 */

const AA_NORMAL_TEXT = 4.5;
const LINK_TOKEN = '#0b3f8f'; // --accent-weak-text
const UA_DEFAULT_BLUE = '#0000ee';

const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};

async function readAnchors(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const parseRgba = (v: string) => v.match(/rgba?\(([^)]+)\)/)![1].split(',').map(Number.parseFloat);
    // Resolve the background an anchor really sits over, not an assumed white.
    const effectiveBg = (el: Element) => {
      const translucent: Array<{ rgb: number[]; alpha: number }> = [];
      let node: Element | null = el;
      let base: number[] = [255, 255, 255];
      while (node) {
        const parts = parseRgba(getComputedStyle(node).backgroundColor);
        const alpha = parts.length > 3 ? parts[3] : 1;
        if (alpha >= 0.999) {
          base = parts.slice(0, 3);
          break;
        }
        if (alpha > 0) translucent.push({ rgb: parts.slice(0, 3), alpha });
        node = node.parentElement;
      }
      let result = base;
      for (const layer of translucent.reverse()) {
        result = layer.rgb.map((v, i) => v * layer.alpha + result[i] * (1 - layer.alpha));
      }
      const hex = '#' + result.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      return { rgb: result, hex };
    };

    return Array.from(document.querySelectorAll('a')).map((a) => {
      const cs = getComputedStyle(a);
      const color = parseRgba(cs.color).slice(0, 3);
      return {
        text: a.textContent?.trim().slice(0, 28),
        hex: '#' + color.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''),
        background: effectiveBg(a).hex,
        inCommentBody: !!a.closest('.comment-body'),
      };
    });
  });
}

test('the app\'s own links use the project token, not the browser default', async ({ page }) => {
  const stub = await startStubApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Requests' }).click();
    await listSettled(page);
    await page.getByRole('button', { name: /#7 Make the canvas respond/ }).click();
    await expect(page.getByRole('link', { name: 'Open in GitHub ↗' })).toBeVisible();
    // The summary and comment source links arrive with their own requests. Wait
    // for them, or this measures the toolbar link alone and the "more than one
    // surface" assertion below turns into a race against the network.
    await expect(page.getByRole('link', { name: 'source' }).first()).toBeVisible();

    const anchors = await readAnchors(page);
    expect(anchors.length, 'expected the toolbar and comment source links').toBeGreaterThan(1);

    const backgrounds = new Set(anchors.map((a) => a.background));
    const reported: string[] = [];
    for (const anchor of anchors) {
      reported.push(`${anchor.inCommentBody ? 'markdown' : 'app'} "${anchor.text}" ${anchor.hex} on ${anchor.background}`);
      expect(
        anchor.hex,
        `${anchor.text}: inherited a colour the app did not choose (${anchor.hex === UA_DEFAULT_BLUE ? 'browser default' : 'unrecognised'})`,
      ).not.toBe(UA_DEFAULT_BLUE);
      expect(anchor.hex, `${anchor.text}: expected the ${LINK_TOKEN} link token`).toBe(LINK_TOKEN);
    }

    // The point of resolving the real background: at least one link here sits on
    // the summary note, where `--accent` would fall under the floor.
    expect(
      backgrounds.size,
      `expected more than one surface to check, got ${[...backgrounds].join(', ')} — ${reported.join('; ')}`,
    ).toBeGreaterThan(1);

    for (const anchor of anchors) {
      const fg = anchor.hex.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16));
      const bg = anchor.background.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16));
      const ratio = contrast(fg, bg);
      expect(ratio, `${anchor.text} on ${anchor.background}: contrast`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  } finally {
    stub.server.close();
  }
});
