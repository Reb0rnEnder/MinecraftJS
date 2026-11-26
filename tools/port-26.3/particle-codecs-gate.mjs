// Byte gate for the native 26.3 particle codecs and the entity metadata that carries them.
// The first frame is captured from a live 26.3 server (metadata index 10, serializer 17,
// empty list); the rest pin each data codec against the option class layout read by javap.
import {Reader26_3} from '../../client/js/net/configuration-26.3.js';
import {decodePlayPacket} from '../../client/js/net/play-codec-26.3.js';
import {PLAY_CLIENTBOUND_26_3} from '../../client/js/net/protocol-26.3-ids.js';
import {readParticleOptions26_3, readParticles26_3} from '../../client/js/net/particles-26.3.js';

let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log('ok   ' + name); }
  catch (error) { failures++; console.error('FAIL ' + name + ': ' + error.message); }
};
const eq = (actual, expected) => {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw Error('expected ' + b + ', got ' + a);
};
const bytes = (...values) => Uint8Array.from(values);
const fl = value => {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value);
  return [...new Uint8Array(view.buffer)];
};
const i32 = value => {
  const view = new DataView(new ArrayBuffer(4));
  view.setInt32(0, value);
  return [...new Uint8Array(view.buffer)];
};

check('live set_entity_data frame with an empty PARTICLE list', () => {
  const packet = decodePlayPacket(new Reader26_3(bytes(0x65, 0xd1, 0x14, 0x0a, 0x11, 0x00, 0xff)));
  eq(packet.name, 'set_entity_data');
  eq(packet.data.entityId, 2641);
  eq(packet.data.metadata[10], []);
});

check('simple particle carries no payload', () => {
  const r = new Reader26_3(bytes(0x00));
  eq(readParticleOptions26_3(r), {id: 0, name: 'angry_villager'});
  eq(r.remaining(), 0);
});

check('block particle is a block state VarInt', () => {
  const r = new Reader26_3(bytes(0x01, 0x8a, 0x01));
  eq(readParticleOptions26_3(r), {id: 1, name: 'block', blockState: 138});
  eq(r.remaining(), 0);
});

check('dust particle is INT color + FLOAT scale', () => {
  const r = new Reader26_3(Uint8Array.from([0x15, ...i32(0x112233), ...fl(2.5)]));
  const p = readParticleOptions26_3(r);
  eq([p.id, p.name, p.color, p.scale], [21, 'dust', 0x112233, 2.5]);
  eq(r.remaining(), 0);
});

check('dust_color_transition is INT from + INT to + FLOAT scale', () => {
  const r = new Reader26_3(Uint8Array.from([0x16, ...i32(1), ...i32(2), ...fl(0.5)]));
  const p = readParticleOptions26_3(r);
  eq([p.id, p.fromColor, p.toColor, p.scale], [22, 1, 2, 0.5]);
  eq(r.remaining(), 0);
});

check('geyser variants are INT and INT+FLOAT', () => {
  const g = new Reader26_3(Uint8Array.from([0x07, ...i32(12)]));
  eq(readParticleOptions26_3(g), {id: 7, name: 'geyser', waterBlocks: 12});
  const b = new Reader26_3(Uint8Array.from([0x08, ...i32(12), ...fl(1.5)]));
  const p = readParticleOptions26_3(b);
  eq([p.waterBlocks, p.burstImpulseBase], [12, 1.5]);
});

check('item particle is an ItemStackTemplate', () => {
  // item 1 (stone), count 3, empty component patch.
  const r = new Reader26_3(bytes(0x39, 0x01, 0x03, 0x00, 0x00));
  const p = readParticleOptions26_3(r);
  eq([p.name, p.item.itemId, p.item.count], ['item', 1, 3]);
  eq(r.remaining(), 0);
});

check('trail is Vec3 + INT color + VarInt duration', () => {
  const dbl = value => {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    return [...new Uint8Array(view.buffer)];
  };
  const r = new Reader26_3(Uint8Array.from([0x3b, ...dbl(1), ...dbl(2), ...dbl(3), ...i32(0xabcdef), 0x40]));
  const p = readParticleOptions26_3(r);
  eq([p.target.x, p.target.y, p.target.z, p.color, p.duration], [1, 2, 3, 0xabcdef, 64]);
  eq(r.remaining(), 0);
});

check('particle list reads count then entries', () => {
  const r = new Reader26_3(bytes(0x02, 0x00, 0x01, 0x05));
  const list = readParticles26_3(r);
  eq(list.map(p => p.name), ['angry_villager', 'block']);
  eq(r.remaining(), 0);
});

check('level_particles carries the native 26.3 field list', () => {
  const varint = value => {
    const out = [];
    do { let byte = value & 0x7f; value >>>= 7; if (value) byte |= 0x80; out.push(byte); } while (value);
    return out;
  };
  const dbl = value => {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    return [...new Uint8Array(view.buffer)];
  };
  const body = [
    ...varint(21), ...i32(0x112233), ...fl(2.0), // dust particle
    0, 1,                                           // overrideLimiter, alwaysShow
    ...dbl(1.5), ...dbl(2.5), ...dbl(3.5),          // position
    ...fl(0.1), ...fl(0.2), ...fl(0.3),            // spread
    ...fl(0.01), ...fl(0.02), ...fl(0.03),         // per-axis max speed
    ...varint(5), ...varint(2),                    // count, randomization
  ];
  const packet = decodePlayPacket(new Reader26_3(Uint8Array.from([...varint(PLAY_CLIENTBOUND_26_3.level_particles), ...body])));
  eq(packet.name, 'level_particles');
  const p = packet.data;
  eq([p.particleName, p.particle.color, p.particle.scale], ['dust', 0x112233, 2]);
  eq([p.longDistance, p.alwaysShow], [false, true]);
  eq([p.x, p.y, p.z], [1.5, 2.5, 3.5]);
  eq([p.offsetX, p.offsetY, p.offsetZ], [0.1, 0.2, 0.30000001192092896].map(v => Math.fround(v)));
  eq([p.xMaxSpeed, p.yMaxSpeed, p.zMaxSpeed], [0.01, 0.02, 0.03].map(v => Math.fround(v)));
  eq([p.particles, p.count, p.randomization], [5, 5, 2]);
  eq(p.data.colorArgb, 0x112233);
});

check('unknown particle id fails closed', () => {
  let threw = false;
  // 200 is past the 128 registered particle types.
  try { readParticleOptions26_3(new Reader26_3(bytes(0xc8, 0x01))); } catch { threw = true; }
  if (!threw) throw Error('unknown particle id was accepted');
});

check('vibration fails closed instead of guessing PositionSource', () => {
  let threw = false;
  try { readParticleOptions26_3(new Reader26_3(bytes(0x3a))); } catch (error) { threw = /vibration/.test(error.message); }
  if (!threw) throw Error('vibration was decoded without its PositionSource codec');
});

if (failures) {
  console.error(failures + ' particle codec checks failed');
  process.exit(1);
}
console.log('particle codecs: all checks passed');
