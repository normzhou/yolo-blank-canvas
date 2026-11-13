import type { ComponentType } from 'react';
import type { CanvasAppProps, GameEntryModule, GamePackageDescriptor } from '../../games/types';
import { starlightBurstDescriptor } from '../../games/starlight-burst/descriptor';
import { prismStackDescriptor } from '../../games/prism-stack/descriptor';
import { createLazyGameElement, loadGameComponent } from '../gameBundles';

export type { CanvasAppProps } from '../../games/types';

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

const devStarlightBurstLoader: () => Promise<GameEntryModule> =
  import.meta.env.DEV || import.meta.env.MODE === 'test'
    ? () => import('../../games/starlight-burst/entry')
    : () => Promise.reject(new Error('Production builds load game bundles via /games/manifest.json'));

const devPrismStackLoader: () => Promise<GameEntryModule> =
  import.meta.env.DEV || import.meta.env.MODE === 'test'
    ? () => import('../../games/prism-stack/entry')
    : () => Promise.reject(new Error('Production builds load game bundles via /games/manifest.json'));

export const CANVAS_APPS: readonly CanvasApp[] = [
  defineLazyCanvasApp(starlightBurstDescriptor, devStarlightBurstLoader),
  defineLazyCanvasApp(prismStackDescriptor, devPrismStackLoader),
];

/** Resolve a route token to an app. Unknown or absent ids are the canvas. */
export function canvasAppById(id: string | null | undefined): CanvasApp | null {
  if (!id) return null;
  return CANVAS_APPS.find((app) => app.id === id) ?? null;
}
