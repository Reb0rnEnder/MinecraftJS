import{test}from'node:test';import assert from'node:assert/strict';import mcassets from'../lib/mcassets.js';
import{Interaction}from'../client/js/game/interaction.js';import{entityPickRadius}from'../client/js/game/entity-pick-radius.js';
import{EntityManager}from'../client/js/game/entities.js';
const legacy=mcassets.MC_VERSION==='1.8.9';
function pick(e,hit=null,mode=1){const g={entityId:42,ridingEntityId:-1,gameMode:mode,player:{},eyePosition:()=>[0,64.5,0],lookVector:()=>[0,0,1],world:{raycast:()=>hit},entities:{pickable:()=>[e],interp:e=>e}};return new Interaction(g).updateTarget();}
const entity=(extra={})=>({id:7,pickable:true,entityName:'cow',kind:'mob',x:.39,y:64,z:2,width:.6,height:1.8,...extra});
test('ordinary mob ray bounds retain the native release-specific default radius',()=>{
 assert.equal(entityPickRadius(entity()),legacy?Math.fround(.1):0);assert.equal(pick(entity())?.type,legacy?'entity':undefined);assert.equal(pick(entity({x:0}))?.type,'entity');
});
test('item-frame faces have zero margin, including in 1.8.9',()=>{
 const e=entity({kind:'itemframe',entityName:'item_frame',box:[.02,64,2,.77,64.75,2.0625]});assert.equal(entityPickRadius(e),0);assert.equal(pick(e),null);e.box[0]=-.1;assert.equal(pick(e)?.type,'entity');
});
test('large fireballs have native one-block pick margin and remain occluded by nearer blocks',()=>{
 const e=entity({entityName:'fireball',kind:'projectile',type:63,x:.9,width:.3125,height:.3125});assert.equal(entityPickRadius(e),1);assert.equal(pick(e)?.type,'entity');assert.equal(pick(e,{dist:.5,x:0,y:64,z:0})?.type,'block');
 assert.equal(pick(entity({x:0,z:4}),null,0),null); // Survival entity reach remains three blocks.
});
if(['1.8.9','1.12.2'].includes(mcassets.MC_VERSION))test('legacy object spawn enables picking large fireballs but not small ones',()=>{
 const manager=new EntityManager({});for(const [id,type]of[[1,63],[2,64]])manager.spawnObject({entityId:id,type,objectData:0,x:0,y:64,z:2});assert.equal(manager.get(1).pickable,true);assert.equal(manager.get(2).pickable,false);
});
