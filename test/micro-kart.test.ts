import { describe, expect, it } from 'vitest';
import {
  CIRCUIT_LIST,
  CIRCUITS,
  createRaceState,
  MAX_STRAIGHT_SPEED,
  MINI_TURBO_CHARGE_SEC,
  projectOntoCircuit,
  sampleCircuitAtS,
  stepRaceState,
  TOTAL_LAPS,
} from '../src/shared/microKart';

describe('Micro Kart 3D circuits, auto-throttle, turn drift & Down brake (#344, #358, #360)', () => {
  it('builds 3 seamless closed-loop 3D circuits with positive elevation relief and boost pads', () => {
    expect(CIRCUIT_LIST.map((c) => c.id)).toEqual([
      'sunset-loop',
      'canyon-crest',
      'starlight-ring',
    ]);
    for (const circuit of CIRCUIT_LIST) {
      expect(circuit.totalLength).toBeGreaterThan(900);
      expect(circuit.nodes.length).toBe(192);
      const ys = circuit.nodes.map((n) => n.y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(8);
      expect(circuit.nodes.some((n) => n.hasBoostPad)).toBe(true);

      const p0 = sampleCircuitAtS(circuit, 0);
      const pEnd = sampleCircuitAtS(circuit, circuit.totalLength - 0.1);
      expect(Math.hypot(p0.x - pEnd.x, p0.z - pEnd.z)).toBeLessThan(2);
    }
  });

  it('auto-accelerates forward with no keys pressed and brakes cleanly when Down (brake) is held', () => {
    const race = createRaceState('sunset-loop', '1p', 42);
    const p1 = race.karts[0]!;
    expect(p1.speed).toBe(0);

    // Hands off (`left: false, right: false, brake: false`) -> full auto-throttle forward!
    for (let i = 0; i < 60; i += 1) {
      stepRaceState(race, { 0: { left: false, right: false } }, 16.67);
    }
    expect(p1.speed).toBeGreaterThan(40);
    expect(p1.braking).toBe(false);
    expect(p1.leftThruster).toBe(true);
    expect(p1.rightThruster).toBe(true);

    // Hold Down (`brake: true`) -> strong braking deceleration + brake light state!
    const speedBeforeBrake = p1.speed;
    for (let i = 0; i < 25; i += 1) {
      stepRaceState(race, { 0: { left: false, right: false, brake: true } }, 16.67);
    }
    expect(p1.braking).toBe(true);
    expect(p1.leftThruster).toBe(false);
    expect(p1.rightThruster).toBe(false);
    expect(p1.speed).toBeLessThan(speedBeforeBrake - 18);
  });

  it('turns left/right, charges drift, and fires a Mini-Turbo boost upon releasing the turn back to neutral', () => {
    const raceL = createRaceState('sunset-loop', '1p', 7);
    const raceR = createRaceState('sunset-loop', '1p', 7);

    // Auto-accelerate hands-off up to cruising speed (>20 m/s)
    for (let i = 0; i < 30; i += 1) {
      stepRaceState(raceL, { 0: { left: false, right: false } }, 16.67);
      stepRaceState(raceR, { 0: { left: false, right: false } }, 16.67);
    }

    // Turn Left (`left: true`) vs Turn Right (`right: true`)
    for (let i = 0; i < 30; i += 1) {
      stepRaceState(raceL, { 0: { left: true, right: false } }, 16.67);
      stepRaceState(raceR, { 0: { left: false, right: true } }, 16.67);
    }
    expect(raceL.karts[0]!.yaw).toBeLessThan(raceR.karts[0]!.yaw);
    expect(raceL.karts[0]!.lat).toBeLessThan(raceR.karts[0]!.lat);
    expect(raceR.karts[0]!.driftCharge).toBeGreaterThanOrEqual(MINI_TURBO_CHARGE_SEC);
    expect(raceR.karts[0]!.skidMarks.length).toBeGreaterThan(0);

    // Release turn (`left: false, right: false`) -> auto-throttle straight + Mini-Turbo surge!
    stepRaceState(raceR, { 0: { left: false, right: false } }, 16.67);
    expect(raceR.karts[0]!.boostTimer).toBeGreaterThan(0.5);
    expect(raceR.karts[0]!.speed).toBeGreaterThan(MAX_STRAIGHT_SPEED);
    expect(raceR.lastEvents.boostTriggered.some((b) => b.slot === 0)).toBe(true);
  });

  it('keeps karts inside cushioned track barriers and advances AI rivals cleanly across 3 laps', () => {
    const circuit = CIRCUITS['canyon-crest'];
    const race = createRaceState('canyon-crest', '1p', 99);
    for (let step = 0; step < 3200 && race.status === 'racing'; step += 1) {
      const k0 = race.karts[0]!;
      const ahead = sampleCircuitAtS(circuit, k0.s + 24);
      const desiredYaw = Math.atan2(ahead.x - k0.x, ahead.z - k0.z);
      let err = desiredYaw - k0.yaw;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      const input =
        err < -0.09
          ? { left: true, right: false }
          : err > 0.09
            ? { left: false, right: true }
            : { left: false, right: false };
      stepRaceState(race, { 0: input }, 25);

      const proj = projectOntoCircuit(circuit, k0.x, k0.z, k0.s);
      expect(Math.abs(proj.lat)).toBeLessThanOrEqual(circuit.wallHalfWidth + 0.5);
    }

    expect(race.status).toBe('finished');
    expect(race.karts[0]!.lap).toBe(TOTAL_LAPS + 1);
    expect(race.karts[0]!.bestLapMs).not.toBeNull();
    expect(race.karts[1]!.unwrappedS).toBeGreaterThan(circuit.totalLength * 2);
  });
});
