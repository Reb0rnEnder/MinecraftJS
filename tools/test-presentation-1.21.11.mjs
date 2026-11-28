import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setJarModels, bat, playerModel } from '../client/js/render/entity-models.js';
import { tickBat774 } from '../client/js/render/bat-1.21.11.js';
import { shieldArmPose774 } from '../client/js/render/shield-pose-1.21.11.js';
import { EntityManager } from '../client/js/game/entities.js';
import { ENTITIES_BY_NAME } from '../client/js/game/entity-types.js';

const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const native = read('tools/fixtures/presentation-1.21.11.json');
setJarModels(read('client/assets/bundles/entity-models.json'));
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 2e-5, `${label}: ${a} != ${b}`);

test('bat flying/resting keyframes, head behavior and complete hierarchy match actual native setupAnim', () => {
  const model = bat();
  assert.equal(model.modelScale, 1);
  assert.equal(model.roots.length, 1);
  assert.equal(model.roots[0], model.parts.$root);
  for (const row of native.batPoses) {
    const entity = { hanging: row.resting, ticks: row.start };
    tickBat774(entity);
    model.animate(model, { age: row.age, yaw: row.yaw, pitch: 33, hanging: row.resting, entity });
    for (const [name, pose] of Object.entries(row.parts)) {
      const part = model.parts[name] || model.parts.head.children.find((p) => p.px === pose[0]);
      assert.ok(part, name);
      ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz'].forEach((key, i) =>
        near(part[key], pose[i], `${row.resting} ${row.age}: ${name}.${key}`)
      );
    }
  }
});

test('bat animation states retain start time until a real transition and metadata uses the native flag accessor', () => {
  const manager = new EntityManager({});
  const e = { id: 7, entityName: 'bat', kind: 'mob', type: ENTITIES_BY_NAME.bat.id, metadata: {}, equipment: [], ticks: 40 };
  manager.map.set(7, e);
  manager.setMetadata(7, { [native.batFlagsId]: 1 });
  assert.equal(e.hanging, true);
  tickBat774(e);
  assert.equal(e.batRestStart, 40);
  e.ticks = 47;
  tickBat774(e);
  assert.equal(e.batRestStart, 40);
  manager.setMetadata(7, { [native.batFlagsId]: 0 });
  tickBat774(e);
  assert.equal(e.batRestStart, undefined);
  assert.equal(e.batFlyStart, 47);
  e.ticks = 49;
  tickBat774(e);
  assert.equal(e.batFlyStart, 47);
});

test('both shields follow native clamped head pitch/yaw for every boundary pose', () => {
  for (const row of native.shields) {
    const arm = { rx: row.initial };
    shieldArmPose774(arm, { rx: row.headX, ry: row.headY }, row.right);
    near(arm.rx, row.rx, 'shield pitch');
    near(arm.ry, row.ry, 'shield yaw');
  }
  const model = playerModel(false);
  model.animate(model, { ls: 0, lsa: 0, age: 0, yaw: 20, pitch: 15, swing: -9999, rightPose: 'block', leftPose: 'empty' });
  const want = { rx: 0 };
  shieldArmPose774(want, model.parts.head, true);
  near(model.parts.rightArm.rx, want.rx, 'actual humanoid pitch');
  near(model.parts.rightArm.ry, want.ry, 'actual humanoid yaw');
});
