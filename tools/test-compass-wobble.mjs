import {test} from 'node:test';import assert from 'node:assert/strict';import {compassProperty} from '../client/js/render/compass.js';
const game=()=>({dimension:-1,worldName:'minecraft:the_nether',dimensionData:{natural:false},world:{worldAge:100},player:{x:10,z:10,yaw:0},items:{nbt:()=>null},spawnPos:{x:0,z:0}});
test('native 1.16 stack identity phase is stable across repeated icon renders',()=>{const original=Math.random;let randomCalls=0;Math.random=()=>{randomCalls++;return randomCalls%2?.7:.3;};try{
 const g=game(),state={},item={},first=compassProperty(g,item,null,state);for(let i=0;i<100;i++)assert.equal(compassProperty(g,item,null,state),first);assert.equal(randomCalls,2);
 g.world.worldAge++;const next=compassProperty(g,item,null,state),delta=((next-first+1.5)%1)-.5;assert.equal(randomCalls,3);assert.ok(Math.abs(delta)<.1);assert.notEqual(next,first);
}finally{Math.random=original;}});
test('a valid Overworld or same-dimension lodestone compass never uses random spin',()=>{const original=Math.random;Math.random=()=>{throw Error('unexpected random angle');};try{
 const g=game();g.dimension=0;g.worldName='minecraft:overworld';g.dimensionData.natural=true;assert.ok(Number.isFinite(compassProperty(g,{},null,{})));
 g.dimension=-1;g.worldName='minecraft:the_nether';g.dimensionData.natural=false;g.items.nbt=()=>({LodestoneDimension:'minecraft:the_nether',LodestonePos:{X:5,Y:64,Z:5}});assert.ok(Number.isFinite(compassProperty(g,{},null,{})));
}finally{Math.random=original;}});
