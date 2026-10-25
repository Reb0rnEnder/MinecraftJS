import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Reader,Writer} from '../client/js/net/buffer.js';
import {Reader498,Writer498,decodePacket498,C498} from '../client/js/net/protocol-1.14.4.js';
import {CLIENTBOUND_498 as IN,SERVERBOUND_498 as OUT} from '../client/js/net/protocol-1.14.4-ids.js';
const packet=(name,fn)=>{const w=new Writer498().varint(IN[name]);fn(w);return w.build();};

test('498 packed positions use X/Z/Y and preserve signed extrema; 404 stays X/Y/Z',()=>{
 for(const [xyz,hex] of [[[1,2,3],'0000004000003002'],[[-1,-1,-1],'ffffffffffffffff'],[[0,-2048,0],'0000000000000800'],[[33554431,2047,33554431],'7fffffdffffff7ff']]){
  assert.deepEqual(new Reader498(Buffer.from(hex,'hex')).position(),{x:xyz[0],y:xyz[1],z:xyz[2]});
  assert.equal(Buffer.from(new Writer498().position(...xyz).build()).toString('hex'),hex);
 }
 assert.equal(Buffer.from(new Writer().position(1,2,3).build()).toString('hex'),'0000004008000003');
 assert.deepEqual(new Reader(new Writer().position(1,2,3).build()).position(),{x:1,y:2,z:3});
 assert.throws(()=>new Writer498().position(0,2048,0),RangeError);assert.throws(()=>new Writer498().position(0.1,0,0),RangeError);
});

test('498 join game has view distance and omits the removed difficulty field',()=>{
 const p=decodePacket498(packet('login',w=>w.i32(42).u8(1).i32(-1).u8(20).string('default').varint(10).bool(false)));
 assert.deepEqual(p,{name:'login',id:0x25,entityId:42,gameMode:1,dimension:-1,maxPlayers:20,levelType:'default',viewDistance:10,reducedDebugInfo:false});
 assert.deepEqual(decodePacket498(packet('difficulty',w=>w.u8(2).bool(true))),{name:'difficulty',id:0x0d,difficulty:2,difficultyLocked:true});
});

test('light packets decode 18 independent boundary/terrain sections and own their data',()=>{
 const b=packet('update_light',w=>{w.varint(-3).varint(4).varint((1<<0)|(1<<17)).varint(1<<1).varint(1<<2).varint(1<<3);for(const value of [15,240,23])w.varint(2048).raw(new Uint8Array(2048).fill(value));});
 const p=decodePacket498(b);assert.equal(p.chunkX,-3);assert.equal(p.chunkZ,4);assert.equal(p.skyLight[-1][0],15);assert.equal(p.skyLight[16][0],240);assert.equal(p.blockLight[0][0],23);assert.equal(p.emptySkyLightMask,4);
 b.fill(0);assert.equal(p.blockLight[0][0],23);
 assert.throws(()=>decodePacket498(packet('update_light',w=>w.varint(0).varint(0).varint(1).varint(0).varint(1).varint(0))),/Conflicting/);
 assert.throws(()=>decodePacket498(packet('update_light',w=>w.varint(0).varint(0).varint(1).varint(0).varint(0).varint(0).varint(1024))),/light array length/);
 assert.throws(()=>decodePacket498(packet('update_light',w=>w.varint(0).varint(0).varint(1<<18).varint(0).varint(0).varint(0))),/light mask/);
});

test('chunk packets read heightmaps before section bytes and block entities afterward',()=>{
 const b=packet('map_chunk',w=>w.i32(-2).i32(5).bool(true).varint(1).raw(new Uint8Array([10,0,0,0])).varint(3).raw(new Uint8Array([1,2,3])).varint(0));
 const p=decodePacket498(b);assert.equal(p.x,-2);assert.equal(p.z,5);assert.equal(p.heightmaps.t,10);assert.deepEqual([...p.chunkData],[1,2,3]);assert.deepEqual(p.blockEntities,[]);
 assert.throws(()=>decodePacket498(b.subarray(0,b.length-1)),/underflow/);
});

test('new metadata serializers keep villager data, optional VarInts, poses and native particles aligned',()=>{
 const b=new Writer498().u8(16).varint(16).varint(2).varint(5).varint(3).u8(17).varint(17).varint(0).u8(18).varint(17).varint(8).u8(6).varint(18).varint(3).u8(9).varint(15).varint(23).varint(11270).u8(255).build();
 const r=new Reader498(b);assert.deepEqual(r.metadata(),{16:{villagerType:2,villagerProfession:5,level:3},17:null,18:7,6:3,9:{particleId:23,data:{blockState:11270}}});assert.equal(r.remaining(),0);
 assert.throws(()=>new Reader498(new Uint8Array([0,19])).metadata(),/Unknown 498 metadata/);
});

test('serverbound interaction packets use new IDs and block-place hand/inside-block layout',()=>{
 assert.equal(new Reader498(C498.keepAlive(5n)).varint(),OUT.keep_alive);
 const r=new Reader498(C498.blockPlace(-2,64,3,1,0,.2,.3,.4,true));assert.equal(r.varint(),0x2c);assert.equal(r.varint(),0);assert.deepEqual(r.position(),{x:-2,y:64,z:3});assert.equal(r.varint(),1);assert.ok(Math.abs(r.f32()-.2)<1e-6);r.f32();r.f32();assert.equal(r.bool(),true);assert.equal(r.remaining(),0);
});

test('498 tags include entity types, menus use VarInts and unported packets stay explicit',()=>{
 const p=decodePacket498(packet('tags',w=>{for(const kind of ['blocks','items','fluids','entities'])w.varint(1).string(kind).varint(2).varint(0).varint(1);}));assert.deepEqual(p.tags.entities,{entities:[0,1]});
 const menu=decodePacket498(packet('open_window',w=>w.varint(300).varint(23).string('{"text":"Loom"}')));assert.equal(menu.windowId,300);assert.equal(menu.inventoryType,23);
 const recipes=decodePacket498(packet('declare_recipes',w=>w.varint(0)));assert.equal(recipes.name,'declare_recipes');assert.deepEqual(recipes.recipes,[]);
 const unknown=decodePacket498(new Writer498().varint(127).build());assert.equal(unknown.name,'unsupported');
 assert.throws(()=>decodePacket498(packet('held_item_slot',w=>w.u8(0).u8(0))),/Trailing data/);
 assert.throws(()=>new Reader498(new Uint8Array()).bytesN(-1),/Invalid byte length/);
});
