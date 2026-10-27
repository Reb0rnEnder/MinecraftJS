import {resourceName} from '../resource-models.js';
// Block/item model resolution and baking (port of vanilla FaceBakery). Worker-safe.
// Baked quad: { pos: Float32Array(12) [0..1 block space], uv: Float32Array(8) [atlas],
//   dir, cull, tint, shade, alpha (texture has transparency), ao }

const FACE_INDEX = { down: 0, up: 1, north: 2, south: 3, west: 4, east: 5 };
const DIR_VEC = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

// Vertex corner order per face (vanilla EnumFaceDirection). Values pick min (0) or max (1) per axis.
const FACE_CORNERS = [
  [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], // down
  [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], // up
  [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]], // north
  [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]], // south
  [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], // west
  [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]], // east
];

function defaultUV(dir, from, to) {
  switch (dir) {
    case 0: return [from[0], 16 - to[2], to[0], 16 - from[2]];
    case 1: return [from[0], from[2], to[0], to[2]];
    case 2: return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]];
    case 3: return [from[0], 16 - to[1], to[0], 16 - from[1]];
    case 4: return [from[2], 16 - to[1], to[2], 16 - from[1]];
    case 5: return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]];
    default: return [0, 0, 16, 16];
  }
}

export class ModelStore {
  // models: { 'block/stone': json, 'item/apple': json, ... }; blockstates: { name: json }
  // atlas: { uv(name) -> [u0,v0,u1,v1] | null, hasAlpha(name) -> bool }
  constructor(models, blockstates, atlas) {
    this.models = models;
    this.blockstates = blockstates;
    this.atlas = atlas;
    this.resolved = new Map();
    this.baked = new Map();
    this.variantIndex = new Map();
  }

  resolveModel(name) {
    name=resourceName(name);
    if (this.resolved.has(name)) return this.resolved.get(name);
    const chain = [];
    let cur = name;
    let guard = 0;
    while (cur && guard++ < 32) {
      if (cur.startsWith('builtin/')) { chain.push({ builtin: cur }); break; }
      const j = this.models[cur] || this.models['block/' + cur];
      if (!j) break;
      chain.push(j);
      cur = resourceName(j.parent);
    }
    const textures = {};
    let elements = null;
    let ao = true;
    let display = {};
    let builtin = null;
    for (let i = chain.length - 1; i >= 0; i--) {
      const j = chain[i];
      if (j.builtin) { builtin = j.builtin; continue; }
      if (j.textures) Object.assign(textures, j.textures);
      if (j.elements) elements = j.elements;
      if (j.ambientocclusion === false) ao = false;
      if (j.display) display = Object.assign({}, display, j.display);
    }
    const resolveTex = (t) => {
      let g = 0;
      while (t && t.startsWith('#') && g++ < 16) t = textures[t.slice(1)];
      return resourceName(t) || null;
    };
    // item model overrides (1.9+) belong to the model file itself, not its parents
    const overrides = chain.length && !chain[0].builtin ? chain[0].overrides || null : null;
    const res = { name, textures, elements, ao, display, builtin, resolveTex, overrides };
    this.resolved.set(name, res);
    return res;
  }

  // Bake a model with rotation; result cached by key
  bakeModel(modelName, rx = 0, ry = 0, uvlock = false) {
    const key = modelName + '|' + rx + '|' + ry + '|' + (uvlock ? 1 : 0);
    let b = this.baked.get(key);
    if (b) return b;
    const m = this.resolveModel(modelName);
    const quads = [];
    let bounds = null;
    if (m.elements) {
      for (const el of m.elements) {
        for (const [faceName, face] of Object.entries(el.faces || {})) {
          const dir = FACE_INDEX[faceName];
          if (dir === undefined) continue;
          const q = this._bakeFace(m, el, dir, face, rx, ry, uvlock);
          if (q) quads.push(q);
        }
        // selection/visual bounds after rotation
        const bb = rotateBox(el.from, el.to, rx, ry);
        if (!bounds) bounds = bb; else {
          for (let i = 0; i < 3; i++) { bounds[i] = Math.min(bounds[i], bb[i]); bounds[i + 3] = Math.max(bounds[i + 3], bb[i + 3]); }
        }
      }
    }
    b = { quads, ao: m.ao, bounds, particle: m.resolveTex('#particle'), builtin: m.builtin, display: m.display };
    this.baked.set(key, b);
    return b;
  }

  _bakeFace(m, el, dir, face, rx, ry, uvlock) {
    const tex = m.resolveTex(face.texture);
    const auv = tex ? this.atlas.uv(tex) : null;
    if (!auv) return null;
    const from = el.from, to = el.to;
    const pos = new Float32Array(12);
    const corners = FACE_CORNERS[dir];
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      pos[i * 3] = c[0] ? to[0] : from[0];
      pos[i * 3 + 1] = c[1] ? to[1] : from[1];
      pos[i * 3 + 2] = c[2] ? to[2] : from[2];
    }
    // Element rotation
    if (el.rotation) applyElementRotation(pos, el.rotation);
    // Model rotation (x then y), around block centre
    if (rx || ry) for (let i = 0; i < 4; i++) rotateVertex(pos, i * 3, rx, ry);
    let ndir = rotateDir(dir, rx, ry);
    let cull = face.cullface !== undefined ? FACE_INDEX[face.cullface] : -1;
    if (cull !== undefined && cull >= 0) cull = rotateDir(cull, rx, ry);
    if (cull === undefined) cull = -1;

    // UVs (in 0..16 texture space)
    const uvs = face.uv || defaultUV(dir, from, to);
    const rot = ((face.rotation || 0) / 90) | 0;
    const uv = new Float32Array(8);
    if (uvlock && (rx || ry)) {
      // Project rotated vertices back onto the face plane in world space
      for (let i = 0; i < 4; i++) {
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        let u, v;
        switch (ndir) {
          case 0: u = x; v = 16 - z; break;
          case 1: u = x; v = z; break;
          case 2: u = 16 - x; v = 16 - y; break;
          case 3: u = x; v = 16 - y; break;
          case 4: u = z; v = 16 - y; break;
          default: u = 16 - z; v = 16 - y; break;
        }
        uv[i * 2] = u; uv[i * 2 + 1] = v;
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const j = (i + rot) % 4;
        uv[i * 2] = uvs[j !== 0 && j !== 1 ? 2 : 0];
        uv[i * 2 + 1] = uvs[j !== 0 && j !== 3 ? 3 : 1];
      }
    }
    // Map to atlas
    const du = (auv[2] - auv[0]) / 16, dv = (auv[3] - auv[1]) / 16;
    for (let i = 0; i < 4; i++) {
      uv[i * 2] = auv[0] + uv[i * 2] * du;
      uv[i * 2 + 1] = auv[1] + uv[i * 2 + 1] * dv;
    }
    for (let i = 0; i < 12; i++) pos[i] /= 16;
    return {
      pos, uv, dir: ndir, cull, tint: face.tintindex !== undefined ? face.tintindex : -1,
      shade: el.shade !== false, alpha: this.atlas.hasAlpha(tex), tex,
    };
  }

  // Precompute variant property maps for subset matching
  _variants(file) {
    let idx = this.variantIndex.get(file);
    if (idx) return idx;
    const bs = this.blockstates[file];
    idx = [];
    if (bs && bs.variants) {
      for (const [key, val] of Object.entries(bs.variants)) {
        const props = {};
        if (key !== 'normal' && key !== 'all' && key !== 'inventory') {
          for (const kv of key.split(',')) {
            const [k, v] = kv.split('=');
            props[k] = v;
          }
        }
        idx.push({ key, props, val });
      }
    }
    this.variantIndex.set(file, idx);
    return idx;
  }

  // Find the variant whose properties all match `props`
  findVariant(file, props, exactKey) {
    const idx = this._variants(file);
    if (!idx.length) return null;
    if (exactKey) {
      const e = idx.find((v) => v.key === exactKey);
      if (e) return e.val;
    }
    let best = null;
    let bestScore = -1;
    for (const v of idx) {
      let ok = true;
      let score = 0;
      for (const [k, val] of Object.entries(v.props)) {
        const p = props[k];
        if (p === undefined) continue;
        if (String(p) !== val) { ok = false; break; }
        score++;
      }
      if (ok && score > bestScore) { best = v.val; bestScore = score; }
    }
    return best || idx[0].val;
  }

  // Returns baked model for a blockstate (file, props); `rand` picks among weighted variants
  bakeVariant(file, props, exactKey, rand = 0) {
    const bs = this.blockstates[file];
    if (bs && bs.multipart) return this.bakeMultipart(file, bs.multipart, props, rand);
    const v = pickWeighted(this.findVariant(file, props, exactKey), rand);
    if (!v) return null;
    return this.bakeModel('block/' + v.model, v.x || 0, v.y || 0, !!v.uvlock);
  }

  // 1.9+ multipart blockstate (MultipartBakedModel): every part whose "when" matches adds its model
  bakeMultipart(file, parts, props, rand) {
    const picks = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.when && !matchWhen(part.when, props)) continue;
      const v = pickWeighted(part.apply, rand);
      if (v) picks.push(i + ':' + (Array.isArray(part.apply) ? part.apply.indexOf(v) : 0));
    }
    const key = 'mp|' + file + '|' + picks.join(',');
    let b = this.baked.get(key);
    if (b) return b;
    const quads = [];
    let bounds = null, first = null;
    for (const p of picks) {
      const [i, k] = p.split(':').map(Number);
      const apply = parts[i].apply;
      const v = Array.isArray(apply) ? apply[k] : apply;
      const m = this.bakeModel('block/' + v.model, v.x || 0, v.y || 0, !!v.uvlock);
      if (!first) first = m;
      for (const q of m.quads) quads.push(q);
      if (m.bounds) {
        if (!bounds) bounds = m.bounds.slice();
        else for (let j = 0; j < 3; j++) { bounds[j] = Math.min(bounds[j], m.bounds[j]); bounds[j + 3] = Math.max(bounds[j + 3], m.bounds[j + 3]); }
      }
    }
    b = { quads, ao: first ? first.ao : true, bounds, particle: first ? first.particle : null, builtin: null, display: first ? first.display : {} };
    this.baked.set(key, b);
    return b;
  }
}

// Weighted variant list -> one entry (rand is a per-position hash)
function pickWeighted(v, rand) {
  if (!Array.isArray(v)) return v || null;
  let total = 0;
  for (const e of v) total += e.weight || 1;
  let r = Math.abs(rand) % total;
  for (const e of v) { r -= e.weight || 1; if (r < 0) return e; }
  return v[0];
}

// Multipart condition: { prop: "a|b", ... } (all must match) or { OR: [conditions] }
function matchWhen(when, props) {
  if (when.OR) return when.OR.some((w) => matchWhen(w, props));
  for (const [k, val] of Object.entries(when)) {
    const p = props[k];
    // values are strings ("a|b") or plain JSON booleans / numbers
    if (!String(val).split('|').includes(String(p === undefined ? false : p))) return false;
  }
  return true;
}

function applyElementRotation(pos, r) {
  const o = r.origin || [8, 8, 8];
  const a = (r.angle || 0) * Math.PI / 180;
  const c = Math.cos(a), s = Math.sin(a);
  let scale = [1, 1, 1];
  if (r.rescale) {
    const k = Math.abs(r.angle) === 22.5 ? 1 / Math.cos(Math.PI / 8) - 1 : 1 / Math.cos(Math.PI / 4) - 1;
    scale = r.axis === 'x' ? [1, 1 + k, 1 + k] : r.axis === 'y' ? [1 + k, 1, 1 + k] : [1 + k, 1 + k, 1];
  }
  for (let i = 0; i < 4; i++) {
    let x = pos[i * 3] - o[0], y = pos[i * 3 + 1] - o[1], z = pos[i * 3 + 2] - o[2];
    let nx = x, ny = y, nz = z;
    if (r.axis === 'x') { ny = y * c - z * s; nz = y * s + z * c; }
    else if (r.axis === 'y') { nx = x * c + z * s; nz = -x * s + z * c; }
    else { nx = x * c - y * s; ny = x * s + y * c; }
    pos[i * 3] = nx * scale[0] + o[0];
    pos[i * 3 + 1] = ny * scale[1] + o[1];
    pos[i * 3 + 2] = nz * scale[2] + o[2];
  }
}

// Vanilla ModelRotation: rotate by -x around X, then by -y around Y (degrees, multiples of 90)
function rotateVertex(pos, i, rx, ry) {
  let x = pos[i] - 8, y = pos[i + 1] - 8, z = pos[i + 2] - 8;
  if (rx) {
    const a = -rx * Math.PI / 180;
    const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
    const ny = y * c - z * s, nz = y * s + z * c;
    y = ny; z = nz;
  }
  if (ry) {
    const a = -ry * Math.PI / 180;
    const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
    const nx = x * c + z * s, nz = -x * s + z * c;
    x = nx; z = nz;
  }
  pos[i] = x + 8; pos[i + 1] = y + 8; pos[i + 2] = z + 8;
}

function rotateDir(dir, rx, ry) {
  const v = [DIR_VEC[dir][0] * 8 + 8, DIR_VEC[dir][1] * 8 + 8, DIR_VEC[dir][2] * 8 + 8];
  rotateVertex(v, 0, rx, ry);
  const x = Math.round(v[0] - 8), y = Math.round(v[1] - 8), z = Math.round(v[2] - 8);
  for (let d = 0; d < 6; d++) {
    const dv = DIR_VEC[d];
    if (dv[0] * 8 === x && dv[1] * 8 === y && dv[2] * 8 === z) return d;
  }
  return dir;
}

function rotateBox(from, to, rx, ry) {
  const a = [from[0], from[1], from[2]], b = [to[0], to[1], to[2]];
  if (rx || ry) { rotateVertex(a, 0, rx, ry); rotateVertex(b, 0, rx, ry); }
  return [
    Math.min(a[0], b[0]) / 16, Math.min(a[1], b[1]) / 16, Math.min(a[2], b[2]) / 16,
    Math.max(a[0], b[0]) / 16, Math.max(a[1], b[1]) / 16, Math.max(a[2], b[2]) / 16,
  ];
}

export { FACE_INDEX, DIR_VEC };
