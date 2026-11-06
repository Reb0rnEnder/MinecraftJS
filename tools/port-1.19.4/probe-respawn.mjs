import assert from'node:assert/strict';import{writeFile}from'node:fs/promises';import{join}from'node:path';
import{connectFixture}from'./fixture-client.mjs';import{cache,target}from'./prepare.mjs';
import{Game}from'../../client/js/game/game.js';import{LocalPlayer}from'../../client/js/game/physics.js';import{World}from'../../client/js/world/world.js';import{WorldBorder}from'../../client/js/world/world-border.js';import{EntityManager}from'../../client/js/game/entities.js';import{C}from'../../client/js/net/packets.js';
const resets=[],g={player:new LocalPlayer(),world:new World(),worldBorder:new WorldBorder(),effects:new Map(),selfMetadata:{},maxHealth:20,health:20,food:20,saturation:5,ticks:0,entityRenderer:{remove(){}},hud:{healthFlash:0},interaction:{predictedDoors:new Map(),predictedBlocks:new Map(),ticksSinceLastSwing:0,useTicks:0},inventory:{reset(){},stateId:0},screens:{current:null,open(s){this.current=s;},close(){this.current=null;}},tileRenderer:{clear(){}},pistons:{clear(){}},_resetMeshing(){},applyGameMode:Game.prototype.applyGameMode,_applyEffects:Game.prototype._applyEffects};
g.world.worldBorder=g.worldBorder;g.entities=new EntityManager(g);
const client=await connectFixture((p,state)=>{
  if(p.name==='login'){g.entityId=p.entityId;g.dimensionCodec=p.dimensionCodec;g.dimension=p.dimension;g.worldName=p.worldName;g.gameMode=p.gameMode;g.world.setDimension(p.dimension,p.dimensionData);}
  if(p.name==='position'){const a=state.position;g.player.setPosition(a.x,a.y,a.z);g.player.yaw=a.yaw;g.player.pitch=a.pitch;}
  if(p.name==='game_state_change'&&p.reason===3){g.gameMode=Math.round(p.value);g.applyGameMode();}
  if(p.name==='spawn_position')Game.prototype.on_spawn_position.call(g,p);
  if(p.name==='update_attributes')Game.prototype.on_update_attributes.call(g,p);
  if(p.name==='update_health')Game.prototype.on_update_health.call(g,p);
  if(p.name==='entity_metadata')Game.prototype.on_entity_metadata.call(g,p);
  if(p.name==='entity_effect')Game.prototype.on_entity_effect.call(g,p);
  if(p.name==='remove_entity_effect')Game.prototype.on_remove_entity_effect.call(g,p);
  if(p.name==='respawn'){
    const old=g.player;Game.prototype.on_respawn.call(g,p);
    state.position={x:g.player.x,y:g.player.y,z:g.player.z,yaw:g.player.yaw,pitch:g.player.pitch};
    resets.push({flags:p.dataToKeep,replaced:old!==g.player,maxHealth:g.maxHealth,health:g.health,speedBase:g.player.speedAttr.base,effects:g.effects.size,usingItem:g.player.usingItem,motion:[g.player.motionX,g.player.motionY,g.player.motionZ],dimension:g.dimension,pose:g.player.pose});
  }
});
try{
  const{command,until}=client;
  command('/gamemode creative');command('/attribute @s minecraft:generic.max_health base set 40');command('/attribute @s minecraft:generic.movement_speed base set 0.3');command('/effect give @s minecraft:speed 60 1 true');
  await until(()=>g.maxHealth===40&&g.player.speedAttr.base===.3&&g.effects.has(1));
  command('/execute in minecraft:the_nether run tp @s 0.0 80.0 0.0');await until(()=>resets.length>0);
  const transfer=resets[0];assert.equal(transfer.flags,3);assert.equal(transfer.replaced,true);assert.equal(transfer.maxHealth,40);assert.equal(transfer.health,40);assert.equal(transfer.speedBase,.3);assert.equal(transfer.effects,0);assert.deepEqual(transfer.motion,[0,0,0]);assert.equal(transfer.pose,'standing');
  await until(()=>g.player.healthInitialized===true);assert.equal(g.hurtTime,0);
  command('/gamemode survival');command('/kill @s');await until(()=>g.health<=0);client.send(C.clientCommand(0));await until(()=>resets.length>1);
  const death=resets[1];assert.equal(death.flags,0);assert.equal(death.replaced,true);assert.equal(death.maxHealth,20);assert.equal(death.health,20);assert.equal(death.speedBase,Math.fround(.1));assert.equal(death.effects,0);
  const report={version:'1.19.4',serverJarSha1:target.downloads.server.sha1,transfer,death,limitations:'Snapshots are taken immediately during Respawn, before the following authoritative inventory/attribute/effect/position updates. Flags 1 and 2 are additionally covered by wire/game regressions and exact native source.'};
  await writeFile(join(cache,'audit/respawn-server.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{client.close();}
