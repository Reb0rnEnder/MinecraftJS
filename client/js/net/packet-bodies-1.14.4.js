// Native protocol-498 packet bodies. Packet IDs are registered by name in protocol-1.14.4-ids.js.
const vec3i16=r=>({x:r.i16(),y:r.i16(),z:r.i16()});
const strings=r=>Array.from({length:r.varint()},()=>r.string());
const varints=r=>Array.from({length:r.varint()},()=>r.varint());
export const PACKET_BODIES_498={
  spawn_entity_experience_orb: (r) => ({ name: 'spawn_entity_experience_orb', entityId: r.varint(), x: r.f64(), y: r.f64(), z: r.f64(), count: r.i16() }),
  spawn_entity_weather: (r) => ({ name: 'spawn_entity_weather', entityId: r.varint(), type: r.i8(), x: r.f64(), y: r.f64(), z: r.f64() }),
  spawn_entity_living: (r) => ({
    name: 'spawn_entity_living', entityId: r.varint(), entityUUID: r.uuid(), type: r.varint(),
    x: r.f64(), y: r.f64(), z: r.f64(), yaw: r.angle(), pitch: r.angle(), headPitch: r.angle(),
    velocity: vec3i16(r), metadata: r.metadata(),
  }),
  spawn_entity_painting: (r) => ({ name: 'spawn_entity_painting', entityId: r.varint(), entityUUID: r.uuid(), title: r.varint(), location: r.position(), direction: r.u8() }),
  named_entity_spawn: (r) => ({
    name: 'named_entity_spawn', entityId: r.varint(), playerUUID: r.uuid(),
    x: r.f64(), y: r.f64(), z: r.f64(), yaw: r.angle(), pitch: r.angle(), metadata: r.metadata(),
  }),
  animation: (r) => ({ name: 'animation', entityId: r.varint(), animation: r.u8() }),
  tile_entity_data: (r) => ({ name: 'tile_entity_data', location: r.position(), action: r.u8(), nbtData: r.optionalNbt() }),
  block_action: (r) => ({ name: 'block_action', location: r.position(), byte1: r.u8(), byte2: r.u8(), blockId: r.varint() }),
  boss_bar: (r) => {
    const p = { name: 'boss_bar', uuid: r.uuid(), action: r.varint() };
    if (p.action === 0) { p.title = r.string(); p.health = r.f32(); p.color = r.varint(); p.dividers = r.varint(); p.flags = r.u8(); }
    else if (p.action === 2) p.health = r.f32();
    else if (p.action === 3) p.title = r.string();
    else if (p.action === 4) { p.color = r.varint(); p.dividers = r.varint(); }
    else if (p.action === 5) p.flags = r.u8();
    return p;
  },
  multi_block_change: (r) => {
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
  tab_complete: (r) => {
    const p = { name: 'tab_complete', transactionId: r.varint(), start: r.varint(), length: r.varint(), matches: [] };
    const n = r.varint();
    for (let i = 0; i < n; i++) p.matches.push({ match: r.string(), tooltip: r.bool() ? r.string() : null });
    return p;
  },
  transaction: (r) => ({ name: 'transaction', windowId: r.i8(), action: r.i16(), accepted: r.bool() }),
  close_window: (r) => ({ name: 'close_window', windowId: r.u8() }),
  craft_progress_bar: (r) => ({ name: 'craft_progress_bar', windowId: r.u8(), property: r.i16(), value: r.i16() }),
  set_cooldown: (r) => ({ name: 'set_cooldown', itemId: r.varint(), cooldownTicks: r.varint() }),
  named_sound_effect: (r) => ({
    name: 'named_sound_effect', soundName: r.string(), soundCategory: r.varint(),
    x: r.i32() / 8, y: r.i32() / 8, z: r.i32() / 8, volume: r.f32(), pitch: r.f32(),
  }),
  explosion: (r) => {
    const p = { name: 'explosion', x: r.f32(), y: r.f32(), z: r.f32(), radius: r.f32(), records: [] };
    const n = r.i32();
    for (let i = 0; i < n; i++) p.records.push({ x: r.i8(), y: r.i8(), z: r.i8() });
    p.motionX = r.f32(); p.motionY = r.f32(); p.motionZ = r.f32();
    return p;
  },
  game_state_change: (r) => ({ name: 'game_state_change', reason: r.u8(), value: r.f32() }),
  world_event: (r) => ({ name: 'world_event', effectId: r.i32(), location: r.position(), data: r.i32(), global: r.bool() }),
  world_particles: (r) => {
    const p = {
      name: 'world_particles', particleId: r.i32(), longDistance: r.bool(),
      x: r.f32(), y: r.f32(), z: r.f32(), offsetX: r.f32(), offsetY: r.f32(), offsetZ: r.f32(),
      particleData: r.f32(), particles: r.i32(), data: [],
    };
    p.data = r.particleData(p.particleId);
    return p;
  },
  rel_entity_move: (r) => ({ name: 'rel_entity_move', entityId: r.varint(), dX: r.i16() / 4096, dY: r.i16() / 4096, dZ: r.i16() / 4096, onGround: r.bool() }),
  entity_move_look: (r) => ({
    name: 'entity_move_look', entityId: r.varint(), dX: r.i16() / 4096, dY: r.i16() / 4096, dZ: r.i16() / 4096,
    yaw: r.angle(), pitch: r.angle(), onGround: r.bool(),
  }),
  entity_look: (r) => ({ name: 'entity_look', entityId: r.varint(), yaw: r.angle(), pitch: r.angle(), onGround: r.bool() }),
  entity: (r) => ({ name: 'entity', entityId: r.varint() }),
  vehicle_move: (r) => ({ name: 'vehicle_move', x: r.f64(), y: r.f64(), z: r.f64(), yaw: r.f32(), pitch: r.f32() }),
  open_sign_entity: (r) => ({ name: 'open_sign_entity', location: r.position() }),
  craft_recipe_response: (r) => ({ name: 'craft_recipe_response', windowId: r.i8(), recipe: r.string() }),
  combat_event: (r) => {
    const p = { name: 'combat_event', event: r.varint() };
    if (p.event === 1) { p.duration = r.varint(); p.entityId = r.i32(); }
    if (p.event === 2) { p.playerId = r.varint(); p.entityId = r.i32(); p.message = r.string(); }
    return p;
  },
  player_info: (r) => {
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
  unlock_recipes: (r) => {
    const p = { name: 'unlock_recipes', action: r.varint(), craftingBookOpen: r.bool(), filteringCraftable: r.bool(), smeltingBookOpen: r.bool(), filteringSmeltable: r.bool(), recipes: strings(r) };
    if (p.action === 0) p.recipesToHighlight = strings(r);
    return p;
  },
  entity_destroy: (r) => ({ name: 'entity_destroy', entityIds: varints(r) }),
  remove_entity_effect: (r) => ({ name: 'remove_entity_effect', entityId: r.varint(), effectId: r.i8() }),
  resource_pack_send: (r) => ({ name: 'resource_pack_send', url: r.string(), hash: r.string() }),
  entity_head_rotation: (r) => ({ name: 'entity_head_rotation', entityId: r.varint(), headYaw: r.angle() }),
  select_advancement_tab: (r) => ({ name: 'select_advancement_tab', id: r.bool() ? r.string() : null }),
  world_border: (r) => {
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
  camera: (r) => ({ name: 'camera', cameraId: r.varint() }),
  scoreboard_display_objective: (r) => ({ name: 'scoreboard_display_objective', position: r.i8(), objective: r.string() }),
  attach_entity: (r) => ({ name: 'attach_entity', entityId: r.i32(), vehicleId: r.i32() }),
  entity_velocity: (r) => ({ name: 'entity_velocity', entityId: r.varint(), velocity: vec3i16(r) }),
  entity_equipment: (r) => ({ name: 'entity_equipment', entityId: r.varint(), slot: r.varint(), item: r.slot() }),
  experience: (r) => ({ name: 'experience', experienceBar: r.f32(), level: r.varint(), totalExperience: r.varint() }),
  scoreboard_objective: (r) => {
    const p = { name: 'scoreboard_objective', objective: r.string(), action: r.i8() };
    if (p.action === 0 || p.action === 2) { p.displayText = r.string(); p.type = r.varint(); }
    return p;
  },
  set_passengers: (r) => ({ name: 'set_passengers', entityId: r.varint(), passengers: varints(r) }),
  teams: (r) => {
    const p = { name: 'scoreboard_team', team: r.string(), mode: r.i8() };
    if (p.mode === 0 || p.mode === 2) {
      p.displayName = r.string(); p.friendlyFire = r.i8(); p.nameTagVisibility = r.string(); p.collisionRule = r.string();
      p.color = r.varint(); p.prefix = r.string(); p.suffix = r.string();
    }
    if (p.mode === 0 || p.mode === 3 || p.mode === 4) p.players = strings(r);
    return p;
  },
  scoreboard_score: (r) => {
    const p = { name: 'scoreboard_score', itemName: r.string(), action: r.varint(), scoreName: r.string() };
    if (p.action !== 1) p.value = r.varint();
    return p;
  },
  title: (r) => {
    const p = { name: 'title', action: r.varint() };
    if (p.action <= 2) p.text = r.string();
    if (p.action === 3) { p.fadeIn = r.i32(); p.stay = r.i32(); p.fadeOut = r.i32(); }
    return p;
  },
  sound_effect: (r) => ({
    name: 'sound_effect', soundId: r.varint(), soundCategory: r.varint(),
    x: r.i32() / 8, y: r.i32() / 8, z: r.i32() / 8, volume: r.f32(), pitch: r.f32(),
  }),
  stop_sound: (r) => {
    const flags = r.i8();
    return { name: 'stop_sound', flags, source: flags & 1 ? r.varint() : null, sound: flags & 2 ? r.string() : null };
  },
  playerlist_header: (r) => ({ name: 'playerlist_header', header: r.string(), footer: r.string() }),
  collect: (r) => ({ name: 'collect', collectedEntityId: r.varint(), collectorEntityId: r.varint(), pickupItemCount: r.varint() }),
  entity_teleport: (r) => ({
    name: 'entity_teleport', entityId: r.varint(), x: r.f64(), y: r.f64(), z: r.f64(),
    yaw: r.angle(), pitch: r.angle(), onGround: r.bool(),
  }),
  advancements: (r) => {
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
  entity_update_attributes: (r) => {
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
};
