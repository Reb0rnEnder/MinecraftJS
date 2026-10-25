// Run with Node 22+: node tools/test-1.13.2-entity-models.mjs
// Reads the local jar and client modules; no asset build, downloads or GPU needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as M from '../client/js/render/entity-models.js';
import { setModelDevice } from '../client/js/render/boxmodel.js';
import { EntityRenderer } from '../client/js/render/entity-renderer.js';
import { TileEntityRenderer } from '../client/js/render/tile-renderer.js';
import { Node } from '../client/js/gfx/scene.js';
import { initBlocks, findState } from '../client/js/world/blocks.js';
import { testEntityGeometry } from './test-1.13.2-entity-geometry.mjs';

const require = createRequire(import.meta.url);
const { ZipFile } = require('../lib/zip.js');
const { extractModels, assertCompleteModels } = require('../lib/modelextract.js');
const jar = new ZipFile(process.env.MC_JAR || fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));
const { models, errors } = extractModels(jar);

// Keep this independent of the extractor's spec list so accidentally deleting a spec fails too.
const expected = `creeper creeperArmor skeleton strayOverlay spider zombie zombieVillager slime slimeOuter
  ghast enderman silverfish blaze magmaCube wither witherSkull bat witch endermite guardian shulker pig
  pigSaddle sheep sheepWool cow chicken squid wolf snowman ocelot ironGolem horse rabbit villager dragon
  polarBear llama parrot vex illager armorStand elytra boat minecart enderCrystal enderCrystalNoBase
  leash evokerFangs llamaSpit shulkerBullet chest largeChest sign book bed skull dragonHead humanoidHead
  banner shield biped armorInner armorOuter player playerSlim
  drowned drownedOuter donkey llamaDecor cod salmon pufferfishSmall pufferfishMedium pufferfishBig
  tropicalFishA tropicalFishB tropicalFishPatternA tropicalFishPatternB dolphin turtle phantom trident`.split(/\s+/);
assert.deepEqual(errors, [], `Extraction errors:\n${errors.join('\n')}`);
assert.deepEqual(Object.keys(models).sort(), expected.sort(), 'Complete client model set');
assert.equal(assertCompleteModels({ models, errors }), models, 'Build/proxy accept complete extraction');
assert.throws(() => assertCompleteModels({ models, errors: ['test extraction failure'] }), /test extraction failure/);
for (const name of expected) {
  assert.throws(() => assertCompleteModels({ models: { ...models, [name]: undefined }, errors: [] }),
    new RegExp(name + ': missing or empty model'), 'Build/proxy reject omitted required models');
  assert.throws(() => assertCompleteModels({ models: { ...models, [name]: { parts: [] } }, errors: [] }),
    new RegExp(name + ': missing or empty model'), 'Empty placeholders are not a repair');
}

let boxCount = 0;
for (const [name, model] of Object.entries(models)) {
  assert.ok(model.fields.length && model.parts.length, `${name}: nonempty fields/parts`);
  assert.ok(model.nums.every(Number.isFinite), `${name}: finite numeric fields`);
  const ref = (i) => assert.ok(i === null || (Number.isInteger(i) && i >= 0 && i < model.parts.length), `${name}: part reference ${i}`);
  model.fields.flat().forEach(ref);
  let boxes = 0;
  for (const part of model.parts) {
    assert.ok(Number.isFinite(part.tw) && part.tw > 0 && Number.isFinite(part.th) && part.th > 0, `${name}: texture size`);
    for (const xyz of [part.p, part.r]) {
      assert.equal(xyz.length, 3);
      assert.ok(xyz.every(Number.isFinite), `${name}: finite pose`);
    }
    part.children.forEach(ref);
    for (const box of part.boxes) {
      assert.equal(box.length, 10, `${name}: box record`);
      assert.ok(box.slice(0, 9).every(Number.isFinite), `${name}: finite box coordinates/UVs/inflation`);
      assert.ok(box.slice(5, 8).every((n) => n >= 0), `${name}: nonnegative dimensions`);
      assert.equal(typeof box[9], 'boolean', `${name}: mirror flag`);
      boxes++;
    }
  }
  assert.ok(boxes > 0, `${name}: nonempty geometry`);
  boxCount += boxes;
}

// Expected layouts from the actual 1.13.2 constructors, including inherited head/llama fields,
// both paddle boxes, the optional crystal base, and the dragon jaw's parent/child relationship.
const recovered = {
  boat: [[[0, 1, 2, 3, 4], [5, 6], 7], [1, 1, 1, 1, 1, 2, 2, 1]],
  snowman: [[0, 1, 2, 3, 4], [1, 1, 1, 1, 1]],
  llama: [[0, 1, 2, 3, 4, 5, 6, 7], [4, 1, 1, 1, 1, 1, 1, 1]],
  enderCrystal: [[0, 1, 2], [1, 1, 1]],
  enderCrystalNoBase: [[0, 1, null], [1, 1]],
  evokerFangs: [[0, 1, 2], [1, 1, 1]],
  skull: [[0], [1]],
  dragonHead: [[0, 1], [6, 1]],
  humanoidHead: [[0, 1], [1, 1]],
};
for (const [name, [fields, counts]] of Object.entries(recovered)) {
  assert.deepEqual(models[name].fields, fields, `${name}: field layout`);
  assert.deepEqual(models[name].parts.map((p) => p.boxes.length), counts, `${name}: part/box counts`);
}
assert.deepEqual(models.boat.parts[0].boxes[0].slice(2, 8), [-14, -9, -3, 28, 16, 3]);
assert.deepEqual(models.boat.parts[7].p, [0, -3, 1], 'Boat water mask pivot');
assert.deepEqual(models.snowman.parts[2].boxes[0].slice(5, 9), [8, 8, 8, -0.5]);
assert.deepEqual(models.llama.parts[0].boxes[0].slice(5, 8), [4, 4, 9]);
assert.deepEqual(models.enderCrystal.parts[2].boxes[0].slice(5, 8), [12, 4, 12]);
assert.deepEqual(models.enderCrystalNoBase.parts, models.enderCrystal.parts.slice(0, 2));
assert.deepEqual(models.evokerFangs.parts.map((p) => p.boxes[0].slice(5, 8)), [[10, 12, 10], [4, 14, 8], [4, 14, 8]]);
assert.deepEqual(models.skull.parts[0].boxes[0], [0, 0, -4, -8, -4, 8, 8, 8, 0, false]);
assert.deepEqual(models.dragonHead.parts[0].children, [1]);
assert.deepEqual(models.dragonHead.parts[1].p, [0, 4, -8]);
assert.deepEqual(models.humanoidHead.parts[1].boxes[0], [32, 0, -4, -8, -4, 8, 8, 8, 0.25, false]);

// --built additionally checks the actual bundle served by the static client after npm run assets.
const bundle = process.argv.includes('--built')
  ? JSON.parse(readFileSync(new URL('../client/assets/bundles/entity-models.json', import.meta.url)))
  : JSON.parse(JSON.stringify(models));
assert.deepEqual(bundle, models, 'Served bundle matches complete jar extraction');
M.setJarModels(bundle);
let meshCount = 0;
const device = {
  createMesh(format, vertices, opts={}) {
    assert.ok(vertices.every(Number.isFinite), 'Finite generated vertices (including UVs/normals)');
    meshCount++;
    return { vertices, dynamic:!!opts.dynamic };
  },
};
setModelDevice(device);
const checkTree = (root) => {
  root.updateWorld();
  const draws = root.collect([]);
  assert.ok(draws.length > 0, 'Nonempty client drawables');
  for (const { d, world } of draws) {
    assert.ok(d.mesh.dynamic || d.mesh.vertices.length > 0, 'Nonempty static client mesh (ground-projected shadows populate dynamic buffers at render time)');
    assert.ok(world.every(Number.isFinite), 'Finite world transform');
    if (typeof d.mat?.tex === 'string') {
      assert.ok(jar.read('assets/minecraft/textures/' + d.mat.tex), 'Missing renderer texture: ' + d.mat.tex);
    }
  }
};
for (const [name, model] of Object.entries(models)) {
  const parts = M.J(name, model.fields.map((_, i) => `field${i}`));
  const root = new Node();
  for (const part of Object.values(parts).flat()) if (part) root.add(part.build());
  checkTree(root);
}
for (const model of [M.boat(), M.snowman()]) {
  const root = new Node();
  for (const part of model.roots) root.add(part.build());
  model.animate(model, { rowing: [0.4, 1.2], yaw: 30, pitch: 15 });
  for (const part of model.roots) part.sync();
  checkTree(root);
}

// Reproduce the two original crash paths, with a CPU-only device and the real block registry.
initBlocks(require('../client/data/blocks.json'), null);
let state = findState('skeleton_skull');
const game = {
  device,
  renderer: { entityRoot: new Node(), extraDraws: [] },
  assets: {},
  world: { getState: () => state },
};
const entities = new EntityRenderer(game);
for (let boatType = 0; boatType < 6; boatType++) {
  checkTree(entities._build({ id: 10 + boatType, kind: 'boat', boatType }).root);
}
assert.ok(jar.read('assets/minecraft/textures/' + entities._texFor({ type: 97 })), 'Snow golem texture');
for (const showBottom of [true, false]) checkTree(entities._build({ id: showBottom ? 2 : 3, kind: 'crystal', showBottom }).root);
const tiles = new TileEntityRenderer(game);
const skulls = ['skeleton_skull', 'wither_skeleton_skull', 'zombie_head', 'player_head', 'creeper_head', 'dragon_head'];
for (const [type, name] of skulls.entries()) {
  for (const [variant, props] of [[name, { rotation: 5 }], [name.replace(/_(skull|head)$/, '_wall_$1'), { facing: 'west' }]]) {
    state = findState(variant, props);
    assert.ok(state > 0, `${variant}: block state exists`);
    const tile = tiles._ensure(type, props.facing ? 1 : 0, 0, state);
    assert.ok(tile && tile.type === 'skull', `${variant}: discovered without legacy SkullType NBT`);
    tiles._build(tile);
    assert.equal(tile.built, true);
    checkTree(tile.obj);
    const tex = ['entity/skeleton/skeleton.png', 'entity/skeleton/wither_skeleton.png', 'entity/zombie/zombie.png',
      'entity/steve.png', 'entity/creeper/creeper.png', 'entity/enderdragon/dragon.png'][type];
    assert.ok(tile.obj.collect([]).every(({ d }) => d.mat.tex === tex), `${variant}: texture from block identity`);
    const outer = tile.obj.children[0];
    assert.equal(outer.position.y, props.facing ? 0.25 : 0, `${variant}: wall/floor position`);
    const degrees = props.facing ? 270 : 5 * 360 / 16;
    assert.ok(Math.abs(outer.rotation.y + degrees * Math.PI / 180) < 1e-10, `${variant}: state rotation`);
  }
}

const scanTiles = new TileEntityRenderer(game);
const section = { blocks: new Uint16Array(4096) };
const skullVariants = skulls.flatMap((name) => [name, name.replace(/_(skull|head)$/, '_wall_$1')]);
for (const [i, name] of skullVariants.entries()) section.blocks[i] = findState(name);
section.blocks[12] = findState('piston_head'); // A suffix match alone would misclassify this.
scanTiles.scanChunk({ x: 0, z: 0, sections: [section] });
assert.equal(scanTiles.tiles.size, 12, 'Chunk scan finds all 12 skull/head blocks, not piston heads');

const geometry = testEntityGeometry({ models: bundle, jar });
console.log(`1.13.2 entity models passed: ${expected.length} models, ${boxCount} boxes, 0 extraction errors; ${meshCount} finite CPU meshes.`);
console.log(`Adapter geometry passed: ${geometry.factories} factory variants, ${geometry.frames} animation frames, ${geometry.meshes} finite meshes.`);
console.log('Client smoke passed: all jar models, boat/snowman animation, 6 boat textures + both crystals, all 6 floor/wall skull types without legacy NBT.');
