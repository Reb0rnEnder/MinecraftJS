import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {initBlocks,blocksByName} from '../client/js/world/blocks.js';import {World} from '../client/js/world/world.js';import {Chunk} from '../client/js/world/chunk.js';import {verticalBounds} from '../client/js/world/vertical-bounds.js';import {sectionKey,sectionCoords} from '../client/js/world/section-key.js';
import {Writer758,decodePacket758} from '../client/js/net/protocol-1.18.2.js';import {CLIENTBOUND_758 as IN} from '../client/js/net/protocol-1.18.2-ids.js';import {decodeChunkData758} from '../client/js/world/chunk-1.18.2.js';import {SectionCuller} from '../client/js/render/culling.js';import {buildSlice,SliceWorld} from '../client/js/world/slice.js';import {columnHeights,packetHeight} from '../client/js/gui/debug-overlay.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));const shapes=json('blockCollisionShapes');initBlocks(json('blocks'),shapes);const stone=blocksByName.stone.defaultState;
function terrain(count,stoneIndices=[]){const w=new Writer758();for(let i=0;i<count;i++){const state=stoneIndices.includes(i)?stone:0;w.u16(state?4096:0).u8(0).varint(state).varint(0).u8(0).varint(1).varint(0);}return{x:0,z:0,groundUp:true,chunkData:w.build(),skyLight:{},blockLight:{},emptySkyLightMask:0,emptyBlockLightMask:0};}
function world(){const w=new World();w.setDimension(0,{min_y:-64,height:384,logical_height:384,has_skylight:true});return w;}
test('native DimensionType bounds accept aligned custom heights and reject malformed ranges',()=>{
 assert.equal(verticalBounds({min_y:-2032,height:4064}).sectionCount,254);
 for(const data of[{min_y:-63,height:384},{min_y:-64,height:385},{min_y:0,height:4096},{min_y:-2048,height:256},{min_y:0,height:16,logical_height:17}])assert.throws(()=>verticalBounds(data),/bounds/);
});
test('negative and tall sections keep states, biomes, heights, collisions and worker slices',()=>{
 const w=world(),c=w.loadChunk758(terrain(24,[0,23]));
 assert.equal(c.sections.length,24);assert.equal(w.getState(0,-64,0),stone);assert.equal(w.getState(0,319,0),stone);assert.equal(w.getState(0,320,0),0);assert.equal(c.heightMap[0],320);
 c.biomes[0]=2;c.biomes[1520]=3;assert.equal(w.getNoiseBiome(0,-16,0),2);assert.equal(w.getNoiseBiome(0,79,0),3);
 assert.ok(w.getCollisions([.1,-64.1,.1,.9,-63.1,.9]).some(b=>b[1]===-64));
 const sl=new SliceWorld(buildSlice(w,0,-4,0));assert.equal(sl.getState(0,-64,0),stone);assert.equal(sl.getBiome(0,0,-64),w.getBiome(0,0,-64));
 const h=columnHeights({assets:{data:{blockCollisionShapes:shapes}}},c,0,0);assert.deepEqual(h,{S:319,M:319});
});
test('wire masks retain a third 64-bit word and terrain/light sections above bit 63',()=>{
 const w=new World();w.setDimension(0,{min_y:-2032,height:4064});
 const decoded=terrain(254,[130]);assert.equal(decodeChunkData758(decoded,{sectionCount:254}).sections[130].nonAir,4096);
 const c=w.loadChunk758(decoded),y=(w.minSection+130)*16;assert.equal(c.getState(0,y,0),stone);
 const light=new Writer758().varint(IN.update_light).varint(0).varint(0).bool(true);
 for(const mask of[1n<<131n,0n,0n,0n])light.varint(3).i64(mask&((1n<<64n)-1n)).i64(mask>>64n&((1n<<64n)-1n)).i64(mask>>128n);
 light.varint(1).varint(2048).raw(new Uint8Array(2048).fill(0xaa)).varint(0);w.updateLight758(decodePacket758(light.build()));assert.equal(c.getSkyLight(0,y,0),10);assert.equal(c.getSkyLight(0,2033,0),15);
});
test('custom-height culling reaches negative sections and keys do not alias neighboring columns',()=>{
 const bounds={minSection:-4,sectionCount:24},culler=new SectionCuller(),a={cx:0,sy:-4,cz:0,solid:{}},b={cx:0,sy:19,cz:0,solid:{}},sections=new Map([[sectionKey(0,-4,0),a],[sectionKey(0,19,0),b]]);
 const reached=culler.update(sections,[],[1,-63,1],2,(x,z)=>x===0&&z===0,false,Infinity,bounds);assert.ok(reached.includes(a));assert.ok(reached.includes(b));assert.equal(culler.isVisible(1,-63,1),true);
 const keys=new Set();for(const x of[-1875000,0,1875000])for(const z of[-1875000,0,1875000])for(const y of[-127,-4,0,19,126]){const k=sectionKey(x,y,z);assert.ok(Number.isSafeInteger(k));assert.deepEqual(sectionCoords(k),[x,y,z]);keys.add(k);}assert.equal(keys.size,45);
});
test('custom server height maps use height-derived bit width and add min-Y',()=>{
 const c=new Chunk(0,0,true,{minY:-64,height:384}),raw=new Array(Math.ceil(256/7)).fill(0n);raw[0]=384n;
 c.heightmaps={WORLD_SURFACE:raw};assert.equal(packetHeight(c,'WORLD_SURFACE',0,0),319);
 const tall=new Chunk(0,0,true,{minY:-2032,height:4064});tall.heightmaps={WORLD_SURFACE:[4064n]};assert.equal(packetHeight(tall,'WORLD_SURFACE',0,0),2031);
});
test('dimension reset invalidates old vertical light/terrain storage',()=>{
 const w=world();w.loadChunk758(terrain(24));assert.equal(w.chunks.size,1);w.setDimension(0,{min_y:0,height:256});assert.equal(w.chunks.size,0);assert.equal(w.lightColumns.size,0);assert.equal(w.minY,0);
});
