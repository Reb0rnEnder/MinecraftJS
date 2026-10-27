// Tile entity (block entity) rendering: chests, signs, skulls, banners, enchanting book, beacon beam, end portal,
// beds and shulker boxes.
import { composeBanner, bannerLayers, buildBanner, bannerSwing } from './banner.js';
import { entityMaterial, entityMesh } from './boxmodel.js';
import { blockModel } from './entity-models.js';
import { buildTextMeshes, destroyTextMeshes } from './text-mesh.js';
import { blocks, blocksByName, getBlock, getStateProperties, findState } from '../world/blocks.js';
import { colorParams, FORMAT } from '../gfx/device.js';
import { D2R, aabbInFrustum } from '../gfx/math.js';
import { Node, material } from '../gfx/scene.js';
import { resolveState } from '../world/blockstates.js';
import { Pistons } from '../game/pistons.js';
import { JavaRandom } from '../util/jrandom.js';
const FLOWER_POT = {
  'minecraft:red_flower': ['rose', 'blue_orchid', 'allium', 'houstonia', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy'],
  'minecraft:yellow_flower': ['dandelion'],
  'minecraft:sapling': ['oak_sapling', 'spruce_sapling', 'birch_sapling', 'jungle_sapling', 'acacia_sapling', 'dark_oak_sapling'],
  'minecraft:red_mushroom': ['mushroom_red'], 'minecraft:brown_mushroom': ['mushroom_brown'], 'minecraft:deadbush': ['dead_bush'],
  'minecraft:tallgrass': ['dead_bush', 'fern', 'fern'], 'minecraft:cactus': ['cactus'],
};
const FLOWER_POT_IDS = { 38: 'minecraft:red_flower', 37: 'minecraft:yellow_flower', 6: 'minecraft:sapling', 40: 'minecraft:red_mushroom', 39: 'minecraft:brown_mushroom', 32: 'minecraft:deadbush', 31: 'minecraft:tallgrass', 81: 'minecraft:cactus' };

const key = (x, y, z) => x + ',' + y + ',' + z;
// Skull identity moved from tile NBT into the block registry in 1.13.
const SKULL_TYPES = new Map(['skeleton_skull', 'wither_skeleton_skull', 'zombie_head', 'player_head', 'creeper_head', 'dragon_head']
  .map((name, type) => [name, type]));
const skullType = (name) => SKULL_TYPES.get(name.replace('_wall_', '_'));
// EnumFacing order: down, up, north, south, west, east
const SHULKER_FACING = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

// TileEntityEndPortalRenderer's layer colours: new Random(31100), three nextFloat()s per layer, times 0.15 for the sky
// layer and 2 / (18 - i) for portal layer i
const END_PORTAL_COLORS = (() => {
  const r = new JavaRandom(31100), f32 = Math.fround, out = [];
  for (let i = 0; i < 16; i++) {
    const f = i === 0 ? f32(0.15) : f32(2 / (18 - i));
    out.push([f32(f32(r.nextFloat() * 0.5 + 0.1) * f), f32(f32(r.nextFloat() * 0.5 + 0.4) * f), f32(f32(r.nextFloat() * 0.5 + 0.5) * f)]);
  }
  return out;
})();

export class TileEntityRenderer {
  constructor(game) {
    this.game = game;
    this.r = game.renderer;
    this.device = game.device;
    this.group = new Node();
    this.r.entityRoot.add(this.group);
    this.tiles = new Map(); // key -> { x,y,z, type, data, obj, ... }
    this.signs = new Map(); // key -> lines
    this.ticks = 0;
  }

  clear() {
    for (const t of this.tiles.values()) this._dispose(t);
    this.tiles.clear();
    this.signs.clear();
  }

  removeChunk(cx, cz) {
    for (const [k, t] of this.tiles) if ((t.x >> 4) === cx && (t.z >> 4) === cz) { this._dispose(t); this.tiles.delete(k); }
    for (const k of [...this.signs.keys()]) { const [x, , z] = k.split(',').map(Number); if ((x >> 4) === cx && (z >> 4) === cz) this.signs.delete(k); }
  }

  _dispose(t) {
    if (t.obj) { this.group.remove(t.obj); t.obj = null; }
    for (const m of t.ownMeshes || []) this.device.destroyMesh(m);
    t.ownMeshes = [];
    destroyTextMeshes(this.device, t.textMeshes);
    t.textMeshes = null;
    if (t.texture) { this.device.destroyTexture(t.texture); t.texture = null; }
  }

  _get(x, y, z) { return this.tiles.get(key(x, y, z)); }

  onBlockChanged(x, y, z, oldState, newState) {
    const k = key(x, y, z);
    const t = this.tiles.get(k);
    if (t && getBlock(newState).id !== getBlock(oldState).id) { this._dispose(t); this.tiles.delete(k); }
    this._ensure(x, y, z, newState);
    // Neighbouring chests may need re-pairing
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this._get(x + dx, y, z + dz);
      if (n && n.type === 'chest') { this._dispose(n); this.tiles.delete(key(x + dx, y, z + dz)); this._ensure(x + dx, y, z + dz, this.game.world.getState(x + dx, y, z + dz)); }
    }
  }

  // TileEntityShulkerBox.getBoundingBox: the full block grown towards its facing by half the lid's progress
  shulkerBounds(x, y, z, facing, progress) {
    const d = SHULKER_FACING[facing] || SHULKER_FACING[1], e = 0.5 * progress;
    const b = [x, y, z, x + 1, y + 1, z + 1];
    for (let k = 0; k < 3; k++) { if (d[k] > 0) b[k + 3] += d[k] * e; else if (d[k] < 0) b[k] += d[k] * e; }
    return b;
  }

  // Collision box of a shulker box block (world.collisionBoxes asks through world.shulkerCollider)
  shulkerCollision(x, y, z, state, out) {
    const t = this.tiles.get(key(x, y, z));
    const facing = ['down', 'up', 'north', 'south', 'west', 'east'].indexOf(getStateProperties(state).facing);
    out.push(this.shulkerBounds(x, y, z, facing < 0 ? 1 : facing, t && t.type === 'shulker' ? t.lid : 0));
  }

  // TileEntityShulkerBox.moveCollidedEntities: the part the lid occupies (getTopBoundingBox) pushes the local player
  // out along the facing, by the overlap plus 0.01
  _shulkerPush(t) {
    const g = this.game, pl = g.player;
    if (!pl || pl.spectator || !g.inWorld) return;
    const facing = ['down', 'up', 'north', 'south', 'west', 'east'].indexOf(getStateProperties(t.state).facing), d = SHULKER_FACING[facing < 0 ? 1 : facing];
    const b = this.shulkerBounds(t.x, t.y, t.z, facing, t.lid);
    for (let k = 0; k < 3; k++) { if (d[k] > 0) b[k] += 1; else if (d[k] < 0) b[k + 3] -= 1; } // contract away from the base
    const e = pl.bb();
    if (!(b[3] > e[0] && b[0] < e[3] && b[4] > e[1] && b[1] < e[4] && b[5] > e[2] && b[2] < e[5])) return;
    const m = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      if (d[k] > 0) m[k] = b[k + 3] - e[k] + 0.01;
      else if (d[k] < 0) m[k] = -(e[k + 3] - b[k] + 0.01);
    }
    pl.moveEntity(g.world, m[0], m[1], m[2]);
  }

  // Create tile visuals for blocks that need them (chests don't always get TE packets)
  _ensure(x, y, z, state) {
    const b = getBlock(state);
    if (!b) return null;
    const k = key(x, y, z);
    let t = this.tiles.get(k);
    if (t) return t;
    const n = b.name;
    let type = null;
    if (n === 'chest' || n === 'trapped_chest' || n === 'ender_chest') type = 'chest';
    else if (n === 'sign' || n === 'wall_sign') type = 'sign';
    else if (skullType(n) !== undefined) type = 'skull';
    else if (n.endsWith('_banner') || n.endsWith('_wall_banner')) type = 'banner';
    else if (n === 'enchanting_table') type = 'book';
    else if (n === 'beacon') type = 'beacon';
    else if (n === 'end_portal' || n === 'end_gateway') type = 'endportal';
    else if (n.endsWith('_bed')) type = 'bed';
    else if (n.endsWith('_shulker_box')) type = 'shulker';
    if (!type) return null;
    t = { x, y, z, type, state, data: null, lid: 0, prevLid: 0, open: 0 };
    this.tiles.set(k, t);
    return t;
  }

  // Use the live model (including lid/cloth transforms) for the damage pass.
  breakingModel(pos,state) {
    let t=this._ensure(pos.x,pos.y,pos.z,state);
    if(!t||!['chest','sign','skull','banner','bed','shulker'].includes(t.type))return null;
    if(!t.built)this._build(t);
    if(t.type==='chest'&&t.secondary){
      const current=this.game.world.getBlockDef(pos.x,pos.y,pos.z).id;
      for(const [dx,dz] of [[-1,0],[0,-1]]){
        if(this.game.world.getBlockDef(pos.x+dx,pos.y,pos.z+dz).id!==current)continue;
        const other=this._ensure(pos.x+dx,pos.y,pos.z+dz,this.game.world.getState(pos.x+dx,pos.y,pos.z+dz));
        if(other&&!other.built)this._build(other);
        if(other?.obj){t=other;break;}
      }
    }
    return {root:t.obj,type:t.type};
  }

  // Scan a newly loaded chunk for tile blocks
  scanChunk(c) {
    for (let sy = 0; sy < 16; sy++) {
      const s = c.sections[sy];
      if (!s) continue;
       for (let i = 0; i < 4096; i++) {
         const state = s.blocks[i], name = getBlock(state).name;
         if (name === 'chest' || name === 'trapped_chest' || name === 'ender_chest' || name === 'sign' || name === 'wall_sign' ||
            name.endsWith('_bed') || name.endsWith('_banner') || name.endsWith('_wall_banner') || skullType(name) !== undefined ||
            name === 'flower_pot' || name === 'end_portal' || name === 'end_gateway' || name.endsWith('_shulker_box') ||
           name === 'enchanting_table' || name === 'beacon') {
           const x = c.x * 16 + (i & 15), y = sy * 16 + (i >> 8), z = c.z * 16 + ((i >> 4) & 15);
           this._ensure(x, y, z, state);
         }
      }
    }
  }

  setSign(pos, lines) {
    this.signs.set(key(pos.x, pos.y, pos.z), lines);
    const t = this._ensure(pos.x, pos.y, pos.z, this.game.world.getState(pos.x, pos.y, pos.z));
    if (t) { t.lines = lines; this._rebuild(t); }
  }

  setTileEntity(pos, action, data) {
    const w = this.game.world;
    const st = w.getState(pos.x, pos.y, pos.z);
    if (!data) return;
    // Flower pot contents -> mesher property override
    if (getBlock(st).name === 'flower_pot' || action === 5) {
      let item = data.Item;
      if (typeof item === 'number') item = FLOWER_POT_IDS[item];
      const list = item ? FLOWER_POT[item] : null;
      const contents = list ? list[data.Data || 0] || list[0] : 'empty';
      this.game.tileProps.set(pos.x + ',' + pos.y + ',' + pos.z, { contents });
      this.game.world.emit('sectionDirty', pos.x >> 4, pos.y >> 4, pos.z >> 4);
      return;
    }
    const t = this._ensure(pos.x, pos.y, pos.z, st);
    if (!t) return;
    t.data = data;
    if (t.type === 'sign' && data.Text1 !== undefined) {
      // Signs can also arrive as tile entity NBT
    }
    this._rebuild(t);
  }

  onBlockAction(p) {
    const b = blocks[p.blockId];
    if (!b) return;
    if (b.name === 'chest' || b.name === 'trapped_chest' || b.name === 'ender_chest' || b.name.endsWith('_shulker_box')) {
      const t = this._ensure(p.location.x, p.location.y, p.location.z, this.game.world.getState(p.location.x, p.location.y, p.location.z));
      if (t && p.byte1 === 1) {
        const n = (p.byte2 << 24) >> 24; // the event parameter is a signed byte (closing twice sends -1)
        t.open = n;
        // TileEntityShulkerBox.receiveClientEvent: only exactly 1 opens and 0 closes
        if (t.type === 'shulker') { if (n === 1) t.status = 'opening'; else if (n === 0) t.status = 'closing'; }
      }
    }
  }

  tick() {
    this.ticks++;
    const g = this.game;
    const beaconUpdate = (Number(g.world.worldAge) || this.ticks) % 80 === 0;
    for (const t of this.tiles.values()) {
      if (t.type === 'beacon' && beaconUpdate) this._updateBeacon(t);
      if (t.type === 'shulker') {
        // TileEntityShulkerBox.update: closed / opening / opened / closing, 0.1 per tick; while it moves, entities in
        // the lid's way are pushed out (the local player here)
        t.prevLid = t.lid;
        const st = t.status || 'closed';
        if (st === 'opening') { t.lid += 0.1; if (t.lid >= 1) { this._shulkerPush(t); t.status = 'opened'; t.lid = 1; } }
        else if (st === 'closing') { t.lid -= 0.1; if (t.lid <= 0) { t.status = 'closed'; t.lid = 0; } }
        else t.lid = st === 'opened' ? 1 : 0;
        if (t.status === 'opening' || t.status === 'closing') this._shulkerPush(t);
      } else if (t.type === 'chest') {
        t.prevLid = t.lid;
        if ((t.open === 0 && t.lid > 0) || (t.open > 0 && t.lid < 1)) {
          const before = t.lid;
          t.lid = Math.max(0, Math.min(1, t.lid + (t.open > 0 ? 0.1 : -0.1)));
          void before; // chest open/close sounds come from the server's TileEntityChest
        }
      } else if (t.type === 'book') {
        // TileEntityEnchantmentTable.update
        const p = g.player;
        const dx = p.x - (t.x + 0.5), dz = p.z - (t.z + 0.5), dy = p.y - (t.y + 0.5);
        t.prevPageFlip = t.pageFlip || 0; t.prevBookSpread = t.bookSpread || 0; t.prevRot = t.bookRotation || 0;
        if (dx * dx + dy * dy + dz * dz < 9) {
          t.tRot = Math.atan2(dz, dx);
          t.bookSpread = (t.bookSpread || 0) + 0.1;
          if (Math.random() < 1 / 40) { const f = t.flipT || 0; do { t.flipT = f + Math.floor(Math.random() * 4) - Math.floor(Math.random() * 4); } while (f === t.flipT); }
        } else {
          t.tRot = (t.tRot || 0) + 0.02;
          t.bookSpread = (t.bookSpread || 0) - 0.1;
        }
        let rot = t.bookRotation || 0;
        while (rot >= Math.PI) rot -= Math.PI * 2; while (rot < -Math.PI) rot += Math.PI * 2;
        let tr = t.tRot;
        while (tr >= Math.PI) tr -= Math.PI * 2; while (tr < -Math.PI) tr += Math.PI * 2;
        let d = tr - rot;
        while (d >= Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        t.bookRotation = rot + d * 0.4;
        t.bookSpread = Math.max(0, Math.min(1, t.bookSpread));
        let f1 = ((t.flipT || 0) - (t.pageFlip || 0)) * 0.4;
        f1 = Math.max(-0.2, Math.min(0.2, f1));
        t.flipA = (t.flipA || 0) + (f1 - (t.flipA || 0)) * 0.9;
        t.pageFlip = (t.pageFlip || 0) + t.flipA;
      }
    }
  }

  // TileEntityBeacon.updateSegmentColors: beam colour segments from stained glass above, blocked by opaque
  // blocks (bedrock excepted); levels from the pyramid of iron/gold/emerald/diamond blocks below
  _updateBeacon(t) {
    const w = this.game.world;
    const { x, y, z } = t;
    t.beamSegments = [];
    t.beamComplete = true;
    let seg = { color: [1, 1, 1], height: 1 };
    t.beamSegments.push(seg);
    let first = true;
    for (let yy = y + 1; yy < 256; yy++) {
      const st = w.getState(x, yy, z), b = getBlock(st);
      let c;
      if (b && (b.name.endsWith('_stained_glass') || b.name.endsWith('_stained_glass_pane'))) {
        const color = b.name.replace(/_stained_glass(?:_pane)?$/, '').replace('light_gray', 'silver');
        c = DYE_RGB[DYE_NAMES.indexOf(color)] || [1, 1, 1];
      }
      else {
        if (b && b.id !== 0 && (b.filterLight >= 15) && b.name !== 'bedrock') { t.beamComplete = false; t.beamSegments = []; break; }
        seg.height++;
        continue;
      }
      if (!first) c = [(seg.color[0] + c[0]) / 2, (seg.color[1] + c[1]) / 2, (seg.color[2] + c[2]) / 2].map(Math.fround);
      if (c[0] === seg.color[0] && c[1] === seg.color[1] && c[2] === seg.color[2]) seg.height++;
      else { seg = { color: c, height: 1 }; t.beamSegments.push(seg); }
      first = false;
    }
    t.levels = 0;
    if (t.beamComplete) {
      const ok = new Set(['emerald_block', 'gold_block', 'diamond_block', 'iron_block']);
      for (let l = 1; l <= 4; t.levels = l++) {
        const yy = y - l;
        if (yy < 0) break;
        let full = true;
        for (let xx = x - l; xx <= x + l && full; xx++) for (let zz = z - l; zz <= z + l; zz++) {
          const b = getBlock(w.getState(xx, yy, zz));
          if (!b || !ok.has(b.name)) { full = false; break; }
        }
        if (!full) break;
      }
      if (t.levels === 0) t.beamComplete = false;
    }
  }

  // TileEntityBeacon.shouldBeamRender: brightness ramps up 0.025 per frame, drops while ticks are skipped
  _beamBrightness(t) {
    if (!t.beamComplete) return 0;
    const now = Number(this.game.world.worldAge) || this.ticks;
    const i = now - (t.beamCounter === undefined ? now : t.beamCounter);
    t.beamCounter = now;
    let f = t.beamFade || 0;
    if (i > 1) f = Math.max(0, f - i / 40);
    f = Math.min(1, f + 0.025);
    t.beamFade = f;
    return f;
  }

  // Fill the core / glow meshes (positions relative to the block's corner)
  _buildBeam(t, partial) {
    const f = this._beamBrightness(t);
    const segs = f > 0 ? t.beamSegments || [] : [];
    const core = [], glow = [];
    const d0 = (Number(this.game.world.worldAge) || this.ticks) + partial;
    const frac = (v) => v - Math.floor(v);
    const d1 = frac(-d0 * 0.2 - Math.floor(-d0 * 0.1));
    const rot = d0 * 0.025 * -1.5;
    const P = (a) => [0.5 + Math.cos(rot + a) * 0.2, 0.5 + Math.sin(rot + a) * 0.2];
    const [p4, p6, p8, p10] = [P(2.356194490192345), P(Math.PI / 4), P(3.9269908169872414), P(5.497787143782138)];
    let j = 0;
    const v = (out, px, py, pz, u, vv, c, a) => out.push(px, py, pz, u, vv, c[0], c[1], c[2], a);
    for (const seg of segs) {
      const k = j + seg.height, c = seg.color;
      const v0 = -1 + d1, v1 = seg.height * f * (0.5 / 0.2) + v0;
      for (const [A, B] of [[p4, p6], [p10, p8], [p6, p10], [p8, p4]]) {
        v(core, A[0], k, A[1], 1, v1, c, 1); v(core, A[0], j, A[1], 1, v0, c, 1);
        v(core, B[0], j, B[1], 0, v0, c, 1); v(core, B[0], k, B[1], 0, v1, c, 1);
      }
      const g0 = -1 + d1, g1 = seg.height * f + g0;
      const q2 = [0.2, 0.2], q4 = [0.8, 0.2], q6 = [0.2, 0.8], q8 = [0.8, 0.8];
      for (const [A, B] of [[q2, q4], [q8, q6], [q4, q8], [q6, q2]]) {
        v(glow, A[0], k, A[1], 1, g1, c, 0.125); v(glow, A[0], j, A[1], 1, g0, c, 0.125);
        v(glow, B[0], j, B[1], 0, g0, c, 0.125); v(glow, B[0], k, B[1], 0, g1, c, 0.125);
      }
      j = k;
    }
    const empty = new Float32Array(0);
    this.device.updateMesh(t.beamCore, core.length ? new Float32Array(core) : empty, { quads: true });
    this.device.updateMesh(t.beamGlow, glow.length ? new Float32Array(glow) : empty, { quads: true });
  }

  _rebuild(t) {
    this._dispose(t);
    t.built = false;
  }

  _build(t) {
    t.built = true;
    const g = this.game;
    const w = g.world;
    const st = w.getState(t.x, t.y, t.z);
    if (getBlock(st).id !== getBlock(t.state).id) t.state = st;
    const props = getStateProperties(st);
    const obj = new Node();
    obj.position.set(t.x, t.y, t.z);
    t.ownMeshes = [];
    let mat;
    switch (t.type) {
      case 'chest': {
        const id = getBlock(st).id;
        const isEnder = getBlock(st).name === 'ender_chest';
        const same = (x, z) => getBlock(w.getState(x, t.y, z)).id === id && !isEnder;
        t.secondary = same(t.x - 1, t.z) || same(t.x, t.z - 1);
        if (t.secondary) { t.obj = null; return; }
        const xPos = same(t.x + 1, t.z), zPos = same(t.x, t.z + 1);
        const large = xPos || zPos;
        const texName = isEnder ? 'entity/chest/ender.png' : id === 146 ? (large ? 'entity/chest/trapped_double.png' : 'entity/chest/trapped.png') : (large ? 'entity/chest/normal_double.png' : 'entity/chest/normal.png');
        mat = entityMaterial(texName, { alphaTest: 0.1 });
        // ModelChest / ModelLargeChest
        const { lid, below, knob } = blockModel(large ? 'largeChest' : 'chest', ['lid', 'below', 'knob']);
        const model = new Node();
        for (const p of [lid, knob, below]) { model.add(p.build()); p.setMaterial(mat); }
        model.scale.set(1 / 16, 1 / 16, 1 / 16);
        // translate(x, y+1, z+1); scale(1,-1,-1); translate(.5,.5,.5); rotate; translate(-.5,-.5,-.5)
        const a = new Node(); a.position.set(0, 1, 1); a.scale.set(1, -1, -1);
        const b2 = new Node(); b2.position.set(0.5, 0.5, 0.5);
         const facing = ['down', 'up', 'north', 'south', 'west', 'east'].indexOf(props.facing);
         const rot = facing === 2 ? 180 : facing === 3 ? 0 : facing === 4 ? 90 : facing === 5 ? -90 : 0;
        const c = new Node();
        if (facing === 2 && xPos) c.position.x = 1;
        if (facing === 5 && zPos) c.position.z = -1;
        c.rotation.y = rot * D2R;
        const d = new Node(); d.position.set(-0.5, -0.5, -0.5);
        d.add(model); c.add(d); b2.add(c); a.add(b2); obj.add(a);
        t.lidParts = [lid, knob];
        break;
      }
      case 'bed': {
        // In 1.13 the colour belongs to the bed block, not block-entity NBT.
        const color = getBlock(st).name.slice(0, -4);
        mat = entityMaterial('entity/bed/' + color + '.png', { alphaTest: 0.1 });
         obj.add(bedPiece(mat, props.part === 'head', ['south', 'west', 'north', 'east'].indexOf(props.facing)));
        break;
      }
      case 'shulker': {
        // TileEntityShulkerBoxRenderer + ModelShulker: base and lid, the lid rises and turns as it opens
        const id = getBlock(st).id;
        const color = getBlock(st).name.replace('_shulker_box', '').replace('light_gray', 'silver');
        mat = entityMaterial('entity/shulker/shulker_' + color + '.png', { alphaTest: 0.1 });
        const sb = shulkerBox(mat, ['down', 'up', 'north', 'south', 'west', 'east'].indexOf(props.facing));
        obj.add(sb.node);
        t.shulkerLid = sb.lid;
        break;
      }
      case 'sign': {
        mat = entityMaterial('entity/sign.png', { alphaTest: 0.1 });
        const { board, stick } = blockModel('sign', ['board', 'stick']); // ModelSign
         const standing = getBlock(st).name === 'sign';
        const f = 0.6666667;
        const outer = new Node();
        outer.position.set(0.5, 0.75 * f, 0.5);
         if (standing) outer.rotation.y = -(Number(props.rotation || 0) * 360 / 16) * D2R;
         else outer.rotation.y = -({ north: 180, south: 0, west: 90, east: -90 }[props.facing] || 0) * D2R;
        const inner = new Node();
        if (!standing) inner.position.set(0, -0.3125, -0.4375);
        const sc = new Node(); sc.scale.set(f, -f, -f);
        const model = new Node(); model.scale.set(1 / 16, 1 / 16, 1 / 16);
        model.add(board.build()); board.setMaterial(mat);
        if (standing) { model.add(stick.build()); stick.setMaterial(mat); }
        sc.add(model);
        // TileEntitySignRenderer: text in the rotated frame: translate(0, 0.5f, 0.07f), scale(f3, -f3, f3), f3 = 0.015625 * f
        const lines = t.lines || this.signs.get(key(t.x, t.y, t.z)) || ['', '', '', ''];
        if (lines.some((l) => l)) {
          const font = g.gui.font;
          const items = [];
          for (let j = 0; j < 4; j++) {
            const line = lines[j] || '';
            if (line) items.push({ text: line, x: -font.width(line) / 2, y: j * 10 - 20, color: 0x000000 });
          }
          t.textMeshes = buildTextMeshes(this.device, font, items);
          const tn = new Node();
          const f3 = 0.015625 * f;
          tn.position.set(0, 0.5 * f, 0.07 * f + 0.001);
          tn.scale.set(f3, -f3, f3);
          for (const m of t.textMeshes) tn.addDrawable(m.mesh, material('color', m.tex || g.gui.white, colorParams(1, 1, 1, 1, 0.05, 1), { blend: 'none' }));
          inner.add(tn);
        }
        inner.add(sc); outer.add(inner); obj.add(outer);
        break;
      }
      case 'skull': {
        const name = getBlock(st).name;
        const type = skullType(name) ?? 0;
        const tex = ['entity/skeleton/skeleton.png', 'entity/skeleton/wither_skeleton.png', 'entity/zombie/zombie.png', 'entity/steve.png', 'entity/creeper/creeper.png', 'entity/enderdragon/dragon.png'][type] || 'entity/skeleton/skeleton.png';
        mat = entityMaterial(type===3&&t.data?.SkullOwner?this.game.entityRenderer.skullTexture(t.data.SkullOwner):tex, { alphaTest: 0.1 });
        const model = skullModel(type, mat);
        const outer = new Node();
        if (!name.includes('_wall_')) {
          outer.position.set(0.5, 0, 0.5);
          outer.rotation.y = -(Number(props.rotation || 0) * 360 / 16) * D2R;
        } else {
          const pos = { north: [0.5, 0.25, 0.74, 180], south: [0.5, 0.25, 0.26, 0],
            west: [0.74, 0.25, 0.5, 270], east: [0.26, 0.25, 0.5, 90] }[props.facing] || [0.5, 0.25, 0.5, 0];
          outer.position.set(pos[0], pos[1], pos[2]);
          outer.rotation.y = -pos[3] * D2R;
        }
        outer.add(model);
        obj.add(outer);
        break;
      }
      case 'banner': {
        const tex = this._bannerTexture(t);
        if (!tex) { t.built = false; return; }
        mat = entityMaterial(tex, { alphaTest: 0.1 });
         const bannerName = getBlock(st).name;
         const wall = bannerName.endsWith('_wall_banner');
         const rotation = wall ? ({ north: 180, south: 0, west: 90, east: -90 }[props.facing] || 0) : Number(props.rotation || 0);
         const b = buildBanner(mat, wall, rotation);
        t.bannerSwing = b.swing;
        obj.add(b.node);
        break;
      }
      case 'book': {
        mat = entityMaterial('entity/enchanting_table_book.png', { alphaTest: 0.1, cull: true }); // enableCull: the zero-thickness pages show one side
        // ModelBook
        const parts = blockModel('book', ['coverRight', 'coverLeft', 'pagesRight', 'pagesLeft', 'flipRight', 'flipLeft', 'spine']);
        const model = new Node(); model.scale.set(1 / 16, 1 / 16, 1 / 16);
        for (const p of Object.values(parts)) { model.add(p.build()); p.setMaterial(mat); }
        t.bookParts = parts;
        const outer = new Node(); outer.position.set(0.5, 0.75, 0.5);
        const rotG = new Node();
        const tilt = new Node(); tilt.rotation.z = 80 * D2R;
        tilt.add(model); rotG.add(tilt); outer.add(rotG);
        t.bookOuter = outer; t.bookRot = rotG;
        obj.add(outer);
        break;
      }
      case 'beacon': {
        // TileEntityBeaconRenderer: rebuilt every frame from the client-side beam segments
        const tex = () => this.game.assets.texture('entity/beacon_beam.png', { wrap: 'repeat' });
        t.beamCore = this.device.createMesh(FORMAT.color, new Float32Array(0), { quads: true, dynamic: true });
        t.beamGlow = this.device.createMesh(FORMAT.color, new Float32Array(0), { quads: true, dynamic: true });
        t.ownMeshes.push(t.beamCore, t.beamGlow);
        const node = new Node();
        // core: no blending, alpha test 0.1, depth write; glow: alpha blend, no depth write. Neither uses fog.
        node.addDrawable(t.beamCore, material('color', tex, colorParams(1, 1, 1, 1, 0.1, 0), { blend: 'none', cull: false }), { order: 3 });
        node.addDrawable(t.beamGlow, material('color', tex, colorParams(1, 1, 1, 1, 0, 0), { blend: 'alpha', depthWrite: false, cull: false }), { order: 4 });
        t.beamNode = node;
        obj.add(node);
        break;
      }
      case 'endportal': {
        // TileEntityEndPortalRenderer: the top face at 0.75 (end portal) or every face not against an opaque block
        // (end gateway, offset 1); 16 layers, the first the end sky blended, the rest end_portal.png added
        const gateway = getBlock(t.state).name === 'end_gateway';
        const w = this.game.world, v = [];
        const quad = (pts) => { for (const [x, y, z] of pts) v.push(x, y, z, 0, 0, 1, 1, 1, 1); };
        const open = (dx, dy, dz) => {
          if (!gateway) return false;
          const b = getBlock(w.getState(t.x + dx, t.y + dy, t.z + dz));
          return !(b && b.opaque) && !(b && b.name === 'end_gateway');
        };
        const top = gateway ? 1 : 0.75;
        if (open(0, 0, 1)) quad([[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]);
        if (open(0, 0, -1)) quad([[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]]);
        if (open(1, 0, 0)) quad([[1, 1, 0], [1, 1, 1], [1, 0, 1], [1, 0, 0]]);
        if (open(-1, 0, 0)) quad([[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]);
        if (open(0, -1, 0)) quad([[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]);
        if (!gateway || open(0, 1, 0)) quad([[0, top, 1], [1, top, 1], [1, top, 0], [0, top, 0]]);
        if (!v.length) break;
        const mesh = this.device.createMesh(FORMAT.color, new Float32Array(v), { quads: true });
        t.ownMeshes.push(mesh);
        const A = this.game.assets;
        t.portalLayers = END_PORTAL_COLORS.map((c, i) => {
          const params = new Float32Array(16);
          params[0] = c[0]; params[1] = c[1]; params[2] = c[2]; params[3] = i;
          const n = i + 1;
          params[4] = 4.5 - n / 4; params[5] = (n * n * 4321 + n * 9) * 2 * D2R; params[6] = 17 / n;
          const tex = i === 0 ? () => A.texture('environment/end_sky.png') : () => A.texture('entity/end_portal.png');
          const m = material('endportal', tex, params, { blend: i === 0 ? 'alpha' : 'add', depthWrite: true });
          obj.addDrawable(mesh, m);
          return { params, n, d: obj.drawables[obj.drawables.length - 1], m };
        });
        t.gateway = gateway;
        break;
      }
      default: break;
    }
    if (mat) t.mat = mat;
    t.obj = obj;
    this.group.add(obj);
  }

  // Composite banner texture (base + tinted pattern masks), or null while the images load
  _bannerTexture(t) {
    const data = t.data || {};
    const img = composeBanner(this.game.assets, bannerLayers(data.Base !== undefined ? data.Base : 0, data.Patterns));
    if (!img) return null;
    t.texture = this.device.createTexture({ width: img.width, height: img.height, data: img.data });
    return t.texture;
  }

  // TileEntityPistonRenderer: moving blocks drawn at their offset (block model, terrain face shading, world light)
  _renderMoving(partial) {
    const g = this.game;
    const moving = g.pistons ? g.pistons.moving : new Map();
    this.movingObjs ||= new Map();
    for (const [k, o] of this.movingObjs) if (!moving.has(k) || moving.get(k) !== o.t) { this.group.remove(o.node); this.movingObjs.delete(k); }
    for (const [k, t] of moving) {
      let o = this.movingObjs.get(k);
      if (!o) {
        const mat = entityMaterial(() => g.assets.atlasTexture, { alphaTest: 0.1, noLighting: true });
        o = { t, node: new Node(), mat, key: null };
        this.group.add(o.node);
        this.movingObjs.set(k, o);
      }
      const f = Pistons.progress(t, partial);
       if (f >= 1 || t.state === 0) { o.node.visible = false; continue; }
      o.node.visible = true;
      // the parts: [state, props override, moves]
      const parts = [];
       const n = getBlock(t.state).name;
      if (n === 'piston_head' && f <= 0.25) parts.push([t.state, { short: true }, true]);
      else if (t.head && !t.extending) {
        // retracting base: the head slides in (short from half way), the base stays put, drawn extended
        const sticky = n === 'sticky_piston';
        parts.push([findState('piston_head',{facing:['down','up','north','south','west','east'][t.facing],type:sticky?'sticky':'normal',short:'false'}), { short: f >= 0.5 }, true]);
        parts.push([findState(n,{...getStateProperties(t.state),extended:'true'}),null,false]);
      } else parts.push([t.state, null, true]);
      const mk = parts.map((p) => p[0] + ':' + JSON.stringify(p[1])).join('|');
      if (o.key !== mk) {
        for (const c of [...o.node.children]) o.node.remove(c);
        for (const [st, props, moves] of parts) {
          const mesh = this._stateMesh(st, props);
          if (!mesh) continue;
          const c = new Node().addDrawable(mesh, o.mat);
          c.moves = moves;
          o.node.add(c);
        }
        o.key = mk;
      }
      const d = Pistons.offset(t, partial);
      for (const c of o.node.children) c.position.set(t.x + 0.5 + (c.moves ? d[0] : 0), t.y + 0.5 + (c.moves ? d[1] : 0), t.z + 0.5 + (c.moves ? d[2] : 0));
      const w = g.world;
      o.mat.params.setLight(w.getSkyLight(t.x, t.y, t.z), w.getBlockLight(t.x, t.y, t.z));
    }
  }

  // Block model mesh with the terrain's per-face shading baked in (cached per state and property override)
  _stateMesh(st, props) {
    this.stateMeshes ||= new Map();
    const k = st + ':' + JSON.stringify(props);
    if (this.stateMeshes.has(k)) return this.stateMeshes.get(k);
    const g = this.game;
    let mesh = null;
    const rs = resolveState(st, () => 0, 0, 0, 0);
    const bm = rs && g.assets.modelStore.bakeVariant(rs.file, props ? { ...rs.props, ...props } : rs.props, props ? null : rs.variant, 0);
    if (bm && bm.quads.length) {
      const SHADE = [0.5, 1, 0.8, 0.8, 0.6, 0.6], N = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
      const tint = g.itemRenderer._defaultTint(rs.file);
      const pos = [], uv = [], nor = [], col = [];
      for (const q of bm.quads) {
        const sh = q.shade === false ? 1 : SHADE[q.dir];
        const c = q.tint >= 0 ? [((tint >> 16) & 255) / 255, ((tint >> 8) & 255) / 255, (tint & 255) / 255] : [1, 1, 1];
        for (let i = 0; i < 4; i++) {
          pos.push(q.pos[i * 3] - 0.5, q.pos[i * 3 + 1] - 0.5, q.pos[i * 3 + 2] - 0.5);
          uv.push(q.uv[i * 2], q.uv[i * 2 + 1]);
          nor.push(...N[q.dir]);
          col.push(c[0] * sh, c[1] * sh, c[2] * sh);
        }
      }
      mesh = entityMesh(pos, uv, nor, col, { quads: true });
    }
    this.stateMeshes.set(k, mesh);
    return mesh;
  }

  render(partial) {
    const g = this.game;
    this._renderMoving(partial);
    const camPos = g.renderer.camPos;
    const maxD = (g.settings.renderDistance * 16) ** 2;
    for (const t of this.tiles.values()) {
      const dx = t.x - camPos[0], dz = t.z - camPos[2];
      if (dx * dx + dz * dz > Math.min(maxD, 64 * 64) && t.type !== 'beacon') { if (t.obj) t.obj.visible = false; continue; }
      // Block entity culling: frustum + occlusion (beacon beams reach the sky, so only frustum-test their column)
      const top = t.type === 'beacon' ? 256 : t.y + 1.5;
      const seen = t.type === 'beacon' ? aabbInFrustum(g.renderer.frustum, t.x, t.y, t.z, t.x + 1, top, t.z + 1) : g.renderer.boxVisible(t.x - 0.25, t.y, t.z - 0.25, t.x + 1.25, top, t.z + 1.25);
      if (!seen) { if (t.obj) t.obj.visible = false; continue; }
      if (!t.built) this._build(t);
      if (!t.obj) continue;
      t.obj.visible = true;
      if (t.mat) {
        // Use the brightest neighbour for opaque-ish tiles
        let sky = g.world.getSkyLight(t.x, t.y, t.z), blk = g.world.getBlockLight(t.x, t.y, t.z);
        for (const [ox, oy, oz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
          sky = Math.max(sky, g.world.getSkyLight(t.x + ox, t.y + oy, t.z + oz) - 1);
          blk = Math.max(blk, g.world.getBlockLight(t.x + ox, t.y + oy, t.z + oz) - 1);
        }
        t.mat.params.setLight(sky, blk);
      }
      if (t.type === 'chest' && t.lidParts) {
        let f = t.prevLid + (t.lid - t.prevLid) * partial;
        f = 1 - f; f = 1 - f * f * f;
        for (const p of t.lidParts) { p.rx = -(f * Math.PI / 2); p.sync(); }
      } else if (t.type === 'book' && t.bookParts) {
        const ticks = this.ticks + partial;
        t.bookOuter.position.y = 0.75 + 0.1 + Math.sin(ticks * 0.1) * 0.01;
        const rot = (t.prevRot || 0) + ((t.bookRotation || 0) - (t.prevRot || 0)) * partial;
        t.bookRot.rotation.y = -rot;
        const flip = (t.prevPageFlip || 0) + ((t.pageFlip || 0) - (t.prevPageFlip || 0)) * partial;
        let f3 = flip + 0.25 - Math.floor(flip + 0.25), f4 = flip + 0.75 - Math.floor(flip + 0.75);
        f3 = f3 * 1.6 - 0.3; f4 = f4 * 1.6 - 0.3;
        f3 = Math.min(1, Math.max(0, f3)); f4 = Math.min(1, Math.max(0, f4));
        const spread = (t.prevBookSpread || 0) + ((t.bookSpread || 0) - (t.prevBookSpread || 0)) * partial;
        const P = t.bookParts;
        const f = (Math.sin(ticks * 0.02) * 0.1 + 1.25) * spread;
        P.coverRight.ry = Math.PI + f; P.coverLeft.ry = -f; P.pagesRight.ry = f; P.pagesLeft.ry = -f;
        P.flipRight.ry = f - f * 2 * f3; P.flipLeft.ry = f - f * 2 * f4;
        P.pagesRight.px = Math.sin(f); P.pagesLeft.px = Math.sin(f); P.flipRight.px = Math.sin(f); P.flipLeft.px = Math.sin(f);
        for (const p of Object.values(P)) p.sync();
      } else if (t.type === 'shulker' && t.shulkerLid) {
        // TileEntityShulkerBox.getProgress: lid lifts by half a block and turns 270 degrees
        const f = t.prevLid + (t.lid - t.prevLid) * partial;
        t.shulkerLid.position.set(0, -f * 0.5 * 16, 0);
        t.shulkerLid.rotation.set(0, 270 * f * D2R, 0);
      } else if (t.type === 'banner' && t.bannerSwing) {
        const time = this.ticks + partial + t.x * 7 + t.y * 9 + t.z * 13;
        t.bannerSwing.rotation.x = bannerSwing(time);
      } else if (t.type === 'beacon' && t.beamNode) {
        this._buildBeam(t, partial);
      } else if (t.type === 'endportal' && t.portalLayers) {
        // getPasses: fewer layers with distance (squared, from the block corner); gateways one more
        const cam = this.r.camPos || [0, 0, 0];
        const dx = t.x - cam[0], dy = t.y - cam[1], dz = t.z - cam[2], d = dx * dx + dy * dy + dz * dz;
        let passes = d > 36864 ? 1 : d > 25600 ? 3 : d > 16384 ? 5 : d > 9216 ? 7 : d > 4096 ? 9 : d > 1024 ? 11 : d > 576 ? 13 : d > 256 ? 14 : 15;
        if (t.gateway) passes++;
        const time = (performance.now() % 800000) / 800000; // Minecraft.getSystemTime() % 800000 / 800000
        for (const [i, L] of t.portalLayers.entries()) {
          L.d.visible = i < passes;
          L.params[7] = (2 + L.n / 1.5) * time;
          L.params[8] = this.device.width; L.params[9] = this.device.height;
        }
      }
    }
  }
}

// TileEntityBedRenderer.renderPiece + ModelBed (1.12): head or foot, facing 0 south, 1 west, 2 north, 3 east
export function bedPiece(mat, head, facing) {
  // ModelBed.preparePiece: the head shows legs 1 and 3, the foot legs 0 and 2
  const b = blockModel('bed', ['head', 'foot', 'legs']);
  const parts = head ? [b.head, b.legs[1], b.legs[3]] : [b.foot, b.legs[0], b.legs[2]];
  const model = new Node();
  for (const p of parts) { p.visible = true; model.add(p.build()); p.setMaterial(mat); }
  model.scale.set(1 / 16, 1 / 16, 1 / 16);
  // translate(f1, 0.5625, f2), rotate(90, X), rotate(f, Z)
  const [f, f1, f2] = [[180, 1, 1], [-90, 0, 1], [0, 0, 0], [90, 1, 0]][facing & 3];
  const a = new Node();
  a.position.set(f1, 0.5625, f2);
  a.rotation.set(Math.PI / 2, 0, f * D2R, 'XYZ');
  a.add(model);
  return a;
}

// TileEntityShulkerBoxRenderer + ModelShulker: base and lid in block space; facing 0 down, 1 up, 2 north ... 5 east.
// Returns { node, lid } (the lid node rises and turns as the box opens)
export function shulkerBox(mat, facingIndex) {
  const { base, lid } = blockModel('shulker', ['base', 'lid']);
  const baseN = new Node(); baseN.add(base.build()); base.setMaterial(mat);
  const lidN = new Node(); lidN.add(lid.build()); lid.setMaterial(mat);
  const s16 = new Node(); s16.scale.set(1 / 16, 1 / 16, 1 / 16); s16.add(baseN); s16.add(lidN);
  // translate(0.5, 1.5, 0.5), scale(1, -1, -1), translate(0, 1, 0), scale 0.9995, translate(0, -1, 0), then the facing
  const a = new Node(); a.position.set(0.5, 1.5, 0.5); a.scale.set(1, -1, -1);
  const b2 = new Node(); b2.position.set(0, 1, 0); b2.scale.setScalar(0.9995);
  const c = new Node(); c.position.set(0, -1, 0);
  const facing = ['down', 'up', 'north', 'south', 'west', 'east'][facingIndex];
  const d = new Node();
  if (facing === 'down') { d.position.set(0, 2, 0); d.rotation.set(Math.PI, 0, 0, 'XYZ'); }
  else if (facing === 'north') { d.position.set(0, 1, 1); d.rotation.set(Math.PI / 2, 0, Math.PI, 'XYZ'); }
  else if (facing === 'south') { d.position.set(0, 1, -1); d.rotation.set(Math.PI / 2, 0, 0, 'XYZ'); }
  else if (facing === 'west') { d.position.set(-1, 1, 0); d.rotation.set(Math.PI / 2, 0, -Math.PI / 2, 'XYZ'); }
  else if (facing === 'east') { d.position.set(1, 1, 0); d.rotation.set(Math.PI / 2, 0, Math.PI / 2, 'XYZ'); }
  d.add(s16); c.add(d); b2.add(c); a.add(b2);
  return { node: a, lid: lidN };
}

// TileEntitySkullRenderer's models by skull type: ModelSkeletonHead (skeleton, wither, creeper), ModelHumanoidHead with
// its overlay (zombie, player) and ModelDragonHead (jaw slightly open, translate(0, -0.374375, 0), scale 0.75).
// Returns a node in skull space (scale(-1, -1, 1), 1/16 units)
export function skullModel(type, mat) {
  const model = new Node();
  model.scale.set(-1 / 16, -1 / 16, 1 / 16);
  let parts;
  if (type === 5) {
    const d = blockModel('dragonHead', ['head', 'jaw']);
    d.jaw.rx = 0.2;
    const g = new Node(); g.position.set(0, -0.374375 * 16, 0); g.scale.setScalar(0.75);
    g.add(d.head.build()); d.head.setMaterial(mat);
    model.add(g);
    return model;
  }
  if (type === 2 || type === 3) { const h = blockModel('humanoidHead', ['head', 'overlay']); parts = [h.head, h.overlay]; }
  else parts = [blockModel('skull', ['head']).head];
  for (const p of parts) { model.add(p.build()); p.setMaterial(mat); }
  return model;
}

// EnumDyeColor names by metadata (1.12 texture file names)
export const DYE_NAMES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'silver', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];

// EntitySheep.DYE_TO_RGB (stained glass beam colours), by dye metadata
const DYE_RGB = [[1, 1, 1], [0.85, 0.5, 0.2], [0.7, 0.3, 0.85], [0.4, 0.6, 0.85], [0.9, 0.9, 0.2], [0.5, 0.8, 0.1], [0.95, 0.5, 0.65], [0.3, 0.3, 0.3],
  [0.6, 0.6, 0.6], [0.3, 0.5, 0.6], [0.5, 0.25, 0.7], [0.2, 0.3, 0.7], [0.4, 0.3, 0.2], [0.4, 0.5, 0.2], [0.6, 0.2, 0.2], [0.1, 0.1, 0.1]].map((c) => c.map(Math.fround));
