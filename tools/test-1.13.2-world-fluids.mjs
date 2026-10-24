// Offline integration: real jar assets -> chunk/world -> worker slice -> packed mesh + fluid physics.
// Run: node tools/test-1.13.2-world-fluids.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ZipFile } from '../lib/zip.js';
import { decodePng } from '../client/js/util/png.js';
import { Atlas, AtlasLookup } from '../client/js/render/atlas.js';
import { ModelStore } from '../client/js/render/models.js';
import { Mesher, BYTES_PER_VERTEX } from '../client/js/render/mesher.js';
import { initBlocks, findState, blocksByName, staticCollisionBoxes } from '../client/js/world/blocks.js';
import { initBiomes, grassColor, foliageColor } from '../client/js/world/biomes.js';
import { World } from '../client/js/world/world.js';
import { Chunk } from '../client/js/world/chunk.js';
import { buildSlice, SliceWorld } from '../client/js/world/slice.js';
import { LocalPlayer } from '../client/js/game/physics.js';
import { BoatController } from '../client/js/game/vehicle.js';
import { getFluidState, fluidHeightAt, isPointInFluid } from '../client/js/world/fluids.js';
import { Interaction } from '../client/js/game/interaction.js';

const data = name => JSON.parse(readFileSync(new URL('../client/data/' + name + '.json', import.meta.url)));
initBlocks(data('blocks'), data('blockCollisionShapes'));
const jar = new ZipFile(process.env.MC_JAR || fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));
const prefix = 'assets/minecraft/';
const jsonAssets = dir => Object.fromEntries(jar.list(prefix + dir + '/').filter(p => p.endsWith('.json'))
  .map(p => [p.slice((prefix + dir + '/').length, -5), JSON.parse(jar.read(p))]));
const textures = jar.list(prefix + 'textures/block/').filter(p => p.endsWith('.png'))
  .map(p => ({ name: p.slice((prefix + 'textures/').length, -4), image: decodePng(jar.read(p)) }));
const meta = {};
for (const t of textures) {
  const raw = jar.read(prefix + 'textures/' + t.name + '.png.mcmeta');
  if (raw) meta[t.name] = JSON.parse(raw);
}
const atlas = new Atlas();
atlas.build(textures, meta);
const store = new ModelStore(jsonAssets('models'), jsonAssets('blockstates'), new AtlasLookup(atlas.exportLookup()));
initBiomes(data('biomes'), decodePng(jar.read(prefix + 'textures/colormap/grass.png')).data,
  decodePng(jar.read(prefix + 'textures/colormap/foliage.png')).data);
const state = (name, props = {}) => {
  assert.ok(blocksByName[name], 'Registered block: ' + name);
  return findState(name, props);
};
const at = (s, x = 8, y = 8, z = 8) => [x, y, z, s];
function worldOf(placements, biome = 1) {
  const w = new World();
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
    const c = new Chunk(x, z, true); c.biomes.fill(biome); w.chunks.set(World.key(x, z), c);
  }
  for (const [x, y, z, s] of placements) w.getChunk(x >> 4, z >> 4).setState(x & 15, y, z & 15, s);
  return w;
}
function mesh(placements, biome = 1) {
  const w = worldOf(placements, biome);
  const slice = new SliceWorld(buildSlice(w, 0, 0, 0));
  const m = new Mesher(slice, store); m.options.smooth = 0;
  return m.buildSection(slice, 0, 0, 0);
}
const quads = buf => buf.byteLength / (4 * BYTES_PER_VERTEX);
const colors = buf => Array.from({ length: buf.byteLength / BYTES_PER_VERTEX }, (_, i) =>
  Array.from(buf.subarray(i * BYTES_PER_VERTEX + 12, i * BYTES_PER_VERTEX + 15)));

test('worker slice retains direct states below 16 (including grass blocks)', () => {
  for (const s of [state('stone'), state('grass_block', { snowy: false }), state('oak_planks')]) {
    const result = mesh([at(s)]);
    assert.ok(result, 'Nonempty low-ID section ' + s);
    assert.ok(result.solid.byteLength + result.cutout.byteLength > 0);
  }
});

test('grass, tall plants, vines and sugar cane receive biome tint, not gray/white vertices', () => {
  for (const name of ['grass', 'tall_grass', 'fern', 'large_fern', 'vine', 'sugar_cane']) {
    const result = mesh([at(state(name))]);
    assert.ok(result?.cutout.byteLength, name + ': real plant mesh');
    const cs = colors(result.cutout);
    assert.ok(cs.every(([r, g, b]) => g > r && g > b), name + ': green tint on every vertex');
  }
  const grass = mesh([at(state('grass'))], 1).cutout;
  const desert = mesh([at(state('grass'))], 2).cutout;
  assert.notDeepEqual(colors(grass), colors(desert), 'Tint varies with biome');
});

test('grass-block overlay and leaves retain their intended tints', () => {
  const m = new Mesher(null, store);
  m.world = { getBiome: () => 1 };
  assert.equal(m.tintFor(state('grass_block'), 0, 8, 8, 8), grassColor(1, 8));
  assert.equal(m.tintFor(state('oak_leaves'), 0, 8, 8, 8), foliageColor(1, 8));
  assert.equal(m.tintFor(state('spruce_leaves'), 0, 8, 8, 8), 0x619961);
  assert.equal(m.tintFor(state('birch_leaves'), 0, 8, 8, 8), 0x80a755);
  assert.equal(m.tintFor(state('stone'), -1, 8, 8, 8), 0xffffff);
});

const logged = ['oak_slab', 'oak_stairs', 'oak_fence', 'glass_pane', 'ladder', 'oak_trapdoor', 'sign', 'chest'];
test('waterlogged blocks emit water in addition to their unchanged block geometry/collision', () => {
  for (const name of logged) {
    const props = { type: 'bottom', half: 'bottom', shape: 'straight', facing: 'north', open: false };
    const pick = wet => state(name, Object.fromEntries(Object.entries({ ...props, waterlogged: wet })
      .filter(([key, value]) => blocksByName[name].stateProperties.some(p => p.name === key && (!p.values || p.values.includes(String(value)))))));
    const dry = pick(false), wet = pick(true);
    assert.notEqual(wet, dry, name + ': distinct global states');
    const d = mesh([at(dry)]), w = mesh([at(wet)]);
    assert.equal(d.translucent.byteLength, 0, name + ': dry block has no fluid');
    assert.ok(w.translucent.byteLength > 0, name + ': source water mesh');
    assert.deepEqual(w.solid, d.solid, name + ': solid model preserved');
    assert.deepEqual(w.cutout, d.cutout, name + ': cutout model preserved');
    assert.deepEqual(staticCollisionBoxes(wet), staticCollisionBoxes(dry), name + ': collision preserved');
  }
});

test('aquatic plants emit both the plant and source water', () => {
  for (const name of ['seagrass', 'tall_seagrass', 'kelp', 'kelp_plant']) {
    const result = mesh([at(state(name))]);
    assert.ok(result.cutout.byteLength, name + ': plant');
    assert.ok(result.translucent.byteLength, name + ': water');
  }
});

test('waterlogged neighbors join source water across a section boundary', () => {
  const s = state('oak_slab', { type: 'bottom', waterlogged: true });
  const water = state('water', { level: 0 });
  const alone = mesh([at(s, 15)]);
  const joined = mesh([at(s, 15), at(water, 16)]);
  assert.ok(quads(alone.translucent) > quads(joined.translucent), 'Shared water face is removed');
  assert.ok(joined.translucent.byteLength, 'Exposed water faces remain');
});

test('waterlogged blocks affect immersion and boats without replacing collision with water', () => {
  for (const name of ['oak_slab', 'oak_stairs', 'glass_pane', 'seagrass']) {
    const props = { waterlogged: true, type: 'bottom', half: 'bottom', shape: 'straight', facing: 'north' };
    const wet = state(name, Object.fromEntries(Object.entries(props)
      .filter(([key]) => blocksByName[name].stateProperties.some(p => p.name === key))));
    const w = worldOf([at(wet)]);
    const player = new LocalPlayer(); player.setPosition(8.25, 8.5, 8.25);
    assert.equal(player.handleWaterMovement(w), true, name + ': player immersed');
    assert.equal(player.inLava, false);
    assert.ok(player.flowVector(w, 8, 8, 8, false).every(Number.isFinite));
    player.setPosition(8.25, 8.95, 8.25);
    assert.equal(player.handleWaterMovement(w), false, name + ': above fluid surface');
  }
  const wet = state('oak_slab', { type: 'bottom', waterlogged: true });
  const w = worldOf([at(wet)]);
  const boat = new BoatController(w, { x: 8.5, y: 8.6, z: 8.5, yaw: 0 });
  assert.equal(boat._checkInWater(), true, 'Boat floats on logged source water');
  const boxes = []; w.collisionBoxes(8, 8, 8, boxes);
  assert.deepEqual(boxes, [[8, 8, 8, 9, 8.5, 9]], 'Water does not erase slab collision');
});

test('ordinary flowing water and lava remain finite and distinct from dry blocks', () => {
  for (const name of ['water', 'lava']) for (const level of [0, 3, 7, 8, 15]) {
    const s = state(name, { level }), result = mesh([at(s)]);
    assert.ok(result.translucent.byteLength, name + ': level ' + level);
    assert.equal(result.solid.byteLength + result.cutout.byteLength, 0);
  }
  const p = new LocalPlayer(); p.setPosition(8.5, 8, 8.5);
  assert.equal(p.handleWaterMovement(worldOf([at(state('oak_slab', { type: 'bottom', waterlogged: false }))])), false);
  assert.equal(p.handleWaterMovement(worldOf([at(state('lava', { level: 0 }))])), false);
});

test('every waterloggable block has a separate source fluid without changing its block identity', () => {
  let tested = 0;
  for (const block of Object.values(blocksByName)) {
    if (!block.stateProperties.some(p => p.name === 'waterlogged')) continue;
    const wet = findState(block.name, { waterlogged: true });
    const dry = findState(block.name, { waterlogged: false });
    assert.equal(getFluidState(dry), null, block.name + ': dry');
    assert.equal(getFluidState(wet)?.source, true, block.name + ': source');
    assert.equal(getFluidState(wet)?.isWater, true, block.name + ': water, not lava');
    tested++;
  }
  assert.ok(tested > 20, 'Waterlogging is not restricted to the hand-picked mesh fixtures');
});

test('camera/HUD/mining fluid checks respect waterlogged surface height and water above', () => {
  const wet = state('oak_slab', { type: 'bottom', waterlogged: true });
  const w = worldOf([at(wet)]);
  assert.equal(fluidHeightAt(w, 8, 8, 8), 8 / 9);
  assert.equal(isPointInFluid(w, 8.5, 8.7, 8.5), true);
  assert.equal(isPointInFluid(w, 8.5, 8.95, 8.5), false);
  assert.equal(isPointInFluid(w, 8.5, 8.7, 8.5, true), false);
  const pl = new LocalPlayer(); pl.setPosition(8.5, 8.7 - pl.eyeHeight(), 8.5);
  assert.equal(Interaction.prototype._eyesInWater.call({ game: { world: w }, player: pl }), true);
  const stacked = worldOf([at(wet), at(state('water', { level: 0 }), 8, 9)]);
  assert.equal(fluidHeightAt(stacked, 8, 8, 8), 1);
  assert.equal(isPointInFluid(stacked, 8.5, 8.95, 8.5), true);
});

test('water uses biome-blue vertices and slabs occlude their solid faces, not the fluid itself', () => {
  const horizontal = buf => {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), ys = [];
    for (let i = 0; i < buf.byteLength; i += 4 * BYTES_PER_VERTEX) {
      const y = Array.from({ length: 4 }, (_, v) => view.getUint16(i + v * BYTES_PER_VERTEX + 2, true) / 2048 - 8);
      if (y.every(v => v === y[0])) ys.push(y[0]);
    }
    return ys;
  };
  const bottom = mesh([at(state('oak_slab', { type: 'bottom', waterlogged: true }))]).translucent;
  assert.ok(colors(bottom).every(([r, g, b]) => b > g && g > r), '1.13 grayscale water is tinted blue');
  assert.ok(horizontal(bottom).every(y => y > 8.5), 'No water bottom coplanar with the solid bottom slab');
  const top = mesh([at(state('oak_slab', { type: 'top', waterlogged: true }))]).translucent;
  assert.ok(top.byteLength > 0, 'Water remains below the top slab');
  assert.ok(horizontal(top).every(y => y < 8.5), 'Top slab covers the internal water surface');
});
