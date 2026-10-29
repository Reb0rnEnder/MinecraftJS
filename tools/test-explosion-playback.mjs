import{test}from'node:test';import assert from'node:assert/strict';
import{Game}from'../client/js/game/game.js';import{SoundManager}from'../client/js/audio/sound.js';import{VANILLA_UI}from'../client/js/gui/vanilla-layout.js';
test('explosion packets play one positional blast, including explosions with no destroyed blocks',()=>{
 for(const records of[[],[{x:0,y:0,z:0},{x:1,y:-1,z:2}]]){
  const calls=[],blocks=[],particles=[],sound=Object.assign(Object.create(SoundManager.prototype),{play:(...args)=>calls.push(args)}),game={sound,world:{setState:(...args)=>blocks.push(args)},player:{motionX:1,motionY:2,motionZ:3},particles:{explosion:(...args)=>particles.push(args)}};
  Game.prototype.on_explosion.call(game,{x:-1.25,y:64.5,z:7.25,radius:4,records,motionX:.1,motionY:.2,motionZ:.3});
  assert.equal(calls.length,1);assert.equal(calls[0][0],VANILLA_UI.version==='1.8.9'?'random.explode':'entity.generic.explode');assert.deepEqual(calls[0].slice(1,5),[-1.25,64.5,7.25,4]);assert.ok(calls[0][5]>=.56&&calls[0][5]<=.84);assert.equal(calls[0][6].category,'block');
  assert.deepEqual(blocks,records.map(r=>[-2+r.x,64+r.y,7+r.z,0]));assert.deepEqual([game.player.motionX,game.player.motionY,game.player.motionZ],[1.1,2.2,3.3]);assert.deepEqual(particles,[[-1.25,64.5,7.25,4]]);
 }
});
