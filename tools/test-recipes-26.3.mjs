// Native 26.3 local crafting table: shaped, shapeless and tag alternatives.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initRecipes, craftResult} from '../client/js/game/crafting.js';

const items = JSON.parse(readFileSync(new URL('../client/data/items.json', import.meta.url), 'utf8'));
const recipes = JSON.parse(readFileSync(new URL('../client/data/recipes.json', import.meta.url), 'utf8'));
const ids = new Map(items.map(item => [item.name, item.id]));
const id = name => {
  const value = ids.get(name);
  assert.notEqual(value, undefined, 'native item exists: ' + name);
  return value;
};

initRecipes(recipes);
const stack = name => ({id: id(name), count: 1, damage: 0});

test('the local table is keyed by native 26.3 result ids', () => {
  assert.ok(Object.keys(recipes).length > 1000);
  assert.ok(recipes[id('acacia_boat')]);
  assert.ok(recipes[id('fire_charge')]);
  const nativeIds = new Set(items.map(item => item.id));
  for (const key of Object.keys(recipes)) assert.ok(nativeIds.has(Number(key)), 'native result id ' + key);
});

test('native shaped recipes keep their pattern and item ids', () => {
  const planks = stack('acacia_planks');
  const grid = [
    planks, null, planks,
    planks, planks, planks,
    null, null, null
  ];
  const result = craftResult(grid, 3, {});
  assert.equal(result.id, id('acacia_boat'));
  assert.equal(result.count, 1);
});

test('native shapeless recipes match tag alternatives', () => {
  const gunpowder = stack('gunpowder'), blaze = stack('blaze_powder');
  for (const fuel of ['coal', 'charcoal']) {
    const result = craftResult([gunpowder, blaze, stack(fuel), null], 2, {});
    assert.equal(result.id, id('fire_charge'), fuel);
    assert.equal(result.count, 3);
  }
});
