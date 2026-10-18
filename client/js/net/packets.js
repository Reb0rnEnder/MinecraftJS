// Minecraft 1.8.x (protocol 47) play-state packet codec.
import { Reader, Writer } from './buffer.js';

const vec3i16 = (r) => ({ x: r.i16(), y: r.i16(), z: r.i16() });

// Clientbound decoders, indexed by packet id
const decoders = {
  0x00: (r) => ({ name: 'keep_alive', keepAliveId: r.varint() }),
  0x01: (r) => ({
    name: 'login', entityId: r.i32(), gameMode: r.u8(), dimension: r.i8(), difficulty: r.u8(),
    maxPlayers: r.u8(), levelType: r.string(), reducedDebugInfo: r.bool(),
  }),
  0x02: (r) => ({ name: 'chat', message: r.string(), position: r.i8() }),
  0x03: (r) => ({ name: 'update_time', age: r.i64(), time: r.i64() }),
  0x04: (r) => ({ name: 'entity_equipment', entityId: r.varint(), slot: r.i16(), item: r.slot() }),
  0x05: (r) => ({ name: 'spawn_position', location: r.position() }),
  0x06: (r) => ({ name: 'update_health', health: r.f32(), food: r.varint(), foodSaturation: r.f32() }),
  0x07: (r) => ({ name: 'respawn', dimension: r.i32(), difficulty: r.u8(), gamemode: r.u8(), levelType: r.string() }),
  0x08: (r) => ({ name: 'position', x: r.f64(), y: r.f64(), z: r.f64(), yaw: r.f32(), pitch: r.f32(), flags: r.i8() }),
  0x09: (r) => ({ name: 'held_item_slot', slot: r.i8() }),
  0x0a: (r) => ({ name: 'bed', entityId: r.varint(), location: r.position() }),
  0x0b: (r) => ({ name: 'animation', entityId: r.varint(), animation: r.u8() }),
  0x0c: (r) => ({
    name: 'named_entity_spawn', entityId: r.varint(), playerUUID: r.uuid(),
    x: r.i32() / 32, y: r.i32() / 32, z: r.i32() / 32, yaw: r.angle(), pitch: r.angle(),
    currentItem: r.i16(), metadata: r.metadata(),
  }),
  0x0d: (r) => ({ name: 'collect', collectedEntityId: r.varint(), collectorEntityId: r.varint() }),
  0x0e: (r) => {
    const p = {
      name: 'spawn_entity', entityId: r.varint(), type: r.i8(),
      x: r.i32() / 32, y: r.i32() / 32, z: r.i32() / 32, pitch: r.angle(), yaw: r.angle(),
      objectData: r.i32(), velocity: null,
    };
    if (p.objectData !== 0) p.velocity = vec3i16(r);
    return p;
  },
  0x0f: (r) => ({
    name: 'spawn_entity_living', entityId: r.varint(), type: r.u8(),
    x: r.i32() / 32, y: r.i32() / 32, z: r.i32() / 32,
    yaw: r.angle(), pitch: r.angle(), headPitch: r.angle(),
    velocity: vec3i16(r), metadata: r.metadata(),
  }),
  0x10: (r) => ({ name: 'spawn_entity_painting', entityId: r.varint(), title: r.string(), location: r.position(), direction: r.u8() }),
  0x11: (r) => ({ name: 'spawn_entity_experience_orb', entityId: r.varint(), x: r.i32() / 32, y: r.i32() / 32, z: r.i32() / 32, count: r.i16() }),
  0x12: (r) => ({ name: 'entity_velocity', entityId: r.varint(), velocity: vec3i16(r) }),
  0x13: (r) => {
    const n = r.varint();
    const ids = [];
    for (let i = 0; i < n; i++) ids.push(r.varint());
    return { name: 'entity_destroy', entityIds: ids };
  },
  0x14: (r) => ({ name: 'entity', entityId: r.varint() }),
  0x15: (r) => ({ name: 'rel_entity_move', entityId: r.varint(), dX: r.i8() / 32, dY: r.i8() / 32, dZ: r.i8() / 32, onGround: r.bool() }),
  0x16: (r) => ({ name: 'entity_look', entityId: r.varint(), yaw: r.angle(), pitch: r.angle(), onGround: r.bool() }),
  0x17: (r) => ({
    name: 'entity_move_look', entityId: r.varint(), dX: r.i8() / 32, dY: r.i8() / 32, dZ: r.i8() / 32,
    yaw: r.angle(), pitch: r.angle(), onGround: r.bool(),
  }),
  0x18: (r) => ({
    name: 'entity_teleport', entityId: r.varint(), x: r.i32() / 32, y: r.i32() / 32, z: r.i32() / 32,
    yaw: r.angle(), pitch: r.angle(), onGround: r.bool(),
  }),
  0x19: (r) => ({ name: 'entity_head_rotation', entityId: r.varint(), headYaw: r.angle() }),
  0x1a: (r) => ({ name: 'entity_status', entityId: r.i32(), entityStatus: r.i8() }),
  0x1b: (r) => ({ name: 'attach_entity', entityId: r.i32(), vehicleId: r.i32(), leash: r.bool() }),
  0x1c: (r) => ({ name: 'entity_metadata', entityId: r.varint(), metadata: r.metadata() }),
  0x1d: (r) => ({ name: 'entity_effect', entityId: r.varint(), effectId: r.i8(), amplifier: r.i8(), duration: r.varint(), hideParticles: r.bool() }),
  0x1e: (r) => ({ name: 'remove_entity_effect', entityId: r.varint(), effectId: r.i8() }),
  0x1f: (r) => ({ name: 'experience', experienceBar: r.f32(), level: r.varint(), totalExperience: r.varint() }),
  0x20: (r) => {
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
  0x21: (r) => {
    const p = { name: 'map_chunk', x: r.i32(), z: r.i32(), groundUp: r.bool(), bitMap: r.u16() };
    p.chunkData = r.bytesN(r.varint());
    return p;
  },
  0x22: (r) => {
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
  0x23: (r) => ({ name: 'block_change', location: r.position(), state: r.varint() }),
  0x24: (r) => ({ name: 'block_action', location: r.position(), byte1: r.u8(), byte2: r.u8(), blockId: r.varint() }),
  0x25: (r) => ({ name: 'block_break_animation', entityId: r.varint(), location: r.position(), destroyStage: r.i8() }),
  0x26: (r) => {
    const skyLightSent = r.bool();
    const n = r.varint();
    const meta = [];
    for (let i = 0; i < n; i++) meta.push({ x: r.i32(), z: r.i32(), bitMap: r.u16() });
    return { name: 'map_chunk_bulk', skyLightSent, meta, data: r.rest() };
  },
  0x27: (r) => {
    const p = { name: 'explosion', x: r.f32(), y: r.f32(), z: r.f32(), radius: r.f32(), records: [] };
    const n = r.i32();
    for (let i = 0; i < n; i++) p.records.push({ x: r.i8(), y: r.i8(), z: r.i8() });
    p.motionX = r.f32(); p.motionY = r.f32(); p.motionZ = r.f32();
    return p;
  },
  0x28: (r) => ({ name: 'world_event', effectId: r.i32(), location: r.position(), data: r.i32(), global: r.bool() }),
  0x29: (r) => ({
    name: 'named_sound_effect', soundName: r.string(), x: r.i32() / 8, y: r.i32() / 8, z: r.i32() / 8,
    volume: r.f32(), pitch: r.u8() / 63,
  }),
  0x2a: (r) => {
    const p = {
      name: 'world_particles', particleId: r.i32(), longDistance: r.bool(),
      x: r.f32(), y: r.f32(), z: r.f32(), offsetX: r.f32(), offsetY: r.f32(), offsetZ: r.f32(),
      particleData: r.f32(), particles: r.i32(), data: [],
    };
    const n = p.particleId === 36 ? 2 : (p.particleId === 37 || p.particleId === 38) ? 1 : 0;
    for (let i = 0; i < n; i++) p.data.push(r.varint());
    return p;
  },
  0x2b: (r) => ({ name: 'game_state_change', reason: r.u8(), value: r.f32() }),
  0x2c: (r) => ({ name: 'spawn_entity_weather', entityId: r.varint(), type: r.i8(), x: r.i32() / 32, y: r.i32() / 32, z: r.i32() / 32 }),
  0x2d: (r) => {
    const p = { name: 'open_window', windowId: r.u8(), inventoryType: r.string(), windowTitle: r.string(), slotCount: r.u8() };
    if (p.inventoryType === 'EntityHorse') p.entityId = r.i32();
    return p;
  },
  0x2e: (r) => ({ name: 'close_window', windowId: r.u8() }),
  0x2f: (r) => ({ name: 'set_slot', windowId: r.i8(), slot: r.i16(), item: r.slot() }),
  0x30: (r) => {
    const windowId = r.u8();
    const n = r.i16();
    const items = [];
    for (let i = 0; i < n; i++) items.push(r.slot());
    return { name: 'window_items', windowId, items };
  },
  0x31: (r) => ({ name: 'craft_progress_bar', windowId: r.u8(), property: r.i16(), value: r.i16() }),
  0x32: (r) => ({ name: 'transaction', windowId: r.i8(), action: r.i16(), accepted: r.bool() }),
  0x33: (r) => ({ name: 'update_sign', location: r.position(), lines: [r.string(), r.string(), r.string(), r.string()] }),
  0x34: (r) => {
    const p = { name: 'map', itemDamage: r.varint(), scale: r.i8(), icons: [] };
    const n = r.varint();
    for (let i = 0; i < n; i++) {
      const dt = r.i8();
      p.icons.push({ type: (dt >> 4) & 15, direction: dt & 15, x: r.i8(), z: r.i8() });
    }
    p.columns = r.u8();
    if (p.columns > 0) {
      p.rows = r.u8(); p.x = r.u8(); p.y = r.u8();
      p.data = r.bytesN(r.varint());
    }
    return p;
  },
  0x35: (r) => ({ name: 'tile_entity_data', location: r.position(), action: r.u8(), nbtData: r.optionalNbt() }),
  0x36: (r) => ({ name: 'open_sign_entity', location: r.position() }),
  0x37: (r) => {
    const n = r.varint();
    const entries = [];
    for (let i = 0; i < n; i++) entries.push({ name: r.string(), value: r.varint() });
    return { name: 'statistics', entries };
  },
  0x38: (r) => {
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
  0x39: (r) => ({ name: 'abilities', flags: r.i8(), flyingSpeed: r.f32(), walkingSpeed: r.f32() }),
  0x3a: (r) => {
    const n = r.varint();
    const matches = [];
    for (let i = 0; i < n; i++) matches.push(r.string());
    return { name: 'tab_complete', matches };
  },
  0x3b: (r) => {
    const p = { name: 'scoreboard_objective', objective: r.string(), action: r.i8() };
    if (p.action === 0 || p.action === 2) { p.displayText = r.string(); p.type = r.string(); }
    return p;
  },
  0x3c: (r) => {
    const p = { name: 'scoreboard_score', itemName: r.string(), action: r.varint(), scoreName: r.string() };
    if (p.action !== 1) p.value = r.varint();
    return p;
  },
  0x3d: (r) => ({ name: 'scoreboard_display_objective', position: r.i8(), objective: r.string() }),
  0x3e: (r) => {
    const p = { name: 'scoreboard_team', team: r.string(), mode: r.i8() };
    if (p.mode === 0 || p.mode === 2) {
      p.displayName = r.string(); p.prefix = r.string(); p.suffix = r.string();
      p.friendlyFire = r.i8(); p.nameTagVisibility = r.string(); p.color = r.i8();
    }
    if (p.mode === 0 || p.mode === 3 || p.mode === 4) {
      const n = r.varint();
      p.players = [];
      for (let i = 0; i < n; i++) p.players.push(r.string());
    }
    return p;
  },
  0x3f: (r) => ({ name: 'custom_payload', channel: r.string(), data: r.rest() }),
  0x40: (r) => ({ name: 'kick_disconnect', reason: r.string() }),
  0x41: (r) => ({ name: 'difficulty', difficulty: r.u8() }),
  0x42: (r) => {
    const p = { name: 'combat_event', event: r.varint() };
    if (p.event === 1) { p.duration = r.varint(); p.entityId = r.i32(); }
    if (p.event === 2) { p.playerId = r.varint(); p.entityId = r.i32(); p.message = r.string(); }
    return p;
  },
  0x43: (r) => ({ name: 'camera', cameraId: r.varint() }),
  0x44: (r) => {
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
  0x45: (r) => {
    const p = { name: 'title', action: r.varint() };
    if (p.action === 0 || p.action === 1) p.text = r.string();
    if (p.action === 2) { p.fadeIn = r.i32(); p.stay = r.i32(); p.fadeOut = r.i32(); }
    return p;
  },
  0x46: (r) => ({ name: 'set_compression', threshold: r.varint() }),
  0x47: (r) => ({ name: 'playerlist_header', header: r.string(), footer: r.string() }),
  0x48: (r) => ({ name: 'resource_pack_send', url: r.string(), hash: r.string() }),
  0x49: (r) => ({ name: 'update_entity_nbt', entityId: r.varint(), tag: r.optionalNbt() }),
};

export function decodePacket(bytes) {
  const r = new Reader(bytes);
  const id = r.varint();
  const dec = decoders[id];
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
// ---------------------------------------------------------------------------

function pkt(id) { return new Writer().varint(id); }

export const C = {
  keepAlive: (id) => pkt(0x00).varint(id).build(),
  // C01PacketChatMessage truncates to 100 characters (longer kicks the client)
  chat: (msg) => pkt(0x01).string(msg.length > 100 ? msg.slice(0, 100) : msg).build(),
  // mouse: 0 interact, 1 attack, 2 interact_at
  useEntity: (target, mouse, x, y, z) => {
    const w = pkt(0x02).varint(target).varint(mouse);
    if (mouse === 2) w.f32(x).f32(y).f32(z);
    return w.build();
  },
  flying: (onGround) => pkt(0x03).bool(onGround).build(),
  position: (x, y, z, onGround) => pkt(0x04).f64(x).f64(y).f64(z).bool(onGround).build(),
  look: (yaw, pitch, onGround) => pkt(0x05).f32(yaw).f32(pitch).bool(onGround).build(),
  positionLook: (x, y, z, yaw, pitch, onGround) => pkt(0x06).f64(x).f64(y).f64(z).f32(yaw).f32(pitch).bool(onGround).build(),
  // status: 0 start, 1 cancel, 2 finish, 3 drop stack, 4 drop item, 5 release use item
  blockDig: (status, x, y, z, face) => pkt(0x07).u8(status).position(x, y, z).i8(face).build(),
  blockPlace: (x, y, z, face, item, cx, cy, cz) => pkt(0x08).position(x, y, z).i8(face).slot(item).i8(cx).i8(cy).i8(cz).build(),
  heldItemSlot: (slot) => pkt(0x09).i16(slot).build(),
  armAnimation: () => pkt(0x0a).build(),
  // action: 0 start sneak, 1 stop sneak, 2 leave bed, 3 start sprint, 4 stop sprint, 5 horse jump, 6 open horse inv
  entityAction: (eid, action, jumpBoost = 0) => pkt(0x0b).varint(eid).varint(action).varint(jumpBoost).build(),
  steerVehicle: (sideways, forward, flags) => pkt(0x0c).f32(sideways).f32(forward).u8(flags).build(),
  closeWindow: (windowId) => pkt(0x0d).u8(windowId).build(),
  windowClick: (windowId, slot, button, action, mode, item) => pkt(0x0e).u8(windowId).i16(slot).i8(button).i16(action).i8(mode).slot(item).build(),
  transaction: (windowId, action, accepted) => pkt(0x0f).i8(windowId).i16(action).bool(accepted).build(),
  creativeSlot: (slot, item) => pkt(0x10).i16(slot).slot(item).build(),
  enchantItem: (windowId, enchantment) => pkt(0x11).i8(windowId).i8(enchantment).build(),
  updateSign: (x, y, z, lines) => {
    const w = pkt(0x12).position(x, y, z);
    for (let i = 0; i < 4; i++) w.string(JSON.stringify({ text: lines[i] || '' }));
    return w.build();
  },
  abilities: (flags, flySpeed, walkSpeed) => pkt(0x13).i8(flags).f32(flySpeed).f32(walkSpeed).build(),
  tabComplete: (text, block) => {
    const w = pkt(0x14).string(text).bool(!!block);
    if (block) w.position(block.x, block.y, block.z);
    return w.build();
  },
  settings: (locale, viewDistance, chatFlags, chatColors, skinParts) =>
    pkt(0x15).string(locale).i8(viewDistance).i8(chatFlags).bool(chatColors).u8(skinParts).build(),
  // 0 respawn, 1 request stats, 2 open inventory achievement
  clientCommand: (action) => pkt(0x16).varint(action).build(),
  customPayload: (channel, data) => pkt(0x17).string(channel).raw(data).build(),
  spectate: (uuid) => pkt(0x18).uuid(uuid).build(),
  resourcePackStatus: (hash, result) => pkt(0x19).string(hash).varint(result).build(),
};

export function mcStringBytes(s) {
  return new Writer().string(s).build();
}
