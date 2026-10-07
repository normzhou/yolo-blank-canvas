/**
 * The Tetris background tracks.
 *
 * Sourced, free music — not composed here. The five tracks are by
 * SketchyLogic from the "NES Shooter Music" pack on OpenGameArt, released
 * CC0 (public domain): https://opengameart.org/content/nes-shooter-music-5-tracks-3-jingles.
 * They are bundled in `public/tetris/` (AAC-LC in .m4a, converted with
 * macOS `afconvert`), so playback is fully local and offline. Attribution
 * was not required; see `docs/assets.md` for provenance.
 *
 * Kept in `src/shared` so the playlist and shuffle can be tested without a
 * browser audio element.
 */

/** A named, bundled audio track. */
export interface Track {
  /** Stable identifier, used to avoid repeating a track back to back. */
  id: string;
  /** Human-readable title, shown as "now playing". */
  title: string;
  /** URL of the bundled audio file, relative to the app root. */
  src: string;
}

/**
 * The background playlist. Tracks are chosen in shuffled order, so playback
 * varies between sessions without ever repeating one back to back.
 */
export const PLAYLIST: ReadonlyArray<Track> = [
  { id: 'map', title: 'Map', src: 'tetris/map.m4a' },
  { id: 'mars', title: 'Mars', src: 'tetris/mars.m4a' },
  { id: 'mercury', title: 'Mercury', src: 'tetris/mercury.m4a' },
  { id: 'venus', title: 'Venus', src: 'tetris/venus.m4a' },
  { id: 'boss', title: 'Boss', src: 'tetris/boss.m4a' },
];

/**
 * A shuffled copy of the playlist. Deterministic for a given `rng`, so tests
 * can assert it is a permutation without depending on `Math.random`.
 */
export function shuffledTracks(rng: () => number = Math.random): Track[] {
  const list = [...PLAYLIST];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
