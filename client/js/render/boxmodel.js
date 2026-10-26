// Port of vanilla ModelRenderer/ModelBox (texture-offset box models) onto the gfx scene graph.
import { FORMAT, EntityParams } from '../gfx/device.js';
import { Node, material } from '../gfx/scene.js';

let device = null;
const boxCache = new Map();

export function setModelDevice(d) {
  if (device !== d) boxCache.clear();
  device = d;
}
export function modelDevice() { return device; }

// Entity material: pipeline 'entity', texture (Texture or texture path), EntityParams
export function entityMaterial(tex, opts = {}) {
  const params = new EntityParams();
  params.setAlphaTest(opts.alphaTest !== undefined ? opts.alphaTest : 0.1);
  if (opts.noLighting) params.setNoLighting(true);
  if (opts.guiLighting) params.setGuiLighting(true);
  if (opts.fullBright) params.setFullBright(true);
  const state = { blend: opts.transparent ? (opts.additive ? 'add' : 'alpha') : 'none', depthWrite: opts.depthWrite !== false, cull: !!opts.cull };
  if (opts.colorWrite === false) state.colorWrite = false;
  const m = material('entity', tex, params, state);
  m.order = opts.transparent ? 2 : 0;
  return m;
}

// Interleave flat arrays into FORMAT.entity vertices
export function entityVertices(pos, uv, nor, col) {
  const n = pos.length / 3;
  const out = new Float32Array(n * 11);
  for (let i = 0; i < n; i++) {
    const o = i * 11;
    out[o] = pos[i * 3]; out[o + 1] = pos[i * 3 + 1]; out[o + 2] = pos[i * 3 + 2];
    out[o + 3] = uv[i * 2]; out[o + 4] = uv[i * 2 + 1];
    out[o + 5] = nor[i * 3]; out[o + 6] = nor[i * 3 + 1]; out[o + 7] = nor[i * 3 + 2];
    if (col) { out[o + 8] = col[i * 3]; out[o + 9] = col[i * 3 + 1]; out[o + 10] = col[i * 3 + 2]; } else { out[o + 8] = out[o + 9] = out[o + 10] = 1; }
  }
  return out;
}

// Entity meshes keep their vertices on the CPU too (scene.js batches small model parts into one draw)
export function entityMesh(pos, uv, nor, col, opts = {}) {
  const v = entityVertices(pos, uv, nor, col);
  const m = device.createMesh(FORMAT.entity, v, opts);
  m.cpu = v;
  return m;
}

// ModelRenderer
export class Part {
  constructor(texW = 64, texH = 32) {
    this.texW = texW; this.texH = texH;
    this.u = 0; this.v = 0;
    this.boxes = [];
    this.px = 0; this.py = 0; this.pz = 0;
    this.rx = 0; this.ry = 0; this.rz = 0;
    this.children = [];
    this.mirror = false;
    this.visible = true;
    this.obj = null;
  }
  tex(u, v) { this.u = u; this.v = v; return this; }
  box(x, y, z, dx, dy, dz, inflate = 0, mirror = this.mirror) {
    this.boxes.push({ x, y, z, dx, dy, dz, inflate, mirror, u: this.u, v: this.v });
    return this;
  }
  pivot(x, y, z) { this.px = x; this.py = y; this.pz = z; return this; }
  rot(x, y, z) { this.rx = x; this.ry = y; this.rz = z; return this; }
  add(child) { this.children.push(child); return this; }

  // Build scene nodes (call once). Geometry in pixel units scaled by 1/16 at the root.
  build() {
    const g = new Node();
    g.rotation.order = 'ZYX';
    if (this.boxes.length) {
      const mesh = boxesMesh(this.boxes, this.texW, this.texH);
      g.addDrawable(mesh, null);
      this.drawable = g.drawables[0];
    }
    for (const c of this.children) g.add(c.build());
    this.obj = g;
    this.sync();
    return g;
  }

  sync() {
    const o = this.obj;
    if (!o) return;
    o.position.set(this.px, this.py, this.pz);
    o.rotation.set(this.rx, this.ry, this.rz, 'ZYX');
    o.visible = this.visible;
    for (const c of this.children) c.sync();
  }

  setMaterial(mat) {
    if (this.drawable) { this.drawable.mat = mat; this.drawable.order = mat ? mat.order || 0 : 0; }
    for (const c of this.children) c.setMaterial(mat);
  }

  // Copy pose from another part (ModelBase.copyModelAngles)
  copyAngles(o) { this.px = o.px; this.py = o.py; this.pz = o.pz; this.rx = o.rx; this.ry = o.ry; this.rz = o.rz; }
}

// Cached mesh for a list of boxes (identical part shapes share one mesh)
export function boxesMesh(boxes, texW, texH) {
  const key = texW + 'x' + texH + ':' + boxes.map((b) => [b.x, b.y, b.z, b.dx, b.dy, b.dz, b.inflate, b.mirror ? 1 : 0, b.u, b.v, ...(b.quads || [])].join(',')).join(';');
  let m = boxCache.get(key);
  if (m) return m;
  const pos = [], uv = [], nor = [];
  for (const b of boxes) {
    if (b.quads) for (let i=0;i<b.quads.length;i+=8) {
      pos.push(...b.quads.slice(i,i+3));uv.push(...b.quads.slice(i+3,i+5));nor.push(...b.quads.slice(i+5,i+8));
    } else addBox(pos, uv, nor, b, texW, texH);
  }
  const v = entityVertices(pos, uv, nor, null);
  m = device.createMesh(FORMAT.entity, v, { quads: true });
  m.cpu = v;
  m.textureSize = [texW,texH];
  boxCache.set(key, m);
  return m;
}

function addBox(pos, uvs, nor, b, texW, texH) {
  let { x, y, z, dx, dy, dz, inflate, mirror, u, v } = b;
  let f = x + dx, f1 = y + dy, f2 = z + dz;
  x -= inflate; y -= inflate; z -= inflate;
  f += inflate; f1 += inflate; f2 += inflate;
  if (mirror) { const t = f; f = x; x = t; }
  const v7 = [x, y, z], v0 = [f, y, z], v1 = [f, f1, z], v2 = [x, f1, z];
  const v3 = [x, y, f2], v4 = [f, y, f2], v5 = [f, f1, f2], v6 = [x, f1, f2];
  const quads = [
    [[v4, v0, v1, v5], u + dz + dx, v + dz, u + dz + dx + dz, v + dz + dy, [1, 0, 0]],
    [[v7, v3, v6, v2], u, v + dz, u + dz, v + dz + dy, [-1, 0, 0]],
    [[v4, v3, v7, v0], u + dz, v, u + dz + dx, v + dz, [0, -1, 0]],
    [[v1, v2, v6, v5], u + dz + dx, v + dz, u + dz + dx + dx, v, [0, 1, 0]],
    [[v0, v7, v2, v1], u + dz, v + dz, u + dz + dx, v + dz + dy, [0, 0, -1]],
    [[v3, v4, v5, v6], u + dz + dx + dz, v + dz, u + dz + dx + dz + dx, v + dz + dy, [0, 0, 1]],
  ];
  for (const [verts, u1, vv1, u2, vv2, n] of quads) {
    let vs = verts;
    let normal = n;
    const tuv = [[u2, vv1], [u1, vv1], [u1, vv2], [u2, vv2]];
    if (mirror) {
      vs = [verts[3], verts[2], verts[1], verts[0]];
      tuv.reverse();
      if (n[0] !== 0) normal = [-n[0], 0, 0];
    }
    for (let i = 0; i < 4; i++) {
      pos.push(vs[i][0], vs[i][1], vs[i][2]);
      uvs.push(tuv[i][0] / texW, tuv[i][1] / texH);
      nor.push(normal[0], normal[1], normal[2]);
    }
  }
}
