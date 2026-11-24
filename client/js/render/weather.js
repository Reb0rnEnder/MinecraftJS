// Rain/snow rendering, rain splashes + sound, and random block display ticks (ambience).
// Native 1.20.6: LevelRenderer.renderSnowAndRain / tickRain and ClientLevel.animateTick.
import { getBlock, getStateProperties, staticCollisionBoxes } from '../world/blocks.js';
import { biomeRainType, biomeInfo } from '../world/biomes.js';
import { FORMAT, litParams } from '../gfx/device.js';
import { JavaRandom } from '../util/jrandom.js';

const MAX_RADIUS = 10;
const MAX = (MAX_RADIUS * 2 + 1) ** 2;
const STRIDE = FORMAT.lit.stride;
const PARAMS = litParams(0.1);
const STATE = { blend: 'alpha', depthWrite: false, cull: false };
const MOTION_BLOCKING = 4; // bit of the native Heightmap.Types predicate masks
const NO_HEIGHT = -0x80000000;
const f32 = Math.fround;
// LevelRenderer.rainSizeX / rainSizeZ
const rainX = new Float32Array(1024), rainZ = new Float32Array(1024);
for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) {
  const f = j - 16, f1 = i - 16;
  const f2 = f32(Math.sqrt(f * f + f1 * f1));
  rainX[(i << 5) | j] = -f1 / f2;
  rainZ[(i << 5) | j] = f / f2;
}

// RandomSource.nextGaussian (MarsagliaPolarGaussian) over a legacy random source
function gaussian(r) {
  if (r.haveGaussian) { r.haveGaussian = false; return r.nextGaussianValue; }
  let v1, v2, s;
  do { v1 = 2 * r.nextDouble() - 1; v2 = 2 * r.nextDouble() - 1; s = v1 * v1 + v2 * v2; } while (s >= 1 || s === 0);
  const m = Math.sqrt(-2 * Math.log(s) / s);
  r.nextGaussianValue = v2 * m; r.haveGaussian = true;
  return v1 * m;
}

// Per-column random values: LevelRenderer seeds a legacy random with
// (x*x*3121 + x*45238971) ^ (z*z*418711 + z*13761) for every column, every frame. They never change, so cache them.
export function columnRandom(x, z) {
  const seed = (Math.imul(Math.imul(x, x), 3121) + Math.imul(x, 45238971)) ^ (Math.imul(Math.imul(z, z), 418711) + Math.imul(z, 13761));
  const r = new JavaRandom(seed | 0);
  const rainSpeed = 3 + r.nextFloat();
  const r2 = new JavaRandom(seed | 0);
  const su = r2.nextDouble(), sug = gaussian(r2), sv = r2.nextDouble(), svg = gaussian(r2);
  return { x, z, rainSpeed: f32(rainSpeed), su, sug, sv, svg, hash: (Math.imul(Math.imul(x, x), 3121) + Math.imul(x, 45238971) + Math.imul(Math.imul(z, z), 418711) + Math.imul(z, 13761)) & 0xff };
}

export class Weather {
  constructor(game) {
    this.game = game;
    const r = game.renderer;
    this.updateCount = 0;
    this.rainSoundCounter = 0;
    this.columns = new Map();
    this.heights = new WeakMap();
    this.layers = {};
    for (const kind of ['rain', 'snow']) {
      this.layers[kind] = {
        tex: 'environment/' + kind + '.png',
        data: new Float32Array(MAX * 4 * STRIDE),
        mesh: game.device.createMesh(FORMAT.lit, new Float32Array(0), { quads: true, dynamic: true }),
        count: 0,
      };
    }
    const draw = (d) => this.draw(d);
    draw.order = 12; draw.profileName = 'weather';
    r.extraDraws.push(draw);
  }

  draw(d) {
    const A = this.game.assets;
    for (const L of Object.values(this.layers)) {
      if (!L.count) continue;
      const tex = A.texture(L.tex, { wrap: 'repeat' });
      if (tex) d.draw({ mesh: L.mesh, pipeline: 'lit', textures: [tex], params: PARAMS, state: STATE, count: L.count * 6 });
    }
  }

  _masks() {
    const raw = this.game.assets?.data?.blockCollisionShapes?.debugHeightmaps?.masks;
    if (raw !== this._rawMasks) {
      this._rawMasks = raw;
      this._maskBytes = raw ? Uint8Array.from(raw, (c) => parseInt(c, 16)) : null;
    }
    return this._maskBytes;
  }

  _column(x, z) {
    const key = (x & 0xffff) * 0x10000 + (z & 0xffff);
    let c = this.columns.get(key);
    if (!c || c.x !== x || c.z !== z) {
      if (this.columns.size > 4096) this.columns.clear();
      c = columnRandom(x, z); this.columns.set(key, c);
    }
    return c;
  }

  // Heightmap.Types.MOTION_BLOCKING height (y above the highest motion-blocking or fluid block), cached per
  // chunk column until a block in that chunk changes
  precipHeight(x, z) {
    const w = this.game.world;
    const chunk = w.getChunk?.(x >> 4, z >> 4);
    const minY = w.minY ?? 0;
    if (!chunk) return minY;
    let cache = this.heights.get(chunk);
    const rev = chunk.blockRevision || 0, loadRev = chunk.debugHeightRevision || 0;
    if (!cache || cache.rev !== rev || cache.loadRev !== loadRev) {
      cache = { rev, loadRev, values: new Int32Array(256).fill(NO_HEIGHT) };
      this.heights.set(chunk, cache);
    }
    const i = ((z & 15) << 4) | (x & 15);
    if (cache.values[i] !== NO_HEIGHT) return cache.values[i];
    const masks = this._masks();
    let h = minY;
    scan: for (let sy = (w.maxSection ?? 16) - 1; sy >= (w.minSection ?? 0); sy--) {
      const section = chunk.getSection(sy);
      if (!section || section.nonAir === 0) continue;
      for (let y = 15; y >= 0; y--) {
        const state = section.get(x & 15, y, z & 15);
        if (state === 0) continue;
        const blocks = masks ? (masks[state] & MOTION_BLOCKING) !== 0 : (() => { const b = getBlock(state); return b && (b.boundingBox === 'block' || b.isLiquid); })();
        if (blocks) { h = sy * 16 + y + 1; break scan; }
      }
    }
    cache.values[i] = h;
    return h;
  }

  _fancy() { const s = this.game.settings; return !!(s.fancyGraphics || s.fabulousGraphics); }

  tick() {
    this.updateCount++;
    const g = this.game;
    if (!g.inWorld) return;
    this._rainParticles();
    this._ambience();
  }

  // LevelRenderer.tickRain
  _rainParticles() {
    const g = this.game;
    const w = g.world;
    const f = w.rainStrength / (this._fancy() ? 1 : 2);
    if (!(f > 0)) return;
    const random = new JavaRandom(BigInt.asIntN(64, BigInt(this.updateCount) * 312987231n));
    const cam = g.renderer?.camPos || [g.player.x, g.player.y + 1.62, g.player.z];
    const cx = Math.floor(cam[0]), cy = Math.floor(cam[1]), cz = Math.floor(cam[2]);
    const particles = g.settings.particles || 0;
    const n = Math.trunc(100 * f32(f * f)) / (particles === 1 ? 2 : 1);
    const minY = w.minY ?? 0;
    let hit = null;
    for (let i = 0; i < n; i++) {
      const x = cx + random.nextInt(21) - 10, z = cz + random.nextInt(21) - 10;
      const top = this.precipHeight(x, z);
      if (top <= minY || top > cy + 10 || top < cy - 10) continue;
      if (biomeRainType(w.getBiome(x, z, top), top, x, z) !== 'rain') continue;
      hit = [x, top - 1, z];
      if (particles === 2) break;
      const rx = random.nextDouble(), rz = random.nextDouble();
      const state = w.getState(x, top - 1, z), b = getBlock(state);
      let shapeTop = -Infinity;
      for (const box of staticCollisionBoxes(state, x, top - 1, z)) if (rx >= box[0] && rx <= box[3] && rz >= box[2] && rz <= box[5] && box[4] > shapeTop) shapeTop = box[4];
      const fluid = this._fluidHeight(state, w.getState(x, top, z));
      const y = top - 1 + Math.max(shapeTop, fluid);
      const props = getStateProperties(state);
      if ((b && b.name === 'lava') || (b && b.name === 'magma_block') || (b && /campfire$/.test(b.name) && props.lit === 'true')) g.particles.smoke(x + rx, y, z + rz, 0, 0, 0);
      else g.particles.rain(x + rx, y, z + rz);
    }
    if (hit && random.nextInt(3) < this.rainSoundCounter++) {
      this.rainSoundCounter = 0;
      const [sx, sy, sz] = hit;
      if (sy > cy + 1 && this.precipHeight(cx, cz) > cy) g.sound.play('weather.rain.above', sx + 0.5, sy + 0.5, sz + 0.5, 0.1, 0.5);
      else g.sound.play('weather.rain', sx + 0.5, sy + 0.5, sz + 0.5, 0.2, 1);
    }
  }

  // FluidState.getHeight: 1 under the same fluid, else amount / 9 (sources hold 8)
  _fluidHeight(state, above) {
    const kind = this._fluid(state);
    if (!kind) return 0;
    if (this._fluid(above) === kind) return 1;
    const b = getBlock(state), level = b && (b.name === 'water' || b.name === 'lava') ? Number(getStateProperties(state).level || 0) : 0;
    const amount = level === 0 ? 8 : level >= 8 ? 8 : 8 - level;
    return amount / 9;
  }

  _fluid(state) {
    const b = getBlock(state);
    if (!b || b.id === 0) return null;
    if (b.name === 'lava') return 'lava';
    if (b.name === 'water' || b.name === 'bubble_column' || b.name === 'kelp' || b.name === 'kelp_plant' || b.name === 'seagrass' || b.name === 'tall_seagrass') return 'water';
    return getStateProperties(state).waterlogged === 'true' ? 'water' : null;
  }

  // ClientLevel.animateTick: 667 random blocks within 16 and 667 within 32 of the player each tick
  _ambience() {
    const g = this.game;
    const w = g.world;
    const px = Math.floor(g.player.x), py = Math.floor(g.player.y), pz = Math.floor(g.player.z);
    for (let i = 0; i < 667; i++) {
      this._displayTick(w, px, py, pz, 16);
      this._displayTick(w, px, py, pz, 32);
    }
  }

  _displayTick(w, px, py, pz, r) {
    const g = this.game;
    const x = px + Math.floor(Math.random() * r) - Math.floor(Math.random() * r);
    const y = py + Math.floor(Math.random() * r) - Math.floor(Math.random() * r);
    const z = pz + Math.floor(Math.random() * r) - Math.floor(Math.random() * r);
    const st = w.getState(x, y, z);
    if (st !== 0) g.particles.randomDisplayTick(x, y, z, st);
    if (getBlock(st)?.collisionFull) return;
    const ambient = biomeInfo(w.getBiome(x, z, y)).effects?.particle;
    if (ambient && Math.random() <= ambient.probability) g.particles.nativeParticle(ambient.options.type.replace(/^minecraft:/, ''), x + Math.random(), y + Math.random(), z + Math.random());
  }

  // LevelRenderer.renderSnowAndRain
  render(partial, cx, cy, cz) {
    const g = this.game;
    const w = g.world;
    const rain = w.prevRain !== undefined ? w.prevRain + (w.rainStrength - w.prevRain) * partial : w.rainStrength;
    for (const L of Object.values(this.layers)) L.count = 0;
    if (!(rain > 0)) return;
    const R = this._fancy() ? 10 : 5;
    const bx = Math.floor(cx), by = Math.floor(cy), bz = Math.floor(cz);
    const ticks = this.updateCount, t = f32(ticks + partial);
    const rainLayer = this.layers.rain, snowLayer = this.layers.snow;
    for (let z = bz - R; z <= bz + R; z++) {
      for (let x = bx - R; x <= bx + R; x++) {
        const biome = w.getBiome(x, z, by);
        const info = biomeInfo(biome);
        if (info.precipitation === 'none' || info.has_precipitation === false) continue;
        const top = this.precipHeight(x, z);
        let y0 = by - R, y1 = by + R;
        if (y0 < top) y0 = top;
        if (y1 < top) y1 = top;
        const ly = top < by ? by : top;
        if (y0 === y1) continue;
        const kind = biomeRainType(biome, y0, x, z);
        if (kind === 'none') continue;
        const col = this._column(x, z);
        const k = ((z - bz + 16) << 5) | (x - bx + 16);
        const dx = rainX[k] * 0.5, dz = rainZ[k] * 0.5;
        if (dx !== dx) continue; // the camera's own column: native sizes are 0/0 = NaN, a degenerate quad that never draws
        const ddx = x + 0.5 - cx, ddz = z + 0.5 - cz;
        const dist = f32(Math.sqrt(ddx * ddx + ddz * ddz)) / R;
        let sky = w.getSkyLight(x, ly, z), blk = w.getBlockLight(x, ly, z);
        const emit = getBlock(w.getState(x, ly, z))?.emitLight || 0;
        if (emit > blk) blk = emit;
        let L, alpha, u0, vTop, vBottom;
        if (kind === 'rain') {
          L = rainLayer;
          const v = f32(f32(-(f32((ticks & 0x1ffff) + col.hash) + partial) / 32) * col.rainSpeed) % 32;
          alpha = ((1 - dist * dist) * 0.5 + 0.5) * rain;
          u0 = 0; vTop = y0 * 0.25 + v; vBottom = y1 * 0.25 + v;
        } else {
          L = snowLayer;
          const v = -((ticks & 0x1ff) + partial) / 512;
          u0 = f32(col.su + t * 0.01 * f32(col.sug));
          const v2 = f32(col.sv + f32(t * f32(col.svg)) * 0.001);
          alpha = ((1 - dist * dist) * 0.3 + 0.5) * rain;
          vTop = y0 * 0.25 + v + v2; vBottom = y1 * 0.25 + v + v2;
          // snow is lit brighter: (packed * 3 + 240) / 4 on each lightmap coordinate
          sky = ((sky * 48 + 240) >> 2) / 16; blk = ((blk * 48 + 240) >> 2) / 16;
        }
        const x0 = x - dx + 0.5, z0 = z - dz + 0.5, x1 = x + dx + 0.5, z1 = z + dz + 0.5;
        const D = L.data;
        let o = L.count++ * 4 * STRIDE;
        o = vertex(D, o, x0, y1, z0, u0, vTop, alpha, sky, blk);
        o = vertex(D, o, x1, y1, z1, u0 + 1, vTop, alpha, sky, blk);
        o = vertex(D, o, x1, y0, z1, u0 + 1, vBottom, alpha, sky, blk);
        vertex(D, o, x0, y0, z0, u0, vBottom, alpha, sky, blk);
      }
    }
    for (const L of Object.values(this.layers)) if (L.count) g.device.updateMesh(L.mesh, L.data.subarray(0, L.count * 4 * STRIDE), { quads: true });
  }
}

function vertex(D, o, x, y, z, u, v, a, sky, blk) {
  D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = u; D[o + 4] = v;
  D[o + 5] = 1; D[o + 6] = 1; D[o + 7] = 1; D[o + 8] = a; D[o + 9] = sky; D[o + 10] = blk;
  return o + STRIDE;
}
