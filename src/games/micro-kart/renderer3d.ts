/**
 * Pure TypeScript Low-Poly Flat-Shaded 3D Perspective Renderer (#344, #358).
 *
 * Zero external 3D libraries, zero texture or model downloads. Projects world
 * triangles/quads into camera space, clips against the near plane (`z >= NEAR_Z`)
 * via Sutherland-Hodgman, shades faces with directional sunlight + distance fog,
 * and painter-sorts polygons onto a Hi-DPI 2D `<canvas>`.
 */

import {
  CIRCUITS,
  getKartDriverSpec,
  MINI_TURBO_CHARGE_SEC,
  ULTRA_TURBO_CHARGE_SEC,
  type CircuitDefinition,
  type KartRaceState,
  type KartState,
  type SceneryProp,
} from '../../shared/microKart';
import { emitAnimalDriverMesh } from './driver3d';

export interface ChaseCamera {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  fovScale: number;
  initialized: boolean;
  orbitYawOffset?: number;
  orbitDist?: number;
  orbitHeight?: number;
}

export function createChaseCamera(): ChaseCamera {
  return {
    x: 0,
    y: 5,
    z: -10,
    yaw: 0,
    pitch: -0.14,
    fovScale: 1,
    initialized: false,
  };
}

function wrapAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export function updateChaseCamera(cam: ChaseCamera, target: KartState, dtSec: number): void {
  if (cam.orbitYawOffset !== undefined) {
    const dist = cam.orbitDist ?? 5.4;
    const h = cam.orbitHeight ?? 2.35;
    const angleFromKart = target.yaw + cam.orbitYawOffset;
    cam.x = target.x + Math.sin(angleFromKart) * dist;
    cam.z = target.z + Math.cos(angleFromKart) * dist;
    cam.y = target.y + h;
    cam.yaw = Math.atan2(target.x - cam.x, target.z - cam.z);
    cam.pitch = -Math.atan2(h - 0.95, dist);
    cam.fovScale = 1.08;
    cam.initialized = true;
    return;
  }

  const chaseDist = target.boostTimer > 0 ? 9.6 : 8.6;
  const chaseHeight = 3.85;
  const desiredYaw = target.yaw;
  const desiredX = target.x - Math.sin(desiredYaw) * chaseDist;
  const desiredZ = target.z - Math.cos(desiredYaw) * chaseDist;
  const desiredY = target.y + chaseHeight - Math.sin(target.pitch) * 2.0;
  const desiredPitch = -0.155 + target.pitch * 0.65;
  const desiredFov = target.boostTimer > 0 ? 0.88 : 1.0;

  if (!cam.initialized) {
    cam.x = desiredX;
    cam.y = desiredY;
    cam.z = desiredZ;
    cam.yaw = desiredYaw;
    cam.pitch = desiredPitch;
    cam.fovScale = desiredFov;
    cam.initialized = true;
    return;
  }

  const posBlend = Math.min(1, dtSec * 18.0);
  const rotBlend = Math.min(1, dtSec * 15.0);
  cam.x += (desiredX - cam.x) * posBlend;
  cam.y += (desiredY - cam.y) * posBlend;
  cam.z += (desiredZ - cam.z) * posBlend;
  cam.yaw = wrapAngle(cam.yaw + wrapAngle(desiredYaw - cam.yaw) * rotBlend);
  cam.pitch += (desiredPitch - cam.pitch) * rotBlend;
  cam.fovScale += (desiredFov - cam.fovScale) * Math.min(1, dtSec * 8.0);
}

interface Pt3 {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoly {
  depth: number;
  fill: string;
  pts: Array<{ sx: number; sy: number }>;
}

const NEAR_Z = 1.15;
const FAR_Z = 310;
const SUN_DIR = (() => {
  const lx = 0.42;
  const ly = 0.78;
  const lz = -0.46;
  const len = Math.hypot(lx, ly, lz);
  return { x: lx / len, y: ly / len, z: lz / len };
})();

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function shadeAndFogRgb(
  rgb: readonly [number, number, number],
  light: number,
  depth: number,
  fogRgb: readonly [number, number, number],
  emissive = false,
): string {
  const litFactor = emissive ? 1.08 : 0.56 + Math.max(0, light) * 0.52;
  const fogT = Math.max(0, Math.min(0.82, (depth - 95) / (FAR_Z - 95)));
  const r = Math.round(Math.min(255, rgb[0] * litFactor) * (1 - fogT) + fogRgb[0] * fogT);
  const g = Math.round(Math.min(255, rgb[1] * litFactor) * (1 - fogT) + fogRgb[1] * fogT);
  const b = Math.round(Math.min(255, rgb[2] * litFactor) * (1 - fogT) + fogRgb[2] * fogT);
  return `rgb(${r},${g},${b})`;
}

/**
 * Clips a camera-space polygon (`vz` forward) against `vz >= NEAR_Z`.
 */
function clipNearPlane(verts: readonly Pt3[]): Pt3[] {
  const out: Pt3[] = [];
  const n = verts.length;
  if (n < 3) return out;
  for (let i = 0; i < n; i += 1) {
    const cur = verts[i]!;
    const nxt = verts[(i + 1) % n]!;
    const curIn = cur.z >= NEAR_Z;
    const nxtIn = nxt.z >= NEAR_Z;
    if (curIn && nxtIn) {
      out.push(nxt);
    } else if (curIn && !nxtIn) {
      const t = (NEAR_Z - cur.z) / (nxt.z - cur.z);
      out.push({
        x: cur.x + (nxt.x - cur.x) * t,
        y: cur.y + (nxt.y - cur.y) * t,
        z: NEAR_Z,
      });
    } else if (!curIn && nxtIn) {
      const t = (NEAR_Z - cur.z) / (nxt.z - cur.z);
      out.push({
        x: cur.x + (nxt.x - cur.x) * t,
        y: cur.y + (nxt.y - cur.y) * t,
        z: NEAR_Z,
      });
      out.push(nxt);
    }
  }
  return out;
}

interface CameraProjector {
  cx: number;
  cy: number;
  cz: number;
  rx: number;
  ry: number;
  rz: number;
  ux: number;
  uy: number;
  uz: number;
  fx: number;
  fy: number;
  fz: number;
  focal: number;
  halfW: number;
  halfH: number;
  fogRgb: readonly [number, number, number];
  polys: ProjectedPoly[];
}

function makeProjector(
  cam: ChaseCamera,
  width: number,
  height: number,
  fogRgb: readonly [number, number, number],
): CameraProjector {
  const cosY = Math.cos(cam.yaw);
  const sinY = Math.sin(cam.yaw);
  const cosP = Math.cos(cam.pitch);
  const sinP = Math.sin(cam.pitch);

  // Forward with yaw + pitch:
  const fx = sinY * cosP;
  const fy = sinP;
  const fz = cosY * cosP;
  // Horizontal right:
  const rx = cosY;
  const ry = 0;
  const rz = -sinY;
  // Up = forward x right (wait: check sign! At yaw=0, pitch=0: f=[0,0,1], r=[1,0,0].
  // Standard cross(f, r) = [0*0 - 1*0, 1*1 - 0*0, 0*0 - 0*1] = [0, +1, 0]!! YES!!)
  const ux = fy * rz - fz * ry;
  const uy = fz * rx - fx * rz;
  const uz = fx * ry - fy * rx;

  const isWideSplit = width / Math.max(1, height) > 2.15;
  const baseFocal = isWideSplit
    ? Math.min(width * 0.58, height * 1.48)
    : Math.min(width * 0.72, height * 1.05);

  return {
    cx: cam.x,
    cy: cam.y,
    cz: cam.z,
    rx,
    ry,
    rz,
    ux,
    uy,
    uz,
    fx,
    fy,
    fz,
    focal: baseFocal * cam.fovScale,
    halfW: width * 0.5,
    halfH: isWideSplit ? height * 0.48 : height * 0.52,
    fogRgb,
    polys: [],
  };
}

function pushWorldPoly(
  proj: CameraProjector,
  worldVerts: readonly Pt3[],
  rgb: readonly [number, number, number],
  depthBias = 0,
  emissive = false,
): void {
  const camVerts: Pt3[] = [];
  let maxZ = -Infinity;
  let minZ = Infinity;
  for (let i = 0; i < worldVerts.length; i += 1) {
    const w = worldVerts[i]!;
    const dx = w.x - proj.cx;
    const dy = w.y - proj.cy;
    const dz = w.z - proj.cz;
    const vz = dx * proj.fx + dy * proj.fy + dz * proj.fz;
    if (vz > maxZ) maxZ = vz;
    if (vz < minZ) minZ = vz;
    camVerts.push({
      x: dx * proj.rx + dy * proj.ry + dz * proj.rz,
      y: dx * proj.ux + dy * proj.uy + dz * proj.uz,
      z: vz,
    });
  }

  if (maxZ < NEAR_Z || minZ > FAR_Z) return;

  const clipped = minZ < NEAR_Z ? clipNearPlane(camVerts) : camVerts;
  if (clipped.length < 3) return;

  // World-space face normal for directional flat shading
  const a = worldVerts[0]!;
  const b = worldVerts[1]!;
  const c = worldVerts[2]!;
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const acz = c.z - a.z;
  let nx = aby * acz - abz * acy;
  let ny = abz * acx - abx * acz;
  let nz = abx * acy - aby * acx;
  const nLen = Math.hypot(nx, ny, nz) || 1;
  nx /= nLen;
  ny /= nLen;
  nz /= nLen;
  if (ny < 0 && Math.abs(ny) > 0.65) {
    // Ensure upward ground/road quads receive positive sun regardless of winding
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const light = Math.abs(nx * SUN_DIR.x + ny * SUN_DIR.y + nz * SUN_DIR.z);

  let sumZ = 0;
  const pts: Array<{ sx: number; sy: number }> = [];
  for (let i = 0; i < clipped.length; i += 1) {
    const v = clipped[i]!;
    sumZ += v.z;
    const invZ = proj.focal / v.z;
    pts.push({
      sx: proj.halfW + v.x * invZ,
      sy: proj.halfH - v.y * invZ,
    });
  }
  const avgZ = sumZ / clipped.length;
  proj.polys.push({
    depth: avgZ + depthBias,
    fill: shadeAndFogRgb(rgb, light, avgZ, proj.fogRgb, emissive),
    pts,
  });
}

function drawSkyAndMountains(
  ctx: CanvasRenderingContext2D,
  cam: ChaseCamera,
  circuit: CircuitDefinition,
  width: number,
  height: number,
): void {
  const isWideSplit = width / Math.max(1, height) > 2.15;
  const baseFocal = isWideSplit
    ? Math.min(width * 0.58, height * 1.48)
    : Math.min(width * 0.72, height * 1.05);
  const centerH = isWideSplit ? height * 0.48 : height * 0.52;
  const horizonY = Math.max(
    height * 0.12,
    Math.min(height * 0.78, centerH + Math.tan(cam.pitch) * baseFocal * cam.fovScale),
  );

  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, circuit.theme.skyTop);
  skyGrad.addColorStop(1, circuit.theme.skyHorizon);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, horizonY + 2);

  // Ground fill below horizon so there are zero sub-pixel gaps between terrain quads
  ctx.fillStyle = circuit.theme.groundOuter;
  ctx.fillRect(0, horizonY, width, height - horizonY);

  // Low-poly parallax horizon mountain range rotating smoothly with cam.yaw
  ctx.fillStyle = circuit.theme.mountainHex;
  ctx.beginPath();
  const peaks = 24;
  const phasePx = ((cam.yaw / (Math.PI * 2)) * width * 2.2) % (width * 2.2);
  ctx.moveTo(0, horizonY + 1);
  for (let i = -peaks; i <= peaks * 2; i += 1) {
    const x = (i / peaks) * width - phasePx;
    const h =
      (Math.abs(Math.sin(i * 1.7 + 0.4)) * 0.65 + Math.abs(Math.cos(i * 0.9)) * 0.35) *
      Math.min(68, height * 0.16);
    ctx.lineTo(x, horizonY - h);
  }
  ctx.lineTo(width, horizonY + 1);
  ctx.closePath();
  ctx.fill();
}

function emitProp(proj: CameraProjector, prop: SceneryProp): void {
  const s = prop.scale;
  const x = prop.x;
  const y = prop.y;
  const z = prop.z;

  if (prop.kind === 'pine') {
    // Trunk prism + 2-tier low-poly emerald pine pyramid
    const trunkW = 0.55 * s;
    const trunkH = 2.4 * s;
    pushWorldPoly(
      proj,
      [
        { x: x - trunkW, y, z: z - trunkW },
        { x: x + trunkW, y, z: z - trunkW },
        { x: x + trunkW, y: y + trunkH, z: z - trunkW },
        { x: x - trunkW, y: y + trunkH, z: z - trunkW },
      ],
      [96, 64, 42],
    );
    const tiers = [
      { baseY: y + 1.8 * s, topY: y + 6.4 * s, r: 2.6 * s, rgb: [38, 128, 76] as const },
      { baseY: y + 4.8 * s, topY: y + 9.4 * s, r: 1.9 * s, rgb: [52, 158, 92] as const },
    ];
    for (const tier of tiers) {
      const r = tier.r;
      const apex = { x, y: tier.topY, z };
      const corners: Pt3[] = [
        { x: x - r, y: tier.baseY, z: z - r },
        { x: x + r, y: tier.baseY, z: z - r },
        { x: x + r, y: tier.baseY, z: z + r },
        { x: x - r, y: tier.baseY, z: z + r },
      ];
      for (let f = 0; f < 4; f += 1) {
        pushWorldPoly(proj, [corners[f]!, corners[(f + 1) % 4]!, apex], tier.rgb);
      }
    }
    return;
  }

  if (prop.kind === 'spire') {
    const r = 2.5 * s;
    const h = 11.5 * s;
    const apex = { x, y: y + h, z };
    const corners: Pt3[] = [
      { x: x - r, y, z: z - r },
      { x: x + r, y, z: z - r },
      { x: x + r, y, z: z + r },
      { x: x - r, y, z: z + r },
    ];
    for (let f = 0; f < 4; f += 1) {
      pushWorldPoly(proj, [corners[f]!, corners[(f + 1) % 4]!, apex], [186, 98, 58]);
    }
    return;
  }

  // 'pylon': futuristic glowing cyan-violet monolith
  const w = 0.75 * s;
  const h = 9.2 * s;
  const corners: Pt3[] = [
    { x: x - w, y, z: z - w },
    { x: x + w, y, z: z - w },
    { x: x + w, y, z: z + w },
    { x: x - w, y, z: z + w },
  ];
  for (let f = 0; f < 4; f += 1) {
    const c0 = corners[f]!;
    const c1 = corners[(f + 1) % 4]!;
    pushWorldPoly(
      proj,
      [
        c0,
        c1,
        { x: c1.x, y: y + h, z: c1.z },
        { x: c0.x, y: y + h, z: c0.z },
      ],
      [44, 62, 112],
    );
  }
  pushWorldPoly(
    proj,
    [
      { x: x - w * 1.15, y: y + h * 0.72, z: z - w * 1.15 },
      { x: x + w * 1.15, y: y + h * 0.72, z: z + w * 1.15 },
      { x: x + w * 1.15, y: y + h * 0.92, z: z + w * 1.15 },
      { x: x - w * 1.15, y: y + h * 0.92, z: z - w * 1.15 },
    ],
    [57, 197, 207],
    -0.2,
    true,
  );
}

/**
 * Transforms local kart-space `[lx, ly, lz]` (`+lz` nose, `+lx` right, `+ly` up)
 * into 3D world space with full roll, pitch, and yaw+driftYaw.
 */
function makeKartTransform(kart: KartState): (lx: number, ly: number, lz: number) => Pt3 {
  const yaw = kart.yaw + kart.driftYaw;
  const pitch = kart.pitch;
  const roll = -kart.bodyRoll; // Lean into or roll visibly with turn

  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  return (lx, ly, lz) => {
    // 1. Roll around local Z
    const x1 = lx * cr - ly * sr;
    const y1 = lx * sr + ly * cr;
    const z1 = lz;
    // 2. Pitch around local X
    const x2 = x1;
    const y2 = y1 * cp - z1 * sp;
    const z2 = y1 * sp + z1 * cp;
    // 3. Yaw around world Y (`+z` forward, `+x` right)
    const wx = kart.x + x2 * cy + z2 * sy;
    const wy = kart.y + y2;
    const wz = kart.z - x2 * sy + z2 * cy;
    return { x: wx, y: wy, z: wz };
  };
}

function emitBox(
  proj: CameraProjector,
  xf: (lx: number, ly: number, lz: number) => Pt3,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  rgb: readonly [number, number, number],
  bias = -0.35,
  emissive = false,
): void {
  const p000 = xf(x0, y0, z0);
  const p100 = xf(x1, y0, z0);
  const p110 = xf(x1, y1, z0);
  const p010 = xf(x0, y1, z0);
  const p001 = xf(x0, y0, z1);
  const p101 = xf(x1, y0, z1);
  const p111 = xf(x1, y1, z1);
  const p011 = xf(x0, y1, z1);

  // Top, Back (-z), Front (+z), Left (-x), Right (+x)
  pushWorldPoly(proj, [p010, p110, p111, p011], rgb, bias, emissive);
  pushWorldPoly(proj, [p000, p100, p110, p010], rgb, bias, emissive);
  pushWorldPoly(proj, [p101, p001, p011, p111], rgb, bias, emissive);
  pushWorldPoly(proj, [p001, p000, p010, p011], rgb, bias, emissive);
  pushWorldPoly(proj, [p100, p101, p111, p110], rgb, bias, emissive);
}

/**
 * Emits a ~46-polygon sculpted low-poly 3D arcade racing kart with wedge nose,
 * side pods, 4 wheels, cockpit pilot helmet + visor, rear spoiler wing,
 * independent Left & Right plasma thruster flames, and drift-charge sparks!
 */
function emitKartMesh(proj: CameraProjector, kart: KartState, timeMs: number): void {
  const driverSpec = getKartDriverSpec(kart.character);
  const livery = {
    primary: driverSpec.kartPrimary,
    accent: driverSpec.kartAccent,
  };
  const xf = makeKartTransform(kart);
  const darkMetal: [number, number, number] = [28, 34, 46];
  const tireDark: [number, number, number] = [20, 23, 30];
  const nozzleSteel: [number, number, number] = [71, 85, 105];

  // 1. Ground contact shadow quad on the road surface layer (`+19.5` above asphalt `+22`)
  const shYaw = kart.yaw + kart.driftYaw;
  const srx = Math.cos(shYaw);
  const srz = -Math.sin(shYaw);
  const sfx = Math.sin(shYaw);
  const sfz = Math.cos(shYaw);
  const sw = 1.38;
  const sl = 2.18;
  pushWorldPoly(
    proj,
    [
      { x: kart.x - srx * sw - sfx * sl, y: kart.y + 0.05, z: kart.z - srz * sw - sfz * sl },
      { x: kart.x + srx * sw - sfx * sl, y: kart.y + 0.05, z: kart.z + srz * sw - sfz * sl },
      { x: kart.x + srx * sw + sfx * sl, y: kart.y + 0.05, z: kart.z + srz * sw + sfz * sl },
      { x: kart.x - srx * sw + sfx * sl, y: kart.y + 0.05, z: kart.z - srz * sw + sfz * sl },
    ],
    [10, 13, 20],
    19.5,
  );

  // 2. Four chunky 3D racing slicks
  const wheelCoords: ReadonlyArray<[number, number]> = [
    [-1.16, 1.15],
    [1.16, 1.15],
    [-1.24, -1.12],
    [1.24, -1.12],
  ];
  for (const [wx, wz] of wheelCoords) {
    emitBox(proj, xf, wx - 0.25, 0.06, wz - 0.42, wx + 0.25, 0.7, wz + 0.42, tireDark, -0.36);
  }

  // 3. Sculpted Wedge Nose & Low Open-Cockpit Tub (`z: -1.55 .. +2.05`)
  const nTipL = xf(-0.46, 0.22, 2.08);
  const nTipR = xf(0.46, 0.22, 2.08);
  const nTopL = xf(-0.46, 0.42, 2.02);
  const nTopR = xf(0.46, 0.42, 2.02);
  const cMidL = xf(-0.74, 0.62, 0.55);
  const cMidR = xf(0.74, 0.62, 0.55);
  const cBotL = xf(-0.74, 0.2, 0.55);
  const cBotR = xf(0.74, 0.2, 0.55);
  pushWorldPoly(proj, [nTopL, nTopR, cMidR, cMidL], livery.primary, -0.4);
  pushWorldPoly(proj, [nTipR, nTipL, nTopL, nTopR], livery.accent, -0.4);
  pushWorldPoly(proj, [nTipL, cBotL, cMidL, nTopL], livery.primary, -0.4);
  pushWorldPoly(proj, [cBotR, nTipR, nTopR, cMidR], livery.primary, -0.4);

  // Left & Right Sculpted Side Pods (`accent` top stripe)
  emitBox(proj, xf, -1.04, 0.2, -0.95, -0.58, 0.56, 0.68, livery.primary, -0.4);
  emitBox(proj, xf, 0.58, 0.2, -0.95, 1.04, 0.56, 0.68, livery.primary, -0.4);
  emitBox(proj, xf, -1.05, 0.52, -0.82, -0.6, 0.59, 0.55, livery.accent, -0.41);
  emitBox(proj, xf, 0.6, 0.52, -0.82, 1.05, 0.59, 0.55, livery.accent, -0.41);

  // Low Rear Engine Deck (`y <= 0.64` so animal tails & scarves sit cleanly above it!)
  emitBox(proj, xf, -0.78, 0.22, -1.58, 0.78, 0.62, -0.48, livery.primary, -0.4);
  emitBox(proj, xf, -0.88, 0.16, -1.66, 0.88, 0.32, -1.54, darkMetal, -0.41);
  emitBox(
    proj,
    xf,
    kart.braking ? -0.76 : -0.66,
    kart.braking ? 0.54 : 0.56,
    -1.63,
    kart.braking ? 0.76 : 0.66,
    kart.braking ? 0.68 : 0.63,
    -1.56,
    kart.braking ? [255, 36, 56] : [220, 64, 80],
    -0.42,
    true,
  );

  // Open Cockpit Tub Floor + Low Contoured Seat Cushion (`y <= 0.70`)
  emitBox(proj, xf, -0.54, 0.34, -0.52, 0.54, 0.58, 0.48, darkMetal, -0.39);
  emitBox(proj, xf, -0.44, 0.54, -0.56, 0.44, 0.72, -0.38, darkMetal, -0.4);

  // 4. Twin Canted Outer Side Winglets (`x = ±1.02` — frames the driver with ZERO center obstruction!)
  for (const side of [-1, 1] as const) {
    const wxIn = side * 0.84;
    const wxOut = side * 1.12;
    const f0 = xf(wxIn, 0.58, -0.92);
    const f1 = xf(wxIn, 0.62, -1.54);
    const t0 = xf(wxOut, 1.08, -1.16);
    const t1 = xf(wxOut, 1.14, -1.68);
    pushWorldPoly(proj, [f0, f1, t1, t0], livery.accent, -0.42);
    // Winglet tip stripe
    const s0 = xf(wxOut, 1.0, -1.14);
    const s1 = xf(wxOut, 1.06, -1.68);
    pushWorldPoly(proj, [s0, s1, t1, t0], livery.primary, -0.43);
  }

  // 5. Sculpted 360° Low-Poly 3D Starlight Burst Animal Driver!
  emitAnimalDriverMesh(
    (verts, rgb, bias = -0.4, emissive = false) =>
      pushWorldPoly(proj, verts, rgb, bias, emissive),
    xf,
    kart,
    timeMs,
  );

  // 6. Twin Rear Thruster Nozzles (`x = -0.44` and `x = +0.44`)
  emitBox(proj, xf, -0.62, 0.28, -1.84, -0.26, 0.56, -1.54, nozzleSteel, -0.42);
  emitBox(proj, xf, 0.26, 0.28, -1.84, 0.62, 0.56, -1.54, nozzleSteel, -0.42);

  // 7. Live Flickering 3D Plasma Flame Pyramids proportional to continuous left/right thrust!
  const flicker = 0.86 + Math.sin(timeMs * 0.045 + kart.slot) * 0.18;
  const isBoosting = kart.boostTimer > 0;
  const speedBase = Math.min(1, 0.3 + kart.speed / 45);
  const boostGain = isBoosting ? 1.55 : 1.15;
  const leftPower = kart.leftThrottle * boostGain * (isBoosting ? 1 : speedBase);
  const rightPower = kart.rightThrottle * boostGain * (isBoosting ? 1 : speedBase);

  const flameColor: [number, number, number] = isBoosting
    ? kart.boostKind === 'ultra'
      ? [250, 204, 21]
      : [56, 232, 255]
    : [255, 148, 46];

  const emitFlame = (cx: number, power: number) => {
    if (power <= 0.05) return;
    const len = (1.1 + power * 1.45) * flicker;
    const r = 0.2 * Math.min(1.3, 0.7 + power * 0.4);
    const cy = 0.42;
    const zBase = -1.84;
    const apex = xf(cx, cy, zBase - len);
    const b0 = xf(cx - r, cy - r, zBase);
    const b1 = xf(cx + r, cy - r, zBase);
    const b2 = xf(cx + r, cy + r, zBase);
    const b3 = xf(cx - r, cy + r, zBase);
    pushWorldPoly(proj, [b0, b1, apex], flameColor, -0.48, true);
    pushWorldPoly(proj, [b1, b2, apex], [255, 245, 200], -0.49, true);
    pushWorldPoly(proj, [b2, b3, apex], flameColor, -0.48, true);
    pushWorldPoly(proj, [b3, b0, apex], flameColor, -0.48, true);
  };

  emitFlame(-0.44, leftPower);
  emitFlame(0.44, rightPower);

  // 8. Rear Tire Drift-Charge Sparks (Cyan = Mini-Turbo armed, Gold = Ultra-Turbo armed!)
  if (kart.driftCharge >= 0.18) {
    const sparkColor: [number, number, number] =
      kart.driftCharge >= ULTRA_TURBO_CHARGE_SEC
        ? [255, 215, 40]
        : kart.driftCharge >= MINI_TURBO_CHARGE_SEC
          ? [56, 232, 255]
          : [255, 255, 255];
    const sparkLen = (0.55 + Math.min(1.1, kart.driftCharge * 0.65)) * flicker;
    for (const sx of [-1.22, 1.22]) {
      const pA = xf(sx, 0.22, -1.35);
      const pB = xf(sx + (sx < 0 ? -0.35 : 0.35), 0.45 + sparkLen * 0.35, -1.85 - sparkLen);
      const pC = xf(sx, 0.52, -1.55 - sparkLen * 0.6);
      pushWorldPoly(proj, [pA, pB, pC], sparkColor, -0.72, true);
    }
  }
}

export interface ViewportRenderMetrics {
  polygonCount: number;
}

/**
 * Renders one 3D chase-camera viewport onto `(vpX, vpY, vpW, vpH)` of `ctx`.
 */
export function renderKartViewport(
  ctx: CanvasRenderingContext2D,
  race: KartRaceState,
  focusSlot: number,
  cam: ChaseCamera,
  vpX: number,
  vpY: number,
  vpW: number,
  vpH: number,
  timeMs: number,
): ViewportRenderMetrics {
  const circuit = CIRCUITS[race.circuitId];
  const focusKart = race.karts[focusSlot] ?? race.karts[0]!;

  ctx.save();
  ctx.beginPath();
  ctx.rect(vpX, vpY, vpW, vpH);
  ctx.clip();
  ctx.translate(vpX, vpY);

  drawSkyAndMountains(ctx, cam, circuit, vpW, vpH);

  const proj = makeProjector(cam, vpW, vpH, circuit.theme.fogHex);
  const nodes = circuit.nodes;
  const N = nodes.length;
  const startNodeIdx = Math.floor(
    (((focusKart.s % circuit.totalLength) + circuit.totalLength) % circuit.totalLength) /
      (circuit.totalLength / N),
  );

  const roadDarkRgb = parseHexRgb(circuit.theme.roadDark);
  const roadLightRgb = parseHexRgb(circuit.theme.roadLight);
  const groundOuterRgb = parseHexRgb(circuit.theme.groundOuter);
  const groundAltRgb = parseHexRgb(circuit.theme.groundAlt);
  const curbARgb = parseHexRgb(circuit.theme.curbA);
  const curbBRgb = parseHexRgb(circuit.theme.curbB);
  const rw = circuit.roadHalfWidth;
  const cw = rw + 1.45;
  const gw = rw + 48;
  const curbH = 0.28;

  // 1. Track ribbon segments (`-10 .. +70` around camera kart)
  for (let step = -10; step < 70; step += 1) {
    const i0 = ((startNodeIdx + step) % N + N) % N;
    const i1 = (i0 + 1) % N;
    const n0 = nodes[i0]!;
    const n1 = nodes[i1]!;
    const bandEven = i0 % 2 === 0;

    // Terrain shoulders (surface layer +26)
    const gRgb = bandEven ? groundOuterRgb : groundAltRgb;
    pushWorldPoly(
      proj,
      [
        { x: n0.x - n0.rx * gw, y: n0.y - 0.15, z: n0.z - n0.rz * gw },
        { x: n0.x - n0.rx * cw, y: n0.y - 0.05, z: n0.z - n0.rz * cw },
        { x: n1.x - n1.rx * cw, y: n1.y - 0.05, z: n1.z - n1.rz * cw },
        { x: n1.x - n1.rx * gw, y: n1.y - 0.15, z: n1.z - n1.rz * gw },
      ],
      gRgb,
      26,
    );
    pushWorldPoly(
      proj,
      [
        { x: n0.x + n0.rx * cw, y: n0.y - 0.05, z: n0.z + n0.rz * cw },
        { x: n0.x + n0.rx * gw, y: n0.y - 0.15, z: n0.z + n0.rz * gw },
        { x: n1.x + n1.rx * gw, y: n1.y - 0.15, z: n1.z + n1.rz * gw },
        { x: n1.x + n1.rx * cw, y: n1.y - 0.05, z: n1.z + n1.rz * cw },
      ],
      gRgb,
      26,
    );

    // Asphalt road quad (surface layer +23)
    pushWorldPoly(
      proj,
      [
        { x: n0.x - n0.rx * rw, y: n0.y, z: n0.z - n0.rz * rw },
        { x: n0.x + n0.rx * rw, y: n0.y, z: n0.z + n0.rz * rw },
        { x: n1.x + n1.rx * rw, y: n1.y, z: n1.z + n1.rz * rw },
        { x: n1.x - n1.rx * rw, y: n1.y, z: n1.z - n1.rz * rw },
      ],
      bandEven ? roadDarkRgb : roadLightRgb,
      23,
    );

    // Center dashed racing line (surface layer +22)
    if (bandEven) {
      const lw = 0.36;
      pushWorldPoly(
        proj,
        [
          { x: n0.x - n0.rx * lw, y: n0.y + 0.03, z: n0.z - n0.rz * lw },
          { x: n0.x + n0.rx * lw, y: n0.y + 0.03, z: n0.z + n0.rz * lw },
          { x: n1.x + n1.rx * lw, y: n1.y + 0.03, z: n1.z + n1.rz * lw },
          { x: n1.x - n1.rx * lw, y: n1.y + 0.03, z: n1.z - n1.rz * lw },
        ],
        [203, 213, 225],
        22,
      );
    }

    // Raised 3D rumble curbs (surface layer +20.5)
    const cRgb = bandEven ? curbARgb : curbBRgb;
    pushWorldPoly(
      proj,
      [
        { x: n0.x - n0.rx * cw, y: n0.y + curbH, z: n0.z - n0.rz * cw },
        { x: n0.x - n0.rx * rw, y: n0.y + curbH, z: n0.z - n0.rz * rw },
        { x: n1.x - n1.rx * rw, y: n1.y + curbH, z: n1.z - n1.rz * rw },
        { x: n1.x - n1.rx * cw, y: n1.y + curbH, z: n1.z - n1.rz * cw },
      ],
      cRgb,
      20.6,
    );
    pushWorldPoly(
      proj,
      [
        { x: n0.x - n0.rx * rw, y: n0.y, z: n0.z - n0.rz * rw },
        { x: n0.x - n0.rx * rw, y: n0.y + curbH, z: n0.z - n0.rz * rw },
        { x: n1.x - n1.rx * rw, y: n1.y + curbH, z: n1.z - n1.rz * rw },
        { x: n1.x - n1.rx * rw, y: n1.y, z: n1.z - n1.rz * rw },
      ],
      cRgb,
      20.4,
    );
    pushWorldPoly(
      proj,
      [
        { x: n0.x + n0.rx * rw, y: n0.y + curbH, z: n0.z + n0.rz * rw },
        { x: n0.x + n0.rx * cw, y: n0.y + curbH, z: n0.z + n0.rz * cw },
        { x: n1.x + n1.rx * cw, y: n1.y + curbH, z: n1.z + n1.rz * cw },
        { x: n1.x + n1.rx * rw, y: n1.y + curbH, z: n1.z + n1.rz * rw },
      ],
      cRgb,
      20.6,
    );
    pushWorldPoly(
      proj,
      [
        { x: n0.x + n0.rx * rw, y: n0.y + curbH, z: n0.z + n0.rz * rw },
        { x: n0.x + n0.rx * rw, y: n0.y, z: n0.z + n0.rz * rw },
        { x: n1.x + n1.rx * rw, y: n1.y, z: n1.z + n1.rz * rw },
        { x: n1.x + n1.rx * rw, y: n1.y + curbH, z: n1.z + n1.rz * rw },
      ],
      cRgb,
      20.4,
    );

    // Glowing 3D Boost Strip on asphalt (surface layer +21)
    if (n0.hasBoostPad) {
      const bl = n0.boostLat;
      const bw = 2.8;
      pushWorldPoly(
        proj,
        [
          { x: n0.x + n0.rx * (bl - bw), y: n0.y + 0.06, z: n0.z + n0.rz * (bl - bw) },
          { x: n0.x + n0.rx * (bl + bw), y: n0.y + 0.06, z: n0.z + n0.rz * (bl + bw) },
          { x: n1.x + n1.rx * (bl + bw), y: n1.y + 0.06, z: n1.z + n1.rz * (bl + bw) },
          { x: n1.x + n1.rx * (bl - bw), y: n1.y + 0.06, z: n1.z + n1.rz * (bl - bw) },
        ],
        bandEven ? [56, 232, 255] : [250, 204, 21],
        21,
        true,
      );
    }

    // Corner Turn-Warning Chevron Signpost (above-ground object layer)
    if (n0.hasChevron) {
      const side = n0.chevronSide;
      const dist = cw + 1.8;
      const sx = n0.x + n0.rx * side * dist;
      const sz = n0.z + n0.rz * side * dist;
      const sw = 1.6;
      pushWorldPoly(
        proj,
        [
          { x: sx - n0.rx * sw, y: n0.y + 0.6, z: sz - n0.rz * sw },
          { x: sx + n0.rx * sw, y: n0.y + 0.6, z: sz + n0.rz * sw },
          { x: sx + n0.rx * sw, y: n0.y + 2.8, z: sz + n0.rz * sw },
          { x: sx - n0.rx * sw, y: n0.y + 2.8, z: sz - n0.rz * sw },
        ],
        [246, 215, 67],
        -0.1,
        true,
      );
    }

    // 3D Checkered Start / Finish Archway at segment 0!
    if (i0 === 0) {
      const cells = 8;
      for (let c = 0; c < cells; c += 1) {
        const f0 = -rw + (c / cells) * (rw * 2);
        const f1 = -rw + ((c + 1) / cells) * (rw * 2);
        // Road finish line checker (surface layer +21.5)
        pushWorldPoly(
          proj,
          [
            { x: n0.x + n0.rx * f0, y: n0.y + 0.05, z: n0.z + n0.rz * f0 },
            { x: n0.x + n0.rx * f1, y: n0.y + 0.05, z: n0.z + n0.rz * f1 },
            { x: n1.x + n1.rx * f1, y: n1.y + 0.05, z: n1.z + n1.rz * f1 },
            { x: n1.x + n1.rx * f0, y: n1.y + 0.05, z: n1.z + n1.rz * f0 },
          ],
          c % 2 === 0 ? [248, 250, 252] : [15, 23, 42],
          21.5,
        );
        // Overhead arch banner checker (`y + 7.2 .. 9.0`)
        pushWorldPoly(
          proj,
          [
            { x: n0.x + n0.rx * f0, y: n0.y + 7.2, z: n0.z + n0.rz * f0 },
            { x: n0.x + n0.rx * f1, y: n0.y + 7.2, z: n0.z + n0.rz * f1 },
            { x: n0.x + n0.rx * f1, y: n0.y + 9.0, z: n0.z + n0.rz * f1 },
            { x: n0.x + n0.rx * f0, y: n0.y + 9.0, z: n0.z + n0.rz * f0 },
          ],
          c % 2 === 0 ? [246, 215, 67] : [30, 41, 59],
          -0.15,
          c % 2 === 0,
        );
      }
      // Left & right arch support pillars
      for (const side of [-1, 1] as const) {
        const px = n0.x + n0.rx * side * (rw + 1.0);
        const pz = n0.z + n0.rz * side * (rw + 1.0);
        pushWorldPoly(
          proj,
          [
            { x: px - n0.rx * 0.7, y: n0.y, z: pz - n0.rz * 0.7 },
            { x: px + n0.rx * 0.7, y: n0.y, z: pz + n0.rz * 0.7 },
            { x: px + n0.rx * 0.7, y: n0.y + 9.2, z: pz + n0.rz * 0.7 },
            { x: px - n0.rx * 0.7, y: n0.y + 9.2, z: pz - n0.rz * 0.7 },
          ],
          [226, 232, 240],
          -0.12,
        );
      }
    }
  }

  // 2. Low-poly roadside scenery props within view distance
  for (const prop of circuit.scenery) {
    const dx = prop.x - cam.x;
    const dz = prop.z - cam.z;
    if (dx * dx + dz * dz < FAR_Z * FAR_Z) {
      emitProp(proj, prop);
    }
  }

  // 3. Drift tire skid marks on asphalt
  for (const kart of race.karts) {
    const marks = kart.skidMarks;
    for (let i = 1; i < marks.length; i += 1) {
      const a = marks[i - 1]!;
      const b = marks[i]!;
      if (Math.hypot(b.lx - a.lx, b.lz - a.lz) < 4.5) {
        pushWorldPoly(
          proj,
          [
            { x: a.lx - 0.14, y: a.ly, z: a.lz },
            { x: a.lx + 0.14, y: a.ly, z: a.lz },
            { x: b.lx + 0.14, y: b.ly, z: b.lz },
            { x: b.lx - 0.14, y: b.ly, z: b.lz },
          ],
          [15, 19, 28],
          20.2,
        );
        pushWorldPoly(
          proj,
          [
            { x: a.rx - 0.14, y: a.ry, z: a.rz },
            { x: a.rx + 0.14, y: a.ry, z: a.rz },
            { x: b.rx + 0.14, y: b.ry, z: b.rz },
            { x: b.rx - 0.14, y: b.ry, z: b.rz },
          ],
          [15, 19, 28],
          20.2,
        );
      }
    }
  }

  // 4. All karts in the race
  for (const kart of race.karts) {
    emitKartMesh(proj, kart, timeMs);
  }

  // 5. Painter's depth sort (far -> near) + crisp polygon rasterization
  proj.polys.sort((a, b) => b.depth - a.depth);
  for (let i = 0; i < proj.polys.length; i += 1) {
    const poly = proj.polys[i]!;
    const pts = poly.pts;
    ctx.fillStyle = poly.fill;
    ctx.strokeStyle = poly.fill;
    ctx.lineWidth = 0.65; // Eliminates hairline anti-aliasing seams between adjacent road quads
    ctx.beginPath();
    ctx.moveTo(pts[0]!.sx, pts[0]!.sy);
    for (let j = 1; j < pts.length; j += 1) {
      ctx.lineTo(pts[j]!.sx, pts[j]!.sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 6. Subtle radial speed-lines around viewport edges during Mini-Turbo / Pad Boost!
  if (focusKart.boostTimer > 0) {
    ctx.strokeStyle =
      focusKart.boostKind === 'ultra' ? 'rgba(250, 204, 21, 0.42)' : 'rgba(56, 232, 255, 0.42)';
    ctx.lineWidth = 2;
    const cx = vpW * 0.5;
    const cy = vpH * 0.52;
    for (let k = 0; k < 14; k += 1) {
      const ang = (k / 14) * Math.PI * 2 + ((timeMs * 0.004) % 1);
      const r0 = Math.min(vpW, vpH) * 0.36;
      const r1 = Math.max(vpW, vpH) * 0.62;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.stroke();
    }
  }

  ctx.restore();
  return { polygonCount: proj.polys.length };
}
