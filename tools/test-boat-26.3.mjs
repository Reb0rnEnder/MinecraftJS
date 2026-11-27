// Native 26.3 boat identity: one entity per wood, no Boat.Type metadata index.
import test from 'node:test';
import assert from 'node:assert/strict';
import {BOAT_TYPES, boatWoodFor} from '../client/js/game/boat-types-1.19.4.js';

test('26.3 boat names resolve their wood without a metadata type', () => {
  assert.deepEqual(BOAT_TYPES, ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'cherry', 'dark_oak', 'pale_oak', 'mangrove', 'poplar', 'bamboo']);
  assert.equal(boatWoodFor('oak_boat'), 'oak');
  assert.equal(boatWoodFor('acacia_chest_boat'), 'acacia');
  assert.equal(boatWoodFor('bamboo_raft'), 'bamboo');
  assert.equal(boatWoodFor('bamboo_chest_raft'), 'bamboo');
  assert.equal(boatWoodFor('pale_oak_boat'), 'pale_oak');
  assert.equal(boatWoodFor('poplar_chest_boat'), 'poplar');
  assert.equal(boatWoodFor('unknown'), 'oak');
});
