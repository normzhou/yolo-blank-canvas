/**
 * Pure deterministic 3D circuit geometry, dual-thruster differential kart physics,
 * drift mini-turbo boost mechanics, spline AI rivals, kart-to-kart bumping, and
 * 3-lap race state for Micro Kart (#344, #358).
 */

export type CircuitId = 'sunset-loop' | 'canyon-crest' | 'starlight-ring';
export type KartRaceMode = '1p' | '2p-local' | '2p-online';
export type BoostKind = 'none' | 'mini' | 'ultra' | 'pad';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ThrusterInput {
  readonly left: boolean;
  readonly right: boolean;
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
  readonly hasBoostPad: boolean;
  readonly boostLat: number;
  readonly hasChevron: boolean;
  /** Which road shoulder carries the turn-warning chevron (`-1` left, `+1` right). */
  readonly chevronSide: -1 | 1;
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
  /** Forward ground speed in m/s. */
  speed: number;
  /** Nearest spline arc-length coordinate `0 .. totalLength`. */
  s: number;
  /** Signed lateral offset from track centerline (`-` left, `+` right). */
  lat: number;
  /** Current lap (`1 .. TOTAL_LAPS`, or `TOTAL_LAPS + 1` once finished). */
  lap: number;
  /** Unwrapped monotonic arc distance traveled since race start. */
  unwrappedS: number;
  maxUnwrappedS: number;
  leftThruster: boolean;
  rightThruster: boolean;
  /** Seconds spent continuously carving on a single thruster (`0 .. 2.0`). */
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
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  driftYaw: number;
  bodyRoll: number;
  speed: number;
  s: number;
  lat: number;
  lap: number;
  unwrappedS: number;
  leftThruster: boolean;
  rightThruster: boolean;
  boostTimer: number;
  boostKind: BoostKind;
  bestLapMs: number | null;
  finishMs: number | null;
}

export const TOTAL_LAPS = 3;
export const TRACK_SEGMENTS = 192;
export const MAX_STRAIGHT_SPEED = 76;
export const MAX_DRIFT_SPEED = 66;
export const MAX_BOOST_SPEED = 102;
export const MINI_TURBO_CHARGE_SEC = 0.42;
export const ULTRA_TURBO_CHARGE_SEC = 1.1;

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
    roadHalfWidth: 14.5,
    // Driven clockwise as u increases: x = R(u)*sin(u), z = R(u)*cos(u) -> wait:
    // At u = 0: x = 0, z = R(0). dx/du = R(0) > 0 (+x), so at u=0 tangent points +x (yaw = pi/2).
    // If instead x = -R(u)*cos(u), z = R(u)*sin(u): at u = 0, x = -R(0), z = 0, dx/du = 0, dz/du = +R(0) (yaw = 0, straight +z!).
    evalPoint: (u) => {
      const r = 185 + 28 * Math.sin(2 * u + 0.4) + 18 * Math.cos(3 * u - 0.3);
      return {
        x: -r * Math.cos(u),
        y: 6.5 * Math.sin(2 * u) + 3.5 * Math.cos(3 * u + 0.6),
        z: r * Math.sin(u) * 1.18,
      };
    },
    boostSegments: [
      { seg: 28, lat: -3.5 },
      { seg: 92, lat: 3.5 },
      { seg: 152, lat: 0 },
    ],
    theme: {
      skyTop: '#171c3a',
      skyHorizon: '#ee7b59',
      fogHex: [224, 126, 98],
      groundOuter: '#274c3c',
      groundAlt: '#214234',
      mountainHex: '#352c54',
      roadDark: '#262d3d',
      roadLight: '#2f384b',
      curbA: '#ef5350',
      curbB: '#f8fafc',
      propKind: 'pine',
    },
    seed: 101,
  },
  {
    id: 'canyon-crest',
    name: 'Canyon Crest',
    subtitle: 'High-altitude mesa climbs & drift hairpins',
    roadHalfWidth: 13.8,
    evalPoint: (u) => {
      const r = 192 + 38 * Math.cos(3 * u - 0.35) + 14 * Math.sin(2 * u);
      return {
        x: -r * Math.cos(u),
        y: 11.5 * Math.sin(2 * u - 0.4) + 6.0 * Math.sin(3 * u + 0.8),
        z: r * Math.sin(u) * 1.12,
      };
    },
    boostSegments: [
      { seg: 22, lat: 3.0 },
      { seg: 74, lat: -3.0 },
      { seg: 124, lat: 2.5 },
      { seg: 168, lat: 0 },
    ],
    theme: {
      skyTop: '#1e1633',
      skyHorizon: '#d97736',
      fogHex: [212, 124, 68],
      groundOuter: '#6b3b2a',
      groundAlt: '#5c3122',
      mountainHex: '#472528',
      roadDark: '#2b2833',
      roadLight: '#35313f',
      curbA: '#f59e0b',
      curbB: '#fef3c7',
      propKind: 'spire',
    },
    seed: 202,
  },
  {
    id: 'starlight-ring',
    name: 'Starlight Ring',
    subtitle: 'Fast twilight chicanes & five turbo strips',
    roadHalfWidth: 13.5,
    evalPoint: (u) => {
      const r = 198 + 30 * Math.cos(2 * u + 0.2) + 22 * Math.sin(4 * u - 0.5);
      return {
        x: -r * Math.cos(u),
        y: 7.5 * Math.cos(2 * u - 0.2) + 4.5 * Math.sin(4 * u),
        z: r * Math.sin(u) * 1.15,
      };
    },
    boostSegments: [
      { seg: 18, lat: 0 },
      { seg: 56, lat: -3.2 },
      { seg: 96, lat: 3.2 },
      { seg: 136, lat: -3.2 },
      { seg: 172, lat: 0 },
    ],
    theme: {
      skyTop: '#070b19',
      skyHorizon: '#2b3b78',
      fogHex: [40, 58, 116],
      groundOuter: '#131d38',
      groundAlt: '#0f172e',
      mountainHex: '#1d2952',
      roadDark: '#1b2236',
      roadLight: '#232c45',
      curbA: '#39c5cf',
      curbB: '#f8fafc',
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

  const boostMap = new Map<number, number>();
  for (const b of spec.boostSegments) {
    boostMap.set(((b.seg % N) + N) % N, b.lat);
    boostMap.set((((b.seg + 1) % N) + N) % N, b.lat);
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

  const nodes: TrackNode[] = rawPts.map((pt, i) => {
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

    const hasChevron = Math.abs(curvature) > 0.0085 && i % 3 === 0;
    const chevronSide: -1 | 1 = curvature > 0 ? -1 : 1; // Outside shoulder of the turn!
    const boostLat = boostMap.get(i);

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
      hasBoostPad: boostLat !== undefined,
      boostLat: boostLat ?? 0,
      hasChevron,
      chevronSide,
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
  playerNames?: { p1?: string; p2?: string },
): KartRaceState {
  const circuit = CIRCUITS[circuitId];
  const rng = mulberry32(seed);
  const L = circuit.totalLength;

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
    const isHuman =
      slot === 0 || (slot === 1 && mode === '2p-local');
    const isRemote = slot === 1 && mode === '2p-online';
    const defaultName =
      slot === 0
        ? playerNames?.p1 ?? 'P1'
        : slot === 1 && (mode === '2p-local' || mode === '2p-online')
          ? playerNames?.p2 ?? 'P2'
          : KART_LIVERIES[slot]!.name;

    karts.push({
      slot: slot as 0 | 1 | 2 | 3,
      name: defaultName,
      isHuman,
      isRemote,
      liveryIndex: slot,
      x: sample.x + sample.rx * grid.lat,
      y: sample.y,
      z: sample.z + sample.rz * grid.lat,
      yaw: sample.yaw,
      pitch: sample.pitch,
      driftYaw: 0,
      bodyRoll: 0,
      speed: 0,
      s: startS,
      lat: grid.lat,
      lap: 1,
      unwrappedS: -grid.backMeters,
      maxUnwrappedS: -grid.backMeters,
      leftThruster: false,
      rightThruster: false,
      driftCharge: 0,
      driftDir: 0,
      boostTimer: 0,
      boostKind: 'none',
      lapStartMs: 0,
      bestLapMs: null,
      finishMs: null,
      place: slot + 1,
      aiTargetLat: (rng() - 0.5) * 9,
      aiBaseSkill: 0.91 + slot * 0.025 + rng() * 0.03,
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

/**
 * Dual-thruster AI pilot: reads a lookahead point on the circuit spline, steers
 * toward boost strips when nearby, and drives through the exact same `{ left, right }`
 * thruster interface as human karts.
 */
function computeAiThrusters(
  kart: KartState,
  circuit: CircuitDefinition,
  leaderUnwrappedS: number,
): ThrusterInput {
  if (kart.finishMs !== null) {
    return { left: false, right: false };
  }
  const lookahead = clamp(16 + kart.speed * 0.34, 16, 42);
  const aheadSample = sampleCircuitAtS(circuit, kart.s + lookahead);
  const aheadNode = circuit.nodes[aheadSample.nodeIndex]!;
  const targetLat = aheadNode.hasBoostPad ? aheadNode.boostLat : kart.aiTargetLat;

  const tx = aheadSample.x + aheadSample.rx * targetLat;
  const tz = aheadSample.z + aheadSample.rz * targetLat;
  const desiredYaw = Math.atan2(tx - kart.x, tz - kart.z);
  const yawError = wrapAngle(desiredYaw - kart.yaw);

  // Gentle rubber-banding: if trailing far behind, hold full twin-thruster more aggressively
  const gapBehind = leaderUnwrappedS - kart.unwrappedS;
  const steerDeadband = gapBehind > 45 ? 0.13 : 0.095;

  if (Math.abs(yawError) > 0.55 && kart.speed > 58) {
    // Tight hairpin air-brake feather
    return yawError < 0 ? { left: true, right: false } : { left: false, right: true };
  }
  if (yawError < -steerDeadband) {
    return { left: true, right: false };
  }
  if (yawError > steerDeadband) {
    return { left: false, right: true };
  }
  return { left: true, right: true };
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

  // Finished karts cruise gently on AI autopilot so the finish camera stays cinematic
  const activeInput =
    kart.finishMs !== null
      ? computeAiThrusters(kart, circuit, kart.unwrappedS)
      : input;

  const left = activeInput.left;
  const right = activeInput.right;
  const both = left && right;
  const onlyLeft = left && !right;
  const onlyRight = !left && right;

  kart.leftThruster = left;
  kart.rightThruster = right;

  // 1. Drift release -> Mini-Turbo / Ultra-Turbo exit boost!
  if (both && kart.driftCharge >= MINI_TURBO_CHARGE_SEC) {
    const isUltra = kart.driftCharge >= ULTRA_TURBO_CHARGE_SEC;
    kart.boostTimer = Math.max(kart.boostTimer, isUltra ? 1.35 : 0.82);
    kart.boostKind = isUltra ? 'ultra' : 'mini';
    kart.speed = Math.max(kart.speed, isUltra ? MAX_BOOST_SPEED * 0.96 : MAX_BOOST_SPEED * 0.88);
    events.boostTriggered.push({ slot: kart.slot, kind: kart.boostKind });
  }

  if (both || (!left && !right)) {
    kart.driftCharge = 0;
    kart.driftDir = 0;
  } else {
    const dir: -1 | 1 = onlyLeft ? -1 : 1;
    if (kart.driftDir !== 0 && kart.driftDir !== dir) {
      kart.driftCharge = 0;
    }
    kart.driftDir = dir;
    if (kart.speed > 20) {
      kart.driftCharge = Math.min(2.0, kart.driftCharge + dt);
    }
  }

  // 2. Boost decay
  if (kart.boostTimer > 0) {
    kart.boostTimer = Math.max(0, kart.boostTimer - dt);
    if (kart.boostTimer === 0) {
      kart.boostKind = 'none';
    }
  }

  // 3. Longitudinal acceleration / air-brake
  const topSpeedBase =
    kart.boostTimer > 0
      ? MAX_BOOST_SPEED
      : both
        ? MAX_STRAIGHT_SPEED
        : onlyLeft || onlyRight
          ? MAX_DRIFT_SPEED
          : 0;
  const topSpeed = topSpeedBase * aiSpeedScale;

  if (both) {
    const accel = kart.boostTimer > 0 ? 78 : 48;
    if (kart.speed < topSpeed) {
      kart.speed = Math.min(topSpeed, kart.speed + accel * dt);
    } else {
      kart.speed = Math.max(topSpeed, kart.speed - 24 * dt);
    }
  } else if (onlyLeft || onlyRight) {
    const accel = kart.boostTimer > 0 ? 64 : 34;
    if (kart.speed < topSpeed) {
      kart.speed = Math.min(topSpeed, kart.speed + accel * dt);
    } else {
      kart.speed = Math.max(topSpeed, kart.speed - 18 * dt);
    }
  } else {
    // Air-brake when both thrusters are released
    kart.speed = Math.max(0, kart.speed - 46 * dt);
  }

  // Off-curb grass/shoulder drag if slightly outside roadHalfWidth
  if (Math.abs(kart.lat) > circuit.roadHalfWidth && kart.boostTimer <= 0) {
    kart.speed = Math.max(0, kart.speed - 22 * dt);
  }

  // 4. Differential thruster yaw rate + drift slip + chassis body roll
  const speedTurnFactor = clamp(0.45 + (kart.speed / MAX_STRAIGHT_SPEED) * 0.72, 0.45, 1.18);
  const turnDir = onlyLeft ? -1 : onlyRight ? 1 : 0;
  const baseTurnRate = 1.62; // rad/s — crisp, responsive carving without twitchiness
  kart.yaw = wrapAngle(kart.yaw + turnDir * baseTurnRate * speedTurnFactor * dt);

  const targetDriftYaw = turnDir * (kart.speed > 24 ? 0.24 : 0.08);
  const targetRoll = turnDir * (kart.speed > 18 ? 0.19 : 0.06);
  const blend = Math.min(1, dt * 9.5);
  kart.driftYaw += (targetDriftYaw - kart.driftYaw) * blend;
  kart.bodyRoll += (targetRoll - kart.bodyRoll) * blend;

  // 5. Advance 3D position along heading
  const prevS = kart.s;
  kart.x += Math.sin(kart.yaw) * kart.speed * dt;
  kart.z += Math.cos(kart.yaw) * kart.speed * dt;

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

  // Cushioned energy barrier at wallHalfWidth: slides smoothly along wall instead of dead-stopping
  if (Math.abs(kart.lat) > circuit.wallHalfWidth) {
    const clampedLat = Math.sign(kart.lat) * circuit.wallHalfWidth;
    const sample = sampleCircuitAtS(circuit, kart.s);
    kart.x = sample.x + sample.rx * clampedLat;
    kart.z = sample.z + sample.rz * clampedLat;
    kart.lat = clampedLat;
    kart.yaw = wrapAngle(kart.yaw + wrapAngle(sample.yaw - kart.yaw) * 0.65);
    kart.speed *= 0.86;
  }

  // 7. Track surface Boost Pad detection
  const node = circuit.nodes[proj.nodeIndex]!;
  if (node.hasBoostPad && Math.abs(kart.lat - node.boostLat) < 4.0 && kart.boostKind !== 'pad') {
    kart.boostTimer = Math.max(kart.boostTimer, 1.05);
    kart.boostKind = 'pad';
    kart.speed = Math.max(kart.speed, MAX_BOOST_SPEED * 0.95);
    events.boostTriggered.push({ slot: kart.slot, kind: 'pad' });
  }

  // 8. Record tire skid marks while drifting on asphalt
  if ((onlyLeft || onlyRight) && kart.speed > 28) {
    const totalVisualYaw = kart.yaw + kart.driftYaw;
    const rx = Math.cos(totalVisualYaw);
    const rz = -Math.sin(totalVisualYaw);
    const backX = kart.x - Math.sin(totalVisualYaw) * 1.4;
    const backZ = kart.z - Math.cos(totalVisualYaw) * 1.4;
    kart.skidMarks.push({
      lx: backX - rx * 0.95,
      ly: kart.y + 0.08,
      lz: backZ - rz * 0.95,
      rx: backX + rx * 0.95,
      ry: kart.y + 0.08,
      rz: backZ + rz * 0.95,
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
 * resolving dual-thruster physics, AI rivals, kart-to-kart bumping, and standings.
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
      const rubberBand = clamp(1 + deltaToLeader * 0.0014, 0.88, 1.07);
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

  // Kart-to-kart elastic sphere bumping (`KART_RADIUS = 1.65m`)
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
        if (!a.isRemote) {
          a.x -= nx * overlap;
          a.z -= nz * overlap;
        }
        if (!b.isRemote) {
          b.x += nx * overlap;
          b.z += nz * overlap;
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
  kart.x = snap.x;
  kart.y = snap.y;
  kart.z = snap.z;
  kart.yaw = snap.yaw;
  kart.pitch = snap.pitch;
  kart.driftYaw = snap.driftYaw;
  kart.bodyRoll = snap.bodyRoll;
  kart.speed = snap.speed;
  kart.s = snap.s;
  kart.lat = snap.lat;
  kart.lap = snap.lap;
  kart.unwrappedS = snap.unwrappedS;
  kart.leftThruster = snap.leftThruster;
  kart.rightThruster = snap.rightThruster;
  kart.boostTimer = snap.boostTimer;
  kart.boostKind = snap.boostKind;
  kart.bestLapMs = snap.bestLapMs;
  kart.finishMs = snap.finishMs;
}

export function toKartNetSnapshot(kart: KartState): KartNetSnapshot {
  return {
    x: Math.round(kart.x * 100) / 100,
    y: Math.round(kart.y * 100) / 100,
    z: Math.round(kart.z * 100) / 100,
    yaw: Math.round(kart.yaw * 1000) / 1000,
    pitch: Math.round(kart.pitch * 1000) / 1000,
    driftYaw: Math.round(kart.driftYaw * 1000) / 1000,
    bodyRoll: Math.round(kart.bodyRoll * 1000) / 1000,
    speed: Math.round(kart.speed * 10) / 10,
    s: Math.round(kart.s * 10) / 10,
    lat: Math.round(kart.lat * 100) / 100,
    lap: kart.lap,
    unwrappedS: Math.round(kart.unwrappedS * 10) / 10,
    leftThruster: kart.leftThruster,
    rightThruster: kart.rightThruster,
    boostTimer: Math.round(kart.boostTimer * 100) / 100,
    boostKind: kart.boostKind,
    bestLapMs: kart.bestLapMs,
    finishMs: kart.finishMs,
  };
}

export function formatRaceClock(ms: number | null): string {
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
