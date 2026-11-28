import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractModels} from '../lib/model-extract-26.3.js';
import {NATIVE_ANIMATIONS_26_3} from '../client/js/render/animations-26.3.js';
import {NATIVE_METADATA_26_3} from '../client/js/game/entity-metadata-26.3.js';

const jar = readFileSync(new URL('../cache/port-26.3/client.jar', import.meta.url));
const {models} = extractModels({data: jar});

test('native 26.3 keyframe clips keep every constant and the jar conversions', () => {
  assert.deepEqual(Object.keys(NATIVE_ANIMATIONS_26_3).sort(), ['breeze', 'copper_golem', 'creaking', 'nautilus']);
  assert.equal(Object.keys(NATIVE_ANIMATIONS_26_3.breeze).length, 6);
  assert.equal(Object.keys(NATIVE_ANIMATIONS_26_3.copper_golem).length, 7);
  assert.equal(Object.keys(NATIVE_ANIMATIONS_26_3.creaking).length, 4);
  assert.equal(Object.keys(NATIVE_ANIMATIONS_26_3.nautilus).length, 1);
  const walk = NATIVE_ANIMATIONS_26_3.copper_golem.COPPER_GOLEM_WALK;
  assert.equal(walk.looping, true);
  assert.equal(walk.length, 0.8333);
  const body = walk.bones.body[0].frames[0][1];
  assert.equal(body[0], 10 * Math.PI / 180);
  assert.equal(body[1], 15 * Math.PI / 180);
  // posVec negates Y; the breeze idle wind_top starts at posVec(0.5, 0, 0).
  assert.deepEqual(NATIVE_ANIMATIONS_26_3.breeze.IDLE.bones.wind_top[0].frames[0][1], [0.5, 0, 0]);
});

test('generated clips drive the bound native models', async () => {
  const M = await import('../client/js/render/entity-models.js');
  M.setJarModels(models);
  const golem = M.nativeMob('copper_golem');
  golem.animate(golem, {age: 2, ls: 0.2, lsa: 1, yaw: 0, pitch: 0, moving: true});
  assert.equal(golem.parts.body.rx, 10 * Math.PI / 180);
  assert.notEqual(golem.parts.body.ry, 0);
  const breeze = M.nativeMob('breeze');
  breeze.animate(breeze, {age: 1, ls: 0, lsa: 0, yaw: 0, pitch: 0});
  assert.notEqual(breeze.parts.body.namedChildren.rods.ry, 0);
});

test('native metadata indices and pose-triggered clips drive the 26.3 states', async () => {
  assert.equal(NATIVE_METADATA_26_3.copper_golem.COPPER_GOLEM_STATE, 17);
  assert.equal(NATIVE_METADATA_26_3.copper_golem.DATA_WEATHER_STATE, 16);
  assert.equal(NATIVE_METADATA_26_3.creaking.IS_TEARING_DOWN, 18);
  assert.equal(NATIVE_METADATA_26_3.breeze.DATA_POSE, 6);
  assert.equal(NATIVE_METADATA_26_3.breeze.DATA_SHARED_FLAGS_ID, 0);
  const M = await import('../client/js/render/entity-models.js');
  M.setJarModels(models);
  const breeze = M.nativeMob('breeze');
  breeze.animate(breeze, {age: 6, ls: 0, lsa: 0, yaw: 0, pitch: 0, entity: {pose: 16, poseStart: 0}});
  assert.ok(Math.abs(breeze.parts.body.namedChildren.head.rx) > 0.1, 'shooting pose applies the SHOOT head rotation');
  const golem = M.nativeMob('copper_golem');
  golem.animate(golem, {age: 6, ls: 0, lsa: 0, yaw: 0, pitch: 0, rightPose: 'empty', leftPose: 'empty', entity: {copperGolemState: 3, copperStateStart: 0, ticks: 10, id: 1}});
  assert.ok(Math.abs(golem.parts.body.namedChildren.right_arm.rx) > 0.01, 'dropping state applies the item-drop interaction');
});
