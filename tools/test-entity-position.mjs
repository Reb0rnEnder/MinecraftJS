import {test} from 'node:test';import assert from 'node:assert/strict';
import {EntityManager} from '../client/js/game/entities.js';import {encodeEntityPosition} from '../client/js/game/entity-position.js';
test('zero-axis relative packets retain exact boat/platform coordinates',()=>{
 const manager=Object.create(EntityManager.prototype),e=manager._base(4,.1234567,64.521234567,-.1234567);e.kind='boat';manager.map=new Map([[4,e]]);
 manager.relMove({entityId:4,dX:1/4096,dY:0,dZ:0,onGround:false},true,false);
 assert.equal(e.newY,64.521234567);assert.equal(e.newZ,-.1234567);assert.equal(e.newX,(encodeEntityPosition(.1234567)+1)/4096);assert.equal(e.inc,10);
 manager.relMove({entityId:4,dX:0,dY:0,dZ:0,onGround:false},true,false);assert.equal(e.newY,64.521234567);
});
test('small absolute boat corrections are honored; locally controlled vehicles only update the packet base',()=>{
 const m=Object.create(EntityManager.prototype),e=m._base(4,.5,64.521,.5);e.kind='boat';m.map=new Map([[4,e]]);
 m.teleport({entityId:4,x:.5001,y:64.522,z:.5001,yaw:15,pitch:0,onGround:false});assert.equal(e.newY,64.522);assert.equal(e.packetY,64.522);
 e.controlled=true;const target=e.newY;m.teleport({entityId:4,x:1,y:65,z:1,yaw:20,pitch:0});assert.equal(e.packetY,65);assert.equal(e.newY,target);
 const base=e.packetX;m.relMove({entityId:4,dX:1,dY:0,dZ:0},true,false);assert.equal(e.packetX,base);
});
test('look-only packets use current interpolated position rather than restarting an older movement target',()=>{
 const m=Object.create(EntityManager.prototype),e=m._base(4,.5,64.521,.5);e.kind='boat';e.inc=10;e.newY=66;m.map=new Map([[4,e]]);
 m.look({entityId:4,yaw:90,pitch:15,onGround:false});assert.equal(e.newY,64.521);
});
test('packet coordinate encoding matches this release’s native rounding, including negative coordinates',()=>{assert.deepEqual([-1.00012,-.00012,.00013,1.00013].map(encodeEntityPosition),[-4097,-1,0,4096]);});
