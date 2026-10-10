import React from 'react';
import { useEffect, useState } from 'react';
import { THEMES, THEME_LABELS, type Theme, loadTheme, saveTheme, resolveTheme } from '../theme';

/**
 * The theme control.
 *
 * A three-way segmented group rather than a dropdown: every option is visible
 * at once, so the control shows what the choices are instead of hiding them.
 * It carries `role="radiogroup"` so arrow-key movement is expected behaviour,
 * and each option is a real button rather than a div with a click handler.
 */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>('slate');

  useEffect(() => {
    const mql =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    setTheme(resolveTheme(loadTheme(window.localStorage), mql));
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    saveTheme(window.localStorage, next);
    document.documentElement.setAttribute('data-theme', next);
    // Form controls, scrollbars and the caret follow this, not just our tokens.
    document.documentElement.style.colorScheme = next === 'dusk' ? 'dark' : 'light';
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const step = keys[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = THEMES.indexOf(theme);
    const next = THEMES[(index + step + THEMES.length) % THEMES.length];
    choose(next);
    // Move focus with the selection, as a radiogroup must.
    document.getElementById(`theme-option-${next}`)?.focus();
  };

  return (
    <div
      className="theme-switcher"
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onKeyDown}
    >
      {THEMES.map((option) => (
        <button
          key={option}
          id={`theme-option-${option}`}
          type="button"
          role="radio"
          className={option === theme ? 'theme-option is-selected' : 'theme-option'}
          aria-checked={option === theme}
          tabIndex={option === theme ? 0 : -1}
          onClick={() => choose(option)}
        >
          {THEME_LABELS[option]}
        </button>
      ))}
    </div>
  );
}