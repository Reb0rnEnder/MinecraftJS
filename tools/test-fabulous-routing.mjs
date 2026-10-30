import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {initBlocks,blocksByName} from '../client/js/world/blocks.js';import {ItemRenderer} from '../client/js/render/item-renderer.js';import {Node,Batcher,drawTree} from '../client/js/gfx/scene.js';import {Mesher} from '../client/js/render/mesher.js';
const data=JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),shapes=JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url)));initBlocks(data,shapes);
test('world glass/ice/honey items select the item target while clear cutout glass and ordinary items stay on main',()=>{
 const atlasMat={},renderer={game:{items:{hasEffect:()=>false}},meshFor(item){return{mesh:{},model:{kind:'block',itemName:item.name}};}};
 for(const name of ['ice','honey_block','red_stained_glass','tinted_glass','glass','stone','apple'])if(name==='apple'||blocksByName[name]){
  const result=ItemRenderer.prototype.objectFor.call(renderer,{name},atlasMat);assert.equal(result.obj.drawables[0].outputTarget,['ice','honey_block','red_stained_glass','tinted_glass'].includes(name)?'itemEntity':undefined,name);
 }
});
test('entity batching keeps main and item target commands independent',()=>{
 const commands=[],device={createMesh(){return{};},updateMesh(){},draw(d){commands.push(d);}},batcher=new Batcher(device),root=new Node(),mesh={quads:true,cpu:new Float32Array(44),vertexCount:4},mat={pipeline:'entity',tex:{},params:new Float32Array(16),state:{}};
 for(const target of ['itemEntity','itemEntity',undefined,undefined]){const node=new Node();node.addDrawable(mesh,mat);node.drawables[0].outputTarget=target;root.add(node);}
 drawTree(device,root,{batcher});assert.equal(commands.length,2);assert.equal(commands[0].outputTarget,'itemEntity');assert.equal(commands[1].outputTarget,undefined);assert.equal(commands[0].count,12);assert.equal(commands[1].count,12);
});
test('tripwire is preserved as independent weather-layer geometry for worker transfer and culling',()=>{
 const state=blocksByName.tripwire.defaultState,section=new Uint32Array(4096);section[0]=state;
 const world={getSectionBlocks:()=>section,getState:(x,y,z)=>x===0&&y===0&&z===0?state:0,getLight:()=>0xf0,getBiome:()=>1},m=new Mesher(world,{atlas:{uv:()=>[0,0,1,1]}});
 m.getModel=()=>({ao:false,quads:[{pos:[0,0,0,0,1,0,1,1,0,1,0,0],uv:[0,0,0,1,1,1,1,0],dir:2,cull:-1,tint:-1,shade:false,alpha:true}]});
 const result=m.buildSection(world,0,0,0);assert.equal(result.tripwire.length,80);assert.equal(result.cutout.length+result.solid.length+result.translucent.length,0);
});
