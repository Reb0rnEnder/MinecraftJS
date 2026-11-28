import { tickBat774 } from '../render/bat-1.21.11.js';
import { applyPawsMetadata774, tickArmadillo774, tickWolf774 } from './paws-1.21.11.js';
import { BOAT_TYPES_774 } from './boat-types-1.21.11.js';
import {EFFECT_774} from './effects-1.21.11.js';
import {encodeEntityPosition,relativeEntityPosition} from './entity-position.js';
import {playPickupSound} from '../audio/client-sound-triggers.js';
import { tickDroppedItem } from './dropped-item.js';
import{pickupVisual,pickupPosition,tickPickupVisuals}from'./item-pickup.js';
import{paintingFacing774,configurePainting774,PAINTING_VARIANT_INDEX_774,PAINTING_DIRECTION_INDEX_774}from'./painting-1.21.11.js';
import {isSquid,initSquid,tickSquid,squidInWater} from './squid-animation.js';
import {detachRemovedEntities} from './riding-lifecycle.js';
import {applyNetherMetadata} from './nether-metadata.js';
import {applyFoxFlags,tickFox} from './fox.js';
import {tickBeeSound,stopBeeSound} from './bee-sound.js';
import {NATIVE_METADATA as WIRE_METADATA} from './entity-metadata-1.21.11.js';
import {placeLeashKnot} from './leash-knot.js';
import {NATIVE_METADATA} from './entity-metadata-1.14.4.js';
import {playerPoseDimensions} from './player-poses-1.19.4.js';
import { tickFallingBlock } from './falling-block.js';
import { tickEntityEffects, tickDragonDeath, isDragon } from '../render/entity-effects.js';
// Client-side entity tracking (positions, interpolation, metadata, animation state).
import { simplify } from '../net/nbt.js';
import { getBlock } from '../world/blocks.js';
import { isPointInFluid } from '../world/fluids.js';
import { mcSin, mcCos } from './physics.js';
import { chatToLegacy } from '../gui/chat.js';
import { initDisplay, applyDisplayMeta, tickDisplay } from './display-entity.js';
import { applyEntityScale, setScaleAttribute } from './entity-scale.js';
import { ENTITY_TYPES, ENTITIES_BY_NAME, MOB_FAMILIES, OBJECT_TYPES, MINECART_NAMES, PAINTINGS,
  ANIMALS, AGEABLE, HORSES, ZOMBIES, FISH, ARROWS, FIREBALLS } from './entity-types.js';

// Random.nextGaussian (Box-Muller)
function gauss() { let u = 0; while (u === 0) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); }

const SNAP_KINDS = new Set(['item', 'xp', 'arrow', 'projectile', 'falling', 'tnt', 'fishhook',
  'trident', 'spectral_arrow', 'dragon_fireball', 'shulker_bullet', 'llama_spit']);

// EntityShulker's box: 1 x 1 at its position, grown towards the opening by 0.5 - sin((0.5 + peek) * PI) * 0.5
// (attach face: 0 down .. 5 east; the shell opens away from it). Returns [minX, minY, minZ, maxX, maxY, maxZ].
const CARPET_DYES=['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black'];
// An entity_effect ParticleOptions' RGB, or null for other particles
export function effectParticleColor(p){const type=String(p?.type??'').replace(/^minecraft:/,'');return type==='entity_effect'&&Number.isFinite(p.data)?p.data&0xffffff:null;}

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

// Resolve wire identities from the target registry; retain its special eye heights.
export function nativeEntityDefinition(game, id) {
  const definition=ENTITY_TYPES[id],supplied=game?.assets?.data?.entities?.find(e=>e.id===id);
  if(supplied&&definition&&supplied.name!==definition.name)throw Error('Entity registry does not match runtime: '+id);
  return definition;
}

export function nativeEntityDefinitionByName(game,name){
  const canonical=String(name||"").replace(/^minecraft:/,"");
  const renderer=ENTITIES_BY_NAME[canonical];
  const supplied=game?.assets?.data?.entities?.find(e=>e.name===canonical);
  if(!renderer&&!supplied)return null;
  const height=supplied?.height??renderer?.height??0;
  return{
    ...renderer,
    ...supplied,
    name:canonical,
    eyeHeight:renderer?.eyeHeight??height*0.85,
    mob:renderer?.mob??false
  };
}

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
    this.map = new Map();this.pickups=[];this.nextPickupId=-2147483649;
    this.fishingCast = false;
  }

  clear() {
    for (const e of this.map.values()) {
      this.game.entityRenderer.remove(e);
      stopBeeSound(e);
      if (e.rollSound) e.rollSound.stop();
      if (e.insideSound) e.insideSound.stop();
    }
    for(const e of this.pickups||[])this.game.entityRenderer.remove(e);this.pickups=[];
    this.map.clear();
    if (this.self) { this.game.entityRenderer.remove(this.self); this.self = null; }
  }

  get(id) { return this.map.get(id); }
  all() { return this.pickups?.length?this._allWithPickups():this.map.values(); }
  *_allWithPickups(){yield* this.map.values();yield* this.pickups;}
  count() { return this.map.size; }

  _base(id, x, y, z, yaw = 0, pitch = 0) {
    return {
      id, x, y, z, prevX: x, prevY: y, prevZ: z, lastTickX: x, lastTickY: y, lastTickZ: z,
      // EntityTracker server position, in 1/4096 block (1.9+)
      serverX: encodeEntityPosition(x), serverY: encodeEntityPosition(y), serverZ: encodeEntityPosition(z),
      packetX:x,packetY:y,packetZ:z,
      newX: x, newY: y, newZ: z, newYaw: yaw, newPitch: pitch, inc: 0,
      yaw, pitch, prevYaw: yaw, prevPitch: pitch, headYaw: yaw, prevHeadYaw: yaw, bodyYaw: yaw, prevBodyYaw: yaw,
      limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, swingProgress: 0, prevSwingProgress: 0, swingTicks: 0, swinging: false,
      onGround: false, metadata: {}, equipment: [null, null, null, null, null], ticks: 0, hurtTime: 0, deathTime: 0,
      motionX: 0, motionY: 0, motionZ: 0, pickable: true, width: 0.6, height: 1.8, eyeHeight: 1.62, riding: -1, passenger: -1,
      health: 20, maxHealth: 20, effects: new Map(), dead: false,
    };
  }

  add(e) {
    if(isSquid(e))initSquid(e);
    if(e.kind==='leash')placeLeashKnot(e);
    const old = this.map.get(e.id);
    if (old) { stopBeeSound(old); this.game.entityRenderer.remove(old); }
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
    if(p.headPitch!==undefined)e.headYaw=e.prevHeadYaw=p.headPitch;
    this._applyMeta(e);
    this.add(e);
  }

  spawnMob(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z, p.yaw, p.pitch);
    const def = p.entityTypeName
      ? nativeEntityDefinitionByName(this.game,p.entityTypeName)
      : nativeEntityDefinition(this.game,p.type);
    e.entityType = p.wireType ?? p.type; //// retain the target wire ID, never an internal family
    e.entityNamespace = 'entity';
    e.entityName = def ? def.name : null;
    e.uuid = p.entityUUID;
    const fam = MOB_FAMILIES[e.entityName];
    e.type = fam ? fam[0] : e.entityName || `unknown:${p.type}`;
    if (fam && fam[1]) Object.assign(e, fam[1]);
    if (e.type === 99) e.health = e.maxHealth = 100;
    if(e.entityName==='wolf')e.health=e.maxHealth=8;
    if(e.entityName==='armadillo')e.health=e.maxHealth=12;
    e.kind = e.entityName === 'armor_stand' ? 'armorstand' : def && def.mob ? 'mob' : 'unknown_mob';
    e.typeName = MOB_NAMES[e.type] || e.entityName || 'Unknown entity';
    e.headYaw = e.prevHeadYaw = p.headPitch; // packet's "headPitch" is the head yaw
    e.width = def ? def.width : 0; e.height = def ? def.height : 0; e.eyeHeight = def ? def.eyeHeight : 0;
    if (e.kind === 'unknown_mob') e.pickable = false;
    if (e.entityName === 'shulker') e.shulkerColor = 16;
    if (e.entityName === 'snow_golem') e.hasPumpkin = true;
    if (e.kind === 'armorstand') e.armorFlags = 0;
    e.motionX = p.velocity.x; e.motionY = p.velocity.y; e.motionZ = p.velocity.z;
    e.metadata = p.metadata;
    this._applyMeta(e);
    this.add(e);
  }

  spawnObject(p) {
    const e = this._base(p.entityId, p.x, p.y, p.z, p.yaw, p.pitch);
    const nativeDef=p.entityTypeName?nativeEntityDefinitionByName(this.game,p.entityTypeName):null;
    const def = nativeDef ? {...nativeDef,kind:OBJECT_TYPES[p.type]?.kind||nativeDef.name} : OBJECT_TYPES[p.type];
    e.kind = def ? def.kind : 'unknown_object';
    e.entityType = p.wireType ?? p.type;
    e.entityNamespace = 'object';
    e.entityName = def ? def.name : (p.entityTypeName || null);
    e.uuid = p.objectUUID;
    // Existing object renderers still select by object ID, in their own namespace.
    e.type = p.type;
    e.typeName = e.entityName || 'Unknown object';
    e.objectData = p.objectData;
    if (e.kind === 'boat' && e.entityName) {
      e.chestBoat = e.entityName === 'chest_boat' || e.entityName.endsWith('_chest_boat') || e.entityName.endsWith('_chest_raft');
      const wood = e.entityName.replace(/_chest_(boat|raft)$/, '').replace(/_(boat|raft)$/, '');
      e.boatType = Math.max(0, BOAT_TYPES_774.indexOf(wood));
    }
    if(e.kind==='minecart')e.cartType=Math.max(0,MINECART_NAMES.indexOf(e.entityName));
    e.width = def ? def.width : 0; e.height = def ? def.height : 0; e.eyeHeight = def ? def.eyeHeight : 0;
    e.pickable = ['boat', 'minecart', 'crystal', 'itemframe', 'leash', 'armorstand', 'shulker_bullet', 'mannequin'].includes(e.kind) || e.entityName === 'fireball';
    // Interaction defines its own dimensions, independent of EntityType's zero
    // registration size. Native bfs defaults to 1x1 and is always pickable.
    if (e.kind === 'display') { initDisplay(e, WIRE_METADATA[e.entityName]); e.noPhysics = true; }
    if (e.kind === 'interaction') {
      // Interaction changes its AABB without refreshing the zero registered eye height.
      e.width = e.height = 1; e.eyeHeight = 0;
      e.pickable = true; e.pickRadius = 0; e.noPhysics = true; e.response = false;
    }
    // Velocity already arrives decoded from lpVec3 in blocks/tick.
    const ignoresVelocity = ['fishing_bobber', 'glow_item_frame', 'item_frame', 'leash_knot', 'potion', 'splash_potion', 'lingering_potion', 'experience_bottle', 'falling_block'];
    if (p.velocity) {
      const v = [p.velocity.x, p.velocity.y, p.velocity.z];
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
      case 'glow_item_frame': case 'item_frame':
        e.facing = p.objectData;
        e.blockPos = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
        e.box = itemFrameBox(p.x, p.y, p.z, e.facing);
        break;
      case 'painting':
        e.blockPos = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
        e.facing = paintingFacing774(p.objectData);
        configurePainting774(e, 0, this.game.paintingVariants);
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
    detachRemovedEntities(this, ids);
    for (const id of ids) {
      const e = this.map.get(id);
      if (!e) continue;
      this.game.entityRenderer.remove(e);
      this.map.delete(id);
      stopBeeSound(e);
      if (e.rollSound) e.rollSound.stop();
      if (e.insideSound) e.insideSound.stop();
      if (e.kind === 'fishhook') this.fishingCast = false;
    }
  }

  setVelocity(p) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    e.motionX = p.velocity.x; e.motionY = p.velocity.y; e.motionZ = p.velocity.z;
  }

  _setTarget(e, x, y, z, yaw, pitch, inc = 3) {
    if (e.kind === 'painting') {
      e.blockPos = { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
      configurePainting774(e, undefined, this.game.paintingVariants);
      return;
    }
    if(e.kind==='leash'){placeLeashKnot(e,x,y,z);return;}
    e.newX = x; e.newY = y; e.newZ = z;
    e.newYaw = yaw; e.newPitch = pitch;
    e.inc = inc;
    // EntityBoat.setPositionAndRotationDirect: lerpSteps = 10; EntityMinecart: turnProgress = increments + 2
    if (e.kind === 'boat') e.inc = 10;
    else if (e.kind === 'minecart') e.inc = inc + 2;
    // Display.lerpTo: posRotInterpolationDuration steps (0 applies on the next tick)
    else if (e.kind === 'display') { e.inc = Math.max(1, e.display?.posRotDuration || 0); return; }
    if (SNAP_KINDS.has(e.kind)) {
      // Non-living entities snap like vanilla's setPositionAndRotation for these
      e.inc = 1;
    }
  }

  relMove(p, move, look) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    if(e.controlled)return; // native ignores relative movement for a locally steered vehicle
    e.packetX=relativeEntityPosition(e.packetX??e.serverX/4096,p.dX);
    e.packetY=relativeEntityPosition(e.packetY??e.serverY/4096,p.dY);
    e.packetZ=relativeEntityPosition(e.packetZ??e.serverZ/4096,p.dZ);
    e.serverX=encodeEntityPosition(e.packetX);e.serverY=encodeEntityPosition(e.packetY);e.serverZ=encodeEntityPosition(e.packetZ);
    this._setTarget(e,e.packetX,e.packetY,e.packetZ,look?p.yaw:e.yaw,look?p.pitch:e.pitch);
    e.onGround = p.onGround;
  }

  look(p) {
    const e = this.map.get(p.entityId);
    if (!e || e.controlled) return;
    this._setTarget(e,e.x,e.y,e.z,p.yaw,p.pitch);
    e.onGround = p.onGround;
  }

  teleport(p) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    e.packetX=p.x;e.packetY=p.y;e.packetZ=p.z;
    e.serverX=encodeEntityPosition(p.x);e.serverY=encodeEntityPosition(p.y);e.serverZ=encodeEntityPosition(p.z);
    if(e.controlled)return;
    // Since 1.16, absolute teleports always supply their exact coordinates to lerpTo.
    this._setTarget(e,p.x,p.y,p.z,p.yaw,p.pitch);
    e.onGround = p.onGround;
  }

  headLook(p) {
    const e = this.map.get(p.entityId);
    if (e) e.headYaw = p.headYaw;
  }

  // slot: 0 main hand, 1 off hand, 2 feet, 3 legs, 4 chest, 5 head, 6 body, 7 saddle
  setEquipment(id, slot, item) {
    const e = this.map.get(id);
    if (!e) return;
    if (slot === 0) e.equipment[0] = item;
    else if (slot === 1) e.offhand = item;
    else if (slot >= 2 && slot <= 5) e.equipment[slot - 1] = item;
    else if (slot === 6) {
      e.bodyEquipment = item;
      if (e.entityName === 'llama' || e.entityName === 'trader_llama') {
        const n = item?.id ? this.game.items?.def?.(item.id)?.name : null;
        const dye = n?.endsWith('_carpet') ? n.slice(0, -7) : null;
        e.llamaCarpet = dye ? CARPET_DYES.indexOf(dye) : -1;
      }
    } else if (slot === 7) {
      e.saddleEquipment = item;
      e.saddled = !!item && (item.count ?? 1) > 0;
    }
  }

  setMetadata(id, meta) {
    const e = this.map.get(id);
    if (!e) return;
    Object.assign(e.metadata, meta);
    this._applyMeta(e, meta);
    applyEntityScale(e);
  }

  // 1.13.2 data parameters, audited through each class's superclass chain in the
  // client jar. Dispatch ONLY by canonical identity; e.type is a renderer selector.
  // Apply deltas, not the accumulated snapshot (e.g. an unrelated update must not
  // restart a TNT fuse). The complete wire values remain available in e.metadata.
  _applyMeta(e, m = e.metadata) {
    // Preserve native metadata on e.metadata. Adapt the unchanged consumers below
    // around 1.14's base pose and living sleeping-position insertions.
    const wire = m, compat = Object.fromEntries(Object.entries(wire).filter(([i]) => Number(i) !== 7).map(([i, v]) => [Number(i) > 7 ? Number(i) - 1 : Number(i), v])), living498 = e.kind === 'mob' || e.kind === 'player' || e.kind === 'armorstand' || e.kind === 'mannequin';
    const native = living498 ? Object.fromEntries(Object.entries(compat).filter(([i]) => Number(i) !== 12).map(([i, v]) => [Number(i) > 12 ? Number(i) - 1 : Number(i), v])) : compat;
    if (living498 && compat[12] !== undefined) e.stingerCount = compat[12];
    if (wire[7] !== undefined) e.frozenTicks = wire[7];
    if (native[6] !== undefined) {
      if (e.pose !== native[6]) e.wildAnimationStart = e.ticks;
      e.pose = native[6];
      if (e.kind === 'player' || e.kind === 'mannequin') {
        const pose = ['standing', 'fall_flying', 'sleeping', 'swimming', 'spin_attack', 'sneaking', 'long_jumping', 'dying'][e.pose];
        const size = playerPoseDimensions(pose);
        if (size) { e.width = Math.fround(size[0]); e.height = Math.fround(size[1]); }
        e.visuallySwimming = pose === 'swimming';
        e.eyeHeight = pose === 'sneaking' ? 1.27 : ['swimming', 'fall_flying', 'spin_attack'].includes(pose) ? 0.4 : pose === 'sleeping' ? 0.2 : 1.62;
      }
    }
    const villagerData = Object.values(native).find(v => v && typeof v === 'object' && Number.isInteger(v.villagerProfession));
    if (villagerData) { e.villagerData = villagerData; e.profession = villagerData.villagerProfession; e.villagerProfession = e.profession; e.villagerType = villagerData.villagerType; e.villagerLevel = villagerData.level; }
    if (living498 && Object.hasOwn(native, 12)) {
      e.sleepingPosition = native[12]; e.bedPos = native[12]; e.sleeping = !!native[12];
    } else if (native[6] !== undefined && native[6] !== 2) { e.sleeping = false; e.bedPos = null; e.sleepingPosition = null; }
    m = {}; for (const [key, value] of Object.entries(native)) { const i = Number(key); if (i === 6 || (living498 && i === 12)) continue; m[i - (i >= 7 ? living498 && i >= 13 ? 2 : 1 : 0)] = value; }
    const name = e.entityName;
    if (name === 'painting') {
      if (wire[PAINTING_DIRECTION_INDEX_774] !== undefined) e.facing = paintingFacing774(wire[PAINTING_DIRECTION_INDEX_774]);
      if (wire[PAINTING_VARIANT_INDEX_774] !== undefined || wire[PAINTING_DIRECTION_INDEX_774] !== undefined) {
        configurePainting774(e, wire[PAINTING_VARIANT_INDEX_774], this.game.paintingVariants);
      }
    }
    const own = WIRE_METADATA[name] || {}, assign = (symbol, key) => { const id = own[symbol]; if (id !== undefined && wire[id] !== undefined) { if (['snifferState', 'dashing'].includes(key) && e[key] !== wire[id]) e.wildAnimationStart = e.ticks; e[key] = wire[id]; } };
    if (e.kind === 'display') applyDisplayMeta(e, wire, own);
    if (name === 'interaction') {
      assign('DATA_WIDTH_ID', 'width'); assign('DATA_HEIGHT_ID', 'height');
      assign('DATA_RESPONSE_ID', 'response');
    }
    if (name === 'frog') { assign('DATA_VARIANT_ID', 'frogVariant'); assign('DATA_TONGUE_TARGET_ID', 'tongueTarget'); }
    if (name === 'allay') { assign('DATA_DANCING', 'dancing'); assign('DATA_CAN_DUPLICATE', 'canDuplicate'); }
    if (name === 'warden') assign('CLIENT_ANGER_LEVEL', 'angerLevel');
    if (name === 'sniffer') assign('DATA_STATE', 'snifferState');
    if (name === 'camel' || name === 'camel_husk') { assign('DASH', 'dashing'); assign('LAST_POSE_CHANGE_TICK', 'lastPoseChangeTick'); assign('DATA_ID_FLAGS', 'horseFlags'); }
    if (name === 'goat') { assign('DATA_HAS_LEFT_HORN', 'hasLeftHorn'); assign('DATA_HAS_RIGHT_HORN', 'hasRightHorn'); }
    if (name === 'cat') { assign('DATA_VARIANT_ID', 'catType'); assign('IS_LYING', 'catLying'); assign('RELAX_STATE_ONE', 'catRelaxing'); assign('DATA_COLLAR_COLOR', 'collar'); }
    if (name === 'cow' || name === 'chicken' || name === 'pig') assign('DATA_VARIANT_ID', name + 'Variant');
    if (name === 'happy_ghast') { assign('IS_LEASH_HOLDER', 'leashHolder'); assign('STAYS_STILL', 'staysStill'); }
    if (name === 'copper_golem') { assign('DATA_WEATHER_STATE', 'weatherState'); assign('COPPER_GOLEM_STATE', 'copperGolemState'); }
    if (name === 'creaking') { assign('CAN_MOVE', 'canMove'); assign('IS_ACTIVE', 'creakingActive'); assign('IS_TEARING_DOWN', 'tearingDown'); assign('HOME_POS', 'homePos'); }
    if (name === 'nautilus' || name === 'zombie_nautilus') {
      if (own.DATA_FLAGS_ID !== undefined && wire[own.DATA_FLAGS_ID] !== undefined) {
        e.sitting = !!(wire[own.DATA_FLAGS_ID] & 1);
        e.tamed = !!(wire[own.DATA_FLAGS_ID] & 4);
      }
      assign('DATA_OWNERUUID_ID', 'ownerUuid'); assign('DASH', 'dashing');
      if (name === 'zombie_nautilus') assign('DATA_VARIANT_ID', 'zombieNautilusVariant');
    }

    applyNetherMetadata(e, wire);
    const ids = NATIVE_METADATA[name];
    if (ids) {
      const assignments = { cat: { DATA_TYPE_ID: 'catType', IS_LYING: 'catLying', RELAX_STATE_ONE: 'catRelaxing', DATA_COLLAR_COLOR: 'collar' }, fox: { DATA_TYPE_ID: 'foxType' }, panda: { MAIN_GENE_ID: 'pandaGene', HIDDEN_GENE_ID: 'pandaHiddenGene' }, villager: { DATA_UNHAPPY_COUNTER: 'unhappyCounter' } }[name] || {};
      for (const [field, key] of Object.entries(assignments)) if (native[ids[field]] !== undefined) e[key] = native[ids[field]];
    }
    if (name === 'fox' && wire[WIRE_METADATA.fox.DATA_FLAGS_ID] !== undefined) applyFoxFlags(e, wire[WIRE_METADATA.fox.DATA_FLAGS_ID]);
    if (name === 'mooshroom') e.mooshroomType = Object.values(native).find(v => v === 'brown' || v === 'red') || e.mooshroomType || 'red';
    if (name === 'bee') {
      const flags = wire[WIRE_METADATA.bee.DATA_FLAGS_ID];
      if (flags !== undefined) { e.hasNectar = !!(flags & 8); e.hasStung = !!(flags & 4); e.beeRolling = !!(flags & 2); }
      if (wire[WIRE_METADATA.bee.DATA_ANGER_END_TIME] !== undefined) {
        e.angerEndTime = wire[WIRE_METADATA.bee.DATA_ANGER_END_TIME];
        const worldAge = BigInt(Math.trunc(Number(this.game.world?.worldAge ?? 0)));
        const end = typeof e.angerEndTime === 'bigint' ? e.angerEndTime : BigInt(Math.trunc(Number(e.angerEndTime) || 0));
        e.angry = end > 0n && end > worldAge;
      }
    }
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
    if (m[2] !== undefined) e.customName = chatToLegacy(m[2]);
    if (m[3] !== undefined) e.nameVisible = !!m[3];
    if (m[4] !== undefined) e.silent = !!m[4];
    if (m[5] !== undefined) e.noGravity = !!m[5];
    set(1, 'air');
    const living = e.kind === 'mob' || e.kind === 'player' || e.kind === 'armorstand' || e.kind === 'mannequin';
    if (living) {
      if (m[6] !== undefined) {
        e.usingItem = !!(m[6] & 1); e.activeHand = m[6] & 2 ? 1 : 0; e.riptide = !!(m[6] & 4);
      }
      if (m[7] !== undefined) {
        const prev = e.health;
        e.health = m[7];
        if (e.health <= 0 && prev > 0) e.dead = true;
      }
      { const id = WIRE_METADATA[name]?.DATA_EFFECT_PARTICLES; if (id !== undefined && wire[id] !== undefined) e.effectParticles = Array.isArray(wire[id]) ? wire[id] : []; }
      set(9, 'potionAmbient'); set(10, 'arrowCount');
    }
    if (name === 'player' || e.kind === 'player') {
      assign('DATA_PLAYER_ABSORPTION_ID', 'absorption');
      assign('DATA_SCORE_ID', 'score');
      assign('DATA_PLAYER_MODE_CUSTOMISATION', 'skinFlags');
      assign('DATA_PLAYER_MAIN_HAND', 'mainHand');
      assign('DATA_SHOULDER_PARROT_LEFT', 'leftShoulder');
      assign('DATA_SHOULDER_PARROT_RIGHT', 'rightShoulder');
    }
    if (name === 'mannequin' || e.kind === 'mannequin') {
      assign('DATA_PLAYER_MAIN_HAND', 'mainHand');
      assign('DATA_PLAYER_MODE_CUSTOMISATION', 'skinFlags');
      assign('DATA_PROFILE', 'profile');
      assign('DATA_IMMOVABLE', 'immovable');
      assign('DATA_DESCRIPTION', 'description');
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
      if (own.ID_FLAGS !== undefined && wire[own.ID_FLAGS] !== undefined) e.critical = !!(wire[own.ID_FLAGS] & 1);
      assign('IN_GROUND', 'inGround');
      if (name === 'arrow') assign('ID_EFFECT_COLOR', 'arrowColor');
      if (name === 'trident') { assign('ID_LOYALTY', 'loyalty'); assign('ID_FOIL', 'foil'); }
    }
    if (e.kind === 'minecart') {
      assign('DATA_ID_HURT', 'rollingAmplitude');
      assign('DATA_ID_HURTDIR', 'rollingDirection');
      assign('DATA_ID_DAMAGE', 'cartDamage');
      assign('DATA_ID_DISPLAY_BLOCK', 'displayBlock');
      assign('DATA_ID_DISPLAY_OFFSET', 'displayOffset');
      assign('DATA_ID_CUSTOM_DISPLAY_BLOCK', 'customDisplay');
    }
    if (e.kind === 'boat') {
      assign('DATA_ID_HURT', 'timeSinceHit');
      assign('DATA_ID_HURTDIR', 'forwardDirection');
      assign('DATA_ID_DAMAGE', 'damageTaken');
      assign('DATA_ID_PADDLE_LEFT', 'paddleLeft');
      assign('DATA_ID_PADDLE_RIGHT', 'paddleRight');
      assign('DATA_ID_BUBBLE_TIME', 'bubbleTime');
    }
    switch (name) {
      case 'item': assign('DATA_ITEM', 'item'); break;
      case 'potion': case 'splash_potion': case 'lingering_potion': assign('DATA_ITEM_STACK', 'item'); break;
      case 'glow_item_frame': case 'item_frame':
        if (own.DATA_DIRECTION !== undefined && wire[own.DATA_DIRECTION] !== undefined) {
          e.facing = wire[own.DATA_DIRECTION];
          const p = e.blockPos || { x: Math.floor(e.x), y: Math.floor(e.y), z: Math.floor(e.z) };
          e.box = itemFrameBox(p.x, p.y, p.z, e.facing);
        }
        assign('DATA_ITEM', 'item');
        assign('DATA_ROTATION', 'rotation');
        break;
      case 'firework_rocket': assign('DATA_ID_FIREWORKS_ITEM', 'item'); assign('DATA_ATTACHED_TO_TARGET', 'boostedId'); assign('DATA_SHOT_AT_ANGLE', 'shotAtAngle'); break;
      case 'fishing_bobber': if (own.DATA_HOOKED_ENTITY !== undefined && wire[own.DATA_HOOKED_ENTITY] !== undefined) e.hookedEntityId = wire[own.DATA_HOOKED_ENTITY] - 1; break;
      case 'falling_block': assign('DATA_START_POS', 'origin'); break;
      case 'tnt': assign('DATA_FUSE_ID', 'fuse'); assign('DATA_BLOCK_STATE_ID', 'blockState'); break;
      case 'wither_skull': assign('DATA_DANGEROUS', 'invulnerable'); break;
      case 'end_crystal': assign('DATA_BEAM_TARGET', 'beamTarget'); assign('DATA_SHOW_BOTTOM', 'showBottom'); break;
      case 'furnace_minecart': assign('DATA_ID_FUEL', 'furnacePowered'); break;
      case 'command_block_minecart': assign('DATA_ID_COMMAND_NAME', 'command'); assign('DATA_ID_LAST_OUTPUT', 'lastOutput'); break;
      case 'area_effect_cloud': {
        if (wire[own.DATA_RADIUS] !== undefined) { e.radius = wire[own.DATA_RADIUS]; e.width = e.radius * 2; e.height = 0.5; }
        if (wire[own.DATA_WAITING] !== undefined) e.singlePoint = !!wire[own.DATA_WAITING];
        if (wire[own.DATA_PARTICLE] !== undefined) { e.cloudParticle = wire[own.DATA_PARTICLE]; e.cloudColor = effectParticleColor(e.cloudParticle) ?? 0; }
        break;
      }
      default: break;
    }
    if (e.kind === 'mob') {
      bit(11, 1, 'noAI'); bit(11, 2, 'leftHanded'); bit(11, 4, 'aggressive');
      if ((AGEABLE.has(name) || ZOMBIES.has(name)) && m[12] !== undefined) {
        e.child = !!m[12];
        const def = ENTITIES_BY_NAME[name], scale = name === 'happy_ghast' ? (e.child ? 0.2375 : 1) : (e.child ? 0.5 : 1);
        e.width = def.width * scale; e.height = def.height * scale; e.eyeHeight = def.eyeHeight * scale;
        if (ZOMBIES.has(name) && e.child) e.eyeHeight = 0.93;
        if ((name === 'cow' || name === 'mooshroom') && e.child) e.eyeHeight = e.height;
        if (name === 'turtle' && e.child) { e.width = 0.36; e.height = 0.12; e.eyeHeight = 0.102; }
      }
      if (ZOMBIES.has(name)) {
        set(13, 'zombieSpecialType'); e.armsRaised = !!e.aggressive;
        assign('DATA_DROWNED_CONVERSION_ID', 'convertingToDrowned');
        if (name === 'zombie_villager') assign('DATA_CONVERTING_ID', 'curing');
        e.converting = !!(e.convertingToDrowned || e.curing);
      }
      if (FISH.has(name)) assign('FROM_BUCKET', 'fromBucket');
      if (name === 'wolf' || name === 'ocelot' || name === 'cat' || name === 'parrot') {
        if (own.DATA_FLAGS_ID !== undefined && wire[own.DATA_FLAGS_ID] !== undefined) {
          e.sitting = !!(wire[own.DATA_FLAGS_ID] & 1);
          e.tamed = !!(wire[own.DATA_FLAGS_ID] & 4);
        } else {
          bit(13, 1, 'sitting'); bit(13, 4, 'tamed');
        }
        assign('DATA_OWNERUUID_ID', 'ownerUuid');
      }
      if (HORSES.has(name)) {
        if (name === 'donkey' || name === 'mule' || name === 'llama' || name === 'trader_llama') assign('DATA_ID_CHEST', 'horseChest');
        const hf = own.DATA_ID_FLAGS !== undefined ? wire[own.DATA_ID_FLAGS] : undefined;
        if (hf !== undefined) {
          e.tamed = !!(hf & 2);
          e.saddled = !!(hf & 4);
          e.horseBred = !!(hf & 8);
          e.horseFlags = (hf & 2) | (hf & 4) | (e.horseChest ? 8 : 0) | (hf & 16 ? 32 : 0) | (hf & 32 ? 64 : 0) | (hf & 64 ? 128 : 0);
        }
      }
      switch (name) {
        case 'bat': if (own.DATA_ID_FLAGS !== undefined && wire[own.DATA_ID_FLAGS] !== undefined) e.hanging = !!(wire[own.DATA_ID_FLAGS] & 1); break;
        case 'blaze': if (own.DATA_FLAGS_ID !== undefined && wire[own.DATA_FLAGS_ID] !== undefined) e.blazeOnFire = !!(wire[own.DATA_FLAGS_ID] & 1); break;
        case 'creeper': assign('DATA_SWELL_DIR', 'creeperState'); assign('DATA_IS_POWERED', 'powered'); assign('DATA_IS_IGNITED', 'ignited'); break;
        case 'skeleton': case 'wither_skeleton': case 'stray': case 'bogged': case 'parched':
          e.armsRaised = !!e.aggressive;
          if (name === 'skeleton') assign('DATA_STRAY_CONVERSION_ID', 'strayConverting');
          if (name === 'bogged') assign('DATA_SHEARED', 'sheared');
          e.converting = !!e.strayConverting;
          break;
        case 'spider': case 'cave_spider': if (own.DATA_FLAGS_ID !== undefined && wire[own.DATA_FLAGS_ID] !== undefined) e.climbing = !!(wire[own.DATA_FLAGS_ID] & 1); break;
        case 'slime': case 'magma_cube':
          if (own.ID_SIZE !== undefined && wire[own.ID_SIZE] !== undefined) {
            e.size = wire[own.ID_SIZE]; e.width = e.height = 0.51000005 * e.size; e.eyeHeight = e.height * 0.625;
          }
          break;
        case 'enderman': assign('DATA_CARRY_STATE', 'carriedBlockState'); assign('DATA_CARRY_STATE', 'carried'); assign('DATA_CREEPY', 'screaming'); break;
        case 'ender_dragon': assign('DATA_PHASE', 'dragonPhase'); break;
        case 'ghast': assign('DATA_IS_CHARGING', 'attacking'); break;
        case 'guardian': case 'elder_guardian':
          assign('DATA_ID_MOVING', 'guardianMoving');
          if (own.DATA_ID_ATTACK_TARGET !== undefined && wire[own.DATA_ID_ATTACK_TARGET] !== undefined && e.guardianTarget !== wire[own.DATA_ID_ATTACK_TARGET]) {
            e.guardianTarget = wire[own.DATA_ID_ATTACK_TARGET]; e.guardianBeamTicks = 0;
          }
          break;
        case 'shulker': assign('DATA_ATTACH_FACE_ID', 'attachFace'); assign('DATA_PEEK_ID', 'peekTick'); assign('DATA_COLOR_ID', 'shulkerColor'); break;
        case 'wither':
          if (own.DATA_TARGET_A !== undefined && [own.DATA_TARGET_A, own.DATA_TARGET_B, own.DATA_TARGET_C].some(i => wire[i] !== undefined)) {
            e.witherTargets = [own.DATA_TARGET_A, own.DATA_TARGET_B, own.DATA_TARGET_C].map(i => e.metadata[i] || 0);
          }
          assign('DATA_ID_INV', 'invulTime');
          break;
        case 'witch': assign('DATA_USING_ITEM', 'witchAggressive'); break;
        case 'evoker': case 'illusioner': assign('DATA_SPELL_CASTING_ID', 'spell'); // falls through
        case 'vindicator': if (own.IS_CELEBRATING !== undefined && wire[own.IS_CELEBRATING] !== undefined) e.illagerFlags = wire[own.IS_CELEBRATING]; e.armsRaised = !!e.aggressive; break;
        case 'vex': if (own.DATA_FLAGS_ID !== undefined && wire[own.DATA_FLAGS_ID] !== undefined) e.charging = !!(wire[own.DATA_FLAGS_ID] & 1); break;
        case 'pig':
          if (own.DATA_BOOST_TIME !== undefined && wire[own.DATA_BOOST_TIME] !== undefined) {
            e.boostDuration = wire[own.DATA_BOOST_TIME]; e.boostTicks = 0; e.boosting = e.boostDuration > 0;
          }
          break;
        case 'sheep': if (own.DATA_WOOL_ID !== undefined && wire[own.DATA_WOOL_ID] !== undefined) { e.fleece = wire[own.DATA_WOOL_ID] & 15; e.sheared = !!(wire[own.DATA_WOOL_ID] & 16); } break;
        case 'wolf': break;
        case 'ocelot': assign('DATA_TRUSTING', 'trusting'); break;
        case 'parrot': assign('DATA_VARIANT_ID', 'parrotVariant'); break;
        case 'rabbit': assign('DATA_TYPE_ID', 'rabbitType'); break;
        case 'villager': if (!e.villagerData) assign('DATA_VILLAGER_DATA', 'villagerData'); break;
        case 'horse': assign('DATA_ID_TYPE_VARIANT', 'horseVariant'); break;
        case 'llama': case 'trader_llama': assign('DATA_STRENGTH_ID', 'llamaStrength'); assign('DATA_VARIANT_ID', 'llamaVariant'); break;
        case 'polar_bear': assign('DATA_STANDING_ID', 'standing'); break;
        case 'snow_golem': if (own.DATA_PUMPKIN_ID !== undefined && wire[own.DATA_PUMPKIN_ID] !== undefined) e.hasPumpkin = !!(wire[own.DATA_PUMPKIN_ID] & 16); break;
        case 'iron_golem': if (own.DATA_FLAGS_ID !== undefined && wire[own.DATA_FLAGS_ID] !== undefined) e.playerCreated = !!(wire[own.DATA_FLAGS_ID] & 1); break;
        case 'dolphin': assign('GOT_FISH', 'gotFish'); assign('MOISTNESS_LEVEL', 'moistness'); break;
        case 'turtle': assign('HAS_EGG', 'hasEgg'); assign('LAYING_EGG', 'layingEgg'); break;
        case 'pufferfish':
          if (own.PUFF_STATE !== undefined && wire[own.PUFF_STATE] !== undefined) {
            e.puffState = wire[own.PUFF_STATE]; e.width = e.height = 0.7 * (e.puffState === 0 ? 0.5 : e.puffState === 1 ? 0.7 : 1);
            e.eyeHeight = e.height * 0.65;
          }
          break;
        case 'tropical_fish': assign('DATA_ID_TYPE_VARIANT', 'fishVariant'); break;
        case 'phantom':
          if (own.ID_SIZE !== undefined && wire[own.ID_SIZE] !== undefined) {
            e.phantomSize = wire[own.ID_SIZE]; e.width = 0.9 + 0.2 * e.phantomSize; e.height = 0.5 + 0.1 * e.phantomSize;
            e.eyeHeight = e.height * 0.35;
          }
          break;
        default: break;
      }
    }
    applyPawsMetadata774(e, wire, this.game.world?.worldAge ?? 0);
  }

  setAttributes(p) {
    const e = this.map.get(p.entityId);
    if (!e) return;
    e.attributes = e.attributes || {};
    for (const prop of p.properties) {
      if (prop.key === 'generic.maxHealth' || prop.key === 'minecraft:max_health' || prop.key === 'max_health') e.maxHealth = prop.value;
      if (prop.key === 'generic.scale' || prop.key === 'minecraft:scale' || prop.key === 'scale') setScaleAttribute(e, prop);
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
    if(e.entityName==='warden'){if(p.entityStatus===4)e.wildAttackStart=e.ticks;if(p.entityStatus===62)e.sonicBoomStart=e.ticks;if(p.entityStatus===61)e.tendrilStart=e.ticks;}
    if(e.entityName==='armadillo'&&p.entityStatus===64){e.armadilloPeekReceived=true;g.sound.play('entity.armadillo.peek',e.x,e.y,e.z,1,1,{category:'neutral'});}
    switch (p.entityStatus) {
      case 2: e.hurtTime = 10; g.sound.playEntityHurt(e); break;
      case 3: e.dead = true; e.health = 0; g.sound.playEntityDeath(e); break;
      case 4: if (e.entityName === 'evoker_fangs') e.fangsActive = true;
        else if(['hoglin','zoglin'].includes(e.entityName)){e.attackTicks=10;g.sound.play('entity.'+e.entityName+'.attack',e.x,e.y,e.z,1,e.child?1.4:1);}break;
      case 6: g.particles.entityEffect(e, 'smoke'); break;
      case 7: g.particles.entityEffect(e, 'heart'); break;
      case 10: e.eatingGrass = 40; break;
      case 12: case 18: g.particles.entityEffect(e, 'heart'); break;
      case 13: g.particles.entityEffect(e, 'angryVillager'); break;
      case 14: g.particles.entityEffect(e, 'happyVillager'); break;
      case 15: g.particles.entityEffect(e, 'witchMagic'); break;
      case 58: case 59: if (e.entityName === 'goat') e.goatRamming = p.entityStatus === 58; break;
      case 53:case 54:g.particles.honeyBlockEffect(e,p.entityStatus===53?5:10);break;
      case 19: if(isSquid(e)){if(!e.squid)initSquid(e);e.squid.phase=0;}break;
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
    playPickupSound(this.game,e);
    // The pickup survives removal or metadata changes of the real server entity.
    (this.pickups||=[]).push(pickupVisual(e,collector,this.nextPickupId--));

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

  // Entity.countPlayerPassengers > 0: a player anywhere among the (indirect) passengers
  carriesPlayer(e, depth = 0) {
    if (depth > 8) return false;
    for (const id of this.passengersOf(e.id)) {
      if (id === this.game.entityId) return true;
      const p = this.map.get(id);
      if (p && (p.kind === 'player' || this.carriesPlayer(p, depth + 1))) return true;
    }
    return false;
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
    if (list.length < 2 && !v.chestBoat) return [v.x, y, v.z];
    let f = v.chestBoat ? Math.fround(0.15) : list.indexOf(riderId) === 0 ? Math.fround(0.2) : Math.fround(-0.6);
    const r = this.map.get(riderId);
    if (r && r.kind === 'mob' && ANIMALS.has(r.entityName)) f = Math.fround(f + 0.2);
    const a = Math.fround(Math.fround(-v.yaw * Math.fround(Math.PI / 180)) - Math.fround(Math.PI / 2));
    return [v.x + f * mcCos(a), y, v.z - f * mcSin(a)];
  }

  mountedOffset(v) {
    if (v.kind === 'boat') return v.entityName?.endsWith('_raft') || v.boatType === 8 ? 0.3 : -0.1; // native bamboo raft offset
    if (v.kind === 'minecart') return 0;    // EntityMinecart.getMountedYOffset (1.9+)
    if (v.kind === 'mob') {
      if(v.entityName==='strider')return v.height-.19+.24*Math.cos((v.limbSwing||0)*1.5)*Math.min(.25,v.limbSwingAmount||0);
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
      if ((e.type === 90 || e.entityName==='strider') && (e.saddled||itemName==='saddle')) return true;
    }
    if (e.kind === 'itemframe' || e.kind === 'armorstand' || e.kind === 'minecart' || e.kind === 'boat') return true;
    return false;
  }

  // Interpolated render position
  interp(e, partial) {
    if(e.pickupVisual)return pickupPosition(e,this.game.player,partial);
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
    s.sleeping=!!pl.sleeping;s.bedPos=g.bedPos;s.sleepingPosition=g.bedPos;
    s.width=pl.width;s.height=pl.height;s.eyeHeight=pl.eyeHeight();s.attrScale=pl.scale||1; // the local player already applies generic.scale to its own size
    s.sneaking = !!pl.crouching; s.swimming = pl.swimming; s.visuallySwimming = pl.pose === 'swimming'; s.pose = pl.pose;
    s.inWater = !!pl.inWater; s.onGround = pl.onGround;
    s.usingItem = pl.usingItem; s.riptide = !!pl.riptide;
    s.useTicks=g.interaction.useTicks;
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
    if (s.metadata && s.metadata[WIRE_METADATA.player.DATA_PLAYER_MODE_CUSTOMISATION] !== undefined) s.skinFlags = s.metadata[WIRE_METADATA.player.DATA_PLAYER_MODE_CUSTOMISATION]; else s.skinFlags = g.settings.skinParts;
    s.invisible = !!(g.selfMetadata && (g.selfMetadata[0] & 32)) || g.effects.has(EFFECT_774.invisibility);
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
    tickPickupVisuals(this);
    const rate = g.tickRate;
    for (const e of [...this.map.values()]) {
      // ClientLevel.tickEntities: a frozen server leaves everything but players and their mounts untouched
      if (rate && !rate.runsNormally() && rate.isEntityFrozen(e, this.carriesPlayer(e))) continue;
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
      if (e.display) tickDisplay(e);
      if (e.id !== g.entityId) g.particles?.sprint?.(e);
      if(e.entityName==='goat') e.goatRammingTicks = Math.max(0, Math.min(20, (e.goatRammingTicks || 0) + (e.goatRamming ? 1 : -2)));
      if(e.entityName==='glow_squid'&&e.darkTicks>0)e.darkTicks--;
      if (e.entityName === 'armadillo') tickArmadillo774(e);
      if (e.entityName === 'wolf' || e.entityName === 'bee') tickWolf774(e, g.world?.worldAge ?? 0);
      if (e.entityName === 'bat') tickBat774(e);
      if(e.entityName==='fox')tickFox(e);
      if(e.entityName==='bee'){tickBeeSound(this,e);e.prevBeeRoll=e.beeRoll||0;e.beeRoll=Math.fround(e.beeRolling?Math.min(1,Math.fround(e.prevBeeRoll+Math.fround(.2))):Math.max(0,Math.fround(e.prevBeeRoll-Math.fround(.24))));}
      if (e.boostedId && e.boostedId === g.entityId) this._fireworkBoost(e);
      if (e.entityName === 'firework_rocket') this._fireworkTick(e);
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
      } else if(e.kind==='item'){
        tickDroppedItem(e,g.world);
      } else if(e.kind==='falling'){
        tickFallingBlock(e,g.world);
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
      if(e.attackTicks>0)e.attackTicks--;
      if(e.boosting&&++e.boostTicks>e.boostDuration)e.boosting=false;
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
      if (e.kind === 'player' || e.kind === 'mob' || e.kind === 'armorstand' || e.kind === 'mannequin') this._livingUpdate(e);
      if(isSquid(e))tickSquid(e,squidInWater(e,g.world));
      if(e.entityName==='glow_squid')g.particles.nativeParticle('glow',e.x+(Math.random()-.5)*e.width*.6,e.y+Math.random()*e.height,e.z+(Math.random()-.5)*e.width*.6);
      if (e.kind === 'player') this._updateCape(e);
      if (e.onFire && Math.random() < 0.3) g.particles.entityFire && g.particles.entityFire(e);
      // LivingEntity.tickEffects (1.20.5+): one of the effect particles, 1 in (invisible ? 15 : 4) * (ambient ? 5 : 1)
      const living = e.kind === 'player' || e.kind === 'mob' || e.kind === 'armorstand' || e.kind === 'mannequin';
      const list = living ? e.effectParticles || [] : [];
      if (list.length) {
        const ambient = !!e.potionAmbient;
        if (Math.floor(Math.random() * (e.invisible ? 15 : 4) * (ambient ? 5 : 1)) === 0) {
          const particle = list[Math.floor(Math.random() * list.length)], color = effectParticleColor(particle);
          if (color !== null && g.particles.potionSwirl) g.particles.potionSwirl(e, color, ambient);
        }
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
    e.useTicks=e.usingItem?(e.useTicks||0)+1:0;
    e.elytraTicks = e.elytraFlying ? (e.elytraTicks || 0) + 1 : 0; // EntityLivingBase.ticksElytraFlying
    e.prevSwimAmount = e.swimAmount ?? 0;
    e.swimAmount = Math.max(0, Math.min(1, e.prevSwimAmount + ((e.visuallySwimming ?? e.swimming) ? 0.09 : -0.09)));
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
