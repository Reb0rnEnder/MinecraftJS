import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {BiomeZoom} from '../client/js/world/biome-zoom.js';import {World} from '../client/js/world/world.js';import {Chunk} from '../client/js/world/chunk.js';import {buildSlice,SliceWorld} from '../client/js/world/slice.js';
const fixture=JSON.parse(readFileSync(new URL('fixtures/biome-zoom-1.15.2.json',import.meta.url)));
test('seeded biome zoom matches 100 native jar oracle samples across signed 64-bit seeds',()=>{
 assert.equal(fixture.clientJarSha1,'e3f78cd16f9eb9a52307ed96ebec64241cc5b32d');for(const row of fixture.cases){const zoom=new BiomeZoom(row.seed);assert.deepEqual(zoom.cell(...row.position),row.cell);assert.equal(zoom.sample(...row.position,(x,y,z)=>[x,y,z].join(',')),row.cell.join(','));}
});
test('uniform biome volumes avoid corner hashing without changing their biome',()=>{
 const zoom=new BiomeZoom(1);zoom.offset=()=>{throw Error('uniform volume calculated unused noise');};assert.equal(zoom.sample(10,64,-100,()=>3),3);
});
test('worker snapshots preserve seeded interpolation across horizontal chunk boundaries and Y',()=>{
 const w=new World();w.setBiomeSeed(-9223372036854775808n);
 for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++){const c=new Chunk(x,z,true);c.biomes=Uint32Array.from({length:1024},(_,i)=>((i>>4)+x*3+z*5+100)%128);w.chunks.set(World.key(x,z),c);}
 const slice=new SliceWorld(buildSlice(w,0,4,0));for(const [x,y,z]of [[0,64,0],[15,78,15],[-1,63,0],[0,66,-1]])assert.equal(slice.getBiome(x,z,y),w.getBiome(x,z,y));
 w.clear();assert.equal(w.biomeZoom,null);
});
