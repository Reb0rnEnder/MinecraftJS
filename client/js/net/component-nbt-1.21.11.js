import { readAnonymousNbt, writeAnonymousNbt } from "./nbt-anonymous.js";

const STYLE_BOOLS = new Set(["bold", "italic", "underlined", "strikethrough", "obfuscated"]);
const COMPONENT_TYPES = new Set(["text", "translatable", "score", "selector", "nbt", "keybind", "object"]);
const OBJECT_TYPES = new Set(["atlas", "player"]);
const CONTENT_KEYS = ["text", "translate", "score", "selector", "nbt", "keybind"];
const HOVER_ACTIONS = new Set(["show_text", "show_item", "show_entity"]);

function node(t, v) { return { t, v }; }
function wrapperCompound(value) { return node(10, { "": value }); }
function isWrapper(value) {
  return value?.t === 10 && Object.keys(value.v || {}).length === 1 && Object.hasOwn(value.v, "");
}
function wrapListElement(value) {
  return value.t === 10 && !isWrapper(value) ? value : wrapperCompound(value);
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isUuidString(value) {
  return typeof value === "string" &&
    (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
      /^[0-9a-f]{32}$/i.test(value));
}
function isInt32(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
}
function isValidChatString(value) {
  if (typeof value !== "string") return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c === 167 || c < 32 || c === 127) return false;
  }
  return true;
}
function isValidHttpUri(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function encodeList(values, path) {
  const items = values.map((value, index) => encodeValue(value, path + "[" + index + "]"));
  if (!items.length) return node(9, { et: 0, items: [] });
  const first = items[0].t;
  if (items.every((item) => item.t === first)) {
    if (first === 1) return node(7, Int8Array.from(items.map((item) => item.v)));
    if (first === 3) return node(11, Int32Array.from(items.map((item) => item.v)));
    if (first === 4) return node(12, BigInt64Array.from(items.map((item) => BigInt(item.v))));
    if (first !== 10) return node(9, { et: first, items: items.map((item) => item.v) });
  }
  const wrapped = items.map(wrapListElement);
  return node(9, { et: 10, items: wrapped.map((item) => item.v) });
}

function encodeValue(value, path = "value") {
  if (typeof value === "string") return node(8, value);
  if (typeof value === "boolean") return node(1, value ? 1 : 0);
  if (typeof value === "bigint") return node(4, value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw Error("Invalid numeric value at " + path);
    // ExtraCodecs.VECTOR4F encodes [r, g, b, a] shadow_color lists strictly as TAG_Float.
    if (/\.shadow_color\[\d+\]$/.test(path)) return node(5, Math.fround(value));
    // Native generic translation arguments retain JsonOps' narrowest numeric representation.
    if (/\.with\[\d+\]$/.test(path)) {
      if (Number.isInteger(value)) {
        if (value >= -128 && value <= 127) return node(1, value);
        if (value >= -32768 && value <= 32767) return node(2, value);
        if (value >= -2147483648 && value <= 2147483647) return node(3, value);
        if (value >= -9223372036854775808 && value < 9223372036854775808) return node(4, BigInt(value));
      }
      return Math.fround(value) === value ? node(5, value) : node(6, value);
    }
    return Number.isInteger(value) ? node(3, value) : node(6, value);
  }
  if (value instanceof Int8Array || value instanceof Uint8Array) return node(7, Int8Array.from(value));
  if (value instanceof Int32Array) return node(11, value);
  if (value instanceof BigInt64Array) return node(12, value);
  if (Array.isArray(value)) return encodeList(value, path);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) out[key] = encodeValue(child, path + "." + key);
    }
    return node(10, out);
  }
  throw Error("Unsupported NBT value at " + path);
}

function decodeNode(value, unwrap = false) {
  if (!value) return null;
  switch (value.t) {
    case 1: case 2: case 3: case 5: case 6: return value.v;
    case 4: {
      const x = BigInt(value.v);
      return x >= BigInt(Number.MIN_SAFE_INTEGER) && x <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(x) : x;
    }
    case 7: case 11: case 12: return Array.from(value.v);
    case 8: return value.v;
    case 9: return value.v.items.map((item) => decodeNode(node(value.v.et, item), value.v.et === 10));
    case 10: {
      if (unwrap && isWrapper(value)) return decodeNode(value.v[""]);
      const out = {};
      for (const [key, child] of Object.entries(value.v)) out[key] = decodeNode(child);
      return out;
    }
    default: throw Error("Unknown component NBT type " + value.t);
  }
}

function normalizeBool(value, label, path) {
  if (value === 0 || value === 1) return !!value;
  if (typeof value !== "boolean") throw Error("Invalid " + label + " at " + path);
  return value;
}

function normalizeClickEvent(raw, path) {
  if (!isPlainObject(raw) || typeof raw.action !== "string") {
    throw Error("Invalid click_event at " + path);
  }
  const ce = { ...raw };
  switch (ce.action) {
    case "open_url":
      if (!isValidHttpUri(ce.url)) throw Error("Invalid click_event open_url url at " + path);
      return ce;
    case "run_command":
    case "suggest_command":
      if (!isValidChatString(ce.command)) throw Error("Invalid click_event command at " + path);
      return ce;
    case "change_page":
      if (typeof ce.page !== "number" || !Number.isInteger(ce.page) || ce.page < 1 || ce.page > 2147483647) {
        throw Error("Invalid click_event change_page page at " + path);
      }
      return ce;
    case "copy_to_clipboard":
      if (typeof ce.value !== "string") throw Error("Invalid click_event copy_to_clipboard value at " + path);
      return ce;
    case "show_dialog":
      if ((typeof ce.dialog !== "string" || !ce.dialog) && !isPlainObject(ce.dialog)) {
        throw Error("Invalid click_event show_dialog dialog at " + path);
      }
      return ce;
    case "custom":
      if (typeof ce.id !== "string" || !ce.id) throw Error("Invalid click_event custom id at " + path);
      return ce;
    default:
      throw Error("Unsupported or disallowed click_event action '" + ce.action + "' at " + path);
  }
}

function normalizeHoverEvent(raw, path) {
  if (!isPlainObject(raw) || typeof raw.action !== "string" || !HOVER_ACTIONS.has(raw.action)) {
    throw Error("Invalid hover_event at " + path);
  }
  const he = { ...raw };
  if (he.action === "show_text") {
    if (he.value === undefined) throw Error("Missing hover_event show_text value at " + path);
    he.value = normalizeComponent(he.value, path + ".hover_event.value");
    return he;
  }
  if (he.action === "show_item") {
    if (typeof he.id !== "string" || !he.id) throw Error("Invalid hover_event show_item id at " + path);
    if (he.count !== undefined && (!Number.isInteger(he.count) || he.count < 1 || he.count > 99)) {
      throw Error("Invalid hover_event show_item count at " + path);
    }
    if (he.components !== undefined && !isPlainObject(he.components)) {
      throw Error("Invalid hover_event show_item components at " + path);
    }
    return he;
  }
  // show_entity
  if (typeof he.id !== "string" || !he.id) throw Error("Invalid hover_event show_entity id at " + path);
  const validUuidArray = Array.isArray(he.uuid) && he.uuid.length === 4 && he.uuid.every(isInt32);
  if (!isUuidString(he.uuid) && !validUuidArray) {
    throw Error("Invalid hover_event show_entity uuid at " + path);
  }
  if (he.name !== undefined) {
    he.name = normalizeComponent(he.name, path + ".hover_event.name");
  }
  return he;
}

function normalizeObjectContents(out, path) {
  if (out.object !== undefined && (typeof out.object !== "string" || !OBJECT_TYPES.has(out.object))) {
    throw Error("Invalid object component kind at " + path);
  }
  const kind = out.object ?? (out.sprite !== undefined ? "atlas" : out.player !== undefined ? "player" : null);
  if (!kind) throw Error("Missing object component payload at " + path);
  if (out.sprite !== undefined && out.player !== undefined) {
    throw Error("Ambiguous object component with both sprite and player at " + path);
  }
  if (kind === "atlas") {
    if (typeof out.sprite !== "string" || !out.sprite) throw Error("Invalid atlas object sprite at " + path);
    if (out.atlas !== undefined && (typeof out.atlas !== "string" || !out.atlas)) {
      throw Error("Invalid atlas object atlas at " + path);
    }
    if (out.player !== undefined || out.hat !== undefined) {
      throw Error("Unexpected player fields on atlas object component at " + path);
    }
    return;
  }
  if (out.sprite !== undefined || out.atlas !== undefined) {
    throw Error("Unexpected atlas fields on player object component at " + path);
  }
  if ((typeof out.player !== "string" || !out.player) && !isPlainObject(out.player)) {
    throw Error("Invalid player object profile at " + path);
  }
  if (out.hat !== undefined) out.hat = normalizeBool(out.hat, "hat", path);
}

function normalizeComponent(value, path = "component") {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (!value.length) throw Error("Empty text component list at " + path);
    return value.map((child, index) => normalizeComponent(child, path + "[" + index + "]"));
  }
  if (!value || typeof value !== "object") throw Error("Invalid text component at " + path);
  const out = { ...value };
  if (out.type !== undefined && (typeof out.type !== "string" || !COMPONENT_TYPES.has(out.type))) {
    throw Error("Invalid text component type at " + path);
  }
  for (const key of STYLE_BOOLS) {
    if (out[key] !== undefined) out[key] = normalizeBool(out[key], key + " style", path);
  }
  if (out.color !== undefined && typeof out.color !== "string") throw Error("Invalid color style at " + path);
  if (out.font !== undefined && typeof out.font !== "string") throw Error("Invalid font style at " + path);
  if (out.insertion !== undefined && typeof out.insertion !== "string") throw Error("Invalid insertion style at " + path);
  if (out.shadow_color !== undefined) {
    if (Array.isArray(out.shadow_color)) {
      if (out.shadow_color.length !== 4 || !out.shadow_color.every((v) => typeof v === "number" && Number.isFinite(v))) {
        throw Error("Invalid shadow_color float list at " + path);
      }
      out.shadow_color = out.shadow_color.map((v) => Math.fround(v));
    } else if (typeof out.shadow_color === "number" && Number.isInteger(out.shadow_color) &&
        out.shadow_color >= -2147483648 && out.shadow_color <= 0xffffffff) {
      out.shadow_color = out.shadow_color | 0;
    } else {
      throw Error("Invalid shadow_color style at " + path);
    }
  }
  if (out.text !== undefined && typeof out.text !== "string") throw Error("Invalid text component payload at " + path);
  if (out.translate !== undefined && typeof out.translate !== "string") throw Error("Invalid translation key at " + path);
  if (out.fallback !== undefined && typeof out.fallback !== "string") throw Error("Invalid translation fallback at " + path);
  if (out.selector !== undefined && typeof out.selector !== "string") throw Error("Invalid selector component at " + path);
  if (out.keybind !== undefined && typeof out.keybind !== "string") throw Error("Invalid keybind component at " + path);
  if (out.nbt !== undefined && typeof out.nbt !== "string") throw Error("Invalid NBT component path at " + path);
  if (out.interpret !== undefined) out.interpret = normalizeBool(out.interpret, "interpret", path);
  if (out.score !== undefined) {
    if (!isPlainObject(out.score) || typeof out.score.name !== "string" || typeof out.score.objective !== "string") {
      throw Error("Invalid score component at " + path);
    }
  }
  if (out.with !== undefined) {
    if (!Array.isArray(out.with)) throw Error("Invalid translation arguments at " + path);
    out.with = out.with.map((child, index) => (
      typeof child === "boolean" || (typeof child === "number" && Number.isFinite(child))
        ? child
        : normalizeComponent(child, path + ".with[" + index + "]")
    ));
  }
  if (out.extra !== undefined) {
    if (!Array.isArray(out.extra) || !out.extra.length) throw Error("Invalid extra component list at " + path);
    out.extra = out.extra.map((child, index) => normalizeComponent(child, path + ".extra[" + index + "]"));
  }
  if (out.separator !== undefined) out.separator = normalizeComponent(out.separator, path + ".separator");
  if (out.click_event !== undefined) out.click_event = normalizeClickEvent(out.click_event, path);
  if (out.hover_event !== undefined) out.hover_event = normalizeHoverEvent(out.hover_event, path);

  const hasObject = out.object !== undefined || out.sprite !== undefined || out.player !== undefined;
  if (hasObject) normalizeObjectContents(out, path);

  const content = CONTENT_KEYS.filter((key) => out[key] !== undefined);
  if (hasObject) content.push("object");
  if (content.length !== 1) throw Error("Text component must have exactly one content field at " + path);

  if (out.type !== undefined) {
    const expectedType = content[0] === "translate" ? "translatable" : content[0];
    if (out.type !== expectedType) throw Error("Text component type mismatch at " + path);
  }
  return out;
}

function appendExtra(base, extra) {
  const normalized = normalizeComponent(base);
  const additions = extra.map((child, index) => normalizeComponent(child, "component.extra[" + index + "]"));
  if (typeof normalized === "string") return { text: normalized, extra: additions };
  return { ...normalized, extra: [...(normalized.extra || []), ...additions] };
}

function wireComponent(value) {
  const normalized = normalizeComponent(value);
  if (Array.isArray(normalized)) return appendExtra(normalized[0], normalized.slice(1));
  if (normalized && typeof normalized === "object") {
    const keys = Object.keys(normalized);
    if (keys.length === 1 && keys[0] === "text") return normalized.text;
  }
  return normalized;
}

export function componentFromNbt(value) {
  return normalizeComponent(decodeNode(value));
}

export function componentToNbt(component) {
  return encodeValue(wireComponent(component), "component");
}

export function readComponentNbt(r) {
  const value = readAnonymousNbt(r);
  if (!value) throw Error("Missing text component");
  return componentFromNbt(value);
}

export function writeComponentNbt(w, component) {
  return writeAnonymousNbt(w, componentToNbt(component));
}
