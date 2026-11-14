import { readAnonymousNbt, writeAnonymousNbt } from "./nbt-anonymous.js";
import { componentFromNbt } from "./component-nbt-1.20.6.js";
import { ITEM_COMPONENT_SCHEMA_766 } from "./item-components-1.20.6-schema.js";
import { ITEM_DEFAULTS_766 } from "./item-components-1.20.6-defaults.js";

const TYPES = ITEM_COMPONENT_SCHEMA_766.types;
const COMPONENT_NAMES = ITEM_COMPONENT_SCHEMA_766.componentNames;
const COMPONENT_IDS = Object.fromEntries(COMPONENT_NAMES.map((name, id) => [name, id]));
const MAX_COLLECTION = 1048576;

function collectionCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_COLLECTION) {
    throw new Error("Invalid " + label + " length");
  }
  return value;
}

function primitiveRead(reader, name) {
  switch (name) {
    case "i8": return reader.i8();
    case "i32": return reader.i32();
    case "i64": return reader.i64();
    case "f32": return reader.f32();
    case "f64": return reader.f64();
    case "bool": return reader.bool();
    case "varint": return reader.varint();
    case "string": return reader.string();
    case "UUID": return reader.uuid();
    case "position": return reader.position();
    case "anonymousNbt": {
      const value = readAnonymousNbt(reader);
      if (!value) throw new Error("Missing anonymous NBT payload");
      return value;
    }
    case "anonOptionalNbt": return readAnonymousNbt(reader);
    case "void": return undefined;
    default: return null;
  }
}

function primitiveWrite(writer, name, value) {
  switch (name) {
    case "i8": writer.i8(value); return true;
    case "i32": writer.i32(value); return true;
    case "i64": writer.i64(value); return true;
    case "f32": writer.f32(value); return true;
    case "f64": writer.f64(value); return true;
    case "bool": writer.bool(value); return true;
    case "varint": writer.varint(value); return true;
    case "string": writer.string(value); return true;
    case "UUID": writer.uuid(value); return true;
    case "position": writer.position(value.x, value.y, value.z); return true;
    case "anonymousNbt":
      if (!value) throw new Error("Missing anonymous NBT payload");
      writeAnonymousNbt(writer, value);
      return true;
    case "anonOptionalNbt":
      writeAnonymousNbt(writer, value ?? null);
      return true;
    case "void": return true;
    default: return false;
  }
}

function readBitfield(reader, fields) {
  const total = fields.reduce((sum, field) => sum + field.size, 0);
  if (total !== 64) throw new Error("Unsupported bitfield width " + total);
  const raw = BigInt.asUintN(64, reader.i64());
  let shift = BigInt(total);
  const out = {};
  for (const field of fields) {
    shift -= BigInt(field.size);
    const bits = (raw >> shift) & ((1n << BigInt(field.size)) - 1n);
    out[field.name] = Number(field.signed ? BigInt.asIntN(field.size, bits) : bits);
  }
  return out;
}

function writeBitfield(writer, fields, value) {
  const total = fields.reduce((sum, field) => sum + field.size, 0);
  if (total !== 64) throw new Error("Unsupported bitfield width " + total);
  let raw = 0n;
  let shift = BigInt(total);
  for (const field of fields) {
    shift -= BigInt(field.size);
    const bits = BigInt.asUintN(field.size, BigInt(value[field.name]));
    raw |= bits << shift;
  }
  writer.i64(BigInt.asIntN(64, raw));
}

function readType(reader, spec, context = null, depth = 0) {
  if (depth > 128) throw new Error("Component schema nesting too deep");
  if (typeof spec === "string") {
    if (spec === "Slot") return decorateSlot(readType(reader, TYPES.Slot, context, depth + 1));
    const primitive = primitiveRead(reader, spec);
    if (primitive !== null || ["void", "anonOptionalNbt"].includes(spec)) return primitive;
    const named = TYPES[spec];
    if (!named) throw new Error("Unknown protocol-766 type " + spec);
    return readType(reader, named, context, depth + 1);
  }

  const [kind, args] = spec;
  if (kind === "container") {
    const out = {};
    for (const field of args) {
      const value = readType(reader, field.type, out, depth + 1);
      if (field.anon) {
        if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(out, value);
      } else if (value !== undefined) {
        out[field.name] = value;
      }
    }
    return out;
  }

  if (kind === "switch") {
    const key = String(context?.[args.compareTo]);
    const chosen = Object.hasOwn(args.fields || {}, key) ? args.fields[key] : args.default;
    if (chosen === undefined) throw new Error("No protocol-766 switch branch for " + args.compareTo + "=" + key);
    return readType(reader, chosen, context, depth + 1);
  }

  if (kind === "array") {
    const count = args.count !== undefined
      ? collectionCount(Number(context?.[args.count]), "component array")
      : collectionCount(Number(readType(reader, args.countType, context, depth + 1)), "component array");
    const out = new Array(count);
    for (let i = 0; i < count; i++) out[i] = readType(reader, args.type, context, depth + 1);
    return out;
  }

  if (kind === "mapper") {
    const raw = readType(reader, args.type, context, depth + 1);
    const mapped = args.mappings[String(raw)];
    if (mapped === undefined) throw new Error("Unknown protocol-766 mapped value " + raw);
    return mapped;
  }

  if (kind === "option") {
    return reader.bool() ? readType(reader, args, context, depth + 1) : null;
  }

  if (kind === "pstring") {
    if (args.countType !== "varint") throw new Error("Unsupported protocol-766 string length type");
    return reader.string();
  }

  if (kind === "bitfield") return readBitfield(reader, args);

  if (kind === "registryEntryHolder") {
    const encoded = reader.varint();
    if (encoded !== 0) return { [args.baseName]: encoded - 1 };
    return { [args.otherwise.name]: readType(reader, args.otherwise.type, context, depth + 1) };
  }

  if (kind === "registryEntryHolderSet") {
    const encoded = collectionCount(reader.varint(), "registry holder set");
    if (encoded === 0) {
      return { [args.base.name]: readType(reader, args.base.type, context, depth + 1) };
    }
    const count = encoded - 1;
    const values = new Array(count);
    for (let i = 0; i < count; i++) values[i] = readType(reader, args.otherwise.type, context, depth + 1);
    return { [args.otherwise.name]: values };
  }

  throw new Error("Unsupported protocol-766 constructor " + kind);
}

function writeType(writer, spec, value, context = null, depth = 0) {
  if (depth > 128) throw new Error("Component schema nesting too deep");
  if (typeof spec === "string") {
    if (spec === "Slot") {
      writeType(writer, TYPES.Slot, rawSlot(value), context, depth + 1);
      return;
    }
    if (primitiveWrite(writer, spec, value)) return;
    const named = TYPES[spec];
    if (!named) throw new Error("Unknown protocol-766 type " + spec);
    writeType(writer, named, value, context, depth + 1);
    return;
  }

  const [kind, args] = spec;
  if (kind === "container") {
    if (!value || typeof value !== "object") throw new Error("Protocol-766 container requires an object");
    for (const field of args) {
      writeType(writer, field.type, field.anon ? value : value[field.name], value, depth + 1);
    }
    return;
  }

  if (kind === "switch") {
    const key = String(context?.[args.compareTo]);
    const chosen = Object.hasOwn(args.fields || {}, key) ? args.fields[key] : args.default;
    if (chosen === undefined) throw new Error("No protocol-766 switch branch for " + args.compareTo + "=" + key);
    writeType(writer, chosen, value, context, depth + 1);
    return;
  }

  if (kind === "array") {
    if (!Array.isArray(value)) throw new Error("Protocol-766 array requires an array");
    collectionCount(value.length, "component array");
    if (args.count !== undefined) {
      if (Number(context?.[args.count]) !== value.length) {
        throw new Error("Protocol-766 array count mismatch for " + args.count);
      }
    } else {
      writeType(writer, args.countType, value.length, context, depth + 1);
    }
    for (const entry of value) writeType(writer, args.type, entry, context, depth + 1);
    return;
  }

  if (kind === "mapper") {
    const pair = Object.entries(args.mappings).find(([, mapped]) => mapped === value);
    if (!pair) throw new Error("Unknown protocol-766 mapped value " + value);
    writeType(writer, args.type, Number(pair[0]), context, depth + 1);
    return;
  }

  if (kind === "option") {
    const present = value !== null && value !== undefined;
    writer.bool(present);
    if (present) writeType(writer, args, value, context, depth + 1);
    return;
  }

  if (kind === "pstring") {
    if (args.countType !== "varint") throw new Error("Unsupported protocol-766 string length type");
    writer.string(value);
    return;
  }

  if (kind === "bitfield") {
    writeBitfield(writer, args, value);
    return;
  }

  if (kind === "registryEntryHolder") {
    if (value?.[args.baseName] !== undefined && value?.[args.baseName] !== null) {
      writer.varint(Number(value[args.baseName]) + 1);
    } else if (value && Object.hasOwn(value, args.otherwise.name)) {
      writer.varint(0);
      writeType(writer, args.otherwise.type, value[args.otherwise.name], context, depth + 1);
    } else {
      throw new Error("Registry holder requires " + args.baseName + " or " + args.otherwise.name);
    }
    return;
  }

  if (kind === "registryEntryHolderSet") {
    if (value?.[args.base.name] !== undefined && value?.[args.base.name] !== null) {
      writer.varint(0);
      writeType(writer, args.base.type, value[args.base.name], context, depth + 1);
    } else if (Array.isArray(value?.[args.otherwise.name])) {
      const values = value[args.otherwise.name];
      collectionCount(values.length, "registry holder set");
      writer.varint(values.length + 1);
      for (const entry of values) writeType(writer, args.otherwise.type, entry, context, depth + 1);
    } else {
      throw new Error("Registry holder set requires " + args.base.name + " or " + args.otherwise.name);
    }
    return;
  }

  throw new Error("Unsupported protocol-766 constructor " + kind);
}

function patchArray(item) {
  if (item?.componentPatch?.added) {
    return Array.isArray(item.componentPatch.added)
      ? item.componentPatch.added
      : Object.entries(item.componentPatch.added).map(([type, data]) => ({ type, data }));
  }
  return Array.isArray(item?.components) ? item.components : [];
}

function removedArray(item) {
  if (Array.isArray(item?.componentPatch?.removed)) return item.componentPatch.removed;
  if (Array.isArray(item?.removeComponents)) {
    return item.removeComponents.map((entry) => typeof entry === "string" ? entry : entry.type);
  }
  return [];
}

function componentView(type, entry) {
  if (!entry) return undefined;
  const value = entry.value;
  if (entry.source !== "patch") return value;
  if (type === "custom_name" || type === "item_name") {
    return value ? componentFromNbt(value) : null;
  }
  if (type === "lore") {
    return value.map((line) => line ? componentFromNbt(line) : null);
  }
  if (type === "written_book_content") {
    return {
      ...value,
      pages: value.pages.map((page) => ({
        ...page,
        content: componentFromNbt(page.content),
        filteredContent: page.filteredContent ? componentFromNbt(page.filteredContent) : null
      }))
    };
  }
  return value;
}

function effectiveComponents(itemId, added, removed) {
  const item = ITEM_DEFAULTS_766.items[itemId];
  if (!item) throw new Error("Unknown 1.20.6 item ID " + itemId);
  const effective = {};
  for (const [type, value] of Object.entries(item.defaults)) {
    effective[type] = { source: "default", value };
  }
  for (const type of removed) delete effective[type];
  for (const component of added) {
    effective[component.type] = { source: "patch", value: component.data };
  }
  return effective;
}

function decorateSlot(raw) {
  if (!raw || raw.itemCount === 0) return null;
  const added = raw.components || [];
  const removed = (raw.removeComponents || []).map((entry) => entry.type);
  const info = ITEM_DEFAULTS_766.items[raw.itemId];
  if (!info) throw new Error("Unknown 1.20.6 item ID " + raw.itemId);
  const effective = effectiveComponents(raw.itemId, added, removed);
  const values = Object.fromEntries(
    Object.entries(effective).map(([type, entry]) => [type, componentView(type, entry)])
  );
  return {
    id: raw.itemId,
    itemId: raw.itemId,
    itemKey: info.name,
    count: raw.itemCount,
    damage: Number(values.damage || 0),
    maxDamage: values.max_damage === undefined ? null : Number(values.max_damage),
    maxStackSize: values.max_stack_size === undefined ? null : Number(values.max_stack_size),
    componentPatch: { added, removed },
    effectiveComponents: effective,
    componentValues: values
  };
}

function rawSlot(item) {
  if (!item || item.count <= 0) return { itemCount: 0 };
  const added = patchArray(item);
  const removed = removedArray(item);
  const itemId = Number(item.itemId ?? item.id);
  if (!Number.isInteger(itemId) || itemId < 0 || itemId >= ITEM_DEFAULTS_766.items.length) {
    throw new Error("Invalid 1.20.6 item ID " + itemId);
  }
  if (!Number.isInteger(item.count) || item.count < -128 || item.count > 127 || item.count === 0) {
    throw new Error("Invalid 1.20.6 item count");
  }
  return {
    itemCount: item.count,
    itemId,
    addedComponentCount: added.length,
    removedComponentCount: removed.length,
    components: added,
    removeComponents: removed.map((type) => ({ type }))
  };
}

export function createItemStack766(itemId,count=1,patch={added:[],removed:[]}) {
  return decorateSlot({itemId,itemCount:count,components:patch.added||[],removeComponents:(patch.removed||[]).map(type=>({type}))});
}

export function readSlot766(reader) {
  return decorateSlot(readType(reader, TYPES.Slot));
}

export function writeSlot766(writer, item) {
  writeType(writer, TYPES.Slot, rawSlot(item));
  return writer;
}

export function readComponentData766(reader, type) {
  const branch = TYPES.SlotComponent[1][1].type[1].fields[type];
  if (branch === undefined) throw new Error("Unknown 1.20.6 component " + type);
  return readType(reader, branch, { type });
}

export function writeComponentData766(writer, type, value) {
  const branch = TYPES.SlotComponent[1][1].type[1].fields[type];
  if (branch === undefined) throw new Error("Unknown 1.20.6 component " + type);
  writeType(writer, branch, value, { type });
  return writer;
}

export function applyComponentPatch766(itemId, added, removed) {
  return effectiveComponents(itemId, added, removed);
}

export function decorateItemCost766(cost) {
  if (!cost) return null;
  const added = cost.components || [];
  const info = ITEM_DEFAULTS_766.items[cost.itemId];
  if (!info) throw new Error("Unknown 1.20.6 item cost ID " + cost.itemId);
  const effective = effectiveComponents(cost.itemId, added, []);
  const values = Object.fromEntries(
    Object.entries(effective).map(([type, entry]) => [type, componentView(type, entry)])
  );
  return {
    id: cost.itemId,
    itemId: cost.itemId,
    itemKey: info.name,
    count: cost.itemCount,
    damage: Number(values.damage || 0),
    maxDamage: values.max_damage === undefined ? null : Number(values.max_damage),
    maxStackSize: values.max_stack_size === undefined ? null : Number(values.max_stack_size),
    componentPatch: { added, removed: [] },
    effectiveComponents: effective,
    componentValues: values
  };
}

export { COMPONENT_NAMES, COMPONENT_IDS };
