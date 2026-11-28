const TAG_EMPTY = 1;
const TAG_MAP_START = 2;
const TAG_MAP_END = 3;
const TAG_LIST_START = 4;
const TAG_LIST_END = 5;
const TAG_BYTE = 6;
const TAG_SHORT = 7;
const TAG_INT = 8;
const TAG_LONG = 9;
const TAG_FLOAT = 10;
const TAG_DOUBLE = 11;
const TAG_STRING = 12;
const TAG_BOOLEAN = 13;
const TAG_BYTE_ARRAY_START = 14;
const TAG_BYTE_ARRAY_END = 15;
const TAG_INT_ARRAY_START = 16;
const TAG_INT_ARRAY_END = 17;
const TAG_LONG_ARRAY_START = 18;
const TAG_LONG_ARRAY_END = 19;

const MAX_PATCH_ENTRIES = 256;

const DATA_COMPONENT_NAMES_774 = [
  "custom_data", "max_stack_size", "max_damage", "damage", "unbreakable",
  "use_effects", "custom_name", "minimum_attack_charge", "damage_type", "item_name",
  "item_model", "lore", "rarity", "enchantments", "can_place_on",
  "can_break", "attribute_modifiers", "custom_model_data", "tooltip_display", "repair_cost",
  "creative_slot_lock", "enchantment_glint_override", "intangible_projectile", "food", "consumable",
  "use_remainder", "use_cooldown", "damage_resistant", "tool", "weapon",
  "attack_range", "enchantable", "equippable", "repairable", "glider",
  "tooltip_style", "death_protection", "blocks_attacks", "piercing_weapon", "kinetic_weapon",
  "swing_animation", "stored_enchantments", "dyed_color", "map_color", "map_id",
  "map_decorations", "map_post_processing", "charged_projectiles", "bundle_contents", "potion_contents",
  "potion_duration_scale", "suspicious_stew_effects", "writable_book_content", "written_book_content", "trim",
  "debug_stick_state", "entity_data", "bucket_entity_data", "block_entity_data", "instrument",
  "provides_trim_material", "ominous_bottle_amplifier", "jukebox_playable", "provides_banner_patterns", "recipes",
  "lodestone_tracker", "firework_explosion", "fireworks", "profile", "note_block_sound",
  "banner_patterns", "base_color", "pot_decorations", "container", "block_state",
  "bees", "lock", "container_loot", "break_sound", "villager/variant",
  "wolf/variant", "wolf/sound_variant", "wolf/collar", "fox/variant", "salmon/size",
  "parrot/variant", "tropical_fish/pattern", "tropical_fish/base_color", "tropical_fish/pattern_color", "mooshroom/variant",
  "rabbit/variant", "pig/variant", "cow/variant", "chicken/variant", "zombie_nautilus/variant",
  "frog/variant", "horse/variant", "painting/variant", "llama/variant", "axolotl/variant",
  "cat/variant", "cat/collar", "sheep/color", "shulker/color"
];

export const DATA_COMPONENT_IDS_774 = Object.fromEntries(
  DATA_COMPONENT_NAMES_774.map((name, id) => [name, id])
);

// CRC32C (Castagnoli) lookup table using reversed polynomial 0x82F63B78.
const CRC32C_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let bit = 0; bit < 8; bit++) {
    c = (c & 1) ? (0x82f63b78 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32C_TABLE[i] = c >>> 0;
}

export function crc32c(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC32C_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) | 0;
}

export function padToLong(hashInt) {
  return BigInt(hashInt >>> 0);
}

function compareHash(a, b) {
  const ua = a >>> 0;
  const ub = b >>> 0;
  return ua < ub ? -1 : ua > ub ? 1 : 0;
}

function putHashLE(buf, offset, hashInt) {
  const u = hashInt >>> 0;
  buf[offset] = u & 0xff;
  buf[offset + 1] = (u >>> 8) & 0xff;
  buf[offset + 2] = (u >>> 16) & 0xff;
  buf[offset + 3] = (u >>> 24) & 0xff;
}

const HASH_EMPTY = crc32c(Uint8Array.of(TAG_EMPTY));
const HASH_EMPTY_MAP = crc32c(Uint8Array.of(TAG_MAP_START, TAG_MAP_END));
const HASH_EMPTY_LIST = crc32c(Uint8Array.of(TAG_LIST_START, TAG_LIST_END));
const HASH_FALSE = crc32c(Uint8Array.of(TAG_BOOLEAN, 0));
const HASH_TRUE = crc32c(Uint8Array.of(TAG_BOOLEAN, 1));

const scratchBuf = new ArrayBuffer(16);
const scratchBytes = new Uint8Array(scratchBuf);
const scratchView = new DataView(scratchBuf);

const CRC32C_INSTANCE = {
  empty() { return HASH_EMPTY; },
  emptyMap() { return HASH_EMPTY_MAP; },
  emptyList() { return HASH_EMPTY_LIST; },
  createBoolean(value) { return value ? HASH_TRUE : HASH_FALSE; },

  createByte(value) {
    scratchBytes[0] = TAG_BYTE;
    scratchBytes[1] = value & 0xff;
    return crc32c(scratchBytes.subarray(0, 2));
  },

  createShort(value) {
    scratchBytes[0] = TAG_SHORT;
    scratchView.setInt16(1, value, true);
    return crc32c(scratchBytes.subarray(0, 3));
  },

  createInt(value) {
    scratchBytes[0] = TAG_INT;
    scratchView.setInt32(1, value | 0, true);
    return crc32c(scratchBytes.subarray(0, 5));
  },

  createLong(value) {
    scratchBytes[0] = TAG_LONG;
    scratchView.setBigInt64(1, BigInt(value), true);
    return crc32c(scratchBytes.subarray(0, 9));
  },

  createFloat(value) {
    scratchBytes[0] = TAG_FLOAT;
    scratchView.setFloat32(1, value, true);
    return crc32c(scratchBytes.subarray(0, 5));
  },

  createDouble(value) {
    scratchBytes[0] = TAG_DOUBLE;
    scratchView.setFloat64(1, value, true);
    return crc32c(scratchBytes.subarray(0, 9));
  },

  createString(value) {
    const str = String(value);
    const len = str.length;
    const buf = new Uint8Array(5 + len * 2);
    const view = new DataView(buf.buffer);
    buf[0] = TAG_STRING;
    view.setInt32(1, len, true);
    for (let i = 0, p = 5; i < len; i++, p += 2) {
      const code = str.charCodeAt(i);
      buf[p] = code & 0xff;
      buf[p + 1] = (code >>> 8) & 0xff;
    }
    return crc32c(buf);
  },

  createByteList(bytes) {
    const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    const buf = new Uint8Array(2 + arr.length);
    buf[0] = TAG_BYTE_ARRAY_START;
    buf.set(arr, 1);
    buf[buf.length - 1] = TAG_BYTE_ARRAY_END;
    return crc32c(buf);
  },

  createIntList(ints) {
    const list = Array.isArray(ints) || ints instanceof Int32Array ? ints : Array.from(ints);
    const buf = new Uint8Array(2 + list.length * 4);
    const view = new DataView(buf.buffer);
    buf[0] = TAG_INT_ARRAY_START;
    for (let i = 0; i < list.length; i++) {
      view.setInt32(1 + i * 4, list[i] | 0, true);
    }
    buf[buf.length - 1] = TAG_INT_ARRAY_END;
    return crc32c(buf);
  },

  createLongList(longs) {
    const list = Array.isArray(longs) || longs instanceof BigInt64Array ? longs : Array.from(longs);
    const buf = new Uint8Array(2 + list.length * 8);
    const view = new DataView(buf.buffer);
    buf[0] = TAG_LONG_ARRAY_START;
    for (let i = 0; i < list.length; i++) {
      view.setBigInt64(1 + i * 8, BigInt(list[i]), true);
    }
    buf[buf.length - 1] = TAG_LONG_ARRAY_END;
    return crc32c(buf);
  },

  createList(hashes) {
    const list = Array.isArray(hashes) ? hashes : Array.from(hashes);
    if (!list.length) return HASH_EMPTY_LIST;
    const buf = new Uint8Array(2 + list.length * 4);
    buf[0] = TAG_LIST_START;
    for (let i = 0; i < list.length; i++) {
      putHashLE(buf, 1 + i * 4, list[i]);
    }
    buf[buf.length - 1] = TAG_LIST_END;
    return crc32c(buf);
  },

  createMap(entries) {
    const pairs = entries instanceof Map
      ? Array.from(entries.entries())
      : Array.isArray(entries)
        ? entries.slice()
        : Array.from(entries);
    if (!pairs.length) return HASH_EMPTY_MAP;
    pairs.sort((a, b) => compareHash(a[0], b[0]) || compareHash(a[1], b[1]));
    const buf = new Uint8Array(2 + pairs.length * 8);
    buf[0] = TAG_MAP_START;
    for (let i = 0; i < pairs.length; i++) {
      putHashLE(buf, 1 + i * 8, pairs[i][0]);
      putHashLE(buf, 5 + i * 8, pairs[i][1]);
    }
    buf[buf.length - 1] = TAG_MAP_END;
    return crc32c(buf);
  }
};

export const HashOps = Object.freeze({ CRC32C_INSTANCE });

function isWrapperCompound(compound) {
  return compound && typeof compound === "object" && !Array.isArray(compound) &&
    Object.keys(compound).length === 1 && Object.hasOwn(compound, "");
}

export function hashTag(nbtNode) {
  if (nbtNode === null || nbtNode === undefined || nbtNode.t === 0) {
    return CRC32C_INSTANCE.empty();
  }
  switch (nbtNode.t) {
    case 1: return CRC32C_INSTANCE.createByte(nbtNode.v);
    case 2: return CRC32C_INSTANCE.createShort(nbtNode.v);
    case 3: return CRC32C_INSTANCE.createInt(nbtNode.v);
    case 4: return CRC32C_INSTANCE.createLong(nbtNode.v);
    case 5: return CRC32C_INSTANCE.createFloat(nbtNode.v);
    case 6: return CRC32C_INSTANCE.createDouble(nbtNode.v);
    case 7: return CRC32C_INSTANCE.createByteList(nbtNode.v);
    case 8: return CRC32C_INSTANCE.createString(nbtNode.v);
    case 9: {
      const et = nbtNode.v?.et | 0;
      const items = nbtNode.v?.items || [];
      if (!items.length) return CRC32C_INSTANCE.emptyList();
      const hashes = new Array(items.length);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (et === 10 && isWrapperCompound(item)) {
          hashes[i] = hashTag(item[""]);
        } else {
          hashes[i] = hashTag({ t: et, v: item });
        }
      }
      return CRC32C_INSTANCE.createList(hashes);
    }
    case 10: {
      const entries = Object.entries(nbtNode.v || {});
      if (!entries.length) return CRC32C_INSTANCE.emptyMap();
      return CRC32C_INSTANCE.createMap(
        entries.map(([key, child]) => [CRC32C_INSTANCE.createString(key), hashTag(child)])
      );
    }
    case 11: return CRC32C_INSTANCE.createIntList(nbtNode.v);
    case 12: return CRC32C_INSTANCE.createLongList(nbtNode.v);
    default:
      throw new Error("Unknown NBT tag type " + nbtNode.t);
  }
}

export const hashNbtValue = hashTag;

export function hashValue(value) {
  if (value === null || value === undefined) return CRC32C_INSTANCE.empty();
  if (typeof value === "boolean") return CRC32C_INSTANCE.createBoolean(value);
  if (typeof value === "string") return CRC32C_INSTANCE.createString(value);
  if (typeof value === "bigint") return CRC32C_INSTANCE.createLong(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot hash non-finite number");
    return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647
      ? CRC32C_INSTANCE.createInt(value)
      : CRC32C_INSTANCE.createDouble(value);
  }
  if (value instanceof Int8Array || value instanceof Uint8Array) {
    return CRC32C_INSTANCE.createByteList(value);
  }
  if (value instanceof Int32Array) {
    return CRC32C_INSTANCE.createIntList(value);
  }
  if (value instanceof BigInt64Array) {
    return CRC32C_INSTANCE.createLongList(value);
  }
  if (Array.isArray(value)) {
    return CRC32C_INSTANCE.createList(value.map(hashValue));
  }
  if (value instanceof Map) {
    return CRC32C_INSTANCE.createMap(
      Array.from(value.entries(), ([k, v]) => [hashValue(k), hashValue(v)])
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    return CRC32C_INSTANCE.createMap(
      entries.map(([k, v]) => [CRC32C_INSTANCE.createString(k), hashValue(v)])
    );
  }
  throw new Error("Unsupported value type for HashOps: " + typeof value);
}

function resolveComponentTypeId(type) {
  if (Number.isInteger(type) && type >= 0 && type < DATA_COMPONENT_NAMES_774.length) {
    return type;
  }
  if (typeof type === "string") {
    const key = type.startsWith("minecraft:") ? type.slice("minecraft:".length) : type;
    const id = DATA_COMPONENT_IDS_774[key];
    if (id !== undefined) return id;
  }
  throw new Error("Unknown 1.21.11 data component type: " + String(type));
}

function patchCount(count, label) {
  if (!Number.isInteger(count) || count < 0 || count > MAX_PATCH_ENTRIES) {
    throw new Error("Invalid HashedPatchMap " + label + " size: " + count);
  }
  return count;
}

export function readHashedStack774(reader) {
  if (!reader.bool()) return null;
  const itemId = reader.varint();
  const count = reader.varint();
  const addedCount = patchCount(reader.varint(), "addedComponents");
  const components = new Array(addedCount);
  for (let i = 0; i < addedCount; i++) {
    components[i] = { type: reader.varint(), hash: reader.i32() };
  }
  const removedCount = patchCount(reader.varint(), "removedComponents");
  const removeComponents = new Array(removedCount);
  for (let i = 0; i < removedCount; i++) {
    removeComponents[i] = reader.varint();
  }
  return { itemId, count, components, removeComponents };
}

function normalizeAddedHashes(hashedStack) {
  const source = hashedStack.components ?? hashedStack.addedComponents ?? hashedStack.componentPatch?.added;
  if (!source) return [];
  if (source instanceof Map) {
    return Array.from(source.entries(), ([type, hash]) => ({
      type: resolveComponentTypeId(type),
      hash: hash | 0
    }));
  }
  if (Array.isArray(source)) {
    return source.map((entry) => ({
      type: resolveComponentTypeId(entry.type),
      hash: entry.hash | 0
    }));
  }
  return Object.entries(source).map(([type, hash]) => ({
    type: resolveComponentTypeId(type),
    hash: hash | 0
  }));
}

function normalizeRemovedTypes(hashedStack) {
  const source = hashedStack.removeComponents ?? hashedStack.removedComponents ?? hashedStack.componentPatch?.removed;
  if (!source) return [];
  const list = source instanceof Set ? Array.from(source) : Array.isArray(source) ? source : [];
  return list.map((entry) => resolveComponentTypeId(typeof entry === "object" && entry !== null ? entry.type : entry));
}

export function writeHashedStack774(writer, hashedStack) {
  const count = hashedStack ? (hashedStack.count ?? hashedStack.itemCount ?? 0) : 0;
  if (!hashedStack || count <= 0) {
    writer.bool(false);
    return writer;
  }
  const itemId = hashedStack.itemId ?? hashedStack.id ?? hashedStack.item;
  if (!Number.isInteger(itemId) || itemId < 0) {
    throw new Error("Invalid HashedStack itemId: " + itemId);
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("Invalid HashedStack count: " + count);
  }
  const components = normalizeAddedHashes(hashedStack);
  const removeComponents = normalizeRemovedTypes(hashedStack);
  patchCount(components.length, "addedComponents");
  patchCount(removeComponents.length, "removedComponents");

  writer.bool(true).varint(itemId).varint(count);
  writer.varint(components.length);
  for (const entry of components) {
    if (!Number.isInteger(entry.hash)) throw new Error("Invalid HashedStack component hash");
    writer.varint(entry.type).i32(entry.hash | 0);
  }
  writer.varint(removeComponents.length);
  for (const typeId of removeComponents) {
    writer.varint(typeId);
  }
  return writer;
}

function lookupProvidedHash(componentPatchHashes, entry, typeId) {
  if (typeof componentPatchHashes === "function") {
    return componentPatchHashes(entry, typeId);
  }
  if (componentPatchHashes instanceof Map) {
    if (componentPatchHashes.has(typeId)) return componentPatchHashes.get(typeId);
    if (componentPatchHashes.has(entry.type)) return componentPatchHashes.get(entry.type);
    const shortName = DATA_COMPONENT_NAMES_774[typeId];
    if (componentPatchHashes.has(shortName)) return componentPatchHashes.get(shortName);
    if (componentPatchHashes.has("minecraft:" + shortName)) return componentPatchHashes.get("minecraft:" + shortName);
  } else if (componentPatchHashes && typeof componentPatchHashes === "object") {
    if (Object.hasOwn(componentPatchHashes, typeId)) return componentPatchHashes[typeId];
    if (Object.hasOwn(componentPatchHashes, entry.type)) return componentPatchHashes[entry.type];
    const shortName = DATA_COMPONENT_NAMES_774[typeId];
    if (Object.hasOwn(componentPatchHashes, shortName)) return componentPatchHashes[shortName];
    if (Object.hasOwn(componentPatchHashes, "minecraft:" + shortName)) return componentPatchHashes["minecraft:" + shortName];
  }
  return undefined;
}

export function hashSlot774(stack, componentPatchHashes) {
  const count = stack ? (stack.count ?? stack.itemCount ?? 0) : 0;
  if (!stack || count <= 0) return null;
  const itemId = stack.itemId ?? stack.id ?? stack.item;
  if (!Number.isInteger(itemId) || itemId < 0) {
    throw new Error("Invalid slot itemId: " + itemId);
  }

  const rawAdded = stack.componentPatch?.added ?? stack.components ?? [];
  const addedList = Array.isArray(rawAdded)
    ? rawAdded
    : Object.entries(rawAdded).map(([type, data]) => ({ type, data }));

  const components = addedList.map((entry) => {
    const typeId = resolveComponentTypeId(entry.type);
    let hash = lookupProvidedHash(componentPatchHashes, entry, typeId);
    if (hash === undefined) {
      if (entry.hash !== undefined) {
        hash = entry.hash;
      } else if (entry.data && typeof entry.data === "object" && Number.isInteger(entry.data.t)) {
        hash = hashTag(entry.data);
      } else if (entry.data !== undefined) {
        hash = hashValue(entry.data);
      } else {
        throw new Error("Missing hash for component " + DATA_COMPONENT_NAMES_774[typeId]);
      }
    }
    if (!Number.isInteger(hash)) throw new Error("Component hash must be an integer");
    return { type: typeId, hash: hash | 0 };
  });

  const removeComponents = normalizeRemovedTypes(stack);
  patchCount(components.length, "addedComponents");
  patchCount(removeComponents.length, "removedComponents");
  return { itemId, count, components, removeComponents };
}
