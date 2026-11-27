// Native 26.3 SmithingScreen: four slot positions, template kind detection and CyclingSlotBackground.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SMITHING_SLOTS, CyclingSlotBackground, smithingTemplateKind} from '../client/js/gui/screens/smithing-26.3.js';

const game = {items: {name: (id) => ({
  trim: 'minecraft:coast_armor_trim_smithing_template',
  upgrade: 'minecraft:netherite_upgrade_smithing_template',
  other: 'minecraft:iron_ingot',
}[id])}};
test('26.3 smithing slots match SmithingMenu constants', () => {
  assert.deepEqual(SMITHING_SLOTS, [[0, 8, 48], [1, 26, 48], [2, 44, 48], [3, 98, 48]]);
});
test('template kind follows the native template item, not the slot contents order', () => {
  assert.equal(smithingTemplateKind(game, null), null);
  assert.equal(smithingTemplateKind(game, {id: 'trim'}), 'trim');
  assert.equal(smithingTemplateKind(game, {id: 'upgrade'}), 'upgrade');
  assert.equal(smithingTemplateKind(game, {id: 'other'}), null);
});
test('CyclingSlotBackground advances every 30 ticks and cross-fades in 4', () => {
  const c = new CyclingSlotBackground(1);
  c.update(['a', 'b']);
  assert.deepEqual(c.layers(0), [['a', 1]]);
  for (let i = 0; i < 29; i++) c.update(['a', 'b']);
  assert.equal(c.index, 1);
  assert.deepEqual(c.layers(0).map(([s]) => s), ['a', 'b']);
  assert.equal(c.layers(0)[0][1], 1);
  assert.equal(c.layers(0)[1][1], 0);
  for (let i = 0; i < 2; i++) c.update(['a', 'b']);
  assert.equal(c.layers(0)[1][1], 0.5);
});
