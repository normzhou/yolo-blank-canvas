import { describe, expect, it } from 'vitest';
import {
  AERO_DRAG_COEFF,
  AI_DECISION_INTERVAL_MS,
  ASPHALT_ROLLING_DRAG_N,
  CIRCUIT_LIST,
  CIRCUITS,
  createRaceState,
  cross2D,
  getKartCenterOfMass,
  getRecommendedSpeedAtS,
  KART_DRIVERS,
  KART_MASS_KG,
  KART_NOSE_OFFSET_M,
  KART_YAW_INERTIA,
  MAX_STRAIGHT_SPEED,
  MAX_TOTAL_THRUST_N,
  predictKartTrajectory,
  projectOntoCircuit,
  resolveElasticKartCollision,
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
      // Road boost pads restored on all 3 circuits (#390)
      expect(circuit.nodes.some((n) => n.hasBoostPad)).toBe(true);

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

    // 1-second trajectory predictor starts at the HEAD (front nose) of the kart and fades to alpha = 0!
    const kR = raceR.karts[0]!;
    const trajR = predictKartTrajectory(kR, circuit, 1.0, 16);
    const trajL = predictKartTrajectory(raceL.karts[0]!, circuit, 1.0, 16);
    expect(trajR.length).toBe(17);
    const expectedNoseX = kR.x + Math.sin(kR.yaw) * KART_NOSE_OFFSET_M;
    const expectedNoseZ = kR.z + Math.cos(kR.yaw) * KART_NOSE_OFFSET_M;
    expect(Math.hypot(trajR[0]!.x - expectedNoseX, trajR[0]!.z - expectedNoseZ)).toBeLessThan(0.05);
    expect(trajR[0]!.alpha).toBeGreaterThan(0.75);
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
    expect(maxSlip).toBeLessThan(25);
    expect(race.karts[0]!.lap).toBe(TOTAL_LAPS + 1);
    expect(race.karts[0]!.bestLapMs).not.toBeNull();
    expect(race.karts[1]!.unwrappedS).toBeGreaterThan(circuit.totalLength * 1.8);
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

  it('resolves off-center kart collisions perfectly elastically with exact conservation of linear momentum, angular momentum, and kinetic energy (#390)', () => {
    const race = createRaceState('sunset-loop', '1p', 5);
    const a = race.karts[0]!;
    const b = race.karts[1]!;

    // Scenario: Off-center angled PIT-maneuver impact!
    // Kart A at (10, 20), yaw = 0, cruising at (vx=0, vz=40), yawRate = 0.2
    // Kart B angled into A's rear-right corner at (12.2, 18.6), yaw = -0.55, moving fast left/forward (-18, 52), yawRate = -0.4
    a.x = 10.0;
    a.z = 20.0;
    a.yaw = 0;
    a.vx = 0;
    a.vz = 40;
    a.yawRate = 0.2;

    b.x = 12.15;
    b.z = 18.55;
    b.yaw = -0.55;
    b.vx = -18;
    b.vz = 52;
    b.yawRate = -0.4;

    const measureSystem = () => {
      const cA = getKartCenterOfMass(a);
      const cB = getKartCenterOfMass(b);
      const px = KART_MASS_KG * (a.vx + b.vx);
      const pz = KART_MASS_KG * (a.vz + b.vz);
      const lOrbital =
        cross2D(cA.x, cA.z, KART_MASS_KG * a.vx, KART_MASS_KG * a.vz) +
        cross2D(cB.x, cB.z, KART_MASS_KG * b.vx, KART_MASS_KG * b.vz);
      const lSpin = KART_YAW_INERTIA * (a.yawRate + b.yawRate);
      const ke =
        0.5 * KART_MASS_KG * (a.vx * a.vx + a.vz * a.vz + b.vx * b.vx + b.vz * b.vz) +
        0.5 * KART_YAW_INERTIA * (a.yawRate * a.yawRate + b.yawRate * b.yawRate);
      return { px, pz, lTotal: lOrbital + lSpin, ke };
    };

    const before = measureSystem();
    const prevOmegaA = a.yawRate;
    const prevOmegaB = b.yawRate;

    // Resolve elastic impulse without positional shift to test exact analytical conservation at contact instant
    const hit = resolveElasticKartCollision(a, b, false);
    expect(hit).toBe(true);

    const after = measureSystem();

    // 1. Exact Linear Momentum conservation (P_x, P_z)
    expect(after.px).toBeCloseTo(before.px, 6);
    expect(after.pz).toBeCloseTo(before.pz, 6);

    // 2. Exact Total Angular Momentum conservation (orbital + spin about world origin!)
    expect(after.lTotal).toBeCloseTo(before.lTotal, 5);

    // 3. Exact Kinetic Energy conservation (perfectly elastic e = 1.0!)
    expect(after.ke).toBeCloseTo(before.ke, 4);

    // 4. Off-center hit genuinely induces angular spin on both karts!
    expect(Math.abs(a.yawRate - prevOmegaA)).toBeGreaterThan(0.1);
    expect(Math.abs(b.yawRate - prevOmegaB)).toBeGreaterThan(0.1);
  });

  it('triggers a road boost pad surge when driving over a circuit boost strip (#390)', () => {
    const circuit = CIRCUITS['sunset-loop'];
    const padNode = circuit.nodes.find((n) => n.hasBoostPad)!;
    expect(padNode).toBeDefined();

    const race = createRaceState('sunset-loop', '1p', 19);
    const p1 = race.karts[0]!;
    // Place kart directly on the boost strip moving forward along track tangent
    p1.x = padNode.x + padNode.rx * padNode.boostLat;
    p1.z = padNode.z + padNode.rz * padNode.boostLat;
    p1.s = padNode.s;
    p1.lat = padNode.boostLat;
    p1.yaw = Math.atan2(padNode.tx, padNode.tz);
    p1.vx = Math.sin(p1.yaw) * 60;
    p1.vz = Math.cos(p1.yaw) * 60;
    p1.speed = 60;

    stepRaceState(race, { 0: { left: false, right: false } }, 16.67);
    expect(p1.boostKind).toBe('pad');
    expect(p1.boostTimer).toBeGreaterThan(0.9);
    expect(p1.speed).toBeGreaterThan(70);
    expect(race.lastEvents.boostTriggered.some((e) => e.slot === 0 && e.kind === 'pad')).toBe(true);
  });

  it('constrains CPU drivers to binary keyboard controls at max 2 actions/sec with staggered 0.5s decision clocks (#394)', () => {
    expect(AI_DECISION_INTERVAL_MS).toBe(500);
    const race = createRaceState('sunset-loop', '1p', 42);
    const cpus = race.karts.slice(1);
    expect(cpus.length).toBe(3);

    // 1. Staggered initial decision phases across the 500 ms window (never synchronized!)
    const phases = cpus.map((k) => k.aiNextDecisionMs % AI_DECISION_INTERVAL_MS);
    expect(Math.abs(phases[0]! - phases[1]!)).toBeGreaterThanOrEqual(80);
    expect(Math.abs(phases[1]! - phases[2]!)).toBeGreaterThanOrEqual(80);
    expect(Math.abs(phases[0]! - phases[2]!)).toBeGreaterThanOrEqual(80);

    const decisionTimes: number[][] = [[], [], []];
    const prevCounts = [0, 0, 0];

    // Step 10.0 seconds at 50 Hz (20 ms/step)
    for (let i = 0; i < 500; i += 1) {
      stepRaceState(race, { 0: { left: false, right: false } }, 20);
      for (let c = 0; c < cpus.length; c += 1) {
        const cpu = cpus[c]!;
        // Strictly binary steering: never pressing both left and right simultaneously, no steerAnalog
        expect(cpu.aiInput.left && cpu.aiInput.right).toBe(false);
        expect(typeof cpu.aiInput.brake).toBe('boolean');
        expect((cpu.aiInput as { steerAnalog?: unknown }).steerAnalog).toBeUndefined();

        if (cpu.aiDecisionCount > prevCounts[c]!) {
          prevCounts[c] = cpu.aiDecisionCount;
          decisionTimes[c]!.push(cpu.aiLastDecisionMs!);
        }
      }
    }

    // 2. Each CPU makes at most 20 decisions in 10 seconds (<= 2 actions/sec), spaced by ~500 ms
    for (let c = 0; c < cpus.length; c += 1) {
      const times = decisionTimes[c]!;
      expect(times.length).toBeGreaterThanOrEqual(19);
      expect(times.length).toBeLessThanOrEqual(20);
      for (let t = 1; t < times.length; t += 1) {
        const gap = times[t]! - times[t - 1]!;
        expect(gap).toBeGreaterThanOrEqual(480);
        expect(gap).toBeLessThanOrEqual(520);
      }
    }

    // 3. No two CPUs share synchronized decision timestamps
    expect(decisionTimes[0]![0]).not.toBe(decisionTimes[1]![0]);
    expect(decisionTimes[1]![0]).not.toBe(decisionTimes[2]![0]);
    expect(decisionTimes[0]![0]).not.toBe(decisionTimes[2]![0]);
  });
});
