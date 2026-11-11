import type { ComponentType } from 'react';

export type CanvasAppProps = {
  /** Return to the blank canvas. The shell owns the location. */
  onExit: () => void;
};

export interface GameControlHint {
  readonly keys: readonly string[];
  readonly label: string;
}

export interface GamePackageDescriptor {
  /** URL token: `?app=<id>`. */
  readonly id: string;
  readonly packageName: string;
  readonly version: string;
  readonly title: string;
  /** One quiet line in the switcher / slide deck. */
  readonly summary: string;
  /** Mode badge displayed on the home slide deck. */
  readonly modeBadge: string;
  /** Accessible label for the deck controls grid. */
  readonly controlsLabel: string;
  readonly controls: readonly GameControlHint[];
}

export interface GameManifestEntry {
  readonly id: string;
  readonly packageName: string;
  readonly version: string;
  /** Full 64-character SHA-256 hex digest of the game's entry bundle. */
  readonly hash: string;
  /** Same-origin immutable module URL (`/games/<id>-<hash>.js`). */
  readonly entry: string;
  /** Ordered list of same-origin JS chunks required to evaluate `entry` offline. */
  readonly chunks: readonly string[];
  /** Byte size of the game's entry chunk. */
  readonly sizeBytes: number;
}

export interface GameBundleManifest {
  readonly schemaVersion: 1;
  readonly games: Readonly<Record<string, GameManifestEntry>>;
}

export type GameEntryModule = {
  readonly default: ComponentType<CanvasAppProps>;
};
