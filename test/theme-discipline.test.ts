import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Theme & type-scale discipline (#103, #134, consolidated in #201).
 */

const css = readFileSync(fileURLToPath(new URL('../src/client/styles.css', import.meta.url)), 'utf8');
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');

function values(selector: string, property: string): string[] {
  const found: string[] = [];
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

const THEMES = [':root', "[data-theme='sand']", "[data-theme='dusk']"] as const;

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex: ${hex}`);
  const n = Number.parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function chroma(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
}

describe('theme and type-scale discipline', () => {
  it('enforces four-corner border radii, hairline vertical borders, and no theme gradients', () => {
    const radiusOffenders: string[] = [];
    for (const m of declarations.matchAll(/border-radius:\s*([^;}]+)/g)) {
      const value = m[1].trim();
      const parts = value.split(/\s+/);
      if (parts.length !== 1 && parts.length !== 4) radiusOffenders.push(value);
    }
    expect(radiusOffenders, `partial radii: ${radiusOffenders.join(' | ')}`).toEqual([]);

    const borderOffenders: string[] = [];
    for (const m of declarations.matchAll(/border-(left|right):\s*([^;}]+)/g)) {
      const width = m[2].trim().split(/\s+/)[0];
      const px = Number.parseFloat(width);
      if (Number.isFinite(px) && px > 1) borderOffenders.push(`${m[1]}: ${width}`);
    }
    expect(borderOffenders, `thick vertical borders: ${borderOffenders.join(' | ')}`).toEqual([]);

    const gradients = [...declarations.matchAll(/(?:^|[;{])\s*([\w-]*gradient[\w-]*):/g)].map((m) => m[1]);
    expect(gradients, `gradients present: ${gradients.join(', ')}`).toEqual([]);
  });

  it('uses only the four role-named font-size tokens with a 12px floor', () => {
    const rawSizes = Array.from(css.matchAll(/font-size:\s*([^;]+);/g))
      .map((match) => match[1].trim())
      .filter((value) => !value.startsWith('var(--text-'));
    expect(rawSizes, `raw font-size values: ${rawSizes.join(', ')}`).toEqual([]);

    const tokens = Array.from(css.matchAll(/--text-[a-z]+:\s*[^;]+;/g)).map((match) => match[0]);
    expect(tokens).toHaveLength(4);
    expect(tokens.join('\n')).toContain('--text-display');
    expect(values(':root', '--text-xs')).toEqual(['12px']);
  });

  it('maintains a nine-step monotonic near-neutral ramp and --accent in every theme', () => {
    for (const theme of THEMES) {
      expect(values(theme, '--accent'), `${theme} defines --accent`).toHaveLength(1);
      const ramp = Array.from({ length: 9 }, (_, i) => values(theme, `--n${i + 1}`)[0]);
      for (const [i, value] of ramp.entries()) {
        expect(value, `${theme} --n${i + 1}`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(chroma(value!), `${theme} --n${i + 1} chroma`).toBeLessThanOrEqual(0.14);
      }
      const ys = ramp.map((v) => luminance(v!));
      const dark = ys[0]! < ys[ys.length - 1]!;
      const diffs = ys.slice(1).map((y, i) => (dark ? y - ys[i]! : ys[i]! - y));
      expect(diffs.filter((d) => d <= 0), `${theme} non-monotonic ramp`).toEqual([]);
      expect(new Set(ramp.map((v) => v!.toLowerCase())).size, `${theme} distinct steps`).toBe(9);
    }
  });
});
