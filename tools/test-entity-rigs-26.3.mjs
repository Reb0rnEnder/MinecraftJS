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
  for (const name of ['horse', 'donkey', 'horseArmor', 'camel', 'sniffer', 'player', 'playerSlim', 'rabbit']) {
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
  ];
  for (const [name, model] of built) {
    assert.doesNotThrow(() => model.animate(model, {age: 20, ls: 10, lsa: 0.5, yaw: 20, pitch: 10, saddled: true, hasRider: true}), name);
  }
});
