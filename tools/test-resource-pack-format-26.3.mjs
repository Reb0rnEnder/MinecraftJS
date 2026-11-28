import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PACK_FORMAT_26_3,
  PACK_FORMAT_1_20_6,
  packFormatForProtocol,
  packCompatibility
} from '../client/js/resource-pack-compatibility.js';

test('26.3 selects the native 97.1 pack format while 1.20.6 keeps 32', () => {
  assert.deepEqual(PACK_FORMAT_26_3, {major: 97, minor: 1});
  assert.deepEqual(PACK_FORMAT_1_20_6, {major: 32, minor: 0});
  assert.deepEqual(packFormatForProtocol(777), PACK_FORMAT_26_3);
  assert.deepEqual(packFormatForProtocol(766), PACK_FORMAT_1_20_6);
});

test('native PackCompatibility.forVersion semantics for 26.3', () => {
  // PackFormat.compareTo compares major then minor. A legacy pack_format=97 is 97.0, which
  // is older than the current 97.1; 26.3 packs declare [97,1] in min_format/max_format.
  assert.equal(packCompatibility({format: 97}), 'old');
  assert.equal(packCompatibility({minFormat: [97, 1], maxFormat: [97, 1]}), 'compatible');
  assert.equal(packCompatibility({minFormat: [97], maxFormat: [98]}), 'compatible');
  assert.equal(packCompatibility({minFormat: [98, 0], maxFormat: [98, 0]}), 'new');
  assert.equal(packCompatibility({supportedFormats: [97, 98]}), 'compatible');
  assert.equal(packCompatibility({supportedFormats: {min_inclusive: 97, max_inclusive: 98}}), 'compatible');
  assert.equal(packCompatibility({supportedFormats: {min_inclusive: 97, max_inclusive: 97}}), 'old');
  assert.equal(packCompatibility({format: 32}), 'old');
  assert.equal(packCompatibility({format: 98}), 'new');
  assert.equal(packCompatibility({format: 97}, PACK_FORMAT_1_20_6), 'new');
  assert.equal(packCompatibility({format: 32}, PACK_FORMAT_1_20_6), 'compatible');
});

test('26.3 format arrays are accepted as [major] or [major, minor]', () => {
  assert.equal(packCompatibility({minFormat: [97], maxFormat: [97, 1]}), 'compatible');
  assert.equal(packCompatibility({minFormat: [97, 1], maxFormat: [98, 0]}), 'compatible');
});
