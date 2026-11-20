/**
 * Sculpted Faceted Low-Poly 3D Animal Drivers for Micro Kart (#362).
 *
 * Brings the four Starlight Burst companions into true 360° 3D open-cockpit karts:
 * - `fox` (`Ren`): Cinnamon-amber plush head + fluffy cheek tufts, wide dark-tipped
 *   pointed fox ears, cobalt slipstream scarf, and snow-tipped fluffy brush tail.
 * - `cat` (`Mochi`): Orchid-lavender plush head, perked rose-lined cat ears, sculpted
 *   3D rose satin ear bow + gold bell, side whiskers, and upright swaying S-curve tail.
 * - `dog` (`Koro`): Sunny Shiba-gold plush head, 2-segment bouncy amber floppy ears,
 *   sporty cobalt bandana, and perky upward-curled wagging Shiba tail.
 * - `bunny` (`Momo`): Sweet berry-rose plush head, tall 2-segment aerodynamically
 *   streaming bunny ears with golden inner facets + golden bow, and round snow-white
 *   cotton pom-pom tail.
 */

import {
  getKartDriverSpec,
  type KartState,
} from '../../shared/microKart';

export interface DriverPt3 {
  x: number;
  y: number;
  z: number;
}

export type PushPolyFn = (
  worldVerts: readonly DriverPt3[],
  rgb: readonly [number, number, number],
  depthBias?: number,
  emissive?: boolean,
) => void;

export type KartSpaceTransform = (lx: number, ly: number, lz: number) => DriverPt3;

/**
 * Emits a 4-sided pyramid from base quad `[b0, b1, b2, b3]` to `apex`.
 */
function emitPyramid(
  pushPoly: PushPolyFn,
  b0: DriverPt3,
  b1: DriverPt3,
  b2: DriverPt3,
  b3: DriverPt3,
  apex: DriverPt3,
  rgb: readonly [number, number, number],
  bias = -0.4,
): void {
  pushPoly([b0, b1, apex], rgb, bias);
  pushPoly([b1, b2, apex], rgb, bias);
  pushPoly([b2, b3, apex], rgb, bias);
  pushPoly([b3, b0, apex], rgb, bias);
}

/**
 * Emits a tapered 3D tube segment connecting two 4-point rings (`r0` -> `r1`).
 */
function emitTubeSegment(
  pushPoly: PushPolyFn,
  xf: KartSpaceTransform,
  c0: readonly [number, number, number],
  w0: number,
  h0: number,
  c1: readonly [number, number, number],
  w1: number,
  h1: number,
  topRgb: readonly [number, number, number],
  bottomRgb: readonly [number, number, number],
  bias = -0.4,
): void {
  const a0 = xf(c0[0] - w0, c0[1], c0[2]);
  const a1 = xf(c0[0], c0[1] + h0, c0[2]);
  const a2 = xf(c0[0] + w0, c0[1], c0[2]);
  const a3 = xf(c0[0], c0[1] - h0, c0[2]);

  const b0 = xf(c1[0] - w1, c1[1], c1[2]);
  const b1 = xf(c1[0], c1[1] + h1, c1[2]);
  const b2 = xf(c1[0] + w1, c1[1], c1[2]);
  const b3 = xf(c1[0], c1[1] - h1, c1[2]);

  pushPoly([a0, a1, b1, b0], topRgb, bias);
  pushPoly([a1, a2, b2, b1], topRgb, bias);
  pushPoly([a2, a3, b3, b2], bottomRgb, bias);
  pushPoly([a3, a0, b0, b3], bottomRgb, bias);
}

/**
 * Emits a sculpted 10-sided faceted low-poly plush animal head centered at `(0, 1.24, -0.14)`
 * with dynamic cornering `headYaw` & `headRoll`, cream muzzle/cheeks, dark button nose,
 * expressive eyes, and wraparound forehead aviator racing goggles.
 */
function makeHeadTransform(
  kartXf: KartSpaceTransform,
  headYaw: number,
  headRoll: number,
  headPitch: number,
): KartSpaceTransform {
  const pivotX = 0;
  const pivotY = 1.23;
  const pivotZ = -0.14;
  const cy = Math.cos(headYaw);
  const sy = Math.sin(headYaw);
  const cr = Math.cos(headRoll);
  const sr = Math.sin(headRoll);
  const cp = Math.cos(headPitch);
  const sp = Math.sin(headPitch);

  return (hx, hy, hz) => {
    // Roll -> Pitch -> Yaw in head-local coordinates
    const x1 = hx * cr - hy * sr;
    const y1 = hx * sr + hy * cr;
    const z1 = hz;

    const x2 = x1;
    const y2 = y1 * cp - z1 * sp;
    const z2 = y1 * sp + z1 * cp;

    const x3 = x2 * cy + z2 * sy;
    const y3 = y2;
    const z3 = -x2 * sy + z2 * cy;

    return kartXf(pivotX + x3, pivotY + y3, pivotZ + z3);
  };
}

export function emitAnimalDriverMesh(
  pushPoly: PushPolyFn,
  kartXf: KartSpaceTransform,
  kart: KartState,
  timeMs: number,
): void {
  const spec = getKartDriverSpec(kart.character);
  const diffSteer = kart.leftThrottle - kart.rightThrottle;
  const steerDir =
    Math.abs(diffSteer) > 0.04
      ? Math.max(-1, Math.min(1, diffSteer))
      : kart.driftDir;

  // Dynamic head look-into-turn & joyful speed nod
  const speedRatio = Math.min(1.28, kart.speed / 100);
  const headYaw = steerDir * 0.3;
  const headRoll = -steerDir * 0.16;
  const headPitch = (kart.braking ? 0.12 : -0.04 * speedRatio) + Math.sin(timeMs * 0.012 + kart.slot) * 0.025;
  const hxf = makeHeadTransform(kartXf, headYaw, headRoll, headPitch);

  const darkCharcoal: [number, number, number] = [24, 28, 38];
  const goggleCyan: [number, number, number] = [96, 232, 255];
  const goggleRim: [number, number, number] = [248, 212, 76];

  // 1. Open-Cockpit Steering Column, Racing Wheel & Driver Torso + Paws
  const steerWheelRoll = -steerDir * 0.48;
  const swCos = Math.cos(steerWheelRoll);
  const swSin = Math.sin(steerWheelRoll);
  // Plush torso in seat (`z = -0.18`, `y = 0.56 .. 0.96`)
  emitTubeSegment(
    pushPoly,
    kartXf,
    [0, 0.56, -0.2],
    0.34,
    0.26,
    [0, 0.95, -0.16],
    0.29,
    0.23,
    spec.furPrimary,
    spec.furCream,
    -0.4,
  );
  // Neck scarf / satin collar ring (`y = 0.94 .. 1.03`)
  emitTubeSegment(
    pushPoly,
    kartXf,
    [0, 0.92, -0.15],
    0.33,
    0.26,
    [0, 1.01, -0.15],
    0.31,
    0.25,
    spec.scarfRgb,
    spec.scarfRgb,
    -0.42,
  );

  // Fluttering twin 3D scarf tails streaming behind the neck in the wind!
  const windAmp = 0.04 + speedRatio * 0.11;
  for (const side of [-1, 1] as const) {
    const wave1 = Math.sin(timeMs * 0.016 + side * 0.9 + kart.slot) * windAmp;
    const wave2 = Math.sin(timeMs * 0.016 - 1.1 + side * 0.9 + kart.slot) * windAmp * 1.5;
    const sx0 = side * 0.13;
    const s0L = kartXf(sx0 - 0.07, 0.96, -0.36);
    const s0R = kartXf(sx0 + 0.07, 0.96, -0.36);
    const s1L = kartXf(sx0 * 1.35 + wave1 - 0.065, 0.93 + speedRatio * 0.05, -0.72);
    const s1R = kartXf(sx0 * 1.35 + wave1 + 0.065, 0.93 + speedRatio * 0.05, -0.72);
    const sTip = kartXf(sx0 * 1.6 + wave2, 0.89 + speedRatio * 0.08, -1.08 - speedRatio * 0.16);
    pushPoly([s0L, s0R, s1R, s1L], spec.scarfRgb, -0.43);
    pushPoly([s1L, s1R, sTip], spec.scarfRgb, -0.43);
  }

  // Steering wheel disc (`z = +0.28`, `y = 0.86`) + cute paws gripping left/right rim
  const swR = 0.22;
  const swPts: DriverPt3[] = [];
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2 + steerWheelRoll;
    swPts.push(kartXf(Math.cos(a) * swR, 0.86 + Math.sin(a) * swR * 0.85, 0.28 - Math.sin(a) * 0.08));
  }
  pushPoly(swPts, darkCharcoal, -0.41);
  for (const side of [-1, 1] as const) {
    const px = side * swR * swCos;
    const py = 0.86 + side * swR * swSin * 0.85;
    // Arm from shoulder to paw on steering wheel
    const shL = kartXf(side * 0.26, 0.88, -0.1);
    const shU = kartXf(side * 0.26, 0.96, -0.1);
    const pwU = kartXf(px, py + 0.05, 0.26);
    const pwL = kartXf(px, py - 0.05, 0.26);
    pushPoly([shL, shU, pwU, pwL], spec.furPrimary, -0.41);
  }

  // 2. Organic 10-Gon Faceted Low-Poly Plush Head Sphere (`rx=0.43, ry=0.38, rz=0.40`)
  const SEG = 10;
  const rings: ReadonlyArray<{ y: number; rScale: number }> = [
    { y: -0.31, rScale: 0.62 },
    { y: -0.12, rScale: 0.98 },
    { y: 0.12, rScale: 1.0 },
    { y: 0.3, rScale: 0.72 },
  ];
  const rxH = 0.44;
  const rzH = 0.4;
  const ringPts: DriverPt3[][] = rings.map((rg) =>
    Array.from({ length: SEG }, (_, i) => {
      const th = (i / SEG) * Math.PI * 2; // th = 0 -> +z (front face!), th = pi -> -z (back of head!)
      return hxf(
        Math.sin(th) * rxH * rg.rScale,
        rg.y,
        Math.cos(th) * rzH * rg.rScale,
      );
    }),
  );
  const topPole = hxf(0, 0.39, -0.02);

  for (let r = 0; r < rings.length - 1; r += 1) {
    const cur = ringPts[r]!;
    const nxt = ringPts[r + 1]!;
    for (let i = 0; i < SEG; i += 1) {
      const i1 = (i + 1) % SEG;
      const midTh = ((i + 0.5) / SEG) * Math.PI * 2;
      // Lower-front cheek & muzzle facets get soft cream fur!
      const isCreamMuzzle = r === 0 && Math.cos(midTh) > 0.25;
      pushPoly(
        [cur[i]!, cur[i1]!, nxt[i1]!, nxt[i]!],
        isCreamMuzzle ? spec.furCream : spec.furPrimary,
        -0.4,
      );
    }
  }
  const topRing = ringPts[rings.length - 1]!;
  for (let i = 0; i < SEG; i += 1) {
    pushPoly([topRing[i]!, topRing[(i + 1) % SEG]!, topPole], spec.furPrimary, -0.4);
  }

  // 3. 360° Aviator Goggle Strap around the head + Forehead Goggle Lenses (visible from front, side & rear!)
  for (let i = 0; i < SEG; i += 1) {
    const th0 = (i / SEG) * Math.PI * 2;
    const th1 = ((i + 1) / SEG) * Math.PI * 2;
    const g0 = hxf(Math.sin(th0) * rxH * 0.99, 0.14, Math.cos(th0) * rzH * 0.99);
    const g1 = hxf(Math.sin(th1) * rxH * 0.99, 0.14, Math.cos(th1) * rzH * 0.99);
    const g2 = hxf(Math.sin(th1) * rxH * 0.95, 0.21, Math.cos(th1) * rzH * 0.95);
    const g3 = hxf(Math.sin(th0) * rxH * 0.95, 0.21, Math.cos(th0) * rzH * 0.95);
    pushPoly([g0, g1, g2, g3], darkCharcoal, -0.42);
  }
  // Twin Forehead Goggle Cups (`z = +0.36`, `y = 0.16..0.28`)
  for (const side of [-1, 1] as const) {
    const gx = side * 0.17;
    pushPoly(
      [
        hxf(gx - 0.12, 0.14, 0.36),
        hxf(gx + 0.12, 0.14, 0.36),
        hxf(gx + 0.11, 0.28, 0.33),
        hxf(gx - 0.11, 0.28, 0.33),
      ],
      goggleRim,
      -0.43,
    );
    pushPoly(
      [
        hxf(gx - 0.09, 0.16, 0.38),
        hxf(gx + 0.09, 0.16, 0.38),
        hxf(gx + 0.08, 0.26, 0.35),
        hxf(gx - 0.08, 0.26, 0.35),
      ],
      goggleCyan,
      -0.45,
      true,
    );
  }

  // 4. Expressive 3D Snout, Button Nose, Eyes & Rosy Cheeks (visible from side/overtake/turntable!)
  const snoutLen = kart.character === 'fox' || kart.character === 'dog' ? 0.53 : 0.44;
  emitPyramid(
    pushPoly,
    hxf(-0.15, -0.16, 0.36),
    hxf(0.15, -0.16, 0.36),
    hxf(0.13, -0.01, 0.36),
    hxf(-0.13, -0.01, 0.36),
    hxf(0, -0.07, snoutLen),
    spec.furCream,
    -0.42,
  );
  // Cute nose button at tip of snout
  pushPoly(
    [
      hxf(-0.045, -0.05, snoutLen + 0.01),
      hxf(0.045, -0.05, snoutLen + 0.01),
      hxf(0, -0.1, snoutLen + 0.01),
    ],
    kart.character === 'cat' || kart.character === 'bunny' ? [244, 92, 132] : darkCharcoal,
    -0.45,
  );
  // Expressive eyes + bright white eye-shine glint + rosy cheeks on front-side temples
  for (const side of [-1, 1] as const) {
    const ex = side * 0.19;
    pushPoly(
      [
        hxf(ex - 0.058, -0.035, 0.385),
        hxf(ex + 0.058, -0.035, 0.385),
        hxf(ex + 0.054, 0.095, 0.395),
        hxf(ex - 0.054, 0.095, 0.395),
      ],
      darkCharcoal,
      -0.44,
    );
    // Crisp white eye-shine sparkle in upper-outer corner of each eye!
    pushPoly(
      [
        hxf(ex - 0.042, 0.035, 0.402),
        hxf(ex - 0.004, 0.035, 0.402),
        hxf(ex - 0.004, 0.082, 0.405),
        hxf(ex - 0.042, 0.082, 0.405),
      ],
      [255, 255, 255],
      -0.46,
      true,
    );
    // Rosy cheek oval
    pushPoly(
      [
        hxf(side * 0.28 - 0.055, -0.11, 0.33),
        hxf(side * 0.28 + 0.055, -0.11, 0.33),
        hxf(side * 0.28, -0.045, 0.34),
      ],
      [248, 113, 133],
      -0.44,
    );
  }

  // 5. Species-Specific 3D Ears, Accessories & Animated Rear Tails!
  if (kart.character === 'fox') {
    // Wide-set pointed Fox Ears with dark charcoal tips + fluffy side cheek tufts!
    for (const side of [-1, 1] as const) {
      const b0 = hxf(side * 0.15, 0.28, -0.08);
      const b1 = hxf(side * 0.38, 0.2, -0.08);
      const b2 = hxf(side * 0.36, 0.22, 0.1);
      const b3 = hxf(side * 0.15, 0.3, 0.08);
      const mid0 = hxf(side * 0.28, 0.56, -0.05);
      const mid1 = hxf(side * 0.46, 0.51, -0.04);
      const mid2 = hxf(side * 0.44, 0.52, 0.05);
      const mid3 = hxf(side * 0.28, 0.57, 0.04);
      const tip = hxf(side * 0.49, 0.82, -0.01);

      pushPoly([b0, b1, mid1, mid0], spec.furPrimary, -0.41);
      pushPoly([b1, b2, mid2, mid1], spec.furPrimary, -0.41);
      pushPoly([b2, b3, mid3, mid2], spec.furCream, -0.42);
      pushPoly([b3, b0, mid0, mid3], spec.furPrimary, -0.41);
      emitPyramid(pushPoly, mid0, mid1, mid2, mid3, tip, spec.furSecondary, -0.42);

      // Fluffy Fox Cheek Tufts (`x = ±0.57`, visible from directly behind!)
      emitPyramid(
        pushPoly,
        hxf(side * 0.38, -0.18, -0.08),
        hxf(side * 0.38, -0.02, -0.08),
        hxf(side * 0.38, -0.02, 0.1),
        hxf(side * 0.38, -0.18, 0.1),
        hxf(side * 0.58, -0.11, -0.02),
        spec.furCream,
        -0.41,
      );
    }

    // Sweeping Upward-Arcing Fox Brush Tail (`+0.24` jaunty side-plume so BOTH cinnamon base & snow-white tip shine from behind!)
    const sway = 0.22 + Math.sin(timeMs * 0.008 + kart.slot) * 0.14 - kart.driftYaw * 0.65;
    const midX = sway * 0.72;
    const tipX = sway * 1.38;
    emitTubeSegment(
      pushPoly,
      kartXf,
      [0, 0.66, -0.42],
      0.13,
      0.13,
      [midX, 0.98, -0.88],
      0.24,
      0.23,
      spec.furPrimary,
      spec.furPrimary,
      -0.42,
    );
    const m0 = kartXf(midX - 0.23, 0.98, -0.88);
    const m1 = kartXf(midX, 0.98 + 0.23, -0.88);
    const m2 = kartXf(midX + 0.23, 0.98, -0.88);
    const m3 = kartXf(midX, 0.98 - 0.23, -0.88);
    const tailTip = kartXf(tipX, 1.32, -1.16);
    pushPoly([m0, m1, tailTip], spec.furCream, -0.43, true);
    pushPoly([m1, m2, tailTip], spec.furCream, -0.43, true);
    pushPoly([m2, m3, tailTip], spec.furCream, -0.43);
    pushPoly([m3, m0, tailTip], spec.furCream, -0.43);
    return;
  }

  if (kart.character === 'cat') {
    // Perked upright Cat Ears with rose-pink inner facets + sculpted 3D Rose Satin Ear Bow!
    for (const side of [-1, 1] as const) {
      const b0 = hxf(side * 0.13, 0.3, -0.08);
      const b1 = hxf(side * 0.35, 0.23, -0.08);
      const b2 = hxf(side * 0.33, 0.25, 0.09);
      const b3 = hxf(side * 0.13, 0.31, 0.08);
      const tip = hxf(side * 0.36, 0.78, 0.0);
      pushPoly([b0, b1, tip], spec.furPrimary, -0.41);
      pushPoly([b1, b2, tip], spec.furPrimary, -0.41);
      pushPoly([b2, b3, tip], spec.furSecondary, -0.42);
      pushPoly([b3, b0, tip], spec.furPrimary, -0.41);

      // Cute side cat whiskers
      pushPoly(
        [
          hxf(side * 0.36, -0.08, 0.12),
          hxf(side * 0.36, -0.05, 0.12),
          hxf(side * 0.56, -0.04, 0.06),
        ],
        spec.furCream,
        -0.42,
      );
      pushPoly(
        [
          hxf(side * 0.36, -0.14, 0.1),
          hxf(side * 0.36, -0.11, 0.1),
          hxf(side * 0.55, -0.13, 0.04),
        ],
        spec.furCream,
        -0.42,
      );
    }

    // 3D Rose Satin Bow at right ear base (visible from both rear & front!)
    const bx = 0.25;
    const by = 0.33;
    const bz = -0.06;
    const bowKnot = hxf(bx, by, bz);
    pushPoly(
      [
        bowKnot,
        hxf(bx - 0.16, by + 0.1, bz - 0.03),
        hxf(bx - 0.14, by - 0.06, bz - 0.03),
      ],
      spec.scarfRgb,
      -0.45,
    );
    pushPoly(
      [
        bowKnot,
        hxf(bx + 0.17, by + 0.08, bz - 0.03),
        hxf(bx + 0.15, by - 0.08, bz - 0.03),
      ],
      spec.scarfRgb,
      -0.45,
    );
    // Golden center knot
    emitPyramid(
      pushPoly,
      hxf(bx - 0.04, by - 0.04, bz - 0.05),
      hxf(bx + 0.04, by - 0.04, bz - 0.05),
      hxf(bx + 0.04, by + 0.04, bz - 0.05),
      hxf(bx - 0.04, by + 0.04, bz - 0.05),
      hxf(bx, by, bz - 0.09),
      [252, 211, 77],
      -0.46,
    );

    // Graceful Upright S-Curved 3-Segment Cat Tail swaying above the rear deck!
    const sway = Math.sin(timeMs * 0.009 + kart.slot) * 0.2 - kart.driftYaw * 0.55;
    emitTubeSegment(
      pushPoly,
      kartXf,
      [0, 0.66, -0.44],
      0.085,
      0.085,
      [sway * 0.45, 1.02, -0.82],
      0.085,
      0.085,
      spec.furPrimary,
      spec.furPrimary,
      -0.42,
    );
    emitTubeSegment(
      pushPoly,
      kartXf,
      [sway * 0.45, 1.02, -0.82],
      0.085,
      0.085,
      [sway * 0.95, 1.36, -0.96],
      0.08,
      0.08,
      spec.furPrimary,
      spec.furPrimary,
      -0.43,
    );
    emitTubeSegment(
      pushPoly,
      kartXf,
      [sway * 0.95, 1.36, -0.96],
      0.08,
      0.08,
      [sway * 1.32 + 0.14, 1.46, -1.02],
      0.05,
      0.05,
      spec.furCream,
      spec.furPrimary,
      -0.44,
    );
    return;
  }

  if (kart.character === 'dog') {
    // Fuller 2-Segment Bouncy Floppy Puppy Ears framing Koro's golden Shiba head!
    const bounce = Math.sin(timeMs * 0.018 + kart.slot) * 0.04 * (0.4 + speedRatio);
    for (const side of [-1, 1] as const) {
      emitTubeSegment(
        pushPoly,
        hxf,
        [side * 0.25, 0.26, -0.02],
        0.11,
        0.075,
        [side * 0.52, 0.21 + bounce, -0.03],
        0.13,
        0.075,
        spec.furSecondary,
        spec.furSecondary,
        -0.42,
      );
      const e0 = hxf(side * 0.44, 0.22 + bounce, -0.14);
      const e1 = hxf(side * 0.6, 0.18 + bounce, -0.14);
      const e2 = hxf(side * 0.6, 0.18 + bounce, 0.08);
      const e3 = hxf(side * 0.44, 0.22 + bounce, 0.08);
      const tip = hxf(side * 0.58, -0.15 + bounce, -0.05 - speedRatio * 0.08);
      emitPyramid(pushPoly, e0, e1, e2, e3, tip, spec.furSecondary, -0.43);
    }

    // Perky Jaunty Curled Wagging Shiba Tail (`wag` speed doubles when boosting!)
    const wagFreq = kart.boostTimer > 0 ? 0.032 : 0.016;
    const wag = -0.16 + Math.sin(timeMs * wagFreq + kart.slot) * 0.22;
    emitTubeSegment(
      pushPoly,
      kartXf,
      [0, 0.66, -0.44],
      0.11,
      0.11,
      [wag * 0.7, 1.02, -0.9],
      0.16,
      0.16,
      spec.furPrimary,
      spec.furCream,
      -0.42,
    );
    emitTubeSegment(
      pushPoly,
      kartXf,
      [wag * 0.7, 1.02, -0.9],
      0.16,
      0.16,
      [wag * 1.05, 1.28, -0.72],
      0.11,
      0.11,
      spec.furCream,
      spec.furPrimary,
      -0.43,
    );
    return;
  }

  // `bunny` (`Momo`): Tall iconic 2-segment Berry-Pink Bunny Ears with inset Golden Inner-Ear Strips + Snow Pom-Pom Tail!
  const streamBack = 0.08 + speedRatio * 0.24 + (kart.boostTimer > 0 ? 0.15 : 0);
  for (const side of [-1, 1] as const) {
    const xBase = side * 0.15;
    const xMid = side * 0.22;
    const xTip = side * 0.25;
    const zMid = -0.04 - streamBack * 0.45;
    const zTip = -0.1 - streamBack;
    // Lower berry-pink ear blade (`y = 0.30 -> 0.80`)
    emitTubeSegment(
      pushPoly,
      hxf,
      [xBase, 0.3, -0.03],
      0.1,
      0.055,
      [xMid, 0.8, zMid],
      0.115,
      0.055,
      spec.furPrimary,
      spec.furPrimary,
      -0.42,
    );
    // Upper berry-pink ear tip (`y = 0.80 -> 1.26`)
    const u0 = hxf(xMid - 0.11, 0.8, zMid - 0.055);
    const u1 = hxf(xMid + 0.11, 0.8, zMid - 0.055);
    const u2 = hxf(xMid + 0.1, 0.8, zMid + 0.055);
    const u3 = hxf(xMid - 0.1, 0.8, zMid + 0.055);
    const earTip = hxf(xTip, 1.26, zTip);
    emitPyramid(pushPoly, u0, u1, u2, u3, earTip, spec.furPrimary, -0.43);

    // Inset Golden Inner-Ear Diamond Strip on front of ear!
    pushPoly(
      [
        hxf(xBase - 0.05, 0.36, 0.035),
        hxf(xBase + 0.05, 0.36, 0.035),
        hxf(xMid + 0.055, 0.78, zMid + 0.062),
        hxf(xMid - 0.055, 0.78, zMid + 0.062),
      ],
      spec.furSecondary,
      -0.45,
    );
    pushPoly(
      [
        hxf(xMid - 0.055, 0.78, zMid + 0.062),
        hxf(xMid + 0.055, 0.78, zMid + 0.062),
        hxf(xTip, 1.12, zTip + 0.03),
      ],
      spec.furSecondary,
      -0.45,
    );
  }

  // Cute Golden Bow at left ear base
  const lbx = -0.2;
  const lby = 0.34;
  const lbz = -0.06;
  const lKnot = hxf(lbx, lby, lbz);
  pushPoly(
    [lKnot, hxf(lbx - 0.15, lby + 0.09, lbz - 0.03), hxf(lbx - 0.13, lby - 0.06, lbz - 0.03)],
    spec.scarfRgb,
    -0.45,
  );
  pushPoly(
    [lKnot, hxf(lbx + 0.15, lby + 0.08, lbz - 0.03), hxf(lbx + 0.13, lby - 0.06, lbz - 0.03)],
    spec.scarfRgb,
    -0.45,
  );

  // Round Fluffy Snow-White 3D Cotton Pom-Pom Bunny Tail on the rear seat!
  const hop = Math.abs(Math.sin(timeMs * 0.016 + kart.slot)) * 0.05;
  const px = -kart.driftYaw * 0.25;
  const py = 0.84 + hop;
  const pz = -0.68;
  const pr = 0.22;
  const eq0 = kartXf(px - pr, py, pz);
  const eq1 = kartXf(px, py, pz - pr);
  const eq2 = kartXf(px + pr, py, pz);
  const eq3 = kartXf(px, py, pz + pr);
  pushPoly([eq0, eq1, kartXf(px, py + pr * 0.95, pz)], spec.furCream, -0.43, true);
  pushPoly([eq1, eq2, kartXf(px, py + pr * 0.95, pz)], spec.furCream, -0.43, true);
  pushPoly([eq2, eq3, kartXf(px, py + pr * 0.95, pz)], spec.furCream, -0.43);
  pushPoly([eq3, eq0, kartXf(px, py + pr * 0.95, pz)], spec.furCream, -0.43);
  emitPyramid(pushPoly, eq3, eq2, eq1, eq0, kartXf(px, py - pr * 0.85, pz), spec.furCream, -0.43);
}
