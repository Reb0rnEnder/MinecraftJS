// The 26.3 renderer must bind native rigs for families whose part trees were
// restructured, and must keep the explicit fallback only for the families that
// still have no matching animation code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractModels} from '../lib/model-extract-26.3.js';

const jar = readFileSync(new URL('../cache/port-26.3/client.jar', import.meta.url));
const {models, errors} = extractModels({data: jar});

test('restructured 26.3 rigs do not silently use the 1.20.6 fallback', () => {
  assert.deepEqual(errors, []);
  for (const name of ['bogged', 'parched', 'breeze', 'creaking', 'copper_golem', 'happy_ghast', 'nautilus', 'zombie_nautilus', 'sulfur_cube', 'horse', 'donkey', 'horseArmor', 'camel', 'sniffer', 'player', 'playerSlim', 'rabbit', 'dragon', 'enderCrystal', 'enderCrystalNoBase']) {
    assert.equal(models[name]?.rigSource, '26.3', `${name} should bind a native 26.3 layer`);
  }
  const boats = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'cherry', 'dark_oak', 'pale_oak', 'mangrove', 'poplar', 'bamboo'];
  for (const wood of boats) {
    for (const prefix of ['boat_', 'chest_boat_']) {
      assert.equal(models[prefix + wood]?.rigSource, '26.3', `${prefix + wood} should bind a native 26.3 layer`);
    }
  }
});

test('native player and horse rigs carry their native child layers', () => {
  const player = models.player;
  assert.equal(player.fields.length, 13);
  const horse = models.horse;
  assert.equal(horse.parts.length, 20); // main 13 + saddle extras
  const camel = models.camel;
  assert.equal(camel.parts.length, 14); // main 11 + saddle/bridle/reins
});

test('native dragon and end crystal keep the 26.3 part chains', () => {
  const dragon = models.dragon;
  assert.equal(dragon.rigSource, '26.3');
  assert.equal(dragon.fields.length, 36);
  assert.equal(dragon.parts.length, 37);
  const crystal = models.enderCrystal;
  assert.equal(crystal.rigSource, '26.3');
  assert.equal(crystal.fields.length, 4);
  assert.equal(crystal.parts.length, 5);
});

test('ported rigs construct and animate without a missing part', async () => {
  const M = await import('../client/js/render/entity-models.js');
  M.setJarModels(models);
  const built = [
    ['player', M.playerModel(false)],
    ['playerSlim', M.playerModel(true)],
    ['horse', M.horse(0)],
    ['donkey', M.horse(1)],
    ['horseArmor', M.horse(0, 'horseArmor')],
    ['camel', M.wildMob('camel')],
    ['sniffer', M.wildMob('sniffer')],
    ['rabbit', M.rabbit()],
    ['dragon', M.dragonParts()],
    ['enderCrystal', M.blockModel('enderCrystal', ['outer_glass', 'inner_glass', 'cube', 'base'])],
    ['bogged', M.nativeBipedMob('bogged')],
    ['parched', M.nativeBipedMob('parched')],
    ['camel_husk', M.wildMob('camel')],
    ['breeze', M.nativeMob('breeze')],
    ['creaking', M.nativeMob('creaking')],
    ['copper_golem', M.nativeMob('copper_golem')],
    ['happy_ghast', M.nativeMob('happy_ghast')],
    ['nautilus', M.nativeMob('nautilus')],
    ['zombie_nautilus', M.nativeMob('zombie_nautilus')],
    ['sulfur_cube', M.nativeMob('sulfur_cube')],
  ];
  for (const [name, model] of built) {
    if (typeof model.animate === 'function') assert.doesNotThrow(() => model.animate(model, {age: 20, ls: 10, lsa: 0.5, yaw: 20, pitch: 10, saddled: true, hasRider: true}), name);
  }
});

test('native happy ghast and nautilus formulas stay within the jar bounds', async () => {
  const M = await import('../client/js/render/entity-models.js');
  M.setJarModels(models);
  const ghast = M.nativeMob('happy_ghast');
  ghast.animate(ghast, {age: 20, yaw: 0, pitch: 0});
  assert.equal(ghast.parts.body.namedChildren.tentacle0.rx, 0.2 * Math.sin(6) + 0.4);
  const nautilus = M.nativeMob('nautilus');
  nautilus.animate(nautilus, {age: 1, yaw: 45, pitch: -45});
  assert.equal(nautilus.parts.root.namedChildren.body.ry, 10 * Math.PI / 180);
  assert.equal(nautilus.parts.root.namedChildren.body.rx, -10 * Math.PI / 180);
});

test('dragon child parts and crystal hierarchy resolve to the native nodes', async () => {
  const M = await import('../client/js/render/entity-models.js');
  M.setJarModels(models);
  const dragon = M.dragonParts();
  assert.equal(dragon.jaw, dragon.head.namedChildren.jaw);
  assert.equal(dragon.neck4.namedChildren && Object.keys(dragon.neck4.namedChildren).length, 0);
  assert.equal(dragon.tail11.namedChildren && Object.keys(dragon.tail11.namedChildren).length, 0);
  assert.equal(dragon.right_hind_foot, dragon.body.namedChildren.right_hind_leg.namedChildren.right_hind_leg_tip.namedChildren.right_hind_foot);
  const crystal = M.blockModel('enderCrystal', ['outer_glass', 'inner_glass', 'cube', 'base']);
  assert.equal(crystal.inner_glass, crystal.outer_glass.namedChildren.inner_glass);
  assert.equal(crystal.cube, crystal.inner_glass.namedChildren.cube);
  assert.equal(crystal.outer_glass.py, 24);
  assert.equal(crystal.inner_glass.sx, 0.875);
  assert.equal(crystal.cube.sx, 0.765625);
});
