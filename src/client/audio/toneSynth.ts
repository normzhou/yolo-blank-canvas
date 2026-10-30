/**
 * Tone.js-style Web Audio synthesis engine (`TonePolySynth`, `ToneFMSynth`,
 * `ToneMembraneSynth`) and real-time `ArcadeSfx` synthesizer (#234).
 *
 * Implemented directly on the native Web Audio API (`AudioContext`,
 * `OscillatorNode`, `GainNode`, `BiquadFilterNode`) so it is 100% CSP-clean
 * under `default-src 'none'; script-src 'self'` (avoiding `Tone.js`
 * `standardized-audio-context` `blob:` Worker CSP violations) and shares the
 * exact same iOS-unlocked `AudioContext` and closed-loop `AnalyserNode` as
 * `TetrisMusic`.
 */

const NOTE_SEMI: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

export function noteToFreq(noteOrFreq: string | number): number {
  if (typeof noteOrFreq === 'number') return noteOrFreq;
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(noteOrFreq.trim());
  if (!match) return 440;
  const semi = NOTE_SEMI[match[1]] ?? 0;
  const octv = Number.parseInt(match[2], 10);
  const midi = 12 * (octv + 1) + semi;
  return 440 * 2 ** ((midi - 69) / 12);
}

export interface FMSynthOptions {
  harmonicity?: number;
  modulationIndex?: number;
  carrierType?: OscillatorType;
  modulationType?: OscillatorType;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

/**
 * 2-Operator Frequency Modulation synthesizer modeled after `Tone.FMSynth`.
 */
export class ToneFMSynth {
  private readonly ctx: AudioContext;
  private readonly output: AudioNode;
  private readonly opts: Required<FMSynthOptions>;

  constructor(ctx: AudioContext, output: AudioNode, options: FMSynthOptions = {}) {
    this.ctx = ctx;
    this.output = output;
    this.opts = {
      harmonicity: options.harmonicity ?? 2.0,
      modulationIndex: options.modulationIndex ?? 3.2,
      carrierType: options.carrierType ?? 'sine',
      modulationType: options.modulationType ?? 'sine',
      attack: options.attack ?? 0.005,
      decay: options.decay ?? 0.14,
      sustain: options.sustain ?? 0.2,
      release: options.release ?? 0.08,
    };
  }

  triggerAttackRelease(
    noteOrFreq: string | number,
    durationSec = 0.12,
    timeOffsetSec = 0,
    velocity = 0.22,
    endNoteOrFreq?: string | number,
  ): void {
    try {
      const now = (this.ctx.currentTime || 0) + Math.max(0, timeOffsetSec);
      const baseFreq = noteToFreq(noteOrFreq);
      const targetFreq = endNoteOrFreq !== undefined ? noteToFreq(endNoteOrFreq) : baseFreq;
      const totalDur = Math.max(0.02, durationSec + this.opts.release);

      const carrier = this.ctx.createOscillator();
      const modulator = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const ampGain = this.ctx.createGain();

      carrier.type = this.opts.carrierType;
      modulator.type = this.opts.modulationType;

      if (typeof carrier.frequency?.setValueAtTime === 'function') {
        carrier.frequency.setValueAtTime(baseFreq, now);
        if (targetFreq !== baseFreq && typeof carrier.frequency.exponentialRampToValueAtTime === 'function') {
          carrier.frequency.exponentialRampToValueAtTime(Math.max(20, targetFreq), now + durationSec);
        }
      }
      if (typeof modulator.frequency?.setValueAtTime === 'function') {
        modulator.frequency.setValueAtTime(baseFreq * this.opts.harmonicity, now);
      }

      const modPeak = baseFreq * this.opts.modulationIndex;
      if (typeof modGain.gain?.setValueAtTime === 'function') {
        modGain.gain.setValueAtTime(modPeak, now);
        if (typeof modGain.gain.exponentialRampToValueAtTime === 'function') {
          modGain.gain.exponentialRampToValueAtTime(Math.max(1, modPeak * 0.15), now + totalDur);
        }
      }

      if (typeof ampGain.gain?.setValueAtTime === 'function') {
        ampGain.gain.setValueAtTime(0.0001, now);
        if (typeof ampGain.gain.linearRampToValueAtTime === 'function') {
          ampGain.gain.linearRampToValueAtTime(velocity, now + this.opts.attack);
          ampGain.gain.linearRampToValueAtTime(
            velocity * this.opts.sustain,
            now + this.opts.attack + Math.min(durationSec, this.opts.decay),
          );
          ampGain.gain.linearRampToValueAtTime(0.0001, now + totalDur);
        }
      }

      if (carrier.frequency) {
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
      }
      carrier.connect(ampGain);
      ampGain.connect(this.output);

      modulator.start(now);
      carrier.start(now);
      modulator.stop(now + totalDur + 0.01);
      carrier.stop(now + totalDur + 0.01);
    } catch {
      // AudioContext may be closed or stubbed in unit tests.
    }
  }
}

/**
 * Polyphonic detuned chord synthesizer modeled after `Tone.PolySynth`.
 */
export class TonePolySynth {
  private readonly ctx: AudioContext;
  private readonly output: AudioNode;

  constructor(ctx: AudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  triggerAttackRelease(
    notes: ReadonlyArray<string | number>,
    durationSec = 0.18,
    timeOffsetSec = 0,
    velocity = 0.16,
  ): void {
    if (notes.length === 0) return;
    try {
      const now = (this.ctx.currentTime || 0) + Math.max(0, timeOffsetSec);
      const release = 0.1;
      const totalDur = Math.max(0.04, durationSec + release);
      const voiceGain = velocity / Math.sqrt(notes.length);

      const envGain = this.ctx.createGain();
      if (typeof envGain.gain?.setValueAtTime === 'function') {
        envGain.gain.setValueAtTime(0.0001, now);
        if (typeof envGain.gain.linearRampToValueAtTime === 'function') {
          envGain.gain.linearRampToValueAtTime(voiceGain, now + 0.01);
          envGain.gain.linearRampToValueAtTime(voiceGain * 0.55, now + durationSec);
          envGain.gain.linearRampToValueAtTime(0.0001, now + totalDur);
        }
      }
      envGain.connect(this.output);

      for (const n of notes) {
        const freq = noteToFreq(n);
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        if (typeof osc.frequency?.setValueAtTime === 'function') {
          osc.frequency.setValueAtTime(freq, now);
        }
        osc.connect(envGain);
        osc.start(now);
        osc.stop(now + totalDur + 0.01);
      }
    } catch {
      // AudioContext may be closed or stubbed in unit tests.
    }
  }
}

/**
 * Pitch-envelope percussion synthesizer modeled after `Tone.MembraneSynth`.
 */
export class ToneMembraneSynth {
  private readonly ctx: AudioContext;
  private readonly output: AudioNode;

  constructor(ctx: AudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  triggerAttackRelease(
    noteOrFreq: string | number = 60,
    durationSec = 0.1,
    timeOffsetSec = 0,
    {
      octaves = 2.8,
      pitchDecay = 0.035,
      velocity = 0.28,
    }: { octaves?: number; pitchDecay?: number; velocity?: number } = {},
  ): void {
    try {
      const now = (this.ctx.currentTime || 0) + Math.max(0, timeOffsetSec);
      const baseFreq = Math.max(24, noteToFreq(noteOrFreq));
      const startFreq = baseFreq * 2 ** octaves;
      const totalDur = Math.max(0.03, durationSec);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';

      if (typeof osc.frequency?.setValueAtTime === 'function') {
        osc.frequency.setValueAtTime(startFreq, now);
        if (typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
          osc.frequency.exponentialRampToValueAtTime(baseFreq, now + Math.min(totalDur, pitchDecay));
        }
      }

      if (typeof gain.gain?.setValueAtTime === 'function') {
        gain.gain.setValueAtTime(velocity, now);
        if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + totalDur);
        }
      }

      osc.connect(gain);
      gain.connect(this.output);
      osc.start(now);
      osc.stop(now + totalDur + 0.01);
    } catch {
      // AudioContext may be closed or stubbed in unit tests.
    }
  }
}

export type SfxEventName =
  | 'countdown-tick'
  | 'countdown-go'
  | 'bubble-shoot'
  | 'bubble-pop'
  | 'bubble-avalanche'
  | 'garbage-send'
  | 'garbage-rise'
  | 'round-win'
  | 'round-lose'
  | 'tetris-rotate'
  | 'tetris-drop'
  | 'tetris-line-clear'
  | 'tetris-four-line'
  | 'tetris-over';

/**
 * Real-time arcade sound effects controller powered by `TonePolySynth`,
 * `ToneFMSynth`, and `ToneMembraneSynth` (#234).
 */
export class ArcadeSfx {
  private readonly getNodes: () => { ctx: AudioContext | null; output: AudioNode | null; enabled: boolean };

  constructor(
    getNodes: () => { ctx: AudioContext | null; output: AudioNode | null; enabled: boolean },
  ) {
    this.getNodes = getNodes;
  }

  private recordAndReady(name: SfxEventName): {
    fm: ToneFMSynth;
    poly: TonePolySynth;
    membrane: ToneMembraneSynth;
  } | null {
    const { ctx, output, enabled } = this.getNodes();
    if (typeof window !== 'undefined') {
      const win = window as unknown as { __yoloSfxLog?: SfxEventName[] };
      if (!win.__yoloSfxLog) win.__yoloSfxLog = [];
      win.__yoloSfxLog.push(name);
    }
    if (!enabled || !ctx || !output) return null;
    if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
      void ctx.resume().catch(() => undefined);
    }
    return {
      fm: new ToneFMSynth(ctx, output),
      poly: new TonePolySynth(ctx, output),
      membrane: new ToneMembraneSynth(ctx, output),
    };
  }

  /** Arcade / car-race 3, 2, 1 countdown beep and green-light launch tone (#252, #258). */
  playCountdown(step: number): void {
    if (step > 0) {
      const synths = this.recordAndReady('countdown-tick');
      if (!synths) return;
      synths.fm.triggerAttackRelease('A4', 0.16, 0, 0.72);
      synths.poly.triggerAttackRelease(['A4', 'E5'], 0.14, 0, 0.58);
      return;
    }
    const synths = this.recordAndReady('countdown-go');
    if (!synths) return;
    synths.fm.triggerAttackRelease('A5', 0.28, 0, 0.85);
    synths.poly.triggerAttackRelease(['A5', 'C#6', 'E6', 'A6'], 0.3, 0, 0.72);
  }

  /** Puzzle Bobble: crisp upward chirp + membrane pop when firing a bubble. */
  playBubbleShoot(): void {
    const synths = this.recordAndReady('bubble-shoot');
    if (!synths) return;
    synths.membrane.triggerAttackRelease(150, 0.06, 0, { octaves: 2.0, pitchDecay: 0.025, velocity: 0.65 });
    synths.fm.triggerAttackRelease(340, 0.075, 0, 0.58, 680);
  }

  /** Puzzle Bobble: bubbly harmonic arpeggio when bubbles pop + avalanche cascade chime. */
  playBubblePop(poppedCount: number, droppedCount = 0): void {
    const synths = this.recordAndReady('bubble-pop');
    const popScale = ['C5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6'];
    const notesToPlay = Math.min(popScale.length, Math.max(2, poppedCount));
    if (synths) {
      for (let i = 0; i < notesToPlay; i += 1) {
        synths.fm.triggerAttackRelease(popScale[i], 0.07, i * 0.04, 0.62, noteToFreq(popScale[i]) * 1.12);
      }
    }
    if (droppedCount > 0) {
      const avSynths = this.recordAndReady('bubble-avalanche');
      if (avSynths) {
        avSynths.poly.triggerAttackRelease(['C5', 'E5', 'G5', 'B5'], 0.22, notesToPlay * 0.035, 0.62);
        avSynths.fm.triggerAttackRelease('C6', 0.18, notesToPlay * 0.035 + 0.06, 0.58, 'G6');
      }
    }
  }

  /** Puzzle Bobble: laser-whoosh when sending attack bubbles to the other side. */
  playGarbageSend(count: number): void {
    const synths = this.recordAndReady('garbage-send');
    if (!synths || count <= 0) return;
    synths.fm.triggerAttackRelease(380, 0.14, 0, 0.62, 860);
  }

  /** Puzzle Bobble: deep rumble + rising triad when attack bubbles shoot up from the bottom. */
  playGarbageRise(count: number): void {
    const synths = this.recordAndReady('garbage-rise');
    if (!synths || count <= 0) return;
    synths.membrane.triggerAttackRelease(58, 0.16, 0, { octaves: 2.8, pitchDecay: 0.05, velocity: 0.78 });
    const triad = ['C4', 'Eb4', 'G4', 'C5'];
    for (let i = 0; i < Math.min(triad.length, Math.max(2, count)); i += 1) {
      synths.fm.triggerAttackRelease(triad[i], 0.08, i * 0.045, 0.58);
    }
  }

  /** Puzzle Bobble: victory fanfare or KO wah-wah. */
  playRoundEnd(won: boolean): void {
    const synths = this.recordAndReady(won ? 'round-win' : 'round-lose');
    if (!synths) return;
    if (won) {
      synths.poly.triggerAttackRelease(['C5', 'E5', 'G5'], 0.14, 0, 0.65);
      synths.poly.triggerAttackRelease(['F5', 'A5', 'C6'], 0.14, 0.14, 0.65);
      synths.poly.triggerAttackRelease(['G5', 'B5', 'D6'], 0.14, 0.28, 0.65);
      synths.poly.triggerAttackRelease(['C5', 'E5', 'G5', 'C6'], 0.36, 0.42, 0.75);
    } else {
      const notes = ['E4', 'Eb4', 'D4', 'C#4'];
      notes.forEach((n, idx) => {
        synths.fm.triggerAttackRelease(n, 0.16, idx * 0.14, 0.68, noteToFreq(n) * 0.94);
      });
    }
  }

  /** Tetris: crisp FM blip on piece rotate. */
  playRotate(): void {
    const synths = this.recordAndReady('tetris-rotate');
    if (!synths) return;
    synths.fm.triggerAttackRelease('D5', 0.045, 0, 0.55, 'A5');
  }

  /** Tetris: punchy MembraneSynth thud when blocks drop/lock. */
  playHardDrop(): void {
    const synths = this.recordAndReady('tetris-drop');
    if (!synths) return;
    synths.membrane.triggerAttackRelease(62, 0.11, 0, { octaves: 3.0, pitchDecay: 0.03, velocity: 0.75 });
    synths.fm.triggerAttackRelease(180, 0.05, 0, 0.52, 90);
  }

  /** Tetris: line clear chime (1–3 lines) or 4-line TETRIS fanfare! */
  playLineClear(lines: number): void {
    if (lines <= 0) return;
    if (lines >= 4) {
      const synths = this.recordAndReady('tetris-four-line');
      if (!synths) return;
      const fanfare = ['E5', 'G#5', 'B5', 'E6'];
      fanfare.forEach((n, idx) => {
        synths.fm.triggerAttackRelease(n, 0.1, idx * 0.065, 0.68);
      });
      synths.poly.triggerAttackRelease(['E5', 'G#5', 'B5', 'E6'], 0.38, 0.26, 0.72);
      synths.membrane.triggerAttackRelease(68, 0.14, 0.26, { octaves: 2.6, velocity: 0.75 });
      return;
    }
    const synths = this.recordAndReady('tetris-line-clear');
    if (!synths) return;
    const arp = ['G4', 'B4', 'D5', 'G5'].slice(0, lines + 1);
    arp.forEach((n, idx) => {
      synths.fm.triggerAttackRelease(n, 0.08, idx * 0.055, 0.62);
    });
    synths.poly.triggerAttackRelease(['G4', 'B4', 'D5'], 0.2, arp.length * 0.05, 0.58);
  }

  /** Tetris: classic descending synth cadence on Game Over. */
  playGameOver(): void {
    const synths = this.recordAndReady('tetris-over');
    if (!synths) return;
    ['A4', 'G4', 'F4', 'E4'].forEach((n, idx) => {
      synths.fm.triggerAttackRelease(n, 0.18, idx * 0.15, 0.68);
    });
  }
}
