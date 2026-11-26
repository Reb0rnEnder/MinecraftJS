// Byte gate for the inbound Play families added after the particle work. Every frame is built
// from the 26.3 record definition (javap), decoded by the client codec with zero leftover, and
// then adapted to the legacy handler field names.
import {Reader26_3} from '../../client/js/net/configuration-26.3.js';
import {decodePlayPacket} from '../../client/js/net/play-codec-26.3.js';
import {adaptPlay26_3} from '../../client/js/net/play-adapter-26.3.js';
import {PLAY_CLIENTBOUND_26_3} from '../../client/js/net/protocol-26.3-ids.js';

let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log('ok   ' + name); }
  catch (error) { failures++; console.error('FAIL ' + name + ': ' + error.message); }
};
const eq = (actual, expected) => {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw Error('expected ' + b + ', got ' + a);
};
const varint = value => {
  const out = [];
  let v = value >>> 0;
  do { let byte = v & 0x7f; v >>>= 7; if (v) byte |= 0x80; out.push(byte); } while (v);
  return out;
};
const f32 = value => { const v = new DataView(new ArrayBuffer(4)); v.setFloat32(0, value); return [...new Uint8Array(v.buffer)]; };
const f64 = value => { const v = new DataView(new ArrayBuffer(8)); v.setFloat64(0, value); return [...new Uint8Array(v.buffer)]; };
const i32 = value => { const v = new DataView(new ArrayBuffer(4)); v.setInt32(0, value); return [...new Uint8Array(v.buffer)]; };
const packPos = (x, y, z) => {
  const v = (BigInt(x) & 0x3ffffffn) << 38n | (BigInt(z) & 0x3ffffffn) << 12n | (BigInt(y) & 0xfffn);
  const out = new DataView(new ArrayBuffer(8));
  out.setBigInt64(0, BigInt.asIntN(64, v));
  return [...new Uint8Array(out.buffer)];
};
// Network text component: unnamed NBT StringTag.
// NBT strings are modified UTF-8 with an unsigned-short length, even in network NBT.
const nbtString = text => {
  const bytes = [...Buffer.from(text, 'utf8')];
  return [8, (bytes.length >> 8) & 0xff, bytes.length & 0xff, ...bytes];
};
const uuid = seed => Array.from({ length: 16 }, (_, i) => (seed + i) & 0xff);

function decode(name, body) {
  const frame = Uint8Array.from([...varint(PLAY_CLIENTBOUND_26_3[name]), ...body]);
  const reader = new Reader26_3(frame);
  const packet = decodePlayPacket(reader);
  eq(packet.name, name);
  eq(reader.remaining(), 0);
  return packet;
}
function adapt(name, body, expected) {
  const packet = decode(name, body);
  const adapted = adaptPlay26_3(packet, null);
  if (!adapted) throw Error('adapter skipped ' + name);
  eq(adapted.name, expected.name);
  return adapted;
}

check('animate decodes and adapts to animation', () => {
  const adapted = adapt('animate', [...varint(5), 3], {name: 'animation'});
  eq([adapted.entityId, adapted.animation], [5, 3]);
});

check('take_item_entity decodes and adapts to collect', () => {
  const adapted = adapt('take_item_entity', [...varint(7), ...varint(9), ...varint(2)], {name: 'collect'});
  eq([adapted.collectedEntityId, adapted.collectorEntityId, adapted.amount], [7, 9, 2]);
});

check('hurt_animation decodes and adapts', () => {
  const adapted = adapt('hurt_animation', [...varint(11), ...f32(90.5)], {name: 'hurt_animation'});
  eq([adapted.entityId, adapted.yaw], [11, 90.5]);
});

check('block_event decodes and adapts to block_action', () => {
  const adapted = adapt('block_event', [...packPos(1, 64, -3), 5, 6, ...varint(42)], {name: 'block_action'});
  eq([adapted.location, adapted.byte1, adapted.byte2, adapted.blockId], [{ x: 1, y: 64, z: -3 }, 5, 6, 42]);
});

check('level_event decodes and adapts to world_event', () => {
  const adapted = adapt('level_event', [...i32(2001), ...packPos(0, 62, 0), ...i32(33), 1], {name: 'world_event'});
  eq([adapted.type, adapted.location, adapted.data, adapted.global], [2001, { x: 0, y: 62, z: 0 }, 33, true]);
});

check('player_rotation decodes with its relative flags', () => {
  const packet = decode('player_rotation', [...f32(45), 1, ...f32(-10), 0]);
  eq([packet.data.yRot, packet.data.relativeY, packet.data.xRot, packet.data.relativeX], [45, true, -10, false]);
});

check('title text/time/clear adapt to the shared title handler', () => {
  const text = adapt('set_title_text', nbtString('hi'), {name: 'title'});
  eq([text.action, JSON.parse(text.text)], [0, 'hi']);
  const sub = adapt('set_subtitle_text', nbtString('sub'), {name: 'title'});
  eq(sub.action, 1);
  const bar = adapt('set_action_bar_text', nbtString('bar'), {name: 'title'});
  eq(bar.action, 2);
  const times = adapt('set_titles_animation', [...i32(10), ...i32(70), ...i32(20)], {name: 'title'});
  eq([times.action, times.fadeIn, times.stay, times.fadeOut], [3, 10, 70, 20]);
  const clear = adapt('clear_titles', [1], {name: 'title'});
  eq(clear.action, 5);
});

check('system_chat decodes component + overlay', () => {
  const adapted = adapt('system_chat', [...nbtString('hello'), 1], {name: 'system_chat'});
  eq([JSON.parse(adapted.content), adapted.isActionBar], ['hello', true]);
});

check('disguised_chat decodes the bound chat type', () => {
  const adapted = adapt('disguised_chat', [...nbtString('hello'), ...varint(1), ...nbtString('Server'), 0], {name: 'profileless_chat'});
  eq([JSON.parse(adapted.message), JSON.parse(adapted.networkName), adapted.networkTargetName], ['hello', 'Server', null]);
});

check('tab_list decodes header and footer', () => {
  const adapted = adapt('tab_list', [...nbtString('head'), ...nbtString('foot')], {name: 'playerlist_header'});
  eq([JSON.parse(adapted.header), JSON.parse(adapted.footer)], ['head', 'foot']);
});

check('set_passengers decodes the full list', () => {
  const adapted = adapt('set_passengers', [...varint(3), ...varint(2), ...varint(8), ...varint(9)], {name: 'set_passengers'});
  eq([adapted.entityId, adapted.passengers], [3, [8, 9]]);
});

check('set_entity_link decodes and adapts', () => {
  const adapted = adapt('set_entity_link', [...varint(4), ...varint(5)], {name: 'attach_entity'});
  eq([adapted.entityId, adapted.vehicleId], [4, 5]);
});

check('player_info_remove decodes UUIDs', () => {
  const adapted = adapt('player_info_remove', [...varint(1), ...uuid(1)], {name: 'player_remove'});
  eq(adapted.players.length, 1);
});

check('set_cursor_item decodes an empty stack', () => {
  const adapted = adapt('set_cursor_item', [0], {name: 'set_cursor_item'});
  eq(adapted.item, null);
});

check('teleport_entity decodes an absolute teleport', () => {
  const adapted = adapt('teleport_entity', [
    ...varint(12),
    ...f64(1.5), ...f64(64), ...f64(-2.5),
    ...f64(0), ...f64(0), ...f64(0),
    ...f32(90), ...f32(0),
    0, 1,
  ], {name: 'entity_teleport'});
  eq([adapted.entityId, adapted.x, adapted.y, adapted.z, adapted.yaw, adapted.pitch], [12, 1.5, 64, -2.5, 90, 0]);
  eq(adapted.onGround, true);
});

check('relative teleports are skipped instead of misapplied', () => {
  const packet = decode('teleport_entity', [
    ...varint(12), ...f64(1), ...f64(2), ...f64(3), ...f64(0), ...f64(0), ...f64(0), ...f32(0), ...f32(0), 1, 0,
  ]);
  eq(packet.data.relatives, 1);
  eq(adaptPlay26_3(packet, null), null);
});

if (failures) {
  console.error(failures + ' inbound checks failed');
  process.exit(1);
}
console.log('inbound batch: all checks passed');
