import {test} from 'node:test';import assert from 'node:assert/strict';
import {registryEntries} from '../client/js/net/registry-codec.js';
import {initBiomes,setServerBiomes,biomeInfo} from '../client/js/world/biomes.js';
const entry=(id,name,waterColor)=>({id,name,element:{temperature:0.5,downfall:0.4,effects:{water_color:waterColor}}});
test('native default namespace applies to registry keys and server biome effects',()=>{
 initBiomes([{id:0,name:'vanilla',temperature:0.8,rainfall:0.4}],null,null);
 for(const key of ['minecraft:worldgen/biome','worldgen/biome',':worldgen/biome']){
  const entries=[entry(0,'minecraft:badlands',123),entry(44,'minecraft:plains',456)],codec={[key]:{type:key,value:entries}};
  assert.equal(registryEntries(codec,'minecraft:worldgen/biome'),entries);
  setServerBiomes(codec);assert.equal(biomeInfo(0).name,'badlands');assert.equal(biomeInfo(44).waterColor,456);
 }
 setServerBiomes(null);
});
test('custom registry namespaces stay separate and a valid one-entry registry stays small',()=>{
 const single=[entry(0,'minecraft:plains',123)];assert.deepEqual(registryEntries({'custom:worldgen/biome':{value:single}},'minecraft:worldgen/biome'),[]);
 assert.equal(registryEntries({'custom:worldgen/biome':{value:single}},'custom:worldgen/biome'),single);
 assert.equal(registryEntries({'worldgen/biome':{value:single}},'minecraft:worldgen/biome').length,1);
 assert.deepEqual(registryEntries(null,'minecraft:worldgen/biome'),[]);
});
test('a server switch replaces the prior custom biome table',()=>{
 setServerBiomes({'minecraft:worldgen/biome':{value:[entry(173,'old:biome',123)]}});assert.equal(biomeInfo(173).name,'old:biome');
 setServerBiomes({'worldgen/biome':{value:[entry(0,'minecraft:badlands',456)]}});assert.notEqual(biomeInfo(173).name,'old:biome');assert.equal(biomeInfo(0).waterColor,456);setServerBiomes(null);
});
