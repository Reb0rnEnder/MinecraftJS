import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {animateAxolotl} from '../client/js/render/axolotl-pose.js';
const fixtures=JSON.parse(readFileSync(new URL('./port-1.17.1/axolotl-poses.json',import.meta.url)));
function model(){return{parts:Object.fromEntries(Object.keys(fixtures[0].parts).map(name=>[name,{rx:0,ry:0,rz:0,px:0,py:0}]))};}
for(const state of new Set(fixtures.map(c=>c.state)))test('native axolotl '+state+' samples and interpolation',()=>{
 const m=model(),history={},samples=fixtures.filter(c=>c.state===state);
 for(let frame=0;frame<=44;frame++){
  animateAxolotl(m,{age:frame/2+7,yaw:25,pitch:12,inWater:state.startsWith('water'),onGround:state.startsWith('ground'),moving:state.endsWith('Moving'),playingDead:state==='playingDead',axolotlRotations:history});
  const sample=samples.find(s=>s.frame===frame);if(!sample)continue;
  for(const [part,expected]of Object.entries(sample.parts)){
   const got=m.parts[part],values=[got.rx,got.ry,got.rz,part==='body'?got.py:0];
   values.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<3e-6,`${state} frame ${frame} ${part}.${i}: ${v} != ${expected[i]}`));
  }
 }
});
test('playing-dead transition retains rotation history and does not leak between entities',()=>{
 const m=model(),first={},second={};animateAxolotl(m,{age:20,yaw:0,pitch:0,inWater:true,moving:true,axolotlRotations:first});
 animateAxolotl(m,{age:21,yaw:0,pitch:0,inWater:true,playingDead:true,axolotlRotations:first});assert.ok(m.parts.body.rz>0);assert.ok(m.parts.body.rz<.35);
 animateAxolotl(m,{age:21,yaw:0,pitch:0,inWater:true,moving:true,axolotlRotations:second});assert.equal(m.parts.body.rz,0);
});
