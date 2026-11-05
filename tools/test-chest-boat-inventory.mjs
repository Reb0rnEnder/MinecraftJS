import {test} from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../client/js/game/game.js';import {EntityManager} from '../client/js/game/entities.js';import {C} from '../client/js/net/packets.js';
test('inventory key requests server-owned chest boat inventory instead of opening player UI',()=>{
 const packets=[],g={gameMode:0,entityId:42,ridingEntityId:9,player:{ridingEntity:{kind:'boat',chestBoat:true}},entities:{isHorse:()=>false},send:p=>packets.push(p),screens:{open(){throw Error('must wait for server container');}},tutorial:{openInventory(){throw Error('not a player inventory');}}};
 Game.prototype.openInventory.call(g);assert.deepEqual(packets,[C.entityAction(42,7)]);
 g.gameMode=3;Game.prototype.openInventory.call(g);assert.equal(packets.length,1);
});
test('chest boat single passenger uses native 0.15f horizontal offset; ordinary boat stays centered',()=>{
 const v={id:9,x:10,y:64,z:10,yaw:0,kind:'boat',chestBoat:true},manager={mountedOffset:EntityManager.prototype.mountedOffset,passengersOf:()=>[42],map:new Map()};
 const p=EntityManager.prototype.riderPos.call(manager,v,42,'player');assert.ok(Math.abs(p[0]-10)<1e-6);assert.ok(Math.abs(p[2]-(10+Math.fround(.15)))<1e-6);
 v.chestBoat=false;assert.deepEqual(EntityManager.prototype.riderPos.call(manager,v,42,'player'),[10,63.55,10]);
});

test('the native experimental bamboo raft keeps its distinct passenger height',()=>{assert.equal(EntityManager.prototype.mountedOffset({kind:'boat',boatType:8}),.3);assert.equal(EntityManager.prototype.mountedOffset({kind:'boat',boatType:0}),-.1);});
