import { describe, expect, it } from 'vitest';
import {
  AERO_DRAG_COEFF,
  ASPHALT_ROLLING_DRAG_N,
  CIRCUIT_LIST,
  CIRCUITS,
  createRaceState,
  getRecommendedSpeedAtS,
  KART_DRIVERS,
  KART_MASS_KG,
  MAX_STRAIGHT_SPEED,
  MAX_TOTAL_THRUST_N,
  predictKartTrajectory,
  projectOntoCircuit,
  sampleCircuitAtS,
  speedToColorHex,
  speedToColorRgb,
  stepRaceState,
  THRUSTER_RAMP_SEC,
  TOTAL_LAPS,
  VACUUM_ACCEL_TIME_SEC,
} from '../src/shared/microKart';
import { computeDriverPose } from '../src/games/micro-kart/driverPose';

describe('Micro Kart 3D circuits, 2s F1 dual-rocket physics, speed-colored road lines, 1s trajectory shadow & driver animations (#344, #362, #384, #386, #388)', () => {
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

  it('builds 3 seamless F1-scaled closed-loop 3D circuits with no extra boost pads and valid corner recommendedSpeed values', () => {
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
      // Pure dual-rocket design (#388): no extra road boost pads
      expect(circuit.nodes.some((n) => n.hasBoostPad)).toBe(false);

      // Recommended cornering speeds vary smoothly between tighter bends and straights
      const recSpeeds = circuit.nodes.map((n) => n.recommendedSpeed);
      expect(Math.min(...recSpeeds)).toBeLessThan(82);
      expect(Math.max(...recSpeeds)).toBeGreaterThan(95);
      expect(getRecommendedSpeedAtS(circuit, 0)).toBeGreaterThan(40);

      const p0 = sampleCircuitAtS(circuit, 0);
      const pEnd = sampleCircuitAtS(circuit, circuit.totalLength - 0.1);
      expect(Math.hypot(p0.x - pEnd.x, p0.z - pEnd.z)).toBeLessThan(2);
    }

    // Shared speed-to-color mapping covers full 0..100 m/s range cleanly
    expect(speedToColorHex(0)).toBe('#38e8ff');
    expect(speedToColorHex(100)).toBe('#ff5666');
    const midRgb = speedToColorRgb(72);
    expect(midRgb[0]).toBeGreaterThan(200);
    expect(midRgb[1]).toBeGreaterThan(180);
  });

  it('calibrates mass, dual-rocket force (2.0s vacuum to 360 km/h) and quadratic aero drag equilibrium at 100 m/s', () => {
    expect(VACUUM_ACCEL_TIME_SEC).toBe(2.0);
    // Vacuum check: F_max / m * 2.0s === 100 m/s (360 km/h F1 top speed)
    const vacuumSpeedAt2s = (MAX_TOTAL_THRUST_N / KART_MASS_KG) * VACUUM_ACCEL_TIME_SEC;
    expect(vacuumSpeedAt2s).toBeCloseTo(MAX_STRAIGHT_SPEED, 5);

    // Terminal velocity equilibrium: full dual thrust balances aero drag + asphalt rolling drag at 100 m/s
    const dragAtTop = AERO_DRAG_COEFF * MAX_STRAIGHT_SPEED * MAX_STRAIGHT_SPEED + ASPHALT_ROLLING_DRAG_N;
    expect(dragAtTop).toBeCloseTo(MAX_TOTAL_THRUST_N, 4);

    // Stronger 2.0s launch (~45 m/s in 1.0s) and crisp Down braking
    const race = createRaceState('sunset-loop', '1p', 42);
    const p1 = race.karts[0]!;
    expect(p1.speed).toBe(0);

    for (let i = 0; i < 60; i += 1) {
      stepRaceState(race, { 0: { left: false, right: false } }, 16.67);
    }
    const speedAt1s = p1.speed;
    expect(speedAt1s).toBeGreaterThan(40);
    expect(speedAt1s).toBeLessThan(50);
    expect(p1.braking).toBe(false);
    expect(p1.leftThrottle).toBeCloseTo(1, 3);
    expect(p1.rightThrottle).toBeCloseTo(1, 3);

    // Hold Down (`brake: true`) -> cuts both rockets quickly and decelerates strongly
    for (let i = 0; i < 25; i += 1) {
      stepRaceState(race, { 0: { left: false, right: false, brake: true } }, 16.67);
    }
    expect(p1.braking).toBe(true);
    expect(p1.leftThrottle).toBe(0);
    expect(p1.rightThrottle).toBe(0);
    expect(p1.speed).toBeLessThan(speedAt1s - 20);
  });

  it('ramps keyboard inner rocket linearly for PWM feathering, keeps planted cornering without extra boosters, and predicts a 1-second curved trajectory shadow', () => {
    const circuit = CIRCUITS['sunset-loop'];
    const raceL = createRaceState('sunset-loop', '1p', 7);
    const raceR = createRaceState('sunset-loop', '1p', 7);

    // Launch hands-off for 1.2s (~52 m/s)
    for (let i = 0; i < 72; i += 1) {
      stepRaceState(raceL, { 0: { left: false, right: false } }, 16.67);
      stepRaceState(raceR, { 0: { left: false, right: false } }, 16.67);
    }

    // Half-ramp -> inner rocket drops smoothly to ~50% (PWM feathering)
    const halfRampSteps = Math.round((THRUSTER_RAMP_SEC * 0.5) / 0.01667);
    for (let i = 0; i < halfRampSteps; i += 1) {
      stepRaceState(raceL, { 0: { left: true, right: false } }, 16.67);
      stepRaceState(raceR, { 0: { left: false, right: true } }, 16.67);
    }
    expect(raceR.karts[0]!.rightThrottle).toBeGreaterThan(0.35);
    expect(raceR.karts[0]!.rightThrottle).toBeLessThan(0.65);
    expect(raceR.karts[0]!.leftThrottle).toBeCloseTo(1, 3);

    // Finish full ramp -> 0% inner cut, planted cornering, zero extra drift turbo!
    for (let i = 0; i < 24; i += 1) {
      stepRaceState(raceL, { 0: { left: true, right: false } }, 16.67);
      stepRaceState(raceR, { 0: { left: false, right: true } }, 16.67);
    }
    expect(raceR.karts[0]!.rightThrottle).toBe(0);
    expect(raceL.karts[0]!.leftThrottle).toBe(0);
    expect(raceL.karts[0]!.yaw).toBeLessThan(raceR.karts[0]!.yaw);
    expect(raceL.karts[0]!.lat).toBeLessThan(raceR.karts[0]!.lat);
    expect(raceR.karts[0]!.boostTimer).toBe(0);

    // Releasing back to straight does NOT fire artificial drift boosters (#388)
    stepRaceState(raceR, { 0: { left: false, right: false } }, 16.67);
    expect(raceR.karts[0]!.boostTimer).toBe(0);
    expect(raceR.lastEvents.boostTriggered.length).toBe(0);

    // 1-second trajectory predictor curves smoothly along current steering and fades to alpha = 0!
    const trajR = predictKartTrajectory(raceR.karts[0]!, circuit, 1.0, 16);
    const trajL = predictKartTrajectory(raceL.karts[0]!, circuit, 1.0, 16);
    expect(trajR.length).toBe(17);
    expect(trajR[0]!.alpha).toBeGreaterThan(0.8);
    expect(trajR[8]!.alpha).toBeGreaterThan(0.1);
    expect(trajR[8]!.alpha).toBeLessThan(trajR[0]!.alpha);
    expect(trajR[16]!.alpha).toBe(0);
    // Turning left vs right predicts diverging spatial paths 1s ahead
    const endR = trajR[16]!;
    const endL = trajL[16]!;
    expect(Math.hypot(endR.x - endL.x, endR.z - endL.z)).toBeGreaterThan(20);

    // Analog steering (`steerAnalog = 0.45`) smoothly holds right rocket at 55%
    const raceAnalog = createRaceState('sunset-loop', '1p', 7);
    for (let i = 0; i < 12; i += 1) {
      stepRaceState(raceAnalog, { 0: { left: false, right: true, steerAnalog: 0.45 } }, 16.67);
    }
    expect(raceAnalog.karts[0]!.leftThrottle).toBeCloseTo(1, 2);
    expect(raceAnalog.karts[0]!.rightThrottle).toBeCloseTo(0.55, 2);
  });

  it('keeps karts planted inside track barriers and advances karts & AI rivals cleanly across 3 laps', () => {
    const circuit = CIRCUITS['canyon-crest'];
    const race = createRaceState('canyon-crest', '1p', 99);
    let maxSlip = 0;
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
      maxSlip = Math.max(maxSlip, Math.abs(k0.lateralSlip));
      const proj = projectOntoCircuit(circuit, k0.x, k0.z, k0.s);
      expect(Math.abs(proj.lat)).toBeLessThanOrEqual(circuit.wallHalfWidth + 0.5);
    }

    expect(race.status).toBe('finished');
    expect(maxSlip).toBeLessThan(8);
    expect(race.karts[0]!.lap).toBe(TOTAL_LAPS + 1);
    expect(race.karts[0]!.bestLapMs).not.toBeNull();
    expect(race.karts[1]!.unwrappedS).toBeGreaterThan(circuit.totalLength * 2.5);
  });

  it('animates driver corner lean, high-speed wind duck, and species-specific wind-blown ears from speed and yawRate (#386)', () => {
    const race = createRaceState('sunset-loop', '1p', 12);
    const fox = race.karts[0]!;
    const cat = race.karts[1]!;
    const dog = race.karts[2]!;
    const bunny = race.karts[3]!;

    const idleFox = computeDriverPose(fox, 0);
    expect(idleFox.aeroTuck).toBe(0);
    expect(Math.abs(idleFox.torsoRoll)).toBeLessThan(0.01);
    expect(Math.abs(idleFox.headDuckZ)).toBeLessThan(0.01);

    fox.speed = 70;
    fox.yawRate = -1.6;
    fox.leftThrottle = 0;
    fox.rightThrottle = 1;
    const leftTurn = computeDriverPose(fox, 100);

    fox.yawRate = 1.6;
    fox.leftThrottle = 1;
    fox.rightThrottle = 0;
    const rightTurn = computeDriverPose(fox, 100);

    expect(leftTurn.torsoRoll).toBeGreaterThan(0.2);
    expect(rightTurn.torsoRoll).toBeLessThan(-0.2);
    expect(leftTurn.torsoShiftX).toBeLessThan(-0.1);
    expect(rightTurn.torsoShiftX).toBeGreaterThan(0.1);
    expect(leftTurn.headYaw).toBeLessThan(-0.3);
    expect(rightTurn.headYaw).toBeGreaterThan(0.3);

    for (const k of [fox, cat, dog, bunny]) {
      k.speed = 98;
      k.yawRate = 0;
      k.leftThrottle = 1;
      k.rightThrottle = 1;
    }
    const fastFox = computeDriverPose(fox, 200);
    const fastCat = computeDriverPose(cat, 200);
    const fastDog = computeDriverPose(dog, 200);
    const fastBunny = computeDriverPose(bunny, 200);

    expect(fastFox.aeroTuck).toBeGreaterThan(0.9);
    expect(fastFox.torsoPitch).toBeGreaterThan(0.18);
    expect(fastFox.headDuckZ).toBeGreaterThan(0.12);
    expect(fastFox.headDuckY).toBeLessThan(-0.08);

    expect(fastFox.leftEarPitch).toBeLessThan(-0.5);
    expect(fastCat.leftEarPitch).toBeLessThan(-0.42);
    expect(fastBunny.leftEarPitch).toBeLessThan(-0.8);
    expect(fastDog.leftEarPitch).toBeGreaterThan(0.65);
  });
});
