import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PLAYLIST,
  PUZZLE_BOBBLE_PLAYLIST,
  SELECTOR_PLAYLIST,
  TETRIS_PLAYLIST,
  shuffledTracks,
  type Track,
} from '../src/shared/tetrisMusic';
import { MUSIC_GAIN, TetrisMusic } from '../src/client/audio/tetrisMusic';

describe('selector, tetris, and puzzle bobble playlists + Tone synth SFX (#232, #234, #252, #258)', () => {
  it('reduces background music gain to 0.22 so sound effects stand out clearly (#252, #258)', () => {
    expect(MUSIC_GAIN).toBe(0.22);
  });

  it('offers distinct, game-specific playlists for Selector Screen, Tetris, and Puzzle Bobble', () => {
    expect(SELECTOR_PLAYLIST.length).toBeGreaterThanOrEqual(2);
    expect(TETRIS_PLAYLIST.length).toBeGreaterThanOrEqual(5);
    expect(PUZZLE_BOBBLE_PLAYLIST.length).toBeGreaterThanOrEqual(5);
    expect(PLAYLIST).toBe(TETRIS_PLAYLIST);

    const ids = new Set<string>();
    for (const track of [...SELECTOR_PLAYLIST, ...TETRIS_PLAYLIST, ...PUZZLE_BOBBLE_PLAYLIST]) {
      expect(track.id.length).toBeGreaterThan(0);
      expect(track.title.length).toBeGreaterThan(0);
      expect(track.src).toMatch(/^tetris\/.+\.(m4a|mp3|ogg|wav)$/);
      expect(ids.has(track.id)).toBe(false);
      ids.add(track.id);
    }
  });

  it('points at 12 bundled full-length (~2-minute) audio files that exist under public/', () => {
    const allTracks = [...SELECTOR_PLAYLIST, ...TETRIS_PLAYLIST, ...PUZZLE_BOBBLE_PLAYLIST];
    expect(allTracks).toHaveLength(12);
    for (const track of allTracks) {
      const file = path.resolve(__dirname, '../public', track.src);
      expect(fs.existsSync(file), `${track.src} should exist under public/`).toBe(true);
      // Full-length (~115s @ 64kbps AAC) tracks are > 750KB each.
      expect(fs.statSync(file).size).toBeGreaterThan(750_000);
    }
  });

  it('shuffles each playlist into a permutation without cross-contaminating screens', () => {
    const selectorShuffled = shuffledTracks(() => 0.42, SELECTOR_PLAYLIST);
    expect([...selectorShuffled].map((track) => track.id).sort()).toEqual(
      [...SELECTOR_PLAYLIST].map((track) => track.id).sort(),
    );
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

  it('unlocks Web Audio synchronously, crossfades between playlists, and triggers Tone.js-style FMSynth/PolySynth/MembraneSynth SFX (#217, #232, #234)', async () => {
    const startedNodes: Array<{ offset?: number }> = [];
    const createdOscillators: Array<{ type: string }> = [];
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
      createGain = vi.fn(() => ({
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }));
      createOscillator = vi.fn(() => {
        const osc = {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        createdOscillators.push(osc);
        return osc;
      });
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
    const winObj: Record<string, unknown> = { AudioContext: FakeAudioContext };
    vi.stubGlobal('window', winObj);
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
      const player = new TetrisMusic((track) => seen.push(track), SELECTOR_PLAYLIST);
      expect(player.ensureContext()).toBe(true);
      expect(audioSession.type).toBe('playback');
      expect(resume).toHaveBeenCalledTimes(1);
      expect(startedNodes.length).toBeGreaterThanOrEqual(1);
      expect(SELECTOR_PLAYLIST.some((t) => t.id === seen[0].id)).toBe(true);

      player.setActive(true);
      await new Promise((r) => setTimeout(r, 15));
      expect(startedNodes.length).toBe(2);

      // Switching playlist from Selector Screen to Puzzle Bobble crossfades smoothly.
      player.setPlaylist(PUZZLE_BOBBLE_PLAYLIST);
      await new Promise((r) => setTimeout(r, 15));
      expect(PUZZLE_BOBBLE_PLAYLIST.some((t) => t.id === seen[seen.length - 1].id)).toBe(true);

      // Trigger real-time Tone.js-style SFX (FMSynth, PolySynth, MembraneSynth).
      player.sfx.playCountdown(3);
      player.sfx.playCountdown(0);
      player.sfx.playBubbleShoot();
      player.sfx.playBubblePop(4, 2);
      player.sfx.playGarbageRise(3);
      player.sfx.playRotate();
      player.sfx.playHardDrop();
      player.sfx.playLineClear(4);

      const metrics = player.sampleOutputMetrics();
      expect(metrics.durationSec).toBe(116);
      expect(metrics.rms).toBeGreaterThan(0.1);
      expect(metrics.crossfadeCount).toBeGreaterThanOrEqual(1);
      expect(metrics.sfxLog).toEqual([
        'countdown-tick',
        'countdown-go',
        'bubble-shoot',
        'bubble-pop',
        'bubble-avalanche',
        'garbage-rise',
        'tetris-rotate',
        'tetris-drop',
        'tetris-four-line',
      ]);
      expect(createdOscillators.length).toBeGreaterThan(10);
      player.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
