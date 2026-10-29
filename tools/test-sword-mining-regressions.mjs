import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import mcassets from '../lib/mcassets.js';
import {Interaction} from '../client/js/game/interaction.js';
import {Items} from '../client/js/game/items.js';
import {LocalPlayer} from '../client/js/game/physics.js';
import {World} from '../client/js/world/world.js';
import {Chunk} from '../client/js/world/chunk.js';
import {initBlocks,blocksByName} from '../client/js/world/blocks.js';
import {C} from '../client/js/net/packets.js';
const data=Object.fromEntries(['blocks','items','blockCollisionShapes','creative','foods','materials','enchantments'].map(n=>[n,JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)))]));
initBlocks(data.blocks,data.blockCollisionShapes);const native=!['1.8.9','1.12.2'].includes(mcassets.MC_VERSION);
const state=n=>native?blocksByName[n].defaultState:blocksByName[n].id<<4;
const assets={data,translate:k=>k,itemsById:new Map([...data.blocks,...data.items].map(d=>[d.id,d])),itemsByName:new Map([...data.blocks,...data.items].map(d=>[d.name,d]))};
function fixture(mode,itemName,blockName='stone'){
 const items=new Items(assets),world=new World(),chunk=new Chunk(0,0,true);world.chunks.set(World.key(0,0),chunk);chunk.setState(8,64,8,state(blockName));
 const player=new LocalPlayer();player.setPosition(1.5,64,1.5);player.onGround=true;
 const held=itemName?{id:items.byName.get(itemName).id,count:1,damage:0}:null,sent=[],broken=[];
 const g={world,player,items,gameMode:mode,effects:new Map(),inventory:{held:()=>held,armor:[],setHeld(){}},tutorial:{onHitBlock(){}},particles:{blockBreak:(...a)=>broken.push(a)},sound:{playBlockHit(){},playBlockBreak(){},onWorldEvent(){}},send:p=>sent.push(p)};
 const interaction=new Interaction(g),target={type:'block',x:8,y:64,z:8,face:1,state:state(blockName),hit:[8.5,65,8.5]};
 return {g,interaction,target,sent,broken,held};
}
const swords=['wooden_sword','stone_sword','iron_sword','diamond_sword','golden_sword'];

test('Creative swords send no mining requests on click or hold and never predict block removal',()=>{
 for(const sword of swords)for(const block of ['stone',native?'cobweb':'web']){
  const f=fixture(1,sword,block);f.interaction.clickBlock(f.target,1);for(let tick=0;tick<25;tick++)f.interaction.onPlayerDamageBlock(f.target,1);
  assert.equal(f.g.world.getState(8,64,8),state(block),sword+' '+block);assert.equal(f.sent.length,0,'no server mining request');assert.equal(f.broken.length,0);assert.equal(f.interaction.isHitting,false);assert.equal(f.held.damage,0);
  assert.equal(f.interaction.destroyBlockClient(f.target),false,'direct prediction remains guarded');
 }
});

test('Creative hand and normal tools still send start-dig and break instantly',()=>{
 for(const item of [null,'diamond_pickaxe']){
  const f=fixture(1,item);f.interaction.clickBlock(f.target,1);assert.equal(f.g.world.getState(8,64,8),0);assert.deepEqual(f.sent,[C.blockDig(0,8,64,8,1)]);assert.equal(f.broken.length,1);
 }
});

test('Creative sword can extinguish adjacent fire without mining the block underneath',()=>{
 const f=fixture(1,'diamond_sword');f.g.world.setState(8,65,8,state('fire'));f.interaction.clickBlock(f.target,1);
 assert.equal(f.g.world.getState(8,65,8),0);assert.equal(f.g.world.getState(8,64,8),state('stone'));assert.deepEqual(f.sent,[C.blockDig(0,8,64,8,1)]);assert.equal(f.broken.length,0);
 for(let tick=0;tick<25;tick++)f.interaction.onPlayerDamageBlock(f.target,1);assert.equal(f.sent.length,1,'no subsequent mining after fire is gone');
});

test('Survival swords retain normal cobweb cutting and slow mining of stone',()=>{
 const web=native?'cobweb':'web';for(const sword of swords){
  const f=fixture(0,sword,web);assert.equal(f.g.items.strVsBlock(f.held,blocksByName[web]),15);f.interaction.clickBlock(f.target,1);
  for(let tick=0;tick<20&&f.g.world.getState(8,64,8)!==0;tick++)f.interaction.onPlayerDamageBlock(f.target,1);
  assert.equal(f.g.world.getState(8,64,8),0);assert.deepEqual(f.sent,[C.blockDig(0,8,64,8,1),C.blockDig(2,8,64,8,1)]);assert.equal(f.broken.length,1);
 }
 const f=fixture(0,'diamond_sword');f.interaction.clickBlock(f.target,1);for(let tick=0;tick<5;tick++)f.interaction.onPlayerDamageBlock(f.target,1);assert.equal(f.g.world.getState(8,64,8),state('stone'),'stone is not an instant sword break');assert.ok(f.interaction.curDamage>0);
});
