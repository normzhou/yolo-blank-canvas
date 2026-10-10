/**
 * Theme selection and persistence (#110).
 *
 * Three themes, chosen for this app rather than pulled from a catalogue: a
 * blank canvas with one overlay panel and one local user. Slate is the palette
 * this project already had, Sand shifts temperature warm at the same lightness,
 * and Dusk is dark — aligned with how GitHub renders dark, so the records the
 * app displays still look like the records they are.
 *
 * All three are validated on two axes by `test/theme-tokens.test.ts`: the
 * WCAG 2.1 ratio floor this project already enforced, and APCA Lc. The dark
 * theme is the reason APCA is here — WCAG 2.x ratios overstate contrast for
 * dark colours badly enough that a palette can pass 4.5:1 and still be hard to
 * read, which is precisely the trap a dark theme walks into.
 *
 * The choice persists in localStorage. With no stored choice the app follows
 * `prefers-color-scheme`, so a user who has already told their OS they want
 * dark gets dark without touching a control.
 */

export const THEMES = ['slate', 'sand', 'dusk'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_LIGHT: Theme = 'slate';
export const DEFAULT_DARK: Theme = 'dusk';

export const THEME_KEY = 'yolo.theme';

/** Label shown on the control. Kept short: the header must not grow a legend. */
export const THEME_LABELS: Record<Theme, string> = {
  slate: 'Slate',
  sand: 'Sand',
  dusk: 'Dusk',
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** Any storage failure falls back to following the system, never to a crash. */
export function loadTheme(store: Pick<Storage, 'getItem'> | null | undefined): Theme | null {
  if (!store) return null;
  try {
    const raw = store.getItem(THEME_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveTheme(store: Pick<Storage, 'setItem'> | null | undefined, theme: Theme): void {
  if (!store) return;
  try {
    store.setItem(THEME_KEY, theme);
  } catch {
    // A full or unavailable storage must not break the control.
  }
}

export interface MediaQueryLike {
  matches: boolean;
  addEventListener?: (type: 'change', handler: () => void) => void;
  removeEventListener?: (type: 'change', handler: () => void) => void;
}

/** The theme to render when nothing is stored: follow the OS. */
export function systemTheme(mql: MediaQueryLike | null | undefined): Theme {
  return mql?.matches ? DEFAULT_DARK : DEFAULT_LIGHT;
}

export function resolveTheme(stored: Theme | null, mql: MediaQueryLike | null | undefined): Theme {
  return stored ?? systemTheme(mql);
}

/**
 * The snippet inlined in `index.html` must be able to set the attribute before
 * first paint, without the module graph. It therefore re-implements the two
 * decisions that affect that attribute — read the stored value, else follow
 * `prefers-color-scheme` — and nothing else. `test/theme.test.ts` checks this
 * copy against the module so the two cannot drift.
 */
export const PRE_PAINT_SNIPPET = `(function(){try{
var t=localStorage.getItem('${THEME_KEY}');
if(t!=='slate'&&t!=='sand'&&t!=='dusk'){
t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'${DEFAULT_DARK}':'${DEFAULT_LIGHT}';
}
document.documentElement.setAttribute('data-theme',t);
document.documentElement.style.colorScheme=t==='dusk'?'dark':'light';
}catch(e){}})();`;