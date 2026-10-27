import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{LocalPlayer}from'../client/js/game/physics.js';import{initBlocks,findState}from'../client/js/world/blocks.js';import{bee,setJarModels}from'../client/js/render/entity-models.js';
const read=name=>JSON.parse(readFileSync(new URL('../client/data/'+name+'.json',import.meta.url)));initBlocks(read('blocks'),read('blockCollisionShapes'));setJarModels(JSON.parse(readFileSync(new URL('../client/assets/bundles/entity-models.json',import.meta.url))));
const world={getState:(x,y,z)=>y===64&&z===0&&(x===0||x===1)?findState('honey_block'):0};
test('honey halves jump height and applies walking speed once across adjacent blocks',()=>{
 const p=new LocalPlayer();p.x=.99;p.z=.5;p.y=64.9375;p.onGround=true;p.motionX=p.motionZ=1;p.jump(world);assert.equal(p.motionY,Math.fround(Math.fround(.42)*.5));p.doBlockCollisions(world);assert.equal(p.motionX,.4);assert.equal(p.motionZ,.4);
 const plain={getState:()=>findState('stone')};p.jump(plain);assert.equal(p.motionY,Math.fround(.42));
});
test('honey side sliding uses the native edge, velocity thresholds and lateral fall scaling',()=>{
 const single={getState:(x,y,z)=>x===0&&y===64&&z===0?findState('honey_block'):0};
 const p=new LocalPlayer();p.x=1.238;p.z=.5;p.y=64.25;p.motionX=1;p.motionZ=.5;p.motionY=-.4;p.fallDistance=20;p.doBlockCollisions(single);assert.equal(p.motionY,-.05);assert.equal(p.motionX,.125);assert.equal(p.motionZ,.0625);assert.equal(p.fallDistance,0);
 p.motionX=1;p.motionY=-.1;p.doBlockCollisions(single);assert.equal(p.motionY,-.05);assert.equal(p.motionX,1,'gentle sliding does not damp lateral movement');
 p.x=.5;p.z=.5;p.motionY=-.4;p.doBlockCollisions(single);assert.equal(p.motionY,-.4,'being inside a honey block is not sufficient to slide');
});
test('native bee model stops grounded wings, bobs in flight and blends attack roll without losing the stinger state',()=>{
 const m=bee();m.animate(m,{onGround:true,speedSq:0,age:4});assert.equal(m.parts.rightWing.rz,0);assert.equal(m.parts.leftWing.rz,0);assert.equal(m.parts.bone.py,19);assert.equal(m.parts.frontLeg.rx,0);
 m.animate(m,{onGround:false,age:0,beeRoll:0});assert.ok(m.parts.rightWing.rz>0);assert.equal(m.parts.leftWing.rz,-m.parts.rightWing.rz);assert.equal(m.parts.bone.py,18.1);assert.ok(m.parts.leftAntenna.rx>0);
 m.animate(m,{angry:true,onGround:false,age:4,beeRoll:1,hasStung:true});assert.equal(m.parts.bone.rx,3.0915928);assert.equal(m.parts.stinger.visible,false);assert.equal(m.parts.bone.py,19);
});
