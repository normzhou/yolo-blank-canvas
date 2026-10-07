import { test, expect, freezeClock, settled, listSettled } from './fixtures';
import { startStubApp, makeStubGithub, withoutSummaryGithub, densityIssues, type RunningStub } from './stub-server';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Measured legibility pass for the UI review (#75).
 *
 * Contrast ratios and type/spacing values are read from the running app, so a
 * claim about the UI carries a number instead of an opinion. This spec only
 * measures and writes a report; it does not fail on a value, because clearing
 * the floor is the fix work (#76), not this capture step.
 */

// Reports are written beside the review images so a finding can cite both.
const REPORT_DIR = path.join(process.cwd(), 'e2e', 'review', 'measurements');
const OUT = path.join(REPORT_DIR, 'legibility.json');

const script = `() => {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (value) => {
    const m = String(value).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((p) => Number.parseFloat(p.trim()));
    return { rgb: parts.slice(0, 3), a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const effectiveBg = (el) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement.parentNode) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) {
        acc = acc === null ? (bg.a === 1 ? bg.rgb : null) : acc;
        if (bg.a === 1) return acc === null ? bg.rgb : acc;
        acc = bg.a === 1 ? bg.rgb : acc;
      }
      node = node.parentElement;
    }
    return acc ?? [255, 255, 255];
  };
  const describe = (el) => {
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    const bgRgb = effectiveBg(el);
    const fgRgb = fg && fg.a < 1 ? over(fg, bgRgb) : (fg ? fg.rgb : [0, 0, 0]);
    const size = Number.parseFloat(cs.fontSize);
    const weight = Number.parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    return {
      selector: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''),
      text: (el.textContent || '').trim().slice(0, 60),
      color: cs.color,
      background: 'rgb(' + bgRgb.join(',') + ')',
      ratio: ratio(fgRgb, bgRgb),
      fontSizePx: size,
      fontWeight: weight,
      lineHeight: cs.lineHeight,
      needs: large ? 3 : 4.5,
    };
  };
  const pick = (sel) => Array.from(document.querySelectorAll(sel));
  const nodes = [
    ...pick('.canvas-title, .canvas-prompt, .canvas-identity, .panel-repo, .panel-identity, .panel-footer span'),
    ...pick('.toolbar button, .filter-group button[aria-pressed="true"], .filter-group button[aria-pressed="false"]'),
    ...pick('.issue-row .issue-title, .issue-row .meta, .badge, .label-chip, .note, .hint, label'),
    ...pick('.summary-box h3, .summary-box p, .comment-header, .comment-body p, .empty, .stale'),
  ];
  const seen = new Set();
  const out = [];
  for (const el of nodes) {
    const d = describe(el);
    if (!d.text || seen.has(d.selector + d.fontSizePx + d.color)) continue;
    seen.add(d.selector + d.fontSizePx + d.color);
    out.push(d);
  }
  const spacing = {};
  for (const sel of ['.canvas', '.panel-body', '.toolbar', '.issue-row', '.comment', '.field', '.summary-box']) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const cs = getComputedStyle(el);
    spacing[sel] = { padding: cs.padding, margin: cs.margin, gap: cs.gap, radius: cs.borderRadius, border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor };
  }
  const root = getComputedStyle(document.documentElement);
  const tokens = {};
  for (const name of ['--bg','--surface','--border','--text','--muted','--accent','--accent-weak','--positive','--warning','--warning-weak','--problem','--closed','--radius']) {
    tokens[name] = root.getPropertyValue(name).trim();
  }
  const fontSizes = Array.from(new Set(out.map((d) => d.fontSizePx))).sort((a, b) => a - b);
  return { samples: out, spacing, tokens, fontSizes };
}`;

async function measure(page: import('@playwright/test').Page) {
  // `script` is a function expression, so it must be invoked in-page.
  return page.evaluate(`(${script})()`) as Promise<{
    samples: Array<{ selector: string; text: string; ratio: number; fontSizePx: number; fontWeight: number; needs: number }>;
    spacing: Record<string, unknown>;
    tokens: Record<string, string>;
    fontSizes: number[];
  }>;
}

test('measure contrast, type scale and spacing on the list and detail views', async ({ page }) => {
  const stub: RunningStub = await startStubApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await freezeClock(page);
    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await listSettled(page);
    const list = await measure(page);

    await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
    await settled(page);
    const detail = await measure(page);

    await page.goto(stub.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await page.getByRole('button', { name: 'New request' }).first().click();
    const form = await measure(page);

    const bySelector = (rows: typeof list.samples) => {
      const map = new Map<string, (typeof list.samples)[number]>();
      for (const row of rows) map.set(`${row.selector}|${row.fontSizePx}`, row);
      return map;
    };
    const merged = [...bySelector(list.samples).values(), ...bySelector(detail.samples).values(), ...bySelector(form.samples).values()];

    const failing = merged.filter((row) => row.ratio < row.needs).sort((a, b) => a.ratio - b.ratio);
    const report = {
      generatedFor: '#75 UI review — measured legibility',
      tokens: list.tokens,
      fontSizes: list.fontSizes,
      spacing: list.spacing,
      samples: merged.length,
      belowFloor: failing.map((row) => ({ selector: row.selector, text: row.text, ratio: row.ratio, needs: row.needs, fontSizePx: row.fontSizePx })),
      all: merged.map((row) => ({ selector: row.selector, text: row.text, ratio: row.ratio, needs: row.needs, fontSizePx: row.fontSizePx, fontWeight: row.fontWeight })),
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
    // The measurement must run; whether it passes is the fix work's business.
    expect(merged.length).toBeGreaterThan(10);
  } finally {
    stub.server.close();
  }
});

test('measure the density list and the no-summary detail state', async ({ page }) => {
  const density = await startStubApp(makeStubGithub({ issues: densityIssues() }));
  const plain = await startStubApp(withoutSummaryGithub());
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await freezeClock(page);
    await page.goto(density.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page.locator('.issue-row')).toHaveCount(30);
    await listSettled(page);
    const rows = await measure(page);

    await page.goto(plain.base);
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
    await settled(page);
    await expect(page.getByText('No progress summary yet.')).toBeVisible();
    const noSummary = await measure(page);

    const report = { generatedFor: '#75 UI review — density and no-summary states', density: rows, noSummary };
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORT_DIR, 'density-and-no-summary.json'), `${JSON.stringify(report, null, 2)}\n`);
    expect(rows.samples.length).toBeGreaterThan(5);
  } finally {
    density.server.close();
    plain.server.close();
  }
});
