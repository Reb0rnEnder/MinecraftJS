import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LocalPlayer} from '../client/js/game/physics.js';
import {World} from '../client/js/world/world.js';
import {initBlocks,blocksByName} from '../client/js/world/blocks.js';
import {powderSnowCollision,frozenFraction,FREEZING_UUID} from '../client/js/world/powder-snow.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));
initBlocks(json('blocks'),json('blockCollisionShapes'));
const state=blocksByName.powder_snow.defaultState;
test('powder snow has contextual collision: leather boots stand, sneak sinks, long falls land at 0.9',()=>{
 const w=new World();const boxes=m=>{const a=[];w.collisionBoxes(1,64,2,a,state,m);return a;};
 assert.deepEqual(boxes(null),[]);assert.deepEqual(boxes({y:65}),[]);
 assert.deepEqual(boxes({y:65,canWalkPowderSnow:true}),[[1,64,2,2,65,3]]);
 assert.deepEqual(boxes({y:65,canWalkPowderSnow:true,sneaking:true}),[]);
 assert.equal(boxes({y:66,fallDistance:3})[0][4],64+Math.fround(.9));
 assert.deepEqual(boxes({y:65,canWalkPowderSnow:true,spectator:true}),[]);
});
test('inside powder snow resets fall distance and slows next movement without treating snow as cobweb',()=>{
 const p=new LocalPlayer();p.setPosition(.5,64,.5);p.fallDistance=4;
 const world={getState:()=>state,getCollisions:()=>[],isLoaded:()=>true};
 p.doBlockCollisions(world);assert.equal(p.fallDistance,0);assert.equal(p.powderSnowStuck,true);assert.equal(p.inWeb,false);
 p.motionX=.2;p.motionY=-.1;p.motionZ=.2;p.moveEntity(world,.2,-.1,.2);
 assert.ok(Math.abs(p.x-(.5+.2*Math.fround(.9)))<1e-7);assert.ok(Math.abs(p.y-63.85)<1e-7);assert.equal(p.motionX,0);assert.equal(p.motionY,0);
});
test('freezing slowdown replaces native modifier instead of applying twice; air clears it',()=>{
 const p=new LocalPlayer();p.frozenTicks=140;p.freezingSlow=true;p.speedAttr={base:.1,modifiers:[{uuid:FREEZING_UUID,operation:0,amount:-.05}]};
 assert.ok(Math.abs(p.aiMoveSpeed()-.05)<1e-7);p.frozenTicks=70;assert.ok(Math.abs(p.aiMoveSpeed()-.075)<1e-7);
 p.freezingSlow=false;assert.ok(Math.abs(p.aiMoveSpeed()-.1)<1e-7);assert.equal(frozenFraction(280),1);assert.equal(frozenFraction(-1),0);
});
