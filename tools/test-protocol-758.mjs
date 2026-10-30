import {readFileSync} from 'node:fs';import {initBlocks} from '../client/js/world/blocks.js';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {Writer758,Reader758,decodePacket758,C758} from '../client/js/net/protocol-1.18.2.js';
import {CLIENTBOUND_758 as IN,SERVERBOUND_758 as OUT} from '../client/js/net/protocol-1.18.2-ids.js';
import {decodeChunkData758,readPalette758} from '../client/js/world/chunk-1.18.2.js';
import {World} from '../client/js/world/world.js';import {nbt,writeNbtRoot,simplify} from '../client/js/net/nbt.js';
initBlocks(JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url))));
const packet=name=>new Writer758().varint(IN[name]);
const single=(w,id)=>w.u8(0).varint(id).varint(0);
function section(w,state=0,biome=1){w.u16(state?4096:0);single(w,state);single(w,biome);return w;}
function chunkData(n=24){const w=new Writer758();for(let i=0;i<n;i++)section(w,i===0||i===n-1?1:0,i%61);return w.build();}
function light(w,sky=0n){w.bool(true);for(const mask of [sky,0n,0n,0n]){const words=mask>0n?Math.ceil(mask.toString(2).length/64):0;w.varint(words);for(let i=0;i<words;i++)w.i64(BigInt.asIntN(64,mask>>BigInt(i*64)));}w.varint(sky?1:0);if(sky)w.varint(2048).raw(new Uint8Array(2048).fill(255));return w.varint(0);}
function fullChunk(data=chunkData()){const w=packet('map_chunk').i32(-2).i32(3).u8(0).varint(data.length).raw(data).varint(1).u8(0xa5).i16(-63).varint(7);writeNbtRoot(w,nbt.compound({Text1:nbt.string('{"text":"below zero"}')}));return decodePacket758(light(w,2n).build());}
test('combined terrain/light preserves compact block entity coordinates and full section biomes',()=>{
 const p=fullChunk(),d=decodeChunkData758(p);assert.equal(d.sections.length,24);assert.equal(d.sections[0].nonAir,4096);assert.equal(d.sections[1].nonAir,0);assert.equal(d.biomes.length,1536);assert.equal(d.biomes[1535],23);assert.equal(p.skyLight[0][0],255);assert.deepEqual(simplify(p.blockEntities[0]),{Text1:'{"text":"below zero"}',id:'minecraft:sign',x:-22,y:-63,z:53});
});
test('negative/tall world sections survive reload and dimension changes',()=>{
 const w=new World();w.setDimension(0,{min_y:-64,height:384});const p=fullChunk(),c=w.loadChunk758(p);assert.equal(w.getState(-32,-64,48),1);assert.equal(w.getState(-32,319,48),1);assert.equal(w.getState(-32,320,48),0);assert.equal(c.heightMap[0],320);assert.equal(c.getSkyLight(0,-64,0),15);
 const data=new Writer758();for(let i=0;i<24;i++)section(data,0,2);w.loadChunk758(fullChunk(data.build()));assert.equal(w.getState(-32,319,48),0);assert.equal(w.getChunk(-2,3).biomes[0],2);w.setDimension(-1,{min_y:0,height:256});assert.equal(w.chunks.size,0);assert.equal(w.sectionCount,16);
});
function packed(values,bits){const w=new Writer758(),per=Math.floor(64/bits),n=Math.ceil(values.length/per);w.varint(n);for(let i=0;i<n;i++){let x=0n;for(let j=0;j<per&&i*per+j<values.length;j++)x|=BigInt(values[i*per+j])<<BigInt(j*bits);w.i64(BigInt.asIntN(64,x));}return w.build();}
test('local and direct palettes agree with a BigInt oracle across word boundaries',()=>{
 for(const [kind,size,registry,widths]of [['blocks',4096,20342,[4,5,8,15]],['biomes',64,61,[1,2,3,6]]])for(const bits of widths){const local=bits<=(kind==='blocks'?8:3),count=local?Math.min(2**bits,registry):registry,values=Array.from({length:size},(_,i)=>(i*37+11)%count),w=new Writer758().u8(bits);if(local){w.varint(count);for(let i=0;i<count;i++)w.varint(i);}w.raw(packed(values,bits));assert.deepEqual([...readPalette758(new Reader758(w.build()),size,registry,kind)],values);}
});
test('native single-palette size padding is accepted within its measured budget',()=>{const data=chunkData();assert.equal(decodeChunkData758(fullChunk(new Uint8Array([...data,...new Uint8Array(24)]))).sections.length,24);assert.throws(()=>decodeChunkData758(fullChunk(new Uint8Array([...data,...new Uint8Array(25)]))),/Trailing/);});
test('malformed palettes, lengths, bounds and trailing packet bytes fail',()=>{
 assert.throws(()=>decodeChunkData758({chunkData:new Uint8Array(0)}));assert.throws(()=>decodeChunkData758(fullChunk(new Uint8Array([...chunkData(),1]))),/Trailing/);
 assert.throws(()=>readPalette758(new Reader758(new Writer758().u8(0).varint(61).varint(0).build()),64,61,'biomes'),/single palette/);
 assert.throws(()=>readPalette758(new Reader758(new Writer758().u8(0).varint(1).varint(1).build()),64,61,'biomes'),/no longs/);
 assert.throws(()=>decodePacket758(packet('simulation_distance').varint(5).u8(0).build()),/Trailing/);
});
test('third mask word and boundary light layers remain intact',()=>{
 const p=decodePacket758(light(packet('update_light').varint(3).varint(-4),1n<<131n).build());assert.equal(p.skyLightMask,1n<<131n);assert.equal(p.skyLight[130].length,2048);const w=new World();w.setDimension(0,{min_y:-2032,height:4064});w.updateLight758(p);assert.equal(w.lightColumns.get('3,-4').sky[131][0],255);
});
test('758 control/effect packets and client information use native fields',()=>{
 assert.equal(decodePacket758(packet('simulation_distance').varint(12).build()).distance,12);
 const e=decodePacket758(packet('entity_effect').varint(10).varint(130).i8(2).varint(300).u8(3).build());assert.equal(e.effectId,130);assert.equal(e.amplifier,2);
 const r=new Reader758(C758.settings());assert.equal(r.varint(),OUT.settings);assert.equal(r.string(),'en_us');r.i8();r.varint();r.bool();r.u8();r.varint();assert.equal(r.bool(),false);assert.equal(r.bool(),true);assert.equal(r.remaining(),0);
 const particle=new Reader758(new Writer758().varint(10).build());assert.equal(particle.particleData(3).blockState,10);assert.equal(particle.remaining(),0);
});
