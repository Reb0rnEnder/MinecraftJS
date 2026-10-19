// Pistons on the client: the block event runs BlockPistonBase.eventReceived like vanilla's client does, turning
// the moved blocks into piston_extension blocks that carry a TileEntityPiston (state, direction, extending, head).
// Those slide over two ticks (progress += 0.5 per tick, interpolated when drawn) and then become their block again;
// the server's block changes agree with the result. Drawing is in TileEntityRenderer (TileEntityPistonRenderer).
import { blocks, blocksByName } from '../world/blocks.js';

// EnumFacing index order: down, up, north, south, west, east
export const FACING = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const OPPOSITE = [1, 0, 3, 2, 5, 4];
const AXIS = [1, 1, 2, 2, 0, 0];

// IBlockState.getMobilityFlag (Material flags plus block overrides)
const DESTROY = new Set([
  'water', 'flowing_water', 'lava', 'flowing_lava', 'leaves', 'leaves2', 'sapling', 'tallgrass', 'deadbush', 'yellow_flower',
  'red_flower', 'brown_mushroom', 'red_mushroom', 'wheat', 'reeds', 'pumpkin_stem', 'melon_stem', 'waterlily', 'nether_wart',
  'cocoa', 'carrots', 'potatoes', 'beetroots', 'vine', 'double_plant', 'chorus_plant', 'chorus_flower', 'torch', 'redstone_wire',
  'lever', 'unlit_redstone_torch', 'redstone_torch', 'stone_button', 'wooden_button', 'unpowered_repeater', 'powered_repeater',
  'unpowered_comparator', 'powered_comparator', 'tripwire_hook', 'tripwire', 'golden_rail', 'detector_rail', 'rail',
  'activator_rail', 'flower_pot', 'skull', 'ladder', 'end_rod', 'stone_pressure_plate', 'wooden_pressure_plate',
  'light_weighted_pressure_plate', 'heavy_weighted_pressure_plate', 'wooden_door', 'iron_door', 'spruce_door', 'birch_door',
  'jungle_door', 'acacia_door', 'dark_oak_door', 'bed', 'snow_layer', 'cactus', 'pumpkin', 'lit_pumpkin', 'melon_block',
  'dragon_egg', 'cake', 'web', 'fire', 'structure_void',
]);
const BLOCK = new Set(['obsidian', 'barrier', 'portal', 'piston_head', 'piston_extension', 'end_portal', 'end_gateway']);
// Block.hasTileEntity
const TILE = new Set([
  'chest', 'trapped_chest', 'furnace', 'lit_furnace', 'dispenser', 'dropper', 'hopper', 'beacon', 'brewing_stand',
  'enchanting_table', 'ender_chest', 'standing_sign', 'wall_sign', 'mob_spawner', 'noteblock', 'jukebox', 'standing_banner',
  'wall_banner', 'skull', 'flower_pot', 'unpowered_comparator', 'powered_comparator', 'daylight_detector',
  'daylight_detector_inverted', 'command_block', 'repeating_command_block', 'chain_command_block', 'structure_block',
  'end_gateway', 'end_portal', 'bed', 'piston_extension',
]);

const name = (st) => (blocks[st >> 4] ? blocks[st >> 4].name : 'air');
const isAir = (st) => (st >> 4) === 0;
const mobility = (n) => (n.endsWith('_shulker_box') || DESTROY.has(n) ? 'destroy' : BLOCK.has(n) ? 'block' : n.endsWith('_glazed_terracotta') ? 'push_only' : 'normal');
const isPiston = (n) => n === 'piston' || n === 'sticky_piston';
const key = (x, y, z) => x + ',' + y + ',' + z;
const off = (p, f, n = 1) => [p[0] + FACING[f][0] * n, p[1] + FACING[f][1] * n, p[2] + FACING[f][2] * n];

// BlockPistonBase.canPush
function canPush(world, st, p, facing, destroyBlocks, f2) {
  const n = name(st), b = blocks[st >> 4];
  if (n === 'obsidian') return false;
  if (Math.abs(p[0]) >= 29999984 || Math.abs(p[2]) >= 29999984) return false; // world border
  if (p[1] < 0 || (facing === 0 && p[1] === 0)) return false;
  if (p[1] > 255 || (facing === 1 && p[1] === 255)) return false;
  if (!isPiston(n)) {
    if (!b || b.hardness === null || b.hardness < 0) return false;
    switch (mobility(n)) {
      case 'block': return false;
      case 'destroy': return destroyBlocks;
      case 'push_only': if (facing !== f2) return false; break;
      default: break;
    }
  } else if (st & 8) return false; // extended
  return !(TILE.has(n) || n.endsWith('_shulker_box'));
}

// BlockPistonStructureHelper
class Structure {
  constructor(world, pos, facing, extending) {
    this.world = world; this.pistonPos = pos; this.facing = facing;
    this.moveDirection = extending ? facing : OPPOSITE[facing];
    this.blockToMove = off(pos, facing, extending ? 1 : 2);
    this.toMove = []; this.toDestroy = [];
  }
  st(p) { return this.world.getState(p[0], p[1], p[2]); }
  has(p) { return this.toMove.some((q) => q[0] === p[0] && q[1] === p[1] && q[2] === p[2]); }
  indexOf(p) { return this.toMove.findIndex((q) => q[0] === p[0] && q[1] === p[1] && q[2] === p[2]); }
  isPistonPos(p) { return p[0] === this.pistonPos[0] && p[1] === this.pistonPos[1] && p[2] === this.pistonPos[2]; }
  canMove() {
    this.toMove = []; this.toDestroy = [];
    const st = this.st(this.blockToMove);
    if (!canPush(this.world, st, this.blockToMove, this.moveDirection, false, this.facing)) {
      if (mobility(name(st)) === 'destroy') { this.toDestroy.push(this.blockToMove); return true; }
      return false;
    }
    if (!this.addBlockLine(this.blockToMove, this.moveDirection)) return false;
    for (let i = 0; i < this.toMove.length; i++) {
      if (name(this.st(this.toMove[i])) === 'slime' && !this.addBranchingBlocks(this.toMove[i])) return false;
    }
    return true;
  }
  addBlockLine(origin, dir) {
    let st = this.st(origin);
    if (isAir(st)) return true;
    if (!canPush(this.world, st, origin, this.moveDirection, false, dir)) return true;
    if (this.isPistonPos(origin) || this.has(origin)) return true;
    let i = 1;
    if (i + this.toMove.length > 12) return false;
    const back = OPPOSITE[this.moveDirection];
    while (name(st) === 'slime') {
      const p = off(origin, back, i);
      st = this.st(p);
      if (isAir(st) || !canPush(this.world, st, p, this.moveDirection, false, back) || this.isPistonPos(p)) break;
      i++;
      if (i + this.toMove.length > 12) return false;
    }
    let i1 = 0;
    for (let j = i - 1; j >= 0; j--) { this.toMove.push(off(origin, back, j)); i1++; }
    for (let j1 = 1; ; j1++) {
      const p1 = off(origin, this.moveDirection, j1);
      const k = this.indexOf(p1);
      if (k > -1) {
        this.reorder(i1, k);
        for (let l = 0; l <= k + i1; l++) {
          const p2 = this.toMove[l];
          if (name(this.st(p2)) === 'slime' && !this.addBranchingBlocks(p2)) return false;
        }
        return true;
      }
      st = this.st(p1);
      if (isAir(st)) return true;
      if (!canPush(this.world, st, p1, this.moveDirection, true, this.moveDirection) || this.isPistonPos(p1)) return false;
      if (mobility(name(st)) === 'destroy') { this.toDestroy.push(p1); return true; }
      if (this.toMove.length >= 12) return false;
      this.toMove.push(p1);
      i1++;
    }
  }
  reorder(a, b) {
    const m = this.toMove;
    this.toMove = [...m.slice(0, b), ...m.slice(m.length - a), ...m.slice(b, m.length - a)];
  }
  addBranchingBlocks(p) {
    for (let f = 0; f < 6; f++) if (AXIS[f] !== AXIS[this.moveDirection] && !this.addBlockLine(off(p, f), f)) return false;
    return true;
  }
}

export class Pistons {
  constructor(game) {
    this.game = game;
    this.moving = new Map(); // "x,y,z" -> TileEntityPiston { x, y, z, state, facing, extending, head, progress, lastProgress }
  }
  clear() { this.moving.clear(); }

  _set(p, st) { this.game.world.setState(p[0], p[1], p[2], st); }
  _tile(p, state, facing, extending, head) {
    // the world state is piston_extension now; register after it so the block change does not drop the tile
    this.moving.set(key(...p), { x: p[0], y: p[1], z: p[2], state, facing, extending, head, progress: 0, lastProgress: 0 });
  }

  // BlockPistonBase.eventReceived on the client: id 0 extend, 1 retract; param is the facing
  onBlockEvent(pos, id, param, blockId) {
    const w = this.game.world;
    const p = [pos.x, pos.y, pos.z];
    const sticky = blocks[blockId] && blocks[blockId].name === 'sticky_piston';
    const facing = param & 7;
    if (facing > 5) return;
    const extId = blocksByName.piston_extension.id;
    if (id === 0) {
      if (!this._doMove(p, facing, true, sticky)) return;
      this._set(p, (blockId << 4) | facing | 8);
    } else if (id === 1) {
      const front = off(p, facing);
      const t = this.moving.get(key(...front));
      if (t) this._clearTile(t);
      this._set(p, (extId << 4) | facing | (sticky ? 8 : 0));
      this._tile(p, (blockId << 4) | facing, facing, false, true);
      if (sticky) {
        const p2 = off(p, facing, 2);
        const st = w.getState(...p2);
        let pulled = false;
        if ((st >> 4) === extId) {
          const t2 = this.moving.get(key(...p2));
          if (t2 && t2.facing === facing && t2.extending) { this._clearTile(t2); pulled = true; }
        }
        if (!pulled && !isAir(st) && canPush(w, st, p2, OPPOSITE[facing], false, facing) && (mobility(name(st)) === 'normal' || isPiston(name(st)))) {
          this._doMove(p, facing, false, sticky);
        }
      } else this._set(front, 0);
    }
  }

  // BlockPistonBase.doMove
  _doMove(p, dir, extending, sticky) {
    const w = this.game.world;
    if (!extending) this._set(off(p, dir), 0);
    const helper = new Structure(w, p, dir, extending);
    if (!helper.canMove()) return false;
    const list = helper.toMove, states = list.map((q) => w.getState(...q));
    const moveDir = extending ? dir : OPPOSITE[dir];
    const extId = blocksByName.piston_extension.id;
    w.beginBatch();
    try {
      for (let j = helper.toDestroy.length - 1; j >= 0; j--) this._set(helper.toDestroy[j], 0);
      for (let l = list.length - 1; l >= 0; l--) {
        this._set(list[l], 0);
        const dst = off(list[l], moveDir);
        this._set(dst, (extId << 4) | dir);
        this._tile(dst, states[l], dir, extending, false);
      }
      if (extending) {
        const front = off(p, dir);
        this._set(front, (extId << 4) | dir | (sticky ? 8 : 0));
        this._tile(front, (blocksByName.piston_head.id << 4) | dir | (sticky ? 8 : 0), dir, true, true);
      }
    } finally { w.endBatch(); }
    return true;
  }

  // TileEntityPiston.clearPistonTileEntity
  _clearTile(t) {
    this.moving.delete(key(t.x, t.y, t.z));
    const w = this.game.world;
    if ((w.getState(t.x, t.y, t.z) >> 4) === blocksByName.piston_extension.id) w.setState(t.x, t.y, t.z, t.state);
  }

  // TileEntityPiston.update
  tick() {
    for (const t of [...this.moving.values()]) {
      t.lastProgress = t.progress;
      if (t.lastProgress >= 1) this._clearTile(t);
      else t.progress = Math.min(1, t.progress + 0.5);
    }
  }

  // A block change replaced a moving block with something else: its tile entity is gone. Checks the world's state
  // rather than the event's, since batched changes report a position's air and then its new piston_extension.
  onBlockChanged(x, y, z) {
    const t = this.moving.get(key(x, y, z));
    if (t && (this.game.world.getState(x, y, z) >> 4) !== blocksByName.piston_extension.id) this.moving.delete(key(x, y, z));
  }

  // TileEntityPiston.getProgress / getOffsetX..Z
  static progress(t, partial) { return Math.min(1, t.lastProgress + (t.progress - t.lastProgress) * Math.min(1, partial)); }
  static offset(t, partial) {
    const f = Pistons.progress(t, partial);
    const e = t.extending ? f - 1 : 1 - f;
    const d = FACING[t.facing];
    return [d[0] * e, d[1] * e, d[2] * e];
  }
}
