import {test} from 'node:test';import assert from 'node:assert/strict';
import {DirtySections} from '../client/js/render/dirty-sections.js';import {Game} from '../client/js/game/game.js';
test('heap drains nearest-first, reuses ordering across deletions and accepts new dirty sections',()=>{
 const d=new DirtySections(['5,4,0','0,4,0','2,4,0','100,4,0']),q=d.prioritized(0,4,0,32);
 assert.equal(q.pop()[0],'0,4,0');d.delete('0,4,0');assert.equal(d.prioritized(.8,4.5,.2,32),q);
 d.add('1,4,0');assert.equal(q.pop()[0],'1,4,0');d.delete('5,4,0');assert.equal(q.pop()[0],'2,4,0');assert.equal(q.pop(),null);assert.ok(d.has('100,4,0'));
 assert.notEqual(d.prioritized(1,4,0,32),q);const next=d.prioritized(1,4,0,32);d.clear();assert.equal(next.pop(),null);assert.notEqual(d.prioritized(1,4,0,32),next);
});
test('deferred entries retry without duplicates and outside-range changes stay deferred',()=>{
 const d=new DirtySections(['0,0,0','1,0,0']),q=d.prioritized(0,0,0,1),e=q.pop();q.add(e);q.add(e);d.add('10,0,0');
 assert.equal(q.pop()[0],'0,0,0');assert.equal(q.pop()[0],'1,0,0');assert.equal(q.pop(),null);assert.equal(d.size,3);
 assert.equal(d.prioritized(10,0,0,0).pop()[0],'10,0,0');
});
test('removing an empty section cancels its dirty job, worker lease and stale result token',()=>{
 const removed=[],g={world:{getChunk:()=>({sections:[{nonAir:0}],getSection:()=>({nonAir:0})})},dirty:new DirtySections(['0,0,0']),inFlight:new Map([['0,0,0',1]]),buildTokens:new Map([['0,0,0',1]]),playerAffectedSections:new Set(['0,0,0']),renderer:{removeSection:k=>removed.push(k)}};
 Game.prototype._markSectionDirty.call(g,0,0,0);assert.equal(g.dirty.size,0);assert.equal(g.inFlight.size,0);assert.equal(g.buildTokens.size,0);assert.equal(g.playerAffectedSections.size,0);assert.deepEqual(removed,['0,0,0']);
 g.world.getChunk=()=>({sections:[{nonAir:1}],getSection:()=>({nonAir:1})});Game.prototype._markSectionDirty.call(g,0,0,0);assert.ok(g.dirty.has('0,0,0'));
});
test('heap agrees with a full sort for a large backlog and survives arbitrary removals',()=>{
 const d=new DirtySections();for(let x=-16;x<=16;x++)for(let z=-16;z<=16;z++)for(let y=-4;y<20;y++)d.add(`${x},${y},${z}`);
 const camera=[.25,4.1,-.1],score=([,x,y,z])=>(x+.5-camera[0])**2+(y+.5-camera[1])**2*.5+(z+.5-camera[2])**2;
 const q=d.prioritized(...camera,16),expected=d.within(0,-1,16).map(score).sort((a,b)=>a-b),actual=[];
 for(let e;e=q.pop();)actual.push(score(e));assert.deepEqual(actual,expected);
});
