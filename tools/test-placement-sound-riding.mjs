import{VANILLA_UI}from'../client/js/gui/vanilla-layout.js';
import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{Interaction}from'../client/js/game/interaction.js';import{EntityManager}from'../client/js/game/entities.js';import{SoundManager}from'../client/js/audio/sound.js';
import{initBlocks,blocksByName}from'../client/js/world/blocks.js';
const blocks=JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),shapes=JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url)));initBlocks(blocks,shapes);
const state=block=>block.defaultState??block.id<<4;
test('accepted placements play once even when their oriented state is not predicted',()=>{
 for(const name of['stone','oak_stairs','oak_fence','wooden_door'].filter(name=>blocksByName[name])){
  const block=blocksByName[name],played=[],held={id:block.id,count:3,damage:0};
  const g={world:{getState:()=>state(blocksByName.stone),setState(){}},items:{name:()=>name},sound:{playBlockPlace:(...args)=>played.push(args)},dimension:0};
  const i=new Interaction(g);i._placedBlock=()=>block;i._canPlaceBlockOnSide=()=>true;i._placementPos=()=>({p:{x:1,y:65,z:3}});i._itemBlock=()=>true;
  assert.equal(i._onItemUse({x:1,y:64,z:3,face:1,hit:[1.5,65,3.5]},held),true,name);assert.equal(held.count,2);assert.equal(played.length,1,name);assert.deepEqual(played[0].slice(0,3),[1,65,3]);
 }
});
test('rejected and empty-stack placement attempts stay silent',()=>{
 const played=[],g={world:{getState:()=>state(blocksByName.stone)},items:{name:()=> 'stone'},sound:{playBlockPlace:(...a)=>played.push(a)}},i=new Interaction(g);i._placedBlock=()=>blocksByName.stone;
 for(const valid of[false,true]){i._canPlaceBlockOnSide=()=>valid;assert.equal(i._onItemUse({x:0,y:64,z:0},{id:1,count:0,damage:0}),false);}assert.deepEqual(played,[]);
});
test('placement sound uses the block category, centered position and native volume/pitch',()=>{
 const played=[],sound=Object.assign(Object.create(SoundManager.prototype),{play:(...a)=>played.push(a)});sound.playBlockPlace(1,65,3,state(blocksByName.stone));
 assert.deepEqual(played[0].slice(1,4),[1.5,65.5,3.5]);assert.equal(played[0][4],1);assert.equal(played[0][5],.8);if(VANILLA_UI.version==='1.8.9')assert.equal(played[0][0],'dig.stone');else assert.equal(played[0][6].category,'block');
});
function fixture(){
 const boat={id:10,kind:'boat',riding:-1,passenger:1,passengerList:[1,2],controlled:true},rider={id:2,riding:10},parent={id:20,passenger:10,passengerList:[10,3]},g={entityId:1,ridingEntityId:10,player:{x:7,y:62,z:9,ridingEntity:boat,ridingBoat:true},vehicle:{e:boat},entityRenderer:{remove(){}}};
 g._dropVehicle=()=>{if(g.vehicle){g.vehicle.e.controlled=false;g.vehicle=null;}};
 const manager=new EntityManager(g);manager.self={id:1,riding:10};manager.map=new Map([[10,boat],[2,rider],[20,parent]]);return{g,manager,boat,rider,parent};
}
test('destroying a ridden boat clears local state, controller and all passenger links',()=>{
 const{g,manager,boat,rider,parent}=fixture();manager.destroy([10]);assert.equal(manager.get(10),undefined);assert.equal(g.ridingEntityId,-1);assert.equal(g.player.ridingEntity,null);assert.equal(g.player.ridingBoat,false);assert.equal(g.vehicle,null);assert.equal(boat.controlled,false);assert.equal(rider.riding,-1);assert.equal(manager.self.riding,-1);assert.deepEqual(parent.passengerList,[3]);assert.equal(parent.passenger,-1);assert.deepEqual([g.player.x,g.player.y,g.player.z],[7,62,9]);manager.destroy([10]);
});
test('removing unrelated entities preserves riding; a missing vehicle entry still detaches',()=>{
 const{g,manager,boat}=fixture();manager.destroy([2]);assert.equal(g.player.ridingEntity,boat);assert.deepEqual(boat.passengerList,[1]);manager.map.delete(10);manager.destroy([10]);assert.equal(g.player.ridingEntity,null);assert.equal(g.vehicle,null);
});
