import { describe, expect, it } from 'vitest';
import {
  KOROBEINIKI,
  KOROBEINIKI_A,
  KOROBEINIKI_B,
  PLAYLIST,
  melodyDuration,
  noteFrequency,
  planNotes,
  shuffledMelodies,
} from '../src/shared/tetrisMusic';

describe('tetris music', () => {
  it('maps equal-tempered pitches to frequencies', () => {
    expect(noteFrequency('A4')).toBeCloseTo(440, 5);
    expect(noteFrequency('A5')).toBeCloseTo(880, 5);
    expect(noteFrequency('C4')).toBeCloseTo(261.63, 1);
    expect(noteFrequency('E5')).toBeCloseTo(659.26, 1);
  });

  it('returns 0 for an unknown pitch', () => {
    expect(noteFrequency('H9')).toBe(0);
    expect(noteFrequency('')).toBe(0);
  });

  it('uses only positive note lengths and resolvable pitches', () => {
    expect(KOROBEINIKI.length).toBeGreaterThan(0);
    for (const [pitch, beats] of KOROBEINIKI) {
      expect(beats).toBeGreaterThan(0);
      if (pitch !== null) expect(noteFrequency(pitch)).toBeGreaterThan(0);
    }
  });

  it('lays notes out sequentially from the start time', () => {
    const events = planNotes(
      [
        ['E5', 1],
        [null, 1],
        ['B4', 2],
      ],
      2,
      10,
    );
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ frequency: noteFrequency('E5'), start: 10, duration: 0.5 });
    expect(events[1]).toMatchObject({ frequency: 0, start: 10.5, duration: 0.5 });
    expect(events[2]).toMatchObject({ frequency: noteFrequency('B4'), start: 11, duration: 1 });
  });

  it('reports the melody length consistently with the planned events', () => {
    const events = planNotes(KOROBEINIKI, 2);
    const end = events[events.length - 1].start + events[events.length - 1].duration;
    expect(melodyDuration(KOROBEINIKI, 2)).toBeCloseTo(end, 5);
  });

  it('opens the tune on the Korobeiniki pickup', () => {
    expect(KOROBEINIKI[0]).toEqual(['E5', 1]);
    expect(KOROBEINIKI_A[0]).toEqual(['E5', 1]);
  });

  it('extends Korobeiniki with a non-empty second strain', () => {
    expect(KOROBEINIKI_B.length).toBeGreaterThan(0);
    expect(KOROBEINIKI).toHaveLength(KOROBEINIKI_A.length + KOROBEINIKI_B.length);
    expect(melodyDuration(KOROBEINIKI, 2)).toBeGreaterThan(melodyDuration(KOROBEINIKI_A, 2));
  });
});

describe('tetris playlist', () => {
  it('offers several distinct, well-formed melodies', () => {
    expect(PLAYLIST.length).toBeGreaterThanOrEqual(3);
    const ids = new Set<string>();
    for (const melody of PLAYLIST) {
      expect(melody.id.length).toBeGreaterThan(0);
      expect(melody.title.length).toBeGreaterThan(0);
      expect(melody.notes.length).toBeGreaterThan(0);
      expect(ids.has(melody.id)).toBe(false);
      ids.add(melody.id);
      for (const [pitch, beats] of melody.notes) {
        expect(beats).toBeGreaterThan(0);
        if (pitch !== null) expect(noteFrequency(pitch)).toBeGreaterThan(0);
      }
    }
  });

  it('shuffles into a permutation of the playlist', () => {
    const shuffled = shuffledMelodies(() => 0.42);
    expect([...shuffled].map((melody) => melody.id).sort()).toEqual(
      [...PLAYLIST].map((melody) => melody.id).sort(),
    );
    expect(shuffled).toHaveLength(PLAYLIST.length);
  });

  it('is deterministic for a given random source', () => {
    expect(shuffledMelodies(() => 0.5).map((melody) => melody.id)).toEqual(
      shuffledMelodies(() => 0.5).map((melody) => melody.id),
    );
  });
});
