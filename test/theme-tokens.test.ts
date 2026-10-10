import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every colour the app paints comes from a token (#110).
 *
 * Roughly twenty colour literals used to sit in the component rules below
 * `:root`, which meant a theme could only override part of the surface: the
 * borders, badges, banner, field, error and board colours would have stayed
 * light while everything else followed. Three of those literals were not even
 * new colours — `.comment-body pre` restated `--field`, the Tetris empty cell
 * was the badge fill at 74%, and the panel scroll shadow was `--text` at 14%.
 *
 * These are the executable form of that contract. Comments are stripped first,
 * because they legitimately contain issue references like `#102` that are not
 * colours.
 */

const css = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'client', 'styles.css'),
  'utf8',
);

const ROOT_START = css.indexOf(':root {');
const ROOT_END = css.indexOf('\n}\n', ROOT_START);

const rootBlock = css.slice(ROOT_START, ROOT_END);

/** Everything outside `:root`, with comments and the root block removed. */
const bodyRules = css
  .slice(ROOT_END)
  .replace(/\/\*[\s\S]*?\*\//g, '');

const definedTokens = new Set(
  Array.from(rootBlock.matchAll(/(--[a-z0-9-]+)\s*:/g)).map((m) => m[1]),
);

/**
 * Tokens declared anywhere, including component-scoped ones such as
 * `--tetris-art-fade`, which belongs to `.tetris-art` rather than the theme.
 * Used only to prove every `var()` resolves to something real.
 */
const declaredAnywhere = new Set(
  Array.from(css.matchAll(/(--[a-z0-9-]+)\s*:/g)).map((m) => m[1]),
);

describe('colour lives in tokens', () => {
  it('declares every colour role in :root', () => {
    // The roles this change added. Named here so deleting one fails loudly:
    // a theme that cannot reach a surface is the defect this guards.
    for (const token of [
      '--border-hover',
      '--field-border',
      '--neutral-weak',
      '--closed-weak',
      '--warning-border',
      '--problem-border',
      '--error-code-bg',
      '--summary-bg',
      '--on-accent',
      '--elevation-scroll',
      '--board-gap',
      '--cell-empty',
      ...'ijlostz'.split('').map((t) => `--tetromino-${t}`),
    ]) {
      expect(definedTokens.has(token), `${token} is not declared in :root`).toBe(true);
    }
  });

  it('has no colour literal outside :root', () => {
    const offenders: string[] = [];
    const lines = bodyRules.split('\n');
    lines.forEach((line, index) => {
      if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\brgba?\s*\(/.test(line)) {
        offenders.push(`styles.css body line ${index}: ${line.trim()}`);
      }
    });
    expect(
      offenders,
      `colour literals outside :root defeat theming:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('defines every token it uses', () => {
    // Deliberately checks against every declaration rather than against
    // `:root` alone: a component-scoped token like `--tetris-art-fade` is
    // legitimate, an undefined `var()` is not.
    const used = new Set(Array.from(css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)).map((m) => m[1]));
    const missing = [...used].filter((t) => !declaredAnywhere.has(t));
    expect(missing, `used but never declared: ${missing.join(', ')}`).toEqual([]);
  });

  it('routes the three duplicated values through their existing tokens', () => {
    // Each of these was a literal that silently restated a role already in
    // `:root`. Re-introducing the literal is how the duplication came back.
    expect(bodyRules).toMatch(/\.comment-body pre\s*\{[^}]*background:\s*var\(--field\)/);
    expect(bodyRules).toMatch(/\.comment-body code\s*\{[^}]*background:\s*var\(--neutral-weak\)/);
    expect(bodyRules).toMatch(/\.tetris-cell\s*\{[^}]*background:\s*var\(--cell-empty\)/);
    expect(bodyRules).toContain('var(--elevation-scroll)');
  });

  it('keeps the Tetris pieces named apart from surface roles', () => {
    // They are artwork, not interface. A theme can reach them, but naming them
    // apart stops a surface role from being repurposed as a piece colour.
    const surfaceNames = ['--bg', '--surface', '--field', '--border', '--text', '--muted', '--accent'];
    for (const name of surfaceNames) {
      expect(rootBlock).not.toMatch(new RegExp(`${name}:\\s*#[0-9a-fA-F]{3,8};[^;]*--tetromino`));
    }
  });
});