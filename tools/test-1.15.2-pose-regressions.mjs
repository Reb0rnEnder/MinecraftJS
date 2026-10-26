import{test}from'node:test';import assert from'node:assert/strict';
import{LocalPlayer}from'../client/js/game/physics.js';import{EntityManager}from'../client/js/game/entities.js';import{playerPoseDimensions}from'../client/js/game/player-poses-1.15.2.js';
test('native crouching dimensions serve every runtime pose including inherited sneaking',()=>{
 for(const pose of ['standing','sleeping','fall_flying','swimming','spin_attack','sneaking','dying','crouching'])assert.ok(playerPoseDimensions(pose)?.every(Number.isFinite),pose);
 const player=new LocalPlayer();player.y=64;player.sneaking=true;player.updateSize({getCollisions:()=>[]});assert.equal(player.pose,'sneaking');assert.equal(player.height,Math.fround(1.5));assert.equal(player.eyeHeight(),Math.fround(1.27));
});
test('a blocked standing pose falls back to crouching and then swimming without crashing',()=>{
 const player=new LocalPlayer();player.y=64;
 player.updateSize({getCollisions:box=>box[4]>65.6?[box]:[]});assert.equal(player.pose,'sneaking');
 player.updateSize({getCollisions:box=>box[4]>65.0?[box]:[]});assert.equal(player.pose,'swimming');assert.equal(player.height,Math.fround(.6));
});
test('wire player pose 5 uses native crouching dimensions on remote players',()=>{
 const manager=new EntityManager({}),entity=manager._base(2,0,64,0);entity.kind='player';entity.entityName='player';manager._applyMeta(entity,{6:5});assert.equal(entity.height,1.5);assert.equal(entity.eyeHeight,1.27);
});
