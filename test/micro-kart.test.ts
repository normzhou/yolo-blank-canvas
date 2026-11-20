import { describe, expect, it } from 'vitest';
import {
  AERO_DRAG_COEFF,
  ASPHALT_ROLLING_DRAG_N,
  CIRCUIT_LIST,
  CIRCUITS,
  createRaceState,
  KART_DRIVERS,
  KART_MASS_KG,
  MAX_STRAIGHT_SPEED,
  MAX_TOTAL_THRUST_N,
  MINI_TURBO_CHARGE_SEC,
  projectOntoCircuit,
  sampleCircuitAtS,
  stepRaceState,
  THRUSTER_RAMP_SEC,
  TOTAL_LAPS,
  VACUUM_ACCEL_TIME_SEC,
} from '../src/shared/microKart';

describe('Micro Kart 3D circuits, F1 dual-thruster physics, PWM ramp, lateral slip & Starlight Burst drivers (#344, #358, #360, #362, #384)', () => {
  it('populates the 4 karts with the 4 Starlight Burst companions (Ren, Mochi, Koro, Momo) with no duplicates', () => {
    expect(KART_DRIVERS.map((d) => `${d.id}:${d.driverName}`)).toEqual([
      'fox:Ren',
      'cat:Mochi',
      'dog:Koro',
      'bunny:Momo',
    ]);
    const defaultRace = createRaceState('sunset-loop', '1p', 1);
    expect(defaultRace.karts.map((k) => k.character)).toEqual(['fox', 'cat', 'dog', 'bunny']);

    const bunnyLead = createRaceState('sunset-loop', '1p', 1, { p1Character: 'bunny' });
    expect(bunnyLead.karts[0]!.character).toBe('bunny');
    expect(bunnyLead.karts[0]!.name).toBe('Momo');
    expect(new Set(bunnyLead.karts.map((k) => k.character)).size).toBe(4);
  });

  it('builds 3 seamless F1-scaled closed-loop 3D circuits with elevation relief and boost pads', () => {
    expect(CIRCUIT_LIST.map((c) => c.id)).toEqual([
      'sunset-loop',
      'canyon-crest',
      'starlight-ring',
    ]);
    for (const circuit of CIRCUIT_LIST) {
      expect(circuit.totalLength).toBeGreaterThan(1500);
      expect(circuit.roadHalfWidth).toBeGreaterThanOrEqual(15.5);
      expect(circuit.nodes.length).toBe(192);
      const ys = circuit.nodes.map((n) => n.y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(10);
      expect(circuit.nodes.some((n) => n.hasBoostPad)).toBe(true);

      const p0 = sampleCircuitAtS(circuit, 0);
      const pEnd = sampleCircuitAtS(circuit, circuit.totalLength - 0.1);
      expect(Math.hypot(p0.x - pEnd.x, p0.z - pEnd.z)).toBeLessThan(2);
    }
  });

  it('calibrates mass, dual-thruster force (3s vacuum to 360 km/h) and quadratic aero drag equilibrium at 100 m/s', () => {
    // Vacuum check: F_max / m * 3.0s === 100 m/s (360 km/h F1 top speed)
    const vacuumSpeedAt3s = (MAX_TOTAL_THRUST_N / KART_MASS_KG) * VACUUM_ACCEL_TIME_SEC;
    expect(vacuumSpeedAt3s).toBeCloseTo(MAX_STRAIGHT_SPEED, 5);

    // Terminal velocity equilibrium: full dual thrust balances aero drag + asphalt rolling drag at 100 m/s
    const dragAtTop = AERO_DRAG_COEFF * MAX_STRAIGHT_SPEED * MAX_STRAIGHT_SPEED + ASPHALT_ROLLING_DRAG_N;
    expect(dragAtTop).toBeCloseTo(MAX_TOTAL_THRUST_N, 4);

    // Acceleration tapers realistically with quadratic aero drag (strong launch, slower top-end gain)
    const race = createRaceState('sunset-loop', '1p', 42);
    const p1 = race.karts[0]!;
    expect(p1.speed).toBe(0);

    for (let i = 0; i < 60; i += 1) {
      stepRaceState(race, { 0: { left: false, right: false } }, 16.67);
    }
    const speedAt1s = p1.speed;
    expect(speedAt1s).toBeGreaterThan(28);
    expect(speedAt1s).toBeLessThan(36);
    expect(p1.braking).toBe(false);
    expect(p1.leftThrottle).toBeCloseTo(1, 3);
    expect(p1.rightThrottle).toBeCloseTo(1, 3);

    // Hold Down (`brake: true`) -> cuts both thrusters quickly and decelerates strongly
    for (let i = 0; i < 25; i += 1) {
      stepRaceState(race, { 0: { left: false, right: false, brake: true } }, 16.67);
    }
    expect(p1.braking).toBe(true);
    expect(p1.leftThrottle).toBe(0);
    expect(p1.rightThrottle).toBe(0);
    expect(p1.speed).toBeLessThan(speedAt1s - 15);
  });

  it('ramps keyboard inner thruster linearly over 0.65s for PWM feathering, supports full cut and analog steer, induces moderate lateral slip, and fires Mini-Turbo on release', () => {
    const raceL = createRaceState('sunset-loop', '1p', 7);
    const raceR = createRaceState('sunset-loop', '1p', 7);

    // Launch hands-off for 1.5s so karts carry high speed (~45 m/s) into the corner
    for (let i = 0; i < 90; i += 1) {
      stepRaceState(raceL, { 0: { left: false, right: false } }, 16.67);
      stepRaceState(raceR, { 0: { left: false, right: false } }, 16.67);
    }

    // Half-ramp (~0.325s) -> inner thruster drops smoothly to ~50% (enabling keyboard PWM!)
    const halfRampSteps = Math.round((THRUSTER_RAMP_SEC * 0.5) / 0.01667);
    for (let i = 0; i < halfRampSteps; i += 1) {
      stepRaceState(raceL, { 0: { left: true, right: false } }, 16.67);
      stepRaceState(raceR, { 0: { left: false, right: true } }, 16.67);
    }
    expect(raceR.karts[0]!.rightThrottle).toBeGreaterThan(0.35);
    expect(raceR.karts[0]!.rightThrottle).toBeLessThan(0.65);
    expect(raceR.karts[0]!.leftThrottle).toBeCloseTo(1, 3);

    // Finish full ramp (>0.65s total) -> full 0% inner cut + real lateral slip + Mini-Turbo charge!
    for (let i = 0; i < 24; i += 1) {
      stepRaceState(raceL, { 0: { left: true, right: false } }, 16.67);
      stepRaceState(raceR, { 0: { left: false, right: true } }, 16.67);
    }
    expect(raceR.karts[0]!.rightThrottle).toBe(0);
    expect(raceL.karts[0]!.leftThrottle).toBe(0);
    expect(raceL.karts[0]!.yaw).toBeLessThan(raceR.karts[0]!.yaw);
    expect(raceL.karts[0]!.lat).toBeLessThan(raceR.karts[0]!.lat);
    expect(Math.abs(raceR.karts[0]!.lateralSlip)).toBeGreaterThan(1.5);
    expect(raceR.karts[0]!.driftCharge).toBeGreaterThanOrEqual(MINI_TURBO_CHARGE_SEC);
    expect(raceR.karts[0]!.skidMarks.length).toBeGreaterThan(0);

    // Release turn -> force-based Mini-Turbo surge!
    const speedBeforeBoost = raceR.karts[0]!.speed;
    stepRaceState(raceR, { 0: { left: false, right: false } }, 16.67);
    expect(raceR.karts[0]!.boostTimer).toBeGreaterThan(0.5);
    expect(raceR.karts[0]!.speed).toBeGreaterThan(speedBeforeBoost + 8);
    expect(raceR.lastEvents.boostTriggered.some((b) => b.slot === 0)).toBe(true);

    // Analog steering (`steerAnalog = 0.45`) smoothly holds right thruster at 55%
    const raceAnalog = createRaceState('sunset-loop', '1p', 7);
    for (let i = 0; i < 12; i += 1) {
      stepRaceState(raceAnalog, { 0: { left: false, right: true, steerAnalog: 0.45 } }, 16.67);
    }
    expect(raceAnalog.karts[0]!.leftThrottle).toBeCloseTo(1, 2);
    expect(raceAnalog.karts[0]!.rightThrottle).toBeCloseTo(0.55, 2);
  });

  it('keeps karts inside cushioned track barriers and advances karts & AI rivals cleanly across 3 laps', () => {
    const circuit = CIRCUITS['canyon-crest'];
    const race = createRaceState('canyon-crest', '1p', 99);
    for (let step = 0; step < 3600 && race.status === 'racing'; step += 1) {
      const k0 = race.karts[0]!;
      const lookahead = Math.min(44, 18 + k0.speed * 0.28);
      const ahead = sampleCircuitAtS(circuit, k0.s + lookahead);
      const desiredYaw = Math.atan2(ahead.x - k0.x, ahead.z - k0.z);
      let err = desiredYaw - k0.yaw;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      const steerAnalog = Math.max(-1, Math.min(1, err * 2.5 - k0.yawRate * 0.22));
      stepRaceState(
        race,
        {
          0: {
            left: steerAnalog < -0.15,
            right: steerAnalog > 0.15,
            steerAnalog,
          },
        },
        20,
      );

      const proj = projectOntoCircuit(circuit, k0.x, k0.z, k0.s);
      expect(Math.abs(proj.lat)).toBeLessThanOrEqual(circuit.wallHalfWidth + 0.5);
    }

    expect(race.status).toBe('finished');
    expect(race.karts[0]!.lap).toBe(TOTAL_LAPS + 1);
    expect(race.karts[0]!.bestLapMs).not.toBeNull();
    expect(race.karts[1]!.unwrappedS).toBeGreaterThan(circuit.totalLength * 2.5);
  });
});
