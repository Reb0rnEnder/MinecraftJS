// Player interaction (port of PlayerControllerMP + Minecraft.clickMouse/rightClickMouse).
import { C } from '../net/packets.js';
import { blocks, blocksByName } from '../world/blocks.js';
import { rayBox } from '../world/world.js';
import { copy } from './container.js';

const INTERACTIVE = new Set(['chest', 'trapped_chest', 'ender_chest', 'crafting_table', 'furnace', 'lit_furnace', 'dispenser', 'dropper',
  'hopper', 'brewing_stand', 'enchanting_table', 'anvil', 'beacon', 'wooden_door', 'spruce_door', 'birch_door', 'jungle_door',
  'acacia_door', 'dark_oak_door', 'trapdoor', 'fence_gate', 'spruce_fence_gate', 'birch_fence_gate', 'jungle_fence_gate',
  'dark_oak_fence_gate', 'acacia_fence_gate', 'lever', 'stone_button', 'wooden_button', 'bed', 'noteblock', 'jukebox',
  'unpowered_repeater', 'powered_repeater', 'unpowered_comparator', 'powered_comparator', 'cake', 'cauldron', 'flower_pot',
  'daylight_detector', 'daylight_detector_inverted', 'command_block', 'dragon_egg', 'standing_sign', 'wall_sign']);

// Items whose onItemUse places/acts on the clicked block (returns true in vanilla)

// EnumFacing index -> direction (down, up, north, south, west, east)
const FACE_DIR = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

export class Interaction {
  constructor(game) {
    this.game = game;
    this.isHitting = false;
    this.curBlock = { x: -1, y: -1, z: -1 }; // PlayerControllerMP.currentBlock
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
    this.equipProgressOff = 0;
    this.prevEquipProgressOff = 0;
    this.swingHand = 0;  // EntityLivingBase.swingingHand
    this.activeHand = 0; // hand of the item in use
    this.ticksSinceLastSwing = 0;
    this.lastHeld = null;
  }

  // ---------------------------------------------------------------- attack cooldown (1.9+)

  // EntityPlayer.getCooldownPeriod: ticks for a full-strength attack (20 / attack speed)
  cooldownPeriod() { return 20 / (this.player.attackSpeed || 4); }
  // EntityPlayer.getCooledAttackStrength
  cooledAttackStrength(adjust) { return Math.max(0, Math.min(1, (this.ticksSinceLastSwing + adjust) / this.cooldownPeriod())); }
  resetCooldown() { this.ticksSinceLastSwing = 0; }

  // EntityPlayer.onUpdate: count up, and a different main hand item (ignoring durability) restarts the cooldown
  _tickCooldown() {
    this.ticksSinceLastSwing++;
    const held = this.game.inventory.held();
    const prev = this._cooldownItem;
    const same = (!prev && !held) || (prev && held && prev.id === held.id && prev.damage === held.damage && prev.count === held.count);
    if (!same) {
      // ItemStack.areItemsEqualIgnoreDurability: damage only counts for items without durability
      const sameItem = (!prev && !held) || (prev && held && prev.id === held.id && (this.game.items.maxDurability(held.id) > 0 || prev.damage === held.damage));
      if (!sameItem) this.resetCooldown();
      this._cooldownItem = held ? { id: held.id, damage: held.damage, count: held.count } : null;
    }
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

  // EntityPlayerSP.swingArm
  swing(hand = 0) {
    this.game.send(C.armAnimation(hand));
    this.swingHand = hand;
    // EntityLivingBase.swingItem: restart only past half of getArmSwingAnimationEnd()
    if (!this.swinging || this.swingTicks >= Math.floor((this.swingLength || 6) / 2) || this.swingTicks < 0) {
      this.swingTicks = -1;
      this.swinging = true;
    }
  }

  // ---------------------------------------------------------------- per tick

  tick(presses) {
    const g = this.game;
    const input = g.input;
    this.updateEquip();
    if (this.rightClickDelay > 0) this.rightClickDelay--;
    this.updateTarget();
    const k = g.settings.keys;
    const attackDown = input.isDown('attack');
    const useDown = input.isDown('use');
    if (this.leftClickCounter > 0) this.leftClickCounter--;

    if (this.player.usingItem) {
      this.useTicks++;
      if (!useDown) this.stopUsingItem();
      const held = g.inventory.getHand(this.activeHand);
      const dur = g.items.useDuration(held);
      if (held && dur > 0 && dur < 72000 && this.useTicks >= dur) {
        // Server finishes eating; stop locally
        this.player.usingItem = false;
        this.useTicks = 0;
      }
      if (held && (g.items.useAction(held) === 'eat' || g.items.useAction(held) === 'drink') && this.useTicks > 4 && this.useTicks % 4 === 0) {
        if (g.items.useAction(held) === 'eat') g.sound.playAtPlayer('entity.generic.eat', 0.5 + 0.5 * Math.round(Math.random()), (Math.random() - Math.random()) * 0.2 + 1);
        else g.sound.playAtPlayer('entity.generic.drink', 0.5, Math.random() * 0.1 + 0.9);
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
    this.sendClickBlockToController(attackDown);
    this.lastHeld = g.inventory.held();
    // EntityPlayer.updateArmSwingProgress runs in the player update, after this tick's clicks
    this.updateSwing();
    this._tickCooldown();
  }

  tickIdle() {
    this.updateSwing();
    this._tickCooldown();
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

  // ItemRenderer.updateEquippedItem (1.9+): the main hand follows the attack cooldown (strength cubed); a changed
  // stack lowers the hand, which comes back up with the new one
  updateEquip() {
    this.prevEquipProgress = this.equipProgress;
    this.prevEquipProgressOff = this.equipProgressOff;
    const inv = this.game.inventory;
    const main = inv.held(), off = inv.offhand;
    const f = this.cooledAttackStrength(1);
    const clamp = (v) => Math.max(-0.4, Math.min(0.4, v));
    this.equipProgress += clamp((this._equipped === main ? f * f * f : 0) - this.equipProgress);
    this.equipProgressOff += clamp((this._equippedOff === off ? 1 : 0) - this.equipProgressOff);
    if (this.equipProgress < 0.1) this._equipped = main;
    if (this.equipProgressOff < 0.1) this._equippedOff = off;
  }

  // Minecraft.clickMouse (1.9+)
  clickMouse() {
    const g = this.game;
    if (this.leftClickCounter > 0) return;
    if (g.player.ridingEntity && g.player.ridingEntity.kind === 'boat') return; // isRowingBoat
    const t = this.target;
    let miss = !t;
    if (t && t.type === 'entity') this.attackEntity(t.entity);
    else if (t && t.type === 'block') {
      const b = blocks[t.state >> 4];
      if (b && b.id !== 0) this.clickBlock(t, t.face); else miss = true;
    }
    if (miss) {
      if (g.gameMode !== 1) this.leftClickCounter = 10;
      this.resetCooldown();
    }
    this.swing(0);
  }

  // PlayerControllerMP.attackEntity + client-side EntityPlayer.attackTargetEntityWithCurrentItem. On the client
  // only other players accept the hit (EntityOtherPlayerMP.attackEntityFrom), so only then does sprinting stop,
  // the 0.6 slowdown apply and crit particles appear locally; for mobs the server sends the crit animations.
  attackEntity(e) {
    const g = this.game, pl = this.player;
    g.send(C.useEntity(e.id, 1));
    if (g.gameMode === 3) return;
    this._attackTargetEntity(e);
    this.resetCooldown();
  }

  // EntityPlayer.attackTargetEntityWithCurrentItem (1.9+), client side: damage scales with the cooled strength;
  // knockback / sprint stop and crit particles only show when the target accepts the hit locally (other players)
  _attackTargetEntity(e) {
    const g = this.game, pl = this.player;
    if (e.kind === 'item' || e.kind === 'xp' || e.kind === 'arrow') return; // canBeAttackedWithItem() is false
    const held = g.inventory.held();
    const f2 = this.cooledAttackStrength(0.5);
    const f1 = g.items.enchantLevel(held, 16) * 1.25 * f2; // sharpness (EnumCreatureAttribute.UNDEFINED)
    this.resetCooldown();
    const strong = f2 > 0.9;
    let i = g.items.enchantLevel(held, 19); // knockback
    if (pl.sprinting && strong) i++;
    const crit = strong && pl.fallDistance > 0 && !pl.onGround && !pl.isOnLadder(g.world) && !pl.inWater && !g.effects.has(15) &&
      !pl.ridingEntity && (e.kind === 'player' || e.kind === 'mob' || e.kind === 'armorstand') && !pl.sprinting;
    if (e.kind !== 'player') return; // attackEntityFrom is false on the client for everything else
    if (i > 0) {
      pl.motionX *= 0.6;
      pl.motionZ *= 0.6;
      pl.sprinting = false;
    }
    if (crit) g.particles.crit(e);
    if (f1 > 0) g.particles.magicCrit(e);
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
      if (!this._extinguishFire(pos, face)) this.destroyBlockClient(pos);
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
  // Block.getPlayerRelativeBlockHardness + EntityPlayer.getDigSpeed, in float like vanilla (the break progress sums
  // these floats, so the tick a block breaks on matches)
  relativeHardness(b) {
    const g = this.game, f32 = Math.fround;
    const hardness = f32(b.hardness);
    if (hardness < 0) return 0;
    if (hardness === 0) return Infinity;
    const held = g.inventory.held();
    let f = f32(g.items.strVsBlock(held, b));
    if (f > 1) {
      const eff = g.items.enchantLevel(held, 32);
      if (eff > 0 && held) f = f32(f + (eff * eff + 1));
    }
    const haste = g.effects.get(3);
    if (haste) f = f32(f * f32(1 + f32((haste.amplifier + 1) * f32(0.2))));
    const fatigue = g.effects.get(4);
    if (fatigue) f = f32(f * f32([0.3, 0.09, 0.0027][fatigue.amplifier] ?? 8.1e-4));
    if (this._eyesInWater() && !this._aquaAffinity()) f = f32(f / 5);
    if (!this.player.onGround) f = f32(f / 5);
    const canHarvest = g.items.canHarvest(held, b);
    return f32(f32(f / hardness) / (canHarvest ? 30 : 100));
  }

  // Entity.isInsideOfMaterial(WATER): the eyes below the water surface (not while in a boat)
  _eyesInWater() {
    const g = this.game, pl = this.player;
    if (pl.ridingEntity && pl.ridingBoat) return false;
    const d = pl.y + pl.eyeHeight();
    const x = Math.floor(pl.x), y = Math.floor(d), z = Math.floor(pl.z);
    const st = g.world.getState(x, y, z), b = blocks[st >> 4];
    if (!b || !b.isWater) return false;
    const lvl = st & 15;
    const f = Math.fround(Math.fround(((lvl >= 8 ? 0 : lvl) + 1) / 9) - Math.fround(0.11111111));
    return d < Math.fround(Math.fround(y + 1) - f);
  }

  // EnchantmentHelper.getAquaAffinityModifier: Aqua Affinity on any armour piece
  _aquaAffinity() {
    const g = this.game;
    return g.inventory.armor.some((it) => it && g.items.enchantLevel(it, 6) > 0);
  }

  // Minecraft.sendClickBlockToController (leftClickCounter is decremented once per tick before the clicks)
  sendClickBlockToController(leftDown) {
    const g = this.game;
    if (!leftDown) this.leftClickCounter = 0;
    if (this.leftClickCounter <= 0 && !this.player.usingItem) {
      const t = this.target;
      if (leftDown && t && t.type === 'block') {
        const b = blocks[g.world.getState(t.x, t.y, t.z) >> 4];
        if (b && b.id !== 0 && this.onPlayerDamageBlock(t, t.face)) {
          g.particles.blockHit(t.x, t.y, t.z, t.face);
          this.swing();
        }
      } else this.resetBreaking();
    }
  }

  onPlayerDamageBlock(t, face) {
    const g = this.game;
    const pos = { x: t.x, y: t.y, z: t.z };
    if (this.blockHitDelay > 0) { this.blockHitDelay--; return true; }
    if (g.gameMode === 1) {
      this.blockHitDelay = 5;
      g.send(C.blockDig(0, pos.x, pos.y, pos.z, face));
      if (!this._extinguishFire(pos, face)) this.destroyBlockClient(pos);
      return true;
    }
    if (g.gameMode === 3) return false;
    if (this._isHittingPos(pos)) {
      const state = g.world.getState(pos.x, pos.y, pos.z);
      const b = blocks[state >> 4];
      if (!b || b.id === 0) { this.isHitting = false; return false; }
      this.prevDamage = this.curDamage;
      this.curDamage = Math.fround(this.curDamage + this.relativeHardness(b)); // curBlockDamageMP is a float
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
        g.sound.playAtPlayer('entity.item.break', 0.8, 0.8 + Math.random() * 0.4);
      }
    }
    // vanilla moves currentBlock below the world instead of clearing it; isHitting may still be true here (an
    // insta-broken block while another was being hit), and the next click aborts that position
    this.curBlock = { x: this.curBlock.x, y: -1, z: this.curBlock.z };
    return true;
  }

  onBlockChange(pos, state) { /* reserved for prediction rollback */ }

  _extinguishFire(pos, face) {
    const g = this.game;
    const d = FACE_DIR[face] || [0, 1, 0];
    const x = pos.x + d[0], y = pos.y + d[1], z = pos.z + d[2];
    const b = blocks[g.world.getState(x, y, z) >> 4];
    if (!b || b.name !== 'fire') return false;
    g.sound.onWorldEvent({ effectId: 1004, location: { x, y, z }, data: 0 });
    g.world.setState(x, y, z, 0);
    return true;
  }

  // Minecraft.rightClickMouse (1.9+): main hand, then off hand, until one of them does something
  rightClickMouse() {
    const g = this.game;
    if (this.isHitting) return;
    this.rightClickDelay = 4;
    if (g.player.ridingEntity && g.player.ridingEntity.kind === 'boat') return; // isRowingBoat
    const t = this.target;
    for (let hand = 0; hand < 2; hand++) {
      const stack = g.inventory.getHand(hand);
      if (t && t.type === 'entity') {
        const e = t.entity;
        const p = g.entities.interp(e, 1);
        // interactWithEntity (INTERACT_AT): armor stands (not markers) take it client-side
        g.send(C.useEntity(e.id, 2, t.hit[0] - p.x, t.hit[1] - p.y, t.hit[2] - p.z, hand));
        if (e.kind === 'armorstand' && !((e.armorFlags || 0) & 16)) return;
        g.send(C.useEntity(e.id, 0, 0, 0, 0, hand)); // interactWithEntity (INTERACT)
        if (g.entities.isInteractive(e, stack)) return;
      } else if (t && t.type === 'block') {
        const b = blocks[g.world.getState(t.x, t.y, t.z) >> 4];
        if (b && b.id !== 0) {
          const before = stack ? stack.count : 0;
          if (this.onPlayerRightClick(t, hand)) {
            this.swing(hand);
            if (stack) {
              if (stack.count <= 0) g.inventory.setHand(hand, null);
              if (stack.count !== before || g.gameMode === 1) this.resetEquipped(hand);
            }
            return;
          }
        }
      }
      if (stack && this.sendUseItem(stack, hand)) { this.resetEquipped(hand); return; }
    }
  }

  // ItemRenderer.resetEquippedProgress
  resetEquipped(hand = 0) { if (hand === 1) this.equipProgressOff = 0; else this.equipProgress = 0; }

  // PlayerControllerMP.processRightClickBlock: true for EnumActionResult.SUCCESS
  onPlayerRightClick(t, hand = 0) {
    const g = this.game;
    const held = g.inventory.getHand(hand);
    const fx = t.hit[0] - t.x, fy = t.hit[1] - t.y, fz = t.hit[2] - t.z;
    const b = blocks[g.world.getState(t.x, t.y, t.z) >> 4];
    let activated = false;
    if (g.gameMode !== 3) {
      const mainAndOffEmpty = !g.inventory.held() && !g.inventory.offhand;
      if ((!this.player.sneaking || mainAndOffEmpty) && b && INTERACTIVE.has(b.name) && b.name !== 'iron_door' && b.name !== 'iron_trapdoor') activated = true;
      // ItemBlock.canPlaceBlockOnSide: no packet at all when the block could not go there
      if (!activated && held && this._itemBlock(held) && !this._canPlaceBlockOnSide(t, held)) return false;
    }
    // CPacketPlayerTryUseItemOnBlock (cursor position on the face)
    g.send(C.blockPlace(t.x, t.y, t.z, t.face, hand, fx, fy, fz));
    if (activated) {
      if (b.isDoor || b.name === 'trapdoor' || b.isFenceGate) this.predictToggle(t, b);
      return true;
    }
    if (g.gameMode === 3) return true;
    if (!held) return false;
    if (g.gameMode === 1) {
      // creative: onItemUse runs but the stack is restored
      const c = held.count, d = held.damage;
      const r = this._onItemUse(t, held);
      held.count = c; held.damage = d;
      return r;
    }
    return this._onItemUse(t, held);
  }

  _itemBlock(held) { return held.id > 0 && held.id < 256 && !!blocks[held.id]; }

  // Block a placer item puts down (ItemBlock or ItemReed-style items)
  _placedBlock(held) {
    if (this._itemBlock(held)) return blocks[held.id];
    const n = { 331: 'redstone_wire', 338: 'reeds', 354: 'cake', 356: 'unpowered_repeater', 379: 'brewing_stand', 380: 'cauldron', 390: 'flower_pot',
      404: 'unpowered_comparator', 287: 'tripwire' }[held.id];
    return n ? blocksByName[n] || null : null;
  }

  _replaceable(st) {
    const b = blocks[st >> 4];
    if (!b || b.id === 0 || b.isLiquid) return true;
    if (b.name === 'snow_layer') return (st & 7) === 0; // one layer
    return /^(tallgrass|deadbush|vine|fire|double_plant)$/.test(b.name);
  }

  // World.canBlockBePlaced (+ Block.canPlaceBlockOnSide basics) at the position the item would use
  _placementPos(t, held) {
    const g = this.game;
    const cur = blocks[g.world.getState(t.x, t.y, t.z) >> 4];
    let face = t.face;
    let p = { x: t.x, y: t.y, z: t.z };
    if (cur && cur.name === 'snow_layer' && (g.world.getState(t.x, t.y, t.z) & 7) < 1) face = 1;
    else if (!this._replaceable(g.world.getState(t.x, t.y, t.z))) {
      const d = FACE_DIR[t.face] || [0, 1, 0];
      p = { x: t.x + d[0], y: t.y + d[1], z: t.z + d[2] };
    }
    return { p, face };
  }

  _canPlaceBlockOnSide(t, held) {
    const g = this.game, w = g.world;
    const nb = this._placedBlock(held);
    if (!nb) return false;
    const { p, face } = this._placementPos(t, held);
    if (p.y < 0 || p.y > 255) return false;
    if (!this._replaceable(w.getState(p.x, p.y, p.z))) return false;
    // entities in the way of a block with a collision box (EntityLivingBase, boats, minecarts, TNT, falling blocks)
    if (nb.boundingBox === 'block') {
      const hit = (b) => b[3] > p.x && b[0] < p.x + 1 && b[4] > p.y && b[1] < p.y + 1 && b[5] > p.z && b[2] < p.z + 1;
      if (hit(this.player.bb())) return false;
      for (const e of g.entities.all()) {
        if (!['player', 'mob', 'armorstand', 'boat', 'minecart', 'tnt', 'falling'].includes(e.kind)) continue;
        const hw = (e.width || 0) / 2;
        if (hit([e.x - hw, e.y, e.z - hw, e.x + hw, e.y + (e.height || 0), e.z + hw])) return false;
      }
    }
    // support for blocks that need something under them / beside them
    const below = blocks[w.getState(p.x, p.y - 1, p.z) >> 4];
    const solidBelow = !!(below && below.opaque);
    const n = nb.name;
    if (/^(redstone_wire|unpowered_repeater|unpowered_comparator|carpet|wooden_pressure_plate|stone_pressure_plate|light_weighted_pressure_plate|heavy_weighted_pressure_plate|rail|golden_rail|detector_rail|activator_rail|snow_layer|cake)$/.test(n) && !solidBelow) return false;
    if (/^(yellow_flower|red_flower|sapling|tallgrass|double_plant|deadbush)$/.test(n) && !(below && /^(grass|dirt|farmland|sand)$/.test(below.name) && (n !== 'deadbush' || below.name === 'sand'))) return false;
    if (/^(brown_mushroom|red_mushroom)$/.test(n) && !(below && below.opaque)) return false;
    if (n === 'reeds' && !(below && (below.name === 'reeds' || /^(grass|dirt|sand)$/.test(below.name)))) return false;
    if (/^(torch|redstone_torch|lever|stone_button|wooden_button|ladder|wall_sign|tripwire_hook)$/.test(n)) {
      if (face === 0 && n !== 'lever' && !/button/.test(n)) return false;
      const d = FACE_DIR[face] || [0, 1, 0];
      const sup = blocks[w.getState(p.x - d[0], p.y - d[1], p.z - d[2]) >> 4];
      if (!(sup && sup.opaque)) return false;
    }
    return true;
  }

  // Item.onItemUse on the client: whether the click "worked" (decides the swing), with the client-side effects
  _onItemUse(t, held) {
    const g = this.game, w = g.world, id = held.id;
    const st = w.getState(t.x, t.y, t.z), b = blocks[st >> 4];
    const above = (y) => blocks[w.getState(t.x, y, t.z) >> 4];
    const air = (bb) => !bb || bb.id === 0;
    const placer = this._placedBlock(held);
    if (placer) {
      if (!this._canPlaceBlockOnSide(t, held)) return false;
      if (held.count <= 0) return false;
      const { p } = this._placementPos(t, held);
      this._predictPlace(p, held, placer);
      held.count--; // the server's slot update follows
      return true;
    }
    switch (id) {
      case 259: return true; // flint and steel
      case 295: case 361: case 362: case 391: case 392: // seeds / carrot / potato
        return t.face === 1 && b && b.name === 'farmland' && air(above(t.y + 1));
      case 372: return t.face === 1 && b && b.name === 'soul_sand' && air(above(t.y + 1));
      case 324: case 330: case 427: case 428: case 429: case 430: case 431: // doors
        return t.face === 1 && air(above(t.y + 1)) && air(above(t.y + 2)) && !!(b && b.opaque);
      case 355: return t.face === 1 && air(above(t.y + 1)); // bed
      case 323: case 425: case 397: return t.face !== 0 && !!(b && b.material !== 'plant' && b.boundingBox === 'block'); // sign, banner, skull
      case 328: case 342: case 343: case 407: case 408: case 422: return !!(b && /rail$/.test(b.name)); // minecarts
      case 383: case 401: return true; // spawn egg (client returns early), firework
      case 389: case 321: return t.face >= 2; // item frame, painting
      case 416: return t.face !== 0; // armor stand
      case 290: case 291: case 292: case 293: case 294: // hoes
        return t.face !== 0 && air(above(t.y + 1)) && !!(b && (b.name === 'grass' || b.name === 'dirt'));
      case 351: return held.damage === 15 && !!(b && /^(sapling|wheat|carrots|potatoes|pumpkin_stem|melon_stem|grass|tallgrass|double_plant|brown_mushroom|red_mushroom|cocoa)$/.test(b.name));
      case 381: return !!(b && b.name === 'end_portal_frame' && !((st & 15) & 4)); // eye of ender into a frame
      default: return false;
    }
  }

  // ItemBlock.onItemUse sets the block on the client right away; only for blocks whose placed state is just
  // the item damage (no facing / orientation logic), the server's block change follows either way
  _predictPlace(p, held, nb) {
    if (!this._itemBlock(held)) return;
    const SIMPLE = /^(stone|grass|dirt|cobblestone|planks|sand|gravel|gold_ore|iron_ore|coal_ore|sponge|glass|lapis_ore|lapis_block|sandstone|wool|gold_block|iron_block|brick_block|tnt|bookshelf|mossy_cobblestone|obsidian|diamond_ore|diamond_block|crafting_table|snow|ice|clay|netherrack|soul_sand|glowstone|stonebrick|melon_block|mycelium|nether_brick|end_stone|redstone_lamp|emerald_ore|emerald_block|redstone_block|quartz_ore|stained_hardened_clay|stained_glass|slime|barrier|prismarine|sea_lantern|hardened_clay|coal_block|packed_ice|red_sandstone|noteblock)$/;
    if (!SIMPLE.test(nb.name)) return;
    let meta = held.damage & 15;
    if (/^(stone|dirt|planks|sand|sandstone|wool|stonebrick|stained_hardened_clay|stained_glass|prismarine|red_sandstone|sponge)$/.test(nb.name) === false) meta = 0;
    this.game.world.setState(p.x, p.y, p.z, (nb.id << 4) | meta);
  }

  // Doors, trapdoors and gates toggle instantly client-side in vanilla
  predictToggle(t, b) {
    const g = this.game;
    let { x, y, z } = t;
    let st = g.world.getState(x, y, z);
    if (b.isDoor && ((st & 15) & 8)) { y -= 1; st = g.world.getState(x, y, z); }
    const meta = (st & 15) ^ 4;
    g.world.setState(x, y, z, ((st >> 4) << 4) | meta);
    // BlockDoor / BlockTrapDoor / BlockFenceGate.onBlockActivated: World.playEvent for the player's own client
    const opening = !!(meta & 4);
    const iron = b.name === 'iron_trapdoor';
    const ev = b.isDoor ? (opening ? 1006 : 1012) : b.isFenceGate ? (opening ? 1008 : 1014) : iron ? (opening ? 1037 : 1036) : (opening ? 1007 : 1013);
    g.sound.onWorldEvent({ effectId: ev, location: { x, y, z }, data: 0 });
  }

  // PlayerControllerMP.processRightClick: true for EnumActionResult.SUCCESS (Item.onItemRightClick did something)
  sendUseItem(held, hand = 0) {
    const g = this.game;
    if (g.gameMode === 3) return false;
    if (held.id === 386) {
      // ItemWritableBook opens the editor client-side
      import('../gui/screens/book.js').then((m) => g.screens.open(new m.BookScreen(g, held, true)));
    }
    g.send(C.useItem(hand)); // CPacketPlayerTryUseItem
    if (g.cooldownFraction(held.id, 0) > 0) return false; // CooldownTracker: still cooling down
    const action = g.items.useAction(held);
    if (action !== 'none') {
      // ItemFood.onItemRightClick -> EntityPlayer.canEat(alwaysEdible): hungry (golden apples and chorus fruit always) and
      // not invulnerable, so nothing is eaten in creative or spectator
      const canEat = (held.id === 322 || held.id === 432 || g.food < 20) && !this.player.invulnerable;
      const food = action === 'eat' && !canEat;
      if (!food) {
        this.player.usingItem = true;
        this.activeHand = hand;
        this.useTicks = 0;
        return true;
      }
      return false;
    }
    if (held.id === 346) { this.swing(hand); return true; } // ItemFishingRod swings the arm itself
    const survival = g.gameMode !== 1;
    const t = this.target;
    const lookingAtFrame = t && t.type === 'block' && blocks[t.state >> 4] && blocks[t.state >> 4].name === 'end_portal_frame';
    // thrown items: snowball, egg, ender pearl, experience bottle, splash / lingering potion, eye of ender
    const thrown = [332, 344, 368, 384, 438, 441].includes(held.id) || (held.id === 381 && !lookingAtFrame);
    if (thrown) {
      if (survival) {
        held.count--;
        if (held.count <= 0) g.inventory.setHand(hand, null);
      }
      return true;
    }
    // armour and elytra equip themselves when that slot is empty
    if ((held.id >= 298 && held.id <= 317) || held.id === 443) {
      const slot = held.id === 443 ? 2 : 3 - ((held.id - 298) % 4);
      if (!g.inventory.armor[slot]) return true;
    }
    return false;
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
      else if (e.kind === 'mob' && e.type) {
        // EntityLiving.getPickedResult: a spawn egg with EntityTag.id, when the entity has an egg
        const def = g.assets.data.entities.find((d) => d.id === (e.entityType ?? e.type));
        const key = def ? 'minecraft:' + def.name : null;
        if (key && g.assets.data.creative.eggs[key]) {
          item = { id: 383, count: 1, damage: 0, nbt: { t: 10, name: '', v: { EntityTag: { t: 10, v: { id: { t: 8, v: key } } } } } };
        }
      }
    }
    if (!item) return;
    const inv = g.inventory;
    // Already in hotbar?
    for (let i = 0; i < 9; i++) {
      const s = inv.main[i];
      // InventoryPlayer.getSlotFor: same item, damage and tag
      if (s && s.id === item.id && s.damage === item.damage && JSON.stringify(g.items.nbt(s) || null) === JSON.stringify(g.items.nbt(item) || null)) { g.selectSlot(i); return; }
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

  // Light for the crack overlay: the brightest sky and block light around the block (its exposed faces)
  _lightAround(p) {
    const w = this.game.world;
    let sky = 0, block = 0;
    for (const [dx, dy, dz] of [[0, 0, 0], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      sky = Math.max(sky, w.getSkyLight(p.x + dx, p.y + dy, p.z + dz));
      block = Math.max(block, w.getBlockLight(p.x + dx, p.y + dy, p.z + dz));
    }
    return { sky, block };
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
    if (this.isHitting && this.curBlock.y >= 0) {
      const dmg = this.prevDamage + (this.curDamage - this.prevDamage) * partial;
      const stage = Math.floor(dmg * 10) - 1;
      const st = g.world.getState(this.curBlock.x, this.curBlock.y, this.curBlock.z);
      const box = g.world.selectionBox(st, this.curBlock.x, this.curBlock.y, this.curBlock.z);
      r.setBreakProgress(this.curBlock, stage, box, this._lightAround(this.curBlock));
    } else {
      let shown = false;
      for (const rb of this.remoteBreaks.values()) {
        if (g.ticks - rb.time > 400) continue;
        const st = g.world.getState(rb.pos.x, rb.pos.y, rb.pos.z);
        r.setBreakProgress(rb.pos, rb.stage, g.world.selectionBox(st, rb.pos.x, rb.pos.y, rb.pos.z), this._lightAround(rb.pos));
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
