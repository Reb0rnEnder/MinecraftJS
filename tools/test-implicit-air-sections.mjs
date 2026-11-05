import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {World} from '../client/js/world/world.js';import {initBlocks,blocksByName} from '../client/js/world/blocks.js';
import {Writer} from '../client/js/net/buffer.js';
initBlocks(JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url))));
const method=Object.getOwnPropertyNames(World.prototype).find(name=>/^loadChunk[0-9]+$/.test(name)),protocol=Number(method.replace('loadChunk',''));
function world(){const w=new World();w.setDimension(0,protocol>=758?{min_y:-64,height:384}:undefined);w.biomeRegistrySize=1;return w;}
function packet(w,states=[]) {
 const data=new Writer(),count=w.sectionCount||16;
 for(let i=0;i<count;i++){
  data.u16(0);
  if(protocol>=758)data.u8(0).varint(states[i]||0).varint(0).u8(0).varint(0).varint(0);
  else data.u8(4).varint(1).varint(states[i]||0).varint(256).raw(new Uint8Array(2048));
 }
 if(protocol===498)data.raw(new Uint8Array(1024));
 return{x:0,z:0,groundUp:true,bitMap:protocol>=756?(1n<<BigInt(count))-1n:65535,chunkData:data.build(),biomes:new Uint32Array(count*64),skyLight:{0:new Uint8Array(2048).fill(255)},blockLight:{},emptySkyLightMask:0,emptyBlockLightMask:0};
}
test('ordinary-air sections are implicit, while separate sky lighting and later block placement survive',()=>{
 const w=world(),min=w.minY||0,c=(w[Object.getOwnPropertyNames(World.prototype).find(n=>/^updateLight[0-9]+$/.test(n))]({...packet(w),chunkX:0,chunkZ:0}),w[method](packet(w))); assert.equal(c.sections.filter(Boolean).length,0);assert.equal(w.getState(0,min,0),0);assert.equal(c.getSkyLight(0,min,0),15);
 c.setState(0,min,0,blocksByName.stone.defaultState);assert.equal(w.getState(0,min,0),blocksByName.stone.defaultState);assert.equal(c.getSkyLight(0,min,0),15);
 w[method](packet(w));assert.equal((c.getSection?c.getSection(min>>4):c.sections[0]),null);assert.equal(w.getState(0,min,0),0);
});
test('cave and void air keep their exact native state IDs even though they have no visible geometry',()=>{
 const w=world(),min=w.minY||0;
 const c=w[method](packet(w,[blocksByName.cave_air.defaultState,blocksByName.void_air.defaultState]));assert.equal(c.sections.filter(Boolean).length,2);
 assert.equal(w.getState(0,min,0),blocksByName.cave_air.defaultState);assert.equal(w.getState(0,min+16,0),blocksByName.void_air.defaultState);
});
