import assert from 'node:assert/strict';
import { Reader, Writer } from '../client/js/net/buffer.js';
import { C, decodePacket, PROTOCOL_VERSION } from '../client/js/net/packets.js';
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

const team = decodePacket(packet(['varint', 0x47], ['string', 'team'], ['i8', 0], ['string', 'Display'], ['i8', 3], ['string', 'always'], ['string', 'always'], ['varint', 0xffffffff], ['string', ''], ['string', ''], ['varint', 1], ['string', 'player']));
assert.equal(team.name, 'scoreboard_team');
assert.equal(team.displayName, 'Display');
assert.deepEqual(team.players, ['player']);

const metadata = decodePacket(packet(['varint', 0x3f], ['varint', 7], ['u8', 0], ['varint', 0], ['i8', 1], ['u8', 1], ['varint', 1], ['varint', 42], ['u8', 0xff]));
assert.equal(metadata.name, 'entity_metadata');
assert.equal(metadata.metadata[0], 1);
assert.equal(metadata.metadata[1], 42);

const uuid = '00000000-0000-0000-0000-000000000001';
const living = decodePacket(packet(['varint', 0x03], ['varint', 7], ['uuid', uuid], ['varint', 87], ['f64', 1], ['f64', 2], ['f64', 3], ['u8', 0], ['u8', 0], ['u8', 0], ['i16', 0], ['i16', 0], ['i16', 0], ['u8', 0], ['varint', 0], ['i8', 1], ['u8', 0xff]));
assert.equal(living.name, 'spawn_entity_living');
assert.equal(living.type, 87); // native zombie ID
assert.equal(living.metadata[0], 1);

const stopSound = decodePacket(packet(['varint', 0x4c], ['i8', 3], ['varint', 4], ['string', 'block.stone.break']));
assert.equal(stopSound.name, 'stop_sound');
assert.equal(stopSound.source, 4);
assert.equal(stopSound.sound, 'block.stone.break');

const brand = new Reader(C.customPayload('MC|Brand', new Writer().string('vanilla').build()));
assert.equal(brand.varint(), 0x0a);
assert.equal(brand.string(), 'minecraft:brand');
assert.equal(brand.string(), 'vanilla');
assert.throws(() => C.customPayload('MC|NotARealChannel', new Uint8Array()), /Invalid custom payload channel/);

const emptySlot = new Reader(new Writer().slot(null).build());
assert.equal(emptySlot.slot(), null);
const itemSlot = new Reader(new Writer().slot({ id: 5, count: 64 }).build());
assert.deepEqual(itemSlot.slot(), { id: 5, count: 64, damage: 0, nbt: null, nbtRaw: null });

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
