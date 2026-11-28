// Native 1.20.6 client projectile ticks and Entity.lerpTo snapping for non-living entities.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {tickProjectile766} from '../client/js/game/projectile-physics-1.20.6.js';
const f=Math.fround,air={getState:()=>0,getCollisions:()=>[],raycast:()=>null,getBlockDef:()=>null};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' vs '+b);
test('thrown potion: move by the old motion, then motion * 0.99, then gravity 0.05 (XP bottle 0.07, snowball 0.03)',()=>{
  for(const [name,g] of [['potion',0.05],['experience_bottle',0.07],['snowball',0.03]]){
    const e={kind:'projectile',entityName:name,x:0,y:64,z:0,motionX:0.5,motionY:0.5,motionZ:0,yaw:0,pitch:0};
    tickProjectile766(e,air);
    close(e.x,0.5);close(e.y,64.5);close(e.motionX,0.5*f(0.99));close(e.motionY,0.5*f(0.99)-g);
    tickProjectile766(e,air);close(e.y,64.5+0.5*f(0.99)-g);
  }
});
test('arrows ease their rotation toward the motion and stick where the path meets a block',()=>{
  const e={kind:'arrow',entityName:'arrow',x:0,y:64,z:0,motionX:0,motionY:-1,motionZ:1,yaw:0,pitch:0};
  tickProjectile766(e,air);close(e.pitch,f(0.2*f(Math.atan2(-1,1)*57.2957763671875)));close(e.motionY,-1*f(0.99)-0.05);
  const wall={...air,raycast:()=>({hit:[0.5,63,1.5],dist:0.7})};
  const a={kind:'arrow',entityName:'arrow',x:0,y:63,z:1,motionX:0.5,motionY:0,motionZ:0.5,yaw:0,pitch:0};
  tickProjectile766(a,wall);assert.equal(a.inGround,true);close(a.motionX,0.5);
  const x=a.x;tickProjectile766(a,{...wall,getCollisions:()=>[[a.x-1,a.y-1,a.z-1,a.x+1,a.y+1,a.z+1]]});assert.equal(a.x,x);
});
test('primed TNT falls with 0.04 gravity, 0.98 drag and bounces with (0.7, -0.5, 0.7) on the ground',()=>{
  const e={kind:'tnt',entityName:'tnt',x:0,y:64,z:0,motionX:0.1,motionY:0,motionZ:0};
  tickProjectile766(e,air);close(e.y,63.96);close(e.motionY,-0.04*f(0.98));
  const floor={...air,getCollisions:()=>[[-5,0,-5,5,63.95,5]]};const t={kind:'tnt',entityName:'tnt',x:0,y:63.96,z:0,motionX:0.1,motionY:-0.2,motionZ:0};
  tickProjectile766(t,floor);assert.equal(t.onGround,true);close(t.motionX,0.1*f(0.98)*f(0.7));
});
test('position packets snap non-living entities at once (Entity.lerpTo); the next tick still simulates',async()=>{
  const {EntityManager}=await import('../client/js/game/entities.js');
  const m=Object.create(EntityManager.prototype),e={kind:'projectile',entityName:'potion',x:0,y:0,z:0,yaw:0,pitch:0};
  m._setTarget(e,10,20,30,45,5);assert.deepEqual([e.x,e.y,e.z,e.yaw,e.pitch,e.inc],[10,20,30,45,5,0]);
});
