// Native 26.3 EntityType order and dimensions, extracted from the pinned client registry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENTITY_TYPES_26_3} from '../client/js/net/entity-data-26.3.js';
import {ENTITY_TYPES, ENTITIES_BY_NAME, OBJECT_TYPES} from '../client/js/game/entity-types.js';

const display = JSON.parse(readFileSync(new URL('../client/data/entities.json', import.meta.url), 'utf8'));

test('entity ids use the native 26.3 registry order, not the 1.20.6 one', () => {
  assert.equal(ENTITY_TYPES.length, 161);
  assert.equal(ENTITY_TYPES_26_3.length, 161);
  assert.equal(ENTITY_TYPES[0].name, 'acacia_boat');
  assert.equal(ENTITY_TYPES[2].name, 'allay');
  assert.equal(ENTITY_TYPES[160].name, 'fishing_bobber');
  assert.deepEqual(ENTITY_TYPES.map(entity => entity.name), ENTITY_TYPES_26_3);
  assert.deepEqual(display.map(entity => entity.name), ENTITY_TYPES_26_3);
});

test('native dimensions, eye heights and categories drive entity definitions', () => {
  const armadillo = ENTITIES_BY_NAME.armadillo;
  assert.deepEqual([armadillo.width, armadillo.height, armadillo.eyeHeight, armadillo.category], [0.7, 0.65, 0.26, 'creature']);
  assert.equal(armadillo.mob, true);
  assert.equal(ENTITIES_BY_NAME['copper_golem'].mob, true);
  assert.equal(ENTITIES_BY_NAME['camel_husk'].mob, true);
  assert.equal(ENTITIES_BY_NAME['zombie_nautilus'].mob, true);
  assert.equal(ENTITIES_BY_NAME['sulfur_cube'].mob, true);
  assert.equal(ENTITIES_BY_NAME.player.mob, false);
  assert.equal(ENTITIES_BY_NAME['fishing_bobber'].mob, false);
});

test('26.3 boats, rafts and split potions keep their renderer kinds', () => {
  for (const name of ['oak_boat', 'oak_chest_boat', 'bamboo_raft', 'bamboo_chest_raft', 'poplar_boat']) {
    assert.equal(OBJECT_TYPES[ENTITIES_BY_NAME[name].id].kind, 'boat', name);
  }
  assert.equal(OBJECT_TYPES[ENTITIES_BY_NAME['splash_potion'].id].kind, 'projectile');
  assert.equal(OBJECT_TYPES[ENTITIES_BY_NAME['lingering_potion'].id].kind, 'projectile');
  assert.equal(OBJECT_TYPES[ENTITIES_BY_NAME['wind_charge'].id].kind, 'projectile');
  assert.equal(OBJECT_TYPES[ENTITIES_BY_NAME['minecart'].id].kind, 'minecart');
});
