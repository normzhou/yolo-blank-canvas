import { shuffledTracks, type Track } from '../../shared/tetrisMusic';

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

/**
 * Plays the background chiptune tracks — bundled free audio, one shuffled
 * track after another, so the music keeps varying across a session.
 *
 * Why Web Audio API (`AudioContext` + `fetch` + `decodeAudioData`) is primary
 * (#217):
 * 1. On iOS Safari and iOS Chrome (both WebKit), `HTMLAudioElement` uses
 *    CoreMedia's HTTP streamer, which requires HTTP `206 Partial Content`
 *    byte-range responses and fails when a static Worker origin serves `.m4a`
 *    with `200 OK`. `fetch(track.src)` + `decodeAudioData` loads the compact
 *    AAC-LC `.m4a` files over standard `200 OK` HTTP without needing byte-range
 *    headers.
 * 2. iOS WebKit requires audio to be unlocked synchronously inside the user
 *    tap gesture (`ensureContext()` + `setActive(true)` in `onClick`), and
 *    setting `navigator.audioSession.type = 'playback'` (iOS 17+) lets game
 *    music play even when the iPhone hardware Ring/Silent switch is on.
 */
export class TetrisMusic {
  private readonly onTrackChange?: (track: Track) => void;
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private pendingLoads = new Map<string, Promise<AudioBuffer | null>>();
  private audio: HTMLAudioElement | null = null;
  private active = false;
  private queue: Track[] = [];
  private currentTrack: Track | null = null;
  private lastTrackId: string | null = null;
  private startedAt = 0;
  private pauseOffset = 0;
  private playToken = 0;

  constructor(onTrackChange?: (track: Track) => void) {
    this.onTrackChange = onTrackChange;
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

        if (!this.currentTrack) {
          this.advance();
        }
        return true;
      } catch {
        this.ctx = null;
      }
    }

    if (typeof Audio === 'undefined') return false;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.addEventListener('ended', () => this.advance());
      this.audio.addEventListener('error', () => this.advance());
      this.advance();
    }
    return true;
  }

  /** Start or stop playback. Safe to call both in `onClick` and `useEffect`. */
  setActive(active: boolean): void {
    if (this.active === active) {
      if (active && this.ctx && this.ctx.state !== 'running') {
        void this.ctx.resume().catch(() => undefined);
      }
      return;
    }
    this.active = active;

    if (this.ctx) {
      if (!active) {
        if (this.sourceNode) {
          this.pauseOffset += Math.max(0, this.ctx.currentTime - this.startedAt);
        }
        this.playToken += 1;
        this.stopSourceNode();
        return;
      }
      if (this.ctx.state !== 'running') {
        void this.ctx.resume().catch(() => undefined);
      }
      if (!this.currentTrack) {
        this.advance();
      } else {
        void this.playDecodedTrack(this.currentTrack, this.pauseOffset);
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
    this.playToken += 1;
    this.stopSourceNode();
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

  private stopSourceNode(): void {
    if (!this.sourceNode) return;
    try {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
      this.sourceNode.disconnect();
    } catch {
      // Node may already have stopped.
    }
    this.sourceNode = null;
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

  private async playDecodedTrack(track: Track, offsetSec: number): Promise<void> {
    this.playToken += 1;
    const token = this.playToken;
    this.stopSourceNode();

    const buffer = await this.loadBuffer(track);
    if (!buffer || !this.active || !this.ctx || token !== this.playToken) return;

    if (this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => undefined);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    const safeOffset = offsetSec > 0 && offsetSec < buffer.duration ? offsetSec : 0;
    this.pauseOffset = safeOffset;
    this.startedAt = this.ctx.currentTime;
    this.sourceNode = source;
    source.onended = () => {
      if (this.playToken === token && this.active) {
        this.sourceNode = null;
        this.pauseOffset = 0;
        this.advance();
      }
    };
    try {
      source.start(0, safeOffset);
    } catch {
      this.sourceNode = null;
    }
  }

  /** Move to the next queued track, reshuffling and avoiding an immediate repeat. */
  private advance(): void {
    if (this.queue.length === 0) {
      this.queue = shuffledTracks();
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
        void this.playDecodedTrack(next, 0);
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
