import {test} from 'node:test';import assert from 'node:assert/strict';
import {initSquid,tickSquid,squidTentacle,squidMatrix} from '../client/js/game/squid-animation.js';
import {EntityManager} from '../client/js/game/entities.js';
const squid=()=>({id:42,kind:'mob',type:94,bodyYaw:0,motionX:.1,motionY:0,motionZ:.2});
test('client tentacles finish their cycle and wait for server event 19',()=>{
 const e=squid();initSquid(e);let extended=false;
 for(let i=0;i<150;i++){tickSquid(e,true);extended||=e.squid.tentacle>.7;}
 assert.ok(extended);assert.equal(e.squid.phase,Math.fround(Math.PI*2));assert.equal(e.squid.tentacle,0);
 const manager=new EntityManager({});manager.map.set(e.id,e);manager.onStatus({entityId:e.id,entityStatus:19});assert.equal(e.squid.phase,0);tickSquid(e,true);assert.ok(e.squid.phase>0&&e.squid.phase<Math.PI);
});
test('water swimming and land flopping use separate native poses with partial interpolation',()=>{
 const e=squid();initSquid(e);for(let i=0;i<15;i++)tickSquid(e,true);
 assert.ok(e.squid.tentacle>.1);assert.ok(e.squid.xRot<0);assert.ok(e.bodyYaw<0);
 assert.equal(squidTentacle(e,0),e.squid.oldTentacle);assert.equal(squidTentacle(e,1),e.squid.tentacle);
 const matrix=squidMatrix(e,e.bodyYaw,.5);assert.ok([...matrix].every(Number.isFinite));assert.notEqual(matrix[5],1);
 e.squid.xRot=0;tickSquid(e,false);assert.ok(Math.abs(e.squid.xRot+1.8)<1e-6);assert.ok(e.squid.tentacle>=0);
});
test('animation history and server phase resets belong to each squid',()=>{
 const a=squid(),b={...squid(),id:99};initSquid(a);initSquid(b);assert.notEqual(a.squid.speed,b.squid.speed);
 for(let i=0;i<10;i++){tickSquid(a,true);tickSquid(b,true);}const phase=b.squid.phase;
 const manager=new EntityManager({});manager.map.set(a.id,a);manager.map.set(b.id,b);manager.onStatus({entityId:a.id,entityStatus:19});assert.equal(a.squid.phase,0);assert.equal(b.squid.phase,phase);
});
