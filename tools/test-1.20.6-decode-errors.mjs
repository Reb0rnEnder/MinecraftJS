import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePlayPacket766} from '../client/js/net/play-codec-1.20.6.js';
import {Writer766} from '../client/js/net/configuration-1.20.6.js';
import {PLAY_CLIENTBOUND_766} from '../client/js/net/protocol-1.20.6-ids.js';
import {NATIVE_PLAY_CLIENTBOUND_NAMES_766} from '../client/js/net/native-packet-names-1.20.6.js';
import {DecoderError,networkExceptionReason} from '../client/js/net/network-errors.js';

test('real native nested locate-component bytes survive the whole system-chat packet decoder',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./port-1.20.6/component-fixtures.json',import.meta.url))).fixtures;
 const fixture=fixtures.find(f=>f.name==='locate result with nested coordinate arguments');
 const packet=new Writer766().varint(PLAY_CLIENTBOUND_766.system_chat).raw(Buffer.from(fixture.wire,'hex')).bool(false).build();
 const decoded=decodePlayPacket766(packet);assert.deepEqual(JSON.parse(decoded.content),fixture.decoded);
});
test('bad packet errors use native packet identities and preserve the detailed JS cause separately',()=>{
 assert.equal(NATIVE_PLAY_CLIENTBOUND_NAMES_766[PLAY_CLIENTBOUND_766.map_chunk],'clientbound/minecraft:level_chunk_with_light');
 assert.equal(NATIVE_PLAY_CLIENTBOUND_NAMES_766[PLAY_CLIENTBOUND_766.system_chat],'clientbound/minecraft:system_chat');
 assert.throws(()=>decodePlayPacket766(new Writer766().varint(PLAY_CLIENTBOUND_766.system_chat).build()),error=>{
  assert.ok(error instanceof DecoderError);assert.ok(error.cause);assert.equal(error.byteOffset,1);
  assert.equal(networkExceptionReason(error),"Internal Exception: DecoderError: Failed to decode packet 'clientbound/minecraft:system_chat'");return true;
 });
 assert.throws(()=>decodePlayPacket766(new Writer766().varint(9999).build()),/Received unknown packet id 9999/);
});
