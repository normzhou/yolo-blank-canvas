import { PLAYLIST, shuffledTracks, type Track } from '../../shared/tetrisMusic';
import { ArcadeSfx, type SfxEventName } from './toneSynth';

type AudioContextConstructor = typeof AudioContext;

export const CROSSFADE_SEC = 1.2;

export interface AudioOutputMetrics {
  rms: number;
  peak: number;
  activeBins: number;
  trackId: string | null;
  trackTitle: string | null;
  durationSec: number;
  crossfadeCount: number;
  activeFadingNodes: number;
  sfxLog: SfxEventName[];
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

interface ActiveVoice {
  source: AudioBufferSourceNode;
  gain: GainNode | null;
  crossfadeTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Plays the background chiptune tracks and real-time `Tone.js`-style arcade
 * sound effects — with smooth `GainNode` crossfading between tracks and
 * between screens (`SELECTOR_PLAYLIST` <-> `TETRIS_PLAYLIST` <-> `PUZZLE_BOBBLE_PLAYLIST`,
 * #217, #232, #234).
 */
export class TetrisMusic {
  private onTrackChange?: (track: Track) => void;
  private playlist: ReadonlyArray<Track>;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentVoice: ActiveVoice | null = null;
  private fadingVoices = new Set<ActiveVoice>();
  private bufferCache = new Map<string, AudioBuffer>();
  private pendingLoads = new Map<string, Promise<AudioBuffer | null>>();
  private audio: HTMLAudioElement | null = null;
  private active = false;
  private sfxEnabled = false;
  private queue: Track[] = [];
  private currentTrack: Track | null = null;
  private lastTrackId: string | null = null;
  private startedAt = 0;
  private pauseOffset = 0;
  private playToken = 0;
  private crossfadeCount = 0;
  public readonly sfx: ArcadeSfx;

  constructor(onTrackChange?: (track: Track) => void, playlist: ReadonlyArray<Track> = PLAYLIST) {
    this.onTrackChange = onTrackChange;
    this.playlist = playlist;
    this.sfx = new ArcadeSfx(() => ({
      ctx: this.ctx,
      output: this.analyser ?? this.ctx?.destination ?? null,
      enabled: this.sfxEnabled,
    }));
  }

  setTrackChangeListener(listener?: (track: Track) => void): void {
    this.onTrackChange = listener;
    if (this.currentTrack && listener) {
      listener(this.currentTrack);
    }
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  /**
   * Switches the active playlist (e.g. Selector Screen <-> Tetris <-> Puzzle Bobble).
   * If a track from the previous playlist is currently playing, crossfades
   * smoothly (`CROSSFADE_SEC = 1.2s`) into a track from the new playlist (#234).
   */
  setPlaylist(nextPlaylist: ReadonlyArray<Track>): void {
    if (this.playlist === nextPlaylist) return;
    this.playlist = nextPlaylist;
    this.queue = [];
    this.pauseOffset = 0;
    const inNewPlaylist = this.currentTrack
      ? nextPlaylist.some((t) => t.id === this.currentTrack?.id)
      : false;
    if (!inNewPlaylist && (this.ctx || this.audio)) {
      this.advance(this.active && this.currentVoice !== null);
    }
  }

  /**
   * Prepare and unlock audio output. Must be called synchronously inside a
   * user gesture (`onClick` / `onPointerDown`).
   */
  ensureContext(): boolean {
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        const nav = navigator as Navigator & { audioSession?: { type?: string } };
        if (nav.audioSession) nav.audioSession.type = 'playback';
      } catch {
        // Ignore if the browser does not permit setting audioSession.type.
      }
    }

    const AudioCtx = getAudioContextConstructor();
    if (AudioCtx) {
      try {
        if (!this.ctx) {
          this.ctx = new AudioCtx();
          if (typeof this.ctx.createAnalyser === 'function') {
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 1024;
            this.analyser.connect(this.ctx.destination);
          }
        }
        if (this.ctx.state !== 'running') {
          void this.ctx.resume().catch(() => undefined);
        }
        // Play a 1-sample silent buffer synchronously to unlock iOS WebKit's
        // hardware audio thread during the tap gesture.
        const silent = this.ctx.createBuffer(1, 1, 22050);
        const unlockNode = this.ctx.createBufferSource();
        unlockNode.buffer = silent;
        unlockNode.connect(this.ctx.destination);
        unlockNode.start(0);

        if (typeof window !== 'undefined') {
          (window as unknown as { __yoloAudioMetrics?: () => AudioOutputMetrics }).__yoloAudioMetrics =
            () => this.sampleOutputMetrics();
        }

        if (!this.currentTrack) {
          this.advance(false);
        }
        return true;
      } catch {
        this.ctx = null;
        this.analyser = null;
      }
    }

    if (typeof Audio === 'undefined') return false;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.addEventListener('ended', () => this.advance(false));
      this.audio.addEventListener('error', () => this.advance(false));
      this.advance(false);
    }
    return true;
  }

  /**
   * Samples real-time audio output metrics from the live `AnalyserNode` and
   * decoded `AudioBuffer` for closed-loop verification (#232, #234).
   */
  sampleOutputMetrics(): AudioOutputMetrics {
    const trackId = this.currentTrack?.id ?? null;
    const trackTitle = this.currentTrack?.title ?? null;
    const cached = trackId ? this.bufferCache.get(trackId) : undefined;
    const durationSec = cached?.duration ?? 0;
    const sfxLog =
      typeof window !== 'undefined'
        ? ((window as unknown as { __yoloSfxLog?: SfxEventName[] }).__yoloSfxLog ?? [])
        : [];

    if (this.analyser) {
      const timeDomain = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(timeDomain);
      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < timeDomain.length; i += 1) {
        const v = Math.abs(timeDomain[i]);
        sumSq += v * v;
        if (v > peak) peak = v;
      }
      const rms = Math.sqrt(sumSq / timeDomain.length);

      const freqBins = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(freqBins);
      let activeBins = 0;
      for (let i = 0; i < freqBins.length; i += 1) {
        if (freqBins[i] > 16) activeBins += 1;
      }
      return {
        rms,
        peak,
        activeBins,
        trackId,
        trackTitle,
        durationSec,
        crossfadeCount: this.crossfadeCount,
        activeFadingNodes: this.fadingVoices.size,
        sfxLog,
      };
    }

    return {
      rms: 0,
      peak: 0,
      activeBins: 0,
      trackId,
      trackTitle,
      durationSec,
      crossfadeCount: this.crossfadeCount,
      activeFadingNodes: this.fadingVoices.size,
      sfxLog,
    };
  }

  setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  /** Start or stop playback. Safe to call both in `onClick` and `useEffect`. */
  setActive(active: boolean): void {
    this.sfxEnabled = active;
    if (this.active === active) {
      if (active && this.ctx && this.ctx.state !== 'running') {
        void this.ctx.resume().catch(() => undefined);
      }
      return;
    }
    this.active = active;

    if (this.ctx) {
      if (!active) {
        if (this.currentVoice) {
          this.pauseOffset += Math.max(0, this.ctx.currentTime - this.startedAt);
        }
        this.playToken += 1;
        this.stopAllVoices();
        return;
      }
      if (this.ctx.state !== 'running') {
        void this.ctx.resume().catch(() => undefined);
      }
      if (!this.currentTrack || !this.playlist.some((t) => t.id === this.currentTrack?.id)) {
        this.advance(false);
      } else {
        void this.playDecodedTrack(this.currentTrack, this.pauseOffset, false);
      }
      return;
    }

    if (!this.audio) return;
    if (!active) {
      this.audio.pause();
      return;
    }
    if (this.audio.paused) void this.audio.play().catch(() => undefined);
  }

  dispose(): void {
    this.active = false;
    this.sfxEnabled = false;
    this.playToken += 1;
    this.stopAllVoices();
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        // Ignore if already disconnected.
      }
      this.analyser = null;
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
    this.bufferCache.clear();
    this.pendingLoads.clear();
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    this.audio = null;
    this.queue = [];
    this.currentTrack = null;
    this.lastTrackId = null;
    this.pauseOffset = 0;
  }

  private stopVoiceImmediate(voice: ActiveVoice | null): void {
    if (!voice) return;
    if (voice.crossfadeTimer !== null) {
      clearTimeout(voice.crossfadeTimer);
      voice.crossfadeTimer = null;
    }
    try {
      voice.source.onended = null;
      voice.source.stop();
      voice.source.disconnect();
    } catch {
      // Node may already have stopped.
    }
    if (voice.gain) {
      try {
        voice.gain.disconnect();
      } catch {
        // Ignore.
      }
    }
  }

  private stopAllVoices(): void {
    this.stopVoiceImmediate(this.currentVoice);
    this.currentVoice = null;
    for (const v of this.fadingVoices) {
      this.stopVoiceImmediate(v);
    }
    this.fadingVoices.clear();
  }

  private fadeOutVoice(voice: ActiveVoice, fadeSec = CROSSFADE_SEC): void {
    if (voice.crossfadeTimer !== null) {
      clearTimeout(voice.crossfadeTimer);
      voice.crossfadeTimer = null;
    }
    voice.source.onended = null;

    if (!this.ctx || !voice.gain || typeof voice.gain.gain?.linearRampToValueAtTime !== 'function') {
      this.stopVoiceImmediate(voice);
      return;
    }

    try {
      const now = this.ctx.currentTime || 0;
      const currentVal = typeof voice.gain.gain.value === 'number' ? voice.gain.gain.value : 1;
      voice.gain.gain.setValueAtTime(Math.max(0.0001, currentVal), now);
      voice.gain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
      this.fadingVoices.add(voice);
      this.crossfadeCount += 1;
      setTimeout(() => {
        this.fadingVoices.delete(voice);
        this.stopVoiceImmediate(voice);
      }, Math.round((fadeSec + 0.05) * 1000));
    } catch {
      this.stopVoiceImmediate(voice);
    }
  }

  private loadBuffer(track: Track): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(track.id);
    if (cached) return Promise.resolve(cached);
    const existing = this.pendingLoads.get(track.id);
    if (existing) return existing;

    const task = (async () => {
      if (!this.ctx || typeof fetch !== 'function') return null;
      try {
        const response = await fetch(track.src);
        if (!response.ok) return null;
        const raw = await response.arrayBuffer();
        if (!this.ctx) return null;
        const decoded = await this.ctx.decodeAudioData(raw.slice(0));
        this.bufferCache.set(track.id, decoded);
        return decoded;
      } catch {
        return null;
      } finally {
        this.pendingLoads.delete(track.id);
      }
    })();

    this.pendingLoads.set(track.id, task);
    return task;
  }

  private async playDecodedTrack(
    track: Track,
    offsetSec: number,
    crossfade: boolean,
  ): Promise<void> {
    this.playToken += 1;
    const token = this.playToken;

    const buffer = await this.loadBuffer(track);
    if (!buffer || !this.active || !this.ctx || token !== this.playToken) return;

    if (this.currentVoice) {
      if (crossfade) {
        this.fadeOutVoice(this.currentVoice, CROSSFADE_SEC);
        this.currentVoice = null;
      } else {
        this.stopVoiceImmediate(this.currentVoice);
        this.currentVoice = null;
      }
    }

    if (this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => undefined);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    let gainNode: GainNode | null = null;
    const dest = this.analyser ?? this.ctx.destination;
    if (typeof this.ctx.createGain === 'function') {
      gainNode = this.ctx.createGain();
      const now = this.ctx.currentTime || 0;
      if (crossfade && typeof gainNode.gain?.setValueAtTime === 'function') {
        gainNode.gain.setValueAtTime(0.0001, now);
        if (typeof gainNode.gain.linearRampToValueAtTime === 'function') {
          gainNode.gain.linearRampToValueAtTime(1.0, now + CROSSFADE_SEC);
        }
      } else if (typeof gainNode.gain?.setValueAtTime === 'function') {
        gainNode.gain.setValueAtTime(1.0, now);
      }
      source.connect(gainNode);
      gainNode.connect(dest);
    } else {
      source.connect(dest);
    }

    const safeOffset = offsetSec > 0 && offsetSec < buffer.duration ? offsetSec : 0;
    this.pauseOffset = safeOffset;
    this.startedAt = this.ctx.currentTime;

    const voice: ActiveVoice = { source, gain: gainNode, crossfadeTimer: null };
    this.currentVoice = voice;

    // Schedule seamless crossfade into the next track before this buffer ends.
    const remainingSec = buffer.duration - safeOffset;
    if (remainingSec > CROSSFADE_SEC * 2.5) {
      voice.crossfadeTimer = setTimeout(() => {
        if (this.playToken === token && this.active && this.currentVoice === voice) {
          this.pauseOffset = 0;
          this.advance(true);
        }
      }, Math.round((remainingSec - CROSSFADE_SEC) * 1000));
    }

    source.onended = () => {
      if (this.playToken === token && this.active && this.currentVoice === voice) {
        this.currentVoice = null;
        this.pauseOffset = 0;
        this.advance(false);
      }
    };
    try {
      source.start(0, safeOffset);
    } catch {
      this.currentVoice = null;
    }
  }

  /** Move to the next queued track, reshuffling and avoiding an immediate repeat. */
  public advance(crossfade = true): void {
    if (this.queue.length === 0) {
      this.queue = shuffledTracks(Math.random, this.playlist);
      if (this.queue.length > 1 && this.queue[0].id === this.lastTrackId) {
        const distinct = this.queue.findIndex((track) => track.id !== this.lastTrackId);
        if (distinct > 0) {
          const [track] = this.queue.splice(distinct, 1);
          this.queue.unshift(track);
        }
      }
    }
    const next = this.queue.shift();
    if (!next) return;
    this.currentTrack = next;
    this.lastTrackId = next.id;
    this.pauseOffset = 0;
    this.onTrackChange?.(next);

    if (this.ctx) {
      if (this.active) {
        void this.playDecodedTrack(next, 0, crossfade && this.currentVoice !== null);
      } else {
        // Preload the first track buffer in the background so playback starts
        // instantaneously as soon as setActive(true) is called.
        void this.loadBuffer(next);
      }
      return;
    }

    if (!this.audio) return;
    this.audio.src = next.src;
    if (this.active) void this.audio.play().catch(() => undefined);
  }
}

/**
 * Shared singleton audio controller so the global YouTube-style sound button
 * in `App.tsx` can drive music crossfades and real-time SFX across the
 * Selector Screen, Tetris, and Puzzle Bobble (#234).
 */
let sharedController: TetrisMusic | null = null;
let sharedMusicOn = false;
const stateListeners = new Set<(musicOn: boolean, nowPlaying: string | null) => void>();

export function getSharedArcadeAudio(): TetrisMusic {
  if (!sharedController) {
    sharedController = new TetrisMusic((track) => {
      for (const listener of stateListeners) {
        listener(sharedMusicOn, track.title);
      }
    });
  }
  return sharedController;
}

export function getSharedMusicOn(): boolean {
  return sharedMusicOn;
}

export function setSharedMusicOn(next: boolean, activePlayable = true): boolean {
  const audio = getSharedArcadeAudio();
  if (next && !audio.ensureContext()) return false;
  sharedMusicOn = next;
  audio.setActive(next && activePlayable);
  audio.setSfxEnabled(next);
  const title = audio.getCurrentTrack()?.title ?? null;
  for (const listener of stateListeners) {
    listener(sharedMusicOn, title);
  }
  return true;
}

export function subscribeSharedAudio(
  listener: (musicOn: boolean, nowPlaying: string | null) => void,
): () => void {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}
