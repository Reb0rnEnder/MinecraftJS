// Native 26.3 recipe-book display graph. The server sends RecipeDisplayEntry records with a
// numeric RecipeDisplayId and a graph of SlotDisplays; the book UI still works with recipe
// records (cells, result, shaped layout), so this module resolves the graph once into that
// shape and keeps the native id for outbound place_recipe / seen_recipe packets.
import { DEFAULT_TAGS } from './default-tags.js';

// Registries.RECIPE_BOOK_CATEGORY protocol ids from the pinned 26.3 registry report.
export const RECIPE_BOOK_CATEGORIES_26_3 = Object.freeze([
  'minecraft:crafting_building_blocks',
  'minecraft:crafting_redstone',
  'minecraft:crafting_equipment',
  'minecraft:crafting_misc',
  'minecraft:furnace_food',
  'minecraft:furnace_blocks',
  'minecraft:furnace_misc',
  'minecraft:blast_furnace_blocks',
  'minecraft:blast_furnace_misc',
  'minecraft:smoker_food',
  'minecraft:stonecutter',
  'minecraft:smithing',
  'minecraft:campfire'
]);

const CATEGORY_TAB = Object.freeze({
  'minecraft:crafting_building_blocks': 'buildingBlocks',
  'minecraft:crafting_redstone': 'redstone',
  'minecraft:crafting_equipment': 'tools',
  'minecraft:crafting_misc': 'misc',
  'minecraft:furnace_food': 'food',
  'minecraft:furnace_blocks': 'buildingBlocks',
  'minecraft:furnace_misc': 'misc',
  'minecraft:blast_furnace_blocks': 'buildingBlocks',
  'minecraft:blast_furnace_misc': 'misc',
  'minecraft:smoker_food': 'food',
  'minecraft:stonecutter': 'misc',
  'minecraft:smithing': 'tools',
  'minecraft:campfire': 'food'
});

const bare = (name) => String(name || '').replace(/^minecraft:/, '');

function tagIds(game, name) {
  const key = String(name || '');
  const tags = game.tags?.registries?.items;
  return tags?.get(key) || tags?.get(bare(key)) || DEFAULT_TAGS.items[key] || DEFAULT_TAGS.items[bare(key)] || [];
}

function stackForItem(item, count = 1, template = null) {
  if (!Number.isInteger(item) || item < 0) return null;
  const stack = { id: item, count: count > 0 ? count : 1, version: '26.3' };
  if (template) {
    if (template.components) stack.components = template.components;
    if (template.added?.length || template.removed?.length) {
      stack.componentPatch = { added: template.added || [], removed: template.removed || [] };
    }
  }
  return stack;
}

function ingredientStacks(game, ingredient) {
  if (!ingredient) return [];
  if (Array.isArray(ingredient)) return ingredient.flatMap((entry) => ingredientStacks(game, entry));
  if (ingredient.tag) return tagIds(game, ingredient.tag).map((id) => stackForItem(id)).filter(Boolean);
  if (ingredient.items) return ingredient.items.map((id) => stackForItem(id)).filter(Boolean);
  if (ingredient.type) return nativeSlotStacks(game, ingredient);
  return [];
}

// SlotDisplay renders one of several representations. The book needs ingredient alternatives
// for cells and the first stack for a result, so each branch returns the stacks it can show.
export function nativeSlotStacks(game, display) {
  if (!display) return [];
  switch (display.type) {
    case 'empty':
      return [];
    case 'item':
      return [stackForItem(display.item)].filter(Boolean);
    case 'item_stack':
      return display.stack ? [stackForItem(display.stack.itemId, display.stack.count, display.stack)].filter(Boolean) : [];
    case 'tag':
      return ingredientStacks(game, display.tag);
    case 'any_fuel':
      return tagIds(game, 'minecraft:furnace_fuel').map((id) => stackForItem(id)).filter(Boolean);
    case 'with_any_potion':
      return nativeSlotStacks(game, display.display);
    case 'only_with_component':
      return nativeSlotStacks(game, display.source);
    case 'dyed':
      return nativeSlotStacks(game, display.target);
    case 'smithing_trim':
      return nativeSlotStacks(game, display.base);
    case 'with_remainder':
      return nativeSlotStacks(game, display.input);
    case 'composite':
      return (display.contents || []).flatMap((child) => nativeSlotStacks(game, child));
    default:
      return [];
  }
}

function categoryName(id) {
  return RECIPE_BOOK_CATEGORIES_26_3[id] || 'minecraft:crafting_misc';
}

function recipeType(display, category) {
  if (display.type !== 'furnace') return display.type;
  if (category === 'minecraft:blast_furnace_blocks' || category === 'minecraft:blast_furnace_misc') return 'blasting';
  if (category === 'minecraft:smoker_food') return 'smoking';
  if (category === 'minecraft:campfire') return 'campfire_cooking';
  return 'smelting';
}

function cellAlternatives(game, display) {
  return nativeSlotStacks(game, display);
}

function primaryStack(stacks) {
  return stacks.find(Boolean) || null;
}

// Convert one native RecipeDisplay (+ its entry metadata) to the book record shape. The entry
// id stays as displayId; the UI id is namespaced so it cannot collide with legacy recipe ids.
export function nativeRecipeFromDisplay(game, display, contents = {}) {
  if (!display) return null;
  const category = categoryName(contents.category);
  const type = recipeType(display, category);
  const tab = CATEGORY_TAB[category] || 'misc';
  const result = primaryStack(nativeSlotStacks(game, display.result));
  if (!result) return null;
  const rec = {
    id: Number.isInteger(contents.id) ? `native:${contents.id}` : `native:ghost:${type}`,
    displayId: Number.isInteger(contents.id) ? contents.id : undefined,
    native: true,
    type: `minecraft:${type}`,
    category,
    tab,
    group: contents.group ?? null,
    result,
    display,
    shaped: type === 'crafting_shaped',
    cells: [],
    width: 0,
    height: 0,
    flags: contents.flags || 0,
    notification: !!(contents.flags & 1),
    highlight: !!(contents.flags & 2)
  };
  if (type === 'crafting_shaped') {
    const width = Math.max(0, display.width | 0);
    const height = Math.max(0, display.height | 0);
    rec.width = width;
    rec.height = height;
    for (let i = 0; i < width * height; i++) rec.cells.push(cellAlternatives(game, display.ingredients?.[i] || { type: 'empty' }));
  } else if (type === 'crafting_shapeless') {
    rec.cells = (display.ingredients || []).map((slot) => cellAlternatives(game, slot)).filter((alts) => alts.length);
    rec.width = rec.height = Math.max(1, Math.ceil(Math.sqrt(rec.cells.length)));
  } else if (type === 'smithing') {
    rec.cells = [display.template, display.base, display.addition].map((slot) => cellAlternatives(game, slot));
    rec.width = rec.height = 3;
  } else if (type === 'stonecutter') {
    rec.cells = [cellAlternatives(game, display.input)];
    rec.width = rec.height = 1;
  } else {
    rec.cells = [cellAlternatives(game, display.ingredient)];
    rec.width = rec.height = 1;
  }
  if (!rec.cells.some((alts) => alts.length)) return null;
  if (Array.isArray(contents.requirements) && contents.requirements.length) {
    rec.craftCells = contents.requirements.map((ingredient) => ingredientStacks(game, ingredient)).filter((alts) => alts.length);
  }
  return rec;
}

// ClientboundRecipeBookAddPacket entries -> book records. Flags are Entry.notification (1)
// and Entry.highlight (2), both verified from the pinned class.
export function nativeRecipeBookEntries(game, entries) {
  const out = [];
  for (const entry of entries || []) {
    const contents = entry?.contents || entry;
    if (!contents?.display) continue;
    const flags = entry?.flags ?? contents.flags ?? 0;
    const rec = nativeRecipeFromDisplay(game, contents.display, { ...contents, flags });
    if (rec) out.push(rec);
  }
  return out;
}
