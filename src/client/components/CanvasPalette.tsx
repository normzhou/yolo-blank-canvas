import { useEffect, useRef } from 'react';
import type { CanvasApp } from '../apps/registry';

const FOCUSABLE = 'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The shell's navigation palette.
 *
 * Navigation only by design (#165): the Requests panel stays a separate,
 * always-reachable surface. Mixing the two would make the first gallery
 * experiment harder to read.
 *
 * The dialog is transient: it is not in the URL, it does not survive a reload,
 * and closing it never changes which app is mounted.
 */
export function CanvasPalette({
  apps,
  activeAppId,
  onSelect,
  onClose,
}: {
  apps: readonly CanvasApp[];
  activeAppId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
        if (buttons.length === 0) return;
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (index < 0) return;
        event.preventDefault();
        const offset = event.key === 'ArrowDown' ? 1 : -1;
        buttons[(index + offset + buttons.length) % buttons.length].focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const container = dialogRef.current;
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div
      className="scrim palette-scrim"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Canvas apps" ref={dialogRef}>
        <header className="palette-header">
          <span className="palette-title">Canvas</span>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="palette-list" ref={listRef}>
          <button
            type="button"
            ref={firstRef}
            className={activeAppId === null ? 'palette-item is-current' : 'palette-item'}
            aria-label="Blank canvas"
            aria-current={activeAppId === null ? 'page' : undefined}
            onClick={() => onSelect(null)}
          >
            <span className="palette-name">Blank canvas</span>
            <span className="palette-hint">The prompt and the requests</span>
          </button>
          {apps.map((app) => (
            <button
              key={app.id}
              type="button"
              className={activeAppId === app.id ? 'palette-item is-current' : 'palette-item'}
              aria-label={app.title}
              aria-current={activeAppId === app.id ? 'page' : undefined}
              onClick={() => onSelect(app.id)}
            >
              <span className="palette-name">{app.title}</span>
              <span className="palette-hint">{app.summary}</span>
            </button>
          ))}
        </div>
        <p className="palette-foot">Esc closes · Ctrl/⌘K toggles</p>
      </div>
    </div>
  );
}
