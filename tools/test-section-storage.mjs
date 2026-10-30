import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {World} from '../client/js/world/world.js';import {Chunk,Section} from '../client/js/world/chunk.js';import {initBlocks,blocksByName} from '../client/js/world/blocks.js';import {sectionKey,sectionCoords} from '../client/js/world/section-key.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(json('blocks'),json('blockCollisionShapes'));const state=b=>b.defaultState??b.id<<4,stone=state(blocksByName.stone);
test('highest native block produces height 256 without wrapping and keeps the column below shaded',()=>{
 const w=new World(),c=new Chunk(0,0,true);w.chunks.set('0,0',c);c.setState(0,255,0,stone);w._computeHeights(c);assert.equal(c.heightMap[0],256);assert.equal(w._sourceLevel(true,0,254,0),0);
});
test('section keys round-trip at the native world border without horizontal aliasing',()=>{
 const keys=new Set();for(const x of[-1875000,0,1875000])for(const z of[-1875000,0,1875000])for(const y of[0,15]){const key=sectionKey(x,y,z);assert.ok(Number.isSafeInteger(key));assert.deepEqual(sectionCoords(key),[x,y,z]);keys.add(key);}assert.equal(keys.size,18);
});
test('all target air variants remain empty when written/recounted',()=>{
 const s=new Section(true);for(const name of['air','cave_air','void_air'])if(blocksByName[name]){
  const air=state(blocksByName[name]);s.set(0,0,0,air);assert.equal(s.nonAir,0,name);s.set(0,0,0,stone);assert.equal(s.nonAir,1);s.set(0,0,0,air);assert.equal(s.nonAir,0);s.blocks.fill(air);s.recount();assert.equal(s.nonAir,0);
 }
});
