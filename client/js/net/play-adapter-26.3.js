// Translates decoded 26.3 Play packets into the packet vocabulary and field names the game
// handlers already use. Every mapping is taken from the 1.20.6 game handler's reads, so a
// packet is only adapted when the fields it needs are known; anything else is skipped
// (never guessed) and reported by the adapter gate.
import {HANDLED_PLAY_CLIENTBOUND_26_3} from './game-names-26.3.js';

const DEG=180/Math.PI;

function positionFlags(relatives){
  let flags=0;
  if(relatives&1)flags|=0x01;
  if(relatives&2)flags|=0x02;
  if(relatives&4)flags|=0x04;
  if(relatives&8)flags|=0x08;
  if(relatives&16)flags|=0x10;
  return flags;
}

// The overworld clock is clock holder 0 (minecraft:overworld); set_time always carries it.
function worldClock(clocks){
  return clocks[0]??Object.values(clocks)[0]??null;
}

const ADAPTERS={
  login(login,context){
    if(!context)throw Error('Play Login needs the 26.3 join context');
    const spawn=login.spawn;
    return {
      entityId:login.playerId,
      isHardcore:login.hardcore,
      dimension:spawn.dimension,
      worldName:spawn.dimension,
      hashedSeed:spawn.seed,
      gameMode:spawn.gameMode,
      previousGameMode:spawn.previousGameMode,
      isDebug:spawn.isDebug,
      isFlat:spawn.isFlat,
      death:spawn.lastDeath,
      portalCooldown:spawn.portalCooldown,
      maxPlayers:login.maxPlayers,
      viewDistance:login.chunkRadius,
      simulationDistance:login.simulationDistance,
      reducedDebugInfo:login.reducedDebugInfo,
      enableRespawnScreen:login.showDeathScreen,
      doLimitedCrafting:login.doLimitedCrafting,
      enforcesSecureChat:login.enforcesSecureChat,
      onlineMode:login.onlineMode,
      levelType:'default',
      dimensionData:context.dimensionData,
      blockStateRegistrySize:context.blockStateRegistrySize,
      airStates:context.airStates,
      biomeRegistrySize:context.biomeRegistrySize,
      biomeEntries:context.biomeEntries,
      enabledFeatures:context.enabledFeatures,
      commandTags:context.commandTags,
      registryTags:context.registryTags
    };
  },
  level_chunk_with_light(chunk){
    return {chunkX:chunk.x,chunkZ:chunk.z,heightmaps:chunk.heightmaps,blockEntities:chunk.blockEntities,sections:chunk.sections,light:chunk.light,x:chunk.x,z:chunk.z};
  },
  player_position(packet){
    const relatives=packet.relatives;
    return {
      teleportId:packet.teleportId,
      x:relatives&1?packet.delta.x:packet.position.x,
      y:relatives&2?packet.delta.y:packet.position.y,
      z:relatives&4?packet.delta.z:packet.position.z,
      yaw:packet.yRot*DEG,
      pitch:packet.xRot*DEG,
      flags:positionFlags(relatives),
      dismountVehicle:false
    };
  },
  set_time(packet){
    const clock=worldClock(packet.clocks);
    return {age:packet.gameTime,time:clock?clock.totalTicks:packet.gameTime};
  },
  game_event(packet){return {reason:packet.event,value:packet.param};},
  player_abilities(packet){
    return {
      flags:(packet.invulnerable?1:0)|(packet.flying?2:0)|(packet.canFly?4:0)|(packet.instabuild?8:0),
      flyingSpeed:packet.flyingSpeed,
      walkingSpeed:packet.walkingSpeed
    };
  },
  set_held_slot(packet){return {slot:packet.slot};},
  set_health(packet){return {health:packet.health,food:packet.food,saturation:packet.saturation};},
  set_experience(packet){return {progress:packet.progress,level:packet.level,total:packet.total};},
  set_default_spawn_position(packet){
    return {location:packet.position,angle:packet.yaw*DEG};
  },
  block_update(packet){return {location:packet.position,state:packet.state};},
  chunk_batch_start(){return {};},
  chunk_batch_finished(packet){return {batchSize:packet.batchSize};},
  custom_payload(packet){return {channel:packet.channel,data:packet.data};},
  disconnect(packet){return {reason:packet.reason};}
};

export function adaptPlay26_3(packet,context){
  if(!packet?.decoded)return null;
  const name=HANDLED_PLAY_CLIENTBOUND_26_3[packet.name];
  const adapt=ADAPTERS[packet.name];
  if(!name||!adapt)return null;
  return {name,...adapt(packet.data,context)};
}

export const ADAPTED_26_3=Object.freeze(Object.keys(ADAPTERS));
export {HANDLED_PLAY_CLIENTBOUND_26_3};
