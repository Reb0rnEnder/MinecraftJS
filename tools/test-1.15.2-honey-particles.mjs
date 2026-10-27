import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{initBlocks,findState}from'../client/js/world/blocks.js';import{EntityManager}from'../client/js/game/entities.js';import{Game}from'../client/js/game/game.js';
const original=Math.random;Math.random=()=>.5;let Particles;try{({Particles}=await import('../client/js/render/particles.js?honey-oracle'));}finally{Math.random=original;}
const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(read('blocks'),read('blockCollisionShapes'));
test('full hive particles use honey_level rather than the liquid level property',()=>{
 const calls=[],p=Object.create(Particles.prototype);p.game={world:{getState:()=>0}};p.honeyDrip=(...args)=>calls.push(args);p.randomDisplayTick(2,64,3,findState('beehive',{honey_level:'5'}));assert.deepEqual(calls,[[2.5,63.95,3.5]]);p.randomDisplayTick(2,64,3,findState('beehive',{honey_level:'0'}));assert.equal(calls.length,1);
 p.game.world.getState=()=>findState('stone');p.randomDisplayTick(2,64,3,findState('beehive',{honey_level:'5'}));assert.equal(calls.length,1);
});
test('honey changes through native hanging, falling and lasting landing particles',()=>{
 const p=Object.create(Particles.prototype);p.list=[];const sound=[];p.game={settings:{particles:0},world:{},sound:{play:(...args)=>sound.push(args)}};p.move=q=>{q.y+=q.my;};
 const drop=p.honeyDrip(0,64,0);assert.equal(drop.maxAge,100);assert.equal(drop.r,Math.fround(.622));for(let i=0;i<100;i++)p.tick();assert.equal(drop.phase,'falling');assert.equal(drop.r,Math.fround(.582));
 p.move=q=>{q.onGround=true;};p.tick();assert.equal(drop.phase,'landing');assert.ok(drop.maxAge>=128);assert.equal(sound[0][0],'block.beehive.drip');assert.equal(drop.b,Math.fround(.082));
});
test('server honey status packets emit five slide or ten landing particles for remote and local players',()=>{
 const emitted=[],g={entityId:1,player:{},particles:{honeyBlockEffect:(e,n)=>emitted.push([e,n])}};g.entities=new EntityManager(g);const e=g.entities._base(2,0,64,0);e.kind='player';g.entities.map.set(2,e);
 Game.prototype.on_entity_status.call(g,{entityId:1,entityStatus:53});Game.prototype.on_entity_status.call(g,{entityId:2,entityStatus:54});assert.equal(emitted.length,2);assert.equal(emitted[0][1],5);assert.equal(emitted[1][1],10);
});
