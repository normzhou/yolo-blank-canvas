/**
 * Game-specific arcade/SNES & Tone.js-style (FMSynth, PolySynth, MembraneSynth)
 * soundtracks (#232, #234).
 *
 * Each screen has its own dedicated playlist of full-length (~2-minute) tracks
 * bundled in `public/tetris/` (AAC-LC `.m4a` at 44.1 kHz, encoded via macOS
 * `afconvert`), so playback is 100% local and offline:
 *
 * - **Selector Screen (`SELECTOR_PLAYLIST`, 2 tracks)**:
 *   1. *Arcade Neon Lobby* — chill FMSynth electric-piano, PolySynth 7th chords & MembraneSynth lounge groove
 *   2. *Pixel Lounge Overworld* — upbeat 16-bit game-select overworld theme
 * - **Tetris (`PLAYLIST` / `TETRIS_PLAYLIST`, 5 tracks)**:
 *   1. *Korobeiniki (Type A)* — traditional 19th-century Russian folk song (public domain)
 *   2. *Kalinka & Troika (Type B)* — traditional Russian folk medley (public domain)
 *   3. *Baroque Invention (Type C)* — J.S. Bach *French Suite No. 3 in B minor, BWV 814* (public domain)
 *   4. *Technotris FM Drive* — YM2612/Genesis-style FMSynth slap bass, PolySynth lead & MembraneSynth electro-polka
 *   5. *Cosmic Block Odyssey* — shimmering FMSynth bell arpeggios & PolySynth minor chords
 * - **Puzzle Bobble (`PUZZLE_BOBBLE_PLAYLIST`, 5 tracks)**:
 *   1. *Bubble Dragon March* — whimsical major-key marimba/bell arcade march
 *   2. *Rainbow Island Carnival* — sunny tropical calypso/flute-synth arcade tune
 *   3. *Starlight Carousel* — music-box & glockenspiel pastel synth bounce
 *   4. *Candy Cloud Playground* — whimsical FMSynth toy-piano, PolySynth staccato brass & MembraneSynth bongos
 *   5. *Bubblegum Soda Pop* — cheerful A-major Japanese arcade pop theme
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
 * The home selector screen playlist (~2 minutes per track):
 * Famous classical melodies arranged for celesta, harpsichord & flute (#266).
 */
export const SELECTOR_PLAYLIST: ReadonlyArray<Track> = [
  { id: 'selector-arcade-lobby', title: 'Für Elise & Turkish March', src: 'tetris/selector-arcade-lobby.m4a' },
  { id: 'selector-pixel-lounge', title: 'Sugar Plum Fairy & Swan Lake', src: 'tetris/selector-pixel-lounge.m4a' },
];

/**
 * The Tetris background playlist (~2 minutes per track):
 * Original Tetris Russian folk themes & famous classical/folk melodies (#266).
 */
export const TETRIS_PLAYLIST: ReadonlyArray<Track> = [
  { id: 'korobeiniki', title: 'Korobeiniki (Type A)', src: 'tetris/korobeiniki.m4a' },
  { id: 'kalinka-troika', title: 'Kalinka & Troika (Type B)', src: 'tetris/kalinka-troika.m4a' },
  { id: 'baroque-invention', title: 'Baroque Invention (Bach Minuet in G)', src: 'tetris/baroque-invention.m4a' },
  { id: 'technotris-fm', title: 'Mountain King & Ode to Joy', src: 'tetris/technotris-fm.m4a' },
  { id: 'cosmic-odyssey', title: 'Greensleeves & Scarborough Fair', src: 'tetris/cosmic-odyssey.m4a' },
];

/** Default alias retained for existing callers and tests. */
export const PLAYLIST: ReadonlyArray<Track> = TETRIS_PLAYLIST;

/**
 * The Puzzle Bobble whimsical, light-hearted arcade playlist (~2 minutes per track):
 * Upbeat, recognized video-game and classic arcade galop/ragtime melodies (#266, #278).
 */
export const PUZZLE_BOBBLE_PLAYLIST: ReadonlyArray<Track> = [
  { id: 'pb-bubble-march', title: 'Bubble Bobble & Puzzle Bobble', src: 'tetris/pb-bubble-march.m4a' },
  { id: 'pb-rainbow-carnival', title: 'Overworld Rag & The Entertainer', src: 'tetris/pb-rainbow-carnival.m4a' },
  { id: 'pb-starlight-carousel', title: 'Athletic Rag & Can-Can Galop', src: 'tetris/pb-starlight-carousel.m4a' },
  { id: 'pb-candy-playground', title: 'Green Greens & William Tell Galop', src: 'tetris/pb-candy-playground.m4a' },
  { id: 'pb-soda-pop', title: 'Csikós Post & Gladiators Galop', src: 'tetris/pb-soda-pop.m4a' },
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
