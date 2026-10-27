import {BiomeZoom} from './biome-zoom.js';
import {scaffoldingCollision} from './scaffolding.js';
import {decodeChunkData578} from './chunk-1.15.2.js';
import { getFluidState, fluidHeightAt } from './fluids.js';
// Client world: chunk storage, block access, light propagation, collision and raycasting.
import { biomeInfo } from './biomes.js';
import { Chunk, Section } from './chunk.js';
import { blocks, getBlock, getStateProperties, DIR_OFFSETS, staticCollisionBoxes } from './blocks.js';
import { stairsShape, stairsFacing, stairsHalf, doorProps } from './blockstates.js';

const HORIZ = ['south', 'west', 'north', 'east'];

export class World {
  constructor() {
    this.chunks = new Map();
    this.lightColumns = new Map();
    this.dimension = 0;
    this.hasSky = true;
    this.listeners = { sectionDirty: [], chunkLoaded: [], chunkUnloaded: [], blockChanged: [] };
    this.selectionProvider = null; // (state, x, y, z) -> [minx..maxz] relative or null
    this.worldAge = 0;
    this.timeOfDay = 6000;
    this.doDaylightCycle = true;
    this.rainStrength = 0;
    this.thunderStrength = 0;
    this.raining = false;
    this._gen = 1;
    this._cache = { gen: new Int32Array(16), x: new Int32Array(16), z: new Int32Array(16), c: new Array(16) };
    this._batch = null;
  }

  on(ev, fn) { this.listeners[ev].push(fn); }
  emit(ev, ...a) { for (const fn of this.listeners[ev]) fn(...a); }

  static key(x, z) { return x + ',' + z; }

  getChunk(cx, cz) { return this._chunk(cx, cz); }

  // Chunk lookup with a small direct-mapped cache (most accesses hit the same few columns)
  _chunk(cx, cz) {
    const slot = ((cx & 3) << 2) | (cz & 3);
    const cache = this._cache;
    if (cache.gen[slot] === this._gen && cache.x[slot] === cx && cache.z[slot] === cz) return cache.c[slot];
    const c = this.chunks.get(cx + ',' + cz);
    cache.gen[slot] = this._gen; cache.x[slot] = cx; cache.z[slot] = cz; cache.c[slot] = c;
    return c;
  }

  setDimension(dim) {
    if (dim !== this.dimension) this.clear();
    this.dimension = dim;
    this.hasSky = dim === 0;
  }

  // A new world (vanilla makes a new WorldClient on join and dimension change, with fresh WorldInfo: clear weather)
  clear() {
    for (const c of this.chunks.values()) this.emit('chunkUnloaded', c);
    this.chunks.clear();
    this.lightColumns.clear();
    this.biomeZoom=null;
    this._gen++;
    this.raining = false;
    this.rainStrength = this.prevRain = 0;
    this.thunderStrength = 0;
  }

  loadChunk(x, z, groundUp, bitMap, data, offset, skyLight) {
    // A full chunk without sections is an empty chunk (unloading has its own packet since 1.9)
    let c = this.getChunk(x, z);
    if (!c) {
      c = new Chunk(x, z, this.hasSky);
      this.chunks.set(x + ',' + z, c);
      this._gen++;
    }
    const n = c.load(data, offset, bitMap, groundUp, skyLight);
    this._computeHeights(c);
    this.emit('chunkLoaded', c, bitMap, groundUp);
    return n;
  }

  // Light columns have their own lifecycle: Update Light may precede terrain.
  _lightColumn(x, z) {
    const key=World.key(x,z);let light=this.lightColumns.get(key);
    if(!light){light={sky:new Array(18),block:new Array(18),skyKnown:false,skyDataMask:0};this.lightColumns.set(key,light);}
    return light;
  }

  loadChunk578(packet) {
    const decoded=decodeChunkData578(packet),{x,z,groundUp,bitMap}=packet;
    let c=this.getChunk(x,z);
    if(!c){c=new Chunk(x,z,this.hasSky);this.chunks.set(World.key(x,z),c);this._gen++;}
    c.nativeLight=this._lightColumn(x,z);c.heightmaps=packet.heightmaps;
    for(let sy=0;sy<16;sy++) {
      const data=decoded.sections[sy];
      if(!data){if(groundUp)c.sections[sy]=null;continue;}
      const sec=new Section(false);sec.blocks=data.blocks;sec.nonAir=data.nonAir;sec.wireNonAir=data.wireNonAir;
      sec.skyLight=c.nativeLight.sky[sy+1] ||= new Uint8Array(2048);
      sec.blockLight=c.nativeLight.block[sy+1] ||= new Uint8Array(2048);
      c.sections[sy]=sec;
    }
    if(decoded.biomes)c.biomes=decoded.biomes;
    this._computeHeights(c);
    this.emit('chunkLoaded',c,bitMap,groundUp);
    // Include cleared sections so previous geometry cannot survive a full reload.
    for(let sy=0;sy<16;sy++)if(groundUp||bitMap&(1<<sy))for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)this.emit('sectionDirty',x+dx,sy,z+dz);
    return c;
  }

  updateLight578(packet) {
    const light=this._lightColumn(packet.chunkX,packet.chunkZ),changed=new Set();
    for(const [name,arrays,empty] of [['sky',packet.skyLight,packet.emptySkyLightMask],['block',packet.blockLight,packet.emptyBlockLightMask]]) {
      for(let i=0;i<18;i++) {
        const bytes=arrays?.[i-1];if(!bytes&&!(empty&(1<<i)))continue;
        if(bytes?.length!==2048&&bytes)throw new Error('Invalid light section');
        light[name][i]=bytes?bytes.slice():new Uint8Array(2048);if(name==='sky'){light.skyKnown=true;light.skyDataMask=bytes?(light.skyDataMask||0)|(1<<i):(light.skyDataMask||0)&~(1<<i); }changed.add(i-1);
      }
    }
    const c=this.getChunk(packet.chunkX,packet.chunkZ);if(!c)return;
    c.nativeLight=light;
    for(const sy of changed) {
      const sec=c.sections[sy];if(sec){sec.skyLight=light.sky[sy+1]||sec.skyLight;sec.blockLight=light.block[sy+1]||sec.blockLight;}
      for(let dy=-1;dy<=1;dy++)if(sy+dy>=0&&sy+dy<16)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)this.emit('sectionDirty',c.x+dx,sy+dy,c.z+dz);
    }
  }

  unloadChunk(x, z) {
    this.lightColumns.delete(World.key(x,z));
    const c = this.getChunk(x, z);
    if (c) { this.chunks.delete(x + ',' + z); this._gen++; this.emit('chunkUnloaded', c); }
  }

  isLoaded(x, z) { return !!this._chunk(x >> 4, z >> 4); }

  getState(x, y, z) {
    if (y < 0 || y > 255) return 0;
    const c = this._chunk(x >> 4, z >> 4);
    if (!c) return 0;
    const s = c.sections[y >> 4];
    return s ? s.blocks[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)] : 0;
  }

  getBlockId(x, y, z) { return getBlock(this.getState(x, y, z)).id; }

  getBlockDef(x, y, z) { return getBlock(this.getState(x, y, z)); }

  setBiomeSeed(seed){this.biomeZoom=seed===undefined?null:new BiomeZoom(seed);}

  getBiome(x, z, y = 64) {
    if(this.biomeZoom){const biome=this.biomeZoom.sample(Math.floor(x),Math.floor(y),Math.floor(z),(qx,qy,qz)=>{const chunk=this._chunk(qx>>2,qz>>2);return chunk?.biomes.length===1024?chunk.biomes[(Math.max(0,Math.min(63,qy))<<4)|((qz&3)<<2)|(qx&3)]:null;});if(biome!==null)return biome;}


    const c = this._chunk(x >> 4, z >> 4);
    if(!c)return 1;
    return c.biomes.length===1024?c.biomes[(Math.max(0,Math.min(63,Math.floor(y/4)))<<4)|((z&15)>>2)<<2|((x&15)>>2)]:c.biomes[((z&15)<<4)|(x&15)];
  }

  // World.isRainingAt: rain, an exposed position, and a biome with rain precipitation.
  isRainingAt(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (!this.hasSky || this.rainStrength <= 0.2 || !this.isLoaded(x, z)) return false;
    if (biomeInfo(this.getBiome(x,z,y)).precipitation !== 'rain') return false;
    for (let above = Math.max(0, y); above < 256; above++) {
      const b = getBlock(this.getState(x, above, z));
      if (b.boundingBox === 'block' || b.isLiquid) return false;
    }
    return true;
  }

  getSkyLight(x, y, z) {
    const c = this._chunk(x >> 4, z >> 4);
    if (!c) return this.hasSky ? 15 : 0;
    return c.getSkyLight(x & 15, y, z & 15);
  }

  getBlockLight(x, y, z) {
    const c = this._chunk(x >> 4, z >> 4);
    if (!c) return 0;
    return c.getBlockLight(x & 15, y, z & 15);
  }

  // Sets a block and updates lighting. Emits sectionDirty for affected sections.
  // Between beginBatch() and endBatch() changes are collected and relit together (one light pass).
  setState(x, y, z, state) {
    if (y < 0 || y > 255) return;
    const c = this._chunk(x >> 4, z >> 4);
    if (!c) return;
    const old = c.getState(x & 15, y, z & 15);
    if (old === state) return;
    c.setState(x & 15, y, z & 15, state);
    this._updateHeight(c, x & 15, y, z & 15, state);
    const change = [x, y, z, old, state];
    if (this._batch) { this._batch.push(change); return; }
    this._applyChanges([change]);
  }

  beginBatch() { if (!this._batch) this._batch = []; }

  endBatch() {
    const b = this._batch;
    this._batch = null;
    if (b && b.length) this._applyChanges(b);
  }

  _applyChanges(changes) {
    const dirty = new Set();
    const blockSeeds = [], skySeeds = [];
    for (const [x, y, z, old, state] of changes) {
      this._markBlock(dirty, x, y, z, true);
      const ob = getBlock(old), nb = getBlock(state);
      const opChanged = this.opacity(old) !== this.opacity(state);
      if (ob.emitLight !== nb.emitLight || opChanged) blockSeeds.push(x, y, z);
      if (this.hasSky && opChanged) skySeeds.push(x, y, z);
    }
    if (blockSeeds.length) this._relight(false, blockSeeds, dirty);
    if (skySeeds.length) this._relight(true, skySeeds, dirty);
    for (const k of dirty) this.emit('sectionDirty', Math.floor(k / 0x200000 / 16) - 0x100000, k % 16, Math.floor(k / 16) % 0x200000 - 0x100000);
    for (const [x, y, z, old, state] of changes) this.emit('blockChanged', x, y, z, old, state);
  }

  // Dirty the section of a block plus the neighbouring sections that sample it (only at section borders).
  // full: block changes affect geometry of all 26 neighbours' faces; light changes only matter at borders too.
  _markBlock(set, x, y, z) {
    const cx = x >> 4, cy = y >> 4, cz = z >> 4;
    const lx = x & 15, ly = y & 15, lz = z & 15;
    const x0 = lx === 0 ? -1 : 0, x1 = lx === 15 ? 1 : 0;
    const y0 = ly === 0 && cy > 0 ? -1 : 0, y1 = ly === 15 && cy < 15 ? 1 : 0;
    const z0 = lz === 0 ? -1 : 0, z1 = lz === 15 ? 1 : 0;
    for (let dx = x0; dx <= x1; dx++) for (let dy = y0; dy <= y1; dy++) for (let dz = z0; dz <= z1; dz++) {
      set.add(((cx + dx + 0x100000) * 0x200000 + (cz + dz + 0x100000)) * 16 + cy + dy);
    }
  }

  // ---------------- Lighting ----------------

  opacity(state) {
    const b = getBlock(state);
    if (!b || b.id === 0) return 0;
    if (b.opaque) return 15;
    return b.filterLight || 0;
  }

  // Height map: y of the highest light-blocking block + 1 (columns at or above it see the sky)
  _computeHeights(c) {
    for (let i = 0; i < 256; i++) {
      const lx = i & 15, lz = i >> 4;
      let h = 0;
      for (let sy = 15; sy >= 0 && !h; sy--) {
        const s = c.sections[sy];
        if (!s || !s.nonAir) continue;
        for (let ly = 15; ly >= 0; ly--) {
          if (this.opacity(s.blocks[(ly << 8) | (lz << 4) | lx]) > 0) { h = sy * 16 + ly + 1; break; }
        }
      }
      c.heightMap[i] = h;
    }
  }

  _updateHeight(c, lx, y, lz, state) {
    const i = (lz << 4) | lx;
    const h = c.heightMap[i];
    if (this.opacity(state) > 0) { if (y + 1 > h) c.heightMap[i] = y + 1; return; }
    if (y + 1 !== h) return;
    let ny = y - 1;
    while (ny >= 0 && this.opacity(c.getState(lx, ny, lz)) === 0) ny--;
    c.heightMap[i] = ny + 1;
  }

  _getL(sky, x, y, z) {
    if (y < 0) return 0;
    if (y > 255) return sky ? 15 : 0;
    const c = this._chunk(x >> 4, z >> 4);
    if (!c) return -1;
    return sky ? c.getSkyLight(x & 15, y, z & 15) : c.getBlockLight(x & 15, y, z & 15);
  }

  _setL(sky, x, y, z, v, dirty) {
    if (y < 0 || y > 255) return;
    const c = this._chunk(x >> 4, z >> 4);
    if (!c) return;
    if (sky) c.setSkyLight(x & 15, y, z & 15, v); else c.setBlockLightAt(x & 15, y, z & 15, v);
    this._markBlock(dirty, x, y, z);
  }

  _sourceLevel(sky, x, y, z) {
    const st = this.getState(x, y, z);
    if (!sky) return getBlock(st).emitLight;
    if (this.opacity(st) > 0) return 0;
    const c = this._chunk(x >> 4, z >> 4);
    return c && y >= c.heightMap[((z & 15) << 4) | (x & 15)] ? 15 : 0;
  }

  // Remove-then-propagate relight around a set of changed positions (seeds: flat x,y,z list)
  _relight(sky, seeds, dirty) {
    const removeQ = [];
    const addQ = [];
    for (let s = 0; s < seeds.length; s += 3) {
      const x = seeds[s], y = seeds[s + 1], z = seeds[s + 2];
      const old = this._getL(sky, x, y, z);
      if (old > 0) { this._setL(sky, x, y, z, 0, dirty); removeQ.push(x, y, z, old); }
    }
    // Removal BFS
    let guard = 0;
    while (removeQ.length && guard++ < 400000) {
      const lv = removeQ.pop(), cz = removeQ.pop(), cy = removeQ.pop(), cx = removeQ.pop();
      for (let d = 0; d < 6; d++) {
        const o = DIR_OFFSETS[d];
        const nx = cx + o[0], ny = cy + o[1], nz = cz + o[2];
        const nl = this._getL(sky, nx, ny, nz);
        if (nl <= 0) continue;
        if (nl < lv || (sky && d === 0 && lv === 15 && nl === 15)) {
          this._setL(sky, nx, ny, nz, 0, dirty);
          removeQ.push(nx, ny, nz, nl);
        } else {
          addQ.push(nx, ny, nz);
        }
      }
    }
    // Re-seed the changed blocks, exposed sky columns and lit neighbours
    for (let s = 0; s < seeds.length; s += 3) {
      const x = seeds[s], y = seeds[s + 1], z = seeds[s + 2];
      const src = this._sourceLevel(sky, x, y, z);
      if (src > 0 && src > this._getL(sky, x, y, z)) { this._setL(sky, x, y, z, src, dirty); addQ.push(x, y, z); }
      if (sky && src === 15) {
        for (let yy = y - 1; yy >= 0; yy--) {
          if (this.opacity(this.getState(x, yy, z)) > 0) break;
          if (this._getL(true, x, yy, z) < 15) { this._setL(true, x, yy, z, 15, dirty); addQ.push(x, yy, z); }
        }
      }
      for (let d = 0; d < 6; d++) {
        const o = DIR_OFFSETS[d];
        if (this._getL(sky, x + o[0], y + o[1], z + o[2]) > 0) addQ.push(x + o[0], y + o[1], z + o[2]);
      }
    }
    // Addition BFS
    let i = 0;
    guard = 0;
    while (i < addQ.length && guard++ < 800000) {
      const cx = addQ[i++], cy = addQ[i++], cz = addQ[i++];
      const lv = this._getL(sky, cx, cy, cz);
      if (lv <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const o = DIR_OFFSETS[d];
        const nx = cx + o[0], ny = cy + o[1], nz = cz + o[2];
        if (ny < 0 || ny > 255) continue;
        const nl = this._getL(sky, nx, ny, nz);
        if (nl < 0) continue;
        const op = this.opacity(this.getState(nx, ny, nz));
        if (op >= 15) continue;
        let v = lv - Math.max(1, op);
        if (sky && d === 0 && lv === 15 && op === 0) v = 15;
        if (v > nl) {
          this._setL(sky, nx, ny, nz, v, dirty);
          addQ.push(nx, ny, nz);
        }
      }
    }
  }

  // ---------------- Collision ----------------

  // Collision boxes for the block at x,y,z in world coordinates
  // state: the block's collision boxes as if it were `state` (moving piston blocks ask for the block they carry)
  collisionBoxes(x, y, z, out, state = this.getState(x, y, z), mover = null) {
    const def = getBlock(state);
    if (!def || def.id === 0) return;
    if (!def) return;
    // BlockPistonMoving: its box is wherever the piston has moved the carried block, which may be the
    // neighbouring cell; getCollisions asks the moving blocks directly (movingCollider)
    if (def.name === 'moving_piston') return;
    // TileEntityShulkerBox: the box grows with the opening lid
    if (this.shulkerCollider && def.name.endsWith('_shulker_box')) { this.shulkerCollider(x, y, z, state, out); return; }
    const shapeBoxes = def.name === 'scaffolding' ? scaffoldingCollision(getStateProperties(state), y, mover) : staticCollisionBoxes(state);
    for (const bx of shapeBoxes) out.push([x + bx[0], y + bx[1], z + bx[2], x + bx[3], y + bx[4], z + bx[5]]);
    return;
    const m = state & 15;
    const add = (a, bb, c, d, e, f) => out.push([x + a, y + bb, z + c, x + d, y + e, z + f]);
    if (b.isFence || b.isPane || b.isWall) {
      const conn = (dx, dz) => {
        const ns = this.getState(x + dx, y, z + dz);
        const nb = getBlock(ns);
        if (!nb || nb.id === 0) return false;
        if (b.isFence) return (nb.isFence && ((nb.name === 'nether_brick_fence') === (b.name === 'nether_brick_fence'))) || nb.isFenceGate || (nb.opaque && nb.name !== 'pumpkin' && nb.name !== 'lit_pumpkin' && nb.name !== 'melon_block');
        if (b.isWall) return nb.isWall || nb.isFenceGate || (nb.opaque && nb.name !== 'pumpkin' && nb.name !== 'lit_pumpkin' && nb.name !== 'melon_block');
        return nb.opaque || nb.isPane || nb.name === 'glass' || nb.name === 'stained_glass';
      };
      const n = conn(0, -1), s = conn(0, 1), w = conn(-1, 0), e = conn(1, 0);
      if (b.isFence) {
        const h = 1.5;
        let x0 = 0.375, x1 = 0.625, z0 = 0.375, z1 = 0.625;
        if (n) z0 = 0; if (s) z1 = 1;
        if (n || s) add(0.375, 0, z0, 0.625, h, z1);
        if (w) x0 = 0; if (e) x1 = 1;
        if (w || e || !(n || s)) add(x0, 0, 0.375, x1, h, 0.625);
      } else if (b.isWall) {
        let x0 = 0.25, x1 = 0.75, z0 = 0.25, z1 = 0.75;
        if (n) z0 = 0; if (s) z1 = 1; if (w) x0 = 0; if (e) x1 = 1;
        if (n && s && !w && !e) { x0 = 0.3125; x1 = 0.6875; } else if (!n && !s && w && e) { z0 = 0.3125; z1 = 0.6875; }
        add(x0, 0, z0, x1, 1.5, z1);
      } else {
        const t0 = 0.4375, t1 = 0.5625;
        if ((!w || !e) && (w || e || n || s)) {
          if (w && !e) add(0, 0, t0, 0.5, 1, t1);
          else if (!w && e) add(0.5, 0, t0, 1, 1, t1);
        } else add(0, 0, t0, 1, 1, t1);
        if ((!n || !s) && (w || e || n || s)) {
          if (n && !s) add(t0, 0, 0, t1, 1, 0.5);
          else if (!n && s) add(t0, 0, 0.5, t1, 1, 1);
        } else add(t0, 0, 0, t1, 1, 1);
      }
      return;
    }
    if (b.isFenceGate) {
      if (m & 4) return;
      const f = HORIZ[m & 3];
      if (f === 'north' || f === 'south') add(0, 0, 0.375, 1, 1.5, 0.625); else add(0.375, 0, 0, 0.625, 1.5, 1);
      return;
    }
    if (b.isStairs) {
      const half = stairsHalf(m), facing = stairsFacing(m);
      const shape = stairsShape((a, bb, c) => this.getState(a, bb, c), x, y, z, m);
      const y0 = half === 'top' ? 0.5 : 0, y1 = half === 'top' ? 1 : 0.5;
      const uy0 = half === 'top' ? 0 : 0.5, uy1 = half === 'top' ? 0.5 : 1;
      add(0, y0, 0, 1, y1, 1);
      const halfBox = (f) => {
        switch (f) {
          case 'north': return [0, 0, 1, 0.5];
          case 'south': return [0, 0.5, 1, 1];
          case 'west': return [0, 0, 0.5, 1];
          default: return [0.5, 0, 1, 1];
        }
      };
      const quarter = (f1, f2) => {
        const a = halfBox(f1), c = halfBox(f2);
        return [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.min(a[2], c[2]), Math.min(a[3], c[3])];
      };
      const ccw = { north: 'west', west: 'south', south: 'east', east: 'north' };
      const cw = { north: 'east', east: 'south', south: 'west', west: 'north' };
      const opp = { north: 'south', south: 'north', east: 'west', west: 'east' };
      const boxes = [];
      if (shape === 'straight' || shape.startsWith('inner')) boxes.push(halfBox(facing));
      if (shape === 'outer_left') boxes.push(quarter(facing, ccw[facing]));
      if (shape === 'outer_right') boxes.push(quarter(facing, cw[facing]));
      if (shape === 'inner_left') boxes.push(quarter(opp[facing], ccw[facing]));
      if (shape === 'inner_right') boxes.push(quarter(opp[facing], cw[facing]));
      for (const q of boxes) add(q[0], uy0, q[1], q[2], uy1, q[3]);
      return;
    }
    if (b.isDoor) {
      const p = doorProps((a, bb, c) => this.getState(a, bb, c), x, y, z, m);
      const f = 0.1875;
      const right = p.hinge === 'right';
      if (p.open) {
        switch (p.facing) {
          case 'east': if (!right) add(0, 0, 0, 1, 1, f); else add(0, 0, 1 - f, 1, 1, 1); break;
          case 'south': if (!right) add(1 - f, 0, 0, 1, 1, 1); else add(0, 0, 0, f, 1, 1); break;
          case 'west': if (!right) add(0, 0, 1 - f, 1, 1, 1); else add(0, 0, 0, 1, 1, f); break;
          default: if (!right) add(0, 0, 0, f, 1, 1); else add(1 - f, 0, 0, 1, 1, 1); break;
        }
      } else {
        switch (p.facing) {
          case 'east': add(0, 0, 0, f, 1, 1); break;
          case 'south': add(0, 0, 0, 1, 1, f); break;
          case 'west': add(1 - f, 0, 0, 1, 1, 1); break;
          default: add(0, 0, 1 - f, 1, 1, 1); break;
        }
      }
      return;
    }
    if (b.boundingBox !== 'block') return;
    const boxes = staticCollisionBoxes(id, m);
    for (const bx of boxes) add(bx[0], bx[1], bx[2], bx[3], bx[4], bx[5]);
  }

  // All collision boxes intersecting an AABB [minX,minY,minZ,maxX,maxY,maxZ]
  // World.getCollisionBoxes: block boxes in bb, plus (with a moving entity) the entity boxes it collides with
  // (this.entityCollider, set by the game)
  getCollisions(bb, mover = null) {
    const out = [];
    if (mover && this.entityCollider) for (const c of this.entityCollider(bb, mover)) out.push(c);
    // one cell of margin like World.getCollisionBoxes: shulker boxes and other boxes can reach into the next cell
    const x0 = Math.floor(bb[0]) - 1, x1 = Math.floor(bb[3] + 1) + 1;
    const y0 = Math.floor(bb[1]) - 1, y1 = Math.floor(bb[4] + 1);
    const z0 = Math.floor(bb[2]) - 1, z1 = Math.floor(bb[5] + 1) + 1;
    const tmp = [];
    for (let x = x0; x < x1; x++) {
      for (let z = z0; z < z1; z++) {
        if (!this.isLoaded(x, z)) {
          // Unloaded chunks are solid walls for the player (prevents falling into the void)
          for (let y = Math.max(y0, 0); y < y1; y++) out.push([x, y, z, x + 1, y + 1, z + 1]);
          continue;
        }
        for (let y = y0; y < y1; y++) {
          tmp.length = 0;
          this.collisionBoxes(x, y, z, tmp, this.getState(x, y, z), mover);
          for (const c of tmp) {
            if (c[3] > bb[0] && c[0] < bb[3] && c[4] > bb[1] && c[1] < bb[4] && c[5] > bb[2] && c[2] < bb[5]) out.push(c);
          }
        }
      }
    }
    if (this.movingCollider) this.movingCollider(bb, out);
    return out;
  }

  // ---------------- Raycast ----------------

  selectionBox(state, x, y, z) {
    const b = getBlock(state);
    if (!b || b.isAir || b.id === 0 || b.isLiquid) return null;
    if (this.selectionProvider) {
      const r = this.selectionProvider(state, x, y, z);
      if (r !== undefined) return r;
    }
    return [0, 0, 0, 1, 1, 1];
  }

  // Returns { x, y, z, face, hit: [x,y,z], state } or null
  raycast(ox, oy, oz, dx, dy, dz, maxDist, hitLiquids = false) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
    const tDeltaX = stepX ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = stepY ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = stepZ ? Math.abs(1 / dz) : Infinity;
    let tMaxX = stepX ? ((stepX > 0 ? x + 1 - ox : ox - x) * tDeltaX) : Infinity;
    let tMaxY = stepY ? ((stepY > 0 ? y + 1 - oy : oy - y) * tDeltaY) : Infinity;
    let tMaxZ = stepZ ? ((stepZ > 0 ? z + 1 - oz : oz - z) * tDeltaZ) : Infinity;
    for (let i = 0; i < 200; i++) {
      const state = this.getState(x, y, z);
      if (state !== 0) {
        const b = getBlock(state);
        let box = null;
        if (b.isLiquid) {
          if (hitLiquids && Number(getStateProperties(state).level || 0) === 0) box = [0, 0, 0, 1, 0.875, 1];
        } else box = this.selectionBox(state, x, y, z);
        const boxes = box ? [box] : [];
        if (hitLiquids === 'any' && getFluidState(state)) boxes.push([0,0,0,1,fluidHeightAt(this,x,y,z),1]);
        let nearest = null, hitBox = null;
        for (const candidate of boxes) {
          const r = rayBox(ox, oy, oz, dx, dy, dz, x + candidate[0], y + candidate[1], z + candidate[2], x + candidate[3], y + candidate[4], z + candidate[5]);
          if (r && r.t <= maxDist && (!nearest || r.t < nearest.t)) { nearest = r; hitBox = candidate; }
        }
        if (nearest) return { x,y,z,face:nearest.face,hit:[ox+dx*nearest.t,oy+dy*nearest.t,oz+dz*nearest.t],state,dist:nearest.t,box:hitBox };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        if (tMaxX > maxDist) break;
        x += stepX; tMaxX += tDeltaX;
      } else if (tMaxY < tMaxZ) {
        if (tMaxY > maxDist) break;
        y += stepY; tMaxY += tDeltaY;
      } else {
        if (tMaxZ > maxDist) break;
        z += stepZ; tMaxZ += tDeltaZ;
      }
    }
    return null;
  }
}

// Ray vs AABB slab test. Returns { t, face } (face as EnumFacing index) or null
export function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = -Infinity, tmax = Infinity, face = -1;
  const axes = [[ox, dx, x0, x1, 4, 5], [oy, dy, y0, y1, 0, 1], [oz, dz, z0, z1, 2, 3]];
  for (const [o, d, mn, mx, negFace, posFace] of axes) {
    if (Math.abs(d) < 1e-12) {
      if (o < mn || o > mx) return null;
      continue;
    }
    let t1 = (mn - o) / d, t2 = (mx - o) / d;
    let f1 = negFace, f2 = posFace;
    if (t1 > t2) { [t1, t2] = [t2, t1]; [f1, f2] = [f2, f1]; }
    if (t1 > tmin) { tmin = t1; face = f1; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  if (tmin < 0) return { t: 0, face };
  return { t: tmin, face };
}

export { Section };
