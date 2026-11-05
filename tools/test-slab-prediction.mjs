import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initBlocks,findState,getStateProperties,blocksByName} from '../client/js/world/blocks.js';
import {Interaction} from '../client/js/game/interaction.js';
import {LocalPlayer} from '../client/js/game/physics.js';
import {Items} from '../client/js/game/items.js';
import {SoundManager} from '../client/js/audio/sound.js';
const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));
const data=Object.fromEntries(['blocks','blockCollisionShapes','items','creative','enchantments'].map(n=>[n,read(n)]));
initBlocks(data.blocks,data.blockCollisionShapes);
function fixture(name='oak_slab'){
 const cells=new Map(),items=new Items({data,translate:k=>k}),held={id:items.byName.get(name).id,count:64,damage:0},player=new LocalPlayer();
 player.setPosition(8,65,8);
 const world={minY:-64,maxY:320,getState:(x,y,z)=>cells.get([x,y,z].join(','))||0,setState(x,y,z,s){const old=this.getState(x,y,z);this.prediction?.record(x,y,z,old);cells.set([x,y,z].join(','),s);},getCollisions:()=>[],beginBatch(){},endBatch(){}};
 const sounds=[],g={items,world,player,dimension:0,gameMode:1,entities:{all:()=>[]},inventory:{getHand:()=>held,held:()=>held,offhand:null,main:[held]},sound:{playBlockPlace:(...a)=>sounds.push(a)},send(){}};
 const interaction=g.interaction=new Interaction(g);
 return{g,held,world,interaction,sounds,target:(face=1,y=64,hitY=y+1)=>({type:'block',x:0,y,z:0,face,hit:[.5,hitY,.5]})};
}
test('half slabs predict immediately and preserve native clicked-face/height rules',()=>{
 for(const [face,hitY,type]of[[1,65,'bottom'],[0,64,'top'],[5,64.5,'bottom'],[5,64.501,'top']]){
  const f=fixture();f.world.setState(0,64,0,findState('stone'));const t=f.target(face,64,hitY),p=f.interaction._placementPos(t,f.held).p;
  assert.equal(f.interaction._canPlaceBlockOnSide(t,f.held),true);
  f.interaction._onItemUse(t,f.held);assert.equal(getStateProperties(f.world.getState(p.x,p.y,p.z)).type,type);assert.equal(f.sounds.length,1);
 }
});
test('matching single slabs merge through their empty half, including while sneaking',()=>{
 for(const [type,face,hitY,merge]of[['bottom',1,64.5,true],['bottom',5,64.7,true],['bottom',5,64.5,false],['top',0,64.5,true],['top',5,64.5,true],['top',5,64.7,false]])for(const sneaking of[false,true]){
  const f=fixture();f.g.player.sneaking=sneaking;f.world.setState(0,64,0,findState('oak_slab',{type,waterlogged:'true'}));const t=f.target(face,64,hitY),p=f.interaction._placementPos(t,f.held).p;
  f.interaction._onItemUse(t,f.held);
  const props=getStateProperties(f.world.getState(0,64,0));assert.equal(props.type,merge?'double':type);if(merge)assert.equal(props.waterlogged,'false');
  assert.equal(p.x===0&&p.y===64&&p.z===0,merge);
 }
});
test('adjacent slabs merge; doubles and different materials are not replaced',()=>{
 const f=fixture();f.world.setState(0,64,0,findState('stone'));f.world.setState(1,64,0,findState('oak_slab',{type:'top',waterlogged:'false'}));const t=f.target(5,64,64.1);
 assert.equal(f.interaction._canPlaceBlockOnSide(t,f.held),true);f.interaction._onItemUse(t,f.held);assert.equal(getStateProperties(f.world.getState(1,64,0)).type,'double');
 assert.equal(f.interaction._canPlaceBlockOnSide(t,f.held),false);f.world.setState(1,64,0,findState('stone_slab'));assert.equal(f.interaction._canPlaceBlockOnSide(t,f.held),false);
});
test('new slabs waterlog only in source water and reject occupied player volume',()=>{
 for(const level of['0','1']){const f=fixture();f.world.setState(0,64,0,findState('water',{level}));f.interaction._onItemUse(f.target(1,64,64.5),f.held);assert.equal(getStateProperties(f.world.getState(0,64,0)).waterlogged,String(level==='0'));}
 const f=fixture();f.world.setState(0,64,0,findState('stone'));f.g.player.setPosition(.5,65,.5);assert.equal(f.interaction._onItemUse(f.target(),f.held),false);assert.equal(f.sounds.length,0);assert.equal(f.world.getState(0,65,0),0);
});
test('break events for air stay silent instead of playing the stone fallback',()=>{
 const sounds=[],sound=Object.assign(Object.create(SoundManager.prototype),{play:(...a)=>sounds.push(a)});
 for(const name of['air','cave_air','void_air'].filter(n=>blocksByName[n]))sound.onWorldEvent({effectId:2001,location:{x:0,y:64,z:0},data:findState(name)});
 assert.equal(sounds.length,0);sound.playBlockBreak(0,64,0,findState('oak_planks'));assert.equal(sounds[0][0],'block.wood.break');assert.equal(sounds.length,1);
});
