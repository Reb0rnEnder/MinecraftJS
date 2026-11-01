import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Game} from '../client/js/game/game.js';import {LocalPlayer} from '../client/js/game/physics.js';import {World} from '../client/js/world/world.js';
import {initBlocks} from '../client/js/world/blocks.js';import {biomeInfo,initBiomes,setServerBiomes} from '../client/js/world/biomes.js';
import {Writer758} from '../client/js/net/protocol-1.18.2.js';import {nbt} from '../client/js/net/nbt.js';
const json=name=>JSON.parse(readFileSync(new URL('../client/data/'+name+'.json',import.meta.url)));initBlocks(json('blocks'),json('blockCollisionShapes'));initBiomes(json('biomes'),null,null);
function codec(key,count){return nbt.compound({[key]:nbt.compound({type:nbt.string(key),value:nbt.list(10,Array.from({length:count},(_,id)=>({id:nbt.int(id),name:nbt.string(id===44?'minecraft:plains':'test:biome_'+id),element:nbt.compound({temperature:{t:5,v:0.5},downfall:{t:5,v:0.4},effects:nbt.compound({water_color:nbt.int(0x123456)})})})))})});}
function scene(){return{world:new World(),player:new LocalPlayer(),settings:{renderDistance:2},assets:{language:'en_us'},interaction:{predictedBlocks:new Map(),predictedDoors:new Map()},entities:{clear(){}},tileRenderer:{clear(){}},pistons:{clear(){}},_resetMeshing(){},sendSettings(){},send(){},applyGameMode:Game.prototype.applyGameMode,screens:{current:null}};}
function join(g,key,count,minY,height){Game.prototype.on_login.call(g,{entityId:1,gameMode:0,dimension:0,worldName:'minecraft:overworld',dimensionData:{min_y:minY,height,has_skylight:1},dimensionCodec:codec(key,count),viewDistance:2,simulationDistance:2});}
function terrain(direct=false){const w=new Writer758();for(let y=0;y<24;y++){
 w.u16(4096).u8(0).varint(1).varint(0);
 if(direct&&y===0){w.u8(7).varint(8);for(let i=0;i<8;i++){let word=0n;for(let j=0;j<9&&i*9+j<64;j++)word|=BigInt((i*9+j)%69)<<BigInt(j*7);w.i64(BigInt.asIntN(64,word));}}
 else w.u8(0).varint(44).varint(0);
 }return{x:3,z:-9,groundUp:true,chunkData:w.build(),blockEntities:[]};}
test('repeated login replaces 174-entry hub registry with 69-entry unqualified backend registry',()=>{
 for(const key of ['minecraft:worldgen/biome','worldgen/biome',':worldgen/biome'])for(const direct of [false,true]){
  const g=scene();join(g,'minecraft:worldgen/biome',174,0,256);assert.equal(g.world.biomeRegistrySize,174);
  join(g,key,69,-64,384);assert.equal(g.world.biomeRegistrySize,69);assert.equal(g.world.sectionCount,24);assert.equal(g.world.minY,-64);
  Game.prototype.on_map_chunk.call(g,terrain(direct));assert.equal(g.world.chunks.size,1);assert.equal(g.world.getState(48,-64,-144),1);
  const biomes=g.world.getChunk(3,-9).biomes;assert.equal(biomes[64],44);if(direct)assert.equal(biomes[63],63);else assert.equal(biomes[0],44);
  assert.equal(biomeInfo(44).name,'plains');assert.equal(biomeInfo(44).waterColor,0x123456);
 }
 setServerBiomes(null);
});
test('unknown biome IDs still reject the whole chunk before changing terrain',()=>{
 const g=scene();join(g,'worldgen/biome',1,-64,384);assert.equal(g.world.biomeRegistrySize,1);
 assert.throws(()=>Game.prototype.on_map_chunk.call(g,terrain()),/biomes id 44, registry size 1/);assert.equal(g.world.chunks.size,0);setServerBiomes(null);
});
