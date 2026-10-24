// Run: node tools/test-1.13.2-items.mjs (Node 22+, local MC_JAR or cache/1.13.2.jar).
// Optional explicit data import: node tools/test-1.13.2-items.mjs --import-registry
// Only that flag uses the network/writes data; normal regression checks are offline.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ZipFile } from '../lib/zip.js';
import { Reader, Writer } from '../client/js/net/buffer.js';
import { decodePacket, C, PROTOCOL_VERSION } from '../client/js/net/packets.js';
import { nbt } from '../client/js/net/nbt.js';
import { Items } from '../client/js/game/items.js';
import { ItemRenderer } from '../client/js/render/item-renderer.js';
import { ModelStore } from '../client/js/render/models.js';
import { Atlas } from '../client/js/render/atlas.js';
import { decodePng } from '../client/js/util/png.js';
import { initBlocks, blocksByName } from '../client/js/world/blocks.js';
import { setTranslator } from '../client/js/gui/chat.js';
import { Inventory, ContainerWindow, armorType, stackable, copy } from '../client/js/game/container.js';
import { initRecipes } from '../client/js/game/crafting.js';
import { Game } from '../client/js/game/game.js';
import { ContainerScreen } from '../client/js/gui/screens/containers.js';
import { setModelDevice } from '../client/js/render/boxmodel.js';
import { setJarModels } from '../client/js/render/entity-models.js';
import { extractModels } from '../lib/modelextract.js';
import { parseClass } from '../lib/classfile.js';
import { walk } from '../lib/bytecode.js';

const COMMIT = '6b8fa82ecd933101be155dac89ad48c3cb144ec9';
const ITEMS_SHA256 = '9282b71d45df8fcd3317e47d1cc9f7a6108097eefca002897fe60c4b395b3616';
const dataUrl = new URL('../client/data/items.json', import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (process.argv.includes('--import-registry')) {
  const base = `https://raw.githubusercontent.com/PrismarineJS/minecraft-data/${COMMIT}/`;
  const fetchBytes = async (path) => {
    const r = await fetch(base + path);
    assert.ok(r.ok, `${path}: HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  };
  const version = JSON.parse(await fetchBytes('data/pc/1.13.2/version.json'));
  assert.equal(version.minecraftVersion, '1.13.2');
  assert.equal(version.version, 404);
  assert.match((await fetchBytes('README.md')).toString(), /## License\s+MIT\b/);
  const bytes = await fetchBytes('data/pc/1.13.2/items.json');
  assert.equal(sha256(bytes), ITEMS_SHA256);
  writeFileSync(dataUrl, bytes); // byte-for-byte import; never convert legacy item IDs
  console.log(`Imported protocol404 items from minecraft-data ${COMMIT}`);
}

const readData = (name) => JSON.parse(readFileSync(new URL('../client/data/' + name + '.json', import.meta.url)));
const data = Object.fromEntries(['items', 'blocks', 'blockCollisionShapes', 'creative', 'foods', 'materials', 'enchantments'].map(n => [n, readData(n)]));
initBlocks(data.blocks, data.blockCollisionShapes);
const jar = new ZipFile(process.env.MC_JAR || fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));
const prefix = 'assets/minecraft/';
const jsonAssets = (dir) => Object.fromEntries(jar.list(prefix + dir + '/').filter(p => p.endsWith('.json'))
  .map(p => [p.slice((prefix + dir + '/').length, -5), JSON.parse(jar.read(p))]));
const textures = ['block', 'item'].flatMap(dir => jar.list(prefix + 'textures/' + dir + '/').filter(p => p.endsWith('.png')))
  .map(p => ({ name: p.slice((prefix + 'textures/').length, -4), image: decodePng(jar.read(p)) }));
const atlas = new Atlas();
const mcmeta = {};
for (const t of textures) {
  const raw = jar.read(prefix + 'textures/' + t.name + '.png.mcmeta');
  if (raw) mcmeta[t.name] = JSON.parse(raw);
}
atlas.build(textures, mcmeta);
const models = jsonAssets('models');
const imageCache = new Map();
const assets = {
  data, atlas, modelStore: new ModelStore(models, jsonAssets('blockstates'), atlas),
  lang: JSON.parse(jar.read(prefix + 'lang/en_us.json')),
  grassPixels: decodePng(jar.read(prefix + 'textures/colormap/grass.png')).data,
  // Deliberately supply the former mixed maps: Items must use only the item registry.
  itemsById: new Map([...data.blocks, ...data.items].map(d => [d.id, d])),
  itemsByName: new Map([...data.blocks, ...data.items].map(d => [d.name, d])),
  textures: new Map(),
  image(path) {
    if (!imageCache.has(path)) {
      const bytes = jar.read(prefix + 'textures/' + path);
      assert.ok(bytes, 'missing built-in texture: ' + path);
      imageCache.set(path, decodePng(bytes));
    }
    return imageCache.get(path);
  },
  makeTexture(key, width, height, data) {
    const texture = { key, width, height, data };
    this.textures.set(key, texture);
    return texture;
  },
  translate(key, args = []) {
    let next = 0;
    return (this.lang[key] ?? key).replace(/%(?:(\d+)\$)?s/g, (_, i) => String(args[i ? Number(i) - 1 : next++] ?? ''));
  },
};
setTranslator((key, args) => assets.translate(key, args));
const game = {
  assets, items: new Items(assets), device: { createMesh: (format, vertices, options) => ({ format, vertices, options }) },
  player: { usingItem: false }, inventory: { held: () => null, offhand: null }, interaction: { useTicks: 0 },
};
const items = game.items, renderer = new ItemRenderer(game);
const extracted = extractModels(jar);
assert.deepEqual(extracted.errors, []);
setJarModels(extracted.models);
setModelDevice(game.device);
const stack = (name, tag = null) => {
  const def = items.byName.get(name);
  assert.ok(def, 'registry entry: ' + name);
  return { id: def.id, count: 1, damage: 0, nbt: tag };
};
const plain = s => s.replace(/§./g, '');
const meshesOf = (res) => {
  const meshes = res.mesh ? [res.mesh] : [];
  if (res.builtin) res.builtin.traverse(node => {
    for (const draw of node.drawables) {
      meshes.push(draw.mesh);
      assert.ok(draw.mat, 'built-in material');
      if (typeof draw.mat.tex === 'string') assets.image(draw.mat.tex);
    }
  });
  return meshes;
};
const assertGeometry = (it) => {
  const m = renderer.modelFor(it);
  assert.notEqual(m.name, 'missing', items.name(it.id));
  for (const tex of m.layers || m.baked?.quads.map(q => q.tex) || []) assert.ok(atlas.entries.has(tex), 'missing atlas texture: ' + tex);
  const meshes = meshesOf(renderer.meshFor(it));
  assert.ok(meshes.length, items.name(it.id) + ': renderable geometry');
  for (const mesh of meshes) {
    assert.ok(mesh.vertices.length > 0);
    assert.ok(mesh.vertices.every(Number.isFinite), items.name(it.id) + ': finite vertices');
    assert.equal(mesh.vertices.length % (4 * 11), 0, 'complete entity-format quads');
  }
  return m;
};

test('protocol404 registry is the exact pinned primary-source dataset', () => {
  assert.equal(PROTOCOL_VERSION, 404);
  assert.equal(sha256(readFileSync(dataUrl)), ITEMS_SHA256);
  assert.equal(items.byId.size, 789);
  assert.equal(items.byName.has('water'), false, 'a block-only entry is not an item');
  for (let id = 1; id <= 789; id++) assert.ok(items.def(id), 'wire ID ' + id);
  assert.equal(items.def(790), null);
  assert.equal(items.name(493), 'diamond_sword');
  assert.equal(items.name(789), 'heart_of_the_sea');
});

test('literal window_items packet preserves flattened IDs through names and real jar geometry', () => {
  // Packet 0x15, window 7, four slots: grass block (8), red bed (610), diamond sword (493), empty.
  const packet = decodePacket(Uint8Array.from([0x15, 7, 0, 4, 1, 8, 64, 0, 1, 0xe2, 4, 1, 0, 1, 0xed, 3, 1, 0, 0]));
  assert.equal(packet.name, 'window_items');
  assert.equal(packet.windowId, 7);
  assert.deepEqual(packet.items.map(it => it?.id ?? null), [8, 610, 493, null]);
  for (const [i, name, display] of [[0, 'grass_block', 'Grass Block'], [1, 'red_bed', 'Red Bed'], [2, 'diamond_sword', 'Diamond Sword']]) {
    const it = packet.items[i];
    assert.equal(items.name(it.id), name);
    assert.equal(plain(items.displayName(it)), display);
    assert.equal(renderer.modelFor(it).name, name);
    assertGeometry(it);
  }
});

test('every registered item resolves its actual jar model, name, textures and nonempty geometry', () => {
  for (const def of data.items) {
    const it = stack(def.name);
    assert.ok(models['item/' + def.name], 'jar item model: ' + def.name);
    const model = assertGeometry(it);
    // Clock/compass can select their numbered frames. Other base models retain the registry name.
    if (!['clock', 'compass'].includes(def.name)) assert.equal(model.name, def.name);
    const name = plain(items.displayName(it));
    assert.ok(name && !/^(?:Unknown|(?:item|block)\.minecraft\.)/.test(name), def.name + ': translated name');
  }
});

test('window and set_slot handlers preserve high IDs in both container and player slots', () => {
  const g = { items, heldSlot: 0, tutorial: { handleSetSlot() {} } };
  g.inventory = new Inventory(g);
  g.window = new ContainerWindow(g, 7, 'minecraft:chest', 'Chest', 27);
  const sample = ['heart_of_the_sea', 'trident', 'light_gray_wool', 'polished_granite', 'red_bed'].map(n => stack(n));
  const w = new Writer().varint(0x15).u8(7).i16(sample.length);
  for (const it of sample) w.slot(it);
  const contents = decodePacket(w.build());
  assert.equal(contents.name, 'window_items');
  assert.equal(contents._extra, undefined);
  Game.prototype.on_window_items.call(g, contents);
  for (let i = 0; i < sample.length; i++) {
    const received = g.window.get(i);
    assert.equal(received.id, sample[i].id);
    assert.equal(items.displayName(received), items.displayName(sample[i]));
    assertGeometry(received);
  }
  const set = new Writer().varint(0x17).i8(0).i16(36).slot(sample[0]).build();
  const changed = decodePacket(set);
  assert.equal(changed.name, 'set_slot');
  assert.equal(changed._extra, undefined);
  Game.prototype.on_set_slot.call(g, changed);
  assert.equal(g.inventory.held().id, 789);
  const creative = new Reader(C.creativeSlot(36, g.inventory.held()));
  assert.equal(creative.varint(), 0x24);
  assert.equal(creative.i16(), 36);
  assert.equal(creative.slot().id, 789, 'outbound wire identity is unchanged');
  assert.equal(creative.remaining(), 0);
});

test('former metadata variants are distinct registry items and ignore the obsolete damage field', () => {
  for (const names of [
    ['stone', 'granite', 'polished_granite', 'diorite', 'polished_diorite', 'andesite', 'polished_andesite'],
    ['coal', 'charcoal'], ['cod', 'salmon', 'tropical_fish', 'pufferfish'], ['cooked_cod', 'cooked_salmon'],
    ['white_wool', 'light_gray_wool', 'red_wool'], ['anvil', 'chipped_anvil', 'damaged_anvil'],
    ['sandstone', 'chiseled_sandstone', 'cut_sandstone'], ['potion', 'splash_potion', 'lingering_potion'],
    ['white_bed', 'red_bed'], ['white_banner', 'red_banner'], ['shulker_box', 'light_gray_shulker_box'],
    ['skeleton_skull', 'player_head', 'dragon_head'], ['golden_apple', 'enchanted_golden_apple'],
  ]) {
    assert.equal(new Set(names.map(n => stack(n).id)).size, names.length);
    for (const name of names) {
      const it = stack(name), variant = { ...it, damage: 15 };
      assert.equal(renderer.modelFor(it).name, name);
      assert.equal(renderer.modelFor(variant), renderer.modelFor(it), name + ': no legacy damage variant');
      assert.equal(items.displayName(variant), items.displayName(it));
      assertGeometry(it);
    }
  }
});

test('container UI draws received sprite, block and builtin slots with the decoded custom tooltip', () => {
  const g = { ...game, heldSlot: 0, settings: { advancedItemTooltips: true } };
  g.inventory = new Inventory(g);
  g.window = new ContainerWindow(g, 9, 'minecraft:chest', 'Chest', 27);
  g.itemRenderer = new ItemRenderer(g);
  const w = new Writer().varint(0x15).u8(9).i16(3);
  w.slot(stack('trident', nbt.compound({ Damage: nbt.int(25), display: nbt.compound({ Name: nbt.string('{"text":"Ocean fork","color":"aqua"}') }) })));
  w.slot(stack('grass_block')).slot(stack('red_bed'));
  Game.prototype.on_window_items.call(g, decodePacket(w.build()));
  const screen = new ContainerScreen(g, g.window);
  screen.guiLeft = screen.guiTop = 0;
  screen.slotPos = [[0, 0, 0], [1, 18, 0], [2, 36, 0]];
  const draws = { sprites: [], meshes: [], nodes: [], tooltips: [], rects: [] };
  const gui = {
    worldBackground() {}, pushMatrix() {}, popMatrix() {}, translate() {}, nextIconDepth: () => 0,
    quad: (...args) => draws.sprites.push(args), rect: (...args) => draws.rects.push(args),
    drawMesh: (draw, matrix) => { assert.ok(matrix.every(Number.isFinite)); draws.meshes.push(draw); },
    drawNode: node => draws.nodes.push(node), tooltip: lines => draws.tooltips.push(lines),
  };
  screen.render(gui, 1, 1, 0);
  assert.equal(draws.sprites.length, 1, 'trident GUI sprite');
  assert.equal(draws.meshes.length, 2, 'grass block depth and colour passes');
  assert.ok(draws.meshes.every(d => d.mesh.vertices.length > 0));
  assert.equal(draws.nodes.length, 1, 'bed builtin geometry');
  assert.equal(plain(draws.tooltips[0][0]), 'Ocean fork');
  assert.ok(draws.tooltips[0].includes('Durability: 225 / 250'));
  assert.equal(draws.tooltips[0].at(-1), '§8minecraft:trident');
});

test('item/block/state IDs remain distinct, and fallback resolves blocks by registry name', () => {
  for (const name of ['oak_leaves', 'glass', 'chest', 'red_bed', 'conduit']) {
    const it = stack(name), block = blocksByName[name];
    assert.notEqual(it.id, block.id, name + ': independent registries');
    assert.notEqual(it.id, block.defaultState, name + ': not a state ID');
    assert.equal(items.blockFor(it.id), block);
    assert.equal(items.isBlockItem(it.id), true);
  }
  assert.equal(items.isBlockItem(stack('diamond_sword').id), false);
  assert.equal(items.isBlockItem(stack('wheat').id), false, 'grain is not the crop with the same registry name');
  assert.equal(items.displayName(stack('wheat')), 'Wheat');
  const alternate = new ItemRenderer({ ...game, assets: { ...assets, modelStore: new ModelStore({
    'block/glass': models['block/glass'], 'block/cube_all': models['block/cube_all'], 'block/cube': models['block/cube'],
    'block/block': models['block/block'],
  }, {}, atlas) } });
  const model = alternate.modelFor(stack('glass'));
  assert.equal(model.kind, 'block');
  assert.ok(model.baked.quads.every(q => q.tex === 'block/glass'));
});

test('Damage NBT drives tooltips, durability bars and elytra/pack predicates, not slot.damage', () => {
  const original = stack('diamond_sword', nbt.compound({ Damage: nbt.int(781) }));
  original.damage = 123;
  const it = new Reader(new Writer().slot(original).build()).slot();
  assert.equal(it.damage, 0, 'protocol404 has no damage short');
  assert.equal(items.damage(it), 781);
  assert.ok(items.tooltip(it, true).includes('Durability: 780 / 1561'));
  assert.equal(items.tooltip(it, true).at(-1), '§8minecraft:diamond_sword');
  const bars = [];
  renderer.drawOverlay({ rect: (...args) => bars.push(args) }, it, 0, 0);
  assert.equal(bars.length, 2);
  assert.deepEqual(bars[1].slice(0, 4), [2, 13, 8, 14]);
  assert.equal(renderer._predicates(it).damaged, 1);
  assert.equal(renderer._predicates(it).damage, 781 / 1561);
  const broken = stack('elytra', nbt.compound({ Damage: nbt.int(431) }));
  assert.equal(renderer.modelFor(broken).name, 'broken_elytra');
  assert.notEqual(renderer.iconKey(broken), renderer.iconKey(stack('elytra')));
  assertGeometry(broken);
  const unbreakable = stack('diamond_sword', nbt.compound({ Damage: nbt.int(781), Unbreakable: nbt.byte(1) }));
  bars.length = 0;
  renderer.drawOverlay({ rect: (...args) => bars.push(args) }, unbreakable, 0, 0);
  assert.equal(bars.length, 0);
  assert.equal(renderer._predicates(unbreakable).damaged, 0);
  const noTag = { ...stack('diamond_sword'), damage: 781 };
  assert.equal(items.damage(noTag), 0, 'do not resurrect pre-flattening metadata');
  it.nbt = nbt.compound({ Damage: nbt.int(10) });
  it.nbtRaw = null;
  assert.equal(items.damage(it), 10, 'replacing NBT invalidates the simplified view');
});

test('bow/shield/fishing overrides and namespaced block-target pack overrides resolve correctly', () => {
  const bow = stack('bow');
  game.player.usingItem = true;
  game.inventory.held = () => bow;
  game.interaction.useTicks = 19;
  assert.equal(renderer.modelFor(bow).name, 'bow_pulling_2');
  game.interaction.useTicks = 14;
  assert.equal(renderer.modelFor(bow).name, 'bow_pulling_1');
  const shield = stack('shield');
  game.inventory.held = () => shield;
  assert.equal(renderer.modelFor(shield).name, 'shield_blocking');
  game.player.usingItem = false;
  const rod = stack('fishing_rod');
  game.inventory.held = () => rod;
  game.entities = { fishingCast: true };
  assert.equal(renderer.modelFor(rod).name, 'fishing_rod_cast');
  game.inventory.held = () => null;
  game.entities = null;
  const packModels = { ...models, 'item/diamond_sword': { ...models['item/diamond_sword'], overrides: [
    { predicate: { 'minecraft:damage': 0.5 }, model: 'minecraft:item/stick' },
    { predicate: { 'minecraft:damage': 0.5 }, model: 'minecraft:block/diamond_block' },
    { predicate: { nonexistent: 0 }, model: 'item/dirt' },
  ] } };
  const ir = new ItemRenderer({ ...game, assets: { ...assets, modelStore: new ModelStore(packModels, {}, atlas) } });
  const damaged = stack('diamond_sword', nbt.compound({ Damage: nbt.int(1000) }));
  const m = ir.modelFor(damaged);
  assert.equal(m.path, 'block/diamond_block', 'last satisfied override, with its actual path');
  assert.equal(m.kind, 'block');
  assert.ok(m.baked.quads.every(q => q.tex === 'block/diamond_block'));
});

test('inventory grass/leaves tint reaches sprite, GUI-block and 3D mesh vertices', () => {
  const rgb = c => [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255];
  const close = (actual, expected) => actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-6, `${actual} vs ${expected}`));
  const k = (127 * 256 + 127) * 4, p = assets.grassPixels;
  const grass = (p[k] << 16) | (p[k + 1] << 8) | p[k + 2];
  const palette = { grass_block: grass, grass, fern: grass, tall_grass: grass, large_fern: grass,
    oak_leaves: 0x48b518, spruce_leaves: 0x619961, birch_leaves: 0x80a755, vine: 0x48b518, lily_pad: 0x71c35c };
  for (const [name, tint] of Object.entries(palette)) {
    const it = stack(name), m = renderer.modelFor(it);
    assert.equal(renderer._defaultTint(name), tint);
    if (m.kind === 'generated') {
      const colors = [];
      renderer._drawLayers({ quad: (...args) => colors.push(args.at(-1)) }, it, m, 0, 0);
      close(colors[0].slice(0, 3), rgb(tint));
      close([...renderer.meshFor(it).mesh.vertices.slice(8, 11)], rgb(tint));
    } else {
      const gui = renderer._blockIconMesh(m).mesh.vertices, world = renderer.blockMesh(m).vertices;
      const shade = [0.5, 1, 0.8, 0.8, 0.6, 0.6];
      m.baked.quads.forEach((q, i) => {
        const c = rgb(q.tint >= 0 ? tint : 0xffffff);
        close([...world.slice(i * 44 + 8, i * 44 + 11)], c);
        close([...gui.slice(i * 36 + 5, i * 36 + 8)], c.map(v => v * (q.shade ? shade[q.dir] : 1)));
      });
    }
  }
  assert.equal(renderer.layerTint(stack('seagrass'), 0), 0xffffff, 'already coloured aquatic sprite');
  const ir = new ItemRenderer({ ...game, assets: { ...assets, grassPixels: new Uint8Array(256 * 256 * 4).fill(42) } });
  assert.equal(ir.layerTint(stack('grass'), 0), 0x2a2a2a, 'resource-pack colormap');
});

test('named enchantments, potions, eggs, food/tool checks and coloured builtins use flattened identities', () => {
  const sword = stack('diamond_sword', nbt.compound({ Enchantments: nbt.list(10, [
    { id: nbt.string('minecraft:sharpness'), lvl: nbt.short(3) },
    { id: nbt.string('minecraft:vanishing_curse'), lvl: nbt.short(1) },
  ]) }));
  assert.ok(items.hasEffect(sword));
  assert.equal(items.enchantLevel(sword, 'sharpness'), 3);
  assert.equal(items.enchantLevel(sword, 16), 3, 'existing internal helper caller compatibility');
  assert.ok(items.tooltip(sword).map(plain).includes('Sharpness III'));
  assert.ok(items.tooltip(sword).includes('§7§cCurse of Vanishing'));
  assert.equal(items.enchantmentName(11, 3), 'Sharpness III', 'protocol404 enchanting clue ID');
  assert.equal(items.enchantmentName('minecraft:channeling', 1), 'Channeling');
  const book = stack('enchanted_book', nbt.compound({ StoredEnchantments: nbt.list(10, [
    { id: nbt.string('minecraft:loyalty'), lvl: nbt.short(3) },
  ]) }));
  assert.ok(items.tooltip(book).map(plain).includes('Loyalty III'));
  for (const [name, prefix] of [['potion', 'Potion'], ['splash_potion', 'Splash Potion'], ['lingering_potion', 'Lingering Potion'], ['tipped_arrow', 'Arrow']]) {
    const it = stack(name, nbt.compound({ Potion: nbt.string('minecraft:long_swiftness') }));
    assert.equal(items.displayName(it), prefix + ' of Swiftness');
    assert.equal(renderer.modelFor(it).name, name);
    assert.equal(renderer.layerTint(it, 0), 8171462);
    assert.ok(items.tooltip(it).map(plain).some(s => s.startsWith('Speed (')));
  }
  const slow = stack('potion', nbt.compound({ Potion: nbt.string('minecraft:slow_falling') }));
  assert.equal(items.displayName(slow), 'Potion of Slow Falling');
  assert.equal(renderer.layerTint(slow, 0), 16773073);
  assert.ok(items.tooltip(slow).map(plain).includes('Slow Falling (1:30)'));
  const turtle = stack('potion', nbt.compound({ Potion: nbt.string('minecraft:strong_turtle_master') }));
  assert.deepEqual(items.potionEffects(turtle).map(e => [e.id, e.duration, e.amplifier]), [[2, 400, 5], [11, 400, 3]]);
  const egg = stack('dolphin_spawn_egg');
  assert.equal(items.displayName(egg), 'Dolphin Spawn Egg');
  assert.equal(items.eggEntity(egg), 'minecraft:dolphin');
  assert.equal(renderer.layerTint(egg, 0), 2243405);
  assert.equal(renderer.layerTint(egg, 1), 16382457);
  const overridden = stack('dolphin_spawn_egg', nbt.compound({ EntityTag: nbt.compound({ id: nbt.string('minecraft:zombie') }) }));
  assert.equal(items.eggEntity(overridden), 'minecraft:zombie');
  assert.equal(renderer.layerTint(overridden, 0), renderer.layerTint(egg, 0));
  assert.equal(items.useAction(stack('potion')), 'drink');
  assert.equal(items.useAction(stack('milk_bucket')), 'drink');
  assert.equal(items.useAction(stack('shield')), 'block');
  assert.equal(items.useDuration(stack('dried_kelp')), 16);
  assert.equal(items.isFood(stack('salmon')), true);
  assert.equal(items.isFood({ id: 260 }), false, 'old apple ID is not food');
  assert.equal(items.strVsBlock(stack('diamond_pickaxe'), blocksByName.stone), 8);
  assert.equal(items.canHarvest(stack('diamond_pickaxe'), blocksByName.stone), true);
  assert.equal(items.strVsBlock(stack('diamond_sword'), blocksByName.cobweb), 15);
  assert.equal(items.displayName(stack('player_head', nbt.compound({ SkullOwner: nbt.string('Alex') }))), "Alex's Head");
  assert.ok(items.tooltip(stack('music_disc_13')).map(plain).includes('C418 - 13'));
});

test('NBT tints separate cached meshes, including firework stars with a custom display name', () => {
  for (const [name, layer, tag] of [
    ['leather_chestplate', 0, nbt.compound({ display: nbt.compound({ color: nbt.int(0x123456) }) })],
    ['filled_map', 1, nbt.compound({ display: nbt.compound({ MapColor: nbt.int(0x123456) }) })],
    ['potion', 0, nbt.compound({ CustomPotionColor: nbt.int(0x123456) })],
    ['firework_star', 1, nbt.compound({ display: nbt.compound({ Name: nbt.string('"Star"') }),
      Explosion: nbt.compound({ Colors: { t: 11, v: Int32Array.of(0x123456) } }) })],
  ]) {
    const dyed = stack(name, tag), regular = stack(name);
    assert.equal(renderer.layerTint(dyed, layer), 0x123456);
    assert.equal(renderer.layerTint(dyed, 1 - layer), 0xffffff);
    assert.notEqual(renderer.iconKey(dyed), renderer.iconKey(regular));
    assert.notEqual(renderer.meshFor(dyed).mesh, renderer.meshFor(regular).mesh);
    assertGeometry(dyed);
  }
  assert.equal(renderer.layerTint(stack('filled_map'), 0), 0xffffff);
  assert.equal(renderer.layerTint(stack('filled_map'), 1), 0x46402e);
  const base = assets.image('entity/banner_base.png');
  const mask = assets.image('entity/banner/base.png');
  let pixel = -1;
  for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i + 2] && base.data[i] > 0) { pixel = i; break; }
  assert.ok(pixel >= 0);
  for (const [name, index, color] of [['white_banner', 0, 0xffffff], ['red_banner', 14, 0x993333], ['blue_banner', 11, 0x334cb2]]) {
    renderer.meshFor(stack(name));
    const texture = assets.textures.get('banneritem:' + index + ':[]');
    assert.ok(texture, name);
    assert.deepEqual([...texture.data.slice(pixel, pixel + 3)], [16, 8, 0].map((shift, c) => Math.trunc(base.data[pixel + c] * (color >> shift & 255) / 255)));
  }
});

test('custom JSON display.Name uses chatToLegacy; 1.13 Lore remains legacy text', () => {
  const tag = nbt.compound({ display: nbt.compound({
    Name: nbt.string('{"text":"Ocean ","color":"aqua","extra":[{"translate":"item.minecraft.trident","bold":true}]}'),
    Lore: nbt.list(8, ['§aOld-style lore', '{"text":"literal lore in 1.13"}']),
  }) });
  const original = stack('trident', tag);
  const decoded = new Reader(new Writer().slot(original).build()).slot();
  assert.equal(decoded.id, 786);
  assert.equal(plain(items.displayName(decoded)), 'Ocean Trident');
  assert.match(items.displayName(decoded), /§b/);
  const lines = items.tooltip(decoded);
  assert.equal(plain(lines[0]), 'Ocean Trident');
  assert.ok(lines.includes('§5§o§aOld-style lore'));
  assert.ok(lines.includes('§5§o{"text":"literal lore in 1.13"}'));
  assert.deepEqual(new Writer().slot(decoded).build(), new Writer().slot(original).build());
  const literal = stack('stone', nbt.compound({ display: nbt.compound({ Name: nbt.string('"Named stone"') }) }));
  assert.equal(items.displayName(literal), 'Named stone');
  assert.match(items.tooltip(literal)[0], /§oNamed stone/);
  const roman = stack('stone', nbt.compound({ display: nbt.compound({ Name: nbt.string('{"text":"Roman","italic":false}') }) }));
  assert.equal(plain(items.tooltip(roman)[0]), 'Roman');
  assert.ok(!items.tooltip(roman)[0].includes('§o'), 'explicit JSON italic:false overrides the custom-name default');
});

// Container integration: actual slots and clicks, with native protocol404 stacks.
const containerGame = (type = null, size = 0) => {
  const sent = [];
  const g = { items, assets, heldSlot: 0, player: { creative: false }, tutorial: { handleSetSlot() {} }, send: p => sent.push(p), sent };
  g.inventory = new Inventory(g);
  if (type) g.window = new ContainerWindow(g, 7, type, 'Test', size);
  return g;
};
const packetSlot = it => new Reader(new Writer().slot(it).build()).slot();
const serverSlot = (g, c, slot, it) => {
  const p = decodePacket(new Writer().varint(0x17).i8(c.windowId).i16(slot).slot(it).build());
  assert.equal(p.name, 'set_slot');
  assert.equal(p._extra, undefined);
  Game.prototype.on_set_slot.call(g, p);
};
const serverContents = (g, c, slots) => {
  const w = new Writer().varint(0x15).u8(c.windowId).i16(slots.length);
  slots.forEach(it => w.slot(it));
  const p = decodePacket(w.build());
  assert.equal(p.name, 'window_items');
  assert.equal(p._extra, undefined);
  Game.prototype.on_window_items.call(g, p);
};
const stackCount = (name, count) => ({ ...stack(name), count });

test('native armour, headwear and offhand slots validate and shift-click without legacy ID collisions', () => {
  for (const [name, slot] of [['diamond_helmet', 5], ['turtle_helmet', 5], ['carved_pumpkin', 5], ['player_head', 5],
    ['iron_chestplate', 6], ['elytra', 6], ['chainmail_leggings', 7], ['golden_boots', 8], ['shield', 45]]) {
    const g = containerGame(), inv = g.inventory;
    const it = packetSlot(stack(name));
    if (slot !== 45) {
      assert.equal(armorType(it, items), slot - 5, name);
      assert.equal(armorType(it, items.byId), slot - 5, name + ': registry-map API');
      assert.equal(inv.isValid(slot, it), true, name);
      for (let s = 5; s < 9; s++) if (s !== slot) assert.equal(inv.isValid(s, it), false, name + ': wrong armour slot');
    }
    serverSlot(g, inv, 36, it);
    inv.click(36, 0, 1);
    assert.equal(inv.get(slot)?.id, it.id, name + ': shift-click destination');
    assert.equal(inv.get(36), null);
    assert.equal(g.sent.length, 1);
    inv.click(slot, 0, 1);
    assert.equal(inv.get(slot), null, name + ': can shift-click back out');
    assert.equal(inv.get(9)?.id, it.id);
  }
  const g = containerGame(), inv = g.inventory;
  for (const name of ['terracotta', 'grass_path', 'pumpkin', 'jack_o_lantern', 'diamond_horse_armor', 'blue_stained_glass']) {
    for (let s = 5; s < 9; s++) assert.equal(inv.isValid(s, stack(name)), false, name + ': not armour');
  }
  assert.equal(armorType({ name: 'minecraft:diamond_boots' }), 3, 'one-argument named-stack API');
  assert.equal(armorType(null, items), -1);
  assert.equal(armorType({ id: -1 }, items), -1);
  assert.equal(inv.isValid(45, stack('stone')), true, 'offhand accepts ordinary items too');
  serverSlot(g, inv, 36, stackCount('carved_pumpkin', 12));
  inv.click(36, 0, 1);
  assert.equal(inv.get(5).count, 1, 'headwear does not overfill the armour slot');
  assert.equal(inv.get(9).count, 11);
  for (const [slot, name] of [[5, 'diamond_helmet'], [6, 'diamond_chestplate'], [7, 'diamond_leggings'], [8, 'diamond_boots']]) serverSlot(g, inv, slot, stack(name));
  assert.equal(inv.armorPoints(), 20);
  serverSlot(g, inv, 5, stack('turtle_helmet'));
  assert.equal(inv.armorPoints(), 19);
  serverSlot(g, inv, 6, stack('elytra'));
  assert.equal(inv.armorPoints(), 11, 'elytra is not chestplate armour points');
});

// Resolve the jar's own field registrations and item tags, independently of container.js's tables.
const jarFieldNames = (cls) => {
  const c = parseClass(jar.read(cls + '.class')), fields = new Map();
  let name;
  for (const ins of walk(c.methods.find(m => m.name === '<clinit>').code)) {
    if (ins.op === 0x12 || ins.op === 0x13) {
      const v = c.constant(ins.op === 0x12 ? ins.u1 : ins.u2);
      if (v.type === 'string') name = v.value;
    } else if (ins.op === 0xb3) fields.set(c.ref(ins.u2).name, name);
  }
  return fields;
};
const jarTag = (name) => JSON.parse(jar.read('data/minecraft/tags/items/' + name.replace(/^minecraft:/, '') + '.json')).values
  .flatMap(n => n.startsWith('#') ? jarTag(n.slice(1)) : [n.replace(/^minecraft:/, '')]);

test('furnace fuel validation and every shift-click route match the 1.13.2 jar recipes and fuel registry', () => {
  const smeltable = new Set();
  for (const path of jar.list('data/minecraft/recipes/')) {
    const recipe = JSON.parse(jar.read(path));
    if (recipe.type !== 'smelting' && recipe.type !== 'minecraft:smelting') continue;
    for (const ing of [recipe.ingredient].flat()) {
      for (const name of ing.tag ? jarTag(ing.tag) : [ing.item.replace(/^minecraft:/, '')]) smeltable.add(name);
    }
  }
  const fuel = new Set(), fields = Object.fromEntries(['atf', 'bct', 'wx'].map(cls => [cls, jarFieldNames(cls)]));
  const c = parseClass(jar.read('bju.class'));
  for (const ins of walk(c.methods.find(m => m.name === 'p' && m.desc === '()Ljava/util/Map;').code)) {
    if (ins.op !== 0xb2) continue;
    const ref = c.ref(ins.u2), name = fields[ref.owner]?.get(ref.name);
    assert.ok(name, 'resolved vanilla fuel reference');
    for (const n of ref.owner === 'wx' ? jarTag(name) : [name]) fuel.add(n);
  }
  assert.ok(fuel.has('stripped_dark_oak_wood') && fuel.has('dried_kelp_block'));
  assert.ok(smeltable.has('sea_pickle') && smeltable.has('chainmail_boots'));
  for (const def of data.items) {
    const g = containerGame('minecraft:furnace', 3), win = g.window;
    const it = packetSlot(stack(def.name));
    assert.equal(win.isValid(1, it), fuel.has(def.name) || def.name === 'bucket', def.name + ': furnace fuel slot');
    assert.equal(win.isValid(0, it), true, 'furnace input permits manual insertion: ' + def.name);
    assert.equal(win.isValid(2, it), false, 'furnace output rejects insertion');
    serverSlot(g, win, 3, it);
    win.click(3, 0, 1);
    const dest = smeltable.has(def.name) ? 0 : fuel.has(def.name) || def.name === 'bucket' ? 1 : 30;
    assert.equal(win.get(dest)?.id, def.id, def.name + ': shift-click route');
    assert.equal(win.get(3), null);
  }
  const g = containerGame('minecraft:furnace', 3), win = g.window;
  g.inventory.cursor = stackCount('bucket', 16);
  win.click(1, 0, 0);
  assert.equal(win.get(1).count, 1);
  assert.equal(g.inventory.cursor.count, 15);
  serverSlot(g, win, 1, stackCount('coal', 63));
  serverSlot(g, win, 3, stackCount('coal', 8));
  win.click(3, 0, 1);
  assert.equal(win.get(1).count, 64);
  assert.equal(win.get(3).count, 7);
});

test('brewing, lapis, beacon and horse rules use native item identities on real slots and shift-clicks', () => {
  const reagentNames = ['nether_wart', 'glowstone_dust', 'redstone', 'gunpowder', 'dragon_breath', 'fermented_spider_eye',
    'sugar', 'ghast_tear', 'glistering_melon_slice', 'blaze_powder', 'magma_cream', 'golden_carrot', 'spider_eye',
    'pufferfish', 'rabbit_foot', 'turtle_helmet', 'phantom_membrane'];
  for (const name of reagentNames) {
    const g = containerGame('minecraft:brewing_stand', 5), w = g.window;
    assert.equal(w.isValid(3, stack(name)), true, name);
    serverSlot(g, w, 5, stack(name));
    w.click(5, 0, 1);
    assert.equal(w.get(3)?.id, stack(name).id, name + ': vanilla 1.13 ingredient-first transfer');
  }
  const g = containerGame('minecraft:brewing_stand', 5), w = g.window;
  for (const name of ['cod', 'salmon', 'tropical_fish', 'ink_sac', 'scute', 'melon_slice']) assert.equal(w.isValid(3, stack(name)), false, name);
  assert.equal(w.isValid(4, stack('blaze_powder')), true);
  assert.equal(w.isValid(4, stack('blaze_rod')), false);
  for (const name of ['potion', 'splash_potion', 'lingering_potion', 'glass_bottle']) {
    for (let i = 0; i < 3; i++) assert.equal(w.isValid(i, stack(name)), true);
    serverSlot(g, w, 0, null);
    serverSlot(g, w, 5, stack(name));
    w.click(5, 0, 1);
    assert.equal(w.get(0)?.id, stack(name).id);
  }
  assert.equal(w.isValid(0, stack('tipped_arrow')), false);
  serverSlot(g, w, 0, null);
  g.inventory.cursor = stackCount('glass_bottle', 8);
  w.click(0, 0, 0);
  assert.equal(w.get(0).count, 1);
  assert.equal(g.inventory.cursor.count, 7);
  for (const [type, size, dest, names, reject] of [
    ['minecraft:enchanting_table', 2, 1, ['lapis_lazuli'], ['light_blue_dye', 'blue_wool', 'ink_sac']],
    ['minecraft:beacon', 1, 0, ['diamond', 'emerald', 'gold_ingot', 'iron_ingot'], ['iron_nugget', 'gold_nugget', 'diamond_block']],
    ['EntityHorse', 2, 0, ['saddle'], ['lead', 'leather', 'stone']],
    ['EntityHorse', 2, 1, ['iron_horse_armor', 'golden_horse_armor', 'diamond_horse_armor'], ['iron_chestplate', 'diamond_helmet', 'stone']],
  ]) {
    for (const name of names) {
      const g = containerGame(type, size), win = g.window;
      assert.equal(win.isValid(dest, stack(name)), true, type + ' ' + name);
      serverSlot(g, win, size, stack(name));
      win.click(size, 0, 1);
      assert.equal(win.get(dest)?.id, stack(name).id, type + ' ' + name + ': shift-click');
      assert.equal(win.get(size), null);
      win.click(dest, 0, 1);
      assert.equal(win.get(dest), null);
    }
    const g = containerGame(type, size);
    for (const name of reject) assert.equal(g.window.isValid(dest, stack(name)), false, type + ' rejects ' + name);
  }
});

test('shift-click merger enforces restricted destinations even when called directly', () => {
  const g = containerGame('minecraft:brewing_stand', 5), w = g.window;
  const wrong = stackCount('stone', 12);
  assert.equal(w.mergeItemStack(wrong, 0, 5, false), false);
  assert.equal(wrong.count, 12);
  assert.ok(w.container.every(it => it === null));
  const bottles = stackCount('glass_bottle', 8);
  assert.equal(w.mergeItemStack(bottles, 0, 3, false), true);
  assert.equal(w.get(0).count, 1);
  assert.ok(w.container.slice(0, 3).every(it => !it || it.count === 1));
  assert.equal(bottles.count + w.container.slice(0, 3).reduce((n, it) => n + (it?.count || 0), 0), 8);
});

test('stack equality compares typed NBT, not absent raw buffers, serialized order or legacy damage', () => {
  const a = stack('stone', nbt.compound({ display: nbt.compound({ Name: nbt.string('"A"') }), Damage: nbt.int(3) }));
  const reordered = stack('stone', nbt.compound({ Damage: nbt.int(3), display: nbt.compound({ Name: nbt.string('"A"') }) }));
  assert.equal(stackable(a, reordered), true, 'compound order and root name do not affect equality');
  assert.equal(stackable(packetSlot(a), reordered), true, 'raw + structured');
  assert.equal(stackable(packetSlot(a), packetSlot(reordered)), true, 'two raw byte orders');
  const rawOnly = { ...packetSlot(a), nbt: null };
  assert.equal(stackable(a, rawOnly), true, 'raw-only stack');
  assert.equal(stackable(a, stack('stone')), false, 'tagged vs untagged');
  assert.equal(stackable({ ...stack('stone'), damage: 14 }, stack('stone')), true, 'obsolete slot.damage is not identity');
  const named = n => stack('stone', nbt.compound({ display: nbt.compound({ Name: nbt.string(JSON.stringify(n)) }) }));
  assert.equal(stackable(named('A'), named('B')), false);
  const enchanted = (name, level) => stack('enchanted_book', nbt.compound({ StoredEnchantments: nbt.list(10, [{ id: nbt.string('minecraft:' + name), lvl: nbt.short(level) }]) }));
  assert.equal(stackable(enchanted('sharpness', 1), enchanted('sharpness', 2)), false);
  assert.equal(stackable(enchanted('sharpness', 1), enchanted('looting', 1)), false);
  const damaged = n => stack('diamond_sword', nbt.compound({ Damage: nbt.int(n) }));
  assert.equal(stackable(damaged(1), damaged(2)), false);
  assert.equal(stackable(damaged(1), copy(damaged(1))), true);
  assert.equal(stackable(stack('stone', nbt.compound({ A: nbt.byte(1) })), stack('stone', nbt.compound({ A: nbt.int(1) }))), false, 'NBT type matters');
  const arrays = n => stack('stone', nbt.compound({ bytes: { t: 7, v: Int8Array.of(-1, 2) }, ints: { t: 11, v: Int32Array.of(1, 2) },
    longs: { t: 12, v: BigInt64Array.of(9007199254740993n, n) }, lore: nbt.list(8, ['one', 'two']) }));
  assert.equal(stackable(arrays(5n), packetSlot(arrays(5n))), true);
  assert.equal(stackable(arrays(5n), arrays(6n)), false, 'long arrays remain exact beyond JS number precision');
  const ordered = names => stack('stone', nbt.compound({ list: nbt.list(8, names) }));
  assert.equal(stackable(ordered(['one', 'two']), ordered(['two', 'one'])), false, 'NBT list order matters');
});

test('real clicks keep differently named NBT stacks separate and merge equivalent structured/packet stacks', () => {
  const named = name => stack('stone', nbt.compound({ display: nbt.compound({ Name: nbt.string(JSON.stringify(name)) }) }));
  const g = containerGame(), inv = g.inventory;
  inv.main[9] = { ...named('A'), count: 60 };
  inv.main[0] = { ...named('B'), count: 8 };
  inv.click(36, 0, 1);
  assert.equal(inv.main[9].count, 60);
  assert.equal(inv.main[10].count, 8);
  serverSlot(g, inv, 36, { ...named('A'), count: 8 });
  inv.click(36, 0, 1);
  assert.equal(inv.main[9].count, 64);
  assert.equal(inv.main[11].count, 4);
  inv.cursor = named('B');
  inv.click(9, 1, 0);
  assert.equal(inv.get(9).count, 1, 'right-click swaps distinct tags rather than merging');
  assert.equal(inv.cursor.count, 64);
  assert.equal(items.displayName(inv.get(9)), 'B');
  assert.equal(items.displayName(inv.cursor), 'A');
});

test('authoritative inventory and crafting-table outputs survive all packet update orders and remain takeable', () => {
  const ingredient = stack('iron_ingot');
  // Deliberately seed a conflicting local recipe: a packet must win over that prediction.
  initRecipes({ collision: [{ inShape: [[ingredient.id]], result: { id: stack('stone').id, count: 64 } }] });
  try {
    for (const type of [null, 'minecraft:crafting_table']) {
      const g = containerGame(type), c = g.window || g.inventory;
      const result = stack('trident', nbt.compound({ Damage: nbt.int(7), display: nbt.compound({ Name: nbt.string('"Server result"') }) }));
      const contents = new Array(c.slots.length).fill(null);
      contents[0] = result; contents[1] = ingredient;
      serverContents(g, c, contents);
      assert.equal(c.get(0)?.id, result.id, (type || 'player inventory') + ': setAll result survives');
      assert.equal(items.damage(c.get(0)), 7);
      assert.equal(items.displayName(c.get(0)), 'Server result');
      serverSlot(g, c, 1, stackCount('iron_ingot', 2));
      assert.equal(c.get(0)?.id, result.id, 'ingredient packet does not replace the result');
      serverSlot(g, c, 0, null);
      assert.equal(c.get(0), null, 'explicit server clear is respected');
      serverSlot(g, c, 1, ingredient);
      assert.equal(c.get(0), null, 'ingredient-only packet does not invent a result');
      serverSlot(g, c, 0, result);
      assert.equal(c.isValid(0, stack('stone')), false);
      assert.equal(c.canTake(0), true, 'valid server output is enabled');
      c.click(0, 0, 0);
      assert.equal(g.inventory.cursor?.id, result.id, 'valid server output can actually be taken');
      assert.equal(items.displayName(g.inventory.cursor), 'Server result');
      assert.equal(items.damage(g.inventory.cursor), 7);
      assert.equal(c.get(1), null, 'existing local ingredient-consumption path still runs');
      assert.equal(g.sent.length, 1);
      const sent = new Reader(g.sent[0]);
      assert.equal(sent.varint(), 0x08, 'native window-click packet');
      assert.equal(sent.u8(), c.windowId);
      assert.equal(sent.i16(), 0);
      assert.equal(sent.i8(), 0);
      assert.equal(sent.i16(), 1);
      assert.equal(sent.varint(), 0);
      const clicked = sent.slot();
      assert.equal(clicked.id, result.id);
      assert.equal(items.damage(clicked), 7);
      assert.equal(items.displayName(clicked), 'Server result');
      assert.equal(sent.remaining(), 0);
    }
  } finally { initRecipes({}); }
});
