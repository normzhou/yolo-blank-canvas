/**
 * Zero-Dependency Static-VBO WebGL2 3D Renderer for Micro Kart (#364).
 *
 * Architecture for minimum CPU & battery consumption:
 * - Circuit road, 3D curbs, terrain, archway, chevrons, boost strips, and low-poly
 *   scenery bake ONCE per circuit into a single `gl.STATIC_DRAW` VBO (1 draw call).
 * - Smooth-subdivided plush driver meshes (`24x14` ellipsoids & `16-gon` curved tubes
 *   for Ren, Mochi, Koro, and Momo), `20-gon` cylindrical tires, and crisp faceted
 *   kart bodywork bake ONCE into static GPU VBOs.
 * - Per-frame animation (kart pose, cornering head look, tail wag/sway, scarf flutter,
 *   and thruster plasma flames) updates only lightweight uniforms (`uModelPos`,
 *   `uModelBasis`, `uModelScale`, `uTint`) with zero per-frame mesh rebuilding.
 * - Fragment shader computes per-pixel normalized Phong diffuse + Blinn-Phong sheen +
 *   plush Fresnel velvet rim lighting + atmospheric horizon fog with hardware Z-buffer.
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
  type KartState,
  type SceneryProp,
} from '../../shared/microKart';
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
    // Outward-facing quads: Top (+y), Bottom (-y), Back (-z), Front (+z), Left (-x), Right (+x)
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

/**
 * Adds a smooth UV-ellipsoid (`segsU x segsV`) with analytical ellipsoid normals
 * and an optional per-quad color selector (e.g. for cream muzzle patches!).
 */
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
    const th = (iu / segsU) * Math.PI * 2; // 0 = +z front, pi = -z rear
    const ph = (iv / segsV - 0.5) * Math.PI; // -pi/2 bottom .. +pi/2 top
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
      th,
      ph,
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

/**
 * Adds a smooth curved multi-ring tube/cone along a spine of `{ x, y, z, rx, ry, rgb }` rings,
 * capping the final ring smoothly if `rx, ry` taper near zero.
 */
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
  segs = 14,
  matKind = MAT_PLUSH,
  colorOverride?: (ringIdx: number, theta: number, defaultRgb: readonly [number, number, number]) => readonly [number, number, number],
): void {
  if (spine.length < 2) return;

  // Build local orthonormal cross-section frame `(right, up2)` at each spine node
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
    // Reference vector not parallel to tangent
    const refX = Math.abs(tx) > 0.88 ? 0 : 1;
    const refY = Math.abs(tx) > 0.88 ? 1 : 0;
    // u = normalize(cross(tangent, ref)) -> Wait: if tangent is +y [0,1,0] and ref is +x [1,0,0]:
    // let's keep `u` aligned with local X when spine goes along Y/Z!
    // cross(up_or_fwd, ref): let's project `[1, 0, 0]` perpendicular to `t`:
    let ux = 1 - tx * tx;
    let uy = -tx * ty;
    let uz = -tx * tz;
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
    // v = cross(t, u)
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
        a,
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
 * Bakes smooth 20-gon 3D cylindrical racing tires + crisp mechanical open-cockpit kart chassis!
 */
function buildKartChassisMesh(spec: KartDriverSpec): MeshBuilder {
  const mb = new MeshBuilder();
  const primary = spec.kartPrimary;
  const accent = spec.kartAccent;
  const darkMetal: [number, number, number] = [28, 34, 46];
  const tireDark: [number, number, number] = [24, 28, 38];
  const hubSilver: [number, number, number] = [148, 163, 184];
  const nozzleSteel: [number, number, number] = [71, 85, 105];

  // 1. Four Smooth 20-Gon 3D Cylindrical Racing Slicks + Alloy Wheel Hubs!
  const wheelCoords: ReadonlyArray<[number, number]> = [
    [-1.16, 1.15],
    [1.16, 1.15],
    [-1.24, -1.12],
    [1.24, -1.12],
  ];
  const WN = 20;
  const wR = 0.34;
  const wCy = 0.38;
  const wHalf = 0.24;
  for (const [wx, wz] of wheelCoords) {
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
      // Inner & outer tire sidewalls + outer alloy wheel hub!
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
          [32, 38, 50],
          MAT_GLOSSY,
        );
        if ((wx < 0 && side < 0) || (wx > 0 && side > 0)) {
          const hx = sx + side * 0.012;
          const hr = wR * 0.48;
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
            hubSilver,
            MAT_GLOSSY,
          );
        }
      }
    }
  }

  // 2. Crisp Glossy Sculpted Wedge Nose & Open-Cockpit Side Pods
  const nTipL = { x: -0.46, y: 0.22, z: 2.08 };
  const nTipR = { x: 0.46, y: 0.22, z: 2.08 };
  const nTopL = { x: -0.46, y: 0.42, z: 2.02 };
  const nTopR = { x: 0.46, y: 0.42, z: 2.02 };
  const cMidL = { x: -0.74, y: 0.62, z: 0.55 };
  const cMidR = { x: 0.74, y: 0.62, z: 0.55 };
  const cBotL = { x: -0.74, y: 0.2, z: 0.55 };
  const cBotR = { x: 0.74, y: 0.2, z: 0.55 };
  mb.addFlatQuad(nTopL, cMidL, cMidR, nTopR, primary, MAT_GLOSSY);
  mb.addFlatQuad(nTipL, nTopL, nTopR, nTipR, accent, MAT_GLOSSY);
  mb.addFlatQuad(nTipL, nTipR, nTopR, nTopL, accent, MAT_GLOSSY);
  mb.addFlatQuad(nTipL, nTopL, cMidL, cBotL, primary, MAT_GLOSSY);
  mb.addFlatQuad(cBotR, cMidR, nTopR, nTipR, primary, MAT_GLOSSY);

  mb.addBox(-1.04, 0.2, -0.95, -0.58, 0.56, 0.68, primary, MAT_GLOSSY);
  mb.addBox(0.58, 0.2, -0.95, 1.04, 0.56, 0.68, primary, MAT_GLOSSY);
  mb.addBox(-1.05, 0.525, -0.82, -0.59, 0.595, 0.55, accent, MAT_GLOSSY);
  mb.addBox(0.59, 0.525, -0.82, 1.05, 0.595, 0.55, accent, MAT_GLOSSY);

  mb.addBox(-0.78, 0.22, -1.58, 0.78, 0.62, -0.48, primary, MAT_GLOSSY);
  mb.addBox(-0.88, 0.16, -1.66, 0.88, 0.32, -1.54, darkMetal, MAT_GLOSSY);

  // Open Cockpit Floor + Seat Cushion
  mb.addBox(-0.56, 0.3, -0.52, 0.56, 0.57, 0.52, darkMetal, MAT_GLOSSY);
  mb.addBox(-0.44, 0.54, -0.56, 0.44, 0.72, -0.38, darkMetal, MAT_GLOSSY);

  // Twin Canted Outer Side Winglets (double-sided 3D thickness so solid from every angle!)
  for (const side of [-1, 1] as const) {
    const wxIn = side * 0.84;
    const wxOut = side * 1.12;
    const dx = side * 0.035;
    const f0 = { x: wxIn, y: 0.58, z: -0.92 };
    const f1 = { x: wxIn, y: 0.62, z: -1.54 };
    const t0 = { x: wxOut, y: 1.08, z: -1.16 };
    const t1 = { x: wxOut, y: 1.14, z: -1.68 };
    const f0b = { x: wxIn + dx, y: 0.58, z: -0.92 };
    const f1b = { x: wxIn + dx, y: 0.62, z: -1.54 };
    const t0b = { x: wxOut + dx, y: 1.08, z: -1.16 };
    const t1b = { x: wxOut + dx, y: 1.14, z: -1.68 };
    mb.addFlatQuad(f0, f1, t1, t0, accent, MAT_GLOSSY);
    mb.addFlatQuad(f1b, f0b, t0b, t1b, accent, MAT_GLOSSY);
    mb.addFlatQuad(t0, t1, t1b, t0b, primary, MAT_GLOSSY);
  }

  // Twin Rear Thruster Nozzles
  mb.addBox(-0.62, 0.28, -1.84, -0.26, 0.56, -1.54, nozzleSteel, MAT_GLOSSY);
  mb.addBox(0.26, 0.28, -1.84, 0.62, 0.56, -1.54, nozzleSteel, MAT_GLOSSY);

  return mb;
}

/**
 * Bakes smooth plush Torso + Paws + Steering Wheel + Torus Neck Collar (`kart` space).
 */
function buildDriverTorsoMesh(spec: KartDriverSpec): MeshBuilder {
  const mb = new MeshBuilder();
  // Smooth plush torso
  emitSmoothSpineTube(
    mb,
    [
      { x: 0, y: 0.58, z: -0.2, rx: 0.33, ry: 0.25, rgb: spec.furPrimary },
      { x: 0, y: 0.78, z: -0.18, rx: 0.32, ry: 0.24, rgb: spec.furPrimary },
      { x: 0, y: 0.98, z: -0.15, rx: 0.27, ry: 0.21, rgb: spec.furPrimary },
    ],
    16,
    MAT_PLUSH,
  );
  // Smooth plush neck scarf collar
  emitSmoothEllipsoid(
    mb,
    0,
    0.96,
    -0.15,
    0.33,
    0.075,
    0.27,
    18,
    8,
    () => spec.scarfRgb,
    MAT_PLUSH,
  );
  // Smooth steering column + wheel + plush arms & round paws!
  emitSmoothEllipsoid(mb, 0, 0.86, 0.28, 0.22, 0.2, 0.045, 16, 8, () => [24, 28, 38], MAT_GLOSSY);
  for (const side of [-1, 1] as const) {
    emitSmoothSpineTube(
      mb,
      [
        { x: side * 0.25, y: 0.9, z: -0.1, rx: 0.085, ry: 0.085, rgb: spec.furPrimary },
        { x: side * 0.22, y: 0.87, z: 0.24, rx: 0.075, ry: 0.075, rgb: spec.furPrimary },
      ],
      10,
      MAT_PLUSH,
    );
    emitSmoothEllipsoid(
      mb,
      side * 0.21,
      0.86,
      0.27,
      0.085,
      0.08,
      0.085,
      12,
      8,
      () => spec.furCream,
      MAT_PLUSH,
    );
  }
  return mb;
}

/**
 * Bakes smooth `24 x 14` plush Animal Head + Snout + Sparkling Eyes + Aviator Goggles
 * + Species-Specific Smooth Curved Ears & Satin Bows (centered at head pivot `(0, 0, 0)`!).
 */
function buildDriverHeadMesh(charId: DriverCharacterId): MeshBuilder {
  const spec = getKartDriverSpec(charId);
  const mb = new MeshBuilder();
  const darkCharcoal: [number, number, number] = [24, 28, 38];

  // 1. Silky-smooth 24x14 Plush Ellipsoid Head (`rx=0.43, ry=0.38, rz=0.40`)
  emitSmoothEllipsoid(
    mb,
    0,
    0,
    0,
    0.435,
    0.385,
    0.4,
    24,
    14,
    (th, ph) => {
      // Soft cream lower-front cheek & muzzle patch!
      if (ph < -0.06 && Math.cos(th) > 0.28) return spec.furCream;
      return spec.furPrimary;
    },
    MAT_PLUSH,
  );

  // 2. Smooth 3D Muzzle / Snout + Glossy Cute Nose Button + Sparkling Plush Eyes + Rosy Cheeks
  const snoutLen = charId === 'fox' || charId === 'dog' ? 0.51 : 0.43;
  emitSmoothSpineTube(
    mb,
    [
      { x: 0, y: -0.08, z: 0.3, rx: 0.17, ry: 0.12, rgb: spec.furCream },
      { x: 0, y: -0.075, z: (0.3 + snoutLen) * 0.5, rx: 0.11, ry: 0.085, rgb: spec.furCream },
      { x: 0, y: -0.07, z: snoutLen, rx: 0.03, ry: 0.025, rgb: spec.furCream },
    ],
    14,
    MAT_PLUSH,
  );
  // Glossy button nose
  emitSmoothEllipsoid(
    mb,
    0,
    -0.06,
    snoutLen + 0.02,
    0.052,
    0.04,
    0.038,
    12,
    8,
    () => (charId === 'cat' || charId === 'bunny' ? [244, 92, 132] : darkCharcoal),
    MAT_GLOSSY,
  );

  // Smooth oval plush eyes + white eye-shine spheres + rosy blush ovals
  for (const side of [-1, 1] as const) {
    emitSmoothEllipsoid(mb, side * 0.185, 0.025, 0.378, 0.058, 0.072, 0.032, 12, 8, () => darkCharcoal, MAT_GLOSSY);
    emitSmoothEllipsoid(
      mb,
      side * 0.185 - 0.02,
      0.058,
      0.408,
      0.022,
      0.024,
      0.018,
      10,
      6,
      () => [255, 255, 255],
      MAT_GLOSSY,
      1,
    );
    emitSmoothEllipsoid(
      mb,
      side * 0.28,
      -0.075,
      0.325,
      0.058,
      0.038,
      0.028,
      10,
      6,
      () => [248, 113, 133],
      MAT_PLUSH,
    );
  }

  // 3. Smooth 24-gon Wraparound Aviator Goggle Band + Forehead Gold-Rimmed Cyan Goggle Cups
  for (let i = 0; i < 24; i += 1) {
    const t0 = (i / 24) * Math.PI * 2;
    const t1 = ((i + 1) / 24) * Math.PI * 2;
    const n0 = norm3(Math.sin(t0), 0.25, Math.cos(t0));
    const n1 = norm3(Math.sin(t1), 0.25, Math.cos(t1));
    mb.addSmoothQuad(
      { x: Math.sin(t0) * 0.432, y: 0.135, z: Math.cos(t0) * 0.398 },
      { x: Math.sin(t1) * 0.432, y: 0.135, z: Math.cos(t1) * 0.398 },
      { x: Math.sin(t1) * 0.412, y: 0.205, z: Math.cos(t1) * 0.38 },
      { x: Math.sin(t0) * 0.412, y: 0.205, z: Math.cos(t0) * 0.38 },
      n0,
      n1,
      n1,
      n0,
      darkCharcoal,
      MAT_GLOSSY,
    );
  }
  for (const side of [-1, 1] as const) {
    const gx = side * 0.165;
    mb.addBox(gx - 0.115, 0.135, 0.33, gx + 0.115, 0.275, 0.385, [248, 212, 76], MAT_GLOSSY);
    mb.addBox(gx - 0.088, 0.155, 0.36, gx + 0.088, 0.255, 0.405, [96, 232, 255], MAT_GLOSSY, 1);
  }

  // 4. Species-Specific Smooth Curved 3D Ears & Signature Accessories!
  if (charId === 'fox') {
    for (const side of [-1, 1] as const) {
      emitSmoothSpineTube(
        mb,
        [
          { x: side * 0.23, y: 0.25, z: -0.01, rx: 0.145, ry: 0.095, rgb: spec.furPrimary },
          { x: side * 0.35, y: 0.53, z: -0.01, rx: 0.105, ry: 0.068, rgb: spec.furPrimary },
          { x: side * 0.43, y: 0.68, z: -0.01, rx: 0.068, ry: 0.045, rgb: spec.furSecondary },
          { x: side * 0.49, y: 0.84, z: -0.01, rx: 0.012, ry: 0.01, rgb: spec.furSecondary },
        ],
        14,
        MAT_PLUSH,
        (ringIdx, theta, defRgb) => {
          // Cream inner ear hollow on front-facing (+z, sin(theta) < 0) half of lower two ear rings!
          if (ringIdx < 2 && Math.sin(theta) < -0.25) return spec.furCream;
          return defRgb;
        },
      );
      // Smooth plush cream cheek tufts!
      emitSmoothSpineTube(
        mb,
        [
          { x: side * 0.32, y: -0.09, z: 0.02, rx: 0.11, ry: 0.095, rgb: spec.furCream },
          { x: side * 0.47, y: -0.1, z: -0.01, rx: 0.065, ry: 0.055, rgb: spec.furCream },
          { x: side * 0.58, y: -0.12, z: -0.03, rx: 0.012, ry: 0.01, rgb: spec.furCream },
        ],
        10,
        MAT_PLUSH,
      );
    }
  } else if (charId === 'cat') {
    for (const side of [-1, 1] as const) {
      emitSmoothSpineTube(
        mb,
        [
          { x: side * 0.21, y: 0.26, z: 0.0, rx: 0.135, ry: 0.085, rgb: spec.furPrimary },
          { x: side * 0.3, y: 0.54, z: 0.0, rx: 0.085, ry: 0.055, rgb: spec.furPrimary },
          { x: side * 0.36, y: 0.79, z: 0.0, rx: 0.012, ry: 0.01, rgb: spec.furPrimary },
        ],
        14,
        MAT_PLUSH,
        (_ringIdx, theta, defRgb) => (Math.sin(theta) < -0.28 ? spec.furSecondary : defRgb),
      );
      // Sleek plush cat whiskers
      for (const wy of [-0.05, -0.11]) {
        mb.addBox(
          side > 0 ? 0.34 : -0.56,
          wy - 0.012,
          0.08,
          side > 0 ? 0.56 : -0.34,
          wy + 0.012,
          0.105,
          spec.furCream,
          MAT_PLUSH,
        );
      }
    }
    // Smooth 3D Rose Satin Ear Bow + Golden Center Knot at right ear base!
    emitSmoothEllipsoid(mb, 0.25, 0.33, -0.06, 0.05, 0.05, 0.05, 10, 8, () => [252, 211, 77], MAT_GLOSSY);
    emitSmoothEllipsoid(mb, 0.14, 0.35, -0.06, 0.095, 0.065, 0.04, 12, 8, () => spec.scarfRgb, MAT_PLUSH);
    emitSmoothEllipsoid(mb, 0.36, 0.32, -0.06, 0.095, 0.065, 0.04, 12, 8, () => spec.scarfRgb, MAT_PLUSH);
  } else if (charId === 'dog') {
    for (const side of [-1, 1] as const) {
      emitSmoothSpineTube(
        mb,
        [
          { x: side * 0.26, y: 0.24, z: -0.02, rx: 0.11, ry: 0.075, rgb: spec.furSecondary },
          { x: side * 0.49, y: 0.21, z: -0.03, rx: 0.125, ry: 0.08, rgb: spec.furSecondary },
          { x: side * 0.56, y: 0.04, z: -0.04, rx: 0.11, ry: 0.07, rgb: spec.furSecondary },
          { x: side * 0.57, y: -0.15, z: -0.05, rx: 0.04, ry: 0.03, rgb: spec.furSecondary },
        ],
        12,
        MAT_PLUSH,
      );
    }
  } else {
    // `bunny` (`Momo`): Tall smooth curved Berry-Pink Bunny Ears + Golden Inner Strips + Golden Bow!
    for (const side of [-1, 1] as const) {
      emitSmoothSpineTube(
        mb,
        [
          { x: side * 0.15, y: 0.3, z: -0.02, rx: 0.095, ry: 0.055, rgb: spec.furPrimary },
          { x: side * 0.21, y: 0.68, z: -0.09, rx: 0.115, ry: 0.06, rgb: spec.furPrimary },
          { x: side * 0.24, y: 1.02, z: -0.18, rx: 0.095, ry: 0.05, rgb: spec.furPrimary },
          { x: side * 0.26, y: 1.26, z: -0.26, rx: 0.022, ry: 0.018, rgb: spec.furPrimary },
        ],
        14,
        MAT_PLUSH,
        (ringIdx, theta, defRgb) => {
          if (ringIdx < 2 && Math.sin(theta) < -0.35) return spec.furSecondary;
          return defRgb;
        },
      );
    }
    emitSmoothEllipsoid(mb, -0.2, 0.34, -0.05, 0.048, 0.048, 0.048, 10, 8, () => [255, 245, 200], MAT_GLOSSY);
    emitSmoothEllipsoid(mb, -0.3, 0.36, -0.05, 0.088, 0.06, 0.038, 12, 8, () => spec.scarfRgb, MAT_PLUSH);
    emitSmoothEllipsoid(mb, -0.1, 0.33, -0.05, 0.088, 0.06, 0.038, 12, 8, () => spec.scarfRgb, MAT_PLUSH);
  }

  return mb;
}

/**
 * Bakes smooth species-specific 3D Tail mesh centered at tail root pivot `(0, 0, 0)`!
 */
function buildDriverTailMesh(charId: DriverCharacterId): MeshBuilder {
  const spec = getKartDriverSpec(charId);
  const mb = new MeshBuilder();

  if (charId === 'fox') {
    emitSmoothSpineTube(
      mb,
      [
        { x: 0, y: 0, z: 0, rx: 0.12, ry: 0.12, rgb: spec.furPrimary },
        { x: 0.08, y: 0.16, z: -0.24, rx: 0.21, ry: 0.2, rgb: spec.furPrimary },
        { x: 0.18, y: 0.34, z: -0.46, rx: 0.25, ry: 0.24, rgb: spec.furPrimary },
        { x: 0.27, y: 0.5, z: -0.62, rx: 0.16, ry: 0.16, rgb: spec.furCream },
        { x: 0.35, y: 0.66, z: -0.76, rx: 0.025, ry: 0.025, rgb: spec.furCream },
      ],
      16,
      MAT_PLUSH,
    );
  } else if (charId === 'cat') {
    emitSmoothSpineTube(
      mb,
      [
        { x: 0, y: 0, z: 0, rx: 0.08, ry: 0.08, rgb: spec.furPrimary },
        { x: 0.06, y: 0.26, z: -0.28, rx: 0.082, ry: 0.082, rgb: spec.furPrimary },
        { x: 0.14, y: 0.56, z: -0.44, rx: 0.078, ry: 0.078, rgb: spec.furPrimary },
        { x: 0.24, y: 0.76, z: -0.5, rx: 0.07, ry: 0.07, rgb: spec.furCream },
        { x: 0.36, y: 0.8, z: -0.52, rx: 0.03, ry: 0.03, rgb: spec.furCream },
      ],
      12,
      MAT_PLUSH,
    );
  } else if (charId === 'dog') {
    emitSmoothSpineTube(
      mb,
      [
        { x: 0, y: 0, z: 0, rx: 0.1, ry: 0.1, rgb: spec.furPrimary },
        { x: -0.08, y: 0.22, z: -0.32, rx: 0.15, ry: 0.15, rgb: spec.furPrimary },
        { x: -0.14, y: 0.48, z: -0.42, rx: 0.14, ry: 0.14, rgb: spec.furCream },
        { x: -0.16, y: 0.62, z: -0.28, rx: 0.065, ry: 0.065, rgb: spec.furCream },
      ],
      14,
      MAT_PLUSH,
    );
  } else {
    // Round fluffy snow-white pom-pom bunny tail!
    emitSmoothEllipsoid(mb, 0, 0.16, -0.22, 0.22, 0.21, 0.22, 18, 12, () => spec.furCream, MAT_PLUSH);
  }

  return mb;
}

function buildScarfTailMesh(spec: KartDriverSpec): MeshBuilder {
  const mb = new MeshBuilder();
  for (const side of [-1, 1] as const) {
    const x0 = -0.1 + side * 0.11;
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
  // Smooth 12-gon unit plasma cone (`z = 0 .. -1.0`, radius `0.21`) tinted via `uTint`!
  emitSmoothSpineTube(
    mb,
    [
      { x: 0, y: 0, z: 0, rx: 0.2, ry: 0.2, rgb: [255, 255, 255], emissive: 1 },
      { x: 0, y: 0, z: -0.45, rx: 0.14, ry: 0.14, rgb: [255, 255, 255], emissive: 1 },
      { x: 0, y: 0, z: -1.0, rx: 0.01, ry: 0.01, rgb: [255, 255, 255], emissive: 1 },
    ],
    12,
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
 * Bakes the entire 192-segment closed 3D circuit + curbs + boost pads + checkered arch
 * + chevrons + smooth conical low-poly pines/spires/pylons into ONE static GPU VBO!
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
  const cw = rw + 1.45;
  const gw = rw + 190;
  const curbH = 0.28;

  for (let i0 = 0; i0 < N; i0 += 1) {
    const i1 = (i0 + 1) % N;
    const n0 = nodes[i0]!;
    const n1 = nodes[i1]!;
    const even = i0 % 2 === 0;
    const gRgb = even ? groundOuter : groundAlt;

    // Terrain shoulders (slightly below road so zero Z overlap)
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

    // Asphalt road quad
    mb.addFlatQuad(
      { x: n0.x - n0.rx * rw, y: n0.y, z: n0.z - n0.rz * rw },
      { x: n0.x + n0.rx * rw, y: n0.y, z: n0.z + n0.rz * rw },
      { x: n1.x + n1.rx * rw, y: n1.y, z: n1.z + n1.rz * rw },
      { x: n1.x - n1.rx * rw, y: n1.y, z: n1.z - n1.rz * rw },
      even ? roadDark : roadLight,
      MAT_MATTE,
    );

    // Center dashed racing line (`+0.045m` crisp above asphalt)
    if (even && i0 !== 0) {
      const lw = 0.36;
      mb.addFlatQuad(
        { x: n0.x - n0.rx * lw, y: n0.y + 0.045, z: n0.z - n0.rz * lw },
        { x: n0.x + n0.rx * lw, y: n0.y + 0.045, z: n0.z + n0.rz * lw },
        { x: n1.x + n1.rx * lw, y: n1.y + 0.045, z: n1.z + n1.rz * lw },
        { x: n1.x - n1.rx * lw, y: n1.y + 0.045, z: n1.z - n1.rz * lw },
        [203, 213, 225],
        MAT_MATTE,
      );
    }

    // Raised 3D rumble curbs (top + inner vertical riser + outer vertical riser)
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

    // Glowing Turbo Boost Strip (`+0.065m`)
    if (n0.hasBoostPad) {
      const bl = n0.boostLat;
      const bw = 2.8;
      mb.addFlatQuad(
        { x: n0.x + n0.rx * (bl - bw), y: n0.y + 0.065, z: n0.z + n0.rz * (bl - bw) },
        { x: n0.x + n0.rx * (bl + bw), y: n0.y + 0.065, z: n0.z + n0.rz * (bl + bw) },
        { x: n1.x + n1.rx * (bl + bw), y: n1.y + 0.065, z: n1.z + n1.rz * (bl + bw) },
        { x: n1.x + n1.rx * (bl - bw), y: n1.y + 0.065, z: n1.z + n1.rz * (bl - bw) },
        even ? [56, 232, 255] : [250, 204, 21],
        MAT_GLOSSY,
        1,
      );
    }

    // Turn-Warning Chevron Signpost
    if (n0.hasChevron) {
      const side = n0.chevronSide;
      const dist = cw + 1.8;
      const sx = n0.x + n0.rx * side * dist;
      const sz = n0.z + n0.rz * side * dist;
      const sw = 1.6;
      mb.addFlatQuad(
        { x: sx - n0.rx * sw, y: n0.y + 0.6, z: sz - n0.rz * sw },
        { x: sx + n0.rx * sw, y: n0.y + 0.6, z: sz + n0.rz * sw },
        { x: sx + n0.rx * sw, y: n0.y + 2.8, z: sz + n0.rz * sw },
        { x: sx - n0.rx * sw, y: n0.y + 2.8, z: sz - n0.rz * sw },
        [246, 215, 67],
        MAT_GLOSSY,
        1,
      );
    }

    // Checkered Start / Finish Archway at segment 0
    if (i0 === 0) {
      const cells = 8;
      for (let c = 0; c < cells; c += 1) {
        const f0 = -rw + (c / cells) * (rw * 2);
        const f1 = -rw + ((c + 1) / cells) * (rw * 2);
        mb.addFlatQuad(
          { x: n0.x + n0.rx * f0, y: n0.y + 0.055, z: n0.z + n0.rz * f0 },
          { x: n0.x + n0.rx * f1, y: n0.y + 0.055, z: n0.z + n0.rz * f1 },
          { x: n1.x + n1.rx * f1, y: n1.y + 0.055, z: n1.z + n1.rz * f1 },
          { x: n1.x + n1.rx * f0, y: n1.y + 0.055, z: n1.z + n1.rz * f0 },
          c % 2 === 0 ? [248, 250, 252] : [15, 23, 42],
          MAT_MATTE,
        );
        mb.addFlatQuad(
          { x: n0.x + n0.rx * f0, y: n0.y + 7.2, z: n0.z + n0.rz * f0 },
          { x: n0.x + n0.rx * f1, y: n0.y + 7.2, z: n0.z + n0.rz * f1 },
          { x: n0.x + n0.rx * f1, y: n0.y + 9.0, z: n0.z + n0.rz * f1 },
          { x: n0.x + n0.rx * f0, y: n0.y + 9.0, z: n0.z + n0.rz * f0 },
          c % 2 === 0 ? [246, 215, 67] : [30, 41, 59],
          MAT_GLOSSY,
          c % 2 === 0 ? 1 : 0,
        );
      }
      for (const side of [-1, 1] as const) {
        const px = n0.x + n0.rx * side * (rw + 1.0);
        const pz = n0.z + n0.rz * side * (rw + 1.0);
        mb.addBox(px - 0.65, n0.y, pz - 0.65, px + 0.65, n0.y + 9.2, pz + 0.65, [226, 232, 240], MAT_GLOSSY);
      }
    }
  }

  // Smooth conical pines / faceted canyon spires / glowing neon pylons baked right into the static circuit VBO!
  for (const prop of circuit.scenery) {
    emitSceneryPropIntoBuilder(mb, prop);
  }

  return mb;
}

function emitSceneryPropIntoBuilder(mb: MeshBuilder, prop: SceneryProp): void {
  const s = prop.scale;
  const { x, y, z } = prop;
  if (prop.kind === 'pine') {
    emitSmoothSpineTube(
      mb,
      [
        { x, y, z, rx: 0.52 * s, ry: 0.52 * s, rgb: [96, 64, 42] },
        { x, y: y + 2.4 * s, z, rx: 0.44 * s, ry: 0.44 * s, rgb: [96, 64, 42] },
      ],
      8,
      MAT_MATTE,
    );
    emitSmoothSpineTube(
      mb,
      [
        { x, y: y + 1.8 * s, z, rx: 2.6 * s, ry: 2.6 * s, rgb: [38, 128, 76] },
        { x, y: y + 6.4 * s, z, rx: 0.08 * s, ry: 0.08 * s, rgb: [46, 148, 86] },
      ],
      10,
      MAT_PLUSH,
    );
    emitSmoothSpineTube(
      mb,
      [
        { x, y: y + 4.8 * s, z, rx: 1.95 * s, ry: 1.95 * s, rgb: [52, 158, 92] },
        { x, y: y + 9.4 * s, z, rx: 0.06 * s, ry: 0.06 * s, rgb: [64, 178, 104] },
      ],
      10,
      MAT_PLUSH,
    );
    return;
  }
  if (prop.kind === 'spire') {
    emitSmoothSpineTube(
      mb,
      [
        { x, y, z, rx: 2.5 * s, ry: 2.5 * s, rgb: [186, 98, 58] },
        { x, y: y + 11.5 * s, z, rx: 0.1 * s, ry: 0.1 * s, rgb: [212, 118, 72] },
      ],
      6,
      MAT_MATTE,
    );
    return;
  }
  const w = 0.75 * s;
  const h = 9.2 * s;
  mb.addBox(x - w, y, z - w, x + w, y + h, z + w, [44, 62, 112], MAT_GLOSSY);
  mb.addBox(x - w * 1.12, y + h * 0.72, z - w * 1.12, x + w * 1.12, y + h * 0.9, z + w * 1.12, [57, 197, 207], MAT_GLOSSY, 1);
}

interface StaticGpuMesh {
  vbo: WebGLBuffer;
  count: number;
}

interface DriverGpuRig {
  chassis: StaticGpuMesh;
  torso: StaticGpuMesh;
  head: StaticGpuMesh;
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
    float wrap = max(0.0, 0.55 * ndl + 0.45);
    float diff = 0.52 + wrap * 0.56;

    float isPlush = step(0.5, vFlags.x) * (1.0 - step(1.5, vFlags.x));
    float isGlossy = 1.0 - step(0.5, vFlags.x);

    vec3 H = normalize(uSun + V);
    float spec = isGlossy * pow(max(dot(N, H), 0.0), 38.0) * 0.28
               + isPlush * pow(max(dot(N, H), 0.0), 14.0) * 0.10;
    float fresnel = isPlush * pow(1.0 - max(dot(N, V), 0.0), 2.5) * 0.28;

    lit = base * diff + vec3(1.0, 0.96, 0.90) * (spec + fresnel);
  }

  float fogT = clamp((vDepth - 98.0) / (325.0 - 98.0), 0.0, 0.84);
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
out vec4 outColor;

void main() {
  if (vUv.y < uHorizonUvY) {
    outColor = vec4(uGround, 1.0);
    return;
  }
  // Procedural low-poly mountain ridge along horizon!
  float xPhase = vUv.x * 24.0 + uYawPhase;
  float i0 = floor(xPhase);
  float f = fract(xPhase);
  float h0 = abs(sin(i0 * 1.7 + 0.4)) * 0.65 + abs(cos(i0 * 0.9)) * 0.35;
  float h1 = abs(sin((i0 + 1.0) * 1.7 + 0.4)) * 0.65 + abs(cos((i0 + 1.0) * 0.9)) * 0.35;
  float ridgeH = mix(h0, h1, f) * 0.095;
  if (vUv.y < uHorizonUvY + ridgeH) {
    outColor = vec4(uMountain, 1.0);
    return;
  }
  float t = clamp((vUv.y - uHorizonUvY) / max(0.05, 1.0 - uHorizonUvY), 0.0, 1.0);
  outColor = vec4(mix(uSkyHorizon, uSkyTop, pow(t, 0.85)), 1.0);
}
`;

const IDENTITY_BASIS = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/**
 * Computes column-major `3x3` basis matrix `[right, up, forward]` for Euler `(yaw, pitch, roll)`
 * matching `makeKartTransform` in `renderer3d.ts` 100%!
 */
function eulerToBasis3(out: Float32Array, yaw: number, pitch: number, roll: number): Float32Array {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  // Transform unit X=(1,0,0), Y=(0,1,0), Z=(0,0,1) through Roll -> Pitch -> Yaw:
  // Column 0 (local +X): x1=cr, y1=sr, z1=0 -> x2=cr, y2=sr*cp, z2=sr*sp -> wx=cr*cy+sr*sp*sy, wy=sr*cp, wz=-cr*sy+sr*sp*cy
  out[0] = cr * cy + sr * sp * sy;
  out[1] = sr * cp;
  out[2] = -cr * sy + sr * sp * cy;

  // Column 1 (local +Y): x1=-sr, y1=cr, z1=0 -> x2=-sr, y2=cr*cp, z2=cr*sp -> wx=-sr*cy+cr*sp*sy, wy=cr*cp, wz=sr*sy+cr*sp*cy
  out[3] = -sr * cy + cr * sp * sy;
  out[4] = cr * cp;
  out[5] = sr * sy + cr * sp * cy;

  // Column 2 (local +Z): x1=0, y1=0, z1=1 -> x2=0, y2=-sp, z2=cp -> wx=cp*sy, wy=-sp, wz=cp*cy
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

  // Pre-allocated scratch buffers so per-frame JS GC churn is literally ZERO!
  private readonly kartBasis = new Float32Array(9);
  private readonly localBasis = new Float32Array(9);
  private readonly worldPartBasis = new Float32Array(9);
  private readonly dynamicScratch = new Float32Array(4096 * FLOATS_PER_VERT);

  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private skyUniforms: Record<string, WebGLUniformLocation | null> = {};

  private readonly sunDir = (() => {
    const l = Math.hypot(0.42, 0.78, -0.46);
    return [0.42 / l, 0.78 / l, -0.46 / l] as const;
  })();

  constructor(private readonly canvas: HTMLCanvasElement, private readonly onUnrecoverableFallback?: () => void) {
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

  private compileProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
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
    };

    // Fullscreen sky quad VAO
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

    // Static world/kart VAO (re-bound per static VBO)
    this.worldVao = gl.createVertexArray()!;

    // Dynamic VAO + VBO for skid marks & contact shadows
    const dynVao = gl.createVertexArray()!;
    gl.bindVertexArray(dynVao);
    const dynVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, dynVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.dynamicScratch.byteLength, gl.DYNAMIC_DRAW);
    this.bindWorldAttribs(gl);
    this.dynamicVao = dynVao;
    this.dynamicVbo = dynVbo;
    gl.bindVertexArray(null);

    // Pre-bake static driver rigs for all 4 Starlight Burst companions + shared flame/box VBOs!
    for (const drv of KART_DRIVERS) {
      this.driverRigs.set(drv.id, {
        chassis: this.uploadStaticMesh(gl, buildKartChassisMesh(drv)),
        torso: this.uploadStaticMesh(gl, buildDriverTorsoMesh(drv)),
        head: this.uploadStaticMesh(gl, buildDriverHeadMesh(drv.id)),
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

  /**
   * Renders one 3D viewport into pixel rectangle `(pxX, pxYFromTop, pxW, pxH)` of the WebGL2 canvas.
   */
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

    const circuit = CIRCUITS[race.circuitId];
    const totalH = this.canvas.height;
    const glY = totalH - pxYFromTop - pxH;

    gl.enable(gl.SCISSOR_TEST);
    gl.viewport(pxX, glY, pxW, pxH);
    gl.scissor(pxX, glY, pxW, pxH);

    // Camera basis & focal projection matching `renderer3d.ts`
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
    const centerRatio = isWideSplit ? 0.48 : 0.52; // from top
    // Screen Y = centerRatio * H - (vy / vz) * focal -> NDC Y = 1 - 2*centerRatio + (2*focal/H)*(vy/vz)
    const centerYBias = 1.0 - 2.0 * centerRatio;
    const horizonPxFromTop = Math.max(
      pxH * 0.12,
      Math.min(pxH * 0.78, centerRatio * pxH + Math.tan(cam.pitch) * focal),
    );
    const horizonUvY = 1.0 - horizonPxFromTop / Math.max(1, pxH);

    // 1. Sky + Low-Poly Horizon Mountain Pass
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
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 2. Static 3D Circuit World Pass (1 single draw call for the whole track + trees/spires/pylons!)
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

    // 3. Contact Shadows + Drift Tire Skid Marks (with hardware polygonOffset so zero Z-fighting!)
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
      const srx = Math.cos(shYaw) * 1.38;
      const srz = -Math.sin(shYaw) * 1.38;
      const sfx = Math.sin(shYaw) * 2.18;
      const sfz = Math.cos(shYaw) * 2.18;
      const sy = kart.y + 0.05;
      pushDynQuad(
        kart.x - srx - sfx, sy, kart.z - srz - sfz,
        kart.x + srx - sfx, sy, kart.z + srz - sfz,
        kart.x + srx + sfx, sy, kart.z + srz + sfz,
        kart.x - srx + sfx, sy, kart.z - srz + sfz,
        0.04, 0.05, 0.08,
      );

      const marks = kart.skidMarks;
      for (let i = 1; i < marks.length; i += 1) {
        const a = marks[i - 1]!;
        const b = marks[i]!;
        if (Math.hypot(b.lx - a.lx, b.lz - a.lz) < 4.5) {
          pushDynQuad(
            a.lx - 0.14, a.ly, a.lz,
            a.lx + 0.14, a.ly, a.lz,
            b.lx + 0.14, b.ly, b.lz,
            b.lx - 0.14, b.ly, b.lz,
            0.06, 0.075, 0.11,
          );
          pushDynQuad(
            a.rx - 0.14, a.ry, a.rz,
            a.rx + 0.14, a.ry, a.rz,
            b.rx + 0.14, b.ry, b.rz,
            b.rx - 0.14, b.ry, b.rz,
            0.06, 0.075, 0.11,
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

    // 4. Articulated Smooth 3D Karts + Starlight Burst Companions (Zero CPU vertex math!)
    gl.bindVertexArray(this.worldVao);
    for (const kart of race.karts) {
      const rig = this.driverRigs.get(kart.character) ?? this.driverRigs.get('fox')!;
      eulerToBasis3(this.kartBasis, kart.yaw + kart.driftYaw, kart.pitch, -kart.bodyRoll);

      // Chassis + 20-gon tires + torso
      this.drawStaticMesh(gl, rig.chassis, kart.x, kart.y, kart.z, this.kartBasis);
      this.drawStaticMesh(gl, rig.torso, kart.x, kart.y, kart.z, this.kartBasis);

      // Rear crimson LED tail / brake bar
      if (this.unitBoxMesh) {
        const bOff = transformOffsetByBasis(this.kartBasis, 0, kart.braking ? 0.61 : 0.59, -1.6);
        this.drawStaticMesh(
          gl,
          this.unitBoxMesh,
          kart.x + bOff.x,
          kart.y + bOff.y,
          kart.z + bOff.z,
          this.kartBasis,
          kart.braking ? 1.52 : 1.32,
          kart.braking ? 0.14 : 0.08,
          0.07,
          1.0,
          kart.braking ? 0.14 : 0.25,
          kart.braking ? 0.22 : 0.32,
        );
      }

      // Articulated Head (`headYaw`, `headPitch`, `headRoll` around neck `(0, 1.23, -0.14)`)
      const steerDir =
        kart.driftDir !== 0
          ? kart.driftDir
          : !kart.leftThruster && kart.rightThruster
            ? -1
            : kart.leftThruster && !kart.rightThruster
              ? 1
              : 0;
      const speedRatio = Math.min(1.25, kart.speed / 76);
      const headYaw = steerDir * 0.3;
      const headRoll = -steerDir * 0.16;
      const headPitch =
        (kart.braking ? 0.12 : -0.04 * speedRatio) +
        Math.sin(timeMs * 0.012 + kart.slot) * 0.025;
      eulerToBasis3(this.localBasis, headYaw, headPitch, headRoll);
      mulBasis3(this.worldPartBasis, this.kartBasis, this.localBasis);
      const headOff = transformOffsetByBasis(this.kartBasis, 0, 1.23, -0.14);
      this.drawStaticMesh(
        gl,
        rig.head,
        kart.x + headOff.x,
        kart.y + headOff.y,
        kart.z + headOff.z,
        this.worldPartBasis,
      );

      // Articulated Species Tail (`wag` / `sway` around `(0, 0.66, -0.44)`)
      const wagFreq = kart.character === 'dog' ? (kart.boostTimer > 0 ? 0.032 : 0.016) : 0.009;
      const tailYaw =
        Math.sin(timeMs * wagFreq + kart.slot) * (kart.character === 'dog' ? 0.26 : 0.16) -
        kart.driftYaw * 0.5;
      const tailHop =
        kart.character === 'bunny' ? Math.abs(Math.sin(timeMs * 0.016 + kart.slot)) * 0.05 : 0;
      eulerToBasis3(this.localBasis, tailYaw, 0, 0);
      mulBasis3(this.worldPartBasis, this.kartBasis, this.localBasis);
      const tailOff = transformOffsetByBasis(this.kartBasis, 0, 0.66 + tailHop, -0.44);
      this.drawStaticMesh(
        gl,
        rig.tail,
        kart.x + tailOff.x,
        kart.y + tailOff.y,
        kart.z + tailOff.z,
        this.worldPartBasis,
      );

      // Wind-fluttering Scarf Tails around `(0, 0.96, -0.34)`
      const scarfYaw = Math.sin(timeMs * 0.016 + kart.slot) * (0.06 + speedRatio * 0.14);
      const scarfPitch = 0.06 + speedRatio * 0.12;
      eulerToBasis3(this.localBasis, scarfYaw, scarfPitch, 0);
      mulBasis3(this.worldPartBasis, this.kartBasis, this.localBasis);
      const scarfOff = transformOffsetByBasis(this.kartBasis, 0, 0.96, -0.34);
      this.drawStaticMesh(
        gl,
        rig.scarf,
        kart.x + scarfOff.x,
        kart.y + scarfOff.y,
        kart.z + scarfOff.z,
        this.worldPartBasis,
      );

      // Smooth Twin Plasma Thruster Cones + Drift Sparks!
      if (this.flameMesh) {
        const flicker = 0.86 + Math.sin(timeMs * 0.045 + kart.slot) * 0.18;
        const isBoosting = kart.boostTimer > 0;
        const throttleScale = kart.braking ? 0 : Math.min(1, 0.22 + kart.speed / 38);
        const powers: ReadonlyArray<[number, number]> = [
          [
            -0.44,
            isBoosting
              ? 1.55
              : kart.braking
                ? 0
                : kart.leftThruster && kart.rightThruster
                  ? 1.0 * throttleScale
                  : kart.leftThruster
                    ? 1.15 * throttleScale
                    : 0.28 * throttleScale,
          ],
          [
            0.44,
            isBoosting
              ? 1.55
              : kart.braking
                ? 0
                : kart.leftThruster && kart.rightThruster
                  ? 1.0 * throttleScale
                  : kart.rightThruster
                    ? 1.15 * throttleScale
                    : 0.28 * throttleScale,
          ],
        ];
        const [fr, fg, fb] = isBoosting
          ? kart.boostKind === 'ultra'
            ? [1.0, 0.82, 0.14]
            : [0.22, 0.92, 1.0]
          : [1.0, 0.62, 0.2];

        for (const [cx, pwr] of powers) {
          if (pwr <= 0.05) continue;
          const len = (1.1 + pwr * 1.45) * flicker;
          const radScale = Math.min(1.3, 0.72 + pwr * 0.38);
          const fOff = transformOffsetByBasis(this.kartBasis, cx, 0.42, -1.84);
          this.drawStaticMesh(
            gl,
            this.flameMesh,
            kart.x + fOff.x,
            kart.y + fOff.y,
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

        // Rear Tire Drift-Charge Sparks
        if (kart.driftCharge >= 0.18) {
          const [sr, sg, sb] =
            kart.driftCharge >= ULTRA_TURBO_CHARGE_SEC
              ? [1.0, 0.85, 0.18]
              : kart.driftCharge >= MINI_TURBO_CHARGE_SEC
                ? [0.22, 0.92, 1.0]
                : [1.0, 1.0, 1.0];
          const sparkLen = (0.55 + Math.min(1.1, kart.driftCharge * 0.65)) * flicker;
          for (const sx of [-1.22, 1.22]) {
            const spOff = transformOffsetByBasis(this.kartBasis, sx, 0.32, -1.4);
            this.drawStaticMesh(
              gl,
              this.flameMesh,
              kart.x + spOff.x,
              kart.y + spOff.y,
              kart.z + spOff.z,
              this.kartBasis,
              0.55,
              0.55,
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
