import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Legibility floor for the palette in `styles.css`.
 *
 * The contrast figures quoted in issues come from running the app; this guards
 * them so a later palette edit cannot silently drop text below WCAG AA. Colours
 * are decoration — the status-presentation spec pins label→text mappings, not
 * these values — so this is a floor, not a design decision.
 */

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'client', 'styles.css'), 'utf8');

function token(name: string): string {
  const key = name.replace(/^--/, '');
  const declaration = css.match(new RegExp(`--${key}:\\s*([^;]+);`));
  if (!declaration) throw new Error(`token --${key} not found in styles.css`);
  const value = declaration[1]!.trim();
  // Since #134 the neutral roles are steps on a nine-step ramp, declared as
  // `var(--nN)`. Follow the reference so this measures the colour the browser
  // paints rather than failing on the indirection.
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
  if (ref) return token(ref[1]!);
  if (!/^#[0-9a-fA-F]{3,8}$/.test(value)) {
    throw new Error(`token --${key} is not a colour literal: ${value}`);
  }
  return value;
}

function channel(hex: string, index: number): number {
  const value = parseInt(hex.slice(1), 16);
  const perChannel = (hex.length - 1) / 3; // 1 for #abc, 2 for #aabbcc
  const shift = (2 - index) * perChannel * 4;
  return (value >> shift) & (perChannel === 1 ? 0xf : 0xff);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [0, 1, 2].map((index) => channel(hex, index) / 255);
  const linear = [r, g, b].map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG 2.1 contrast ratio, rounded to two decimals like the issue reports. */
export function contrast(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [high, low] = a > b ? [a, b] : [b, a];
  return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100;
}

// This guards the default palette (`:root` = Slate) with the contextual reasons
// each pair matters. Since #110 the app has three themes, all validated in
// `theme-contrast.test.ts` on both WCAG and APCA; this file remains the record of
// why each pair is checked, and the floor for the theme the app ships by default.
describe('colour tokens meet the legibility floor', () => {
  // Pairs that actually occur in the UI, so the guard cannot drift from what
  // ships. 4.5:1 is the WCAG 1.4.3 normal-text threshold.
  const textPairs: Array<[string, string, number, string]> = [
    ['--text', '--surface', 4.5, 'issue titles, body copy'],
    ['--muted', '--surface', 4.5, 'notes, panel footer, comment meta'],
    ['--muted', '--bg', 4.5, 'canvas identity line'],
    ['--text', '--field', 4.5, 'text typed into a field'],
    // `button.primary` paints `color: var(--on-accent)`. This pair used to name
    // `--surface` on the assumption that the panel surface was the white label
    // colour; under the #134 ramp `--surface` is the panel ground and `--on-accent`
    // is the label. The pair was measuring a colour the button never used. The
    // label token is checked here, and again with the APCA floor in
    // theme-contrast.test.ts.
    ['--on-accent', '--accent', 4.5, 'primary button label on the accent fill'],
    ['--problem', '--problem-weak', 4.5, 'Status needs reconciliation badge'],
    ['--problem', '--surface', 4.5, 'the stale marker'],
    ['--warning', '--warning-weak', 4.5, 'Waiting badge'],
    ['--accent-weak-text', '--accent-weak', 4.5, 'In progress badge and pressed filter'],
    ['--error-text', '--error-bg', 4.5, 'the error notice'],
  ];

  it.each(textPairs)('%s on %s is at least %s:1 (%s)', (foreground, background, minimum, where) => {
    expect(contrast(token(foreground), token(background)), `${foreground} on ${background} — ${where}`).toBeGreaterThanOrEqual(
      minimum,
    );
  });

  it('keeps the badge text distinct from the other amber role', () => {
    // Waiting and Needs reconciliation are both amber. They must not resolve to
    // the same value, or the alarm hierarchy is invisible.
    expect(token('--warning')).not.toBe(token('--problem'));
  });

  it('does not put text on translucent backdrop art any more', () => {
    // A translucent panel over arbitrary art cannot guarantee contrast at any
    // alpha; the stats panel is opaque for that reason.
    expect(css).not.toMatch(/\.tetris-side\s*\{[^}]*rgba\(/);
  });
});

describe('motion preference is honoured', () => {
  it('disables the backdrop crossfade under prefers-reduced-motion', () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/);
    expect(block, 'no prefers-reduced-motion block in styles.css').not.toBeNull();
    expect(block?.[0]).toContain('animation: none');
  });
});

describe('text fields read as fields', () => {
  it('gives inputs and textareas a fill distinct from the panel', () => {
    expect(token('--field')).not.toBe(token('--surface'));
    expect(css).toMatch(/input\[type="text"\], textarea \{[^}]*background: var\(--field\)/);
  });
});
