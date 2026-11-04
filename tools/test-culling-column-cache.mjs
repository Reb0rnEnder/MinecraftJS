import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SectionCuller,sectionKey} from '../client/js/render/culling.js';
test('moving camera reuses occupied columns, preserving the exact walk and load/unload invalidation',()=>{
 const c=new SectionCuller(),sections=new Map(),loaded=new Set();let queries=0,revision=1;
 for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++){loaded.add(x+','+z);sections.set(sectionKey(x,4,z),{cx:x,sy:4,cz:z,solid:{}});}
 const check=(x,z)=>{queries++;return loaded.has(x+','+z);},bounds={minSection:0,sectionCount:16};
 const run=(cam,dist=32)=>c.update(sections,[],cam,dist,check,false,Infinity,bounds,revision);
 const compare=(cam,dist=32)=>{const baseline=new SectionCuller();const expected=baseline.update(sections,[],cam,dist,(x,z)=>loaded.has(x+','+z),false,Infinity,bounds);assert.deepEqual(run(cam,dist),expected);assert.equal(c.reachedCount,baseline.reachedCount);};
 compare([1,65,1]);assert.equal(queries,67*67);queries=0;compare([2,65,2]);assert.equal(queries,0);
 loaded.delete('1,1');revision++;compare([3,65,3]);assert.equal(queries,67*67);queries=0;
 compare([17,65,3]);assert.equal(queries,67*67);queries=0;compare([17,66,3],10);assert.equal(queries,23*23);
 const before=queries;run([17,66,3],10);assert.equal(queries,before);
 // Without an explicit revision the public culler API always queries afresh.
 c.update(sections,[],[17,66,3],10,check,false);assert.equal(queries,before+23*23);
});
