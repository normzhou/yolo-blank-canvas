import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  COUNTDOWN_LANGUAGES,
  COUNTDOWN_VOICE_SPRITE_SRC,
  TOTAL_COUNTDOWN_SPEAKERS_MILLIONS,
  pickCountdownLanguage,
} from '../src/shared/countdownLanguages';
import {
  PLAYLIST,
  PUZZLE_BOBBLE_PLAYLIST,
  SELECTOR_PLAYLIST,
  TETRIS_PLAYLIST,
  shuffledTracks,
  type Track,
} from '../src/shared/tetrisMusic';
import {
  AUDIO_DISK_CACHE_NAME,
   getSharedArcadeAudio,
  getSharedMusicOn,
  getSharedSfxOn,
  MUSIC_GAIN,
  setSharedMusicOn,
  setSharedSfxOn,
  TetrisMusic,
} from '../src/client/audio/tetrisMusic';

describe('selector, tetris, and puzzle bobble playlists + Tone synth SFX (#232, #234, #252, #258, #262)', () => {
  it('reduces background music gain to 0.22 so sound effects stand out clearly (#252, #258)', () => {
    expect(MUSIC_GAIN).toBe(0.22);
  });

  it('samples Ready/Go countdown phrases across the 10 most spoken languages weighted by speaker count (#262)', () => {
    expect(COUNTDOWN_LANGUAGES).toHaveLength(10);
    expect(TOTAL_COUNTDOWN_SPEAKERS_MILLIONS).toBe(5433);
    expect(COUNTDOWN_LANGUAGES[0]).toMatchObject({
      id: 'en',
      readyText: 'READY…',
      goText: 'GO!',
    });
    expect(COUNTDOWN_LANGUAGES[1]).toMatchObject({
      id: 'zh',
      readyText: '预备…',
      goText: '齐！',
    });

    // Verify exact speaker-ratio quantile boundaries
    expect(pickCountdownLanguage(() => 0.0).id).toBe('en');
    expect(pickCountdownLanguage(() => 1514 / 5433).id).toBe('en');
    expect(pickCountdownLanguage(() => 1516 / 5433).id).toBe('zh');
    expect(pickCountdownLanguage(() => (1515 + 1140 + 1) / 5433).id).toBe('hi');
    expect(pickCountdownLanguage(() => 0.999).id).toBe('ur');

    // Verify interactive quota sampling never repeats back-to-back and includes Mandarin Chinese (#276)
    const picks = Array.from({ length: 25 }, () => pickCountdownLanguage());
    for (let i = 1; i < picks.length; i += 1) {
      expect(picks[i].id).not.toBe(picks[i - 1].id);
    }
    expect(picks.some((p) => p.id === 'zh')).toBe(true);
    expect(picks.some((p) => p.id === 'en')).toBe(true);
    expect(picks.some((p) => p.id === 'hi')).toBe(true);
    expect(picks.some((p) => p.id === 'es')).toBe(true);

    // Verify bundled 10-language spoken voice sprite exists under public/
    const voiceFile = path.resolve(__dirname, '../public', COUNTDOWN_VOICE_SPRITE_SRC);
    expect(fs.existsSync(voiceFile)).toBe(true);
    expect(fs.statSync(voiceFile).size).toBeGreaterThan(50_000);
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

      // Before setActive(true), sound is off so SFX must not start any Web Audio synth nodes (#270).
      const nodesBeforeMutedSfx = startedNodes.length;
      player.sfx.playBubbleShoot();
      expect(startedNodes.length).toBe(nodesBeforeMutedSfx);
      (winObj as { __yoloSfxLog?: string[] }).__yoloSfxLog = [];

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

  it('starts shared Music and Sound Effects ON by default and keeps them 100% decoupled (#317)', () => {
    expect(getSharedMusicOn()).toBe(true);
    expect(getSharedSfxOn()).toBe(true);

    // Toggling Music off does not turn Sound Effects off
    setSharedMusicOn(false);
    expect(getSharedMusicOn()).toBe(false);
    expect(getSharedSfxOn()).toBe(true);

    // Toggling Music back on does not alter Sound Effects
    setSharedMusicOn(true);
    expect(getSharedMusicOn()).toBe(true);
    expect(getSharedSfxOn()).toBe(true);

    // Toggling Sound Effects off leaves Music on, and setActive(true) does not re-enable SFX
    setSharedSfxOn(false);
    expect(getSharedSfxOn()).toBe(false);
    expect(getSharedMusicOn()).toBe(true);
    getSharedArcadeAudio().setActive(true);
    expect(getSharedSfxOn()).toBe(false);

    // Restore both on
    setSharedSfxOn(true);
    expect(getSharedSfxOn()).toBe(true);
  });

  it('persists fetched .m4a tracks in Cache Storage (window.caches) on first play and serves subsequent sessions from disk cache without re-fetching (#326)', async () => {
    const diskEntries = new Map<string, Response>();
    let openedBucket = '';
    const fakeCaches = {
      open: vi.fn(async (name: string) => {
        openedBucket = name;
        return {
          match: vi.fn(async (key: string) => {
            const hit = diskEntries.get(key);
            return hit ? hit.clone() : undefined;
          }),
          put: vi.fn(async (key: string, resp: Response) => {
            diskEntries.set(key, resp.clone());
          }),
        };
      }),
    };

    const fakeFetch = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(32),
    }));

    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      createGain() {
        return {
          gain: {
            value: 1,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      }
      createBuffer = vi.fn(() => ({ duration: 0.001 } as unknown as AudioBuffer));
      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          onended: null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }
      decodeAudioData = vi.fn(async () => ({ duration: 60 }));
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => undefined);
    }

    vi.stubGlobal('window', {
      AudioContext: FakeAudioContext,
      caches: fakeCaches,
    });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('fetch', fakeFetch);
    vi.stubGlobal('caches', fakeCaches);

    try {
      // Session 1: fetches from network and populates persistent Cache Storage
      const session1 = new TetrisMusic();
      session1.ensureContext();
      session1.setActive(true);
      await new Promise((r) => setTimeout(r, 20));
      expect(openedBucket).toBe(AUDIO_DISK_CACHE_NAME);
      expect(diskEntries.size).toBeGreaterThanOrEqual(1);
      const callsAfterSession1 = fakeFetch.mock.calls.length;
      expect(callsAfterSession1).toBeGreaterThanOrEqual(1);
      session1.dispose();

      // Pre-populate all playlist tracks in diskEntries so Session 2 is 100% cache hit
      for (const t of PLAYLIST) {
        diskEntries.set(t.src, new Response(new ArrayBuffer(32)));
      }
      diskEntries.set(COUNTDOWN_VOICE_SPRITE_SRC, new Response(new ArrayBuffer(32)));

      // Session 2 (simulating app restart): serves from diskEntries without any new fetch() call
      fakeFetch.mockClear();
      const session2 = new TetrisMusic();
      session2.ensureContext();
      session2.setActive(true);
      await new Promise((r) => setTimeout(r, 20));
      expect(fakeFetch).not.toHaveBeenCalled();
      session2.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
