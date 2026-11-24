/**
 * Lightweight, pure speed- and angular-rate-driven character pose heuristics
 * for Micro Kart animal drivers (#386).
 *
 * Shared by both the primary static-VBO WebGL2 renderer and the Canvas 2D fallback:
 * - Tight turns (`kart.yawRate`) lean torso & head into the corner while pulling
 *   ears, scarf, and tail slightly outward under lateral G-force.
 * - High linear speed (`kart.speed` approaching 100 m/s / 360 km/h, or Turbo Boost)
 *   ducks the driver's torso and head forward & down to fight the rushing wind and
 *   sweeps species-specific ears back with playful high-speed flutter.
 */

import { getKartDriverSpec, MAX_STRAIGHT_SPEED, type KartState } from '../../shared/microKart';

export interface DriverPose {
  /** Normalized linear speed (`0 .. 1.35`, where `1.0` = 100 m/s / 360 km/h). */
  readonly speedRatio: number;
  /** Smoothly ramped high-speed aero tuck intensity (`0 .. 1.25`). */
  readonly aeroTuck: number;
  /** Signed cornering intensity (`-1.25` hard left .. `+1.25` hard right). */
  readonly turnLean: number;
  /** Torso lean roll in radians (`< 0` tilts right, `> 0` tilts left). */
  readonly torsoRoll: number;
  /** Torso forward wind-duck pitch in radians (`> 0` leans forward toward `+z`). */
  readonly torsoPitch: number;
  /** Torso lateral weight shift in meters (`+x` right, `-x` left). */
  readonly torsoShiftX: number;
  /** Head look-into-turn yaw in radians (`+` looks right, `-` looks left). */
  readonly headYaw: number;
  /** Extra head corner roll in radians (`< 0` tilts right, `> 0` tilts left). */
  readonly headRoll: number;
  /** Head forward wind-duck / braking pitch in radians (`> 0` ducks nose down/forward). */
  readonly headPitch: number;
  /** Head forward wind-duck translation in kart-local meters (`+z` forward). */
  readonly headDuckZ: number;
  /** Head downward wind-duck translation in kart-local meters (`< 0` crouches down). */
  readonly headDuckY: number;
  /** Head lateral shift riding atop the leaning torso (`+x` right, `-x` left). */
  readonly headShiftX: number;
  /**
   * Articulated left/right ear blowback pitch in radians (in head-local frame).
   * - Upright ears (`fox`, `cat`, `bunny`): `< 0` sweeps ear tips backward (`-z`).
   * - Downward floppy ears (`dog`): `> 0` sweeps hanging ear tips backward (`-z`).
   */
  readonly leftEarPitch: number;
  readonly rightEarPitch: number;
  /** Outward centrifugal ear tilt in radians during tight turns. */
  readonly leftEarRoll: number;
  readonly rightEarRoll: number;
  /** Normalized wind blowback factor (`0 .. 1.3`) for Canvas 2D procedural ears & scarf. */
  readonly earWindRatio: number;
  /** Scarf & tail wind/centrifugal motion. */
  readonly scarfYaw: number;
  readonly scarfPitch: number;
  readonly tailYaw: number;
  readonly tailPitch: number;
  readonly tailHop: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function computeDriverPose(kart: KartState, timeMs: number): DriverPose {
  const speedRatio = clamp(kart.speed / MAX_STRAIGHT_SPEED, 0, 1.35);
  const isBoosting = kart.boostTimer > 0;

  // Combine real angular velocity (`yawRate`) with differential throttle intent so corner
  // lean starts briskly on turn-in and deepens naturally in sustained high-G hairpins.
  const yawNorm = clamp(kart.yawRate / 1.7, -1.25, 1.25);
  const diffSteer = clamp(kart.leftThrottle - kart.rightThrottle, -1, 1);
  const turnLean = clamp(yawNorm * 0.78 + diffSteer * 0.35, -1.25, 1.25);

  // High-speed aero tuck kicks in smoothly above ~40% top speed and deepens during boost!
  const aeroTuck = clamp(
    smoothstep(0.38, 1.0, speedRatio) + (isBoosting ? 0.28 : 0),
    0,
    1.25,
  );
  // Braking deceleration pitches the driver subtly forward into the wheel
  const brakeLurch = kart.braking ? clamp(kart.speed / 55, 0, 1) * 0.22 : 0;

  // 1. Torso lean & forward aero tuck (pivoted near seat base)
  const torsoRoll = -turnLean * 0.24;
  const torsoPitch = aeroTuck * 0.22 + brakeLurch * 0.65;
  const torsoShiftX = turnLean * 0.13;

  // 2. Head look-into-turn + wind duck forward & down behind the nose
  const headBob = Math.sin(timeMs * 0.013 + kart.slot * 1.3) * (0.025 + speedRatio * 0.015);
  const headYaw = turnLean * 0.34;
  const headRoll = -turnLean * 0.22;
  const headPitch = aeroTuck * 0.24 + brakeLurch * 0.85 + headBob;
  const headDuckZ = aeroTuck * 0.15 + brakeLurch * 0.08;
  const headDuckY = -aeroTuck * 0.095 - brakeLurch * 0.035;
  const headShiftX = turnLean * 0.19;

  // 3. Wind-blown ears (speed + boost blowback + lively flutter + outward centrifugal G tilt!)
  const earWindRatio = clamp(
    smoothstep(0.22, 1.0, speedRatio) + (isBoosting ? 0.3 : 0),
    0,
    1.3,
  );
  const flutterFreq = 0.02 + speedRatio * 0.026 + (isBoosting ? 0.01 : 0);
  const flutterAmp = 0.03 + earWindRatio * 0.075;
  const flutterL = Math.sin(timeMs * flutterFreq + kart.slot * 1.7) * flutterAmp;
  const flutterR = Math.sin(timeMs * flutterFreq + kart.slot * 1.7 + 0.9) * flutterAmp;

  // Centrifugal force pulls ear tips slightly outward opposite the turn direction!
  // Remember: +roll tilts upward (+y) tips toward -x (LEFT), which is outward on a RIGHT turn (+turnLean).
  const centrifugalRoll = turnLean * 0.24;

  let leftEarPitch: number;
  let rightEarPitch: number;
  let leftEarRoll = centrifugalRoll + flutterL * 0.35;
  let rightEarRoll = centrifugalRoll - flutterR * 0.35;

  const species = getKartDriverSpec(kart.character).species;
  if (species === 'bunny') {
    // Tall left bunny ear streams dramatically back (~62 deg max!); folded right ear sweeps ~44 deg!
    leftEarPitch = -(0.06 + earWindRatio * 0.86) + flutterL;
    rightEarPitch = -(0.04 + earWindRatio * 0.62) + flutterR;
  } else if (species === 'dog') {
    // Downward floppy puppy ears: +pitch rotates negative-Y ear tips BACKWARD (-z) in the wind!
    leftEarPitch = 0.06 + earWindRatio * 0.72 + flutterL * 1.25;
    rightEarPitch = 0.06 + earWindRatio * 0.72 + flutterR * 1.25;
    // Flip centrifugal roll sign for downward-hanging ears so tips still swing outward!
    leftEarRoll = -centrifugalRoll - 0.08 * earWindRatio + flutterL * 0.45;
    rightEarRoll = -centrifugalRoll + 0.08 * earWindRatio - flutterR * 0.45;
  } else if (species === 'fox') {
    // Leaf-curved fox ears sweep sleekly back (~42 deg max)
    leftEarPitch = -(0.04 + earWindRatio * 0.58) + flutterL * 0.75;
    rightEarPitch = -(0.04 + earWindRatio * 0.58) + flutterR * 0.75;
  } else {
    // Perky cat ears pin back sleekly (~36 deg max)
    leftEarPitch = -(0.03 + earWindRatio * 0.5) + flutterL * 0.65;
    rightEarPitch = -(0.03 + earWindRatio * 0.5) + flutterR * 0.65;
  }

  // 4. Scarf & tail react to wind speed and cornering G-force
  const scarfFlutter =
    Math.sin(timeMs * (0.017 + speedRatio * 0.015) + kart.slot) * (0.06 + speedRatio * 0.16);
  const scarfYaw = scarfFlutter - turnLean * 0.32;
  const scarfPitch = 0.08 + speedRatio * 0.22 + (isBoosting ? 0.12 : 0);

  const wagFreq = species === 'dog' ? (isBoosting ? 0.036 : 0.018) : 0.011;
  const tailYaw =
    Math.sin(timeMs * wagFreq + kart.slot) * (species === 'dog' ? 0.28 : 0.16) -
    turnLean * 0.4;
  const tailPitch = -aeroTuck * 0.24;
  const tailHop =
    species === 'bunny' ? Math.abs(Math.sin(timeMs * 0.018 + kart.slot)) * 0.06 : 0;

  return {
    speedRatio,
    aeroTuck,
    turnLean,
    torsoRoll,
    torsoPitch,
    torsoShiftX,
    headYaw,
    headRoll,
    headPitch,
    headDuckZ,
    headDuckY,
    headShiftX,
    leftEarPitch,
    rightEarPitch,
    leftEarRoll,
    rightEarRoll,
    earWindRatio,
    scarfYaw,
    scarfPitch,
    tailYaw,
    tailPitch,
    tailHop,
  };
}
