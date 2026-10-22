import type { ComponentType } from 'react';
import { TetrisView } from '../views/TetrisView';
import { PuzzleBobbleView } from '../views/PuzzleBobbleView';

/**
 * The first-party canvas content registry.
 *
 * Canvas content is compiled into the client and addressed by `?app=<id>`.
 * That is deliberately narrower than a plugin system: there is no manifest,
 * no remote loading, no install step and no per-app persistence. The registry
 * exists so the shell can own navigation and so each app stays a component
 * with one contract, not because the app is meant to become a platform.
 *
 * `id` must match the token the route parser accepts: lowercase letters,
 * digits and hyphens, starting with a letter.
 */
export type CanvasAppProps = {
  /** Return to the blank canvas. The shell owns the location. */
  onExit: () => void;
};

export type CanvasApp = {
  /** URL token: `?app=<id>`. */
  id: string;
  title: string;
  /** One quiet line in the switcher. */
  summary: string;
  element: ComponentType<CanvasAppProps>;
};

export const CANVAS_APPS: readonly CanvasApp[] = [
  {
    id: 'tetris',
    title: 'Tetris',
    summary: 'Clear lines. The board is local to this view.',
    element: TetrisView,
  },
  {
    id: 'puzzle-bobble',
    title: 'Puzzle Bobble',
    summary: '2-player Bust-A-Move bubble battle (ASDF vs Arrows). Local to this view.',
    element: PuzzleBobbleView,
  },
];

/** Resolve a route token to an app. Unknown or absent ids are the canvas. */
export function canvasAppById(id: string | null | undefined): CanvasApp | null {
  if (!id) return null;
  return CANVAS_APPS.find((app) => app.id === id) ?? null;
}
