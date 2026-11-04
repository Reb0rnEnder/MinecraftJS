import {test} from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../client/js/world/world.js';
import {Chunk,Section} from '../client/js/world/chunk.js';
const method=Object.getOwnPropertyNames(World.prototype).find(name=>/^updateLight\d+$/.test(name));
function fixture(){
 const w=new World(),min=w.minSection??0,max=w.maxSection??16,H=max-min;
 const c=new Chunk(0,0,true,w);for(let y=min;y<max;y++){if(c.setSection)c.setSection(y,new Section(false));else c.sections[y]=new Section(false);}
 w.chunks.set('0,0',c);w._gen++;const dirty=[];w.on('sectionDirty',(...p)=>dirty.push(p.join(',')));
 const update=(skyLight={},blockLight={},extra={})=>w[method]({chunkX:0,chunkZ:0,skyLight,blockLight,emptySkyLightMask:0,emptyBlockLightMask:0,...extra});
 return{w,c,min,max,H,dirty,update};
}
test('changed server light dirties each affected neighbouring section once; duplicate light reuses owned arrays',()=>{
 const f=fixture(),sky={},block={};for(let i=0;i<f.H;i++){sky[i]=new Uint8Array(2048).fill(0xff);block[i]=new Uint8Array(2048).fill(0x77);}
 f.update(sky,block);assert.equal(f.dirty.length,f.H*9);assert.equal(new Set(f.dirty).size,f.dirty.length);
 const light=f.w._lightColumn(0,0),first=light.sky[1];assert.notEqual(first,sky[0]);f.dirty.length=0;
 f.update(sky,block);assert.equal(f.dirty.length,0);assert.equal(light.sky[1],first);
 sky[0][0]=0x11;f.update(sky);assert.equal(first[0],0xff,'network buffers are never retained by reference');assert.equal(light.sky[1][0],0x11);assert.ok(f.dirty.length>0);
});
test('explicit empty masks, unknown sky and all-zero data masks keep distinct native semantics',()=>{
 const f=fixture(),light=f.w._lightColumn(0,0);assert.equal(light.skyKnown,false);
 f.update({}, {},{emptySkyLightMask:2});assert.equal(light.skyKnown,true);assert.ok(f.dirty.length>0);f.dirty.length=0;
 f.update({}, {},{emptySkyLightMask:2});assert.equal(f.dirty.length,0);
 const empty=light.sky[1];f.update({0:new Uint8Array(2048)});assert.ok(f.dirty.length>0,'data mask changes even when the bytes are zero');assert.equal(light.sky[1],empty);
 f.dirty.length=0;f.update({0:new Uint8Array(2048)});assert.equal(f.dirty.length,0);
 f.update({}, {},{emptySkyLightMask:2});assert.ok(f.dirty.length>0);
});
test('light that arrives before terrain survives, and malformed arrays remain rejected',()=>{
 const f=fixture();f.w.unloadChunk(0,0);f.update({0:new Uint8Array(2048).fill(0xcc)});assert.equal(f.w.chunks.size,0);assert.equal(f.w._lightColumn(0,0).sky[1][0],0xcc);
 assert.throws(()=>f.update({0:new Uint8Array(2047)}),/Invalid light section/);
});
