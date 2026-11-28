// 1.21.11 native multipart model predicate support: nested AND/OR and ! value lists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ModelStore } from '../client/js/render/models.js';
import { ZipArchive } from '../client/js/util/zip.js';
import { decodeUtf8 } from '../client/js/util/utf8.js';

const face = { texture: '#t' };
const box = (size) => ({ textures: { t: 'block/stone' }, elements: [{ from: [0,0,0], to: [size,size,size], faces: { up: face } }] });
const models = {
  'block/base': box(16), 'block/a': box(12), 'block/b': box(10), 'block/c': box(8),
};
const multipart = [{ apply: { model: 'block/base' }, when: { facing: 'north' } },
  { apply: { model: 'block/a' }, when: { AND: [{ facing: 'north' }, { slot: 'true' }] } },
  { apply: { model: 'block/b' }, when: { OR: [{ facing: 'south' }, { AND: [{ facing: 'east' }, { slot: 'false' }] }] } },
  { apply: { model: 'block/c' }, when: { facing: '!north|south', slot: true } }];
const store = () => new ModelStore(models, { test: { multipart } }, { uv: () => [0,0,1,1], hasAlpha: () => false });
const quadCount = (props) => store().bakeVariant('test', props).quads.length;

test('1.21.11 multipart predicates support nested AND, nested OR and conjunctions', () => {
  assert.equal(quadCount({ facing: 'north', slot: 'true' }), 2);
  assert.equal(quadCount({ facing: 'north', slot: 'false' }), 1);
  assert.equal(quadCount({ facing: 'east', slot: 'false' }), 1);
  assert.equal(quadCount({ facing: 'south', slot: 'true' }), 2);
});

test('negated alternatives negate each pipe-delimited value independently', () => {
  assert.equal(quadCount({ facing: 'west', slot: true }), 1);
  assert.equal(quadCount({ facing: 'north', slot: true }), 2);
  assert.equal(quadCount({ facing: 'south', slot: true }), 2);
  assert.equal(quadCount({ facing: 'north', slot: false }), 1);
});

test('the pinned 1.21.11 chiseled bookshelf actually supplies nested AND slot conditions', () => {
  const jar = new ZipArchive(readFileSync(new URL('../cache/port-1.21.11/client.jar', import.meta.url)));
  const bs = JSON.parse(decodeUtf8(jar.read('assets/minecraft/blockstates/chiseled_bookshelf.json')));
  const conditions = bs.multipart.map(part => part.when).filter(Boolean);
  assert.ok(conditions.some(c => Array.isArray(c.AND) && c.AND.some(p => Object.hasOwn(p, 'slot_0_occupied'))));
  const occupied = { ...models };
  for (const part of bs.multipart) if (part.apply?.model) occupied[part.apply.model.replace(/^minecraft:/, '')] = box(16);
  const native = new ModelStore(occupied, { chiseled_bookshelf: bs }, { uv: () => [0,0,1,1], hasAlpha: () => false });
  const props = { facing: 'north', ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`slot_${i}_occupied`, i === 0 ? 'true' : 'false'])) };
  assert.equal(native.bakeVariant('chiseled_bookshelf', props).quads.length, 7);
});
