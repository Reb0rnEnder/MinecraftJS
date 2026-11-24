// Rain/snow rendering, rain splashes + sound, and random block display ticks (ambience).
// Native 1.8.9 EntityRenderer.renderRainSnow / addRainParticles and WorldClient.doVoidFogParticles. NATIVE below records what differs between releases; each value was read from this release's jar.
import { blocks, staticCollisionBoxes, jarSelectionBox } from '../world/blocks.js';
import { biomeRainType, biomeInfo } from '../world/biomes.js';
import { FORMAT, litParams } from '../gfx/device.js';
import { JavaRandom } from '../util/jrandom.js';

export const NATIVE = {tick: 'bounds', tickMinY: 'none', tickOrigin: 'entity', renderOrigin: 'entity', rainScroll: 'double', scrollSign: 1, biomeY: 'zero', precipitation: 'type', lightEmission: false, snowBlockLightTriple: false, smoke: ['lava', 'flowing_lava'], campfireSmoke: false, displayTicks: 1000, displayRadii: [16], biomeParticles: false, sounds: ['ambient.weather.rain', 'ambient.weather.rain']};
// Block definitions are indexed by id; states pack id << 4 | metadata
const blockOf = (state) => blocks[state >> 4];

const MAX_RADIUS = 10;
const MAX = (MAX_RADIUS * 2 + 1) ** 2;
const STRIDE = FORMAT.lit.stride;
const PARAMS = litParams(0.1);
const STATE = { blend: 'alpha', depthWrite: false, cull: false };
const MOTION_BLOCKING = 4; // bit of the native Heightmap.Types predicate masks
const NO_HEIGHT = -0x80000000;
const f32 = Math.fround;
// rainSizeX / rainSizeZ
const rainX = new Float32Array(1024), rainZ = new Float32Array(1024);
for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) {
  const f = j - 16, f1 = i - 16;
  const f2 = f32(Math.sqrt(f * f + f1 * f1));
  rainX[(i << 5) | j] = -f1 / f2;
  rainZ[(i << 5) | j] = f / f2;
}

// Random.nextGaussian (Marsaglia polar) over a legacy random source
function gaussian(r) {
  if (r.haveGaussian) { r.haveGaussian = false; return r.nextGaussianValue; }
  let v1, v2, s;
  do { v1 = 2 * r.nextDouble() - 1; v2 = 2 * r.nextDouble() - 1; s = v1 * v1 + v2 * v2; } while (s >= 1 || s === 0);
  const m = Math.sqrt(-2 * Math.log(s) / s);
  r.nextGaussianValue = v2 * m; r.haveGaussian = true;
  return v1 * m;
}

// Per-column random values: the renderer seeds a legacy random with
// (x*x*3121 + x*45238971) ^ (z*z*418711 + z*13761) for every column, every frame. They never change, so cache them.
export function columnRandom(x, z) {
  const seed = (Math.imul(Math.imul(x, x), 3121) + Math.imul(x, 45238971)) ^ (Math.imul(Math.imul(z, z), 418711) + Math.imul(z, 13761));
  const r = new JavaRandom(seed | 0);
  const rainSpeed = NATIVE.rainScroll === 'double' ? 3 + r.nextDouble() : f32(3 + r.nextFloat());
  const r2 = new JavaRandom(seed | 0);
  const su = r2.nextDouble(), sug = gaussian(r2), sv = r2.nextDouble(), svg = gaussian(r2);
  return { x, z, rainSpeed, su, sug, sv, svg, hash: (Math.imul(Math.imul(x, x), 3121) + Math.imul(x, 45238971) + Math.imul(Math.imul(z, z), 418711) + Math.imul(z, 13761)) & 0xff };
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

  // Precipitation height: y above the highest block that blocks movement or holds fluid (the native
  // MOTION_BLOCKING predicate masks when this release has them), cached per chunk column until a block changes
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
        if (masks ? (masks[state] & MOTION_BLOCKING) !== 0 : this._blocksPrecipitation(state)) { h = sy * 16 + y + 1; break scan; }
      }
    }
    cache.values[i] = h;
    return h;
  }

  _blocksPrecipitation(state) {
    const b = blockOf(state);
    return !!b && b.id !== 0 && (b.boundingBox === 'block' || b.isLiquid || this._fluid(state) !== null);
  }

  _fancy() { const s = this.game.settings; return !!(s.fancyGraphics || s.fabulousGraphics); }

  // Biome precipitation at a position: 'rain', 'snow' or 'none'
  _precipitation(biome, x, y, z) { return biomeRainType(biome, y, x, z); }

  // Can rain splash here (the tick's biome test)?
  _rainsAt(x, y, z) {
    const w = this.game.world, biome = w.getBiome(x, z, y);
    if (NATIVE.precipitation === 'has') return this._precipitation(biome, x, y, z) === 'rain';
    return biomeInfo(biome).precipitation === 'rain' && this._precipitation(biome, x, y, z) === 'rain';
  }

  tick() {
    this.updateCount++;
    const g = this.game;
    if (!g.inWorld) return;
    this._rainParticles();
    this._ambience();
  }

  _tickOrigin() {
    const g = this.game;
    if (NATIVE.tickOrigin === 'camera' && g.renderer?.camPos) return g.renderer.camPos;
    return [g.player.x, g.player.y, g.player.z];
  }

  // Rain splashes and the rain sound around the camera
  _rainParticles() {
    const g = this.game;
    const w = g.world;
    const f = w.rainStrength / (this._fancy() ? 1 : 2);
    if (!(f > 0)) return;
    const random = new JavaRandom(BigInt.asIntN(64, BigInt(this.updateCount) * 312987231n));
    const o = this._tickOrigin();
    const cx = Math.floor(o[0]), cy = Math.floor(o[1]), cz = Math.floor(o[2]);
    const particles = g.settings.particles || 0;
    if (NATIVE.tick === 'modern') this._modernRain(g, w, random, f, cx, cy, cz, particles);
    else this._legacyRain(g, w, random, f, cx, cy, cz, particles);
  }

  // 1.16+: nextInt(21) - 10 offsets; the sound plays at the last block that caught rain
  _modernRain(g, w, random, f, cx, cy, cz, particles) {
    const n = Math.trunc(100 * f32(f * f)) / (particles === 1 ? 2 : 1);
    const minY = NATIVE.tickMinY === 'world' ? (w.minY ?? 0) : 0;
    let hit = null;
    for (let i = 0; i < n; i++) {
      const x = cx + random.nextInt(21) - 10, z = cz + random.nextInt(21) - 10;
      const top = this.precipHeight(x, z);
      if (top <= minY || top > cy + 10 || top < cy - 10) continue;
      if (!this._rainsAt(x, top, z)) continue;
      hit = [x, top - 1, z];
      if (particles === 2) break;
      const rx = random.nextDouble(), rz = random.nextDouble();
      const state = w.getState(x, top - 1, z);
      const shapeTop = this._shapeAt(state, x, top - 1, z, rx, rz)[1];
      const y = top - 1 + Math.max(shapeTop, this._fluidHeight(state, w.getState(x, top, z)));
      if (this._fluid(state) === 'lava' || this._smokes(state)) g.particles.smoke(x + rx, y, z + rz, 0, 0, 0);
      else g.particles.rain(x + rx, y, z + rz);
    }
    if (hit && random.nextInt(3) < this.rainSoundCounter++) {
      this.rainSoundCounter = 0;
      const [sx, sy, sz] = hit;
      if (sy > cy + 1 && this.precipHeight(cx, cz) > cy) g.sound.play(NATIVE.sounds[1], sx + 0.5, sy + 0.5, sz + 0.5, 0.1, 0.5);
      else g.sound.play(NATIVE.sounds[0], sx + 0.5, sy + 0.5, sz + 0.5, 0.2, 1);
    }
  }

  // Up to 1.15: nextInt(10) - nextInt(10) offsets; the sound position is a random sample of the splashes
  _legacyRain(g, w, random, f, cx, cy, cz, particles) {
    let n = Math.trunc(100 * f32(f * f));
    if (particles === 1) n >>= 1; else if (particles === 2) n = 0;
    let count = 0, sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < n; i++) {
      const dx = random.nextInt(10) - random.nextInt(10), dz = random.nextInt(10) - random.nextInt(10);
      const x = cx + dx, z = cz + dz, top = this.precipHeight(x, z), below = top - 1;
      if (top > cy + 10 || top < cy - 10 || !this._rainsAt(x, top, z)) continue;
      const rx = random.nextDouble(), rz = random.nextDouble();
      const state = w.getState(x, below, z);
      let lift, smokeDrop;
      if (NATIVE.tick === 'bounds') {
        // Block bounding box (1.8-1.12): smoke drops by its minY, rain lands on its maxY; nothing lands on air
        const b = blockOf(state);
        const box = jarSelectionBox(state) || [0, 0, 0, 1, 1, 1];
        if (this._smokes(state)) { g.particles.smoke(x + rx, f32(top + 0.1) - box[1], z + rz, 0, 0, 0); continue; }
        if (!b || b.id === 0) continue;
        lift = box[4];
      } else {
        // Collision shape at the splash point unless the fluid above is higher (1.13-1.15)
        const [shapeBottom, shapeTop] = this._shapeAt(state, x, below, z, rx, rz);
        const fluid = this._fluidHeight(w.getState(x, top, z), w.getState(x, top + 1, z));
        if (shapeTop >= fluid) { lift = shapeTop; smokeDrop = shapeBottom; } else { lift = 0; smokeDrop = 0; }
        if (!(lift > -Number.MAX_VALUE)) continue;
        if (this._fluid(w.getState(x, top, z)) === 'lava' || this._smokes(state)) { g.particles.smoke(x + rx, f32(top + 0.1) - smokeDrop, z + rz, 0, 0, 0); continue; }
      }
      if (random.nextInt(++count) === 0) { sx = x + rx; sy = f32(below + 0.1) + lift - 1; sz = z + rz; }
      g.particles.rain(x + rx, f32(below + 0.1) + lift, z + rz);
    }
    if (count > 0 && random.nextInt(3) < this.rainSoundCounter++) {
      this.rainSoundCounter = 0;
      if (sy > cy + 1 && this.precipHeight(cx, cz) > cy) g.sound.play(NATIVE.sounds[1], sx, sy, sz, 0.1, 0.5);
      else g.sound.play(NATIVE.sounds[0], sx, sy, sz, 0.2, 1);
    }
  }

  // [min, max] height of the collision shape over (rx, rz) inside the block, or -Infinity when it has none there
  _shapeAt(state, x, y, z, rx, rz) {
    let lo = Infinity, hi = -Infinity;
    for (const box of staticCollisionBoxes(state, x, y, z)) {
      if (rx >= box[0] && rx <= box[3] && rz >= box[2] && rz <= box[5]) { if (box[1] < lo) lo = box[1]; if (box[4] > hi) hi = box[4]; }
    }
    return [lo === Infinity ? -Infinity : lo, hi];
  }

  // Blocks that turn rain into smoke
  _smokes(state) {
    const b = blockOf(state);
    if (!b) return false;
    if (NATIVE.smoke.includes(b.name)) return true;
    return NATIVE.campfireSmoke && /campfire$/.test(b.name) && this._props(state).lit === 'true';
  }

  _props(state) { return {}; }

  // FluidState.getHeight: 1 under the same fluid, else amount / 9 (sources hold 8)
  _fluidHeight(state, above) {
    const kind = this._fluid(state);
    if (!kind) return 0;
    if (this._fluid(above) === kind) return 1;
    const b = blockOf(state), level = b && (b.name === 'water' || b.name === 'lava') ? Number(this._props(state).level || 0) : 0;
    const amount = level === 0 ? 8 : level >= 8 ? 8 : 8 - level;
    return amount / 9;
  }

  _fluid(state) {
    const b = blockOf(state);
    if (!b || b.id === 0) return null;
    if (b.name === 'lava' || b.name === 'flowing_lava') return 'lava';
    if (b.name === 'water' || b.name === 'flowing_water' || b.name === 'bubble_column' || b.name === 'kelp' || b.name === 'kelp_plant' || b.name === 'seagrass' || b.name === 'tall_seagrass') return 'water';
    return this._props(state).waterlogged === 'true' ? 'water' : null;
  }

  // Random display ticks around the player each tick
  _ambience() {
    const g = this.game;
    const w = g.world;
    const px = Math.floor(g.player.x), py = Math.floor(g.player.y), pz = Math.floor(g.player.z);
    for (let i = 0; i < NATIVE.displayTicks; i++) for (const r of NATIVE.displayRadii) this._displayTick(w, px, py, pz, r);
  }

  _displayTick(w, px, py, pz, r) {
    const g = this.game;
    const x = px + Math.floor(Math.random() * r) - Math.floor(Math.random() * r);
    const y = py + Math.floor(Math.random() * r) - Math.floor(Math.random() * r);
    const z = pz + Math.floor(Math.random() * r) - Math.floor(Math.random() * r);
    const st = w.getState(x, y, z);
    if (st !== 0) g.particles.randomDisplayTick(x, y, z, st);
    if (!NATIVE.biomeParticles || blockOf(st)?.collisionFull) return;
    const ambient = biomeInfo(w.getBiome(x, z, y)).effects?.particle;
    if (ambient && Math.random() <= ambient.probability) g.particles.nativeParticle(ambient.options.type.replace(/^minecraft:/, ''), x + Math.random(), y + Math.random(), z + Math.random());
  }

  // Rain and snow quads around the camera
  render(partial, cx, cy, cz) {
    const g = this.game;
    const w = g.world;
    const rain = w.prevRain !== undefined ? w.prevRain + (w.rainStrength - w.prevRain) * partial : w.rainStrength;
    for (const L of Object.values(this.layers)) L.count = 0;
    if (!(rain > 0)) return;
    const R = this._fancy() ? 10 : 5;
    // Up to 1.14 the view entity's (uninterpolated) position anchors the columns; later the camera does
    let ax = cx, ay = cy, az = cz, lightY = Math.floor(cy);
    if (NATIVE.renderOrigin === 'entity' && g.player) {
      const p = g.player;
      ax = p.x; ay = p.y; az = p.z;
      lightY = Math.floor((p.prevY ?? p.y) + (p.y - (p.prevY ?? p.y)) * partial);
    }
    const bx = Math.floor(ax), by = Math.floor(ay), bz = Math.floor(az);
    const ticks = this.updateCount, t = f32(ticks + partial), sign = NATIVE.scrollSign;
    const rainLayer = this.layers.rain, snowLayer = this.layers.snow;
    for (let z = bz - R; z <= bz + R; z++) {
      for (let x = bx - R; x <= bx + R; x++) {
        const biome = w.getBiome(x, z, NATIVE.biomeY === 'camera' ? by : 0);
        const info = biomeInfo(biome);
        if (info.precipitation === 'none' || info.has_precipitation === false) continue;
        const top = this.precipHeight(x, z);
        let y0 = by - R, y1 = by + R;
        if (y0 < top) y0 = top;
        if (y1 < top) y1 = top;
        const ly = top < lightY ? lightY : top;
        if (y0 === y1) continue;
        const kind = this._precipitation(biome, x, y0, z);
        if (kind === 'none') continue;
        const k = ((z - bz + 16) << 5) | (x - bx + 16);
        const dx = rainX[k] * 0.5, dz = rainZ[k] * 0.5;
        if (dx !== dx) continue; // the anchor's own column: native sizes are 0/0 = NaN, a degenerate quad that never draws
        const col = this._column(x, z);
        const ddx = f32(x + 0.5) - ax, ddz = f32(z + 0.5) - az;
        const dist = f32(Math.sqrt(ddx * ddx + ddz * ddz)) / R;
        let sky = w.getSkyLight(x, ly, z), blk = w.getBlockLight(x, ly, z);
        if (NATIVE.lightEmission) { const emit = blockOf(w.getState(x, ly, z))?.emitLight || 0; if (emit > blk) blk = emit; }
        let L, alpha, u0, vTop, vBottom;
        if (kind === 'rain') {
          L = rainLayer;
          let v;
          if (NATIVE.rainScroll === 'wrapped') v = f32(f32(-(f32((ticks & 0x1ffff) + col.hash) + partial) / 32) * col.rainSpeed) % 32;
          else if (NATIVE.rainScroll === 'float') v = f32(f32(-(f32((ticks + col.hash) & 31) + partial) / 32) * col.rainSpeed);
          else v = sign * (((ticks + col.hash) & 31) + partial) / 32 * col.rainSpeed;
          alpha = ((1 - dist * dist) * 0.5 + 0.5) * rain;
          u0 = 0; vTop = y0 * 0.25 + v; vBottom = y1 * 0.25 + v;
        } else {
          L = snowLayer;
          const v = sign * ((ticks & 0x1ff) + partial) / 512;
          let v2;
          if (NATIVE.rainScroll === 'double') { u0 = col.su + t * 0.01 * f32(col.sug); v2 = col.sv + f32(t * f32(col.svg)) * 0.001; }
          else { u0 = f32(col.su + t * 0.01 * f32(col.sug)); v2 = f32(col.sv + f32(t * f32(col.svg)) * 0.001); }
          alpha = ((1 - dist * dist) * 0.3 + 0.5) * rain;
          vTop = y0 * 0.25 + v + v2; vBottom = y1 * 0.25 + v + v2;
          // snow is lit brighter: (packed * 3 + 240) / 4 on each lightmap coordinate (1.15/1.16 triple the block
          // light first; the lightmap clamps the result)
          sky = ((sky * 48 + 240) >> 2) / 16;
          blk = Math.min(15, (((NATIVE.snowBlockLightTriple ? blk * 3 : blk) * 48 + 240) >> 2) / 16);
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
