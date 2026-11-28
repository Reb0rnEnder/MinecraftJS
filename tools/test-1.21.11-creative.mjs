import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Reader774, Writer774 } from '../client/js/net/configuration-1.21.11.js';
import { nativeCreativeRows774, creativeStack774 } from '../client/js/gui/creative-data-1.21.11.js';
import { creativeRows, CreativeScreen, handleHotbarSnapshots, hotbarSnapshots } from '../client/js/gui/screens/containers.js';

const data = JSON.parse(readFileSync(new URL('../client/data/creative.json', import.meta.url)));
const items = JSON.parse(readFileSync(new URL('../client/data/items.json', import.meta.url)));
const byName = new Map(items.map((i) => [i.name, i.id]));

function game(mask = 0, operator = false) {
  return {
    assets: { data: { creative: data } },
    enabledFeatures: new Set([
      'minecraft:vanilla',
      ...['minecraft:trade_rebalance', 'minecraft:redstone_experiments', 'minecraft:minecart_improvements'].filter((_, i) => mask & (1 << i))
    ]),
    settings: { operatorItemsTab: operator },
    canUseCommandBlock: () => true
  };
}

test('native Creative population has real stable categories and version-correct experiment/operator gates', () => {
  assert.equal(data.version, '1.21.11');
  assert.equal(data.protocol, 774);
  assert.equal(data.dataVersion, 4671);
  assert.equal(data.stackFormat, 'native-components-774');
  assert.equal(data.stacks.length, 1897);
  assert.equal(data.featureCatalogs.length, 8);
  for (let mask = 0; mask < 8; mask++) {
    const rows = nativeCreativeRows774(game(mask));
    const search = rows.find((t) => t.type === 'search');
    const ids = new Set(search.items.map((s) => s[0]));
    for (const name of [
      'cherry_log', 'pale_oak_log', 'wolf_armor', 'armadillo_scute',
      'bundle', 'crafter', 'mace', 'copper_spear', 'copper_golem_statue', 'copper_nautilus_armor'
    ]) {
      assert.ok(ids.has(byName.get(name)), name);
    }
    assert.equal(rows.find((t) => t.label === 'op').items.length, 0);
    assert.ok(creativeRows(game(mask, true)).find((t) => t.label === 'op').items.length > 0);
    assert.equal(rows.find((t) => t.label === 'buildingBlocks').background, 'items.png');
  }
});

test('every native Creative component stack survives the real protocol codec without trailing bytes', () => {
  for (const tuple of data.stacks) {
    const stack = creativeStack774(tuple);
    const bytes = new Writer774().slot(stack).build();
    const r = new Reader774(bytes);
    const decoded = r.slot();
    assert.equal(r.remaining(), 0);
    assert.equal(decoded.id, tuple[0]);
    assert.deepEqual(decoded.componentPatch, stack.componentPatch);
  }
});

test('Creative tab templates and saved/load toolbars preserve components and are owned copies', () => {
  const tuple = data.stacks.find((s) => s[3].added.some((c) => c.type === 'stored_enchantments'));
  const a = creativeStack774(tuple);
  const b = creativeStack774(tuple);
  a.componentPatch.added[0].data.changed = true;
  assert.equal(b.componentPatch.added[0].data.changed, undefined);
  assert.equal(tuple[3].added[0].data.changed, undefined);
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v)
  };
  try {
    const sent = [];
    const g = game();
    g.inventory = { main: [b, ...Array(8).fill(null)], setSlot(i, item) { this.slots ??= {}; this.slots[i] = item; } };
    g.settings.keys = { hotbar1: 'Digit1', loadToolbarActivator: 'KeyX' };
    g.settings.keyName = (v) => v;
    g.hud = { setActionBar() {} };
    g.send = (packet) => sent.push(packet);
    handleHotbarSnapshots(g, 0, false, true);
    const saved = hotbarSnapshots()[0][0];
    assert.deepEqual(saved.componentPatch, b.componentPatch);
    handleHotbarSnapshots(g, 0, true, false);
    assert.equal(sent.length, 9);
    assert.deepEqual(g.inventory.slots[36].componentPatch, b.componentPatch);
    assert.notEqual(g.inventory.slots[36], b);
  } finally {
    delete globalThis.localStorage;
  }
});

test('Creative tabs and scroller render real 1.21.11 sprites, keeping cached icon stacks stable', () => {
  const tab = nativeCreativeRows774(game())[0];
  const drawn = [];
  const icons = [];
  const s = {
    game: { itemRenderer: { drawItem(_gui, stack) { icons.push(stack); } } },
    _tabRect: () => ({ x: 0, y: 0, top: true, col: 0 })
  };
  const gui = { sprite: (name) => drawn.push(name) };
  CreativeScreen.prototype._drawTab.call(s, gui, tab, false);
  CreativeScreen.prototype._drawTab.call(s, gui, tab, true);
  assert.deepEqual(drawn, ['container/creative_inventory/tab_top_unselected_1', 'container/creative_inventory/tab_top_selected_1']);
  assert.equal(icons[0], icons[1]);
});
