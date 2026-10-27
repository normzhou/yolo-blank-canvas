/**
 * Game-specific arcade/SNES chiptune soundtracks (#232).
 *
 * Each game has its own dedicated playlist of full-length (~2-minute) tracks
 * bundled in `public/tetris/` (AAC-LC `.m4a` at 44.1 kHz, encoded via macOS
 * `afconvert`), so playback is 100% local and offline:
 *
 * - **Tetris (`PLAYLIST` / `TETRIS_PLAYLIST`)**:
 *   1. *Korobeiniki (Type A)* — traditional 19th-century Russian folk song (public domain)
 *   2. *Kalinka & Troika (Type B)* — traditional Russian folk medley (public domain)
 *   3. *Baroque Invention (Type C)* — J.S. Bach *French Suite No. 3 in B minor, BWV 814* (public domain)
 * - **Puzzle Bobble (`PUZZLE_BOBBLE_PLAYLIST`)**:
 *   1. *Bubble Dragon March* — original whimsical major-key marimba/bell arcade march (CC0)
 *   2. *Rainbow Island Carnival* — original sunny tropical calypso/flute-synth arcade tune (CC0)
 *   3. *Starlight Carousel* — original music-box & glockenspiel pastel synth bounce (CC0)
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
 * The Tetris background playlist (~2 minutes per track).
 */
export const TETRIS_PLAYLIST: ReadonlyArray<Track> = [
  { id: 'korobeiniki', title: 'Korobeiniki (Type A)', src: 'tetris/korobeiniki.m4a' },
  { id: 'kalinka-troika', title: 'Kalinka & Troika (Type B)', src: 'tetris/kalinka-troika.m4a' },
  { id: 'baroque-invention', title: 'Baroque Invention (Type C)', src: 'tetris/baroque-invention.m4a' },
];

/** Default alias retained for existing callers and tests. */
export const PLAYLIST: ReadonlyArray<Track> = TETRIS_PLAYLIST;

/**
 * The Puzzle Bobble whimsical, light-hearted arcade playlist (~2 minutes per track).
 */
export const PUZZLE_BOBBLE_PLAYLIST: ReadonlyArray<Track> = [
  { id: 'pb-bubble-march', title: 'Bubble Dragon March', src: 'tetris/pb-bubble-march.m4a' },
  { id: 'pb-rainbow-carnival', title: 'Rainbow Island Carnival', src: 'tetris/pb-rainbow-carnival.m4a' },
  { id: 'pb-starlight-carousel', title: 'Starlight Carousel', src: 'tetris/pb-starlight-carousel.m4a' },
];

/**
 * A shuffled copy of the given playlist (defaults to `PLAYLIST`).
 * Deterministic for a given `rng`, so tests can assert it is a permutation
 * without depending on `Math.random`.
 */
export function shuffledTracks(
  rng: () => number = Math.random,
  tracks: ReadonlyArray<Track> = PLAYLIST,
): Track[] {
  const list = [...tracks];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
