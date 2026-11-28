import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Items } from '../client/js/game/items.js';
import { Inventory, stackable } from '../client/js/game/container.js';
import { Interaction } from '../client/js/game/interaction.js';
import {
  bundleAdd,
  bundleRemove,
  bundleContents,
  bundleWeight,
  bundleContentWeight,
  bundleBar,
  emptyBundle,
  selectBundleItem,
  isBundleItem
} from '../client/js/game/bundle.js';
import { BUNDLE_NATIVE_774, BUNDLE_NAMES_774 } from '../client/js/game/bundle-data-1.21.11.js';
import { bundleTooltipLayout, drawBundleTooltip } from '../client/js/gui/bundle-tooltip.js';
import { createItemStack774, itemComponentValues774 } from '../client/js/net/item-components-1.21.11.js';

const read = (n) => JSON.parse(readFileSync(new URL('../client/data/' + n + '.json', import.meta.url)));
const data = Object.fromEntries(['items', 'blocks', 'creative', 'enchantments'].map((n) => [n, read(n)]));

function fixture() {
  const sounds = [];
  const packets = [];
  const g = {
    assets: { data, translate: (k, a = []) => k + ':' + a.join(',') },
    heldSlot: 0,
    gameMode: 0,
    player: { creative: false },
    sound: { playAtPlayer: (...a) => sounds.push(a) },
    send: (p) => packets.push(p),
    cooldownFraction: () => 0
  };
  g.items = new Items(g.assets);
  g.inventory = new Inventory(g);
  g.interaction = new Interaction(g);
  const item = (name, count = 1, added = [], removed = []) =>
    createItemStack774(g.items.byName.get(name).id, count, { added, removed });
  return { g, item, sounds, packets };
}

test('all 17 dyed/undyed bundles and component weights (nested bundles, occupied bee nests) follow native 1.21.11 rules', () => {
  const { g, item } = fixture();
  assert.equal(BUNDLE_NAMES_774.length, 17);
  for (const name of BUNDLE_NAMES_774) {
    assert.equal(isBundleItem(item(name), g.items), true, name);
  }
  const fullHive = item('beehive', 1, [{ type: 'bees', data: { bees: [{ entityData: {}, ticksInHive: 0, minTicksInHive: 20 }] } }]);
  assert.equal(bundleWeight(fullHive, g.items), 64);
  const emptyHive = item('beehive', 1);
  assert.equal(bundleWeight(emptyHive, g.items), 1);

  const inner = item('red_bundle');
  assert.equal(bundleAdd(inner, item('stone', 12), g.items, stackable), 12);
  assert.equal(bundleWeight(inner, g.items), 16); // 4 overhead + 12
});

test('right-clicking items into/out of a carried bundle respects capacity and preserves component patches', () => {
  const { g, item } = fixture();
  const inv = g.inventory;
  const bundle = item('bundle');
  inv.cursor = bundle;
  inv.setSlot(36, item('ender_pearl', 20));
  inv.slotClick(36, 0, 0);
  assert.equal(bundleContentWeight(bundle, g.items), 64);
  assert.equal(inv.get(36).count, 4);
  assert.equal(bundleContents(bundle)[0].count, 16);

  const bar = bundleBar(bundle, g.items);
  assert.equal(bar.width, 13);
  assert.equal(bar.color, BUNDLE_NATIVE_774.fullBarColor);

  inv.slotClick(37, 1, 0);
  assert.equal(inv.get(37).count, 16);
  assert.equal(bundleContentWeight(bundle, g.items), 0);

  const custom = item('stone', 5, [{ type: 'custom_model_data', data: { floats: [12], flags: [], strings: [], colors: [] } }]);
  inv.setSlot(36, custom);
  inv.slotClick(36, 0, 0);
  assert.equal(inv.get(36), null);
  const out = bundleRemove(bundle);
  assert.ok(stackable(out, custom));
  assert.deepEqual(itemComponentValues774(out).custom_model_data, { floats: [12], flags: [], strings: [], colors: [] });
});

test('bundle in slot accepts cursor stack, supports 1.21.11 selected item extraction, and blocks shulkers', () => {
  const { g, item } = fixture();
  const inv = g.inventory;
  const b = item('blue_bundle');
  inv.setSlot(36, b);
  inv.cursor = item('stone', 40);
  inv.slotClick(36, 0, 0);
  assert.equal(inv.cursor, null);
  assert.equal(bundleContentWeight(b, g.items), 40);
  inv.slotClick(36, 1, 0);
  assert.equal(inv.cursor.count, 40);
  assert.equal(bundleContentWeight(b, g.items), 0);

  const b2 = item('bundle');
  assert.equal(bundleAdd(b2, item('dirt', 2), g.items, stackable), 2);
  assert.equal(bundleAdd(b2, item('stone', 3), g.items, stackable), 3);
  assert.equal(selectBundleItem(b2, 1), 1);
  const picked = bundleRemove(b2);
  assert.equal(g.items.name(picked.id), 'dirt');

  assert.equal(bundleAdd(b2, item('shulker_box'), g.items, stackable), 0);
  assert.equal(bundleAdd(b2, item('red_shulker_box'), g.items, stackable), 0);
});

test('bundle tooltip renders 1.21.11 4-column grid, 96px progressbar sprites, and bundle use empties contents', () => {
  const { g, item, packets, sounds } = fixture();
  const b = item('bundle');
  g.inventory.main[0] = b;
  bundleAdd(b, item('stone', 12), g.items, stackable);
  const lines = g.items.tooltip(b);
  assert.equal(lines.bundleTooltip.items.length, 1);
  assert.deepEqual(bundleTooltipLayout(lines.bundleTooltip), { empty: false, columns: 4, rows: 1, width: 96, height: 45 });

  const sprites = [];
  const icons = [];
  drawBundleTooltip(
    {
      sprite: (...a) => sprites.push(a),
      text() {},
      textCentered() {},
      game: { itemRenderer: { drawItem: (...a) => icons.push(a) } }
    },
    lines.bundleTooltip,
    0,
    0
  );
  assert.equal(icons.length, 1);
  assert.deepEqual(
    sprites.map((s) => s[0]),
    ['container/bundle/slot_background', 'container/bundle/bundle_progressbar_fill', 'container/bundle/bundle_progressbar_border']
  );
  for (const sp of [
    'slot_background',
    'slot_highlight_back',
    'slot_highlight_front',
    'bundle_progressbar_fill',
    'bundle_progressbar_full',
    'bundle_progressbar_border'
  ]) {
    assert.ok(existsSync(new URL('../client/assets/minecraft/textures/gui/sprites/container/bundle/' + sp + '.png', import.meta.url)), sp);
  }

  assert.equal(g.interaction.sendUseItem(b), true);
  assert.equal(packets.length, 1);
  assert.equal(bundleContentWeight(b, g.items), 0);
  assert.equal(emptyBundle(g, b), false);
  assert.equal(sounds.length, BUNDLE_NATIVE_774.sounds ? 1 : 0);
});
