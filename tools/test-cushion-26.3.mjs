// Native 26.3 cushion: the single-box CushionModel, the DYE_COLOR metadata index and
// CushionRenderer's direction transform.
// Sources: cache/port-26.3/client.jar (Cushion, CushionModel, CushionRenderer,
// EntityDataSerializers, DyeColor).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractModels} from '../lib/model-extract-26.3.js';
import * as M from '../client/js/render/entity-models.js';
import {EntityRenderer} from '../client/js/render/entity-renderer.js';
import {NATIVE_METADATA_26_3} from '../client/js/game/entity-metadata-26.3.js';
import {ENTITIES_BY_NAME, OBJECT_TYPES} from '../client/js/game/entity-types.js';
import {ENTITY_REGISTRY_26_3} from '../client/js/game/entity-registry-26.3.js';

const jar = readFileSync(new URL('../cache/port-26.3/client.jar', import.meta.url));
const {models, errors} = extractModels({data: jar});
M.setJarModels(models);

test('26.3 cushion binds CushionModel geometry', () => {
  assert.deepEqual(errors, []);
  assert.equal(models.cushion?.rigSource, '26.3');
  const model = M.cushion();
  const part = model.parts.cushion;
  assert.equal(model.roots[0], part);
  assert.deepEqual([part.px, part.py, part.pz], [23, 4, -7]);
  assert.equal(part.boxes.length, 1);
  const box = part.boxes[0];
  assert.deepEqual([box.x, box.y, box.z, box.dx, box.dy, box.dz], [-31, -4, -1, 16, 4, 16]);
  assert.equal(box.inflate, -0.005);
  assert.doesNotThrow(() => model.animate(model, {age: 1}));
});

test('26.3 cushion metadata uses the native DYE_COLOR index', () => {
  assert.equal(NATIVE_METADATA_26_3.cushion.DATA_COLOR, 8);
  assert.equal(ENTITIES_BY_NAME.cushion.mob, false);
  const id = ENTITY_REGISTRY_26_3.findIndex(([name]) => name === 'cushion');
  assert.equal(OBJECT_TYPES[id].kind, 'cushion');
});

test('CushionRenderer direction transform follows 180 - Direction.toYRot', () => {
  const renderer = Object.create(EntityRenderer.prototype);
  for (const [yaw, degrees] of [[0, 180], [90, -90], [180, 0], [270, 90], [-90, 90], [44, 180], [45, -90]]) {
    const v = {yawGroup: {rotation: {y: 0}}};
    renderer._renderCushion({yaw}, v);
    assert.ok(Math.abs(v.yawGroup.rotation.y - degrees * Math.PI / 180) < 1e-9, String(yaw));
  }
  assert.equal(renderer._cushionTexture({cushionColor: 0}), 'entity/cushion/white_cushion.png');
  assert.equal(renderer._cushionTexture({cushionColor: 15}), 'entity/cushion/black_cushion.png');
  assert.equal(renderer._cushionTexture({}), 'entity/cushion/white_cushion.png');
});
