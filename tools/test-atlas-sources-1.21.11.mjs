import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cropImage, runAtlasSources } from '../client/js/render/atlas-sources.js';
import { applyPalette, paletteMapping, palettedPermutationSprites } from '../client/js/render/paletted-permutations.js';
import { ZipArchive } from '../client/js/util/zip.js';
import { decodeUtf8 } from '../client/js/util/utf8.js';

const image = (width, height, data) => ({ width, height, data: Uint8Array.from(data) });

test('atlas directory and single sources add sprites without replacing existing directory sprites', async () => {
  const loaded = [];
  const result = await runAtlasSources([{ sources: [
    { type: 'minecraft:directory', source: 'block', prefix: 'block/' },
    { type: 'minecraft:single', resource: 'minecraft:entity/bell/bell_body' },
  ] }], {
    names: new Set(['block/stone']),
    list: async (dir) => dir === 'block' ? ['stone', 'custom'] : [],
    load: async (path) => { loaded.push(path); return image(1, 1, [1, 2, 3, 255]); },
  });
  assert.deepEqual([...result.add.keys()], ['block/custom', 'entity/bell/bell_body']);
  assert.deepEqual([...result.remove], []);
  await Promise.all([...result.add.values()].map((load) => load()));
  assert.deepEqual(loaded, ['block/custom', 'entity/bell/bell_body']);
});

test('atlas filters remove matching ids and unstitch crops scaled regions', async () => {
  const sheet = image(4, 2, [
    1,0,0,255, 2,0,0,255, 3,0,0,255, 4,0,0,255,
    5,0,0,255, 6,0,0,255, 7,0,0,255, 8,0,0,255,
  ]);
  const result = await runAtlasSources([{ sources: [
    { type: 'minecraft:filter', pattern: { namespace: 'minecraft', path: 'item/.*' } },
    { type: 'minecraft:unstitch', resource: 'minecraft:sheet', divisor_x: 4, divisor_y: 2,
      regions: [{ sprite: 'minecraft:stitched', x: 2, y: 0, width: 2, height: 2 }] },
  ] }], { names: new Set(['item/apple', 'block/stone']), list: async () => [], load: async () => sheet });
  assert.deepEqual([...result.remove], ['item/apple']);
  const sprite = await result.add.get('stitched')();
  assert.deepEqual([sprite.width, sprite.height], [2, 2]);
  assert.deepEqual([...sprite.data], [3,0,0,255,4,0,0,255,7,0,0,255,8,0,0,255]);
});

test('paletted permutations recolour keyed opaque pixels and retain transparent pixels', async () => {
  const key = image(2, 1, [10,20,30,255, 0,0,0,0]);
  const palette = image(2, 1, [90,80,70,128, 1,2,3,255]);
  const base = image(2, 1, [10,20,30,200, 40,50,60,0]);
  const mapping = paletteMapping(key.data, palette.data);
  assert.deepEqual([...applyPalette(base, mapping).data], [90,80,70,100, 40,50,60,0]);

  const sprites = await palettedPermutationSprites([{ sources: [{ type: 'minecraft:paletted_permutations',
    palette_key: 'minecraft:key', permutations: { copper: 'minecraft:palette' }, textures: ['minecraft:base'] }] }],
  async (path) => ({ key, palette, base })[path] || null);
  assert.equal(sprites.length, 1);
  assert.equal(sprites[0].name, 'base_copper');
  assert.deepEqual([...sprites[0].image.data], [90,80,70,100, 40,50,60,0]);
});

test('image crop copies rows from an arbitrary RGBA rectangle', () => {
  const source = image(3, 2, Array.from({ length: 24 }, (_, i) => i));
  assert.deepEqual([...cropImage(source, 1, 0, 2, 2).data], [4,5,6,7,8,9,10,11,16,17,18,19,20,21,22,23]);
});

test('pinned 1.21.11 atlas definitions contribute vanilla conduit, bell and book sprites', async () => {
  const jar = new ZipArchive(readFileSync(new URL('../cache/port-1.21.11/client.jar', import.meta.url)));
  const atlasPath = (name) => 'assets/minecraft/atlases/' + name + '.json';
  const definitions = ['blocks', 'items'].map((name) => JSON.parse(decodeUtf8(jar.read(atlasPath(name)))));
  const textures = jar.list('assets/minecraft/textures/').filter((path) => path.endsWith('.png'));
  const ids = new Set(textures.filter((path) => /\/textures\/(block|item)\//.test(path))
    .map((path) => path.replace(/^assets\/minecraft\/textures\//, '').replace(/\.png$/, '')));
  const result = await runAtlasSources(definitions, {
    names: ids,
    list: async (directory) => textures
      .filter((path) => path.startsWith('assets/minecraft/textures/' + directory + '/'))
      .map((path) => path.slice(('assets/minecraft/textures/' + directory + '/').length, -4)),
    load: async () => image(1, 1, [0,0,0,0]),
  });
  for (const sprite of ['entity/conduit/cage', 'entity/bell/bell_body', 'entity/enchanting_table_book']) {
    assert.ok(result.add.has(sprite), `expected native atlas sprite ${sprite}`);
  }
});
