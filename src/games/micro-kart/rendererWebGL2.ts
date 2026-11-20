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
  CIRCUITS,
  getKartDriverSpec,
  KART_DRIVERS,
  MINI_TURBO_CHARGE_SEC,
  ULTRA_TURBO_CHARGE_SEC,
  type CircuitDefinition,
  type CircuitId,
  type DriverCharacterId,
  type KartDriverSpec,
  type KartRaceState,
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
  const curbH = 0.3;

  for (let i0 = 0; i0 < N; i0 += 1) {
    const i1 = (i0 + 1) % N;
    const n0 = nodes[i0]!;
    const n1 = nodes[i1]!;
    const even = i0 % 2 === 0;
    const gRgb = even ? groundOuter : groundAlt;

    // Ground shoulders
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

    // Asphalt track
    mb.addFlatQuad(
      { x: n0.x - n0.rx * rw, y: n0.y, z: n0.z - n0.rz * rw },
      { x: n0.x + n0.rx * rw, y: n0.y, z: n0.z + n0.rz * rw },
      { x: n1.x + n1.rx * rw, y: n1.y, z: n1.z + n1.rz * rw },
      { x: n1.x - n1.rx * rw, y: n1.y, z: n1.z - n1.rz * rw },
      even ? roadDark : roadLight,
      MAT_MATTE,
    );

    // Sunny center dashed racing line
    if (even && i0 !== 0) {
      const lw = 0.38;
      mb.addFlatQuad(
        { x: n0.x - n0.rx * lw, y: n0.y + 0.045, z: n0.z - n0.rz * lw },
        { x: n0.x + n0.rx * lw, y: n0.y + 0.045, z: n0.z + n0.rz * lw },
        { x: n1.x + n1.rx * lw, y: n1.y + 0.045, z: n1.z + n1.rz * lw },
        { x: n1.x - n1.rx * lw, y: n1.y + 0.045, z: n1.z - n1.rz * lw },
        [255, 246, 200],
        MAT_MATTE,
      );
    }

    // Raised 3D Candy-Striped Curbs
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

    // Vivid Rainbow-Chevron Turbo Boost Strip!
    if (n0.hasBoostPad) {
      const bl = n0.boostLat;
      const bw = 3.0;
      const rainbowCols: ReadonlyArray<[number, number, number]> = [
        [56, 236, 255],
        [255, 224, 72],
        [255, 112, 166],
      ];
      const padCol = rainbowCols[i0 % 3]!;
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

    // Playful Sunny Turn-Arrow Signpost
    if (n0.hasChevron) {
      const side = n0.chevronSide;
      const dist = cw + 1.8;
      const sx = n0.x + n0.rx * side * dist;
      const sz = n0.z + n0.rz * side * dist;
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

    // Festive Carnival Checkered Start / Finish Archway + Hanging Pennants + Twin Golden Stars!
    if (i0 === 0) {
      const cells = 8;
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
        // Ground checkered finish line
        mb.addFlatQuad(
          { x: n0.x + n0.rx * f0, y: n0.y + 0.055, z: n0.z + n0.rz * f0 },
          { x: n0.x + n0.rx * f1, y: n0.y + 0.055, z: n0.z + n0.rz * f1 },
          { x: n1.x + n1.rx * f1, y: n1.y + 0.055, z: n1.z + n1.rz * f1 },
          { x: n1.x + n1.rx * f0, y: n1.y + 0.055, z: n1.z + n1.rz * f0 },
          c % 2 === 0 ? [255, 255, 255] : [30, 38, 56],
          MAT_MATTE,
        );
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

  // Playful low-poly world scenery baked right into the static circuit VBO!
  for (let i = 0; i < circuit.scenery.length; i += 1) {
    emitSceneryPropIntoBuilder(mb, circuit.scenery[i]!, i);
  }

  return mb;
}

function emitSceneryPropIntoBuilder(mb: MeshBuilder, prop: SceneryProp, index: number): void {
  const s = prop.scale;
  const { x, y, z } = prop;

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

out vec4 outColor;

void main() {
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

const SKY_VS = `#version 300 es
layout(location = 0) in vec2 aQuad;
out vec2 vUv;
void main() {
  vUv = aQuad * 0.5 + 0.5;
  gl_Position = vec4(aQuad, 0.999, 1.0);
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
  private worldVao: WebGLVertexArrayObject | null = null;
  private skyVao: WebGLVertexArrayObject | null = null;
  private dynamicVao: WebGLVertexArrayObject | null = null;
  private dynamicVbo: WebGLBuffer | null = null;
  private skyVbo: WebGLBuffer | null = null;

  private circuitMeshes = new Map<CircuitId, StaticGpuMesh>();
  private driverRigs = new Map<DriverCharacterId, DriverGpuRig>();
  private flameMesh: StaticGpuMesh | null = null;
  private unitBoxMesh: StaticGpuMesh | null = null;
  private contextLost = false;

  private readonly kartBasis = new Float32Array(9);
  private readonly localBasis = new Float32Array(9);
  private readonly worldPartBasis = new Float32Array(9);
  private readonly headWorldBasis = new Float32Array(9);
  private readonly dynamicScratch = new Float32Array(4096 * FLOATS_PER_VERT);

  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private skyUniforms: Record<string, WebGLUniformLocation | null> = {};

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
        powerPreference: 'default',
      });
    } catch {
      return false;
    }
    if (!gl) return false;

    const worldProg = this.compileProgram(gl, WORLD_VS, WORLD_FS);
    const skyProg = this.compileProgram(gl, SKY_VS, SKY_FS);
    if (!worldProg || !skyProg) return false;

    this.gl = gl;
    this.worldProg = worldProg;
    this.skyProg = skyProg;

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

  private getOrBakeCircuitMesh(gl: WebGL2RenderingContext, circuitId: CircuitId): StaticGpuMesh {
    const cached = this.circuitMeshes.get(circuitId);
    if (cached) return cached;
    const baked = this.uploadStaticMesh(gl, buildStaticCircuitMesh(CIRCUITS[circuitId]));
    this.circuitMeshes.set(circuitId, baked);
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

  renderViewport(
    race: KartRaceState,
    _focusSlot: number,
    cam: ChaseCamera,
    pxX: number,
    pxYFromTop: number,
    pxW: number,
    pxH: number,
    timeMs: number,
  ): boolean {
    const gl = this.gl;
    if (!gl || this.contextLost || !this.worldProg || !this.skyProg) return false;

    const circuit = CIRCUITS[race.circuitId];
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
    gl.uniform1f(this.skyUniforms.uYawPhase!, (cam.yaw / (Math.PI * 2)) * 24.0);
    gl.uniform1f(this.skyUniforms.uIsStarry!, race.circuitId === 'starlight-ring' ? 1.0 : 0.0);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 2. Static 3D Circuit World Pass (1 single draw call!)
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.worldProg);
    gl.uniform3f(this.uniforms.uCamPos!, cam.x, cam.y, cam.z);
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

    gl.bindVertexArray(this.worldVao);
    const circuitMesh = this.getOrBakeCircuitMesh(gl, race.circuitId);
    this.drawStaticMesh(gl, circuitMesh, 0, 0, 0, IDENTITY_BASIS);

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

    for (const kart of race.karts) {
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

    // 4. Playful Toy Bumper-Karts & Starlight Burst Companions
    gl.bindVertexArray(this.worldVao);
    for (const kart of race.karts) {
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

      // Bright Cartoon Rocket-Pipe Thruster Flames + Drift Sparks!
      if (this.flameMesh) {
        const flicker = 0.86 + Math.sin(timeMs * 0.045 + kart.slot) * 0.18;
        const isBoosting = kart.boostTimer > 0;
        const speedBase = Math.min(1, 0.3 + kart.speed / 45);
        const boostGain = isBoosting ? 1.55 : 1.15;
        const powers: ReadonlyArray<[number, number]> = [
          [-0.49, kart.leftThrottle * boostGain * (isBoosting ? 1 : speedBase)],
          [0.49, kart.rightThrottle * boostGain * (isBoosting ? 1 : speedBase)],
        ];
        const [fr, fg, fb] = isBoosting
          ? kart.boostKind === 'ultra'
            ? [1.0, 0.86, 0.18]
            : [0.24, 0.94, 1.0]
          : [1.0, 0.68, 0.22];

        for (const [cx, pwr] of powers) {
          if (pwr <= 0.05) continue;
          const len = (1.1 + pwr * 1.45) * flicker;
          const radScale = Math.min(1.3, 0.74 + pwr * 0.38);
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

        if (kart.driftCharge >= 0.18) {
          const [sr, sg, sb] =
            kart.driftCharge >= ULTRA_TURBO_CHARGE_SEC
              ? [1.0, 0.85, 0.18]
              : kart.driftCharge >= MINI_TURBO_CHARGE_SEC
                ? [0.22, 0.94, 1.0]
                : [1.0, 1.0, 1.0];
          const sparkLen = (0.58 + Math.min(1.1, kart.driftCharge * 0.65)) * flicker;
          for (const sx of [-1.28, 1.28]) {
            const spOff = transformOffsetByBasis(this.kartBasis, sx, 0.34, -1.42);
            this.drawStaticMesh(
              gl,
              this.flameMesh,
              kart.x + spOff.x,
              kart.y + bounceY + spOff.y,
              kart.z + spOff.z,
              this.kartBasis,
              0.56,
              0.56,
              sparkLen,
              sr,
              sg,
              sb,
            );
          }
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
      if (this.skyVbo) gl.deleteBuffer(this.skyVbo);
      if (this.worldVao) gl.deleteVertexArray(this.worldVao);
      if (this.dynamicVao) gl.deleteVertexArray(this.dynamicVao);
      if (this.skyVao) gl.deleteVertexArray(this.skyVao);
      if (this.worldProg) gl.deleteProgram(this.worldProg);
      if (this.skyProg) gl.deleteProgram(this.skyProg);
    }
    this.circuitMeshes.clear();
    this.driverRigs.clear();
    this.gl = null;
  }
}
