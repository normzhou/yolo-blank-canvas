/**
 * Pixel-art stage backdrops for Prism Stack and Starlight Burst.
 *
 * The art is sourced from free/public-domain assets, bundled in
 * `public/backdrops/` — no runtime network fetch and no third-party
 * hosting, so the app stays offline. Provenance and licenses are
 * recorded in `docs/assets.md`. The backdrop is decoration: it carries
 * no game state and is never written to GitHub.
 */

export interface Backdrop {
  /** Stable identifier. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** URL of the bundled image, relative to the app root. */
  src: string;
}

/** The scenes, cycled in order on multi-line clears or stage advances. */
export const BACKGROUNDS: ReadonlyArray<Backdrop> = [
  { id: 'night-sky', title: 'Night Sky', src: 'backdrops/night-sky.jpg' },
  { id: 'city', title: 'City at Night', src: 'backdrops/city-night.png' },
  { id: 'desert', title: 'Desert Dunes', src: 'backdrops/desert.png' },
  { id: 'mars', title: 'Red Planet', src: 'backdrops/mars.jpg' },
  { id: 'space', title: 'Deep Space', src: 'backdrops/space.jpg' },
  { id: 'castle', title: 'Castle in the Dark', src: 'backdrops/castle.gif' },
];

/** Index of the next scene, wrapping around the set. */
export function nextBackgroundIndex(index: number): number {
  return (index + 1) % BACKGROUNDS.length;
}
