/**
 * Pure deterministic 3D circuit geometry, dual-thruster differential kart physics,
 * drift mini-turbo boost mechanics, spline AI rivals, kart-to-kart bumping, and
 * 3-lap race state for Micro Kart (#344, #358).
 */

export type CircuitId = 'sunset-loop' | 'canyon-crest' | 'starlight-ring' | 'cloud-gate';
export type KartRaceMode = '1p' | '2p-local' | '2p-online' | 'online-8p';
export type KartRaceFormat = 'grand-prix' | 'marathon';
export type BoostKind = 'none' | 'mini' | 'ultra' | 'pad';
export type DriverSpecies = 'fox' | 'cat' | 'dog' | 'bunny';
export type DriverCharacterId =
  | 'fox'
  | 'kiko'
  | 'yuzu'
  | 'cat'
  | 'dog'
  | 'hana'
  | 'poko'
  | 'bunny';
export type KartPortraitMood = 'happy' | 'normal' | 'anxious' | 'cry';

/**
 * Computes the live HUD portrait emotion for a kart based on race placement (#406):
 * - 1st place -> `'happy'`
 * - Last place while racing -> `'anxious'` (worried/sweating like Starlight Burst hurry-up)
 * - Last place when finished / race ends -> `'cry'` (teardrops)
 * - Middle places -> `'normal'`
 */
export function getKartPortraitMood(
  place: number,
  totalKarts: number,
  raceFinished: boolean,
  kartFinished = false,
): KartPortraitMood {
  if (place === 1) return 'happy';
  if (place >= totalKarts) {
    return raceFinished || kartFinished ? 'cry' : 'anxious';
  }
  return 'normal';
}

export interface KartDriverSpec {
  readonly id: DriverCharacterId;
  readonly species: DriverSpecies;
  readonly persona: 'boy' | 'girl';
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
    species: 'fox',
    persona: 'boy',
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
    id: 'kiko',
    species: 'fox',
    persona: 'girl',
    speciesLabel: 'Fox',
    driverName: 'Kiko',
    furPrimary: [244, 132, 124],
    furSecondary: [246, 215, 67],
    furCream: [255, 248, 244],
    scarfRgb: [246, 215, 67],
    kartPrimary: [244, 114, 148],
    kartAccent: [246, 215, 67],
    mapGlow: '#ff8a80',
  },
  {
    id: 'yuzu',
    species: 'cat',
    persona: 'boy',
    speciesLabel: 'Cat',
    driverName: 'Yuzu',
    furPrimary: [246, 206, 78],
    furSecondary: [232, 162, 52],
    furCream: [255, 252, 240],
    scarfRgb: [72, 209, 204],
    kartPrimary: [64, 196, 170],
    kartAccent: [255, 224, 102],
    mapGlow: '#ffd54f',
  },
  {
    id: 'cat',
    species: 'cat',
    persona: 'girl',
    speciesLabel: 'Cat',
    driverName: 'Mochi',
    furPrimary: [176, 107, 216],
    furSecondary: [242, 128, 152],
    furCream: [254, 248, 255],
    scarfRgb: [224, 96, 95],
    kartPrimary: [246, 215, 67],
    kartAccent: [224, 96, 95],
    mapGlow: '#c084fc',
  },
  {
    id: 'dog',
    species: 'dog',
    persona: 'boy',
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
    id: 'hana',
    species: 'dog',
    persona: 'girl',
    speciesLabel: 'Dog',
    driverName: 'Hana',
    furPrimary: [106, 214, 206],
    furSecondary: [244, 138, 168],
    furCream: [252, 255, 254],
    scarfRgb: [244, 138, 168],
    kartPrimary: [255, 154, 178],
    kartAccent: [148, 236, 224],
    mapGlow: '#64ffda',
  },
  {
    id: 'poko',
    species: 'bunny',
    persona: 'boy',
    speciesLabel: 'Bunny',
    driverName: 'Poko',
    furPrimary: [102, 168, 244],
    furSecondary: [246, 215, 67],
    furCream: [248, 252, 255],
    scarfRgb: [246, 215, 67],
    kartPrimary: [88, 132, 246],
    kartAccent: [250, 224, 108],
    mapGlow: '#60a5fa',
  },
  {
    id: 'bunny',
    species: 'bunny',
    persona: 'girl',
    speciesLabel: 'Bunny',
    driverName: 'Momo',
    furPrimary: [224, 96, 95],
    furSecondary: [246, 215, 67],
    furCream: [255, 248, 250],
    scarfRgb: [246, 215, 67],
    kartPrimary: [176, 107, 216],
    kartAccent: [246, 215, 67],
    mapGlow: '#f472b6',
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
  readonly kind:
    | 'pine'
    | 'spire'
    | 'pylon'
    | 'pavilion'
    | 'jade-pillar'
    | 'bonsai-pine'
    | 'lotus'
    | 'cloud-bank';
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
  /** `'ground'` for earth-backed circuits, `'starry'` for night sky, `'cloud-sea'` for suspended sky-viaduct circuits (#402). */
  readonly skyMode?: 'ground' | 'starry' | 'cloud-sea';
  /** Optional segment range `[start, end]` featuring an elevated turquoise Jade Pool basin flanking the causeway. */
  readonly jadePoolRange?: readonly [number, number];
  /** Optional segment range `[start, end]` hugging a carved white-jade cliff wall with a cantilevered golden pavilion. */
  readonly cliffRange?: readonly [number, number];
  /** Optional segment index spanned by a colossal carved white-jade Moon-Ring Arch & sky-waterfall. */
  readonly moonGateSeg?: number;
}

export interface CircuitDefinition {
  readonly id: CircuitId;
  readonly reversed: boolean;
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
    id: 'sakura',
    name: 'Sakura Rose',
    primary: [244, 114, 148],
    accent: [255, 224, 112],
    glow: '#ff8a80',
    helmet: [255, 245, 248],
  },
  {
    id: 'citrine',
    name: 'Citrine Teal',
    primary: [64, 196, 170],
    accent: [255, 224, 102],
    glow: '#ffd54f',
    helmet: [254, 252, 236],
  },
  {
    id: 'astral',
    name: 'Astral Violet',
    primary: [188, 140, 255],
    accent: [125, 211, 252],
    glow: '#c084fc',
    helmet: [250, 245, 255],
  },
  {
    id: 'verde',
    name: 'Verde Mint',
    primary: [63, 185, 80],
    accent: [230, 255, 180],
    glow: '#5fc27e',
    helmet: [240, 253, 244],
  },
  {
    id: 'aqua',
    name: 'Aqua Blossom',
    primary: [255, 154, 178],
    accent: [148, 236, 224],
    glow: '#64ffda',
    helmet: [240, 255, 252],
  },
  {
    id: 'cobalt',
    name: 'Cobalt Star',
    primary: [88, 132, 246],
    accent: [250, 224, 108],
    glow: '#60a5fa',
    helmet: [240, 246, 255],
  },
  {
    id: 'blaze',
    name: 'Blaze Coral',
    primary: [240, 101, 95],
    accent: [255, 214, 102],
    glow: '#f472b6',
    helmet: [254, 242, 242],
  },
];

export interface MarathonStage {
  readonly circuitId: CircuitId;
  readonly reversed: boolean;
}

export interface KartState {
  readonly slot: number;
  name: string;
  character: DriverCharacterId;
  isHuman: boolean;
  isRemote: boolean;
  liveryIndex: number;
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
  /** Marathon stage index (`0, 1, 2, ...` endlessly cycling all 8 forward + reverse circuits, #412). */
  stageIndex: number;
  /** Per-kart shuffled 8-course Portal Marathon schedule, lazily extended each Big Lap (#420). */
  marathonSchedule: MarathonStage[];
  /** UnwrappedS baseline where this kart entered its current Marathon stage. */
  stageStartUnwrappedS: number;
  /** Continuous lap-equivalent progress across portals (`stageIndex + localS / stageLen`). */
  marathonProgress: number;
  /** True once lapped & knocked out in Portal Marathon Knockout mode. */
  eliminated: boolean;
  eliminatedAtMs: number | null;
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
  /** Latched binary keyboard-equivalent AI decision (sticks until next jittered event, #394, #396). */
  aiInput: { readonly left: boolean; readonly right: boolean; readonly brake: boolean };
  /** Next race clock timestamp (ms) when this CPU is allowed to change buttons (randomized 200..400ms). */
  aiNextDecisionMs: number;
  aiLastDecisionMs: number | null;
  aiDecisionCount: number;
  /** Per-kart deterministic PRNG state for randomized 200..400ms control timing jitter. */
  aiRngState: number;
  skidMarks: SkidMark[];
}

export interface KartRaceEvents {
  boostTriggered: Array<{ slot: number; kind: BoostKind }>;
  lapCompleted: Array<{ slot: number; lap: number; lapMs: number; finished: boolean }>;
  portalCrossed: Array<{
    slot: number;
    fromStageIndex: number;
    toStageIndex: number;
    fromCircuitId: CircuitId;
    fromReversed: boolean;
    toCircuitId: CircuitId;
    toReversed: boolean;
  }>;
  eliminated: Array<{ slot: number; place: number; name: string }>;
  bumped: boolean;
}

export interface MarathonHuntState {
  readonly hunterSlot: number;
  readonly preySlot: number;
  readonly hunterName: string;
  readonly preyName: string;
  readonly targetCircuitId: CircuitId;
  readonly targetReversed: boolean;
  /** True once the hunter has warped onto the prey's exact track & direction for the physical pass! */
  readonly onSameRoad: boolean;
}

export interface KartRaceState {
  readonly circuitId: CircuitId;
  readonly reversed: boolean;
  readonly format: KartRaceFormat;
  readonly mode: KartRaceMode;
  readonly totalLaps: number;
  readonly seed: number;
  elapsedMs: number;
  status: 'racing' | 'finished';
  winnerSlot: number | null;
  /** Current stage gap between 1st place and last surviving kart in Portal Marathon mode (`0..8+`). */
  marathonLeadGapLaps: number;
  /** Active Portal Homing hunt state when 1st place is within 1 track of lapping last place (`gap >= 7.0`, #422). */
  marathonHunt: MarathonHuntState | null;
  /** Number of non-eliminated karts still racing in Portal Marathon mode. */
  survivorsCount: number;
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
/** Randomized CPU binary button decision hold window (200 ms .. 400 ms jittered, #394, #396). */
export const AI_DECISION_MIN_MS = 200;
export const AI_DECISION_MAX_MS = 400;

// Rotational dynamics & 2D rigid-body bumper footprint (#384, #388, #390)
export const THRUSTER_HALF_SPAN_M = 0.68;
export const KART_YAW_INERTIA = 1400;
export const YAW_DAMPING = 6500;
/** Center of mass offset along kart forward axis (slightly rear-biased toward the rockets). */
export const KART_COM_Z_OFFSET = -0.22;
export const KART_HALF_WIDTH = 1.25;
export const KART_HALF_LENGTH = 2.05;
/** Forward offset from kart center to the front bumper nose where the trajectory path starts. */
export const KART_NOSE_OFFSET_M = 2.15;

// Planted F1 lateral tire friction + speed-squared downforce (controlled, low-skid feel)
export const TIRE_LATERAL_MU = 4.6;
export const AERO_DOWNFORCE_COEFF = 0.0024;
export const TIRE_CORNERING_STIFFNESS = 18.0;
export const SLIP_SELF_ALIGN_TORQUE = 180;

/** Approximate single-thruster equilibrium (~71% top speed) & +50% force road boost equilibrium (~122 m/s). */
export const MAX_DRIFT_SPEED = Math.round(MAX_STRAIGHT_SPEED * Math.SQRT1_2);
export const ROAD_BOOST_FORCE_MULT = 1.5;
export const ROAD_BOOST_DURATION_SEC = 5.0;
export const MAX_BOOST_SPEED = Math.round(MAX_STRAIGHT_SPEED * Math.sqrt(ROAD_BOOST_FORCE_MULT));
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
      skyMode: 'starry',
    },
    seed: 303,
  },
  {
    id: 'cloud-gate',
    name: 'Cloud Gate',
    subtitle: 'White-jade sky viaduct & sea of clouds',
    roadHalfWidth: 16.0,
    evalPoint(u: number) {
      // Sweeping elevated Heavenly Palace sky circuit (`~1,975 m`):
      // Soars up sky-stairs from South Heaven Gate -> Colossal Moon-Ring & Sky-Waterfall ->
      // flat emerald Jade Pool basin bridged by a soaring +11m White-Jade Arch Bridge hill ->
      // Immortal Cliff cut -> open Cloud-Sea viaduct descent!
      const x =
        312 * Math.sin(u) +
        62 * Math.sin(2 * u + 0.3) -
        28 * Math.sin(3 * u - 0.45);
      const z =
        282 * Math.cos(u) -
        54 * Math.cos(2 * u - 0.25) +
        24 * Math.sin(3 * u + 0.6);

      // Base sky elevation undulating gently across cloud viaduct & cliff sections
      let baseY =
        16.5 +
        9.5 * Math.sin(u - 0.2) -
        4.2 * Math.cos(2 * u + 0.4) +
        2.0 * Math.sin(3 * u);

      // Level the Jade Pool basin (`segs 64..96`, `u in [2.094 .. 3.142]`) smoothly to `pondY = 14.0 m`,
      // then sculpt a dramatic +11.2m semicircular White-Jade Belt Arch Bridge hill (`segs 68..92`)!
      const jpStartU = (64 / TRACK_SEGMENTS) * Math.PI * 2;
      const jpEndU = (96 / TRACK_SEGMENTS) * Math.PI * 2;
      const jpMidU = (jpStartU + jpEndU) * 0.5;
      const jpHalfU = (jpEndU - jpStartU) * 0.5;
      const pondY = 14.0;
      const distFromPool = Math.abs(u - jpMidU);
      if (distFromPool < jpHalfU + 0.38) {
        // Smooth flat-blend into the calm emerald pond level
        const blend =
          distFromPool <= jpHalfU
            ? 1.0
            : 0.5 * (1 + Math.cos(((distFromPool - jpHalfU) / 0.38) * Math.PI));
        baseY = baseY * (1 - blend) + pondY * blend;
      }

      // Semicircular White-Jade Belt Arch Bridge hump (`玉带桥`, `segs 68..92`, +11.2m peak at seg 80)
      const bridgeHalfU = (12 / TRACK_SEGMENTS) * Math.PI * 2;
      if (distFromPool < bridgeHalfU) {
        const archPhase = (distFromPool / bridgeHalfU) * Math.PI;
        baseY += 11.2 * 0.5 * (1 + Math.cos(archPhase));
      }

      return { x, y: baseY, z };
    },
    boostSegments: [
      { seg: 14, lat: 0 },
      { seg: 54, lat: -3.2 },
      { seg: 84, lat: 0 },
      { seg: 126, lat: 3.4 },
      { seg: 168, lat: 0 },
    ],
    theme: {
      skyTop: '#2f6da8',
      skyHorizon: '#f5e2ba',
      fogHex: [228, 224, 212],
      groundOuter: '#e8eef5',
      groundAlt: '#d4e2ef',
      mountainHex: '#7fa1be',
      roadDark: '#45546a',
      roadLight: '#50617a',
      curbA: '#f2efe6',
      curbB: '#c84232',
      propKind: 'pavilion',
      skyMode: 'cloud-sea',
      jadePoolRange: [64, 96],
      cliffRange: [104, 132],
      moonGateSeg: 46,
    },
    seed: 404,
  },
];

function buildCircuit(spec: CircuitSpec, reversed = false): CircuitDefinition {
  const N = TRACK_SEGMENTS;
  const rawPts = Array.from({ length: N }, (_, i) => {
    const srcIdx = reversed ? (N - i) % N : i;
    const u = (srcIdx / N) * Math.PI * 2;
    return { u, ...spec.evalPoint(u) };
  });

  // Mirror Cloud Gate segment ranges when driving in reverse so landmarks align 1:1 with elevation & spline (#410)
  const theme: CircuitTheme = reversed
    ? {
        ...spec.theme,
        jadePoolRange: spec.theme.jadePoolRange
          ? [N - spec.theme.jadePoolRange[1], N - spec.theme.jadePoolRange[0]]
          : undefined,
        cliffRange: spec.theme.cliffRange
          ? [N - spec.theme.cliffRange[1], N - spec.theme.cliffRange[0]]
          : undefined,
        moonGateSeg:
          spec.theme.moonGateSeg !== undefined
            ? (N - spec.theme.moonGateSeg) % N
            : undefined,
      }
    : spec.theme;

  const boostMap = new Map<number, number>();
  for (const b of spec.boostSegments) {
    const seg = reversed ? (N - b.seg) % N : ((b.seg % N) + N) % N;
    const lat = reversed ? -b.lat : b.lat;
    boostMap.set(seg, lat);
    boostMap.set((seg + 1) % N, lat);
  }

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
    const boostLat = boostMap.get(i);
    return {
      ...n,
      recommendedSpeed: Math.round(smoothed * 10) / 10,
      hasBoostPad: boostLat !== undefined,
      boostLat: boostLat ?? 0,
    };
  });

  // Deterministic low-poly roadside scenery outside the track barriers
  const rng = mulberry32(spec.seed);
  const scenery: SceneryProp[] = [];
  if (theme.skyMode === 'cloud-sea') {
    const [jpStart, jpEnd] = theme.jadePoolRange ?? [-1, -1];
    const [clStart, clEnd] = theme.cliffRange ?? [-1, -1];

    for (let i = 0; i < N; i += 2) {
      const node = nodes[i]!;
      const inJadePool = i >= jpStart && i <= jpEnd;
      const inCliff = i >= clStart && i <= clEnd;

      // 1. White-jade cloud pillars with warm glowing palace lanterns lining viaduct edges
      if (i % 8 === 0 && i !== 0) {
        for (const side of [-1, 1] as const) {
          const dist = spec.roadHalfWidth + 2.4;
          scenery.push({
            kind: 'jade-pillar',
            x: node.x + node.rx * side * dist,
            y: node.y,
            z: node.z + node.rz * side * dist,
            scale: 1.0,
            yaw: Math.atan2(node.tx, node.tz),
          });
        }
      }

      // 2. Restrained, sculptural Glowing Glass Lotus Blossoms (~10-12 across the Jade Pool pond, #404, #406)
      if (inJadePool && i % 6 === 0) {
        const pondWaterY = Math.min(nodes[jpStart]!.y, nodes[jpEnd]!.y) - 0.24;
        for (const side of [-1, 1] as const) {
          const dist = spec.roadHalfWidth + 6.5 + rng() * 15.5;
          scenery.push({
            kind: 'lotus',
            x: node.x + node.rx * side * dist,
            y: pondWaterY,
            z: node.z + node.rz * side * dist,
            scale: 1.25 + rng() * 0.5,
            yaw: rng() * Math.PI * 2,
          });
        }
      }

      // 3. Sculpted 3D sunlit cloud-sea banks drifting BELOW the suspended sky viaduct!
      if (!inJadePool && i % 4 === 0) {
        const underSide = (i / 4) % 2 === 0 ? -1 : 1;
        const cloudDist = 14 + rng() * 34;
        const cloudDrop = 5.5 + rng() * 9.5;
        scenery.push({
          kind: 'cloud-bank',
          x: node.x + node.rx * underSide * cloudDist,
          y: node.y - cloudDrop,
          z: node.z + node.rz * underSide * cloudDist,
          scale: 1.3 + rng() * 1.15,
          yaw: rng() * Math.PI * 2,
        });
        // Also place a broad sunlit cloud directly underneath the bridge span every 8 segments
        if (i % 8 === 0) {
          scenery.push({
            kind: 'cloud-bank',
            x: node.x + node.rx * ((rng() - 0.5) * 16),
            y: node.y - (8.5 + rng() * 6.5),
            z: node.z + node.rz * ((rng() - 0.5) * 16),
            scale: 1.65 + rng() * 0.9,
            yaw: rng() * Math.PI * 2,
          });
        }
      }

      // 4. Floating golden-eaved mini-pavilions & gnarled bonsai sky-pines on floating rock islets
      if (i % 14 === 4) {
        const side = inCliff ? 1 : (Math.floor(i / 14) % 2 === 0 ? 1 : -1);
        const dist = spec.roadHalfWidth + 24 + rng() * 26;
        scenery.push({
          kind: 'pavilion',
          x: node.x + node.rx * side * dist,
          y: node.y + (rng() - 0.35) * 9,
          z: node.z + node.rz * side * dist,
          scale: 0.95 + rng() * 0.5,
          yaw: Math.atan2(-node.rx * side, -node.rz * side),
        });
      }
      if (i % 10 === 2) {
        const side = inCliff ? -1 : (Math.floor(i / 10) % 2 === 0 ? -1 : 1);
        const dist = inCliff
          ? spec.roadHalfWidth + 11 + rng() * 10
          : spec.roadHalfWidth + 15 + rng() * 24;
        scenery.push({
          kind: 'bonsai-pine',
          x: node.x + node.rx * side * dist,
          y: inCliff ? node.y + 4 + rng() * 12 : node.y + (rng() - 0.5) * 5,
          z: node.z + node.rz * side * dist,
          scale: 0.9 + rng() * 0.55,
          yaw: rng() * Math.PI * 2,
        });
      }
    }
  } else {
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
  }

  return {
    id: spec.id,
    reversed,
    name: spec.name,
    subtitle: spec.subtitle,
    roadHalfWidth: spec.roadHalfWidth,
    wallHalfWidth: spec.roadHalfWidth + 1.8,
    totalLength,
    nodes,
    scenery,
    theme,
  };
}

export const CIRCUITS: Readonly<Record<CircuitId, CircuitDefinition>> = {
  'sunset-loop': buildCircuit(CIRCUIT_SPECS[0]!, false),
  'canyon-crest': buildCircuit(CIRCUIT_SPECS[1]!, false),
  'starlight-ring': buildCircuit(CIRCUIT_SPECS[2]!, false),
  'cloud-gate': buildCircuit(CIRCUIT_SPECS[3]!, false),
};

export const CIRCUITS_REVERSED: Readonly<Record<CircuitId, CircuitDefinition>> = {
  'sunset-loop': buildCircuit(CIRCUIT_SPECS[0]!, true),
  'canyon-crest': buildCircuit(CIRCUIT_SPECS[1]!, true),
  'starlight-ring': buildCircuit(CIRCUIT_SPECS[2]!, true),
  'cloud-gate': buildCircuit(CIRCUIT_SPECS[3]!, true),
};

export function getCircuit(id: CircuitId, reversed = false): CircuitDefinition {
  return reversed ? CIRCUITS_REVERSED[id] : CIRCUITS[id];
}

export const CIRCUIT_LIST: readonly CircuitDefinition[] = [
  CIRCUITS['sunset-loop'],
  CIRCUITS['canyon-crest'],
  CIRCUITS['starlight-ring'],
  CIRCUITS['cloud-gate'],
];

/** Returns the next circuit in Grand Prix rotation (Sunset Loop -> Canyon Crest -> Starlight Ring -> Cloud Gate -> Sunset Loop, #400). */
export function getNextCircuitId(id: CircuitId): CircuitId {
  const idx = CIRCUIT_LIST.findIndex((c) => c.id === id);
  return CIRCUIT_LIST[(idx + 1) % CIRCUIT_LIST.length]!.id;
}

/**
 * Full 2x Grand Prix cycle (#410):
 * Races all circuits forward, then flips into Reverse for the second cycle
 * before wrapping back to Forward (`4 circuits -> 8-race full cycle`).
 */
export function getNextRaceStage(
  id: CircuitId,
  reversed = false,
): { circuitId: CircuitId; reversed: boolean } {
  const idx = CIRCUIT_LIST.findIndex((c) => c.id === id);
  const nextIdx = (idx + 1) % CIRCUIT_LIST.length;
  const wrapped = nextIdx === 0;
  return {
    circuitId: CIRCUIT_LIST[nextIdx]!.id,
    reversed: wrapped ? !reversed : reversed,
  };
}

export function formatCircuitTitle(id: CircuitId, reversed = false): string {
  const name = CIRCUITS[id].name;
  return reversed ? `${name} ↺ Reverse` : name;
}

/** Full Portal Marathon cycle length: 4 physical tracks Forward + 4 Reverse = 8 stages (#418). */
export const MARATHON_CYCLE_STAGES = CIRCUIT_LIST.length * 2;

/**
 * Maps an unbounded Portal Marathon stage index (`0, 1, 2, ...`) onto the
 * endless 8-stage Forward + Reverse cycle (#412, #418):
 *  - `0..3`: 4 physical tracks Forward (`1, 2, 3, 4`)
 *  - `4..7`: 4 physical tracks Reverse (`1', 2', 3', 4'`)
 *  - `8..11`: back to Forward (`1, 2, 3, 4`) ... endlessly!
 */
export function getMarathonStage(
  stageIndex: number,
  startCircuitId: CircuitId = 'sunset-loop',
  startReversed = false,
): { circuitId: CircuitId; reversed: boolean } {
  const n = CIRCUIT_LIST.length;
  const startBase = Math.max(0, CIRCUIT_LIST.findIndex((c) => c.id === startCircuitId));
  const startOffset = startBase + (startReversed ? n : 0);
  const fullCycle = MARATHON_CYCLE_STAGES;
  const totalIdx = (((startOffset + stageIndex) % fullCycle) + fullCycle) % fullCycle;
  return {
    circuitId: CIRCUIT_LIST[totalIdx % n]!.id,
    reversed: totalIdx >= n,
  };
}

const ALL_MARATHON_STAGES: readonly MarathonStage[] = [
  ...CIRCUIT_LIST.map((c) => ({ circuitId: c.id, reversed: false })),
  ...CIRCUIT_LIST.map((c) => ({ circuitId: c.id, reversed: true })),
];

/**
 * Generates a uniformly randomized 8-course Portal Marathon cycle (`{1,2,3,4,1',2',3',4'}`)
 * enforcing that NO two adjacent stages share the same physical `circuitId` (never `1 -> 1'` or `4' -> 4`)
 * both within the cycle and across the boundary from `prevLastCircuitId` (#420).
 */
export function generateMarathonCycleOrder(
  rng: () => number,
  options?: {
    fixedFirst?: MarathonStage | null;
    forbiddenFirstCircuitId?: CircuitId | null;
  },
): MarathonStage[] {
  const fixedFirst = options?.fixedFirst ?? null;
  const forbiddenFirstId = options?.forbiddenFirstCircuitId ?? null;
  const remaining = ALL_MARATHON_STAGES.filter(
    (s) => !(fixedFirst && s.circuitId === fixedFirst.circuitId && s.reversed === fixedFirst.reversed),
  );
  const out: MarathonStage[] = fixedFirst ? [fixedFirst] : [];
  const used = new Uint8Array(remaining.length);

  function solve(): boolean {
    if (out.length === ALL_MARATHON_STAGES.length) return true;
    const prevId = out.length > 0 ? out[out.length - 1]!.circuitId : forbiddenFirstId;
    const cands: number[] = [];
    for (let i = 0; i < remaining.length; i += 1) {
      if (!used[i] && remaining[i]!.circuitId !== prevId) {
        cands.push(i);
      }
    }
    for (let i = cands.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = cands[i]!;
      cands[i] = cands[j]!;
      cands[j] = tmp;
    }
    for (const idx of cands) {
      used[idx] = 1;
      out.push(remaining[idx]!);
      if (solve()) return true;
      out.pop();
      used[idx] = 0;
    }
    return false;
  }

  solve();
  return out;
}

/**
 * Resolves a specific kart's shuffled Portal Marathon stage at any unbounded `stageIndex` (#420).
 * Lazily extends `kart.marathonSchedule` one fresh shuffled 8-course Big Lap at a time:
 * - Big Lap 1 (`cycle 0`): every kart starts on `race.circuitId` (`stage 0`), then follows its own shuffle.
 * - Big Lap 2+ (`cycle >= 1`): freshly shuffles all 8 courses so any course (except the prior track's id) can be first!
 */
export function getMarathonStageForKart(
  race: KartRaceState,
  kart: KartState,
  stageIndex: number = kart.stageIndex,
): MarathonStage {
  const safeIdx = Math.max(0, stageIndex);
  while (kart.marathonSchedule.length <= safeIdx) {
    const cycleIdx = Math.floor(kart.marathonSchedule.length / MARATHON_CYCLE_STAGES);
    const cycleSeed =
      (Math.imul(race.seed + 17, 2654435761) ^
        Math.imul(kart.slot + 1, 1013904223) ^
        Math.imul(cycleIdx + 1, 2246822519)) >>>
      0;
    const cycleRng = mulberry32(cycleSeed || 1);
    const prevLastId =
      kart.marathonSchedule.length > 0
        ? kart.marathonSchedule[kart.marathonSchedule.length - 1]!.circuitId
        : null;
    const nextCycle = generateMarathonCycleOrder(cycleRng, {
      fixedFirst:
        cycleIdx === 0 ? { circuitId: race.circuitId, reversed: race.reversed } : null,
      forbiddenFirstCircuitId: prevLastId,
    });
    kart.marathonSchedule.push(...nextCycle);
  }
  return kart.marathonSchedule[safeIdx]!;
}

/** Resolves the active circuit definition for a specific kart (per-kart shuffled stage in Marathon, shared in Grand Prix, #412, #420). */
export function getCircuitForKart(race: KartRaceState, kart: KartState): CircuitDefinition {
  if (race.format === 'marathon') {
    const st = getMarathonStageForKart(race, kart, kart.stageIndex);
    return getCircuit(st.circuitId, st.reversed);
  }
  return getCircuit(race.circuitId, race.reversed);
}

/**
 * Rigid-body 3D portal coordinate transform from `fromCircuit`'s start/finish gate
 * (`nodes[0]`) into `toCircuit`'s start/finish gate (`nodes[0]`) (#412).
 * Used identically for:
 *  1) Rendering the live Valve-Portal stencil camera looking into the next circuit, and
 *  2) Snapping the chase camera seamlessly the exact frame a kart crosses the portal!
 */
export function transformPoseThroughPortal(
  pose: { x: number; y: number; z: number; yaw: number },
  fromCircuit: CircuitDefinition,
  toCircuit: CircuitDefinition,
): { x: number; y: number; z: number; yaw: number } {
  const g0 = fromCircuit.nodes[0]!;
  const g1 = toCircuit.nodes[0]!;
  const h0 = Math.hypot(g0.tx, g0.tz) || 1;
  const tx0 = g0.tx / h0;
  const tz0 = g0.tz / h0;
  const h1 = Math.hypot(g1.tx, g1.tz) || 1;
  const tx1 = g1.tx / h1;
  const tz1 = g1.tz / h1;
  const dx = pose.x - g0.x;
  const dy = pose.y - g0.y;
  const dz = pose.z - g0.z;
  const fwd = dx * tx0 + dz * tz0;
  const lat = dx * g0.rx + dz * g0.rz;
  const yaw0 = Math.atan2(tx0, tz0);
  const yaw1 = Math.atan2(tx1, tz1);
  const relYaw = wrapAngle(pose.yaw - yaw0);
  return {
    x: g1.x + tx1 * fwd + g1.rx * lat,
    y: g1.y + dy,
    z: g1.z + tz1 * fwd + g1.rz * lat,
    yaw: wrapAngle(yaw1 + relYaw),
  };
}

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
    reversed?: boolean;
    format?: KartRaceFormat;
    humanRoster?: Array<{ slot: number; name: string; character: DriverCharacterId }>;
  },
): KartRaceState {
  const reversed = Boolean(options?.reversed);
  const format: KartRaceFormat = options?.format ?? 'grand-prix';
  const circuit = getCircuit(circuitId, reversed);
  const rng = mulberry32(seed);
  const L = circuit.totalLength;

  const allChars: DriverCharacterId[] = KART_DRIVERS.map((d) => d.id);
  const rosterBySlot = new Map<number, { name: string; character: DriverCharacterId }>();
  let slotCharacters: DriverCharacterId[];
  if (options?.humanRoster && options.humanRoster.length > 0) {
    const used = new Set<DriverCharacterId>();
    for (const entry of options.humanRoster) {
      if (entry.slot < 0 || entry.slot >= 8) continue;
      let chosen = entry.character;
      if (used.has(chosen)) {
        chosen = allChars.find((c) => !used.has(c)) ?? chosen;
      }
      used.add(chosen);
      rosterBySlot.set(entry.slot, { name: entry.name, character: chosen });
    }
    const remaining = allChars.filter((c) => !used.has(c));
    slotCharacters = [];
    for (let s = 0; s < 8; s += 1) {
      const assigned = rosterBySlot.get(s);
      if (assigned) {
        slotCharacters.push(assigned.character);
      } else {
        slotCharacters.push(remaining.shift() ?? allChars[s % allChars.length]!);
      }
    }
  } else {
    const p1Char: DriverCharacterId = options?.p1Character ?? 'fox';
    const remainingAfterP1 = allChars.filter((c) => c !== p1Char);
    const p2Char: DriverCharacterId =
      options?.p2Character && options.p2Character !== p1Char
        ? options.p2Character
        : remainingAfterP1[0]!;
    const aiChars = allChars.filter((c) => c !== p1Char && c !== p2Char);
    slotCharacters = [p1Char, p2Char, ...aiChars];
  }

  // Staggered 4x2 F1 starting grid behind the start/finish arch (#430):
  // 6 AI rivals fill rows 1-3 (`10m, 18m, 26m` behind line) and human karts (`slot 0, 1`)
  // launch from row 4 (`34m` behind line) looking straight down an epic 8-kart pack!
  const gridOffsets: ReadonlyArray<{ backMeters: number; lat: number }> = [
    { backMeters: 34, lat: -3.8 },
    { backMeters: 34, lat: 3.8 },
    { backMeters: 26, lat: -3.8 },
    { backMeters: 26, lat: 3.8 },
    { backMeters: 18, lat: -3.8 },
    { backMeters: 18, lat: 3.8 },
    { backMeters: 10, lat: -3.8 },
    { backMeters: 10, lat: 3.8 },
  ];

  const count = mode === '2p-online' ? 2 : 8;
  const karts: KartState[] = [];

  for (let slot = 0; slot < count; slot += 1) {
    const grid = gridOffsets[slot]!;
    const startS = L - grid.backMeters;
    const sample = sampleCircuitAtS(circuit, startS);
    const charId = slotCharacters[slot]!;
    const driverSpec = getKartDriverSpec(charId);
    const liveryIndex = KART_DRIVERS.findIndex((d) => d.id === charId);
    const rosterEntry = rosterBySlot.get(slot);
    const isHuman =
      mode === 'online-8p'
        ? Boolean(rosterEntry)
        : slot === 0 || (slot === 1 && mode === '2p-local');
    const isRemote = slot === 1 && mode === '2p-online';
    const defaultName =
      rosterEntry
        ? rosterEntry.name
        : slot === 0
        ? options?.p1 ?? driverSpec.driverName
        : slot === 1 && (mode === '2p-local' || mode === '2p-online')
          ? options?.p2 ?? driverSpec.driverName
          : driverSpec.driverName;

    karts.push({
      slot,
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
      stageIndex: 0,
      marathonSchedule:
        format === 'marathon'
          ? generateMarathonCycleOrder(
              mulberry32(
                ((Math.imul(seed + 17, 2654435761) ^ Math.imul(slot + 1, 1013904223) ^ 2246822519) >>> 0) ||
                  1,
              ),
              { fixedFirst: { circuitId, reversed } },
            )
          : [],
      stageStartUnwrappedS: 0,
      marathonProgress: -grid.backMeters / L,
      eliminated: false,
      eliminatedAtMs: null,
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
      aiBaseSkill: 0.88 + (slot / Math.max(1, count - 1)) * 0.11 + rng() * 0.025,
      aiInput: { left: false, right: false, brake: false },
      // Stagger each CPU slot's first decision across [60..340] ms so all 7 AI rivals start unsynchronized (#394, #430)
      aiNextDecisionMs:
        ([0, 65, 115, 165, 210, 255, 300, 340][slot] ?? slot * 50) + Math.round(rng() * 25),
      aiLastDecisionMs: null,
      aiDecisionCount: 0,
      aiRngState: ((seed ^ ((slot + 1) * 0x9e3779b1)) >>> 0) || 1,
      skidMarks: [],
    });
  }

  return {
    circuitId,
    reversed,
    format,
    mode,
    totalLaps: format === 'marathon' ? Number.POSITIVE_INFINITY : TOTAL_LAPS,
    seed,
    elapsedMs: 0,
    status: 'racing',
    winnerSlot: null,
    marathonLeadGapLaps: 0,
    marathonHunt: null,
    survivorsCount: karts.length,
    karts,
    lastEvents: {
      boostTriggered: [],
      lapCompleted: [],
      portalCrossed: [],
      eliminated: [],
      bumped: false,
    },
  };
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return target;
}

function nextAiRandom(kart: KartState): number {
  let s = (kart.aiRngState + 0x6d2b79f5) >>> 0;
  kart.aiRngState = s;
  s = Math.imul(s ^ (s >>> 15), 1 | s);
  s ^= s + Math.imul(s ^ (s >>> 7), 61 | s);
  return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
}

/**
 * Projects a kart forward using the exact same rigid-body physics as the driver's
 * nose-anchored 1.0-second trajectory shadow (`predictKartTrajectory`), holding a candidate
 * binary button state `(leftBtn, rightBtn, braking)` for `holdSec` (worst-case latency
 * `0.40 s`) and letting the shadow track continue to `totalSec` (`1.0 s`) (#398).
 */
export function projectKartShadowForButtons(
  kart: KartState,
  circuit: CircuitDefinition,
  leftBtn: boolean,
  rightBtn: boolean,
  braking: boolean,
  holdSec: number,
  totalSec = 1.0,
  steps = 10,
): { x: number; z: number; yaw: number; s: number; lat: number } {
  const dt = totalSec / Math.max(1, steps);
  let x = kart.x;
  let z = kart.z;
  let yaw = kart.yaw;
  let vx = kart.vx;
  let vz = kart.vz;
  let yawRate = kart.yawRate;
  let lt = kart.leftThrottle;
  let rt = kart.rightThrottle;
  let curS = kart.s;

  const boostMult = kart.boostTimer > 0 && kart.boostKind === 'pad' ? ROAD_BOOST_FORCE_MULT : 1.0;

  for (let i = 0; i < steps; i += 1) {
    const holding = i * dt < holdSec;
    const stepL = holding ? leftBtn : false;
    const stepR = holding ? rightBtn : false;
    const stepBrake = holding ? braking : false;
    const targetL = stepBrake ? 0 : stepL ? 0 : 1;
    const targetR = stepBrake ? 0 : stepR ? 0 : 1;
    const rampRate = stepBrake ? 1 / BRAKE_CUT_RAMP_SEC : 1 / THRUSTER_RAMP_SEC;
    const steerDir = stepL ? -1 : stepR ? 1 : 0;

    lt = moveToward(lt, targetL, dt * rampRate);
    rt = moveToward(rt, targetR, dt * rampRate);

    const fLeft = lt * PER_THRUSTER_MAX_N * boostMult;
    const fRight = rt * PER_THRUSTER_MAX_N * boostMult;
    const fThrust = fLeft + fRight;
    const torqueThrust = (fLeft - fRight) * THRUSTER_HALF_SPAN_M;

    const preFx = Math.sin(yaw);
    const preFz = Math.cos(yaw);
    const preRx = Math.cos(yaw);
    const preRz = -Math.sin(yaw);
    const preVFwd = vx * preFx + vz * preFz;
    const preVLat = vx * preRx + vz * preRz;

    const torqueBrakeSteer =
      stepBrake && steerDir !== 0
        ? steerDir * 6800 * clamp(preVFwd / 22, 0.25, 1.0)
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
    const fBrake = stepBrake && vFwd > 0.05 ? -BRAKE_FORCE_N : 0;

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
    const stepProj = projectOntoCircuit(circuit, x, z, curS);
    curS = stepProj.s;
  }

  const endFx = Math.sin(yaw);
  const endFz = Math.cos(yaw);
  const noseX = x + endFx * KART_NOSE_OFFSET_M;
  const noseZ = z + endFz * KART_NOSE_OFFSET_M;
  const proj = projectOntoCircuit(circuit, noseX, noseZ, curS);
  return { x: noseX, z: noseZ, yaw, s: proj.s, lat: proj.lat };
}

/**
 * Shadow-projection binary AI pilot (#394, #396, #398):
 * - Restricted to binary keyboard controls (`left`, `right`, or `none`, plus independent `brake`,
 *   NO `steerAnalog`) with randomized `200..400 ms` hold intervals.
 * - Brake compares current speed directly against the track's recommended speed (`getRecommendedSpeedAtS`).
 * - Steering projects the kart out to worst-case latency (`AI_DECISION_MAX_MS = 400 ms`) using the
 *   same shadow-track physics as the player's trajectory path, picking whichever of `left`, `none`,
 *   or `right` lands closest to the middle of the road (`lat = 0`).
 */
function computeAiThrusters(
  kart: KartState,
  circuit: CircuitDefinition,
  _leaderUnwrappedS: number,
  elapsedMs: number,
): ThrusterInput {
  if (elapsedMs < kart.aiNextDecisionMs) {
    return kart.aiInput;
  }

  // Draw the next randomized hold duration in [200, 400] ms so keys stick cleanly and CPUs stay desynchronized
  const nextHoldMs =
    AI_DECISION_MIN_MS + Math.round(nextAiRandom(kart) * (AI_DECISION_MAX_MS - AI_DECISION_MIN_MS));
  kart.aiNextDecisionMs = elapsedMs + nextHoldMs;
  kart.aiLastDecisionMs = elapsedMs;
  kart.aiDecisionCount += 1;

  // If an elastic collision spun this CPU around backward, turn immediately back toward track forward
  const curTrackYaw = sampleCircuitAtS(circuit, kart.s).yaw;
  const headingToTrack = wrapAngle(curTrackYaw - kart.yaw);
  if (Math.abs(headingToTrack) > Math.PI * 0.55) {
    kart.aiInput = {
      left: headingToTrack < 0,
      right: headingToTrack >= 0,
      brake: false,
    };
    return kart.aiInput;
  }

  // Independent binary brake decision: compare current speed against the track's recommended speed
  const trackCheckS = kart.s + clamp(18 + kart.speed * 0.42, 18, 56);
  const trackRecSpeed = getRecommendedSpeedAtS(circuit, trackCheckS);
  const brake = kart.speed > trackRecSpeed * 1.08 && trackRecSpeed < 94;

  // Project out to worst-case latency (`AI_DECISION_MAX_MS = 400 ms`) along the 1s shadow track
  const worstCaseSec = AI_DECISION_MAX_MS / 1000;
  const currentProj = projectKartShadowForButtons(
    kart,
    circuit,
    kart.aiInput.left,
    kart.aiInput.right,
    brake,
    worstCaseSec,
  );

  // Evaluate `press left`, `press nothing`, `press right` and choose whichever lands closest to road center (`lat = 0`)
  const candidates: ReadonlyArray<{ left: boolean; right: boolean }> = [
    { left: true, right: false },
    { left: false, right: false },
    { left: false, right: true },
  ];

  let best = candidates[1]!;
  let bestAbsLat = Infinity;
  for (const cand of candidates) {
    const proj =
      cand.left === kart.aiInput.left && cand.right === kart.aiInput.right
        ? currentProj
        : projectKartShadowForButtons(kart, circuit, cand.left, cand.right, brake, worstCaseSec);
    const absLat = Math.abs(proj.lat);
    if (absLat < bestAbsLat) {
      bestAbsLat = absLat;
      best = cand;
    }
  }

  kart.aiInput = { left: best.left, right: best.right, brake };
  return kart.aiInput;
}

function stepSingleKart(
  kart: KartState,
  input: ThrusterInput,
  circuit: CircuitDefinition,
  dt: number,
  elapsedMs: number,
  events: KartRaceEvents,
  aiSpeedScale = 1,
  race: KartRaceState | null = null,
): void {
  if (kart.isRemote) return;

  // Finished karts cruise cleanly on AI autopilot so the finish camera stays cinematic
  const activeInput =
    kart.finishMs !== null
      ? computeAiThrusters(kart, circuit, kart.unwrappedS, elapsedMs)
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

  // Pure dual-rocket propulsion + road boost pads (#388, #390): no artificial drift mini-turbo!
  kart.driftCharge = 0;
  kart.driftDir = turning && !braking ? (steerLeft ? -1 : 1) : 0;
  if (kart.boostTimer > 0) {
    kart.boostTimer = Math.max(0, kart.boostTimer - dt);
    if (kart.boostTimer === 0) {
      kart.boostKind = 'none';
    }
  }

  // 2. Dual-rocket forces (+50% boost force for 5s on road boost pads), rotational torque & yaw damping
  const boostMult = kart.boostTimer > 0 && kart.boostKind === 'pad' ? ROAD_BOOST_FORCE_MULT : 1.0;
  const fLeft = kart.leftThrottle * PER_THRUSTER_MAX_N * boostMult * aiSpeedScale;
  const fRight = kart.rightThrottle * PER_THRUSTER_MAX_N * boostMult * aiSpeedScale;
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
  // Braking / drag stops a forward-moving kart at 0, but an existing backward rebound velocity
  // from a head-on elastic collision is preserved so karts genuinely fly apart (#426)!
  if (vFwd >= 0 && nextVFwd < 0) {
    nextVFwd = 0;
  }

  let nextVLat = vLat + aLat * dt;
  if (Math.abs(aLatDesired) <= aLatMax && vLat !== 0 && Math.sign(nextVLat) !== Math.sign(vLat)) {
    nextVLat = 0;
  }

  kart.vx = fx * nextVFwd + rx * nextVLat;
  kart.vz = fz * nextVFwd + rz * nextVLat;
  kart.speed = Math.max(0, nextVFwd);
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
    const newVTang = vTang * (0.94 - 0.14 * impactRatio);
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

  // 7. Road Boost Pad detection (#390, #398): pure +50% rocket force for 5.0s (NO velocity impulse!)
  const node = circuit.nodes[proj.nodeIndex]!;
  if (node.hasBoostPad && Math.abs(kart.lat - node.boostLat) < 4.2) {
    const shouldEmit = kart.boostKind !== 'pad' || kart.boostTimer < ROAD_BOOST_DURATION_SEC - 0.6;
    kart.boostTimer = ROAD_BOOST_DURATION_SEC;
    kart.boostKind = 'pad';
    if (shouldEmit) {
      events.boostTriggered.push({ slot: kart.slot, kind: 'pad' });
    }
  }

  // 8. Record tire skid marks only when actually slipping laterally or braking hard on asphalt
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

  // 9. Monotonic lap / Portal crossing
  if (race?.format === 'marathon') {
    const localUnwrapped = kart.unwrappedS - kart.stageStartUnwrappedS;
    if (!kart.eliminated && localUnwrapped >= L) {
      const overshoot = localUnwrapped - L;
      const completedStage = kart.stageIndex;
      const lapMs = Math.max(100, Math.round(elapsedMs - kart.lapStartMs));
      if (kart.bestLapMs === null || lapMs < kart.bestLapMs) {
        kart.bestLapMs = lapMs;
      }
      kart.lapStartMs = elapsedMs;
      kart.lap += 1;
      kart.stageStartUnwrappedS += L;
      kart.stageIndex += 1;

      const nextStage = getMarathonStageForKart(race, kart, kart.stageIndex);
      const nextCircuit = getCircuit(nextStage.circuitId, nextStage.reversed);

      // Preserve 100% exact momentum & relative pose through the finish-line Portal Gate!
      const oldGateYaw = Math.atan2(circuit.nodes[0]!.tx, circuit.nodes[0]!.tz);
      const relYaw = wrapAngle(kart.yaw - oldGateYaw);
      const vFwd = kart.vx * Math.sin(oldGateYaw) + kart.vz * Math.cos(oldGateYaw);
      const vLat = kart.vx * Math.cos(oldGateYaw) - kart.vz * Math.sin(oldGateYaw);
      const clampedLat = clamp(kart.lat, -(nextCircuit.wallHalfWidth - 1.4), nextCircuit.wallHalfWidth - 1.4);
      const entryS = clamp(overshoot, 0.05, nextCircuit.totalLength * 0.25);
      const nextSample = sampleCircuitAtS(nextCircuit, entryS);
      const nextGateYaw = nextSample.yaw;

      kart.x = nextSample.x + nextSample.rx * clampedLat;
      kart.y = nextSample.y;
      kart.z = nextSample.z + nextSample.rz * clampedLat;
      kart.yaw = wrapAngle(nextGateYaw + relYaw);
      kart.pitch = nextSample.pitch;
      kart.vx = Math.sin(nextGateYaw) * vFwd + Math.cos(nextGateYaw) * vLat;
      kart.vz = Math.cos(nextGateYaw) * vFwd - Math.sin(nextGateYaw) * vLat;
      kart.s = nextSample.s;
      kart.lat = clampedLat;
      kart.unwrappedS = kart.stageStartUnwrappedS + nextSample.s;
      kart.maxUnwrappedS = Math.max(kart.maxUnwrappedS, kart.unwrappedS);
      kart.marathonProgress = kart.stageIndex + nextSample.s / nextCircuit.totalLength;
      kart.skidMarks = [];

      events.lapCompleted.push({
        slot: kart.slot,
        lap: completedStage + 1,
        lapMs,
        finished: false,
      });
      events.portalCrossed.push({
        slot: kart.slot,
        fromStageIndex: completedStage,
        toStageIndex: kart.stageIndex,
        fromCircuitId: circuit.id,
        fromReversed: circuit.reversed,
        toCircuitId: nextCircuit.id,
        toReversed: nextCircuit.reversed,
      });
    } else {
      kart.marathonProgress = kart.stageIndex + localUnwrapped / L;
    }
  } else if (kart.finishMs === null && kart.unwrappedS >= kart.lap * L) {
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
 * Locks `leader`'s upcoming finish-line portal (`leader.stageIndex + 1`) onto `target`
 * while preserving the strict no-same-track-adjacent invariant (`X ↛ X'`) (#422).
 */
function lockLeaderNextPortalOntoTarget(
  race: KartRaceState,
  leader: KartState,
  target: MarathonStage,
): void {
  const nextIdx = leader.stageIndex + 1;
  // Ensure schedule covers the full 8-stage cycle containing `nextIdx`
  const cycleStart = Math.floor(nextIdx / MARATHON_CYCLE_STAGES) * MARATHON_CYCLE_STAGES;
  const cycleEnd = cycleStart + MARATHON_CYCLE_STAGES;
  getMarathonStageForKart(race, leader, cycleEnd - 1);

  const curr = leader.marathonSchedule[leader.stageIndex]!;
  if (target.circuitId === curr.circuitId) return; // Never violate `X -> X'`

  const existing = leader.marathonSchedule[nextIdx]!;
  if (existing.circuitId === target.circuitId && existing.reversed === target.reversed) {
    return; // Already locked!
  }

  // Prefer swapping `target` from the remaining tail of the current 8-stage cycle so the cycle stays an exact permutation!
  const tail = leader.marathonSchedule.slice(nextIdx, cycleEnd);
  const matchInTail = tail.findIndex(
    (s) => s.circuitId === target.circuitId && s.reversed === target.reversed,
  );
  if (matchInTail >= 0) {
    const rest = tail.filter((_, idx) => idx !== matchInTail);
    const nextCycleFirstId =
      leader.marathonSchedule.length > cycleEnd
        ? leader.marathonSchedule[cycleEnd]!.circuitId
        : null;
    const solved: MarathonStage[] = [target];
    const used = new Uint8Array(rest.length);
    const backtrack = (): boolean => {
      if (solved.length === tail.length) {
        return nextCycleFirstId === null || solved[solved.length - 1]!.circuitId !== nextCycleFirstId;
      }
      const prevId = solved[solved.length - 1]!.circuitId;
      for (let i = 0; i < rest.length; i += 1) {
        if (!used[i] && rest[i]!.circuitId !== prevId) {
          used[i] = 1;
          solved.push(rest[i]!);
          if (backtrack()) return true;
          solved.pop();
          used[i] = 0;
        }
      }
      return false;
    };
    if (backtrack()) {
      for (let k = 0; k < solved.length; k += 1) {
        leader.marathonSchedule[nextIdx + k] = solved[k]!;
      }
      return;
    }
  }

  // Fallback (if `target` was already completed earlier in this Big Lap): place `target` directly at `nextIdx`
  // provided it doesn't conflict with `nextIdx + 1` (or swap `nextIdx + 1` safely inside the tail).
  const after = leader.marathonSchedule[nextIdx + 1];
  if (!after || after.circuitId !== target.circuitId) {
    leader.marathonSchedule[nextIdx] = target;
  } else {
    // Find a non-conflicting successor in the remaining tail
    for (let k = nextIdx + 2; k < cycleEnd; k += 1) {
      const cand = leader.marathonSchedule[k]!;
      const prevOk = cand.circuitId !== target.circuitId;
      const nextAfterK = leader.marathonSchedule[k + 1];
      const nextOk = !nextAfterK || after.circuitId !== nextAfterK.circuitId;
      const prevBeforeK = leader.marathonSchedule[k - 1];
      const beforeOk = !prevBeforeK || after.circuitId !== prevBeforeK.circuitId;
      if (prevOk && nextOk && beforeOk) {
        leader.marathonSchedule[nextIdx] = target;
        leader.marathonSchedule[nextIdx + 1] = cand;
        leader.marathonSchedule[k] = after;
        return;
      }
    }
    leader.marathonSchedule[nextIdx] = target;
  }
}

/**
 * Advances the entire race by `dtMs` milliseconds (clamped for tab-switch safety),
 * resolving dual-thruster rigid-body physics, pure non-rubber-banded AI rivals,
 * kart-to-kart bumping, Portal warps, and Marathon knockout elimination (#390, #412).
 */
export function stepRaceState(
  race: KartRaceState,
  humanInputs: Readonly<Record<number, ThrusterInput>>,
  dtMs: number,
): KartRaceState {
  const clampedMs = clamp(dtMs, 0, 50);
  const dt = clampedMs / 1000;
  const events: KartRaceEvents = {
    boostTriggered: [],
    lapCompleted: [],
    portalCrossed: [],
    eliminated: [],
    bumped: false,
  };

  if (clampedMs <= 0) {
    race.lastEvents = events;
    return race;
  }

  race.elapsedMs += clampedMs;
  const leaderUnwrappedS = Math.max(...race.karts.map((k) => k.unwrappedS));

  for (const kart of race.karts) {
    if (kart.isRemote || kart.eliminated) continue;
    const kartCircuit = getCircuitForKart(race, kart);
    if (kart.isHuman) {
      const input = humanInputs[kart.slot] ?? { left: false, right: false };
      stepSingleKart(kart, input, kartCircuit, dt, race.elapsedMs, events, 1, race);
    } else {
      // Pure honest AI with ZERO artificial rubber-banding or pack compression (#412)
      const aiInput = computeAiThrusters(kart, kartCircuit, leaderUnwrappedS, race.elapsedMs);
      stepSingleKart(
        kart,
        aiInput,
        kartCircuit,
        dt,
        race.elapsedMs,
        events,
        kart.aiBaseSkill,
        race,
      );
    }
  }

  // Perfectly elastic 2D rigid-body kart-to-kart collisions between ANY active karts on the SAME physical track!
  // In Portal Marathon, karts on stage `2` (Forward) and stage `2'` (Reverse) share the exact same 3D road
  // and can collide head-on (#390, #418)!
  for (let i = 0; i < race.karts.length; i += 1) {
    for (let j = i + 1; j < race.karts.length; j += 1) {
      const a = race.karts[i]!;
      const b = race.karts[j]!;
      if (a.eliminated || b.eliminated) continue;
      if (
        race.format === 'marathon' &&
        getCircuitForKart(race, a).id !== getCircuitForKart(race, b).id
      ) {
        continue;
      }
      if (resolveElasticKartCollision(a, b, true)) {
        events.bumped = true;
      }
    }
  }

  if (race.format === 'marathon') {
    // True 8-Cycle Physical Lapping Knockout + Portal Homing Lock-On (#418, #422):
    // 1) At `gap >= 7.0` stages, 1st place's next Portal automatically locks onto last place's
    //    physical track & direction so 1st warps right behind them on the exact same road!
    // 2) Knockout triggers when 1st reaches `gap >= 8.0` PHYSICALLY on the same track & direction
    //    passing last place on screen (with a `9.0` safety cap so a race never stalls across a portal).
    let active = race.karts
      .filter((k) => !k.eliminated)
      .sort((a, b) => b.marathonProgress - a.marathonProgress);

    while (race.status === 'racing' && active.length > 1) {
      const leader = active[0]!;
      const trailer = active[active.length - 1]!;
      const gapStages = leader.marathonProgress - trailer.marathonProgress;
      const leaderStage = getMarathonStageForKart(race, leader, leader.stageIndex);
      const trailerStage = getMarathonStageForKart(race, trailer, trailer.stageIndex);
      const onSameRoad =
        leaderStage.circuitId === trailerStage.circuitId &&
        leaderStage.reversed === trailerStage.reversed;

      if (
        (gapStages >= MARATHON_CYCLE_STAGES && onSameRoad) ||
        gapStages >= MARATHON_CYCLE_STAGES + 1.0
      ) {
        trailer.eliminated = true;
        trailer.eliminatedAtMs = Math.round(race.elapsedMs);
        trailer.finishMs = Math.round(race.elapsedMs);
        trailer.place = active.length;
        trailer.speed = 0;
        trailer.vx = 0;
        trailer.vz = 0;
        events.eliminated.push({
          slot: trailer.slot,
          place: trailer.place,
          name: trailer.name,
        });
        active = active.slice(0, active.length - 1);
      } else {
        break;
      }
    }

    // Update Portal Homing lock-on & active hunt telemetry when 1st is within 1 track of lapping last (`gap >= 7.0`)
    if (race.status === 'racing' && active.length > 1) {
      const leader = active[0]!;
      const trailer = active[active.length - 1]!;
      const gapStages = leader.marathonProgress - trailer.marathonProgress;
      if (gapStages >= MARATHON_CYCLE_STAGES - 1.0) {
        const leaderStage = getMarathonStageForKart(race, leader, leader.stageIndex);
        const trailerStage = getMarathonStageForKart(race, trailer, trailer.stageIndex);
        const onSameRoad =
          leaderStage.circuitId === trailerStage.circuitId &&
          leaderStage.reversed === trailerStage.reversed;

        let targetStage = trailerStage;
        if (!onSameRoad) {
          const trailerFrac = trailer.marathonProgress - trailer.stageIndex;
          if (trailerStage.circuitId === leaderStage.circuitId || trailerFrac >= 0.86) {
            const upcomingTrailer = getMarathonStageForKart(race, trailer, trailer.stageIndex + 1);
            if (upcomingTrailer.circuitId !== leaderStage.circuitId) {
              targetStage = upcomingTrailer;
            }
          }
          lockLeaderNextPortalOntoTarget(race, leader, targetStage);
          targetStage = getMarathonStageForKart(race, leader, leader.stageIndex + 1);
        }

        race.marathonHunt = {
          hunterSlot: leader.slot,
          preySlot: trailer.slot,
          hunterName: leader.name,
          preyName: trailer.name,
          targetCircuitId: targetStage.circuitId,
          targetReversed: targetStage.reversed,
          onSameRoad,
        };
      } else {
        race.marathonHunt = null;
      }
    } else {
      race.marathonHunt = null;
    }

    race.survivorsCount = active.length;
    race.marathonLeadGapLaps =
      active.length > 1
        ? Math.max(0, active[0]!.marathonProgress - active[active.length - 1]!.marathonProgress)
        : MARATHON_CYCLE_STAGES;

    // Order standings: active survivors by marathonProgress desc, then eliminated karts by knockout order (latest eliminated = higher rank!)
    const eliminatedSorted = race.karts
      .filter((k) => k.eliminated)
      .sort((a, b) => (b.eliminatedAtMs ?? 0) - (a.eliminatedAtMs ?? 0));
    const ordered = [...active, ...eliminatedSorted];
    ordered.forEach((kart, idx) => {
      kart.place = idx + 1;
    });

    // Race ends when only 1 survivor remains (Champion!) OR all human players have been knocked out
    const humanKarts = race.karts.filter((k) => k.isHuman);
    const allHumansEliminated =
      humanKarts.length > 0 && humanKarts.every((k) => k.eliminated);
    if (race.status === 'racing' && (active.length <= 1 || allHumansEliminated)) {
      race.status = 'finished';
      const champ = active[0] ?? ordered[0]!;
      race.winnerSlot = champ.slot;
      if (active.length === 1 && champ.finishMs === null) {
        champ.finishMs = Math.round(race.elapsedMs);
      }
    }
  } else {
    // Standard Grand Prix standings: finished karts ordered by finishMs, racing karts by unwrappedS
    const sorted = [...race.karts].sort((a, b) => {
      if (a.finishMs !== null && b.finishMs !== null) return a.finishMs - b.finishMs;
      if (a.finishMs !== null) return -1;
      if (b.finishMs !== null) return 1;
      return b.unwrappedS - a.unwrappedS;
    });
    sorted.forEach((kart, idx) => {
      kart.place = idx + 1;
    });

    // Finish check: race ends once all human players have crossed the finish line (#406)
    const humanKarts = race.karts.filter((k) => k.isHuman);
    const allHumansDone =
      humanKarts.length > 0 && humanKarts.every((k) => k.finishMs !== null);
    if (race.status === 'racing' && allHumansDone) {
      race.status = 'finished';
      race.winnerSlot = sorted[0]?.slot ?? 0;
    }
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

/**
 * Returns a kart's world-space 2D Center of Mass (slightly rear-biased toward the rockets).
 */
export function getKartCenterOfMass(kart: Pick<KartState, 'x' | 'z' | 'yaw'>): { x: number; z: number } {
  return {
    x: kart.x + Math.sin(kart.yaw) * KART_COM_Z_OFFSET,
    z: kart.z + Math.cos(kart.yaw) * KART_COM_Z_OFFSET,
  };
}

/**
 * 2D cross-product torque / angular momentum in `(x, z)` where `+yaw` rotates `+z` toward `+x`:
 * `cross2D(r, v) = r.z * v.x - r.x * v.z` (matching `v_rot = (+w * r.z, -w * r.x)`).
 */
export function cross2D(rx: number, rz: number, vx: number, vz: number): number {
  return rz * vx - rx * vz;
}

/**
 * Resolves a perfectly elastic (`e = 1.0`) collision between two karts:
 * karts using Separating Axis Theorem (SAT) contact detection and each kart's Center of Mass.
 *
 * Strictly conserves:
 * - Total linear momentum: `m_A * v_A + m_B * v_B`
 * - Total angular momentum: `sum(cross2D(c_i, m_i * v_i) + I_i * yawRate_i)`
 * - Total kinetic energy: `sum(0.5 * m_i * |v_i|^2 + 0.5 * I_i * yawRate_i^2)`
 */
export function resolveElasticKartCollision(
  a: KartState,
  b: KartState,
  separate = true,
): boolean {
  // Fast broad-phase circle reject (`2 * hypot(halfW, halfL) ≈ 4.82m`)
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (dx * dx + dz * dz > 24.5) return false;

  const aRx = Math.cos(a.yaw);
  const aRz = -Math.sin(a.yaw);
  const aFx = Math.sin(a.yaw);
  const aFz = Math.cos(a.yaw);
  const bRx = Math.cos(b.yaw);
  const bRz = -Math.sin(b.yaw);
  const bFx = Math.sin(b.yaw);
  const bFz = Math.cos(b.yaw);

  const axes: ReadonlyArray<{ ax: number; az: number }> = [
    { ax: aRx, az: aRz },
    { ax: aFx, az: aFz },
    { ax: bRx, az: bRz },
    { ax: bFx, az: bFz },
  ];

  let minOverlap = Infinity;
  let nx = 1;
  let nz = 0;

  for (const cand of axes) {
    const projA =
      KART_HALF_WIDTH * Math.abs(aRx * cand.ax + aRz * cand.az) +
      KART_HALF_LENGTH * Math.abs(aFx * cand.ax + aFz * cand.az);
    const projB =
      KART_HALF_WIDTH * Math.abs(bRx * cand.ax + bRz * cand.az) +
      KART_HALF_LENGTH * Math.abs(bFx * cand.ax + bFz * cand.az);
    const centerDist = dx * cand.ax + dz * cand.az;
    const overlap = projA + projB - Math.abs(centerDist);
    if (overlap <= 0) return false;
    if (overlap < minOverlap) {
      minOverlap = overlap;
      const sign = centerDist >= 0 ? 1 : -1;
      nx = cand.ax * sign;
      nz = cand.az * sign;
    }
  }

  // Simple 2D spherical collision physics with respect to each kart's Center of Mass (`comA`, `comB`),
  // while keeping exact 2D OBB polygon SAT for overlap detection & minimal separation (#426).
  // Strictly conserves total linear momentum, total angular momentum (orbital + spin), and kinetic energy!
  const comA = getKartCenterOfMass(a);
  const comB = getKartCenterOfMass(b);
  const comDx = comB.x - comA.x;
  const comDz = comB.z - comA.z;
  const comDist = Math.hypot(comDx, comDz);
  let physNx = comDist > 1e-6 ? comDx / comDist : nx;
  let physNz = comDist > 1e-6 ? comDz / comDist : nz;

  // On a mathematically exact dead-center opposing head-on collision (`|cross| < 0.035`),
  // break unstable knife-edge symmetry with a small deterministic glance (~4 deg) so opposing karts
  // never balance nose-to-nose under equal full forward thrust.
  const headingDot = aFx * bFx + aFz * bFz;
  const radialAlignCross = cross2D(physNx, physNz, aFx, aFz);
  if (headingDot < -0.7 && Math.abs(radialAlignCross) < 0.035) {
    const glanceSign = a.slot < b.slot ? 1 : -1;
    const glanceAngle = glanceSign * 0.07;
    const ca = Math.cos(glanceAngle);
    const sa = Math.sin(glanceAngle);
    const rotNx = physNx * ca - physNz * sa;
    const rotNz = physNx * sa + physNz * ca;
    physNx = rotNx;
    physNz = rotNz;
  }

  const vRelNormal = (b.vx - a.vx) * physNx + (b.vz - a.vz) * physNz;
  if (vRelNormal < 0) {
    const invMA = a.isRemote ? 0 : 1 / KART_MASS_KG;
    const invMB = b.isRemote ? 0 : 1 / KART_MASS_KG;
    const denom = invMA + invMB;

    if (denom > 1e-12) {
      // Perfectly elastic (`e = 1.0`) 2D spherical COM impulse!
      const j = (-2.0 * vRelNormal) / denom;
      const jx = j * physNx;
      const jz = j * physNz;

      if (!a.isRemote) {
        a.vx -= jx * invMA;
        a.vz -= jz * invMA;
        a.speed = Math.max(0, a.vx * aFx + a.vz * aFz);
        a.lateralSlip = a.vx * aRx + a.vz * aRz;
      }
      if (!b.isRemote) {
        b.vx += jx * invMB;
        b.vz += jz * invMB;
        b.speed = Math.max(0, b.vx * bFx + b.vz * bFz);
        b.lateralSlip = b.vx * bRx + b.vz * bRz;
      }
    }
  }

  // Minimal positional separation beyond tiny contact slop so karts never interpenetrate
  if (separate && minOverlap > 0.02) {
    const corr = minOverlap - 0.01;
    if (!a.isRemote && !b.isRemote) {
      a.x -= nx * corr * 0.5;
      a.z -= nz * corr * 0.5;
      b.x += nx * corr * 0.5;
      b.z += nz * corr * 0.5;
    } else if (!a.isRemote) {
      a.x -= nx * corr;
      a.z -= nz * corr;
    } else if (!b.isRemote) {
      b.x += nx * corr;
      b.z += nz * corr;
    }
  }

  return true;
}

export function getRecommendedSpeedAtS(circuit: CircuitDefinition, s: number): number {
  const sample = sampleCircuitAtS(circuit, s);
  return circuit.nodes[sample.nodeIndex]?.recommendedSpeed ?? MAX_STRAIGHT_SPEED;
}

/**
 * Predicts the curved ground trajectory starting from the **head (front nose)** of the kart
 * over the next `durationSec` seconds (default `1.0s`) assuming the driver holds their current
 * steering & rocket thrust levels (#388, #390).
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

  const boostMult = kart.boostTimer > 0 && kart.boostKind === 'pad' ? ROAD_BOOST_FORCE_MULT : 1.0;
  const fLeft = kart.leftThrottle * PER_THRUSTER_MAX_N * boostMult;
  const fRight = kart.rightThrottle * PER_THRUSTER_MAX_N * boostMult;
  const fThrust = fLeft + fRight;
  const torqueThrust = (fLeft - fRight) * THRUSTER_HALF_SPAN_M;
  const steerDir = kart.leftThrottle - kart.rightThrottle;
  const braking = kart.braking;

  const initFx = Math.sin(yaw);
  const initFz = Math.cos(yaw);
  const noseStartX = x + initFx * KART_NOSE_OFFSET_M;
  const noseStartZ = z + initFz * KART_NOSE_OFFSET_M;
  const noseStartProj = projectOntoCircuit(circuit, noseStartX, noseStartZ, curS);

  const pts: TrajectoryPoint[] = [
    {
      x: noseStartX,
      y: noseStartProj.groundY + 0.06,
      z: noseStartZ,
      rx: Math.cos(yaw),
      rz: -Math.sin(yaw),
      t: 0,
      alpha: 0.82,
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

    const noseX = x + fx * KART_NOSE_OFFSET_M;
    const noseZ = z + fz * KART_NOSE_OFFSET_M;
    const proj = projectOntoCircuit(circuit, noseX, noseZ, curS);
    curS = proj.s;
    y = proj.groundY;

    const frac = i / steps;
    const alpha = i === steps ? 0 : 0.82 * Math.pow(1 - frac, 1.55);
    pts.push({
      x: noseX,
      y: y + 0.06,
      z: noseZ,
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

/**
 * Seamlessly converts a departing/disconnected human kart into a server-simulated CPU rival
 * without losing momentum, lap, stage, or Portal Marathon cycle (#438).
 */
export function convertKartToCpu(race: KartRaceState, slot: number): boolean {
  const kart = race.karts[slot];
  if (!kart || !kart.isHuman) return false;
  const spec = getKartDriverSpec(kart.character);
  kart.isHuman = false;
  kart.isRemote = false;
  kart.name = spec.driverName;
  return true;
}

/**
 * Drops a live spectator into the **best-performing surviving CPU kart** (lowest `place`
 * among non-human, non-eliminated karts) and returns its slot index, or `-1` if all
 * surviving karts are already human-controlled (#438).
 */
export function takeOverBestCpuKart(race: KartRaceState, humanName: string): number {
  const candidates = race.karts
    .filter((k) => !k.isHuman && !k.eliminated)
    .sort((a, b) => a.place - b.place);
  const best = candidates[0];
  if (!best) return -1;
  best.isHuman = true;
  best.isRemote = false;
  best.name = humanName.trim() || 'Player';
  return best.slot;
}

export interface AuthoritativeKartFrame {
  sl: number;
  h: 0 | 1;
  nm: string;
  ch: DriverCharacterId;
  x: number;
  y: number;
  z: number;
  yw: number;
  pt: number;
  vx: number;
  vz: number;
  sp: number;
  yr: number;
  s: number;
  lt: number;
  us: number;
  lp: number;
  pl: number;
  si: number;
  mp: number;
  el: 0 | 1;
  fn: number | null;
  bl: number | null;
  bt: number;
  bk: BoostKind;
  ltT: number;
  rtT: number;
  br: 0 | 1;
  dd: -1 | 0 | 1;
  sc?: CircuitId;
  sr?: 0 | 1;
  nc?: CircuitId;
  nr?: 0 | 1;
}

export interface AuthoritativeRaceSnapshot {
  tk: number;
  ms: number;
  st: 'racing' | 'finished';
  w: number | null;
  sv: number;
  gp: number;
  ht: MarathonHuntState | null;
  k: AuthoritativeKartFrame[];
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Serializes the full 8-kart authoritative world into a compact 20Hz wire packet (#438). */
export function serializeAuthoritativeRaceSnapshot(
  race: KartRaceState,
  serverTick: number,
): AuthoritativeRaceSnapshot {
  const isMarathon = race.format === 'marathon';
  return {
    tk: serverTick,
    ms: Math.round(race.elapsedMs),
    st: race.status,
    w: race.winnerSlot,
    sv: race.survivorsCount,
    gp: r2(race.marathonLeadGapLaps),
    ht: race.marathonHunt ? { ...race.marathonHunt } : null,
    k: race.karts.map((kart) => {
      const curStage = isMarathon ? getMarathonStageForKart(race, kart, kart.stageIndex) : null;
      const nextStage = isMarathon ? getMarathonStageForKart(race, kart, kart.stageIndex + 1) : null;
      return {
        sl: kart.slot,
        h: kart.isHuman ? 1 : 0,
        nm: kart.name,
        ch: kart.character,
        x: r2(kart.x),
        y: r2(kart.y),
        z: r2(kart.z),
        yw: Math.round(kart.yaw * 1000) / 1000,
        pt: Math.round(kart.pitch * 1000) / 1000,
        vx: r2(kart.vx),
        vz: r2(kart.vz),
        sp: r2(kart.speed),
        yr: r2(kart.yawRate),
        s: r2(kart.s),
        lt: r2(kart.lat),
        us: r2(kart.unwrappedS),
        lp: kart.lap,
        pl: kart.place,
        si: kart.stageIndex,
        mp: Math.round(kart.marathonProgress * 1000) / 1000,
        el: kart.eliminated ? 1 : 0,
        fn: kart.finishMs,
        bl: kart.bestLapMs,
        bt: r2(kart.boostTimer),
        bk: kart.boostKind,
        ltT: r2(kart.leftThrottle),
        rtT: r2(kart.rightThrottle),
        br: kart.braking ? 1 : 0,
        dd: kart.driftDir,
        ...(curStage ? { sc: curStage.circuitId, sr: curStage.reversed ? 1 : 0 } : {}),
        ...(nextStage ? { nc: nextStage.circuitId, nr: nextStage.reversed ? 1 : 0 } : {}),
      };
    }),
  };
}

/**
 * Reconciles a client-side `KartRaceState` smoothly toward an authoritative 20Hz server snapshot:
 * - Local human slot uses gentle prediction reconciliation (`0.22`) for crisp 0ms steering feel.
 * - Remote humans & server-simulated CPUs blend smoothly (`0.48`) with exact velocity tracking.
 * - Stage transitions (portal warps) or large deltas snap cleanly immediately (#438).
 */
export function applyAuthoritativeRaceSnapshot(
  race: KartRaceState,
  snap: AuthoritativeRaceSnapshot,
  localHumanSlot: number | null,
  hardSnap = false,
): { localPortalCrossed: boolean } {
  let localPortalCrossed = false;
  race.elapsedMs = snap.ms;
  race.status = snap.st;
  race.winnerSlot = snap.w;
  race.survivorsCount = snap.sv;
  race.marathonLeadGapLaps = snap.gp;
  race.marathonHunt = snap.ht ? { ...snap.ht } : null;

  for (const kf of snap.k) {
    const kart = race.karts[kf.sl];
    if (!kart) continue;
    const prevStage = kart.stageIndex;
    const isLocal = localHumanSlot !== null && kf.sl === localHumanSlot;

    kart.isHuman = kf.h === 1;
    kart.isRemote = kf.h === 1 && !isLocal;
    kart.name = kf.nm;
    kart.character = kf.ch;
    kart.liveryIndex = Math.max(0, KART_DRIVERS.findIndex((d) => d.id === kf.ch));
    kart.lap = kf.lp;
    kart.place = kf.pl;
    kart.stageIndex = kf.si;
    kart.marathonProgress = kf.mp;
    kart.eliminated = kf.el === 1;
    kart.finishMs = kf.fn;
    kart.bestLapMs = kf.bl;
    kart.boostTimer = kf.bt;
    kart.boostKind = kf.bk;
    kart.leftThrottle = kf.ltT;
    kart.rightThrottle = kf.rtT;
    kart.braking = kf.br === 1;
    kart.driftDir = kf.dd;
    kart.unwrappedS = kf.us;
    kart.maxUnwrappedS = Math.max(kart.maxUnwrappedS, kf.us);

    if (race.format === 'marathon' && kf.sc) {
      getMarathonStageForKart(race, kart, kf.si + 1);
      kart.marathonSchedule[kf.si] = { circuitId: kf.sc, reversed: kf.sr === 1 };
      if (kf.nc) {
        kart.marathonSchedule[kf.si + 1] = { circuitId: kf.nc, reversed: kf.nr === 1 };
      }
    }

    const stageChanged = kf.si !== prevStage;
    if (isLocal && stageChanged) {
      localPortalCrossed = true;
    }

    const distErr = Math.hypot(kf.x - kart.x, kf.z - kart.z);
    if (hardSnap || stageChanged || distErr > 14) {
      kart.x = kf.x;
      kart.y = kf.y;
      kart.z = kf.z;
      kart.yaw = kf.yw;
      kart.pitch = kf.pt;
      kart.vx = kf.vx;
      kart.vz = kf.vz;
      kart.speed = kf.sp;
      kart.yawRate = kf.yr;
      kart.s = kf.s;
      kart.lat = kf.lt;
      if (stageChanged) kart.skidMarks = [];
    } else {
      const alpha = isLocal ? 0.22 : 0.48;
      kart.x += (kf.x - kart.x) * alpha;
      kart.y += (kf.y - kart.y) * alpha;
      kart.z += (kf.z - kart.z) * alpha;
      kart.yaw = wrapAngle(kart.yaw + wrapAngle(kf.yw - kart.yaw) * (isLocal ? 0.28 : 0.52));
      kart.pitch += (kf.pt - kart.pitch) * 0.45;
      kart.vx += (kf.vx - kart.vx) * (isLocal ? 0.3 : 0.65);
      kart.vz += (kf.vz - kart.vz) * (isLocal ? 0.3 : 0.65);
      kart.speed += (kf.sp - kart.speed) * (isLocal ? 0.3 : 0.65);
      kart.yawRate += (kf.yr - kart.yawRate) * 0.4;
      kart.s = kf.s;
      kart.lat = kf.lt;
    }
  }

  return { localPortalCrossed };
}
