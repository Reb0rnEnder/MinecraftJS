import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{initBlocks,findState}from'../client/js/world/blocks.js';import{World}from'../client/js/world/world.js';import{Chunk}from'../client/js/world/chunk.js';import{LocalPlayer}from'../client/js/game/physics.js';
const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(read('blocks'),read('blockCollisionShapes'));
for(const [name,bounce,damage]of [['slime_block',1,0],['red_bed',Math.fround(.66),2]])test('flattened '+name+' preserves native landing bounce and fall damage',()=>{
 const w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);c.setState(0,64,0,findState(name));const p=new LocalPlayer();p.x=p.z=.5;p.y=65.5;p.motionY=-1;p.fallDistance=10;let dealt=0;p.onFall=n=>dealt+=n;p.moveEntity(w,0,-1,0);assert.equal(p.onGround,true);assert.equal(p.motionY,bounce);assert.equal(dealt,damage);
});
test('flattened cobweb enters the web movement state',()=>{
 const p=new LocalPlayer();p.x=p.z=.5;p.y=64;p.doBlockCollisions({getState:()=>findState('cobweb')});assert.equal(p.inWeb,true);
});
