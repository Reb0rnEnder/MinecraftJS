import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ZipFile } from '../lib/zip.js';
import { parseClass } from '../lib/classfile.js';
import { walk } from '../lib/bytecode.js';
import { Writer } from '../client/js/net/buffer.js';
import { nbt } from '../client/js/net/nbt.js';
import { decodePacket } from '../client/js/net/packets.js';
import { Particles } from '../client/js/render/particles.js';
const types = JSON.parse(readFileSync(new URL('../client/data/particles.json', import.meta.url)));
const jar = new ZipFile(fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));

test('native particle IDs match the jar registration order, rather than constant field order', () => {
  const c = parseClass(jar.read('fl.class'));
  const m = c.methods.find(m => m.name === 'c' && m.desc === '()V');
  const actual = [...walk(m.code)].filter(i => i.op === 0x12 || i.op === 0x13)
    .map(i => c.constant(i.op === 0x12 ? i.u1 : i.u2)).filter(v => v.type === 'string')
    .map((v, id) => ({ id, name: v.value }));
  assert.equal(actual.length, 50); assert.deepEqual(types, actual);
  assert.equal(types[2].name, 'barrier'); assert.equal(types[35].name, 'portal'); assert.equal(types[33].name, 'note');
});
const packet = id => new Writer().varint(0x24).i32(id).bool(false)
  .f32(2.5).f32(64.5).f32(3.5).f32(0).f32(0).f32(0).f32(0).i32(1);

test('world particles consume native block, dust and item payloads without leftover bytes', () => {
  const item = { id: 789, count: 1, nbt: nbt.compound({ Damage: nbt.int(17) }) };
  const samples = [
    [3, w => w.varint(8191), { blockState: 8191 }],
    [20, w => w.varint(9000), { blockState: 9000 }],
    [11, w => w.f32(1).f32(0.5).f32(0).f32(2), { red: 1, green: 0.5, blue: 0, scale: 2 }],
    [27, w => w.slot(item), null],
    [35, w => w, {}],
    [33, w => w, {}],
  ];
  for (const [id, add, data] of samples) {
    const p = decodePacket(add(packet(id)).build());
    assert.equal(p.name, 'world_particles'); assert.equal(p._extra, undefined, 'native payload for ' + id);
    if (data) assert.deepEqual(p.data, data);
    else { assert.equal(p.data.item.id, item.id); assert.deepEqual(p.data.item.nbt.v, item.nbt.v); }
  }
});

test('portal/note packets cannot create barrier icons, and block states reach the effect unchanged', () => {
  const calls = [], p = Object.create(Particles.prototype);
  p.game = { assets: { data: { particles: types } } };
  p.portal = (...args) => calls.push(['portal', ...args]);
  p.simpleRising = (...args) => calls.push(['note', ...args]);
  p.barrier = (...args) => calls.push(['barrier', ...args]);
  p.digging = (...args) => calls.push(['block', ...args]);
  p.onPacket(decodePacket(packet(35).build()));
  p.onPacket(decodePacket(packet(33).build()));
  assert.deepEqual(calls.map(c => c[0]), ['portal', 'note']);
  p.onPacket(decodePacket(packet(2).build()));
  assert.deepEqual(calls.at(-1), ['barrier', 2, 64, 3]);
  p.onPacket(decodePacket(packet(3).varint(8191).build()));
  assert.equal(calls.at(-1)[0], 'block'); assert.equal(calls.at(-1).at(-1), 8191);
});
