import { tickEntityEffects, tickDragonDeath, isDragon } from '../render/entity-effects.js';
// Client-side entity tracking (positions, interpolation, metadata, animation state).
import { simplify } from '../net/nbt.js';
import { getBlock } from '../world/blocks.js';
import { isPointInFluid } from '../world/fluids.js';
import { mcSin, mcCos } from './physics.js';
import { chatToLegacy } from '../gui/chat.js';
import { ENTITY_TYPES, ENTITIES_BY_NAME, MOB_FAMILIES, OBJECT_TYPES, MINECART_NAMES, PAINTINGS,
  ANIMALS, AGEABLE, HORSES, ZOMBIES, FISH, ARROWS, FIREBALLS } from './entity-types.js';

// Random.nextGaussian (Box-Muller)
function gauss() { let u = 0; while (u === 0) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); }

const SNAP_KINDS = new Set(['item', 'xp', 'arrow', 'projectile', 'falling', 'tnt', 'fishhook',
  'trident', 'spectral_arrow', 'dragon_fireball', 'shulker_bullet', 'llama_spit']);

// EntityShulker's box: 1 x 1 at its position, grown towards the opening by 0.5 - sin((0.5 + peek) * PI) * 0.5
// (attach face: 0 down .. 5 east; the shell opens away from it). Returns [minX, minY, minZ, maxX, maxY, maxZ].
export function shulkerBox(e, peek = e.peek || 0) {
  const d = 0.5 - Math.sin((0.5 + peek) * Math.PI) * 0.5;
  const b = [e.x - 0.5, e.y, e.z - 0.5, e.x + 0.5, e.y + 1, e.z + 0.5];
  switch (e.attachFace || 0) {
    case 0: b[4] += d; break;
    case 1: b[1] -= d; break;
    case 2: b[5] += d; break;
    case 3: b[2] -= d; break;
    case 4: b[3] += d; break;
    case 5: b[0] -= d; break;
    default: break;
  }
  return b;
}
// the direction a shulker's growing box pushes things (EntityShulker.onUpdate, MoverType.SHULKER)
const SHULKER_PUSH = [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]];

const MOB_NAMES = {
  50: 'Creeper', 51: 'Skeleton', 52: 'Spider', 53: 'Giant', 54: 'Zombie', 55: 'Slime', 56: 'Ghast', 57: 'PigZombie', 58: 'Enderman',
  59: 'CaveSpider', 60: 'Silverfish', 61: 'Blaze', 62: 'LavaSlime', 63: 'EnderDragon', 64: 'WitherBoss', 65: 'Bat', 66: 'Witch',
  67: 'Endermite', 68: 'Guardian', 90: 'Pig', 91: 'Sheep', 92: 'Cow', 93: 'Chicken', 94: 'Squid', 95: 'Wolf', 96: 'MushroomCow',
  97: 'SnowMan', 98: 'Ozelot', 99: 'VillagerGolem', 100: 'EntityHorse', 101: 'Rabbit', 120: 'Villager',
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

// 1.13 item frames can also face up/down. Unlike paintings their spawn data is
// EnumFacing's six-direction index: down, up, north, south, west, east.
export function itemFrameBox(x, y, z, face) {
  const d = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][face] || [0, 0, 1];
  const c = [Math.floor(x) + 0.5, Math.floor(y) + 0.5, Math.floor(z) + 0.5].map((v, i) => v - d[i] * 0.46875);
  const h = d.map(v => v ? 1 / 32 : 12 / 32);
  return [...c.map((v, i) => v - h[i]), ...c.map((v, i) => v + h[i])];
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
      // EntityTracker server position, in 1/4096 block (1.9+)
      serverX: Math.round(x * 4096), serverY: Math.round(y * 4096), serverZ: Math.round(z * 4096),
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
    e.entityName = 'player';
    e.typeName = 'Player';
    e.uuid = p.playerUUID;
    const info = this.game.scoreboard.players ? this.game.scoreboard.players.get(p.playerUUID) : null;
    e.name = info ? info.name : '';
    // the held item arrives as entity equipment (1.9+)
    e.width = 0.6; e.height = 1.8; e.eyeHeight = 1.62;
    e.metadata = p.metadata;
    this._applyMeta(e);
    this.add(e);
  }

  spawnMob(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z, p.yaw, p.pitch);
    const def = ENTITY_TYPES[p.type];
    e.entityType = p.type; // the unmodified wire ID, never an internal family
    e.entityNamespace = 'entity';
    e.entityName = def ? def.name : null;
    e.uuid = p.entityUUID;
    const fam = MOB_FAMILIES[e.entityName];
    e.type = fam ? fam[0] : e.entityName || `unknown:${p.type}`;
    if (fam && fam[1]) Object.assign(e, fam[1]);
    e.kind = e.entityName === 'armor_stand' ? 'armorstand' : def && def.mob ? 'mob' : 'unknown_mob';
    e.typeName = MOB_NAMES[e.type] || e.entityName || 'Unknown entity';
    e.headYaw = e.prevHeadYaw = p.headPitch; // packet's "headPitch" is the head yaw
    e.width = def ? def.width : 0; e.height = def ? def.height : 0; e.eyeHeight = def ? def.eyeHeight : 0;
    if (e.kind === 'unknown_mob') e.pickable = false;
    if (e.entityName === 'shulker') e.shulkerColor = 16;
    if (e.entityName === 'snow_golem') e.hasPumpkin = true;
    if (e.kind === 'armorstand') e.armorFlags = 0;
    e.motionX = p.velocity.x / 8000; e.motionY = p.velocity.y / 8000; e.motionZ = p.velocity.z / 8000;
    e.metadata = p.metadata;
    this._applyMeta(e);
    this.add(e);
  }

  spawnObject(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z, p.yaw, p.pitch);
    const def = OBJECT_TYPES[p.type];
    e.kind = def ? def.kind : 'unknown_object';
    e.entityType = p.type;
    e.entityNamespace = 'object';
    e.entityName = def ? def.name : null;
    e.uuid = p.objectUUID;
    // Existing object renderers still select by object ID, in their own namespace.
    e.type = p.type;
    e.typeName = e.entityName || 'Unknown object';
    e.objectData = p.objectData;
    e.width = def ? def.width : 0; e.height = def ? def.height : 0; e.eyeHeight = def ? def.eyeHeight : 0;
    e.pickable = ['boat', 'minecart', 'crystal', 'itemframe', 'leash', 'armorstand', 'shulker_bullet'].includes(e.kind) || e.entityName === 'fireball';
    // crd.a(iz) consumes velocity in constructors for spit/bullets and acceleration
    // for fireballs, then clears data for these and several immobile objects.
    const ignoresVelocity = ['fishing_bobber', 'item_frame', 'leash_knot', 'potion', 'experience_bottle', 'falling_block'];
    if (p.velocity) {
      const v = [p.velocity.x / 8000, p.velocity.y / 8000, p.velocity.z / 8000];
      if (FIREBALLS.has(e.entityName)) {
        const length = Math.hypot(...v);
        [e.accelX, e.accelY, e.accelZ] = v.map(n => length ? n / length * 0.1 : 0);
      } else if (e.entityName === 'llama_spit' || e.entityName === 'shulker_bullet' || (p.objectData > 0 && !ignoresVelocity.includes(e.entityName))) {
        [e.motionX, e.motionY, e.motionZ] = v;
      }
    }
    if (ARROWS.has(e.entityName)) e.owner = p.objectData > 0 ? p.objectData - 1 : -1;
    switch (e.entityName) {
      case 'item': e.hoverStart = Math.random() * Math.PI * 2; break;
      case 'minecart': e.cartType = p.objectData; e.entityName = MINECART_NAMES[p.objectData] || 'minecart'; break;
      case 'tnt': e.fuse = 80; break;
      case 'end_crystal': e.showBottom = true; break;
      case 'falling_block': e.blockState = p.objectData; break; // flattened direct state, not id/meta
      case 'item_frame':
        e.facing = p.objectData;
        e.blockPos = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
        e.box = itemFrameBox(p.x, p.y, p.z, e.facing);
        break;
      case 'armor_stand': e.armorFlags = 0; break;
      case 'fishing_bobber': e.owner = p.objectData; break;
      case 'area_effect_cloud': e.radius = 3; break;
      case 'evoker_fangs': e.fangsLife = 22; e.fangsActive = false; e.fangsProgress = e.prevFangsProgress = 0; break;
      default: break;
    }
    this.add(e);
  }

  spawnPainting(p) {
    const e = this._base(p.entityId, p.location.x + 0.5, p.location.y + 0.5, p.location.z + 0.5);
    e.kind = 'painting';
    e.entityName = 'painting';
    e.uuid = p.entityUUID;
    e.typeName = 'Painting';
    e.paintingId = p.title;
    const art = PAINTINGS[p.title];
    e.paintingName = art ? art[0] : null;
    e.title = art ? art[1] : null;
    e.facing = p.direction; // horizontal index: 0 south, 1 west, 2 north, 3 east
    e.blockPos = p.location;
    e.width = art ? art[2] / 16 : 0; e.height = art ? art[3] / 16 : 0;
    if (art) e.box = hangingBox(p.location.x, p.location.y, p.location.z, e.facing, art[2], art[3]);
    this.add(e);
  }

  spawnXpOrb(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z);
    e.kind = 'xp';
    e.entityName = 'experience_orb';
    e.typeName = 'XPOrb';
    e.count = p.count;
    e.pickable = false;
    e.width = 0.5; e.height = 0.5;
    this.add(e);
  }

  spawnLightning(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z);
    e.kind = 'lightning';
    e.entityName = 'lightning_bolt';
    e.entityType = p.type;
    e.entityNamespace = 'weather';
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
    // EntityBoat.setPositionAndRotationDirect: lerpSteps = 10; EntityMinecart: turnProgress = increments + 2
    if (e.kind === 'boat') e.inc = 10;
    else if (e.kind === 'minecart') e.inc = inc + 2;
    if (SNAP_KINDS.has(e.kind)) {
      // Non-living entities snap like vanilla's setPositionAndRotation for these
      e.inc = 1;
    }
  }

  relMove(p, move, look) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    e.serverX += Math.round(p.dX * 4096);
    e.serverY += Math.round(p.dY * 4096);
    e.serverZ += Math.round(p.dZ * 4096);
    if (e.controlled) return; // NetHandlerPlayClient: !entity.canPassengerSteer()
    const yaw = look ? p.yaw : (e.inc > 0 ? e.newYaw : e.yaw);
    const pitch = look ? p.pitch : (e.inc > 0 ? e.newPitch : e.pitch);
    this._setTarget(e, e.serverX / 4096, e.serverY / 4096, e.serverZ / 4096, yaw, pitch);
    e.onGround = p.onGround;
  }

  look(p) {
    const e = this.map.get(p.entityId);
    if (!e || e.controlled) return;
    this._setTarget(e, e.inc > 0 ? e.newX : e.x, e.inc > 0 ? e.newY : e.y, e.inc > 0 ? e.newZ : e.z, p.yaw, p.pitch);
    e.onGround = p.onGround;
  }

  teleport(p) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    e.serverX = Math.round(p.x * 4096); e.serverY = Math.round(p.y * 4096); e.serverZ = Math.round(p.z * 4096);
    if (e.controlled) return;
    // handleEntityTeleport (1.9+): close to the current position only the rotation changes
    if (Math.abs(e.x - p.x) < 0.03125 && Math.abs(e.y - p.y) < 0.015625 && Math.abs(e.z - p.z) < 0.03125) this._setTarget(e, e.x, e.y, e.z, p.yaw, p.pitch);
    else this._setTarget(e, p.x, p.y, p.z, p.yaw, p.pitch);
    e.onGround = p.onGround;
  }

  headLook(p) {
    const e = this.map.get(p.entityId);
    if (e) e.headYaw = p.headYaw;
  }

  // slot: 0 main hand, 1 off hand, 2 feet, 3 legs, 4 chest, 5 head; equipment[] is [held, feet, legs, chest, head]
  setEquipment(id, slot, item) {
    const e = this.map.get(id);
    if (!e) return;
    if (slot === 0) e.equipment[0] = item;
    else if (slot === 1) e.offhand = item;
    else if (slot >= 2 && slot <= 5) e.equipment[slot - 1] = item;
  }

  setMetadata(id, meta) {
    const e = this.map.get(id);
    if (!e) return;
    Object.assign(e.metadata, meta);
    this._applyMeta(e, meta);
  }

  // 1.13.2 data parameters, audited through each class's superclass chain in the
  // client jar. Dispatch ONLY by canonical identity; e.type is a renderer selector.
  // Apply deltas, not the accumulated snapshot (e.g. an unrelated update must not
  // restart a TNT fuse). The complete wire values remain available in e.metadata.
  _applyMeta(e, m = e.metadata) {
    const name = e.entityName;
    const set = (index, key) => { if (m[index] !== undefined) e[key] = m[index]; };
    const bit = (index, mask, key) => { if (m[index] !== undefined) e[key] = !!(m[index] & mask); };
    if (m[0] !== undefined) {
      e.prevSwimming = !!e.swimming;
      e.onFire = !!(m[0] & 1);
      e.sneaking = !!(m[0] & 2);
      e.sprinting = !!(m[0] & 8);
      e.swimming = !!(m[0] & 16);
      e.invisible = !!(m[0] & 32);
      e.glowing = !!(m[0] & 64);
      e.elytraFlying = !!(m[0] & 128);
    }
    // 1.13 index 2 is optional chat (metadata type 5), including null to clear.
    // Keep metadata raw; renderers consume only the converted display property.
    if (m[2] !== undefined) e.customName = chatToLegacy(m[2]);
    if (m[3] !== undefined) e.nameVisible = !!m[3];
    if (m[4] !== undefined) e.silent = !!m[4];
    if (m[5] !== undefined) e.noGravity = !!m[5];
    set(1, 'air');
    const living = e.kind === 'mob' || e.kind === 'player' || e.kind === 'armorstand';
    if (living) {
      if (m[6] !== undefined) {
        e.usingItem = !!(m[6] & 1); e.activeHand = m[6] & 2 ? 1 : 0; e.riptide = !!(m[6] & 4);
      }
      if (m[7] !== undefined) {
        const prev = e.health;
        e.health = m[7];
        if (e.health <= 0 && prev > 0) e.dead = true;
      }
      set(8, 'potionColor'); set(9, 'potionAmbient'); set(10, 'arrowCount');
    }
    if (name === 'player' || e.kind === 'player') {
      set(11, 'absorption'); set(12, 'score'); set(13, 'skinFlags'); set(14, 'mainHand');
      set(15, 'leftShoulder'); set(16, 'rightShoulder'); // NBT, not optional block states
    }
    if (name === 'armor_stand' || e.kind === 'armorstand') {
      if (m[11] !== undefined) {
        e.armorFlags = m[11];
        e.small = !!(m[11] & 1); e.showArms = !!(m[11] & 4); e.noBasePlate = !!(m[11] & 8); e.marker = !!(m[11] & 16);
        const scale = e.marker ? 0 : e.small ? 0.5 : 1;
        e.width = 0.5 * scale; e.height = 1.975 * scale;
        e.eyeHeight = e.small ? e.height * 0.5 : e.height * 0.9;
        e.pickable = !e.marker;
      }
      for (const [i, part] of ['head', 'body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].entries()) {
        if (m[i + 12] !== undefined) (e.poses || (e.poses = {}))[part] = m[i + 12];
      }
    }
    if (ARROWS.has(name)) {
      bit(6, 1, 'critical'); set(7, 'ownerUuid');
      if (name === 'arrow') set(8, 'arrowColor');
      if (name === 'trident') set(8, 'loyalty');
    }
    if (e.kind === 'minecart') {
      set(6, 'rollingAmplitude'); set(7, 'rollingDirection'); set(8, 'cartDamage');
      set(9, 'displayBlock'); set(10, 'displayOffset'); set(11, 'customDisplay'); // direct block state
    }
    switch (name) {
      case 'item': case 'potion': set(6, 'item'); break;
      case 'item_frame': set(6, 'item'); set(7, 'rotation'); break;
      case 'firework_rocket': set(6, 'item'); set(7, 'boostedId'); break;
      case 'fishing_bobber': if (m[6] !== undefined) e.hookedEntityId = m[6] - 1; break;
      case 'falling_block': set(6, 'origin'); break;
      case 'tnt': set(6, 'fuse'); break;
      case 'wither_skull': set(6, 'invulnerable'); break;
      case 'end_crystal': set(6, 'beamTarget'); set(7, 'showBottom'); break;
      case 'boat':
        set(6, 'timeSinceHit'); set(7, 'forwardDirection'); set(8, 'damageTaken'); set(9, 'boatType');
        set(10, 'paddleLeft'); set(11, 'paddleRight'); set(12, 'bubbleTime'); break;
      case 'furnace_minecart': set(12, 'furnacePowered'); break;
      case 'command_block_minecart': set(12, 'command'); set(13, 'lastOutput'); break;
      case 'area_effect_cloud':
        if (m[6] !== undefined) { e.radius = m[6]; e.width = e.radius * 2; e.height = 0.5; }
        set(7, 'cloudColor'); set(8, 'singlePoint'); set(9, 'particle'); break;
      default: break; // no additional data parameters for other object classes
    }
    if (e.kind === 'mob') {
      bit(11, 1, 'noAI'); bit(11, 2, 'leftHanded');
      if ((AGEABLE.has(name) || ZOMBIES.has(name)) && m[12] !== undefined) {
        e.child = !!m[12];
        const def = ENTITIES_BY_NAME[name], scale = e.child ? 0.5 : 1;
        e.width = def.width * scale; e.height = def.height * scale; e.eyeHeight = def.eyeHeight * scale;
        if (ZOMBIES.has(name) && e.child) e.eyeHeight = 0.93;
        if ((name === 'cow' || name === 'mooshroom') && e.child) e.eyeHeight = e.height;
        if (name === 'turtle' && e.child) { e.width = 0.36; e.height = 0.12; e.eyeHeight = 0.102; }
      }
      if (ZOMBIES.has(name)) {
        set(13, 'zombieSpecialType'); set(14, 'armsRaised'); set(15, 'convertingToDrowned');
        if (name === 'zombie_villager') { set(16, 'converting'); set(17, 'villagerProfession'); }
      }
      if (FISH.has(name)) set(12, 'fromBucket'); // NOT EntityAgeable's baby flag
      if (name === 'wolf' || name === 'ocelot' || name === 'parrot') {
        bit(13, 1, 'sitting'); bit(13, 4, 'tamed'); set(14, 'ownerUuid');
      }
      if (HORSES.has(name)) {
        bit(13, 2, 'tamed'); bit(13, 4, 'saddled'); bit(13, 8, 'horseBred');
        set(14, 'ownerUuid');
        if (name === 'donkey' || name === 'mule' || name === 'llama') set(15, 'horseChest');
        if (m[13] !== undefined || m[15] !== undefined) {
          const f = e.metadata[13] || 0;
          // Preserve the existing renderer's horse flag layout at this boundary.
          e.horseFlags = (f & 2) | (f & 4) | (e.horseChest ? 8 : 0) | (f & 16 ? 32 : 0) | (f & 32 ? 64 : 0) | (f & 64 ? 128 : 0);
        }
      }
      switch (name) {
        case 'bat': bit(12, 1, 'hanging'); break;
        case 'blaze': bit(12, 1, 'blazeOnFire'); break;
        case 'creeper': set(12, 'creeperState'); set(13, 'powered'); set(14, 'ignited'); break;
        case 'skeleton': case 'wither_skeleton': case 'stray': set(12, 'armsRaised'); break;
        case 'spider': case 'cave_spider': bit(12, 1, 'climbing'); break;
        case 'slime': case 'magma_cube':
          if (m[12] !== undefined) {
            e.size = m[12]; e.width = e.height = 0.51000005 * e.size; e.eyeHeight = e.height * 0.625;
          }
          break;
        case 'enderman':
          set(12, 'carriedBlockState'); set(12, 'carried'); set(13, 'screaming'); break;
        case 'ender_dragon': set(12, 'dragonPhase'); break;
        case 'ghast': set(12, 'attacking'); break;
        case 'guardian': case 'elder_guardian': set(12, 'guardianMoving'); if (m[13] !== undefined && e.guardianTarget !== m[13]) { e.guardianTarget = m[13]; e.guardianBeamTicks = 0; } break;
        case 'shulker':
          set(12, 'attachFace'); set(13, 'attachPosition'); set(14, 'peekTick'); set(15, 'shulkerColor'); break;
        case 'wither':
          if ([12, 13, 14].some(i => m[i] !== undefined)) e.witherTargets = [12, 13, 14].map(i => e.metadata[i] || 0);
          set(15, 'invulTime'); break;
        case 'witch': set(12, 'witchAggressive'); break;
        case 'evoker': case 'illusioner': set(13, 'spell'); // fall through: AbstractIllager flags
        case 'vindicator': bit(12, 1, 'armsRaised'); set(12, 'illagerFlags'); break;
        case 'vex': bit(12, 1, 'charging'); break;
        case 'pig': set(13, 'saddled'); set(14, 'boostTime'); break;
        case 'sheep': if (m[13] !== undefined) { e.fleece = m[13] & 15; e.sheared = !!(m[13] & 16); } break;
        case 'wolf': bit(13, 2, 'angry'); set(15, 'wolfHealth'); set(16, 'begging'); set(17, 'collar'); break;
        case 'ocelot': set(15, 'catType'); break;
        case 'parrot': set(15, 'parrotVariant'); break;
        case 'rabbit': set(13, 'rabbitType'); break;
        case 'villager': set(13, 'profession'); break;
        case 'horse': set(15, 'horseVariant'); set(16, 'horseArmor'); break;
        case 'llama': set(16, 'llamaStrength'); set(17, 'llamaCarpet'); set(18, 'llamaVariant'); break;
        case 'polar_bear': set(13, 'standing'); break;
        case 'snow_golem': bit(12, 16, 'hasPumpkin'); break;
        case 'iron_golem': bit(12, 1, 'playerCreated'); break;
        case 'dolphin': set(12, 'treasurePosition'); set(13, 'gotFish'); set(14, 'moistness'); break;
        case 'turtle':
          set(13, 'homePosition'); set(14, 'hasEgg'); set(15, 'layingEgg'); set(16, 'travelPosition');
          set(17, 'goingHome'); set(18, 'travelling'); break;
        case 'pufferfish':
          if (m[13] !== undefined) {
            e.puffState = m[13]; e.width = e.height = 0.7 * (e.puffState === 0 ? 0.5 : e.puffState === 1 ? 0.7 : 1);
            e.eyeHeight = e.height * 0.65;
          }
          break;
        case 'tropical_fish': set(13, 'fishVariant'); break;
        case 'phantom':
          if (m[12] !== undefined) {
            e.phantomSize = m[12]; e.width = 0.9 + 0.2 * e.phantomSize; e.height = 0.5 + 0.1 * e.phantomSize;
            e.eyeHeight = e.height * 0.35;
          }
          break;
        // Chicken, cow, mooshroom, horses without subclass fields, squid,
        // silverfish, endermite, cod, salmon, giant: inherited parameters only.
        default: break;
      }
    }
  }

  setAttributes(p) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    e.attributes = e.attributes || {};
    for (const prop of p.properties) {
      if (prop.key === 'generic.maxHealth') e.maxHealth = prop.value;
      e.attributes[prop.key] = prop; // movement speed and jump strength drive a ridden horse
    }
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
      case 0: case 3: // swing main hand / off hand
        if (!e.swinging || e.swingTicks >= 3 || e.swingTicks < 0) { e.swingTicks = -1; e.swinging = true; e.swingHand = p.animation === 3 ? 1 : 0; }
        break;
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
      case 4: if (e.entityName === 'evoker_fangs') e.fangsActive = true; break;
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

  // The vehicle's passengers in the server's order (SPacketSetPassengers; the first one steers)
  passengersOf(vehicleId) {
    const v = this.map.get(vehicleId);
    if (v && v.passengerList) return v.passengerList.slice();
    const out = [];
    for (const e of this.map.values()) if (e.riding === vehicleId) out.push(e.id);
    if (this.game.ridingEntityId === vehicleId && !out.includes(this.game.entityId)) out.push(this.game.entityId);
    return out;
  }

  setLeash(id, holder) {
    const e = this.map.get(id);
    if (e) e.leashHolder = holder;
  }

  isHorse(id) { const e = this.map.get(id); return !!e && e.kind === 'mob' && e.type === 100; }
  isLiving(id) { const e = this.map.get(id); return !!e && e.kind === 'mob'; }

  // Height offsets for riding (Entity.getMountedYOffset / getYOffset)
  // Entity.updatePassenger: on the vehicle at getMountedYOffset + the rider's getYOffset (players -0.35). Boats
  // (EntityBoat.updatePassenger) seat two riders apart: the first 0.2 forward, the second 0.6 back (animals 0.2 further
  // forward), along Vec3d(f, 0, 0).rotateYaw(-yaw - 90 degrees)
  riderPos(v, riderId, riderKind) {
    const y = v.y + this.mountedOffset(v) + (riderKind === 'player' ? -0.35 : 0);
    if (v.kind !== 'boat') return [v.x, y, v.z];
    const list = this.passengersOf(v.id);
    if (list.length < 2) return [v.x, y, v.z];
    let f = list.indexOf(riderId) === 0 ? Math.fround(0.2) : Math.fround(-0.6);
    const r = this.map.get(riderId);
    if (r && r.kind === 'mob' && ANIMALS.has(r.entityName)) f = Math.fround(f + 0.2);
    const a = Math.fround(Math.fround(-v.yaw * Math.fround(Math.PI / 180)) - Math.fround(Math.PI / 2));
    return [v.x + f * mcCos(a), y, v.z - f * mcSin(a)];
  }

  mountedOffset(v) {
    if (v.kind === 'boat') return -0.1;     // EntityBoat.getMountedYOffset (1.9+)
    if (v.kind === 'minecart') return 0;    // EntityMinecart.getMountedYOffset (1.9+)
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
      const itemName = held ? this.game.items.name(held.id) : null;
      if (e.entityName === 'villager' || HORSES.has(e.entityName)) return true;
      if ((e.entityName === 'cow' || e.entityName === 'mooshroom') && itemName === 'bucket') return true;
      if (e.entityName === 'sheep' && itemName === 'shears') return true;
      if (itemName === 'name_tag' || itemName === 'lead') return true;
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

  // Pseudo-entity mirroring the local player (rendered in third person)
  updateSelf() {
    const g = this.game;
    const pl = g.player;
    let s = this.self;
    if (!s) {
      s = this.self = this._base(-1, pl.x, pl.y, pl.z, pl.yaw, pl.pitch);
      s.kind = 'player'; s.entityName = 'player'; s.typeName = 'Player'; s.pickable = false;
    }
    s.uuid = g.playerUuid || s.uuid; s.name = g.username;
    s.prevX = s.x; s.prevY = s.y; s.prevZ = s.z;
    s.prevYaw = s.yaw; s.prevPitch = s.pitch; s.prevHeadYaw = s.headYaw; s.prevBodyYaw = s.bodyYaw;
    s.prevLimbSwingAmount = s.limbSwingAmount;
    s.x = pl.x; s.y = pl.y; s.z = pl.z;
    s.yaw = pl.yaw; s.pitch = pl.pitch; s.headYaw = pl.yaw;
    s.sneaking = pl.sneaking && !pl.flying; s.swimming = !!pl.swimming;
    s.inWater = !!pl.inWater; s.onGround = pl.onGround;
    s.usingItem = pl.usingItem; s.riptide = !!pl.riptide;
    s.riding = g.ridingEntityId;
    s.ticks++;
    const it = g.interaction;
    s.prevSwingProgress = it.prevSwingProgress; s.swingProgress = it.swingProgress;
    s.equipment = [g.inventory.held(), g.inventory.armor[0], g.inventory.armor[1], g.inventory.armor[2], g.inventory.armor[3]];
    s.offhand = g.inventory.offhand;
    s.activeHand = it.activeHand || 0; s.swingHand = it.swingHand || 0;
    s.mainHand = g.settings.mainHand === 'left' ? 0 : 1;
    s.elytraFlying = !!pl.elytraFlying;
    s.motionX = pl.motionX; s.motionY = pl.motionY; s.motionZ = pl.motionZ;
    s.hurtTime = g.hurtTime; s.deathTime = g.dead ? Math.min(20, (s.deathTime || 0) + 1) : 0;
    s.metadata = g.selfMetadata || s.metadata;
    if (s.metadata && s.metadata[13] !== undefined) s.skinFlags = s.metadata[13]; else s.skinFlags = g.settings.skinParts;
    s.invisible = !!(g.selfMetadata && (g.selfMetadata[0] & 32)) || g.effects.has(14);
    s.onFire = g.selfMetadata ? !!(g.selfMetadata[0] & 1) : false;
    // LayerCape's sway from the view bobbing of the local player
    s.prevCameraYaw = pl.prevCameraYaw; s.cameraYaw = pl.cameraYaw;
    s.prevDistanceWalked = pl.prevDistanceWalked; s.distanceWalked = pl.distanceWalked;
    this._livingUpdate(s);
    this._updateCape(s);
  }

  // EntityPlayer.updateCape: a point trailing the player (snaps when more than 10 blocks behind), for LayerCape
  _updateCape(e) {
    if (e.chasingX === undefined) { e.chasingX = e.prevChasingX = e.x; e.chasingY = e.prevChasingY = e.y; e.chasingZ = e.prevChasingZ = e.z; }
    e.prevChasingX = e.chasingX; e.prevChasingY = e.chasingY; e.prevChasingZ = e.chasingZ;
    for (const [c, p] of [['chasingX', 'x'], ['chasingY', 'y'], ['chasingZ', 'z']]) {
      const d = e[p] - e[c];
      if (d > 10 || d < -10) { e[c] = e[p]; e['prev' + c[0].toUpperCase() + c.slice(1)] = e[c]; }
    }
    e.chasingX += (e.x - e.chasingX) * 0.25; e.chasingY += (e.y - e.chasingY) * 0.25; e.chasingZ += (e.z - e.chasingZ) * 0.25;
  }

  // EntityDragon.onLivingUpdate (client part): wing animation clock and the 64-tick (yaw, y) ring buffer
  // that drives the neck and tail
  // EntityBoat.onUpdate: hurt wobble countdown and paddle positions (the steered boat uses our own paddle input)
  _boatTick(e) {
    if (e.timeSinceHit > 0) e.timeSinceHit--;
    if (e.damageTaken > 0) e.damageTaken--;
    if (!e.paddlePositions) e.paddlePositions = [0, 0];
    const st = e.controlled && this.game.vehicle && this.game.vehicle.e === e ? this.game.vehicle.paddles : [e.paddleLeft, e.paddleRight];
    e.paddleState = [!!st[0], !!st[1]];
    for (let i = 0; i < 2; i++) {
      if (e.paddleState[i]) {
        const pp = e.paddlePositions[i];
        if (pp % (Math.PI * 2) <= Math.PI / 4 && (pp + 0.39269909262657166) % (Math.PI * 2) >= Math.PI / 4) {
          // EntityBoat.getPaddleSound: water while floating / submerged, land on the ground, none in the air
          const ctl = this.game.vehicle && this.game.vehicle.e === e ? this.game.vehicle : null;
          let snd;
          if (ctl) snd = ctl.status === 'land' ? 'entity.boat.paddle_land' : ctl.status === 'air' ? null : 'entity.boat.paddle_water';
          else {
            snd = isPointInFluid(this.game.world, e.x, e.y + 0.1, e.z) ? 'entity.boat.paddle_water' : 'entity.boat.paddle_land';
          }
          if (snd) this.game.sound.play(snd, e.x, e.y, e.z, 1, 0.8 + 0.4 * Math.random());
        }
        e.paddlePositions[i] = Math.fround(pp + 0.39269909262657166);
      } else e.paddlePositions[i] = 0;
    }
  }

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
    if (e.dead) { this._dragonParts(e); return; }
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
      if (e.entityName === 'ender_dragon') { if (e.parts) yield* e.parts; continue; }
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
        g.sound.playLoop('entity.minecart.riding', e.x, e.y, e.z, { category: 'neutral' }).then((h) => { e.rollSound = h; if (!this.map.has(e.id) && h) h.stop(); });
      }
      if (e.rollSound) { e.rollSound.setPosition([e.x, e.y, e.z]); e.rollSound.setVolume(f >= 0.01 ? Math.min(f, 0.5) * 0.7 : 0); }
      const riding = g.ridingEntityId === e.id;
      if (riding && !e.insideSound && !e.insideSoundPending) {
        e.insideSoundPending = true;
        g.sound.playLoop('entity.minecart.inside', 0, 0, 0, { global: true, category: 'neutral' }).then((h) => { e.insideSound = h; });
      }
      if (e.insideSound) {
        if (!riding) { e.insideSound.stop(); e.insideSound = null; e.insideSoundPending = false; }
        else e.insideSound.setVolume(f >= 0.01 ? Math.min(f, 1) * 0.75 : 0);
      }
    }
  }

  // EntityFireworkRocket.onUpdate, client side: a rocket attached to the gliding local player pushes it along its look
  // EntityFireworkRocket.onUpdate (client): attached to a gliding entity it sits on it, else it speeds up (x / z * 1.15,
  // y + 0.04); a spark every tick at y - 0.3
  _fireworkTick(e) {
    const g = this.game;
    if (e.boostedId) {
      const b = e.boostedId === g.entityId ? g.player : this.map.get(e.boostedId);
      if (b) {
        e.x = b.x; e.y = b.y; e.z = b.z; e.inc = 0;
        e.motionX = b.motionX || 0; e.motionY = b.motionY || 0; e.motionZ = b.motionZ || 0;
      }
    } else if (!(e.inc > 0)) {
      e.motionX = (e.motionX || 0) * 1.15; e.motionZ = (e.motionZ || 0) * 1.15; e.motionY = (e.motionY || 0) + 0.04;
      e.x += e.motionX; e.y += e.motionY; e.z += e.motionZ;
    }
    g.particles.spark(e.x, e.y - 0.3, e.z, gauss() * 0.05, -(e.motionY || 0) * 0.5, gauss() * 0.05);
  }

  _fireworkBoost(e) {
    const pl = this.game.player;
    if (!pl.elytraFlying) return;
    const yaw = pl.yaw, pitch = pl.pitch;
    const fr = Math.fround, f = fr(0.017453292), PI = fr(Math.PI);
    const c1 = mcCos(fr(fr(-yaw * f) - PI)), s1 = mcSin(fr(fr(-yaw * f) - PI));
    const c2 = -mcCos(fr(-pitch * f)), s2 = mcSin(fr(-pitch * f));
    const lx = s1 * c2, ly = s2, lz = c1 * c2;
    pl.motionX += lx * 0.1 + (lx * 1.5 - pl.motionX) * 0.5;
    pl.motionY += ly * 0.1 + (ly * 1.5 - pl.motionY) * 0.5;
    pl.motionZ += lz * 0.1 + (lz * 1.5 - pl.motionZ) * 0.5;
  }

  tick() {
    const g = this.game;
    this.updateSelf();
    this._minecartSounds();
    for (const e of [...this.map.values()]) {
      // the vehicle we steer was already moved this tick (Game._tickRiding set its previous position)
      if (!e.controlled) {
        e.prevX = e.x; e.prevY = e.y; e.prevZ = e.z;
        e.prevYaw = e.yaw;
      }
      e.prevPitch = e.pitch;
      e.prevHeadYaw = e.headYaw;
      e.prevBodyYaw = e.bodyYaw;
      e.prevLimbSwingAmount = e.limbSwingAmount;
      e.prevSwingProgress = e.swingProgress;
      e.ticks++;
      if (e.boostedId && e.boostedId === g.entityId) this._fireworkBoost(e);
      if (e.entityName === 'firework_rocket') this._fireworkTick(e);
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
      // Riding: placed on the vehicle after every vehicle has moved (second pass below)
      if (e.riding >= 0 && this.map.get(e.riding)) {
        e.inc = 0;
      } else if (e.inc > 0) {
        e.x += (e.newX - e.x) / e.inc;
        e.y += (e.newY - e.y) / e.inc;
        e.z += (e.newZ - e.z) / e.inc;
        e.yaw += wrap(e.newYaw - e.yaw) / e.inc;
        e.pitch += (e.newPitch - e.pitch) / e.inc;
        e.inc--;
      } else if (SNAP_KINDS.has(e.kind) && e.kind !== 'fishhook' && e.entityName !== 'firework_rocket') {
        // Client-side motion between server updates
        if (!ARROWS.has(e.entityName) || !e.inGround) {
          e.x += e.motionX; e.y += e.motionY; e.z += e.motionZ;
          const fireball = FIREBALLS.has(e.entityName), bullet = e.entityName === 'shulker_bullet';
          const drag = fireball ? 0.95 : e.kind === 'item' || e.kind === 'xp' ? 0.98 : 0.99;
          const gravity = e.noGravity || fireball || bullet ? 0 : ARROWS.has(e.entityName) ? 0.05 : e.entityName === 'llama_spit' ? 0.06 : e.kind === 'projectile' || e.kind === 'xp' ? 0.03 : 0.04;
          e.motionX = (e.motionX + (e.accelX || 0)) * drag;
          e.motionY = (e.motionY + (e.accelY || 0) - gravity) * (fireball || bullet ? drag : 0.98);
          e.motionZ = (e.motionZ + (e.accelZ || 0)) * drag;
          // stop at the ground
          const st = g.world.getState(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
          const b = getBlock(st);
          if (b && b.opaque) { e.y = Math.floor(e.y) + 1; e.motionY = 0; e.motionX *= 0.5; e.motionZ *= 0.5; }
        }
      }
      tickEntityEffects(e, this);
      if (e.entityName === 'ender_dragon') this._dragonUpdate(e);
      if (e.kind === 'tnt') e.fuse = Math.max(0, (e.fuse ?? 80) - 1);
      if (e.entityName === 'evoker_fangs' && e.fangsActive) {
        // EntityEvokerFangs aoo: status 4 starts its 22-tick life; animation lasts 20.
        e.prevFangsProgress = e.fangsProgress;
        e.fangsLife--;
        e.fangsProgress = Math.min(1, (22 - e.fangsLife) / 20);
      }
      if (e.kind === 'boat') this._boatTick(e);
      if (e.kind === 'minecart') { // EntityMinecart.onUpdate: both count down on the client too
        if (e.rollingAmplitude > 0) e.rollingAmplitude--;
        if (e.cartDamage > 0) e.cartDamage = Math.max(0, e.cartDamage - 1);
      }
      if (e.entityName === 'shulker') {
        // EntityShulker.onUpdate (client): peek amount follows the peek tick by 0.05, body fixed at 180
        const f1 = (e.peekTick || 0) * 0.01;
        e.prevPeek = e.peek || 0;
        if (e.prevPeek > f1) e.peek = Math.max(f1, Math.min(1, e.prevPeek - 0.05));
        else if (e.prevPeek < f1) e.peek = Math.max(0, Math.min(f1, e.prevPeek + 0.05));
        // opening pushes whatever its box now overlaps (the local player is ours to move)
        const grow = (0.5 - Math.sin((0.5 + e.peek) * Math.PI) * 0.5) - (0.5 - Math.sin((0.5 + e.prevPeek) * Math.PI) * 0.5);
        const pl = g.player;
        if (grow > 0 && pl && !pl.spectator && !pl.noClip) {
          const b = shulkerBox(e), pb = pl.bb();
          if (b[3] > pb[0] && b[0] < pb[3] && b[4] > pb[1] && b[1] < pb[4] && b[5] > pb[2] && b[2] < pb[5]) {
            const d = SHULKER_PUSH[e.attachFace || 0];
            pl.moveEntity(g.world, d[0] * grow, d[1] * grow, d[2] * grow);
          }
        }
        e.bodyYaw = e.prevBodyYaw = 180;
      }
      if (e.hurtTime > 0) e.hurtTime--;
      if (e.dead) {
        e.deathTime++;
        // EntityLivingBase.onDeathUpdate: at 20 ticks the body is gone in a puff of smoke
        if (isDragon(e)) { tickDragonDeath(e, g); this._dragonParts(e); }
        else if (e.deathTime === 20 && (e.kind === 'mob' || e.kind === 'player')) g.particles.deathPoof(e);
      }
      if (e.eatingGrass > 0) e.eatingGrass--;
      // Swing progress
      if (e.swinging) {
        e.swingTicks++;
        if (e.swingTicks >= 6) { e.swingTicks = 0; e.swinging = false; }
      } else e.swingTicks = 0;
      e.swingProgress = e.swingTicks / 6;
      if (e.kind === 'player' || e.kind === 'mob' || e.kind === 'armorstand') this._livingUpdate(e);
      if (e.kind === 'player') this._updateCape(e);
      if (e.onFire && Math.random() < 0.3) g.particles.entityFire && g.particles.entityFire(e);
      // EntityLivingBase.updatePotionEffects (1.9+): colour in metadata 8, "ambient" (beacon) in 9
      const living = e.kind === 'player' || e.kind === 'mob' || e.kind === 'armorstand';
      const color = living ? e.metadata[8] | 0 : 0;
      if (color > 0) {
        const ambient = !!e.metadata[9];
        let spawn = e.invisible ? Math.random() < 1 / 15 : Math.random() < 0.5;
        if (ambient) spawn = spawn && Math.random() < 0.2;
        if (spawn) g.particles.potionSwirl && g.particles.potionSwirl(e, color, ambient);
      }
    }
    // Entity.updatePassenger: riders sit on their vehicle's new position (getMountedYOffset + the rider's getYOffset)
    for (const e of this.map.values()) {
      if (e.riding < 0) continue;
      const v = this.map.get(e.riding);
      if (v) [e.x, e.y, e.z] = this.riderPos(v, e.id, e.kind);
    }
  }

  // EntityLivingBase.onUpdate: body yaw + limb swing
  _livingUpdate(e) {
    e.elytraTicks = e.elytraFlying ? (e.elytraTicks || 0) + 1 : 0; // EntityLivingBase.ticksElytraFlying
    e.prevSwimAmount = e.swimAmount ?? 0;
    e.swimAmount = Math.max(0, Math.min(1, e.prevSwimAmount + (e.swimming ? 0.09 : -0.09)));
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
    // riding: Entity.updateRidden moves the rider after its own update, so it sees no movement and the limbs settle
    if (e.riding >= 0) f4 = 0;
    e.limbSwingAmount += (f4 - e.limbSwingAmount) * 0.4;
    e.limbSwing += e.limbSwingAmount;
    void simplify;
  }
}

export { MOB_NAMES };
