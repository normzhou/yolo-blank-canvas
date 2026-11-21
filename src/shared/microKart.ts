/**
 * Pure deterministic 3D circuit geometry, dual-thruster differential kart physics,
 * drift mini-turbo boost mechanics, spline AI rivals, kart-to-kart bumping, and
 * 3-lap race state for Micro Kart (#344, #358).
 */

export type CircuitId = 'sunset-loop' | 'canyon-crest' | 'starlight-ring';
export type KartRaceMode = '1p' | '2p-local' | '2p-online';
export type BoostKind = 'none' | 'mini' | 'ultra' | 'pad';
export type DriverCharacterId = 'fox' | 'cat' | 'dog' | 'bunny';

export interface KartDriverSpec {
  readonly id: DriverCharacterId;
  readonly speciesLabel: string;
  readonly driverName: string;
  readonly furPrimary: [number, number, number];
  readonly furSecondary: [number, number, number];
  readonly furCream: [number, number, number];
  readonly scarfRgb: [number, number, number];
  readonly kartPrimary: [number, number, number];
  readonly kartAccent: [number, number, number];
  readonly mapGlow: string;
}

export const KART_DRIVERS: readonly KartDriverSpec[] = [
  {
    id: 'fox',
    speciesLabel: 'Fox',
    driverName: 'Ren',
    furPrimary: [242, 160, 61],
    furSecondary: [212, 118, 38],
    furCream: [255, 248, 236],
    scarfRgb: [91, 141, 239],
    kartPrimary: [77, 208, 225],
    kartAccent: [246, 215, 67],
    mapGlow: '#4dd0e1',
  },
  {
    id: 'cat',
    speciesLabel: 'Cat',
    driverName: 'Mochi',
    furPrimary: [176, 107, 216],
    furSecondary: [242, 128, 152],
    furCream: [254, 248, 255],
    scarfRgb: [224, 96, 95],
    kartPrimary: [246, 215, 67],
    kartAccent: [224, 96, 95],
    mapGlow: '#b06bd8',
  },
  {
    id: 'dog',
    speciesLabel: 'Dog',
    driverName: 'Koro',
    furPrimary: [95, 194, 126],
    furSecondary: [242, 160, 61],
    furCream: [255, 251, 238],
    scarfRgb: [242, 160, 61],
    kartPrimary: [242, 160, 61],
    kartAccent: [254, 240, 138],
    mapGlow: '#5fc27e',
  },
  {
    id: 'bunny',
    speciesLabel: 'Bunny',
    driverName: 'Momo',
    furPrimary: [224, 96, 95],
    furSecondary: [246, 215, 67],
    furCream: [255, 248, 250],
    scarfRgb: [246, 215, 67],
    kartPrimary: [176, 107, 216],
    kartAccent: [246, 215, 67],
    mapGlow: '#e0605f',
  },
];

export function getKartDriverSpec(character: DriverCharacterId): KartDriverSpec {
  return KART_DRIVERS.find((d) => d.id === character) ?? KART_DRIVERS[0]!;
}

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ThrusterInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly brake?: boolean;
  /**
   * Optional continuous analog steering in `-1 .. +1` (used by touchscreen drag slider
   * and AI pilots): `-1` cuts left thruster to 0%, `0` fires both at 100%, `+1` cuts
   * right thruster to 0%.
   */
  readonly steerAnalog?: number;
}

export interface SceneryProp {
  readonly kind: 'pine' | 'spire' | 'pylon';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  readonly yaw: number;
}

export interface TrackNode {
  readonly index: number;
  readonly u: number;
  /** Cumulative horizontal arc-length from start line (meters). */
  readonly s: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Unit 3D tangent along driving direction. */
  readonly tx: number;
  readonly ty: number;
  readonly tz: number;
  /** Unit horizontal right-hand normal `[rx, 0, rz]`. */
  readonly rx: number;
  readonly rz: number;
  /** Signed horizontal curvature (positive = turning right, negative = turning left). */
  readonly curvature: number;
  /** Recommended no-skid corner speed in m/s (`45 .. 100`) for center-stripe color guidance. */
  readonly recommendedSpeed: number;
  readonly hasBoostPad: boolean;
  readonly boostLat: number;
  readonly hasChevron: boolean;
  /** Which road shoulder carries the turn-warning chevron (`-1` left, `+1` right). */
  readonly chevronSide: -1 | 1;
}

export interface TrajectoryPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rx: number;
  readonly rz: number;
  /** Elapsed prediction time in seconds (`0 .. durationSec`). */
  readonly t: number;
  /** Alpha opacity (`0.85` beneath car -> `0.0` at 1s out). */
  readonly alpha: number;
}

export interface CircuitTheme {
  readonly skyTop: string;
  readonly skyHorizon: string;
  readonly fogHex: [number, number, number];
  readonly groundOuter: string;
  readonly groundAlt: string;
  readonly mountainHex: string;
  readonly roadDark: string;
  readonly roadLight: string;
  readonly curbA: string;
  readonly curbB: string;
  readonly propKind: SceneryProp['kind'];
}

export interface CircuitDefinition {
  readonly id: CircuitId;
  readonly name: string;
  readonly subtitle: string;
  readonly roadHalfWidth: number;
  readonly wallHalfWidth: number;
  readonly totalLength: number;
  readonly nodes: readonly TrackNode[];
  readonly scenery: readonly SceneryProp[];
  readonly theme: CircuitTheme;
}

export interface SkidMark {
  readonly lx: number;
  readonly ly: number;
  readonly lz: number;
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
}

export interface KartLiveries {
  readonly id: string;
  readonly name: string;
  readonly primary: [number, number, number];
  readonly accent: [number, number, number];
  readonly glow: string;
  readonly helmet: [number, number, number];
}

export const KART_LIVERIES: readonly KartLiveries[] = [
  {
    id: 'nova',
    name: 'Nova Cyan',
    primary: [57, 197, 207],
    accent: [246, 215, 67],
    glow: '#39c5cf',
    helmet: [248, 250, 252],
  },
  {
    id: 'blaze',
    name: 'Blaze Coral',
    primary: [240, 101, 95],
    accent: [255, 214, 102],
    glow: '#f0655f',
    helmet: [254, 242, 242],
  },
  {
    id: 'verde',
    name: 'Verde Mint',
    primary: [63, 185, 80],
    accent: [230, 255, 180],
    glow: '#3fb950',
    helmet: [240, 253, 244],
  },
  {
    id: 'astral',
    name: 'Astral Violet',
    primary: [188, 140, 255],
    accent: [125, 211, 252],
    glow: '#bc8cff',
    helmet: [250, 245, 255],
  },
];

export interface KartState {
  readonly slot: 0 | 1 | 2 | 3;
  readonly name: string;
  readonly character: DriverCharacterId;
  readonly isHuman: boolean;
  readonly isRemote: boolean;
  readonly liveryIndex: number;
  x: number;
  y: number;
  z: number;
  /** World heading in radians (`0` = `+z`, `+` turns right toward `+x`). */
  yaw: number;
  /** Track slope pitch in radians (positive = nose up). */
  pitch: number;
  /** Extra visual slip yaw while drifting (`-` left drift, `+` right drift). */
  driftYaw: number;
  /** Visual chassis roll in radians. */
  bodyRoll: number;
  /** Forward ground speed in m/s (`v_fwd`, signed projection along kart heading). */
  speed: number;
  /** World horizontal velocity components in m/s (rigid-body 2D momentum). */
  vx: number;
  vz: number;
  /** Angular yaw velocity in rad/s (`+` turning right, `-` turning left). */
  yawRate: number;
  /** Signed lateral slip speed in m/s relative to kart right vector (`+` sliding right). */
  lateralSlip: number;
  /** Nearest spline arc-length coordinate `0 .. totalLength`. */
  s: number;
  /** Signed lateral offset from track centerline (`-` left, `+` right). */
  lat: number;
  /** Current lap (`1 .. TOTAL_LAPS`, or `TOTAL_LAPS + 1` once finished). */
  lap: number;
  /** Unwrapped monotonic arc distance traveled since race start. */
  unwrappedS: number;
  maxUnwrappedS: number;
  /** Continuous left/right thruster output levels (`0.0 .. 1.0`). */
  leftThrottle: number;
  rightThrottle: number;
  leftThruster: boolean;
  rightThruster: boolean;
  braking: boolean;
  /** Seconds spent continuously carving a turn (`0 .. 2.0`). */
  driftCharge: number;
  driftDir: -1 | 0 | 1;
  boostTimer: number;
  boostKind: BoostKind;
  lapStartMs: number;
  bestLapMs: number | null;
  finishMs: number | null;
  /** Current race standing `1 .. 4`. */
  place: number;
  /** AI lane preference offset in meters. */
  aiTargetLat: number;
  aiBaseSkill: number;
  skidMarks: SkidMark[];
}

export interface KartRaceEvents {
  boostTriggered: Array<{ slot: number; kind: BoostKind }>;
  lapCompleted: Array<{ slot: number; lap: number; lapMs: number; finished: boolean }>;
  bumped: boolean;
}

export interface KartRaceState {
  readonly circuitId: CircuitId;
  readonly mode: KartRaceMode;
  readonly totalLaps: number;
  readonly seed: number;
  elapsedMs: number;
  status: 'racing' | 'finished';
  winnerSlot: number | null;
  karts: KartState[];
  lastEvents: KartRaceEvents;
}

export interface KartNetSnapshot {
  character?: DriverCharacterId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  driftYaw: number;
  bodyRoll: number;
  speed: number;
  vx?: number;
  vz?: number;
  yawRate?: number;
  lateralSlip?: number;
  leftThrottle?: number;
  rightThrottle?: number;
  s: number;
  lat: number;
  lap: number;
  unwrappedS: number;
  leftThruster: boolean;
  rightThruster: boolean;
  braking?: boolean;
  boostTimer: number;
  boostKind: BoostKind;
  bestLapMs: number | null;
  finishMs: number | null;
}

export const TOTAL_LAPS = 3;
export const TRACK_SEGMENTS = 192;

// F1-calibrated dual-rocket rigid-body physics constants (#384, #388):
// - Mass m = 800 kg, F1 top speed v_max = 100 m/s (360 km/h)
// - In zero air drag, full dual rocket thrust reaches v_max in exactly 2.0 seconds
// - Quadratic aero drag + asphalt rolling resistance equilibrate full dual thrust at 100 m/s
export const KART_MASS_KG = 800;
export const GRAVITY_MPS2 = 9.81;
export const MAX_STRAIGHT_SPEED = 100;
export const VACUUM_ACCEL_TIME_SEC = 2.0;
export const MAX_TOTAL_THRUST_N = (KART_MASS_KG * MAX_STRAIGHT_SPEED) / VACUUM_ACCEL_TIME_SEC;
export const PER_THRUSTER_MAX_N = MAX_TOTAL_THRUST_N * 0.5;
export const ASPHALT_ROLLING_DRAG_N = 480;
export const AERO_DRAG_COEFF =
  (MAX_TOTAL_THRUST_N - ASPHALT_ROLLING_DRAG_N) / (MAX_STRAIGHT_SPEED * MAX_STRAIGHT_SPEED);
export const BRAKE_FORCE_N = 42_000;
export const OFFROAD_EXTRA_DRAG_N = 15_000;

/** Linear ramp time (seconds) for keyboard 100% <-> 0% thruster modulation (PWM-friendly). */
export const THRUSTER_RAMP_SEC = 0.55;
export const ANALOG_RAMP_SEC = 0.06;
export const BRAKE_CUT_RAMP_SEC = 0.11;

// Rotational dynamics (differential rocket torque vs angular inertia & yaw damping)
export const THRUSTER_HALF_SPAN_M = 0.68;
export const KART_YAW_INERTIA = 1400;
export const YAW_DAMPING = 6500;

// Planted F1 lateral tire friction + speed-squared downforce (controlled, low-skid feel)
export const TIRE_LATERAL_MU = 4.6;
export const AERO_DOWNFORCE_COEFF = 0.0024;
export const TIRE_CORNERING_STIFFNESS = 18.0;
export const SLIP_SELF_ALIGN_TORQUE = 180;

/** Approximate single-thruster equilibrium (~71% top speed). */
export const MAX_DRIFT_SPEED = Math.round(MAX_STRAIGHT_SPEED * Math.SQRT1_2);
export const MAX_BOOST_SPEED = MAX_STRAIGHT_SPEED;
export const MINI_TURBO_CHARGE_SEC = 0.42;
export const ULTRA_TURBO_CHARGE_SEC = 1.1;

const SPEED_COLOR_STOPS: ReadonlyArray<{ readonly mps: number; readonly rgb: readonly [number, number, number] }> = [
  { mps: 0, rgb: [56, 232, 255] }, // 0 km/h — electric cyan
  { mps: 55, rgb: [52, 211, 153] }, // 198 km/h — vivid emerald green (tight hairpin pace)
  { mps: 72, rgb: [250, 204, 21] }, // 259 km/h — sunny gold (sweeper pace)
  { mps: 86, rgb: [251, 146, 60] }, // 310 km/h — fiery orange (fast bend pace)
  { mps: 100, rgb: [255, 86, 102] }, // 360 km/h — racing coral-red (flat-out top speed)
];

/**
 * Shared speed-to-RGB color spectrum used identically on the onscreen speedometer
 * and on the center road dashes (`node.recommendedSpeed`) so matching speedometer
 * color to road-stripe color guides clean, skid-free cornering (#388).
 */
export function speedToColorRgb(speedMps: number): [number, number, number] {
  const s = clamp(speedMps, 0, MAX_STRAIGHT_SPEED);
  for (let i = 0; i < SPEED_COLOR_STOPS.length - 1; i += 1) {
    const a = SPEED_COLOR_STOPS[i]!;
    const b = SPEED_COLOR_STOPS[i + 1]!;
    if (s <= b.mps) {
      const t = (s - a.mps) / Math.max(1e-6, b.mps - a.mps);
      return [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t),
      ];
    }
  }
  const last = SPEED_COLOR_STOPS[SPEED_COLOR_STOPS.length - 1]!.rgb;
  return [last[0], last[1], last[2]];
}

export function speedToColorHex(speedMps: number): string {
  const [r, g, b] = speedToColorRgb(speedMps);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function wrapAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CircuitSpec {
  id: CircuitId;
  name: string;
  subtitle: string;
  roadHalfWidth: number;
  evalPoint: (u: number) => { x: number; y: number; z: number };
  boostSegments: ReadonlyArray<{ seg: number; lat: number }>;
  theme: CircuitTheme;
  seed: number;
}

const CIRCUIT_SPECS: readonly CircuitSpec[] = [
  {
    id: 'sunset-loop',
    name: 'Sunset Loop',
    subtitle: 'Wide coastal sweepers & rolling crests',
    roadHalfWidth: 16.5,
    // Driven clockwise as u increases: x = -R(u)*cos(u), z = R(u)*sin(u) -> at u=0 tangent points +z (yaw = 0).
    // Scaled ~1.35x for 360 km/h F1 thruster speeds & smooth lateral slides (~1,740m lap).
    evalPoint: (u) => {
      const r = 250 + 36 * Math.sin(2 * u + 0.4) + 22 * Math.cos(3 * u - 0.3);
      return {
        x: -r * Math.cos(u),
        y: 8.5 * Math.sin(2 * u) + 4.5 * Math.cos(3 * u + 0.6),
        z: r * Math.sin(u) * 1.18,
      };
    },
    boostSegments: [
      { seg: 28, lat: -4.0 },
      { seg: 92, lat: 4.0 },
      { seg: 152, lat: 0 },
    ],
    theme: {
      skyTop: '#2f84f4',
      skyHorizon: '#ffd596',
      fogHex: [245, 204, 152],
      groundOuter: '#49b85e',
      groundAlt: '#3da652',
      mountainHex: '#6c88cb',
      roadDark: '#414b63',
      roadLight: '#4d5872',
      curbA: '#ff4d57',
      curbB: '#ffffff',
      propKind: 'pine',
    },
    seed: 101,
  },
  {
    id: 'canyon-crest',
    name: 'Canyon Crest',
    subtitle: 'Sunny toy-mesa climbs & drift hairpins',
    roadHalfWidth: 16.0,
    evalPoint: (u) => {
      const r = 260 + 48 * Math.cos(3 * u - 0.35) + 18 * Math.sin(2 * u);
      return {
        x: -r * Math.cos(u),
        y: 14.5 * Math.sin(2 * u - 0.4) + 7.5 * Math.sin(3 * u + 0.8),
        z: r * Math.sin(u) * 1.12,
      };
    },
    boostSegments: [
      { seg: 22, lat: 3.5 },
      { seg: 74, lat: -3.5 },
      { seg: 124, lat: 3.0 },
      { seg: 168, lat: 0 },
    ],
    theme: {
      skyTop: '#2a7ae8',
      skyHorizon: '#ffc37c',
      fogHex: [242, 186, 126],
      groundOuter: '#df9549',
      groundAlt: '#d1853b',
      mountainHex: '#b86242',
      roadDark: '#474254',
      roadLight: '#544e63',
      curbA: '#24c8d8',
      curbB: '#ffe46b',
      propKind: 'spire',
    },
    seed: 202,
  },
  {
    id: 'starlight-ring',
    name: 'Starlight Ring',
    subtitle: 'Cosmic starlight skyway & five turbo strips',
    roadHalfWidth: 15.8,
    evalPoint: (u) => {
      const r = 268 + 38 * Math.cos(2 * u + 0.2) + 26 * Math.sin(4 * u - 0.5);
      return {
        x: -r * Math.cos(u),
        y: 9.5 * Math.cos(2 * u - 0.2) + 5.5 * Math.sin(4 * u),
        z: r * Math.sin(u) * 1.15,
      };
    },
    boostSegments: [
      { seg: 18, lat: 0 },
      { seg: 56, lat: -3.6 },
      { seg: 96, lat: 3.6 },
      { seg: 136, lat: -3.6 },
      { seg: 172, lat: 0 },
    ],
    theme: {
      skyTop: '#192166',
      skyHorizon: '#8454f6',
      fogHex: [112, 82, 206],
      groundOuter: '#273478',
      groundAlt: '#202b66',
      mountainHex: '#43388f',
      roadDark: '#2c355c',
      roadLight: '#364170',
      curbA: '#38e8ff',
      curbB: '#ffe46b',
      propKind: 'pylon',
    },
    seed: 303,
  },
];

function buildCircuit(spec: CircuitSpec): CircuitDefinition {
  const N = TRACK_SEGMENTS;
  const rawPts = Array.from({ length: N }, (_, i) => {
    const u = (i / N) * Math.PI * 2;
    return { u, ...spec.evalPoint(u) };
  });

  let cumS = 0;
  const sArr: number[] = [0];
  for (let i = 0; i < N; i += 1) {
    const a = rawPts[i]!;
    const b = rawPts[(i + 1) % N]!;
    const segHorizontal = Math.hypot(b.x - a.x, b.z - a.z);
    cumS += segHorizontal;
    if (i < N - 1) sArr.push(cumS);
  }
  const totalLength = cumS;

  const baseNodes = rawPts.map((pt, i) => {
    const prev = rawPts[(i - 1 + N) % N]!;
    const next = rawPts[(i + 1) % N]!;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const dz = next.z - prev.z;
    const len3 = Math.hypot(dx, dy, dz) || 1;
    const tx = dx / len3;
    const ty = dy / len3;
    const tz = dz / len3;

    const hLen = Math.hypot(dx, dz) || 1;
    const htx = dx / hLen;
    const htz = dz / hLen;
    // Right-hand horizontal normal for forward = [sin(yaw), 0, cos(yaw)] is [cos(yaw), 0, -sin(yaw)] = [htz, 0, -htx]
    const rx = htz;
    const rz = -htx;

    // Curvature sign from heading change
    const prevNext = rawPts[(i + 2) % N]!;
    const yaw1 = Math.atan2(next.x - pt.x, next.z - pt.z);
    const yaw2 = Math.atan2(prevNext.x - next.x, prevNext.z - next.z);
    const segLen = Math.hypot(next.x - pt.x, next.z - pt.z) || 1;
    const curvature = wrapAngle(yaw2 - yaw1) / segLen;

    const hasChevron = Math.abs(curvature) > 0.0068 && i % 3 === 0;
    const chevronSide: -1 | 1 = curvature > 0 ? -1 : 1; // Outside shoulder of the turn!

    return {
      index: i,
      u: pt.u,
      s: sArr[i]!,
      x: pt.x,
      y: pt.y,
      z: pt.z,
      tx,
      ty,
      tz,
      rx,
      rz,
      curvature,
      hasChevron,
      chevronSide,
    };
  });

  // Compute no-skid recommended cornering speed (m/s) per node with a 0.72 safety margin
  // plus 5-segment (~45m) braking-zone lookahead so center road dashes warn drivers early!
  const gripBudget = TIRE_LATERAL_MU * GRAVITY_MPS2 * 0.72;
  const dfBudget = AERO_DOWNFORCE_COEFF * 0.72;
  const rawSafeSpeeds = baseNodes.map((n) => {
    const absK = Math.abs(n.curvature);
    if (absK <= dfBudget + 1e-5) return MAX_STRAIGHT_SPEED;
    return clamp(Math.sqrt(gripBudget / (absK - dfBudget)), 45, MAX_STRAIGHT_SPEED);
  });
  const lookaheadSpeeds = rawSafeSpeeds.map((_, i) => {
    let minSpd = MAX_STRAIGHT_SPEED;
    for (let look = 0; look <= 5; look += 1) {
      const sp = rawSafeSpeeds[(i + look) % N]!;
      if (sp < minSpd) minSpd = sp;
    }
    return minSpd;
  });
  const nodes: TrackNode[] = baseNodes.map((n, i) => {
    const prevSpd = lookaheadSpeeds[(i - 1 + N) % N]!;
    const curSpd = lookaheadSpeeds[i]!;
    const nextSpd = lookaheadSpeeds[(i + 1) % N]!;
    const smoothed = prevSpd * 0.22 + curSpd * 0.56 + nextSpd * 0.22;
    return {
      ...n,
      recommendedSpeed: Math.round(smoothed * 10) / 10,
      hasBoostPad: false,
      boostLat: 0,
    };
  });

  // Deterministic low-poly roadside scenery outside the track barriers
  const rng = mulberry32(spec.seed);
  const scenery: SceneryProp[] = [];
  for (let i = 0; i < N; i += 3) {
    const node = nodes[i]!;
    for (const side of [-1, 1] as const) {
      if (rng() < 0.62) {
        const dist = spec.roadHalfWidth + 8.5 + rng() * 24;
        const px = node.x + node.rx * side * dist;
        const pz = node.z + node.rz * side * dist;
        scenery.push({
          kind: spec.theme.propKind,
          x: px,
          y: node.y - 0.4,
          z: pz,
          scale: 0.85 + rng() * 0.65,
          yaw: rng() * Math.PI * 2,
        });
      }
    }
  }

  return {
    id: spec.id,
    name: spec.name,
    subtitle: spec.subtitle,
    roadHalfWidth: spec.roadHalfWidth,
    wallHalfWidth: spec.roadHalfWidth + 1.8,
    totalLength,
    nodes,
    scenery,
    theme: spec.theme,
  };
}

export const CIRCUITS: Readonly<Record<CircuitId, CircuitDefinition>> = {
  'sunset-loop': buildCircuit(CIRCUIT_SPECS[0]!),
  'canyon-crest': buildCircuit(CIRCUIT_SPECS[1]!),
  'starlight-ring': buildCircuit(CIRCUIT_SPECS[2]!),
};

export const CIRCUIT_LIST: readonly CircuitDefinition[] = [
  CIRCUITS['sunset-loop'],
  CIRCUITS['canyon-crest'],
  CIRCUITS['starlight-ring'],
];

/**
 * Interpolates a track frame at continuous arc coordinate `s` (`0 .. totalLength`).
 */
export function sampleCircuitAtS(circuit: CircuitDefinition, rawS: number): {
  s: number;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  rx: number;
  rz: number;
  yaw: number;
  pitch: number;
  curvature: number;
  nodeIndex: number;
} {
  const L = circuit.totalLength;
  const s = ((rawS % L) + L) % L;
  const nodes = circuit.nodes;
  const N = nodes.length;

  // Binary search in monotonic `nodes[i].s`
  let lo = 0;
  let hi = N - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (nodes[mid]!.s <= s) lo = mid;
    else hi = mid - 1;
  }
  const n0 = nodes[lo]!;
  const n1 = nodes[(lo + 1) % N]!;
  const s0 = n0.s;
  const s1 = lo === N - 1 ? L : n1.s;
  const span = Math.max(0.0001, s1 - s0);
  const t = clamp((s - s0) / span, 0, 1);

  const x = n0.x + (n1.x - n0.x) * t;
  const y = n0.y + (n1.y - n0.y) * t;
  const z = n0.z + (n1.z - n0.z) * t;
  const tx = n0.tx + (n1.tx - n0.tx) * t;
  const ty = n0.ty + (n1.ty - n0.ty) * t;
  const tz = n0.tz + (n1.tz - n0.tz) * t;
  const rx = n0.rx + (n1.rx - n0.rx) * t;
  const rz = n0.rz + (n1.rz - n0.rz) * t;
  const rLen = Math.hypot(rx, rz) || 1;
  const yaw = Math.atan2(tx, tz);
  const pitch = Math.asin(clamp(ty, -0.6, 0.6));
  const curvature = n0.curvature + (n1.curvature - n0.curvature) * t;

  return {
    s,
    x,
    y,
    z,
    tx,
    ty,
    tz,
    rx: rx / rLen,
    rz: rz / rLen,
    yaw,
    pitch,
    curvature,
    nodeIndex: lo,
  };
}

/**
 * Projects world `(x, z)` onto the nearest point on the closed track spline,
 * searching locally around `hintS` first for O(1) speed and falling back to full scan if far.
 */
export function projectOntoCircuit(
  circuit: CircuitDefinition,
  x: number,
  z: number,
  hintS?: number,
): { s: number; lat: number; groundY: number; trackYaw: number; pitch: number; nodeIndex: number } {
  const nodes = circuit.nodes;
  const N = nodes.length;
  const L = circuit.totalLength;

  let bestIdx = 0;
  let bestDistSq = Infinity;

  if (hintS !== undefined) {
    const approxIdx = Math.floor((((hintS % L) + L) % L) / (L / N));
    for (let offset = -12; offset <= 12; offset += 1) {
      const idx = ((approxIdx + offset) % N + N) % N;
      const n = nodes[idx]!;
      const dSq = (x - n.x) * (x - n.x) + (z - n.z) * (z - n.z);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = idx;
      }
    }
  }

  if (bestDistSq > 950) {
    bestDistSq = Infinity;
    for (let i = 0; i < N; i += 1) {
      const n = nodes[i]!;
      const dSq = (x - n.x) * (x - n.x) + (z - n.z) * (z - n.z);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
  }

  // Refine projection across the two segments adjacent to `bestIdx`
  let bestS = nodes[bestIdx]!.s;
  let bestProjDistSq = Infinity;
  for (const segStart of [(bestIdx - 1 + N) % N, bestIdx]) {
    const a = nodes[segStart]!;
    const b = nodes[(segStart + 1) % N]!;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const abLenSq = abx * abx + abz * abz || 1;
    const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / abLenSq, 0, 1);
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    const dSq = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (dSq < bestProjDistSq) {
      bestProjDistSq = dSq;
      const sEnd = segStart === N - 1 ? L : b.s;
      bestS = (a.s + (sEnd - a.s) * t) % L;
    }
  }

  const sample = sampleCircuitAtS(circuit, bestS);
  const lat = (x - sample.x) * sample.rx + (z - sample.z) * sample.rz;
  return {
    s: sample.s,
    lat,
    groundY: sample.y,
    trackYaw: sample.yaw,
    pitch: sample.pitch,
    nodeIndex: sample.nodeIndex,
  };
}

export function createRaceState(
  circuitId: CircuitId = 'sunset-loop',
  mode: KartRaceMode = '1p',
  seed = 1,
  options?: {
    p1?: string;
    p2?: string;
    p1Character?: DriverCharacterId;
    p2Character?: DriverCharacterId;
  },
): KartRaceState {
  const circuit = CIRCUITS[circuitId];
  const rng = mulberry32(seed);
  const L = circuit.totalLength;

  const allChars: DriverCharacterId[] = ['fox', 'cat', 'dog', 'bunny'];
  const p1Char: DriverCharacterId = options?.p1Character ?? 'fox';
  const remainingAfterP1 = allChars.filter((c) => c !== p1Char);
  const p2Char: DriverCharacterId =
    options?.p2Character && options.p2Character !== p1Char
      ? options.p2Character
      : remainingAfterP1[0]!;
  const aiChars = allChars.filter((c) => c !== p1Char && c !== p2Char);
  const slotCharacters: DriverCharacterId[] = [
    p1Char,
    p2Char,
    aiChars[0] ?? 'dog',
    aiChars[1] ?? 'bunny',
  ];

  // Staggered 2x2 starting grid behind the start/finish arch:
  // Rivals (`slot 2, 3`) start on row 1 (`11m` behind line) and human karts (`slot 0, 1`)
  // start right behind them (`20m` behind line) with a clear view of the pack & arch!
  const gridOffsets: ReadonlyArray<{ backMeters: number; lat: number }> = [
    { backMeters: 20, lat: -3.8 },
    { backMeters: 20, lat: 3.8 },
    { backMeters: 11, lat: -3.8 },
    { backMeters: 11, lat: 3.8 },
  ];

  const count = mode === '2p-online' ? 2 : 4;
  const karts: KartState[] = [];

  for (let slot = 0; slot < count; slot += 1) {
    const grid = gridOffsets[slot]!;
    const startS = L - grid.backMeters;
    const sample = sampleCircuitAtS(circuit, startS);
    const charId = slotCharacters[slot]!;
    const driverSpec = getKartDriverSpec(charId);
    const liveryIndex = KART_DRIVERS.findIndex((d) => d.id === charId);
    const isHuman =
      slot === 0 || (slot === 1 && mode === '2p-local');
    const isRemote = slot === 1 && mode === '2p-online';
    const defaultName =
      slot === 0
        ? options?.p1 ?? driverSpec.driverName
        : slot === 1 && (mode === '2p-local' || mode === '2p-online')
          ? options?.p2 ?? driverSpec.driverName
          : driverSpec.driverName;

    karts.push({
      slot: slot as 0 | 1 | 2 | 3,
      name: defaultName,
      character: charId,
      isHuman,
      isRemote,
      liveryIndex: liveryIndex >= 0 ? liveryIndex : slot,
      x: sample.x + sample.rx * grid.lat,
      y: sample.y,
      z: sample.z + sample.rz * grid.lat,
      yaw: sample.yaw,
      pitch: sample.pitch,
      driftYaw: 0,
      bodyRoll: 0,
      speed: 0,
      vx: 0,
      vz: 0,
      yawRate: 0,
      lateralSlip: 0,
      s: startS,
      lat: grid.lat,
      lap: 1,
      unwrappedS: -grid.backMeters,
      maxUnwrappedS: -grid.backMeters,
      leftThrottle: 1,
      rightThrottle: 1,
      leftThruster: true,
      rightThruster: true,
      braking: false,
      driftCharge: 0,
      driftDir: 0,
      boostTimer: 0,
      boostKind: 'none',
      lapStartMs: 0,
      bestLapMs: null,
      finishMs: null,
      place: slot + 1,
      aiTargetLat: (rng() - 0.5) * 10,
      aiBaseSkill: 0.92 + slot * 0.025 + rng() * 0.03,
      skidMarks: [],
    });
  }

  return {
    circuitId,
    mode,
    totalLaps: TOTAL_LAPS,
    seed,
    elapsedMs: 0,
    status: 'racing',
    winnerSlot: null,
    karts,
    lastEvents: {
      boostTriggered: [],
      lapCompleted: [],
      bumped: false,
    },
  };
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return target;
}

/**
 * Predictive F1 AI pilot (#384): uses speed-scaled lookahead + proportional analog
 * differential steering (`steerAnalog`) and upcoming corner-curvature braking so AI
 * rivals carry real racing lines at 360 km/h without understeering into barriers.
 */
function computeAiThrusters(
  kart: KartState,
  circuit: CircuitDefinition,
  leaderUnwrappedS: number,
): ThrusterInput {
  const lookahead = clamp(18 + kart.speed * 0.28, 18, 46);
  const aheadSample = sampleCircuitAtS(circuit, kart.s + lookahead);
  const aheadNode = circuit.nodes[aheadSample.nodeIndex]!;
  const targetLat = aheadNode.hasBoostPad ? aheadNode.boostLat : kart.aiTargetLat;

  const tx = aheadSample.x + aheadSample.rx * targetLat;
  const tz = aheadSample.z + aheadSample.rz * targetLat;
  const desiredYaw = Math.atan2(tx - kart.x, tz - kart.z);
  const travelYaw =
    kart.speed > 12 ? Math.atan2(kart.vx, kart.vz) : kart.yaw;
  const headingBlendYaw = wrapAngle(kart.yaw + wrapAngle(travelYaw - kart.yaw) * 0.45);
  const yawError = wrapAngle(desiredYaw - headingBlendYaw);

  // Sample upcoming curvature slightly further ahead for smooth corner-entry braking
  const brakeLookahead = clamp(28 + kart.speed * 0.42, 28, 72);
  const curveSample = sampleCircuitAtS(circuit, kart.s + brakeLookahead);
  const curveNode = circuit.nodes[curveSample.nodeIndex]!;
  const absCurv = Math.abs(curveNode.curvature);
  const maxLatAccel = TIRE_LATERAL_MU * GRAVITY_MPS2 + AERO_DOWNFORCE_COEFF * kart.speed * kart.speed;
  const safeCornerSpeed =
    absCurv > 0.003 ? Math.sqrt((maxLatAccel * 0.92) / absCurv) : MAX_STRAIGHT_SPEED;

  // PD steering controller: proportional yaw error minus angular rate damping
  const gapBehind = leaderUnwrappedS - kart.unwrappedS;
  const steerGain = gapBehind > 60 ? 2.8 : 2.5;
  const rawSteer = clamp(yawError * steerGain - kart.yawRate * 0.22, -1, 1);
  const steerAnalog = Math.abs(rawSteer) < 0.03 ? 0 : rawSteer;

  const needCornerBrake =
    (kart.speed > safeCornerSpeed * 1.08 && absCurv > 0.0055) ||
    (Math.abs(yawError) > 0.65 && kart.speed > 68);

  return {
    left: steerAnalog < -0.18,
    right: steerAnalog > 0.18,
    brake: needCornerBrake,
    steerAnalog,
  };
}

function stepSingleKart(
  kart: KartState,
  input: ThrusterInput,
  circuit: CircuitDefinition,
  dt: number,
  elapsedMs: number,
  events: KartRaceEvents,
  aiSpeedScale = 1,
): void {
  if (kart.isRemote) return;

  // Finished karts cruise cleanly on AI autopilot so the finish camera stays cinematic
  const activeInput =
    kart.finishMs !== null
      ? computeAiThrusters(kart, circuit, kart.unwrappedS)
      : input;

  const braking = Boolean(activeInput.brake);
  const hasAnalog =
    typeof activeInput.steerAnalog === 'number' && Number.isFinite(activeInput.steerAnalog);
  const analogVal = hasAnalog ? clamp(activeInput.steerAnalog!, -1, 1) : 0;

  const digitalLeft = activeInput.left && !activeInput.right;
  const digitalRight = activeInput.right && !activeInput.left;
  const steerIntent = hasAnalog
    ? analogVal
    : digitalLeft
      ? -1
      : digitalRight
        ? 1
        : 0;

  const steerLeft = steerIntent < -0.05;
  const steerRight = steerIntent > 0.05;
  const turning = steerLeft || steerRight;

  // 1. Update continuous per-thruster throttle levels (`0.0 .. 1.0`):
  //    - Braking cuts both thrusters quickly (`BRAKE_CUT_RAMP_SEC`)
  //    - Analog touch slider / AI smoothly tracks continuous inner thruster reduction
  //    - Keyboard digital keys linearly ramp 100% <-> 0% over `THRUSTER_RAMP_SEC` (0.65s)
  //      so players can PWM-tap keys smoothly or hold for full-cut hairpins!
  let targetLeft = 1;
  let targetRight = 1;
  if (braking) {
    targetLeft = 0;
    targetRight = 0;
  } else if (steerIntent < 0) {
    targetLeft = 1 + steerIntent; // -1 -> 0.0 (full cut), -0.4 -> 0.6
    targetRight = 1;
  } else if (steerIntent > 0) {
    targetLeft = 1;
    targetRight = 1 - steerIntent; // +1 -> 0.0 (full cut), +0.4 -> 0.6
  }

  const rampSec = braking
    ? BRAKE_CUT_RAMP_SEC
    : hasAnalog
      ? ANALOG_RAMP_SEC
      : THRUSTER_RAMP_SEC;
  const maxThrottleDelta = dt / rampSec;
  kart.leftThrottle = moveToward(kart.leftThrottle, targetLeft, maxThrottleDelta);
  kart.rightThrottle = moveToward(kart.rightThrottle, targetRight, maxThrottleDelta);

  kart.braking = braking;
  kart.leftThruster = kart.leftThrottle > 0.35;
  kart.rightThruster = kart.rightThrottle > 0.35;

  // Pure dual-rocket propulsion (#388): no extra drift mini-turbo or boost pads!
  kart.driftCharge = 0;
  kart.driftDir = turning && !braking ? (steerLeft ? -1 : 1) : 0;
  kart.boostTimer = 0;
  kart.boostKind = 'none';

  // 2. Dual-rocket forces, rotational torque, angular inertia & yaw damping
  const fLeft = kart.leftThrottle * PER_THRUSTER_MAX_N * aiSpeedScale;
  const fRight = kart.rightThrottle * PER_THRUSTER_MAX_N * aiSpeedScale;
  const fThrust = fLeft + fRight;

  // Left thruster pushing forward creates +yaw (right turn); cutting left creates -yaw (left turn)
  const torqueThrust = (fLeft - fRight) * THRUSTER_HALF_SPAN_M;

  // Trail-braking front-wheel steering torque when braking + steering so hairpins remain controllable
  const torqueBrakeSteer =
    braking && Math.abs(steerIntent) > 0.05
      ? steerIntent * 6800 * clamp(kart.speed / 22, 0.25, 1.0)
      : 0;

  // Body-frame decomposition of current velocity before yaw step (for caster self-alignment)
  const preFx = Math.sin(kart.yaw);
  const preFz = Math.cos(kart.yaw);
  const preRx = Math.cos(kart.yaw);
  const preRz = -Math.sin(kart.yaw);
  const preVLat = kart.vx * preRx + kart.vz * preRz;
  const preVFwd = kart.vx * preFx + kart.vz * preFz;

  // Positive coefficient * vLat aligns nose smoothly back toward travel direction
  const torqueAlign = SLIP_SELF_ALIGN_TORQUE * preVLat * clamp(preVFwd / 30, 0.2, 1.0);
  const yawAccel =
    (torqueThrust + torqueBrakeSteer + torqueAlign - YAW_DAMPING * kart.yawRate) / KART_YAW_INERTIA;
  kart.yawRate = clamp(kart.yawRate + yawAccel * dt, -3.2, 3.2);
  kart.yaw = wrapAngle(kart.yaw + kart.yawRate * dt);

  // 4. 2D Rigid-Body Linear Forces: Thrust, Quadratic Aero Drag, Rolling Resistance,
  //    Slope Gravity, Braking & Moderate F1 Lateral Tire Friction + Aero Downforce
  const fx = Math.sin(kart.yaw);
  const fz = Math.cos(kart.yaw);
  const rx = Math.cos(kart.yaw);
  const rz = -Math.sin(kart.yaw);

  const vFwd = kart.vx * fx + kart.vz * fz;
  const vLat = kart.vx * rx + kart.vz * rz;
  const vMag = Math.hypot(kart.vx, kart.vz);

  const offroad = Math.abs(kart.lat) > circuit.roadHalfWidth && kart.boostTimer <= 0;
  const fAeroFwd = -AERO_DRAG_COEFF * vMag * vFwd;
  const fRoll = vFwd > 0.05 ? -ASPHALT_ROLLING_DRAG_N : vFwd < -0.05 ? ASPHALT_ROLLING_DRAG_N : 0;
  const fOffroad = offroad
    ? -Math.sign(vFwd) * (OFFROAD_EXTRA_DRAG_N + 120 * Math.abs(vFwd))
    : 0;
  const fGravity = -KART_MASS_KG * GRAVITY_MPS2 * Math.sin(kart.pitch);
  const fBrake = braking && vFwd > 0.05 ? -BRAKE_FORCE_N : 0;

  // Lateral tire friction capped by mechanical grip + F1 speed-squared aero downforce
  const muEff = offroad ? TIRE_LATERAL_MU * 0.72 : TIRE_LATERAL_MU;
  const aLatMax = muEff * GRAVITY_MPS2 + AERO_DOWNFORCE_COEFF * vFwd * vFwd;
  const aLatDesired = -TIRE_CORNERING_STIFFNESS * vLat;
  const aLatTire = clamp(aLatDesired, -aLatMax, aLatMax);
  const aAeroLat = -(AERO_DRAG_COEFF * vMag * vLat) / KART_MASS_KG;

  // Induced cornering tire-scrub drag when sliding laterally
  const aScrub =
    vFwd > 0.5
      ? -0.14 * Math.abs(aLatTire) * clamp(Math.abs(vLat) / 10, 0, 1)
      : 0;

  const aFwd =
    (fThrust + fAeroFwd + fRoll + fOffroad + fGravity + fBrake) / KART_MASS_KG + aScrub;
  const aLat = aLatTire + aAeroLat;

  let nextVFwd = vFwd + aFwd * dt;
  if (vFwd >= 0 && nextVFwd < 0) {
    nextVFwd = 0;
  }
  nextVFwd = Math.max(0, nextVFwd);

  let nextVLat = vLat + aLat * dt;
  if (Math.abs(aLatDesired) <= aLatMax && vLat !== 0 && Math.sign(nextVLat) !== Math.sign(vLat)) {
    nextVLat = 0;
  }

  kart.vx = fx * nextVFwd + rx * nextVLat;
  kart.vz = fz * nextVFwd + rz * nextVLat;
  kart.speed = nextVFwd;
  kart.lateralSlip = nextVLat;

  // Visual slip yaw & chassis roll reflect real angular velocity + lateral slide angle
  const realSlipAngle = Math.atan2(-nextVLat, Math.max(18, nextVFwd));
  const targetDriftYaw = clamp(realSlipAngle * 1.15 + kart.yawRate * 0.06, -0.34, 0.34);
  const targetRoll = clamp(kart.yawRate * 0.11 + realSlipAngle * 0.25, -0.24, 0.24);
  const blend = Math.min(1, dt * 10.5);
  kart.driftYaw += (targetDriftYaw - kart.driftYaw) * blend;
  kart.bodyRoll += (targetRoll - kart.bodyRoll) * blend;

  // 5. Advance 3D position along real 2D velocity vector
  const prevS = kart.s;
  kart.x += kart.vx * dt;
  kart.z += kart.vz * dt;

  // 6. Project onto circuit spline, snap altitude to 3D road surface, and enforce cushioned barriers
  const proj = projectOntoCircuit(circuit, kart.x, kart.z, prevS);
  const L = circuit.totalLength;

  // Signed arc delta handling the `L -> 0` finish-line wrap cleanly
  let ds = proj.s - prevS;
  if (ds < -L * 0.5) ds += L;
  if (ds > L * 0.5) ds -= L;
  kart.unwrappedS += ds;
  if (kart.unwrappedS > kart.maxUnwrappedS) {
    kart.maxUnwrappedS = kart.unwrappedS;
  }
  kart.s = proj.s;
  kart.lat = proj.lat;
  kart.y = proj.groundY;
  kart.pitch += (proj.pitch - kart.pitch) * Math.min(1, dt * 12);

  // Cushioned energy barrier at wallHalfWidth: resolves normal vs tangential 2D velocity
  if (Math.abs(kart.lat) > circuit.wallHalfWidth) {
    const outSign = Math.sign(kart.lat);
    const clampedLat = outSign * circuit.wallHalfWidth;
    const sample = sampleCircuitAtS(circuit, kart.s);
    kart.x = sample.x + sample.rx * clampedLat;
    kart.z = sample.z + sample.rz * clampedLat;
    kart.lat = clampedLat;

    const stx = Math.sin(sample.yaw);
    const stz = Math.cos(sample.yaw);
    const vTang = kart.vx * stx + kart.vz * stz;
    const vOut = (kart.vx * sample.rx + kart.vz * sample.rz) * outSign;
    const impactRatio = clamp(Math.max(0, vOut) / 40, 0, 1);
    const newVTang = Math.max(0, vTang * (0.94 - 0.14 * impactRatio));
    const newVOut = vOut > 0 ? -vOut * 0.16 : vOut;

    kart.vx = stx * newVTang + sample.rx * outSign * newVOut;
    kart.vz = stz * newVTang + sample.rz * outSign * newVOut;
    kart.yawRate *= 0.45;
    kart.yaw = wrapAngle(kart.yaw + wrapAngle(sample.yaw - kart.yaw) * 0.35);

    const nFx = Math.sin(kart.yaw);
    const nFz = Math.cos(kart.yaw);
    const nRx = Math.cos(kart.yaw);
    const nRz = -Math.sin(kart.yaw);
    kart.speed = Math.max(0, kart.vx * nFx + kart.vz * nFz);
    kart.lateralSlip = kart.vx * nRx + kart.vz * nRz;
  }

  // 7. Record tire skid marks only when actually slipping laterally or braking hard on asphalt
  if ((Math.abs(kart.lateralSlip) > 3.2 || braking) && kart.speed > 28) {
    const totalVisualYaw = kart.yaw + kart.driftYaw;
    const srx = Math.cos(totalVisualYaw);
    const srz = -Math.sin(totalVisualYaw);
    const backX = kart.x - Math.sin(totalVisualYaw) * 1.4;
    const backZ = kart.z - Math.cos(totalVisualYaw) * 1.4;
    kart.skidMarks.push({
      lx: backX - srx * 0.95,
      ly: kart.y + 0.08,
      lz: backZ - srz * 0.95,
      rx: backX + srx * 0.95,
      ry: kart.y + 0.08,
      rz: backZ + srz * 0.95,
    });
    if (kart.skidMarks.length > 38) {
      kart.skidMarks.shift();
    }
  }

  // 9. Monotonic lap crossing (`unwrappedS >= lap * totalLength`)
  if (kart.finishMs === null && kart.unwrappedS >= kart.lap * L) {
    const completedLap = kart.lap;
    const lapMs = Math.max(100, Math.round(elapsedMs - kart.lapStartMs));
    if (kart.bestLapMs === null || lapMs < kart.bestLapMs) {
      kart.bestLapMs = lapMs;
    }
    kart.lapStartMs = elapsedMs;
    kart.lap += 1;
    const finished = completedLap >= TOTAL_LAPS;
    if (finished) {
      kart.finishMs = Math.round(elapsedMs);
    }
    events.lapCompleted.push({
      slot: kart.slot,
      lap: completedLap,
      lapMs,
      finished,
    });
  }
}

/**
 * Advances the entire race by `dtMs` milliseconds (clamped for tab-switch safety),
 * resolving dual-thruster rigid-body physics, AI rivals, kart-to-kart bumping, and standings.
 */
export function stepRaceState(
  race: KartRaceState,
  humanInputs: Readonly<Record<number, ThrusterInput>>,
  dtMs: number,
): KartRaceState {
  const clampedMs = clamp(dtMs, 0, 50);
  const dt = clampedMs / 1000;
  const circuit = CIRCUITS[race.circuitId];
  const events: KartRaceEvents = {
    boostTriggered: [],
    lapCompleted: [],
    bumped: false,
  };

  if (clampedMs <= 0) {
    race.lastEvents = events;
    return race;
  }

  race.elapsedMs += clampedMs;
  const leaderUnwrappedS = Math.max(...race.karts.map((k) => k.unwrappedS));

  for (const kart of race.karts) {
    if (kart.isRemote) continue;
    if (kart.isHuman) {
      const input = humanInputs[kart.slot] ?? { left: false, right: false };
      stepSingleKart(kart, input, circuit, dt, race.elapsedMs, events, 1);
    } else {
      // Gentle arcade rubber-banding keeps AI competitive without unfair runaway leads
      const deltaToLeader = leaderUnwrappedS - kart.unwrappedS;
      const rubberBand = clamp(1 + deltaToLeader * 0.0011, 0.88, 1.08);
      const aiInput = computeAiThrusters(kart, circuit, leaderUnwrappedS);
      stepSingleKart(
        kart,
        aiInput,
        circuit,
        dt,
        race.elapsedMs,
        events,
        kart.aiBaseSkill * rubberBand,
      );
    }
  }

  // Kart-to-kart elastic sphere bumping with real 2D momentum exchange (`KART_RADIUS = 1.65m`)
  const minDist = 3.2;
  for (let i = 0; i < race.karts.length; i += 1) {
    for (let j = i + 1; j < race.karts.length; j += 1) {
      const a = race.karts[i]!;
      const b = race.karts[j]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001 && dist < minDist) {
        const overlap = (minDist - dist) * 0.52;
        const nx = dx / dist;
        const nz = dz / dist;
        const relVelNormal = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        const impulse = relVelNormal < 0 ? -0.68 * relVelNormal : 0;
        if (!a.isRemote) {
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          a.vx -= nx * impulse;
          a.vz -= nz * impulse;
        }
        if (!b.isRemote) {
          b.x += nx * overlap;
          b.z += nz * overlap;
          b.vx += nx * impulse;
          b.vz += nz * impulse;
        }
        events.bumped = true;
      }
    }
  }

  // Recompute live race standings (`1st .. Nth`): finished karts ordered by finishMs, racing karts by unwrappedS
  const sorted = [...race.karts].sort((a, b) => {
    if (a.finishMs !== null && b.finishMs !== null) return a.finishMs - b.finishMs;
    if (a.finishMs !== null) return -1;
    if (b.finishMs !== null) return 1;
    return b.unwrappedS - a.unwrappedS;
  });
  sorted.forEach((kart, idx) => {
    kart.place = idx + 1;
  });

  // Finish check: race ends as soon as all local human karts finish (or in online 2P when either finishes + settles)
  const localHumans = race.karts.filter((k) => k.isHuman && !k.isRemote);
  const allHumansDone =
    localHumans.length > 0 && localHumans.every((k) => k.finishMs !== null);
  if (race.status === 'racing' && allHumansDone) {
    race.status = 'finished';
    race.winnerSlot = sorted[0]?.slot ?? 0;
  }

  race.lastEvents = events;
  return race;
}

export function applyRemoteKartSnapshot(kart: KartState, snap: KartNetSnapshot): void {
  if (snap.character) {
    (kart as { character: DriverCharacterId }).character = snap.character;
  }
  kart.x = snap.x;
  kart.y = snap.y;
  kart.z = snap.z;
  kart.yaw = snap.yaw;
  kart.pitch = snap.pitch;
  kart.driftYaw = snap.driftYaw;
  kart.bodyRoll = snap.bodyRoll;
  kart.speed = snap.speed;
  kart.vx = snap.vx ?? Math.sin(snap.yaw) * snap.speed;
  kart.vz = snap.vz ?? Math.cos(snap.yaw) * snap.speed;
  kart.yawRate = snap.yawRate ?? 0;
  kart.lateralSlip = snap.lateralSlip ?? 0;
  kart.leftThrottle = snap.leftThrottle ?? (snap.leftThruster ? 1 : 0);
  kart.rightThrottle = snap.rightThrottle ?? (snap.rightThruster ? 1 : 0);
  kart.s = snap.s;
  kart.lat = snap.lat;
  kart.lap = snap.lap;
  kart.unwrappedS = snap.unwrappedS;
  kart.leftThruster = snap.leftThruster;
  kart.rightThruster = snap.rightThruster;
  kart.braking = Boolean(snap.braking);
  kart.boostTimer = snap.boostTimer;
  kart.boostKind = snap.boostKind;
  kart.bestLapMs = snap.bestLapMs;
  kart.finishMs = snap.finishMs;
}

export function toKartNetSnapshot(kart: KartState): KartNetSnapshot {
  return {
    character: kart.character,
    x: Math.round(kart.x * 100) / 100,
    y: Math.round(kart.y * 100) / 100,
    z: Math.round(kart.z * 100) / 100,
    yaw: Math.round(kart.yaw * 1000) / 1000,
    pitch: Math.round(kart.pitch * 1000) / 1000,
    driftYaw: Math.round(kart.driftYaw * 1000) / 1000,
    bodyRoll: Math.round(kart.bodyRoll * 1000) / 1000,
    speed: Math.round(kart.speed * 10) / 10,
    vx: Math.round(kart.vx * 10) / 10,
    vz: Math.round(kart.vz * 10) / 10,
    yawRate: Math.round(kart.yawRate * 1000) / 1000,
    lateralSlip: Math.round(kart.lateralSlip * 10) / 10,
    leftThrottle: Math.round(kart.leftThrottle * 100) / 100,
    rightThrottle: Math.round(kart.rightThrottle * 100) / 100,
    s: Math.round(kart.s * 10) / 10,
    lat: Math.round(kart.lat * 100) / 100,
    lap: kart.lap,
    unwrappedS: Math.round(kart.unwrappedS * 10) / 10,
    leftThruster: kart.leftThruster,
    rightThruster: kart.rightThruster,
    braking: kart.braking,
    boostTimer: Math.round(kart.boostTimer * 100) / 100,
    boostKind: kart.boostKind,
    bestLapMs: kart.bestLapMs,
    finishMs: kart.finishMs,
  };
}

export function getRecommendedSpeedAtS(circuit: CircuitDefinition, s: number): number {
  const sample = sampleCircuitAtS(circuit, s);
  return circuit.nodes[sample.nodeIndex]?.recommendedSpeed ?? MAX_STRAIGHT_SPEED;
}

/**
 * Predicts the kart's curved ground trajectory over the next `durationSec` seconds
 * (default `1.0s`) assuming the driver holds their current steering & thruster levels.
 * Used to draw the solid-to-transparent theme-colored trajectory shadow beneath and ahead
 * of the kart (#388).
 */
export function predictKartTrajectory(
  kart: KartState,
  circuit: CircuitDefinition,
  durationSec = 1.0,
  steps = 16,
): TrajectoryPoint[] {
  const dt = durationSec / Math.max(1, steps);
  let x = kart.x;
  let z = kart.z;
  let y = kart.y;
  let yaw = kart.yaw;
  let vx = kart.vx;
  let vz = kart.vz;
  let yawRate = kart.yawRate;
  let curS = kart.s;

  const fLeft = kart.leftThrottle * PER_THRUSTER_MAX_N;
  const fRight = kart.rightThrottle * PER_THRUSTER_MAX_N;
  const fThrust = fLeft + fRight;
  const torqueThrust = (fLeft - fRight) * THRUSTER_HALF_SPAN_M;
  const steerDir = kart.leftThrottle - kart.rightThrottle;
  const braking = kart.braking;

  const pts: TrajectoryPoint[] = [
    {
      x,
      y: y + 0.06,
      z,
      rx: Math.cos(yaw),
      rz: -Math.sin(yaw),
      t: 0,
      alpha: 0.85,
    },
  ];

  for (let i = 1; i <= steps; i += 1) {
    const preFx = Math.sin(yaw);
    const preFz = Math.cos(yaw);
    const preRx = Math.cos(yaw);
    const preRz = -Math.sin(yaw);
    const preVFwd = vx * preFx + vz * preFz;
    const preVLat = vx * preRx + vz * preRz;

    const torqueBrakeSteer =
      braking && Math.abs(steerDir) > 0.05
        ? clamp(steerDir, -1, 1) * 6800 * clamp(preVFwd / 22, 0.25, 1.0)
        : 0;
    const torqueAlign = SLIP_SELF_ALIGN_TORQUE * preVLat * clamp(preVFwd / 30, 0.2, 1.0);
    const yawAccel = (torqueThrust + torqueBrakeSteer + torqueAlign - YAW_DAMPING * yawRate) / KART_YAW_INERTIA;
    yawRate = clamp(yawRate + yawAccel * dt, -3.2, 3.2);
    yaw = wrapAngle(yaw + yawRate * dt);

    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const vFwd = vx * fx + vz * fz;
    const vLat = vx * rx + vz * rz;
    const vMag = Math.hypot(vx, vz);

    const fAeroFwd = -AERO_DRAG_COEFF * vMag * vFwd;
    const fRoll = vFwd > 0.05 ? -ASPHALT_ROLLING_DRAG_N : 0;
    const fBrake = braking && vFwd > 0.05 ? -BRAKE_FORCE_N : 0;

    const aLatMax = TIRE_LATERAL_MU * GRAVITY_MPS2 + AERO_DOWNFORCE_COEFF * vFwd * vFwd;
    const aLatDesired = -TIRE_CORNERING_STIFFNESS * vLat;
    const aLatTire = clamp(aLatDesired, -aLatMax, aLatMax);
    const aAeroLat = -(AERO_DRAG_COEFF * vMag * vLat) / KART_MASS_KG;
    const aScrub = vFwd > 0.5 ? -0.14 * Math.abs(aLatTire) * clamp(Math.abs(vLat) / 10, 0, 1) : 0;

    const aFwd = (fThrust + fAeroFwd + fRoll + fBrake) / KART_MASS_KG + aScrub;
    const aLat = aLatTire + aAeroLat;

    let nextVFwd = Math.max(0, vFwd + aFwd * dt);
    if (vFwd >= 0 && vFwd + aFwd * dt < 0) nextVFwd = 0;
    let nextVLat = vLat + aLat * dt;
    if (Math.abs(aLatDesired) <= aLatMax && vLat !== 0 && Math.sign(nextVLat) !== Math.sign(vLat)) {
      nextVLat = 0;
    }

    vx = fx * nextVFwd + rx * nextVLat;
    vz = fz * nextVFwd + rz * nextVLat;
    x += vx * dt;
    z += vz * dt;

    const proj = projectOntoCircuit(circuit, x, z, curS);
    curS = proj.s;
    y = proj.groundY;

    const frac = i / steps;
    const alpha = i === steps ? 0 : 0.85 * Math.pow(1 - frac, 1.55);
    pts.push({
      x,
      y: y + 0.06,
      z,
      rx,
      rz,
      t: frac * durationSec,
      alpha,
    });
  }

  return pts;
}

export function formatRaceClock(ms: number): string {
  if (ms === null || !Number.isFinite(ms)) return '--:--.--';
  const clamped = Math.max(0, Math.round(ms));
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const hundredths = Math.floor((clamped % 1000) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export function ordinalPlace(place: number): string {
  if (place === 1) return '1ST';
  if (place === 2) return '2ND';
  if (place === 3) return '3RD';
  return `${place}TH`;
}
