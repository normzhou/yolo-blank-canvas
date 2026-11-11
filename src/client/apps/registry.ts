import type { ComponentType } from 'react';
import type { CanvasAppProps, GameEntryModule, GamePackageDescriptor } from '../../games/types';
import { puzzleBobbleDescriptor } from '../../games/puzzle-bobble/descriptor';
import { tetrisDescriptor } from '../../games/tetris/descriptor';
import { createLazyGameElement, loadGameComponent } from '../gameBundles';

export type { CanvasAppProps } from '../../games/types';

/**
 * The first-party modular canvas registry (#165, #306).
 *
 * Only lightweight menu metadata (`descriptor.ts`) is compiled into the Home
 * shell. Each game's engine and view live in their own content-hashed bundle
 * (`/games/<id>-<hash>.js`, tracked by `/games/manifest.json`), lazily fetched,
 * SHA-256 verified, and persisted in `CacheStorage` (`yolo-arcade-games-v1`)
 * when the user enters that game.
 */
export interface CanvasApp extends GamePackageDescriptor {
  readonly element: ComponentType<CanvasAppProps>;
  readonly preload: () => Promise<ComponentType<CanvasAppProps>>;
}

function defineLazyCanvasApp(
  descriptor: GamePackageDescriptor,
  devLoader: () => Promise<GameEntryModule>,
): CanvasApp {
  return {
    ...descriptor,
    element: createLazyGameElement(descriptor, devLoader),
    preload: () => loadGameComponent(descriptor, devLoader),
  };
}

const devPuzzleBobbleLoader: () => Promise<GameEntryModule> =
  import.meta.env.DEV || import.meta.env.MODE === 'test'
    ? () => import('../../games/puzzle-bobble/entry')
    : () => Promise.reject(new Error('Production builds load game bundles via /games/manifest.json'));

const devTetrisLoader: () => Promise<GameEntryModule> =
  import.meta.env.DEV || import.meta.env.MODE === 'test'
    ? () => import('../../games/tetris/entry')
    : () => Promise.reject(new Error('Production builds load game bundles via /games/manifest.json'));

export const CANVAS_APPS: readonly CanvasApp[] = [
  defineLazyCanvasApp(puzzleBobbleDescriptor, devPuzzleBobbleLoader),
  defineLazyCanvasApp(tetrisDescriptor, devTetrisLoader),
];

/** Resolve a route token to an app. Unknown or absent ids are the canvas. */
export function canvasAppById(id: string | null | undefined): CanvasApp | null {
  if (!id) return null;
  return CANVAS_APPS.find((app) => app.id === id) ?? null;
}
