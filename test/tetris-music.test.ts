import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PLAYLIST,
  PUZZLE_BOBBLE_PLAYLIST,
  TETRIS_PLAYLIST,
  shuffledTracks,
  type Track,
} from '../src/shared/tetrisMusic';
import { TetrisMusic } from '../src/client/audio/tetrisMusic';

describe('tetris and puzzle bobble playlists (#232)', () => {
  it('offers distinct, game-specific playlists for Tetris and Puzzle Bobble', () => {
    expect(TETRIS_PLAYLIST.length).toBeGreaterThanOrEqual(3);
    expect(PUZZLE_BOBBLE_PLAYLIST.length).toBeGreaterThanOrEqual(3);
    expect(PLAYLIST).toBe(TETRIS_PLAYLIST);

    const ids = new Set<string>();
    for (const track of [...TETRIS_PLAYLIST, ...PUZZLE_BOBBLE_PLAYLIST]) {
      expect(track.id.length).toBeGreaterThan(0);
      expect(track.title.length).toBeGreaterThan(0);
      expect(track.src).toMatch(/^tetris\/.+\.(m4a|mp3|ogg|wav)$/);
      expect(ids.has(track.id)).toBe(false);
      ids.add(track.id);
    }
  });

  it('points at bundled full-length (~2-minute) audio files that exist under public/', () => {
    for (const track of [...TETRIS_PLAYLIST, ...PUZZLE_BOBBLE_PLAYLIST]) {
      const file = path.resolve(__dirname, '../public', track.src);
      expect(fs.existsSync(file), `${track.src} should exist under public/`).toBe(true);
      // Full-length (~115s @ 64kbps AAC) tracks are > 750KB each.
      expect(fs.statSync(file).size).toBeGreaterThan(750_000);
    }
  });

  it('shuffles each playlist into a permutation without cross-contaminating games', () => {
    const tetrisShuffled = shuffledTracks(() => 0.42, TETRIS_PLAYLIST);
    expect([...tetrisShuffled].map((track) => track.id).sort()).toEqual(
      [...TETRIS_PLAYLIST].map((track) => track.id).sort(),
    );
    const pbShuffled = shuffledTracks(() => 0.42, PUZZLE_BOBBLE_PLAYLIST);
    expect([...pbShuffled].map((track) => track.id).sort()).toEqual(
      [...PUZZLE_BOBBLE_PLAYLIST].map((track) => track.id).sort(),
    );
  });

  it('is deterministic for a given random source', () => {
    expect(shuffledTracks(() => 0.5).map((track) => track.id)).toEqual(
      shuffledTracks(() => 0.5).map((track) => track.id),
    );
  });

  it('unlocks Web Audio synchronously in ensureContext and plays decoded .m4a buffers on iOS WebKit (#217, #232)', async () => {
    const startedNodes: Array<{ offset?: number }> = [];
    const resume = vi.fn(async () => undefined);
    const decodeAudioData = vi.fn(async () => ({ duration: 116 } as unknown as AudioBuffer));

    class FakeAudioContext {
      state = 'suspended';
      currentTime = 0;
      destination = {};
      resume = resume;
      createAnalyser = vi.fn(() => ({
        fftSize: 1024,
        frequencyBinCount: 512,
        connect: vi.fn(),
        disconnect: vi.fn(),
        getFloatTimeDomainData: (arr: Float32Array) => arr.fill(0.22),
        getByteFrequencyData: (arr: Uint8Array) => arr.fill(64),
      }));
      createBuffer = vi.fn(() => ({ duration: 0.001 } as unknown as AudioBuffer));
      createBufferSource = vi.fn(() => ({
        buffer: null as AudioBuffer | null,
        onended: null as (() => void) | null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn((_when?: number, offset?: number) => {
          startedNodes.push({ offset });
        }),
        stop: vi.fn(),
      }));
      decodeAudioData = decodeAudioData;
      close = vi.fn(async () => undefined);
    }

    const audioSession = { type: 'ambient' };
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });
    vi.stubGlobal('navigator', { audioSession });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(16),
      })),
    );

    try {
      const seen: Track[] = [];
      const player = new TetrisMusic((track) => seen.push(track), PUZZLE_BOBBLE_PLAYLIST);
      expect(player.ensureContext()).toBe(true);
      expect(audioSession.type).toBe('playback');
      expect(resume).toHaveBeenCalledTimes(1);
      // 1-sample silent unlock buffer started synchronously inside ensureContext().
      expect(startedNodes.length).toBeGreaterThanOrEqual(1);
      expect(seen).toHaveLength(1);
      expect(PUZZLE_BOBBLE_PLAYLIST.some((t) => t.id === seen[0].id)).toBe(true);

      player.setActive(true);
      await new Promise((r) => setTimeout(r, 10));
      expect(decodeAudioData).toHaveBeenCalledTimes(1);
      // Second node is the decoded chiptune track buffer.
      expect(startedNodes.length).toBe(2);

      const metrics = player.sampleOutputMetrics();
      expect(metrics.durationSec).toBe(116);
      expect(metrics.rms).toBeGreaterThan(0.1);
      expect(metrics.activeBins).toBeGreaterThan(100);
      player.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
