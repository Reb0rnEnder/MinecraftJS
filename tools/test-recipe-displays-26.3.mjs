import test from 'node:test';
import assert from 'node:assert/strict';
import {C} from '../client/js/net/packets.js';
import {PLAY_SERVERBOUND_26_3 as OUT} from '../client/js/net/protocol-26.3-ids.js';
import {Reader26_3} from '../client/js/net/configuration-26.3.js';
import {RecipeBook} from '../client/js/game/recipebook.js';
import {
  RECIPE_BOOK_CATEGORIES_26_3,
  nativeRecipeBookEntries,
  nativeRecipeFromDisplay,
  nativeSlotStacks
} from '../client/js/game/recipe-displays-26.3.js';

const read = (bytes) => new Reader26_3(bytes);

function gameFixture() {
  return {
    tags: {registries: {items: new Map([
      ['minecraft:planks', [1, 2]],
      ['minecraft:furnace_fuel', [3]]
    ])}},
    hud: {toasts: [], addRecipeToast(recipes) { this.toasts.push(...recipes); }},
    screens: {current: null}
  };
}

function shapedEntry(flags = 0) {
  return {
    contents: {
      id: 7,
      display: {
        type: 'crafting_shaped', width: 2, height: 2,
        ingredients: [
          {type: 'item', item: 1},
          {type: 'empty'},
          {type: 'tag', tag: {tag: 'minecraft:planks'}},
          {type: 'item_stack', stack: {itemId: 4, count: 2, added: [], removed: []}}
        ],
        result: {type: 'item_stack', stack: {itemId: 5, count: 4, added: [], removed: []}},
        craftingStation: {type: 'empty'}
      },
      group: 2,
      category: 0,
      requirements: [{items: [1]}]
    },
    flags
  };
}

test('native 26.3 recipe categories match the pinned registry ids', () => {
  assert.equal(RECIPE_BOOK_CATEGORIES_26_3.length, 13);
  assert.equal(RECIPE_BOOK_CATEGORIES_26_3[0], 'minecraft:crafting_building_blocks');
  assert.equal(RECIPE_BOOK_CATEGORIES_26_3[10], 'minecraft:stonecutter');
  assert.equal(RECIPE_BOOK_CATEGORIES_26_3[12], 'minecraft:campfire');
});

test('shaped displays keep width, empty cells, tags and native ids', () => {
  const game = gameFixture();
  const entry = shapedEntry();
  const rec = nativeRecipeFromDisplay(game, entry.contents.display, entry.contents);
  assert.equal(rec.id, 'native:7');
  assert.equal(rec.displayId, 7);
  assert.equal(rec.type, 'minecraft:crafting_shaped');
  assert.equal(rec.tab, 'buildingBlocks');
  assert.equal(rec.group, 2);
  assert.equal(rec.width, 2);
  assert.equal(rec.height, 2);
  assert.equal(rec.cells.length, 4);
  assert.deepEqual(rec.cells[0].map((s) => s.id), [1]);
  assert.deepEqual(rec.cells[1], []);
  assert.deepEqual(rec.cells[2].map((s) => s.id), [1, 2]);
  assert.equal(rec.cells[3][0].count, 2);
  assert.equal(rec.result.id, 5);
  assert.equal(rec.result.count, 4);
  assert.equal(rec.craftCells.length, 1);
});

test('recipe types follow category and fuel resolves through the item tag', () => {
  const game = gameFixture();
  const base = {
    type: 'furnace',
    ingredient: {type: 'item', item: 1},
    fuel: {type: 'any_fuel'},
    result: {type: 'item', item: 9},
    craftingStation: {type: 'empty'},
    duration: 200,
    experience: 0.1
  };
  assert.equal(nativeRecipeFromDisplay(game, base, {category: 4}).type, 'minecraft:smelting');
  assert.equal(nativeRecipeFromDisplay(game, base, {category: 4}).tab, 'food');
  assert.equal(nativeRecipeFromDisplay(game, base, {category: 8}).type, 'minecraft:blasting');
  assert.equal(nativeRecipeFromDisplay(game, base, {category: 9}).type, 'minecraft:smoking');
  assert.equal(nativeRecipeFromDisplay(game, base, {category: 12}).type, 'minecraft:campfire_cooking');
  assert.deepEqual(nativeSlotStacks(game, {type: 'any_fuel'}).map((s) => s.id), [3]);
});

test('add-entry flags become highlight and notification metadata', () => {
  const game = gameFixture();
  const recs = nativeRecipeBookEntries(game, [shapedEntry(3)]);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].highlight, true);
  assert.equal(recs[0].notification, true);
  assert.equal(nativeRecipeFromDisplay(game, shapedEntry(0).contents.display, {id: 7}).highlight, false);
});

test('the book rebuilds from the native graph, settings and remove-all', () => {
  const game = gameFixture();
  const entry = shapedEntry(3);
  game.nativeRecipeDisplays = new Map([[7, entry]]);
  const book = new RecipeBook(game);
  book.onNativeAdd([entry]);
  assert.ok(book.known.has('native:7'));
  assert.ok(book.fresh.has('native:7'));
  assert.equal(book.recipes['native:7'].result.id, 5);
  assert.equal(book.lists.buildingBlocks.length, 1);
  assert.equal(book.lists.search.length, 1);
  assert.equal(game.hud.toasts.length, 1);
  book.markSeen(book.recipes['native:7']);
  assert.equal(book.fresh.has('native:7'), false);
  book.onNativeAdd([entry]);
  assert.equal(book.fresh.has('native:7'), false);

  book.onNativeSettings({crafting: {open: true, filtering: true}, furnace: {open: true, filtering: false}, blastFurnace: {open: false, filtering: true}, smoker: {open: true, filtering: true}});
  assert.equal(book.open, true);
  assert.equal(book.filtering, true);
  assert.deepEqual(book.cookingStates.smelting, {open: true, filtering: false});
  assert.deepEqual(book.cookingStates.blasting, {open: false, filtering: true});
  assert.deepEqual(book.cookingStates.smoking, {open: true, filtering: true});

  game.nativeRecipeDisplays.clear();
  book.onNativeRemove();
  assert.equal(Object.keys(book.recipes).length, 0);
  assert.equal(book.lists.search.length, 0);
  assert.equal(book.known.size, 0);
});

test('26.3 place_recipe and seen_recipe send VarInt display ids', () => {
  let r = read(C.placeRecipe(3, 321, true));
  assert.equal(r.varint(), OUT.place_recipe);
  assert.equal(r.varint(), 3);
  assert.equal(r.varint(), 321);
  assert.equal(r.bool(), true);
  assert.equal(r.remaining(), 0);

  r = read(C.recipeInfoShown(321));
  assert.equal(r.varint(), OUT.recipe_book_seen_recipe);
  assert.equal(r.varint(), 321);
  assert.equal(r.remaining(), 0);

  r = read(C.recipeBookSettings(2, true, false));
  assert.equal(r.varint(), OUT.recipe_book_change_settings);
  assert.equal(r.varint(), 2);
  assert.equal(r.bool(), true);
  assert.equal(r.bool(), false);
  assert.equal(r.remaining(), 0);
});
