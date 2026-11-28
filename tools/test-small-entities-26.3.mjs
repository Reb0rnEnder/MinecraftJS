// Native 26.3 wind charges and the ominous item spawner.
// Sources: cache/port-26.3/client.jar (WindChargeModel, WindChargeRenderer,
// OminousItemSpawnerRenderer, OminousItemSpawner, ItemEntityRenderer).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractModels} from '../lib/model-extract-26.3.js';
import * as M from '../client/js/render/entity-models.js';
import {EntityRenderer} from '../client/js/render/entity-renderer.js';
import {Node} from '../client/js/gfx/scene.js';
import {ENTITIES_BY_NAME, OBJECT_TYPES} from '../client/js/game/entity-types.js';
import {ENTITY_REGISTRY_26_3} from '../client/js/game/entity-registry-26.3.js';

const jar = readFileSync(new URL('../cache/port-26.3/client.jar', import.meta.url));
const {models, errors} = extractModels({data: jar});
M.setJarModels(models);

test('26.3 wind charge binds WindChargeModel and its two counter-spinning parts', () => {
  assert.deepEqual(errors, []);
  assert.equal(models.windCharge?.rigSource, '26.3');
  const model = M.windCharge();
  assert.equal(model.roots[0], model.parts.bone);
  const wind = model.parts.bone.namedChildren.wind;
  const charge = model.parts.bone.namedChildren.wind_charge;
  assert.equal(wind.boxes.length, 2);
  assert.equal(charge.boxes.length, 1);
  model.animate(model, {age: 1});
  assert.ok(Math.abs(wind.ry - 16 * Math.PI / 180) < 1e-9);
  assert.ok(Math.abs(charge.ry + 16 * Math.PI / 180) < 1e-9);
});

test('26.3 wind charge keeps its own renderer kind instead of the item projectile fallback', () => {
  for (const name of ['wind_charge', 'breeze_wind_charge']) {
    const id = ENTITY_REGISTRY_26_3.findIndex(([entry]) => entry === name);
    assert.ok(id >= 0, name);
    assert.equal(OBJECT_TYPES[id].kind, name);
    assert.equal(ENTITIES_BY_NAME[name].mob, false);
  }
});

test('26.3 wind charge scrolls a repeat-sampled texture', () => {
  const renderer = Object.create(EntityRenderer.prototype);
  const requested = [];
  renderer.game = {assets: {texture: (path, opts) => { requested.push([path, opts]); return {}; }}};
  renderer._makeModelObject = () => new Node();
  renderer.group = {add: () => {}};
  renderer.visuals = new Map();
  const v = renderer._build({kind: 'wind_charge', id: 1});
  assert.equal(typeof v.windMat.tex, 'function');
  v.windMat.tex();
  assert.deepEqual(requested, [['entity/projectiles/wind_charge.png', {wrap: 'repeat'}]]);
});

test('26.3 small entities keep native shadowRadius = 0', () => {
  const renderer = Object.create(EntityRenderer.prototype);
  renderer.game = {assets: {texture: () => ({})}};
  renderer._mat = () => ({});
  renderer._makeModelObject = () => new Node();
  renderer.group = {add: () => {}};
  renderer.visuals = new Map();
  let shadows = 0;
  renderer._addShadow = () => { shadows++; };
  const cushion = renderer._build({kind: 'cushion', id: 1});
  const spawner = renderer._build({kind: 'ominous_item_spawner', id: 2});
  assert.equal(cushion.shadow, undefined);
  assert.equal(spawner.shadow, undefined);
  assert.equal(shadows, 0);
  // ItemEntityRenderer still sets shadowRadius = 0.15, so keep that shadow path.
  renderer._build({kind: 'item', id: 3});
  assert.equal(shadows, 1);
});

test('OminousItemSpawnerRenderer scales in over 50 ticks and spins 40 degrees per tick', () => {
  const renderer = Object.create(EntityRenderer.prototype);
  renderer.game = {itemRenderer: {iconKey: () => 'icon'}, items: {hasEffect: () => false}};
  renderer._itemObject = () => ({obj: new Node(), model: {display: {ground: {}}}, gui3d: false});
  const v = {root: new Node(), atlasMat: null, itemKey: null};
  const e = {item: {id: 1, count: 1, damage: 0}, ticks: 0};
  renderer._renderOminousItemSpawner(e, v, null, 0);
  assert.equal(v.inner.scale.x, 0);
  e.ticks = 25;
  renderer._renderOminousItemSpawner(e, v, null, 0);
  assert.equal(v.inner.scale.x, 0.5);
  e.ticks = 50;
  renderer._renderOminousItemSpawner(e, v, null, 0);
  assert.equal(v.inner.scale.x, 1);
  assert.ok(Math.abs(v.inner.rotation.y - (50 * 40 % 360) * Math.PI / 180) < 1e-9);
});
