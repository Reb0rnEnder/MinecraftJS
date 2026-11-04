import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DirtySections} from '../client/js/render/dirty-sections.js';
import {Game} from '../client/js/game/game.js';
import {baselineScheduleMeshes} from './fixtures/mesh-scheduler-baseline.js';
import {setPlatform} from '../client/js/platform/platform.js';
setPlatform({now:()=>100});
const keys=q=>q.map(entry=>entry[0]).sort();
test('indexed pending sections match a full Set scan across movement, range changes and signed coordinates',()=>{
 const q=new DirtySections(),ref=new Set();let seed=17;
 const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let i=0;i<3000;i++){
  const key=[rand(71)-35,rand(30)-5,rand(71)-35].join(',');
  if(i%4){assert.equal(q.add(key),q);ref.add(key);}else assert.equal(q.delete(key),ref.delete(key));
  if(i%23===0){const x=rand(51)-25,z=rand(51)-25,r=rand(15);assert.deepEqual(keys(q.within(x,z,r)),[...ref].filter(k=>{const[a,,b]=k.split(',').map(Number);return Math.abs(a-x)<=r&&Math.abs(b-z)<=r;}).sort());}
 }
 assert.deepEqual([...q],[...ref]);q.clear();assert.equal(q.size,0);assert.equal(q.columns.size,0);assert.deepEqual(q.within(0,0,32),[]);
});
test('off-range server traffic does not invalidate the active query and deferred work remains available',()=>{
 const q=new DirtySections(['0,-4,0','32,3,32']),active=q.within(0,0,11);assert.deepEqual(keys(active),['0,-4,0']);
 q.add('31,2,30');q.delete('32,3,32');assert.equal(q.within(0,0,11),active);
 q.add('1,3,1');assert.notEqual(q.within(0,0,11),active);assert.ok(q.has('31,2,30'));
 assert.ok(keys(q.within(31,30,1)).includes('31,2,30'));q.delete('31,2,30');assert.deepEqual(q.within(31,30,1),[]);
});
function fixture(Queue){
 const chunk={sections:[],getSection:()=>null},removed=[],worker={};
 const g={assets:{worker},world:{getChunk:()=>chunk},renderer:{removeSection:key=>removed.push(key)},settings:{renderDistance:10,prioritizeChunkUpdates:'none'},_lodCamera:()=>[0,64,0],_updateLod(){}};
 Game.prototype._setupWorker.call(g);g.dirty=new Queue();return{g,removed};
}
test('actual scheduler preserves pending near/far sections, unload deletion and movement eligibility',()=>{
 const a=fixture(DirtySections),b=fixture(Set);
 for(let x=-32;x<=32;x++)for(let z=-32;z<=32;z++)for(let y=-4;y<8;y++)for(const f of[a,b])f.g.dirty.add([x,y,z].join(','));
 for(const center of [[0,64,0],[320,64,320],[-320,64,-320]]){
  for(const f of[a,b])f.g._lodCamera=()=>center;
  Game.prototype._scheduleMeshes.call(a.g);baselineScheduleMeshes.call(b.g);
  assert.deepEqual(a.removed.sort(),b.removed.sort());assert.deepEqual([...a.g.dirty].sort(),[...b.g.dirty].sort());
 }
});
