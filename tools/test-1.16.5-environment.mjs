import {test}from'node:test';import assert from'node:assert/strict';import {readFileSync}from'node:fs';
import {initBiomes,biomeInfo,setServerBiomes}from'../client/js/world/biomes.js';import {sampleBiomeFog}from'../client/js/world/biome-effects.js';
import {initBlocks,findState}from'../client/js/world/blocks.js';import {World}from'../client/js/world/world.js';import {LocalPlayer}from'../client/js/game/physics.js';
import {SteerableController}from'../client/js/game/vehicle.js';import {netherParticle,NETHER_PARTICLES}from'../client/js/render/nether-particles.js';
import {tickBiomeSounds}from'../client/js/audio/biome-sounds.js';
const data=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));
initBiomes(data('biomes'));initBlocks(data('blocks'),data('blockCollisionShapes'));
function world(floor){const w=new World();w.isLoaded=()=>true;w.getState=(_x,y,_z)=>y===0?findState(floor):0;return w;}
test('native biome effects and Gaussian fog honor vertical biomes and custom server IDs',()=>{
 assert.equal(biomeInfo(170).effects.fog_color,1787717);assert.equal(biomeInfo(173).effects.water_fog_color,4341314);
 const w={getNoiseBiome:()=>170},color=sampleBiomeFog(w,100,50,20),expected=[16,8,0].map(s=>(1787717>>s&255)/255);color.forEach((c,i)=>assert.ok(Math.abs(c-expected[i])<1e-10));
 setServerBiomes({'minecraft:worldgen/biome':{value:[{id:200,name:'custom:blue',element:{temperature:.1,downfall:.2,effects:{fog_color:255,water_color:123,water_fog_color:456}}}]}});
 assert.equal(biomeInfo(200).name,'custom:blue');assert.equal(biomeInfo(200).effects.fog_color,255);setServerBiomes(null);assert.notEqual(biomeInfo(200).name,'custom:blue');
});
test('only striders can stand on the half-block lava collision surface; submerged striders rise',()=>{
 const w=world('lava'),e={entityName:'strider',width:.9,height:1.7,x:0,y:1,z:0,yaw:0},ctl=new SteerableController(w,e),p={yaw:0,pitch:0};
 const normal=new LocalPlayer();normal.setPosition(0,1,0);const out=[];w.collisionBoxes(0,0,0,out,findState('lava'),normal);assert.deepEqual(out,[]);
 ctl.body.setPosition(0,.5,0);w.collisionBoxes(0,0,0,out,findState('lava'),ctl.body);assert.deepEqual(out,[[0,0,0,1,.5,1]]);
 for(let i=0;i<8;i++)ctl.tick(p,0,0,{speed:.175});assert.ok(Math.abs(ctl.body.y-.5)<1e-6);assert.ok(ctl.body.z>0,'steering item supplies forward movement even without W');
 ctl.body.setPosition(0,.1,0);ctl.body.motionY=0;ctl.tick(p,0,0,{speed:.175});assert.ok(ctl.body.motionY>0,'buoyancy reverses downward motion');
});
test('Soul Speed removes soul-sand slowdown; boost and cold alter ridden strider speed',()=>{
 const w=world('soul_sand'),p=new LocalPlayer();p.setPosition(0,1,0);p.onGround=true;p.motionX=1;p.doBlockCollisions(w);assert.equal(p.motionX,.4);
 p.soulSpeed=3;p.motionX=1;p.doBlockCollisions(w);assert.equal(p.motionX,1);
 const stone=world('stone'),e={entityName:'strider',width:.9,height:1.7,x:0,y:1,z:0,yaw:0},warm=new SteerableController(stone,{...e}),cold=new SteerableController(stone,{...e,striderCold:true}),boost=new SteerableController(stone,{...e,boosting:true,boostDuration:100,boostTicks:50});
 for(const ctl of[warm,cold,boost])ctl.tick({yaw:0,pitch:0},0,0,{speed:.175});assert.ok(cold.body.landMovementFactor<warm.body.landMovementFactor);assert.ok(boost.body.landMovementFactor>warm.body.landMovementFactor);
});
test('every Nether particle has native sprites and finite updates with tear phase transitions',()=>{
 const sprites=data('particleSprites'),particles=[],system={game:{world:{}},fx(x,y,z,mx,my,mz,extra){return{x,y,z,mx,my,mz,...extra};},add(p){p.age=0;particles.push(p);return p;},move(p){p.x+=p.mx||0;p.y+=p.my||0;p.z+=p.mz||0;},flame(x,y,z){return this.add({x,y,z});}};
 for(const type of NETHER_PARTICLES){assert.ok(sprites[type]?.textures.length,type);const p=netherParticle(system,type,0,10,0);if(p.update){p.age=1;p.update(p);}for(const key of['x','y','z'])assert.ok(Number.isFinite(p[key]),type+key);}
 const hang=netherParticle(system,'dripping_obsidian_tear',0,10,0);hang.age=101;assert.equal(hang.update(hang),false);assert.equal(particles.at(-1).sprite,'falling_obsidian_tear');
});
test('biome sound loops fade over forty ticks and stop when changing biomes',async()=>{
 let id=170;const volumes=[],handle={setVolume:v=>volumes.push(v),stop(){this.stopped=true;}},sound={generation:0,game:{inWorld:true,player:{x:0,y:50,z:0,eyeHeight:()=>1.62},world:{getBiome:()=>id,getSkyLight:()=>15,getBlockLight:()=>0}},play(){},playLoop:async()=>handle};
 for(let i=0;i<41;i++){tickBiomeSounds(sound);await Promise.resolve();}assert.equal(volumes.at(-1),1);
 id=1;for(let i=0;i<41;i++)tickBiomeSounds(sound);assert.equal(handle.stopped,true);assert.equal(sound.biomeSounds.loops.size,0);
});
