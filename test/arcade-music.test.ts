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
  PRISM_STACK_PLAYLIST,
  SELECTOR_PLAYLIST,
  STARLIGHT_BURST_PLAYLIST,
  shuffledTracks,
  type Track,
} from '../src/shared/arcadeMusic';
import {
  ArcadeMusicPlayer,
  AUDIO_DISK_CACHE_NAME,
  getSharedArcadeAudio,
  getSharedMusicOn,
  getSharedSfxOn,
  MUSIC_GAIN,
  setSharedMusicOn,
  setSharedSfxOn,
} from '../src/client/audio/arcadeAudio';

describe('selector, prism stack, and starlight burst playlists + Tone synth SFX (#232, #234, #252, #258, #262, #352)', () => {
  it('reduces background music gain to 0.22 so sound effects stand out clearly (#252, #258)', () => {
    expect(MUSIC_GAIN).toBe(0.22);
  });

  it('samples Ready/Go countdown phrases across the 22 most spoken languages weighted linearly by speaker count with major-country flag emojis (#262, #331, #333)', () => {
    expect(COUNTDOWN_LANGUAGES).toHaveLength(22);
    expect(TOTAL_COUNTDOWN_SPEAKERS_MILLIONS).toBe(6758);
    for (let i = 0; i < COUNTDOWN_LANGUAGES.length; i += 1) {
      const lang = COUNTDOWN_LANGUAGES[i]!;
      expect(lang.flags.trim().length).toBeGreaterThan(0);
      expect(lang.spriteIndex).toBe(i);
    }
    expect(COUNTDOWN_LANGUAGES[0]).toMatchObject({
      id: 'en',
      flags: '🇺🇸 🇬🇧 🇨🇦 🇦🇺',
      readyText: 'READY…',
      goText: 'GO!',
    });
    expect(COUNTDOWN_LANGUAGES[1]).toMatchObject({
      id: 'zh',
      readyText: '预备…',
      goText: '齐！',
    });
    expect(COUNTDOWN_LANGUAGES[21]).toMatchObject({
      id: 'ko',
      flags: '🇰🇷',
      readyText: '준비…',
      goText: '시작!',
    });

    // Verify exact speaker-ratio quantile boundaries
    expect(pickCountdownLanguage(() => 0.0).id).toBe('en');
    expect(pickCountdownLanguage(() => 1514 / 6758).id).toBe('en');
    expect(pickCountdownLanguage(() => 1516 / 6758).id).toBe('zh');
    expect(pickCountdownLanguage(() => (1515 + 1140 + 1) / 6758).id).toBe('hi');
    expect(pickCountdownLanguage(() => 0.999).id).toBe('ko');

    // Verify interactive linear sampling never repeats back-to-back (#276, #331, #333)
    const picks = Array.from({ length: 40 }, () => pickCountdownLanguage());
    for (let i = 1; i < picks.length; i += 1) {
      expect(picks[i].id).not.toBe(picks[i - 1].id);
    }

    // Verify bundled 22-language spoken voice sprite exists under public/
    const voiceFile = path.resolve(__dirname, '../public', COUNTDOWN_VOICE_SPRITE_SRC);
    expect(fs.existsSync(voiceFile)).toBe(true);
    expect(fs.statSync(voiceFile).size).toBeGreaterThan(150_000);
  });

  it('offers distinct, game-specific playlists for Selector Screen, Prism Stack, and Starlight Burst', () => {
    expect(SELECTOR_PLAYLIST.length).toBeGreaterThanOrEqual(2);
    expect(PRISM_STACK_PLAYLIST.length).toBeGreaterThanOrEqual(5);
    expect(STARLIGHT_BURST_PLAYLIST.length).toBeGreaterThanOrEqual(5);
    expect(PLAYLIST).toBe(PRISM_STACK_PLAYLIST);

    const ids = new Set<string>();
    for (const track of [...SELECTOR_PLAYLIST, ...PRISM_STACK_PLAYLIST, ...STARLIGHT_BURST_PLAYLIST]) {
      expect(track.id.length).toBeGreaterThan(0);
      expect(track.title.length).toBeGreaterThan(0);
      expect(track.src).toMatch(/^audio\/.+\.(m4a|mp3|ogg|wav)$/);
      expect(ids.has(track.id)).toBe(false);
      ids.add(track.id);
    }
  });

  it('points at 12 bundled full-length (~2-minute) audio files that exist under public/', () => {
    const allTracks = [...SELECTOR_PLAYLIST, ...PRISM_STACK_PLAYLIST, ...STARLIGHT_BURST_PLAYLIST];
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
    const prismShuffled = shuffledTracks(() => 0.42, PRISM_STACK_PLAYLIST);
    expect([...prismShuffled].map((track) => track.id).sort()).toEqual(
      [...PRISM_STACK_PLAYLIST].map((track) => track.id).sort(),
    );
    const sbShuffled = shuffledTracks(() => 0.42, STARLIGHT_BURST_PLAYLIST);
    expect([...sbShuffled].map((track) => track.id).sort()).toEqual(
      [...STARLIGHT_BURST_PLAYLIST].map((track) => track.id).sort(),
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
      const player = new ArcadeMusicPlayer((track) => seen.push(track), SELECTOR_PLAYLIST);
      expect(player.ensureContext()).toBe(true);
      expect(audioSession.type).toBe('playback');
      expect(resume).toHaveBeenCalledTimes(1);
      expect(startedNodes.length).toBeGreaterThanOrEqual(1);
      expect(SELECTOR_PLAYLIST.some((t) => t.id === seen[0].id)).toBe(true);

      // Before setActive(true), sound is off so SFX must not start any Web Audio synth nodes (#270).
      const nodesBeforeMutedSfx = startedNodes.length;
      player.sfx.playStarShoot();
      expect(startedNodes.length).toBe(nodesBeforeMutedSfx);
      (winObj as { __yoloSfxLog?: string[] }).__yoloSfxLog = [];

      player.setActive(true);
      await new Promise((r) => setTimeout(r, 15));
      expect(startedNodes.length).toBe(2);

      // Switching playlist from Selector Screen to Starlight Burst crossfades smoothly.
      player.setPlaylist(STARLIGHT_BURST_PLAYLIST);
      await new Promise((r) => setTimeout(r, 15));
      expect(STARLIGHT_BURST_PLAYLIST.some((t) => t.id === seen[seen.length - 1].id)).toBe(true);

      // Trigger real-time Tone.js-style SFX (FMSynth, PolySynth, MembraneSynth).
      player.sfx.playCountdown(3);
      player.sfx.playCountdown(0);
      player.sfx.playStarShoot();
      player.sfx.playStarBurst(4, 2);
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
        'star-shoot',
        'star-burst',
        'star-cascade',
        'garbage-rise',
        'prism-rotate',
        'prism-drop',
        'prism-quad-clear',
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
      const session1 = new ArcadeMusicPlayer();
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
      const session2 = new ArcadeMusicPlayer();
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
