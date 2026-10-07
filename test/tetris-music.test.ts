import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PLAYLIST, shuffledTracks } from '../src/shared/tetrisMusic';

describe('tetris playlist', () => {
  it('offers several distinct, well-formed tracks', () => {
    expect(PLAYLIST.length).toBeGreaterThanOrEqual(3);
    const ids = new Set<string>();
    for (const track of PLAYLIST) {
      expect(track.id.length).toBeGreaterThan(0);
      expect(track.title.length).toBeGreaterThan(0);
      expect(track.src).toMatch(/^tetris\/.+\.(m4a|mp3|ogg|wav)$/);
      expect(ids.has(track.id)).toBe(false);
      ids.add(track.id);
    }
  });

  it('points at bundled audio files that actually exist', () => {
    for (const track of PLAYLIST) {
      const file = path.resolve(__dirname, '../public', track.src);
      expect(fs.existsSync(file), `${track.src} should exist under public/`).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(1000);
    }
  });

  it('shuffles into a permutation of the playlist', () => {
    const shuffled = shuffledTracks(() => 0.42);
    expect([...shuffled].map((track) => track.id).sort()).toEqual(
      [...PLAYLIST].map((track) => track.id).sort(),
    );
    expect(shuffled).toHaveLength(PLAYLIST.length);
  });

  it('is deterministic for a given random source', () => {
    expect(shuffledTracks(() => 0.5).map((track) => track.id)).toEqual(
      shuffledTracks(() => 0.5).map((track) => track.id),
    );
  });
});
