import { KOROBEINIKI, melodyDuration, noteFrequency } from '../../shared/tetrisMusic';

/**
 * Plays the Tetris tune with a square-wave synth, evoking an old-school game.
 *
 * Browser autoplay policy means the AudioContext must be created or resumed from
 * a user gesture, so `ensureContext()` is called from the Music button; the view
 * then drives `setActive` from game state. Everything is local — nothing is
 * recorded or sent anywhere.
 */

const BEATS_PER_SECOND = 2.2;
const LOOKAHEAD_SECONDS = 0.5;
const SCHEDULE_INTERVAL_MS = 200;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const candidate = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  return candidate ?? null;
}

export class TetrisMusic {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private nextNoteAt = 0;
  private noteIndex = 0;

  /** Create/resume the context. Must be called in a user gesture. */
  ensureContext(): boolean {
    const Ctor = audioContextCtor();
    if (!Ctor) return false;
    if (!this.context) {
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.12;
      this.master.connect(this.context.destination);
      this.nextNoteAt = this.context.currentTime;
      this.noteIndex = 0;
    }
    void this.context.resume();
    return true;
  }

  /** Start or stop playback without creating a context. */
  setActive(active: boolean): void {
    if (!active) {
      this.stopScheduler();
      return;
    }
    if (!this.context) return;
    if (this.timer !== null) return;
    this.nextNoteAt = Math.max(this.nextNoteAt, this.context.currentTime);
    this.timer = window.setInterval(() => this.schedule(), SCHEDULE_INTERVAL_MS);
    this.schedule();
  }

  dispose(): void {
    this.stopScheduler();
    if (this.context && this.context.state !== 'closed') void this.context.close();
    this.context = null;
    this.master = null;
  }

  private stopScheduler(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule(): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    if (context.state === 'suspended') {
      this.nextNoteAt = Math.max(this.nextNoteAt, context.currentTime);
    }
    const horizon = context.currentTime + LOOKAHEAD_SECONDS;
    while (this.nextNoteAt < horizon) {
      const [pitch, beats] = KOROBEINIKI[this.noteIndex % KOROBEINIKI.length];
      const duration = beats / BEATS_PER_SECOND;
      if (pitch) {
        this.playNote(noteFrequency(pitch), this.nextNoteAt, duration * 0.9);
      }
      this.nextNoteAt += duration;
      this.noteIndex += 1;
    }
  }

  private playNote(frequency: number, at: number, duration: number): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(1, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }
}

export function totalMelodySeconds(): number {
  return melodyDuration(KOROBEINIKI, BEATS_PER_SECOND);
}
