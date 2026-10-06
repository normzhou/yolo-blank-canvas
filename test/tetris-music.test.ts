import { describe, expect, it } from 'vitest';
import { KOROBEINIKI, melodyDuration, noteFrequency, planNotes } from '../src/shared/tetrisMusic';

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
  });
});
