import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every colour the app paints comes from a token (#110, consolidated in #201).
 */

const css = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'client', 'styles.css'),
  'utf8',
);

const ROOT_START = css.indexOf(':root {');
const ROOT_END = css.indexOf('\n}\n', ROOT_START);
const rootBlock = css.slice(ROOT_START, ROOT_END);

const themeBlocks = /\[data-theme='(?:sand|dusk)'\] \{[\s\S]*?\n\}/g;
const bodyRules = css
  .slice(ROOT_END)
  .replace(themeBlocks, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const definedTokens = new Set(
  Array.from(rootBlock.matchAll(/(--[a-z0-9-]+)\s*:/g)).map((m) => m[1]),
);
const declaredAnywhere = new Set(
  Array.from(css.matchAll(/(--[a-z0-9-]+)\s*:/g)).map((m) => m[1]),
);

describe('colour lives in tokens', () => {
  it('declares every required colour role in :root and overrides board/surface roles per theme', () => {
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
    for (const theme of ['sand', 'dusk']) {
      const block = css.slice(css.indexOf(`[data-theme='${theme}'] {`));
      const section = block.slice(0, block.indexOf('\n}'));
      for (const token of ['--cell-empty', '--board-gap', '--surface', '--text', '--border']) {
        expect(section, `${theme} does not override ${token}`).toContain(`${token}:`);
      }
    }
  });

  it('defines every var() token it uses and has no colour literal outside :root/themes', () => {
    const offenders: string[] = [];
    bodyRules.split('\n').forEach((line, index) => {
      if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\brgba?\s*\(/.test(line)) {
        offenders.push(`styles.css body line ${index}: ${line.trim()}`);
      }
    });
    expect(offenders, `colour literals outside :root:\n${offenders.join('\n')}`).toEqual([]);

    const used = new Set(Array.from(css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)).map((m) => m[1]));
    const missing = [...used].filter((t) => !declaredAnywhere.has(t));
    expect(missing, `used but never declared: ${missing.join(', ')}`).toEqual([]);
  });

  it('routes surface, field, link, button, and on-art text through semantic tokens and honours prefers-reduced-motion', () => {
    expect(bodyRules).toMatch(/\.comment-body pre\s*\{[^}]*background:\s*var\(--field\)/);
    expect(bodyRules).toMatch(/\.comment-body code\s*\{[^}]*background:\s*var\(--neutral-weak\)/);
    expect(bodyRules).toMatch(/\.tetris-cell\s*\{[^}]*background:\s*var\(--cell-empty\)/);
    expect(bodyRules).toContain('var(--elevation-scroll)');
    expect(bodyRules).toMatch(/input\[type="text"\], textarea\s*\{[^}]*background:\s*var\(--field\)/);
    expect(bodyRules).toMatch(/a\s*\{[^}]*color:\s*var\(--accent-weak-text\)/);
    expect(bodyRules).toMatch(/button\s*\{[^}]*background:\s*var\(--surface\)[^}]*color:\s*var\(--text\)/);
    // Opaque surface backing for Tetris stats & on-art text (#76, #90).
    expect(bodyRules).toMatch(/\.tetris-side\s*\{[^}]*background:\s*var\(--surface\)/);
    expect(bodyRules).toMatch(/\.tetris-title\s*\{[^}]*background:\s*var\(--surface\)/);
    expect(bodyRules).toMatch(/\.tetris-help,\s*\.tetris-scene\s*\{[^}]*background:\s*var\(--surface\)/);
    // Reduced-motion block disables animations (#76, #186, #198).
    const reducedBlock = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/);
    expect(reducedBlock).not.toBeNull();
    expect(reducedBlock?.[0]).toContain('animation: none');
  });
});
