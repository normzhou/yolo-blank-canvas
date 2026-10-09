import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The type scale is a small, role-named set (#103).
 *
 * The review measured nine font sizes (11-22px) with three adjacent steps one
 * pixel apart, so hierarchy read as accidental. #103 collapsed them to four
 * role tokens. This guard stops literals creeping back in: a size that is not
 * one of the tokens has to be a deliberate, visible change.
 */

const css = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'client', 'styles.css'),
  'utf8',
);

describe('type scale', () => {
  it('uses only tokenised font sizes', () => {
    const literals = Array.from(css.matchAll(/font-size:\s*([^;]+);/g))
      .map((match) => match[1].trim())
      .filter((value) => !value.startsWith('var(--text-'));
    expect(literals, `raw font-size values: ${literals.join(', ')}`).toEqual([]);
  });

  it('defines a single role-named set of steps', () => {
    const tokens = Array.from(css.matchAll(/--text-[a-z]+:\s*[^;]+;/g)).map((match) => match[0]);
    expect(tokens).toHaveLength(4);
    expect(tokens.join('\n')).toContain('--text-display');
  });
});
