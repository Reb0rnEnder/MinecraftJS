// Minimal scene graph: nodes with TRS transforms (or an explicit matrix) and drawables.
// A drawable is { mesh, mat, order, primitive?, first?, count? } where mat is a shared material
// { pipeline, tex: Texture|string|null, params: Float32Array|{p}, state }. String textures are resolved
// at draw time through the resolver passed to drawTree (so textures may load lazily).
import { mat4 } from './math.js';

const TMP = mat4.create();

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { this.x = this.y = this.z = s; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
}

export class Euler {
  constructor(x = 0, y = 0, z = 0, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; }
  set(x, y, z, order) { this.x = x; this.y = y; this.z = z; if (order) this.order = order; return this; }
  copy(e) { this.x = e.x; this.y = e.y; this.z = e.z; this.order = e.order; return this; }
}

export function material(pipeline, tex, params, state = {}) {
  return { pipeline, tex, params, state };
}

export class Node {
  constructor() {
    this.position = new Vec3();
    this.rotation = new Euler();   // radians; matrix = R(order[0]) * R(order[1]) * R(order[2]) (three.js convention)
    this.scale = new Vec3(1, 1, 1);
    this.matrix = null;            // explicit local matrix overrides position/rotation/scale when set
    this.billboard = false;        // face the camera (rotation replaced by the inverse view rotation)
    this.world = mat4.create();
    this.children = [];
    this.parent = null;
    this.visible = true;
    this.drawables = [];
    this.userData = {};
  }

  add(...nodes) {
    for (const n of nodes) {
      if (!n) continue;
      if (n.parent) n.parent.remove(n);
      n.parent = this;
      this.children.push(n);
    }
    return this;
  }

  remove(n) {
    const i = this.children.indexOf(n);
    if (i >= 0) this.children.splice(i, 1);
    n.parent = null;
    return this;
  }

  clear() { for (const c of this.children) c.parent = null; this.children.length = 0; return this; }

  addDrawable(mesh, mat, extra = {}) { this.drawables.push({ mesh, mat, order: 0, ...extra }); return this; }

  // Assign a material to every drawable in the subtree
  setMaterial(mat) { this.traverse((n) => { for (const d of n.drawables) d.mat = mat; }); return this; }

  // Copy of the tree sharing meshes and materials
  clone() {
    const n = new Node();
    n.position.copy(this.position); n.rotation.copy(this.rotation); n.scale.copy(this.scale);
    n.matrix = this.matrix ? new Float32Array(this.matrix) : null;
    n.billboard = this.billboard; n.visible = this.visible;
    n.drawables = this.drawables.map((d) => ({ ...d }));
    n.userData = { ...this.userData };
    for (const c of this.children) n.add(c.clone());
    return n;
  }

  localMatrix(out, camRot) {
    if (this.matrix) { out.set(this.matrix); return out; }
    mat4.identity(out);
    const p = this.position;
    mat4.translate(out, out, p.x, p.y, p.z);
    if (this.billboard && camRot) mat4.multiply(out, out, camRot);
    else {
      const r = this.rotation;
      for (const axis of r.order) {
        const a = axis === 'X' ? r.x : axis === 'Y' ? r.y : r.z;
        if (a) mat4.rotate(out, out, a, axis === 'X' ? 1 : 0, axis === 'Y' ? 1 : 0, axis === 'Z' ? 1 : 0);
      }
    }
    const s = this.scale;
    if (s.x !== 1 || s.y !== 1 || s.z !== 1) mat4.scale(out, out, s.x, s.y, s.z);
    return out;
  }

  updateWorld(parentWorld, camRot) {
    if (!this.visible) return;
    this.localMatrix(TMP, camRot);
    if (this.billboard && camRot && parentWorld) {
      // keep only the parent's translation so the billboard stays screen aligned
      const t = mat4.create();
      t[12] = parentWorld[0] * this.position.x + parentWorld[4] * this.position.y + parentWorld[8] * this.position.z + parentWorld[12];
      t[13] = parentWorld[1] * this.position.x + parentWorld[5] * this.position.y + parentWorld[9] * this.position.z + parentWorld[13];
      t[14] = parentWorld[2] * this.position.x + parentWorld[6] * this.position.y + parentWorld[10] * this.position.z + parentWorld[14];
      TMP[12] = 0; TMP[13] = 0; TMP[14] = 0;
      mat4.multiply(this.world, t, TMP);
    } else if (parentWorld) mat4.multiply(this.world, parentWorld, TMP);
    else this.world.set(TMP);
    for (const c of this.children) c.updateWorld(this.world, camRot);
  }

  // Collect visible drawables with their world matrices
  collect(out) {
    if (!this.visible) return out;
    for (const d of this.drawables) out.push({ d, world: this.world });
    for (const c of this.children) c.collect(out);
    return out;
  }

  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
}

// Turn a drawable into a device draw call (null if its texture is not ready)
export function toDraw(d, world, resolve) {
  const m = d.mat;
  if (!m || !d.mesh) return null;
  let tex = m.tex;
  if (typeof tex === 'string' || typeof tex === 'function') { tex = resolve ? resolve(tex) : null; if (!tex) return null; }
  const params = m.params && m.params.p ? m.params.p : m.params;
  return { mesh: d.mesh, pipeline: m.pipeline, textures: tex ? [tex] : null, params, model: world, state: m.state, primitive: d.primitive, first: d.first, count: d.count };
}

// Submit a node tree to the device, ordered by drawable.order (stable)
export function drawTree(device, root, opts = {}) {
  root.updateWorld(opts.parentWorld || null, opts.camRot || null);
  const list = root.collect([]);
  list.sort((a, b) => (a.d.order || 0) - (b.d.order || 0));
  for (const { d, world } of list) {
    const dr = toDraw(d, world, opts.resolve);
    if (dr) device.draw(dr);
  }
}
