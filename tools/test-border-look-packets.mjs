import {test} from 'node:test';import assert from 'node:assert/strict';
import mcassets from '../lib/mcassets.js';
import {decodePacket} from '../client/js/net/packets.js';
import {Writer} from '../client/js/net/buffer.js';
const version=mcassets.MC_VERSION;
const versions={
  '1.8.9':{border:0x44},'1.12.2':{border:0x38},'1.13.2':{border:0x3b,look:0x31},
  '1.14.4':{border:0x3d,look:0x34},'1.15.2':{border:0x3e,look:0x35},'1.16.5':{border:0x3d,look:0x33},
  '1.17.1':{initialize:0x20,lerp:0x43,look:0x37},'1.18.2':{initialize:0x20,lerp:0x43,look:0x37},
  '1.19.4':{initialize:34,lerp:72,look:59},
};
// The unfinished 1.20.6 renderer baseline is tested with its native-762 codec,
// not advertised as a completed native-766 Play implementation.
const codec=version==='1.20.6'?(await import('../client/js/net/protocol-1.19.4.js')).decodePacket762:decodePacket;
const ids=versions[version==='1.20.6'?'1.19.4':version];
const varlong=(w,value)=>{let n=BigInt(value);do{const b=Number(n&127n);n>>=7n;w.u8(b|(n?128:0));}while(n);return w;};
test(version+': initialization reads native warning distance before warning time, preserving lerp and absolute size',()=>{
  const w=new Writer().varint(ids.border??ids.initialize);if(ids.border!==undefined)w.varint(3);
  const p=codec(varlong(w.f64(1.5).f64(-2).f64(100).f64(20),10000).varint(29999984).varint(7).varint(19).build());
  assert.equal(p.name,'world_border');assert.equal(p.action,3);assert.equal(p.warningBlocks,7);assert.equal(p.warningTime,19);assert.equal(p.portalBoundary,29999984);assert.equal(Number(p.speed),10000);
});
test(version+': native size lerp retains start, destination and milliseconds',()=>{
  const w=new Writer().varint(ids.border??ids.lerp);if(ids.border!==undefined)w.varint(1);
  const p=codec(varlong(w.f64(10).f64(40),1234).build());assert.equal(p.name,'world_border');assert.equal(p.action,1);assert.deepEqual([p.oldRadius,p.newRadius,Number(p.speed)],[10,40,1234]);
});
if(ids.look!==undefined)test(version+': look-at packet routes to its native Game action with both anchor forms',()=>{
  let p=codec(new Writer().varint(ids.look).varint(1).f64(3).f64(70).f64(-2).bool(false).build());
  assert.equal(p.name,'face_player');assert.equal(p.fromAnchor,1);assert.equal(p.x,3);assert.equal(p.isEntity,false);
  p=codec(new Writer().varint(ids.look).varint(0).f64(3).f64(70).f64(-2).bool(true).varint(17).varint(1).build());
  assert.equal(p.name,'face_player');assert.equal(p.entityId,17);assert.equal(p.toAnchor,1);
});
