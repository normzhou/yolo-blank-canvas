/**
 * Zero-Dependency Static-VBO WebGL2 Playful Arcade Kart Renderer (#364, #370).
 *
 * Hardware-friendly low-poly craft for smooth 60fps on laptops & tablets:
 * - Circuit road, candy curbs, rainbow boost pads, festive pennant start arch,
 *   rounded storybook trees, floating striped hot-air balloons, cartoon cacti,
 *   and glowing Starlight crystals bake ONCE into 1 `gl.STATIC_DRAW` VBO.
 * - Chunky toy bumper-karts (`14-gon` oversized cartoon tires with bright accent
 *   hubs, wraparound rubber bumper, round retro headlights, pastel roll-hoop arch,
 *   jaunty chrome booster pipes) and 100% Starlight Burst consistent plush drivers
 *   (`16x10` smooth Phong heads — low polygon count, silky smooth shading!) bake
 *   ONCE into static GPU VBOs.
 * - Per-frame animation updates only lightweight uniform matrices & tints (zero GC).
 */

import {
  getCircuit,
  getCircuitForKart,
  getKartDriverSpec,
  getMarathonStageForKart,
  KART_DRIVERS,
  predictKartTrajectory,
  speedToColorRgb,
  transformPoseThroughPortal,
  type CircuitDefinition,
  type CircuitId,
  type DriverCharacterId,
  type KartDriverSpec,
  type KartRaceState,
  type KartState,
  type SceneryProp,
} from '../../shared/microKart';
import { computeDriverPose } from './driverPose';
import type { ChaseCamera } from './renderer3d';

const FLOATS_PER_VERT = 11; // pos(3) + norm(3) + color(3) + flags(2: matKind, emissive)
const MAT_GLOSSY = 0.0;
const MAT_PLUSH = 1.0;
const MAT_MATTE = 2.0;

interface Vec3Mut {
  x: number;
  y: number;
  z: number;
}

class MeshBuilder {
  readonly data: number[] = [];

  get vertexCount(): number {
    return this.data.length / FLOATS_PER_VERT;
  }

  pushVert(
    p: Vec3Mut,
    n: Vec3Mut,
    rgb: readonly [number, number, number],
    matKind: number,
    emissive = 0,
  ): void {
    this.data.push(
      p.x,
      p.y,
      p.z,
      n.x,
      n.y,
      n.z,
      rgb[0] / 255,
      rgb[1] / 255,
      rgb[2] / 255,
      matKind,
      emissive,
    );
  }

  addFlatTri(
    a: Vec3Mut,
    b: Vec3Mut,
    c: Vec3Mut,
    rgb: readonly [number, number, number],
    matKind = MAT_GLOSSY,
    emissive = 0,
  ): void {
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const uz = b.z - a.z;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const vz = c.z - a.z;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const n = { x: nx, y: ny, z: nz };
    this.pushVert(a, n, rgb, matKind, emissive);
    this.pushVert(b, n, rgb, matKind, emissive);
    this.pushVert(c, n, rgb, matKind, emissive);
  }

  addFlatQuad(
    p0: Vec3Mut,
    p1: Vec3Mut,
    p2: Vec3Mut,
    p3: Vec3Mut,
    rgb: readonly [number, number, number],
    matKind = MAT_GLOSSY,
    emissive = 0,
  ): void {
    this.addFlatTri(p0, p1, p2, rgb, matKind, emissive);
    this.addFlatTri(p0, p2, p3, rgb, matKind, emissive);
  }

  addSmoothTri(
    p0: Vec3Mut,
    p1: Vec3Mut,
    p2: Vec3Mut,
    n0: Vec3Mut,
    n1: Vec3Mut,
    n2: Vec3Mut,
    rgb: readonly [number, number, number],
    matKind = MAT_PLUSH,
    emissive = 0,
  ): void {
    this.pushVert(p0, n0, rgb, matKind, emissive);
    this.pushVert(p1, n1, rgb, matKind, emissive);
    this.pushVert(p2, n2, rgb, matKind, emissive);
  }

  addSmoothQuad(
    p0: Vec3Mut,
    p1: Vec3Mut,
    p2: Vec3Mut,
    p3: Vec3Mut,
    n0: Vec3Mut,
    n1: Vec3Mut,
    n2: Vec3Mut,
    n3: Vec3Mut,
    rgb: readonly [number, number, number],
    matKind = MAT_PLUSH,
    emissive = 0,
  ): void {
    this.addSmoothTri(p0, p1, p2, n0, n1, n2, rgb, matKind, emissive);
    this.addSmoothTri(p0, p2, p3, n0, n2, n3, rgb, matKind, emissive);
  }

  addBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    rgb: readonly [number, number, number],
    matKind = MAT_GLOSSY,
    emissive = 0,
  ): void {
    const p000 = { x: x0, y: y0, z: z0 };
    const p100 = { x: x1, y: y0, z: z0 };
    const p110 = { x: x1, y: y1, z: z0 };
    const p010 = { x: x0, y: y1, z: z0 };
    const p001 = { x: x0, y: y0, z: z1 };
    const p101 = { x: x1, y: y0, z: z1 };
    const p111 = { x: x1, y: y1, z: z1 };
    const p011 = { x: x0, y: y1, z: z1 };
    this.addFlatQuad(p010, p011, p111, p110, rgb, matKind, emissive);
    this.addFlatQuad(p000, p100, p101, p001, rgb, matKind, emissive);
    this.addFlatQuad(p100, p000, p010, p110, rgb, matKind, emissive);
    this.addFlatQuad(p001, p101, p111, p011, rgb, matKind, emissive);
    this.addFlatQuad(p000, p001, p011, p010, rgb, matKind, emissive);
    this.addFlatQuad(p101, p100, p110, p111, rgb, matKind, emissive);
  }
}

function norm3(x: number, y: number, z: number): Vec3Mut {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function emitSmoothEllipsoid(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  segsU: number,
  segsV: number,
  colorFn: (theta: number, phi: number) => readonly [number, number, number],
  matKind = MAT_PLUSH,
  emissive = 0,
): void {
  const ptAt = (iu: number, iv: number) => {
    const th = (iu / segsU) * Math.PI * 2;
    const ph = (iv / segsV - 0.5) * Math.PI;
    const cosP = Math.cos(ph);
    const sinP = Math.sin(ph);
    const sinT = Math.sin(th);
    const cosT = Math.cos(th);
    const lx = sinT * cosP * rx;
    const ly = sinP * ry;
    const lz = cosT * cosP * rz;
    return {
      p: { x: cx + lx, y: cy + ly, z: cz + lz },
      n: norm3(lx / (rx * rx), ly / (ry * ry), lz / (rz * rz)),
    };
  };

  for (let iv = 0; iv < segsV; iv += 1) {
    for (let iu = 0; iu < segsU; iu += 1) {
      const a = ptAt(iu, iv);
      const b = ptAt(iu + 1, iv);
      const c = ptAt(iu + 1, iv + 1);
      const d = ptAt(iu, iv + 1);
      const midTh = ((iu + 0.5) / segsU) * Math.PI * 2;
      const midPh = ((iv + 0.5) / segsV - 0.5) * Math.PI;
      const rgb = colorFn(midTh, midPh);
      mb.addSmoothQuad(a.p, b.p, c.p, d.p, a.n, b.n, c.n, d.n, rgb, matKind, emissive);
    }
  }
}

interface TubeSpineNode {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rgb: readonly [number, number, number];
  emissive?: number;
}

function emitSmoothSpineTube(
  mb: MeshBuilder,
  spine: readonly TubeSpineNode[],
  segs = 10,
  matKind = MAT_PLUSH,
  colorOverride?: (
    ringIdx: number,
    theta: number,
    defaultRgb: readonly [number, number, number],
  ) => readonly [number, number, number],
  fixedRefAxis?: Vec3Mut,
): void {
  if (spine.length < 2) return;

  const frames = spine.map((node, idx) => {
    const prev = spine[Math.max(0, idx - 1)]!;
    const next = spine[Math.min(spine.length - 1, idx + 1)]!;
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    let tz = next.z - prev.z;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    let ux: number;
    let uy: number;
    let uz: number;
    if (fixedRefAxis) {
      const dot = fixedRefAxis.x * tx + fixedRefAxis.y * ty + fixedRefAxis.z * tz;
      ux = fixedRefAxis.x - dot * tx;
      uy = fixedRefAxis.y - dot * ty;
      uz = fixedRefAxis.z - dot * tz;
      const ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul;
      uy /= ul;
      uz /= ul;
    } else {
      const refX = Math.abs(tx) > 0.88 ? 0 : 1;
      const refY = Math.abs(tx) > 0.88 ? 1 : 0;
      ux = 1 - tx * tx;
      uy = -tx * ty;
      uz = -tx * tz;
      let ul = Math.hypot(ux, uy, uz);
      if (ul < 0.05) {
        ux = refX;
        uy = refY;
        uz = 0;
        ul = 1;
      }
      ux /= ul;
      uy /= ul;
      uz /= ul;
    }
    const vx = ty * uz - tz * uy;
    const vy = tz * ux - tx * uz;
    const vz = tx * uy - ty * ux;
    return { node, u: { x: ux, y: uy, z: uz }, v: { x: vx, y: vy, z: vz } };
  });

  const ringVerts = frames.map(({ node, u, v }) =>
    Array.from({ length: segs }, (_, i) => {
      const a = (i / segs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = u.x * ca + v.x * sa;
      const ny = u.y * ca + v.y * sa;
      const nz = u.z * ca + v.z * sa;
      return {
        p: {
          x: node.x + u.x * ca * node.rx + v.x * sa * node.ry,
          y: node.y + u.y * ca * node.rx + v.y * sa * node.ry,
          z: node.z + u.z * ca * node.rx + v.z * sa * node.ry,
        },
        n: norm3(nx, ny, nz),
      };
    }),
  );

  for (let r = 0; r < spine.length - 1; r += 1) {
    const cur = ringVerts[r]!;
    const nxt = ringVerts[r + 1]!;
    const sNode = spine[r]!;
    const nNode = spine[r + 1]!;
    for (let i = 0; i < segs; i += 1) {
      const i1 = (i + 1) % segs;
      const midA = ((i + 0.5) / segs) * Math.PI * 2;
      const rgb = colorOverride ? colorOverride(r, midA, nNode.rgb) : nNode.rgb;
      mb.addSmoothQuad(
        cur[i]!.p,
        cur[i1]!.p,
        nxt[i1]!.p,
        nxt[i]!.p,
        cur[i]!.n,
        cur[i1]!.n,
        nxt[i1]!.n,
        nxt[i]!.n,
        rgb,
        matKind,
        nNode.emissive ?? sNode.emissive ?? 0,
      );
    }
  }
}

/**
 * Low-poly 3D golden Starlight diamond/octahedron star emblem (only 16 tris!).
 */
function emitStarCrystal(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  rgb: readonly [number, number, number],
  emissive = 1,
): void {
  const top = { x: cx, y: cy + r * 1.25, z: cz };
  const bot = { x: cx, y: cy - r * 1.25, z: cz };
  const ring = [
    { x: cx, y: cy, z: cz + r },
    { x: cx + r, y: cy, z: cz },
    { x: cx, y: cy, z: cz - r },
    { x: cx - r, y: cy, z: cz },
  ];
  for (let i = 0; i < 4; i += 1) {
    const a = ring[i]!;
    const b = ring[(i + 1) % 4]!;
    mb.addFlatTri(top, a, b, rgb, MAT_GLOSSY, emissive);
    mb.addFlatTri(bot, b, a, rgb, MAT_GLOSSY, emissive);
  }
}

/**
 * Playful, chunky Toy Arcade Bumper-Kart Chassis (low-poly, zero F1 sharpness!):
 * - Oversized chunky `14-gon` cartoon tires with bright driver-accent wheel hubs!
 * - Soft rounded wraparound rubber bumper rail!
 * - Plump rounded hood + white racing stripe + cute round glowing retro headlights!
 * - Cheerful rounded pastel roll-hoop spoiler arch + jaunty angled chrome rocket pipes!
 */
function buildKartChassisMesh(spec: KartDriverSpec): MeshBuilder {
  const mb = new MeshBuilder();
  const primary = spec.kartPrimary;
  const accent = spec.kartAccent;
  const creamWhite: [number, number, number] = [255, 252, 245];
  const bumperDark: [number, number, number] = [50, 56, 72];
  const tireDark: [number, number, number] = [34, 38, 50];
  const chromeSilver: [number, number, number] = [214, 224, 238];
  const seatCozy: [number, number, number] = [44, 50, 66];

  // 1. Oversized Chunky `14-gon` Cartoon Tires + Bright Colored Toy Wheel Rims!
  const wheelCoords: ReadonlyArray<[number, number, number]> = [
    [-1.18, 1.08, 0.4],
    [1.18, 1.08, 0.4],
    [-1.28, -1.06, 0.46],
    [1.28, -1.06, 0.46],
  ];
  const WN = 14;
  const wHalf = 0.27;
  for (const [wx, wz, wR] of wheelCoords) {
    const wCy = wR + 0.02;
    for (let i = 0; i < WN; i += 1) {
      const a0 = (i / WN) * Math.PI * 2;
      const a1 = ((i + 1) / WN) * Math.PI * 2;
      const y0 = wCy + Math.sin(a0) * wR;
      const z0 = wz + Math.cos(a0) * wR;
      const y1 = wCy + Math.sin(a1) * wR;
      const z1 = wz + Math.cos(a1) * wR;
      const n0 = norm3(0, Math.sin(a0), Math.cos(a0));
      const n1 = norm3(0, Math.sin(a1), Math.cos(a1));
      mb.addSmoothQuad(
        { x: wx - wHalf, y: y0, z: z0 },
        { x: wx + wHalf, y: y0, z: z0 },
        { x: wx + wHalf, y: y1, z: z1 },
        { x: wx - wHalf, y: y1, z: z1 },
        n0,
        n0,
        n1,
        n1,
        tireDark,
        MAT_PLUSH,
      );
      for (const side of [-1, 1] as const) {
        const sx = wx + side * wHalf;
        const sn = { x: side, y: 0, z: 0 };
        mb.addSmoothTri(
          { x: sx, y: wCy, z: wz },
          side > 0 ? { x: sx, y: y0, z: z0 } : { x: sx, y: y1, z: z1 },
          side > 0 ? { x: sx, y: y1, z: z1 } : { x: sx, y: y0, z: z0 },
          sn,
          sn,
          sn,
          [42, 48, 62],
          MAT_GLOSSY,
        );
        if ((wx < 0 && side < 0) || (wx > 0 && side > 0)) {
          // Bright cheerful accent rim + cream center cap!
          const hx = sx + side * 0.014;
          const hr = wR * 0.56;
          mb.addSmoothTri(
            { x: hx, y: wCy, z: wz },
            side > 0
              ? { x: hx, y: wCy + Math.sin(a0) * hr, z: wz + Math.cos(a0) * hr }
              : { x: hx, y: wCy + Math.sin(a1) * hr, z: wz + Math.cos(a1) * hr },
            side > 0
              ? { x: hx, y: wCy + Math.sin(a1) * hr, z: wz + Math.cos(a1) * hr }
              : { x: hx, y: wCy + Math.sin(a0) * hr, z: wz + Math.cos(a0) * hr },
            sn,
            sn,
            sn,
            i % 2 === 0 ? accent : creamWhite,
            MAT_GLOSSY,
          );
        }
      }
    }
  }

  // 2. Plump Rounded Toy Kart Body (Smooth Multi-Ring Lozenge Hull — Zero Sharp F1 Wedge!)
  emitSmoothSpineTube(
    mb,
    [
      { x: 0, y: 0.44, z: -1.58, rx: 0.9, ry: 0.34, rgb: primary },
      { x: 0, y: 0.46, z: -0.7, rx: 1.06, ry: 0.36, rgb: primary },
      { x: 0, y: 0.48, z: 0.52, rx: 1.04, ry: 0.36, rgb: primary },
      { x: 0, y: 0.44, z: 1.48, rx: 0.84, ry: 0.3, rgb: primary },
      { x: 0, y: 0.38, z: 1.92, rx: 0.54, ry: 0.22, rgb: primary },
      { x: 0, y: 0.36, z: 2.04, rx: 0.14, ry: 0.08, rgb: primary },
    ],
    12,
    MAT_GLOSSY,
    (_r, theta, defRgb) => {
      // Crisp white racing stripe down the sunny rounded top hood!
      if (Math.sin(theta) > 0.72 && Math.abs(Math.cos(theta)) < 0.42) return creamWhite;
      return defRgb;
    },
  );

  // 3. Soft Wraparound Toy Bumper-Kart Rubber Cushion Rail (Front + Sides + Rear!)
  emitSmoothEllipsoid(mb, 0, 0.26, 1.72, 0.92, 0.15, 0.44, 12, 6, () => bumperDark, MAT_PLUSH);
  emitSmoothEllipsoid(mb, -0.96, 0.28, -0.02, 0.19, 0.15, 1.38, 10, 6, () => bumperDark, MAT_PLUSH);
  emitSmoothEllipsoid(mb, 0.96, 0.28, -0.02, 0.19, 0.15, 1.38, 10, 6, () => bumperDark, MAT_PLUSH);
  emitSmoothEllipsoid(mb, 0, 0.26, -1.58, 0.94, 0.15, 0.22, 10, 6, () => bumperDark, MAT_PLUSH);

  // Cute Accent Side Trim Stripes + Golden Star Emblem on the Nose!
  mb.addBox(-1.08, 0.48, -0.78, -0.82, 0.58, 0.68, accent, MAT_GLOSSY);
  mb.addBox(0.82, 0.48, -0.78, 1.08, 0.58, 0.68, accent, MAT_GLOSSY);
  emitStarCrystal(mb, 0, 0.68, 1.48, 0.22, accent, 1);

  // Cute Twin Round Glowing Retro Headlights on the Rounded Nose!
  for (const side of [-1, 1] as const) {
    emitSmoothEllipsoid(mb, side * 0.56, 0.56, 1.74, 0.16, 0.16, 0.14, 10, 6, () => chromeSilver, MAT_GLOSSY);
    emitSmoothEllipsoid(mb, side * 0.56, 0.56, 1.84, 0.12, 0.12, 0.08, 10, 6, () => [255, 248, 196], MAT_GLOSSY, 1);
  }

  // Cozy Recessed Cockpit Cushion + Rounded Seatback
  mb.addBox(-0.56, 0.36, -0.52, 0.56, 0.64, 0.48, seatCozy, MAT_PLUSH);
  emitSmoothEllipsoid(mb, 0, 0.72, -0.54, 0.5, 0.24, 0.16, 10, 6, () => accent, MAT_PLUSH);

  // 4. Cheerful Rounded Pastel Roll-Hoop / Toy Rear Spoiler Arch (Fun Arcade Silhouette!)
  emitSmoothSpineTube(
    mb,
    [
      { x: -0.94, y: 0.56, z: -1.32, rx: 0.11, ry: 0.11, rgb: accent },
      { x: -0.98, y: 0.96, z: -1.46, rx: 0.11, ry: 0.11, rgb: accent },
      { x: -0.52, y: 1.12, z: -1.52, rx: 0.11, ry: 0.11, rgb: accent },
      { x: 0.0, y: 1.16, z: -1.54, rx: 0.12, ry: 0.12, rgb: creamWhite },
      { x: 0.52, y: 1.12, z: -1.52, rx: 0.11, ry: 0.11, rgb: accent },
      { x: 0.98, y: 0.96, z: -1.46, rx: 0.11, ry: 0.11, rgb: accent },
      { x: 0.94, y: 0.56, z: -1.32, rx: 0.11, ry: 0.11, rgb: accent },
    ],
    8,
    MAT_GLOSSY,
    undefined,
    { x: 0, y: 0, z: 1 },
  );

  // 5. Jaunty Twin Angled Chrome Toy Rocket Exhaust Pipes!
  for (const side of [-1, 1] as const) {
    emitSmoothSpineTube(
      mb,
      [
        { x: side * 0.44, y: 0.44, z: -1.36, rx: 0.17, ry: 0.17, rgb: chromeSilver },
        { x: side * 0.48, y: 0.5, z: -1.78, rx: 0.21, ry: 0.21, rgb: chromeSilver },
        { x: side * 0.49, y: 0.52, z: -1.9, rx: 0.24, ry: 0.24, rgb: accent },
      ],
      10,
      MAT_GLOSSY,
    );
  }

  // Dashboard steering wheel bolted to the cockpit so the plush driver can lean freely!
  emitSmoothEllipsoid(mb, 0, 0.92, 0.32, 0.25, 0.22, 0.055, 12, 6, () => [42, 48, 64], MAT_GLOSSY);
  emitSmoothEllipsoid(mb, 0, 0.92, 0.35, 0.085, 0.085, 0.04, 8, 6, () => spec.kartAccent, MAT_GLOSSY);

  return mb;
}

/**
 * Bakes cozy plush Torso + Chubby Arms/Paws + Neckerchief centered around the seat hip pivot
 * `(0, 0.62, -0.16)` so the driver visibly leans into tight turns and ducks into high-speed wind!
 */
function buildDriverTorsoMesh(spec: KartDriverSpec): MeshBuilder {
  const mb = new MeshBuilder();
  const py = 0.62;
  const pz = -0.16;
  emitSmoothSpineTube(
    mb,
    [
      { x: 0, y: 0.62 - py, z: -0.18 - pz, rx: 0.35, ry: 0.27, rgb: spec.furPrimary },
      { x: 0, y: 0.82 - py, z: -0.16 - pz, rx: 0.34, ry: 0.26, rgb: spec.furPrimary },
      { x: 0, y: 1.02 - py, z: -0.14 - pz, rx: 0.28, ry: 0.22, rgb: spec.furPrimary },
    ],
    12,
    MAT_PLUSH,
  );
  // Cozy cream plush tummy patch visible from the front!
  emitSmoothEllipsoid(mb, 0, 0.8 - py, 0.08 - pz, 0.21, 0.2, 0.1, 10, 6, () => spec.furCream, MAT_PLUSH);
  // Cozy Starlight Burst neckerchief collar (+ Mochi's golden jingle bell / Ren's star badge!)
  emitSmoothEllipsoid(mb, 0, 1.0 - py, -0.14 - pz, 0.34, 0.085, 0.28, 14, 6, () => spec.scarfRgb, MAT_PLUSH);
  if (spec.id === 'cat') {
    emitSmoothEllipsoid(mb, 0, 0.96 - py, 0.16 - pz, 0.085, 0.085, 0.085, 8, 6, () => [246, 215, 67], MAT_GLOSSY);
  } else if (spec.id === 'fox') {
    emitStarCrystal(mb, 0, 0.94 - py, 0.17 - pz, 0.095, [246, 215, 67], 1);
  }

  // Plush arms + chubby cream paws reaching toward the steering wheel!
  for (const side of [-1, 1] as const) {
    emitSmoothSpineTube(
      mb,
      [
        { x: side * 0.26, y: 0.93 - py, z: -0.08 - pz, rx: 0.095, ry: 0.095, rgb: spec.furPrimary },
        { x: side * 0.23, y: 0.92 - py, z: 0.28 - pz, rx: 0.085, ry: 0.085, rgb: spec.furPrimary },
      ],
      8,
      MAT_PLUSH,
    );
    emitSmoothEllipsoid(
      mb,
      side * 0.22,
      0.92 - py,
      0.31 - pz,
      0.095,
      0.09,
      0.095,
      10,
      6,
      () => spec.furCream,
      MAT_PLUSH,
    );
  }
  return mb;
}

/**
 * 100% Starlight Burst Consistent Low-Poly Smooth Plush Animal Head (`16x10` — HALF the
 * polygons of 24x14, silky smooth via per-pixel Phong normals & plush Fresnel velvet rim!):
 * - Wide-set glossy kawaii jewel eyes (NO serious pilot goggles!)
 * - Warm rosy plush cheeks + cute noses + Koro's happy pink blep tongue
 * - Ren: warm amber fox ears + cream inner hollows + fluffy cheek tufts
 * - Mochi: orchid-lavender cat ears + rose satin bow + golden knot + whiskers
 * - Koro: mint-sage puppy + velvety tangerine floppy ears + cream Shiba brow dots
 * - Momo: berry-coral bunny + tall left ear + adorable folded right ear + sunny golden bow!
 */
function buildDriverHeadMesh(charId: DriverCharacterId): MeshBuilder {
  const spec = getKartDriverSpec(charId);
  const mb = new MeshBuilder();
  const darkInk: [number, number, number] = [28, 30, 42];
  const rosyPink: [number, number, number] = [248, 122, 146];
  const warmPeach: [number, number, number] = [252, 178, 118];

  // 1. Plump Chubby-Cheeked `16x10` Low-Poly Plush Head (`rx=0.47, ry=0.41, rz=0.43`)
  emitSmoothEllipsoid(
    mb,
    0,
    0,
    0,
    0.47,
    0.41,
    0.43,
    16,
    10,
    (th, ph) => {
      if (ph < -0.05 && Math.cos(th) > 0.22) return spec.furCream;
      return spec.furPrimary;
    },
    MAT_PLUSH,
  );

  // 2. Soft Cute Muzzle + Glossy Button Nose (+ Koro's Happy Pink Blep Tongue!)
  const snoutLen = charId === 'fox' || charId === 'dog' ? 0.5 : 0.45;
  emitSmoothEllipsoid(mb, 0, -0.09, 0.36, 0.2, 0.13, snoutLen - 0.31, 10, 6, () => spec.furCream, MAT_PLUSH);
  emitSmoothEllipsoid(
    mb,
    0,
    -0.055,
    snoutLen + 0.015,
    charId === 'dog' ? 0.068 : 0.052,
    0.042,
    0.038,
    8,
    6,
    () => (charId === 'cat' || charId === 'bunny' ? rosyPink : darkInk),
    MAT_GLOSSY,
  );
  if (charId === 'dog') {
    // Koro's signature Starlight Burst happy pink blep tongue + cream Shiba brow dots!
    emitSmoothEllipsoid(mb, 0, -0.15, snoutLen - 0.01, 0.055, 0.065, 0.032, 8, 6, () => rosyPink, MAT_PLUSH);
    for (const side of [-1, 1] as const) {
      emitSmoothEllipsoid(mb, side * 0.16, 0.2, 0.36, 0.062, 0.036, 0.03, 8, 6, () => spec.furCream, MAT_PLUSH);
    }
  }

  // 3. Wide-Set Glossy Starlight Burst Kawaii Jewel Eyes + Rosy Plush Cheeks!
  const irisRgb: [number, number, number] =
    charId === 'fox'
      ? [95, 194, 126]
      : charId === 'cat'
        ? [246, 215, 67]
        : charId === 'dog'
          ? [246, 215, 67]
          : [246, 215, 67];
  const cheekRgb = charId === 'bunny' ? warmPeach : rosyPink;

  for (const side of [-1, 1] as const) {
    // Wide-set big glossy espresso jewel eyes (`x = ±0.215`)
    emitSmoothEllipsoid(mb, side * 0.215, 0.04, 0.395, 0.088, 0.105, 0.042, 10, 6, () => darkInk, MAT_GLOSSY);
    // Luminous colored lower iris accent
    emitSmoothEllipsoid(mb, side * 0.215, -0.01, 0.422, 0.052, 0.038, 0.025, 8, 4, () => irisRgb, MAT_GLOSSY, 1);
    // Big sparkling white top-left star-moon catchlight
    emitSmoothEllipsoid(
      mb,
      side * 0.215 - 0.028,
      0.082,
      0.432,
      0.034,
      0.038,
      0.022,
      8,
      4,
      () => [255, 255, 255],
      MAT_GLOSSY,
      1,
    );
    // Soft rosy plush cheek blushes
    emitSmoothEllipsoid(mb, side * 0.32, -0.085, 0.33, 0.085, 0.052, 0.038, 8, 6, () => cheekRgb, MAT_PLUSH);
  }

  // 4. Species-Specific Static Head Accessories (whiskers, cheek tufts, satin bows);
  //    articulated left/right ears are baked in `buildDriverEarMeshes` so they blow back in the wind!
  if (charId === 'fox') {
    for (const side of [-1, 1] as const) {
      // Adorable fluffy side cheek tufts!
      emitSmoothSpineTube(
        mb,
        [
          { x: side * 0.36, y: -0.09, z: 0.02, rx: 0.125, ry: 0.105, rgb: spec.furCream },
          { x: side * 0.52, y: -0.1, z: -0.01, rx: 0.075, ry: 0.062, rgb: spec.furCream },
          { x: side * 0.62, y: -0.12, z: -0.03, rx: 0.014, ry: 0.012, rgb: spec.furCream },
        ],
        8,
        MAT_PLUSH,
      );
    }
  } else if (charId === 'cat') {
    for (const side of [-1, 1] as const) {
      // Cute dainty cat whiskers
      for (const wy of [-0.04, -0.11]) {
        mb.addBox(
          side > 0 ? 0.38 : -0.6,
          wy - 0.012,
          0.1,
          side > 0 ? 0.6 : -0.38,
          wy + 0.012,
          0.125,
          spec.furCream,
          MAT_PLUSH,
        );
      }
    }
    // Puffy Rose Satin Ear Bow + Golden Center Knot (visible front & back!)
    emitSmoothEllipsoid(mb, 0.27, 0.37, -0.04, 0.062, 0.062, 0.062, 8, 6, () => [246, 215, 67], MAT_GLOSSY);
    emitSmoothEllipsoid(mb, 0.14, 0.39, -0.04, 0.11, 0.075, 0.055, 8, 6, () => spec.scarfRgb, MAT_PLUSH);
    emitSmoothEllipsoid(mb, 0.4, 0.35, -0.04, 0.11, 0.075, 0.055, 8, 6, () => spec.scarfRgb, MAT_PLUSH);
  } else if (charId === 'bunny') {
    // Sunny Golden Satin Ear Bow!
    emitSmoothEllipsoid(mb, 0.24, 0.39, -0.04, 0.06, 0.06, 0.06, 8, 6, () => [255, 250, 224], MAT_GLOSSY);
    emitSmoothEllipsoid(mb, 0.12, 0.41, -0.04, 0.105, 0.072, 0.052, 8, 6, () => spec.scarfRgb, MAT_PLUSH);
    emitSmoothEllipsoid(mb, 0.36, 0.37, -0.04, 0.105, 0.072, 0.052, 8, 6, () => spec.scarfRgb, MAT_PLUSH);
  }

  return mb;
}

interface DriverEarMeshes {
  left: MeshBuilder;
  right: MeshBuilder;
  leftAnchor: readonly [number, number, number];
  rightAnchor: readonly [number, number, number];
}

function buildDriverEarMeshes(charId: DriverCharacterId): DriverEarMeshes {
  const spec = getKartDriverSpec(charId);
  const left = new MeshBuilder();
  const right = new MeshBuilder();

  const emitRel = (
    mb: MeshBuilder,
    anchor: readonly [number, number, number],
    spine: readonly TubeSpineNode[],
    colorOverride?: (
      ringIdx: number,
      theta: number,
      defaultRgb: readonly [number, number, number],
    ) => readonly [number, number, number],
    fixedRefAxis?: Vec3Mut,
  ) => {
    const [ax, ay, az] = anchor;
    emitSmoothSpineTube(
      mb,
      spine.map((n) => ({ ...n, x: n.x - ax, y: n.y - ay, z: n.z - az })),
      10,
      MAT_PLUSH,
      colorOverride,
      fixedRefAxis,
    );
  };

  if (charId === 'fox') {
    const leftAnchor = [-0.24, 0.27, -0.01] as const;
    const rightAnchor = [0.24, 0.27, -0.01] as const;
    for (const [side, mb, anchor] of [
      [-1, left, leftAnchor],
      [1, right, rightAnchor],
    ] as const) {
      emitRel(
        mb,
        anchor,
        [
          { x: side * 0.24, y: 0.27, z: -0.01, rx: 0.155, ry: 0.1, rgb: spec.furPrimary },
          { x: side * 0.37, y: 0.56, z: -0.01, rx: 0.115, ry: 0.072, rgb: spec.furPrimary },
          { x: side * 0.45, y: 0.78, z: -0.01, rx: 0.052, ry: 0.038, rgb: spec.furPrimary },
          { x: side * 0.48, y: 0.88, z: -0.01, rx: 0.014, ry: 0.012, rgb: spec.furPrimary },
        ],
        (ringIdx, theta, defRgb) => (ringIdx < 2 && Math.sin(theta) < -0.25 ? spec.furCream : defRgb),
      );
    }
    return { left, right, leftAnchor, rightAnchor };
  }

  if (charId === 'cat') {
    const leftAnchor = [-0.22, 0.28, 0.0] as const;
    const rightAnchor = [0.22, 0.28, 0.0] as const;
    for (const [side, mb, anchor] of [
      [-1, left, leftAnchor],
      [1, right, rightAnchor],
    ] as const) {
      emitRel(
        mb,
        anchor,
        [
          { x: side * 0.22, y: 0.28, z: 0.0, rx: 0.145, ry: 0.092, rgb: spec.furPrimary },
          { x: side * 0.32, y: 0.56, z: 0.0, rx: 0.092, ry: 0.06, rgb: spec.furPrimary },
          { x: side * 0.38, y: 0.78, z: 0.0, rx: 0.016, ry: 0.014, rgb: spec.furPrimary },
        ],
        (_ringIdx, theta, defRgb) => (Math.sin(theta) < -0.28 ? spec.furSecondary : defRgb),
      );
    }
    return { left, right, leftAnchor, rightAnchor };
  }

  if (charId === 'dog') {
    const leftAnchor = [-0.32, 0.25, -0.02] as const;
    const rightAnchor = [0.32, 0.25, -0.02] as const;
    for (const [side, mb, anchor] of [
      [-1, left, leftAnchor],
      [1, right, rightAnchor],
    ] as const) {
      emitRel(mb, anchor, [
        { x: side * 0.32, y: 0.25, z: -0.02, rx: 0.12, ry: 0.085, rgb: spec.furSecondary },
        { x: side * 0.54, y: 0.18, z: -0.03, rx: 0.145, ry: 0.095, rgb: spec.furSecondary },
        { x: side * 0.62, y: -0.04, z: -0.04, rx: 0.135, ry: 0.085, rgb: spec.furSecondary },
        { x: side * 0.6, y: -0.25, z: -0.04, rx: 0.052, ry: 0.042, rgb: spec.furSecondary },
      ]);
    }
    return { left, right, leftAnchor, rightAnchor };
  }

  // Momo (`bunny`): tall perky left ear + adorable folded right ear!
  const leftAnchor = [-0.17, 0.32, -0.02] as const;
  const rightAnchor = [0.18, 0.32, -0.02] as const;
  emitRel(
    left,
    leftAnchor,
    [
      { x: -0.17, y: 0.32, z: -0.02, rx: 0.105, ry: 0.065, rgb: spec.furPrimary },
      { x: -0.24, y: 0.72, z: -0.08, rx: 0.125, ry: 0.068, rgb: spec.furPrimary },
      { x: -0.28, y: 1.08, z: -0.15, rx: 0.102, ry: 0.055, rgb: spec.furPrimary },
      { x: -0.3, y: 1.32, z: -0.2, rx: 0.025, ry: 0.02, rgb: spec.furPrimary },
    ],
    (ringIdx, theta, defRgb) => (ringIdx < 2 && Math.sin(theta) < -0.32 ? spec.furCream : defRgb),
  );
  emitRel(
    right,
    rightAnchor,
    [
      { x: 0.18, y: 0.32, z: -0.02, rx: 0.07, ry: 0.105, rgb: spec.furPrimary },
      { x: 0.28, y: 0.68, z: -0.06, rx: 0.072, ry: 0.118, rgb: spec.furPrimary },
      { x: 0.39, y: 0.89, z: -0.09, rx: 0.068, ry: 0.105, rgb: spec.furPrimary },
      { x: 0.52, y: 0.8, z: -0.11, rx: 0.066, ry: 0.102, rgb: spec.furPrimary },
      { x: 0.58, y: 0.54, z: -0.14, rx: 0.056, ry: 0.088, rgb: spec.furPrimary },
      { x: 0.56, y: 0.42, z: -0.15, rx: 0.022, ry: 0.028, rgb: spec.furPrimary },
    ],
    (ringIdx, theta, defRgb) => (ringIdx < 2 && Math.cos(theta) > 0.32 ? spec.furCream : defRgb),
    { x: 0, y: 0, z: 1 },
  );
  return { left, right, leftAnchor, rightAnchor };
}

function buildDriverTailMesh(charId: DriverCharacterId): MeshBuilder {
  const spec = getKartDriverSpec(charId);
  const mb = new MeshBuilder();

  if (charId === 'fox') {
    emitSmoothSpineTube(
      mb,
      [
        { x: 0, y: 0, z: 0, rx: 0.12, ry: 0.12, rgb: spec.furPrimary },
        { x: 0.08, y: 0.18, z: -0.24, rx: 0.22, ry: 0.21, rgb: spec.furPrimary },
        { x: 0.18, y: 0.36, z: -0.46, rx: 0.26, ry: 0.25, rgb: spec.furPrimary },
        { x: 0.28, y: 0.54, z: -0.64, rx: 0.17, ry: 0.17, rgb: spec.furCream },
        { x: 0.36, y: 0.7, z: -0.78, rx: 0.028, ry: 0.028, rgb: spec.furCream },
      ],
      12,
      MAT_PLUSH,
    );
  } else if (charId === 'cat') {
    emitSmoothSpineTube(
      mb,
      [
        { x: 0, y: 0, z: 0, rx: 0.085, ry: 0.085, rgb: spec.furPrimary },
        { x: 0.06, y: 0.28, z: -0.28, rx: 0.088, ry: 0.088, rgb: spec.furPrimary },
        { x: 0.15, y: 0.58, z: -0.44, rx: 0.082, ry: 0.082, rgb: spec.furPrimary },
        { x: 0.26, y: 0.78, z: -0.5, rx: 0.074, ry: 0.074, rgb: spec.furCream },
        { x: 0.38, y: 0.82, z: -0.52, rx: 0.032, ry: 0.032, rgb: spec.furCream },
      ],
      10,
      MAT_PLUSH,
    );
  } else if (charId === 'dog') {
    emitSmoothSpineTube(
      mb,
      [
        { x: 0, y: 0, z: 0, rx: 0.11, ry: 0.11, rgb: spec.furPrimary },
        { x: -0.08, y: 0.24, z: -0.32, rx: 0.16, ry: 0.16, rgb: spec.furPrimary },
        { x: -0.14, y: 0.5, z: -0.42, rx: 0.15, ry: 0.15, rgb: spec.furCream },
        { x: -0.16, y: 0.64, z: -0.28, rx: 0.07, ry: 0.07, rgb: spec.furCream },
      ],
      10,
      MAT_PLUSH,
    );
  } else {
    emitSmoothEllipsoid(mb, 0, 0.18, -0.22, 0.24, 0.23, 0.24, 12, 8, () => spec.furCream, MAT_PLUSH);
  }

  return mb;
}

function buildScarfTailMesh(spec: KartDriverSpec): MeshBuilder {
  const mb = new MeshBuilder();
  for (const side of [-1, 1] as const) {
    const x0 = -0.09 + side * 0.11;
    mb.addBox(x0 - 0.055, -0.02, -0.34, x0 + 0.055, 0.02, 0, spec.scarfRgb, MAT_PLUSH);
    mb.addFlatTri(
      { x: x0 - 0.055, y: 0, z: -0.34 },
      { x: x0 + 0.055, y: 0, z: -0.34 },
      { x: x0 - 0.08, y: -0.03, z: -0.68 },
      spec.scarfRgb,
      MAT_PLUSH,
    );
    mb.addFlatTri(
      { x: x0 + 0.055, y: 0, z: -0.34 },
      { x: x0 - 0.055, y: 0, z: -0.34 },
      { x: x0 - 0.08, y: -0.03, z: -0.68 },
      spec.scarfRgb,
      MAT_PLUSH,
    );
  }
  return mb;
}

function buildFlameConeMesh(): MeshBuilder {
  const mb = new MeshBuilder();
  emitSmoothSpineTube(
    mb,
    [
      { x: 0, y: 0, z: 0, rx: 0.21, ry: 0.21, rgb: [255, 255, 255], emissive: 1 },
      { x: 0, y: 0, z: -0.45, rx: 0.15, ry: 0.15, rgb: [255, 255, 255], emissive: 1 },
      { x: 0, y: 0, z: -1.0, rx: 0.01, ry: 0.01, rgb: [255, 255, 255], emissive: 1 },
    ],
    10,
    MAT_GLOSSY,
  );
  return mb;
}

function buildBrakeBarMesh(): MeshBuilder {
  const mb = new MeshBuilder();
  mb.addBox(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, [255, 255, 255], MAT_GLOSSY, 1);
  return mb;
}

/**
 * Bakes the entire 192-segment closed 3D circuit + candy curbs + rainbow boost strips +
 * festive carnival pennant start archway + playful low-poly world props (storybook trees,
 * floating striped hot-air balloons, toy mesas & saguaro cacti, glowing Starlight stars)
 * into ONE static GPU VBO!
 */
function buildStaticCircuitMesh(circuit: CircuitDefinition): MeshBuilder {
  const mb = new MeshBuilder();
  const nodes = circuit.nodes;
  const N = nodes.length;

  const roadDark = parseHexRgb(circuit.theme.roadDark);
  const roadLight = parseHexRgb(circuit.theme.roadLight);
  const groundOuter = parseHexRgb(circuit.theme.groundOuter);
  const groundAlt = parseHexRgb(circuit.theme.groundAlt);
  const curbA = parseHexRgb(circuit.theme.curbA);
  const curbB = parseHexRgb(circuit.theme.curbB);

  const rw = circuit.roadHalfWidth;
  const cw = rw + 1.55;
  const gw = rw + 190;
  const isCloudSea = circuit.theme.skyMode === 'cloud-sea';
  const curbH = isCloudSea ? 0.52 : 0.3;
  const [jpStart, jpEnd] = circuit.theme.jadePoolRange ?? [-1, -1];
  const [clStart, clEnd] = circuit.theme.cliffRange ?? [-1, -1];
  const moonSeg = circuit.theme.moonGateSeg ?? -1;
  const jadePondY =
    isCloudSea && jpStart >= 0 && jpEnd >= 0
      ? Math.min(nodes[jpStart]!.y, nodes[jpEnd]!.y) - 0.25
      : 0;

  for (let i0 = 0; i0 < N; i0 += 1) {
    const i1 = (i0 + 1) % N;
    const n0 = nodes[i0]!;
    const n1 = nodes[i1]!;
    const even = i0 % 2 === 0;
    const gRgb = even ? groundOuter : groundAlt;
    const inJadePool = isCloudSea && i0 >= jpStart && i0 <= jpEnd;
    const inCliff = isCloudSea && i0 >= clStart && i0 <= clEnd;

    if (isCloudSea) {
      // Sculpted floating White-Jade Sky Viaduct deck underside (Rainbow Road in the clouds!)
      const deckH = 2.35;
      const underW = cw - 0.8;
      const jadeSide: [number, number, number] = even ? [236, 232, 222] : [224, 220, 210];
      const jadeUnder: [number, number, number] = [184, 196, 212];
      // Left & right carved jade bridge fascia walls dropping below the balustrade
      mb.addFlatQuad(
        { x: n0.x - n0.rx * cw, y: n0.y + curbH, z: n0.z - n0.rz * cw },
        { x: n1.x - n1.rx * cw, y: n1.y + curbH, z: n1.z - n1.rz * cw },
        { x: n1.x - n1.rx * underW, y: n1.y - deckH, z: n1.z - n1.rz * underW },
        { x: n0.x - n0.rx * underW, y: n0.y - deckH, z: n0.z - n0.rz * underW },
        jadeSide,
        MAT_MATTE,
      );
      mb.addFlatQuad(
        { x: n0.x + n0.rx * cw, y: n0.y + curbH, z: n0.z + n0.rz * cw },
        { x: n0.x + n0.rx * underW, y: n0.y - deckH, z: n0.z + n0.rz * underW },
        { x: n1.x + n1.rx * underW, y: n1.y - deckH, z: n1.z + n1.rz * underW },
        { x: n1.x + n1.rx * cw, y: n1.y + curbH, z: n1.z + n1.rz * cw },
        jadeSide,
        MAT_MATTE,
      );
      // Solid bridge belly underneath so soaring hills never look paper-thin
      mb.addFlatQuad(
        { x: n0.x - n0.rx * underW, y: n0.y - deckH, z: n0.z - n0.rz * underW },
        { x: n1.x - n1.rx * underW, y: n1.y - deckH, z: n1.z - n1.rz * underW },
        { x: n1.x + n1.rx * underW, y: n1.y - deckH, z: n1.z + n1.rz * underW },
        { x: n0.x + n0.rx * underW, y: n0.y - deckH, z: n0.z + n0.rz * underW },
        jadeUnder,
        MAT_MATTE,
      );

      // Jade Pool Terrace (`瑶池`) + Soaring White-Jade Belt Arch Bridge (`玉带桥`, `wm_jade_bridge.jpg`)!
      if (inJadePool) {
        const poolW = rw + 68;
        const poolCol: [number, number, number] = even ? [28, 172, 166] : [42, 198, 188];
        const rimCol: [number, number, number] = [242, 239, 230];
        // Continuous shimmering turquoise-emerald pond water spanning flat at `jadePondY` EVEN UNDER THE ARCH BRIDGE!
        mb.addFlatQuad(
          { x: n0.x - n0.rx * poolW, y: jadePondY, z: n0.z - n0.rz * poolW },
          { x: n0.x + n0.rx * poolW, y: jadePondY, z: n0.z + n0.rz * poolW },
          { x: n1.x + n1.rx * poolW, y: jadePondY, z: n1.z + n1.rz * poolW },
          { x: n1.x - n1.rx * poolW, y: jadePondY, z: n1.z - n1.rz * poolW },
          poolCol,
          MAT_GLOSSY,
        );
        for (const side of [-1, 1] as const) {
          const outer = side * poolW;
          const rimOuter = side * (poolW + 2.6);
          mb.addFlatQuad(
            { x: n0.x + n0.rx * outer, y: jadePondY + 0.5, z: n0.z + n0.rz * outer },
            { x: n0.x + n0.rx * rimOuter, y: jadePondY + 0.5, z: n0.z + n0.rz * rimOuter },
            { x: n1.x + n1.rx * rimOuter, y: jadePondY + 0.5, z: n1.z + n1.rz * rimOuter },
            { x: n1.x + n1.rx * outer, y: jadePondY + 0.5, z: n1.z + n1.rz * outer },
            rimCol,
            MAT_MATTE,
          );
        }

        // Sculpted White-Jade Belt Arch Bridge spandrel walls & rhythmic carved balustrade posts!
        const jpMid = (jpStart + jpEnd) * 0.5;
        const archHalfSpan = 12;
        const d0 = Math.abs(i0 - jpMid);
        const d1 = Math.abs(i1 - jpMid);
        if (d0 <= archHalfSpan && d1 <= archHalfSpan) {
          // Graceful high semicircular arch vault opening right above the emerald pond
          const archOpening = (d: number) => {
            const norm = d / archHalfSpan;
            // Semi-circular stone arch cutout rising cleanly up toward the bridge belly
            const archH = Math.sqrt(Math.max(0, 1 - norm * norm)) * 8.4;
            return jadePondY + archH;
          };
          const bot0 = Math.min(n0.y - deckH, archOpening(d0));
          const bot1 = Math.min(n1.y - deckH, archOpening(d1));
          const spandrelCol: [number, number, number] = even ? [246, 243, 236] : [236, 232, 224];
          // Solid 0.45m-thick carved white-marble arch spandrel & parapet walls (separate inner/outer faces -> ZERO Z-fighting!)
          for (const side of [-1, 1] as const) {
            const sxIn = side * (cw + 0.06);
            const sxOut = side * (cw + 0.52);
            const topY0 = n0.y + curbH + 1.32;
            const topY1 = n1.y + curbH + 1.32;
            // Outer face (facing pond)
            const outA = { x: n0.x + n0.rx * sxOut, y: topY0, z: n0.z + n0.rz * sxOut };
            const outB = { x: n1.x + n1.rx * sxOut, y: topY1, z: n1.z + n1.rz * sxOut };
            const outC = { x: n1.x + n1.rx * sxOut, y: bot1, z: n1.z + n1.rz * sxOut };
            const outD = { x: n0.x + n0.rx * sxOut, y: bot0, z: n0.z + n0.rz * sxOut };
            // Inner face (facing road)
            const inA = { x: n0.x + n0.rx * sxIn, y: topY0, z: n0.z + n0.rz * sxIn };
            const inB = { x: n1.x + n1.rx * sxIn, y: topY1, z: n1.z + n1.rz * sxIn };
            const inC = { x: n1.x + n1.rx * sxIn, y: n1.y + curbH, z: n1.z + n1.rz * sxIn };
            const inD = { x: n0.x + n0.rx * sxIn, y: n0.y + curbH, z: n0.z + n0.rz * sxIn };
            if (side > 0) {
              mb.addFlatQuad(outA, outD, outC, outB, spandrelCol, MAT_MATTE);
              mb.addFlatQuad(inA, inB, inC, inD, [232, 228, 220], MAT_MATTE);
              mb.addFlatQuad(inA, outA, outB, inB, [248, 245, 238], MAT_MATTE);
            } else {
              mb.addFlatQuad(outA, outB, outC, outD, spandrelCol, MAT_MATTE);
              mb.addFlatQuad(inA, inD, inC, inB, [232, 228, 220], MAT_MATTE);
              mb.addFlatQuad(outA, inA, inB, outB, [248, 245, 238], MAT_MATTE);
            }
            // Rhythmic carved white-jade balustrade posts with golden orbs along the Jade Belt Bridge hill!
            if (i0 % 2 === 0) {
              const px = n0.x + n0.rx * (side * (cw + 0.3));
              const pz = n0.z + n0.rz * (side * (cw + 0.3));
              mb.addBox(px - 0.36, n0.y + curbH, pz - 0.36, px + 0.36, n0.y + curbH + 1.95, pz + 0.36, [248, 245, 238], MAT_MATTE);
              mb.addBox(px - 0.42, n0.y + curbH + 1.95, pz - 0.42, px + 0.42, n0.y + curbH + 2.4, pz + 0.42, [244, 202, 86], MAT_GLOSSY, 1);
            }
          }
          // Stone arch vault soffit underneath the bridge
          mb.addFlatQuad(
            { x: n0.x - n0.rx * cw, y: bot0, z: n0.z - n0.rz * cw },
            { x: n1.x - n1.rx * cw, y: bot1, z: n1.z - n1.rz * cw },
            { x: n1.x + n1.rx * cw, y: bot1, z: n1.z + n1.rz * cw },
            { x: n0.x + n0.rx * cw, y: bot0, z: n0.z + n0.rz * cw },
            [194, 206, 216],
            MAT_MATTE,
          );
        }
      }

      // Immortal Cliff Cut (`cn6.jpg`): carved ivory-slate cliff wall on inner edge + cantilevered golden pavilion!
      if (inCliff) {
        const cliffX0 = n0.x - n0.rx * (cw + 2.5);
        const cliffZ0 = n0.z - n0.rz * (cw + 2.5);
        const cliffX1 = n1.x - n1.rx * (cw + 2.5);
        const cliffZ1 = n1.z - n1.rz * (cw + 2.5);
        const cliffBack0X = n0.x - n0.rx * (cw + 24);
        const cliffBack0Z = n0.z - n0.rz * (cw + 24);
        const cliffBack1X = n1.x - n1.rx * (cw + 24);
        const cliffBack1Z = n1.z - n1.rz * (cw + 24);
        const cliffH = 30 + Math.sin(((i0 - clStart) / Math.max(1, clEnd - clStart)) * Math.PI) * 14;
        const cliffCol: [number, number, number] = even ? [226, 222, 212] : [206, 204, 196];
        // Vertical carved white-jade cliff face
        mb.addFlatQuad(
          { x: cliffX0, y: n0.y - 12, z: cliffZ0 },
          { x: cliffX1, y: n1.y - 12, z: cliffZ1 },
          { x: cliffX1, y: n1.y + cliffH, z: cliffZ1 },
          { x: cliffX0, y: n0.y + cliffH, z: cliffZ0 },
          cliffCol,
          MAT_MATTE,
        );
        // Subtle recessed vermilion-gold palace cornice band along the cliff wall
        mb.addFlatQuad(
          { x: cliffX0 + n0.rx * 0.25, y: n0.y + 9.2, z: cliffZ0 + n0.rz * 0.25 },
          { x: cliffX1 + n1.rx * 0.25, y: n1.y + 9.2, z: cliffZ1 + n1.rz * 0.25 },
          { x: cliffX1 + n1.rx * 0.25, y: n1.y + 10.6, z: cliffZ1 + n1.rz * 0.25 },
          { x: cliffX0 + n0.rx * 0.25, y: n0.y + 10.6, z: cliffZ0 + n0.rz * 0.25 },
          [238, 194, 78],
          MAT_GLOSSY,
        );
        // Cliff top cap
        mb.addFlatQuad(
          { x: cliffX0, y: n0.y + cliffH, z: cliffZ0 },
          { x: cliffX1, y: n1.y + cliffH, z: cliffZ1 },
          { x: cliffBack1X, y: n1.y + cliffH + 4, z: cliffBack1Z },
          { x: cliffBack0X, y: n0.y + cliffH + 4, z: cliffBack0Z },
          [234, 232, 224],
          MAT_MATTE,
        );
        // Cantilevered golden-roofed pavilion jutting out over the outer cloud abyss at apex!
        if (i0 === Math.floor((clStart + clEnd) * 0.5)) {
          const px = n0.x + n0.rx * (cw + 11.5);
          const pz = n0.z + n0.rz * (cw + 11.5);
          const py = n0.y - 0.3;
          mb.addBox(px - 6.8, py - 1.6, pz - 6.8, px + 6.8, py, pz + 6.8, [242, 239, 230], MAT_MATTE);
          emitGoldenPavilion(mb, px, py, pz, 1.35);
        }
      }

      // Colossal 68m-Wide White-Jade Moon-Ring Arch (`cn1.jpg`) + High-Altitude Sky-Waterfall (`+38m` ABOVE track)!
      if (i0 === moonSeg) {
        const ringSegs = 24;
        const ringR = 34.0; // Monumental 68m diameter towering ~52m above the road!
        const ringThick = 3.8;
        const ringDepth = 3.2;
        const ringCenterY = n0.y + 14.5;

        // Twin monumental stepped white-jade cloud pedestals anchoring the colossal ring
        for (const side of [-1, 1] as const) {
          const pedX = n0.x + n0.rx * side * (ringR - 0.4);
          const pedZ = n0.z + n0.rz * side * (ringR - 0.4);
          mb.addBox(pedX - 4.4, n0.y - 16, pedZ - 4.4, pedX + 4.4, n0.y + 3.5, pedZ + 4.4, [238, 235, 226], MAT_MATTE);
          mb.addBox(pedX - 3.4, n0.y + 3.5, pedZ - 3.4, pedX + 3.4, n0.y + 8.5, pedZ + 3.4, [246, 243, 236], MAT_MATTE);
        }

        for (let k = 0; k < ringSegs; k += 1) {
          const a0 = -0.35 + (k / ringSegs) * (Math.PI + 0.7);
          const a1 = -0.35 + ((k + 1) / ringSegs) * (Math.PI + 0.7);
          const c0 = Math.cos(a0);
          const s0 = Math.sin(a0);
          const c1 = Math.cos(a1);
          const s1 = Math.sin(a1);
          const rIn = ringR - ringThick * 0.5;
          const rOut = ringR + ringThick * 0.5;
          const pIn0 = { x: n0.x + n0.rx * (c0 * rIn), y: ringCenterY + s0 * rIn, z: n0.z + n0.rz * (c0 * rIn) };
          const pOut0 = { x: n0.x + n0.rx * (c0 * rOut), y: ringCenterY + s0 * rOut, z: n0.z + n0.rz * (c0 * rOut) };
          const pIn1 = { x: n0.x + n0.rx * (c1 * rIn), y: ringCenterY + s1 * rIn, z: n0.z + n0.rz * (c1 * rIn) };
          const pOut1 = { x: n0.x + n0.rx * (c1 * rOut), y: ringCenterY + s1 * rOut, z: n0.z + n0.rz * (c1 * rOut) };
          const dfx = n0.tx * ringDepth;
          const dfz = n0.tz * ringDepth;
          const ringCol: [number, number, number] = k % 2 === 0 ? [248, 245, 238] : [236, 232, 222];
          // Front & back faces of the colossal white-jade Moon-Ring
          mb.addFlatQuad(pIn0, pOut0, pOut1, pIn1, ringCol, MAT_GLOSSY);
          mb.addFlatQuad(
            { x: pIn0.x + dfx, y: pIn0.y, z: pIn0.z + dfz },
            { x: pIn1.x + dfx, y: pIn1.y, z: pIn1.z + dfz },
            { x: pOut1.x + dfx, y: pOut1.y, z: pOut1.z + dfz },
            { x: pOut0.x + dfx, y: pOut0.y, z: pOut0.z + dfz },
            ringCol,
            MAT_GLOSSY,
          );
          // Outer thickness cap
          mb.addFlatQuad(
            pOut0,
            { x: pOut0.x + dfx, y: pOut0.y, z: pOut0.z + dfz },
            { x: pOut1.x + dfx, y: pOut1.y, z: pOut1.z + dfz },
            pOut1,
            [226, 222, 214],
            MAT_MATTE,
          );
          // Gleaming golden inner celestial band
          mb.addFlatQuad(
            pIn0,
            pIn1,
            { x: pIn1.x + dfx, y: pIn1.y, z: pIn1.z + dfz },
            { x: pIn0.x + dfx, y: pIn0.y, z: pIn0.z + dfz },
            [248, 208, 92],
            MAT_GLOSSY,
            1,
          );
        }

        // Soaring Floating Immortal Cliff Spire + Upper Golden Palace Terrace (+39m ABOVE road)
        // placed cleanly clear of the 68m Moon-Ring Arch on the OUTSIDE of the bend in both Forward & Reverse!
        const outSign = n0.curvature >= 0 ? -1 : 1;
        const spireDist = ringR + 24;
        const spX = n0.x + n0.rx * outSign * spireDist + n0.tx * 26;
        const spZ = n0.z + n0.rz * outSign * spireDist + n0.tz * 26;
        const spTopY = n0.y + 39;
        // Towering sculpted immortal mountain spire rising from clouds below to +39m above the road
        emitSmoothSpineTube(
          mb,
          [
            { x: spX, y: n0.y - 34, z: spZ, rx: 4.0, ry: 4.0, rgb: [118, 132, 150] },
            { x: spX, y: n0.y - 4, z: spZ, rx: 12.5, ry: 12.5, rgb: [154, 166, 178] },
            { x: spX, y: n0.y + 22, z: spZ, rx: 15.5, ry: 15.5, rgb: [198, 200, 194] },
            { x: spX, y: spTopY, z: spZ, rx: 14.0, ry: 14.0, rgb: [236, 233, 224] },
          ],
          8,
          MAT_MATTE,
        );
        // Crown the floating mountain terrace with a gleaming Golden Pavilion (`cn2.jpg`)!
        emitGoldenPavilion(
          mb,
          spX + n0.rx * outSign * 2.5 + n0.tx * 2.5,
          spTopY,
          spZ + n0.rz * outSign * 2.5 + n0.tz * 2.5,
          1.55,
        );

        // MASSIVE 74m-TALL LUMINOUS SKY-WATERFALL pouring down the FRONT FACE toward the approaching driver!
        const faceDirX = -n0.tx * 0.78 - n0.rx * outSign * 0.62;
        const faceDirZ = -n0.tz * 0.78 - n0.rz * outSign * 0.62;
        const faceSideX = faceDirZ;
        const faceSideZ = -faceDirX;
        const wfBaseX = spX + faceDirX * 15.2;
        const wfBaseZ = spZ + faceDirZ * 15.2;

        // Water spout lip jutting out from the top of the spire at +38m
        mb.addBox(wfBaseX - 6.5, spTopY - 1.8, wfBaseZ - 6.5, wfBaseX + 6.5, spTopY - 0.1, wfBaseZ + 6.5, [224, 246, 252], MAT_GLOSSY, 1);

        const wfStreams: ReadonlyArray<[number, number, number, [number, number, number]]> = [
          [-5.4, 3.6, 0.2, [132, 224, 244]],
          [0.0, 4.8, 0.85, [242, 253, 255]],
          [5.6, 3.2, 0.2, [156, 234, 248]],
        ];
        for (const [latOff, halfW, outOff, wfRgb] of wfStreams) {
          const cx0 = wfBaseX + faceSideX * (latOff - halfW) + faceDirX * outOff;
          const cz0 = wfBaseZ + faceSideZ * (latOff - halfW) + faceDirZ * outOff;
          const cx1 = wfBaseX + faceSideX * (latOff + halfW) + faceDirX * outOff;
          const cz1 = wfBaseZ + faceSideZ * (latOff + halfW) + faceDirZ * outOff;
          const top0 = { x: cx0, y: spTopY - 1.0, z: cz0 };
          const top1 = { x: cx1, y: spTopY - 1.0, z: cz1 };
          const bot1 = { x: cx1 + faceDirX * 5.2, y: n0.y - 36, z: cz1 + faceDirZ * 5.2 };
          const bot0 = { x: cx0 + faceDirX * 5.2, y: n0.y - 36, z: cz0 + faceDirZ * 5.2 };
          mb.addFlatQuad(top0, top1, bot1, bot0, wfRgb, MAT_GLOSSY, 1);
          mb.addFlatQuad(top1, top0, bot0, bot1, wfRgb, MAT_GLOSSY, 1);
        }
        // Billowing white spray-mist cloud puffs where the Sky-Waterfall plunges past road level into the clouds!
        const mistCol = (): readonly [number, number, number] => [246, 252, 255];
        emitSmoothEllipsoid(mb, wfBaseX + faceDirX * 4, n0.y - 2, wfBaseZ + faceDirZ * 4, 11.5, 4.6, 11.5, 8, 5, mistCol, MAT_PLUSH, 1);
        emitSmoothEllipsoid(mb, wfBaseX + faceDirX * 6, n0.y - 14, wfBaseZ + faceDirZ * 6, 15.5, 5.4, 15.5, 8, 5, mistCol, MAT_PLUSH, 1);
      }
    } else {
      // Standard Earth-backed Ground Shoulders
      mb.addFlatQuad(
        { x: n0.x - n0.rx * gw, y: n0.y - 0.18, z: n0.z - n0.rz * gw },
        { x: n0.x - n0.rx * cw, y: n0.y - 0.04, z: n0.z - n0.rz * cw },
        { x: n1.x - n1.rx * cw, y: n1.y - 0.04, z: n1.z - n1.rz * cw },
        { x: n1.x - n1.rx * gw, y: n1.y - 0.18, z: n1.z - n1.rz * gw },
        gRgb,
        MAT_MATTE,
      );
      mb.addFlatQuad(
        { x: n0.x + n0.rx * cw, y: n0.y - 0.04, z: n0.z + n0.rz * cw },
        { x: n0.x + n0.rx * gw, y: n0.y - 0.18, z: n0.z + n0.rz * gw },
        { x: n1.x + n1.rx * gw, y: n1.y - 0.18, z: n1.z + n1.rz * gw },
        { x: n1.x + n1.rx * cw, y: n1.y - 0.04, z: n1.z + n1.rz * cw },
        gRgb,
        MAT_MATTE,
      );
    }

    // Asphalt / Slate-Jade track surface
    mb.addFlatQuad(
      { x: n0.x - n0.rx * rw, y: n0.y, z: n0.z - n0.rz * rw },
      { x: n0.x + n0.rx * rw, y: n0.y, z: n0.z + n0.rz * rw },
      { x: n1.x + n1.rx * rw, y: n1.y, z: n1.z + n1.rz * rw },
      { x: n1.x - n1.rx * rw, y: n1.y, z: n1.z - n1.rz * rw },
      even ? roadDark : roadLight,
      MAT_MATTE,
    );

    // Speed-matched center dashed racing line (matches onscreen speedometer color for skid-free cornering!)
    if (even && i0 !== 0) {
      const lw = 0.54;
      const lineRgb = speedToColorRgb(n0.recommendedSpeed);
      mb.addFlatQuad(
        { x: n0.x - n0.rx * lw, y: n0.y + 0.048, z: n0.z - n0.rz * lw },
        { x: n0.x + n0.rx * lw, y: n0.y + 0.048, z: n0.z + n0.rz * lw },
        { x: n1.x + n1.rx * lw, y: n1.y + 0.048, z: n1.z + n1.rz * lw },
        { x: n1.x - n1.rx * lw, y: n1.y + 0.048, z: n1.z - n1.rz * lw },
        lineRgb,
        MAT_MATTE,
        1,
      );
    }

    // Raised 3D Curbs / Carved White-Jade & Vermilion Balustrades
    const cRgb = even ? curbA : curbB;
    mb.addFlatQuad(
      { x: n0.x - n0.rx * cw, y: n0.y + curbH, z: n0.z - n0.rz * cw },
      { x: n0.x - n0.rx * rw, y: n0.y + curbH, z: n0.z - n0.rz * rw },
      { x: n1.x - n1.rx * rw, y: n1.y + curbH, z: n1.z - n1.rz * rw },
      { x: n1.x - n1.rx * cw, y: n1.y + curbH, z: n1.z - n1.rz * cw },
      cRgb,
      MAT_MATTE,
    );
    mb.addFlatQuad(
      { x: n0.x - n0.rx * rw, y: n0.y, z: n0.z - n0.rz * rw },
      { x: n0.x - n0.rx * rw, y: n0.y + curbH, z: n0.z - n0.rz * rw },
      { x: n1.x - n1.rx * rw, y: n1.y + curbH, z: n1.z - n1.rz * rw },
      { x: n1.x - n1.rx * rw, y: n1.y, z: n1.z - n1.rz * rw },
      cRgb,
      MAT_MATTE,
    );
    mb.addFlatQuad(
      { x: n0.x + n0.rx * rw, y: n0.y + curbH, z: n0.z + n0.rz * rw },
      { x: n0.x + n0.rx * cw, y: n0.y + curbH, z: n0.z + n0.rz * cw },
      { x: n1.x + n1.rx * cw, y: n1.y + curbH, z: n1.z + n1.rz * cw },
      { x: n1.x + n1.rx * rw, y: n1.y + curbH, z: n1.z + n1.rz * rw },
      cRgb,
      MAT_MATTE,
    );
    mb.addFlatQuad(
      { x: n0.x + n0.rx * rw, y: n0.y, z: n0.z + n0.rz * rw },
      { x: n1.x + n1.rx * rw, y: n1.y, z: n1.z + n1.rz * rw },
      { x: n1.x + n1.rx * rw, y: n1.y + curbH, z: n1.z + n1.rz * rw },
      { x: n0.x + n0.rx * rw, y: n0.y + curbH, z: n0.z + n0.rz * rw },
      cRgb,
      MAT_MATTE,
    );

    // Road Boost Strip (Dunhuang Liquid-Gold & Lapis on Cloud Gate; Rainbow Chevron elsewhere!)
    if (n0.hasBoostPad) {
      const bl = n0.boostLat;
      const bw = 3.0;
      const padPalette: ReadonlyArray<[number, number, number]> = isCloudSea
        ? [
            [248, 206, 86],
            [76, 178, 238],
            [255, 240, 186],
          ]
        : [
            [56, 236, 255],
            [255, 224, 72],
            [255, 112, 166],
          ];
      const padCol = padPalette[i0 % 3]!;
      mb.addFlatQuad(
        { x: n0.x + n0.rx * (bl - bw), y: n0.y + 0.068, z: n0.z + n0.rz * (bl - bw) },
        { x: n0.x + n0.rx * (bl + bw), y: n0.y + 0.068, z: n0.z + n0.rz * (bl + bw) },
        { x: n1.x + n1.rx * (bl + bw), y: n1.y + 0.068, z: n1.z + n1.rz * (bl + bw) },
        { x: n1.x + n1.rx * (bl - bw), y: n1.y + 0.068, z: n1.z + n1.rz * (bl - bw) },
        padCol,
        MAT_GLOSSY,
        1,
      );
    }

    // Turn-Warning Marker (Glowing White-Jade Palace Lantern Post on Cloud Gate; Yellow Chevron elsewhere)
    if (n0.hasChevron) {
      const side = n0.chevronSide;
      const dist = cw + 1.8;
      const sx = n0.x + n0.rx * side * dist;
      const sz = n0.z + n0.rz * side * dist;
      if (isCloudSea) {
        mb.addBox(sx - 0.34, n0.y, sz - 0.34, sx + 0.34, n0.y + 4.4, sz + 0.34, [242, 239, 230], MAT_MATTE);
        mb.addBox(sx - 0.65, n0.y + 4.4, sz - 0.65, sx + 0.65, n0.y + 5.7, sz + 0.65, [244, 152, 58], MAT_GLOSSY, 1);
        mb.addBox(sx - 0.9, n0.y + 5.7, sz - 0.9, sx + 0.9, n0.y + 6.1, sz + 0.9, [238, 194, 78], MAT_GLOSSY);
      } else {
        const sw = 1.65;
        mb.addFlatQuad(
          { x: sx - n0.rx * sw, y: n0.y + 0.8, z: sz - n0.rz * sw },
          { x: sx + n0.rx * sw, y: n0.y + 0.8, z: sz + n0.rz * sw },
          { x: sx + n0.rx * sw, y: n0.y + 3.0, z: sz + n0.rz * sw },
          { x: sx - n0.rx * sw, y: n0.y + 3.0, z: sz - n0.rz * sw },
          [255, 218, 68],
          MAT_GLOSSY,
          1,
        );
        mb.addBox(sx - 0.18, n0.y, sz - 0.18, sx + 0.18, n0.y + 0.85, sz + 0.18, [255, 250, 240], MAT_GLOSSY);
      }
    }

    // Start / Finish Archway: Monumental South Heaven Gate (`南天门`) on Cloud Gate; Carnival Arch elsewhere!
    if (i0 === 0) {
      const cells = 8;
      for (let c = 0; c < cells; c += 1) {
        const f0 = -rw + (c / cells) * (rw * 2);
        const f1 = -rw + ((c + 1) / cells) * (rw * 2);
        // Ground checkered finish line
        mb.addFlatQuad(
          { x: n0.x + n0.rx * f0, y: n0.y + 0.055, z: n0.z + n0.rz * f0 },
          { x: n0.x + n0.rx * f1, y: n0.y + 0.055, z: n0.z + n0.rz * f1 },
          { x: n1.x + n1.rx * f1, y: n1.y + 0.055, z: n1.z + n1.rz * f1 },
          { x: n1.x + n1.rx * f0, y: n1.y + 0.055, z: n1.z + n1.rz * f0 },
          c % 2 === 0 ? [255, 255, 255] : [30, 38, 56],
          MAT_MATTE,
        );
      }

      if (isCloudSea) {
        // Monumental 4-Pillar South Heaven Gate (`南天门`) with Double-Tiered Upturned Golden Eaves!
        const gateSpan = rw + 3.4;
        const pillarPositions = [-gateSpan, -(rw + 0.8), rw + 0.8, gateSpan];
        for (const pLat of pillarPositions) {
          const px = n0.x + n0.rx * pLat;
          const pz = n0.z + n0.rz * pLat;
          // Stepped white-jade plinth
          mb.addBox(px - 1.35, n0.y, pz - 1.35, px + 1.35, n0.y + 2.4, pz + 1.35, [242, 239, 230], MAT_MATTE);
          // Vermilion imperial pillar with gilded capital
          mb.addBox(px - 0.82, n0.y + 2.4, pz - 0.82, px + 0.82, n0.y + 11.4, pz + 0.82, [188, 50, 40], MAT_GLOSSY);
          mb.addBox(px - 1.05, n0.y + 11.4, pz - 1.05, px + 1.05, n0.y + 12.2, pz + 1.05, [242, 198, 76], MAT_GLOSSY);
        }
        // Azure-lapis & gold carved lintel beam (`藻井`) spanning across all 4 pillars (`t = -1.2 .. +1.2`)
        const halfD = 1.2;
        const bLFront = { x: n0.x - n0.rx * (gateSpan + 1.2) - n0.tx * halfD, z: n0.z - n0.rz * (gateSpan + 1.2) - n0.tz * halfD };
        const bRFront = { x: n0.x + n0.rx * (gateSpan + 1.2) - n0.tx * halfD, z: n0.z + n0.rz * (gateSpan + 1.2) - n0.tz * halfD };
        const bLBack = { x: n0.x - n0.rx * (gateSpan + 1.2) + n0.tx * halfD, z: n0.z - n0.rz * (gateSpan + 1.2) + n0.tz * halfD };
        const bRBack = { x: n0.x + n0.rx * (gateSpan + 1.2) + n0.tx * halfD, z: n0.z + n0.rz * (gateSpan + 1.2) + n0.tz * halfD };
        const beamCols: ReadonlyArray<[number, number, [number, number, number], number]> = [
          [9.4, 11.2, [42, 82, 148], 0],
          [11.2, 12.0, [244, 198, 76], 1],
        ];
        for (const [y0, y1, rgb, em] of beamCols) {
          mb.addFlatQuad(
            { x: bLFront.x, y: n0.y + y0, z: bLFront.z },
            { x: bRFront.x, y: n0.y + y0, z: bRFront.z },
            { x: bRFront.x, y: n0.y + y1, z: bRFront.z },
            { x: bLFront.x, y: n0.y + y1, z: bLFront.z },
            rgb,
            MAT_GLOSSY,
            em,
          );
          mb.addFlatQuad(
            { x: bRBack.x, y: n0.y + y0, z: bRBack.z },
            { x: bLBack.x, y: n0.y + y0, z: bLBack.z },
            { x: bLBack.x, y: n0.y + y1, z: bLBack.z },
            { x: bRBack.x, y: n0.y + y1, z: bRBack.z },
            rgb,
            MAT_GLOSSY,
            em,
          );
        }
        // Bottom soffit of lintel beam
        mb.addFlatQuad(
          { x: bLFront.x, y: n0.y + 9.4, z: bLFront.z },
          { x: bLBack.x, y: n0.y + 9.4, z: bLBack.z },
          { x: bRBack.x, y: n0.y + 9.4, z: bRBack.z },
          { x: bRFront.x, y: n0.y + 9.4, z: bRFront.z },
          [32, 62, 112],
          MAT_MATTE,
        );
        // Central 3D Carved Imperial Plaque (`南天门`) protruding cleanly proud of BOTH faces (ZERO Z-fighting!)
        const frameW = 5.4;
        const innerW = 4.65;
        for (const faceSign of [-1, 1] as const) {
          const frameOff = faceSign * (halfD + 0.35);
          const goldOff = faceSign * (halfD + 0.62);
          const emitPlaqueQuad = (hw: number, yBot: number, yTop: number, off: number, rgb: [number, number, number], em: number) => {
            const p0 = { x: n0.x - n0.rx * hw + n0.tx * off, y: n0.y + yBot, z: n0.z - n0.rz * hw + n0.tz * off };
            const p1 = { x: n0.x + n0.rx * hw + n0.tx * off, y: n0.y + yBot, z: n0.z + n0.rz * hw + n0.tz * off };
            const p2 = { x: n0.x + n0.rx * hw + n0.tx * off, y: n0.y + yTop, z: n0.z + n0.rz * hw + n0.tz * off };
            const p3 = { x: n0.x - n0.rx * hw + n0.tx * off, y: n0.y + yTop, z: n0.z - n0.rz * hw + n0.tz * off };
            if (faceSign < 0) {
              mb.addFlatQuad(p0, p1, p2, p3, rgb, MAT_GLOSSY, em);
            } else {
              mb.addFlatQuad(p1, p0, p3, p2, rgb, MAT_GLOSSY, em);
            }
          };
          // Deep vermilion carved border frame (0.35m proud of azure beam)
          emitPlaqueQuad(frameW, 8.2, 11.8, frameOff, [156, 36, 28], 0);
          // Raised glowing liquid-gold central tablet (0.27m proud of vermilion border!)
          emitPlaqueQuad(innerW, 8.65, 11.35, goldOff, [252, 212, 88], 1);
        }
        // Double-Tiered Sweeping Upturned Golden Pavilion Roofs (`飞檐`)!
        const roofTiers: ReadonlyArray<[number, number, number, number]> = [
          [gateSpan + 3.4, 12.1, 14.3, 3.6],
          [gateSpan * 0.66, 14.6, 17.6, 2.8],
        ];
        for (const [halfSpan, yBot, yTop, halfD] of roofTiers) {
          const eL = { x: n0.x - n0.rx * halfSpan, z: n0.z - n0.rz * halfSpan };
          const eR = { x: n0.x + n0.rx * halfSpan, z: n0.z + n0.rz * halfSpan };
          const rL = { x: n0.x - n0.rx * (halfSpan * 0.72), z: n0.z - n0.rz * (halfSpan * 0.72) };
          const rR = { x: n0.x + n0.rx * (halfSpan * 0.72), z: n0.z + n0.rz * (halfSpan * 0.72) };
          const fDx = n0.tx * halfD;
          const fDz = n0.tz * halfD;
          // Front & rear sloping golden tiled eaves
          mb.addFlatQuad(
            { x: eL.x - fDx, y: n0.y + yBot, z: eL.z - fDz },
            { x: eR.x - fDx, y: n0.y + yBot, z: eR.z - fDz },
            { x: rR.x, y: n0.y + yTop, z: rR.z },
            { x: rL.x, y: n0.y + yTop, z: rL.z },
            [244, 196, 72],
            MAT_GLOSSY,
          );
          mb.addFlatQuad(
            { x: eR.x + fDx, y: n0.y + yBot, z: eR.z + fDz },
            { x: eL.x + fDx, y: n0.y + yBot, z: eL.z + fDz },
            { x: rL.x, y: n0.y + yTop, z: rL.z },
            { x: rR.x, y: n0.y + yTop, z: rR.z },
            [224, 172, 54],
            MAT_GLOSSY,
          );
          // Upturned corner eave tips
          for (const side of [-1, 1] as const) {
            const tipX = n0.x + n0.rx * side * (halfSpan + 1.4);
            const tipZ = n0.z + n0.rz * side * (halfSpan + 1.4);
            mb.addBox(tipX - 0.55, n0.y + yBot + 0.1, tipZ - 0.55, tipX + 0.55, n0.y + yBot + 1.15, tipZ + 0.55, [255, 224, 112], MAT_GLOSSY, 1);
          }
        }
      } else {
        const pennantColors: ReadonlyArray<[number, number, number]> = [
          [255, 92, 108],
          [255, 218, 68],
          [77, 216, 232],
          [184, 118, 242],
        ];
        for (let c = 0; c < cells; c += 1) {
          const f0 = -rw + (c / cells) * (rw * 2);
          const f1 = -rw + ((c + 1) / cells) * (rw * 2);
          const fm = (f0 + f1) * 0.5;
          // Overhead festive checkered banner
          mb.addFlatQuad(
            { x: n0.x + n0.rx * f0, y: n0.y + 7.2, z: n0.z + n0.rz * f0 },
            { x: n0.x + n0.rx * f1, y: n0.y + 7.2, z: n0.z + n0.rz * f1 },
            { x: n0.x + n0.rx * f1, y: n0.y + 9.2, z: n0.z + n0.rz * f1 },
            { x: n0.x + n0.rx * f0, y: n0.y + 9.2, z: n0.z + n0.rz * f0 },
            c % 2 === 0 ? [255, 224, 72] : [255, 92, 108],
            MAT_GLOSSY,
            1,
          );
          // Hanging triangular carnival pennant flags underneath the banner!
          const pRgb = pennantColors[c % pennantColors.length]!;
          const pL = { x: n0.x + n0.rx * (f0 + 0.25), y: n0.y + 7.15, z: n0.z + n0.rz * (f0 + 0.25) };
          const pR = { x: n0.x + n0.rx * (f1 - 0.25), y: n0.y + 7.15, z: n0.z + n0.rz * (f1 - 0.25) };
          const pTip = { x: n0.x + n0.rx * fm, y: n0.y + 5.75, z: n0.z + n0.rz * fm };
          mb.addFlatTri(pL, pR, pTip, pRgb, MAT_GLOSSY, 1);
          mb.addFlatTri(pR, pL, pTip, pRgb, MAT_GLOSSY, 1);
        }
        for (const side of [-1, 1] as const) {
          const px = n0.x + n0.rx * side * (rw + 1.0);
          const pz = n0.z + n0.rz * side * (rw + 1.0);
          // Candy-striped archway pillars + glowing golden Starlight stars on top!
          mb.addBox(px - 0.72, n0.y, pz - 0.72, px + 0.72, n0.y + 4.8, pz + 0.72, [255, 252, 245], MAT_GLOSSY);
          mb.addBox(px - 0.76, n0.y + 4.8, pz - 0.76, px + 0.76, n0.y + 9.4, pz + 0.76, [255, 92, 108], MAT_GLOSSY);
          emitStarCrystal(mb, px, n0.y + 10.6, pz, 1.15, [255, 224, 72], 1);
        }
      }
    }
  }

  // Playful low-poly world scenery baked right into the static circuit VBO!
  for (let i = 0; i < circuit.scenery.length; i += 1) {
    emitSceneryPropIntoBuilder(mb, circuit.scenery[i]!, i);
  }

  return mb;
}

function emitGoldenPavilion(
  mb: MeshBuilder,
  x: number,
  y: number,
  z: number,
  s: number,
): void {
  // White-jade terrace plinth
  mb.addBox(x - 4.2 * s, y, z - 4.2 * s, x + 4.2 * s, y + 1.4 * s, z + 4.2 * s, [242, 239, 230], MAT_MATTE);
  // 4 Vermilion palace pillars
  const po = 2.9 * s;
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      mb.addBox(
        x + sx * po - 0.34 * s,
        y + 1.4 * s,
        z + sz * po - 0.34 * s,
        x + sx * po + 0.34 * s,
        y + 5.8 * s,
        z + sz * po + 0.34 * s,
        [188, 52, 42],
        MAT_GLOSSY,
      );
    }
  }
  // Inner warm glowing sanctuary core
  mb.addBox(x - 1.8 * s, y + 1.6 * s, z - 1.8 * s, x + 1.8 * s, y + 5.2 * s, z + 1.8 * s, [255, 220, 134], MAT_GLOSSY, 1);

  // Double-tiered upturned liquid-gold pyramid roofs (`wm_laojun.jpg`)
  const emitPyramidRoof = (yBase: number, halfW: number, height: number) => {
    const apex = { x, y: yBase + height, z };
    const p0 = { x: x - halfW, y: yBase, z: z - halfW };
    const p1 = { x: x + halfW, y: yBase, z: z - halfW };
    const p2 = { x: x + halfW, y: yBase, z: z + halfW };
    const p3 = { x: x - halfW, y: yBase, z: z + halfW };
    mb.addFlatTri(p0, p1, apex, [244, 198, 76], MAT_GLOSSY);
    mb.addFlatTri(p1, p2, apex, [226, 174, 56], MAT_GLOSSY);
    mb.addFlatTri(p2, p3, apex, [244, 198, 76], MAT_GLOSSY);
    mb.addFlatTri(p3, p0, apex, [226, 174, 56], MAT_GLOSSY);
  };
  emitPyramidRoof(y + 5.6 * s, 5.2 * s, 2.4 * s);
  emitPyramidRoof(y + 7.7 * s, 3.6 * s, 2.5 * s);
  emitStarCrystal(mb, x, y + 10.6 * s, z, 0.55 * s, [255, 228, 112], 1);
}

function emitSceneryPropIntoBuilder(mb: MeshBuilder, prop: SceneryProp, index: number): void {
  const s = prop.scale;
  const { x, y, z } = prop;

  if (prop.kind === 'pavilion') {
    // Floating immortal spire islet beneath the golden-eaved mini-pavilion
    emitSmoothSpineTube(
      mb,
      [
        { x, y: y - 13 * s, z, rx: 0.4 * s, ry: 0.4 * s, rgb: [122, 136, 152] },
        { x, y: y - 5.5 * s, z, rx: 3.4 * s, ry: 3.4 * s, rgb: [164, 174, 184] },
        { x, y: y + 0.1 * s, z, rx: 5.4 * s, ry: 5.4 * s, rgb: [222, 220, 212] },
      ],
      6,
      MAT_MATTE,
    );
    emitGoldenPavilion(mb, x, y, z, s);
    return;
  }

  if (prop.kind === 'jade-pillar') {
    // White-jade cloud column crowned with a warm glowing vermilion-gold palace lantern (`wm_paifang.jpg`)
    mb.addBox(x - 0.55 * s, y, z - 0.55 * s, x + 0.55 * s, y + 0.85 * s, z + 0.55 * s, [238, 235, 226], MAT_MATTE);
    mb.addBox(x - 0.34 * s, y + 0.85 * s, z - 0.34 * s, x + 0.34 * s, y + 4.4 * s, z + 0.34 * s, [246, 243, 236], MAT_MATTE);
    mb.addBox(x - 0.54 * s, y + 4.4 * s, z - 0.54 * s, x + 0.54 * s, y + 5.45 * s, z + 0.54 * s, [248, 174, 72], MAT_GLOSSY, 1);
    mb.addBox(x - 0.72 * s, y + 5.45 * s, z - 0.72 * s, x + 0.72 * s, y + 5.82 * s, z + 0.72 * s, [196, 56, 44], MAT_GLOSSY);
    return;
  }

  if (prop.kind === 'bonsai-pine') {
    // Gnarled Huangshan / Xianxia bonsai celestial pine on a floating rock spur (`cn1.jpg`, `cn4.jpg`)
    emitSmoothEllipsoid(mb, x, y - 1.4 * s, z, 3.2 * s, 1.9 * s, 2.8 * s, 7, 5, () => [156, 166, 176], MAT_MATTE);
    const lean = index % 2 === 0 ? 1 : -1;
    emitSmoothSpineTube(
      mb,
      [
        { x, y: y - 0.2 * s, z, rx: 0.58 * s, ry: 0.58 * s, rgb: [86, 66, 52] },
        { x: x + lean * 1.4 * s, y: y + 2.6 * s, z: z + 0.5 * s, rx: 0.44 * s, ry: 0.44 * s, rgb: [98, 76, 58] },
        { x: x + lean * 2.8 * s, y: y + 4.4 * s, z: z - 0.3 * s, rx: 0.28 * s, ry: 0.28 * s, rgb: [98, 76, 58] },
      ],
      6,
      MAT_MATTE,
    );
    // Layered flat celadon-emerald pine needle pads
    emitSmoothEllipsoid(mb, x + lean * 2.9 * s, y + 4.8 * s, z - 0.3 * s, 3.1 * s, 0.85 * s, 2.4 * s, 8, 5, () => [62, 118, 92], MAT_PLUSH);
    emitSmoothEllipsoid(mb, x + lean * 1.0 * s, y + 3.4 * s, z + 1.2 * s, 2.2 * s, 0.7 * s, 1.9 * s, 7, 5, () => [78, 138, 106], MAT_PLUSH);
    emitSmoothEllipsoid(mb, x + lean * 3.8 * s, y + 5.7 * s, z - 0.6 * s, 1.8 * s, 0.62 * s, 1.5 * s, 7, 5, () => [96, 158, 122], MAT_PLUSH);
    return;
  }

  if (prop.kind === 'lotus') {
    // Oversized Sculpted Glowing Glass Lotus Blossom (`琉璃莲花`, `wm_lotus.jpg`) clearly visible from driver eye height!
    emitSmoothEllipsoid(mb, x, y + 0.12, z, 3.1 * s, 0.18 * s, 3.1 * s, 9, 4, () => [32, 134, 92], MAT_MATTE);
    // 6 sculpted angled outer rose-pink glass petals fanning open around the pad
    const petalCount = 6;
    for (let k = 0; k < petalCount; k += 1) {
      const a0 = prop.yaw + (k / petalCount) * Math.PI * 2;
      const aL = a0 - 0.34;
      const aR = a0 + 0.34;
      const baseP = { x: x + Math.cos(a0) * 0.45 * s, y: y + 0.35 * s, z: z + Math.sin(a0) * 0.45 * s };
      const midL = { x: x + Math.cos(aL) * 1.45 * s, y: y + 1.05 * s, z: z + Math.sin(aL) * 1.45 * s };
      const midR = { x: x + Math.cos(aR) * 1.45 * s, y: y + 1.05 * s, z: z + Math.sin(aR) * 1.45 * s };
      const tip = { x: x + Math.cos(a0) * 2.15 * s, y: y + 1.65 * s, z: z + Math.sin(a0) * 2.15 * s };
      mb.addFlatQuad(baseP, midL, tip, midR, [255, 136, 188], MAT_GLOSSY, 1);
      mb.addFlatQuad(baseP, midR, tip, midL, [255, 168, 206], MAT_GLOSSY, 1);
    }
    // Upright glowing blush-white inner crown petals + radiant golden lotus heart!
    emitSmoothEllipsoid(mb, x, y + 1.25 * s, z, 1.15 * s, 0.95 * s, 1.15 * s, 7, 5, () => [255, 224, 238], MAT_GLOSSY, 1);
    emitSmoothEllipsoid(mb, x, y + 1.85 * s, z, 0.62 * s, 0.52 * s, 0.62 * s, 6, 4, () => [255, 236, 112], MAT_GLOSSY, 1);
    return;
  }

  if (prop.kind === 'cloud-bank') {
    // Sculpted sunlit 3D cloud-sea cluster drifting beneath the floating sky viaduct (`cn2.jpg`, `cn3.jpg`)
    const cloudColor = (_th: number, phi: number): readonly [number, number, number] =>
      phi > -0.1 ? [252, 249, 242] : [196, 214, 230];
    emitSmoothEllipsoid(mb, x, y, z, 9.5 * s, 3.1 * s, 7.6 * s, 8, 5, cloudColor, MAT_PLUSH);
    emitSmoothEllipsoid(mb, x + 5.8 * s, y - 0.6 * s, z + 2.4 * s, 6.8 * s, 2.4 * s, 5.8 * s, 7, 4, cloudColor, MAT_PLUSH);
    emitSmoothEllipsoid(mb, x - 5.4 * s, y - 0.4 * s, z - 2.6 * s, 7.2 * s, 2.6 * s, 6.2 * s, 7, 4, cloudColor, MAT_PLUSH);
    return;
  }

  if (prop.kind === 'pine') {
    // Sunset Loop: Cheerful puffy rounded storybook trees + floating striped hot-air balloons!
    if (index % 7 === 2) {
      const by = y + 18 + (index % 3) * 5;
      const balloonA: [number, number, number] = index % 2 === 0 ? [255, 86, 102] : [77, 208, 225];
      const balloonB: [number, number, number] = [255, 232, 92];
      emitSmoothEllipsoid(
        mb,
        x,
        by,
        z,
        3.6 * s,
        4.4 * s,
        3.6 * s,
        10,
        6,
        (th) => (Math.floor((th / (Math.PI * 2)) * 8) % 2 === 0 ? balloonA : balloonB),
        MAT_PLUSH,
      );
      mb.addBox(x - 0.9 * s, by - 6.0 * s, z - 0.9 * s, x + 0.9 * s, by - 4.7 * s, z + 0.9 * s, [186, 128, 72], MAT_MATTE);
      return;
    }
    // Rounded storybook park tree (warm trunk + 2 bouncy emerald/lime cloud puffs!)
    emitSmoothSpineTube(
      mb,
      [
        { x, y, z, rx: 0.62 * s, ry: 0.62 * s, rgb: [138, 92, 54] },
        { x, y: y + 3.2 * s, z, rx: 0.48 * s, ry: 0.48 * s, rgb: [138, 92, 54] },
      ],
      7,
      MAT_MATTE,
    );
    emitSmoothEllipsoid(mb, x, y + 4.8 * s, z, 2.75 * s, 2.35 * s, 2.75 * s, 9, 6, () => [54, 174, 88], MAT_PLUSH);
    emitSmoothEllipsoid(mb, x, y + 7.2 * s, z, 1.95 * s, 1.75 * s, 1.95 * s, 9, 6, () => [102, 208, 98], MAT_PLUSH);
    return;
  }

  if (prop.kind === 'spire') {
    // Canyon Crest: Alternating cartoon saguaro cacti & flat-top layered toy mesas!
    if (index % 2 === 0) {
      const cactusGreen: [number, number, number] = [66, 178, 96];
      emitSmoothSpineTube(
        mb,
        [
          { x, y, z, rx: 0.78 * s, ry: 0.78 * s, rgb: cactusGreen },
          { x, y: y + 6.4 * s, z, rx: 0.72 * s, ry: 0.72 * s, rgb: cactusGreen },
          { x, y: y + 7.1 * s, z, rx: 0.22 * s, ry: 0.22 * s, rgb: [98, 206, 118] },
        ],
        7,
        MAT_PLUSH,
      );
      // Left & right cartoon cactus arms!
      mb.addBox(x - 2.0 * s, y + 2.8 * s, z - 0.45 * s, x - 0.6 * s, y + 3.7 * s, z + 0.45 * s, cactusGreen, MAT_PLUSH);
      mb.addBox(x - 2.0 * s, y + 2.8 * s, z - 0.45 * s, x - 1.15 * s, y + 5.2 * s, z + 0.45 * s, cactusGreen, MAT_PLUSH);
      mb.addBox(x + 0.6 * s, y + 3.6 * s, z - 0.45 * s, x + 2.0 * s, y + 4.5 * s, z + 0.45 * s, cactusGreen, MAT_PLUSH);
      mb.addBox(x + 1.15 * s, y + 3.6 * s, z - 0.45 * s, x + 2.0 * s, y + 5.8 * s, z + 0.45 * s, cactusGreen, MAT_PLUSH);
      // Tiny sunny desert flower on top!
      emitStarCrystal(mb, x, y + 7.45 * s, z, 0.42 * s, [255, 220, 76], 1);
      return;
    }
    // Layered flat-top terracotta toy mesa
    emitSmoothSpineTube(
      mb,
      [
        { x, y, z, rx: 3.4 * s, ry: 3.4 * s, rgb: [212, 112, 64] },
        { x, y: y + 4.6 * s, z, rx: 2.6 * s, ry: 2.6 * s, rgb: [232, 144, 82] },
        { x, y: y + 8.6 * s, z, rx: 2.2 * s, ry: 2.2 * s, rgb: [242, 168, 98] },
        { x, y: y + 8.7 * s, z, rx: 0.1 * s, ry: 0.1 * s, rgb: [242, 168, 98] },
      ],
      7,
      MAT_MATTE,
    );
    return;
  }

  // Starlight Ring: Luminous Starlight Burst Floating Golden Stars & Cosmic Pastel Pillars!
  const w = 0.72 * s;
  const h = 7.2 * s;
  const ringCol: [number, number, number] = index % 2 === 0 ? [56, 232, 255] : [206, 134, 255];
  mb.addBox(x - w, y, z - w, x + w, y + h, z + w, [68, 86, 162], MAT_GLOSSY);
  mb.addBox(x - w * 1.18, y + h * 0.65, z - w * 1.18, x + w * 1.18, y + h * 0.85, z + w * 1.18, ringCol, MAT_GLOSSY, 1);
  emitStarCrystal(mb, x, y + h + 1.8 * s, z, 1.35 * s, [255, 224, 76], 1);
}

interface StaticGpuMesh {
  vbo: WebGLBuffer;
  count: number;
}

interface DriverGpuRig {
  chassis: StaticGpuMesh;
  torso: StaticGpuMesh;
  head: StaticGpuMesh;
  leftEar: StaticGpuMesh;
  rightEar: StaticGpuMesh;
  leftEarAnchor: readonly [number, number, number];
  rightEarAnchor: readonly [number, number, number];
  tail: StaticGpuMesh;
  scarf: StaticGpuMesh;
}

const WORLD_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNorm;
layout(location = 2) in vec3 aColor;
layout(location = 3) in vec2 aFlags;

uniform vec3 uModelPos;
uniform mat3 uModelBasis;
uniform vec3 uModelScale;

uniform vec3 uCamPos;
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform vec3 uCamF;
uniform vec2 uProjScale;
uniform float uCenterYBias;

out vec3 vWorldPos;
out vec3 vNorm;
out vec3 vColor;
out vec2 vFlags;
out float vDepth;

void main() {
  vec3 worldPos = uModelPos + uModelBasis * (aPos * uModelScale);
  vec3 worldNorm = normalize(uModelBasis * aNorm);
  vec3 rel = worldPos - uCamPos;

  float vx = dot(rel, uCamR);
  float vy = dot(rel, uCamU);
  float vz = dot(rel, uCamF);

  vWorldPos = worldPos;
  vNorm = worldNorm;
  vColor = aColor;
  vFlags = aFlags;
  vDepth = vz;

  float near = 1.05;
  float far = 340.0;
  float clipX = vx * uProjScale.x;
  float clipY = vy * uProjScale.y + uCenterYBias * vz;
  float clipZ = ((far + near) / (far - near)) * vz - ((2.0 * far * near) / (far - near));
  gl_Position = vec4(clipX, clipY, clipZ, vz);
}
`;

const WORLD_FS = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vNorm;
in vec3 vColor;
in vec2 vFlags;
in float vDepth;

uniform vec3 uCamPos;
uniform vec3 uSun;
uniform vec3 uFogColor;
uniform vec3 uTint;
uniform vec4 uClipPlane;
uniform float uUseClipPlane;

out vec4 outColor;

void main() {
  if (uUseClipPlane > 0.5 && dot(vWorldPos, uClipPlane.xyz) < uClipPlane.w) {
    discard;
  }
  vec3 base = vColor * uTint;
  vec3 lit;

  if (vFlags.y > 0.5) {
    lit = base * 1.06;
  } else {
    vec3 N = normalize(vNorm);
    vec3 V = normalize(uCamPos - vWorldPos);
    if (vFlags.x < 0.5 && dot(N, V) < 0.0) {
      N = -N;
    }
    if (vFlags.x > 1.5 && N.y < 0.0 && abs(N.y) > 0.6) {
      N = -N;
    }

    float ndl = dot(N, uSun);
    float wrap = max(0.0, 0.56 * ndl + 0.44);
    float diff = 0.58 + wrap * 0.52;

    float isPlush = step(0.5, vFlags.x) * (1.0 - step(1.5, vFlags.x));
    float isGlossy = 1.0 - step(0.5, vFlags.x);

    vec3 H = normalize(uSun + V);
    float spec = isGlossy * pow(max(dot(N, H), 0.0), 34.0) * 0.30
               + isPlush * pow(max(dot(N, H), 0.0), 14.0) * 0.11;
    float fresnel = isPlush * pow(1.0 - max(dot(N, V), 0.0), 2.4) * 0.26;

    lit = base * diff + vec3(1.0, 0.97, 0.92) * (spec + fresnel);
  }

  float fogT = clamp((vDepth - 108.0) / (330.0 - 108.0), 0.0, 0.78);
  vec3 finalRgb = mix(clamp(lit, 0.0, 1.0), uFogColor, fogT);
  outColor = vec4(finalRgb, 1.0);
}
`;

const SHADOW_FLOATS_PER_VERT = 7; // pos(3) + rgba(4)

const SHADOW_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aColor;

uniform vec3 uCamPos;
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform vec3 uCamF;
uniform vec2 uProjScale;
uniform float uCenterYBias;

out vec4 vColor;

void main() {
  vec3 rel = aPos - uCamPos;
  float vx = dot(rel, uCamR);
  float vy = dot(rel, uCamU);
  float vz = dot(rel, uCamF);

  vColor = aColor;
  float near = 1.05;
  float far = 340.0;
  float clipX = vx * uProjScale.x;
  float clipY = vy * uProjScale.y + uCenterYBias * vz;
  float clipZ = ((far + near) / (far - near)) * vz - ((2.0 * far * near) / (far - near));
  gl_Position = vec4(clipX, clipY, clipZ, vz);
}
`;

const SHADOW_FS = `#version 300 es
precision highp float;

in vec4 vColor;
out vec4 outColor;

void main() {
  outColor = vColor;
}
`;

const SKY_VS = `#version 300 es
layout(location = 0) in vec2 aQuad;
out vec2 vUv;
void main() {
  vUv = aQuad * 0.5 + 0.5;
  gl_Position = vec4(aQuad, 0.99999, 1.0);
}
`;

const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uGround;
uniform vec3 uMountain;
uniform float uHorizonUvY;
uniform float uYawPhase;
uniform float uIsStarry;
out vec4 outColor;

void main() {
  if (uIsStarry > 1.5) {
    // Cloud Gate: Infinite Rolling Sea of Clouds below horizon +
    // Atmospheric Huangshan Spires + Golden Tyndall Sunbeams
    if (vUv.y < uHorizonUvY) {
      float d = clamp((uHorizonUvY - vUv.y) / max(0.05, uHorizonUvY), 0.0, 1.0);
      float sx = vUv.x * 8.0 + uYawPhase * 0.36;
      float wave1 = sin(sx * 1.4 + d * 7.5) * 0.5 + 0.5;
      float wave2 = cos(sx * 2.9 - d * 12.0 + 1.3) * 0.5 + 0.5;
      float billow = smoothstep(0.22, 0.82, wave1 * 0.62 + wave2 * 0.38);
      vec3 cloudShadow = vec3(0.66, 0.78, 0.89);
      vec3 cloudCrest = vec3(0.99, 0.97, 0.93);
      vec3 seaCol = mix(cloudShadow, cloudCrest, billow);
      // Warm golden mist melt right at the distant horizon
      vec3 horizonMist = mix(uSkyHorizon, vec3(0.98, 0.95, 0.89), 0.55);
      seaCol = mix(horizonMist, seaCol, smoothstep(0.0, 0.38, d));
      outColor = vec4(seaCol, 1.0);
      return;
    }

    float t = clamp((vUv.y - uHorizonUvY) / max(0.05, 1.0 - uHorizonUvY), 0.0, 1.0);
    vec3 sky = mix(uSkyHorizon, uSkyTop, pow(t, 0.72));

    // Morning Celestial Sun + soft diagonal golden Tyndall sunbeams
    float sunX = fract(0.72 - uYawPhase * 0.0416667);
    float sunDist = length(vec2((vUv.x - sunX) * 1.6, t - 0.56));
    sky += vec3(1.0, 0.92, 0.72) * (exp(-sunDist * 6.5) * 0.52);
    float rayPhase = (vUv.x * 11.0 + uYawPhase * 0.45) - t * 3.8;
    float rayMask = pow(max(0.0, sin(rayPhase) * 0.5 + 0.5), 4.0) * (1.0 - t * 0.75);
    sky += vec3(1.0, 0.93, 0.76) * rayMask * 0.13;

    // Soft high-altitude auspicious cloud wisps
    float cx = fract(vUv.x * 2.5 + uYawPhase * 0.105) - 0.5;
    float cy = t - 0.62;
    float wisp = exp(-((cx * cx) * 14.0 + (cy * cy) * 68.0));
    sky = mix(sky, vec3(1.0, 0.98, 0.93), wisp * 0.45);

    // Atmospheric Huangshan / Zhangjiajie immortal spire silhouettes poking out of the cloud sea
    float pxFar = vUv.x * 16.0 + uYawPhase * 0.72;
    float pFarA = pow(max(0.0, 1.0 - abs(fract(pxFar * 0.31) * 2.0 - 1.0)), 1.7);
    float pFarB = pow(max(0.0, 1.0 - abs(fract(pxFar * 0.53 + 0.37) * 2.0 - 1.0)), 2.2);
    float farSpire = (pFarA * 0.58 + pFarB * 0.42) * 0.145;
    if (vUv.y < uHorizonUvY + farSpire) {
      float mGrad = clamp((vUv.y - uHorizonUvY) / max(0.01, farSpire), 0.0, 1.0);
      vec3 farCol = mix(vec3(0.94, 0.92, 0.87), uMountain * 1.12, pow(mGrad, 0.75) * 0.8);
      sky = mix(sky, farCol, 0.88);
    }
    float pxNear = vUv.x * 11.5 + uYawPhase * 0.52 + 1.8;
    float pNearA = pow(max(0.0, 1.0 - abs(fract(pxNear * 0.41) * 2.0 - 1.0)), 2.1);
    float pNearB = pow(max(0.0, 1.0 - abs(fract(pxNear * 0.79 + 0.21) * 2.0 - 1.0)), 2.8);
    float nearSpire = (pNearA * 0.62 + pNearB * 0.38) * 0.095;
    if (vUv.y < uHorizonUvY + nearSpire) {
      float nGrad = clamp((vUv.y - uHorizonUvY) / max(0.01, nearSpire), 0.0, 1.0);
      vec3 nearCol = mix(vec3(0.96, 0.94, 0.89), uMountain * 0.82, pow(nGrad, 0.7) * 0.88);
      sky = mix(sky, nearCol, 0.94);
    }

    outColor = vec4(sky, 1.0);
    return;
  }

  if (vUv.y < uHorizonUvY) {
    outColor = vec4(uGround, 1.0);
    return;
  }
  // Smooth cheerful rolling storybook hills along the horizon
  float xPhase = vUv.x * 16.0 + uYawPhase * 0.67;
  float ridgeH = (0.5 + 0.35 * sin(xPhase * 1.15) + 0.22 * cos(xPhase * 2.1 + 0.8)) * 0.072;
  if (vUv.y < uHorizonUvY + ridgeH) {
    outColor = vec4(uMountain, 1.0);
    return;
  }
  float t = clamp((vUv.y - uHorizonUvY) / max(0.05, 1.0 - uHorizonUvY), 0.0, 1.0);
  vec3 sky = mix(uSkyHorizon, uSkyTop, pow(t, 0.78));

  if (uIsStarry > 0.5) {
    // Twinkling procedural stars for Starlight Ring!
    vec2 cell = floor(vec2((vUv.x + uYawPhase * 0.04) * 44.0, vUv.y * 24.0));
    vec2 f = fract(vec2((vUv.x + uYawPhase * 0.04) * 44.0, vUv.y * 24.0)) - 0.5;
    float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
    if (h > 0.86 && length(f) < 0.14) {
      sky = mix(sky, vec3(1.0, 0.96, 0.78), 0.9);
    }
  } else {
    // Crisp, cheerful flat-bottomed puffy storybook cumulus clouds!
    float cx = fract(vUv.x * 3.0 + uYawPhase * 0.125) - 0.5;
    float cy = t - 0.48;
    float p1 = length(vec2((cx + 0.13) * 2.7, (cy - 0.01) * 4.8));
    float p2 = length(vec2(cx * 2.5, (cy - 0.055) * 4.4));
    float p3 = length(vec2((cx - 0.14) * 2.8, (cy - 0.005) * 4.9));
    float cloudMask = (1.0 - smoothstep(0.30, 0.36, min(p1, min(p2, p3)))) * smoothstep(-0.075, -0.03, cy);
    sky = mix(sky, vec3(1.0, 0.99, 0.97), cloudMask * 0.86);
  }

  outColor = vec4(sky, 1.0);
}
`;

const IDENTITY_BASIS = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

function eulerToBasis3(out: Float32Array, yaw: number, pitch: number, roll: number): Float32Array {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  out[0] = cr * cy + sr * sp * sy;
  out[1] = sr * cp;
  out[2] = -cr * sy + sr * sp * cy;

  out[3] = -sr * cy + cr * sp * sy;
  out[4] = cr * cp;
  out[5] = sr * sy + cr * sp * cy;

  out[6] = cp * sy;
  out[7] = -sp;
  out[8] = cp * cy;
  return out;
}

function mulBasis3(out: Float32Array, a: Float32Array, b: Float32Array): Float32Array {
  for (let col = 0; col < 3; col += 1) {
    const bx = b[col * 3]!;
    const by = b[col * 3 + 1]!;
    const bz = b[col * 3 + 2]!;
    out[col * 3] = a[0]! * bx + a[3]! * by + a[6]! * bz;
    out[col * 3 + 1] = a[1]! * bx + a[4]! * by + a[7]! * bz;
    out[col * 3 + 2] = a[2]! * bx + a[5]! * by + a[8]! * bz;
  }
  return out;
}

function transformOffsetByBasis(
  basis: Float32Array,
  lx: number,
  ly: number,
  lz: number,
): Vec3Mut {
  return {
    x: basis[0]! * lx + basis[3]! * ly + basis[6]! * lz,
    y: basis[1]! * lx + basis[4]! * ly + basis[7]! * lz,
    z: basis[2]! * lx + basis[5]! * ly + basis[8]! * lz,
  };
}

export class MicroKartWebGL2Renderer {
  private gl: WebGL2RenderingContext | null = null;
  private worldProg: WebGLProgram | null = null;
  private skyProg: WebGLProgram | null = null;
  private shadowProg: WebGLProgram | null = null;
  private worldVao: WebGLVertexArrayObject | null = null;
  private skyVao: WebGLVertexArrayObject | null = null;
  private dynamicVao: WebGLVertexArrayObject | null = null;
  private shadowVao: WebGLVertexArrayObject | null = null;
  private dynamicVbo: WebGLBuffer | null = null;
  private shadowVbo: WebGLBuffer | null = null;
  private skyVbo: WebGLBuffer | null = null;

  private circuitMeshes = new Map<string, StaticGpuMesh>();
  private driverRigs = new Map<DriverCharacterId, DriverGpuRig>();
  private flameMesh: StaticGpuMesh | null = null;
  private unitBoxMesh: StaticGpuMesh | null = null;
  private contextLost = false;

  private readonly kartBasis = new Float32Array(9);
  private readonly localBasis = new Float32Array(9);
  private readonly worldPartBasis = new Float32Array(9);
  private readonly headWorldBasis = new Float32Array(9);
  private readonly dynamicScratch = new Float32Array(4096 * FLOATS_PER_VERT);
  private readonly shadowScratch = new Float32Array(512 * SHADOW_FLOATS_PER_VERT);

  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private skyUniforms: Record<string, WebGLUniformLocation | null> = {};
  private shadowUniforms: Record<string, WebGLUniformLocation | null> = {};

  private readonly sunDir = (() => {
    const l = Math.hypot(0.42, 0.82, -0.38);
    return [0.42 / l, 0.82 / l, -0.38 / l] as const;
  })();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onUnrecoverableFallback?: () => void,
  ) {
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    if (!this.initContext()) {
      this.onUnrecoverableFallback?.();
    }
  }

  get isReady(): boolean {
    return this.gl !== null && !this.contextLost;
  }

  private handleContextLost = (ev: Event): void => {
    ev.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.circuitMeshes.clear();
    this.driverRigs.clear();
    this.flameMesh = null;
    this.unitBoxMesh = null;
    if (!this.initContext()) {
      this.onUnrecoverableFallback?.();
    }
  };

  private compileProgram(
    gl: WebGL2RenderingContext,
    vsSrc: string,
    fsSrc: string,
  ): WebGLProgram | null {
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  private uploadStaticMesh(gl: WebGL2RenderingContext, mb: MeshBuilder): StaticGpuMesh {
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mb.data), gl.STATIC_DRAW);
    return { vbo, count: mb.vertexCount };
  }

  private bindWorldAttribs(gl: WebGL2RenderingContext): void {
    const stride = FLOATS_PER_VERT * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 36);
  }

  private initContext(): boolean {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = this.canvas.getContext('webgl2', {
        alpha: false,
        antialias: true,
        depth: true,
        stencil: true,
        powerPreference: 'default',
      });
    } catch {
      return false;
    }
    if (!gl) return false;

    const worldProg = this.compileProgram(gl, WORLD_VS, WORLD_FS);
    const skyProg = this.compileProgram(gl, SKY_VS, SKY_FS);
    const shadowProg = this.compileProgram(gl, SHADOW_VS, SHADOW_FS);
    if (!worldProg || !skyProg || !shadowProg) return false;

    this.gl = gl;
    this.worldProg = worldProg;
    this.skyProg = skyProg;
    this.shadowProg = shadowProg;

    this.uniforms = {
      uModelPos: gl.getUniformLocation(worldProg, 'uModelPos'),
      uModelBasis: gl.getUniformLocation(worldProg, 'uModelBasis'),
      uModelScale: gl.getUniformLocation(worldProg, 'uModelScale'),
      uCamPos: gl.getUniformLocation(worldProg, 'uCamPos'),
      uCamR: gl.getUniformLocation(worldProg, 'uCamR'),
      uCamU: gl.getUniformLocation(worldProg, 'uCamU'),
      uCamF: gl.getUniformLocation(worldProg, 'uCamF'),
      uProjScale: gl.getUniformLocation(worldProg, 'uProjScale'),
      uCenterYBias: gl.getUniformLocation(worldProg, 'uCenterYBias'),
      uSun: gl.getUniformLocation(worldProg, 'uSun'),
      uFogColor: gl.getUniformLocation(worldProg, 'uFogColor'),
      uTint: gl.getUniformLocation(worldProg, 'uTint'),
      uClipPlane: gl.getUniformLocation(worldProg, 'uClipPlane'),
      uUseClipPlane: gl.getUniformLocation(worldProg, 'uUseClipPlane'),
    };
    this.skyUniforms = {
      uSkyTop: gl.getUniformLocation(skyProg, 'uSkyTop'),
      uSkyHorizon: gl.getUniformLocation(skyProg, 'uSkyHorizon'),
      uGround: gl.getUniformLocation(skyProg, 'uGround'),
      uMountain: gl.getUniformLocation(skyProg, 'uMountain'),
      uHorizonUvY: gl.getUniformLocation(skyProg, 'uHorizonUvY'),
      uYawPhase: gl.getUniformLocation(skyProg, 'uYawPhase'),
      uIsStarry: gl.getUniformLocation(skyProg, 'uIsStarry'),
    };
    this.shadowUniforms = {
      uCamPos: gl.getUniformLocation(shadowProg, 'uCamPos'),
      uCamR: gl.getUniformLocation(shadowProg, 'uCamR'),
      uCamU: gl.getUniformLocation(shadowProg, 'uCamU'),
      uCamF: gl.getUniformLocation(shadowProg, 'uCamF'),
      uProjScale: gl.getUniformLocation(shadowProg, 'uProjScale'),
      uCenterYBias: gl.getUniformLocation(shadowProg, 'uCenterYBias'),
    };

    const skyVao = gl.createVertexArray()!;
    gl.bindVertexArray(skyVao);
    const skyVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, skyVbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.skyVao = skyVao;
    this.skyVbo = skyVbo;

    this.worldVao = gl.createVertexArray()!;

    const dynVao = gl.createVertexArray()!;
    gl.bindVertexArray(dynVao);
    const dynVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, dynVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.dynamicScratch.byteLength, gl.DYNAMIC_DRAW);
    this.bindWorldAttribs(gl);
    this.dynamicVao = dynVao;
    this.dynamicVbo = dynVbo;

    const shVao = gl.createVertexArray()!;
    gl.bindVertexArray(shVao);
    const shVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, shVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.shadowScratch.byteLength, gl.DYNAMIC_DRAW);
    const shStride = SHADOW_FLOATS_PER_VERT * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, shStride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, shStride, 3 * 4);
    this.shadowVao = shVao;
    this.shadowVbo = shVbo;
    gl.bindVertexArray(null);

    for (const drv of KART_DRIVERS) {
      const ears = buildDriverEarMeshes(drv.id);
      this.driverRigs.set(drv.id, {
        chassis: this.uploadStaticMesh(gl, buildKartChassisMesh(drv)),
        torso: this.uploadStaticMesh(gl, buildDriverTorsoMesh(drv)),
        head: this.uploadStaticMesh(gl, buildDriverHeadMesh(drv.id)),
        leftEar: this.uploadStaticMesh(gl, ears.left),
        rightEar: this.uploadStaticMesh(gl, ears.right),
        leftEarAnchor: ears.leftAnchor,
        rightEarAnchor: ears.rightAnchor,
        tail: this.uploadStaticMesh(gl, buildDriverTailMesh(drv.id)),
        scarf: this.uploadStaticMesh(gl, buildScarfTailMesh(drv)),
      });
    }
    this.flameMesh = this.uploadStaticMesh(gl, buildFlameConeMesh());
    this.unitBoxMesh = this.uploadStaticMesh(gl, buildBrakeBarMesh());

    return true;
  }

  private getOrBakeCircuitMesh(
    gl: WebGL2RenderingContext,
    circuitId: CircuitId,
    reversed: boolean,
  ): StaticGpuMesh {
    const key = `${circuitId}:${reversed ? 'rev' : 'fwd'}`;
    const cached = this.circuitMeshes.get(key);
    if (cached) return cached;
    const baked = this.uploadStaticMesh(gl, buildStaticCircuitMesh(getCircuit(circuitId, reversed)));
    this.circuitMeshes.set(key, baked);
    return baked;
  }

  private drawStaticMesh(
    gl: WebGL2RenderingContext,
    mesh: StaticGpuMesh,
    px: number,
    py: number,
    pz: number,
    basis: Float32Array,
    sx = 1,
    sy = 1,
    sz = 1,
    tr = 1,
    tg = 1,
    tb = 1,
  ): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    this.bindWorldAttribs(gl);
    gl.uniform3f(this.uniforms.uModelPos!, px, py, pz);
    gl.uniformMatrix3fv(this.uniforms.uModelBasis!, false, basis);
    gl.uniform3f(this.uniforms.uModelScale!, sx, sy, sz);
    gl.uniform3f(this.uniforms.uTint!, tr, tg, tb);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  private drawSkyBackdrop(
    gl: WebGL2RenderingContext,
    circuit: CircuitDefinition,
    camYaw: number,
    horizonUvY: number,
  ): void {
    gl.useProgram(this.skyProg);
    const skyTop = parseHexRgb(circuit.theme.skyTop);
    const skyHor = parseHexRgb(circuit.theme.skyHorizon);
    const gnd = parseHexRgb(circuit.theme.groundOuter);
    const mtn = parseHexRgb(circuit.theme.mountainHex);
    gl.uniform3f(this.skyUniforms.uSkyTop!, skyTop[0] / 255, skyTop[1] / 255, skyTop[2] / 255);
    gl.uniform3f(this.skyUniforms.uSkyHorizon!, skyHor[0] / 255, skyHor[1] / 255, skyHor[2] / 255);
    gl.uniform3f(this.skyUniforms.uGround!, gnd[0] / 255, gnd[1] / 255, gnd[2] / 255);
    gl.uniform3f(this.skyUniforms.uMountain!, mtn[0] / 255, mtn[1] / 255, mtn[2] / 255);
    gl.uniform1f(this.skyUniforms.uHorizonUvY!, horizonUvY);
    gl.uniform1f(this.skyUniforms.uYawPhase!, (camYaw / (Math.PI * 2)) * 24.0);
    gl.uniform1f(
      this.skyUniforms.uIsStarry!,
      circuit.theme.skyMode === 'cloud-sea'
        ? 2.0
        : circuit.theme.skyMode === 'starry'
          ? 1.0
          : 0.0,
    );
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private setupWorldCameraUniforms(
    gl: WebGL2RenderingContext,
    circuit: CircuitDefinition,
    camX: number,
    camY: number,
    camZ: number,
    camYaw: number,
    camPitch: number,
    focal: number,
    pxW: number,
    pxH: number,
    centerYBias: number,
  ): void {
    const cosY = Math.cos(camYaw);
    const sinY = Math.sin(camYaw);
    const cosP = Math.cos(camPitch);
    const sinP = Math.sin(camPitch);
    const fx = sinY * cosP;
    const fy = sinP;
    const fz = cosY * cosP;
    const rx = cosY;
    const ry = 0;
    const rz = -sinY;
    const ux = fy * rz - fz * ry;
    const uy = fz * rx - fx * rz;
    const uz = fx * ry - fy * rx;
    gl.useProgram(this.worldProg);
    gl.uniform3f(this.uniforms.uCamPos!, camX, camY, camZ);
    gl.uniform3f(this.uniforms.uCamR!, rx, ry, rz);
    gl.uniform3f(this.uniforms.uCamU!, ux, uy, uz);
    gl.uniform3f(this.uniforms.uCamF!, fx, fy, fz);
    gl.uniform2f(this.uniforms.uProjScale!, (2.0 * focal) / pxW, (2.0 * focal) / pxH);
    gl.uniform1f(this.uniforms.uCenterYBias!, centerYBias);
    gl.uniform3f(this.uniforms.uSun!, this.sunDir[0], this.sunDir[1], this.sunDir[2]);
    gl.uniform3f(
      this.uniforms.uFogColor!,
      circuit.theme.fogHex[0] / 255,
      circuit.theme.fogHex[1] / 255,
      circuit.theme.fogHex[2] / 255,
    );
  }

  private drawKartRigs(
    gl: WebGL2RenderingContext,
    karts: readonly KartState[],
    timeMs: number,
    tr = 1,
    tg = 1,
    tb = 1,
  ): void {
    gl.bindVertexArray(this.worldVao);
    for (const kart of karts) {
      const rig = this.driverRigs.get(kart.character);
      if (!rig) continue;
      const bounceY = Math.sin(timeMs * 0.015 + kart.slot * 1.4) * (kart.speed > 5 ? 0.045 : 0.01);
      const totalYaw = kart.yaw + kart.driftYaw;
      eulerToBasis3(this.kartBasis, totalYaw, kart.pitch, -kart.bodyRoll);
      this.drawStaticMesh(gl, rig.chassis, kart.x, kart.y + bounceY, kart.z, this.kartBasis, 1, 1, 1, tr, tg, tb);

      const pose = computeDriverPose(kart, timeMs);
      eulerToBasis3(this.localBasis, 0, pose.torsoPitch, pose.torsoRoll);
      mulBasis3(this.worldPartBasis, this.kartBasis, this.localBasis);
      const torsoOff = transformOffsetByBasis(this.kartBasis, 0, 0.72, -0.04);
      this.drawStaticMesh(
        gl,
        rig.torso,
        kart.x + torsoOff.x,
        kart.y + bounceY + torsoOff.y,
        kart.z + torsoOff.z,
        this.worldPartBasis,
        1,
        1,
        1,
        tr,
        tg,
        tb,
      );

      eulerToBasis3(this.localBasis, pose.headYaw, pose.headPitch, pose.headRoll);
      mulBasis3(this.headWorldBasis, this.kartBasis, this.localBasis);
      const headOff = transformOffsetByBasis(
        this.kartBasis,
        pose.headShiftX,
        1.12 + pose.headDuckY,
        -0.02 + pose.headDuckZ,
      );
      const hx = kart.x + headOff.x;
      const hy = kart.y + bounceY + headOff.y;
      const hz = kart.z + headOff.z;
      this.drawStaticMesh(gl, rig.head, hx, hy, hz, this.headWorldBasis, 1, 1, 1, tr, tg, tb);

      eulerToBasis3(this.localBasis, 0, pose.leftEarPitch, pose.leftEarRoll);
      mulBasis3(this.worldPartBasis, this.headWorldBasis, this.localBasis);
      const lAnchor = transformOffsetByBasis(
        this.headWorldBasis,
        rig.leftEarAnchor[0],
        rig.leftEarAnchor[1],
        rig.leftEarAnchor[2],
      );
      this.drawStaticMesh(gl, rig.leftEar, hx + lAnchor.x, hy + lAnchor.y, hz + lAnchor.z, this.worldPartBasis, 1, 1, 1, tr, tg, tb);

      eulerToBasis3(this.localBasis, 0, pose.rightEarPitch, pose.rightEarRoll);
      mulBasis3(this.worldPartBasis, this.headWorldBasis, this.localBasis);
      const rAnchor = transformOffsetByBasis(
        this.headWorldBasis,
        rig.rightEarAnchor[0],
        rig.rightEarAnchor[1],
        rig.rightEarAnchor[2],
      );
      this.drawStaticMesh(gl, rig.rightEar, hx + rAnchor.x, hy + rAnchor.y, hz + rAnchor.z, this.worldPartBasis, 1, 1, 1, tr, tg, tb);
    }
  }

  renderViewport(
    race: KartRaceState,
    focusSlot: number,
    cam: ChaseCamera,
    pxX: number,
    pxYFromTop: number,
    pxW: number,
    pxH: number,
    timeMs: number,
  ): boolean {
    const gl = this.gl;
    if (!gl || this.contextLost || !this.worldProg || !this.skyProg) return false;

    const focusKart = race.karts[focusSlot] ?? race.karts[0]!;
    const circuit = getCircuitForKart(race, focusKart);
    const visibleKarts = race.karts.filter(
      (k) =>
        !k.eliminated &&
        (race.format !== 'marathon' || getCircuitForKart(race, k).id === circuit.id),
    );
    const totalH = this.canvas.height;
    const glY = totalH - pxYFromTop - pxH;

    gl.enable(gl.SCISSOR_TEST);
    gl.viewport(pxX, glY, pxW, pxH);
    gl.scissor(pxX, glY, pxW, pxH);

    const cosY = Math.cos(cam.yaw);
    const sinY = Math.sin(cam.yaw);
    const cosP = Math.cos(cam.pitch);
    const sinP = Math.sin(cam.pitch);
    const fx = sinY * cosP;
    const fy = sinP;
    const fz = cosY * cosP;
    const rx = cosY;
    const ry = 0;
    const rz = -sinY;
    const ux = fy * rz - fz * ry;
    const uy = fz * rx - fx * rz;
    const uz = fx * ry - fy * rx;

    const isWideSplit = pxW / Math.max(1, pxH) > 2.15;
    const baseFocal = isWideSplit
      ? Math.min(pxW * 0.58, pxH * 1.48)
      : Math.min(pxW * 0.72, pxH * 1.05);
    const focal = baseFocal * cam.fovScale;
    const centerRatio = isWideSplit ? 0.48 : 0.52;
    const centerYBias = 1.0 - 2.0 * centerRatio;
    const horizonPxFromTop = Math.max(
      pxH * 0.12,
      Math.min(pxH * 0.78, centerRatio * pxH + Math.tan(cam.pitch) * focal),
    );
    const horizonUvY = 1.0 - horizonPxFromTop / Math.max(1, pxH);

    // 1. Sky + Fluffy Clouds / Twinkling Stars + Rolling Hills Pass
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    this.drawSkyBackdrop(gl, circuit, cam.yaw, horizonUvY);

    // 2. Static 3D Circuit World Pass (1 single draw call!)
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    this.setupWorldCameraUniforms(gl, circuit, cam.x, cam.y, cam.z, cam.yaw, cam.pitch, focal, pxW, pxH, centerYBias);

    gl.bindVertexArray(this.worldVao);
    gl.uniform1f(this.uniforms.uUseClipPlane!, 0.0);
    const circuitMesh = this.getOrBakeCircuitMesh(gl, circuit.id, circuit.reversed);
    this.drawStaticMesh(gl, circuitMesh, 0, 0, 0, IDENTITY_BASIS);

    // 2B. Live Valve-Portal Stencil Window inside the Finish-Line Archway in Portal Marathon Mode (#412, #416)!
    const localProgressDist = focusKart.unwrappedS - focusKart.stageStartUnwrappedS;
    if (race.format === 'marathon' && localProgressDist > 120) {
      const g0 = circuit.nodes[0]!;
      const h0 = Math.hypot(g0.tx, g0.tz) || 1;
      const tx0 = g0.tx / h0;
      const tz0 = g0.tz / h0;
      const toGateX = g0.x - cam.x;
      const toGateY = g0.y + 4.5 - cam.y;
      const toGateZ = g0.z - cam.z;
      const gateDist = Math.hypot(toGateX, toGateY, toGateZ);
      const fwdDot = (toGateX * fx + toGateY * fy + toGateZ * fz) / Math.max(1, gateDist);
      // Camera must be on the approach side of the finish portal plane
      const camSignedAlongGate = (cam.x - g0.x) * tx0 + (cam.z - g0.z) * tz0;
      if (camSignedAlongGate < -0.5 && gateDist > 2.0 && gateDist < 380 && fwdDot > 0.12) {
        const nextStage = getMarathonStageForKart(race, focusKart, focusKart.stageIndex + 1);
        const nextCircuit = getCircuit(nextStage.circuitId, nextStage.reversed);
        const nextKarts = race.karts.filter(
          (k) => !k.eliminated && getCircuitForKart(race, k).id === nextCircuit.id,
        );

        const portalW = circuit.roadHalfWidth + 0.35;
        const portalH = circuit.theme.skyMode === 'cloud-sea' ? 9.2 : 6.85;
        // Build portal doorway quad in dynamicScratch (2 triangles)
        let pIdx = 0;
        const pushPortalVert = (px: number, py: number, pz: number, r: number, g: number, b: number, em: number) => {
          this.dynamicScratch[pIdx++] = px;
          this.dynamicScratch[pIdx++] = py;
          this.dynamicScratch[pIdx++] = pz;
          this.dynamicScratch[pIdx++] = -tx0;
          this.dynamicScratch[pIdx++] = 0;
          this.dynamicScratch[pIdx++] = -tz0;
          this.dynamicScratch[pIdx++] = r;
          this.dynamicScratch[pIdx++] = g;
          this.dynamicScratch[pIdx++] = b;
          this.dynamicScratch[pIdx++] = MAT_GLOSSY;
          this.dynamicScratch[pIdx++] = em;
        };
        const pBL = [g0.x - g0.rx * portalW, g0.y + 0.02, g0.z - g0.rz * portalW] as const;
        const pBR = [g0.x + g0.rx * portalW, g0.y + 0.02, g0.z + g0.rz * portalW] as const;
        const pTR = [g0.x + g0.rx * portalW, g0.y + portalH, g0.z + g0.rz * portalW] as const;
        const pTL = [g0.x - g0.rx * portalW, g0.y + portalH, g0.z - g0.rz * portalW] as const;
        pushPortalVert(pBL[0], pBL[1], pBL[2], 0.2, 0.9, 1.0, 1);
        pushPortalVert(pBR[0], pBR[1], pBR[2], 0.2, 0.9, 1.0, 1);
        pushPortalVert(pTR[0], pTR[1], pTR[2], 0.2, 0.9, 1.0, 1);
        pushPortalVert(pBL[0], pBL[1], pBL[2], 0.2, 0.9, 1.0, 1);
        pushPortalVert(pTR[0], pTR[1], pTR[2], 0.2, 0.9, 1.0, 1);
        pushPortalVert(pTL[0], pTL[1], pTL[2], 0.2, 0.9, 1.0, 1);

        // Stencil mask write pass (depth-tested against current circuit so foreground hills occlude cleanly!)
        gl.enable(gl.STENCIL_TEST);
        gl.stencilMask(0xff);
        gl.stencilFunc(gl.ALWAYS, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        gl.colorMask(false, false, false, false);
        gl.depthMask(false);
        gl.bindVertexArray(this.dynamicVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamicVbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dynamicScratch.subarray(0, pIdx));
        gl.uniform3f(this.uniforms.uModelPos!, 0, 0, 0);
        gl.uniformMatrix3fv(this.uniforms.uModelBasis!, false, IDENTITY_BASIS);
        gl.uniform3f(this.uniforms.uModelScale!, 1, 1, 1);
        gl.uniform3f(this.uniforms.uTint!, 1, 1, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Draw NEXT CIRCUIT'S LIVE SKY + UNOBSTRUCTED 3D WORLD strictly inside stencil === 1!
        gl.colorMask(true, true, true, true);
        gl.depthMask(true);
        gl.stencilMask(0x00);
        gl.stencilFunc(gl.EQUAL, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        const portalCam = transformPoseThroughPortal(cam, circuit, nextCircuit);
        // Reset depth ONLY inside stencil === 1 while painting next circuit's sky!
        gl.depthFunc(gl.ALWAYS);
        this.drawSkyBackdrop(gl, nextCircuit, portalCam.yaw, horizonUvY);

        gl.depthFunc(gl.LESS);
        this.setupWorldCameraUniforms(
          gl,
          nextCircuit,
          portalCam.x,
          portalCam.y,
          portalCam.z,
          portalCam.yaw,
          cam.pitch,
          focal,
          pxW,
          pxH,
          centerYBias,
        );
        // Oblique Portal Near-Plane Clip (#416): discard ALL geometry of nextCircuit behind its portal plane
        // (+2.4m past g1 clears nextCircuit's own start-gantry pillars & trailing road s=L-50..L!)
        const g1 = nextCircuit.nodes[0]!;
        const h1 = Math.hypot(g1.tx, g1.tz) || 1;
        const tx1 = g1.tx / h1;
        const tz1 = g1.tz / h1;
        const clipD = tx1 * g1.x + tz1 * g1.z + 2.4;
        gl.uniform4f(this.uniforms.uClipPlane!, tx1, 0, tz1, clipD);
        gl.uniform1f(this.uniforms.uUseClipPlane!, 1.0);

        gl.bindVertexArray(this.worldVao);
        const nextMesh = this.getOrBakeCircuitMesh(gl, nextCircuit.id, nextCircuit.reversed);
        this.drawStaticMesh(gl, nextMesh, 0, 0, 0, IDENTITY_BASIS);
        if (nextKarts.length > 0) {
          this.drawKartRigs(gl, nextKarts, timeMs);
        }

        // Disable portal clip plane & stencil test, restore main camera!
        gl.uniform1f(this.uniforms.uUseClipPlane!, 0.0);
        gl.disable(gl.STENCIL_TEST);
        gl.stencilMask(0xff);
        this.setupWorldCameraUniforms(
          gl,
          circuit,
          cam.x,
          cam.y,
          cam.z,
          cam.yaw,
          cam.pitch,
          focal,
          pxW,
          pxH,
          centerYBias,
        );

        // Luminous shimmering Cyan-Gold Portal Frame Border outlining the archway opening!
        const pulse = 0.78 + 0.22 * Math.sin(timeMs * 0.008);
        const borderT = 0.72;
        let fIdx = 0;
        const pushFrameQuad = (
          a: readonly [number, number, number],
          b: readonly [number, number, number],
          c: readonly [number, number, number],
          d: readonly [number, number, number],
          cr: number,
          cg: number,
          cb: number,
        ) => {
          const verts = [a, b, c, a, c, d];
          for (const v of verts) {
            this.dynamicScratch[fIdx++] = v[0];
            this.dynamicScratch[fIdx++] = v[1];
            this.dynamicScratch[fIdx++] = v[2];
            this.dynamicScratch[fIdx++] = -g0.tx;
            this.dynamicScratch[fIdx++] = 0;
            this.dynamicScratch[fIdx++] = -g0.tz;
            this.dynamicScratch[fIdx++] = cr * pulse;
            this.dynamicScratch[fIdx++] = cg * pulse;
            this.dynamicScratch[fIdx++] = cb * pulse;
            this.dynamicScratch[fIdx++] = MAT_GLOSSY;
            this.dynamicScratch[fIdx++] = 1;
          }
        };
        const fOffX = -g0.tx * 0.32;
        const fOffZ = -g0.tz * 0.32;
        const pt = (lat: number, y: number): [number, number, number] => [
          g0.x + g0.rx * lat + fOffX,
          g0.y + y,
          g0.z + g0.rz * lat + fOffZ,
        ];
        // Left cyan energy pillar strip
        pushFrameQuad(pt(-portalW - borderT, 0), pt(-portalW, 0), pt(-portalW, portalH), pt(-portalW - borderT, portalH), 0.16, 0.94, 1.0);
        // Right cyan energy pillar strip
        pushFrameQuad(pt(portalW, 0), pt(portalW + borderT, 0), pt(portalW + borderT, portalH), pt(portalW, portalH), 0.16, 0.94, 1.0);
        // Top radiant gold-cyan portal header strip
        pushFrameQuad(pt(-portalW - borderT, portalH - 0.15), pt(portalW + borderT, portalH - 0.15), pt(portalW + borderT, portalH + borderT), pt(-portalW - borderT, portalH + borderT), 1.0, 0.86, 0.32);

        gl.bindVertexArray(this.dynamicVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamicVbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dynamicScratch.subarray(0, fIdx));
        gl.uniform3f(this.uniforms.uModelPos!, 0, 0, 0);
        gl.uniformMatrix3fv(this.uniforms.uModelBasis!, false, IDENTITY_BASIS);
        gl.uniform3f(this.uniforms.uModelScale!, 1, 1, 1);
        gl.uniform3f(this.uniforms.uTint!, 1, 1, 1);
        gl.drawArrays(gl.TRIANGLES, 0, fIdx / FLOATS_PER_VERT);
      }
    }

    // 3. Ground Shadows + Tire Marks
    let dynIdx = 0;
    const pushDynTri = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number,
      cr: number, cg: number, cb: number,
    ) => {
      if (dynIdx + 3 * FLOATS_PER_VERT > this.dynamicScratch.length) return;
      const pts: ReadonlyArray<[number, number, number]> = [
        [ax, ay, az],
        [bx, by, bz],
        [cx, cy, cz],
      ];
      for (const [px, py, pz] of pts) {
        this.dynamicScratch[dynIdx++] = px;
        this.dynamicScratch[dynIdx++] = py;
        this.dynamicScratch[dynIdx++] = pz;
        this.dynamicScratch[dynIdx++] = 0;
        this.dynamicScratch[dynIdx++] = 1;
        this.dynamicScratch[dynIdx++] = 0;
        this.dynamicScratch[dynIdx++] = cr;
        this.dynamicScratch[dynIdx++] = cg;
        this.dynamicScratch[dynIdx++] = cb;
        this.dynamicScratch[dynIdx++] = MAT_MATTE;
        this.dynamicScratch[dynIdx++] = 0;
      }
    };
    const pushDynQuad = (
      x0: number, y0: number, z0: number,
      x1: number, y1: number, z1: number,
      x2: number, y2: number, z2: number,
      x3: number, y3: number, z3: number,
      cr: number, cg: number, cb: number,
    ) => {
      pushDynTri(x0, y0, z0, x1, y1, z1, x2, y2, z2, cr, cg, cb);
      pushDynTri(x0, y0, z0, x2, y2, z2, x3, y3, z3, cr, cg, cb);
    };

    for (const kart of visibleKarts) {
      const shYaw = kart.yaw + kart.driftYaw;
      const srx = Math.cos(shYaw) * 1.44;
      const srz = -Math.sin(shYaw) * 1.44;
      const sfx = Math.sin(shYaw) * 2.15;
      const sfz = Math.cos(shYaw) * 2.15;
      const sy = kart.y + 0.05;
      pushDynQuad(
        kart.x - srx - sfx, sy, kart.z - srz - sfz,
        kart.x + srx - sfx, sy, kart.z + srz - sfz,
        kart.x + srx + sfx, sy, kart.z + srz + sfz,
        kart.x - srx + sfx, sy, kart.z - srz + sfz,
        0.08, 0.1, 0.14,
      );

      const marks = kart.skidMarks;
      for (let i = 1; i < marks.length; i += 1) {
        const a = marks[i - 1]!;
        const b = marks[i]!;
        if (Math.hypot(b.lx - a.lx, b.lz - a.lz) < 4.5) {
          pushDynQuad(
            a.lx - 0.15, a.ly, a.lz,
            a.lx + 0.15, a.ly, a.lz,
            b.lx + 0.15, b.ly, b.lz,
            b.lx - 0.15, b.ly, b.lz,
            0.09, 0.11, 0.16,
          );
          pushDynQuad(
            a.rx - 0.15, a.ry, a.rz,
            a.rx + 0.15, a.ry, a.rz,
            b.rx + 0.15, b.ry, b.rz,
            b.rx - 0.15, b.ry, b.rz,
            0.09, 0.11, 0.16,
          );
        }
      }
    }

    // 3a-ii. Animated Soaring Red-Crowned Cranes (`仙鹤`, 12 graceful birds gliding above Cloud Gate!)
    if (circuit.theme.skyMode === 'cloud-sea') {
      const tSec = timeMs * 0.001;
      const anchorSegs = [4, 14, 28, 44, 52, 70, 84, 96, 118, 138, 158, 176];
      for (let ci = 0; ci < anchorSegs.length; ci += 1) {
        const anchor = circuit.nodes[anchorSegs[ci]!]!;
        const orbitR = 14 + (ci % 3) * 9;
        const speed = (0.3 + (ci % 4) * 0.05) * (ci % 2 === 0 ? 1 : -1);
        const ang = tSec * speed + ci * 1.15;
        const cx = anchor.x + Math.cos(ang) * orbitR;
        const cz = anchor.z + Math.sin(ang) * orbitR;
        const cy = anchor.y + 8.5 + (ci % 3) * 3.8 + Math.sin(tSec * 1.2 + ci) * 1.3;

        // Tangent flight direction around orbit
        const dirSign = speed >= 0 ? 1 : -1;
        const bfx = -Math.sin(ang) * dirSign;
        const bfz = Math.cos(ang) * dirSign;
        const brx = bfz;
        const brz = -bfx;

        // Graceful sinusoidal wingbeat (`wm_crane_fly.jpg`)
        const flap = Math.sin(tSec * 4.4 + ci * 1.65);
        const wingMidY = cy + flap * 1.05;
        const wingTipY = cy + flap * 2.15;
        const spanMid = 2.85;
        const spanTip = 5.25;

        // Slender snow-white torso & outstretched neck (two crisp double-sided triangles)
        const noseX = cx + bfx * 3.2;
        const noseZ = cz + bfz * 3.2;
        const tailX = cx - bfx * 2.65;
        const tailZ = cz - bfz * 2.65;
        const bodyLX = cx - brx * 0.52;
        const bodyLZ = cz - brz * 0.52;
        const bodyRX = cx + brx * 0.52;
        const bodyRZ = cz + brz * 0.52;
        pushDynTri(noseX, cy + 0.18, noseZ, bodyLX, cy, bodyLZ, bodyRX, cy, bodyRZ, 0.99, 0.98, 0.96);
        pushDynTri(noseX, cy + 0.18, noseZ, bodyRX, cy, bodyRZ, bodyLX, cy, bodyLZ, 0.99, 0.98, 0.96);
        pushDynTri(tailX, cy - 0.06, tailZ, bodyRX, cy, bodyRZ, bodyLX, cy, bodyLZ, 0.96, 0.96, 0.94);
        pushDynTri(tailX, cy - 0.06, tailZ, bodyLX, cy, bodyLZ, bodyRX, cy, bodyRZ, 0.96, 0.96, 0.94);

        // Vivid crimson-red crown accent on the crane's head!
        pushDynTri(
          cx + bfx * 2.25, cy + 0.48, cz + bfz * 2.25,
          cx + bfx * 2.95 - brx * 0.28, cy + 0.26, cz + bfz * 2.95 - brz * 0.28,
          cx + bfx * 2.95 + brx * 0.28, cy + 0.26, cz + bfz * 2.95 + brz * 0.28,
          0.92, 0.16, 0.14,
        );

        // Snow-white inner wings + charcoal-black trailing primary wingtips (double-sided!)
        for (const side of [-1, 1] as const) {
          const rootFX = cx + bfx * 0.85;
          const rootFZ = cz + bfz * 0.85;
          const rootBX = cx - bfx * 1.1;
          const rootBZ = cz - bfz * 1.1;
          const midFX = cx + brx * side * spanMid + bfx * 0.42;
          const midFZ = cz + brz * side * spanMid + bfz * 0.42;
          const midBX = cx + brx * side * spanMid - bfx * 1.05;
          const midBZ = cz + brz * side * spanMid - bfz * 1.05;
          const tipX = cx + brx * side * spanTip - bfx * 0.65;
          const tipZ = cz + brz * side * spanTip - bfz * 0.65;

          // Inner snow-white wing
          pushDynTri(rootFX, cy, rootFZ, midFX, wingMidY, midFZ, midBX, wingMidY, midBZ, 0.99, 0.99, 0.97);
          pushDynTri(rootFX, cy, rootFZ, midBX, wingMidY, midBZ, rootBX, cy, rootBZ, 0.97, 0.97, 0.95);
          pushDynTri(rootFX, cy, rootFZ, midBX, wingMidY, midBZ, midFX, wingMidY, midFZ, 0.92, 0.94, 0.97);
          pushDynTri(rootFX, cy, rootFZ, rootBX, cy, rootBZ, midBX, wingMidY, midBZ, 0.92, 0.94, 0.97);

          // Crisp black trailing primary flight feathers!
          pushDynTri(midFX, wingMidY, midFZ, tipX, wingTipY, tipZ, midBX, wingMidY, midBZ, 0.1, 0.12, 0.16);
          pushDynTri(midFX, wingMidY, midFZ, midBX, wingMidY, midBZ, tipX, wingTipY, tipZ, 0.1, 0.12, 0.16);
        }
      }
    }

    if (dynIdx > 0 && this.dynamicVao && this.dynamicVbo) {
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-2.0, -4.0);
      gl.bindVertexArray(this.dynamicVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamicVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dynamicScratch.subarray(0, dynIdx));
      gl.uniform3f(this.uniforms.uModelPos!, 0, 0, 0);
      gl.uniformMatrix3fv(this.uniforms.uModelBasis!, false, IDENTITY_BASIS);
      gl.uniform3f(this.uniforms.uModelScale!, 1, 1, 1);
      gl.uniform3f(this.uniforms.uTint!, 1, 1, 1);
      gl.drawArrays(gl.TRIANGLES, 0, dynIdx / FLOATS_PER_VERT);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }

    // 3b. Curved 1-Second Predicted Trajectory Path starting from the HEAD (front nose) of the kart!
    if (focusKart && !focusKart.eliminated && this.shadowProg && this.shadowVao && this.shadowVbo) {
      const traj = predictKartTrajectory(focusKart, circuit, 1.0, 16);
      const spec = getKartDriverSpec(focusKart.character);
      const tr = spec.kartPrimary[0] / 255;
      const tg = spec.kartPrimary[1] / 255;
      const tb = spec.kartPrimary[2] / 255;

      let shIdx = 0;
      const pushShVert = (vx: number, vy: number, vz: number, r: number, g: number, b: number, a: number) => {
        if (shIdx + SHADOW_FLOATS_PER_VERT > this.shadowScratch.length) return;
        this.shadowScratch[shIdx++] = vx;
        this.shadowScratch[shIdx++] = vy;
        this.shadowScratch[shIdx++] = vz;
        this.shadowScratch[shIdx++] = r;
        this.shadowScratch[shIdx++] = g;
        this.shadowScratch[shIdx++] = b;
        this.shadowScratch[shIdx++] = a;
      };
      const pushShQuad = (
        x0: number, y0: number, z0: number, a0: number,
        x1: number, y1: number, z1: number, a1: number,
        x2: number, y2: number, z2: number, a2: number,
        x3: number, y3: number, z3: number, a3: number,
      ) => {
        pushShVert(x0, y0, z0, tr, tg, tb, a0);
        pushShVert(x1, y1, z1, tr, tg, tb, a1);
        pushShVert(x2, y2, z2, tr, tg, tb, a2);
        pushShVert(x0, y0, z0, tr, tg, tb, a0);
        pushShVert(x2, y2, z2, tr, tg, tb, a2);
        pushShVert(x3, y3, z3, tr, tg, tb, a3);
      };

      // Curved 1-second predicted path extending forward from the kart's nose (`t = 0 .. 1s`)
      const baseW = 1.48;
      for (let i = 0; i < traj.length - 1; i += 1) {
        const a = traj[i]!;
        const b = traj[i + 1]!;
        const wA = baseW * (1 - (a.t / 1.0) * 0.45);
        const wB = baseW * (1 - (b.t / 1.0) * 0.45);
        pushShQuad(
          a.x - a.rx * wA, a.y, a.z - a.rz * wA, a.alpha,
          a.x + a.rx * wA, a.y, a.z + a.rz * wA, a.alpha,
          b.x + b.rx * wB, b.y, b.z + b.rz * wB, b.alpha,
          b.x - b.rx * wB, b.y, b.z - b.rz * wB, b.alpha,
        );
      }

      if (shIdx > 0) {
        gl.useProgram(this.shadowProg);
        gl.uniform3f(this.shadowUniforms.uCamPos!, cam.x, cam.y, cam.z);
        gl.uniform3f(this.shadowUniforms.uCamR!, rx, ry, rz);
        gl.uniform3f(this.shadowUniforms.uCamU!, ux, uy, uz);
        gl.uniform3f(this.shadowUniforms.uCamF!, fx, fy, fz);
        gl.uniform2f(this.shadowUniforms.uProjScale!, (2.0 * focal) / pxW, (2.0 * focal) / pxH);
        gl.uniform1f(this.shadowUniforms.uCenterYBias!, centerYBias);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(-3.0, -6.0);
        gl.bindVertexArray(this.shadowVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowVbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.shadowScratch.subarray(0, shIdx));
        gl.drawArrays(gl.TRIANGLES, 0, shIdx / SHADOW_FLOATS_PER_VERT);
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        // Restore world program for kart meshes
        gl.useProgram(this.worldProg);
      }
    }

    // 4. Playful Toy Bumper-Karts & Starlight Burst Companions
    gl.bindVertexArray(this.worldVao);
    for (const kart of visibleKarts) {
      const rig = this.driverRigs.get(kart.character) ?? this.driverRigs.get('fox')!;
      const pose = computeDriverPose(kart, timeMs);
      // Subtle playful suspension hop when racing fast!
      const bounceY = Math.abs(Math.sin(timeMs * 0.015 + kart.slot * 1.7)) * Math.min(0.055, kart.speed * 0.0006);
      eulerToBasis3(this.kartBasis, kart.yaw + kart.driftYaw, kart.pitch, -kart.bodyRoll);

      this.drawStaticMesh(gl, rig.chassis, kart.x, kart.y + bounceY, kart.z, this.kartBasis);

      // Dynamic plush torso leaning into tight turns and ducking forward at top speed!
      eulerToBasis3(this.localBasis, 0, pose.torsoPitch, pose.torsoRoll);
      mulBasis3(this.worldPartBasis, this.kartBasis, this.localBasis);
      const torsoOff = transformOffsetByBasis(this.kartBasis, pose.torsoShiftX * 0.45, 0.62, -0.16);
      this.drawStaticMesh(
        gl,
        rig.torso,
        kart.x + torsoOff.x,
        kart.y + bounceY + torsoOff.y,
        kart.z + torsoOff.z,
        this.worldPartBasis,
      );

      // Cheerful glowing rear brake/tail lamps
      if (this.unitBoxMesh) {
        const bOff = transformOffsetByBasis(this.kartBasis, 0, 0.68, -1.66);
        this.drawStaticMesh(
          gl,
          this.unitBoxMesh,
          kart.x + bOff.x,
          kart.y + bounceY + bOff.y,
          kart.z + bOff.z,
          this.kartBasis,
          kart.braking ? 1.48 : 1.18,
          kart.braking ? 0.16 : 0.1,
          0.08,
          1.0,
          kart.braking ? 0.16 : 0.34,
          kart.braking ? 0.24 : 0.38,
        );
      }

      // Expressive corner-leaning, wind-ducking head + wind-blown articulated ears!
      eulerToBasis3(this.localBasis, pose.headYaw, pose.headPitch, pose.headRoll);
      mulBasis3(this.headWorldBasis, this.kartBasis, this.localBasis);
      const headOff = transformOffsetByBasis(
        this.kartBasis,
        pose.headShiftX,
        1.3 + pose.headDuckY,
        -0.14 + pose.headDuckZ,
      );
      const headWx = kart.x + headOff.x;
      const headWy = kart.y + bounceY + headOff.y;
      const headWz = kart.z + headOff.z;
      this.drawStaticMesh(gl, rig.head, headWx, headWy, headWz, this.headWorldBasis);

      // Left & right ears blow back in high-speed wind and tilt slightly outward in tight turns!
      const [lax, lay, laz] = rig.leftEarAnchor;
      const leftEarOff = transformOffsetByBasis(this.headWorldBasis, lax, lay, laz);
      eulerToBasis3(this.localBasis, 0, pose.leftEarPitch, pose.leftEarRoll);
      mulBasis3(this.worldPartBasis, this.headWorldBasis, this.localBasis);
      this.drawStaticMesh(
        gl,
        rig.leftEar,
        headWx + leftEarOff.x,
        headWy + leftEarOff.y,
        headWz + leftEarOff.z,
        this.worldPartBasis,
      );

      const [rax, ray, raz] = rig.rightEarAnchor;
      const rightEarOff = transformOffsetByBasis(this.headWorldBasis, rax, ray, raz);
      eulerToBasis3(this.localBasis, 0, pose.rightEarPitch, pose.rightEarRoll);
      mulBasis3(this.worldPartBasis, this.headWorldBasis, this.localBasis);
      this.drawStaticMesh(
        gl,
        rig.rightEar,
        headWx + rightEarOff.x,
        headWy + rightEarOff.y,
        headWz + rightEarOff.z,
        this.worldPartBasis,
      );

      // Wagging / swishing species tail reacting to speed and corner G-force
      eulerToBasis3(this.localBasis, pose.tailYaw, pose.tailPitch, 0);
      mulBasis3(this.worldPartBasis, this.kartBasis, this.localBasis);
      const tailOff = transformOffsetByBasis(this.kartBasis, 0, 0.7 + pose.tailHop, -0.46);
      this.drawStaticMesh(
        gl,
        rig.tail,
        kart.x + tailOff.x,
        kart.y + bounceY + tailOff.y,
        kart.z + tailOff.z,
        this.worldPartBasis,
      );

      // Fluttering neckerchief tails anchored to leaning/ducking collar
      eulerToBasis3(this.localBasis, pose.scarfYaw, pose.scarfPitch, pose.torsoRoll * 0.6);
      mulBasis3(this.worldPartBasis, this.kartBasis, this.localBasis);
      const scarfOff = transformOffsetByBasis(
        this.kartBasis,
        pose.headShiftX * 0.68,
        1.0 + pose.headDuckY * 0.65,
        -0.34 + pose.headDuckZ * 0.65,
      );
      this.drawStaticMesh(
        gl,
        rig.scarf,
        kart.x + scarfOff.x,
        kart.y + bounceY + scarfOff.y,
        kart.z + scarfOff.z,
        this.worldPartBasis,
      );

      // Pure Dual-Rocket Exhaust Flames scaled strictly in proportion to each thruster's output (`0..1`)!
      if (this.flameMesh) {
        const flicker = 0.88 + Math.sin(timeMs * 0.045 + kart.slot) * 0.14;
        const padBoost = kart.boostTimer > 0 && kart.boostKind === 'pad';
        const powers: ReadonlyArray<[number, number]> = [
          [-0.49, kart.leftThrottle],
          [0.49, kart.rightThrottle],
        ];
        const [fr, fg, fb] = padBoost ? [0.24, 0.94, 1.0] : [1.0, 0.68, 0.22];

        for (const [cx, throttle] of powers) {
          if (throttle <= 0.02) continue;
          const boostLen = padBoost ? 1.32 : 1.0;
          const len = (0.35 + throttle * 2.15) * boostLen * flicker;
          const radScale = (0.42 + throttle * 0.72) * (padBoost ? 1.12 : 1.0);
          const fOff = transformOffsetByBasis(this.kartBasis, cx, 0.52, -1.9);
          this.drawStaticMesh(
            gl,
            this.flameMesh,
            kart.x + fOff.x,
            kart.y + bounceY + fOff.y,
            kart.z + fOff.z,
            this.kartBasis,
            radScale,
            radScale,
            len,
            fr,
            fg,
            fb,
          );
        }
      }
    }

    gl.bindVertexArray(null);
    gl.disable(gl.SCISSOR_TEST);
    return true;
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    const gl = this.gl;
    if (gl) {
      for (const m of this.circuitMeshes.values()) gl.deleteBuffer(m.vbo);
      for (const r of this.driverRigs.values()) {
        gl.deleteBuffer(r.chassis.vbo);
        gl.deleteBuffer(r.torso.vbo);
        gl.deleteBuffer(r.head.vbo);
        gl.deleteBuffer(r.leftEar.vbo);
        gl.deleteBuffer(r.rightEar.vbo);
        gl.deleteBuffer(r.tail.vbo);
        gl.deleteBuffer(r.scarf.vbo);
      }
      if (this.flameMesh) gl.deleteBuffer(this.flameMesh.vbo);
      if (this.unitBoxMesh) gl.deleteBuffer(this.unitBoxMesh.vbo);
      if (this.dynamicVbo) gl.deleteBuffer(this.dynamicVbo);
      if (this.shadowVbo) gl.deleteBuffer(this.shadowVbo);
      if (this.skyVbo) gl.deleteBuffer(this.skyVbo);
      if (this.worldVao) gl.deleteVertexArray(this.worldVao);
      if (this.dynamicVao) gl.deleteVertexArray(this.dynamicVao);
      if (this.shadowVao) gl.deleteVertexArray(this.shadowVao);
      if (this.skyVao) gl.deleteVertexArray(this.skyVao);
      if (this.worldProg) gl.deleteProgram(this.worldProg);
      if (this.shadowProg) gl.deleteProgram(this.shadowProg);
      if (this.skyProg) gl.deleteProgram(this.skyProg);
    }
    this.circuitMeshes.clear();
    this.driverRigs.clear();
    this.gl = null;
  }
}
