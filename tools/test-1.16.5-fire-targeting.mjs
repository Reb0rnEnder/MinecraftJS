import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{Game}from'../client/js/game/game.js';import{Interaction}from'../client/js/game/interaction.js';import{World}from'../client/js/world/world.js';import{initBlocks,findState,blocksByName}from'../client/js/world/blocks.js';import{Hud}from'../client/js/gui/hud.js';import{setPlatform}from'../client/js/platform/platform.js';
initBlocks(JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url))));
test('native fire selection catches clicks above the support in Creative and Survival',()=>{
 for(const fire of['fire','soul_fire'])for(const mode of[0,1]){
  const support=findState('stone'),cells=new Map([['0,0,0',support],['0,1,0',blocksByName[fire].defaultState]]),digs=[],effects=[],world=new World();world.getState=(x,y,z)=>cells.get([x,y,z].join(','))||0;world.setState=(x,y,z,state)=>cells.set([x,y,z].join(','),state);
  const g={world,player:{creative:mode===1},gameMode:mode,inventory:{held:()=>null},tutorial:{onHitBlock(){}},particles:{blockBreak:()=>effects.push('break particle')},sound:{playBlockBreak:()=>effects.push('break sound'),onWorldEvent(){}}};world.selectionProvider=(...args)=>Game.prototype.selectionBox.call(g,...args);
  const target=world.raycast(.5,2.5,.5,0,-1,0,5);assert.equal(target.y,1);assert.ok(Math.abs(target.hit[1]-1.0625)<1e-9);
  const interaction=new Interaction(g);interaction._sendDig=(status,pos,face)=>digs.push({status,pos:{...pos},face});interaction.clickBlock(target,target.face);
  assert.equal(world.getState(0,0,0),support);assert.equal(world.getState(0,1,0),0);assert.equal(digs[0].pos.y,1);assert.deepEqual(effects,[],'server supplies the native extinguish event');
 }
});
test('soul fire is recognized locally but the first-person overlay retains native orange fire',()=>{
 const fire=findState('soul_fire'),hud=Object.create(Hud.prototype),textures=[];
 hud.game={gameMode:0,selfMetadata:{},player:{bb:()=>[0,1,0,.6,2.8,.6]},world:{getState:()=>fire},assets:{atlas:{entries:{get:name=>{textures.push(name);return{uv:[0,0,1,1]};}}}},device:{createMesh:()=>({})}};
 assert.equal(hud._isBurning(),true);setPlatform({width:800,height:600});hud.renderFire({scale:2,drawMesh(){}});assert.deepEqual(textures,['block/fire_1']);
});
