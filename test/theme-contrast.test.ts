import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Contrast for every theme, on two axes (#110).
 *
 * WCAG 2.1 is the floor this project already enforced, and it stays. APCA is
 * added because the dark theme needs it: WCAG 2.x overstates contrast for dark
 * colours badly enough that a pair can clear 4.5:1 and still be hard to read.
 * A dark theme validated by ratio alone is not validated, which is why Dusk's
 * muted text and badge text were lifted until they cleared |Lc| 60 — the same
 * perceptual floor the light themes meet.
 *
 * APCA implementation follows apca-w3 0.1.9 and is checked below against that
 * package's published reference values, so a future edit that breaks the maths
 * fails here rather than quietly passing every pair.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, '..', 'src', 'client', 'styles.css'), 'utf8');

const MIN_WCAG = 4.5;
const MIN_LC_TEXT = 60;
const MIN_LC_NON_TEXT = 8;

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(fg: string, bg: string): number {
  const a = relativeLuminance(hexToRgb(fg));
  const b = relativeLuminance(hexToRgb(bg));
  const [high, low] = a > b ? [a, b] : [b, a];
  return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100;
}

// apca-w3 0.1.9 constants.
const A = {
  trc: 2.4, Rco: 0.2126729, Gco: 0.7151522, Bco: 0.072175,
  normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65,
  blkThrs: 0.022, blkClmp: 1.414, scaleBoW: 1.14, scaleWoB: 1.14,
  loBoWoffset: 0.027, loWoBoffset: 0.027, loClip: 0.1, deltaYmin: 0.0005,
};

function sRGBtoY(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => (v / 255) ** A.trc) as [number, number, number];
  return A.Rco * r + A.Gco * g + A.Bco * b;
}

/** Signed APCA Lc: positive for dark-on-light, negative for light-on-dark. */
export function apcaLc(text: string, bg: string): number {
  let txtY = sRGBtoY(hexToRgb(text));
  let bgY = sRGBtoY(hexToRgb(bg));
  txtY = txtY > A.blkThrs ? txtY : txtY + (A.blkThrs - txtY) ** A.blkClmp;
  bgY = bgY > A.blkThrs ? bgY : bgY + (A.blkThrs - bgY) ** A.blkClmp;
  if (Math.abs(bgY - txtY) < A.deltaYmin) return 0;
  let out: number;
  if (bgY > txtY) {
    out = (bgY ** A.normBG - txtY ** A.normTXT) * A.scaleBoW;
    out = out < A.loClip ? 0 : out - A.loBoWoffset;
  } else {
    out = (bgY ** A.revBG - txtY ** A.revTXT) * A.scaleWoB;
    out = out > -A.loClip ? 0 : out + A.loWoBoffset;
  }
  return out * 100;
}

/** Every colour a theme declares, from its `:root` or `[data-theme='…']` block. */
export function themeTokens(name: 'slate' | 'sand' | 'dusk'): Record<string, string> {
  const open = name === 'slate' ? ':root {' : `[data-theme='${name}'] {`;
  const start = css.indexOf(open);
  expect(start, `${open} block not found`).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf('\n}', start));
  const tokens: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) tokens[m[1]] = m[2].trim();
  return tokens;
}

/** [label, foreground token, background token] */
const TEXT_PAIRS: Array<[string, string, string]> = [
  ['body text on surface', '--text', '--surface'],
  ['body text on bg', '--text', '--bg'],
  ['muted meta on surface', '--muted', '--surface'],
  ['muted meta on bg', '--muted', '--bg'],
  ['link on surface', '--accent-weak-text', '--surface'],
  ['link on summary bg', '--accent-weak-text', '--summary-bg'],
  ['link on field', '--accent-weak-text', '--field'],
  ['primary button label', '--on-accent', '--accent'],
  ['badge: in progress', '--accent-weak-text', '--accent-weak'],
  ['badge: waiting', '--warning', '--warning-weak'],
  ['badge: problem', '--problem', '--problem-weak'],
  ['badge: closed', '--closed', '--closed-weak'],
  ['neutral badge', '--muted', '--neutral-weak'],
  ['error text', '--error-text', '--error-bg'],
  ['positive on surface', '--positive', '--surface'],
];

/** [label, foreground token, background token] — separations, not prose. */
const NON_TEXT_PAIRS: Array<[string, string, string]> = [
  ['border on surface', '--border', '--surface'],
  ['border on bg', '--border', '--bg'],
  ['field border on surface', '--field-border', '--surface'],
  ['hover border on surface', '--border-hover', '--surface'],
  ['warning border', '--warning-border', '--warning-weak'],
  ['problem border', '--problem-border', '--problem-weak'],
  ['board grid', '--board-gap', '--surface'],
];

/**
 * The colour roles a theme is expected to paint, named exactly. A prefix
 * pattern is not enough here: `--text-xs` is the type scale while `--text` is
 * a colour, and `--text-*` cannot tell them apart.
 */
const COLOUR_ROLES = new Set([
  '--bg', '--surface', '--field', '--border', '--border-hover', '--field-border',
  '--text', '--muted', '--accent', '--accent-weak', '--accent-weak-text', '--on-accent',
  '--positive', '--warning', '--warning-weak', '--warning-border',
  '--problem', '--problem-weak', '--problem-border',
  '--error-bg', '--error-text', '--error-code-bg',
  '--closed', '--closed-weak', '--neutral-weak', '--summary-bg',
  '--board-gap', '--cell-empty',
  '--elevation-scroll', '--elevation-scroll-fade', '--surface-transparent',
  ...'ijlostz'.split('').map((t) => `--tetromino-${t}`),
]);

const isColourRole = (token: string) => COLOUR_ROLES.has(token);

const THEMES = ['slate', 'sand', 'dusk'] as const;

describe('APCA implementation matches its published reference values', () => {
  // Without this the checks below could pass on broken maths.
  const cases: Array<[string, string, number]> = [
    ['#888888', '#ffffff', 63.1],
    ['#000000', '#ffffff', 106.0],
    ['#ffffff', '#000000', -107.9],
  ];
  for (const [text, bg, expected] of cases) {
    it(`${text} on ${bg} is about ${expected} Lc`, () => {
      expect(apcaLc(text, bg)).toBeCloseTo(expected, 0);
    });
  }
});

describe.each(THEMES)('theme "%s" is legible', (theme) => {
  const tokens = themeTokens(theme);
  const at = (token: string) => {
    const v = tokens[token];
    expect(v, `${theme}: ${token} is not declared`).toBeDefined();
    return v;
  };

  it.each(TEXT_PAIRS)('%s clears the WCAG floor and the APCA floor', (_label, fg, bg) => {
    const F = at(fg);
    const B = at(bg);
    const ratio = contrast(F, B);
    const lc = Math.abs(apcaLc(F, B));
    expect(ratio, `${theme}: ${_label} wcag ${ratio} (${F} on ${B})`).toBeGreaterThanOrEqual(MIN_WCAG);
    expect(lc, `${theme}: ${_label} APCA Lc ${lc.toFixed(1)} (${F} on ${B})`).toBeGreaterThanOrEqual(MIN_LC_TEXT);
  });

  it.each(NON_TEXT_PAIRS)('%s stays visible as a separation', (_label, fg, bg) => {
    const lc = Math.abs(apcaLc(at(fg), at(bg)));
    expect(lc, `${theme}: ${_label} APCA Lc ${lc.toFixed(1)}`).toBeGreaterThanOrEqual(MIN_LC_NON_TEXT);
  });

  it('covers the same colour roles as the other themes', () => {
    // `:root` additionally holds the theme-independent tokens — type scale,
    // spacing, radii, font — so its set is deliberately larger. What has to
    // match is the set of colour roles the themes override; a role present in
    // one theme and absent from another is a theme that cannot paint.
    const mine = Object.keys(tokens).filter(isColourRole).sort();
    for (const other of THEMES) {
      const theirs = Object.keys(themeTokens(other)).filter(isColourRole).sort();
      expect(mine, `${theme} covers different colour roles than ${other}`).toEqual(theirs);
    }
  });
});

describe('themes are reachable from the document', () => {
  it('declares a block per theme', () => {
    for (const theme of THEMES) {
      if (theme === 'slate') continue;
      expect(css, `[data-theme='${theme}'] block missing`).toContain(`[data-theme='${theme}'] {`);
    }
  });

  it('gives Dusk a genuinely dark surface and the others genuinely light ones', () => {
    // A dark surface under a light colour-scheme renders form controls and
    // scrollbars dark-on-dark — the kind of thing a ratio test misses.
    const luminanceOf = (theme: 'slate' | 'sand' | 'dusk') =>
      relativeLuminance(hexToRgb(themeTokens(theme)['--surface']));
    expect(luminanceOf('dusk')).toBeLessThan(0.02);
    expect(luminanceOf('slate')).toBeGreaterThan(0.9);
    expect(luminanceOf('sand')).toBeGreaterThan(0.9);
  });
});