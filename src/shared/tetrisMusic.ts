/**
 * The Tetris background tune.
 *
 * This is the traditional *Korobeiniki* melody — a public-domain Russian folk
 * song — not the copyrighted Game Boy arrangement. Kept in `src/shared` so the
 * melody and pitch mapping can be tested without a browser audio context.
 */

export type Note = [pitch: string | null, beats: number];

const SEMITONES: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

const NOTE_RE = /^([A-G]#?)(-?\d)$/;

/** Equal-tempered frequency in Hz for a note like `E5`; 0 for an unknown pitch. */
export function noteFrequency(pitch: string): number {
  const match = NOTE_RE.exec(pitch);
  if (!match) return 0;
  const [, name, octaveText] = match;
  const midi = (Number(octaveText) + 1) * 12 + SEMITONES[name];
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Korobeiniki, main A section. `[pitch, beats]`, `null` is a rest.
 * One pass is four bars of 4/4.
 */
export const KOROBEINIKI: ReadonlyArray<Note> = [
  ['E5', 1], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['C5', 0.5], ['B4', 0.5],
  ['A4', 1], ['A4', 0.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5],
  ['B4', 1.5], ['C5', 0.5], ['D5', 1], ['E5', 1],
  ['C5', 1], ['A4', 1], ['A4', 1], [null, 1],
  ['D5', 1.5], ['F5', 0.5], ['A5', 1], ['G5', 0.5], ['F5', 0.5],
  ['E5', 1.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5],
  ['B4', 1], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['E5', 1],
  ['C5', 1], ['A4', 1], ['A4', 1], [null, 1],
];

export interface NoteEvent {
  /** Frequency in Hz, or 0 for a rest. */
  frequency: number;
  /** Seconds from the start of the melody. */
  start: number;
  /** Seconds the note sounds. */
  duration: number;
}

/** Total length of one melody pass in seconds at the given tempo (beats/second). */
export function melodyDuration(melody: ReadonlyArray<Note>, beatsPerSecond: number): number {
  return melody.reduce((total, [, beats]) => total + beats / beatsPerSecond, 0);
}

/**
 * Lay the melody out on a timeline starting at `startAt`. Pure, so the
 * scheduling can be tested; the audio wrapper only turns events into nodes.
 */
export function planNotes(
  melody: ReadonlyArray<Note>,
  beatsPerSecond: number,
  startAt = 0,
): NoteEvent[] {
  const events: NoteEvent[] = [];
  let at = startAt;
  for (const [pitch, beats] of melody) {
    const duration = beats / beatsPerSecond;
    events.push({ frequency: pitch ? noteFrequency(pitch) : 0, start: at, duration });
    at += duration;
  }
  return events;
}
