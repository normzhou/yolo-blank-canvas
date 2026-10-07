/**
 * The Tetris background tunes.
 *
 * A small playlist of public-domain folk and classical melodies — traditional
 * *Korobeiniki* (the Russian folk song, not the copyrighted Game Boy
 * arrangement), traditional *Greensleeves*, Beethoven's *Ode to Joy* and
 * Grieg's *In the Hall of the Mountain King* — arranged simply for the
 * square-wave synth. Kept in `src/shared` so the melodies, pitch mapping and
 * shuffle can be tested without a browser audio context.
 */

export type Note = [pitch: string | null, beats: number];

/** A named tune, a sequence of notes and rests. */
export interface Melody {
  /** Stable identifier, used to avoid repeating a tune back to back. */
  id: string;
  /** Human-readable title shown nowhere but useful in reports/tests. */
  title: string;
  notes: ReadonlyArray<Note>;
}

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
 * Korobeiniki, main strain (the familiar Tetris theme). `[pitch, beats]`,
 * `null` is a rest. One pass is four bars of 4/4.
 */
export const KOROBEINIKI_A: ReadonlyArray<Note> = [
  ['E5', 1], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['C5', 0.5], ['B4', 0.5],
  ['A4', 1], ['A4', 0.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5],
  ['B4', 1.5], ['C5', 0.5], ['D5', 1], ['E5', 1],
  ['C5', 1], ['A4', 1], ['A4', 1], [null, 1],
  ['D5', 1.5], ['F5', 0.5], ['A5', 1], ['G5', 0.5], ['F5', 0.5],
  ['E5', 1.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5],
  ['B4', 1], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['E5', 1],
  ['C5', 1], ['A4', 1], ['A4', 1], [null, 1],
];

/**
 * Korobeiniki, second strain — the part of the folk song after the familiar
 * opening. A simple arranged continuation in the same key and feel, not the
 * copyrighted game arrangement.
 */
export const KOROBEINIKI_B: ReadonlyArray<Note> = [
  ['A4', 1], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['E5', 1],
  ['E5', 1], ['D5', 0.5], ['C5', 0.5], ['B4', 1], ['A4', 1],
  ['A4', 1], ['C5', 1], ['E5', 1], ['A5', 1],
  ['G5', 1.5], ['F5', 0.5], ['E5', 1], ['D5', 1],
  ['D5', 1], ['F5', 0.5], ['A5', 0.5], ['G5', 1], ['F5', 1],
  ['E5', 1.5], ['D5', 0.5], ['C5', 1], ['B4', 1],
  ['B4', 1], ['C5', 0.5], ['D5', 0.5], ['E5', 1], ['C5', 1],
  ['A4', 1], ['A4', 1], [null, 1],
];

/**
 * The full Korobeiniki tune: the familiar strain followed by its second part.
 * Kept as a single export so existing callers and the melody-length test still
 * see one complete tune.
 */
export const KOROBEINIKI: ReadonlyArray<Note> = [...KOROBEINIKI_A, ...KOROBEINIKI_B];

/** Traditional Greensleeves, the opening phrase. */
const GREENSLEEVES: ReadonlyArray<Note> = [
  ['A4', 1], ['C5', 2], ['D5', 1], ['E5', 1.5], ['F5', 0.5], ['E5', 1],
  ['D5', 2], ['B4', 1], ['G4', 1.5], ['A4', 0.5], ['B4', 1],
  ['C5', 2], ['A4', 1], ['A4', 1.5], ['G#4', 0.5], ['A4', 1],
  ['B4', 2], ['G#4', 1], ['E4', 3],
];

/** Beethoven, *Ode to Joy* (Symphony No. 9 theme). */
const ODE_TO_JOY: ReadonlyArray<Note> = [
  ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1],
  ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
  ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1],
  ['E4', 1.5], ['D4', 0.5], ['D4', 2],
  ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1],
  ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
  ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1],
  ['D4', 1.5], ['C4', 0.5], ['C4', 2],
];

/** Grieg, *In the Hall of the Mountain King* — opening theme. */
const MOUNTAIN_KING: ReadonlyArray<Note> = [
  ['B4', 1], ['C#5', 1], ['D5', 1], ['E5', 1], ['F#5', 1], ['D5', 1], ['F#5', 0.5], ['F#5', 0.5],
  ['E5', 1], ['D5', 1], ['C#5', 1], ['B4', 1], ['C#5', 1], ['D5', 1], ['E5', 0.5], ['E5', 0.5],
  ['C#5', 1], ['D5', 0.5], ['D5', 0.5], ['C#5', 1], ['B4', 1], ['B4', 2],
];

/**
 * The background playlist. Tunes are chosen in shuffled order, so playback
 * varies between sessions without ever repeating one back to back.
 */
export const PLAYLIST: ReadonlyArray<Melody> = [
  { id: 'korobeiniki', title: 'Korobeiniki', notes: KOROBEINIKI },
  { id: 'greensleeves', title: 'Greensleeves', notes: GREENSLEEVES },
  { id: 'ode-to-joy', title: 'Ode to Joy', notes: ODE_TO_JOY },
  { id: 'mountain-king', title: 'In the Hall of the Mountain King', notes: MOUNTAIN_KING },
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

/**
 * A shuffled copy of the playlist. Deterministic for a given `rng`, so tests
 * can assert it is a permutation without depending on `Math.random`.
 */
export function shuffledMelodies(rng: () => number = Math.random): Melody[] {
  const list = [...PLAYLIST];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
