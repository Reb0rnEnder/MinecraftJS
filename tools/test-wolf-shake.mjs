// EntityWolf/Wolf client shake and begging tilt, ModelWolf/WolfModel roll and RenderWolf wet shading per version.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NATIVE,tickWolfShake,wolfShakeEvent,wolfHeadRoll,wolfBodyRoll,wolfWetShade} from '../client/js/game/wolf-shake.js';
const f=Math.fround;
test('begging eases the head tilt by 0.4 per tick, rolled by lerp * 0.15 pi',()=>{
  const e={begging:true};tickWolfShake(e,false);assert.equal(e.interestedAngle,f(0.4));
  tickWolfShake(e,false);assert.equal(e.interestedAngle,f(f(0.4)+f(f(1-f(0.4))*f(0.4))));
  assert.ok(Math.abs(wolfHeadRoll(e,1)-e.interestedAngle*0.15*Math.PI)<1e-6);
});
test('event 8 shakes 0.05 per tick until the previous value reaches 2, splashing past 0.4',()=>{
  const e={};tickWolfShake(e,true);assert.equal(e.isWet,true);
  assert.equal(wolfShakeEvent(e,8),true);let splashes=0,ticks=0;
  while(e.shaking&&ticks<100){tickWolfShake(e,false,()=>splashes++);ticks++;}
  assert.equal(ticks,42); // 0.05f summed 40 times stays just under 2assert.ok(splashes>0);assert.equal(e.isWet,false);assert.equal(wolfWetShade(e,0),1);
});
test('body roll: sin(t pi) sin(11 t pi) 0.15 pi of (lerp + offset) / 1.8 clamped',()=>{
  const e={shakeAnimO:0.9,shakeAnim:0.95};const t=Math.min(1,Math.max(0,(0.925-0.16)/1.8));
  assert.ok(Math.abs(wolfBodyRoll(e,0.5,-0.16)-Math.sin(t*Math.PI)*Math.sin(t*Math.PI*11)*0.15*Math.PI)<1e-5);
  assert.equal(wolfBodyRoll({},0,-0.2),0);
});
test('version rules: wet reset, event 56, alive guard and the wet shade',()=>{
  const e={};wolfShakeEvent(e,8);tickWolfShake(e,false);tickWolfShake(e,true);
  // before 1.16 being wet resets the shake on the client; 1.16+ only the server cancels it (event 56)
  assert.equal(e.shaking,NATIVE.cancelEvent);
  const c={};wolfShakeEvent(c,8);tickWolfShake(c,false);assert.equal(wolfShakeEvent(c,56),NATIVE.cancelEvent);assert.equal(c.shaking,!NATIVE.cancelEvent);
  const dead={health:0,begging:true};tickWolfShake(dead,false);assert.equal(dead.interestedAngle,NATIVE.aliveGuard?undefined:f(0.4));
  const wet={isWet:true,shakeAnimO:1,shakeAnim:1};
  if(NATIVE.brightness){assert.equal(wolfWetShade(wet,0,0.5),f(0.5*f(0.75+0.5*0.25)));assert.deepEqual(NATIVE.shade,[0.75,0.25]);}
  else assert.equal(wolfWetShade(wet,0),f(NATIVE.shade[0]+0.5*NATIVE.shade[1]));
  assert.equal(wolfWetShade({isWet:true},0,1),f(NATIVE.shade[0]));
});
