import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {World} from '../client/js/world/world.js';import {Writer498} from '../client/js/net/protocol-1.14.4.js';
import {initBlocks} from '../client/js/world/blocks.js';import {buildSlice} from '../client/js/world/slice.js';
import {Game} from '../client/js/game/game.js';
initBlocks(JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url))));
const bytes=v=>new Uint8Array(2048).fill(v|(v<<4));
function terrain(x=0,z=0,groundUp=true,stone=false){const w=new Writer498();if(stone){w.u16(4096).u8(4).varint(1).varint(1).varint(256);for(let i=0;i<256;i++)w.i64(0n);}if(groundUp)for(let i=0;i<256;i++)w.i32(1);return {x,z,groundUp,bitMap:stone?1:0,chunkData:w.build(),heightmaps:null};}
const light=(sky={},block={},extra={})=>({chunkX:0,chunkZ:0,skyLight:sky,blockLight:block,emptySkyLightMask:0,emptyBlockLightMask:0,...extra});
test('light before terrain remains independent and lights empty sections in both world and worker slices',()=>{
 const w=new World();w.updateLight498(light({3:bytes(12)},{3:bytes(4)}));assert.equal(w.chunks.size,0);
 w.loadChunk498(terrain());assert.equal(w.getSkyLight(3,50,3),12);assert.equal(w.getBlockLight(3,50,3),4);
 const sl=buildSlice(w,0,3,0);assert.equal(sl.light[(4*20+5)*20+5],0xc4);
});
test('terrain then light, partial light updates and empty masks preserve other sections',()=>{
 const w=new World();w.loadChunk498(terrain(0,0,true,true));assert.equal(w.getSkyLight(1,3,1),0);
 w.updateLight498(light({0:bytes(15),1:bytes(7)},{0:bytes(8)}));assert.equal(w.getSkyLight(1,3,1),15);assert.equal(w.getBlockLight(1,3,1),8);
 w.updateLight498(light({}, {},{emptySkyLightMask:2}));assert.equal(w.getSkyLight(1,3,1),0);assert.equal(w.getSkyLight(1,18,1),7);assert.equal(w.getBlockLight(1,3,1),8);
 w.loadChunk498(terrain(0,0,false));assert.equal(w.getState(0,0,0),1);assert.equal(w.getBlockLight(1,3,1),8);
});
test('boundary light layers, unload/reload and dimension reset have distinct lifetimes',()=>{
 const w=new World();w.loadChunk498(terrain());w.updateLight498(light({'-1':bytes(5),16:bytes(13)}));assert.equal(w.getSkyLight(0,-1,0),5);assert.equal(w.getSkyLight(0,256,0),13);
 const dirty=[];w.on('sectionDirty',(...a)=>dirty.push(a));w.updateLight498(light({0:bytes(15)}));assert.ok(dirty.some(([x,y,z])=>x===1&&y===1&&z===1));
 w.unloadChunk(0,0);assert.equal(w.lightColumns.size,0);w.loadChunk498(terrain());assert.equal(w.getSkyLight(0,0,0),0);
 w.clear();assert.equal(w.lightColumns.size,0);w.setDimension(-1);w.loadChunk498(terrain());assert.equal(w.getSkyLight(0,256,0),0);
});
test('full terrain replacement clears removed geometry but retains independent light',()=>{
 const w=new World();w.loadChunk498(terrain(0,0,true,true));w.updateLight498(light({0:bytes(15)}));const dirty=[];w.on('sectionDirty',(...a)=>dirty.push(a));
 w.loadChunk498(terrain());assert.equal(w.getState(0,0,0),0);assert.equal(w.getSkyLight(0,0,0),15);assert.ok(dirty.some(([x,y,z])=>x===0&&y===0&&z===0));
});
test('worker results invalidated by new light are discarded and previous-world replies cannot clear current work',()=>{
 const worker={},set=[];const g={assets:{worker},world:{getChunk:()=>({})},renderer:{setSectionMesh:(...a)=>set.push(a)}};Game.prototype._setupWorker.call(g);
 g.inFlight.set('0,0,0',1);g.dirty.add('0,0,0');worker.onmessage({data:{type:'built',x:0,y:0,z:0,gen:g.meshGen}});assert.equal(set.length,0);assert.equal(g.inFlight.size,0);assert.ok(g.dirty.has('0,0,0'));
 g.inFlight.set('0,0,0',1);worker.onmessage({data:{type:'built',x:0,y:0,z:0,gen:g.meshGen-1}});assert.equal(g.inFlight.size,1);
});
