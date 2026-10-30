import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Interaction} from '../client/js/game/interaction.js';import {LocalPlayer} from '../client/js/game/physics.js';import {initBlocks,blocksByName,findState,getStateProperties} from '../client/js/world/blocks.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(json('blocks'),json('blockCollisionShapes'));
for(const [name,prop]of[['sea_pickle','pickles'],['turtle_egg','eggs'],['snow','layers'],...(blocksByName.red_candle?[['red_candle','candles']]:[])])test('stacking '+name+' uses clicked cell, increments native state and consumes one item',()=>{
 let state=findState(name,{[prop]:'2'});const player=new LocalPlayer();player.setPosition(10,64,10);
 const g={player,dimension:0,items:{blockFor:()=>blocksByName[name],name:()=>name,isBlockItem:()=>true},entities:{all:()=>[]},world:{getState:(x,y,z)=>x===0&&y===64&&z===0?state:y===63?blocksByName.stone.defaultState:0,setState:(x,y,z,s)=>{assert.deepEqual([x,y,z],[0,64,0]);state=s;}},sound:{playBlockPlace(){}}};
 const it=new Interaction(g),target={type:'block',x:0,y:64,z:0,face:1,hit:[.5,65,.5]},held={id:1,count:3};it.target=target;
 assert.deepEqual(it._placementPos(target,held).p,{x:0,y:64,z:0});assert.equal(it._onItemUse(target,held),true);assert.equal(held.count,2);assert.equal(getStateProperties(state)[prop],'3');
 player.sneaking=true;assert.equal(it._stackingProperty(target,held),null);
});
