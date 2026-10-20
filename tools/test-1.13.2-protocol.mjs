import assert from 'node:assert/strict';
import { Writer } from '../client/js/net/buffer.js';
import { decodePacket, PROTOCOL_VERSION } from '../client/js/net/packets.js';
import { Chunk } from '../client/js/world/chunk.js';

const packet = (...parts) => {
  const w = new Writer();
  for (const [method, ...args] of parts) w[method](...args);
  return w.build();
};

const varint = (n) => {
  const out = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return out;
};

assert.equal(PROTOCOL_VERSION, 404);
assert.equal(decodePacket(packet(['varint', 0x25], ['i32', 42], ['u8', 1], ['i32', 0], ['u8', 2], ['u8', 20], ['string', 'default'], ['bool', false])).name, 'login');
assert.equal(decodePacket(packet(['varint', 0x21], ['i64', 123n])).name, 'keep_alive');
assert.equal(decodePacket(packet(['varint', 0x32], ['f64', 1], ['f64', 65], ['f64', 2], ['f32', 90], ['f32', 0], ['i8', 0], ['varint', 9])).name, 'position');
assert.equal(decodePacket(packet(['varint', 0x22], ['i32', 3], ['i32', -4], ['bool', true], ['varint', 0], ['varint', 0], ['varint', 0])).name, 'map_chunk');

// One section with palette state 1, empty light arrays, and 256 four-byte biome ids.
const section = [4, ...varint(1), ...varint(1), ...varint(512)];
section.push(...new Uint8Array(512 * 8), ...new Uint8Array(2048), ...new Uint8Array(2048));
for (let i = 0; i < 256; i++) section.push(0, 0, 0, 42);
const chunk = new Chunk(0, 0, true);
assert.equal(chunk.load(new Uint8Array(section), 0, 1, true, true), section.length);
assert.equal(chunk.getState(0, 0, 0), 1);
assert.equal(chunk.biomes[0], 42);
assert.equal(chunk.sections[0].nonAir, 4096);

console.log('1.13.2 protocol/chunk smoke test passed');
