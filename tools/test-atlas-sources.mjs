// SpriteSourceList sources: directory, single, filter and unstitch, in definition order.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runAtlasSources,cropImage} from '../client/js/render/atlas-sources.js';
const img=(w,h,v=1)=>({width:w,height:h,data:new Uint8Array(w*h*4).fill(v)});
const ctx=(names=['block/stone'],dirs={'entity/conduit':['base','cage'],'block':['stone','dirt']})=>({names:new Set(names),list:async d=>dirs[d]||[],load:async p=>p==='gui/sheet'?{width:4,height:2,data:Uint8Array.from({length:32},(_,i)=>i)}:img(16,16)});
test('directory adds new ids with the prefix, keeps loaded ones; single renames; filter removes; unstitch crops',async()=>{
  const r=await runAtlasSources([{sources:[{type:'directory',source:'entity/conduit',prefix:'entity/conduit/'},{type:'directory',source:'block',prefix:'block/'},{type:'single',resource:'entity/bell/bell_body',sprite:'bell'},
    {type:'unstitch',resource:'gui/sheet',divisor_x:2,divisor_y:1,regions:[{sprite:'left',x:0,y:0,width:1,height:1}]},{type:'filter',pattern:{path:'block/s.*'}}]}],ctx());
  assert.deepEqual([...r.add.keys()].sort(),['bell','block/dirt','entity/conduit/base','entity/conduit/cage','left']);
  assert.deepEqual([...r.remove],['block/stone']);
  const left=await r.add.get('left')();assert.equal(left.width,2);assert.deepEqual([...left.data.slice(0,8)],[0,1,2,3,4,5,6,7]);
  assert.deepEqual(cropImage({width:2,height:2,data:Uint8Array.from({length:16},(_,i)=>i)},1,1,1,1).data,Uint8Array.from([12,13,14,15]));
});
