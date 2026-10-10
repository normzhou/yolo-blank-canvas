import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  PRE_PAINT_SNIPPET,
  THEMES,
  THEME_KEY,
  isTheme,
  loadTheme,
  resolveTheme,
  saveTheme,
  systemTheme,
} from '../src/client/theme';

/**
 * The theme preference (#110).
 *
 * Two properties matter and are easy to lose:
 *
 *  1. Nothing stored means following `prefers-color-scheme`, not a fixed
 *     default. Someone who has told their OS they want dark should not have to
 *     find a control to get it.
 *  2. A broken or unavailable store degrades to following the system. It never
 *     throws and never leaves the app unstyled.
 *
 * The third block guards `index.html`. That file inlines its own copy of the
 * decision so the theme can be applied before first paint, and a second copy of
 * a rule is a second rule that can quietly go stale — this checks it still
 * matches the module.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8');

const storeOf = (initial: Record<string, string> = {}) => {
  const map = { ...initial };
  return {
    getItem: (k: string) => map[k] ?? null,
    setItem: (k: string, v: string) => {
      map[k] = v;
    },
    read: map,
  };
};

describe('theme storage', () => {
  it('recognises exactly the shipped themes', () => {
    for (const theme of THEMES) expect(isTheme(theme)).toBe(true);
    for (const value of ['', 'Dusk', 'sepia', null, undefined, 3, {}]) {
      expect(isTheme(value)).toBe(false);
    }
  });

  it('round-trips a stored choice', () => {
    const store = storeOf();
    saveTheme(store, 'dusk');
    expect(loadTheme(store)).toBe('dusk');
    expect(store.read[THEME_KEY]).toBe('dusk');
  });

  it('ignores a stored value that is not a theme', () => {
    expect(loadTheme(storeOf({ [THEME_KEY]: 'neon' }))).toBeNull();
    expect(loadTheme(storeOf({ [THEME_KEY]: '{}' }))).toBeNull();
  });

  it('degrades to following the system when storage is unavailable', () => {
    const hostile = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => loadTheme(hostile)).not.toThrow();
    expect(loadTheme(hostile)).toBeNull();
    expect(() => saveTheme(hostile, 'sand')).not.toThrow();
    expect(loadTheme(null)).toBeNull();
  });
});

describe('which theme renders', () => {
  const prefersDark = (matches: boolean) => ({ matches });
  const light = prefersDark(false);
  const dark = prefersDark(true);

  it('follows the system when nothing is stored', () => {
    expect(resolveTheme(null, light)).toBe(DEFAULT_LIGHT);
    expect(resolveTheme(null, dark)).toBe(DEFAULT_DARK);
  });

  it('lets a stored choice win over the system', () => {
    expect(resolveTheme('sand', dark)).toBe('sand');
    expect(resolveTheme('slate', dark)).toBe('slate');
  });

  it('falls back to light when the media query is unavailable', () => {
    expect(systemTheme(null)).toBe(DEFAULT_LIGHT);
    expect(resolveTheme(null, null)).toBe(DEFAULT_LIGHT);
  });
});

describe('the pre-paint copy in index.html stays in step', () => {
  it('applies the attribute before the app bundle loads', () => {
    // If this moved below the module script the app would paint the default
    // theme first and then correct itself — a visible flash.
    const scriptAt = indexHtml.indexOf("setAttribute('data-theme'");
    const moduleAt = indexHtml.indexOf('<script type="module"');
    expect(scriptAt).toBeGreaterThan(-1);
    expect(moduleAt).toBeGreaterThan(-1);
    expect(scriptAt).toBeLessThan(moduleAt);
  });

  it('reads the same key and recognises the same themes', () => {
    expect(indexHtml).toContain(`'${THEME_KEY}'`);
    for (const theme of THEMES) {
      expect(indexHtml, `index.html does not mention ${theme}`).toContain(`'${theme}'`);
    }
    expect(indexHtml).toContain(`'${DEFAULT_DARK}'`);
    expect(indexHtml).toContain(`'${DEFAULT_LIGHT}'`);
  });

  it('contains the module\'s snippet verbatim, ignoring whitespace', () => {
    // The module holds the canonical string and index.html inlines it. Comparing
    // with whitespace removed keeps the check meaningful without making it a
    // formatting test.
    const squeeze = (s: string) => s.replace(/\s+/g, '');
    expect(indexHtml.replace(/\s+/g, '')).toContain(squeeze(PRE_PAINT_SNIPPET));
  });
});