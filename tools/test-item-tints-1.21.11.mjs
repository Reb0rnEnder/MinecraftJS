import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ZipFile } from '../lib/zip.js';
import { Items } from '../client/js/game/items.js';
import { createItemStack774 } from '../client/js/net/item-components-1.21.11.js';
import { ItemRenderer } from '../client/js/render/item-renderer.js';
import { ModelStore } from '../client/js/render/models.js';

const jarPath = new URL('../cache/port-1.21.11/client.jar', import.meta.url);
const jar = new ZipFile(jarPath);
const nativeJson = (path) => JSON.parse(jar.read('assets/minecraft/' + path + '.json'));
const wolfDefinition = nativeJson('items/wolf_armor');
const nativeModels = Object.fromEntries(['generated', 'wolf_armor', 'wolf_armor_dyed'].map((name) =>
  ['item/' + name, nativeJson('models/item/' + name)]));
const itemData = JSON.parse(readFileSync(new URL('../client/data/items.json', import.meta.url)));

// Native 1.21.11 references (client.txt mappings / cached CFR):
// ihd.java:82-88 (BlockModelWrapper): evaluates every tint and records each color in render-state identity.
// ggw.java:21-25 (Dye), doj.java:28-30 (DyedItemColor): effective dyed_color, otherwise the declared default.
// items/wolf_armor.json: white constant at index 0, dye at index 1; generated overlay is layer1.
function fixture({ definition = wolfDefinition, models = nativeModels, name = 'wolf_armor' } = {}) {
  // Tiny opaque sprites exercise real extrusion without a GPU or image decoder.
  const sprites = ['item/wolf_armor', 'item/wolf_armor_overlay', 'item/test_overlay'];
  const atlas = {
    size: 4,
    data: new Uint8Array(4 * 4 * 4).fill(255),
    entries: new Map(sprites.map((sprite, x) => [sprite, { x, y: 0, w: 1, h: 1, uv: [x / 4, 0, (x + 1) / 4, 1 / 4] }]))
  };
  const assets = { data: { items: itemData }, atlas, atlasTexture: {}, itemModels: { [name]: definition } };
  assets.modelStore = new ModelStore(models, {}, atlas);
  const items = new Items(assets);
  const created = [];
  const device = {
    createMesh(format, data, options) {
      const mesh = { format, data, options };
      created.push(mesh);
      return mesh;
    }
  };
  const renderer = new ItemRenderer({ assets, items, device, player: {}, settings: {} });
  const stack = (components = {}, count = 1) => createItemStack774(items.byName.get(name).id, count, {
    added: Object.entries(components).map(([type, data]) => ({ type, data })), removed: []
  });
  const draw = (item) => {
    const quads = [];
    renderer.drawItem({ quad: (...args) => quads.push(args) }, item, 3, 5, false);
    return quads;
  };
  return { renderer, stack, draw, created };
}

function meshColors(mesh) {
  assert.equal(mesh.format.name, 'entity');
  const colors = [];
  for (let offset = 8; offset < mesh.data.length; offset += mesh.format.stride) {
    colors.push(Array.from(mesh.data.subarray(offset, offset + 3)));
  }
  return colors;
}

test('wolf-armor tint regression uses the exact pinned 1.21.11 definition and model layers', () => {
  assert.equal(createHash('sha1').update(readFileSync(jarPath)).digest('hex'), 'ba2df812c2d12e0219c489c4cd9a5e1f0760f5bd');
  assert.deepEqual(wolfDefinition.model.on_true.tints, [
    { type: 'minecraft:constant', value: -1 }, { type: 'minecraft:dye', default: 0 }
  ]);
  const { renderer, stack } = fixture();
  const model = renderer.modelFor(stack({ dyed_color: 0xff0000 }));
  assert.equal(model.kind, 'generated');
  assert.equal(model.path, 'item/wolf_armor_dyed');
  assert.deepEqual(model.layers, ['item/wolf_armor', 'item/wolf_armor_overlay']);
  assert.deepEqual(model.tints, wolfDefinition.model.on_true.tints);
});

test('GUI drawItem applies the declared nonzero wolf-armor dye tint without coloring the base', () => {
  const { stack, draw } = fixture();
  for (const [dye, expected] of [[0xff0000, [1, 0, 0, 1]], [0x0000ff, [0, 0, 1, 1]], [0, [0, 0, 0, 1]]]) {
    const quads = draw(stack({ dyed_color: dye }));
    assert.equal(quads.length, 2);
    assert.deepEqual(quads.map((q) => q.at(-1)), [[1, 1, 1, 1], expected]);
    assert.deepEqual(quads[0].slice(1, 5), [3, 5, 19, 21]);
  }
});

test('distinct dyes separate GUI/cache identity while equivalent dyes share it', () => {
  const { renderer, stack } = fixture();
  const red = stack({ dyed_color: 0xff0000 }), blue = stack({ dyed_color: 0x0000ff });
  assert.strictEqual(renderer.modelFor(red), renderer.modelFor(blue), 'model definitions can remain shared');
  assert.notEqual(renderer.iconKey(red), renderer.iconKey(blue));
  assert.equal(renderer.iconKey(red), renderer.iconKey(stack({ dyed_color: 0xff0000 }, 2)));
  assert.equal(renderer.iconKey(red), renderer.iconKey(stack({ dyed_color: 0xff0000, repair_cost: 1 })));
});

test('objectFor extrudes distinct dye colors, reuses equivalent meshes, and never recolors cached vertices', () => {
  for (const held of [false, true]) {
    const { renderer, stack, created } = fixture();
    const red = stack({ dyed_color: 0xff0000 }), blue = stack({ dyed_color: 0x0000ff });
    const redObject = renderer.objectFor(red, {}, held);
    const redMesh = redObject.obj.drawables[0].mesh;
    const redVertices = redMesh.data.slice();
    const blueMesh = renderer.objectFor(blue, {}, held).obj.drawables[0].mesh;
    assert.notStrictEqual(redMesh, blueMesh);
    for (const [mesh, tint] of [[redMesh, [1, 0, 0]], [blueMesh, [0, 0, 1]]]) {
      const colors = meshColors(mesh);
      assert.equal(colors.length, 48, 'two one-pixel layers, six quads each');
      assert.deepEqual(colors.slice(0, 24), Array.from({ length: 24 }, () => [1, 1, 1]));
      assert.deepEqual(colors.slice(24), Array.from({ length: 24 }, () => tint));
    }
    assert.strictEqual(renderer.objectFor(stack({ dyed_color: 0xff0000 }), {}, held).obj.drawables[0].mesh, redMesh);
    assert.deepEqual(redMesh.data, redVertices);
    assert.equal(created.length, 2);
  }
});

test('GUI and mesh cache include declared tint index 2, not just the first two indices', () => {
  const { renderer, stack, draw } = fixture({
    name: 'stick',
    definition: { model: { type: 'minecraft:model', model: 'minecraft:item/test_tints', tints: [
      { type: 'minecraft:constant', value: -1 },
      { type: 'minecraft:constant', value: 0 },
      { type: 'minecraft:dye', default: 0x0000ff }
    ] } },
    models: { ...nativeModels, 'item/test_tints': { parent: 'minecraft:item/generated', textures: {
      layer0: 'minecraft:item/wolf_armor', layer1: 'minecraft:item/wolf_armor_overlay', layer2: 'minecraft:item/test_overlay'
    } } }
  });
  const red = stack({ dyed_color: 0xff0000 }), fallback = stack();
  assert.deepEqual(draw(red).map((q) => q.at(-1)), [[1, 1, 1, 1], [0, 0, 0, 1], [1, 0, 0, 1]]);
  assert.deepEqual(draw(fallback).map((q) => q.at(-1)), [[1, 1, 1, 1], [0, 0, 0, 1], [0, 0, 1, 1]]);
  assert.notEqual(renderer.iconKey(red), renderer.iconKey(fallback));
  const redMesh = renderer.objectFor(red, {}).obj.drawables[0].mesh;
  const fallbackMesh = renderer.objectFor(fallback, {}).obj.drawables[0].mesh;
  assert.notStrictEqual(redMesh, fallbackMesh);
  assert.deepEqual(meshColors(redMesh).slice(48), Array.from({ length: 24 }, () => [1, 0, 0]));
  assert.deepEqual(meshColors(fallbackMesh).slice(48), Array.from({ length: 24 }, () => [0, 0, 1]));
});

test('undyed native wolf armor remains one white layer without declared tints', () => {
  const { renderer, stack, draw } = fixture();
  const item = stack();
  assert.equal(renderer.modelFor(item).path, 'item/wolf_armor');
  assert.equal(renderer.modelFor(item).tints, undefined);
  assert.deepEqual(draw(item).map((q) => q.at(-1)), [[1, 1, 1, 1]]);
});

test('generated models without declarations retain legacy per-item tint fallback and cache separation', () => {
  const { renderer, stack, draw } = fixture({
    name: 'leather_helmet', definition: null,
    models: { ...nativeModels, 'item/leather_helmet': { parent: 'minecraft:item/generated', textures: {
      layer0: 'minecraft:item/wolf_armor', layer1: 'minecraft:item/wolf_armor_overlay'
    } } }
  });
  const red = stack({ dyed_color: 0xff0000 }), blue = stack({ dyed_color: 0x0000ff });
  assert.equal(renderer.modelFor(red).tints, undefined);
  assert.deepEqual(draw(red).map((q) => q.at(-1)), [[1, 0, 0, 1], [1, 1, 1, 1]]);
  assert.notEqual(renderer.iconKey(red), renderer.iconKey(blue));
  assert.notStrictEqual(renderer.meshFor(red).mesh, renderer.meshFor(blue).mesh);
});
