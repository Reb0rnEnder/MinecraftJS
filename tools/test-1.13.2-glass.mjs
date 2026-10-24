// Run: node tools/test-1.13.2-glass.mjs
// Uses the local vanilla jar (MC_JAR or cache/1.13.2.jar); never downloads assets.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ZipFile } from '../lib/zip.js';
import { decodePng } from '../client/js/util/png.js';
import { Atlas, AtlasLookup } from '../client/js/render/atlas.js';
import { ModelStore } from '../client/js/render/models.js';
import { Mesher, BYTES_PER_VERTEX } from '../client/js/render/mesher.js';
import { initBlocks, blocksByName, getBlock, findState, DIR_NAMES, DIR_OFFSETS } from '../client/js/world/blocks.js';
import { initBiomes } from '../client/js/world/biomes.js';

const readData = (name) => JSON.parse(readFileSync(new URL('../client/data/' + name + '.json', import.meta.url)));
initBlocks(readData('blocks'), readData('blockCollisionShapes'));
const jar = new ZipFile(process.env.MC_JAR || fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));
const prefix = 'assets/minecraft/';
const jsonAssets = (dir) => Object.fromEntries(jar.list(prefix + dir + '/').filter((p) => p.endsWith('.json'))
  .map((p) => [p.slice((prefix + dir + '/').length, -5), JSON.parse(jar.read(p))]));
const textures = jar.list(prefix + 'textures/block/').filter((p) => p.endsWith('.png'))
  .map((p) => ({ name: p.slice((prefix + 'textures/').length, -4), image: decodePng(jar.read(p)) }));
const mcmeta = {};
for (const t of textures) {
  const raw = jar.read(prefix + 'textures/' + t.name + '.png.mcmeta');
  if (raw) mcmeta[t.name] = JSON.parse(raw);
}
const atlas = new Atlas();
atlas.build(textures, mcmeta);
const store = new ModelStore(jsonAssets('models'), jsonAssets('blockstates'), new AtlasLookup(atlas.exportLookup()));
initBiomes(readData('biomes'), decodePng(jar.read(prefix + 'textures/colormap/grass.png')).data,
  decodePng(jar.read(prefix + 'textures/colormap/foliage.png')).data);

const colors = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray',
  'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const glassNames = ['glass', ...colors.map((c) => c + '_stained_glass')];
const paneNames = ['glass_pane', ...colors.map((c) => c + '_stained_glass_pane')];
const leaves = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'].map((w) => w + '_leaves');
const layers = ['solid', 'cutout', 'translucent'];
const origin = [8, 8, 8];
const state = (name) => {
  assert.ok(blocksByName[name], name);
  const s = blocksByName[name].defaultState;
  assert.equal(getBlock(s).name, name, name + ': direct global state lookup');
  return s;
};
const paneState = (name, props = {}) => findState(name, {
  north: false, south: false, east: false, west: false, waterlogged: false, ...props,
});
const at = (s, pos = origin) => [...pos, s];

// Only the world input is synthetic. Initialization, PNG alpha detection, atlas lookup,
// multipart/model baking, state resolution, culling and packed mesh output are production code.
function mesh(placements, options = {}, lod = false) {
  const cells = new Map(placements.map(([x, y, z, s]) => [[x, y, z].join(','), s]));
  const section = new Uint16Array(4096);
  for (const [x, y, z, s] of placements) {
    if ([x, y, z].every((v) => v >= 0 && v < 16)) section[(y << 8) | (z << 4) | x] = s;
  }
  const world = {
    getState: (x, y, z) => cells.get([x, y, z].join(',')) || 0,
    getLight: () => 0xf0,
    getBiome: () => 1,
    getSectionBlocks: () => section,
  };
  const mesher = new Mesher(world, store);
  Object.assign(mesher.options, options);
  // Reject missing assets instead of silently accepting the atlas's stone fallback.
  for (const [x, y, z, s] of placements) {
    const model = mesher.getModel(s, x, y, z);
    assert.ok(model?.quads.length, getBlock(s).name + ': real jar model');
    for (const q of model.quads) assert.ok(atlas.has(q.tex), 'missing jar texture: ' + q.tex);
  }
  return mesher.buildSection(world, 0, 0, 0, lod);
}

function expectLayers(result, expected, label) {
  const counts = {};
  for (const layer of layers) {
    assert.equal(result[layer].byteLength % (4 * BYTES_PER_VERTEX), 0, label + ': packed quads');
    counts[layer] = result[layer].byteLength / (4 * BYTES_PER_VERTEX);
  }
  assert.deepEqual(counts, { solid: 0, cutout: 0, translucent: 0, ...expected }, label);
}

// Inspect positions in the actual packed buffers, not shouldRenderFace's return value.
function facesOnPlane(buffer, axis, plane) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let count = 0;
  for (let q = 0; q < buffer.byteLength; q += 4 * BYTES_PER_VERTEX) {
    let onPlane = true;
    for (let v = 0; v < 4; v++) {
      const pos = view.getUint16(q + v * BYTES_PER_VERTEX + axis * 2, true) / 2048 - 8;
      if (Math.abs(pos - plane) > 1 / 2048) onPlane = false;
    }
    if (onPlane) count++;
  }
  return count;
}

const layerFor = (name) => name === 'glass' || name === 'glass_pane' ? 'cutout' : 'translucent';
const alphaValues = (name) => new Set(textures.find((t) => t.name === 'block/' + name).image.data.filter((_, i) => i % 4 === 3));

test('jar alpha distinguishes clear cutout glass from every stained glass color', () => {
  for (const name of ['glass', 'glass_pane_top', ...leaves]) {
    assert.deepEqual([...alphaValues(name)].sort((a, b) => a - b), [0, 255], name);
  }
  for (const name of [...colors.map((c) => c + '_stained_glass'), ...colors.map((c) => c + '_stained_glass_pane_top'), 'ice']) {
    assert.ok([...alphaValues(name)].some((a) => a > 0 && a < 255), name + ': needs alpha blending');
  }
});

test('all 16 stained cubes and panes emit blended geometry, including fast/LOD', () => {
  for (const name of [...glassNames.slice(1), ...paneNames.slice(1)]) {
    for (const mode of ['fancy', 'fast', 'lod']) {
      const result = mesh([at(state(name))], { fancy: mode !== 'fast' }, mode === 'lod');
      expectLayers(result, { translucent: 6 }, name + ' ' + mode);
    }
    assert.equal(blocksByName[name].opaque, false, name);
    assert.equal(blocksByName[name].translucent, true, name);
    assert.equal(blocksByName[name].aoLight, 1, name);
  }
});

test('clear glass and clear panes use alpha-tested cutout, not solid or blended', () => {
  for (const name of ['glass', 'glass_pane']) {
    expectLayers(mesh([at(state(name))]), { cutout: 6 }, name);
    assert.equal(blocksByName[name].opaque, false, name);
    assert.equal(blocksByName[name].translucent, false, name);
  }
});

test('glass cube interiors cull only matching blocks; opaque neighbors retain their visible face', () => {
  for (const name of glassNames) {
    const s = state(name), layer = layerFor(name);
    for (let dir = 0; dir < 6; dir++) {
      const otherPos = origin.map((v, i) => v + DIR_OFFSETS[dir][i]);
      const axis = [1, 1, 2, 2, 0, 0][dir], plane = origin[axis] + (dir & 1);
      let result = mesh([at(s), at(s, otherPos)]);
      expectLayers(result, { [layer]: 10 }, name + ' interior ' + DIR_NAMES[dir]);
      assert.equal(facesOnPlane(result[layer], axis, plane), 0, name + ': no shared faces');
      result = mesh([at(s), at(state('stone'), otherPos)]);
      expectLayers(result, { solid: 6, [layer]: 5 }, name + ' / stone ' + DIR_NAMES[dir]);
      assert.equal(facesOnPlane(result.solid, axis, plane), 1, name + ': stone visible through glass');
      assert.equal(facesOnPlane(result[layer], axis, plane), 0, name + ': glass hidden against stone');
    }
    const other = state(name === 'white_stained_glass' ? 'orange_stained_glass' : 'white_stained_glass');
    const mixed = mesh([at(s), at(other, [9, 8, 8])]);
    expectLayers(mixed, name === 'glass' ? { cutout: 6, translucent: 6 } : { translucent: 12 }, name + ': different glass');
    assert.equal(layers.reduce((n, l) => n + facesOnPlane(mixed[l], 0, 9), 0), 2, name + ': keep different glass boundary');
    expectLayers(mesh([at(s, [15, 8, 8]), at(s, [16, 8, 8])]), { [layer]: 5 }, name + ': section boundary');
  }
  expectLayers(mesh([at(state('stone')), at(state('stone'), [9, 8, 8])]), { solid: 10 }, 'opaque pair');
});

test('connected panes cull matching end caps by block identity and opposing connections', () => {
  for (const name of paneNames) {
    const layer = layerFor(name);
    for (const dir of [2, 3, 4, 5]) {
      const opposite = dir ^ 1;
      const otherPos = origin.map((v, i) => v + DIR_OFFSETS[dir][i]);
      const axis = dir < 4 ? 2 : 0, plane = origin[axis] + (dir & 1);
      const own = paneState(name, { [DIR_NAMES[dir]]: true });
      // Different global states (connections + waterlogging) still share one glass type.
      const neighbor = paneState(name, { [DIR_NAMES[opposite]]: true, waterlogged: true });
      assert.notEqual(own, neighbor);
      let result = mesh([at(own), at(neighbor, otherPos)]);
      // The wet pane now also emits six double-sided water faces. Keep the
      // original 18-pane-quad assertion AND verify the added fluid geometry.
      expectLayers(result, { [layer]: 18, translucent: (layer === 'translucent' ? 18 : 0) + 12 }, name + ' connected ' + DIR_NAMES[dir]);
      assert.equal(facesOnPlane(result[layer], axis, plane), 0, name + ': no interior end caps');
      result = mesh([at(own), at(paneState(name), otherPos)]);
      expectLayers(result, { [layer]: 16 }, name + ': unconnected neighbor');
      assert.equal(facesOnPlane(result[layer], axis, plane), 1, name + ': exposed end cap retained');
      result = mesh([at(own), at(state('stone'), otherPos)]);
      expectLayers(result, { solid: 6, [layer]: 9 }, name + ': opaque neighbor');
      assert.equal(facesOnPlane(result.solid, axis, plane), 1, name + ': pane cannot hide stone');
      assert.equal(facesOnPlane(result[layer], axis, plane), 0, name + ': cap against stone culled');
    }
    // The jar leaves the post's top/bottom unculled: do not erase non-cullface quads.
    const stacked = mesh([at(paneState(name)), at(paneState(name), [8, 9, 8])]);
    expectLayers(stacked, { [layer]: 12 }, name + ': stacked posts');
    assert.equal(facesOnPlane(stacked[layer], 1, 9), 2, name + ': jar post caps preserved');
  }
  const mixed = mesh([at(paneState('white_stained_glass_pane', { east: true })),
    at(paneState('orange_stained_glass_pane', { west: true }), [9, 8, 8])]);
  expectLayers(mixed, { translucent: 20 }, 'different pane colors');
  assert.equal(facesOnPlane(mixed.translucent, 0, 9), 2, 'different pane colors retain caps');
});

test('ice remains blended, packed/blue ice solid, and frosted ages share interior culling', () => {
  for (const name of ['ice', 'frosted_ice']) {
    const own = state(name), neighbor = blocksByName[name].minStateId;
    expectLayers(mesh([at(own)]), { translucent: 6 }, name);
    const result = mesh([at(own), at(neighbor, [9, 8, 8])]);
    expectLayers(result, { translucent: 10 }, name + ': same block interior');
    assert.equal(facesOnPlane(result.translucent, 0, 9), 0, name);
    expectLayers(mesh([at(own), at(state('stone'), [9, 8, 8])]), { solid: 6, translucent: 5 }, name + ' / stone');
  }
  const frosted = mesh([at(findState('frosted_ice', { age: 0 })), at(findState('frosted_ice', { age: 3 }), [9, 8, 8])]);
  expectLayers(frosted, { translucent: 10 }, 'different frosted ice ages');
  for (const name of ['packed_ice', 'blue_ice']) expectLayers(mesh([at(state(name))]), { solid: 6 }, name);
});

test('all leaves remain cutout in fancy and solid in fast/LOD with existing face culling', () => {
  for (const name of leaves) {
    const s = state(name);
    assert.equal(blocksByName[name].opaque, false, name);
    assert.equal(blocksByName[name].translucent, false, name);
    expectLayers(mesh([at(s)]), { cutout: 6 }, name + ' fancy');
    expectLayers(mesh([at(s), at(s, [9, 8, 8])]), { cutout: 12 }, name + ' fancy interiors');
    expectLayers(mesh([at(s), at(s, [9, 8, 8])], { fancy: false }), { solid: 10 }, name + ' fast');
    expectLayers(mesh([at(s), at(s, [9, 8, 8])], {}, true), { solid: 10 }, name + ' lod');
    expectLayers(mesh([at(s), at(state('stone'), [9, 8, 8])]), { solid: 6, cutout: 5 }, name + ' / stone fancy');
  }
});
