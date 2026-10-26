import {test} from 'node:test';import assert from 'node:assert/strict';
import {CameraEye} from '../client/js/render/camera-eye.js';import {Game} from '../client/js/game/game.js';
test('camera eases eye height by the native half-step and interpolates frames without moving gameplay eyes',()=>{
 let target=Math.fround(1.62);const eye=new CameraEye(),player={x:0,prevX:0,y:64,prevY:64,z:0,prevZ:0,eyeHeight:()=>target};const g={player,cameraEye:eye,cameraEntity:null,eyePosition:Game.prototype.eyePosition};eye.tick(target);
 for(const height of [1.27,.4,1.62]){
  const before=eye.current;target=Math.fround(height);eye.tick(target);const next=Math.fround(before+Math.fround(Math.fround(target-before)*.5));assert.equal(eye.current,next);
  assert.equal(Game.prototype.eyePosition.call(g,0)[1],64+target,'targeting eye follows pose immediately');assert.equal(Game.prototype.cameraPosition.call(g,0)[1],64+before);assert.equal(Game.prototype.cameraPosition.call(g,1)[1],64+next);assert.equal(Game.prototype.cameraPosition.call(g,.5)[1],64+(before+next)/2);
 }
 eye.reset();assert.equal(eye.height(.5,1.62),Math.fround(1.62),'a fresh world starts at its own eye height');
});
