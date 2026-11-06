import mcassets from '../lib/mcassets.js';
import{PLAYER_DATA,respawnPolicy,clampMaxHealth}from'../client/js/game/player-native.js';
import{test}from'node:test';import assert from'node:assert/strict';
import{LocalPlayer}from'../client/js/game/physics.js';import{replaceRespawnPlayer}from'../client/js/game/respawn-player.js';
import{Game}from'../client/js/game/game.js';import{World}from'../client/js/world/world.js';
import{nbt,TAG}from'../client/js/net/nbt.js';

function fixture(){
  const player=new LocalPlayer(),removed=[];player.setPosition(100,70,80);player.motionX=2;player.motionY=-1;player.motionZ=3;player.fallDistance=40;player.usingItem=true;player.flying=true;if(Object.hasOwn(player,'attackSpeed'))player.attackSpeed=12;player.speedAttr={base:.3,modifiers:[{uuid:'sprint',operation:2,amount:.3}]};player.attributes=new Map([['generic.maxHealth',{value:40,modifiers:[]}]]);player.onStep=()=>{};player.ridingEntity={id:18};player.riptideTicks=20;player.sneaking=true;
  const g={player,maxHealth:40,health:12,prevHealth:15,food:2,saturation:0,xpBar:.5,xpLevel:20,xpTotal:300,heldSlot:4,window:{id:8},inventoryOpen:true,spawnPos:{x:1,y:64,z:2},spawnAngle:37,selfMetadata:{0:0xa2,[PLAYER_DATA.healthIndex]:12,99:{custom:'value'}},effects:new Map([[1,{amplifier:3}]]),lastReported:{x:100,y:70,z:80,yaw:45,pitch:10,sneak:true,sprint:false},entities:{self:{id:-1}},entityRenderer:{remove:id=>removed.push(id)},interaction:{ticksSinceLastSwing:20,useTicks:31,spyglassUsing:true},inventory:{stateId:31,dragSlots:new Set([5]),reset(){this.main=Array(36).fill(null);}},removed};
  if(PLAYER_DATA.poseIndex!==null)g.selfMetadata[PLAYER_DATA.poseIndex]=3;
  if(PLAYER_DATA.frozenIndex!==null)g.selfMetadata[PLAYER_DATA.frozenIndex]=80;
  if(PLAYER_DATA.livingFlagsIndex!==null)g.selfMetadata[PLAYER_DATA.livingFlagsIndex]=4;
  return g;
}
for(const copyMetadata of[false,true])for(const keepAttributes of[false,true])test(`fresh respawn: metadata=${copyMetadata}, attributes=${keepAttributes}`,()=>{
  const g=fixture(),old=g.player,oldData=g.selfMetadata,p=replaceRespawnPlayer(g,{copyMetadata,keepAttributes});
  assert.notEqual(p,old);assert.equal(p.onStep,old.onStep);assert.deepEqual([p.motionX,p.motionY,p.motionZ,p.fallDistance,p.usingItem,p.ridingEntity],[0,0,0,0,false,null]);
  assert.equal(g.effects.size,0);assert.equal(g.health,keepAttributes?40:20);assert.equal(g.maxHealth,g.health);assert.equal(g.selfMetadata[PLAYER_DATA.healthIndex],g.health);
  if(PLAYER_DATA.poseIndex!==null){assert.equal(g.selfMetadata[PLAYER_DATA.poseIndex],0);assert.equal(p.pose,'standing');}
  if(Object.hasOwn(p,'riptideTicks'))assert.equal(p.riptideTicks,0);
  if(PLAYER_DATA.frozenIndex!==null)assert.equal(p.frozenTicks,copyMetadata?80:0);if(Object.hasOwn(p,'elytraFlying'))assert.equal(p.elytraFlying,copyMetadata);assert.equal(g.selfMetadata[99]?.custom,copyMetadata?'value':undefined);
  if(copyMetadata){assert.notEqual(g.selfMetadata[99],oldData[99]);}
  assert.equal(p.speedAttr.base,keepAttributes?.3:Math.fround(.1));if(Object.hasOwn(p,'attackSpeed'))assert.equal(p.attackSpeed,keepAttributes?12:4);assert.equal(p.attributes.size,keepAttributes?1:0);
  if(keepAttributes){assert.notEqual(p.speedAttr,old.speedAttr);assert.notEqual(p.speedAttr.modifiers,old.speedAttr.modifiers);}
  assert.deepEqual([p.x,p.y,p.z,p.yaw,p.prevYaw,p.pitch],[1.5,65,2.5,-180,37,0]);
  assert.deepEqual([g.food,g.saturation,g.xpBar,g.xpLevel,g.xpTotal,g.heldSlot,g.window,g.inventoryOpen],[20,5,0,0,0,0,null,false]);
  assert.equal(g.inventory.stateId,0);assert.equal(g.inventory.dragSlots.size,0);assert.equal(g.interaction.useTicks,0);assert.equal(g.interaction.ticksSinceLastSwing,0);assert.deepEqual(g.removed,[-1]);assert.equal(g.entities.self,null);
});

test('older metadata indices do not acquire newer pose, freeze or riptide fields',()=>{
  const g=fixture();g.selfMetadata={0:2,6:4,1:200};
  replaceRespawnPlayer(g,{healthIndex:6,poseIndex:null,livingFlagsIndex:null,frozenIndex:null});
  assert.equal(g.selfMetadata[6],20);assert.equal(g.selfMetadata[1],200);assert.equal(Object.hasOwn(g.selfMetadata,7),false);assert.equal(Object.hasOwn(g.selfMetadata,8),false);
});

const version=mcassets.MC_VERSION,bits=['1.19.4','1.20.6'].includes(version),retentionFlag=['1.16.5','1.17.1','1.18.2'].includes(version);
for(const value of(bits?[0,1,2,3]:retentionFlag?[false,true]:[null]))test(version+' Game respawn uses its native retention policy '+value,()=>{
  const g=fixture(),world=g.world=new World(),modernHeight=['1.18.2','1.19.4','1.20.6'].includes(version),minY=modernHeight?-64:0,height=modernHeight?384:256;world.setDimension(0,{min_y:minY,height});
  const type={min_y:nbt.int(minY),height:nbt.int(height),effects:nbt.string('minecraft:overworld')};
  g.dimensionCodec=nbt.compound({'minecraft:dimension_type':nbt.compound({value:nbt.list(TAG.COMPOUND,[{id:nbt.int(0),name:nbt.string('minecraft:overworld'),element:nbt.compound(type)}])})});
  Object.assign(g,{dimension:0,worldName:'minecraft:overworld',screens:{current:null},applyGameMode:Game.prototype.applyGameMode});
  const packet={worldType:'minecraft:overworld',worldName:'minecraft:overworld',dimension:0,dimensionData:{min_y:minY,height,effects:'minecraft:overworld'},hashedSeed:0n,gameMode:1,gamemode:1,previousGameMode:0,isFlat:false,levelType:'default',dataToKeep:bits?value:undefined,copyMetadata:retentionFlag?value:undefined};
  const old=g.player,policy=respawnPolicy(packet);Game.prototype.on_respawn.call(g,packet);
  assert.notEqual(g.player,old);assert.equal(g.player.speedAttr.base,policy.keepAttributes?.3:Math.fround(.1));assert.equal(g.selfMetadata[99]?.custom,policy.copyMetadata?'value':undefined);assert.equal(g.player.invulnerable,true);
});

test('attribute updates retain modifier records and use native max-health arithmetic',()=>{
  const g=fixture();g.entityId=7;g.entities.setAttributes=()=>{};
  const p={entityId:7,properties:[{key:'generic.maxHealth',value:20,modifiers:[{uuid:'a',operation:0,amount:5},{uuid:'b',operation:1,amount:.2},{uuid:'c',operation:2,amount:.5}]}]};
  Game.prototype.on_update_attributes.call(g,p);assert.equal(g.maxHealth,45);assert.notEqual(g.player.attributes.get('generic.maxHealth'),p.properties[0]);
});

test('max-health range retains the target native minimum and upper limit',()=>{assert.equal(clampMaxHealth(-50),['1.8.9','1.12.2','1.13.2','1.14.4','1.15.2'].includes(version)?0:1);assert.equal(clampMaxHealth(10000),1024);});

// LocalPlayer's initial health synchronization is silent, even when copied
// max health exceeds the first authoritative current health after a transfer.
test('initial server health after respawn is silent; subsequent damage flashes',()=>{
  const g=fixture();replaceRespawnPlayer(g,{keepAttributes:true});g.hud={healthFlash:0};g.ticks=50;
  Game.prototype.on_update_health.call(g,{health:20,food:19,foodSaturation:3});
  assert.equal(g.player.healthInitialized,true);assert.equal(g.hurtTime,0);assert.equal(g.hud.healthFlash,0);assert.equal(g.health,20);
  Game.prototype.on_update_health.call(g,{health:17,food:19,foodSaturation:3});
  assert.equal(g.hurtTime,10);assert.equal(g.hud.healthFlash,70);assert.equal(g.selfMetadata[PLAYER_DATA.healthIndex],17);
});
