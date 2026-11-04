import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Game} from '../client/js/game/game.js';
import {Interaction} from '../client/js/game/interaction.js';import {EntityManager} from '../client/js/game/entities.js';import {Items} from '../client/js/game/items.js';
import {initBlocks,blocksByName} from '../client/js/world/blocks.js';import {SoundManager} from '../client/js/audio/sound.js';import mcassets from '../lib/mcassets.js';
const read=p=>JSON.parse(readFileSync(new URL('../client/'+p,import.meta.url))),version=mcassets.MC_VERSION,old=version==='1.8.9',legacy=old||version==='1.12.2';
initBlocks(read('data/blocks.json'),read('data/blockCollisionShapes.json'));const defs=read('assets/minecraft/sounds.json');
function fixture(name,mode=0){const held={id:1,count:2,damage:0},calls=[],sent=[],player={usingItem:false,sneaking:false,creative:mode===1},g={gameMode:mode,player,food:20,world:{getState:()=>0},items:{name:()=>name,useAction:()=> 'drink',canAlwaysEat:()=>false},inventory:{getHand:()=>held,held:()=>held,offhand:null,setHand(){}},sound:{play:(...p)=>calls.push(p)},send:p=>sent.push(p),cooldownFraction:()=>0};return{held,calls,sent,g,it:new Interaction(g)};}
test('throwable potions bypass the inherited drink animation, while normal potions still start drinking',()=>{
 for(const name of ['splash_potion',...(old?[]:['lingering_potion'])])for(const mode of[0,1]){
  const f=fixture(name,mode);f.held.id=old?373:name==='splash_potion'?438:441;f.held.damage=old?16384:0;
  if(old)f.g.items.useAction=()=> 'none'; // Native legacy use action uses the splash metadata bit.
  assert.equal(f.it.sendUseItem(f.held,0),true);assert.equal(f.g.player.usingItem,false);assert.equal(f.held.count,mode===1?2:1);assert.equal(f.sent.length,1);
 }
 const f=fixture('potion');f.held.id=373;f.it.sendUseItem(f.held,0);assert.equal(f.g.player.usingItem,true);
});
test('collection packets play native item and XP sounds at the collected entity, including other collectors',()=>{
 const calls=[],g={entityId:1,sound:{play:(...p)=>calls.push(p)}},m=new EntityManager(g);
 for(const [id,kind]of[[7,'item'],[8,'xp']]){const e=m._base(id,3,64,5);e.kind=kind;m.map.set(id,e);m.onCollect({collectedEntityId:id,collectorEntityId:99});}
 assert.equal(calls.length,2);assert.deepEqual(calls[0].slice(1,5),[3,64,5,.2]);assert.equal(calls[0][0],old?'random.pop':'entity.item.pickup');assert.ok(calls[0][5]>=.6&&calls[0][5]<=3.4);
 assert.equal(calls[1][0],old?'random.orb':'entity.experience_orb.pickup');assert.equal(calls[1][4],old?.2:.1);assert.equal(calls[1][6].category,'player');m.onCollect({collectedEntityId:123,collectorEntityId:1});assert.equal(calls.length,2);
 for(const call of calls){const snd=Object.assign(Object.create(SoundManager.prototype),{defs});assert.ok(snd._pick(call[0]),call[0]+' resolves through target assets');}
});
function blockFixture(name,mode=0){const f=fixture('',mode),block=blocksByName[name];assert.ok(block,name);let state=legacy?block.id<<4:block.defaultState;f.g.inventory.held=f.g.inventory.getHand=()=>null;f.g.world={getState:()=>state,setState:(x,y,z,next)=>{state=next;}};return{...f,target:{x:1,y:64,z:2,face:1,hit:[1.5,65,2.5]},state:()=>state};}
test('button press plays once locally, predicts powered state, and already-powered buttons stay silent',()=>{
 for(const name of [legacy?'wooden_button':'oak_button','stone_button',...(version==='1.19.4'?['crimson_button','bamboo_button']:[])]){
  const f=blockFixture(name);assert.equal(f.it.onPlayerRightClick(f.target),true);assert.equal(f.calls.length,1);assert.notEqual(f.state(),legacy?blocksByName[name].id<<4:blocksByName[name].defaultState);
  f.it.onPlayerRightClick(f.target);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].slice(1,4),[1.5,64.5,2.5]);assert.equal(f.calls[0][6].category,'block');
  const snd=Object.assign(Object.create(SoundManager.prototype),{defs}),pick=snd._pick(f.calls[0][0]);assert.ok(pick);assert.ok(Math.abs(f.calls[0][4]*pick.volume-.3)<1e-6);assert.ok(Math.abs(f.calls[0][5]*pick.pitch-.6)<1e-6);
 }
});
test('comparator mode toggle uses the native local click; Adventure and Spectator do not emit it',()=>{
 const name=legacy?'unpowered_comparator':'comparator',f=blockFixture(name);f.it.onPlayerRightClick(f.target);f.it.onPlayerRightClick(f.target);assert.equal(f.calls.length,2);assert.equal(f.calls[0][5],.55);assert.equal(f.calls[1][5],.5);
 for(const mode of[2,3]){const f=blockFixture(name,mode);f.it.onPlayerRightClick(f.target);assert.equal(f.calls.length,0);}
});

test('use sounds select native honey audio, player category, and particles only for eating',async()=>{
 const {consumeEffect}=await import('../client/js/audio/consume-sounds.js'),calls=[],particles=[];
 const g={player:{},items:{useAction:()=> 'drink',name:()=> 'potion'},sound:{playAtPlayer:(...p)=>calls.push(p)},particles:{itemCrack:(...p)=>particles.push(p)}};
 consumeEffect(g,{id:1});assert.equal(calls[0][0],old?'random.drink':'entity.generic.drink');assert.equal(calls[0][3],'player');assert.equal(particles.length,0);
 if(['1.15.2','1.16.5','1.17.1','1.18.2','1.19.4'].includes(version)){g.items.name=()=> 'honey_bottle';consumeEffect(g,{id:2});assert.equal(calls.at(-1)[0],'item.honey_bottle.drink');assert.ok(defs[calls.at(-1)[0]]);}
 g.items.useAction=()=> 'eat';consumeEffect(g,{id:3},16);assert.equal(particles[0][2],16);assert.equal(calls.at(-1)[3],'player');
 const played=[],snd=Object.assign(Object.create(SoundManager.prototype),{play:(...p)=>played.push(p)});snd.playAtPlayer('test',.5,1,'player');assert.deepEqual(played[0][6],{global:true,category:'player'});snd.playAtPlayer('test');assert.deepEqual(played[1][6],{global:true});
 const muted=Object.assign(Object.create(SoundManager.prototype),{audio:{},defs,game:{settings:{masterVolume:1,soundVolumes:{player:0,neutral:1}}},_buffer:()=>{throw Error('muted player use sound decoded');}});assert.equal(await muted.playAtPlayer(old?'random.drink':'entity.generic.drink',.5,1,'player'),null);
});
test('server completion plays the final consume effect exactly once even after inventory replacement',()=>{
 const f=fixture('potion'),particles=[];f.held.id=373;f.g.sound.playAtPlayer=(...p)=>f.calls.push(p);f.g.particles={itemCrack:(...p)=>particles.push(p)};
 f.g.items.useAction=item=>item.id===373?'drink':'none';f.it.sendUseItem(f.held,0);f.held.id=374;f.g.entityId=1;f.g.interaction=f.it;f.g.entities={onStatus(){}};Game.prototype.on_entity_status.call(f.g,{entityId:1,entityStatus:9});assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],old?'random.drink':'entity.generic.drink');assert.equal(particles.length,0);
 f.it.finishItemUse();assert.equal(f.calls.length,1);
});
