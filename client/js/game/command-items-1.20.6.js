// Native 1.20.5+ item command arguments: ItemParser (minecraft:item_stack, `id[component=value,...]`) and
// ItemPredicateArgument's ComponentPredicateParser grammar (minecraft:item_predicate, `id|#tag|*` then
// `[a|!b,c=value,d~value]`). Values are SNBT read like TagParser.readValue; the plain integer/boolean component
// codecs are checked with their native messages, other codecs are left to the server.
import { parseSnbt } from '../net/snbt.js';

// 1.20.6 registries (generated reports): data_component_type and item_sub_predicate_type
export const DATA_COMPONENT_TYPES = ['attribute_modifiers', 'banner_patterns', 'base_color', 'bees', 'block_entity_data', 'block_state', 'bucket_entity_data', 'bundle_contents', 'can_break', 'can_place_on', 'charged_projectiles', 'container', 'container_loot', 'creative_slot_lock', 'custom_data', 'custom_model_data', 'custom_name', 'damage', 'debug_stick_state', 'dyed_color', 'enchantment_glint_override', 'enchantments', 'entity_data', 'fire_resistant', 'firework_explosion', 'fireworks', 'food', 'hide_additional_tooltip', 'hide_tooltip', 'instrument', 'intangible_projectile', 'item_name', 'lock', 'lodestone_tracker', 'lore', 'map_color', 'map_decorations', 'map_id', 'map_post_processing', 'max_damage', 'max_stack_size', 'note_block_sound', 'ominous_bottle_amplifier', 'pot_decorations', 'potion_contents', 'profile', 'rarity', 'recipes', 'repair_cost', 'stored_enchantments', 'suspicious_stew_effects', 'tool', 'trim', 'unbreakable', 'writable_book_content', 'written_book_content'].map((n) => 'minecraft:' + n);
// DataComponentType.isTransient: no persistent codec
export const TRANSIENT_COMPONENTS = new Set(['minecraft:creative_slot_lock', 'minecraft:map_post_processing']);
export const ITEM_SUB_PREDICATES = ['attribute_modifiers', 'bundle_contents', 'container', 'custom_data', 'damage', 'enchantments', 'firework_explosion', 'fireworks', 'potion_contents', 'stored_enchantments', 'trim', 'writable_book_content', 'written_book_content'].map((n) => 'minecraft:' + n);
const COUNT = 'minecraft:count'; // ItemPredicateArgument PSEUDO_COMPONENTS / PSEUDO_PREDICATES

// DataComponents codecs with a plain number (NbtOps "Not a number"), and their range messages (ExtraCodecs)
const nonNegative = (v) => (v >= 0 ? null : 'Value must be non-negative: ' + v);
const positive = (v) => (v >= 1 ? null : 'Value must be positive: ' + v);
const range = (a, b) => (v) => (v >= a && v <= b ? null : `Value must be within range [${a};${b}]: ` + v);
const INT_CODECS = { 'minecraft:damage': nonNegative, 'minecraft:max_damage': positive, 'minecraft:max_stack_size': range(1, 99), 'minecraft:repair_cost': nonNegative, 'minecraft:ominous_bottle_amplifier': range(0, 4), 'minecraft:custom_model_data': null, 'minecraft:map_id': null, 'minecraft:enchantment_glint_override': null };
const NUMERIC = new Set([1, 2, 3, 4, 5, 6]);
function codecError(type, tag) {
  if (!(type in INT_CODECS)) return null;
  if (!NUMERIC.has(tag.t)) return 'Not a number';
  const check = INT_CODECS[type];
  return check ? check(Math.trunc(Number(tag.v))) : null;
}

const fail = (start, key, args = []) => ({ end: start, error: { start, key, args } });
const isRl = (c) => /[0-9a-z_:/.-]/.test(c);
// ResourceLocation.read: the allowed characters, then namespace/path validation
function readRl(text, i) {
  const start = i;
  while (i < text.length && isRl(text[i])) i++;
  const raw = text.slice(start, i), colon = raw.indexOf(':');
  const ns = colon >= 0 ? raw.slice(0, colon) : 'minecraft', path = colon >= 0 ? raw.slice(colon + 1) : raw;
  if (!/^[a-z0-9_.-]*$/.test(ns) || !/^[a-z0-9/._-]*$/.test(path)) return { error: fail(start, 'argument.id.invalid') };
  return { id: ns + ':' + path, end: i };
}
const skipWs = (text, i) => { while (i < text.length && /\s/.test(text[i])) i++; return i; };
// TagParser.readValue errors in our SNBT reader's terms
function readValue(text, i) {
  try { const r = parseSnbt(text, { partial: true, from: i, nativeNumbers: true }); return { tag: r.value, end: r.end }; }
  catch (e) {
    const m = String(e.message);
    return { error: fail(i, m.includes('Expected key') ? 'argument.nbt.expected.key' : m.includes('Mixed list') ? 'argument.nbt.list.mixed' : m.includes('Invalid array') ? 'argument.nbt.array.mixed' : 'argument.nbt.expected.value') };
  }
}
const normalize = (id) => (id.includes(':') ? id : 'minecraft:' + id);

// minecraft:item_stack -> { end } or { error }
export function parseItemStack(text, start, { items }) {
  const rl = readRl(text, start);
  if (rl.error) return rl.error;
  if (items?.length && !items.includes(rl.id)) return fail(start, 'argument.item.id.invalid', [rl.id]);
  let i = rl.end;
  if (text[i] !== '[') return { end: i };
  i++;
  const seen = new Set();
  while (i < text.length && text[i] !== ']') {
    i = skipWs(text, i);
    if (i >= text.length) return fail(i, 'arguments.item.component.expected');
    const typeStart = i, type = readRl(text, i);
    if (type.error) return type.error;
    if (!DATA_COMPONENT_TYPES.includes(type.id) || TRANSIENT_COMPONENTS.has(type.id)) return fail(typeStart, 'arguments.item.component.unknown', [type.id]);
    if (seen.has(type.id)) return fail(type.end, 'arguments.item.component.repeated', [type.id]);
    seen.add(type.id);
    i = skipWs(text, type.end);
    if (text[i] !== '=') return fail(i, 'parsing.expected', ['=']);
    i = skipWs(text, i + 1);
    const valueStart = i, v = readValue(text, i);
    if (v.error) return v.error;
    const bad = codecError(type.id, v.tag);
    if (bad) return fail(valueStart, 'arguments.item.component.malformed', [type.id, bad]);
    i = skipWs(text, v.end);
    if (text[i] !== ',') break;
    i = skipWs(text, i + 1);
    if (i >= text.length) return fail(i, 'arguments.item.component.expected');
  }
  if (text[i] !== ']') return fail(i, 'parsing.expected', [']']);
  return { end: i + 1 };
}

// minecraft:item_predicate (ComponentPredicateParser grammar) -> { end } or { error }
export function parseItemPredicate(text, start, { items, itemTags }) {
  let i = start;
  if (text[i] === '*') i++;
  else if (text[i] === '#') {
    const rl = readRl(text, i + 1);
    if (rl.error) return rl.error;
    if (itemTags && !itemTags.includes(rl.id)) return fail(i + 1, 'arguments.item.tag.unknown', [rl.id]);
    i = rl.end;
  } else {
    const rl = readRl(text, i);
    if (rl.error) return rl.error;
    if (items?.length && !items.includes(rl.id)) return fail(i, 'argument.item.id.invalid', [rl.id]);
    i = rl.end;
  }
  if (text[i] !== '[') return { end: i };
  i = skipWs(text, i + 1);
  if (text[i] === ']') return { end: i + 1 }; // conditions are optional
  // the grammar's character and resource terms skip whitespace before themselves
  // conditions := alternatives (',' conditions)?; alternatives := term ('|' alternatives)?; term := '!'? test
  for (;;) {
    for (;;) {
      i = skipWs(text, i);
      if (text[i] === '!') i = skipWs(text, i + 1);
      const typeStart = i, rl = readRl(text, i);
      if (rl.error) return rl.error;
      i = skipWs(text, rl.end);
      if (text[i] === '~') {
        if (rl.id !== COUNT && !ITEM_SUB_PREDICATES.includes(rl.id)) return fail(typeStart, 'arguments.item.predicate.unknown', [rl.id]);
        const v = readValue(text, i + 1);
        if (v.error) return v.error;
        i = v.end;
      } else {
        if (rl.id !== COUNT && (!DATA_COMPONENT_TYPES.includes(rl.id) || TRANSIENT_COMPONENTS.has(rl.id))) return fail(typeStart, 'arguments.item.component.unknown', [rl.id]);
        if (text[i] === '=') {
          const valueStart = skipWs(text, i + 1), v = readValue(text, valueStart);
          if (v.error) return v.error;
          const bad = rl.id === COUNT ? null : codecError(rl.id, v.tag);
          if (bad) return fail(valueStart, 'arguments.item.component.malformed', [rl.id, bad]);
          i = v.end;
        }
      }
      i = skipWs(text, i);
      if (text[i] !== '|') break;
      i++;
    }
    if (text[i] !== ',') break;
    i++;
  }
  i = skipWs(text, i);
  if (text[i] !== ']') return fail(i, 'parsing.expected', [']']);
  return { end: i + 1 };
}
export { normalize as normalizeItemId };

// ItemParser.SuggestionsVisitor: what the last parse step would suggest at the end of `word`
// -> { offset (within word), values } or null to fall back to item ids
export function itemStackSuggestions(word, items) {
  const rl = readRl(word, 0);
  if (rl.error || rl.end < word.length && word[rl.end] !== '[') return null;
  if (rl.end === word.length) return items?.includes(rl.id) ? { offset: word.length, values: ['['] } : null;
  let i = rl.end + 1;
  const seen = new Set();
  for (;;) {
    i = skipWs(word, i);
    const typeStart = i, type = readRl(word, i);
    if (type.end === word.length && !type.error && DATA_COMPONENT_TYPES.includes(type.id) && !TRANSIENT_COMPONENTS.has(type.id) && !seen.has(type.id)) return { offset: type.end, values: ['='] };
    if (type.end === word.length) return { offset: typeStart, values: DATA_COMPONENT_TYPES.filter((t) => !TRANSIENT_COMPONENTS.has(t) && !seen.has(t)).map((t) => t + '=') };
    if (type.error || !DATA_COMPONENT_TYPES.includes(type.id)) return { offset: word.length, values: [] };
    seen.add(type.id);
    i = skipWs(word, type.end);
    if (i === word.length) return { offset: i, values: ['='] };
    if (word[i] !== '=') return { offset: word.length, values: [] };
    const v = readValue(word, skipWs(word, i + 1));
    if (v.error) return { offset: word.length, values: [] };
    i = skipWs(word, v.end);
    if (i === word.length) return { offset: i, values: [',', ']'] };
    if (word[i] !== ',') return { offset: word.length, values: [] };
    i++;
  }
}
// Inside an item predicate's brackets after "[", ",", "|" or "!": component and sub-predicate types
export function itemPredicateSuggestions(word) {
  const open = word.indexOf('[');
  if (open < 0 || word.includes(']')) return null;
  const m = /[[,|!]\s*([0-9a-z_:/.-]*)$/.exec(word);
  if (!m) return { offset: word.length, values: [] };
  return { offset: word.length - m[1].length, values: [...new Set([COUNT, ...DATA_COMPONENT_TYPES.filter((t) => !TRANSIENT_COMPONENTS.has(t)), ...ITEM_SUB_PREDICATES])] };
}
