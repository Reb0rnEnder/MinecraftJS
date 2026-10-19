// Client-side entity tracking (positions, interpolation, metadata, animation state).
import { simplify } from '../net/nbt.js';
import { blocks } from '../world/blocks.js';

const MOB_SIZES = {
  50: [0.6, 1.8, 1.62], 51: [0.6, 1.95, 1.74], 52: [1.4, 0.9, 0.65], 53: [3.6, 10.8, 10.44], 54: [0.6, 1.95, 1.74], 55: [0.51, 0.51, 0.31],
  56: [4, 4, 2.6], 57: [0.6, 1.95, 1.74], 58: [0.6, 2.9, 2.55], 59: [0.7, 0.5, 0.45], 60: [0.4, 0.3, 0.1], 61: [0.6, 1.8, 1.62],
  62: [0.51, 0.51, 0.31], 63: [16, 8, 6.8], 64: [0.9, 3.5, 3.15], 65: [0.5, 0.9, 0.81], 66: [0.6, 1.95, 1.62], 67: [0.4, 0.3, 0.1],
  68: [0.85, 0.85, 0.425], 90: [0.9, 0.9, 0.765], 91: [0.9, 1.3, 1.105], 92: [0.9, 1.3, 1.105], 93: [0.4, 0.7, 0.595],
  94: [0.95, 0.95, 0.475], 95: [0.6, 0.8, 0.68], 96: [0.9, 1.3, 1.105], 97: [0.7, 1.9, 1.7], 98: [0.6, 0.7, 0.595],
  99: [1.4, 2.9, 2.465], 100: [1.4, 1.6, 1.36], 101: [0.6, 0.7, 0.595], 120: [0.6, 1.95, 1.62],
};
const MOB_NAMES = {
  50: 'Creeper', 51: 'Skeleton', 52: 'Spider', 53: 'Giant', 54: 'Zombie', 55: 'Slime', 56: 'Ghast', 57: 'PigZombie', 58: 'Enderman',
  59: 'CaveSpider', 60: 'Silverfish', 61: 'Blaze', 62: 'LavaSlime', 63: 'EnderDragon', 64: 'WitherBoss', 65: 'Bat', 66: 'Witch',
  67: 'Endermite', 68: 'Guardian', 90: 'Pig', 91: 'Sheep', 92: 'Cow', 93: 'Chicken', 94: 'Squid', 95: 'Wolf', 96: 'MushroomCow',
  97: 'SnowMan', 98: 'Ozelot', 99: 'VillagerGolem', 100: 'EntityHorse', 101: 'Rabbit', 120: 'Villager',
};
const OBJECT_SIZES = {
  1: [1.5, 0.6], 2: [0.25, 0.25], 10: [0.98, 0.7], 50: [0.98, 0.98], 51: [2, 2], 60: [0.5, 0.5], 61: [0.25, 0.25], 62: [0.25, 0.25],
  63: [1, 1], 64: [0.3125, 0.3125], 65: [0.25, 0.25], 66: [0.3125, 0.3125], 70: [0.98, 0.98], 71: [0.5, 0.5], 72: [0.25, 0.25],
  73: [0.25, 0.25], 75: [0.25, 0.25], 76: [0.25, 0.25], 77: [0.375, 0.5], 78: [0.5, 1.975], 90: [0.25, 0.25],
};

const wrap = (a) => { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; };

// EntityHanging.updateBoundingBox: hanging block centre pushed 0.46875 towards the wall, shifted half a
// block for even sizes, 1 pixel thick. facing: horizontal index (0 south, 1 west, 2 north, 3 east).
export function hangingBox(hx, hy, hz, facing, wPx, hPx) {
  const front = [[0, 1], [-1, 0], [0, -1], [1, 0]][facing] || [0, 1];
  const ccw = [[1, 0], [0, 1], [-1, 0], [0, -1]][facing] || [1, 0];
  const off = (px) => (px % 32 === 0 ? 0.5 : 0);
  const cx = hx + 0.5 - front[0] * 0.46875 + off(wPx) * ccw[0];
  const cy = hy + 0.5 + off(hPx);
  const cz = hz + 0.5 - front[1] * 0.46875 + off(wPx) * ccw[1];
  const alongZ = front[0] === 0; // facing north/south: the picture spans X
  const hx2 = (alongZ ? wPx : 1) / 32, hy2 = hPx / 32, hz2 = (alongZ ? 1 : wPx) / 32;
  return [cx - hx2, cy - hy2, cz - hz2, cx + hx2, cy + hy2, cz + hz2];
}

export class EntityManager {
  constructor(game) {
    this.game = game;
    this.map = new Map();
    this.fishingCast = false;
  }

  clear() {
    for (const e of this.map.values()) {
      this.game.entityRenderer.remove(e);
      if (e.rollSound) e.rollSound.stop();
      if (e.insideSound) e.insideSound.stop();
    }
    this.map.clear();
    if (this.self) { this.game.entityRenderer.remove(this.self); this.self = null; }
  }

  get(id) { return this.map.get(id); }
  all() { return this.map.values(); }
  count() { return this.map.size; }

  _base(id, x, y, z, yaw = 0, pitch = 0) {
    return {
      id, x, y, z, prevX: x, prevY: y, prevZ: z, lastTickX: x, lastTickY: y, lastTickZ: z,
      serverX: Math.round(x * 32), serverY: Math.round(y * 32), serverZ: Math.round(z * 32),
      newX: x, newY: y, newZ: z, newYaw: yaw, newPitch: pitch, inc: 0,
      yaw, pitch, prevYaw: yaw, prevPitch: pitch, headYaw: yaw, prevHeadYaw: yaw, bodyYaw: yaw, prevBodyYaw: yaw,
      limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, swingProgress: 0, prevSwingProgress: 0, swingTicks: 0, swinging: false,
      onGround: false, metadata: {}, equipment: [null, null, null, null, null], ticks: 0, hurtTime: 0, deathTime: 0,
      motionX: 0, motionY: 0, motionZ: 0, pickable: true, width: 0.6, height: 1.8, eyeHeight: 1.62, riding: -1, passenger: -1,
      health: 20, maxHealth: 20, effects: new Map(), dead: false,
    };
  }

  add(e) {
    const old = this.map.get(e.id);
    if (old) this.game.entityRenderer.remove(old);
    this.map.set(e.id, e);
  }

  spawnPlayer(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z, p.yaw, p.pitch);
    e.kind = 'player';
    e.typeName = 'Player';
    e.uuid = p.playerUUID;
    const info = this.game.scoreboard.players ? this.game.scoreboard.players.get(p.playerUUID) : null;
    e.name = info ? info.name : '';
    e.currentItem = p.currentItem;
    if (p.currentItem > 0) e.equipment[0] = { id: p.currentItem, count: 1, damage: 0 };
    e.width = 0.6; e.height = 1.8; e.eyeHeight = 1.62;
    e.metadata = p.metadata;
    this._applyMeta(e);
    this.add(e);
  }

  spawnMob(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z, p.yaw, p.pitch);
    e.kind = 'mob';
    e.type = p.type;
    e.typeName = MOB_NAMES[p.type] || 'Mob';
    e.headYaw = e.prevHeadYaw = p.headPitch; // packet's "headPitch" is actually head yaw in 1.8
    const s = MOB_SIZES[p.type] || [0.6, 1.8, 1.62];
    e.width = s[0]; e.height = s[1]; e.eyeHeight = s[2];
    e.motionX = p.velocity.x / 8000; e.motionY = p.velocity.y / 8000; e.motionZ = p.velocity.z / 8000;
    // EntityList id 30: handleSpawnMob creates a real armor stand (ViaRewind sends hologram stands this way)
    if (p.type === 30) { e.kind = 'armorstand'; e.typeName = 'ArmorStand'; e.width = 0.5; e.height = 1.975; e.eyeHeight = 1.975 * 0.85; }
    e.metadata = p.metadata;
    this._applyMeta(e);
    this.add(e);
  }

  spawnObject(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z, p.yaw, p.pitch);
    e.kind = 'object';
    e.type = p.type;
    e.objectData = p.objectData;
    const s = OBJECT_SIZES[p.type] || [0.5, 0.5];
    e.width = s[0]; e.height = s[1]; e.eyeHeight = s[1] * 0.85;
    if (p.velocity) { e.motionX = p.velocity.x / 8000; e.motionY = p.velocity.y / 8000; e.motionZ = p.velocity.z / 8000; }
    switch (p.type) {
      case 1: e.kind = 'boat'; e.typeName = 'Boat'; break;
      case 2: e.kind = 'item'; e.typeName = 'Item'; e.pickable = false; e.hoverStart = Math.random() * Math.PI * 2; break;
      case 10: e.kind = 'minecart'; e.typeName = 'Minecart'; e.cartType = p.objectData; break;
      case 50: e.kind = 'tnt'; e.typeName = 'PrimedTnt'; e.pickable = false; e.fuse = 80; break;
      case 51: e.kind = 'crystal'; e.typeName = 'EnderCrystal'; break;
      case 60: e.kind = 'arrow'; e.typeName = 'Arrow'; e.pickable = false; break;
      case 61: case 62: case 65: case 72: case 73: case 75: case 64: case 63: case 66: case 76:
        e.kind = 'projectile'; e.typeName = 'Projectile'; e.pickable = false; break;
      case 70: {
        e.kind = 'falling'; e.typeName = 'FallingSand'; e.pickable = false;
        const id = p.objectData & 0xfff, meta = (p.objectData >> 12) & 15;
        e.blockState = (id << 4) | meta;
        break;
      }
      case 71: {
        e.kind = 'itemframe'; e.typeName = 'ItemFrame';
        e.facing = p.objectData; // 0 south, 1 west, 2 north, 3 east
        e.x = e.prevX = e.newX = p.x; e.z = e.prevZ = e.newZ = p.z; e.y = e.prevY = e.newY = p.y;
        e.box = hangingBox(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), e.facing, 12, 12);
        break;
      }
      case 77: e.kind = 'leash'; e.typeName = 'LeashKnot'; break;
      case 78: e.kind = 'armorstand'; e.typeName = 'ArmorStand'; break;
      case 90: e.kind = 'fishhook'; e.typeName = 'Fishing Float'; e.pickable = false; e.owner = p.objectData; break;
      default: e.kind = 'projectile'; break;
    }
    this.add(e);
  }

  spawnPainting(p) {
    const e = this._base(p.entityId, p.location.x + 0.5, p.location.y + 0.5, p.location.z + 0.5);
    e.kind = 'painting';
    e.typeName = 'Painting';
    e.title = p.title;
    e.facing = p.direction; // horizontal index: 0 south, 1 west, 2 north, 3 east
    e.blockPos = p.location;
    e.width = 0.5; e.height = 0.5;
    this.add(e);
  }

  spawnXpOrb(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z);
    e.kind = 'xp';
    e.typeName = 'XPOrb';
    e.count = p.count;
    e.pickable = false;
    e.width = 0.5; e.height = 0.5;
    this.add(e);
  }

  spawnLightning(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z);
    e.kind = 'lightning';
    e.pickable = false;
    e.lightningState = 2;
    e.boltVertex = Math.floor(Math.random() * 1e9);
    e.flashes = Math.floor(Math.random() * 3) + 1;
    this.add(e);
  }

  destroy(ids) {
    for (const id of ids) {
      const e = this.map.get(id);
      if (!e) continue;
      this.game.entityRenderer.remove(e);
      this.map.delete(id);
      if (e.rollSound) e.rollSound.stop();
      if (e.insideSound) e.insideSound.stop();
      if (e.kind === 'fishhook') this.fishingCast = false;
    }
  }

  setVelocity(p) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    e.motionX = p.velocity.x / 8000; e.motionY = p.velocity.y / 8000; e.motionZ = p.velocity.z / 8000;
  }

  _setTarget(e, x, y, z, yaw, pitch, inc = 3) {
    if (e.kind === 'painting') return;
    e.newX = x; e.newY = y; e.newZ = z;
    e.newYaw = yaw; e.newPitch = pitch;
    e.inc = inc;
    if (e.kind === 'item' || e.kind === 'xp' || e.kind === 'arrow' || e.kind === 'projectile' || e.kind === 'falling' || e.kind === 'tnt' || e.kind === 'fishhook') {
      // Non-living entities snap like vanilla's setPositionAndRotation for these
      e.inc = 1;
    }
  }

  relMove(p, move, look) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    e.serverX += Math.round(p.dX * 32);
    e.serverY += Math.round(p.dY * 32);
    e.serverZ += Math.round(p.dZ * 32);
    const yaw = look ? p.yaw : (e.inc > 0 ? e.newYaw : e.yaw);
    const pitch = look ? p.pitch : (e.inc > 0 ? e.newPitch : e.pitch);
    this._setTarget(e, e.serverX / 32, e.serverY / 32, e.serverZ / 32, yaw, pitch);
    e.onGround = p.onGround;
  }

  look(p) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    this._setTarget(e, e.inc > 0 ? e.newX : e.x, e.inc > 0 ? e.newY : e.y, e.inc > 0 ? e.newZ : e.z, p.yaw, p.pitch);
    e.onGround = p.onGround;
  }

  teleport(p) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    e.serverX = Math.round(p.x * 32); e.serverY = Math.round(p.y * 32); e.serverZ = Math.round(p.z * 32);
    let y = p.y;
    // vanilla: if close enough to current, keep current y to avoid jitter on ground
    if (Math.abs(e.x - p.x) < 0.03125 && Math.abs(e.y - p.y) < 0.015625 && Math.abs(e.z - p.z) < 0.03125) y = e.y;
    this._setTarget(e, p.x, y, p.z, p.yaw, p.pitch);
    e.onGround = p.onGround;
  }

  headLook(p) {
    const e = this.map.get(p.entityId);
    if (e) e.headYaw = p.headYaw;
  }

  setEquipment(id, slot, item) {
    const e = this.map.get(id);
    if (e && slot >= 0 && slot < 5) e.equipment[slot] = item;
  }

  setMetadata(id, meta) {
    const e = this.map.get(id);
    if (!e) return;
    Object.assign(e.metadata, meta);
    this._applyMeta(e);
  }

  _applyMeta(e) {
    const m = e.metadata;
    if (m[0] !== undefined) {
      e.onFire = !!(m[0] & 1);
      e.sneaking = !!(m[0] & 2);
      e.sprinting = !!(m[0] & 8);
      e.usingItem = !!(m[0] & 16);
      e.invisible = !!(m[0] & 32);
    }
    if (m[2] !== undefined) e.customName = m[2];
    if (m[3] !== undefined) e.nameVisible = !!m[3];
    if (m[6] !== undefined && (e.kind === 'mob' || e.kind === 'player')) {
      const prev = e.health;
      e.health = m[6];
      if (e.health <= 0 && prev > 0) e.dead = true;
    }
    if (e.kind === 'item' && m[10]) e.item = m[10];
    if (e.kind === 'itemframe') { e.item = m[8] || null; e.rotation = m[9] || 0; }
    if (e.kind === 'armorstand' && m[10] !== undefined) {
      // EntityArmorStand.setSize: small = half size, marker = no box (name tag sits right at its feet + 0.5)
      e.armorFlags = m[10];
      const small = !!(m[10] & 1), marker = !!(m[10] & 16);
      if (marker) { e.width = 0; e.height = 0; } else if (small) { e.width = 0.25; e.height = 0.9875; } else { e.width = 0.5; e.height = 1.975; }
    }
    if (e.kind === 'projectile' && e.type === 76 && m[8]) e.item = m[8];
    if (e.kind === 'arrow' && m[16] !== undefined) e.critical = !!(m[16] & 1);
    if (e.kind === 'minecart') {
      if (m[20] !== undefined) e.displayBlock = m[20];
      if (m[21] !== undefined) e.displayOffset = m[21];
      if (m[22] !== undefined) e.customDisplay = !!m[22];
    }
    if (e.kind === 'mob') {
      if (m[12] !== undefined) e.child = m[12] < 0;
      switch (e.type) {
        case 51: if (m[13] !== undefined) e.wither = m[13] === 1; break;
        case 54: case 57: if (m[13] !== undefined) e.villagerZombie = !!m[13]; if (m[12] !== undefined) e.child = m[12] === 1; break;
        case 55: case 62: if (m[16] !== undefined) { e.size = m[16]; e.width = e.height = 0.51000005 * e.size; } break;
        case 50: if (m[16] !== undefined) e.creeperState = m[16]; if (m[17] !== undefined) e.powered = !!m[17]; break;
        case 91: if (m[16] !== undefined) { e.fleece = m[16] & 15; e.sheared = !!(m[16] & 16); } break;
        case 90: if (m[16] !== undefined) e.saddled = !!m[16]; break;
        case 95: if (m[16] !== undefined) { e.sitting = !!(m[16] & 1); e.angry = !!(m[16] & 2); e.tamed = !!(m[16] & 4); }
          if (m[18] !== undefined) e.wolfHealth = m[18]; if (m[20] !== undefined) e.collar = m[20]; break;
        case 98: if (m[16] !== undefined) { e.sitting = !!(m[16] & 1); e.tamed = !!(m[16] & 4); } if (m[18] !== undefined) e.catType = m[18]; break;
        case 120: if (m[16] !== undefined) e.profession = m[16]; break;
        case 58: if (m[16] !== undefined) e.carried = m[16]; if (m[17] !== undefined) e.carriedMeta = m[17]; if (m[18] !== undefined) e.screaming = !!m[18]; break;
        case 65: if (m[16] !== undefined) e.hanging = !!(m[16] & 1); break;
        case 100: if (m[16] !== undefined) e.horseFlags = m[16]; if (m[19] !== undefined) e.horseType = m[19]; if (m[20] !== undefined) e.horseVariant = m[20]; if (m[22] !== undefined) e.horseArmor = m[22]; break;
        case 101: if (m[18] !== undefined) e.rabbitType = m[18]; break;
        case 68: if (m[16] !== undefined) { e.elder = !!(m[16] & 4); if (e.elder) { e.width = e.height = 1.9975; } } break;
        case 64: if (m[20] !== undefined) e.invulTime = m[20]; break;
        case 61: if (m[16] !== undefined) e.blazeOnFire = !!m[16]; break;
        case 66: if (m[21] !== undefined) e.witchAggressive = !!m[21]; break;
        default: break;
      }
    }
    if (e.kind === 'player' && m[10] !== undefined) e.skinFlags = m[10];
  }

  setAttributes(p) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    for (const prop of p.properties) if (prop.key === 'generic.maxHealth') e.maxHealth = prop.value;
  }

  addEffect(p) {
    const e = this.map.get(p.entityId);
    if (e) e.effects.set(p.effectId, p);
  }

  onAnimation(p) {
    const e = this.map.get(p.entityId);
    const g = this.game;
    if (p.entityId === g.entityId) { if (p.animation === 0) g.interaction.swing && (g.interaction.swinging = true, g.interaction.swingTicks = -1); return; }
    if (!e) return;
    switch (p.animation) {
      case 0: if (!e.swinging || e.swingTicks >= 3 || e.swingTicks < 0) { e.swingTicks = -1; e.swinging = true; } break;
      case 1: e.hurtTime = 10; break;
      case 2: e.sleeping = false; break;
      case 4: g.particles.crit(e); break;
      case 5: g.particles.magicCrit(e); break;
      default: break;
    }
  }

  onStatus(p) {
    const e = this.map.get(p.entityId);
    const g = this.game;
    if (!e) return;
    switch (p.entityStatus) {
      case 2: e.hurtTime = 10; g.sound.playEntityHurt(e); break;
      case 3: e.dead = true; e.health = 0; g.sound.playEntityDeath(e); break;
      case 6: g.particles.entityEffect(e, 'smoke'); break;
      case 7: g.particles.entityEffect(e, 'heart'); break;
      case 10: e.eatingGrass = 40; break;
      case 12: case 18: g.particles.entityEffect(e, 'heart'); break;
      case 13: g.particles.entityEffect(e, 'angryVillager'); break;
      case 14: g.particles.entityEffect(e, 'happyVillager'); break;
      case 15: g.particles.entityEffect(e, 'witchMagic'); break;
      case 17: g.particles.fireworkExplode && g.particles.fireworkExplode(e); break;
      default: break;
    }
  }

  onBed(p) {
    const e = this.map.get(p.entityId);
    if (p.entityId === this.game.entityId) { this.game.sleeping = true; return; }
    if (e) { e.sleeping = true; e.bedPos = p.location; }
  }

  onCollect(p) {
    const e = this.map.get(p.collectedEntityId);
    const collector = p.collectorEntityId === this.game.entityId ? null : this.map.get(p.collectorEntityId);
    if (!e) return;
    // (the pop / orb sound comes from the server: client-side World.playSoundAtEntity is a no-op in 1.8.9)
    // EntityPickupFX: fly to collector over 3 ticks
    e.pickup = { tick: 0, target: collector, start: [e.x, e.y, e.z] };
    e.pickable = false;
    if (p.collectorEntityId === this.game.entityId && e.item) {
      const inv = this.game.inventory;
      for (let i = 0; i < 36; i++) { const s = inv.main[i]; if (s && s.id === e.item.id && s.damage === e.item.damage) { s.popTime = 5; break; } }
    }
  }

  attach(id, vehicleId) {
    const e = this.map.get(id);
    if (e) {
      if (e.riding >= 0) { const v = this.map.get(e.riding); if (v) v.passenger = -1; }
      e.riding = vehicleId;
    }
    if (vehicleId >= 0) { const v = this.map.get(vehicleId); if (v) v.passenger = id; }
    if (id === this.game.entityId && vehicleId < 0) {
      // Dismounted: vanilla keeps position; nothing else to do
    }
  }

  setLeash(id, holder) {
    const e = this.map.get(id);
    if (e) e.leashHolder = holder;
  }

  isHorse(id) { const e = this.map.get(id); return !!e && e.kind === 'mob' && e.type === 100; }
  isLiving(id) { const e = this.map.get(id); return !!e && e.kind === 'mob'; }

  // Height offsets for riding (Entity.getMountedYOffset / getYOffset)
  mountedOffset(v) {
    if (v.kind === 'boat') return -0.3 + 0.6 * 0.5;
    if (v.kind === 'minecart') return 0.0 + 0.7 * 0.5 - 0.1;
    if (v.kind === 'mob') {
      if (v.type === 90) return 0.9 * 0.75 - 0.3;
      if (v.type === 100) return v.height * 0.75 - 0.25;
      if (v.type === 52 || v.type === 59) return v.height * 0.5 - 0.15;
      return v.height * 0.75 - 0.35;
    }
    return v.height * 0.75;
  }

  isInteractive(e, held) {
    if (e.kind === 'mob') {
      if (e.type === 120 || e.type === 100) return true;
      if (held && (e.type === 92 || e.type === 96) && held.id === 325) return true;
      if (held && e.type === 91 && held.id === 359) return true;
      if (held && held.id === 421) return true;
      if (held && held.id === 420) return true;
      if (e.type === 95 || e.type === 98) return !!e.tamed;
      if (e.type === 90 && e.saddled) return true;
    }
    if (e.kind === 'itemframe' || e.kind === 'armorstand' || e.kind === 'minecart' || e.kind === 'boat') return true;
    return false;
  }

  // Interpolated render position
  interp(e, partial) {
    return {
      x: e.prevX + (e.x - e.prevX) * partial,
      y: e.prevY + (e.y - e.prevY) * partial,
      z: e.prevZ + (e.z - e.prevZ) * partial,
    };
  }

  boss() {
    for (const e of this.map.values()) {
      if (e.kind === 'mob' && (e.type === 63 || e.type === 64)) {
        const max = e.type === 63 ? 200 : 300;
        const name = e.customName || (e.type === 63 ? 'Ender Dragon' : 'Wither');
        return { healthScale: Math.max(0, Math.min(1, (e.health || 0) / (e.maxHealth || max))), name };
      }
    }
    return null;
  }

  // Pseudo-entity mirroring the local player (rendered in third person)
  updateSelf() {
    const g = this.game;
    const pl = g.player;
    let s = this.self;
    if (!s) {
      s = this.self = this._base(-1, pl.x, pl.y, pl.z, pl.yaw, pl.pitch);
      s.kind = 'player'; s.typeName = 'Player'; s.pickable = false;
    }
    s.uuid = g.playerUuid || s.uuid; s.name = g.username;
    s.prevX = s.x; s.prevY = s.y; s.prevZ = s.z;
    s.prevYaw = s.yaw; s.prevPitch = s.pitch; s.prevHeadYaw = s.headYaw; s.prevBodyYaw = s.bodyYaw;
    s.prevLimbSwingAmount = s.limbSwingAmount;
    s.x = pl.x; s.y = pl.y; s.z = pl.z;
    s.yaw = pl.yaw; s.pitch = pl.pitch; s.headYaw = pl.yaw;
    s.sneaking = pl.sneaking && !pl.flying; s.onGround = pl.onGround;
    s.usingItem = pl.usingItem;
    s.riding = g.ridingEntityId;
    s.ticks++;
    const it = g.interaction;
    s.prevSwingProgress = it.prevSwingProgress; s.swingProgress = it.swingProgress;
    s.equipment = [g.inventory.held(), g.inventory.armor[0], g.inventory.armor[1], g.inventory.armor[2], g.inventory.armor[3]];
    s.hurtTime = g.hurtTime; s.deathTime = g.dead ? Math.min(20, (s.deathTime || 0) + 1) : 0;
    s.metadata = g.selfMetadata || s.metadata;
    if (s.metadata && s.metadata[10] !== undefined) s.skinFlags = s.metadata[10]; else s.skinFlags = g.settings.skinParts;
    s.invisible = g.effects.has(14);
    s.onFire = g.selfMetadata ? !!(g.selfMetadata[0] & 1) : false;
    this._livingUpdate(s);
  }

  // EntityDragon.onLivingUpdate (client part): wing animation clock and the 64-tick (yaw, y) ring buffer
  // that drives the neck and tail
  _dragonUpdate(e) {
    if (!e.ring) {
      e.ring = Array.from({ length: 64 }, () => [e.yaw, e.y]);
      e.ringIdx = 0; e.animTime = 0; e.prevAnimTime = 0;
    }
    e.prevAnimTime = e.animTime;
    if (!e.dead) {
      const dx = e.x - e.prevX, dz = e.z - e.prevZ, dy = e.y - e.prevY;
      e.animTime += 0.2 / (Math.sqrt(dx * dx + dz * dz) * 10 + 1) * Math.pow(2, dy);
    }
    e.ringIdx = (e.ringIdx + 1) & 63;
    e.ring[e.ringIdx] = [e.yaw, e.y];
    this._dragonParts(e);
  }

  // EntityDragon's EntityDragonPart hitboxes (the dragon itself cannot be hit). Entity ids follow the
  // dragon's: head +1, body +2, tail1..3 +3..+5, wing1 +6, wing2 +7 (order of creation in the constructor).
  _dragonParts(e) {
    if (!e.parts) {
      e.parts = ['head', 'body', 'tail1', 'tail2', 'tail3', 'wing1', 'wing2'].map((name, i) => ({
        id: e.id + 1 + i, kind: 'dragonPart', name, parent: e, pickable: true, metadata: {},
        x: e.x, y: e.y, z: e.z, prevX: e.x, prevY: e.y, prevZ: e.z, width: 0, height: 0,
      }));
    }
    const [head, body, tail1, tail2, tail3, wing1, wing2] = e.parts;
    const off = (i) => e.ring[(e.ringIdx - i) & 63]; // getMovementOffsets(i, 1.0F)
    const wrap = (a) => { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; };
    const set = (p, x, y, z, w, h) => { p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z; p.x = x; p.y = y; p.z = z; p.width = w; p.height = h; };
    const f1 = (off(5)[1] - off(10)[1]) * 10 / 180 * Math.PI;
    const f2 = Math.cos(f1), f11 = -Math.sin(f1);
    const f12 = e.yaw * Math.PI / 180, f13 = Math.sin(f12), f14 = Math.cos(f12);
    set(body, e.x + f13 * 0.5, e.y, e.z - f14 * 0.5, 5, 3);
    set(wing1, e.x + f14 * 4.5, e.y + 2, e.z + f13 * 4.5, 4, 2);
    set(wing2, e.x - f14 * 4.5, e.y + 2, e.z - f13 * 4.5, 4, 2);
    const a5 = off(5), a0 = off(0);
    set(head, e.x + f13 * 5.5 * f2, e.y + (a0[1] - a5[1]) + f11 * 5.5, e.z - f14 * 5.5 * f2, 3, 3);
    [tail1, tail2, tail3].forEach((p, j) => {
      const a = off(12 + j * 2);
      const r = f12 + wrap(a[0] - a5[0]) * Math.PI / 180;
      const f15 = Math.sin(r), f16 = Math.cos(r), f17 = 1.5, f18 = (j + 1) * 2;
      set(p, e.x - (f13 * f17 + f15 * f18) * f2, e.y + (a[1] - a5[1]) - (f18 + f17) * f11 + 1.5, e.z + (f14 * f17 + f16 * f18) * f2, 2, 2);
    });
  }

  // Every hittable box: normal entities plus dragon parts (instead of the dragon itself)
  *pickable() {
    for (const e of this.map.values()) {
      if (e.kind === 'mob' && e.type === 63) { if (e.parts) yield* e.parts; continue; }
      yield e;
    }
  }

  // MovingSoundMinecart (every cart) + MovingSoundMinecartRiding (the cart we sit in): looping rolling sounds
  // whose volume follows the cart's speed
  _minecartSounds() {
    const g = this.game;
    for (const e of this.map.values()) {
      if (e.kind !== 'minecart') continue;
      const f = Math.hypot(e.x - e.prevX, e.z - e.prevZ);
      if (!e.rollSound && !e.rollSoundPending) {
        e.rollSoundPending = true;
        g.sound.playLoop('minecart.base', e.x, e.y, e.z).then((h) => { e.rollSound = h; if (!this.map.has(e.id) && h) h.stop(); });
      }
      if (e.rollSound) { e.rollSound.setPosition([e.x, e.y, e.z]); e.rollSound.setVolume(f >= 0.01 ? Math.min(f, 0.5) * 0.7 : 0); }
      const riding = g.ridingEntityId === e.id;
      if (riding && !e.insideSound && !e.insideSoundPending) {
        e.insideSoundPending = true;
        g.sound.playLoop('minecart.inside', 0, 0, 0, { global: true }).then((h) => { e.insideSound = h; });
      }
      if (e.insideSound) {
        if (!riding) { e.insideSound.stop(); e.insideSound = null; e.insideSoundPending = false; }
        else e.insideSound.setVolume(f >= 0.01 ? Math.min(f, 1) * 0.75 : 0);
      }
    }
  }

  tick() {
    const g = this.game;
    this.updateSelf();
    this._minecartSounds();
    for (const e of [...this.map.values()]) {
      e.prevX = e.x; e.prevY = e.y; e.prevZ = e.z;
      e.prevYaw = e.yaw; e.prevPitch = e.pitch;
      e.prevHeadYaw = e.headYaw;
      e.prevBodyYaw = e.bodyYaw;
      e.prevLimbSwingAmount = e.limbSwingAmount;
      e.prevSwingProgress = e.swingProgress;
      e.ticks++;
      if (e.pickup) {
        e.pickup.tick++;
        if (e.pickup.tick >= 3) { this.game.entityRenderer.remove(e); this.map.delete(e.id); continue; }
        const t = e.pickup.tick / 3;
        let tx, ty, tz;
        if (e.pickup.target) { tx = e.pickup.target.x; ty = e.pickup.target.y + 0.5; tz = e.pickup.target.z; }
        else { tx = g.player.x; ty = g.player.y + 0.5; tz = g.player.z; }
        e.x = e.pickup.start[0] + (tx - e.pickup.start[0]) * t;
        e.y = e.pickup.start[1] + (ty - e.pickup.start[1]) * t;
        e.z = e.pickup.start[2] + (tz - e.pickup.start[2]) * t;
        continue;
      }
      if (e.kind === 'lightning') {
        e.lightningState--;
        if (e.lightningState < 0) {
          if (e.flashes === 0) { this.map.delete(e.id); this.game.entityRenderer.remove(e); continue; }
          if (e.lightningState < -Math.floor(Math.random() * 10)) { e.flashes--; e.lightningState = 1; e.boltVertex = Math.floor(Math.random() * 1e9); g.renderer.lightningTicks = 2; }
        }
        continue;
      }
      // Riding: follow vehicle
      if (e.riding >= 0) {
        const v = this.map.get(e.riding);
        if (v) {
          // vehicle.getMountedYOffset() + rider.getYOffset() (players: -0.35)
          e.x = v.x; e.z = v.z; e.y = v.y + this.mountedOffset(v) + (e.kind === 'player' ? -0.35 : 0);
          e.inc = 0;
        }
      } else if (e.inc > 0) {
        e.x += (e.newX - e.x) / e.inc;
        e.y += (e.newY - e.y) / e.inc;
        e.z += (e.newZ - e.z) / e.inc;
        e.yaw += wrap(e.newYaw - e.yaw) / e.inc;
        e.pitch += (e.newPitch - e.pitch) / e.inc;
        e.inc--;
      } else if (e.kind === 'item' || e.kind === 'xp' || e.kind === 'arrow' || e.kind === 'projectile' || e.kind === 'falling' || e.kind === 'tnt') {
        // Client-side motion between server updates
        if (e.kind !== 'arrow' || !e.inGround) {
          e.x += e.motionX; e.y += e.motionY; e.z += e.motionZ;
          const drag = e.kind === 'item' || e.kind === 'xp' ? 0.98 : 0.99;
          e.motionX *= drag; e.motionY = (e.motionY - (e.kind === 'projectile' ? 0.03 : 0.04)) * 0.98; e.motionZ *= drag;
          // stop at the ground
          const st = g.world.getState(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
          const b = blocks[st >> 4];
          if (b && b.opaque) { e.y = Math.floor(e.y) + 1; e.motionY = 0; e.motionX *= 0.5; e.motionZ *= 0.5; }
        }
      }
      if (e.kind === 'mob' && e.type === 63) this._dragonUpdate(e);
      if (e.kind === 'tnt') e.fuse = Math.max(0, (e.fuse || 80) - 1);
      if (e.hurtTime > 0) e.hurtTime--;
      if (e.dead) { e.deathTime++; }
      if (e.eatingGrass > 0) e.eatingGrass--;
      // Swing progress
      if (e.swinging) {
        e.swingTicks++;
        if (e.swingTicks >= 6) { e.swingTicks = 0; e.swinging = false; }
      } else e.swingTicks = 0;
      e.swingProgress = e.swingTicks / 6;
      if (e.kind === 'player' || e.kind === 'mob' || e.kind === 'armorstand') this._livingUpdate(e);
      if (e.onFire && Math.random() < 0.3) g.particles.entityFire && g.particles.entityFire(e);
      // Potion swirl particles
      if (e.metadata[7] && !e.metadata[8] !== undefined && e.metadata[7] > 0 && Math.random() < 0.25 && !e.invisible) {
        g.particles.potionSwirl && g.particles.potionSwirl(e, e.metadata[7], !!e.metadata[8]);
      }
    }
  }

  // EntityLivingBase.onUpdate: body yaw + limb swing
  _livingUpdate(e) {
    const d0 = e.x - e.prevX, d1 = e.z - e.prevZ;
    const f = d0 * d0 + d1 * d1;
    let f1 = e.bodyYaw;
    let f2 = 0;
    if (f > 0.0025000002) {
      f2 = Math.sqrt(f) * 3;
      f1 = Math.atan2(d1, d0) * 180 / Math.PI - 90;
    }
    if (e.swingProgress > 0) f1 = e.yaw;
    // func_110146_f
    const yawRef = e.kind === 'mob' ? e.headYaw : e.yaw;
    let df = wrap(f1 - e.bodyYaw);
    e.bodyYaw += df * 0.3;
    let f3 = wrap(yawRef - e.bodyYaw);
    if (f3 < -75) f3 = -75;
    if (f3 >= 75) f3 = 75;
    e.bodyYaw = yawRef - f3;
    if (f3 * f3 > 2500) e.bodyYaw += f3 * 0.2;
    if (e.kind === 'player') e.headYaw = e.yaw;
    // Limb swing
    const dy = e.kind === 'mob' && (e.type === 65 || e.type === 56 || e.type === 61) ? e.y - e.prevY : 0;
    let f4 = Math.sqrt(d0 * d0 + d1 * d1 + dy * dy) * 4;
    if (f4 > 1) f4 = 1;
    e.limbSwingAmount += (f4 - e.limbSwingAmount) * 0.4;
    e.limbSwing += e.limbSwingAmount;
    void simplify;
  }
}

export { MOB_NAMES };
