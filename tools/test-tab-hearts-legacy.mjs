// Tab-list hearts before 1.20.2 (GuiPlayerTabOverlay.drawScoreboardValues): icons.png hearts, blink after a change,
// a reset when the list is reopened, and the "<n>hp" fallback for narrow columns.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderLegacyTabHearts} from '../client/js/gui/tab-hearts-legacy.js';
const gui=()=>{const calls=[];return {calls,blit:(t,x,y,u,v)=>calls.push(['blit',x,y,u,v]),text:(t,x,y,c)=>calls.push(['text',t,x,y,c]),textWidth:t=>t.length*6};};
test('hearts at fractional spacing with containers up to 10',()=>{
 const g=gui();renderLegacyTabHearts(g,new Map(),1,5,100,190,'u',7,0,0);
 const b=g.calls.filter(c=>c[0]==='blit');assert.equal(b.filter(c=>c[3]===16).length,10);assert.equal(b.filter(c=>c[3]===52).length,3);assert.equal(b.filter(c=>c[3]===61).length,1);
 assert.equal(b.find(c=>c[3]===61)[1],100+3*Math.fround(86/10));
});
test('damage blinks the containers while the list stays open; reopening resets the state',()=>{
 const g=gui(),states=new Map();renderLegacyTabHearts(g,states,1,0,0,90,'u',20,0,0);
 const g2=gui();renderLegacyTabHearts(g2,states,1,0,0,90,'u',14,10,100);assert.equal(states.get('u').blinkUntil,30);assert.equal(states.get('u').displayHealth,20,'catches up after a second');
 const g3=gui();renderLegacyTabHearts(g3,states,1,0,0,90,'u',14,14,200);assert.ok(g3.calls.some(c=>c[3]===25),'blinking container');
 const g4=gui();renderLegacyTabHearts(g4,states,2,0,0,90,'u',14,15,300);assert.equal(states.get('u').displayHealth,14,'reopened');
});
test('narrow columns show the health with an hp suffix when it fits',()=>{
 const g=gui();renderLegacyTabHearts(g,new Map(),1,0,0,40,'u',40,0,0);assert.equal(g.calls[0][1],'20.0hp');assert.equal(g.calls[0][4],0x00ff00);
 const n=gui();renderLegacyTabHearts(n,new Map(),1,0,0,30,'u',40,0,0);assert.equal(n.calls[0][1],'20.0');
});
