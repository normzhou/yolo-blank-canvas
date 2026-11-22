import { describe, expect, it } from 'vitest';
import {
  AERO_DRAG_COEFF,
  AI_DECISION_MAX_MS,
  AI_DECISION_MIN_MS,
  ASPHALT_ROLLING_DRAG_N,
  CIRCUIT_LIST,
  CIRCUITS,
  createRaceState,
  cross2D,
  formatCircuitTitle,
  generateMarathonCycleOrder,
  getCircuit,
  getCircuitForKart,
  getKartCenterOfMass,
  getKartPortraitMood,
  getMarathonStage,
  getMarathonStageForKart,
  getNextCircuitId,
  getNextRaceStage,
  getRecommendedSpeedAtS,
  KART_DRIVERS,
  KART_MASS_KG,
  KART_NOSE_OFFSET_M,
  KART_YAW_INERTIA,
  MARATHON_CYCLE_STAGES,
  MAX_STRAIGHT_SPEED,
  MAX_TOTAL_THRUST_N,
  predictKartTrajectory,
  projectKartShadowForButtons,
  projectOntoCircuit,
  resolveElasticKartCollision,
  ROAD_BOOST_DURATION_SEC,
  ROAD_BOOST_FORCE_MULT,
  sampleCircuitAtS,
  speedToColorHex,
  speedToColorRgb,
  stepRaceState,
  THRUSTER_RAMP_SEC,
  TOTAL_LAPS,
  transformPoseThroughPortal,
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

  it('builds 4 seamless F1-scaled closed-loop 3D circuits including Cloud Gate with valid corner recommendedSpeed values', () => {
    expect(CIRCUIT_LIST.map((c) => c.id)).toEqual([
      'sunset-loop',
      'canyon-crest',
      'starlight-ring',
      'cloud-gate',
    ]);
    expect(getNextCircuitId('sunset-loop')).toBe('canyon-crest');
    expect(getNextCircuitId('canyon-crest')).toBe('starlight-ring');
    expect(getNextCircuitId('starlight-ring')).toBe('cloud-gate');
    expect(getNextCircuitId('cloud-gate')).toBe('sunset-loop');

    // Full 2x Grand Prix cycle (#410): 4 circuits Forward -> 4 circuits Reverse -> back to Forward!
    let stage: { circuitId: (typeof CIRCUIT_LIST)[number]['id']; reversed: boolean } = {
      circuitId: 'sunset-loop',
      reversed: false,
    };
    const fullCycle: string[] = [];
    for (let i = 0; i < CIRCUIT_LIST.length * 2; i += 1) {
      fullCycle.push(`${stage.circuitId}:${stage.reversed ? 'rev' : 'fwd'}`);
      stage = getNextRaceStage(stage.circuitId, stage.reversed);
    }
    expect(fullCycle).toEqual([
      'sunset-loop:fwd',
      'canyon-crest:fwd',
      'starlight-ring:fwd',
      'cloud-gate:fwd',
      'sunset-loop:rev',
      'canyon-crest:rev',
      'starlight-ring:rev',
      'cloud-gate:rev',
    ]);
    expect(stage).toEqual({ circuitId: 'sunset-loop', reversed: false });
    expect(formatCircuitTitle('sunset-loop', false)).toBe('Sunset Loop');
    expect(formatCircuitTitle('sunset-loop', true)).toBe('Sunset Loop ↺ Reverse');

    // Reversed Cloud Gate mirrors landmark ranges & drives cleanly in reverse physics (#410)
    const cgFwd = getCircuit('cloud-gate', false);
    const cgRev = getCircuit('cloud-gate', true);
    expect(cgRev.reversed).toBe(true);
    expect(cgRev.totalLength).toBeCloseTo(cgFwd.totalLength, 1);
    expect(cgRev.theme.moonGateSeg).toBe(192 - 46);
    expect(cgRev.theme.jadePoolRange).toEqual([192 - 96, 192 - 64]);
    expect(
      cgRev.nodes[0]!.tx * cgFwd.nodes[0]!.tx + cgRev.nodes[0]!.tz * cgFwd.nodes[0]!.tz,
    ).toBeLessThan(-0.98);
    const revRace = createRaceState('cloud-gate', '1p', 42, { reversed: true });
    expect(revRace.reversed).toBe(true);
    for (let step = 0; step < 90; step += 1) {
      stepRaceState(revRace, { 0: { left: false, right: false } }, 20);
    }
    expect(revRace.karts[0]!.unwrappedS).toBeGreaterThan(20);
    expect(Number.isFinite(revRace.karts[0]!.x)).toBe(true);

    // Portal Marathon endless 8-stage cycle, momentum-preserving portal warps, and progressive lap-out knockouts (#412)
    const stages = Array.from({ length: 10 }, (_, idx) => {
      const s = getMarathonStage(idx);
      return `${s.circuitId}:${s.reversed ? 'rev' : 'fwd'}`;
    });
    expect(stages).toEqual([
      'sunset-loop:fwd',
      'canyon-crest:fwd',
      'starlight-ring:fwd',
      'cloud-gate:fwd',
      'sunset-loop:rev',
      'canyon-crest:rev',
      'starlight-ring:rev',
      'cloud-gate:rev',
      'sunset-loop:fwd',
      'canyon-crest:fwd',
    ]);

    // Rigid gate-to-gate portal camera transform aligns the start/finish gates 1:1
    const c0 = getCircuit('sunset-loop', false);
    const c1 = getCircuit('canyon-crest', false);
    const g0 = c0.nodes[0]!;
    const g1 = c1.nodes[0]!;
    const h0 = Math.hypot(g0.tx, g0.tz);
    const h1 = Math.hypot(g1.tx, g1.tz);
    const transformed = transformPoseThroughPortal(
      {
        x: g0.x - (g0.tx / h0) * 10 + g0.rx * 3,
        y: g0.y + 4,
        z: g0.z - (g0.tz / h0) * 10 + g0.rz * 3,
        yaw: Math.atan2(g0.tx, g0.tz),
      },
      c0,
      c1,
    );
    expect(transformed.x).toBeCloseTo(g1.x - (g1.tx / h1) * 10 + g1.rx * 3, 5);
    expect(transformed.y).toBeCloseTo(g1.y + 4, 5);
    expect(transformed.z).toBeCloseTo(g1.z - (g1.tz / h1) * 10 + g1.rz * 3, 5);

    // 1) Per-kart shuffled 8-course cycles & momentum-preserving Portal warp (#412, #420)
    const race = createRaceState('sunset-loop', '1p', 7, { format: 'marathon' });
    expect(race.format).toBe('marathon');
    expect(race.survivorsCount).toBe(4);

    // Every kart starts on Track 1 (`sunset-loop:fwd`), every 8-stage Big Lap is a full permutation of all 8 stages,
    // and ZERO consecutive stages ever share the same physical `circuitId` (`1 -> 1'` / `4' -> 4` forbidden across ALL boundaries)!
    const perKartFirstCycleSigs: string[] = [];
    const bigLap2FirstChoices = new Set<string>();
    for (const k of race.karts) {
      const s0 = getMarathonStageForKart(race, k, 0);
      expect(s0).toEqual({ circuitId: 'sunset-loop', reversed: false });
      let prevId: string | null = null;
      for (let cycle = 0; cycle < 5; cycle += 1) {
        const seen = new Set<string>();
        for (let stepInCycle = 0; stepInCycle < 8; stepInCycle += 1) {
          const st = getMarathonStageForKart(race, k, cycle * 8 + stepInCycle);
          if (prevId !== null) {
            expect(st.circuitId).not.toBe(prevId);
          }
          seen.add(`${st.circuitId}:${st.reversed ? 'rev' : 'fwd'}`);
          prevId = st.circuitId;
        }
        expect(seen.size).toBe(8);
        if (cycle >= 1) {
          const firstOfCycle = getMarathonStageForKart(race, k, cycle * 8);
          bigLap2FirstChoices.add(`${firstOfCycle.circuitId}:${firstOfCycle.reversed ? 'rev' : 'fwd'}`);
        }
      }
      perKartFirstCycleSigs.push(
        k.marathonSchedule
          .slice(0, 8)
          .map((s) => `${s.circuitId}:${s.reversed ? 'r' : 'f'}`)
          .join(','),
      );
    }
    // Players receive distinct randomized shuffles, and Big Lap 2+ is NOT locked to Sunset Loop Forward!
    expect(new Set(perKartFirstCycleSigs).size).toBeGreaterThan(1);
    expect(bigLap2FirstChoices.size).toBeGreaterThan(2);

    // Drive P1 on autopilot through its first full lap -> warps seamlessly into P1's own shuffled Stage 1 (never same circuit!)
    const p1 = race.karts[0]!;
    const expectedNext = getMarathonStageForKart(race, p1, 1);
    expect(expectedNext.circuitId).not.toBe('sunset-loop');
    (p1 as { isHuman: boolean }).isHuman = false;
    let portalEvent: (typeof race.lastEvents.portalCrossed)[number] | null = null;
    let preSpeed = 0;
    for (let step = 0; step < 2200; step += 1) {
      const prevSpeed = p1.speed;
      stepRaceState(race, {}, 20);
      const hit = race.lastEvents.portalCrossed.find((e) => e.slot === 0);
      if (hit) {
        portalEvent = hit;
        preSpeed = prevSpeed;
        break;
      }
    }
    expect(portalEvent).not.toBeNull();
    expect(portalEvent!.fromStageIndex).toBe(0);
    expect(portalEvent!.toStageIndex).toBe(1);
    expect(portalEvent!.fromCircuitId).toBe('sunset-loop');
    expect(portalEvent!.toCircuitId).toBe(expectedNext.circuitId);
    expect(portalEvent!.toReversed).toBe(expectedNext.reversed);
    expect(p1.stageIndex).toBe(1);
    expect(getCircuitForKart(race, p1).id).toBe(expectedNext.circuitId);
    // Speed is preserved across the portal with zero reset!
    expect(p1.speed).toBeGreaterThan(preSpeed * 0.85);
    expect(p1.speed).toBeGreaterThan(45);

    // 2) True 4-physical-track Forward-vs-Reverse head-on collision (#418, #420):
    //    Explicitly set kart 0 on Canyon Crest Forward and kart 1 on Canyon Crest Reverse -> real head-on bounce!
    const headOnRace = createRaceState('sunset-loop', '1p', 11, { format: 'marathon' });
    const kFwd = headOnRace.karts[0]!;
    const kRev = headOnRace.karts[1]!;
    kFwd.marathonSchedule[1] = { circuitId: 'canyon-crest', reversed: false };
    kRev.marathonSchedule[5] = { circuitId: 'canyon-crest', reversed: true };
    kFwd.stageIndex = 1; // Canyon Crest Forward
    kRev.stageIndex = 5; // Canyon Crest Reverse (same physical map id!)
    const canyonFwd = getCircuitForKart(headOnRace, kFwd);
    const canyonRev = getCircuitForKart(headOnRace, kRev);
    expect(canyonFwd.id).toBe('canyon-crest');
    expect(canyonRev.id).toBe('canyon-crest');
    expect(canyonFwd.reversed).toBe(false);
    expect(canyonRev.reversed).toBe(true);
    const midFwd = sampleCircuitAtS(canyonFwd, canyonFwd.totalLength * 0.5);
    kFwd.x = midFwd.x - midFwd.tx * 1.1;
    kFwd.y = midFwd.y;
    kFwd.z = midFwd.z - midFwd.tz * 1.1;
    kFwd.yaw = midFwd.yaw;
    kFwd.vx = midFwd.tx * 60;
    kFwd.vz = midFwd.tz * 60;
    kFwd.speed = 60;
    kRev.x = midFwd.x + midFwd.tx * 1.1;
    kRev.y = midFwd.y;
    kRev.z = midFwd.z + midFwd.tz * 1.1;
    kRev.yaw = midFwd.yaw + Math.PI;
    kRev.vx = -midFwd.tx * 60;
    kRev.vz = -midFwd.tz * 60;
    kRev.speed = 60;
    stepRaceState(headOnRace, { 0: { left: false, right: false } }, 16);
    expect(headOnRace.lastEvents.bumped).toBe(true);

    // 3) True 8-stage full-cycle lapping knockout (#418):
    //    IMPOSSIBLE to lap anyone before completing a full 8-stage cycle (gap < 8.0 -> ZERO knockouts)!
    expect(MARATHON_CYCLE_STAGES).toBe(8);
    const koRace = createRaceState('sunset-loop', '1p', 9, { format: 'marathon' });
    const setStageProg = (slot: number, stageIdx: number, frac: number) => {
      const k = koRace.karts[slot]!;
      k.stageIndex = stageIdx;
      const c = getCircuitForKart(koRace, k);
      const pt = sampleCircuitAtS(c, frac * c.totalLength);
      k.x = pt.x;
      k.y = pt.y;
      k.z = pt.z;
      k.yaw = pt.yaw;
      k.vx = 0;
      k.vz = 0;
      k.speed = 0;
      k.stageStartUnwrappedS = stageIdx * 2000;
      k.unwrappedS = k.stageStartUnwrappedS + pt.s;
      k.s = pt.s;
      k.marathonProgress = stageIdx + frac;
    };

    // Leader at 7.5 stages ahead of slot 3 (NOT a full 8-stage cycle!) -> ZERO knockouts,
    // AND Portal Homing automatically activates & locks leader's next portal onto slot 3's track & direction (#422)!
    setStageProg(0, 7, 0.55);
    setStageProg(1, 5, 0.5);
    setStageProg(2, 3, 0.5);
    setStageProg(3, 0, 0.05);
    // Ensure leader (stage 7) is on a different circuit than slot 3 (stage 0 = Sunset Loop Forward)
    koRace.karts[0]!.marathonSchedule[7] = { circuitId: 'cloud-gate', reversed: true };
    koRace.karts[3]!.marathonSchedule[0] = { circuitId: 'sunset-loop', reversed: false };
    stepRaceState(koRace, { 0: { left: false, right: false } }, 1);
    expect(koRace.karts[3]!.eliminated).toBe(false);
    expect(koRace.survivorsCount).toBe(4);
    expect(koRace.status).toBe('racing');
    expect(koRace.marathonHunt).not.toBeNull();
    expect(koRace.marathonHunt!.hunterSlot).toBe(0);
    expect(koRace.marathonHunt!.preySlot).toBe(3);
    expect(koRace.marathonHunt!.onSameRoad).toBe(false);
    // Leader's next portal (stage 8) is now locked straight onto slot 3's exact track & direction!
    expect(getMarathonStageForKart(koRace, koRace.karts[0]!, 8)).toEqual({
      circuitId: 'sunset-loop',
      reversed: false,
    });

    // If leader reaches gap = 8.07 on a DIFFERENT circuit than slot 3 -> NOT prematurely knocked out!
    koRace.karts[0]!.marathonSchedule[8] = { circuitId: 'starlight-ring', reversed: false };
    setStageProg(0, 8, 0.12);
    stepRaceState(koRace, { 0: { left: false, right: false } }, 1);
    expect(koRace.karts[3]!.eliminated).toBe(false);

    // Once leader is PHYSICALLY on slot 3's exact track & direction (`sunset-loop:fwd`) and passes (gap >= 8.0) -> KO!
    koRace.karts[0]!.marathonSchedule[8] = { circuitId: 'sunset-loop', reversed: false };
    setStageProg(0, 8, 0.12);
    stepRaceState(koRace, { 0: { left: false, right: false } }, 1);
    expect(koRace.karts[3]!.eliminated).toBe(true);
    expect(koRace.karts[3]!.place).toBe(4);
    expect(koRace.survivorsCount).toBe(3);
    expect(koRace.status).toBe('racing');

    // Leader physically catches slot 2 on the same track & direction (gap >= 8.0) -> knocks out slot 2 in 3rd!
    const slot2Stage = getMarathonStageForKart(koRace, koRace.karts[2]!, 3);
    getMarathonStageForKart(koRace, koRace.karts[0]!, 11);
    koRace.karts[0]!.marathonSchedule[11] = slot2Stage;
    setStageProg(0, 11, 0.62);
    stepRaceState(koRace, { 0: { left: false, right: false } }, 1);
    expect(koRace.karts[2]!.eliminated).toBe(true);
    expect(koRace.karts[2]!.place).toBe(3);
    expect(koRace.survivorsCount).toBe(2);
    expect(koRace.status).toBe('racing');

    // Leader physically catches slot 1 on the same track & direction (gap >= 8.0) -> knocks out slot 1 in 2nd, slot 0 wins!
    const slot1Stage = getMarathonStageForKart(koRace, koRace.karts[1]!, 5);
    getMarathonStageForKart(koRace, koRace.karts[0]!, 13);
    koRace.karts[0]!.marathonSchedule[13] = slot1Stage;
    setStageProg(0, 13, 0.62);
    stepRaceState(koRace, { 0: { left: false, right: false } }, 1);
    expect(koRace.karts[1]!.eliminated).toBe(true);
    expect(koRace.karts[1]!.place).toBe(2);
    expect(koRace.survivorsCount).toBe(1);
    expect(koRace.status).toBe('finished');
    expect(koRace.winnerSlot).toBe(0);
    expect(koRace.karts[0]!.place).toBe(1);

    for (const circuit of CIRCUIT_LIST) {
      expect(circuit.totalLength).toBeGreaterThan(1500);
      expect(circuit.roadHalfWidth).toBeGreaterThanOrEqual(15.5);
      expect(circuit.nodes.length).toBe(192);
      const ys = circuit.nodes.map((n) => n.y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(10);
      // Road boost pads restored on all 4 circuits (#390, #402)
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

    // Cloud Gate specific Heavenly Palace cloud-scape properties (#402)
    const cloudGate = CIRCUITS['cloud-gate'];
    expect(cloudGate.theme.skyMode).toBe('cloud-sea');
    expect(cloudGate.theme.jadePoolRange).toEqual([64, 96]);
    expect(cloudGate.theme.cliffRange).toEqual([104, 132]);
    expect(cloudGate.theme.moonGateSeg).toBe(46);
    expect(cloudGate.scenery.some((p) => p.kind === 'cloud-bank')).toBe(true);
    expect(cloudGate.scenery.some((p) => p.kind === 'pavilion')).toBe(true);
    expect(cloudGate.scenery.some((p) => p.kind === 'jade-pillar')).toBe(true);
    expect(cloudGate.scenery.some((p) => p.kind === 'bonsai-pine')).toBe(true);
    const lotusCount = cloudGate.scenery.filter((p) => p.kind === 'lotus').length;
    expect(lotusCount).toBeGreaterThanOrEqual(6);
    expect(lotusCount).toBeLessThanOrEqual(16);

    // Live placement portrait emotions (#406): 1st = happy, last while racing = anxious, last at finish = cry
    expect(getKartPortraitMood(1, 4, false, false)).toBe('happy');
    expect(getKartPortraitMood(1, 4, true, true)).toBe('happy');
    expect(getKartPortraitMood(2, 4, false, false)).toBe('normal');
    expect(getKartPortraitMood(3, 4, true, true)).toBe('normal');
    expect(getKartPortraitMood(4, 4, false, false)).toBe('anxious');
    expect(getKartPortraitMood(4, 4, true, false)).toBe('cry');
    expect(getKartPortraitMood(4, 4, false, true)).toBe('cry');

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

  it('applies a pure +50% rocket booster force for 5.0s on road boost pads with zero instant velocity impulse (#390, #398)', () => {
    expect(ROAD_BOOST_FORCE_MULT).toBe(1.5);
    expect(ROAD_BOOST_DURATION_SEC).toBe(5.0);
    const circuit = CIRCUITS['sunset-loop'];
    const padNode = circuit.nodes.find((n) => n.hasBoostPad)!;
    expect(padNode).toBeDefined();

    const raceBoosted = createRaceState('sunset-loop', '1p', 19);
    const raceNormal = createRaceState('sunset-loop', '1p', 19);
    const kB = raceBoosted.karts[0]!;
    const kN = raceNormal.karts[0]!;

    // Place kB on the boost pad and kN on the same node offset off the pad at 55 m/s
    const yaw = Math.atan2(padNode.tx, padNode.tz);
    for (const [k, lat] of [
      [kB, padNode.boostLat],
      [kN, padNode.boostLat > 0 ? -6 : 6],
    ] as const) {
      k.x = padNode.x + padNode.rx * lat;
      k.z = padNode.z + padNode.rz * lat;
      k.s = padNode.s;
      k.lat = lat;
      k.yaw = yaw;
      k.vx = Math.sin(yaw) * 55;
      k.vz = Math.cos(yaw) * 55;
      k.speed = 55;
    }

    // 1. First tick over pad: NO instant velocity impulse (< 2 m/s delta in 16.67 ms!), sets 5.0s pad boost!
    stepRaceState(raceBoosted, { 0: { left: false, right: false } }, 16.67);
    stepRaceState(raceNormal, { 0: { left: false, right: false } }, 16.67);
    expect(kB.boostKind).toBe('pad');
    expect(kB.boostTimer).toBeCloseTo(5.0, 1);
    expect(kB.speed - 55).toBeLessThan(2.0);
    expect(raceBoosted.lastEvents.boostTriggered.some((e) => e.slot === 0 && e.kind === 'pad')).toBe(true);

    // 2. Over the next 1.0s, +50% rocket booster force smoothly accelerates kB significantly ahead of kN
    for (let i = 0; i < 60; i += 1) {
      stepRaceState(raceBoosted, { 0: { left: false, right: false } }, 16.67);
      stepRaceState(raceNormal, { 0: { left: false, right: false } }, 16.67);
    }
    expect(kB.boostTimer).toBeGreaterThan(3.8);
    expect(kB.speed).toBeGreaterThan(kN.speed + 10);
  });

  it('steers CPUs via worst-case-latency shadow projection closest to road center and checks track speed for braking (#398)', () => {
    const circuit = CIRCUITS['sunset-loop'];
    const race = createRaceState('sunset-loop', '1p', 7);
    const cpu = race.karts[1]!;

    // Place CPU right of centerline (`lat = +9m`) angled rightward (`+0.28 rad`) so Left pulls closest to center
    const straightNode = circuit.nodes.find((n) => Math.abs(n.curvature) < 0.002)!;
    const yaw = Math.atan2(straightNode.tx, straightNode.tz) + 0.28;
    cpu.x = straightNode.x + straightNode.rx * 9;
    cpu.z = straightNode.z + straightNode.rz * 9;
    cpu.s = straightNode.s;
    cpu.lat = 9;
    cpu.yaw = yaw;
    cpu.vx = Math.sin(yaw) * 70;
    cpu.vz = Math.cos(yaw) * 70;
    cpu.speed = 70;
    cpu.aiNextDecisionMs = 0;

    // Verify shadow projection confirms pressing Left lands closer to road center (`|lat|`) than Nothing or Right
    const leftProj = projectKartShadowForButtons(cpu, circuit, true, false, false, 0.4);
    const noneProj = projectKartShadowForButtons(cpu, circuit, false, false, false, 0.4);
    const rightProj = projectKartShadowForButtons(cpu, circuit, false, true, false, 0.4);
    expect(Math.abs(leftProj.lat)).toBeLessThan(Math.abs(noneProj.lat));
    expect(Math.abs(noneProj.lat)).toBeLessThan(Math.abs(rightProj.lat));

    stepRaceState(race, { 0: { left: false, right: false } }, 20);
    expect(cpu.aiInput.left).toBe(true);
    expect(cpu.aiInput.right).toBe(false);
    expect(cpu.aiInput.brake).toBe(false);

    // Overspeeding into a sharp corner (current speed >> track recommended speed) triggers independent brake!
    const sharpIdx = circuit.nodes.findIndex((n) => n.recommendedSpeed < 82);
    expect(sharpIdx).toBeGreaterThanOrEqual(0);
    const approachNode = circuit.nodes[(sharpIdx - 4 + circuit.nodes.length) % circuit.nodes.length]!;
    const aYaw = Math.atan2(approachNode.tx, approachNode.tz);
    cpu.x = approachNode.x;
    cpu.z = approachNode.z;
    cpu.s = approachNode.s;
    cpu.lat = 0;
    cpu.yaw = aYaw;
    cpu.vx = Math.sin(aYaw) * 98;
    cpu.vz = Math.cos(aYaw) * 98;
    cpu.speed = 98;
    cpu.aiNextDecisionMs = race.elapsedMs;

    stepRaceState(race, { 0: { left: false, right: false } }, 20);
    expect(cpu.aiInput.brake).toBe(true);
  });

  it('constrains CPU drivers to latched binary keyboard controls with randomized 200ms-400ms jittered decision intervals (#394, #396)', () => {
    expect(AI_DECISION_MIN_MS).toBe(200);
    expect(AI_DECISION_MAX_MS).toBe(400);
    const race = createRaceState('sunset-loop', '1p', 42);
    const cpus = race.karts.slice(1);
    expect(cpus.length).toBe(3);

    // 1. Staggered initial decision timestamps across rivals (never synchronized!)
    const initNext = cpus.map((k) => k.aiNextDecisionMs);
    expect(Math.abs(initNext[0]! - initNext[1]!)).toBeGreaterThanOrEqual(60);
    expect(Math.abs(initNext[1]! - initNext[2]!)).toBeGreaterThanOrEqual(60);

    const decisionTimes: number[][] = [[], [], []];
    const prevCounts = [0, 0, 0];
    const prevInputs = cpus.map((k) => ({ ...k.aiInput }));

    // Step 12.0 seconds at 50 Hz (20 ms/step)
    for (let i = 0; i < 600; i += 1) {
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
          prevInputs[c] = { ...cpu.aiInput };
        } else {
          // Whatever the CPU decided MUST stick unchanged until the next control event timestamp!
          expect(cpu.aiInput.left).toBe(prevInputs[c]!.left);
          expect(cpu.aiInput.right).toBe(prevInputs[c]!.right);
          expect(cpu.aiInput.brake).toBe(prevInputs[c]!.brake);
        }
      }
    }

    // 2. Every decision hold duration falls within [200, 400] ms (+ 20 ms tick quantization) with real jitter!
    for (let c = 0; c < cpus.length; c += 1) {
      const times = decisionTimes[c]!;
      expect(times.length).toBeGreaterThanOrEqual(30);
      const gaps: number[] = [];
      for (let t = 1; t < times.length; t += 1) {
        const gap = times[t]! - times[t - 1]!;
        expect(gap).toBeGreaterThanOrEqual(AI_DECISION_MIN_MS);
        expect(gap).toBeLessThanOrEqual(AI_DECISION_MAX_MS + 20);
        gaps.push(gap);
      }
      expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThanOrEqual(80);
    }

    // 3. Rival CPUs stay desynchronized
    expect(decisionTimes[0]![0]).not.toBe(decisionTimes[1]![0]);
    expect(decisionTimes[1]![0]).not.toBe(decisionTimes[2]![0]);
    expect(decisionTimes[0]![0]).not.toBe(decisionTimes[2]![0]);
  });
});
