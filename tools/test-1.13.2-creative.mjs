// node tools/test-1.13.2-creative.mjs
// Offline integration tests: real CreativeScreen, Inventory, Items, ModelStore,
// ItemRenderer.modelFor and protocol404 serialization. Only the GUI drawing surface,
// sound, storage and network transport are recording adapters; no shared JVM edits.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ZipFile } from '../lib/zip.js';
import { extractCreative, formatCreative, JAR_SHA1 } from './creative-dump/extract-1.13.2.mjs';
import { CreativeScreen, creativeTabOf, hotbarSnapshots, handleHotbarSnapshots } from '../client/js/gui/screens/containers.js';
import { Inventory, stackable } from '../client/js/game/container.js';
import { Items } from '../client/js/game/items.js';
import { ItemRenderer } from '../client/js/render/item-renderer.js';
import { ModelStore } from '../client/js/render/models.js';
import { Reader, Writer } from '../client/js/net/buffer.js';
import { nbt } from '../client/js/net/nbt.js';
import { initBlocks } from '../client/js/world/blocks.js';
import { setTranslator as setChatTranslator } from '../client/js/gui/chat.js';
import { setTranslator } from '../client/js/gui/i18n.js';

const readData = name => JSON.parse(readFileSync(new URL('../client/data/' + name + '.json', import.meta.url)));
const data = Object.fromEntries(['items', 'blocks', 'blockCollisionShapes', 'creative', 'foods', 'materials', 'enchantments'].map(n => [n, readData(n)]));
initBlocks(data.blocks, data.blockCollisionShapes);
const jarPath = process.env.MC_JAR || fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url));
const jar = new ZipFile(jarPath), prefix = 'assets/minecraft/';
const lang = JSON.parse(jar.read(prefix + 'lang/en_us.json'));
const models = Object.fromEntries(jar.list(prefix + 'models/').filter(p => p.endsWith('.json'))
  .map(p => [p.slice((prefix + 'models/').length, -5), JSON.parse(jar.read(p))]));
const textureExists = name => jar.has(prefix + 'textures/' + name + '.png');
const atlas = { entries: new Map(), uv: name => textureExists(name) ? [0, 0, 1, 1] : null, hasAlpha: () => false };
const plain = s => s.replace(/§./g, '');
const HOTBARS_KEY = 'minecraftjs.hotbars.1.13.2.v1';
const LEGACY_KEY = 'minecraftjs.hotbars';
const byName = new Map(data.items.map(d => [d.name, d]));
const byId = new Map(data.items.map(d => [d.id, d]));
const stack = (name, tag = null, count = 1) => ({ id: byName.get(name).id, count, damage: 0, nbt: tag });
const tuple = ([id, damage, tag]) => ({ id, damage, count: 1, nbt: tag ? { t: 10, name: '', v: structuredClone(tag) } : null });
const named = name => stack('stone', nbt.compound({ display: nbt.compound({ Name: nbt.string(JSON.stringify({ text: name })) }) }));
const packetStack = it => new Reader(new Writer().slot(it).build()).slot();
const bars = () => Array.from({ length: 9 }, () => Array(9).fill(null));
const envelope = list => ({ version: 1, minecraftVersion: '1.13.2', protocol: 404, dataVersion: 1631, bars: list });
const definitions = [
  ['buildingBlocks', 'bricks', 239, 'Building Blocks'], ['decorations', 'peony', 207, 'Decoration Blocks'],
  ['redstone', 'redstone', 54, 'Redstone'], ['transportation', 'powered_rail', 18, 'Transportation'],
  ['hotbar', 'bookshelf', 0, 'Saved Toolbars'], ['search', 'compass', 1034, 'Search Items'],
  ['misc', 'lava_bucket', 147, 'Miscellaneous'], ['food', 'apple', 35, 'Foodstuffs'],
  ['tools', 'iron_axe', 35, 'Tools'], ['combat', 'golden_sword', 99, 'Combat'],
  ['brewing', 'potion', 138, 'Brewing'], ['inventory', 'chest', 0, 'Survival Inventory'],
];

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k, v) { this.values.set(k, String(v)); }
}

function makeGame(creative = data.creative, storage = new MemoryStorage()) {
  globalThis.localStorage = storage;
  const records = { items: [], text: [], tooltips: [], blits: [], sounds: [], sent: [], actionBars: [] };
  const assets = {
    data: { ...data, creative }, lang: { ...lang }, atlas, modelStore: new ModelStore(models, {}, atlas),
    translate(key, args = []) {
      let next = 0;
      return (this.lang[key] ?? key).replace(/%(?:(\d+)\$)?s/g, (_, i) => String(args[i ? Number(i) - 1 : next++] ?? ''));
    },
  };
  setTranslator((key, args) => assets.translate(key, args));
  setChatTranslator((key, args) => assets.translate(key, args));
  const gui = {
    width: 640, height: 480,
    font: { width: s => s.length * 6, trimToWidth: (s, w) => s.slice(0, Math.max(0, Math.floor(w / 6))) },
    worldBackground() {}, rect() {}, pushMatrix() {}, popMatrix() {}, translate() {}, setBlend() {},
    blit(path, ...args) { assert.ok(jar.has(prefix + 'textures/' + path), 'jar GUI texture: ' + path); records.blits.push([path, ...args]); },
    text: (...args) => records.text.push(args), tooltip: lines => records.tooltips.push(lines),
  };
  const game = {
    assets, gui, records, storage, items: new Items(assets), heldSlot: 0, effects: new Map(),
    player: { creative: true, usingItem: false }, interaction: { useTicks: 0 },
    settings: { advancedItemTooltips: true, keys: { inventory: 'KeyE', chat: 'KeyT', saveToolbarActivator: 'KeyC', loadToolbarActivator: 'KeyX',
      ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['hotbar' + (i + 1), 'Digit' + (i + 1)])) },
      keyName: code => code.replace(/^(Key|Digit)/, ''),
    },
    send: p => records.sent.push(p), sound: { playUi: (...args) => records.sounds.push(args) },
    hud: { setActionBar: text => records.actionBars.push(text) }, tutorial: { handleSetSlot() {} },
    entityRenderer: { drawPlayerInGui() {} }, device: { destroyMesh() {} },
    screens: { current: null, _mouse: () => game.mouse }, mouse: [0, 0],
  };
  game.inventory = new Inventory(game);
  game.renderer = new ItemRenderer(game);
  game.itemRenderer = {
    drawItem(gui, it, x, y, overlay) {
      records.items.push({ it, x, y, overlay, model: game.renderer.modelFor(it) });
    },
    drawSprite() {},
  };
  CreativeScreen.lastTab = 0;
  game.screen = new CreativeScreen(game);
  game.screens.current = game.screen;
  game.screen.init();
  return game;
}

function chooseTab(g, label) {
  const t = g.assets.data.creative.tabs.find(t => t.label === label);
  assert.ok(t, 'tab ' + label);
  const r = g.screen._tabRect(t);
  g.screen.mouseDown(r.x + 14, r.y + 16, 0, {});
  assert.equal(g.screen.tab, t.index, 'real tab click: ' + label);
  return t;
}
function pointFor(g, predicate) {
  const screen = g.screen, index = screen.list.findIndex(it => it && predicate(it));
  assert.ok(index >= 0, 'item present in ' + screen.tabLabel());
  const row = Math.floor(index / 9), max = screen.maxScrollRows(), first = Math.min(row, max);
  screen.scroll = max ? first / max : 0;
  g.mouse = [screen.guiLeft + 10 + index % 9 * 18, screen.guiTop + 19 + (row - first) * 18];
  assert.equal(screen.gridItemAt(...g.mouse).idx, index);
  return g.mouse;
}
function slotPoint(g, slot) {
  const p = g.screen.slotPos.find(p => p[0] === slot);
  assert.ok(p, 'visible slot ' + slot);
  return g.mouse = [g.screen.guiLeft + p[1] + 1, g.screen.guiTop + p[2] + 1];
}
function search(g, text) {
  chooseTab(g, 'search');
  g.screen.search.setText('');
  for (const ch of text) assert.equal(g.screen.char(ch), true);
  assert.equal(g.screen.search.text, text);
  return g.screen.list;
}
function sentCreative(g) {
  return g.records.sent.map(bytes => {
    const r = new Reader(bytes);
    assert.equal(r.varint(), 0x24, 'actual native creative_inventory_action packet');
    const slot = r.i16(), item = r.slot();
    assert.equal(r.remaining(), 0);
    return { slot, item };
  });
}

test('every tab, icon, ordered stack and metadata table reproduces from the SHA1-pinned 1.13.2 jar', () => {
  const extracted = extractCreative(jarPath);
  assert.deepEqual(data.creative, extracted);
  assert.equal(readFileSync(new URL('../client/data/creative.json', import.meta.url), 'utf8'), formatCreative(extracted));
  assert.equal(extracted.source.clientJarSha1, JAR_SHA1);
  assert.deepEqual([extracted.version, extracted.protocol, extracted.dataVersion], ['1.13.2', 404, 1631]);
  for (const [i, [label, icon, count]] of definitions.entries()) {
    const t = extracted.tabs[i];
    assert.equal(t.index, i); assert.equal(t.label, label); assert.equal(t.items.length, count);
    assert.equal(byId.get(t.icon[0]).name, icon);
    assert.equal(t.column, i % 6); assert.equal(t.top, i < 6);
    assert.equal(t.right, [4, 5, 11].includes(i));
    assert.equal(t.background, i === 5 ? 'item_search.png' : i === 11 ? 'inventory.png' : 'items.png');
    assert.equal(t.title, i !== 11); assert.equal(t.scrollbar, i !== 11);
    assert.equal(new Set(t.items.map(s => JSON.stringify(s))).size, t.items.length, label + ': no duplicate variants');
    for (let j = 1; j < t.items.length; j++) assert.ok(t.items[j][0] >= t.items[j - 1][0], label + ': registry order');
  }
  assert.deepEqual(extracted.tabs[10].icon[2], { Potion: { t: 8, v: 'minecraft:water' } });
});

test('flattened families, aquatic additions, exclusions and vanilla category choices are preserved', () => {
  const g = makeGame();
  const check = (group, names) => {
    const t = chooseTab(g, group), ids = new Set(t.items.map(s => s[0]));
    for (const name of names.split(' ')) {
      assert.ok(ids.has(byName.get(name).id), group + ': ' + name);
      assert.equal(creativeTabOf(g, byName.get(name).id), group);
    }
  };
  check('buildingBlocks', 'granite polished_granite cut_sandstone red_wool stripped_oak_log blue_ice dried_kelp_block tube_coral_block');
  check('decorations', 'peony seagrass sea_pickle tube_coral tube_coral_fan red_bed light_gray_banner shulker_box damaged_anvil');
  check('redstone', 'oak_button birch_pressure_plate spruce_trapdoor dark_oak_door redstone');
  check('transportation', 'powered_rail elytra dark_oak_boat');
  check('misc', 'dolphin_spawn_egg drowned_spawn_egg phantom_spawn_egg scute nautilus_shell heart_of_the_sea chorus_fruit kelp turtle_egg conduit');
  check('food', 'cod salmon tropical_fish pufferfish cooked_cod cooked_salmon enchanted_golden_apple dried_kelp');
  check('tools', 'iron_axe diamond_pickaxe shears');
  check('combat', 'trident turtle_helmet shield');
  check('brewing', 'phantom_membrane golden_carrot');
  const searchIds = new Set(data.creative.tabs[5].items.map(s => s[0]));
  for (const name of ['barrier', 'command_block', 'chain_command_block', 'repeating_command_block', 'command_block_minecart',
    'structure_block', 'structure_void', 'debug_stick', 'knowledge_book', 'spawner', 'filled_map', 'written_book', 'dragon_egg']) {
    assert.equal(searchIds.has(byName.get(name).id), false, name + ': not offered by vanilla creative');
  }
});

test('all catalog entries and icons resolve native IDs, translated names and real jar model names/textures', () => {
  const g = makeGame();
  for (const t of data.creative.tabs) for (const raw of [t.icon, ...t.items]) {
    const it = tuple(raw), def = g.items.def(it.id);
    assert.ok(def, `${t.label}: native ID ${it.id}`); assert.equal(raw[1], 0);
    assert.ok(jar.has(prefix + 'models/item/' + def.name + '.json'));
    const model = g.renderer.modelFor(it);
    assert.notEqual(model.name, 'missing');
    assert.ok(model.name === def.name || ['clock', 'compass'].includes(def.name) && model.name.startsWith(def.name + '_'), def.name + ': model name');
    for (const texture of model.layers || model.baked?.quads.map(q => q.tex) || []) assert.ok(textureExists(texture), def.name + ': ' + texture);
    if (model.kind === 'block') assert.ok(model.baked.quads.length > 0, def.name + ': baked geometry');
    const name = plain(g.items.displayName(it));
    assert.ok(name && !/^(Unknown|(?:item|block)\.minecraft\.)/.test(name), def.name + ': ' + name);
    assert.ok(stackable(it, packetStack(it)), def.name + ': lossless NBT/wire identity');
  }
});

test('potion/arrow/book variants and retained potion/effect/egg consumers use 1.13.2 semantics', () => {
  const g = makeGame(), all = data.creative.tabs[5].items.map(tuple);
  assert.equal(Object.keys(data.creative.potions).length, 43);
  const potionKeys = Object.keys(data.creative.potions).filter(k => k !== 'minecraft:empty');
  for (const name of ['potion', 'splash_potion', 'lingering_potion', 'tipped_arrow']) {
    const variants = all.filter(it => g.items.name(it.id) === name);
    const expected = name === 'tipped_arrow' ? potionKeys.filter(k => data.creative.potions[k].effects.length) : potionKeys;
    assert.deepEqual(variants.map(it => g.items.nbt(it).Potion), expected, name + ': vanilla variant order');
  }
  assert.deepEqual(data.creative.potions['minecraft:strong_turtle_master'].effects, [[2, 400, 5], [11, 400, 3]]);
  assert.deepEqual(data.creative.potions['minecraft:strong_slowness'].effects, [[2, 400, 3]]);
  assert.deepEqual(data.creative.effects[5].modifiers, [['generic.attackDamage', 3, 0]]);
  assert.deepEqual(data.creative.effects[18].modifiers, [['generic.attackDamage', -4, 0]]);
  for (const e of Object.values(data.creative.effects)) assert.ok(lang[e.name], 'native effect translation ' + e.name);
  const eggs = all.filter(it => g.items.name(it.id).endsWith('_spawn_egg'));
  assert.equal(eggs.length, 51);
  for (const egg of eggs) {
    assert.equal(egg.nbt, null, 'native egg has no legacy EntityTag variant');
    assert.deepEqual(g.items.eggInfo(egg).slice(0, 2), data.creative.eggs[g.items.eggEntity(egg)].slice(0, 2));
  }
  const books = all.filter(it => g.items.name(it.id) === 'enchanted_book');
  assert.equal(books.length, 99);
  const levels = new Map();
  for (const book of books) {
    const e = book.nbt.v.StoredEnchantments.v.items[0];
    assert.equal(e.id.t, 8); assert.match(e.id.v, /^minecraft:/); assert.equal(e.lvl.t, 2);
    (levels.get(e.id.v) || levels.set(e.id.v, []).get(e.id.v)).push(e.lvl.v);
    assert.ok(g.items.enchantments(book).length === 1);
  }
  assert.equal(levels.size, 34);
  for (const [name, ls] of levels) assert.deepEqual(ls, Array.from({ length: ls.length }, (_, i) => i + 1), name + ': every search level in ascending order');
  assert.deepEqual(levels.get('minecraft:impaling'), [1, 2, 3, 4, 5]);
  for (const t of data.creative.tabs.filter(t => ['combat', 'tools'].includes(t.label))) for (const it of t.items) {
    const e = it[2]?.StoredEnchantments?.v.items[0];
    if (e) assert.equal(e.lvl.v, levels.get(e.id.v).at(-1), t.label + ': category books are maximum level');
  }
});

test('real tab clicks render every native icon, title, tooltip and layout at vanilla positions', () => {
  const g = makeGame(), s = g.screen;
  const xs = [0, 29, 58, 87, 139, 167, 0, 29, 58, 87, 116, 167];
  for (const [i, [label, icon, count, title]] of definitions.entries()) {
    const t = chooseTab(g, label), r = s._tabRect(t);
    assert.equal(r.x - s.guiLeft, xs[i]);
    assert.equal(r.y - s.guiTop, i < 6 ? -28 : 132);
    assert.equal(s.list.length, label === 'hotbar' ? 81 : count);
    assert.equal(s.scroll, 0); assert.equal(s.fields.length, label === 'search' ? 1 : 0);
    assert.equal(s.slotPos.length, label === 'inventory' ? 41 : 9);
    g.records.items.length = g.records.text.length = g.records.tooltips.length = 0;
    s.render(g.gui, r.x + 14, r.y + 16, 0);
    for (const other of data.creative.tabs) {
      const p = s._tabRect(other);
      const rendered = g.records.items.find(d => d.x === p.x + 6 && d.y === p.y + 8 + (p.top ? 1 : -1));
      assert.ok(rendered, 'rendered icon ' + other.label);
      assert.equal(rendered.it.id, other.icon[0]);
      assert.ok(stackable(rendered.it, tuple(other.icon)));
    }
    if (t.title) assert.ok(g.records.text.some(([text, x, y]) => text === title && x === s.guiLeft + 8 && y === s.guiTop + 6), title + ': ' + JSON.stringify(g.records.text));
    assert.deepEqual(g.records.tooltips.at(-1), [title]);
    assert.equal(g.items.name(t.icon[0]), icon);
    if (label === 'inventory') assert.deepEqual(s.slotPos.find(p => p[0] === 45), [45, 35, 20]);
  }
});

test('actual search typing, translated variant tooltips, namespace lookup and hotbar number packets', () => {
  const g = makeGame(), s = g.screen;
  s.key({ code: 'KeyT' }); s.char('t');
  assert.equal(s.tabLabel(), 'search'); assert.equal(s.search.text, '', 'opening chat key is not inserted');
  assert.equal(s.search.maxLength, 50);
  let result = search(g, 'minecraft:heart_of_the_sea');
  assert.equal(result.length, 1); assert.equal(g.items.name(result[0].id), 'heart_of_the_sea');
  pointFor(g, () => true);
  s.key({ code: 'Digit3' }); s.char('3');
  assert.equal(s.search.text, 'minecraft:heart_of_the_sea');
  const [packet] = sentCreative(g);
  assert.equal(packet.slot, 38); assert.equal(packet.item.id, 789); assert.equal(packet.item.count, 64);
  assert.equal(g.inventory.get(38).id, 789);
  result = search(g, 'loyalty iii');
  assert.equal(result.length, 1); assert.equal(g.items.enchantments(result[0])[0].id, 'minecraft:loyalty');
  pointFor(g, () => true); s.render(g.gui, ...g.mouse, 0);
  assert.ok(g.records.tooltips.at(-1).map(plain).includes('Combat'));
  assert.ok(g.records.tooltips.at(-1).map(plain).includes('Loyalty III'));
  result = search(g, 'minecraft:slow falling');
  assert.equal(result.length, 8, 'normal/long potions, splash, lingering and arrows');
  assert.ok(result.every(it => g.items.potionType(it).name === 'slow_falling'));
  assert.equal(search(g, 'othernamespace:stone').length, 0);
  assert.equal(search(g, 'there-is-no-such-item').length, 0);
  assert.equal(s.maxScrollRows(), 0); assert.equal(s.scroll, 0);
  assert.equal(search(g, '').length, 1034);
  s.wheel(10); assert.ok(s.scroll > 0);
  s.char('trident'); assert.equal(s.scroll, 0); assert.equal(s.list.length, 1);
});

test('grid selection and outbound slot/drop packets preserve native variants and deep-copy NBT', () => {
  const g = makeGame(), s = g.screen;
  for (const name of ['polished_granite', 'red_wool', 'light_gray_banner', 'turtle_egg', 'dolphin_spawn_egg', 'trident', 'dried_kelp']) {
    chooseTab(g, creativeTabOf(g, byName.get(name).id));
    const p = pointFor(g, it => g.items.name(it.id) === name);
    s.mouseDown(...p, 0, {});
    assert.equal(g.inventory.cursor.id, byName.get(name).id);
    s.mouseDown(...slotPoint(g, 36), 0, {});
    assert.equal(g.inventory.get(36).id, byName.get(name).id);
    assert.equal(sentCreative(g).at(-1).item.id, byName.get(name).id);
    g.inventory.setSlot(36, null); g.inventory.cursor = null;
  }
  search(g, 'minecraft:long_turtle_master'); // registry-name search uses the item name, not raw potion NBT
  assert.equal(s.list.length, 0);
  search(g, 'turtle master');
  const p = pointFor(g, it => g.items.name(it.id) === 'potion' && g.items.nbt(it).Potion === 'minecraft:long_turtle_master');
  const template = s.gridItemAt(...p).item;
  s.mouseDown(...p, 0, {});
  assert.notEqual(g.inventory.cursor.nbt, template.nbt);
  g.inventory.cursor.nbt.v.Potion.v = 'minecraft:water';
  assert.equal(template.nbt.v.Potion.v, 'minecraft:long_turtle_master');
  g.inventory.cursor = null;
  s.mouseDown(...p, 0, {});
  g.records.sent.length = 0;
  s.mouseDown(s.guiLeft - 40, s.guiTop + 50, 0, {});
  assert.equal(sentCreative(g)[0].slot, -1);
  assert.equal(g.items.nbt(sentCreative(g)[0].item).Potion, 'minecraft:long_turtle_master');
});

test('all 1,034 search stacks can actually be selected into the hotbar and sent with their exact NBT', () => {
  const g = makeGame(), s = g.screen;
  chooseTab(g, 'search');
  assert.equal(new Set(s.list.map(it => it.id)).size, 776, '13 registered command-only/noncreative items are excluded');
  for (const template of s.list) {
    pointFor(g, it => it === template);
    g.records.sent.length = 0;
    s.key({ code: 'Digit1' }); s.char('1');
    const [p] = sentCreative(g), selected = g.inventory.main[0];
    assert.equal(p.slot, 36);
    assert.ok(stackable(template, p.item), g.items.displayName(template) + ': selected packet identity');
    assert.equal(p.item.count, g.items.maxStack(template.id));
    assert.ok(stackable(template, selected));
    if (template.nbt) assert.notEqual(template.nbt, selected.nbt, 'selected template is deep copied');
    assert.equal(s.search.text, '');
  }
});

test('NBT-aware creative grid merging distinguishes arrows, book levels, names and empty cells', () => {
  const g = makeGame(), s = g.screen;
  chooseTab(g, 'combat');
  const arrows = s.list.filter(it => g.items.name(it.id) === 'tipped_arrow');
  const p = pointFor(g, it => it === arrows[0]);
  s.mouseDown(...p, 0, {}); s.mouseDown(...p, 0, {});
  assert.equal(g.inventory.cursor.count, 2);
  const other = pointFor(g, it => it === arrows[1]);
  s.mouseDown(...other, 2, {});
  assert.equal(g.inventory.cursor.count, 1);
  assert.equal(g.items.nbt(g.inventory.cursor).Potion, g.items.nbt(arrows[0]).Potion);
  s.mouseDown(...other, 0, {});
  assert.equal(g.inventory.cursor, null, 'different NBT must not merge');
  s.mouseDown(...other, 0, { shift: true }); assert.equal(g.inventory.cursor.count, 64);
  s.mouseDown(...other, 2, {}); assert.equal(g.inventory.cursor.count, 63);
  g.inventory.cursor = null;
  s.mouseDown(...other, 1, {}); assert.equal(g.inventory.cursor.count, 64, 'middle-click clone');
  g.inventory.cursor = null;
  search(g, 'loyalty');
  const level1 = pointFor(g, it => g.items.enchantments(it)[0]?.lvl === 1);
  s.mouseDown(...level1, 0, {});
  s.mouseDown(...pointFor(g, it => g.items.enchantments(it)[0]?.lvl === 2), 0, {});
  assert.equal(g.inventory.cursor, null, 'different enchanted-book levels remain distinct');
  search(g, 'stone');
  g.inventory.cursor = named('Named');
  s.mouseDown(...pointFor(g, it => g.items.name(it.id) === 'stone'), 0, {});
  assert.equal(g.inventory.cursor, null, 'custom names are part of identity');
  search(g, 'trident');
  g.inventory.cursor = { ...named('Empty cell'), count: 3 };
  const empty = [s.guiLeft + 10 + 18, s.guiTop + 19];
  assert.equal(s.gridItemAt(...empty).item, null);
  s.mouseDown(...empty, 2, {}); assert.equal(g.inventory.cursor.count, 2);
  s.mouseDown(...empty, 0, {}); assert.equal(g.inventory.cursor, null);
});

test('inventory NBT-only replacement, splitting, offhand (46th slot) and number swaps synchronize', () => {
  const g = makeGame(), s = g.screen, inv = g.inventory;
  chooseTab(g, 'inventory');
  assert.equal(inv.slots.length, 46);
  inv.setSlot(36, named('A')); inv.cursor = named('B');
  s.mouseDown(...slotPoint(g, 36), 0, {});
  let packets = sentCreative(g);
  assert.equal(packets.length, 1); assert.equal(packets[0].slot, 36);
  assert.equal(g.items.displayName(packets[0].item), 'B'); assert.equal(g.items.displayName(inv.cursor), 'A');
  inv.cursor = { ...named('Offhand'), count: 3 }; g.records.sent.length = 0;
  s.mouseDown(...slotPoint(g, 45), 2, {});
  assert.equal(inv.offhand.count, 1); assert.equal(inv.cursor.count, 2);
  assert.notEqual(inv.offhand.nbt, inv.cursor.nbt, 'split tags are independent');
  inv.cursor.nbt.v.display.v.Name.v = '"Changed cursor"';
  assert.equal(g.items.displayName(inv.offhand), 'Offhand');
  assert.equal(sentCreative(g)[0].slot, 45);
  inv.cursor = null; g.records.sent.length = 0;
  slotPoint(g, 45); s.key({ code: 'Digit1' });
  packets = sentCreative(g);
  assert.deepEqual(packets.map(p => p.slot), [36, 45]);
  assert.equal(g.items.displayName(inv.get(36)), 'Offhand'); assert.equal(g.items.displayName(inv.offhand), 'B');
  g.records.sent.length = 0;
  s.mouseDown(...slotPoint(g, 45), 0, { shift: true });
  assert.equal(inv.offhand, null); assert.equal(g.items.displayName(inv.get(9)), 'B');
  assert.deepEqual(sentCreative(g).map(p => p.slot), [9, 45]);
  inv.offhand = stack('trident'); inv.cursor = stack('diamond'); g.records.sent.length = 0;
  s.mouseDown(s.guiLeft + 174, s.guiTop + 113, 0, { shift: true });
  assert.ok(inv.slots.every((_, i) => inv.get(i) === null)); assert.equal(inv.cursor, null);
  assert.ok(sentCreative(g).some(p => p.slot === 45 && p.item === null), 'destroy includes offhand');
  inv.setSlot(5, stack('turtle_helmet')); inv.main[0] = stack('stone');
  g.records.sent.length = 0; slotPoint(g, 5); s.key({ code: 'Digit1' });
  assert.equal(g.items.name(inv.get(5).id), 'turtle_helmet'); assert.equal(g.records.sent.length, 0);
  inv.main[0] = null; s.key({ code: 'Digit1' });
  assert.equal(inv.get(5), null); assert.equal(g.items.name(inv.main[0].id), 'turtle_helmet');
});

test('hotbar hints are native locked paper with JSON names and correct key argument order', () => {
  const g = makeGame(), s = g.screen;
  chooseTab(g, 'hotbar');
  for (let i = 0; i < 9; i++) {
    const hint = s.list[i * 10];
    assert.equal(g.items.name(hint.id), 'paper'); assert.equal(hint.id, byName.get('paper').id);
    assert.deepEqual(JSON.parse(hint.nbt.v.display.v.Name.v), { translate: 'inventory.hotbarInfo', with: [String(i + 1), 'C'] });
    assert.equal(plain(g.items.displayName(hint)), g.assets.translate('inventory.hotbarInfo', [String(i + 1), 'C']));
    const p = pointFor(g, it => it === hint);
    for (const button of [0, 1, 2]) { s.mouseDown(...p, button, { shift: true }); assert.equal(g.inventory.cursor, null); }
    s.key({ code: 'Digit2' }); assert.equal(g.inventory.main[1], null);
    delete hint.locked;
    s.mouseDown(...p, 0, {}); assert.equal(g.inventory.cursor, null, 'NBT lock alone is sufficient');
  }
  assert.equal(g.records.sent.length, 0);
});

test('versioned hotbars retain typed NBT/raw-only stacks and never read or overwrite legacy saves', () => {
  const g = makeGame(), inv = g.inventory;
  const legacy = bars(); legacy[0][0] = { id: 339, damage: 0, count: 64, nbt: null };
  const original = JSON.stringify(legacy);
  g.storage.setItem(LEGACY_KEY, original);
  assert.deepEqual(hotbarSnapshots(), bars());
  const complex = stack('trident', nbt.compound({ Damage: nbt.int(7), display: nbt.compound({ Name: nbt.string('"Ocean fork"') }),
    bytes: { t: 7, v: Int8Array.of(-1, 2) }, ints: { t: 11, v: Int32Array.of(-7, 65536) },
    longs: { t: 12, v: BigInt64Array.of(9007199254740993n, -4n) }, long: { t: 4, v: 9007199254740995n },
    Enchantments: nbt.list(10, [{ id: nbt.string('minecraft:loyalty'), lvl: nbt.short(3) }]),
  }));
  inv.main[0] = packetStack(complex);
  inv.main[0].nbt.v.Damage.v = 11; // structured edits take precedence over a stale wire copy
  const rawOnly = packetStack(named('Raw only')); rawOnly.nbt = null;
  inv.main[1] = rawOnly; inv.main[8] = stack('heart_of_the_sea', null, 23);
  handleHotbarSnapshots(g, 2, false, true);
  assert.equal(g.storage.getItem(LEGACY_KEY), original);
  assert.equal(g.records.actionBars[0], g.assets.translate('inventory.hotbarSaved', ['3', 'X']));
  assert.equal(JSON.parse(g.storage.getItem(HOTBARS_KEY)).protocol, 404);
  const saved = hotbarSnapshots()[2][0];
  assert.equal(saved.nbt.v.Damage.v, 11); assert.equal(saved.nbt.v.long.v, 9007199254740995n);
  assert.ok(saved.nbt.v.longs.v instanceof BigInt64Array); assert.ok(saved.nbt.v.bytes.v instanceof Int8Array);
  inv.main[0].nbt.v.Damage.v = 99;
  handleHotbarSnapshots(g, 2, true, false);
  const packets = sentCreative(g);
  assert.deepEqual(packets.map(p => p.slot), [36, 37, 38, 39, 40, 41, 42, 43, 44]);
  assert.equal(g.items.damage(packets[0].item), 11);
  assert.equal(g.items.displayName(packets[1].item), 'Raw only');
  assert.equal(packets[8].item.id, 789); assert.equal(packets[8].item.count, 23);
  assert.ok(stackable(saved, packets[0].item));
  inv.main[0].nbt.v.Damage.v = 123;
  assert.equal(hotbarSnapshots()[2][0].nbt.v.Damage.v, 11, 'loaded tags cannot mutate persisted snapshot');
  chooseTab(g, 'hotbar');
  assert.equal(g.screen.list[18].nbt.v.Damage.v, 11);
  inv.main[0] = stack('diamond');
  handleHotbarSnapshots(g, 2, false, true);
  assert.equal(g.items.name(g.screen.list[18].id), 'diamond', 'open saved-hotbar tab refreshes after save');
  assert.equal(g.storage.getItem(LEGACY_KEY), original);
});

test('incompatible/malformed saved hotbars fail closed and storage failures do not claim success', () => {
  const g = makeGame();
  for (const value of ['{', 'null', JSON.stringify(bars()), JSON.stringify({ ...envelope(bars()), protocol: 340 }),
    JSON.stringify({ ...envelope(bars()), minecraftVersion: '1.12.2' }), JSON.stringify({ ...envelope(bars()), version: 2 })]) {
    g.storage.setItem(HOTBARS_KEY, value);
    assert.deepEqual(hotbarSnapshots(), bars());
    assert.equal(g.storage.getItem(HOTBARS_KEY), value, 'reads do not destructively rewrite incompatible data');
  }
  const saved = bars(); saved[0] = null; saved[1][0] = stack('diamond'); saved[1][1] = { id: 790, count: 1 };
  saved[1][2] = { id: 1, count: 0 }; saved[1][3] = { id: 1, count: 128 };
  g.storage.setItem(HOTBARS_KEY, JSON.stringify(envelope(saved)));
  assert.equal(hotbarSnapshots()[1][0].id, byName.get('diamond').id);
  assert.ok(hotbarSnapshots()[0].every(it => !it)); assert.ok(hotbarSnapshots()[1].slice(1).every(it => !it));
  globalThis.localStorage = { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(hotbarSnapshots(), bars());
  handleHotbarSnapshots(g, 0, false, true);
  assert.equal(g.records.actionBars.length, 0);
  handleHotbarSnapshots(g, -1, true, false); handleHotbarSnapshots(g, 9, false, true);
  assert.equal(g.records.sent.length, 0);
});

test('catalog/category caches are asset-scoped and open search responds to data, language and model reloads', () => {
  const original = makeGame();
  assert.equal(creativeTabOf(original, byName.get('stone').id), 'buildingBlocks');
  const changed = structuredClone(data.creative), stone = changed.tabs[0].items.shift();
  changed.tabs[1].items.unshift(stone);
  const g = makeGame(changed), s = g.screen;
  assert.equal(creativeTabOf(g, stone[0]), 'decorations');
  assert.equal(creativeTabOf(original, stone[0]), 'buildingBlocks', 'no cross-game static cache');
  search(g, 'trident'); assert.equal(s.list.length, 1);
  const replacement = structuredClone(changed);
  replacement.tabs[5].items = replacement.tabs[5].items.filter(it => it[0] !== byName.get('trident').id);
  g.assets.data.creative = replacement;
  s.tick(); assert.equal(s.search.text, 'trident'); assert.equal(s.list.length, 0);
  replacement.tabs = structuredClone(data.creative.tabs);
  s.tick(); assert.equal(s.list.length, 1, 'replacement tabs array invalidates cache');
  assert.equal(creativeTabOf(g, stone[0]), 'buildingBlocks');
  search(g, 'ocean fork'); assert.equal(s.list.length, 0);
  g.assets.lang = { ...g.assets.lang, 'item.minecraft.trident': 'Ocean Fork', 'itemGroup.combat': 'Battle Gear' };
  s.render(g.gui, 0, 0, 0);
  assert.equal(s.search.text, 'ocean fork'); assert.equal(s.list.length, 1, 'language reload re-filters existing search');
  pointFor(g, () => true); s.render(g.gui, ...g.mouse, 0);
  assert.ok(g.records.tooltips.at(-1).map(plain).includes('Battle Gear'));
  chooseTab(g, 'combat');
  g.assets.modelStore = new ModelStore({ ...models, 'item/golden_sword': { parent: 'item/generated', textures: { layer0: 'item/diamond' } } }, {}, atlas);
  g.renderer.reset(); g.records.items.length = 0;
  s.render(g.gui, 0, 0, 0);
  const r = s._tabRect(g.assets.data.creative.tabs[9]);
  const icon = g.records.items.find(d => d.x === r.x + 6 && d.y === r.y + 7);
  assert.deepEqual(icon.model.layers, ['item/diamond'], 'tab uses the current resource-pack model');
});
