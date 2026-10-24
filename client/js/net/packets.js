// Minecraft 1.13.2 (protocol 404) play-state packet codec.
import { Reader, Writer } from './buffer.js';
import { readNbtRoot } from './nbt.js';

export const PROTOCOL_VERSION = 404;

const vec3i16 = (r) => ({ x: r.i16(), y: r.i16(), z: r.i16() });
const strings = (r) => { const n = r.varint(); const a = []; for (let i = 0; i < n; i++) a.push(r.string()); return a; };
const varints = (r) => { const n = r.varint(); const a = []; for (let i = 0; i < n; i++) a.push(r.varint()); return a; };

// Clientbound decoders, indexed by packet id
const decoders = {
  0x00: (r) => ({
    name: 'spawn_entity', entityId: r.varint(), objectUUID: r.uuid(), type: r.i8(),
    x: r.f64(), y: r.f64(), z: r.f64(), pitch: r.angle(), yaw: r.angle(), objectData: r.i32(), velocity: vec3i16(r),
  }),
  0x01: (r) => ({ name: 'spawn_entity_experience_orb', entityId: r.varint(), x: r.f64(), y: r.f64(), z: r.f64(), count: r.i16() }),
  0x02: (r) => ({ name: 'spawn_entity_weather', entityId: r.varint(), type: r.i8(), x: r.f64(), y: r.f64(), z: r.f64() }),
  0x03: (r) => ({
    name: 'spawn_entity_living', entityId: r.varint(), entityUUID: r.uuid(), type: r.varint(),
    x: r.f64(), y: r.f64(), z: r.f64(), yaw: r.angle(), pitch: r.angle(), headPitch: r.angle(),
    velocity: vec3i16(r), metadata: r.metadata(),
  }),
  0x04: (r) => ({ name: 'spawn_entity_painting', entityId: r.varint(), entityUUID: r.uuid(), title: r.varint(), location: r.position(), direction: r.u8() }),
  0x05: (r) => ({
    name: 'named_entity_spawn', entityId: r.varint(), playerUUID: r.uuid(),
    x: r.f64(), y: r.f64(), z: r.f64(), yaw: r.angle(), pitch: r.angle(), metadata: r.metadata(),
  }),
  // animation: 0 swing main hand, 1 hurt, 2 leave bed, 3 swing off hand, 4 critical, 5 magic critical
  0x06: (r) => ({ name: 'animation', entityId: r.varint(), animation: r.u8() }),
  0x07: (r) => {
    const n = r.varint();
    const entries = [];
    for (let i = 0; i < n; i++) entries.push({ name: r.string(), value: r.varint() });
    return { name: 'statistics', entries };
  },
  0x08: (r) => ({ name: 'block_break_animation', entityId: r.varint(), location: r.position(), destroyStage: r.i8() }),
  // action: 1 spawner, 2 command block, 3 beacon, 4 skull, 5 flower pot, 6 banner, 7 structure, 8 end gateway, 9 sign, 10 shulker box, 11 bed
  0x09: (r) => ({ name: 'tile_entity_data', location: r.position(), action: r.u8(), nbtData: r.optionalNbt() }),
  0x0a: (r) => ({ name: 'block_action', location: r.position(), byte1: r.u8(), byte2: r.u8(), blockId: r.varint() }),
  0x0b: (r) => ({ name: 'block_change', location: r.position(), state: r.varint() }),
  0x0c: (r) => {
    const p = { name: 'boss_bar', uuid: r.uuid(), action: r.varint() };
    if (p.action === 0) { p.title = r.string(); p.health = r.f32(); p.color = r.varint(); p.dividers = r.varint(); p.flags = r.u8(); }
    else if (p.action === 2) p.health = r.f32();
    else if (p.action === 3) p.title = r.string();
    else if (p.action === 4) { p.color = r.varint(); p.dividers = r.varint(); }
    else if (p.action === 5) p.flags = r.u8();
    return p;
  },
  0x0d: (r) => ({ name: 'difficulty', difficulty: r.u8() }),
  0x0e: (r) => ({ name: 'tab_complete', transactionId: r.varint(), start: r.varint(), length: r.varint(), matches: [] }),
  0x0f: (r) => ({ name: 'chat', message: r.string(), position: r.i8() }),
  0x10: (r) => {
    const chunkX = r.i32();
    const chunkZ = r.i32();
    const n = r.varint();
    const records = [];
    for (let i = 0; i < n; i++) {
      const h = r.u8();
      const y = r.u8();
      records.push({ x: h >> 4, z: h & 15, y, state: r.varint() });
    }
    return { name: 'multi_block_change', chunkX, chunkZ, records };
  },
  0x11: (r) => ({ name: 'transaction', windowId: r.i8(), action: r.i16(), accepted: r.bool() }),
  0x12: (r) => ({ name: 'close_window', windowId: r.u8() }),
  0x13: (r) => {
    const p = { name: 'open_window', windowId: r.u8(), inventoryType: r.string(), windowTitle: r.string(), slotCount: r.u8() };
    if (p.inventoryType === 'EntityHorse') p.entityId = r.i32();
    return p;
  },
  0x14: (r) => {
    const windowId = r.u8();
    const n = r.i16();
    const items = [];
    for (let i = 0; i < n; i++) items.push(r.slot());
    return { name: 'window_items', windowId, items };
  },
  0x15: (r) => ({ name: 'craft_progress_bar', windowId: r.u8(), property: r.i16(), value: r.i16() }),
  0x16: (r) => ({ name: 'set_slot', windowId: r.i8(), slot: r.i16(), item: r.slot() }),
  0x17: (r) => ({ name: 'set_cooldown', itemId: r.varint(), cooldownTicks: r.varint() }),
  0x18: (r) => ({ name: 'custom_payload', channel: r.string(), data: r.rest() }),
  0x19: (r) => ({
    name: 'named_sound_effect', soundName: r.string(), soundCategory: r.varint(),
    x: r.i32() / 8, y: r.i32() / 8, z: r.i32() / 8, volume: r.f32(), pitch: r.f32(),
  }),
  0x1a: (r) => ({ name: 'kick_disconnect', reason: r.string() }),
  0x1b: (r) => ({ name: 'entity_status', entityId: r.i32(), entityStatus: r.i8() }),
  0x1c: (r) => {
    const p = { name: 'explosion', x: r.f32(), y: r.f32(), z: r.f32(), radius: r.f32(), records: [] };
    const n = r.i32();
    for (let i = 0; i < n; i++) p.records.push({ x: r.i8(), y: r.i8(), z: r.i8() });
    p.motionX = r.f32(); p.motionY = r.f32(); p.motionZ = r.f32();
    return p;
  },
  0x1d: (r) => ({ name: 'unload_chunk', chunkX: r.i32(), chunkZ: r.i32() }),
  0x1e: (r) => ({ name: 'game_state_change', reason: r.u8(), value: r.f32() }),
  0x1f: (r) => ({ name: 'keep_alive', keepAliveId: r.i64() }),
  0x20: (r) => {
    const p = { name: 'map_chunk', x: r.i32(), z: r.i32(), groundUp: r.bool(), bitMap: r.varint() };
    p.chunkData = r.bytesN(r.varint());
    const n = r.varint();
    p.blockEntities = [];
    for (let i = 0; i < n; i++) p.blockEntities.push(readNbtRoot(r));
    return p;
  },
  0x21: (r) => ({ name: 'world_event', effectId: r.i32(), location: r.position(), data: r.i32(), global: r.bool() }),
  0x22: (r) => {
    const p = {
      name: 'world_particles', particleId: r.i32(), longDistance: r.bool(),
      x: r.f32(), y: r.f32(), z: r.f32(), offsetX: r.f32(), offsetY: r.f32(), offsetZ: r.f32(),
      particleData: r.f32(), particles: r.i32(), data: [],
    };
    p.data = r.particleData(p.particleId);
    return p;
  },
  0x23: (r) => ({
    name: 'login', entityId: r.i32(), gameMode: r.u8(), dimension: r.i32(), difficulty: r.u8(),
    maxPlayers: r.u8(), levelType: r.string(), reducedDebugInfo: r.bool(),
  }),
  0x24: (r) => {
    const p = { name: 'map', itemDamage: r.varint(), scale: r.i8(), trackingPosition: r.bool(), icons: [] };
    const n = r.varint();
    for (let i = 0; i < n; i++) {
      const type = r.varint(), x = r.i8(), z = r.i8(), direction = r.u8();
      p.icons.push({ type, direction, x, z, displayName: r.bool() ? r.string() : null });
    }
    p.columns = r.u8();
    if (p.columns > 0) {
      p.rows = r.u8(); p.x = r.u8(); p.y = r.u8();
      p.data = r.bytesN(r.varint());
    }
    return p;
  },
  0x25: (r) => ({ name: 'entity', entityId: r.varint() }),
  0x26: (r) => ({ name: 'rel_entity_move', entityId: r.varint(), dX: r.i16() / 4096, dY: r.i16() / 4096, dZ: r.i16() / 4096, onGround: r.bool() }),
  0x27: (r) => ({
    name: 'entity_move_look', entityId: r.varint(), dX: r.i16() / 4096, dY: r.i16() / 4096, dZ: r.i16() / 4096,
    yaw: r.angle(), pitch: r.angle(), onGround: r.bool(),
  }),
  0x28: (r) => ({ name: 'entity_look', entityId: r.varint(), yaw: r.angle(), pitch: r.angle(), onGround: r.bool() }),
  0x29: (r) => ({ name: 'vehicle_move', x: r.f64(), y: r.f64(), z: r.f64(), yaw: r.f32(), pitch: r.f32() }),
  0x2a: (r) => ({ name: 'open_sign_entity', location: r.position() }),
  0x2b: (r) => ({ name: 'craft_recipe_response', windowId: r.i8(), recipe: r.string() }),
  0x2c: (r) => ({ name: 'abilities', flags: r.i8(), flyingSpeed: r.f32(), walkingSpeed: r.f32() }),
  0x2d: (r) => {
    const p = { name: 'combat_event', event: r.varint() };
    if (p.event === 1) { p.duration = r.varint(); p.entityId = r.i32(); }
    if (p.event === 2) { p.playerId = r.varint(); p.entityId = r.i32(); p.message = r.string(); }
    return p;
  },
  0x2e: (r) => {
    const action = r.varint();
    const n = r.varint();
    const data = [];
    for (let i = 0; i < n; i++) {
      const e = { uuid: r.uuid() };
      if (action === 0) {
        e.name = r.string();
        const pc = r.varint();
        e.properties = [];
        for (let j = 0; j < pc; j++) {
          const prop = { name: r.string(), value: r.string() };
          if (r.bool()) prop.signature = r.string();
          e.properties.push(prop);
        }
        e.gamemode = r.varint();
        e.ping = r.varint();
        if (r.bool()) e.displayName = r.string();
      } else if (action === 1) {
        e.gamemode = r.varint();
      } else if (action === 2) {
        e.ping = r.varint();
      } else if (action === 3) {
        e.displayName = r.bool() ? r.string() : null;
      }
      data.push(e);
    }
    return { name: 'player_info', action, data };
  },
  0x2f: (r) => ({ name: 'position', x: r.f64(), y: r.f64(), z: r.f64(), yaw: r.f32(), pitch: r.f32(), flags: r.i8(), teleportId: r.varint() }),
  0x30: (r) => ({ name: 'bed', entityId: r.varint(), location: r.position() }),
  0x31: (r) => {
    const p = { name: 'unlock_recipes', action: r.varint(), craftingBookOpen: r.bool(), filteringCraftable: r.bool(), smeltingBookOpen: r.bool(), filteringSmeltable: r.bool(), recipes: strings(r) };
    if (p.action === 0) p.recipesToHighlight = strings(r);
    return p;
  },
  0x32: (r) => ({ name: 'entity_destroy', entityIds: varints(r) }),
  0x33: (r) => ({ name: 'remove_entity_effect', entityId: r.varint(), effectId: r.i8() }),
  0x34: (r) => ({ name: 'resource_pack_send', url: r.string(), hash: r.string() }),
  0x35: (r) => ({ name: 'respawn', dimension: r.i32(), difficulty: r.u8(), gamemode: r.u8(), levelType: r.string() }),
  0x36: (r) => ({ name: 'entity_head_rotation', entityId: r.varint(), headYaw: r.angle() }),
  0x37: (r) => ({ name: 'select_advancement_tab', id: r.bool() ? r.string() : null }),
  0x38: (r) => {
    const p = { name: 'world_border', action: r.varint() };
    switch (p.action) {
      case 0: p.radius = r.f64(); break;
      case 1: p.oldRadius = r.f64(); p.newRadius = r.f64(); p.speed = Number(r.varlong()); break;
      case 2: p.x = r.f64(); p.z = r.f64(); break;
      case 3:
        p.x = r.f64(); p.z = r.f64(); p.oldRadius = r.f64(); p.newRadius = r.f64();
        p.speed = Number(r.varlong()); p.portalBoundary = r.varint(); p.warningTime = r.varint(); p.warningBlocks = r.varint();
        break;
      case 4: p.warningTime = r.varint(); break;
      case 5: p.warningBlocks = r.varint(); break;
      default: break;
    }
    return p;
  },
  0x39: (r) => ({ name: 'camera', cameraId: r.varint() }),
  0x3a: (r) => ({ name: 'held_item_slot', slot: r.i8() }),
  0x3b: (r) => ({ name: 'scoreboard_display_objective', position: r.i8(), objective: r.string() }),
  0x3c: (r) => ({ name: 'entity_metadata', entityId: r.varint(), metadata: r.metadata() }),
  // leash only (riding is set_passengers)
  0x3d: (r) => ({ name: 'attach_entity', entityId: r.i32(), vehicleId: r.i32() }),
  0x3e: (r) => ({ name: 'entity_velocity', entityId: r.varint(), velocity: vec3i16(r) }),
  // slot: 0 main hand, 1 off hand, 2 feet, 3 legs, 4 chest, 5 head
  0x3f: (r) => ({ name: 'entity_equipment', entityId: r.varint(), slot: r.varint(), item: r.slot() }),
  0x40: (r) => ({ name: 'experience', experienceBar: r.f32(), level: r.varint(), totalExperience: r.varint() }),
  0x41: (r) => ({ name: 'update_health', health: r.f32(), food: r.varint(), foodSaturation: r.f32() }),
  0x42: (r) => {
    const p = { name: 'scoreboard_objective', objective: r.string(), action: r.i8() };
    if (p.action === 0 || p.action === 2) { p.displayText = r.string(); p.type = r.varint(); }
    return p;
  },
  0x43: (r) => ({ name: 'set_passengers', entityId: r.varint(), passengers: varints(r) }),
  0x44: (r) => {
    const p = { name: 'scoreboard_team', team: r.string(), mode: r.i8() };
    if (p.mode === 0 || p.mode === 2) {
      p.displayName = r.string(); p.friendlyFire = r.i8(); p.nameTagVisibility = r.string(); p.collisionRule = r.string();
      p.color = r.varint(); p.prefix = r.string(); p.suffix = r.string();
    }
    if (p.mode === 0 || p.mode === 3 || p.mode === 4) p.players = strings(r);
    return p;
  },
  0x45: (r) => {
    const p = { name: 'scoreboard_score', itemName: r.string(), action: r.varint(), scoreName: r.string() };
    if (p.action !== 1) p.value = r.varint();
    return p;
  },
  0x46: (r) => ({ name: 'spawn_position', location: r.position() }),
  0x47: (r) => ({ name: 'update_time', age: r.i64(), time: r.i64() }),
  // action: 0 title, 1 subtitle, 2 action bar, 3 times, 4 hide, 5 reset
  0x48: (r) => {
    const p = { name: 'title', action: r.varint() };
    if (p.action <= 2) p.text = r.string();
    if (p.action === 3) { p.fadeIn = r.i32(); p.stay = r.i32(); p.fadeOut = r.i32(); }
    return p;
  },
  0x49: (r) => ({
    name: 'sound_effect', soundId: r.varint(), soundCategory: r.varint(),
    x: r.i32() / 8, y: r.i32() / 8, z: r.i32() / 8, volume: r.f32(), pitch: r.f32(),
  }),
  0x4a: (r) => ({ name: 'playerlist_header', header: r.string(), footer: r.string() }),
  0x4b: (r) => ({ name: 'collect', collectedEntityId: r.varint(), collectorEntityId: r.varint(), pickupItemCount: r.varint() }),
  0x4c: (r) => ({
    name: 'entity_teleport', entityId: r.varint(), x: r.f64(), y: r.f64(), z: r.f64(),
    yaw: r.angle(), pitch: r.angle(), onGround: r.bool(),
  }),
  // SPacketAdvancementInfo: advancements to add, ids to remove, progress per advancement
  0x4d: (r) => {
    const p = { name: 'advancements', reset: r.bool(), added: [], removed: [], progress: [] };
    const n = r.varint();
    for (let i = 0; i < n; i++) {
      const a = { id: r.string(), parent: r.bool() ? r.string() : null, display: null, criteria: [], requirements: [] };
      if (r.bool()) {
        const d = a.display = { title: r.string(), description: r.string(), icon: r.slot(), frame: r.varint(), flags: r.i32() };
        d.background = d.flags & 1 ? r.string() : null;
        d.showToast = !!(d.flags & 2);
        d.hidden = !!(d.flags & 4);
        d.x = r.f32(); d.y = r.f32();
      }
      a.criteria = strings(r);
      const rn = r.varint();
      for (let j = 0; j < rn; j++) a.requirements.push(strings(r));
      p.added.push(a);
    }
    p.removed = strings(r);
    const m = r.varint();
    for (let i = 0; i < m; i++) {
      const id = r.string();
      const crit = {};
      const c = r.varint();
      for (let j = 0; j < c; j++) { const k = r.string(); crit[k] = r.bool() ? Number(r.i64()) : null; }
      p.progress.push({ id, criteria: crit });
    }
    return p;
  },
  0x4e: (r) => {
    const entityId = r.varint();
    const n = r.i32();
    const properties = [];
    for (let i = 0; i < n; i++) {
      const key = r.string();
      const value = r.f64();
      const m = r.varint();
      const modifiers = [];
      for (let j = 0; j < m; j++) modifiers.push({ uuid: r.uuid(), amount: r.f64(), operation: r.i8() });
      properties.push({ key, value, modifiers });
    }
    return { name: 'update_attributes', entityId, properties };
  },
  // flags: 1 ambient, 2 show particles
  0x4f: (r) => {
    const p = { name: 'entity_effect', entityId: r.varint(), effectId: r.i8(), amplifier: r.i8(), duration: r.varint(), flags: r.i8() };
    p.ambient = !!(p.flags & 1);
    p.hideParticles = !(p.flags & 2);
    return p;
  },
  0x50: (r) => {
    const flags = r.i8();
    return { name: 'stop_sound', flags, source: flags & 1 ? r.varint() : null, sound: flags & 2 ? r.string() : null };
  },
};

// 1.13.2 inserted command/recipe/tag packets and split the entity movement ids. Keep the
// mature field decoders above, but expose them under the protocol-404 registration order.
// Packets without a 1.12 counterpart remain unknown until their feature is ported.
const decoders404 = {
  0x00: decoders[0x00], 0x01: decoders[0x01], 0x02: decoders[0x02], 0x03: decoders[0x03],
  0x04: decoders[0x04], 0x05: decoders[0x05], 0x06: decoders[0x06], 0x07: decoders[0x07],
  0x08: decoders[0x08], 0x09: decoders[0x09], 0x0a: decoders[0x0a], 0x0b: decoders[0x0b],
  0x0c: decoders[0x0c], 0x0e: decoders[0x0f], 0x0f: decoders[0x10],
  0x10: (r) => {
    const p = { name: 'tab_complete', transactionId: r.varint(), start: r.varint(), length: r.varint(), matches: [] };
    const n = r.varint();
    for (let i = 0; i < n; i++) p.matches.push({ match: r.string(), tooltip: r.bool() ? r.string() : null });
    return p;
  },
  0x12: decoders[0x11], 0x13: decoders[0x12], 0x14: decoders[0x13], 0x15: decoders[0x14],
  0x16: decoders[0x15], 0x17: decoders[0x16], 0x18: decoders[0x17], 0x19: decoders[0x18],
  0x1a: decoders[0x19], 0x1b: decoders[0x1a], 0x1c: decoders[0x1b], 0x1e: decoders[0x1c],
  0x1f: decoders[0x1d], 0x20: decoders[0x1e], 0x21: decoders[0x1f], 0x22: decoders[0x20],
  0x23: decoders[0x21], 0x24: decoders[0x22], 0x25: decoders[0x23], 0x26: decoders[0x24],
  0x27: decoders[0x25], 0x28: decoders[0x26], 0x29: decoders[0x27], 0x2a: decoders[0x28],
  0x2b: decoders[0x29], 0x2c: decoders[0x2a], 0x2d: decoders[0x2b], 0x2e: decoders[0x2c],
  0x2f: decoders[0x2d], 0x30: decoders[0x2e], 0x32: decoders[0x2f], 0x33: decoders[0x30],
  0x34: decoders[0x31], 0x35: decoders[0x32], 0x36: decoders[0x33], 0x37: decoders[0x34],
  0x38: decoders[0x35], 0x39: decoders[0x36], 0x3a: decoders[0x37], 0x3b: decoders[0x38],
  0x3c: decoders[0x39], 0x3d: decoders[0x3a], 0x3e: decoders[0x3b], 0x3f: decoders[0x3c],
  0x40: decoders[0x3d], 0x41: decoders[0x3e], 0x42: decoders[0x3f], 0x43: decoders[0x40],
  0x44: decoders[0x41], 0x45: decoders[0x42], 0x46: decoders[0x43], 0x47: decoders[0x44],
  0x48: decoders[0x45], 0x49: decoders[0x46], 0x4a: decoders[0x47], 0x4b: decoders[0x48],
  0x4c: decoders[0x50], 0x4d: decoders[0x49], 0x4e: decoders[0x4a], 0x4f: decoders[0x4b],
  0x50: decoders[0x4c], 0x51: decoders[0x4d], 0x52: decoders[0x4e], 0x53: decoders[0x4f],
};

export function decodePacket(bytes) {
  const r = new Reader(bytes);
  const id = r.varint();
  const dec = decoders404[id];
  if (!dec) return { name: 'unknown', id };
  const p = dec(r);
  p.id = id;
  if (r.remaining() > 0 && p.name !== 'custom_payload') {
    p._extra = r.remaining();
  }
  return p;
}

// ---------------------------------------------------------------------------
// Serverbound encoders. Each returns a Uint8Array (varint id + body).
// hand: 0 main hand, 1 off hand
// ---------------------------------------------------------------------------

function pkt(id) { return new Writer().varint(id); }

const LEGACY_CHANNELS = {
  'MC|Brand': 'minecraft:brand',
  'MC|BEdit': 'minecraft:book_edit',
  'MC|BSign': 'minecraft:book_sign',
  'MC|BOpen': 'minecraft:book_open',
  'MC|TrList': 'minecraft:trader_list',
  'MC|TrSel': 'minecraft:trader_select',
  'MC|StopSound': 'minecraft:stop_sound',
  'MC|ItemName': 'minecraft:item_name',
  'MC|Beacon': 'minecraft:beacon',
  'MC|Struct': 'minecraft:structure_block',
  'MC|AutoCmd': 'minecraft:command_block',
  'MC|AdvCmd': 'minecraft:command_block',
};

function customPayloadChannel(channel) {
  const value = LEGACY_CHANNELS[channel] || channel;
  if (!/^[a-z0-9_.-]+:[a-z0-9/._-]+$/.test(value)) throw new Error(`Invalid custom payload channel: ${channel}`);
  return value;
}

export const C = {
  teleportConfirm: (teleportId) => pkt(0x00).varint(teleportId).build(),
  // Protocol 404's serverbound tab-complete packet is transaction + text.
  // Do not append the later command-assumption/position fields: 1.13.2 servers
  // reject those bytes as trailing data (and disconnect the client).
  tabComplete: (text, _position = null, transactionId = 0) => pkt(0x05).varint(transactionId).string(text).build(),
  // CPacketChatMessage: 256 characters since 1.11 (longer kicks the client)
  chat: (msg) => pkt(0x02).string(msg.length > 256 ? msg.slice(0, 256) : msg).build(),
  // 0 perform respawn, 1 request stats
  clientCommand: (action) => pkt(0x03).varint(action).build(),
  // mainHand: 0 left, 1 right
  settings: (locale, viewDistance, chatFlags, chatColors, skinParts, mainHand = 1) =>
    pkt(0x04).string(locale).i8(viewDistance).varint(chatFlags).bool(chatColors).u8(skinParts).varint(mainHand).build(),
  transaction: (windowId, action, accepted) => pkt(0x06).i8(windowId).i16(action).bool(accepted).build(),
  enchantItem: (windowId, enchantment) => pkt(0x07).i8(windowId).i8(enchantment).build(),
  windowClick: (windowId, slot, button, action, mode, item) => pkt(0x08).u8(windowId).i16(slot).i8(button).i16(action).varint(mode).slot(item).build(),
  closeWindow: (windowId) => pkt(0x09).u8(windowId).build(),
  customPayload: (channel, data) => pkt(0x0a).string(customPayloadChannel(channel)).raw(data).build(),
  // mouse: 0 interact, 1 attack, 2 interact_at
  useEntity: (target, mouse, x, y, z, hand = 0) => {
    const w = pkt(0x0d).varint(target).varint(mouse);
    if (mouse === 2) w.f32(x).f32(y).f32(z);
    if (mouse !== 1) w.varint(hand);
    return w.build();
  },
  keepAlive: (id) => pkt(0x0e).i64(id).build(),
  flying: (onGround) => pkt(0x0f).bool(onGround).build(),
  position: (x, y, z, onGround) => pkt(0x10).f64(x).f64(y).f64(z).bool(onGround).build(),
  positionLook: (x, y, z, yaw, pitch, onGround) => pkt(0x11).f64(x).f64(y).f64(z).f32(yaw).f32(pitch).bool(onGround).build(),
  look: (yaw, pitch, onGround) => pkt(0x12).f32(yaw).f32(pitch).bool(onGround).build(),
  vehicleMove: (x, y, z, yaw, pitch) => pkt(0x13).f64(x).f64(y).f64(z).f32(yaw).f32(pitch).build(),
  steerBoat: (left, right) => pkt(0x14).bool(left).bool(right).build(),
  abilities: (flags, flySpeed, walkSpeed) => pkt(0x17).i8(flags).f32(flySpeed).f32(walkSpeed).build(),
  // status: 0 start, 1 cancel, 2 finish, 3 drop stack, 4 drop item, 5 release use item, 6 swap hands
  blockDig: (status, x, y, z, face) => pkt(0x18).varint(status).position(x, y, z).i8(face).build(),
  // action: 0 start sneak, 1 stop sneak, 2 leave bed, 3 start sprint, 4 stop sprint, 5 start horse jump,
  // 6 stop horse jump, 7 open horse inventory, 8 start elytra flying
  entityAction: (eid, action, jumpBoost = 0) => pkt(0x19).varint(eid).varint(action).varint(jumpBoost).build(),
  steerVehicle: (sideways, forward, flags) => pkt(0x1a).f32(sideways).f32(forward).u8(flags).build(),
  resourcePackStatus: (result) => pkt(0x1d).varint(result).build(),
  // CPacketPlaceRecipe: fill the crafting grid with a recipe (all: as many times as possible)
  placeRecipe: (windowId, recipe, all) => pkt(0x16).i8(windowId).string(String(recipe)).bool(all).build(),
  // CPacketRecipeInfo: a new recipe was seen / the book's open and filtering flags
  recipeInfoShown: (recipe) => pkt(0x1b).varint(0).string(String(recipe)).build(),
  recipeInfoSettings: (open, filtering) => pkt(0x1b).varint(1).bool(open).bool(filtering).bool(false).bool(false).build(),
  // CPacketSeenAdvancements: opened a tab (id) / closed the screen (null)
  seenAdvancements: (tab) => (tab ? pkt(0x1e).varint(0).string(tab).build() : pkt(0x1e).varint(1).build()),
  heldItemSlot: (slot) => pkt(0x21).i16(slot).build(),
  creativeSlot: (slot, item) => pkt(0x24).i16(slot).slot(item).build(),
  // plain text lines (1.9+)
  updateSign: (x, y, z, lines) => {
    const w = pkt(0x26).position(x, y, z);
    for (let i = 0; i < 4; i++) w.string(lines[i] || '');
    return w.build();
  },
  armAnimation: (hand = 0) => pkt(0x27).varint(hand).build(),
  spectate: (uuid) => pkt(0x28).uuid(uuid).build(),
  // cursor position on the face, 0..1
  blockPlace: (x, y, z, face, hand, cx, cy, cz) => pkt(0x29).position(x, y, z).varint(face).varint(hand).f32(cx).f32(cy).f32(cz).build(),
  useItem: (hand = 0) => pkt(0x2a).varint(hand).build(),
};

export function mcStringBytes(s) {
  return new Writer().string(s).build();
}
