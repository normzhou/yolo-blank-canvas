import { shuffledTracks, type Track } from '../../shared/tetrisMusic';

/**
 * Plays the Tetris background tracks — bundled free audio, one shuffled
 * track after another, so the music keeps varying across a session.
 *
 * Browser autoplay policy means playback can only start from a user
 * gesture, so `ensureContext()` is called from the Music button; the view
 * then drives `setActive` from game state. Everything is local — nothing
 * is recorded or sent anywhere.
 */
export class TetrisMusic {
  private readonly onTrackChange?: (track: Track) => void;
  private audio: HTMLAudioElement | null = null;
  private active = false;
  private queue: Track[] = [];
  private lastTrackId: string | null = null;

  constructor(onTrackChange?: (track: Track) => void) {
    this.onTrackChange = onTrackChange;
  }

  /** Prepare the audio element. Must be called in a user gesture. */
  ensureContext(): boolean {
    if (typeof Audio === 'undefined') return false;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.addEventListener('ended', () => this.advance());
      this.audio.addEventListener('error', () => this.advance());
      this.advance();
    }
    return true;
  }

  /** Start or stop playback without creating the element. */
  setActive(active: boolean): void {
    this.active = active;
    if (!this.audio) return;
    if (!active) {
      this.audio.pause();
      return;
    }
    if (this.audio.paused) void this.audio.play().catch(() => undefined);
  }

  dispose(): void {
    this.active = false;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    this.audio = null;
    this.queue = [];
    this.lastTrackId = null;
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
    if (!next || !this.audio) return;
    this.lastTrackId = next.id;
    this.audio.src = next.src;
    this.onTrackChange?.(next);
    if (this.active) void this.audio.play().catch(() => undefined);
  }
}
