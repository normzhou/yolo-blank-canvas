import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Contrast for every theme, on two axes (#110, consolidated in #201).
 *
 * Enforces both WCAG 2.1 (>= 4.5:1) and APCA (|Lc| >= 60 for text, |Lc| >= 8
 * for separations) across all three themes (slate, sand, dusk), replacing the
 * duplicate single-theme `test/contrast.test.ts` file and table-expanded
 * `it.each` micro-tests.
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
  for (const [token, value] of Object.entries(tokens)) {
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (ref) tokens[token] = tokens[ref[1]] ?? value;
  }
  return tokens;
}

const TEXT_PAIRS: Array<[string, string, string]> = [
  ['body text on surface', '--text', '--surface'],
  ['body text on bg', '--text', '--bg'],
  ['body text in field', '--text', '--field'],
  ['muted meta on surface', '--muted', '--surface'],
  ['muted meta on bg', '--muted', '--bg'],
  ['link on surface', '--accent-weak-text', '--surface'],
  ['link on summary bg', '--accent-weak-text', '--summary-bg'],
  ['link on field', '--accent-weak-text', '--field'],
  ['primary button label', '--on-accent', '--accent'],
  ['badge: in progress', '--accent-weak-text', '--accent-weak'],
  ['badge: waiting', '--warning', '--warning-weak'],
  ['badge: problem', '--problem', '--problem-weak'],
  ['stale marker on surface', '--problem', '--surface'],
  ['badge: closed', '--closed', '--closed-weak'],
  ['neutral badge', '--muted', '--neutral-weak'],
  ['error text', '--error-text', '--error-bg'],
  ['positive on surface', '--positive', '--surface'],
];

const NON_TEXT_PAIRS: Array<[string, string, string]> = [
  ['border on surface', '--border', '--surface'],
  ['border on bg', '--border', '--bg'],
  ['field border on surface', '--field-border', '--surface'],
  ['hover border on surface', '--border-hover', '--surface'],
  ['warning border', '--warning-border', '--warning-weak'],
  ['problem border', '--problem-border', '--problem-weak'],
  ['board grid', '--board-gap', '--surface'],
];

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

const THEMES = ['slate', 'sand', 'dusk'] as const;

describe('theme contrast & legibility', () => {
  it('matches published APCA reference values', () => {
    expect(apcaLc('#888888', '#ffffff')).toBeCloseTo(63.1, 0);
    expect(apcaLc('#000000', '#ffffff')).toBeCloseTo(106.0, 0);
    expect(apcaLc('#ffffff', '#000000')).toBeCloseTo(-107.9, 0);
  });

  for (const theme of THEMES) {
    it(`theme "${theme}" clears WCAG and APCA floors across all text and separation pairs`, () => {
      const tokens = themeTokens(theme);
      for (const [label, fg, bg] of TEXT_PAIRS) {
        const F = tokens[fg];
        const B = tokens[bg];
        expect(F, `${theme}: ${fg} missing`).toBeDefined();
        expect(B, `${theme}: ${bg} missing`).toBeDefined();
        expect(contrast(F!, B!), `${theme}: ${label} WCAG (${F} on ${B})`).toBeGreaterThanOrEqual(MIN_WCAG);
        expect(Math.abs(apcaLc(F!, B!)), `${theme}: ${label} APCA (${F} on ${B})`).toBeGreaterThanOrEqual(MIN_LC_TEXT);
      }
      for (const [label, fg, bg] of NON_TEXT_PAIRS) {
        const F = tokens[fg];
        const B = tokens[bg];
        expect(Math.abs(apcaLc(F!, B!)), `${theme}: ${label} APCA (${F} on ${B})`).toBeGreaterThanOrEqual(
          MIN_LC_NON_TEXT,
        );
      }
      expect(tokens['--warning']).not.toBe(tokens['--problem']);
      expect(tokens['--field']).not.toBe(tokens['--surface']);
    });
  }

  it('declares matching colour roles across all themes with genuine light/dark polarity', () => {
    const baseline = Object.keys(themeTokens('slate'))
      .filter((k) => COLOUR_ROLES.has(k))
      .sort();
    for (const theme of ['sand', 'dusk'] as const) {
      expect(css, `[data-theme='${theme}'] block missing`).toContain(`[data-theme='${theme}'] {`);
      const roles = Object.keys(themeTokens(theme))
        .filter((k) => COLOUR_ROLES.has(k))
        .sort();
      expect(roles, `${theme} colour roles mismatch`).toEqual(baseline);
    }
    const luminanceOf = (theme: 'slate' | 'sand' | 'dusk') =>
      relativeLuminance(hexToRgb(themeTokens(theme)['--surface']));
    expect(luminanceOf('dusk')).toBeLessThan(0.02);
    expect(luminanceOf('slate')).toBeGreaterThan(0.9);
    expect(luminanceOf('sand')).toBeGreaterThan(0.9);
  });
});
