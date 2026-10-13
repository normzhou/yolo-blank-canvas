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