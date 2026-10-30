import {placementIntersects} from './placement-collision.js';
// Player interaction (port of PlayerControllerMP + Minecraft.clickMouse/rightClickMouse).
import { C } from '../net/packets.js';
import { blocks, blocksByName, findState, getBlock, getStateProperties, staticCollisionBoxes } from '../world/blocks.js';
import { isPointInFluid } from '../world/fluids.js';
import { rayBox } from '../world/world.js';
import { armorType, copy, stackable } from './container.js';
import { COMMAND_BLOCKS, CommandBlockScreen, CommandMinecartScreen } from '../gui/screens/commandblock.js';
import { StructureBlockScreen } from '../gui/screens/structure.js';
import { JigsawScreen } from '../gui/screens/jigsaw.js';

const INTERACTIVE = new Set(['barrel', 'blast_furnace', 'smoker', 'stonecutter', 'loom', 'cartography_table', 'grindstone', 'lectern', 'bell', 'chest', 'trapped_chest', 'ender_chest', 'crafting_table', 'furnace', 'lit_furnace', 'dispenser', 'dropper',
  'hopper', 'brewing_stand', 'enchanting_table', 'anvil', 'beacon', 'wooden_door', 'spruce_door', 'birch_door', 'jungle_door',
  'acacia_door', 'dark_oak_door', 'trapdoor', 'fence_gate', 'spruce_fence_gate', 'birch_fence_gate', 'jungle_fence_gate',
  'dark_oak_fence_gate', 'acacia_fence_gate', 'lever', 'stone_button', 'wooden_button', 'bed', 'noteblock', 'jukebox',
  'unpowered_repeater', 'powered_repeater', 'unpowered_comparator', 'powered_comparator', 'cake', 'cauldron', 'flower_pot',
  'daylight_detector', 'daylight_detector_inverted', 'command_block', 'dragon_egg', 'standing_sign', 'wall_sign',
  // 1.9+: their onBlockActivated succeeds too, so the off hand must not click again
  'repeating_command_block', 'chain_command_block', 'structure_block', 'jigsaw',
  ...['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'silver', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'].map((c) => c + '_shulker_box')]);

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
    this.predictedBlocks = new Map();
    this.tickNumber = 0;
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
    this.tickNumber++;
    for(const [key,p] of this.predictedBlocks)if(p.dimension!==g.dimension)this.predictedBlocks.delete(key);
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
      if (held && ['eat','drink'].includes(g.items.useAction(held)) && dur > 0 && this.useTicks >= dur) {
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
        if (g.gameMode === 3 && code === 'mouse1') continue; // the middle button goes to the spectator menu instead
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
      const b = getBlock(t.state);
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
    const sharpness = g.items.enchantLevel(held, 'sharpness');
    const f1 = (sharpness > 0 ? sharpness * .5 + .5 : 0) * f2;
    this.resetCooldown();
    const strong = f2 > 0.9;
    let i = g.items.enchantLevel(held, 'knockback');
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

  _holdingCreativeSword() {
    const g=this.game,held=g.inventory.held();
    return !!(g.gameMode === 1 && held && ['wooden_sword', 'stone_sword', 'iron_sword', 'diamond_sword', 'golden_sword'].includes(g.items.name(held.id)));
  }

  // Do not ask the server to mine with a Creative sword. Adjacent fire still
  // uses START_DESTROY_BLOCK so extinguishing remains synchronized.
  _creativeSwordBlocksMining(pos,face) {
    if(!this._holdingCreativeSword())return false;
    const d=FACE_DIR[face]||[0,1,0],st=this.game.world.getState(pos.x+d[0],pos.y+d[1],pos.z+d[2]);
    return getBlock(st)?.name!=='fire';
  }

  // PlayerControllerMP.clickBlock
  clickBlock(t, face) {
    const g = this.game;
    const pos = { x: t.x, y: t.y, z: t.z };
    if (g.gameMode === 2 || g.gameMode === 3) {
      // Adventure: only with tools able to "destroy" (CanDestroy not supported); spectator nothing
      if (g.gameMode === 3) return;
    }
    if(this._creativeSwordBlocksMining(pos,face)){this.resetBreaking();return false;}
    if (g.gameMode === 1) {
      g.tutorial.onHitBlock(g.world.getState(pos.x, pos.y, pos.z), 1);
      this._sendDig(0, pos, face);
      if (!this._extinguishFire(pos, face)) this.destroyBlockClient(pos);
      this.blockHitDelay = 5;
      return;
    }
    if (!this.isHitting || !this._isHittingPos(pos)) {
      if (this.isHitting) this._sendDig(1, this.curBlock, face);
      const state = g.world.getState(pos.x, pos.y, pos.z);
      g.tutorial.onHitBlock(state, 0);
      this._sendDig(0, pos, face);
      const b = getBlock(state);
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
      const eff = g.items.enchantLevel(held, 'efficiency');
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
    return isPointInFluid(g.world, pl.x, pl.y + pl.eyeHeight(), pl.z);
  }

  // EnchantmentHelper.getAquaAffinityModifier: Aqua Affinity on any armour piece
  _aquaAffinity() {
    const g = this.game;
    return g.inventory.armor.some((it) => it && g.items.enchantLevel(it, 'aqua_affinity') > 0);
  }

  // Minecraft.sendClickBlockToController (leftClickCounter is decremented once per tick before the clicks)
  sendClickBlockToController(leftDown) {
    const g = this.game;
    if (!leftDown) this.leftClickCounter = 0;
    if (this.leftClickCounter <= 0 && !this.player.usingItem) {
      const t = this.target;
      if (leftDown && t && t.type === 'block') {
        const b = getBlock(g.world.getState(t.x, t.y, t.z));
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
    if(this._creativeSwordBlocksMining(pos,face)){this.resetBreaking();return false;}
    if (g.gameMode === 1) {
      this.blockHitDelay = 5;
      g.tutorial.onHitBlock(g.world.getState(pos.x, pos.y, pos.z), 1);
      this._sendDig(0, pos, face);
      if (!this._extinguishFire(pos, face)) this.destroyBlockClient(pos);
      return true;
    }
    if (g.gameMode === 3) return false;
    if (this._isHittingPos(pos)) {
      const state = g.world.getState(pos.x, pos.y, pos.z);
      const b = getBlock(state);
      if (!b || b.id === 0) { this.isHitting = false; return false; }
      this.prevDamage = this.curDamage;
      this.curDamage = Math.fround(this.curDamage + this.relativeHardness(b)); // curBlockDamageMP is a float
      if (this.stepSoundCounter % 4 === 0) g.sound.playBlockHit(pos.x, pos.y, pos.z, state);
      this.stepSoundCounter++;
      g.tutorial.onHitBlock(state, Math.max(0, Math.min(1, this.curDamage)));
      if (this.curDamage >= 1) {
        this.isHitting = false;
        this._sendDig(2, pos, face);
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
      const c = this.curBlock;
      this.game.tutorial.onHitBlock(this.game.world.getState(c.x, c.y, c.z), -1);
      this._sendDig(1, this.curBlock, this.curFace || 0);
    }
    this.isHitting = false;
    this.curDamage = 0;
    this.prevDamage = 0;
  }

  // PlayerControllerMP.onPlayerDestroyBlock
  destroyBlockClient(pos) {
    const g = this.game;
    const held = g.inventory.held();
    if (this._holdingCreativeSword()) return false;
    const state = g.world.getState(pos.x, pos.y, pos.z);
    const b = getBlock(state);
    if (!b || b.id === 0) return false;
    g.particles.blockBreak(pos.x, pos.y, pos.z, state);
    g.sound.playBlockBreak(pos.x, pos.y, pos.z, state);
    g.world.setState(pos.x, pos.y, pos.z, 0);
    // Doors/double plants/beds: the other half goes too (server will confirm)
    if (b.isDoor) {
      const other = getStateProperties(state).half === 'upper' ? pos.y - 1 : pos.y + 1;
      const otherState = g.world.getState(pos.x, other, pos.z);
      if (getBlock(otherState)?.name === b.name) g.world.setState(pos.x, other, pos.z, 0);
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

  _sendDig(status,pos,face) {
    this.pendingDigs ||= new Map();
    const p=this.player;
    this.pendingDigs.set(`${pos.x},${pos.y},${pos.z}:${status}`,{x:p.x,y:p.y,z:p.z});
    while(this.pendingDigs.size>50)this.pendingDigs.delete(this.pendingDigs.keys().next().value);
    this.game.send(C.blockDig(status,pos.x,pos.y,pos.z,face));
  }

  acknowledgeDigging(p) {
    const {x,y,z}=p.location,key=`${x},${y},${z}:${p.status}`,before=this.pendingDigs?.get(key);
    this.pendingDigs?.delete(key);
    const g=this.game;
    if(g.world.getState(x,y,z)!==p.block && (!p.successful || p.status!==0 || !before)) {
      g.world.setState(x,y,z,p.block);
      if(before && g.world.getCollisions(this.player.bb(),this.player).length)this.player.setPosition(before.x,before.y,before.z);
    }
  }

  onBlockChange(pos,state){this.predictedBlocks.delete(pos.x+','+pos.y+','+pos.z);}

  _extinguishFire(pos, face) {
    const g = this.game;
    const d = FACE_DIR[face] || [0, 1, 0];
    const x = pos.x + d[0], y = pos.y + d[1], z = pos.z + d[2];
    const b = getBlock(g.world.getState(x, y, z));
    if (!b || b.name !== 'fire') return false;
    g.sound.onWorldEvent({ effectId: 1009, location: { x, y, z }, data: 0 });
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
        // EntityMinecartCommandBlock.processInitialInteract: GuiEditCommandBlockMinecart (COMMAND 12, LAST_OUTPUT 13)
        if (e.kind === 'minecart' && e.cartType === 6 && g.canUseCommandBlock()) { g.screens.open(new CommandMinecartScreen(g, e, 12, 13)); return; }
        if (g.entities.isInteractive(e, stack)) return;
      } else if (t && t.type === 'block') {
        // ItemFirework is an elytra-use item, not a block-use item. If the
        // crosshair hits terrain, send TryUseItem instead of consuming the
        // click as TryUseItemOnBlock.
        if (stack && g.items.name(stack.id) === 'firework_rocket' && this.player.elytraFlying) {
          if (this.sendUseItem(stack, hand)) { this.resetEquipped(hand); return; }
        }
        const b = getBlock(g.world.getState(t.x, t.y, t.z));
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
        const b = getBlock(g.world.getState(t.x, t.y, t.z));
    let activated = false;
    if (g.gameMode !== 3) {
      const mainAndOffEmpty = !g.inventory.held() && !g.inventory.offhand;
      if ((!this.player.sneaking || mainAndOffEmpty) && b && (INTERACTIVE.has(b.name) || b.isDoor || b.isFenceGate || b.name.endsWith('_trapdoor') || b.name.endsWith('_button') || b.name.endsWith('_bed') || b.name.endsWith('_sign') || ['repeater','comparator','note_block','daylight_detector','shulker_box','light_gray_shulker_box'].includes(b.name)) && b.name !== 'iron_door' && b.name !== 'iron_trapdoor') activated = true;
      // BlockCommandBlock.onBlockActivated: only for players who can use command blocks, who get GuiCommandBlock
      // (TileEntityStructure.usedBy too: GuiEditStructure)
      if (activated && (COMMAND_BLOCKS.has(b.name) || b.name === 'structure_block' || b.name==='jigsaw') && !g.canUseCommandBlock()) activated = false;
      // ItemBlock.canPlaceBlockOnSide: no packet at all when the block could not go there
      if (!activated && held && this._itemBlock(held) && g.items.name(held.id)!=='scaffolding' && !this._canPlaceBlockOnSide(t, held)) return false;
    }
    // CPacketPlayerTryUseItemOnBlock (cursor position on the face)
    g.send(C.blockPlace(t.x, t.y, t.z, t.face, hand, fx, fy, fz));
    if (activated) {
      if (COMMAND_BLOCKS.has(b.name)) g.screens.open(new CommandBlockScreen(g, { x: t.x, y: t.y, z: t.z }));
      if (b.name === 'structure_block') g.screens.open(new StructureBlockScreen(g, { x: t.x, y: t.y, z: t.z }, g.structureBlocks.get(t.x + ',' + t.y + ',' + t.z)));
      if (b.name === 'jigsaw') g.screens.open(new JigsawScreen(g,{x:t.x,y:t.y,z:t.z},g.jigsawBlocks.get(t.x+','+t.y+','+t.z)));
      if (b.isDoor || b.name === 'trapdoor' || b.name.endsWith('_trapdoor') || b.isFenceGate) this.predictToggle(t, b);
      return true;
    }
    if (g.gameMode === 3) return true;
    if (held && g.items.name(held.id)==='scaffolding') return true; // authoritative extension/support/falling rules
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

  _itemBlock(held) { return !!held && this.game.items.isBlockItem(held.id); }

  // Block a placer item puts down (ItemBlock or ItemReed-style items)
  _placedBlock(held) {
    if (this._itemBlock(held)) return this.game.items.blockFor(held.id);
    const n = { redstone: 'redstone_wire', string: 'tripwire' }[this.game.items.name(held.id)];
    return n ? blocksByName[n] || null : null;
  }

  _replaceable(st) {
    const b = getBlock(st);
    if (!b || b.id === 0 || b.isLiquid) return true;
    if (b.name === 'snow') return Number(getStateProperties(st).layers || 1) === 1;
    return /^(tall_grass|dead_bush|vine|fire|kelp|kelp_plant|seagrass|tall_seagrass)$/.test(b.name);
  }

  // World.canBlockBePlaced (+ Block.canPlaceBlockOnSide basics) at the position the item would use
  _stackingProperty(t, held) {
    if (!held || this.player.sneaking) return null;
    const state=this.game.world.getState(t.x,t.y,t.z),block=getBlock(state),placed=this._placedBlock(held);
    if (!placed || placed.name !== block.name) return null;
    const props=getStateProperties(state),property={snow:'layers',sea_pickle:'pickles',turtle_egg:'eggs'}[block.name];
    if (!property || Number(props[property]) >= (property === 'layers' ? 8 : 4) || property === 'layers' && t.face !== 1) return null;
    return property;
  }

  _placementPos(t, held) {
    const g = this.game;
    const cur = getBlock(g.world.getState(t.x, t.y, t.z));
    let face = t.face;
    let p = { x: t.x, y: t.y, z: t.z };
    if (this._stackingProperty(t, held)) return { p, face };
    if (cur && cur.name === 'snow' && Number(getStateProperties(g.world.getState(t.x, t.y, t.z)).layers || 1) < 1) face = 1;
    else if (!this._replaceable(g.world.getState(t.x, t.y, t.z))) {
      const d = FACE_DIR[t.face] || [0, 1, 0];
      p = { x: t.x + d[0], y: t.y + d[1], z: t.z + d[2] };
    }
    return { p, face };
  }

  _placementState(t,held,block){
    const stacked=this._stackingProperty(t,held);
    if(stacked){const props={...getStateProperties(this.game.world.getState(t.x,t.y,t.z))};props[stacked]=String(Number(props[stacked])+1);return findState(block.name,props);}
    const props={...getStateProperties(block.defaultState)};
    if('axis' in props)props.axis=['y','y','z','z','x','x'][t.face]||'y';
    if('type' in props&&block.name.endsWith('_slab'))props.type=t.face===0||t.face!==1&&t.hit[1]-t.y>.5?'top':'bottom';
    return findState(block.name,props);
  }

  _canPlaceBlockOnSide(t, held) {
    const g = this.game, w = g.world;
    const nb = this._placedBlock(held);
    if (!nb) return false;
    const { p, face } = this._placementPos(t, held);
    if (p.y < 0 || p.y > 255) return false;
    if (!this._stackingProperty(t,held) && !this._replaceable(w.getState(p.x, p.y, p.z))) return false;
    // entities in the way of a block with a collision box (EntityLivingBase, boats, minecarts, TNT, falling blocks)
    const placed=this._placementState(t,held,nb),boxes=staticCollisionBoxes(placed,p.x,p.y,p.z);
    if (boxes.length) {
      const hit=b=>placementIntersects(boxes,p,b);
      if (hit(this.player.bb())) return false;
      for (const e of g.entities.all()) {
        if(e.kind==='falling'&&w.getState(Math.floor(e.x),Math.floor(e.y),Math.floor(e.z))===e.blockState)continue;
        if (!['player', 'mob', 'armorstand', 'boat', 'minecart', 'tnt', 'falling'].includes(e.kind)) continue;
        const hw = (e.width || 0) / 2;
        if (hit([e.x - hw, e.y, e.z - hw, e.x + hw, e.y + (e.height || 0), e.z + hw])) return false;
      }
    }
    // support for blocks that need something under them / beside them
    const below = getBlock(w.getState(p.x, p.y - 1, p.z));
    const solidBelow = !!(below && below.opaque);
    const n = nb.name;
    if (/^(redstone_wire|repeater|comparator|carpet|pressure_plate|rail|snow|cake)$/.test(n) && !solidBelow) return false;
    if (/^(dandelion|poppy|sapling|tall_grass|dead_bush|fern|sunflower|lilac|rose_bush|peony|large_fern)$/.test(n) && !(below && /^(grass_block|dirt|farmland|sand)$/.test(below.name) && (n !== 'dead_bush' || below.name === 'sand'))) return false;
    if (/^(brown_mushroom|red_mushroom)$/.test(n) && !(below && below.opaque)) return false;
    if (n === 'sugar_cane' && !(below && (below.name === 'sugar_cane' || /^(grass_block|dirt|sand)$/.test(below.name)))) return false;
    if (/^(torch|redstone_torch|lever|stone_button|wooden_button|ladder|wall_sign|tripwire_hook)$/.test(n)) {
       if (face === 0 && n !== 'lever' && !/button/.test(n)) return false;
      const d = FACE_DIR[face] || [0, 1, 0];
    const sup = getBlock(w.getState(p.x - d[0], p.y - d[1], p.z - d[2]));
      if (!(sup && (sup.opaque||face===1&&sup.isPane&&/^(torch|redstone_torch)$/.test(n)))) return false;
    }
    return true;
  }

  // Item.onItemUse on the client: whether the click "worked" (decides the swing), with the client-side effects
  _onItemUse(t, held) {
    const g = this.game, w = g.world, id = held.id, name = g.items.name(id);
    const st = w.getState(t.x, t.y, t.z), b = getBlock(st);
    const above = (y) => getBlock(w.getState(t.x, y, t.z));
    const air = (bb) => !bb || bb.id === 0;
    const placer = this._placedBlock(held);
    if (placer) {
      if (!this._canPlaceBlockOnSide(t, held)) return false;
      if (held.count <= 0) return false;
      const { p } = this._placementPos(t, held);
      this._predictPlace(p, held, placer);
      // Sound belongs to successful item use, including states left for the server to resolve.
      g.sound.playBlockPlace(p.x, p.y, p.z, placer.defaultState);
      held.count--; // the server's slot update follows
      return true;
    }
    switch (name) {
      case 'flint_and_steel': return true;
      case 'wheat_seeds': case 'carrot': case 'potato':
        return t.face === 1 && b && b.name === 'farmland' && air(above(t.y + 1));
      case 'nether_wart': return t.face === 1 && b && b.name === 'soul_sand' && air(above(t.y + 1));
      case 'sweet_berries':return t.face===1&&/^(grass_block|dirt|coarse_dirt|podzol)$/.test(b?.name||'')&&air(above(t.y+1));
      case 'oak_door': case 'iron_door': case 'spruce_door': case 'birch_door': case 'jungle_door': case 'acacia_door': case 'dark_oak_door':
        return t.face === 1 && air(above(t.y + 1)) && air(above(t.y + 2)) && !!(b && b.opaque);
      case 'white_bed': case 'orange_bed': case 'magenta_bed': case 'light_blue_bed': case 'yellow_bed': case 'lime_bed': case 'pink_bed': case 'gray_bed':
      case 'light_gray_bed': case 'cyan_bed': case 'purple_bed': case 'blue_bed': case 'brown_bed': case 'green_bed': case 'red_bed': case 'black_bed':
        return t.face === 1 && air(above(t.y + 1));
      case 'sign': case 'oak_sign': case 'spruce_sign': case 'birch_sign': case 'jungle_sign': case 'acacia_sign': case 'dark_oak_sign':
      case 'white_banner': case 'orange_banner': case 'magenta_banner': case 'light_blue_banner': case 'yellow_banner': case 'lime_banner': case 'pink_banner': case 'gray_banner':
      case 'light_gray_banner': case 'cyan_banner': case 'purple_banner': case 'blue_banner': case 'brown_banner': case 'green_banner': case 'red_banner': case 'black_banner':
      case 'skeleton_skull': case 'wither_skeleton_skull': case 'zombie_head': case 'creeper_head': case 'player_head': case 'dragon_head':
        return t.face !== 0 && !!(b && b.material !== 'plant' && b.boundingBox === 'block');
      case 'minecart': case 'chest_minecart': case 'furnace_minecart': case 'tnt_minecart': case 'hopper_minecart': case 'command_block_minecart': case 'spawner_minecart':
        return !!(b && /rail$/.test(b.name));
      case 'armor_stand': return t.face !== 0;
      // ItemFirework succeeds while gliding; a dry rocket must fall through
      // to the normal use-item path instead of consuming a block click.
      case 'firework_rocket': return !!this.player.elytraFlying;
      case 'painting': case 'item_frame': case 'glow_item_frame': return t.face >= 2;
      case 'wooden_hoe': case 'stone_hoe': case 'iron_hoe': case 'diamond_hoe': case 'golden_hoe':
        return t.face !== 0 && air(above(t.y + 1)) && !!(b && (b.name === 'grass' || b.name === 'dirt'));
      case 'bone_meal': return !!(b && /^(sapling|wheat|carrots|potatoes|pumpkin_stem|melon_stem|grass|tallgrass|double_plant|brown_mushroom|red_mushroom|cocoa)$/.test(b.name));
      case 'ender_eye': return !!(b && b.name === 'end_portal_frame' && !getStateProperties(st).eye);
      default: return false;
    }
  }

  // ItemBlock.onItemUse sets the block on the client right away; only for blocks whose placed state is just
  // the item damage (no facing / orientation logic), the server's block change follows either way
  _predictPlace(p, held, nb) {
    // Only predict states whose native placement can be resolved here. A
    // default-state guess for doors, beds, stairs, fluids or multipart blocks
    // can create colliders inside players and overwrite legitimate neighbours.
    const t=this.target,stacked=t?.type==='block'&&this._stackingProperty(t,held);
    if(!nb||!stacked&&nb.stateProperties?.some(p=>p.name!=='axis'))return;
    const previous=this.game.world.getState(p.x,p.y,p.z),axis=nb.stateProperties?.some(p=>p.name==='axis');
    const predicted=(stacked||axis&&t?.type==='block')?this._placementState(t,held,nb):nb.defaultState;
    if(predicted===undefined||predicted===previous)return;
    const key=p.x+','+p.y+','+p.z,old=this.predictedBlocks.get(key);
    this.predictedBlocks.set(key,{previous:old?.previous??previous,predicted,dimension:this.game.dimension});
    this.game.world.setState(p.x,p.y,p.z,predicted);
  }

  // Doors, trapdoors and gates toggle instantly client-side in vanilla
  predictToggle(t, b) {
    const g = this.game;
    let { x, y, z } = t;
    let st = g.world.getState(x, y, z);
    let props = getStateProperties(st);
    if (b.isDoor && props.half === 'upper') { y -= 1; st = g.world.getState(x, y, z); props = getStateProperties(st); }
    const opening = props.open !== 'true';
    g.world.setState(x, y, z, findState(b.name, { ...props, open: String(opening) }));
    // BlockDoor / BlockTrapDoor / BlockFenceGate.onBlockActivated: World.playEvent for the player's own client
    const iron = b.name === 'iron_trapdoor';
    const ev = b.isDoor ? (opening ? 1006 : 1012) : b.isFenceGate ? (opening ? 1008 : 1014) : iron ? (opening ? 1037 : 1036) : (opening ? 1007 : 1013);
    g.sound.onWorldEvent({ effectId: ev, location: { x, y, z }, data: 0 });
  }

  // PlayerControllerMP.processRightClick: true for EnumActionResult.SUCCESS (Item.onItemRightClick did something)
  sendUseItem(held, hand = 0) {
    const g = this.game;
    if (g.gameMode === 3) return false;
    const name = g.items.name(held.id);
    if (name === 'writable_book') {
      // ItemWritableBook opens the editor client-side
      import('../gui/screens/book.js').then((m) => g.screens.open(new m.BookScreen(g, held, true, hand)));
    }
    g.send(C.useItem(hand)); // CPacketPlayerTryUseItem
    if (g.cooldownFraction(held.id, 0) > 0) return false; // CooldownTracker: still cooling down
    if (name === 'trident') {
      if (g.items.damage(held) >= g.items.maxDurability(held.id)-1) return false;
      if (g.items.enchantLevel(held, 'riptide') > 0 && !this._wetForRiptide()) return false;
    }
    if (name === 'firework_rocket' && this.player.elytraFlying) return true;
    const action = g.items.useAction(held);
    if (name === 'crossbow' && g.items.crossbowCharged(held)) return true; // Server fires and clears Charged NBT.
    if (action === 'bow' || action === 'crossbow') {
      const ammo = [g.inventory.offhand, ...g.inventory.main].some(s => s && (/^(arrow|spectral_arrow|tipped_arrow)$/.test(g.items.name(s.id)) || action === 'crossbow' && s === g.inventory.offhand && g.items.name(s.id) === 'firework_rocket'));
      if (!this.player.creative && !ammo) return false;
    }
    if (action !== 'none') {
      // ItemFood.onItemRightClick -> EntityPlayer.canEat(alwaysEdible): hungry (golden apples and chorus fruit always) and
      // not invulnerable, so nothing is eaten in creative or spectator
      const canEat = (g.items.canAlwaysEat(held) || g.food < 20) && !this.player.invulnerable;
      const food = action === 'eat' && !canEat;
      if (!food) {
        this.player.usingItem = true;
        this.activeHand = hand;
        this.useTicks = 0;
        return true;
      }
      return false;
    }
    if (name === 'fishing_rod') { this.swing(hand); return true; } // ItemFishingRod swings the arm itself
    const survival = g.gameMode !== 1;
    const t = this.target;
    const lookingAtFrame = t && t.type === 'block' && getBlock(t.state).name === 'end_portal_frame';
    // thrown items: snowball, egg, ender pearl, experience bottle, splash / lingering potion, eye of ender
    const thrown = ['snowball', 'egg', 'ender_pearl', 'experience_bottle', 'splash_potion', 'lingering_potion'].includes(name) || (name === 'ender_eye' && !lookingAtFrame);
    if (thrown) {
      if (survival) {
        held.count--;
        if (held.count <= 0) g.inventory.setHand(hand, null);
      }
      return true;
    }
    // armour and elytra equip themselves when that slot is empty
    const type = armorType(held, g.items);
    if (type >= 0) {
      const slot = 3 - type;
      if (!g.inventory.armor[slot]) return true;
    }
    return false;
  }

  _wetForRiptide() {
    const p = this.player, w = this.game.world;
    // Match TridentItem's isInWaterOrRain check. Refresh the body-fluid
    // contact instead of relying only on the previous movement tick; this is
    // important when a delayed chunk/block update puts the player in water.
    // Eligibility must not call handleWaterMovement: that applies currents.
    let bodyWet=!!p.inWater;
    if(w&&typeof w.getState==='function'&&typeof p.bb==='function'&&!(p.ridingEntity&&p.ridingBoat)){
      const bb=p.bb();
      for(let x=Math.floor(bb[0]);!bodyWet&&x<Math.ceil(bb[3]);x++)for(let z=Math.floor(bb[2]);!bodyWet&&z<Math.ceil(bb[5]);z++)for(let y=Math.floor(bb[1]);!bodyWet&&y<Math.ceil(bb[4]);y++)bodyWet=isPointInFluid(w,x+.5,Math.max(y,bb[1]),z+.5);
    }
    return bodyWet||!!(w?.isRainingAt?.(p.x,p.y,p.z)||w?.isRainingAt?.(p.x,p.y+p.height,p.z));
  }

  stopUsingItem() {
    const g = this.game;
    const held = g.inventory.getHand(this.activeHand);
    // Every release ends the server's active hand, including a charge under ten ticks.
    g.send(C.blockDig(5, 0, 0, 0, 0));
    if (held && g.items.name(held.id) === 'trident' && this.useTicks >= 10) {
      const level = g.items.enchantLevel(held, 'riptide');
      if (level > 0 && this._wetForRiptide()) {
        this.player.startRiptide(level, g.world);
        g.sound?.playAtPlayer('item.trident.riptide_' + Math.min(level, 3), 1, 1);
      }
    }
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
      let name = null;
      if (e.kind === 'painting') name = 'painting';
      else if (e.kind === 'itemframe') { if (e.item) item = copy(e.item); else name = 'item_frame'; }
      else if (e.kind === 'minecart') name = e.entityName;
      else if (e.kind === 'boat') name = (['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'][e.boatType || 0] || 'oak') + '_boat';
      else if (e.kind === 'armorstand') name = 'armor_stand';
      else if (e.kind === 'crystal') name = 'end_crystal';
      else if (e.kind === 'mob' && e.entityName) name = e.entityName + '_spawn_egg';
      const def = name && g.items.byName.get(name);
      if (def) item = { id: def.id, count: 1, damage: 0 };
    }
    if (!item) return;
    const inv = g.inventory;
    // Already in hotbar?
    for (let i = 0; i < 9; i++) {
      const s = inv.main[i];
      // InventoryPlayer.getSlotFor: same item, damage and tag
      if (s && stackable(s, item)) { g.selectSlot(i); return; }
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
      r.setBreakProgress(this.curBlock, stage, st, this._lightAround(this.curBlock));
    } else {
      let shown = false;
      for (const rb of this.remoteBreaks.values()) {
        if (g.ticks - rb.time > 400) continue;
        const st = g.world.getState(rb.pos.x, rb.pos.y, rb.pos.z);
        r.setBreakProgress(rb.pos, rb.stage, st, this._lightAround(rb.pos));
        shown = true;
        break;
      }
      if (!shown) r.setBreakProgress(null, -1);
    }
  }
}

// Block.getPickBlock -> item for a block state
export function pickBlockItem(state, game) {
  const b = getBlock(state);
  if (!b || b.name === 'air') return null;
  const map = {
    wall_sign: 'sign', wall_torch: 'torch', redstone_wall_torch: 'redstone_torch',
    redstone_wire: 'redstone', tripwire: 'string', wheat: 'wheat_seeds', carrots: 'carrot', potatoes: 'potato',
    beetroots: 'beetroot_seeds', cocoa: 'cocoa_beans', pumpkin_stem: 'pumpkin_seeds', attached_pumpkin_stem: 'pumpkin_seeds',
    melon_stem: 'melon_seeds', attached_melon_stem: 'melon_seeds', farmland: 'dirt', grass_path: 'dirt',
    kelp_plant: 'kelp', tall_seagrass: 'seagrass',
  };
  let name = map[b.name] || b.name.replace(/^potted_/, '').replace('_wall_', '_');
  if (b.name === 'piston_head') name = getStateProperties(state).type === 'sticky' ? 'sticky_piston' : 'piston';
  const def = game.items.byName.get(name);
  return def && def.id > 0 ? { id: def.id, count: 1, damage: 0 } : null;
}
