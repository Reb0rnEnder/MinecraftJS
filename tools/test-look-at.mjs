import {test} from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import {applyLookAt} from '../client/js/game/look-at.js';
import {readLookAt} from '../client/js/net/look-at.js';
import {Reader,Writer} from '../client/js/net/buffer.js';
const native=JSON.parse(readFileSync(new URL('./fixtures/border-look-native-1.19.4.json',import.meta.url)));
test('look-at rotations match exact JVM Mth values, including vertical, degenerate and large deltas',()=>{
  for(const v of native.angles){const player={x:0,y:0,z:0,eyeHeight:()=>1.62};applyLookAt({player},{fromAnchor:0,x:v.delta[0],y:v.delta[1],z:v.delta[2]});assert.equal(player.yaw,v.yaw);assert.equal(player.pitch,v.pitch);assert.equal(player.prevYaw,v.yaw);assert.equal(player.prevPitch,v.pitch);assert.equal(player.headYaw,v.yaw);}
});
test('look-at wire body handles source/target anchors and fallback position',()=>{
  const w=new Writer().varint(1).f64(100).f64(80).f64(-30).bool(true).varint(17).varint(1),r=new Reader(w.build()),p=readLookAt(r);assert.equal(r.remaining(),0);assert.deepEqual(p,{name:'face_player',fromAnchor:1,x:100,y:80,z:-30,isEntity:true,entityId:17,toAnchor:1});
  const player={x:0,y:70,z:0,eyeHeight:()=>1.62},e={x:3,y:70,z:-2,eyeHeight:1.62};applyLookAt({player,entities:{get:()=>e}},p);
  const expected={x:0,y:70,z:0,eyeHeight:()=>1.62};applyLookAt({player:expected},{fromAnchor:0,x:3,y:70,z:-2});assert.equal(player.yaw,expected.yaw);assert.equal(player.pitch,expected.pitch);
  const fallback={...player};applyLookAt({player:fallback,entities:{get:()=>null}},p);assert.notEqual(fallback.yaw,player.yaw);
  assert.throws(()=>readLookAt(new Reader(new Writer().varint(2).build())),/anchor/);
});
