import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Particles} from '../client/js/render/particles.js';import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
const modern=Number(VANILLA_UI.version.split('.')[1])>=13;
function system(){const p=Object.create(Particles.prototype);p.game={items:{byName:new Map([['splash_potion',{id:12345}],['ender_eye',{id:23456}]])}};return p;}
test('block breaking uses target-specific world-event state encoding',()=>{
 const p=system();let got;p.blockBreak=(x,y,z,state)=>got=state;p.onWorldEvent({effectId:2001,location:{x:1,y:2,z:3},data:5000});
 assert.equal(got,modern?5000:((5000&4095)<<4)|((5000>>12)&15));
});
test('ender eye world event includes both native portal rings and eight item fragments',()=>{
 const p=system(),ring=[],cracks=[],ids=[];p.portal=(...a)=>ring.push(a);p._itemCrackAt=(...a)=>cracks.push(a);p._itemAtlas=id=>{ids.push(id);return[0,0,1,1];};
 p.onWorldEvent({effectId:2003,location:{x:1,y:64,z:2},data:0});assert.equal(cracks.length,8);assert.equal(ring.length,80);assert.ok(ring.every(a=>Math.abs(Math.hypot(a[0]-1.5,a[2]-2.5)-5)<1e-8));assert.equal(ids[0],modern?23456:381);
});
if(modern)test('modern dispenser smoke uses six direction ordinals, including up/down',()=>{
 const p=system(),smoke=[];p.smoke=(...a)=>smoke.push(a);
 p.onWorldEvent({effectId:2000,location:{x:0,y:64,z:0},data:1});assert.equal(smoke.length,10);assert.ok(smoke.every(a=>a[1]>64.8));
 smoke.length=0;p.onWorldEvent({effectId:2000,location:{x:0,y:64,z:0},data:0});assert.ok(smoke.every(a=>a[1]<64.2));
});
