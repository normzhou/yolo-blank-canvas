/**
 * Pixel-art backdrops for the Tetris view.
 *
 * The art is sourced from free/public-domain assets, bundled in
 * `public/tetris/` — no runtime network fetch and no third-party
 * hosting, so the app stays offline. Provenance and licenses are
 * recorded in `docs/assets.md`. The backdrop is decoration: it carries
 * no game state and is never written to GitHub.
 *
 * Kept in `src/shared` so the scenes and cycling can be validated
 * without a browser.
 */

export interface Backdrop {
  /** Stable identifier. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** URL of the bundled image, relative to the app root. */
  src: string;
}

/** The scenes, cycled in order each time the player clears four lines. */
export const BACKGROUNDS: ReadonlyArray<Backdrop> = [
  { id: 'night-sky', title: 'Night Sky', src: 'tetris/night-sky.jpg' },
  { id: 'city', title: 'City at Night', src: 'tetris/city-night.png' },
  { id: 'desert', title: 'Desert Dunes', src: 'tetris/desert.png' },
  { id: 'mars', title: 'Red Planet', src: 'tetris/mars.jpg' },
  { id: 'space', title: 'Deep Space', src: 'tetris/space.jpg' },
  { id: 'castle', title: 'Castle in the Dark', src: 'tetris/castle.gif' },
];

/** Index of the next scene, wrapping around the set. */
export function nextBackgroundIndex(index: number): number {
  return (index + 1) % BACKGROUNDS.length;
}
