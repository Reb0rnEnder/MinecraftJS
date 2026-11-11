import { Reader766 } from "./configuration-1.20.6.js";
import { readAnonymousNbt } from "./nbt-anonymous.js";
import { componentFromNbt } from "./component-nbt-1.20.6.js";
import { readSlot766, decorateItemCost766 } from "./item-components-1.20.6.js";
import { PLAY_SCHEMA_766 } from "./play-schema-1.20.6.js";
import { bitsetValue, compactMask, maskHas, maskHighest, maskValue } from "./bitset.js";
import { simplify } from "./nbt.js";

const TYPES = PLAY_SCHEMA_766.types;
const NAME_BY_ID = Object.fromEntries(Object.entries(PLAY_SCHEMA_766.ids).map(([name, id]) => [id, name]));
const MAX_COLLECTION = 1048576;

function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_COLLECTION) {
    throw new Error("Invalid " + label + " length");
  }
  return value;
}

function scope(value, parent = null) {
  return { value, parent };
}

function lookup(current, path) {
  let cursor = current;
  const parts = String(path).split("/");
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      cursor = cursor?.parent;
      continue;
    }
    if (!cursor) return undefined;
    const value = cursor.value?.[part];
    cursor = scope(value, cursor);
  }
  return cursor?.value;
}

function primitive(reader, name) {
  switch (name) {
    case "i8": return reader.i8();
    case "u8": return reader.u8();
    case "i16": return reader.i16();
    case "i32": return reader.i32();
    case "i64": return reader.i64();
    case "f32": return reader.f32();
    case "f64": return reader.f64();
    case "bool": return reader.bool();
    case "varint": case "optvarint": return reader.varint();
    case "varlong": return reader.varlong();
    case "string": return reader.string();
    case "UUID": return reader.uuid();
    case "position": return reader.position();
    case "anonymousNbt": {
      const value = readAnonymousNbt(reader);
      if (!value) throw new Error("Missing anonymous NBT payload");
      return value;
    }
    case "anonOptionalNbt": return readAnonymousNbt(reader);
    case "Slot": return readSlot766(reader);
    case "vec3f": return { x: reader.f32(), y: reader.f32(), z: reader.f32() };
    case "vec3f64": return { x: reader.f64(), y: reader.f64(), z: reader.f64() };
    case "vec3i16": return { x: reader.i16(), y: reader.i16(), z: reader.i16() };
    case "vec4f": return { x: reader.f32(), y: reader.f32(), z: reader.f32(), w: reader.f32() };
    case "void": return undefined;
    default: return null;
  }
}

function readBitfield(reader, fields) {
  const total = fields.reduce((sum, field) => sum + field.size, 0);
  let raw;
  if (total === 8) raw = BigInt(reader.u8());
  else if (total === 64) raw = BigInt.asUintN(64, reader.i64());
  else throw new Error("Unsupported protocol-766 bitfield width " + total);
  let shift = BigInt(total);
  const out = {};
  for (const field of fields) {
    shift -= BigInt(field.size);
    const bits = (raw >> shift) & ((1n << BigInt(field.size)) - 1n);
    out[field.name] = Number(field.signed ? BigInt.asIntN(field.size, bits) : bits);
  }
  return out;
}

function readContainer(reader, fields, parent, depth, firstByte = null) {
  const out = {};
  const current = scope(out, parent);
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    let value;
    if (index === 0 && firstByte !== null) {
      if (field.type !== "i8" && field.type !== "u8") {
        throw new Error("Top-bit terminated element must begin with a byte field");
      }
      value = field.type === "i8" && firstByte >= 128 ? firstByte - 256 : firstByte;
    } else {
      value = readType(reader, field.type, current, depth + 1);
    }
    if (field.anon) {
      if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(out, value);
    } else if (value !== undefined) {
      out[field.name] = value;
    }
  }
  return out;
}

function readType(reader, spec, current = null, depth = 0) {
  if (depth > 128) throw new Error("Protocol-766 Play schema nesting too deep");
  if (typeof spec === "string") {
    if (spec === "Slot") return readSlot766(reader);
    const value = primitive(reader, spec);
    if (value !== null || ["void", "anonOptionalNbt"].includes(spec)) return value;
    const named = TYPES[spec];
    if (!named) throw new Error("Unknown protocol-766 Play type " + spec);
    return readType(reader, named, current, depth + 1);
  }

  const [kind, args] = spec;
  if (kind === "container") return readContainer(reader, args, current, depth);

  if (kind === "array") {
    const length = args.count !== undefined
      ? count(Number(typeof args.count === 'number' ? args.count : lookup(current, args.count)), "Play array")
      : count(Number(readType(reader, args.countType, current, depth + 1)), "Play array");
    const out = new Array(length);
    // Arrays do not introduce a named container scope in ProtoDef. Adding one
    // breaks shaped-recipe dimensions and ../action in player-info entries.
    for (let i = 0; i < length; i++) out[i] = readType(reader, args.type, current, depth + 1);
    return out;
  }

  if (kind === "switch") {
    const key = String(lookup(current, args.compareTo));
    const chosen = Object.hasOwn(args.fields || {}, key) ? args.fields[key] : args.default;
    if (chosen === undefined) throw new Error("No protocol-766 Play switch branch for " + args.compareTo + "=" + key);
    return readType(reader, chosen, current, depth + 1);
  }

  if (kind === "mapper") {
    const raw = readType(reader, args.type, current, depth + 1);
    const mapped = args.mappings[String(raw)];
    if (mapped === undefined) throw new Error("Unknown protocol-766 mapped value " + raw);
    return mapped;
  }

  if (kind === "option") return reader.bool() ? readType(reader, args, current, depth + 1) : null;

  if (kind === "pstring") {
    if (args.countType !== "varint") throw new Error("Unsupported protocol-766 string count type");
    return reader.string();
  }

  if (kind === "buffer") {
    if (args.countType === undefined) return reader.rest();
    const length = count(Number(readType(reader, args.countType, current, depth + 1)), "Play buffer");
    return reader.bytesN(length);
  }

  if (kind === "bitfield") return readBitfield(reader, args);

  if (kind === "bitflags") {
    const raw = Number(readType(reader, args.type, current, depth + 1));
    const out = { raw };
    args.flags.forEach((name, bit) => { out[name] = (raw & (1 << bit)) !== 0; });
    return out;
  }

  if (kind === "entityMetadataLoop") {
    const out = [];
    while (true) {
      if (reader.remaining() <= 0) throw new RangeError("Entity metadata underflow");
      if (reader.bytes[reader.offset] === args.endVal) {
        reader.offset++;
        break;
      }
      out.push(readType(reader, args.type, current, depth + 1));
    }
    return out;
  }

  if (kind === "registryEntryHolder") {
    const encoded = reader.varint();
    if (encoded !== 0) return { [args.baseName]: encoded - 1 };
    return { [args.otherwise.name]: readType(reader, args.otherwise.type, current, depth + 1) };
  }

  if (kind === "registryEntryHolderSet") {
    const encoded = count(reader.varint(), "registry holder set");
    if (encoded === 0) return { [args.base.name]: readType(reader, args.base.type, current, depth + 1) };
    const values = new Array(encoded - 1);
    for (let i = 0; i < values.length; i++) values[i] = readType(reader, args.otherwise.type, current, depth + 1);
    return { [args.otherwise.name]: values };
  }

  if (kind === "topBitSetTerminatedArray") {
    const specType = args.type;
    if (!Array.isArray(specType) || specType[0] !== "container") {
      throw new Error("Unsupported top-bit terminated element");
    }
    const out = [];
    for (;;) {
      const marker = reader.u8();
      out.push(readContainer(reader, specType[1], current, depth + 1, marker & 0x7f));
      if ((marker & 0x80) === 0) break;
    }
    return out;
  }

  throw new Error("Unsupported protocol-766 Play constructor " + kind);
}

const GAME_MODE = Object.freeze({ survival: 0, creative: 1, adventure: 2, spectator: 3 });
const DIFFICULTY = Object.freeze({ peaceful: 0, easy: 1, normal: 2, hard: 3 });
const GAME_STATE_REASON = Object.freeze({
  no_respawn_block_available: 0,
  start_raining: 1,
  stop_raining: 2,
  change_game_mode: 3,
  win_game: 4,
  demo_event: 5,
  play_arrow_hit_sound: 6,
  rain_level_change: 7,
  thunder_level_change: 8,
  puffer_fish_sting: 9,
  guardian_elder_effect: 10,
  immediate_respawn: 11,
  limited_crafting: 12,
  level_chunks_load_start: 13
});

function metadataValue(entry) {
  if (entry.type === "component") return componentFromNbt(entry.value);
  if (entry.type === "optional_component") return entry.value ? componentFromNbt(entry.value) : null;
  return entry.value;
}

function configurationRegistries(context) {
  return context?.registries || context?.configuration?.registries || null;
}

function resolveDimension(context, id) {
  const registries = configurationRegistries(context);
  if (!registries) return null;
  const entries = registries.get?.("minecraft:dimension_type");
  const entry = entries?.[id];
  if (!entry?.value) throw new Error("Missing protocol-766 dimension type " + id);
  const data = simplify(entry.value);
  if (!Number.isInteger(data.min_y) || !Number.isInteger(data.height) || data.height <= 0 ||
      data.height % 16 || data.min_y % 16) {
    throw new Error("Invalid protocol-766 dimension type " + entry.key);
  }
  const effects = String(data.effects || "");
  const dimension = effects === "minecraft:the_nether" ? -1 : effects === "minecraft:the_end" ? 1 : 0;
  return { dimensionTypeName: entry.key, dimensionData: data, dimension };
}

function registryEntries(context, name) {
  const entries = configurationRegistries(context)?.get?.(name);
  if (!entries) return null;
  return entries.map((entry, id) => ({
    id,
    name: entry.key,
    element: entry.value ? simplify(entry.value) : null
  }));
}

function registrySize(context, name) {
  return registryEntries(context, name)?.length || null;
}

function safeLong(value, label) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid " + label);
  return n;
}

function angle(value) {
  return value * 360 / 256;
}

function blockEntityNbt(tag, type, location) {
  const id = PLAY_SCHEMA_766.blockEntityTypes[type];
  if (!id) throw new Error("Unknown protocol-766 block entity type " + type);
  if (tag && tag.t !== 10) throw new Error("Invalid protocol-766 block entity NBT");
  return {
    t: 10,
    name: "",
    v: {
      ...(tag?.v || {}),
      id: { t: 8, v: id },
      x: { t: 3, v: location.x },
      y: { t: 3, v: location.y },
      z: { t: 3, v: location.z }
    }
  };
}

function normalizeLight(packet) {
  const out = { ...packet };
  for (const key of ["skyLightMask", "blockLightMask", "emptySkyLightMask", "emptyBlockLightMask"]) {
    out[key + "Words"] = packet[key];
    out[key] = compactMask(bitsetValue(packet[key]));
  }
  if ((maskValue(out.skyLightMask) & maskValue(out.emptySkyLightMask)) ||
      (maskValue(out.blockLightMask) & maskValue(out.emptyBlockLightMask))) {
    throw new Error("Overlapping protocol-766 light masks");
  }
  for (const [key, mask] of [["skyLight", out.skyLightMask], ["blockLight", out.blockLightMask]]) {
    const arrays = packet[key];
    const data = {};
    let next = 0;
    for (let bit = 0; bit <= maskHighest(mask); bit++) {
      if (!maskHas(mask, bit)) continue;
      const bytes = arrays[next++];
      if (bytes?.length !== 2048) throw new Error("Invalid protocol-766 light array");
      data[bit - 1] = bytes.slice();
    }
    if (next !== arrays.length) throw new Error("Protocol-766 light arrays do not match mask");
    out[key] = data;
  }
  return out;
}

function normalizeWorld(packet, context) {
  const world = packet.worldState;
  const dimension = resolveDimension(context, world.dimension);
  const gameMode = GAME_MODE[world.gamemode];
  if (gameMode === undefined) throw new Error("Unknown protocol-766 game mode " + world.gamemode);
  return {
    ...packet,
    ...(dimension || {}),
    dimensionType: world.dimension,
    worldName: world.name,
    hashedSeed: world.hashedSeed,
    gameMode,
    previousGameMode: world.previousGamemode === 255 ? -1 : world.previousGamemode,
    isDebug: world.isDebug,
    isFlat: world.isFlat,
    death: world.death,
    portalCooldown: world.portalCooldown,
    biomeRegistrySize: registrySize(context, "minecraft:worldgen/biome"),
    biomeEntries: registryEntries(context, "minecraft:worldgen/biome"),
    enabledFeatures: context?.features,
    ...normalizeTags([...(context?.tags || new Map())].map(([tagType, tags]) => ({tagType, tags:tags.map(tag => ({tagName:tag.name, entries:tag.entries}))}))),
    blockStateRegistrySize: PLAY_SCHEMA_766.blockStateCount,
    airStates: PLAY_SCHEMA_766.airStates
  };
}

function normalizeTags(registries) {
  const commandTags = {}, registryTags = {};
  const kinds = {'minecraft:block':'blocks', 'minecraft:item':'items', 'minecraft:fluid':'fluids', 'minecraft:entity_type':'entities'};
  for (const registry of registries) {
    const name = registry.tagType.includes(':') ? registry.tagType : 'minecraft:' + registry.tagType;
    const tags = Object.fromEntries(registry.tags.map(tag => [tag.tagName, tag.entries]));
    commandTags[name] = tags;
    if (kinds[name]) registryTags[kinds[name]] = tags;
  }
  return {commandTags, registryTags};
}

function normalize(name, packet, context = null) {
  if (name === 'cookie_request') return {...packet, key:packet.cookie};
  if (name === 'ping') return {...packet, pingId:packet.id};
  if (name === 'tags') {
    const {commandTags, registryTags} = normalizeTags(packet.tags);
    return {...packet, registries:commandTags, tags:registryTags};
  }
  if (name === 'declare_recipes') return {...packet, recipes:packet.recipes.map(recipe => ({
    ...recipe, recipeId:recipe.name,
    data:recipe.type === 'minecraft:crafting_shaped' ? {...recipe.data, width:recipe.data.gridWidth,
      height:recipe.data.gridHeight, ingredients:recipe.data.ingredients.flat()} : {...recipe.data,cookingTime:recipe.data.cookTime}
  }))};
  if (name === "login" || name === "respawn") return normalizeWorld(packet, context);

  if (name === "position" && packet.flags?.raw !== undefined) {
    return { ...packet, flags: packet.flags.raw };
  }

  if (name === "open_window") {
    return { ...packet, windowTitle: componentFromNbt(packet.windowTitle) };
  }

  if (name === "trade_list") {
    return {
      ...packet,
      trades: packet.trades.map((trade) => ({
        a: decorateItemCost766(trade.inputItem1),
        out: trade.outputItem,
        b: decorateItemCost766(trade.inputItem2),
        disabled: trade.tradeDisabled,
        uses: trade.nbTradeUses,
        max: trade.maximumNbTradeUses,
        xp: trade.xp,
        specialPrice: trade.specialPrice,
        priceMultiplier: trade.priceMultiplier,
        demand: trade.demand
      }))
    };
  }

  if (name === "map_chunk") {
    const light = normalizeLight(packet);
    return {
      ...light,
      groundUp: true,
      blockEntities: packet.blockEntities.map((entry) => {
        const location = {
          x: packet.x * 16 + entry.x,
          y: entry.y,
          z: packet.z * 16 + entry.z
        };
        return blockEntityNbt(entry.nbtData, entry.type, location);
      })
    };
  }

  if (name === "update_light") return normalizeLight(packet);

  if (name === "block_change") return { ...packet, state: packet.type };

  if (name === "multi_block_change") {
    const { x: chunkX, z: chunkZ, y: sectionY } = packet.chunkCoordinates;
    return {
      ...packet,
      chunkX,
      chunkZ,
      sectionY,
      records: packet.records.map((raw) => {
        const value = BigInt.asUintN(64, BigInt(raw));
        return {
          state: Number(value >> 12n),
          x: Number(value >> 8n & 15n),
          z: Number(value >> 4n & 15n),
          y: sectionY * 16 + Number(value & 15n)
        };
      })
    };
  }

  if (name === "tile_entity_data") {
    return {
      ...packet,
      type: packet.action,
      nbtData: blockEntityNbt(packet.nbtData, packet.action, packet.location)
    };
  }

  if (name === "entity_metadata") {
    return {
      ...packet,
      metadata: Object.fromEntries(packet.metadata.map((entry) => [entry.key, metadataValue(entry)]))
    };
  }

  if (name === "entity_update_attributes") {
    const rename = {
      "generic.movement_speed": "generic.movementSpeed",
      "generic.max_health": "generic.maxHealth",
      "generic.attack_speed": "generic.attackSpeed",
      "generic.fall_damage_multiplier": "generic.fallDamageMultiplier",
      "generic.jump_strength": "generic.jumpStrength",
      "generic.max_absorption": "generic.maxAbsorption",
      "generic.safe_fall_distance": "generic.safeFallDistance",
      "generic.step_height": "generic.stepHeight",
      "player.block_break_speed": "player.blockBreakSpeed",
      "player.block_interaction_range": "player.blockInteractionRange",
      "player.entity_interaction_range": "player.entityInteractionRange"
    };
    return {
      ...packet,
      name: "update_attributes",
      properties: packet.properties.map((property) => ({
        ...property,
        key: rename[property.key] || property.key
      }))
    };
  }

  if (name === "entity_effect") {
    return {
      ...packet,
      ambient: !!(packet.flags & 1),
      hideParticles: !(packet.flags & 2),
      showIcon: !!(packet.flags & 4)
    };
  }

  if (name === "spawn_entity") {
    const entityTypeName = PLAY_SCHEMA_766.entityTypes[packet.type];
    if (!entityTypeName) throw new Error("Unknown protocol-766 entity type " + packet.type);
    return {
      ...packet,
      wireType: packet.type,
      entityTypeName,
      yaw: angle(packet.yaw),
      pitch: angle(packet.pitch),
      headPitch: angle(packet.headPitch)
    };
  }

  if (name === "rel_entity_move") {
    return {
      ...packet,
      dX: packet.dX / 4096,
      dY: packet.dY / 4096,
      dZ: packet.dZ / 4096
    };
  }
  if (name === "entity_move_look") {
    return {
      ...packet,
      dX: packet.dX / 4096,
      dY: packet.dY / 4096,
      dZ: packet.dZ / 4096,
      yaw: angle(packet.yaw),
      pitch: angle(packet.pitch)
    };
  }
  if (name === "entity_look" || name === "entity_teleport") {
    return { ...packet, yaw: angle(packet.yaw), pitch: angle(packet.pitch) };
  }
  if (name === "entity_head_rotation") return { ...packet, headYaw: angle(packet.headYaw) };

  if (name === "damage_event") {
    return {
      ...packet,
      sourceCauseId: packet.sourceCauseId - 1,
      sourceDirectId: packet.sourceDirectId - 1
    };
  }

  if (name === "difficulty") {
    const difficulty = DIFFICULTY[packet.difficulty];
    if (difficulty === undefined) throw new Error("Unknown protocol-766 difficulty " + packet.difficulty);
    return { ...packet, difficulty };
  }

  if (name === "game_state_change") {
    const reason = GAME_STATE_REASON[packet.reason];
    if (reason === undefined) throw new Error("Unknown protocol-766 game-state reason " + packet.reason);
    return { ...packet, reason, value: packet.gameMode };
  }

  if (name === "server_data") {
    return { ...packet, motd: componentFromNbt(packet.motd) };
  }

  if (name === "initialize_world_border") {
    return {
      name: "world_border",
      action: 3,
      x: packet.x,
      z: packet.z,
      oldRadius: packet.oldDiameter,
      newRadius: packet.newDiameter,
      speed: safeLong(packet.speed, "world border lerp time"),
      portalBoundary: packet.portalTeleportBoundary,
      warningBlocks: packet.warningBlocks,
      warningTime: packet.warningTime
    };
  }
  if (name === "world_border_center") return { name: "world_border", action: 2, x: packet.x, z: packet.z };
  if (name === "world_border_lerp_size") {
    return {
      name: "world_border",
      action: 1,
      oldRadius: packet.oldDiameter,
      newRadius: packet.newDiameter,
      speed: safeLong(packet.speed, "world border lerp time")
    };
  }
  if (name === "world_border_size") return { name: "world_border", action: 0, radius: packet.diameter };
  if (name === "world_border_warning_delay") return { name: "world_border", action: 4, warningTime: packet.warningTime };
  if (name === "world_border_warning_reach") return { name: "world_border", action: 5, warningBlocks: packet.warningBlocks };

  if (name === "kick_disconnect" && packet.reason) {
    return { ...packet, reason: componentFromNbt(packet.reason) };
  }

  return packet;
}

export function decodePlayPacket766(data, context = null) {
  const reader = data instanceof Reader766 ? data : new Reader766(data);
  const id = reader.varint();
  const name = NAME_BY_ID[id];
  if (!name) return { name: "raw_" + id.toString(16), id, data: reader.rest() };
  const spec = TYPES["packet_" + name];
  if (!spec) throw new Error("Missing generated protocol-766 Play packet type " + name);
  let packet;
  try { packet = normalize(name, readType(reader, spec), context); }
  catch (cause) { throw new Error('Cannot decode protocol-766 ' + name + ' at byte ' + reader.offset + ': ' + cause.message, {cause}); }
  if (reader.remaining() !== 0) throw new Error("Trailing protocol-766 Play bytes for " + name + ": " + reader.remaining());
  return { name, id, ...packet };
}

export function decodePlayBody766(name, bytes, context = null) {
  const spec = TYPES["packet_" + name];
  if (!spec) throw new Error("Unsupported P06 Play packet " + name);
  const reader = bytes instanceof Reader766 ? bytes : new Reader766(bytes);
  const packet = normalize(name, readType(reader, spec), context);
  if (reader.remaining() !== 0) throw new Error("Trailing protocol-766 Play body bytes for " + name);
  return packet;
}

export const P06_PLAY_PACKET_NAMES = PLAY_SCHEMA_766.packets;
