import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{initBlocks,findState,getBlock,getStateProperties}from'../client/js/world/blocks.js';import{resolveState}from'../client/js/world/blockstates.js';import{TileEntityRenderer}from'../client/js/render/tile-renderer.js';import{ModelStore}from'../client/js/render/models.js';import{Node}from'../client/js/gfx/scene.js';import{Pistons}from'../client/js/game/pistons.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(json('blocks'),json('blockCollisionShapes'));
const directions=['down','up','north','south','west','east'];
test('all extended piston heads remain model-rendered, including sticky and short variants',()=>{
 for(const facing of directions)for(const type of ['normal','sticky'])for(const short of ['true','false']){
  const st=findState('piston_head',{facing,type,short});assert.equal(getBlock(st).hasModel,true);const rs=resolveState(st,()=>0,0,0,0);assert.ok(rs);assert.equal(rs.file,'piston_head');assert.deepEqual(rs.props,{facing,type,short});
 }
});
test('retracting moving renderer uses native head/base states, never metadata-composed fire states',()=>{
 for(const facing of directions)for(const sticky of [false,true])for(const progress of [0,.25,.5,.75]){
  const t={state:findState(sticky?'sticky_piston':'piston',{facing,extended:'false'}),head:true,extending:false,facing:directions.indexOf(facing),progress,lastProgress:progress,x:0,y:64,z:0},seen=[];
  const game={pistons:{moving:new Map([['piston',t]])},assets:{},world:{getSkyLight:()=>15,getBlockLight:()=>0}},r=Object.assign(Object.create(TileEntityRenderer.prototype),{game,group:new Node(),_stateMesh(st,props){seen.push({st,props});return null;}});
  r._renderMoving(1);assert.equal(seen.length,2);assert.equal(getBlock(seen[0].st).name,'piston_head');assert.equal(getStateProperties(seen[0].st).facing,facing);assert.equal(getStateProperties(seen[0].st).type,sticky?'sticky':'normal');assert.equal(getBlock(seen[1].st).name,sticky?'sticky_piston':'piston');assert.equal(getStateProperties(seen[1].st).extended,'true');
  const collision=Pistons.prototype._collisionState(t);assert.equal(getStateProperties(collision).facing,facing);assert.equal(getStateProperties(collision).type,sticky?'sticky':'normal');
 }
});

test('native piston head variants bake visible geometry with the shipped block models',()=>{
 const data=JSON.parse(readFileSync(new URL('../client/assets/bundles/models.json',import.meta.url))),store=new ModelStore(data.models,data.blockstates,{uv:()=>[0,0,1,1],hasAlpha:()=>false});
 for(const facing of directions)for(const type of ['normal','sticky'])for(const short of ['true','false']){const st=findState('piston_head',{facing,type,short}),rs=resolveState(st,()=>0,0,0,0);assert.ok(store.bakeVariant(rs.file,rs.props).quads.length>=6);}
});
