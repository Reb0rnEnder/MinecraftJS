// 1.20.6 PlayerTabOverlay hearts: HealthState blinking/catch-up, heart layout and the narrow-column text fallback.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTranslator} from '../client/js/gui/i18n.js';
import {HealthState,renderTabHearts} from '../client/js/gui/tab-hearts.js';
setTranslator((k,a)=>k==='multiplayer.player.list.hp'?a[0]+' hp':k);
const gui=()=>{const calls=[];return {calls,sprite:(n,x,y,w,h)=>calls.push(['sprite',n,x,y]),text:(t,x,y,c)=>calls.push(['text',t,x,y,c]),textWidth:t=>t.length*6};};
test('HealthState blinks 20 ticks after a drop, 10 after a rise, and catches up after 20 stable ticks',()=>{
 const s=new HealthState(20);s.update(14,100);assert.equal(s.blinkUntilTick,120);assert.equal(s.displayedValue,20);
 assert.equal(s.isBlinking(103),true,"(120-103)%6=5");assert.equal(s.isBlinking(106),false,"(120-106)%6=2");assert.equal(s.isBlinking(121),false);
 s.update(14,121);assert.equal(s.displayedValue,14);s.update(16,130);assert.equal(s.blinkUntilTick,140);
});
test('hearts: containers for max(20, values), full/half sprites by health, absorbing sprites past 10 hearts',()=>{
 const g=gui(),states=new Map();renderTabHearts(g,states,10,100,190,'u',7,0);
 const sp=g.calls.filter(c=>c[0]==='sprite');assert.equal(sp.filter(c=>c[1]==='hud/heart/container').length,10);
 assert.equal(sp.filter(c=>c[1]==='hud/heart/full').length,3);assert.equal(sp.filter(c=>c[1]==='hud/heart/half').length,1);
 assert.deepEqual(sp.find(c=>c[1]==='hud/heart/half').slice(2),[100+3*8,10],'step floor(min((90-4)/10, 9)) = 8');
 const big=gui();renderTabHearts(big,new Map(),0,0,90,'v',24,0);assert.ok(big.calls.some(c=>c[1]==='hud/heart/absorbing_full_blinking'),'the eleventh heart and up');
 const narrow=gui();renderTabHearts(narrow,new Map(),0,0,40,'w',40,0);const t=narrow.calls.find(c=>c[0]==='text');assert.equal(t[1],'20.0');assert.equal(t[4],0x00ff00);
});
