import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LocalPlayer} from '../client/js/game/physics.js';
import {initBlocks} from '../client/js/world/blocks.js';
import mcassets from '../lib/mcassets.js';
const version=mcassets.MC_VERSION;
const json=name=>JSON.parse(readFileSync(new URL('../client/data/'+name+'.json',import.meta.url)));
initBlocks(json('blocks'),json('blockCollisionShapes'));
const world={getState:()=>0,isLoaded:()=>true,getCollisions:()=>[]};
function player(spectator=true){const p=new LocalPlayer();p.setPosition(0,64,0);p.allowFlying=p.flying=true;p.spectator=spectator;return p;}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test(version+': entering spectator clears stale grounded/collision state before the first movement tick',()=>{
 const air=player(),grounded=player();grounded.onGround=true;
 grounded.pushOutOfBlocks=()=>{throw Error('spectators must not be pushed out of walls');};
 air.tick(world,{forward:true});grounded.tick(world,{forward:true});
 assert.equal(grounded.noClip,true);assert.equal(grounded.onGround,false);near(grounded.z,air.z);near(grounded.motionZ,air.motionZ);
 near(grounded.z,Math.fround(Math.fround(.98)*Math.fround(.05)));
 grounded.moveEntity({getCollisions(){throw Error('noclip queried wall collision');}},1,1,1);near(grounded.x,1);
 grounded.pushOutOfBlocks=()=>false;grounded.spectator=false;grounded.tick(world,{});assert.equal(grounded.noClip,false);
});
test(version+': spectator coasts with native airborne drag and vertical flight damping',()=>{
 const p=player();p.motionX=.2;p.motionY=.2;p.motionZ=.1;p.onGround=true;
 for(let i=0;i<3;i++)p.tick(world,{});
 near(p.motionX,.2*Math.fround(.91)**3);near(p.motionZ,.1*Math.fround(.91)**3);near(p.motionY,.2*.6**3);near(p.y,64+.2+.12+.072);
});
if(['1.15.2','1.16.5','1.17.1'].includes(version))test(version+': descending does not amplify horizontal spectator or creative flight input',()=>{
 for(const spectator of [true,false])for(const input of [{forward:true},{forward:true,left:true}]){
  const straight=player(spectator),down=player(spectator);straight.tick(world,input);down.tick(world,{...input,sneak:true});near(straight.x,down.x);near(straight.z,down.z);assert.ok(down.y<straight.y);
 }
});
if(version==='1.14.4')test('1.14.4: creative descent restores the native sneak input reduction, retaining spectator behavior',()=>{
 const straight=player(false),down=player(false);straight.tick(world,{forward:true});down.tick(world,{forward:true,sneak:true});near(straight.z,down.z);
 const spectator=player();spectator.tick(world,{forward:true,sneak:true});near(spectator.z,Math.fround(.05));
});
if(version==='1.8.9')test('1.8.9: retain native horizontal sneak slowdown during flight',()=>{
 const straight=player(),down=player();straight.tick(world,{forward:true});down.tick(world,{forward:true,sneak:true});near(down.z,straight.z*.3);
});
if(['1.16.5','1.17.1'].includes(version))test(version+': flying bypasses the liquid jump impulse in water and lava',()=>{
 const dry=player();dry.tick(world,{jump:true});
 for(const lava of [false,true]){
  const wet=player();wet.handleWaterMovement=()=>{wet.inWater=!lava;};wet.isInLava=()=>lava;wet.isEyeInWater=()=>false;
  wet.tick(world,{jump:true});near(wet.y,dry.y);near(wet.motionY,dry.motionY);
 }
});
