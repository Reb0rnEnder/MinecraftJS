import{test}from'node:test';import assert from'node:assert/strict';
import{Game}from'../client/js/game/game.js';import{LocalPlayer}from'../client/js/game/physics.js';import{Reader}from'../client/js/net/buffer.js';
test('server relative rotation flags independently add yaw (8) and pitch (16), including the confirmation packet',()=>{
 for(const [flags,yaw,pitch]of [[8,65,-5],[16,5,15],[24,65,15],[0,5,-5]]){
  const player=new LocalPlayer(),sent=[];player.setPosition(10,64,10);player.yaw=60;player.pitch=20;
  const g={player,doneLoadingTerrain:true,send:p=>sent.push(p)};Game.prototype.on_position.call(g,{x:20,y:70,z:30,yaw:5,pitch:-5,flags,teleportId:3});
  assert.equal(player.yaw,yaw);assert.equal(player.pitch,pitch);const r=new Reader(sent.at(-1));r.varint();assert.equal(r.f64(),20);assert.equal(r.f64(),70);assert.equal(r.f64(),30);assert.equal(r.f32(),yaw);assert.equal(r.f32(),pitch);
 }
});
