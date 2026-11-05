import {test} from 'node:test';import assert from 'node:assert/strict';
import {turnPlayer,BOAT_LOOK_LIMIT} from '../client/js/game/mouse-look.js';
const player=()=>({yaw:20,prevYaw:20,pitch:10,prevPitch:10});
test('mouse look shifts both interpolation endpoints and clamps pitch',()=>{
 const p=player();turnPlayer(p,15,-5);assert.equal(p.yaw,35);assert.equal(p.prevYaw,35);assert.equal(p.pitch,5);assert.equal(p.prevPitch,5);
 turnPlayer(p,0,200);assert.equal(p.pitch,90);assert.equal(p.prevPitch,90);
});
test('boat yaw is clamped on every mouse frame without waiting for a game tick',()=>{
 const p=player();p.yaw=p.prevYaw=104;p.ridingEntity={kind:'boat',yaw:0};
 for(let i=0;i<100;i++){turnPlayer(p,20,0);if(BOAT_LOOK_LIMIT!==null){assert.equal(p.yaw,105);assert.equal(p.prevYaw,105);}}
 if(BOAT_LOOK_LIMIT===null)assert.equal(p.yaw,2104);
 if(BOAT_LOOK_LIMIT!==null){turnPlayer(p,-1,0);assert.equal(p.yaw,104);assert.equal(p.prevYaw,104);}
});
test('boat clamp handles wrapped headings and leaves other mounts unrestricted',()=>{
 const p=player();p.yaw=p.prevYaw=450;p.ridingEntity={kind:'boat',yaw:350};turnPlayer(p,30,0);
 assert.equal(p.yaw,BOAT_LOOK_LIMIT===null?480:455);assert.equal(p.prevYaw,p.yaw);
 p.ridingEntity={kind:'minecart',yaw:0};turnPlayer(p,200,0);assert.equal(p.yaw,BOAT_LOOK_LIMIT===null?680:655);
});
