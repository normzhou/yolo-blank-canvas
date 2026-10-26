import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PLAYLIST, shuffledTracks, type Track } from '../src/shared/tetrisMusic';
import { TetrisMusic } from '../src/client/audio/tetrisMusic';

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

  it('unlocks Web Audio synchronously in ensureContext and plays decoded .m4a buffers on iOS WebKit (#217)', async () => {
    const startedNodes: Array<{ offset?: number }> = [];
    const resume = vi.fn(async () => undefined);
    const decodeAudioData = vi.fn(async () => ({ duration: 32 } as unknown as AudioBuffer));

    class FakeAudioContext {
      state = 'suspended';
      currentTime = 0;
      destination = {};
      resume = resume;
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
      const player = new TetrisMusic((track) => seen.push(track));
      expect(player.ensureContext()).toBe(true);
      expect(audioSession.type).toBe('playback');
      expect(resume).toHaveBeenCalledTimes(1);
      // 1-sample silent unlock buffer started synchronously inside ensureContext().
      expect(startedNodes.length).toBeGreaterThanOrEqual(1);
      expect(seen).toHaveLength(1);

      player.setActive(true);
      await new Promise((r) => setTimeout(r, 10));
      expect(decodeAudioData).toHaveBeenCalledTimes(1);
      // Second node is the decoded chiptune track buffer.
      expect(startedNodes.length).toBe(2);
      player.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
