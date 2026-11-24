// src/shared/microKart.ts
var KART_DRIVERS = [
  {
    id: "fox",
    species: "fox",
    persona: "boy",
    speciesLabel: "Fox",
    driverName: "Ren",
    furPrimary: [242, 160, 61],
    furSecondary: [212, 118, 38],
    furCream: [255, 248, 236],
    scarfRgb: [91, 141, 239],
    kartPrimary: [77, 208, 225],
    kartAccent: [246, 215, 67],
    mapGlow: "#4dd0e1"
  },
  {
    id: "kiko",
    species: "fox",
    persona: "girl",
    speciesLabel: "Fox",
    driverName: "Kiko",
    furPrimary: [244, 132, 124],
    furSecondary: [246, 215, 67],
    furCream: [255, 248, 244],
    scarfRgb: [246, 215, 67],
    kartPrimary: [244, 114, 148],
    kartAccent: [246, 215, 67],
    mapGlow: "#ff8a80"
  },
  {
    id: "yuzu",
    species: "cat",
    persona: "boy",
    speciesLabel: "Cat",
    driverName: "Yuzu",
    furPrimary: [246, 206, 78],
    furSecondary: [232, 162, 52],
    furCream: [255, 252, 240],
    scarfRgb: [72, 209, 204],
    kartPrimary: [64, 196, 170],
    kartAccent: [255, 224, 102],
    mapGlow: "#ffd54f"
  },
  {
    id: "cat",
    species: "cat",
    persona: "girl",
    speciesLabel: "Cat",
    driverName: "Mochi",
    furPrimary: [176, 107, 216],
    furSecondary: [242, 128, 152],
    furCream: [254, 248, 255],
    scarfRgb: [224, 96, 95],
    kartPrimary: [246, 215, 67],
    kartAccent: [224, 96, 95],
    mapGlow: "#c084fc"
  },
  {
    id: "dog",
    species: "dog",
    persona: "boy",
    speciesLabel: "Dog",
    driverName: "Koro",
    furPrimary: [95, 194, 126],
    furSecondary: [242, 160, 61],
    furCream: [255, 251, 238],
    scarfRgb: [242, 160, 61],
    kartPrimary: [242, 160, 61],
    kartAccent: [254, 240, 138],
    mapGlow: "#5fc27e"
  },
  {
    id: "hana",
    species: "dog",
    persona: "girl",
    speciesLabel: "Dog",
    driverName: "Hana",
    furPrimary: [106, 214, 206],
    furSecondary: [244, 138, 168],
    furCream: [252, 255, 254],
    scarfRgb: [244, 138, 168],
    kartPrimary: [255, 154, 178],
    kartAccent: [148, 236, 224],
    mapGlow: "#64ffda"
  },
  {
    id: "poko",
    species: "bunny",
    persona: "boy",
    speciesLabel: "Bunny",
    driverName: "Poko",
    furPrimary: [102, 168, 244],
    furSecondary: [246, 215, 67],
    furCream: [248, 252, 255],
    scarfRgb: [246, 215, 67],
    kartPrimary: [88, 132, 246],
    kartAccent: [250, 224, 108],
    mapGlow: "#60a5fa"
  },
  {
    id: "bunny",
    species: "bunny",
    persona: "girl",
    speciesLabel: "Bunny",
    driverName: "Momo",
    furPrimary: [224, 96, 95],
    furSecondary: [246, 215, 67],
    furCream: [255, 248, 250],
    scarfRgb: [246, 215, 67],
    kartPrimary: [176, 107, 216],
    kartAccent: [246, 215, 67],
    mapGlow: "#f472b6"
  }
];
function getKartDriverSpec(character) {
  return KART_DRIVERS.find((d) => d.id === character) ?? KART_DRIVERS[0];
}
var TOTAL_LAPS = 3;
var TRACK_SEGMENTS = 192;
var KART_MASS_KG = 800;
var GRAVITY_MPS2 = 9.81;
var MAX_STRAIGHT_SPEED = 100;
var VACUUM_ACCEL_TIME_SEC = 2;
var MAX_TOTAL_THRUST_N = KART_MASS_KG * MAX_STRAIGHT_SPEED / VACUUM_ACCEL_TIME_SEC;
var PER_THRUSTER_MAX_N = MAX_TOTAL_THRUST_N * 0.5;
var ASPHALT_ROLLING_DRAG_N = 480;
var AERO_DRAG_COEFF = (MAX_TOTAL_THRUST_N - ASPHALT_ROLLING_DRAG_N) / (MAX_STRAIGHT_SPEED * MAX_STRAIGHT_SPEED);
var BRAKE_FORCE_N = 42e3;
var OFFROAD_EXTRA_DRAG_N = 15e3;
var THRUSTER_RAMP_SEC = 0.55;
var ANALOG_RAMP_SEC = 0.06;
var BRAKE_CUT_RAMP_SEC = 0.11;
var AI_DECISION_MIN_MS = 200;
var AI_DECISION_MAX_MS = 400;
var THRUSTER_HALF_SPAN_M = 0.68;
var KART_YAW_INERTIA = 1400;
var YAW_DAMPING = 6500;
var KART_COM_Z_OFFSET = -0.22;
var KART_HALF_WIDTH = 1.25;
var KART_HALF_LENGTH = 2.05;
var KART_NOSE_OFFSET_M = 2.15;
var TIRE_LATERAL_MU = 4.6;
var AERO_DOWNFORCE_COEFF = 24e-4;
var TIRE_CORNERING_STIFFNESS = 18;
var SLIP_SELF_ALIGN_TORQUE = 180;
var MAX_DRIFT_SPEED = Math.round(MAX_STRAIGHT_SPEED * Math.SQRT1_2);
var ROAD_BOOST_FORCE_MULT = 1.5;
var ROAD_BOOST_DURATION_SEC = 5;
var MAX_BOOST_SPEED = Math.round(MAX_STRAIGHT_SPEED * Math.sqrt(ROAD_BOOST_FORCE_MULT));
function wrapAngle(a) {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var CIRCUIT_SPECS = [
  {
    id: "sunset-loop",
    name: "Sunset Loop",
    subtitle: "Wide coastal sweepers & rolling crests",
    roadHalfWidth: 16.5,
    // Driven clockwise as u increases: x = -R(u)*cos(u), z = R(u)*sin(u) -> at u=0 tangent points +z (yaw = 0).
    // Scaled ~1.35x for 360 km/h F1 thruster speeds & smooth lateral slides (~1,740m lap).
    evalPoint: (u) => {
      const r = 250 + 36 * Math.sin(2 * u + 0.4) + 22 * Math.cos(3 * u - 0.3);
      return {
        x: -r * Math.cos(u),
        y: 8.5 * Math.sin(2 * u) + 4.5 * Math.cos(3 * u + 0.6),
        z: r * Math.sin(u) * 1.18
      };
    },
    boostSegments: [
      { seg: 28, lat: -4 },
      { seg: 92, lat: 4 },
      { seg: 152, lat: 0 }
    ],
    theme: {
      skyTop: "#2f84f4",
      skyHorizon: "#ffd596",
      fogHex: [245, 204, 152],
      groundOuter: "#49b85e",
      groundAlt: "#3da652",
      mountainHex: "#6c88cb",
      roadDark: "#414b63",
      roadLight: "#4d5872",
      curbA: "#ff4d57",
      curbB: "#ffffff",
      propKind: "pine"
    },
    seed: 101
  },
  {
    id: "canyon-crest",
    name: "Canyon Crest",
    subtitle: "Sunny toy-mesa climbs & drift hairpins",
    roadHalfWidth: 16,
    evalPoint: (u) => {
      const r = 260 + 48 * Math.cos(3 * u - 0.35) + 18 * Math.sin(2 * u);
      return {
        x: -r * Math.cos(u),
        y: 14.5 * Math.sin(2 * u - 0.4) + 7.5 * Math.sin(3 * u + 0.8),
        z: r * Math.sin(u) * 1.12
      };
    },
    boostSegments: [
      { seg: 22, lat: 3.5 },
      { seg: 74, lat: -3.5 },
      { seg: 124, lat: 3 },
      { seg: 168, lat: 0 }
    ],
    theme: {
      skyTop: "#2a7ae8",
      skyHorizon: "#ffc37c",
      fogHex: [242, 186, 126],
      groundOuter: "#df9549",
      groundAlt: "#d1853b",
      mountainHex: "#b86242",
      roadDark: "#474254",
      roadLight: "#544e63",
      curbA: "#24c8d8",
      curbB: "#ffe46b",
      propKind: "spire"
    },
    seed: 202
  },
  {
    id: "starlight-ring",
    name: "Starlight Ring",
    subtitle: "Cosmic starlight skyway & five turbo strips",
    roadHalfWidth: 15.8,
    evalPoint: (u) => {
      const r = 268 + 38 * Math.cos(2 * u + 0.2) + 26 * Math.sin(4 * u - 0.5);
      return {
        x: -r * Math.cos(u),
        y: 9.5 * Math.cos(2 * u - 0.2) + 5.5 * Math.sin(4 * u),
        z: r * Math.sin(u) * 1.15
      };
    },
    boostSegments: [
      { seg: 18, lat: 0 },
      { seg: 56, lat: -3.6 },
      { seg: 96, lat: 3.6 },
      { seg: 136, lat: -3.6 },
      { seg: 172, lat: 0 }
    ],
    theme: {
      skyTop: "#192166",
      skyHorizon: "#8454f6",
      fogHex: [112, 82, 206],
      groundOuter: "#273478",
      groundAlt: "#202b66",
      mountainHex: "#43388f",
      roadDark: "#2c355c",
      roadLight: "#364170",
      curbA: "#38e8ff",
      curbB: "#ffe46b",
      propKind: "pylon",
      skyMode: "starry"
    },
    seed: 303
  },
  {
    id: "cloud-gate",
    name: "Cloud Gate",
    subtitle: "White-jade sky viaduct & sea of clouds",
    roadHalfWidth: 16,
    evalPoint(u) {
      const x = 312 * Math.sin(u) + 62 * Math.sin(2 * u + 0.3) - 28 * Math.sin(3 * u - 0.45);
      const z = 282 * Math.cos(u) - 54 * Math.cos(2 * u - 0.25) + 24 * Math.sin(3 * u + 0.6);
      let baseY = 16.5 + 9.5 * Math.sin(u - 0.2) - 4.2 * Math.cos(2 * u + 0.4) + 2 * Math.sin(3 * u);
      const jpStartU = 64 / TRACK_SEGMENTS * Math.PI * 2;
      const jpEndU = 96 / TRACK_SEGMENTS * Math.PI * 2;
      const jpMidU = (jpStartU + jpEndU) * 0.5;
      const jpHalfU = (jpEndU - jpStartU) * 0.5;
      const pondY = 14;
      const distFromPool = Math.abs(u - jpMidU);
      if (distFromPool < jpHalfU + 0.38) {
        const blend = distFromPool <= jpHalfU ? 1 : 0.5 * (1 + Math.cos((distFromPool - jpHalfU) / 0.38 * Math.PI));
        baseY = baseY * (1 - blend) + pondY * blend;
      }
      const bridgeHalfU = 12 / TRACK_SEGMENTS * Math.PI * 2;
      if (distFromPool < bridgeHalfU) {
        const archPhase = distFromPool / bridgeHalfU * Math.PI;
        baseY += 11.2 * 0.5 * (1 + Math.cos(archPhase));
      }
      return { x, y: baseY, z };
    },
    boostSegments: [
      { seg: 14, lat: 0 },
      { seg: 54, lat: -3.2 },
      { seg: 84, lat: 0 },
      { seg: 126, lat: 3.4 },
      { seg: 168, lat: 0 }
    ],
    theme: {
      skyTop: "#2f6da8",
      skyHorizon: "#f5e2ba",
      fogHex: [228, 224, 212],
      groundOuter: "#e8eef5",
      groundAlt: "#d4e2ef",
      mountainHex: "#7fa1be",
      roadDark: "#45546a",
      roadLight: "#50617a",
      curbA: "#f2efe6",
      curbB: "#c84232",
      propKind: "pavilion",
      skyMode: "cloud-sea",
      jadePoolRange: [64, 96],
      cliffRange: [104, 132],
      moonGateSeg: 46
    },
    seed: 404
  }
];
function buildCircuit(spec, reversed = false) {
  const N = TRACK_SEGMENTS;
  const rawPts = Array.from({ length: N }, (_, i) => {
    const srcIdx = reversed ? (N - i) % N : i;
    const u = srcIdx / N * Math.PI * 2;
    return { u, ...spec.evalPoint(u) };
  });
  const theme = reversed ? {
    ...spec.theme,
    jadePoolRange: spec.theme.jadePoolRange ? [N - spec.theme.jadePoolRange[1], N - spec.theme.jadePoolRange[0]] : void 0,
    cliffRange: spec.theme.cliffRange ? [N - spec.theme.cliffRange[1], N - spec.theme.cliffRange[0]] : void 0,
    moonGateSeg: spec.theme.moonGateSeg !== void 0 ? (N - spec.theme.moonGateSeg) % N : void 0
  } : spec.theme;
  const boostMap = /* @__PURE__ */ new Map();
  for (const b of spec.boostSegments) {
    const seg = reversed ? (N - b.seg) % N : (b.seg % N + N) % N;
    const lat = reversed ? -b.lat : b.lat;
    boostMap.set(seg, lat);
    boostMap.set((seg + 1) % N, lat);
  }
  let cumS = 0;
  const sArr = [0];
  for (let i = 0; i < N; i += 1) {
    const a = rawPts[i];
    const b = rawPts[(i + 1) % N];
    const segHorizontal = Math.hypot(b.x - a.x, b.z - a.z);
    cumS += segHorizontal;
    if (i < N - 1) sArr.push(cumS);
  }
  const totalLength = cumS;
  const baseNodes = rawPts.map((pt, i) => {
    const prev = rawPts[(i - 1 + N) % N];
    const next = rawPts[(i + 1) % N];
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
    const rx = htz;
    const rz = -htx;
    const prevNext = rawPts[(i + 2) % N];
    const yaw1 = Math.atan2(next.x - pt.x, next.z - pt.z);
    const yaw2 = Math.atan2(prevNext.x - next.x, prevNext.z - next.z);
    const segLen = Math.hypot(next.x - pt.x, next.z - pt.z) || 1;
    const curvature = wrapAngle(yaw2 - yaw1) / segLen;
    const hasChevron = Math.abs(curvature) > 68e-4 && i % 3 === 0;
    const chevronSide = curvature > 0 ? -1 : 1;
    return {
      index: i,
      u: pt.u,
      s: sArr[i],
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
      chevronSide
    };
  });
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
      const sp = rawSafeSpeeds[(i + look) % N];
      if (sp < minSpd) minSpd = sp;
    }
    return minSpd;
  });
  const nodes = baseNodes.map((n, i) => {
    const prevSpd = lookaheadSpeeds[(i - 1 + N) % N];
    const curSpd = lookaheadSpeeds[i];
    const nextSpd = lookaheadSpeeds[(i + 1) % N];
    const smoothed = prevSpd * 0.22 + curSpd * 0.56 + nextSpd * 0.22;
    const boostLat = boostMap.get(i);
    return {
      ...n,
      recommendedSpeed: Math.round(smoothed * 10) / 10,
      hasBoostPad: boostLat !== void 0,
      boostLat: boostLat ?? 0
    };
  });
  const rng = mulberry32(spec.seed);
  const scenery = [];
  if (theme.skyMode === "cloud-sea") {
    const [jpStart, jpEnd] = theme.jadePoolRange ?? [-1, -1];
    const [clStart, clEnd] = theme.cliffRange ?? [-1, -1];
    for (let i = 0; i < N; i += 2) {
      const node = nodes[i];
      const inJadePool = i >= jpStart && i <= jpEnd;
      const inCliff = i >= clStart && i <= clEnd;
      if (i % 8 === 0 && i !== 0) {
        for (const side of [-1, 1]) {
          const dist = spec.roadHalfWidth + 2.4;
          scenery.push({
            kind: "jade-pillar",
            x: node.x + node.rx * side * dist,
            y: node.y,
            z: node.z + node.rz * side * dist,
            scale: 1,
            yaw: Math.atan2(node.tx, node.tz)
          });
        }
      }
      if (inJadePool && i % 6 === 0) {
        const pondWaterY = Math.min(nodes[jpStart].y, nodes[jpEnd].y) - 0.24;
        for (const side of [-1, 1]) {
          const dist = spec.roadHalfWidth + 6.5 + rng() * 15.5;
          scenery.push({
            kind: "lotus",
            x: node.x + node.rx * side * dist,
            y: pondWaterY,
            z: node.z + node.rz * side * dist,
            scale: 1.25 + rng() * 0.5,
            yaw: rng() * Math.PI * 2
          });
        }
      }
      if (!inJadePool && i % 4 === 0) {
        const underSide = i / 4 % 2 === 0 ? -1 : 1;
        const cloudDist = 14 + rng() * 34;
        const cloudDrop = 5.5 + rng() * 9.5;
        scenery.push({
          kind: "cloud-bank",
          x: node.x + node.rx * underSide * cloudDist,
          y: node.y - cloudDrop,
          z: node.z + node.rz * underSide * cloudDist,
          scale: 1.3 + rng() * 1.15,
          yaw: rng() * Math.PI * 2
        });
        if (i % 8 === 0) {
          scenery.push({
            kind: "cloud-bank",
            x: node.x + node.rx * ((rng() - 0.5) * 16),
            y: node.y - (8.5 + rng() * 6.5),
            z: node.z + node.rz * ((rng() - 0.5) * 16),
            scale: 1.65 + rng() * 0.9,
            yaw: rng() * Math.PI * 2
          });
        }
      }
      if (i % 14 === 4) {
        const side = inCliff ? 1 : Math.floor(i / 14) % 2 === 0 ? 1 : -1;
        const dist = spec.roadHalfWidth + 24 + rng() * 26;
        scenery.push({
          kind: "pavilion",
          x: node.x + node.rx * side * dist,
          y: node.y + (rng() - 0.35) * 9,
          z: node.z + node.rz * side * dist,
          scale: 0.95 + rng() * 0.5,
          yaw: Math.atan2(-node.rx * side, -node.rz * side)
        });
      }
      if (i % 10 === 2) {
        const side = inCliff ? -1 : Math.floor(i / 10) % 2 === 0 ? -1 : 1;
        const dist = inCliff ? spec.roadHalfWidth + 11 + rng() * 10 : spec.roadHalfWidth + 15 + rng() * 24;
        scenery.push({
          kind: "bonsai-pine",
          x: node.x + node.rx * side * dist,
          y: inCliff ? node.y + 4 + rng() * 12 : node.y + (rng() - 0.5) * 5,
          z: node.z + node.rz * side * dist,
          scale: 0.9 + rng() * 0.55,
          yaw: rng() * Math.PI * 2
        });
      }
    }
  } else {
    for (let i = 0; i < N; i += 3) {
      const node = nodes[i];
      for (const side of [-1, 1]) {
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
            yaw: rng() * Math.PI * 2
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
    theme
  };
}
var CIRCUITS = {
  "sunset-loop": buildCircuit(CIRCUIT_SPECS[0], false),
  "canyon-crest": buildCircuit(CIRCUIT_SPECS[1], false),
  "starlight-ring": buildCircuit(CIRCUIT_SPECS[2], false),
  "cloud-gate": buildCircuit(CIRCUIT_SPECS[3], false)
};
var CIRCUITS_REVERSED = {
  "sunset-loop": buildCircuit(CIRCUIT_SPECS[0], true),
  "canyon-crest": buildCircuit(CIRCUIT_SPECS[1], true),
  "starlight-ring": buildCircuit(CIRCUIT_SPECS[2], true),
  "cloud-gate": buildCircuit(CIRCUIT_SPECS[3], true)
};
function getCircuit(id, reversed = false) {
  return reversed ? CIRCUITS_REVERSED[id] : CIRCUITS[id];
}
var CIRCUIT_LIST = [
  CIRCUITS["sunset-loop"],
  CIRCUITS["canyon-crest"],
  CIRCUITS["starlight-ring"],
  CIRCUITS["cloud-gate"]
];
var MARATHON_CYCLE_STAGES = CIRCUIT_LIST.length * 2;
var ALL_MARATHON_STAGES = [
  ...CIRCUIT_LIST.map((c) => ({ circuitId: c.id, reversed: false })),
  ...CIRCUIT_LIST.map((c) => ({ circuitId: c.id, reversed: true }))
];
function generateMarathonCycleOrder(rng, options) {
  const fixedFirst = options?.fixedFirst ?? null;
  const forbiddenFirstId = options?.forbiddenFirstCircuitId ?? null;
  const remaining = ALL_MARATHON_STAGES.filter(
    (s) => !(fixedFirst && s.circuitId === fixedFirst.circuitId && s.reversed === fixedFirst.reversed)
  );
  const out = fixedFirst ? [fixedFirst] : [];
  const used = new Uint8Array(remaining.length);
  function solve() {
    if (out.length === ALL_MARATHON_STAGES.length) return true;
    const prevId = out.length > 0 ? out[out.length - 1].circuitId : forbiddenFirstId;
    const cands = [];
    for (let i = 0; i < remaining.length; i += 1) {
      if (!used[i] && remaining[i].circuitId !== prevId) {
        cands.push(i);
      }
    }
    for (let i = cands.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = cands[i];
      cands[i] = cands[j];
      cands[j] = tmp;
    }
    for (const idx of cands) {
      used[idx] = 1;
      out.push(remaining[idx]);
      if (solve()) return true;
      out.pop();
      used[idx] = 0;
    }
    return false;
  }
  solve();
  return out;
}
function getMarathonStageForKart(race, kart, stageIndex = kart.stageIndex) {
  const safeIdx = Math.max(0, stageIndex);
  while (kart.marathonSchedule.length <= safeIdx) {
    const cycleIdx = Math.floor(kart.marathonSchedule.length / MARATHON_CYCLE_STAGES);
    const cycleSeed = (Math.imul(race.seed + 17, 2654435761) ^ Math.imul(kart.slot + 1, 1013904223) ^ Math.imul(cycleIdx + 1, 2246822519)) >>> 0;
    const cycleRng = mulberry32(cycleSeed || 1);
    const prevLastId = kart.marathonSchedule.length > 0 ? kart.marathonSchedule[kart.marathonSchedule.length - 1].circuitId : null;
    const nextCycle = generateMarathonCycleOrder(cycleRng, {
      fixedFirst: cycleIdx === 0 ? { circuitId: race.circuitId, reversed: race.reversed } : null,
      forbiddenFirstCircuitId: prevLastId
    });
    kart.marathonSchedule.push(...nextCycle);
  }
  return kart.marathonSchedule[safeIdx];
}
function getCircuitForKart(race, kart) {
  if (race.format === "marathon") {
    const st = getMarathonStageForKart(race, kart, kart.stageIndex);
    return getCircuit(st.circuitId, st.reversed);
  }
  return getCircuit(race.circuitId, race.reversed);
}
function sampleCircuitAtS(circuit, rawS) {
  const L = circuit.totalLength;
  const s = (rawS % L + L) % L;
  const nodes = circuit.nodes;
  const N = nodes.length;
  let lo = 0;
  let hi = N - 1;
  while (lo < hi) {
    const mid = lo + hi + 1 >> 1;
    if (nodes[mid].s <= s) lo = mid;
    else hi = mid - 1;
  }
  const n0 = nodes[lo];
  const n1 = nodes[(lo + 1) % N];
  const s0 = n0.s;
  const s1 = lo === N - 1 ? L : n1.s;
  const span = Math.max(1e-4, s1 - s0);
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
    nodeIndex: lo
  };
}
function projectOntoCircuit(circuit, x, z, hintS) {
  const nodes = circuit.nodes;
  const N = nodes.length;
  const L = circuit.totalLength;
  let bestIdx = 0;
  let bestDistSq = Infinity;
  if (hintS !== void 0) {
    const approxIdx = Math.floor((hintS % L + L) % L / (L / N));
    for (let offset = -12; offset <= 12; offset += 1) {
      const idx = ((approxIdx + offset) % N + N) % N;
      const n = nodes[idx];
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
      const n = nodes[i];
      const dSq = (x - n.x) * (x - n.x) + (z - n.z) * (z - n.z);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
  }
  let bestS = nodes[bestIdx].s;
  let bestProjDistSq = Infinity;
  for (const segStart of [(bestIdx - 1 + N) % N, bestIdx]) {
    const a = nodes[segStart];
    const b = nodes[(segStart + 1) % N];
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
    nodeIndex: sample.nodeIndex
  };
}
function createRaceState(circuitId = "sunset-loop", mode = "1p", seed = 1, options) {
  const reversed = Boolean(options?.reversed);
  const format = options?.format ?? "grand-prix";
  const circuit = getCircuit(circuitId, reversed);
  const rng = mulberry32(seed);
  const L = circuit.totalLength;
  const allChars = KART_DRIVERS.map((d) => d.id);
  const rosterBySlot = /* @__PURE__ */ new Map();
  let slotCharacters;
  if (options?.humanRoster && options.humanRoster.length > 0) {
    const used = /* @__PURE__ */ new Set();
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
        slotCharacters.push(remaining.shift() ?? allChars[s % allChars.length]);
      }
    }
  } else {
    const p1Char = options?.p1Character ?? "fox";
    const remainingAfterP1 = allChars.filter((c) => c !== p1Char);
    const p2Char = options?.p2Character && options.p2Character !== p1Char ? options.p2Character : remainingAfterP1[0];
    const aiChars = allChars.filter((c) => c !== p1Char && c !== p2Char);
    slotCharacters = [p1Char, p2Char, ...aiChars];
  }
  const gridOffsets = [
    { backMeters: 34, lat: -3.8 },
    { backMeters: 34, lat: 3.8 },
    { backMeters: 26, lat: -3.8 },
    { backMeters: 26, lat: 3.8 },
    { backMeters: 18, lat: -3.8 },
    { backMeters: 18, lat: 3.8 },
    { backMeters: 10, lat: -3.8 },
    { backMeters: 10, lat: 3.8 }
  ];
  const count = mode === "2p-online" ? 2 : 8;
  const karts = [];
  for (let slot = 0; slot < count; slot += 1) {
    const grid = gridOffsets[slot];
    const startS = L - grid.backMeters;
    const sample = sampleCircuitAtS(circuit, startS);
    const charId = slotCharacters[slot];
    const driverSpec = getKartDriverSpec(charId);
    const liveryIndex = KART_DRIVERS.findIndex((d) => d.id === charId);
    const rosterEntry = rosterBySlot.get(slot);
    const isHuman = mode === "online-8p" ? Boolean(rosterEntry) : slot === 0 || slot === 1 && mode === "2p-local";
    const isRemote = slot === 1 && mode === "2p-online";
    const defaultName = rosterEntry ? rosterEntry.name : slot === 0 ? options?.p1 ?? driverSpec.driverName : slot === 1 && (mode === "2p-local" || mode === "2p-online") ? options?.p2 ?? driverSpec.driverName : driverSpec.driverName;
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
      marathonSchedule: format === "marathon" ? generateMarathonCycleOrder(
        mulberry32(
          (Math.imul(seed + 17, 2654435761) ^ Math.imul(slot + 1, 1013904223) ^ 2246822519) >>> 0 || 1
        ),
        { fixedFirst: { circuitId, reversed } }
      ) : [],
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
      boostKind: "none",
      lapStartMs: 0,
      bestLapMs: null,
      finishMs: null,
      place: slot + 1,
      aiTargetLat: (rng() - 0.5) * 10,
      aiBaseSkill: 0.88 + slot / Math.max(1, count - 1) * 0.11 + rng() * 0.025,
      aiInput: { left: false, right: false, brake: false },
      // Stagger each CPU slot's first decision across [60..340] ms so all 7 AI rivals start unsynchronized (#394, #430)
      aiNextDecisionMs: ([0, 65, 115, 165, 210, 255, 300, 340][slot] ?? slot * 50) + Math.round(rng() * 25),
      aiLastDecisionMs: null,
      aiDecisionCount: 0,
      aiRngState: (seed ^ (slot + 1) * 2654435761) >>> 0 || 1,
      skidMarks: []
    });
  }
  return {
    circuitId,
    reversed,
    format,
    mode,
    totalLaps: format === "marathon" ? Number.POSITIVE_INFINITY : TOTAL_LAPS,
    seed,
    elapsedMs: 0,
    status: "racing",
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
      bumped: false
    }
  };
}
function moveToward(current, target, maxDelta) {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return target;
}
function nextAiRandom(kart) {
  let s = kart.aiRngState + 1831565813 >>> 0;
  kart.aiRngState = s;
  s = Math.imul(s ^ s >>> 15, 1 | s);
  s ^= s + Math.imul(s ^ s >>> 7, 61 | s);
  return ((s ^ s >>> 14) >>> 0) / 4294967296;
}
function projectKartShadowForButtons(kart, circuit, leftBtn, rightBtn, braking, holdSec, totalSec = 1, steps = 10) {
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
  const boostMult = kart.boostTimer > 0 && kart.boostKind === "pad" ? ROAD_BOOST_FORCE_MULT : 1;
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
    const torqueBrakeSteer = stepBrake && steerDir !== 0 ? steerDir * 6800 * clamp(preVFwd / 22, 0.25, 1) : 0;
    const torqueAlign = SLIP_SELF_ALIGN_TORQUE * preVLat * clamp(preVFwd / 30, 0.2, 1);
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
function computeAiThrusters(kart, circuit, _leaderUnwrappedS, elapsedMs) {
  if (elapsedMs < kart.aiNextDecisionMs) {
    return kart.aiInput;
  }
  const nextHoldMs = AI_DECISION_MIN_MS + Math.round(nextAiRandom(kart) * (AI_DECISION_MAX_MS - AI_DECISION_MIN_MS));
  kart.aiNextDecisionMs = elapsedMs + nextHoldMs;
  kart.aiLastDecisionMs = elapsedMs;
  kart.aiDecisionCount += 1;
  const curTrackYaw = sampleCircuitAtS(circuit, kart.s).yaw;
  const headingToTrack = wrapAngle(curTrackYaw - kart.yaw);
  if (Math.abs(headingToTrack) > Math.PI * 0.55) {
    kart.aiInput = {
      left: headingToTrack < 0,
      right: headingToTrack >= 0,
      brake: false
    };
    return kart.aiInput;
  }
  const trackCheckS = kart.s + clamp(18 + kart.speed * 0.42, 18, 56);
  const trackRecSpeed = getRecommendedSpeedAtS(circuit, trackCheckS);
  const brake = kart.speed > trackRecSpeed * 1.08 && trackRecSpeed < 94;
  const worstCaseSec = AI_DECISION_MAX_MS / 1e3;
  const currentProj = projectKartShadowForButtons(
    kart,
    circuit,
    kart.aiInput.left,
    kart.aiInput.right,
    brake,
    worstCaseSec
  );
  const candidates = [
    { left: true, right: false },
    { left: false, right: false },
    { left: false, right: true }
  ];
  let best = candidates[1];
  let bestAbsLat = Infinity;
  for (const cand of candidates) {
    const proj = cand.left === kart.aiInput.left && cand.right === kart.aiInput.right ? currentProj : projectKartShadowForButtons(kart, circuit, cand.left, cand.right, brake, worstCaseSec);
    const absLat = Math.abs(proj.lat);
    if (absLat < bestAbsLat) {
      bestAbsLat = absLat;
      best = cand;
    }
  }
  kart.aiInput = { left: best.left, right: best.right, brake };
  return kart.aiInput;
}
function stepSingleKart(kart, input, circuit, dt, elapsedMs, events, aiSpeedScale = 1, race = null) {
  if (kart.isRemote) return;
  const activeInput = kart.finishMs !== null ? computeAiThrusters(kart, circuit, kart.unwrappedS, elapsedMs) : input;
  const braking = Boolean(activeInput.brake);
  const hasAnalog = typeof activeInput.steerAnalog === "number" && Number.isFinite(activeInput.steerAnalog);
  const analogVal = hasAnalog ? clamp(activeInput.steerAnalog, -1, 1) : 0;
  const digitalLeft = activeInput.left && !activeInput.right;
  const digitalRight = activeInput.right && !activeInput.left;
  const steerIntent = hasAnalog ? analogVal : digitalLeft ? -1 : digitalRight ? 1 : 0;
  const steerLeft = steerIntent < -0.05;
  const steerRight = steerIntent > 0.05;
  const turning = steerLeft || steerRight;
  let targetLeft = 1;
  let targetRight = 1;
  if (braking) {
    targetLeft = 0;
    targetRight = 0;
  } else if (steerIntent < 0) {
    targetLeft = 1 + steerIntent;
    targetRight = 1;
  } else if (steerIntent > 0) {
    targetLeft = 1;
    targetRight = 1 - steerIntent;
  }
  const rampSec = braking ? BRAKE_CUT_RAMP_SEC : hasAnalog ? ANALOG_RAMP_SEC : THRUSTER_RAMP_SEC;
  const maxThrottleDelta = dt / rampSec;
  kart.leftThrottle = moveToward(kart.leftThrottle, targetLeft, maxThrottleDelta);
  kart.rightThrottle = moveToward(kart.rightThrottle, targetRight, maxThrottleDelta);
  kart.braking = braking;
  kart.leftThruster = kart.leftThrottle > 0.35;
  kart.rightThruster = kart.rightThrottle > 0.35;
  kart.driftCharge = 0;
  kart.driftDir = turning && !braking ? steerLeft ? -1 : 1 : 0;
  if (kart.boostTimer > 0) {
    kart.boostTimer = Math.max(0, kart.boostTimer - dt);
    if (kart.boostTimer === 0) {
      kart.boostKind = "none";
    }
  }
  const boostMult = kart.boostTimer > 0 && kart.boostKind === "pad" ? ROAD_BOOST_FORCE_MULT : 1;
  const fLeft = kart.leftThrottle * PER_THRUSTER_MAX_N * boostMult * aiSpeedScale;
  const fRight = kart.rightThrottle * PER_THRUSTER_MAX_N * boostMult * aiSpeedScale;
  const fThrust = fLeft + fRight;
  const torqueThrust = (fLeft - fRight) * THRUSTER_HALF_SPAN_M;
  const torqueBrakeSteer = braking && Math.abs(steerIntent) > 0.05 ? steerIntent * 6800 * clamp(kart.speed / 22, 0.25, 1) : 0;
  const preFx = Math.sin(kart.yaw);
  const preFz = Math.cos(kart.yaw);
  const preRx = Math.cos(kart.yaw);
  const preRz = -Math.sin(kart.yaw);
  const preVLat = kart.vx * preRx + kart.vz * preRz;
  const preVFwd = kart.vx * preFx + kart.vz * preFz;
  const torqueAlign = SLIP_SELF_ALIGN_TORQUE * preVLat * clamp(preVFwd / 30, 0.2, 1);
  const yawAccel = (torqueThrust + torqueBrakeSteer + torqueAlign - YAW_DAMPING * kart.yawRate) / KART_YAW_INERTIA;
  kart.yawRate = clamp(kart.yawRate + yawAccel * dt, -3.2, 3.2);
  kart.yaw = wrapAngle(kart.yaw + kart.yawRate * dt);
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
  const fOffroad = offroad ? -Math.sign(vFwd) * (OFFROAD_EXTRA_DRAG_N + 120 * Math.abs(vFwd)) : 0;
  const fGravity = -KART_MASS_KG * GRAVITY_MPS2 * Math.sin(kart.pitch);
  const fBrake = braking && vFwd > 0.05 ? -BRAKE_FORCE_N : 0;
  const muEff = offroad ? TIRE_LATERAL_MU * 0.72 : TIRE_LATERAL_MU;
  const aLatMax = muEff * GRAVITY_MPS2 + AERO_DOWNFORCE_COEFF * vFwd * vFwd;
  const aLatDesired = -TIRE_CORNERING_STIFFNESS * vLat;
  const aLatTire = clamp(aLatDesired, -aLatMax, aLatMax);
  const aAeroLat = -(AERO_DRAG_COEFF * vMag * vLat) / KART_MASS_KG;
  const aScrub = vFwd > 0.5 ? -0.14 * Math.abs(aLatTire) * clamp(Math.abs(vLat) / 10, 0, 1) : 0;
  const aFwd = (fThrust + fAeroFwd + fRoll + fOffroad + fGravity + fBrake) / KART_MASS_KG + aScrub;
  const aLat = aLatTire + aAeroLat;
  let nextVFwd = vFwd + aFwd * dt;
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
  const realSlipAngle = Math.atan2(-nextVLat, Math.max(18, nextVFwd));
  const targetDriftYaw = clamp(realSlipAngle * 1.15 + kart.yawRate * 0.06, -0.34, 0.34);
  const targetRoll = clamp(kart.yawRate * 0.11 + realSlipAngle * 0.25, -0.24, 0.24);
  const blend = Math.min(1, dt * 10.5);
  kart.driftYaw += (targetDriftYaw - kart.driftYaw) * blend;
  kart.bodyRoll += (targetRoll - kart.bodyRoll) * blend;
  const prevS = kart.s;
  kart.x += kart.vx * dt;
  kart.z += kart.vz * dt;
  const proj = projectOntoCircuit(circuit, kart.x, kart.z, prevS);
  const L = circuit.totalLength;
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
  const node = circuit.nodes[proj.nodeIndex];
  if (node.hasBoostPad && Math.abs(kart.lat - node.boostLat) < 4.2) {
    const shouldEmit = kart.boostKind !== "pad" || kart.boostTimer < ROAD_BOOST_DURATION_SEC - 0.6;
    kart.boostTimer = ROAD_BOOST_DURATION_SEC;
    kart.boostKind = "pad";
    if (shouldEmit) {
      events.boostTriggered.push({ slot: kart.slot, kind: "pad" });
    }
  }
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
      rz: backZ + srz * 0.95
    });
    if (kart.skidMarks.length > 38) {
      kart.skidMarks.shift();
    }
  }
  if (race?.format === "marathon") {
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
      const oldGateYaw = Math.atan2(circuit.nodes[0].tx, circuit.nodes[0].tz);
      const relYaw = wrapAngle(kart.yaw - oldGateYaw);
      const vFwd2 = kart.vx * Math.sin(oldGateYaw) + kart.vz * Math.cos(oldGateYaw);
      const vLat2 = kart.vx * Math.cos(oldGateYaw) - kart.vz * Math.sin(oldGateYaw);
      const clampedLat = clamp(kart.lat, -(nextCircuit.wallHalfWidth - 1.4), nextCircuit.wallHalfWidth - 1.4);
      const entryS = clamp(overshoot, 0.05, nextCircuit.totalLength * 0.25);
      const nextSample = sampleCircuitAtS(nextCircuit, entryS);
      const nextGateYaw = nextSample.yaw;
      kart.x = nextSample.x + nextSample.rx * clampedLat;
      kart.y = nextSample.y;
      kart.z = nextSample.z + nextSample.rz * clampedLat;
      kart.yaw = wrapAngle(nextGateYaw + relYaw);
      kart.pitch = nextSample.pitch;
      kart.vx = Math.sin(nextGateYaw) * vFwd2 + Math.cos(nextGateYaw) * vLat2;
      kart.vz = Math.cos(nextGateYaw) * vFwd2 - Math.sin(nextGateYaw) * vLat2;
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
        finished: false
      });
      events.portalCrossed.push({
        slot: kart.slot,
        fromStageIndex: completedStage,
        toStageIndex: kart.stageIndex,
        fromCircuitId: circuit.id,
        fromReversed: circuit.reversed,
        toCircuitId: nextCircuit.id,
        toReversed: nextCircuit.reversed
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
      finished
    });
  }
}
function lockLeaderNextPortalOntoTarget(race, leader, target) {
  const nextIdx = leader.stageIndex + 1;
  const cycleStart = Math.floor(nextIdx / MARATHON_CYCLE_STAGES) * MARATHON_CYCLE_STAGES;
  const cycleEnd = cycleStart + MARATHON_CYCLE_STAGES;
  getMarathonStageForKart(race, leader, cycleEnd - 1);
  const curr = leader.marathonSchedule[leader.stageIndex];
  if (target.circuitId === curr.circuitId) return;
  const existing = leader.marathonSchedule[nextIdx];
  if (existing.circuitId === target.circuitId && existing.reversed === target.reversed) {
    return;
  }
  const tail = leader.marathonSchedule.slice(nextIdx, cycleEnd);
  const matchInTail = tail.findIndex(
    (s) => s.circuitId === target.circuitId && s.reversed === target.reversed
  );
  if (matchInTail >= 0) {
    const rest = tail.filter((_, idx) => idx !== matchInTail);
    const nextCycleFirstId = leader.marathonSchedule.length > cycleEnd ? leader.marathonSchedule[cycleEnd].circuitId : null;
    const solved = [target];
    const used = new Uint8Array(rest.length);
    const backtrack = () => {
      if (solved.length === tail.length) {
        return nextCycleFirstId === null || solved[solved.length - 1].circuitId !== nextCycleFirstId;
      }
      const prevId = solved[solved.length - 1].circuitId;
      for (let i = 0; i < rest.length; i += 1) {
        if (!used[i] && rest[i].circuitId !== prevId) {
          used[i] = 1;
          solved.push(rest[i]);
          if (backtrack()) return true;
          solved.pop();
          used[i] = 0;
        }
      }
      return false;
    };
    if (backtrack()) {
      for (let k = 0; k < solved.length; k += 1) {
        leader.marathonSchedule[nextIdx + k] = solved[k];
      }
      return;
    }
  }
  const after = leader.marathonSchedule[nextIdx + 1];
  if (!after || after.circuitId !== target.circuitId) {
    leader.marathonSchedule[nextIdx] = target;
  } else {
    for (let k = nextIdx + 2; k < cycleEnd; k += 1) {
      const cand = leader.marathonSchedule[k];
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
function stepRaceState(race, humanInputs, dtMs) {
  const clampedMs = clamp(dtMs, 0, 50);
  const dt = clampedMs / 1e3;
  const events = {
    boostTriggered: [],
    lapCompleted: [],
    portalCrossed: [],
    eliminated: [],
    bumped: false
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
      const aiInput = computeAiThrusters(kart, kartCircuit, leaderUnwrappedS, race.elapsedMs);
      stepSingleKart(
        kart,
        aiInput,
        kartCircuit,
        dt,
        race.elapsedMs,
        events,
        kart.aiBaseSkill,
        race
      );
    }
  }
  for (let i = 0; i < race.karts.length; i += 1) {
    for (let j = i + 1; j < race.karts.length; j += 1) {
      const a = race.karts[i];
      const b = race.karts[j];
      if (a.eliminated || b.eliminated) continue;
      if (race.format === "marathon" && getCircuitForKart(race, a).id !== getCircuitForKart(race, b).id) {
        continue;
      }
      if (resolveElasticKartCollision(a, b, true)) {
        events.bumped = true;
      }
    }
  }
  if (race.format === "marathon") {
    let active = race.karts.filter((k) => !k.eliminated).sort((a, b) => b.marathonProgress - a.marathonProgress);
    while (race.status === "racing" && active.length > 1) {
      const leader = active[0];
      const trailer = active[active.length - 1];
      const gapStages = leader.marathonProgress - trailer.marathonProgress;
      const leaderStage = getMarathonStageForKart(race, leader, leader.stageIndex);
      const trailerStage = getMarathonStageForKart(race, trailer, trailer.stageIndex);
      const onSameRoad = leaderStage.circuitId === trailerStage.circuitId && leaderStage.reversed === trailerStage.reversed;
      if (gapStages >= MARATHON_CYCLE_STAGES && onSameRoad || gapStages >= MARATHON_CYCLE_STAGES + 1) {
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
          name: trailer.name
        });
        active = active.slice(0, active.length - 1);
      } else {
        break;
      }
    }
    if (race.status === "racing" && active.length > 1) {
      const leader = active[0];
      const trailer = active[active.length - 1];
      const gapStages = leader.marathonProgress - trailer.marathonProgress;
      if (gapStages >= MARATHON_CYCLE_STAGES - 1) {
        const leaderStage = getMarathonStageForKart(race, leader, leader.stageIndex);
        const trailerStage = getMarathonStageForKart(race, trailer, trailer.stageIndex);
        const onSameRoad = leaderStage.circuitId === trailerStage.circuitId && leaderStage.reversed === trailerStage.reversed;
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
          onSameRoad
        };
      } else {
        race.marathonHunt = null;
      }
    } else {
      race.marathonHunt = null;
    }
    race.survivorsCount = active.length;
    race.marathonLeadGapLaps = active.length > 1 ? Math.max(0, active[0].marathonProgress - active[active.length - 1].marathonProgress) : MARATHON_CYCLE_STAGES;
    const eliminatedSorted = race.karts.filter((k) => k.eliminated).sort((a, b) => (b.eliminatedAtMs ?? 0) - (a.eliminatedAtMs ?? 0));
    const ordered = [...active, ...eliminatedSorted];
    ordered.forEach((kart, idx) => {
      kart.place = idx + 1;
    });
    const humanKarts = race.karts.filter((k) => k.isHuman);
    const allHumansEliminated = humanKarts.length > 0 && humanKarts.every((k) => k.eliminated);
    if (race.status === "racing" && (active.length <= 1 || allHumansEliminated)) {
      race.status = "finished";
      const champ = active[0] ?? ordered[0];
      race.winnerSlot = champ.slot;
      if (active.length === 1 && champ.finishMs === null) {
        champ.finishMs = Math.round(race.elapsedMs);
      }
    }
  } else {
    const sorted = [...race.karts].sort((a, b) => {
      if (a.finishMs !== null && b.finishMs !== null) return a.finishMs - b.finishMs;
      if (a.finishMs !== null) return -1;
      if (b.finishMs !== null) return 1;
      return b.unwrappedS - a.unwrappedS;
    });
    sorted.forEach((kart, idx) => {
      kart.place = idx + 1;
    });
    const humanKarts = race.karts.filter((k) => k.isHuman);
    const allHumansDone = humanKarts.length > 0 && humanKarts.every((k) => k.finishMs !== null);
    if (race.status === "racing" && allHumansDone) {
      race.status = "finished";
      race.winnerSlot = sorted[0]?.slot ?? 0;
    }
  }
  race.lastEvents = events;
  return race;
}
function getKartCenterOfMass(kart) {
  return {
    x: kart.x + Math.sin(kart.yaw) * KART_COM_Z_OFFSET,
    z: kart.z + Math.cos(kart.yaw) * KART_COM_Z_OFFSET
  };
}
function cross2D(rx, rz, vx, vz) {
  return rz * vx - rx * vz;
}
function resolveElasticKartCollision(a, b, separate = true) {
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
  const axes = [
    { ax: aRx, az: aRz },
    { ax: aFx, az: aFz },
    { ax: bRx, az: bRz },
    { ax: bFx, az: bFz }
  ];
  let minOverlap = Infinity;
  let nx = 1;
  let nz = 0;
  for (const cand of axes) {
    const projA = KART_HALF_WIDTH * Math.abs(aRx * cand.ax + aRz * cand.az) + KART_HALF_LENGTH * Math.abs(aFx * cand.ax + aFz * cand.az);
    const projB = KART_HALF_WIDTH * Math.abs(bRx * cand.ax + bRz * cand.az) + KART_HALF_LENGTH * Math.abs(bFx * cand.ax + bFz * cand.az);
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
  const comA = getKartCenterOfMass(a);
  const comB = getKartCenterOfMass(b);
  const comDx = comB.x - comA.x;
  const comDz = comB.z - comA.z;
  const comDist = Math.hypot(comDx, comDz);
  let physNx = comDist > 1e-6 ? comDx / comDist : nx;
  let physNz = comDist > 1e-6 ? comDz / comDist : nz;
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
      const j = -2 * vRelNormal / denom;
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
function getRecommendedSpeedAtS(circuit, s) {
  const sample = sampleCircuitAtS(circuit, s);
  return circuit.nodes[sample.nodeIndex]?.recommendedSpeed ?? MAX_STRAIGHT_SPEED;
}
function convertKartToCpu(race, slot) {
  const kart = race.karts[slot];
  if (!kart || !kart.isHuman) return false;
  const spec = getKartDriverSpec(kart.character);
  kart.isHuman = false;
  kart.isRemote = false;
  kart.name = spec.driverName;
  return true;
}
function takeOverBestCpuKart(race, humanName) {
  const candidates = race.karts.filter((k) => !k.isHuman && !k.eliminated).sort((a, b) => a.place - b.place);
  const best = candidates[0];
  if (!best) return -1;
  best.isHuman = true;
  best.isRemote = false;
  best.name = humanName.trim() || "Player";
  return best.slot;
}
function r2(n) {
  return Math.round(n * 100) / 100;
}
function serializeAuthoritativeRaceSnapshot(race, serverTick) {
  const isMarathon = race.format === "marathon";
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
        yw: Math.round(kart.yaw * 1e3) / 1e3,
        pt: Math.round(kart.pitch * 1e3) / 1e3,
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
        mp: Math.round(kart.marathonProgress * 1e3) / 1e3,
        el: kart.eliminated ? 1 : 0,
        fn: kart.finishMs,
        bl: kart.bestLapMs,
        bt: r2(kart.boostTimer),
        bk: kart.boostKind,
        ltT: r2(kart.leftThrottle),
        rtT: r2(kart.rightThrottle),
        br: kart.braking ? 1 : 0,
        dd: kart.driftDir,
        ...curStage ? { sc: curStage.circuitId, sr: curStage.reversed ? 1 : 0 } : {},
        ...nextStage ? { nc: nextStage.circuitId, nr: nextStage.reversed ? 1 : 0 } : {}
      };
    })
  };
}

// src/shared/kartOnlineRoom.ts
var KART_MAX_PLAYERS = 8;
var KART_LOBBY_TIMEOUT_MS = 12e4;
var KART_SERVER_TICK_MS = 50;
var KART_PHYSICS_SUBSTEP_MS = 1e3 / 120;
var KART_START_COUNTDOWN_MS = 2400;
var KART_PLAYER_DISCONNECT_MS = 15e3;
var KART_FINISHED_IDLE_TTL_MS = 45e3;
var VALID_CIRCUITS = new Set(CIRCUIT_LIST.map((c) => c.id));
var VALID_CHARS = new Set(KART_DRIVERS.map((d) => d.id));
var ALL_CHAR_IDS = KART_DRIVERS.map((d) => d.id);
function sanitizeCircuit(raw) {
  return typeof raw === "string" && VALID_CIRCUITS.has(raw) ? raw : "sunset-loop";
}
function sanitizeFormat(raw) {
  return raw === "marathon" ? "marathon" : "grand-prix";
}
function sanitizeCharacter(raw) {
  return typeof raw === "string" && VALID_CHARS.has(raw) ? raw : "fox";
}
function cleanName(raw) {
  if (typeof raw !== "string") return "Player";
  return raw.trim().replace(/\s+/g, " ").slice(0, 24) || "Player";
}
function pickUniqueCharacter(players, preferred, excludePlayerId) {
  const taken = /* @__PURE__ */ new Set();
  for (const p of players.values()) {
    if (p.id !== excludePlayerId) taken.add(p.character);
  }
  if (preferred && !taken.has(preferred)) return preferred;
  return ALL_CHAR_IDS.find((c) => !taken.has(c)) ?? preferred ?? "fox";
}
function nextOpenSlot(players) {
  const used = /* @__PURE__ */ new Set();
  for (const p of players.values()) used.add(p.slot);
  for (let s = 0; s < KART_MAX_PLAYERS; s += 1) {
    if (!used.has(s)) return s;
  }
  return -1;
}
function createKartOnlineRoomManager({ now = () => Date.now() } = {}) {
  let room = null;
  let seq = 1;
  let lastClosedNotice = null;
  function makeId() {
    return `kroom_${now().toString(36)}_${(seq++).toString(36)}`;
  }
  function closeRoom(reason) {
    if (!room) return null;
    const notice = {
      roomId: room.id,
      hostId: room.hostId,
      reason,
      at: now()
    };
    lastClosedNotice = notice;
    room = null;
    return notice;
  }
  function buildAuthoritativeRace(r, t) {
    const humanRoster = [...r.players.values()].sort((a, b) => a.slot - b.slot).map((p) => ({ slot: p.slot, name: p.name, character: p.character }));
    r.race = createRaceState(r.circuitId, "online-8p", r.seed, {
      reversed: r.reversed,
      format: r.format,
      humanRoster
    });
    r.status = "playing";
    r.raceStartedAt = t;
    r.lastTickAt = t;
    r.finishedAt = null;
    r.serverTick = 1;
    r.inputsBySlot = {};
    r.lastSnapshot = serializeAuthoritativeRaceSnapshot(r.race, r.serverTick);
  }
  function createLobby(hostId, hostName, options = {}, notifiedOnlineIds = []) {
    const t = now();
    if (room) {
      return { ok: false, error: "An 8P Micro Kart room is already active \u2014 join or spectate it!" };
    }
    const cleanHostName = cleanName(hostName);
    const charId = sanitizeCharacter(options.character);
    const notified = /* @__PURE__ */ new Set();
    for (const pid of notifiedOnlineIds) {
      if (pid && pid !== hostId) notified.add(pid);
    }
    const hostMember = {
      id: hostId,
      name: cleanHostName,
      slot: 0,
      character: charId,
      joinedAt: t,
      lastSeenAt: t
    };
    room = {
      id: makeId(),
      status: "waiting",
      hostId,
      hostName: cleanHostName,
      format: sanitizeFormat(options.format),
      circuitId: sanitizeCircuit(options.circuitId),
      reversed: Boolean(options.reversed),
      seed: typeof options.seed === "number" && Number.isFinite(options.seed) ? Math.max(1, Math.floor(options.seed)) : t % 999983 + 1,
      createdAt: t,
      timeoutAt: t + KART_LOBBY_TIMEOUT_MS,
      raceStartedAt: null,
      finishedAt: null,
      lastTickAt: t,
      serverTick: 0,
      players: /* @__PURE__ */ new Map([[hostId, hostMember]]),
      spectators: /* @__PURE__ */ new Map(),
      notifiedIds: notified,
      dismissedBy: /* @__PURE__ */ new Set(),
      inputsBySlot: {},
      race: null,
      lastSnapshot: null
    };
    lastClosedNotice = null;
    return { ok: true, room: getPublicRoomView(hostId) };
  }
  function joinRoom(playerId, playerName, preferredCharacter) {
    const t = now();
    if (!room) return { ok: false, error: "No active 8P Micro Kart room." };
    const existing = room.players.get(playerId);
    if (existing) {
      existing.lastSeenAt = t;
      return {
        ok: true,
        joinedLive: room.status === "playing",
        slot: existing.slot,
        character: existing.character,
        room: getPublicRoomView(playerId),
        snapshot: room.lastSnapshot
      };
    }
    const name = cleanName(playerName);
    room.spectators.delete(playerId);
    room.dismissedBy.delete(playerId);
    if (room.status === "waiting") {
      const slot2 = nextOpenSlot(room.players);
      if (slot2 < 0) return { ok: false, error: "Room is full (8/8 players)." };
      const chosenChar = pickUniqueCharacter(
        room.players,
        preferredCharacter ? sanitizeCharacter(preferredCharacter) : void 0
      );
      room.players.set(playerId, {
        id: playerId,
        name,
        slot: slot2,
        character: chosenChar,
        joinedAt: t,
        lastSeenAt: t
      });
      return {
        ok: true,
        joinedLive: false,
        slot: slot2,
        character: chosenChar,
        room: getPublicRoomView(playerId),
        snapshot: null
      };
    }
    if (!room.race) return { ok: false, error: "Race state unavailable." };
    const slot = takeOverBestCpuKart(room.race, name);
    if (slot < 0) {
      room.spectators.set(playerId, { id: playerId, name, joinedAt: t, lastSeenAt: t });
      return { ok: false, error: "All 8 karts are already human-controlled." };
    }
    const takenKart = room.race.karts[slot];
    room.players.set(playerId, {
      id: playerId,
      name,
      slot,
      character: takenKart.character,
      joinedAt: t,
      lastSeenAt: t
    });
    room.inputsBySlot[slot] = { left: false, right: false, brake: false };
    room.lastSnapshot = serializeAuthoritativeRaceSnapshot(room.race, room.serverTick);
    return {
      ok: true,
      joinedLive: true,
      slot,
      character: takenKart.character,
      room: getPublicRoomView(playerId),
      snapshot: room.lastSnapshot
    };
  }
  function selectCharacter(playerId, character) {
    if (!room || room.status !== "waiting") {
      return { ok: false, error: "Character can only be changed in the waiting lobby." };
    }
    const member = room.players.get(playerId);
    if (!member) return { ok: false, error: "Player is not in the lobby." };
    const cleanChar = sanitizeCharacter(character);
    for (const other of room.players.values()) {
      if (other.id !== playerId && other.character === cleanChar) {
        return { ok: false, error: `${cleanChar} is already chosen by ${other.name}.` };
      }
    }
    member.character = cleanChar;
    member.lastSeenAt = now();
    return { ok: true, character: cleanChar };
  }
  function updateLobbyOptions(requesterId, options) {
    if (!room || room.status !== "waiting" || room.hostId !== requesterId) return false;
    if (options.format !== void 0) room.format = sanitizeFormat(options.format);
    if (options.circuitId !== void 0) room.circuitId = sanitizeCircuit(options.circuitId);
    if (options.reversed !== void 0) room.reversed = Boolean(options.reversed);
    return true;
  }
  function spectate(playerId, playerName) {
    const t = now();
    if (!room) return { ok: false, error: "No active 8P Micro Kart room." };
    if (room.players.has(playerId)) {
      return { ok: true, room: getPublicRoomView(playerId), snapshot: room.lastSnapshot };
    }
    room.dismissedBy.delete(playerId);
    room.spectators.set(playerId, {
      id: playerId,
      name: cleanName(playerName),
      joinedAt: t,
      lastSeenAt: t
    });
    return { ok: true, room: getPublicRoomView(playerId), snapshot: room.lastSnapshot };
  }
  function dismissLobby(playerId) {
    if (!room || room.status !== "waiting") return { closed: null };
    if (room.players.has(playerId)) return { closed: null };
    room.dismissedBy.add(playerId);
    if (room.players.size < 2 && room.notifiedIds.size > 0 && [...room.notifiedIds].every((id) => room.dismissedBy.has(id))) {
      return { closed: closeRoom("all_dismissed") };
    }
    return { closed: null };
  }
  function startRace(requesterId) {
    if (!room || room.status !== "waiting") return { ok: false, error: "No waiting lobby to start." };
    if (room.hostId !== requesterId) return { ok: false, error: "Only the host can start the race." };
    if (room.players.size < 2) {
      return { ok: false, error: "Wait for at least 1 other player to join before starting." };
    }
    buildAuthoritativeRace(room, now());
    return {
      ok: true,
      room: getPublicRoomView(requesterId),
      snapshot: room.lastSnapshot
    };
  }
  function setInput(playerId, input) {
    if (!room || room.status !== "playing") return false;
    const member = room.players.get(playerId);
    if (!member) return false;
    member.lastSeenAt = now();
    const steerAnalog = typeof input.steerAnalog === "number" && Number.isFinite(input.steerAnalog) ? Math.max(-1, Math.min(1, input.steerAnalog)) : void 0;
    room.inputsBySlot[member.slot] = {
      left: Boolean(input.left),
      right: Boolean(input.right),
      brake: Boolean(input.brake),
      ...steerAnalog !== void 0 ? { steerAnalog } : {}
    };
    return true;
  }
  function touch(playerId) {
    if (!room) return;
    const t = now();
    const m = room.players.get(playerId);
    if (m) m.lastSeenAt = t;
    const s = room.spectators.get(playerId);
    if (s) s.lastSeenAt = t;
  }
  function leave(playerId) {
    if (!room) return { changed: false, convertedSlot: null, closed: null };
    if (room.spectators.delete(playerId)) {
      if (room.status === "playing" && room.players.size === 0 && room.spectators.size === 0) {
        return { changed: true, convertedSlot: null, closed: closeRoom("empty") };
      }
      return { changed: true, convertedSlot: null, closed: null };
    }
    const member = room.players.get(playerId);
    if (!member) return { changed: false, convertedSlot: null, closed: null };
    room.players.delete(playerId);
    delete room.inputsBySlot[member.slot];
    if (room.status === "waiting") {
      if (room.players.size === 0 || member.id === room.hostId) {
        if (member.id === room.hostId) {
          return { changed: true, convertedSlot: null, closed: closeRoom("host_cancelled") };
        }
        return { changed: true, convertedSlot: null, closed: closeRoom("empty") };
      }
      return { changed: true, convertedSlot: null, closed: null };
    }
    let convertedSlot = null;
    if (room.race && convertKartToCpu(room.race, member.slot)) {
      convertedSlot = member.slot;
      room.lastSnapshot = serializeAuthoritativeRaceSnapshot(room.race, room.serverTick);
    }
    if (member.id === room.hostId && room.players.size > 0) {
      const nextHost = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      room.hostId = nextHost.id;
      room.hostName = nextHost.name;
    }
    if (room.players.size === 0 && room.spectators.size === 0) {
      return { changed: true, convertedSlot, closed: closeRoom("empty") };
    }
    return { changed: true, convertedSlot, closed: null };
  }
  function checkTimers(onlinePlayerIds) {
    const t = now();
    if (!room) return { autoStarted: false, closed: null, convertedSlots: [], changed: false };
    let changed = false;
    const convertedSlots = [];
    if (room.status === "waiting") {
      if (onlinePlayerIds) {
        for (const nid of [...room.notifiedIds]) {
          if (!onlinePlayerIds.has(nid)) {
            room.notifiedIds.delete(nid);
            room.dismissedBy.delete(nid);
          }
        }
      }
      if (t >= room.timeoutAt) {
        if (room.players.size >= 2) {
          buildAuthoritativeRace(room, t);
          return { autoStarted: true, closed: null, convertedSlots, changed: true };
        }
        return { autoStarted: false, closed: closeRoom("timeout"), convertedSlots, changed: true };
      }
      if (room.players.size < 2 && room.notifiedIds.size > 0 && [...room.notifiedIds].every((id) => room.dismissedBy.has(id))) {
        return { autoStarted: false, closed: closeRoom("all_dismissed"), convertedSlots, changed: true };
      }
      const host = room.players.get(room.hostId);
      if (host && t - host.lastSeenAt > KART_PLAYER_DISCONNECT_MS * 2) {
        return { autoStarted: false, closed: closeRoom("host_cancelled"), convertedSlots, changed: true };
      }
      return { autoStarted: false, closed: null, convertedSlots, changed };
    }
    for (const member of [...room.players.values()]) {
      if (t - member.lastSeenAt > KART_PLAYER_DISCONNECT_MS) {
        room.players.delete(member.id);
        delete room.inputsBySlot[member.slot];
        if (room.race && convertKartToCpu(room.race, member.slot)) {
          convertedSlots.push(member.slot);
        }
        changed = true;
      }
    }
    for (const spec of [...room.spectators.values()]) {
      if (t - spec.lastSeenAt > KART_PLAYER_DISCONNECT_MS * 2) {
        room.spectators.delete(spec.id);
        changed = true;
      }
    }
    if (room.players.size === 0 && room.spectators.size === 0) {
      return { autoStarted: false, closed: closeRoom("empty"), convertedSlots, changed: true };
    }
    if (room.finishedAt !== null && t - room.finishedAt > KART_FINISHED_IDLE_TTL_MS) {
      return { autoStarted: false, closed: closeRoom("empty"), convertedSlots, changed: true };
    }
    return { autoStarted: false, closed: null, convertedSlots, changed };
  }
  function tickSimulation() {
    if (!room || room.status !== "playing" || !room.race) return null;
    const t = now();
    const dtMs = Math.min(120, Math.max(0, t - room.lastTickAt));
    room.lastTickAt = t;
    const countdownRemaining = room.raceStartedAt !== null ? Math.max(0, room.raceStartedAt + KART_START_COUNTDOWN_MS - t) : 0;
    if (countdownRemaining <= 0 && dtMs > 0) {
      let remMs = dtMs;
      while (remMs > 0.05) {
        const subMs = Math.min(KART_PHYSICS_SUBSTEP_MS, remMs);
        stepRaceState(room.race, room.inputsBySlot, subMs);
        remMs -= subMs;
      }
      if (room.race.status === "finished" && room.finishedAt === null) {
        room.finishedAt = t;
      }
    }
    room.serverTick += 1;
    room.lastSnapshot = serializeAuthoritativeRaceSnapshot(room.race, room.serverTick);
    return room.lastSnapshot;
  }
  function isSimActive() {
    return Boolean(room && room.status === "playing");
  }
  function hasActiveRoom() {
    return room !== null;
  }
  function getRoomMemberIds() {
    const ids = /* @__PURE__ */ new Set();
    if (!room) return ids;
    for (const id of room.players.keys()) ids.add(id);
    for (const id of room.spectators.keys()) ids.add(id);
    return ids;
  }
  function getPublicRoomView(forPlayerId) {
    if (!room) return null;
    const t = now();
    const takenCharacters = {};
    const players = [...room.players.values()].sort((a, b) => a.slot - b.slot).map((p) => {
      takenCharacters[p.character] = { playerId: p.id, playerName: p.name };
      return {
        id: p.id,
        name: p.name,
        slot: p.slot,
        character: p.character,
        isHost: p.id === room.hostId
      };
    });
    const spectators = [...room.spectators.values()].map((s) => ({ id: s.id, name: s.name }));
    const myPlayer = room.players.get(forPlayerId);
    const myRole = myPlayer ? "player" : room.spectators.has(forPlayerId) ? "spectator" : "none";
    const countdownRemainingMs = room.status === "playing" && room.raceStartedAt !== null ? Math.max(0, room.raceStartedAt + KART_START_COUNTDOWN_MS - t) : 0;
    const openCpuSeats = room.status === "playing" && room.race ? room.race.karts.filter((k) => !k.isHuman && !k.eliminated).length : Math.max(0, KART_MAX_PLAYERS - room.players.size);
    return {
      id: room.id,
      status: room.status,
      hostId: room.hostId,
      hostName: room.hostName,
      format: room.format,
      circuitId: room.circuitId,
      reversed: room.reversed,
      seed: room.seed,
      maxPlayers: KART_MAX_PLAYERS,
      createdAt: room.createdAt,
      timeoutAt: room.timeoutAt,
      countdownRemainingMs,
      players,
      spectators,
      takenCharacters,
      myRole,
      mySlot: myPlayer ? myPlayer.slot : null,
      canStart: room.status === "waiting" && room.hostId === forPlayerId && room.players.size >= 2,
      dismissedByMe: room.dismissedBy.has(forPlayerId),
      notifiedCount: room.notifiedIds.size,
      dismissedCount: room.dismissedBy.size,
      openCpuSeats
    };
  }
  function getLastClosedNotice() {
    if (!lastClosedNotice) return null;
    if (now() - lastClosedNotice.at > 15e3) return null;
    return lastClosedNotice;
  }
  function getLastSnapshot() {
    return room?.lastSnapshot ?? null;
  }
  return {
    createLobby,
    joinRoom,
    selectCharacter,
    updateLobbyOptions,
    spectate,
    dismissLobby,
    startRace,
    setInput,
    touch,
    leave,
    checkTimers,
    tickSimulation,
    isSimActive,
    hasActiveRoom,
    getRoomMemberIds,
    getPublicRoomView,
    getLastClosedNotice,
    getLastSnapshot
  };
}
export {
  KART_FINISHED_IDLE_TTL_MS,
  KART_LOBBY_TIMEOUT_MS,
  KART_MAX_PLAYERS,
  KART_PHYSICS_SUBSTEP_MS,
  KART_PLAYER_DISCONNECT_MS,
  KART_SERVER_TICK_MS,
  KART_START_COUNTDOWN_MS,
  createKartOnlineRoomManager
};
