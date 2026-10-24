// Section mesher: turns 16^3 block sections into vertex buffers. Runs inside a worker.
// Vertex layout (10 floats): x y z u v r g b sky block
import { blocks, getBlock, getStateProperties, staticCollisionBoxes, DIR_OFFSETS, DIR_NAMES, OPPOSITE } from '../world/blocks.js';
import { getFluidState } from '../world/fluids.js';
import { resolveState } from '../world/blockstates.js';
import { grassColor, foliageColor, waterColor } from '../world/biomes.js';
import { computeVisibility } from './visgraph.js';

export const BYTES_PER_VERTEX = 20;

// Block.EnumOffsetType: 1 = XZ (BlockFlower), 2 = XYZ (BlockTallGrass)
const OFFSET_TYPES = {
  dandelion: 1, poppy: 1, blue_orchid: 1, allium: 1, azure_bluet: 1, red_tulip: 1, orange_tulip: 1,
  white_tulip: 1, pink_tulip: 1, oxeye_daisy: 1, brown_mushroom: 1, red_mushroom: 1,
  grass: 2, tall_grass: 2, fern: 2, large_fern: 2,
};

// MathHelper.getPositionRandom, low 32 bits (every caller only uses bits 16 - 31, and the low half of a long product
// depends only on the low halves, so int maths gives the same bits as the 64-bit original)
function positionRandom(x, y, z) {
  const i = Math.imul(x, 3129871) ^ Math.imul(z, 116129781) ^ y;
  return (Math.imul(Math.imul(i, i), 42317861) + Math.imul(i, 11)) | 0;
}
const FACE_SHADE = [0.5, 1.0, 0.8, 0.8, 0.6, 0.6];

// Does the block's solid shape cover a whole fluid face? In particular a bottom
// slab hides its water's bottom, a top slab hides its top, and stairs can cover
// a face with several boxes. Keep transparent glass/ice boundaries visible.
function coversFluidFace(state, dir, height = 1) {
  const b = getBlock(state);
  if (!b || b.isLiquid) return false;
  if (b.opaque) return true;
  if (b.translucent || b.name === 'glass' || b.name.endsWith('_leaves')) return false;
  const axis = dir < 2 ? 1 : dir < 4 ? 2 : 0;
  const u = axis === 0 ? 2 : 0, v = axis === 1 ? 2 : 1;
  const plane = dir === 1 ? height : (dir & 1);
  let remaining = [[0, 0, 1, axis === 1 ? 1 : height]];
  for (const box of staticCollisionBoxes(state)) {
    if (box[axis] > plane + 1e-6 || box[axis + 3] < plane - 1e-6) continue;
    const next = [];
    for (const r of remaining) {
      const x0 = Math.max(r[0], box[u]), y0 = Math.max(r[1], box[v]);
      const x1 = Math.min(r[2], box[u + 3]), y1 = Math.min(r[3], box[v + 3]);
      if (x0 >= x1 || y0 >= y1) { next.push(r); continue; }
      if (r[0] < x0) next.push([r[0], r[1], x0, r[3]]);
      if (x1 < r[2]) next.push([x1, r[1], r[2], r[3]]);
      if (r[1] < y0) next.push([x0, r[1], x1, y0]);
      if (y1 < r[3]) next.push([x0, y1, x1, r[3]]);
    }
    remaining = next;
    if (!remaining.length) return true;
  }
  return false;
}

// Packed vertex buffer (gfx FORMAT.terrain): pos unorm16 x4, uv unorm16 x2, colour unorm8 x4, light unorm8 x2 (+2 pad)
class VBuf {
  constructor() { this._alloc(1024); this.n = 0; }
  _alloc(verts) {
    const buf = new ArrayBuffer(verts * BYTES_PER_VERTEX);
    if (this.u8) new Uint8Array(buf).set(this.u8);
    this.u16 = new Uint16Array(buf);
    this.u8 = new Uint8Array(buf);
    this.cap = verts;
  }
  push10(x, y, z, u, v, r, g, b, sky, blk) {
    if (this.n >= this.cap) this._alloc(this.cap * 2);
    const w = this.n * 10, by = this.n * 20, U = this.u16, B = this.u8;
    U[w] = (x + 8) * 2048 + 0.5; U[w + 1] = (y + 8) * 2048 + 0.5; U[w + 2] = (z + 8) * 2048 + 0.5;
    U[w + 4] = u * 65535 + 0.5; U[w + 5] = v * 65535 + 0.5;
    B[by + 12] = (r > 1 ? 1 : r) * 255 + 0.5; B[by + 13] = (g > 1 ? 1 : g) * 255 + 0.5; B[by + 14] = (b > 1 ? 1 : b) * 255 + 0.5; B[by + 15] = 255;
    B[by + 16] = sky * 17 + 0.5; B[by + 17] = blk * 17 + 0.5;
    this.n++;
  }
  result() { return this.u8.slice(0, this.n * BYTES_PER_VERTEX); }
  reset() { this.n = 0; return this; }
}

// Tangent axes per face direction for AO sampling: [e1, e2]
const AO_AXES = [
  [[1, 0, 0], [0, 0, 1]], // down
  [[1, 0, 0], [0, 0, 1]], // up
  [[1, 0, 0], [0, 1, 0]], // north
  [[1, 0, 0], [0, 1, 0]], // south
  [[0, 0, 1], [0, 1, 0]], // west
  [[0, 0, 1], [0, 1, 0]], // east
];

// Per block id flags for the hot face test (computed once): 1 leaves, 2 matching
// glass/ice/slime/portal interiors, 4 pane end caps (connection-dependent).
let FACE_FLAGS = null;
function faceFlags() {
  if (FACE_FLAGS && FACE_FLAGS.length === blocks.length) return FACE_FLAGS;
  FACE_FLAGS = new Uint8Array(blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b) continue;
    const n = b.name;
    let f = 0;
    if (n.endsWith('_leaves')) f |= 1;
    if (n === 'glass' || n.endsWith('_stained_glass') || n === 'ice' || n === 'frosted_ice' || n === 'slime_block' || n === 'nether_portal') f |= 2;
    if (b.isPane) f |= 4;
    FACE_FLAGS[i] = f;
  }
  return FACE_FLAGS;
}

// Small plants left out of far (LOD) sections
const LOD_SKIP = new Set(['grass', 'tall_grass', 'fern', 'seagrass', 'tall_seagrass', 'dandelion', 'poppy', 'blue_orchid', 'allium',
  'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'dead_bush', 'brown_mushroom',
  'red_mushroom', 'sunflower', 'lilac', 'rose_bush', 'peony', 'large_fern', 'lily_pad', 'cobweb']);

export class Mesher {
  constructor(world, store) {
    this.world = world; // { getState(x,y,z), getLight(x,y,z) -> sky<<4|block, getBiome(x,z) }
    this.store = store;
    this.cache = new Map(); // resolved model per (file|props) key
    this.atlas = store.atlas;
    this.waterStill = this.atlas.uv('block/water_still');
    this.waterFlow = this.atlas.uv('block/water_flow');
    this.lavaStill = this.atlas.uv('block/lava_still');
    this.lavaFlow = this.atlas.uv('block/lava_flow');
    this.options = { fancy: true, smooth: 2, alt: true };
    this.stateModels = new Map(); // state -> model, for states whose model ignores neighbours
    this.dynamicStates = new Set(); // states whose resolution reads neighbouring blocks
    this._reads = 0;
    this._countingGet = (a, b, c) => { this._reads++; return this.world.getState(a, b, c); };
    this._neighbors = new Int32Array(6);
    this._visible = new Uint8Array(6);
    this._corners = [];
    for (let i = 0; i < 12; i++) this._corners.push([new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3)]);
    this._cornerValid = new Uint8Array(12);
    this._tintCache = [];
  }

  isLeaves(b) { return b.name.endsWith('_leaves'); }

  getModel(state, x, y, z) {
    const w = this.world;
    const hasTp = w.tileProps && w.tileProps.size && w.tileProps.has(x + ',' + y + ',' + z);
    if (!hasTp) {
      const cached = this.stateModels.get(state);
      if (cached !== undefined) return this._pick(cached, x, y, z);
    }
    this._reads = 0;
    const rs = resolveState(state, this._countingGet, x, y, z);
    const staticState = this._reads === 0 && !hasTp;
    if (!rs) { if (staticState) this.stateModels.set(state, null); return null; }
    const tp = hasTp && w.tileProps.get(x + ',' + y + ',' + z);
    if (tp) rs.props = { ...rs.props, ...tp };
    let key = rs.file + '|' + (rs.variant || '');
    for (const k in rs.props) key += k + '=' + rs.props[k] + ',';
    let m = this.cache.get(key);
    if (m === undefined) {
      const bs = this.store.blockstates[rs.file];
      if (!bs) { m = null; } else {
        const variants = bs.variants && this.store.findVariant(rs.file, rs.props, rs.variant);
        if (Array.isArray(variants)) {
          m = { multi: variants.map((v, i) => this.store.bakeVariant(rs.file, rs.props, rs.variant, i)), weights: variants.map((v) => v.weight || 1) };
        } else {
          m = this.store.bakeVariant(rs.file, rs.props, rs.variant, 0);
        }
      }
      this.cache.set(key, m);
    }
    if (staticState) this.stateModels.set(state, m);
    return this._pick(m, x, y, z);
  }

  _pick(m, x, y, z) {
    if (m && m.multi) {
      if (this.options.alt === false) return m.multi[0]; // Alternate Blocks: OFF
      // WeightedBakedModel: Math.abs((int) MathHelper.getPositionRandom(pos) >> 16) % totalWeight
      const total = m.weights.reduce((a, b) => a + b, 0);
      let r = Math.abs(positionRandom(x, y, z) >> 16) % total;
      for (let i = 0; i < m.multi.length; i++) { r -= m.weights[i]; if (r < 0) return m.multi[i]; }
      return m.multi[0];
    }
    return m;
  }

  tintFor(state, tint, x, y, z) {
    if (tint < 0) return 0xffffff;
    const b = getBlock(state);
    const n = b.name;
    const props = getStateProperties(state);
    switch (n) {
      case 'grass_block': case 'grass': case 'tall_grass': case 'fern': case 'large_fern': case 'sugar_cane':
        return this.biomeBlend(x, y, z, grassColor);
      case 'vine': return this.biomeBlend(x, y, z, foliageColor);
      case 'spruce_leaves': return 0x619961;
      case 'birch_leaves': return 0x80a755;
      default:
        if (n.endsWith('_leaves')) return this.biomeBlend(x, y, z, foliageColor);
        if (n === 'lily_pad') return 0x208030;
        if (n === 'attached_pumpkin_stem' || n === 'attached_melon_stem') return 0xe0c71c;
        if (n === 'pumpkin_stem' || n === 'melon_stem') {
          const age = Number(props.age || 0);
          return ((age * 32) << 16) | ((255 - age * 8) << 8) | (age * 4);
        }
        if (n === 'redstone_wire') {
          const power = Number(props.power || 0), f = power / 15;
          let r = f * 0.6 + 0.4;
          if (power === 0) r = 0.3;
          const g = Math.max(0, f * f * 0.7 - 0.5);
          const bl = Math.max(0, f * f * 0.6 - 0.7);
          return ((r * 255) << 16) | ((g * 255) << 8) | (bl * 255);
        }
        return 0xffffff;
    }
  }

  biomeBlend(x, y, z, fn) {
    let r = 0, g = 0, b = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = fn(this.world.getBiome(x + dx, z + dz), y);
        r += (c >> 16) & 255; g += (c >> 8) & 255; b += c & 255;
      }
    }
    return (((r / 9) | 0) << 16) | (((g / 9) | 0) << 8) | ((b / 9) | 0);
  }

  // Combined light used for AO sampling: returns [sky, block] or null if position is opaque
  lightAt(x, y, z) {
    const s = this.world.getState(x, y, z);
    const b = getBlock(s);
    if (b && b.opaque) return null;
    const l = this.world.getLight(x, y, z);
    if (b && b.useNeighborBrightness) {
      // Slabs/stairs: take the brightest neighbour
      let best = l;
      for (const o of DIR_OFFSETS) {
        const nl = this.world.getLight(x + o[0], y + o[1], z + o[2]);
        if ((nl >> 4) > (best >> 4)) best = (nl & 0xf0) | (best & 15);
        if ((nl & 15) > (best & 15)) best = (best & 0xf0) | (nl & 15);
      }
      return best;
    }
    return l;
  }

  aoValue(x, y, z) {
    const b = getBlock(this.world.getState(x, y, z));
    return b ? b.aoLight : 1;
  }

  isTranslucentForAO(x, y, z) {
    const b = getBlock(this.world.getState(x, y, z));
    return !b || !b.opaque;
  }

  // Compute per-corner light+AO for a face whose plane is at block (px,py,pz) looking in dir.
  // Returns array of 4 corners [(-,-),(+,-),(+,+),(-,+)] each [ao, sky, block] in tangent space.
  // lightAt with the block state already read
  _lightOf(state, x, y, z) {
    const b = getBlock(state);
    if (b && b.opaque) return null;
    if (b && b.useNeighborBrightness) return this.lightAt(x, y, z);
    return this.world.getLight(x, y, z);
  }

  faceCorners(px, py, pz, dir, out) {
    const [e1, e2] = AO_AXES[dir];
    const w = this.world;
    const sP = w.getState(px, py, pz), bP = getBlock(sP);
    const center = this._lightOf(sP, px, py, pz);
    const cAO = bP ? bP.aoLight : 1;
    const cSky = center === null ? 0 : center >> 4, cBlk = center === null ? 0 : center & 15;
    for (let k = 0; k < 4; k++) {
      const s1 = k === 0 || k === 3 ? -1 : 1; // along e1
      const s2 = k < 2 ? -1 : 1; // along e2
      const ax = px + e1[0] * s1, ay = py + e1[1] * s1, az = pz + e1[2] * s1;
      const bx = px + e2[0] * s2, by = py + e2[1] * s2, bz = pz + e2[2] * s2;
      const cx = ax + e2[0] * s2, cy = ay + e2[1] * s2, cz = az + e2[2] * s2;
      const sA = w.getState(ax, ay, az), sB = w.getState(bx, by, bz);
      const bA = getBlock(sA), bB = getBlock(sB);
      const aoA = bA ? bA.aoLight : 1;
      const aoB = bB ? bB.aoLight : 1;
      const tA = !bA || !bA.opaque;
      const tB = !bB || !bB.opaque;
      const lA = this._lightOf(sA, ax, ay, az);
      const lB = this._lightOf(sB, bx, by, bz);
      let aoC, lC;
      if (tA || tB) { const sC = w.getState(cx, cy, cz), bC = getBlock(sC); aoC = bC ? bC.aoLight : 1; lC = this._lightOf(sC, cx, cy, cz); } else { aoC = aoA; lC = lA; }
      const ao = (aoA + aoB + aoC + cAO) * 0.25;
      // vanilla getAoBrightness: zero entries replaced by centre
      const sky = ((lA === null || lA === 0 ? cSky : lA >> 4) + (lB === null || lB === 0 ? cSky : lB >> 4) + (lC === null || lC === 0 ? cSky : lC >> 4) + cSky) / 4;
      const blk = ((lA === null || lA === 0 ? cBlk : lA & 15) + (lB === null || lB === 0 ? cBlk : lB & 15) + (lC === null || lC === 0 ? cBlk : lC & 15) + cBlk) / 4;
      const c = out[k];
      c[0] = ao; c[1] = sky; c[2] = blk;
    }
    return out;
  }

  shouldRenderFace(state, nState, dir) {
    const nb = getBlock(nState);
    const nid = nb ? nb.id : 0;
    if (!nb || nb.id === 0) return true;
    if (nb.opaque) return false;
    const F = this._flags;
    // Fast graphics: leaves are opaque cubes
    if (!this.options.fancy && (F[nid] & 1)) return false;
    // Glass/ice compare block identity, not global state (e.g. frosted ice age).
    // Each stained color has its own block id; keep faces between different colors.
    const own = getBlock(state);
    const f = own ? F[own.id] : 0;
    if (own && own.id === nid) {
      if ((f & 2) && (own.name !== 'nether_portal' || state === nState)) return false;
      if (f & 4) {
        // Pane connections and waterlogging can differ across the shared face.
        // Only hide horizontal end caps when both panes actually connect.
        if (dir < 2) return false;
        const p = getStateProperties(state), np = getStateProperties(nState);
        if (p[DIR_NAMES[dir]] === 'true' && np[DIR_NAMES[OPPOSITE[dir]]] === 'true') return false;
      }
    }
    return true;
  }

  // world: a SliceWorld around the section
  // lod (MinecraftJS level of detail, far sections): flat lighting, fast leaves, no small plants
  buildSection(world, cx, sy, cz, lod = false) {
    if (lod) {
      const saved = this.options;
      this.options = { ...saved, fancy: false, smooth: 0, lod: true };
      try { return this.buildSection(world, cx, sy, cz, false); } finally { this.options = saved; }
    }
    this.world = world;
    this._flags = faceFlags();
    // the buffers stay allocated between builds (result() copies the used part out)
    const bufs = this._bufs || (this._bufs = [new VBuf(), new VBuf(), new VBuf()]);
    const solid = bufs[0].reset(), cutout = bufs[1].reset(), trans = bufs[2].reset();
    const w = world;
    const bx0 = cx * 16, by0 = sy * 16, bz0 = cz * 16;
    const blocksArr = w.getSectionBlocks();
    if (!blocksArr) return null;
    for (let i = 0; i < 4096; i++) {
      const state = blocksArr[i];
      const b = getBlock(state);
      const id = b ? b.id : 0;
      if (id === 0) continue;
      const lx = i & 15, lz = (i >> 4) & 15, ly = i >> 8;
      const x = bx0 + lx, y = by0 + ly, z = bz0 + lz;
      if (!b) continue;
      const fluid = getFluidState(state);
      if (fluid) this.renderFluid(state, fluid, x, y, z, trans, lx, ly, lz);
      if (b.isLiquid) continue;
      if (!b.hasModel) continue;
      if (this.options.lod && LOD_SKIP.has(b.name)) continue;
      const model = this.getModel(state, x, y, z);
      if (!model || !model.quads.length) continue;
      // Block.getOffsetType: flowers are nudged randomly in XZ, tall grass in XYZ (BlockModelRenderer)
      let ox = 0, oy = 0, oz = 0;
      const offType = OFFSET_TYPES[b.name];
      if (offType) {
        const r = positionRandom(x, y, z);
        ox = (((r >>> 16) & 15) / 15 - 0.5) * 0.5;
        oz = (((r >>> 24) & 15) / 15 - 0.5) * 0.5;
        if (offType === 2) oy = (((r >>> 20) & 15) / 15 - 1) * 0.2;
      }
      const useAO = this.options.smooth && model.ao && b.emitLight === 0;
      const fastLeaves = !this.options.fancy && this.isLeaves(b);
      const visible = this._visible;
      for (let d = 0; d < 6; d++) {
        const o = DIR_OFFSETS[d];
        visible[d] = this.shouldRenderFace(state, w.getState(x + o[0], y + o[1], z + o[2]), d) ? 1 : 0;
      }
      this._cornerValid.fill(0);
      const ownLight = this.lightAt(x, y, z);
      const tintCache = this._tintCache; tintCache.length = 0; // tint per tint index for this block
      for (const q of model.quads) {
        if (q.cull >= 0 && !visible[q.cull]) continue;
        let buf;
        if (b.translucent) buf = trans; else if (q.alpha && !fastLeaves) buf = cutout; else buf = solid;
        let tint = q.tint < 0 ? 0xffffff : tintCache[q.tint];
        if (tint === undefined) tint = tintCache[q.tint] = this.tintFor(state, q.tint, x, y, z);
        const tr = ((tint >> 16) & 255) / 255, tg = ((tint >> 8) & 255) / 255, tb = (tint & 255) / 255;
        const shade = q.shade ? FACE_SHADE[q.dir] : 1;
        const p = q.pos, uv = q.uv;
        // Is this quad axis-aligned to its face dir?
        const axis = q.dir >> 1; // 0:y 1:z 2:x
        const ci = axis === 0 ? 1 : axis === 1 ? 2 : 0;
        const planeVal = p[ci];
        const aligned = Math.abs(p[3 + ci] - planeVal) < 1e-4 && Math.abs(p[6 + ci] - planeVal) < 1e-4 && Math.abs(p[9 + ci] - planeVal) < 1e-4;
        if (useAO && aligned) {
          const flush = (q.dir & 1) ? planeVal > 0.9999 : planeVal < 0.0001;
          const o = DIR_OFFSETS[q.dir];
          const px = flush ? x + o[0] : x, py = flush ? y + o[1] : y, pz = flush ? z + o[2] : z;
          const ck = q.dir * 2 + (flush ? 1 : 0);
          const corners = this._corners[ck];
          if (!this._cornerValid[ck]) { this.faceCorners(px, py, pz, q.dir, corners); this._cornerValid[ck] = 1; }
          const [e1, e2] = AO_AXES[q.dir];
          for (let v = 0; v < 4; v++) {
            const vx = p[v * 3], vy = p[v * 3 + 1], vz = p[v * 3 + 2];
            const t1 = vx * e1[0] + vy * e1[1] + vz * e1[2];
            const t2 = vx * e2[0] + vy * e2[1] + vz * e2[2];
            // bilinear over corners (-,-)=0, (+,-)=1, (+,+)=2, (-,+)=3
            const w0 = (1 - t1) * (1 - t2), w1 = t1 * (1 - t2), w2 = t1 * t2, w3 = (1 - t1) * t2;
            const ao = corners[0][0] * w0 + corners[1][0] * w1 + corners[2][0] * w2 + corners[3][0] * w3;
            const sky = corners[0][1] * w0 + corners[1][1] * w1 + corners[2][1] * w2 + corners[3][1] * w3;
            const blk = corners[0][2] * w0 + corners[1][2] * w1 + corners[2][2] * w2 + corners[3][2] * w3;
            const f = shade * ao;
            buf.push10(lx + vx + ox, ly + vy + oy, lz + vz + oz, uv[v * 2], uv[v * 2 + 1], tr * f, tg * f, tb * f, sky, blk);
          }
        } else {
          let l = ownLight;
          if (q.cull >= 0) {
            const o = DIR_OFFSETS[q.cull];
            const nl = this.lightAt(x + o[0], y + o[1], z + o[2]);
            if (nl !== null) l = nl;
          }
          if (l === null) l = w.getLight(x, y, z);
          const sky = l >> 4, blk = l & 15;
          for (let v = 0; v < 4; v++) {
            buf.push10(lx + p[v * 3] + ox, ly + p[v * 3 + 1] + oy, lz + p[v * 3 + 2] + oz, uv[v * 2], uv[v * 2 + 1], tr * shade, tg * shade, tb * shade, sky, blk);
          }
        }
      }
    }
    return { solid: solid.result(), cutout: cutout.result(), translucent: trans.result(), vis: computeVisibility(blocksArr, this.options.fancy), lod: !!this.options.lod };
  }

  // ---- Fluids (port of BlockFluidRenderer) ----

  fluidMatches(state, lava) {
    const fluid = getFluidState(state);
    return !!fluid && fluid.isLava === lava;
  }

  fluidHeight(x, y, z, lava) {
    let count = 0;
    let sum = 0;
    for (let j = 0; j < 4; j++) {
      const bx = x - (j & 1), bz = z - ((j >> 1) & 1);
      if (this.fluidMatches(this.world.getState(bx, y + 1, bz), lava)) return 1;
      const s = this.world.getState(bx, y, bz);
      if (!this.fluidMatches(s, lava)) {
        const b = getBlock(s);
        const solid = b && b.boundingBox === 'block' && b.id !== 0;
        if (!solid) { sum += 1; count++; }
      } else {
        const k = getFluidState(s).level;
        const pct = ((k >= 8 ? 0 : k) + 1) / 9;
        if (k >= 8 || k === 0) { sum += pct * 10; count += 10; }
        sum += pct;
        count++;
      }
    }
    return count ? 1 - sum / count : 0;
  }

  flowDecay(x, y, z, lava) {
    const s = this.world.getState(x, y, z);
    if (!this.fluidMatches(s, lava)) return -1;
    const l = getFluidState(s).level;
    return l >= 8 ? 0 : l;
  }

  flowDirection(x, y, z, lava) {
    let vx = 0, vz = 0;
    const i = this.flowDecay(x, y, z, lava);
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      let j = this.flowDecay(x + dx, y, z + dz, lava);
      if (j < 0) {
        const s = this.world.getState(x + dx, y, z + dz);
        const b = getBlock(s);
        const blocksMovement = b && b.boundingBox === 'block' && b.id !== 0;
        if (!blocksMovement) {
          j = this.flowDecay(x + dx, y - 1, z + dz, lava);
          if (j >= 0) { const k = j - (i - 8); vx += dx * k; vz += dz * k; }
        }
      } else {
        const k = j - i; vx += dx * k; vz += dz * k;
      }
    }
    if (vx === 0 && vz === 0) return -1000;
    return Math.atan2(vz, vx) - Math.PI / 2;
  }

  renderFluid(state, fluid, x, y, z, buf, lx, ly, lz) {
    const lava = fluid.isLava;
    const w = this.world;
    const still = lava ? this.lavaStill : this.waterStill;
    const flow = lava ? this.lavaFlow : this.waterFlow;
    if (!still || !flow) return;
    const col = lava ? 0xffffff : this.biomeBlend(x, y, z, (bio) => waterColor(bio));
    const cr = ((col >> 16) & 255) / 255, cg = ((col >> 8) & 255) / 255, cb = (col & 255) / 255;
    const up = w.getState(x, y + 1, z);
    const down = w.getState(x, y - 1, z);
    const sideStates = [w.getState(x, y, z - 1), w.getState(x, y, z + 1), w.getState(x - 1, y, z), w.getState(x + 1, y, z)];
    let h00 = this.fluidHeight(x, y, z, lava);
    let h01 = this.fluidHeight(x, y, z + 1, lava);
    let h11 = this.fluidHeight(x + 1, y, z + 1, lava);
    let h10 = this.fluidHeight(x + 1, y, z, lava);
    const height = Math.max(h00, h01, h11, h10);
    const renderTop = !this.fluidMatches(up, lava) && !coversFluidFace(state, 1, height);
    const renderBottom = !this.fluidMatches(down, lava) && !coversFluidFace(state, 0) && !coversFluidFace(down, 1);
    const sides = sideStates.map((s, i) => !this.fluidMatches(s, lava) &&
      !coversFluidFace(state, i + 2, height) && !coversFluidFace(s, (i + 2) ^ 1, height));
    if (!renderTop && !renderBottom && !sides.some(v => v)) return;
    const U = (uv, t) => uv[0] + (uv[2] - uv[0]) * t / 16;
    const V = (uv, t) => uv[1] + (uv[3] - uv[1]) * t / 16;
    const light = (lx2, ly2, lz2) => {
      const a = w.getLight(lx2, ly2, lz2);
      return a;
    };
    const lt = Math.max(light(x, y, z) >> 4, light(x, y + 1, z) >> 4);
    const lb = Math.max(light(x, y, z) & 15, light(x, y + 1, z) & 15);
    const emitL = lava ? 15 : 0;

    const quad = (verts, shade, sky, blk) => {
      // verts: [[x,y,z,u,v] x4]
      for (const v of verts) buf.push10(lx + v[0], ly + v[1], lz + v[2], v[3], v[4], cr * shade, cg * shade, cb * shade, sky, Math.max(blk, emitL));
      for (let k = 3; k >= 0; k--) { const v = verts[k]; buf.push10(lx + v[0], ly + v[1], lz + v[2], v[3], v[4], cr * shade, cg * shade, cb * shade, sky, Math.max(blk, emitL)); }
    };

    if (renderTop) {
      h00 -= 0.001; h01 -= 0.001; h11 -= 0.001; h10 -= 0.001;
      const dirA = this.flowDirection(x, y, z, lava);
      let uvs;
      if (dirA < -999) {
        uvs = [[U(still, 0), V(still, 0)], [U(still, 0), V(still, 16)], [U(still, 16), V(still, 16)], [U(still, 16), V(still, 0)]];
      } else {
        const s = Math.sin(dirA) * 0.25, c = Math.cos(dirA) * 0.25;
        uvs = [
          [U(flow, 8 + (-c - s) * 16), V(flow, 8 + (-c + s) * 16)],
          [U(flow, 8 + (-c + s) * 16), V(flow, 8 + (c + s) * 16)],
          [U(flow, 8 + (c + s) * 16), V(flow, 8 + (c - s) * 16)],
          [U(flow, 8 + (c - s) * 16), V(flow, 8 + (-c - s) * 16)],
        ];
      }
      quad([
        [0, h00, 0, uvs[0][0], uvs[0][1]],
        [0, h01, 1, uvs[1][0], uvs[1][1]],
        [1, h11, 1, uvs[2][0], uvs[2][1]],
        [1, h10, 0, uvs[3][0], uvs[3][1]],
      ], 1.0, lt, lb);
    }
    if (renderBottom) {
      const l = w.getLight(x, y - 1, z);
      quad([
        [0, 0, 1, U(still, 0), V(still, 16)],
        [0, 0, 0, U(still, 0), V(still, 0)],
        [1, 0, 0, U(still, 16), V(still, 0)],
        [1, 0, 1, U(still, 16), V(still, 16)],
      ], 0.5, l >> 4, l & 15);
    }
    const sideDefs = [
      [h00, h10, 0, 1, 0.001, 0.001, [0, 0, -1]],
      [h11, h01, 1, 0, 0.999, 0.999, [0, 0, 1]],
      [h01, h00, 0.001, 0.001, 1, 0, [-1, 0, 0]],
      [h10, h11, 0.999, 0.999, 0, 1, [1, 0, 0]],
    ];
    for (let j = 0; j < 4; j++) {
      if (!sides[j]) continue;
      const [f20, f21, d3, d4, d5, d6, o] = sideDefs[j];
      const u0 = U(flow, 0), u1 = U(flow, 8);
      const v0 = V(flow, (1 - f20) * 16 * 0.5), v1 = V(flow, (1 - f21) * 16 * 0.5), v2 = V(flow, 8);
      const l = w.getLight(x + o[0], y, z + o[2]);
      const shade = j < 2 ? 0.8 : 0.6;
      quad([
        [d3, f20, d5, u0, v0],
        [d4, f21, d6, u1, v1],
        [d4, 0, d6, u1, v2],
        [d3, 0, d5, u0, v2],
      ], shade, l >> 4, l & 15);
    }
  }
}
