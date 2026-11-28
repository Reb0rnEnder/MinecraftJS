// Wolf.tick / handleEntityEvent / getHeadRollAngle / getBodyRollAngle / getWetShade (client).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tickWolf766,wolfEvent766,wolfHeadRoll766,wolfBodyRoll766,wolfWetShade766} from '../client/js/game/paws-1.20.6.js';
const f=Math.fround;
test('begging tilts the head by lerp(interested) * 0.15 pi, easing 0.4 per tick',()=>{
 const e={begging:true,health:20};tickWolf766(e,false);assert.equal(e.interestedAngle,f(0.4));tickWolf766(e,false);assert.equal(e.interestedAngle,f(f(0.4)+f(f(1-f(0.4))*f(0.4))));
 assert.ok(Math.abs(wolfHeadRoll766(e,0.5)-f((0.4+(e.interestedAngle-0.4)*0.5)*f(0.15)*f(Math.PI)))<1e-6);
 e.begging=false;tickWolf766(e,false);assert.ok(e.interestedAngle<e.interestedAngleO);
});
test('wet wolves shake after event 8: 0.05 per tick to 2 with splashes past 0.4, darker while wet; 56 cancels',()=>{
 const e={health:20,width:0.6};tickWolf766(e,true);assert.equal(e.isWet,true);assert.equal(wolfWetShade766(e,0),0.75);
 assert.equal(wolfEvent766(e,8),true);let splashes=0;for(let i=0;i<10;i++)tickWolf766(e,false,()=>splashes++);
 assert.ok(Math.abs(e.shakeAnim-0.5)<1e-5);assert.ok(splashes>0);
 const roll=wolfBodyRoll766(e,0,0),t=Math.min(1,Math.max(0,f(e.shakeAnimO/1.8)));assert.ok(Math.abs(roll-Math.sin(t*Math.PI)*Math.sin(t*Math.PI*11)*0.15*Math.PI)<1e-5);
 for(let i=0;i<40;i++)tickWolf766(e,false);assert.equal(e.shaking,false);assert.equal(e.isWet,false);assert.equal(wolfWetShade766(e,0),1);
 wolfEvent766(e,8);tickWolf766(e,false);wolfEvent766(e,56);assert.equal(e.shaking,false);assert.equal(e.shakeAnim,0);
});
