// Rain/snow rendering, rain splashes + sound, and random block display ticks (ambience).
import { getBlock } from '../world/blocks.js';
import { biomeRainType,biomeInfo } from '../world/biomes.js';
import { FORMAT, litParams } from '../gfx/device.js';

const RADIUS = 10;
const MAX = (RADIUS * 2 + 1) ** 2;
const STRIDE = FORMAT.lit.stride;
const PARAMS = litParams(0.1);
const STATE = { blend: 'alpha', depthWrite: false, cull: false };
const rainX = new Float32Array(1024), rainZ = new Float32Array(1024);
for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) {
  const f = j - 16, f1 = i - 16;
  const f2 = Math.sqrt(f * f + f1 * f1) || 1;
  rainX[(i << 5) | j] = -f1 / f2;
  rainZ[(i << 5) | j] = f / f2;
}

export class Weather {
  constructor(game) {
    this.game = game;
    const r = game.renderer;
    this.updateCount = 0;
    this.rainSoundCounter = 0;
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
    draw.order = 12;
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

  precipHeight(x, z) {
    const w = this.game.world;
    const chunk = w.getChunk?.(x >> 4, z >> 4);
    for (let sy = (w.maxSection??16)-1; sy >= (w.minSection??0); sy--) {
      const section = chunk?.getSection(sy);
      if (chunk && (!section || section.nonAir === 0)) continue;
      for (let y = 15; y >= 0; y--) {
        const state = section ? section.get(x & 15, y, z & 15) : w.getState(x, sy * 16 + y, z);
        const b = getBlock(state);
        if (b && b.id !== 0 && (b.boundingBox === 'block' || b.isLiquid) && b.name !== 'leaves_never') return sy * 16 + y + 1;
      }
    }
    return w.minY??0;
  }

  tick() {
    this.updateCount++;
    const g = this.game;
    if (!g.inWorld) return;
    this._rainParticles();
    this._ambience();
  }

  _rainParticles() {
    const g = this.game;
    const w = g.world;
    let f = w.rainStrength;
    if (g.settings.particles >= 1) f /= 2;
    if (f <= 0 || g.dimension !== 0) return;
    const px = Math.floor(g.player.x), py = Math.floor(g.player.y), pz = Math.floor(g.player.z);
    const n = Math.floor(100 * f * f);
    let sx = 0, sy = 0, sz = 0, count = 0;
    for (let i = 0; i < n; i++) {
      const x = px + Math.floor(Math.random() * 21) - 10, z = pz + Math.floor(Math.random() * 21) - 10;
      const top = this.precipHeight(x, z);
      if (top > py + 10 || top < py - 10) continue;
      if (biomeRainType(w.getBiome(x, z, top), top) !== 'rain') continue;
      const below = getBlock(w.getState(x, top - 1, z));
      const rx = Math.random(), rz = Math.random();
      if (below && below.isLava) g.particles.smoke(x + rx, top + 0.1, z + rz, 0, 0, 0);
      else if (below && below.id !== 0) {
        if (Math.random() < 1 / ++count) { sx = x + rx; sy = top + 0.1; sz = z + rz; }
        g.particles.rain(x + rx, top + 0.1, z + rz);
      }
    }
    if (count > 0 && Math.floor(Math.random() * 3) < this.rainSoundCounter++) {
      this.rainSoundCounter = 0;
      if (sy > g.player.y + 1 && this.precipHeight(px, pz) > py) g.sound.play('weather.rain.above', sx, sy, sz, 0.1, 0.5);
      else g.sound.play('weather.rain', sx, sy, sz, 0.2, 1);
    }
  }

  // WorldClient.doVoidFogParticles -> Block.randomDisplayTick
  _ambience() {
    const g = this.game;
    const w = g.world;
    const px = Math.floor(g.player.x), py = Math.floor(g.player.y), pz = Math.floor(g.player.z);
    // WorldClient.doVoidFogParticles: 1000 random blocks within 16
    for (let i = 0; i < 1000; i++) {
      const r = 16;
      const x = px + Math.floor(Math.random() * r) - Math.floor(Math.random() * r);
      const y = py + Math.floor(Math.random() * r) - Math.floor(Math.random() * r);
      const z = pz + Math.floor(Math.random() * r) - Math.floor(Math.random() * r);
      const st = w.getState(x, y, z);
      if (st !== 0) g.particles.randomDisplayTick(x, y, z, st);
      const ambient=biomeInfo(w.getBiome(x,z,y)).effects?.particle;
      if(ambient&&!getBlock(st)?.collisionFull&&Math.random()<ambient.probability)g.particles.nativeParticle(ambient.options.type.replace(/^minecraft:/,''),x+Math.random(),y+Math.random(),z+Math.random());
    }
  }

  render(partial, cx, cy, cz) {
    const g = this.game;
    const w = g.world;
    const rain = w.prevRain !== undefined ? w.prevRain + (w.rainStrength - w.prevRain) * partial : w.rainStrength;
    for (const L of Object.values(this.layers)) L.count = 0;
    if (rain <= 0 || g.dimension !== 0) return;
    const bx = Math.floor(cx), by = Math.floor(cy), bz = Math.floor(cz);
    const t = this.updateCount + partial;
    for (let z = bz - RADIUS; z <= bz + RADIUS; z++) {
      for (let x = bx - RADIUS; x <= bx + RADIUS; x++) {
        const k = ((z - bz + 16) << 5) | (x - bx + 16);
        const dx = rainX[k] * 0.5, dz = rainZ[k] * 0.5;
        const top = this.precipHeight(x, z);
        let y0 = by - RADIUS, y1 = by + RADIUS;
        if (y0 < top) y0 = top;
        if (y1 < top) y1 = top;
        if (y0 === y1) continue;
        const type = biomeRainType(w.getBiome(x, z, Math.max(top, by)), Math.max(top, by));
        if (type === 'none') continue;
        const kind = type === 'snow' ? 'snow' : 'rain';
        const L = this.layers[kind];
        const ddx = x + 0.5 - cx, ddz = z + 0.5 - cz;
        const dist = Math.sqrt(ddx * ddx + ddz * ddz) / RADIUS;
        const alpha = ((1 - dist * dist) * 0.5 + 0.5) * rain;
        let vOff, uOff = 0;
        const hash = ((x * x * 3121 + x * 45238971 + z * z * 418711 + z * 13761) & 31);
        if (kind === 'rain') {
          // v grows with world y, so the offset has to grow over time for the streaks to fall
          vOff = (((this.updateCount + hash) & 31) + partial) / 32 * (3 + ((x * 31 + z * 17) & 7) / 8);
        } else {
          vOff = ((this.updateCount & 511) + partial) / 512;
          uOff = ((x * 7 + z * 13) & 15) / 16 + t * 0.002 * (((x ^ z) & 1) ? 1 : -1);
        }
        const x0 = x - dx + 0.5, z0 = z - dz + 0.5, x1 = x + dx + 0.5, z1 = z + dz + 0.5;
        const v0 = y0 * 0.25 + vOff, v1 = y1 * 0.25 + vOff;
        const ly = Math.max(by, top);
        const sky = w.getSkyLight(x, ly, z), blk = w.getBlockLight(x, ly, z);
        const o = L.count++ * 4 * STRIDE;
        L.data.set([
          x0, y1, z0, uOff, v1, 1, 1, 1, alpha, sky, blk,
          x1, y1, z1, uOff + 1, v1, 1, 1, 1, alpha, sky, blk,
          x1, y0, z1, uOff + 1, v0, 1, 1, 1, alpha, sky, blk,
          x0, y0, z0, uOff, v0, 1, 1, 1, alpha, sky, blk,
        ], o);
      }
    }
    for (const L of Object.values(this.layers)) if (L.count) g.device.updateMesh(L.mesh, L.data.subarray(0, L.count * 4 * STRIDE), { quads: true });
  }
}
