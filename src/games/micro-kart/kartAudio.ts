/**
 * Procedural Web Audio synthesizer for Micro Kart (#344, #358):
 * - Warm low-pass filtered dual-oscillator engine hum tracking kart speed & boost
 * - Mini-turbo / pad boost whoosh sweep
 * - Lap completion chime & race-finish fanfare
 * - Cushioned kart-to-kart bump thud
 */

import { getSharedSfxOn } from '../../client/audio/arcadeAudio';
import type { BoostKind } from '../../shared/microKart';

type AudioCtxCtor = typeof AudioContext;

function getAudioContextCtor(): AudioCtxCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioCtxCtor;
    webkitAudioContext?: AudioCtxCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class MicroKartSynth {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private lastBumpAt = 0;

  private ensureRunning(): AudioContext | null {
    if (!getSharedSfxOn()) return null;
    if (!this.ctx) {
      const Ctor = getAudioContextCtor();
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  updateEngine(speed: number, boosting: boolean, drifting: boolean, active: boolean): void {
    if (!active || !getSharedSfxOn() || speed < 1.5) {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      return;
    }
    const ctx = this.ensureRunning();
    if (!ctx || ctx.state !== 'running') return;

    if (!this.engineOsc || !this.subOsc || !this.engineFilter || !this.engineGain) {
      try {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        filter.type = 'lowpass';
        filter.Q.value = 2.2;
        gain.gain.value = 0;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();

        this.engineOsc = osc1;
        this.subOsc = osc2;
        this.engineFilter = filter;
        this.engineGain = gain;
      } catch {
        return;
      }
    }

    const now = ctx.currentTime;
    const normSpeed = Math.min(1.35, speed / 76);
    const baseHz = 56 + normSpeed * 112 + (boosting ? 28 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseHz, now, 0.04);
    this.subOsc.frequency.setTargetAtTime(baseHz * 0.5, now, 0.04);
    this.engineFilter.frequency.setTargetAtTime(
      260 + normSpeed * 620 + (drifting ? 220 : 0) + (boosting ? 420 : 0),
      now,
      0.05,
    );
    const targetGain = Math.min(0.038, 0.012 + normSpeed * 0.02 + (boosting ? 0.008 : 0));
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
  }

  playBoost(kind: BoostKind): void {
    const ctx = this.ensureRunning();
    if (!ctx || ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const startHz = kind === 'ultra' ? 320 : 250;
      const endHz = kind === 'ultra' ? 880 : 680;
      osc.frequency.setValueAtTime(startHz, now);
      osc.frequency.exponentialRampToValueAtTime(endHz, now + 0.24);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Ignore Web Audio errors in headless environments
    }
  }

  playLap(finished: boolean): void {
    const ctx = this.ensureRunning();
    if (!ctx || ctx.state !== 'running') return;
    const notes = finished ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    try {
      const now = ctx.currentTime;
      notes.forEach((hz, idx) => {
        const t = now + idx * 0.085;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(hz, t);
        gain.gain.setValueAtTime(0.075, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    } catch {
      // Ignore
    }
  }

  playBump(): void {
    const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (perfNow - this.lastBumpAt < 180) return;
    this.lastBumpAt = perfNow;
    const ctx = this.ensureRunning();
    if (!ctx || ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.11);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Ignore
    }
  }

  dispose(): void {
    try {
      this.engineOsc?.stop();
      this.subOsc?.stop();
      this.engineOsc?.disconnect();
      this.subOsc?.disconnect();
      this.engineFilter?.disconnect();
      this.engineGain?.disconnect();
    } catch {
      // Ignore
    }
    this.engineOsc = null;
    this.subOsc = null;
    this.engineFilter = null;
    this.engineGain = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
