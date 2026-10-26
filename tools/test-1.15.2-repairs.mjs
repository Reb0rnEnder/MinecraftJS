import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{Items}from'../client/js/game/items.js';import{Interaction}from'../client/js/game/interaction.js';import{LocalPlayer}from'../client/js/game/physics.js';import{EntityManager}from'../client/js/game/entities.js';
import{initBlocks,findState,getBlock}from'../client/js/world/blocks.js';import{nbt}from'../client/js/net/nbt.js';import{World}from'../client/js/world/world.js';import{Chunk}from'../client/js/world/chunk.js';import{buildSlice,SliceWorld}from'../client/js/world/slice.js';
const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url))),data=Object.fromEntries(['blocks','blockCollisionShapes','items','creative','enchantments'].map(n=>[n,read(n)]));initBlocks(data.blocks,data.blockCollisionShapes);const items=new Items({data,translate:k=>k});
const held=name=>({id:items.byName.get(name).id,count:64});
function fixture(name='stone'){
 const player=new LocalPlayer();player.x=player.z=.5;player.y=64;const cells=new Map([['0,63,0',findState('stone')]]),stack=held(name),sent=[];
 const world={getState:(x,y,z)=>cells.get([x,y,z].join(','))||0,setState:(x,y,z,s)=>cells.set([x,y,z].join(','),s),isRainingAt:()=>false};
 const g={items,player,world,dimension:0,gameMode:1,food:20,entities:{all:()=>[]},inventory:{getHand:()=>stack,held:()=>stack,offhand:null,main:[stack]},send:p=>sent.push(p),sound:{onWorldEvent(){},playAtPlayer(){}},cooldownFraction:()=>0};
 const i=new Interaction(g);return{g,i,player,world,cells,stack,sent};
}
test('production item mechanics match native identities instead of shifted inherited numeric IDs',()=>{
 for(const[name,action]of Object.entries({trident:'spear',crossbow:'crossbow',shield:'block',bow:'bow',honey_bottle:'drink',apple:'eat',firework_rocket:'none'}))assert.equal(items.useAction(held(name)),action,name);
 assert.equal(items.isFood(held('crossbow')),false);assert.equal(items.useDuration(held('trident')),72000);
 assert.equal(data.creative.source.clientJarSha1,'e3f78cd16f9eb9a52307ed96ebec64241cc5b32d');assert.equal(data.creative.tabs.find(t=>t.label==='search').items.length,1134);
});
test('public right-click rejects a solid placement inside the local player before prediction',()=>{
 const{g,i,world}=fixture();i.target={type:'block',x:0,y:63,z:0,face:1,hit:[.5,64,.5]};i.rightClickMouse();assert.equal(world.getState(0,64,0),0);assert.equal(i.predictedBlocks.size,0);
});
test('partial block collision checks use native occupied boxes and permit touching surfaces',()=>{
 const{g,i,player,cells}=fixture('oak_slab');cells.set('0,64,-1',findState('stone'));const target={x:0,y:64,z:-1,face:3,hit:[.5,64.25,0]};player.y=64.5;assert.equal(i._canPlaceBlockOnSide(target,g.inventory.held()),true);player.y=64.4;assert.equal(i._canPlaceBlockOnSide(target,g.inventory.held()),false);
 const fence=fixture('oak_fence');fence.cells.set('0,64,-1',findState('stone'));fence.player.y=65;assert.equal(fence.i._canPlaceBlockOnSide(target,fence.stack),false);
});
test('prediction stays until authoritative correction and does not guess multipart states',()=>{
 const{g,i,world,stack}=fixture('glass');const block=getBlock(findState('glass'));i._predictPlace({x:2,y:64,z:0},stack,block);assert.equal(world.getState(2,64,0),block.defaultState);
 g.settings={keys:{}};g.input={isDown:()=>false};for(const method of['updateEquip','updateTarget','sendClickBlockToController','updateSwing','_tickCooldown'])i[method]=()=>{};
 for(let n=0;n<100;n++)i.tick([]);assert.equal(world.getState(2,64,0),block.defaultState);assert.equal(i.predictedBlocks.size,1);
 world.setState(2,64,0,0);i.onBlockChange({x:2,y:64,z:0},0);assert.equal(i.predictedBlocks.size,0);
 for(const name of['oak_door','white_bed','oak_stairs']){i._predictPlace({x:3,y:64,z:0},held(name),getBlock(findState(name)));assert.equal(world.getState(3,64,0),0,name);}
});
test('Riptide uses real inventory NBT and production mechanics; wet checks do not apply fluid movement',()=>{
 const{g,i,stack,player,world}=fixture('trident');stack.nbt=nbt.compound({Enchantments:nbt.list(10,[{id:nbt.string('minecraft:riptide'),lvl:nbt.short(3)}])});world.getState=()=>findState('water');
 player.handleWaterMovement=()=>{throw Error('eligibility applied fluid acceleration');};const before=[player.motionX,player.motionY,player.motionZ];assert.equal(i._wetForRiptide(),true);assert.deepEqual([player.motionX,player.motionY,player.motionZ],before);
 assert.equal(i.sendUseItem(stack),true);assert.equal(player.usingItem,true);i.useTicks=12;i.stopUsingItem();assert.equal(player.riptide,true);assert.equal(player.motionZ,3);
});
test('the new stinger-count field does not become a bed position or shift mob/player properties',()=>{
 const m=new EntityManager({}),e=m._base(5,0,0,0);e.kind='mob';e.entityName='cat';m._applyMeta(e,{12:2,13:null,16:5,18:7,21:10});assert.equal(e.stingerCount,2);assert.equal(e.sleepingPosition,null);assert.equal(e.catType,7);assert.equal(e.sitting,true);assert.equal(e.collar,10);
 m._applyMeta(e,{12:3});assert.equal(e.sleepingPosition,null);assert.equal(e.catType,7);
 const b=m._base(6,0,0,0);b.kind='mob';b.entityName='bee';m._applyMeta(b,{16:12,17:30});assert.equal(b.hasNectar,true);assert.equal(b.hasStung,true);assert.equal(b.angry,true);
});
test('target render/selection data cover every state and non-cubes do not cause suffocation push-out',()=>{
 const s=data.blockCollisionShapes;assert.equal(s.render.states.length,11337);assert.equal(s.selection.states.length,11337);assert.equal(s.render.source.clientJarSha1,data.creative.source.clientJarSha1);
 const p=new LocalPlayer();p.x=p.z=.5;p.y=64;const world={getState:(x,y,z)=>x===0&&y===64&&z===0?findState('campfire'):0};p.pushOutOfBlocks(world,.5,64.5,.5);assert.equal(p.motionX,0);assert.equal(p.motionZ,0);
});
test('height-dependent biome cells survive the worker snapshot',()=>{
 const w=new World(),c=new Chunk(0,0,true);c.biomes=new Uint32Array(1024);c.biomes.fill(1);c.biomes[(20<<4)]=2;w.chunks.set(World.key(0,0),c);
 assert.equal(w.getBiome(0,0,80),2);assert.equal(w.getBiome(0,0,4),1);assert.equal(new SliceWorld(buildSlice(w,0,5,0)).getBiome(0,0,80),2);
});
