import { readScoreFormat774 } from '../game/score-format-1.21.11.js';
import { NATIVE_PLAY_CLIENTBOUND_NAMES_774 } from './native-packet-names-1.21.11.js';
import { DecoderError } from './network-errors.js';
import { Reader774 } from './configuration-1.21.11.js';
import { readAnonymousNbt } from './nbt-anonymous.js';
import { componentFromNbt } from './component-nbt-1.21.11.js';
import { readSlot774, decorateItemCost774 } from './item-components-1.21.11.js';
import { PLAY_SCHEMA_774 } from './play-schema-1.21.11.js';
import { readLpVec3 } from './lpvec3.js';
import { bitsetValue, compactMask, maskHas, maskHighest, maskValue } from './bitset.js';
import { simplify } from './nbt.js';

const TYPES = PLAY_SCHEMA_774.types;
const NAME_BY_ID = Object.fromEntries(Object.entries(PLAY_SCHEMA_774.ids).map(([name, id]) => [id, name]));
const MAX_COLLECTION = 1048576;

function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_COLLECTION) {
    throw new Error('Invalid ' + label + ' length');
  }
  return value;
}

function scope(value, parent = null) {
  return { value, parent };
}

function lookup(current, path) {
  const rawPath = String(path);
  if (!rawPath.includes('/')) {
    let cursor = current;
    while (cursor) {
      if (cursor.value && Object.hasOwn(cursor.value, rawPath) && cursor.value[rawPath] !== undefined) {
        return cursor.value[rawPath];
      }
      cursor = cursor.parent;
    }
    return undefined;
  }
  let cursor = current;
  for (const part of rawPath.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
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
    case 'i8': return reader.i8();
    case 'u8': return reader.u8();
    case 'i16': return reader.i16();
    case 'u16': return reader.u16();
    case 'i32': return reader.i32();
    case 'u32': return reader.u32();
    case 'i64': return reader.i64();
    case 'f32': return reader.f32();
    case 'f64': return reader.f64();
    case 'bool': return reader.bool();
    case 'varint':
    case 'optvarint':
      return reader.varint();
    case 'varlong': return reader.varlong();
    case 'string': return reader.string();
    case 'restBuffer': return reader.rest();
    case 'UUID': return reader.uuid();
    case 'position': return reader.position();
    case 'anonymousNbt': {
      const value = readAnonymousNbt(reader);
      if (!value) throw new Error('Missing anonymous NBT payload');
      return value;
    }
    case 'anonOptionalNbt': return readAnonymousNbt(reader);
    case 'Slot': return readSlot774(reader);
    case 'vec2f': return { x: reader.f32(), y: reader.f32() };
    case 'vec3f': return { x: reader.f32(), y: reader.f32(), z: reader.f32() };
    case 'vec3f64': return { x: reader.f64(), y: reader.f64(), z: reader.f64() };
    case 'vec3i16': return { x: reader.i16(), y: reader.i16(), z: reader.i16() };
    case 'vec4f': return { x: reader.f32(), y: reader.f32(), z: reader.f32(), w: reader.f32() };
    case 'lpVec3': return readLpVec3(reader);
    case 'void': return undefined;
    default: return null;
  }
}

function readBitfield(reader, fields) {
  const total = fields.reduce((sum, field) => sum + field.size, 0);
  let raw;
  if (total === 8) raw = BigInt(reader.u8());
  else if (total === 16) raw = BigInt(reader.u16());
  else if (total === 32) raw = BigInt(reader.i32() >>> 0);
  else if (total === 64) raw = BigInt.asUintN(64, reader.i64());
  else throw new Error('Unsupported protocol-774 bitfield width ' + total);
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
      if (field.type !== 'i8' && field.type !== 'u8') {
        throw new Error('Top-bit terminated element must begin with a byte field');
      }
      value = field.type === 'i8' && firstByte >= 128 ? firstByte - 256 : firstByte;
    } else {
      value = readType(reader, field.type, current, depth + 1);
    }
    if (field.anon) {
      if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(out, value);
    } else if (value !== undefined) {
      out[field.name] = value;
    }
  }
  return out;
}

function readType(reader, spec, current = null, depth = 0) {
  if (depth > 128) throw new Error('Protocol-774 Play schema nesting too deep');
  if (typeof spec === 'string') {
    if (spec === 'Slot') return readSlot774(reader);
    const value = primitive(reader, spec);
    if (value !== null || ['void', 'anonOptionalNbt'].includes(spec)) return value;
    const named = TYPES[spec];
    if (!named) throw new Error('Unknown protocol-774 Play type ' + spec);
    return readType(reader, named, current, depth + 1);
  }

  const [kind, args] = spec;
  if (kind === 'container') return readContainer(reader, args, current, depth);

  if (kind === 'array') {
    const length = args.count !== undefined
      ? count(Number(typeof args.count === 'number' ? args.count : lookup(current, args.count)), 'Play array')
      : count(Number(readType(reader, args.countType, current, depth + 1)), 'Play array');
    const out = new Array(length);
    for (let i = 0; i < length; i++) out[i] = readType(reader, args.type, current, depth + 1);
    return out;
  }

  if (kind === 'switch') {
    const key = String(lookup(current, args.compareTo));
    const chosen = Object.hasOwn(args.fields || {}, key) ? args.fields[key] : args.default;
    if (chosen === undefined) return undefined;
    return readType(reader, chosen, current, depth + 1);
  }

  if (kind === 'mapper') {
    const raw = readType(reader, args.type, current, depth + 1);
    const mapped = args.mappings[String(raw)];
    if (mapped === undefined) throw new Error('Unknown protocol-774 mapped value ' + raw);
    return mapped;
  }

  if (kind === 'option') return reader.bool() ? readType(reader, args, current, depth + 1) : null;

  if (kind === 'pstring') {
    if (args.countType !== 'varint') throw new Error('Unsupported protocol-774 string count type');
    return reader.string();
  }

  if (kind === 'buffer') {
    if (args.countType === undefined && args.count === undefined) return reader.rest();
    const length = count(Number(
      args.count !== undefined
        ? (typeof args.count === 'number' ? args.count : lookup(current, args.count))
        : readType(reader, args.countType, current, depth + 1)
    ), 'Play buffer');
    return reader.bytesN(length);
  }

  if (kind === 'bitfield') return readBitfield(reader, args);

  if (kind === 'bitflags') {
    const raw = Number(readType(reader, args.type, current, depth + 1));
    const out = { raw };
    args.flags.forEach((name, bit) => { out[name] = (raw & (1 << bit)) !== 0; });
    return out;
  }

  if (kind === 'entityMetadataLoop') {
    const out = [];
    while (true) {
      if (reader.remaining() <= 0) throw new RangeError('Entity metadata underflow');
      if (reader.bytes[reader.offset] === args.endVal) {
        reader.offset++;
        break;
      }
      out.push(readType(reader, args.type, current, depth + 1));
    }
    return out;
  }

  if (kind === 'registryEntryHolder') {
    const encoded = reader.varint();
    if (encoded !== 0) return { [args.baseName]: encoded - 1 };
    return { [args.otherwise.name]: readType(reader, args.otherwise.type, current, depth + 1) };
  }

  if (kind === 'registryEntryHolderSet') {
    const encoded = count(reader.varint(), 'registry holder set');
    if (encoded === 0) return { [args.base.name]: readType(reader, args.base.type, current, depth + 1) };
    const values = new Array(encoded - 1);
    for (let i = 0; i < values.length; i++) values[i] = readType(reader, args.otherwise.type, current, depth + 1);
    return { [args.otherwise.name]: values };
  }

  if (kind === 'topBitSetTerminatedArray') {
    const specType = args.type;
    if (!Array.isArray(specType) || specType[0] !== 'container') {
      throw new Error('Unsupported top-bit terminated element');
    }
    const out = [];
    for (;;) {
      const marker = reader.u8();
      out.push(readContainer(reader, specType[1], current, depth + 1, marker & 0x7f));
      if ((marker & 0x80) === 0) break;
    }
    return out;
  }

  throw new Error('Unsupported protocol-774 Play constructor ' + kind);
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
  if (entry.type === 'component') return componentFromNbt(entry.value);
  if (entry.type === 'optional_component') return entry.value ? componentFromNbt(entry.value) : null;
  return entry.value;
}

function configurationRegistries(context) {
  return context?.registries || context?.configuration?.registries || null;
}

function resolveDimension(context, id) {
  const registries = configurationRegistries(context);
  if (!registries) return null;
  const entries = registries.get?.('minecraft:dimension_type');
  const entry = entries?.[id];
  if (!entry?.value) throw new Error('Missing protocol-774 dimension type ' + id);
  const data = simplify(entry.value);
  if (!Number.isInteger(data.min_y) || !Number.isInteger(data.height) || data.height <= 0 ||
      data.height % 16 || data.min_y % 16) {
    throw new Error('Invalid protocol-774 dimension type ' + entry.key);
  }
  const effects = String(data.effects || '');
  const skybox = String(data.skybox || '');
  const cardinal = String(data.cardinal_light || '');
  const dimension = (effects === 'minecraft:the_nether' || cardinal === 'nether' || entry.key === 'minecraft:the_nether')
    ? -1
    : (effects === 'minecraft:the_end' || skybox === 'end' || entry.key === 'minecraft:the_end')
      ? 1
      : 0;
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
  const n = BigInt(value);
  if (n < 0n || n > 0x7fffffffffffffffn) throw new Error('Invalid ' + label);
  return n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n;
}

function angle(value) {
  return value * 360 / 256;
}

function blockEntityNbt(tag, type, location) {
  const id = PLAY_SCHEMA_774.blockEntityTypes[type];
  if (!id) throw new Error('Unknown protocol-774 block entity type ' + type);
  if (tag && tag.t !== 10) throw new Error('Invalid protocol-774 block entity NBT');
  return {
    t: 10,
    name: '',
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
  for (const key of ['skyLightMask', 'blockLightMask', 'emptySkyLightMask', 'emptyBlockLightMask']) {
    out[key + 'Words'] = packet[key];
    out[key] = compactMask(bitsetValue(packet[key]));
  }
  if ((maskValue(out.skyLightMask) & maskValue(out.emptySkyLightMask)) ||
      (maskValue(out.blockLightMask) & maskValue(out.emptyBlockLightMask))) {
    throw new Error('Overlapping protocol-774 light masks');
  }
  for (const [key, mask] of [['skyLight', out.skyLightMask], ['blockLight', out.blockLightMask]]) {
    const arrays = packet[key];
    const data = {};
    let next = 0;
    for (let bit = 0; bit <= maskHighest(mask); bit++) {
      if (!maskHas(mask, bit)) continue;
      const bytes = arrays[next++];
      if (bytes?.length !== 2048) throw new Error('Invalid protocol-774 light array');
      data[bit - 1] = bytes.slice();
    }
    if (next !== arrays.length) throw new Error('Protocol-774 light arrays do not match mask');
    out[key] = data;
  }
  return out;
}

function normalizeWorld(packet, context) {
  const world = packet.worldState;
  const dimension = resolveDimension(context, world.dimension);
  const gameMode = GAME_MODE[world.gamemode];
  if (gameMode === undefined) throw new Error('Unknown protocol-774 game mode ' + world.gamemode);
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
    seaLevel: world.seaLevel,
    biomeRegistrySize: registrySize(context, 'minecraft:worldgen/biome'),
    biomeEntries: registryEntries(context, 'minecraft:worldgen/biome'),
    dimensionCodec: registryCodec(context),
    enabledFeatures: context?.features,
    ...normalizeTags([...(context?.tags || new Map())].map(([tagType, tags]) => ({
      tagType,
      tags: tags.map((tag) => ({ tagName: tag.name, entries: tag.entries }))
    }))),
    blockStateRegistrySize: PLAY_SCHEMA_774.blockStateCount,
    airStates: PLAY_SCHEMA_774.airStates
  };
}

function registryCodec(context) {
  const registries = configurationRegistries(context);
  if (!registries) return null;
  return {
    t: 10,
    name: '',
    v: Object.fromEntries([...registries].map(([name, entries]) => [name, {
      t: 10,
      v: {
        type: { t: 8, v: name },
        value: {
          t: 9,
          v: {
            et: 10,
            items: entries.map((entry, id) => ({
              id: { t: 3, v: id },
              name: { t: 8, v: entry.key },
              element: entry.value
            }))
          }
        }
      }
    }]))
  };
}

const componentJson = (value) => value == null ? null : JSON.stringify(componentFromNbt(value));
const SOUND_SOURCES = ['master', 'music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient', 'voice', 'ui'];
const PARTICLE_IDS = Object.fromEntries(
  Object.entries(TYPES.Particle[1][0].type[1].mappings).map(([id, name]) => [name, Number(id)])
);

function particleView(particle) {
  let data = particle.data;
  if (['block', 'block_marker', 'falling_dust', 'dust_pillar', 'block_crumble'].includes(particle.type)) {
    data = { blockState: data };
  } else if (particle.type === 'item') {
    data = { item: data };
  } else if (particle.type === 'sculk_charge') {
    data = { rotation: data };
  } else if (particle.type === 'shriek') {
    data = { delayInTicksBeforeShown: data };
  } else if (['entity_effect', 'tinted_leaves', 'flash'].includes(particle.type)) {
    data = { colorArgb: data };
  } else if (particle.type === 'dust_color_transition') {
    data = { ...data };
  } else if (particle.type === 'vibration') {
    data = {
      positionType: 'minecraft:' + data.positionType,
      destination: data.positionType === 'block' ? data.position : data.position.entityId,
      entityEyeHeight: data.positionType === 'entity' ? data.position.entityEyeHeight : undefined,
      ticks: data.ticks,
      particle: true
    };
  }
  return { particleId: PARTICLE_IDS[particle.type], data: data ?? {} };
}

function commandView(packet) {
  const nodes = packet.nodes.map((node) => {
    const extra = node.extraNodeData || {}, flags = node.flags;
    let properties = extra.properties;
    if (extra.parser === 'brigadier:string') {
      properties = { mode: ['SINGLE_WORD', 'QUOTABLE_PHRASE', 'GREEDY_PHRASE'].indexOf(properties) };
    } else if (extra.parser === 'minecraft:entity') {
      properties = { flags: (properties.onlyAllowEntities ? 1 : 0) | (properties.onlyAllowPlayers ? 2 : 0) };
    } else if (extra.parser === 'minecraft:score_holder') {
      properties = { flags: properties.allowMultiple ? 1 : 0 };
    }
    return {
      ...extra,
      type: flags.command_node_type,
      children: node.children,
      executable: !!flags.has_command,
      ...(flags.has_redirect_node ? { redirect: node.redirectNode } : {}),
      properties: properties || {},
      suggestions: extra.suggestionType
    };
  });
  if (!nodes[packet.rootIndex] || nodes.some(
    (node) => node.type > 2 || node.children.some((id) => !nodes[id]) || (node.redirect !== undefined && !nodes[node.redirect])
  )) {
    throw Error('Invalid protocol-774 command reference');
  }
  return { ...packet, nodes, root: packet.rootIndex };
}

function normalizeTags(registries) {
  const commandTags = {}, registryTags = {};
  const kinds = {
    'minecraft:block': 'blocks',
    'minecraft:item': 'items',
    'minecraft:fluid': 'fluids',
    'minecraft:entity_type': 'entities'
  };
  for (const registry of registries) {
    const name = registry.tagType.includes(':') ? registry.tagType : 'minecraft:' + registry.tagType;
    const tags = Object.fromEntries(registry.tags.map((tag) => [tag.tagName, tag.entries]));
    commandTags[name] = tags;
    if (kinds[name]) registryTags[kinds[name]] = tags;
  }
  return { commandTags, registryTags };
}

function normalize(name, packet, context = null) {
  if (name === 'add_resource_pack') return { ...packet, promptMessage: componentJson(packet.promptMessage) };
  if (name === 'declare_commands') return commandView(packet);
  if (name === 'face_player') return { ...packet, fromAnchor: packet.feet_eyes, toAnchor: packet.entity_feet_eyes };
  if (name === 'world_particles') {
    return { ...packet, ...particleView(packet.particle), particles: packet.amount, particleData: packet.velocityOffset };
  }
  if (name === 'explosion') {
    return {
      ...packet,
      x: packet.center.x,
      y: packet.center.y,
      z: packet.center.z,
      motionX: packet.playerKnockback?.x ?? 0,
      motionY: packet.playerKnockback?.y ?? 0,
      motionZ: packet.playerKnockback?.z ?? 0,
      nativeExplosion: {
        radius: packet.radius,
        blockCount: packet.blockCount,
        particle: particleView(packet.explosionParticle),
        soundId: packet.sound.soundId ?? -1,
        soundName: packet.sound.data?.soundName,
        blockParticles: packet.blockParticles.map((entry) => ({
          ...entry,
          particle: particleView(entry.data.particle)
        }))
      }
    };
  }
  if (name === 'map') {
    return { ...packet, icons: packet.icons?.map((icon) => ({ ...icon, displayName: componentJson(icon.displayName) })) ?? null };
  }
  if (name === 'advancements') {
    return {
      ...packet,
      removed: packet.identifiers,
      added: packet.advancementMapping.map((entry) => {
        const a = entry.value, d = a.displayData;
        return {
          id: entry.key,
          parent: a.parentId,
          criteria: [...new Set(a.requirements.flat())],
          requirements: a.requirements,
          display: d ? {
            title: componentJson(d.title),
            description: componentJson(d.description),
            icon: d.icon,
            frame: d.frameType,
            showToast: !!d.flags.show_toast,
            hidden: !!d.flags.hidden,
            background: d.backgroundTexture,
            x: d.xCord,
            y: d.yCord
          } : null
        };
      }),
      progress: packet.progressMapping.map((entry) => ({
        id: entry.key,
        criteria: Object.fromEntries(entry.value.map((c) => [
          c.criterionIdentifier,
          c.criterionProgress === null ? null : Number(c.criterionProgress)
        ]))
      }))
    };
  }
  if (name === 'system_chat') return { ...packet, content: componentJson(packet.content) };
  if (name === 'profileless_chat') {
    return {
      ...packet,
      name,
      message: componentJson(packet.message),
      networkName: componentJson(packet.name),
      networkTargetName: componentJson(packet.target)
    };
  }
  if (name === 'player_chat') {
    return {
      ...packet,
      sender: packet.senderUuid,
      unsignedChatContent: componentJson(packet.unsignedChatContent),
      networkName: componentJson(packet.networkName),
      networkTargetName: componentJson(packet.networkTargetName)
    };
  }
  if (name === 'hide_message') return { ...packet, signatureId: packet.id };
  if (name === 'player_info') {
    return {
      ...packet,
      actions: packet.action.raw,
      data: packet.data.map((entry) => ({
        ...entry,
        ...entry.player,
        ping: entry.latency,
        listed: entry.listed === undefined ? undefined : !!entry.listed,
        displayName: componentJson(entry.displayName),
        chatSession: entry.chatSession ? { uuid: entry.chatSession.uuid, ...entry.chatSession.publicKey } : null
      }))
    };
  }
  if (name === 'playerlist_header') {
    return { ...packet, header: componentJson(packet.header), footer: componentJson(packet.footer) };
  }
  if (name === 'teams') {
    const modes = { add: 0, remove: 1, change: 2, join: 3, leave: 4 };
    return {
      ...packet,
      name: 'scoreboard_team',
      mode: modes[packet.mode] ?? packet.mode,
      displayName: componentJson(packet.name),
      color: packet.formatting,
      prefix: componentJson(packet.prefix),
      suffix: componentJson(packet.suffix)
    };
  }
  if (name === 'scoreboard_objective') {
    return {
      ...packet,
      name,
      objective: packet.name,
      displayText: componentJson(packet.displayText),
      type: packet.type === 1 ? 'hearts' : 'integer',
      numberFormat: readScoreFormat774(packet.number_format, packet.styling)
    };
  }
  if (name === 'scoreboard_display_objective') return { ...packet, name, objective: packet.name };
  if (name === 'scoreboard_score') {
    return {
      ...packet,
      action: 0,
      displayName: componentJson(packet.display_name),
      numberFormat: readScoreFormat774(packet.number_format, packet.styling)
    };
  }
  if (name === 'reset_score') {
    return { ...packet, name: 'scoreboard_score', action: 1, itemName: packet.entity_name, scoreName: packet.objective_name };
  }
  if (name === 'boss_bar') return { ...packet, uuid: packet.entityUUID, title: componentJson(packet.title) };
  if (name === 'death_combat_event') return { ...packet, name: 'combat_event', event: 2, message: componentJson(packet.message) };
  if (name === 'action_bar' || name === 'set_title_text' || name === 'set_title_subtitle') {
    return {
      ...packet,
      name: 'title',
      action: name === 'action_bar' ? 2 : name === 'set_title_text' ? 0 : 1,
      text: componentJson(packet.text)
    };
  }
  if (name === 'set_title_time') return { ...packet, name: 'title', action: 3 };
  if (name === 'clear_titles') return { ...packet, name: 'title', action: packet.reset ? 5 : 4 };
  if (name === 'sound_effect' || name === 'entity_sound_effect') {
    return {
      ...packet,
      ...(name === 'sound_effect' ? { x: packet.x / 8, y: packet.y / 8, z: packet.z / 8 } : {}),
      soundId: packet.sound.soundId ?? -1,
      soundName: packet.sound.data?.soundName,
      range: packet.sound.data?.fixedRange,
      soundCategory: SOUND_SOURCES.indexOf(packet.soundCategory)
    };
  }
  if (name === 'cookie_request') return { ...packet, key: packet.cookie };
  if (name === 'ping') return { ...packet, pingId: packet.id };
  if (name === 'tags') {
    const { commandTags, registryTags } = normalizeTags(packet.tags);
    return { ...packet, registries: commandTags, tags: registryTags };
  }
  if (name === 'login' || name === 'respawn') return normalizeWorld(packet, context);

  if (name === 'spawn_position') {
    return {
      ...packet,
      dimensionName: packet.globalPos.dimensionName,
      location: packet.globalPos.location,
      angle: packet.yaw
    };
  }

  if (name === 'position' && packet.flags?.raw !== undefined) {
    return { ...packet, flags: packet.flags.raw };
  }

  if (name === 'entity_teleport' && packet.flags?.raw !== undefined) {
    return { ...packet, flags: packet.flags.raw };
  }

  if (name === 'open_window') {
    return { ...packet, windowTitle: componentFromNbt(packet.windowTitle) };
  }

  if (name === 'trade_list') {
    return {
      ...packet,
      trades: packet.trades.map((trade) => ({
        a: decorateItemCost774(trade.inputItem1),
        out: trade.outputItem,
        b: decorateItemCost774(trade.inputItem2),
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

  if (name === 'map_chunk') {
    const light = normalizeLight(packet);
    return {
      ...light,
      protocol: 774,
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

  if (name === 'update_light') return normalizeLight(packet);

  if (name === 'block_change') return { ...packet, state: packet.type };

  if (name === 'multi_block_change') {
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

  if (name === 'tile_entity_data') {
    return {
      ...packet,
      type: packet.action,
      nbtData: blockEntityNbt(packet.nbtData, packet.action, packet.location)
    };
  }

  if (name === 'entity_metadata') {
    return {
      ...packet,
      metadata: Object.fromEntries(packet.metadata.map((entry) => [entry.key, metadataValue(entry)]))
    };
  }

  if (name === 'entity_update_attributes') {
    const rename = {
      'generic.movement_speed': 'generic.movementSpeed',
      'generic.max_health': 'generic.maxHealth',
      'generic.attack_speed': 'generic.attackSpeed',
      'generic.attack_damage': 'generic.attackDamage',
      'generic.fall_damage_multiplier': 'generic.fallDamageMultiplier',
      'generic.jump_strength': 'generic.jumpStrength',
      'generic.max_absorption': 'generic.maxAbsorption',
      'generic.safe_fall_distance': 'generic.safeFallDistance',
      'generic.step_height': 'generic.stepHeight',
      'generic.scale': 'generic.scale',
      'generic.gravity': 'generic.gravity',
      'player.block_break_speed': 'player.blockBreakSpeed',
      'player.block_interaction_range': 'player.blockInteractionRange',
      'player.entity_interaction_range': 'player.entityInteractionRange',
      'movement_speed': 'generic.movementSpeed',
      'max_health': 'generic.maxHealth',
      'attack_speed': 'generic.attackSpeed',
      'attack_damage': 'generic.attackDamage',
      'fall_damage_multiplier': 'generic.fallDamageMultiplier',
      'jump_strength': 'generic.jumpStrength',
      'max_absorption': 'generic.maxAbsorption',
      'safe_fall_distance': 'generic.safeFallDistance',
      'step_height': 'generic.stepHeight',
      'scale': 'generic.scale',
      'gravity': 'generic.gravity',
      'block_break_speed': 'player.blockBreakSpeed',
      'block_interaction_range': 'player.blockInteractionRange',
      'entity_interaction_range': 'player.entityInteractionRange'
    };
    return {
      ...packet,
      name: 'update_attributes',
      properties: packet.properties.map((property) => {
        const bare = String(property.key).replace(/^minecraft:/, '');
        return {
          ...property,
          key: rename[bare] || rename[property.key] || property.key
        };
      })
    };
  }

  if (name === 'entity_effect') {
    return {
      ...packet,
      ambient: !!(packet.flags & 1),
      hideParticles: !(packet.flags & 2),
      showIcon: !!(packet.flags & 4),
      shouldBlend: !!(packet.flags & 8)
    };
  }

  if (name === 'spawn_entity') {
    const entityTypeName = PLAY_SCHEMA_774.entityTypes[packet.type];
    if (!entityTypeName) throw new Error('Unknown protocol-774 entity type ' + packet.type);
    return {
      ...packet,
      wireType: packet.type,
      entityTypeName,
      velocityX: packet.velocity.x,
      velocityY: packet.velocity.y,
      velocityZ: packet.velocity.z,
      yaw: angle(packet.yaw),
      pitch: angle(packet.pitch),
      headPitch: angle(packet.headPitch)
    };
  }

  if (name === 'entity_velocity') {
    return {
      ...packet,
      velocityX: packet.velocity.x,
      velocityY: packet.velocity.y,
      velocityZ: packet.velocity.z
    };
  }

  if (name === 'rel_entity_move') {
    return {
      ...packet,
      dX: packet.dX / 4096,
      dY: packet.dY / 4096,
      dZ: packet.dZ / 4096
    };
  }
  if (name === 'entity_move_look') {
    return {
      ...packet,
      dX: packet.dX / 4096,
      dY: packet.dY / 4096,
      dZ: packet.dZ / 4096,
      yaw: angle(packet.yaw),
      pitch: angle(packet.pitch)
    };
  }
  if (name === 'entity_look') {
    return { ...packet, yaw: angle(packet.yaw), pitch: angle(packet.pitch) };
  }
  if (name === 'entity_head_rotation') return { ...packet, headYaw: angle(packet.headYaw) };

  if (name === 'damage_event') {
    return {
      ...packet,
      sourceCauseId: packet.sourceCauseId - 1,
      sourceDirectId: packet.sourceDirectId - 1
    };
  }

  if (name === 'difficulty') {
    const difficulty = DIFFICULTY[packet.difficulty];
    if (difficulty === undefined) throw new Error('Unknown protocol-774 difficulty ' + packet.difficulty);
    return { ...packet, difficulty };
  }

  if (name === 'game_state_change') {
    const reason = GAME_STATE_REASON[packet.reason];
    if (reason === undefined) throw new Error('Unknown protocol-774 game-state reason ' + packet.reason);
    return { ...packet, reason, value: packet.gameMode };
  }

  if (name === 'server_data') {
    return { ...packet, motd: componentFromNbt(packet.motd) };
  }

  if (name === 'initialize_world_border') {
    return {
      name: 'world_border',
      action: 3,
      x: packet.x,
      z: packet.z,
      oldRadius: packet.oldDiameter,
      newRadius: packet.newDiameter,
      speed: safeLong(packet.speed, 'world border lerp time'),
      portalBoundary: packet.portalTeleportBoundary,
      warningBlocks: packet.warningBlocks,
      warningTime: packet.warningTime
    };
  }
  if (name === 'world_border_center') return { name: 'world_border', action: 2, x: packet.x, z: packet.z };
  if (name === 'world_border_lerp_size') {
    return {
      name: 'world_border',
      action: 1,
      oldRadius: packet.oldDiameter,
      newRadius: packet.newDiameter,
      speed: safeLong(packet.speed, 'world border lerp time')
    };
  }
  if (name === 'world_border_size') return { name: 'world_border', action: 0, radius: packet.diameter };
  if (name === 'world_border_warning_delay') return { name: 'world_border', action: 4, warningTime: packet.warningTime };
  if (name === 'world_border_warning_reach') return { name: 'world_border', action: 5, warningBlocks: packet.warningBlocks };

  if (name === 'kick_disconnect' && packet.reason) {
    return { ...packet, reason: componentFromNbt(packet.reason) };
  }

  return packet;
}

export function decodePlayPacket774(data, context = null) {
  const reader = data instanceof Reader774 ? data : new Reader774(data);
  const id = reader.varint();
  const name = NAME_BY_ID[id];
  if (!name) throw new DecoderError('Received unknown packet id ' + id, { byteOffset: reader.offset });
  const spec = TYPES['packet_' + name];
  if (!spec) throw new Error('Missing generated protocol-774 Play packet type ' + name);
  let packet;
  try {
    packet = normalize(name, readType(reader, spec), context);
  } catch (cause) {
    throw new DecoderError(
      "Failed to decode packet '" + NATIVE_PLAY_CLIENTBOUND_NAMES_774[id] + "'",
      { cause, packet: NATIVE_PLAY_CLIENTBOUND_NAMES_774[id], byteOffset: reader.offset }
    );
  }
  if (reader.remaining() !== 0) {
    const packetName = NATIVE_PLAY_CLIENTBOUND_NAMES_774[id];
    throw new DecoderError(
      'Packet play/' + packetName + ' (decodePlayPacket774) was larger than I expected, found ' +
      reader.remaining() + ' bytes extra whilst reading packet ' + packetName,
      { packet: packetName, byteOffset: reader.offset }
    );
  }
  return { name, id, ...packet };
}

export function decodePlayBody774(name, bytes, context = null) {
  const spec = TYPES['packet_' + name];
  if (!spec) throw new Error('Unsupported P11 Play packet ' + name);
  const reader = bytes instanceof Reader774 ? bytes : new Reader774(bytes);
  const packet = normalize(name, readType(reader, spec), context);
  if (reader.remaining() !== 0) throw new Error('Trailing protocol-774 Play body bytes for ' + name);
  return packet;
}

export const P11_PLAY_PACKET_NAMES = PLAY_SCHEMA_774.packets;
