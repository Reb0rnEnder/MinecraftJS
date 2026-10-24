// Particle system (port of EffectRenderer + common EntityFX subclasses), batched into one buffer per texture.
import { POTIONS } from '../game/potionhelper.js';
import { blocks } from '../world/blocks.js';
import { resolveState } from '../world/blockstates.js';
import { FORMAT, litParams } from '../gfx/device.js';

const PARTICLE_GRID = 16; // Logical UV grid of this version, independent of resource-pack resolution.
const MAX = 4000;
const rand = Math.random;
const STRIDE = FORMAT.lit.stride;
const PARAMS = litParams(0.1);
const STATE = { blend: 'alpha', depthWrite: false, cull: false };

class Batch {
  constructor(device, tex) {
    this.device = device;
    this.tex = tex; // texture path or function returning a texture
    this.data = new Float32Array(MAX * 4 * STRIDE);
    this.mesh = device.createMesh(FORMAT.lit, new Float32Array(0), { quads: true, dynamic: true });
    this.n = 0;
  }
  begin() { this.n = 0; }
  quad(c, u0, v0, u1, v1, r, g, b, a, sky, blk) {
    if (this.n >= MAX) return;
    const d = this.data;
    let o = this.n++ * 4 * STRIDE;
    for (let k = 0; k < 4; k++) {
      d[o] = c[k * 3]; d[o + 1] = c[k * 3 + 1]; d[o + 2] = c[k * 3 + 2];
      d[o + 3] = k < 2 ? u1 : u0; d[o + 4] = k === 0 || k === 3 ? v1 : v0;
      d[o + 5] = r; d[o + 6] = g; d[o + 7] = b; d[o + 8] = a;
      d[o + 9] = sky; d[o + 10] = blk;
      o += STRIDE;
    }
  }
  end() { if (this.n) this.device.updateMesh(this.mesh, this.data.subarray(0, this.n * 4 * STRIDE), { quads: true }); }
  draw(d, resolve) {
    if (!this.n) return;
    const tex = resolve(this.tex);
    if (tex) d.draw({ mesh: this.mesh, pipeline: 'lit', textures: [tex], params: PARAMS, state: STATE, count: this.n * 6 });
  }
}

export class Particles {
  constructor(game) {
    this.game = game;
    this.list = [];
    const r = game.renderer;
    const dev = game.device;
    this.batchP = new Batch(dev, 'particle/particles.png');
    this.batchA = new Batch(dev, () => game.assets.atlasTexture);
    this.batchE = new Batch(dev, 'entity/explosion.png');
    const resolve = (t) => (typeof t === 'function' ? t() : game.assets.texture(t));
    const draw = (d) => { for (const b of [this.batchP, this.batchA, this.batchE]) b.draw(d, resolve); };
    draw.order = 11;
    r.extraDraws.push(draw);
  }

  count() { return this.list.length; }
  clear() { this.list.length = 0; this.barrierIndex?.clear(); }

  setting() { return this.game.settings.particles || 0; }

  add(p) {
    if (this.list.length >= MAX) return;
    const s = this.setting();
    if (s === 2 && !p.important) return;
    if (s === 1 && !p.important && rand() * 3 < 1) return; // RenderGlobal.spawnEntityFX: 1 in 3 dropped
    p.age = 0;
    p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
    p.mx = p.mx || 0; p.my = p.my || 0; p.mz = p.mz || 0;
    p.r = p.r ?? 1; p.g = p.g ?? 1; p.b = p.b ?? 1; p.a = p.a ?? 1;
    p.scale = p.scale ?? (rand() * 0.5 + 0.5) * 2;
    p.maxAge = p.maxAge ?? Math.floor(4 / (rand() * 0.9 + 0.1));
    p.gravity = p.gravity ?? 0;
    p.collide = p.collide !== false;
    this.list.push(p);
    return p;
  }

  // Base EntityFX constructor with randomised motion
  fx(x, y, z, mx = 0, my = 0, mz = 0, extra = {}) {
    const p = { x, y, z, ...extra };
    p.mx = mx + (rand() * 2 - 1) * 0.4;
    p.my = my + (rand() * 2 - 1) * 0.4;
    p.mz = mz + (rand() * 2 - 1) * 0.4;
    const f = (rand() + rand() + 1) * 0.15;
    const f1 = Math.sqrt(p.mx * p.mx + p.my * p.my + p.mz * p.mz) || 1;
    p.mx = p.mx / f1 * f * 0.4; p.my = p.my / f1 * f * 0.4 + 0.1; p.mz = p.mz / f1 * f * 0.4;
    return p;
  }

  tick() {
    const w = this.game.world;
    if (this.emitters && this.emitters.length) {
      for (const em of this.emitters) this._emit(em);
      this.emitters = this.emitters.filter((em) => em.age < 3);
    }
    let alive = 0;
    for (const p of this.list) {
      if (p.barrier && !this._barrierVisible(p)) { this.barrierIndex?.delete(p.barrierKey); continue; }
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.maxAge) { if (p.barrier) this.barrierIndex?.delete(p.barrierKey); continue; }
      if (p.update) { if (p.update(p) === false) continue; }
      else {
        p.my -= 0.04 * p.gravity;
        this.move(p, w);
        p.mx *= p.drag ?? 0.98; p.my *= p.drag ?? 0.98; p.mz *= p.drag ?? 0.98;
        if (p.onGround) { p.mx *= 0.7; p.mz *= 0.7; }
      }
      this.list[alive++] = p;
    }
    this.list.length = alive;
  }

  move(p, w) {
    let nx = p.x + p.mx, ny = p.y + p.my, nz = p.z + p.mz;
    p.onGround = false;
    if (p.collide) {
      const solid = (x, y, z) => { const b = blocks[w.getState(Math.floor(x), Math.floor(y), Math.floor(z)) >> 4]; return b && b.boundingBox === 'block' && b.id !== 0 && !b.isLiquid; };
      if (solid(p.x, ny, p.z)) { if (p.my < 0) { p.onGround = true; ny = Math.floor(ny) + 1.001; } else ny = p.y; p.my = 0; }
      if (solid(nx, ny, p.z)) { nx = p.x; p.mx = 0; }
      if (solid(nx, ny, nz)) { nz = p.z; p.mz = 0; }
    }
    p.x = nx; p.y = ny; p.z = nz;
  }

  render(partial, cx, cy, cz) {
    const cr = this.game.renderer.camRot;
    const right = { x: cr[0], y: cr[1], z: cr[2] };
    const up = { x: cr[4], y: cr[5], z: cr[6] };
    const w = this.game.world;
    for (const b of [this.batchP, this.batchA, this.batchE]) b.begin();
    for (const p of this.list) {
      if (p.invisible || p.barrier && !this._barrierVisible(p)) continue;
      const x = p.prevX + (p.x - p.prevX) * partial;
      const y = p.prevY + (p.y - p.prevY) * partial;
      const z = p.prevZ + (p.z - p.prevZ) * partial;
      let size = 0.1 * p.scale;
      if (p.sizeFn) size = p.sizeFn(p, partial) * 0.1;
      let sky, blk;
      if (p.fullBright) { sky = -1; blk = 15; } else { const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z); sky = w.getSkyLight(bx, by, bz); blk = w.getBlockLight(bx, by, bz); }
      let u0, v0, u1, v1, batch;
      if (p.atlas) {
        batch = this.batchA;
        [u0, v0, u1, v1] = p.atlas;
      } else if (p.explosionFrame !== undefined) {
        batch = this.batchE;
        const f = Math.min(15, Math.floor((p.age + partial) * 15 / p.maxAge));
        u0 = (f % 4) / 4; v0 = Math.floor(f / 4) / 4; u1 = u0 + 0.25; v1 = v0 + 0.25;
        size = 2 * (1 - p.age / p.maxAge * 0.5) * p.scale * 0.5;
        sky = -1;
      } else {
        batch = this.batchP;
        if (p.uv) [u0, v0, u1, v1] = p.uv;
        else {
          const idx = p.texFn ? p.texFn(p) : p.tex || 0;
          u0 = (idx % 16) / PARTICLE_GRID; v0 = Math.floor(idx / 16) / PARTICLE_GRID; u1 = u0 + 0.999 / PARTICLE_GRID; v1 = v0 + 0.999 / PARTICLE_GRID;
        }
      }
      if (p.footprint) {
        // flat on the ground (handled with particles texture fallback)
        const s = 0.125;
        batch.quad([x - s, y, z + s, x - s, y, z - s, x + s, y, z - s, x + s, y, z + s], u0, v0, u1, v1, p.r, p.g, p.b, p.a * (1 - p.age / p.maxAge), sky, blk);
        continue;
      }
      const rx = right.x * size, ry = right.y * size, rz = right.z * size;
      const ux = up.x * size, uy = up.y * size, uz = up.z * size;
      batch.quad([
        x - rx - ux, y - ry - uy, z - rz - uz,
        x - rx + ux, y - ry + uy, z - rz + uz,
        x + rx + ux, y + ry + uy, z + rz + uz,
        x + rx - ux, y + ry - uy, z + rz - uz,
      ], u0, v0, u1, v1, p.r, p.g, p.b, p.alphaFn ? p.alphaFn(p, partial) : p.a, sky, blk);
    }
    for (const b of [this.batchP, this.batchA, this.batchE]) b.end();
    void cx; void cy; void cz;
  }

  // ---------------------------------------------------------------- particle factories

  _blockSprite(state) {
    const rs = resolveState(state, (a, b, c) => this.game.world.getState(a, b, c), 0, 0, 0);
    let tex = null;
    if (rs) {
      const bm = this.game.assets.modelStore.bakeVariant(rs.file, rs.props, rs.variant, 0);
      tex = bm && bm.particle;
    }
    const b = blocks[state >> 4];
    if (!tex && b) { if (b.isWater) tex = 'blocks/water_still'; else if (b.isLava) tex = 'blocks/lava_still'; }
    const uv = tex ? this.game.assets.atlas.uv(tex) : null;
    return uv;
  }

  // EntityDiggingFX
  digging(x, y, z, mx, my, mz, state, tint) {
    const uv = this._blockSprite(state);
    if (!uv) return;
    const du = (uv[2] - uv[0]) / 4, dv = (uv[3] - uv[1]) / 4;
    const ju = rand() * 3, jv = rand() * 3;
    const u0 = uv[0] + ju * du, v0 = uv[1] + jv * dv;
    const p = this.fx(x, y, z, mx, my, mz, { atlas: [u0, v0, u0 + du, v0 + dv], gravity: 1, scale: (rand() * 0.5 + 0.5), r: 0.6, g: 0.6, b: 0.6 });
    const b = blocks[state >> 4];
    if (b && b.name === 'grass') { p.r = 0.6 * 0.5; p.g = 0.6 * 0.7; p.b = 0.6 * 0.2; }
    if (tint) { p.r *= ((tint >> 16) & 255) / 255; p.g *= ((tint >> 8) & 255) / 255; p.b *= (tint & 255) / 255; }
    p.scale /= 2;
    return this.add(p);
  }

  blockBreak(x, y, z, state) {
    const b = blocks[state >> 4];
    if (!b || b.id === 0) return;
    const n = 4;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const px = x + (i + 0.5) / n, py = y + (j + 0.5) / n, pz = z + (k + 0.5) / n;
      this.digging(px, py, pz, px - x - 0.5, py - y - 0.5, pz - z - 0.5, state);
    }
  }

  blockHit(x, y, z, face) {
    const st = this.game.world.getState(x, y, z);
    const b = blocks[st >> 4];
    if (!b || b.id === 0) return;
    const f = 0.1;
    let px = x + rand() * (1 - f * 2) + f, py = y + rand() * (1 - f * 2) + f, pz = z + rand() * (1 - f * 2) + f;
    if (face === 0) py = y - f; if (face === 1) py = y + 1 + f;
    if (face === 2) pz = z - f; if (face === 3) pz = z + 1 + f;
    if (face === 4) px = x - f; if (face === 5) px = x + 1 + f;
    const p = this.digging(px, py, pz, 0, 0, 0, st);
    if (p) { p.mx *= 0.2; p.my = (p.my - 0.1) * 0.2 + 0.1; p.mz *= 0.2; p.scale *= 0.6; }
  }

  itemCrack(item, player, count = 1) {
    const g = this.game;
    const m = g.itemRenderer.modelFor(item);
    const tex = m.kind === 'generated' ? m.layers[0] : m.baked && m.baked.particle;
    const uv = tex ? g.assets.atlas.uv(tex) : null;
    if (!uv) return;
    const eye = g.eyePosition();
    const look = g.lookVector();
    for (let i = 0; i < count; i++) {
      const du = (uv[2] - uv[0]) / 4, dv = (uv[3] - uv[1]) / 4;
      const u0 = uv[0] + Math.floor(rand() * 3) * du, v0 = uv[1] + Math.floor(rand() * 3) * dv;
      const px = eye[0] + look[0] * 0.6 + (rand() - 0.5) * 0.3, py = eye[1] - 0.3 + rand() * 0.2, pz = eye[2] + look[2] * 0.6 + (rand() - 0.5) * 0.3;
      this.add({ x: px, y: py, z: pz, mx: (rand() - 0.5) * 0.1, my: rand() * 0.1 + 0.05, mz: (rand() - 0.5) * 0.1, atlas: [u0, v0, u0 + du, v0 + dv], gravity: 1, scale: 0.5, maxAge: 20 });
    }
    void player;
  }

  _itemAtlas(id) {
    const g = this.game;
    const m = g.itemRenderer.modelFor({ id, damage: 0, count: 1 });
    const tex = m.kind === 'generated' ? m.layers[0] : null;
    return tex ? g.assets.atlas.uv(tex) : null;
  }

  // EntityParticleEmitter (CRIT / CRIT_MAGIC): 16 tries per tick for 3 ticks around the entity's middle
  crit(e, magic = false) {
    (this.emitters || (this.emitters = [])).push({ e, magic, age: 0 });
    this._emit(this.emitters[this.emitters.length - 1]);
  }
  magicCrit(e) { this.crit(e, true); }

  _emit(em) {
    const e = em.e;
    for (let i = 0; i < 16; i++) {
      const dx = rand() * 2 - 1, dy = rand() * 2 - 1, dz = rand() * 2 - 1;
      if (dx * dx + dy * dy + dz * dz > 1) continue;
      const w = e.width || 0.6, h = e.height || 1.8;
      this.crit1(e.x + dx * w / 4, e.y + h / 2 + dy * h / 4, e.z + dz * w / 4, dx, dy + 0.2, dz, em.magic);
    }
    em.age++;
  }

  // EntityCrit2FX (magic: tinted, next sprite): grows in over its first frames, green/blue fade
  crit1(x, y, z, mx, my, mz, magic) {
    const p = this.fx(x, y, z, 0, 0, 0, { tex: magic ? 66 : 65 });
    p.mx = p.mx * 0.1 + mx * 0.4; p.my = p.my * 0.1 + my * 0.4; p.mz = p.mz * 0.1 + mz * 0.4;
    const c = rand() * 0.30000001192092896 + 0.6000000238418579;
    p.r = p.g = p.b = c;
    if (magic) { p.r *= 0.3; p.g *= 0.8; }
    p.baseScale = (rand() * 0.5 + 0.5) * 2 * 0.75;
    p.scale = p.baseScale;
    p.maxAge = Math.floor(6 / (rand() * 0.8 + 0.6));
    p.sizeFn = (q, pt) => q.baseScale * Math.min(1, Math.max(0, (q.age + pt) / q.maxAge * 32));
    p.update = (q) => {
      this.move(q, this.game.world);
      q.g *= 0.96; q.b *= 0.9;
      q.mx *= 0.7; q.my *= 0.7; q.mz *= 0.7;
      q.my -= 0.02;
      if (q.onGround) { q.mx *= 0.7; q.mz *= 0.7; }
    };
    const added = this.add(p);
    if (added) { added.age = 1; added.prevX = added.x; added.prevY = added.y; added.prevZ = added.z; p.update(p); } // the constructor runs onUpdate once
    return added;
  }

  smoke(x, y, z, mx, my, mz, scaleMul = 1) {
    const p = { x, y, z, mx: mx + (rand() * 2 - 1) * 0.1 * 0 , my: my, mz: mz };
    p.mx = p.mx * 0.1 + mx; p.my = p.my * 0.1 + my; p.mz = p.mz * 0.1 + mz;
    const c = rand() * 0.3;
    p.r = p.g = p.b = c;
    p.scale = (rand() * 0.5 + 0.5) * 2 * 0.75 * scaleMul;
    p.maxAge = Math.floor(8 / (rand() * 0.8 + 0.2) * scaleMul);
    p.texFn = (q) => 7 - Math.floor(q.age * 8 / q.maxAge);
    p.update = (q) => {
      q.my += 0.004;
      this.move(q, this.game.world);
      if (q.y === q.prevY) { q.mx *= 1.1; q.mz *= 1.1; }
      q.mx *= 0.96; q.my *= 0.96; q.mz *= 0.96;
      if (q.onGround) { q.mx *= 0.7; q.mz *= 0.7; }
    };
    return this.add(p);
  }

  flame(x, y, z, mx = 0, my = 0, mz = 0) {
    const p = { x, y, z, mx: mx * 0.01 + mx * 0, my: my, mz: mz, tex: 48, fullBright: true };
    p.mx = mx * 0.01 + (rand() * 2 - 1) * 0.0; p.my = my * 0.01; p.mz = mz * 0.01;
    p.baseScale = (rand() * 0.5 + 0.5) * 2;
    p.maxAge = Math.floor(8 / (rand() * 0.8 + 0.2)) + 4;
    p.sizeFn = (q, pt) => { const f = (q.age + pt) / q.maxAge; return q.baseScale * (1 - f * f * 0.5); };
    p.update = (q) => { this.move(q, this.game.world); q.mx *= 0.96; q.my *= 0.96; q.mz *= 0.96; };
    p.collide = false;
    return this.add(p);
  }

  lava(x, y, z) {
    const p = { x, y, z, mx: rand() * 0.8 - 0.4, my: rand() * 0.4 + 0.05, mz: rand() * 0.8 - 0.4, tex: 49, fullBright: true };
    p.mx *= 0.8; p.mz *= 0.8;
    p.baseScale = (rand() * 2 + 0.2) * 1;
    p.maxAge = Math.floor(16 / (rand() * 0.8 + 0.2));
    p.sizeFn = (q, pt) => { const f = (q.age + pt) / q.maxAge; return q.baseScale * (1 - f * f); };
    p.update = (q) => {
      if (rand() > q.age / q.maxAge) this.smoke(q.x, q.y, q.z, q.mx, q.my, q.mz);
      q.my -= 0.03; this.move(q, this.game.world);
      q.mx *= 0.999; q.my *= 0.999; q.mz *= 0.999;
      if (q.onGround) { q.mx *= 0.7; q.mz *= 0.7; }
    };
    return this.add(p);
  }

  // ParticleRain and ParticleSplash: per-tick gravity is 0.06 / 0.04,
  // not 0.04 multiplied by those values. Both die promptly on landing.
  rain(x, y, z) { return this._waterDrop(x, y, z, 0, 0, 0, false); }

  splash(x, y, z, mx = 0, my = 0, mz = 0) {
    return this._waterDrop(x, y, z, mx, my, mz, true);
  }

  _waterDrop(x, y, z, mx, my, mz, splash) {
    const p = this.fx(x, y, z, 0, 0, 0, { tex: splash ? 20 + Math.floor(rand() * 3) : 19 + Math.floor(rand() * 4), r: 1, g: 1, b: 1 });
    p.mx *= 0.3; p.my = rand() * 0.2 + 0.1; p.mz *= 0.3;
    if (splash && my === 0 && (mx !== 0 || mz !== 0)) { p.mx = mx; p.my = 0.1; p.mz = mz; }
    p.maxAge = Math.floor(8 / (rand() * 0.8 + 0.2));
    p.update = q => {
      q.my -= splash ? 0.04 : 0.06;
      this.move(q, this.game.world);
      q.mx *= 0.98; q.my *= 0.98; q.mz *= 0.98;
      if (q.onGround) {
        if (rand() < 0.5) return false;
        q.mx *= 0.7; q.mz *= 0.7;
      }
      if (this._dropInFluid(q)) return false;
    };
    return this.add(p);
  }

  _dropInFluid(p) {
    const state = this.game.world.getState(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
    const level = (state & 15) >= 8 ? 0 : state & 15;
    return !!blocks[state >> 4]?.isLiquid && p.y < Math.floor(p.y) + 1 - (level + 1) / 9;
  }

  bubble(x, y, z, mx, my, mz) {
    const p = { x, y, z, tex: 32, scale: (rand() * 0.6 + 0.2) * 1 };
    p.mx = mx * 0.2 + (rand() * 2 - 1) * 0.02; p.my = my * 0.2 + (rand() * 2 - 1) * 0.02; p.mz = mz * 0.2 + (rand() * 2 - 1) * 0.02;
    p.maxAge = Math.floor(8 / (rand() * 0.8 + 0.2));
    p.update = (q) => {
      q.my += 0.002; this.move(q, this.game.world);
      q.mx *= 0.85; q.my *= 0.85; q.mz *= 0.85;
      const b = blocks[this.game.world.getState(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z)) >> 4];
      if (!b || !b.isWater) return false;
    };
    return this.add(p);
  }

  spell(x, y, z, mx, my, mz, r = 1, g = 1, b = 1, instant = false, witch = false) {
    const p = { x, y, z, mx: mx, my: my, mz: mz };
    p.my *= 0.2;
    if (mx === 0 && mz === 0) { p.mx *= 0.1; p.mz *= 0.1; }
    p.scale = (rand() * 0.5 + 0.5) * 2 * 0.75;
    p.maxAge = Math.floor(8 / (rand() * 0.8 + 0.2));
    p.r = r; p.g = g; p.b = b;
    const base = instant ? 144 : 128;
    p.texFn = (q) => base + (7 - Math.floor(q.age * 8 / q.maxAge));
    p.update = (q) => {
      q.my += 0.004;
      this.move(q, this.game.world);
      if (q.y === q.prevY) { q.mx *= 1.1; q.mz *= 1.1; }
      q.mx *= 0.96; q.my *= 0.96; q.mz *= 0.96;
      if (q.onGround) { q.mx *= 0.7; q.mz *= 0.7; }
    };
    if (witch) { const f = rand() * 0.5 + 0.35; p.r = 1 * f; p.g = 0; p.b = 1 * f; }
    return this.add(p);
  }

  potionSwirl(e, color, ambient) {
    const r = ((color >> 16) & 255) / 255, g = ((color >> 8) & 255) / 255, b = (color & 255) / 255;
    this.spell(e.x + (rand() - 0.5) * e.width, e.y + rand() * e.height, e.z + (rand() - 0.5) * e.width, 0, 0, 0, r, g, b);
  }

  simpleRising(x, y, z, tex, opts = {}) {
    const p = { x, y, z, tex, mx: opts.mx || 0, my: opts.my ?? 0.1, mz: opts.mz || 0, maxAge: opts.maxAge || 16, scale: opts.scale || 1.5, r: opts.r ?? 1, g: opts.g ?? 1, b: opts.b ?? 1, collide: false };
    p.update = (q) => { this.move(q, this.game.world); if (q.y === q.prevY) { q.mx *= 1.1; q.mz *= 1.1; } q.mx *= 0.86; q.my *= 0.86; q.mz *= 0.86; };
    return this.add(p);
  }

  note(x, y, z, pitch) {
    const f = pitch / 24;
    const r = Math.sin((f + 0) * Math.PI * 2) * 0.65 + 0.35;
    const g = Math.sin((f + 1 / 3) * Math.PI * 2) * 0.65 + 0.35;
    const b = Math.sin((f + 2 / 3) * Math.PI * 2) * 0.65 + 0.35;
    this.simpleRising(x + 0.5, y + 1.2, z + 0.5, 64, { r, g, b, my: 0.2, maxAge: 6, scale: 1.5 });
  }

  entityEffect(e, kind) {
    for (let i = 0; i < 7; i++) {
      const x = e.x + (rand() * 2 - 1) * e.width, y = e.y + 0.5 + rand() * e.height, z = e.z + (rand() * 2 - 1) * e.width;
      if (kind === 'heart') this.simpleRising(x, y, z, 80, { my: 0.1 });
      else if (kind === 'angryVillager') this.simpleRising(x, y, z, 81, { my: 0.1 });
      else if (kind === 'happyVillager') this.simpleRising(x, y, z, 82, { my: 0.05 });
      else if (kind === 'smoke') this.smoke(x, y, z, 0, 0, 0);
      else if (kind === 'witchMagic') this.spell(x, y, z, 0, 0, 0, 1, 1, 1, false, true);
    }
  }

  entityFire(e) {
    if (rand() < 0.5) this.smoke(e.x + (rand() - 0.5) * e.width, e.y + rand() * e.height, e.z + (rand() - 0.5) * e.width, 0, 0.02, 0);
  }

  portal(x, y, z, mx, my, mz) {
    const p = { x, y, z, mx, my, mz, tex: Math.floor(rand() * 8), collide: false };
    p.sx = x; p.sy = y; p.sz = z;
    const f = rand() * 0.6 + 0.4;
    p.r = p.g = p.b = f; p.g *= 0.3; p.r *= 0.9;
    p.baseScale = rand() * 0.2 + 0.5;
    p.maxAge = Math.floor(rand() * 10) + 40;
    p.update = (q) => {
      let f2 = q.age / q.maxAge; const f3 = f2; f2 = -f2 + f2 * f2 * 2; f2 = 1 - f2;
      q.x = q.sx + q.mx * f2; q.y = q.sy + q.my * f2 + (1 - f3); q.z = q.sz + q.mz * f2;
    };
    p.sizeFn = (q, pt) => { let f = (q.age + pt) / q.maxAge; f = 1 - f; f *= f; f = 1 - f; return q.baseScale * f * 2; };
    return this.add(p);
  }

  enchant(x, y, z, mx, my, mz) {
    const p = { x, y, z, mx, my, mz, tex: 225 + Math.floor(rand() * 26), collide: false };
    p.sx = x; p.sy = y; p.sz = z;
    const f = rand() * 0.6 + 0.4;
    p.r = p.g = p.b = f; p.r *= 0.9; p.g *= 0.9;
    p.baseScale = rand() * 0.5 + 0.2;
    p.maxAge = Math.floor(rand() * 10) + 30;
    p.update = (q) => {
      let f2 = q.age / q.maxAge; f2 = 1 - f2; let f3 = 1 - f2; f3 *= f3; f3 *= f3;
      q.x = q.sx + q.mx * f2; q.y = q.sy + q.my * f2 - f3 * 1.2; q.z = q.sz + q.mz * f2;
    };
    return this.add(p);
  }

  reddust(x, y, z, r, g, b) {
    if (r === 0) r = 1;
    const f = rand() * 0.4 + 0.6;
    const p = { x, y, z, mx: (rand() * 2 - 1) * 0.1 * 0.1, my: (rand() * 2 - 1) * 0.1 * 0.1, mz: (rand() * 2 - 1) * 0.1 * 0.1 };
    p.r = (rand() * 0.2 + 0.8) * r * f; p.g = (rand() * 0.2 + 0.8) * g * f; p.b = (rand() * 0.2 + 0.8) * b * f;
    p.scale = (rand() * 0.5 + 0.5) * 2 * 0.75;
    p.maxAge = Math.floor(8 / (rand() * 0.8 + 0.2));
    p.texFn = (q) => 7 - Math.floor(q.age * 8 / q.maxAge);
    p.update = (q) => { this.move(q, this.game.world); if (q.y === q.prevY) { q.mx *= 1.1; q.mz *= 1.1; } q.mx *= 0.96; q.my *= 0.96; q.mz *= 0.96; };
    return this.add(p);
  }

  drip(x, y, z, lava) {
    const p = { x, y, z, mx: 0, my: 0, mz: 0, tex: 113, scale: 1, maxAge: Math.floor(64 / (rand() * 0.8 + 0.2)) };
    p.r = lava ? 1 : 0; p.g = lava ? 0.2 : 0; p.b = lava ? 0 : 1;
    p.delay = 40;
    p.update = (q) => {
      if (q.delay-- > 0) { q.mx *= 0.02; q.my *= 0.02; q.mz *= 0.02; q.tex = 113; }
      else { q.tex = 112; q.my -= 0.06 * 0.5; }
      this.move(q, this.game.world);
      q.mx *= 0.98; q.my *= 0.98; q.mz *= 0.98;
      if (q.onGround) { if (!lava) this.splash(q.x, q.y, q.z, 0, 0, 0); return false; }
    };
    return this.add(p);
  }

  explosion(x, y, z, radius) {
    this.add({ x, y, z, explosionFrame: 0, maxAge: 6 + Math.floor(rand() * 4), scale: 2 + radius * 0.5, collide: false, important: true, update: () => {} });
    for (let i = 0; i < 16; i++) this.smoke(x + (rand() - 0.5) * radius, y + (rand() - 0.5) * radius, z + (rand() - 0.5) * radius, (rand() - 0.5) * 0.2, rand() * 0.1, (rand() - 0.5) * 0.2, 2.5);
  }

  // EntityExplodeFX (EXPLOSION_NORMAL): the grey puff of mob deaths and the "explode" particle
  poof(x, y, z, mx = 0, my = 0, mz = 0) {
    const c = rand() * 0.3 + 0.7;
    const p = { x, y, z, mx: mx + (Math.random() * 2 - 1) * 0.05, my: my + (Math.random() * 2 - 1) * 0.05, mz: mz + (Math.random() * 2 - 1) * 0.05,
      r: c, g: c, b: c, scale: rand() * rand() * 6 + 1, maxAge: Math.trunc(16 / (rand() * 0.8 + 0.2)) + 2 };
    p.texFn = (q) => Math.max(0, 7 - Math.trunc(q.age * 8 / q.maxAge));
    p.update = (q) => {
      q.my += 0.004;
      this.move(q, this.game.world);
      q.mx *= 0.9; q.my *= 0.9; q.mz *= 0.9;
      if (q.onGround) { q.mx *= 0.7; q.mz *= 0.7; }
    };
    return this.add(p);
  }

  // EntityLivingBase.onDeathUpdate at deathTime 20: twenty puffs over the body
  deathPoof(e) {
    const w = e.width || 0.6, h = e.height || 1.8;
    for (let i = 0; i < 20; i++) {
      this.poof(e.x + rand() * w * 2 - w, e.y + rand() * h, e.z + rand() * w * 2 - w, gauss() * 0.02, gauss() * 0.02, gauss() * 0.02);
    }
  }

  // EntityFirework.SparkFX (textures 160 - 167, full bright, y accel -0.004, friction 0.91).
  // opts: { color, fade, trail, twinkle, a }
  spark(x, y, z, mx, my, mz, opts = {}) {
    const p = { x, y, z, mx, my, mz, fullBright: true, important: !!opts.important, a: opts.a ?? 1 };
    p.scale = (rand() * 0.5 + 0.5) * 2 * 0.75;
    p.maxAge = 48 + Math.floor(rand() * 12);
    if (opts.color !== undefined) { p.r = ((opts.color >> 16) & 255) / 255; p.g = ((opts.color >> 8) & 255) / 255; p.b = (opts.color & 255) / 255; }
    if (opts.fade !== undefined) p.fade = [((opts.fade >> 16) & 255) / 255, ((opts.fade >> 8) & 255) / 255, (opts.fade & 255) / 255];
    p.trail = !!opts.trail; p.twinkle = !!opts.twinkle;
    p.texFn = (q) => 160 + (8 - 1 - Math.trunc(q.age * 8 / q.maxAge));
    // twinkling sparks blink out in the last two thirds
    p.alphaFn = (q) => (q.twinkle && q.age >= Math.trunc(q.maxAge / 3) && Math.trunc((q.age + q.maxAge) / 3) % 2 !== 0 ? 0 : q.a);
    p.update = (q) => {
      const half = Math.trunc(q.maxAge / 2);
      if (q.age > half) {
        q.a = 1 - (q.age - half) / q.maxAge;
        if (q.fade) { q.r += (q.fade[0] - q.r) * 0.2; q.g += (q.fade[1] - q.g) * 0.2; q.b += (q.fade[2] - q.b) * 0.2; }
      }
      q.my += -0.004;
      this.move(q, this.game.world);
      q.mx *= 0.91; q.my *= 0.91; q.mz *= 0.91;
      if (q.onGround) { q.mx *= 0.7; q.mz *= 0.7; }
      if (q.trail && q.age < half && (q.age + q.maxAge) % 2 === 0) {
        const c = this.spark(q.x, q.y, q.z, 0, 0, 0, { a: 0.99, twinkle: q.twinkle });
        if (c) { c.r = q.r; c.g = q.g; c.b = q.b; c.fade = q.fade; c.age = Math.trunc(c.maxAge / 2); }
      }
    };
    return this.add(p);
  }

  // EntityFirework.StarterFX (EntityFireworkRocket status 17): one explosion every 2 ticks from tag Fireworks.Explosions,
  // with the blast sound, then the twinkle sound for flickering ones
  fireworks(x, y, z, mx, my, mz, fw) {
    const list = fw && Array.isArray(fw.Explosions) && fw.Explosions.length ? fw.Explosions : null;
    let maxAge = 8, twinkle = false;
    if (list) {
      maxAge = list.length * 2 - 1;
      if (list.some((ex) => ex.Flicker)) { twinkle = true; maxAge += 15; }
    }
    const g = this.game, snd = g.sound;
    const far = () => { const pl = g.player; return (pl.x - x) ** 2 + (pl.y - y) ** 2 + (pl.z - z) ** 2 >= 256; };
    let age = 0;
    const create = (vx, vy, vz, colors, fades, trail, flick) => {
      const c = colors[Math.floor(rand() * colors.length)];
      const f = fades && fades.length ? fades[Math.floor(rand() * fades.length)] : undefined;
      this.spark(x, y, z, vx, vy, vz, { a: 0.99, trail, twinkle: flick, color: c, fade: f, important: true });
    };
    const ball = (speed, n, colors, fades, trail, flick) => {
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
        const dx = k + (Math.random() - Math.random()) * 0.5, dy = i + (Math.random() - Math.random()) * 0.5, dz = j + (Math.random() - Math.random()) * 0.5;
        const d = Math.fround(Math.sqrt(dx * dx + dy * dy + dz * dz)) / speed + gauss() * 0.05;
        create(dx / d, dy / d, dz / d, colors, fades, trail, flick);
        if (i !== -n && i !== n && j !== -n && j !== n) k += n * 2 - 1; // only the shell
      }
    };
    const shaped = (speed, pts, colors, fades, trail, flick, creeper) => {
      let [px, py] = pts[0];
      create(px * speed, py * speed, 0, colors, fades, trail, flick);
      const f = Math.fround(rand() * Math.PI), step = creeper ? 0.034 : 0.34;
      for (let i = 0; i < 3; i++) {
        const a = f + Math.fround(i * Math.fround(Math.PI)) * step;
        let ax = px, ay = py;
        for (let j = 1; j < pts.length; j++) {
          const [bx, by] = pts[j];
          for (let t = 0.25; t <= 1; t += 0.25) {
            let ox = (ax + (bx - ax) * t) * speed;
            const oy = (ay + (by - ay) * t) * speed;
            const oz = ox * Math.sin(a);
            ox *= Math.cos(a);
            for (let s = -1; s <= 1; s += 2) create(ox * s, oy, oz * s, colors, fades, trail, flick);
          }
          ax = bx; ay = by;
        }
      }
    };
    const burst = (colors, fades, trail, flick) => {
      const ox = gauss() * 0.05, oz = gauss() * 0.05;
      for (let i = 0; i < 70; i++) create(mx * 0.5 + gauss() * 0.15 + ox, my * 0.5 + rand() * 0.5, mz * 0.5 + gauss() * 0.15 + oz, colors, fades, trail, flick);
    };
    this.add({ x, y, z, invisible: true, important: true, collide: false, maxAge: 1e9, update: () => {
      if (age === 0 && list) {
        const large = list.length >= 3 || list.some((ex) => ex.Type === 1);
        snd.play('fireworks.' + (large ? 'largeBlast' : 'blast') + (far() ? '_far' : ''), x, y, z, 20, 0.95 + rand() * 0.1);
      }
      if (age % 2 === 0 && list && age / 2 < list.length) {
        const ex = list[age / 2];
        const colors = ex.Colors && ex.Colors.length ? Array.from(ex.Colors) : [1973019]; // ItemDye.DYE_COLORS[0]
        const fades = ex.FadeColors ? Array.from(ex.FadeColors) : null;
        const trail = !!ex.Trail, flick = !!ex.Flicker;
        switch (ex.Type) {
          case 1: ball(0.5, 4, colors, fades, trail, flick); break;
          case 2: shaped(0.5, [[0, 1], [0.3455, 0.309], [0.9511, 0.309], [0.3795918367346939, -0.12653061224489795], [0.6122448979591837, -0.8040816326530612], [0, -0.35918367346938773]], colors, fades, trail, flick, false); break;
          case 3: shaped(0.5, [[0, 0.2], [0.2, 0.2], [0.2, 0.6], [0.6, 0.6], [0.6, 0.2], [0.2, 0.2], [0.2, 0], [0.4, 0], [0.4, -0.6], [0.2, -0.6], [0.2, -0.4], [0, -0.4]], colors, fades, trail, flick, true); break;
          case 4: burst(colors, fades, trail, flick); break;
          default: ball(0.25, 2, colors, fades, trail, flick);
        }
        // EntityFirework.OverlayFX: a 4-tick flash in the first colour
        const c = colors[0];
        this.add({ x, y, z, collide: false, important: true, maxAge: 4, uv: [0.25, 0.125, 0.5, 0.375], update: () => {},
          r: ((c >> 16) & 255) / 255, g: ((c >> 8) & 255) / 255, b: (c & 255) / 255,
          sizeFn: (q, pt) => 7.1 * Math.sin((q.age + pt - 1) * 0.25 * Math.PI) * 10,
          alphaFn: (q, pt) => 0.6 - (q.age + pt - 1) * 0.25 * 0.5 });
      }
      age++;
      if (age > maxAge) {
        if (twinkle) snd.play('fireworks.twinkle' + (far() ? '_far' : ''), x, y, z, 20, 0.9 + rand() * 0.15);
        return false;
      }
    } });
  }

  // EntityFireworkRocket (status 17): the explosion from the rocket's item
  fireworkExplode(e) {
    const tag = e.item ? this.game.items.nbt(e.item) : null;
    this.fireworks(e.x, e.y, e.z, e.motionX || 0, e.motionY || 0, e.motionZ || 0, tag && tag.Fireworks);
  }

  largeExplode(x, y, z, scale = 1) {
    this.add({ x, y, z, explosionFrame: 0, maxAge: 6 + Math.floor(rand() * 4), scale: (rand() * 0.6 + 0.4) * 2 * scale, collide: false, update: () => {} });
  }

  footstep(x, y, z) {
    this.add({ x, y: y + 0.01, z, tex: 0, footprint: true, maxAge: 200, r: 0.1, g: 0.1, b: 0.1, update: () => {} });
  }

  // S2A packet
  onPacket(p) {
    const n = p.particles;
    const emit = (fn) => {
      if (n === 0) {
        fn(p.x, p.y, p.z, p.offsetX * p.particleData, p.offsetY * p.particleData, p.offsetZ * p.particleData, true);
      } else {
        for (let i = 0; i < n; i++) {
          const gx = gauss() * p.offsetX, gy = gauss() * p.offsetY, gz = gauss() * p.offsetZ;
          fn(p.x + gx, p.y + gy, p.z + gz, gauss() * p.particleData, gauss() * p.particleData, gauss() * p.particleData, false);
        }
      }
    };
    const id = p.particleId;
    switch (id) {
      case 0: emit((x, y, z, mx, my, mz) => this.poof(x, y, z, mx, my, mz)); break;
      case 1: emit((x, y, z) => this.largeExplode(x, y, z, 1)); break;
      case 2: emit((x, y, z) => { for (let i = 0; i < 6; i++) this.largeExplode(x + (rand() - rand()) * 4, y + (rand() - rand()) * 4, z + (rand() - rand()) * 4, 1); }); break;
      case 3: emit((x, y, z, mx, my, mz) => this.spark(x, y, z, mx, my, mz)); break;
      case 4: emit((x, y, z, mx, my, mz) => this.bubble(x, y, z, mx, my, mz)); break;
      case 39: emit((x, y, z) => this.rain(x, y, z)); break;
      case 5: case 6: emit((x, y, z, mx, my, mz) => this.splash(x, y, z, mx, my, mz)); break;
      case 7: case 8: emit((x, y, z) => this.add({ x, y, z, tex: 0, scale: rand() * 0.6 + 0.2, r: 0.4, g: 0.4, b: 0.7, maxAge: Math.floor(16 / (rand() * 0.8 + 0.2)), collide: false, update: (q) => { q.x += q.mx; q.y += q.my; q.z += q.mz; q.mx *= 0.99; q.my *= 0.99; q.mz *= 0.99; } })); break;
      case 9: emit((x, y, z, mx, my, mz) => this.crit1(x, y, z, mx, my, mz, false)); break;
      case 10: emit((x, y, z, mx, my, mz) => this.crit1(x, y, z, mx, my, mz, true)); break;
      case 11: emit((x, y, z, mx, my, mz) => this.smoke(x, y, z, mx, my, mz)); break;
      case 12: emit((x, y, z, mx, my, mz) => this.smoke(x, y, z, mx, my, mz, 2.5)); break;
      case 13: emit((x, y, z, mx, my, mz) => this.spell(x, y, z, mx, my, mz)); break;
      case 14: emit((x, y, z, mx, my, mz) => this.spell(x, y, z, mx, my, mz, 1, 1, 1, true)); break;
      case 15: case 16: emit((x, y, z, mx, my, mz, single) => this.spell(x, y, z, 0, 0, 0, single ? mx : p.offsetX, single ? my : p.offsetY, single ? mz : p.offsetZ)); break;
      case 17: emit((x, y, z, mx, my, mz) => this.spell(x, y, z, mx, my, mz, 1, 1, 1, false, true)); break;
      case 18: emit((x, y, z) => this.drip(x, y, z, false)); break;
      case 19: emit((x, y, z) => this.drip(x, y, z, true)); break;
      case 20: emit((x, y, z) => this.simpleRising(x, y, z, 81, { my: 0 })); break;
      case 21: case 22: emit((x, y, z) => this.simpleRising(x, y, z, id === 21 ? 82 : 0, { my: 0.0, scale: id === 21 ? 1.5 : 0.5, r: id === 22 ? 0.4 : 1, g: id === 22 ? 0.4 : 1, b: id === 22 ? 0.7 : 1 })); break;
      case 23: emit((x, y, z, mx) => this.simpleRising(x, y, z, 64, { my: 0.2, maxAge: 6, r: Math.sin(mx * Math.PI * 2) * 0.65 + 0.35, g: Math.sin((mx + 1 / 3) * Math.PI * 2) * 0.65 + 0.35, b: Math.sin((mx + 2 / 3) * Math.PI * 2) * 0.65 + 0.35 })); break;
      case 24: emit((x, y, z, mx, my, mz) => this.portal(x, y, z, mx, my, mz)); break;
      case 25: emit((x, y, z, mx, my, mz) => this.enchant(x, y, z, mx, my, mz)); break;
      case 26: emit((x, y, z, mx, my, mz) => this.flame(x, y, z, mx, my, mz)); break;
      case 27: emit((x, y, z) => this.lava(x, y, z)); break;
      case 28: emit((x, y, z) => this.footstep(x, y, z)); break;
      case 29: emit((x, y, z, mx, my, mz) => { const s = this.smoke(x, y, z, mx, my, mz, 2.5); if (s) { s.r = s.g = s.b = 1 - rand() * 0.3; } }); break;
      case 30: emit((x, y, z, mx, my, mz, single) => this.reddust(x, y, z, single ? mx : p.offsetX, single ? my : p.offsetY, single ? mz : p.offsetZ)); break;
      case 31: case 33: case 32: {
        const uv = this._itemAtlas(id === 33 ? 341 : 332);
        emit((x, y, z, mx, my, mz) => { if (uv) this._itemCrackAt(uv, x, y, z, mx, my, mz); });
        break;
      }
      case 34: emit((x, y, z) => this.simpleRising(x, y, z, 80, { my: 0.1 })); break;
      case 35: emit((x, y, z) => this.barrier(Math.floor(x), Math.floor(y), Math.floor(z))); break;
      case 36: {
        const itemId = p.data[0], dmg = p.data[1] || 0;
        const m = this.game.itemRenderer.modelFor({ id: itemId, damage: dmg, count: 1 });
        const tex = m.kind === 'generated' ? m.layers[0] : m.baked && m.baked.particle;
        const uv = tex ? this.game.assets.atlas.uv(tex) : null;
        emit((x, y, z, mx, my, mz) => { if (uv) this._itemCrackAt(uv, x, y, z, mx, my, mz); });
        break;
      }
      case 37: case 38: {
        const st = p.data[0];
        const state = ((st & 4095) << 4) | ((st >> 12) & 15);
        emit((x, y, z, mx, my, mz) => this.digging(x, y, z, mx, my, mz, state));
        break;
      }
      case 40: break;
      case 41: this.game.hud.elderGuardianTime = 60; break;
      default: break;
    }
  }

  _itemCrackAt(uv, x, y, z, mx, my, mz) {
    const du = (uv[2] - uv[0]) / 4, dv = (uv[3] - uv[1]) / 4;
    const u0 = uv[0] + Math.floor(rand() * 3) * du, v0 = uv[1] + Math.floor(rand() * 3) * dv;
    const p = this.fx(x, y, z, mx, my, mz, { atlas: [u0, v0, u0 + du, v0 + dv], gravity: 1, scale: 0.5 });
    return this.add(p);
  }

  // World events with particles
  onWorldEvent(p) {
    const { x, y, z } = p.location;
    switch (p.effectId) {
      case 2000: {
        const dx = (p.data % 3) - 1, dz = Math.floor(p.data / 3) % 3 - 1;
        for (let i = 0; i < 10; i++) {
          const d = rand() * 0.2 + 0.01;
          this.smoke(x + 0.5 + dx * 0.6 + (rand() - 0.5) * 0.25 * dz, y + 0.5 + (rand() - 0.5) * 0.5, z + 0.5 + dz * 0.6 + (rand() - 0.5) * 0.25 * dx, dx * d + (rand() - 0.5) * 0.01, -0.03 + (rand() - 0.5) * 0.01, dz * d + (rand() - 0.5) * 0.01);
        }
        break;
      }
      case 2001: {
        const st = ((p.data & 4095) << 4) | ((p.data >> 12) & 15);
        this.blockBreak(x, y, z, st);
        break;
      }
      case 2002: {
        // RenderGlobal.playAuxSFX: the potion's liquid colour; SPELL_INSTANT when an effect is instant
        const color = this.game.items.potionColor({ id: 373, damage: p.data, nbt: null });
        const instant = this.game.items.potionEffects({ id: 373, damage: p.data, nbt: null }).some((e) => POTIONS[e.id].instant);
        const r = ((color >> 16) & 255) / 255, g = ((color >> 8) & 255) / 255, b = (color & 255) / 255;
        const uv = this._itemAtlas(373);
        for (let i = 0; i < 8; i++) if (uv) this._itemCrackAt(uv, x + 0.5, y + 0.5, z + 0.5, gauss() * 0.15, rand() * 0.2, gauss() * 0.15);
        for (let i = 0; i < 100; i++) {
          const d = rand() * 4, a = rand() * Math.PI * 2;
          const mx = Math.cos(a) * d, my = 0.01 + rand() * 0.5, mz = Math.sin(a) * d;
          const s = this.spell(x + 0.5 + mx * 0.1, y + 0.5 + 0.3, z + 0.5 + mz * 0.1, mx, my, mz, r, g, b, instant);
          if (s) { const f = 0.75 + rand() * 0.25; s.r *= f; s.g *= f; s.b *= f; }
        }
        break;
      }
      case 2003: for (let i = 0; i < 8; i++) this._itemCrackAt(this._itemAtlas(381) || [0, 0, 0, 0], x + 0.5, y + 0.5, z + 0.5, gauss() * 0.15, rand() * 0.2, gauss() * 0.15); break;
      case 2004: for (let i = 0; i < 20; i++) { this.smoke(x + 0.5 + (rand() - 0.5) * 2, y + 0.5 + (rand() - 0.5) * 2, z + 0.5 + (rand() - 0.5) * 2, 0, 0, 0); this.flame(x + 0.5 + (rand() - 0.5) * 2, y + 0.5 + (rand() - 0.5) * 2, z + 0.5 + (rand() - 0.5) * 2); } break;
      case 2005: {
        const n = p.data || 15;
        for (let i = 0; i < n; i++) this.simpleRising(x + rand(), y + rand() * 1, z + rand(), 82, { mx: gauss() * 0.02, my: gauss() * 0.02, mz: gauss() * 0.02 });
        break;
      }
      default: break;
    }
  }

  _barrierVisible(p) {
    const g = this.game, held = g.inventory.held();
    return !!g.player.creative && !!held && g.items.name(held.id) === 'barrier'
      && blocks[g.world.getState(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) >> 4]?.name === 'barrier';
  }

  barrier(x, y, z) {
    if (!this._barrierVisible({ x: x + 0.5, y: y + 0.5, z: z + 0.5 })) return;
    const key = x + ',' + y + ',' + z;
    const index = this.barrierIndex || (this.barrierIndex = new Map());
    const existing = index.get(key);
    if (existing) { existing.age = 0; return; }
    const marker = this.add({ x: x + 0.5, y: y + 0.5, z: z + 0.5, barrier: true, barrierKey: key,
      atlas: this.game.assets.atlas.uv('items/barrier'), scale: 5, maxAge: 80, update: () => {} });
    if (marker) index.set(key, marker);
  }

  // Ambient block particles (Block.randomDisplayTick), called by the weather/ambience ticker
  randomDisplayTick(x, y, z, state) {
    const b = blocks[state >> 4];
    if (!b) return;
    const n = b.name;
    if (n === 'barrier') this.barrier(x, y, z);
    const m = state & 15;
    if (n === 'torch' || n === 'redstone_torch') {
      let px = x + 0.5, py = y + 0.7, pz = z + 0.5;
      const off = { 1: [-0.27, 0.22, 0], 2: [0.27, 0.22, 0], 3: [0, 0.22, -0.27], 4: [0, 0.22, 0.27] }[m];
      if (off) { px += off[0]; py += off[1]; pz += off[2]; }
      if (n === 'torch') { this.smoke(px, py, pz, 0, 0, 0); this.flame(px, py, pz); }
      else this.reddust(px, py, pz, 1, 0, 0);
    } else if (n === 'lit_furnace') {
      const f = [null, null, [0, -0.52], [0, 0.52], [-0.52, 0], [0.52, 0]][m] || [0, -0.52];
      const px = x + 0.5 + f[0] + (f[0] ? 0 : rand() * 0.6 - 0.3), py = y + rand() * 6 / 16, pz = z + 0.5 + f[1] + (f[1] ? 0 : rand() * 0.6 - 0.3);
      this.smoke(px, py, pz, 0, 0, 0); this.flame(px, py, pz);
    } else if (n === 'fire') {
      if (rand() * 24 < 1) this.game.sound.play('fire.fire', x + 0.5, y + 0.5, z + 0.5, 1 + rand(), rand() * 0.7 + 0.3);
      for (let i = 0; i < 3; i++) this.smoke(x + rand(), y + rand() * 0.5 + 0.5, z + rand(), 0, 0, 0, 2.5);
    } else if (n === 'portal') {
      if (rand() * 100 < 1) this.game.sound.play('portal.portal', x + 0.5, y + 0.5, z + 0.5, 0.5, rand() * 0.4 + 0.8);
      for (let i = 0; i < 4; i++) {
        let px = x + rand(), py = y + rand(), pz = z + rand();
        const j = rand() < 0.5 ? -1 : 1;
        let mx = (rand() - 0.5) * 0.5, my = (rand() - 0.5) * 0.5, mz = (rand() - 0.5) * 0.5;
        if (this.game.world.getBlockId(x - 1, y, z) !== 90 && this.game.world.getBlockId(x + 1, y, z) !== 90) { px = x + 0.5 + 0.25 * j; mx = rand() * 2 * j; }
        else { pz = z + 0.5 + 0.25 * j; mz = rand() * 2 * j; }
        this.portal(px, py, pz, mx, my, mz);
      }
    } else if (n === 'redstone_wire' && m > 0) {
      const f = m / 15;
      this.reddust(x + 0.5 + (rand() - 0.5) * 0.2, y + 0.0625, z + 0.5 + (rand() - 0.5) * 0.2, f * 0.6 + 0.4, Math.max(0, f * f * 0.7 - 0.5), Math.max(0, f * f * 0.6 - 0.7));
    } else if (n === 'lit_redstone_ore') {
      for (let i = 0; i < 6; i++) this.reddust(x + rand(), y + rand(), z + rand(), 1, 0, 0);
    } else if (n === 'mycelium') {
      this.simpleRising(x + rand(), y + 1.1, z + rand(), 0, { r: 0.4, g: 0.4, b: 0.7, my: 0, scale: 0.5 });
    } else if (n === 'enchanting_table') {
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        if (dx > -2 && dx < 2 && dz === -1) dz = 2;
        if (rand() < 1 / 16) for (let dy = 0; dy <= 1; dy++) {
          if (this.game.world.getBlockId(x + dx, y + dy, z + dz) === 47) this.enchant(x + 0.5, y + 2, z + 0.5, dx + rand() - 0.5, dy - rand() - 1, dz + rand() - 0.5);
        }
      }
    } else if (n === 'water' || n === 'flowing_water') {
      // BlockLiquid.randomDisplayTick (water): flowing water gurgles now and then
      if (m > 0 && m < 8 && rand() * 64 < 1) this.game.sound.play('liquid.water', x + 0.5, y + 0.5, z + 0.5, rand() * 0.25 + 0.75, rand() + 0.5);
    } else if (n === 'lava' || n === 'flowing_lava') {
      // BlockLiquid.randomDisplayTick (lava): pops with a particle, and a rarer ambient sound
      if (this.game.world.getBlockId(x, y + 1, z) === 0) {
        if (rand() * 100 < 1) {
          const px = x + rand(), pz = z + rand();
          this.lava(px, y + 1, pz);
          this.game.sound.play('liquid.lavapop', px, y + 1, pz, 0.2 + rand() * 0.2, 0.9 + rand() * 0.15);
        }
        if (rand() * 200 < 1) this.game.sound.play('liquid.lava', x, y, z, 0.2 + rand() * 0.2, 0.9 + rand() * 0.15);
      }
    } else if (n === 'end_portal_frame' || n === 'dragon_egg') {
      // no-op
    } else if (n === 'leaves' || n === 'leaves2') {
      // World.isRaining (canLightningStrike): rain strength above 0.2, not the "begin raining" flag
      if (this.game.world.rainStrength > 0.2 && rand() < 0.07 && blocks[this.game.world.getState(x, y - 1, z) >> 4]?.id === 0) this.drip(x + rand(), y - 0.05, z + rand(), false);
    }
    // Liquids dripping through ceilings
    const below = blocks[this.game.world.getState(x, y - 1, z) >> 4];
    if (b.opaque && below && below.id === 0 && rand() < 0.01) {
      const above = blocks[this.game.world.getState(x, y + 1, z) >> 4];
      if (above && above.isLiquid) this.drip(x + rand(), y - 0.05, z + rand(), above.isLava);
    }
  }
}

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
