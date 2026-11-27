// 26.3 trim component ids, item model selection and palette-generated worn trim textures.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {itemTrim, trimItemModel, trimTextureName, armorTrimTexture} from '../client/js/render/armor-trims-26.3.js';

const item = {id: 1};
const game = {
  items: {
    name: () => 'iron_chestplate',
    component: (_item, name) => name === 'trim' ? {material: 1, pattern: 2} : name === 'equippable' ? {slot: 'chest', assetId: 'minecraft:iron'} : null,
  },
};
test('26.3 trim ids resolve to the material/pattern and native item model', () => {
  const trim = itemTrim(game, item);
  assert.deepEqual([trim.material, trim.pattern, trim.armor], ['iron', 'coast', 'iron']);
  assert.equal(trimItemModel(game, item), 'item/iron_chestplate_iron_trim');
  assert.equal(trimTextureName(game, item, false), 'trims/entity/humanoid/coast');
});
test('worn trims use the equipment override palette and generate a texture', async () => {
  const calls = [];
  const image = (w, h, r, g, b, a) => ({width: w, height: h, data: new Uint8Array([r, g, b, a])});
  const A = {
    version: 1,
    imageAsync: async (path) => path === 'trims/entity/humanoid/coast.png' ? image(1, 1, 10, 20, 30, 255)
      : path === 'palettes/trim_base.png' ? image(1, 1, 10, 20, 30, 255)
      : path === 'palettes/trim/iron_darker.png' ? image(1, 1, 40, 50, 60, 255) : null,
    makeTexture: (key, w, h, data) => { calls.push([key, [...data]]); return {key}; },
  };
  game.assets = A;
  assert.equal(armorTrimTexture(game, 'trims/entity/humanoid/coast', item), null);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1][0], 40);
  assert.ok(armorTrimTexture(game, 'trims/entity/humanoid/coast', item).key.includes('iron_darker'));
});
