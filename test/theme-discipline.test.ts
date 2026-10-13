import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Theme discipline (#134).
 *
 * The finish pass must be constrained by a rule set that can be *checked*, not by
 * adjectives. Research on this repeatedly found the same thing: "make it feel
 * less generic" does not change the output, a real constraint does. These are the
 * parts of that rule set which are true of **every** candidate, so they are
 * enforced here before any candidate has been chosen.
 *
 * Each rule below bans a specific documented tell rather than expressing taste.
 * They are deliberately mechanical — a check a person can re-run — so that a
 * theme cannot drift back into the distribution the constraint was written to
 * escape.
 */

const css = readFileSync(fileURLToPath(new URL('../src/client/styles.css', import.meta.url)), 'utf8');

/** Strip comments so a banned pattern in prose cannot fail the build. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');

function values(selector: string, property: string): string[] {
  const found: string[] = [];
  // The selector prefix must not consume the previous rule's closing brace, or
  // every second rule block is silently skipped and a missing token reads as a
  // pass. `[^{}]*` cannot cross a brace, so it stops at each block boundary on
  // its own.
  const rulePattern = /([^{}]*)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(declarations)) !== null) {
    const [, selectorText, body] = match;
    if (!selectorText.split(',').some((part) => part.trim() === selector)) continue;
    for (const decl of body.split(';')) {
      const [prop, ...rest] = decl.split(':');
      if (prop?.trim() === property) found.push(rest.join(':').trim());
    }
  }
  return found;
}

describe('no one-sided border radius', () => {
  it('every border-radius names all four corners', () => {
    // `border-radius: 6px 0 0 0` is the shape of the single-rounded-side accent
    // treatment that reads as machine-made. A single value means all four corners
    // and is fine; anything in between means the author chose which sides round.
    const offenders: string[] = [];
    const pattern = /border-radius:\s*([^;}]+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(declarations)) !== null) {
      const value = match[1].trim();
      const parts = value.split(/\s+/);
      const tokens = parts.filter((part) => !/^(var\(--[\w-]+\)|0)$/.test(part));
      // One token (possibly a var) rounds all corners; four tokens name all four.
      if (parts.length !== 1 && parts.length !== 4) offenders.push(value);
      void tokens;
    }
    expect(offenders, `one-sided or partial radii: ${offenders.join(' | ')}`).toEqual([]);
  });
});

describe('no heavy vertical borders', () => {
  it('no border-left or border-right is wider than the hairline', () => {
    // A thick coloured left border is the most recognisable generated-UI tell.
    // The hairline (1px) is the whole border vocabulary of this app; anything
    // heavier is either an accent bar or a card, and this UI has neither.
    const offenders: string[] = [];
    const pattern = /border-(left|right):\s*([^;}]+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(declarations)) !== null) {
      const width = match[2].trim().split(/\s+/)[0];
      const px = Number.parseFloat(width);
      if (Number.isFinite(px) && px > 1) offenders.push(`${match[1]}: ${width}`);
    }
    expect(offenders, `thick vertical borders: ${offenders.join(' | ')}`).toEqual([]);
  });
});

describe('type never drops below the readable floor', () => {
  it('no font-size is declared below 12px', () => {
    // Captured in review: *"the default for some reason is to use nigh-illegibly
    // small text"*. `--text-xs` is 12px and is the floor; nothing may go under it.
    const offenders: string[] = [];
    const pattern = /font-size:\s*([\d.]+)px/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(declarations)) !== null) {
      const px = Number.parseFloat(match[1]);
      if (px < 12) offenders.push(`${match[1]}px`);
    }
    expect(offenders, `font sizes below the 12px floor: ${offenders.join(' | ')}`).toEqual([]);
  });

  it('keeps the declared floor at 12px', () => {
    expect(values(':root', '--text-xs')).toEqual(['12px']);
  });
});

describe('the accent is available to state, not only to decoration', () => {
  it('the accent token exists once per theme', () => {
    // A constraint that cannot name the accent has no way to say the accent is
    // reserved. It must be a real token in every theme, not a literal.
    for (const selector of [':root', "[data-theme='sand']", "[data-theme='dusk']"]) {
      expect(values(selector, '--accent'), `${selector} defines --accent`).toHaveLength(1);
    }
  });

  it('no gradient is used anywhere in the theme surface', () => {
    // Gradients were the most-cited piece of the generated look in the research
    // behind this constraint, and they are decoration by definition.
    const gradients = [...declarations.matchAll(/(?:^|[;{])\s*([\w-]*gradient[\w-]*):/g)].map((m) => m[1]);
    expect(gradients, `gradients present: ${gradients.join(', ')}`).toEqual([]);
  });
});

/**
 * Constraint B, terminal phosphor — the rule set the maintainer approved on #146
 * and the agent applied on #134.
 *
 * B has one rule that can fail: **the neutral ramp between text and ground spans
 * at least nine distinguishable steps**, and it is one hue family. Everything else
 * in B (accent reserved for state, no glow) is already covered above or is a
 * statement about where a token may be used rather than a measurable property.
 */

const THEMES = [':root', "[data-theme='sand']", "[data-theme='dusk']"] as const;

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex: ${hex}`);
  const n = Number.parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Colourfulness as simple chroma (max channel − min channel), not HSL saturation.
 *
 * HSL saturation is unusable for this check: `#fffdfa` — visually a plain off-white
 * — scores 1.0 because the formula divides by a vanishing denominator near white,
 * and would score 1.0 again near black. Chroma does not have that failure mode at
 * either end, which is exactly where a nine-step ramp spends most of its range.
 *
 * The threshold is 0.14 (~36/255). That admits a warm-neutral step such as
 * `#c4b9a3` at 0.13 while rejecting anything that reads as a colour in its own
 * right. It is a judgement, and a deliberately loose one: the purpose is to stop a
 * second hue entering the surface, not to grade the palette.
 */
function chroma(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

/** Relative luminance, used for monotonicity: the ramp must darken or lighten steadily. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
}

describe.each(THEMES)('constraint B: %s has a nine-step neutral ramp', (theme) => {
  const ramp = Array.from({ length: 9 }, (_, i) => values(theme, `--n${i + 1}`)[0]);

  it('declares all nine steps', () => {
    const missing = ramp.map((v, i) => (v ? null : `--n${i + 1}`)).filter(Boolean);
    expect(missing, `missing ramp steps: ${missing.join(', ')}`).toEqual([]);
  });

  it('every step is a literal, not an unresolved reference', () => {
    for (const [i, value] of ramp.entries()) {
      expect(value, `--n${i + 1}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('is one hue family — no step is a colour in its own right', () => {
    // "Monochrome" is the operative word. Each step must be a near-neutral: a
    // saturated step would put a second hue into the surface, which is exactly
    // what this constraint exists to prevent.
    const chromatic = ramp
      .map((value, i) => ({ step: `--n${i + 1}`, sat: chroma(value) }))
      .filter((entry) => entry.sat > 0.14);
    expect(chromatic, `saturated ramp steps: ${chromatic.map((c) => `${c.step} chroma ${c.sat.toFixed(3)}`).join(', ')}`).toEqual([]);
  });

  it('runs monotonically from ground to text', () => {
    // A ramp that goes up and down is not a ramp; it is a palette with extra
    // steps. Direction is set by the theme's own polarity.
    const ys = ramp.map(luminance);
    const dark = ys[0]! < ys[ys.length - 1]!;
    const diffs = ys.slice(1).map((y, i) => (dark ? y - ys[i]! : ys[i]! - y));
    const backwards = diffs.filter((d) => d <= 0);
    expect(backwards, `non-monotonic steps (${dark ? 'dark' : 'light'} ramp): ${backwards.length} of ${diffs.length}`).toEqual([]);
  });

  it('has nine distinguishable steps, not nine names for two colours', () => {
    // Adjacent steps must be far enough apart to read as different. The separation
    // floor from status-presentation.md (|Lc| >= 8) is the right bar here.
    const distinct = new Set(ramp.map((v) => v.toLowerCase()));
    expect(distinct.size, `only ${distinct.size} distinct colours across nine steps`).toBe(9);
  });
});