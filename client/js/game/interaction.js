// Player interaction (port of PlayerControllerMP + Minecraft.clickMouse/rightClickMouse).
import { C } from '../net/packets.js';
import { blocks } from '../world/blocks.js';
import { rayBox } from '../world/world.js';
import { copy } from './container.js';

const INTERACTIVE = new Set(['chest', 'trapped_chest', 'ender_chest', 'crafting_table', 'furnace', 'lit_furnace', 'dispenser', 'dropper',
  'hopper', 'brewing_stand', 'enchanting_table', 'anvil', 'beacon', 'wooden_door', 'spruce_door', 'birch_door', 'jungle_door',
  'acacia_door', 'dark_oak_door', 'trapdoor', 'fence_gate', 'spruce_fence_gate', 'birch_fence_gate', 'jungle_fence_gate',
  'dark_oak_fence_gate', 'acacia_fence_gate', 'lever', 'stone_button', 'wooden_button', 'bed', 'noteblock', 'jukebox',
  'unpowered_repeater', 'powered_repeater', 'unpowered_comparator', 'powered_comparator', 'cake', 'cauldron', 'flower_pot',
  'daylight_detector', 'daylight_detector_inverted', 'command_block', 'dragon_egg', 'standing_sign', 'wall_sign']);

// Items whose onItemUse places/acts on the clicked block (returns true in vanilla)
const PLACE_ITEMS = new Set([259, 295, 323, 324, 328, 330, 331, 338, 342, 343, 354, 355, 356, 361, 362, 372, 379, 380, 381, 383, 389, 390, 391, 392, 397, 401, 404, 407, 408, 416, 422, 425, 427, 428, 429, 430, 431, 287, 321]);

export class Interaction {
  constructor(game) {
    this.game = game;
    this.isHitting = false;
    this.curBlock = null;
    this.curDamage = 0;
    this.prevDamage = 0;
    this.stepSoundCounter = 0;
    this.blockHitDelay = 0;
    this.rightClickDelay = 0;
    this.leftClickCounter = 0;
    this.useTicks = 0;
    this.target = null; // { type: 'block', ... } | { type: 'entity', entity, hit }
    this.remoteBreaks = new Map();
    this.swingProgress = 0;
    this.prevSwingProgress = 0;
    this.swingTicks = -1;
    this.swinging = false;
    this.equipProgress = 0;
    this.prevEquipProgress = 0;
    this.lastHeld = null;
  }

  get player() { return this.game.player; }

  reach() { return this.game.gameMode === 1 ? 5 : 4.5; }

  // Minecraft.getMouseOver
  updateTarget(partial = 1) {
    const g = this.game;
    const eye = g.eyePosition(partial);
    const look = g.lookVector(partial);
    const reach = this.reach();
    let hit = g.world.raycast(eye[0], eye[1], eye[2], look[0], look[1], look[2], reach);
    let blockDist = hit ? hit.dist : reach;
    let entityReach = g.gameMode === 1 ? 6 : reach;
    if (g.gameMode !== 1 && blockDist > 3) blockDist = blockDist;
    // Entities
    let best = null;
    let bestDist = hit ? hit.dist : entityReach;
    for (const e of g.entities.pickable()) {
      if (!e.pickable || e.id === g.entityId || e.id === g.ridingEntityId) continue;
      const border = 0.1;
      let r;
      if (e.box) { // hanging entities: exact box from EntityHanging.updateBoundingBox
        const b = e.box;
        r = rayBox(eye[0], eye[1], eye[2], look[0], look[1], look[2], b[0] - border, b[1] - border, b[2] - border, b[3] + border, b[4] + border, b[5] + border);
      } else {
        const p = g.entities.interp(e, partial);
        const w = e.width / 2 + border;
        r = rayBox(eye[0], eye[1], eye[2], look[0], look[1], look[2], p.x - w, p.y - border, p.z - w, p.x + w, p.y + e.height + border, p.z + w);
      }
      if (r && r.t < bestDist) { bestDist = r.t; best = { e, r }; }
    }
    if (best && (g.gameMode === 1 || best.r.t <= 3)) {
      this.target = { type: 'entity', entity: best.e, hit: [eye[0] + look[0] * best.r.t, eye[1] + look[1] * best.r.t, eye[2] + look[2] * best.r.t] };
    } else if (hit) {
      this.target = { type: 'block', ...hit };
    } else this.target = null;
    return this.target;
  }

  onSlotChanged() {
    if (this.isHitting) this.resetBreaking();
    this.player.usingItem = false;
  }

  swing() {
    this.game.send(C.armAnimation());
    if (!this.swinging || this.swingTicks >= 3 || this.swingTicks < 0) {
      this.swingTicks = -1;
      this.swinging = true;
    }
  }

  // ---------------------------------------------------------------- per tick

  tick(presses) {
    const g = this.game;
    const input = g.input;
    this.updateSwing();
    this.updateEquip();
    if (this.rightClickDelay > 0) this.rightClickDelay--;
    this.updateTarget();
    const k = g.settings.keys;
    const attackDown = input.isDown('attack');
    const useDown = input.isDown('use');

    if (this.player.usingItem) {
      this.useTicks++;
      if (!useDown) this.stopUsingItem();
      const held = g.inventory.held();
      const dur = g.items.useDuration(held);
      if (held && dur > 0 && dur < 72000 && this.useTicks >= dur) {
        // Server finishes eating; stop locally
        this.player.usingItem = false;
        this.useTicks = 0;
      }
      if (held && (g.items.useAction(held) === 'eat' || g.items.useAction(held) === 'drink') && this.useTicks > 4 && this.useTicks % 4 === 0) {
        if (g.items.useAction(held) === 'eat') g.sound.playAtPlayer('random.eat', 0.5 + 0.5 * Math.round(Math.random()), (Math.random() - Math.random()) * 0.2 + 1);
        else g.sound.playAtPlayer('random.drink', 0.5, Math.random() * 0.1 + 0.9);
        g.particles.itemCrack(held, this.player, 5);
      }
    } else {
      for (const code of presses) {
        if (code === k.attack) this.clickMouse();
        if (code === k.use) this.rightClickMouse();
        if (code === k.pickItem) this.middleClick();
      }
      if (useDown && this.rightClickDelay === 0 && !this.player.usingItem) this.rightClickMouse();
    }
    this.sendClickBlockToController(attackDown && !this.player.usingItem);
    this.lastHeld = g.inventory.held();
  }

  tickIdle() {
    this.updateSwing();
    this.updateEquip();
    if (this.isHitting) this.resetBreaking();
    if (this.player.usingItem && !this.game.screens.current?.allowsMovement) this.stopUsingItem();
  }

  updateSwing() {
    this.prevSwingProgress = this.swingProgress;
    let haste = this.game.effects.get(3), fatigue = this.game.effects.get(4);
    const len = haste ? 6 - (1 + haste.amplifier) : fatigue ? 6 + (1 + fatigue.amplifier) * 2 : 6;
    if (this.swinging) {
      this.swingTicks++;
      if (this.swingTicks >= len) { this.swingTicks = 0; this.swinging = false; }
    } else this.swingTicks = 0;
    this.swingProgress = this.swingTicks / len;
    this.swingLength = len;
  }

  updateEquip() {
    // ItemRenderer.updateEquippedItem
    this.prevEquipProgress = this.equipProgress;
    const held = this.game.inventory.held();
    const same = (a, b) => (!a && !b) || (a && b && a.id === b.id && a.damage === b.damage);
    const flag = same(this._equipped, held);
    if (!this._equipped && !held) { /* nothing */ }
    const f1 = 0.4;
    const f2 = flag ? 1 : 0;
    let f3 = f2 - this.equipProgress;
    if (f3 < -f1) f3 = -f1;
    if (f3 > f1) f3 = f1;
    this.equipProgress += f3;
    if (this.equipProgress < 0.1) this._equipped = held ? copy(held) : null;
    if (flag && held) this._equipped = held;
  }

  // Minecraft.clickMouse
  clickMouse() {
    const g = this.game;
    if (this.leftClickCounter > 0) return;
    this.swing();
    const t = this.target;
    if (!t) {
      if (g.gameMode !== 1) this.leftClickCounter = 10;
      return;
    }
    if (t.type === 'entity') {
      this.attackEntity(t.entity);
    } else if (t.type === 'block') {
      const b = blocks[t.state >> 4];
      if (b && b.id !== 0) this.clickBlock(t, t.face);
    }
  }

  attackEntity(e) {
    const g = this.game;
    if (g.gameMode === 3) { g.send(C.spectate(e.uuid)); return; }
    g.send(C.useEntity(e.id, 1));
    if (this.player.sprinting && g.gameMode !== 3) {
      this.player.motionX *= 0.6;
      this.player.motionZ *= 0.6;
      this.player.sprinting = false;
    }
    // Crit particles when falling
    if (this.player.fallDistance > 0 && !this.player.onGround && !this.player.inWater) g.particles.crit(e);
    if (g.items.enchantLevel(g.inventory.held(), 16) > 0) g.particles.magicCrit(e);
  }

  // PlayerControllerMP.clickBlock
  clickBlock(t, face) {
    const g = this.game;
    const pos = { x: t.x, y: t.y, z: t.z };
    if (g.gameMode === 2 || g.gameMode === 3) {
      // Adventure: only with tools able to "destroy" (CanDestroy not supported); spectator nothing
      if (g.gameMode === 3) return;
    }
    if (g.gameMode === 1) {
      g.send(C.blockDig(0, pos.x, pos.y, pos.z, face));
      this.destroyBlockClient(pos);
      this.blockHitDelay = 5;
      return;
    }
    if (!this.isHitting || !this._isHittingPos(pos)) {
      if (this.isHitting) g.send(C.blockDig(1, this.curBlock.x, this.curBlock.y, this.curBlock.z, face));
      g.send(C.blockDig(0, pos.x, pos.y, pos.z, face));
      const state = g.world.getState(pos.x, pos.y, pos.z);
      const b = blocks[state >> 4];
      const notAir = b && b.id !== 0;
      if (notAir && this.relativeHardness(b) >= 1) {
        this.destroyBlockClient(pos);
      } else {
        this.isHitting = true;
        this.curBlock = pos;
        this.curFace = face;
        this.curDamage = 0;
        this.prevDamage = 0;
        this.stepSoundCounter = 0;
        this._hitItem = g.inventory.held();
      }
    }
  }

  _isHittingPos(pos) {
    const c = this.curBlock;
    const held = this.game.inventory.held();
    const sameItem = (!held && !this._hitItem) || (held && this._hitItem && held.id === this._hitItem.id && held.damage === this._hitItem.damage);
    return c && c.x === pos.x && c.y === pos.y && c.z === pos.z && sameItem;
  }

  // Block.getPlayerRelativeBlockHardness
  relativeHardness(b) {
    const g = this.game;
    const hardness = b.hardness;
    if (hardness < 0) return 0;
    if (hardness === 0) return 1;
    const held = g.inventory.held();
    let f = g.items.strVsBlock(held, b);
    if (f > 1) {
      const eff = g.items.enchantLevel(held, 32);
      if (eff > 0 && held) f += eff * eff + 1;
    }
    const haste = g.effects.get(3);
    if (haste) f *= 1 + (haste.amplifier + 1) * 0.2;
    const fatigue = g.effects.get(4);
    if (fatigue) f *= [0.3, 0.09, 0.0027][fatigue.amplifier] ?? 8.1e-4;
    const eyeBlock = blocks[g.world.getState(Math.floor(this.player.x), Math.floor(this.player.y + 1.62), Math.floor(this.player.z)) >> 4];
    if (eyeBlock && eyeBlock.isWater) {
      const helmet = g.inventory.armor[3];
      if (!(helmet && g.items.enchantLevel(helmet, 6) > 0)) f /= 5;
    }
    if (!this.player.onGround) f /= 5;
    const canHarvest = g.items.canHarvest(held, b);
    return canHarvest ? f / hardness / 30 : f / hardness / 100;
  }

  sendClickBlockToController(leftDown) {
    const g = this.game;
    if (!leftDown) this.leftClickCounter = 0;
    else if (this.leftClickCounter > 0) this.leftClickCounter--;
    if (this.leftClickCounter <= 0 && leftDown && this.target && this.target.type === 'block') {
      const t = this.target;
      const b = blocks[t.state >> 4];
      if (b && b.id !== 0 && this.onPlayerDamageBlock(t, t.face)) {
        g.particles.blockHit(t.x, t.y, t.z, t.face);
        this.swing();
      }
    } else if (this.isHitting) {
      this.resetBreaking();
    }
  }

  onPlayerDamageBlock(t, face) {
    const g = this.game;
    const pos = { x: t.x, y: t.y, z: t.z };
    if (this.blockHitDelay > 0) { this.blockHitDelay--; return true; }
    if (g.gameMode === 1) {
      this.blockHitDelay = 5;
      g.send(C.blockDig(0, pos.x, pos.y, pos.z, face));
      this.destroyBlockClient(pos);
      return true;
    }
    if (g.gameMode === 3) return false;
    if (this._isHittingPos(pos)) {
      const state = g.world.getState(pos.x, pos.y, pos.z);
      const b = blocks[state >> 4];
      if (!b || b.id === 0) { this.isHitting = false; return false; }
      this.prevDamage = this.curDamage;
      this.curDamage += this.relativeHardness(b);
      if (this.stepSoundCounter % 4 === 0) g.sound.playBlockHit(pos.x, pos.y, pos.z, state);
      this.stepSoundCounter++;
      if (this.curDamage >= 1) {
        this.isHitting = false;
        g.send(C.blockDig(2, pos.x, pos.y, pos.z, face));
        this.destroyBlockClient(pos);
        this.curDamage = 0;
        this.prevDamage = 0;
        this.stepSoundCounter = 0;
        this.blockHitDelay = 5;
      }
      return true;
    }
    this.clickBlock(t, face);
    return true;
  }

  resetBreaking() {
    if (this.isHitting && this.curBlock) {
      this.game.send(C.blockDig(1, this.curBlock.x, this.curBlock.y, this.curBlock.z, this.curFace || 0));
    }
    this.isHitting = false;
    this.curDamage = 0;
    this.prevDamage = 0;
  }

  // PlayerControllerMP.onPlayerDestroyBlock
  destroyBlockClient(pos) {
    const g = this.game;
    const held = g.inventory.held();
    if (g.gameMode === 1 && held && [267, 268, 272, 276, 283].includes(held.id)) return false;
    const state = g.world.getState(pos.x, pos.y, pos.z);
    const b = blocks[state >> 4];
    if (!b || b.id === 0) return false;
    g.particles.blockBreak(pos.x, pos.y, pos.z, state);
    g.sound.playBlockBreak(pos.x, pos.y, pos.z, state);
    g.world.setState(pos.x, pos.y, pos.z, 0);
    // Doors/double plants/beds: the other half goes too (server will confirm)
    if (b.isDoor) {
      const other = (state & 15) & 8 ? pos.y - 1 : pos.y + 1;
      if ((g.world.getState(pos.x, other, pos.z) >> 4) === b.id) g.world.setState(pos.x, other, pos.z, 0);
    }
    if (g.gameMode !== 1 && held && g.items.isDamageable(held)) {
      held.damage++;
      if (held.damage > g.items.maxDurability(held.id)) {
        g.inventory.setHeld(null);
        g.sound.playAtPlayer('random.break', 0.8, 0.8 + Math.random() * 0.4);
      }
    }
    this.curBlock = null;
    return true;
  }

  onBlockChange(pos, state) { /* reserved for prediction rollback */ }

  // Minecraft.rightClickMouse
  rightClickMouse() {
    const g = this.game;
    if (this.isHitting) return;
    this.rightClickDelay = 4;
    let useItem = true;
    const held = g.inventory.held();
    const t = this.target;
    if (t && t.type === 'entity') {
      const e = t.entity;
      const p = g.entities.interp(e, 1);
      g.send(C.useEntity(e.id, 2, t.hit[0] - p.x, t.hit[1] - p.y, t.hit[2] - p.z));
      g.send(C.useEntity(e.id, 0));
      if (g.entities.isInteractive(e, held)) useItem = false;
    } else if (t && t.type === 'block') {
      const b = blocks[t.state >> 4];
      if (b && b.id !== 0) {
        if (this.onPlayerRightClick(t)) { useItem = false; this.swing(); }
        if (!held) return;
        if (held.count === 0) g.inventory.setHeld(null);
      }
    }
    if (useItem) {
      const h = g.inventory.held();
      if (h) this.sendUseItem(h);
    }
  }

  // ItemBlock.onItemUse runs on the client too: if the block could go there, play its place sound right away
  _placeSound(t, held) {
    const g = this.game, w = g.world;
    const nb = blocks[held.id];
    if (!nb) return;
    const replaceable = (st) => { const b = blocks[st >> 4]; return !b || b.id === 0 || b.isLiquid || /^(tallgrass|deadbush|vine|snow_layer|fire|double_plant)$/.test(b.name); };
    let { x, y, z } = t;
    if (!replaceable(t.state)) {
      const d = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][t.face] || [0, 1, 0];
      x += d[0]; y += d[1]; z += d[2];
      if (!replaceable(w.getState(x, y, z))) return;
    }
    if (y < 0 || y > 255) return;
    // World.canBlockBePlaced: a solid block may not overlap the player
    if (nb.boundingBox === 'block') {
      const bb = this.player.bb();
      if (bb[3] > x && bb[0] < x + 1 && bb[4] > y && bb[1] < y + 1 && bb[5] > z && bb[2] < z + 1) return;
    }
    g.sound.playBlockPlace(x, y, z, (held.id << 4) | ((held.damage || 0) & 15));
  }

  // PlayerControllerMP.onPlayerRightClick
  onPlayerRightClick(t) {
    const g = this.game;
    const held = g.inventory.held();
    const fx = t.hit[0] - t.x, fy = t.hit[1] - t.y, fz = t.hit[2] - t.z;
    const b = blocks[t.state >> 4];
    let activated = false;
    if (g.gameMode !== 3 && (!this.player.sneaking || !held) && b && INTERACTIVE.has(b.name)) activated = true;
    if (b && (b.name === 'iron_door' || b.name === 'iron_trapdoor')) activated = false;
    g.send(C.blockPlace(t.x, t.y, t.z, t.face, held, Math.floor(fx * 16), Math.floor(fy * 16), Math.floor(fz * 16)));
    if (activated) {
      if (b.isDoor || b.name === 'trapdoor' || b.isFenceGate) this.predictToggle(t, b);
      return true;
    }
    if (g.gameMode === 3 || !held) return false;
    // ItemBlock and items whose onItemUse succeeds on blocks
    if (held.id < 256) { this._placeSound(t, held); return true; }
    return PLACE_ITEMS.has(held.id) || (held.id === 351 && held.damage === 15) || (held.id >= 290 && held.id <= 294);
  }

  // Doors, trapdoors and gates toggle instantly client-side in vanilla
  predictToggle(t, b) {
    const g = this.game;
    let { x, y, z } = t;
    let st = g.world.getState(x, y, z);
    if (b.isDoor && ((st & 15) & 8)) { y -= 1; st = g.world.getState(x, y, z); }
    const meta = (st & 15) ^ 4;
    g.world.setState(x, y, z, ((st >> 4) << 4) | meta);
    const opening = !!(meta & 4);
    const sound = opening ? 'random.door_open' : 'random.door_close';
    g.sound.play(sound, x + 0.5, y + 0.5, z + 0.5, 1, Math.random() * 0.1 + 0.9);
  }

  sendUseItem(held) {
    const g = this.game;
    if (g.gameMode === 3) return;
    if (held.id === 386) {
      // ItemWritableBook opens the editor client-side
      import('../gui/screens/book.js').then((m) => g.screens.open(new m.BookScreen(g, held, true)));
    }
    g.send(C.blockPlace(-1, -1, -1, 255, held, 0, 0, 0));
    const action = g.items.useAction(held);
    if (action !== 'none') {
      const food = action === 'eat' && held.id !== 322 && g.food >= 20 && g.gameMode !== 1;
      if (!food) {
        this.player.usingItem = true;
        this.useTicks = 0;
      }
    }
    // Throwables etc. animate the arm
    if ([332, 344, 368, 373, 384, 381, 385, 346].includes(held.id) && !(held.id === 373 && !(held.damage & 16384))) this.swing();
  }

  stopUsingItem() {
    const g = this.game;
    g.send(C.blockDig(5, 0, 0, 0, 0));
    this.player.usingItem = false;
    this.useTicks = 0;
  }

  middleClick() {
    const g = this.game;
    const t = this.target;
    if (!t) return;
    let item = null;
    if (t.type === 'block') {
      const st = t.state;
      item = pickBlockItem(st, g);
    } else if (t.type === 'entity') {
      const e = t.entity;
      if (e.kind === 'painting') item = { id: 321, count: 1, damage: 0 };
      else if (e.kind === 'itemframe') item = e.item ? copy(e.item) : { id: 389, count: 1, damage: 0 };
      else if (e.kind === 'minecart') item = { id: 328, count: 1, damage: 0 };
      else if (e.kind === 'boat') item = { id: 333, count: 1, damage: 0 };
      else if (e.kind === 'mob' && e.type) item = { id: 383, count: 1, damage: e.type };
    }
    if (!item) return;
    const inv = g.inventory;
    // Already in hotbar?
    for (let i = 0; i < 9; i++) {
      const s = inv.main[i];
      if (s && s.id === item.id && (s.damage === item.damage || item.id === 383 && false)) { g.selectSlot(i); return; }
    }
    if (g.gameMode !== 1) {
      // Survival: swap from main inventory if present
      for (let i = 9; i < 36; i++) {
        const s = inv.main[i];
        if (s && s.id === item.id && s.damage === item.damage) {
          inv.click.call(inv, i, g.heldSlot, 2);
          return;
        }
      }
      return;
    }
    // Creative: put the item into the current hotbar slot (or the first empty one)
    let slot = g.heldSlot;
    if (inv.main[slot]) {
      for (let i = 0; i < 9; i++) if (!inv.main[i]) { slot = i; break; }
    }
    item.count = 1;
    inv.main[slot] = item;
    g.selectSlot(slot);
    g.send(C.creativeSlot(36 + slot, item));
  }

  dropItem(all) {
    const g = this.game;
    const held = g.inventory.held();
    if (!held || g.gameMode === 3) return;
    g.send(C.blockDig(all ? 3 : 4, 0, 0, 0, 0));
    if (all) g.inventory.setHeld(null);
    else { held.count--; if (held.count <= 0) g.inventory.setHeld(null); }
    this.swing();
  }

  setRemoteBreak(entityId, pos, stage) {
    if (stage < 0 || stage > 9) this.remoteBreaks.delete(entityId);
    else this.remoteBreaks.set(entityId, { pos, stage, time: this.game.ticks });
  }

  renderSelection(partial) {
    const g = this.game;
    const r = g.renderer;
    this.updateTarget(partial);
    const t = this.target;
    if (t && t.type === 'block' && !g.hideGui && g.gameMode !== 3) {
      const b = t.box;
      r.setOutline([t.x + b[0], t.y + b[1], t.z + b[2], t.x + b[3], t.y + b[4], t.z + b[5]]);
    } else r.setOutline(null);
    if (this.isHitting && this.curBlock) {
      const dmg = this.prevDamage + (this.curDamage - this.prevDamage) * partial;
      const stage = Math.floor(dmg * 10) - 1;
      const st = g.world.getState(this.curBlock.x, this.curBlock.y, this.curBlock.z);
      const box = g.world.selectionBox(st, this.curBlock.x, this.curBlock.y, this.curBlock.z);
      r.setBreakProgress(this.curBlock, stage, box);
    } else {
      let shown = false;
      for (const rb of this.remoteBreaks.values()) {
        if (g.ticks - rb.time > 400) continue;
        const st = g.world.getState(rb.pos.x, rb.pos.y, rb.pos.z);
        r.setBreakProgress(rb.pos, rb.stage, g.world.selectionBox(st, rb.pos.x, rb.pos.y, rb.pos.z));
        shown = true;
        break;
      }
      if (!shown) r.setBreakProgress(null, -1);
    }
  }
}

// Block.getPickBlock -> item for a block state
export function pickBlockItem(state, game) {
  const id = state >> 4, m = state & 15;
  const b = blocks[id];
  if (!b || id === 0) return null;
  const map = {
    wooden_door: 324, iron_door: 330, spruce_door: 427, birch_door: 428, jungle_door: 429, acacia_door: 430, dark_oak_door: 431,
    standing_sign: 323, wall_sign: 323, reeds: 338, cake: 354, bed: 355, unpowered_repeater: 356, powered_repeater: 356,
    unpowered_comparator: 404, powered_comparator: 404, brewing_stand: 379, cauldron: 380, flower_pot: 390, skull: 397,
    redstone_wire: 331, wheat: 295, carrots: 391, potatoes: 392, nether_wart: 372, pumpkin_stem: 361, melon_stem: 362,
    cocoa: 351, tripwire: 287, standing_banner: 425, wall_banner: 425, lit_furnace: 61, lit_redstone_ore: 73,
    unlit_redstone_torch: 76, lit_redstone_lamp: 123, lit_pumpkin: 91, double_stone_slab: 44, double_wooden_slab: 126,
    double_stone_slab2: 182, piston_head: 33, redstone_lamp: 123, daylight_detector_inverted: 151, farmland: 3,
  };
  if (map[b.name] !== undefined) {
    let damage = 0;
    if (b.name === 'cocoa') damage = 3;
    if (b.name === 'double_stone_slab' || b.name === 'double_wooden_slab' || b.name === 'double_stone_slab2') damage = m & 7;
    return { id: map[b.name], count: 1, damage };
  }
  let damage = 0;
  const keepMeta = new Set(['stone', 'dirt', 'planks', 'sand', 'wool', 'stained_glass', 'stained_glass_pane', 'stained_hardened_clay', 'carpet',
    'red_flower', 'tallgrass', 'monster_egg', 'stonebrick', 'sandstone', 'red_sandstone', 'cobblestone_wall', 'prismarine', 'sponge', 'anvil']);
  if (keepMeta.has(b.name)) damage = b.name === 'anvil' ? (m >> 2) : m;
  if (b.name === 'log' || b.name === 'leaves' || b.name === 'sapling') damage = m & 3;
  if (b.name === 'log2' || b.name === 'leaves2') damage = m & 1;
  if (b.name === 'stone_slab' || b.name === 'wooden_slab' || b.name === 'stone_slab2') damage = m & 7;
  if (b.name === 'double_plant') damage = m & 7;
  if (b.name === 'quartz_block') damage = m >= 2 ? 2 : m;
  return { id, count: 1, damage };
}
