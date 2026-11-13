/**
 * Game-specific chiptune & synth soundtracks (#232, #234, #352).
 *
 * Bundled locally in `public/audio/` (AAC-LC `.m4a` at 44.1 kHz) so playback
 * is 100% local and offline. Note: musical composition replacement is scheduled
 * for Phase 4 of #351 per maintainer direction.
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

/** Home selector screen playlist (~2 minutes per track). */
export const SELECTOR_PLAYLIST: ReadonlyArray<Track> = [
  { id: 'selector-lobby', title: 'Für Elise & Turkish March', src: 'audio/selector-lobby.m4a' },
  { id: 'selector-lounge', title: 'Sugar Plum Fairy & Swan Lake', src: 'audio/selector-lounge.m4a' },
];

/** Prism Stack background playlist (~2 minutes per track). */
export const PRISM_STACK_PLAYLIST: ReadonlyArray<Track> = [
  { id: 'prism-track-1', title: 'Folk Polka Medley I', src: 'audio/prism-track-1.m4a' },
  { id: 'prism-track-2', title: 'Kalinka & Troika Medley', src: 'audio/prism-track-2.m4a' },
  { id: 'prism-track-3', title: 'Baroque Invention (Bach Minuet in G)', src: 'audio/prism-track-3.m4a' },
  { id: 'prism-track-4', title: 'Mountain King & Ode to Joy', src: 'audio/prism-track-4.m4a' },
  { id: 'prism-track-5', title: 'Greensleeves & Scarborough Fair', src: 'audio/prism-track-5.m4a' },
];

/** Default alias retained for audio player initialization and tests. */
export const PLAYLIST: ReadonlyArray<Track> = PRISM_STACK_PLAYLIST;

/** Starlight Burst background playlist (~2 minutes per track). */
export const STARLIGHT_BURST_PLAYLIST: ReadonlyArray<Track> = [
  { id: 'starlight-track-1', title: 'Starlight Chime March', src: 'audio/starlight-track-1.m4a' },
  { id: 'starlight-track-2', title: 'Overworld Rag & The Entertainer', src: 'audio/starlight-track-2.m4a' },
  { id: 'starlight-track-3', title: 'Athletic Rag & Can-Can Galop', src: 'audio/starlight-track-3.m4a' },
  { id: 'starlight-track-4', title: 'Spring Meadow & William Tell Galop', src: 'audio/starlight-track-4.m4a' },
  { id: 'starlight-track-5', title: 'Csikós Post & Gladiators Galop', src: 'audio/starlight-track-5.m4a' },
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
