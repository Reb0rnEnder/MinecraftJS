import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{initBlocks,getBlock}from'../client/js/world/blocks.js';import{tickPortal,portalWarp,touchesPortal}from'../client/js/game/portal.js';import{moveParticle}from'../client/js/render/particle-collision.js';import{Game}from'../client/js/game/game.js';import{Reader}from'../client/js/net/buffer.js';import{Renderer}from'../client/js/render/renderer.js';import{mat4}from'../client/js/gfx/math.js';import{setPlatform}from'../client/js/platform/platform.js';
const blocks=JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),shapes=JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url)));initBlocks(blocks,shapes);const portal=blocks.find(b=>b.name==='nether_portal'||b.name==='portal'),state=portal.defaultState??portal.id<<4,close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
setPlatform({now:()=>0,width:854,height:480});
test('portal contact includes the edge of the player; 80 visual ticks ramp in and stepping out fades',()=>{
 const sounds=[],g={gameMode:0,player:{x:1.1,y:63,z:.5},world:{getState:(x,y,z)=>x===0&&y===63&&z===0?state:0},sound:{playAtPlayer:(...a)=>sounds.push(a)},effects:new Map(),portalTime:0};assert.equal(touchesPortal(g),true);for(let i=0;i<80;i++)tickPortal(g);close(g.portalTime,1);assert.equal(sounds.length,1);
 g.player.x=3;tickPortal(g);close(g.portalTime,.95);g.effects.set(9,{duration:100});tickPortal(g);assert.ok(g.portalTime>.95);g.effects.get(9).duration=60;tickPortal(g);assert.ok(g.portalTime<.95);
 g.ridingEntityId=2;g.player.x=.5;assert.equal(touchesPortal(g),false);
});
test('portal distortion warps projection without altering FOV or player movement',()=>{
 const identity=mat4.create();assert.deepEqual(portalWarp(0,20),identity);const warp=portalWarp(1,10);assert.ok(warp.every(Number.isFinite));assert.notDeepEqual(warp,identity);assert.notDeepEqual(warp,portalWarp(1,10,true));
 const r={renderDistance:4,view:mat4.create(),proj:mat4.create(),skyView:mat4.create(),skyProj:mat4.create(),viewProj:mat4.create()};Renderer.prototype.setCamera.call(r,0,64,0,180,0,0,70);const normal=r.proj.slice();Renderer.prototype.setCamera.call(r,0,64,0,180,0,0,70,null,warp);assert.equal(r.fov,70);assert.notDeepEqual(r.proj,normal);assert.ok(r.viewProj.every(Number.isFinite));
});
test('End exit value zero requests respawn without credits; value one opens the poem and ignores stale imports',async()=>{
 const sent=[],opened=[],g={inWorld:true,conn:{},send:b=>sent.push(b),screens:{open:s=>opened.push(s)},gui:{width:400,height:300,font:{wrap:s=>[s]}},assets:{readText:async()=>''}};
 Game.prototype.on_game_state_change.call(g,{reason:4,value:0});assert.equal(sent.length,1);const r=new Reader(sent[0]);r.varint();assert.equal(r.varint(),0);assert.equal(opened[0].isCredits,undefined);
 Game.prototype.on_game_state_change.call(g,{reason:4,value:1});for(let i=0;i<20&&!opened.some(s=>s.isCredits);i++)await new Promise(r=>setTimeout(r,5));assert.equal(opened.at(-1).isCredits,true);opened.at(-1).respawn();opened.at(-2)?.respawn?.();assert.equal(sent.length,2);
 const before=opened.length;Game.prototype.on_game_state_change.call(g,{reason:4,value:1});g.conn={};await new Promise(r=>setTimeout(r,5));assert.equal(opened.length,before);
});
test('particles land on a slab surface and cannot tunnel through a wall',()=>{
 const slab=[0,0,0,1,.5,1],w={getCollisions:()=>[slab]},p={x:.5,y:2,z:.5,mx:0,my:-3,mz:0,collide:true};moveParticle(p,w);close(p.y,.5);assert.equal(p.onGround,true);assert.equal(p.my,0);
 const q={x:.5,y:.6,z:.5,mx:2,my:0,mz:0,collide:true};moveParticle(q,{getCollisions:()=>[[1,0,0,2,2,1]]});close(q.x,.9);assert.equal(q.mx,0);
 const free={x:0,y:0,z:0,mx:3,my:-4,mz:2,collide:false};moveParticle(free,{getCollisions:()=>{throw Error('No collision lookup for free particles');}});assert.deepEqual([free.x,free.y,free.z],[3,-4,2]);
});
