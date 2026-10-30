import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {initBlocks,blocksByName,getBlock} from '../client/js/world/blocks.js';import {Mesher} from '../client/js/render/mesher.js';
const data=JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),shapes=JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url)));initBlocks(data,shapes);
test('all block definitions retain their target-native blend layer independently of light opacity',()=>{
 assert.equal(Object.keys(shapes.render.layers).length,data.length);for(const block of data){const b=getBlock(block.defaultState);assert.equal(b.translucent,shapes.render.layers[block.name]==='translucent',block.name);}
 for(const name of ['honey_block','tinted_glass'])if(blocksByName[name])assert.equal(blocksByName[name].translucent,true,name);
 if(blocksByName.tinted_glass){assert.equal(blocksByName.tinted_glass.filterLight,15);assert.equal(blocksByName.tinted_glass.opaque,false);}
});
test('translucent cubes remain blended in Fancy, Fast and distance LOD meshes',()=>{
 const atlas={uv:()=>[0,0,1,1]},quad={pos:[0,0,0,0,1,0,1,1,0,1,0,0],uv:[0,0,0,1,1,1,1,0],dir:2,cull:-1,tint:-1,shade:false,alpha:true};
 for(const name of ['ice','honey_block','tinted_glass'])if(blocksByName[name])for(const fancy of [true,false])for(const lod of [true,false]){
  const state=blocksByName[name].defaultState,section=new Uint32Array(4096);section[0]=state;
  const world={getSectionBlocks:()=>section,getState:(x,y,z)=>x===0&&y===0&&z===0?state:0,getLight:()=>0xf0,getBiome:()=>1},m=new Mesher(world,{atlas});m.options.fancy=fancy;m.getModel=()=>({quads:[quad],ao:false});
  const result=m.buildSection(world,0,0,0,lod);assert.equal(result.solid.length,0,name);assert.equal(result.cutout.length,0,name);assert.equal(result.translucent.length,80,name);
 }
});
test('partial native layer tables are rejected instead of reverting silently to name lists',()=>{
 assert.throws(()=>initBlocks(data,{...shapes,render:{...shapes.render,layers:{air:'solid'}}}),/Missing native block render layer/);initBlocks(data,shapes);
});
