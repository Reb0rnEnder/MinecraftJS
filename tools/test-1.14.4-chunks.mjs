import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Writer498} from '../client/js/net/protocol-1.14.4.js';
import {decodeChunkData498} from '../client/js/world/chunk-1.14.4.js';
function section(bits,palette,values,nonAir=4096) {
 const w=new Writer498().u16(nonAir).u8(bits);
 if(palette){w.varint(palette.length);for(const v of palette)w.varint(v);}
 const packed=new Array(bits*64).fill(0n),mask=(1n<<BigInt(bits))-1n;
 for(let i=0;i<4096;i++) {
  const offset=i*bits,index=Math.floor(offset/64),shift=offset%64,value=BigInt(values[i])&mask;
  packed[index]|=value<<BigInt(shift);if(shift+bits>64)packed[index+1]|=value>>BigInt(64-shift);
 }
 w.varint(packed.length);for(const value of packed)w.i64(BigInt.asIntN(64,value));return w.build();
}
const packet=(data,mask=1,groundUp=false)=>({chunkData:data,bitMap:mask,groundUp});
test('native sections read non-air counts and continuous cross-long local palettes without consuming light bytes',()=>{
 const palette=Array.from({length:17},(_,i)=>i+5),values=Array.from({length:4096},(_,i)=>i%17);
 const decoded=decodeChunkData498(packet(section(5,palette,values,4000),1<<7));
 assert.equal(decoded.sections[7].wireNonAir,4000);assert.equal(decoded.sections[7].nonAir,4096);assert.equal(decoded.sections[0],null);assert.equal(decoded.biomes,null);
 assert.deepEqual([...decoded.sections[7].blocks],values.map(i=>palette[i]));
});
test('global palettes omit a palette-length field and retain 14-bit registry IDs',()=>{
 const values=Array.from({length:4096},(_,i)=>(i*29)%11271),data=section(14,null,values);
 const decoded=decodeChunkData498(packet(data));assert.deepEqual([...decoded.sections[0].blocks],values);
});
test('full chunks carry 256 biome IDs after all sections; partial chunks omit biomes',()=>{
 const w=new Writer498().raw(section(4,[0],new Array(4096).fill(0),0));for(let i=0;i<256;i++)w.i32(i%73);
 const chunk=decodeChunkData498(packet(w.build(),1,true));assert.equal(chunk.sections[0].nonAir,0);assert.equal(chunk.biomes[255],255%73);
 const empty=new Writer498();for(let i=0;i<256;i++)empty.i32(1);assert.ok(decodeChunkData498(packet(empty.build(),0,true)).sections.every(v=>v===null));
});
test('corrupt section payloads fail explicitly instead of shifting into following data',()=>{
 const data=section(4,[1],new Array(4096).fill(0));assert.throws(()=>decodeChunkData498(packet(data.subarray(0,data.length-1))),/underflow/);
 assert.throws(()=>decodeChunkData498(packet(data,1<<16)),/section mask/);
 assert.throws(()=>decodeChunkData498(packet(section(4,[1],new Array(4096).fill(1)))),/palette index/);
 assert.throws(()=>decodeChunkData498(packet(section(4,[11271],new Array(4096).fill(0)))),/registry state/);
 const extra=new Uint8Array(data.length+1);extra.set(data);assert.throws(()=>decodeChunkData498(packet(extra)),/Trailing/);
});

test('vanilla 1.14.4 fluid double-counts do not reject a valid section; all native air states count as empty',()=>{
 const values=Array.from({length:4096},(_,i)=>i%4);
 const p=decodeChunkData498(packet(section(4,[0,9129,9130,34],values,8192)));
 assert.equal(p.sections[0].wireNonAir,8192);assert.equal(p.sections[0].nonAir,1024);
});
