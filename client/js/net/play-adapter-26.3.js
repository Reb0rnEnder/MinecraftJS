// Translates decoded 26.3 Play packets into the packet vocabulary and field names the game
// handlers already use. Every mapping is taken from the 1.20.6 game handler's reads, so a
// packet is only adapted when the fields it needs are known; anything else is skipped
// (never guessed) and reported by the adapter gate.
import {HANDLED_PLAY_CLIENTBOUND_26_3} from './game-names-26.3.js';
import {lightTo758} from '../world/light-26.3.js';

const DEG=180/Math.PI;

// Native rotations travel as either a byte (1/256 turn) or a radians float; the entity layer
// stores degrees.
const byteAngle=value=>value*360/256;

// A stepped VecDelta is a list of per-tick deltas; the game's relMove consumes one short triple.
function moveTotals(move){
  if(move.delta.type==='linear')return move.delta;
  const total={dx:0,dy:0,dz:0};
  for(const step of move.delta.steps){total.dx+=step.dx;total.dy+=step.dy;total.dz+=step.dz;}
  return total;
}

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
  move_entity_pos(packet){
    const move=moveTotals(packet);
    return {entityId:packet.entityId,dX:move.dx,dY:move.dy,dZ:move.dz,onGround:packet.onGround};
  },
  move_entity_pos_rot(packet){
    const move=moveTotals(packet);
    return {entityId:packet.entityId,dX:move.dx,dY:move.dy,dZ:move.dz,yaw:byteAngle(packet.yRot),pitch:byteAngle(packet.xRot),onGround:packet.onGround};
  },
  move_entity_rot(packet){
    return {entityId:packet.entityId,yaw:byteAngle(packet.yRot),pitch:byteAngle(packet.xRot),onGround:packet.onGround};
  },
  rotate_head(packet){return {entityId:packet.entityId,headYaw:byteAngle(packet.yHeadRot)};},
  entity_position_sync(packet){
    const end=packet.path.type==='stepped'?packet.path.end:{x:packet.path.end.x,y:packet.path.end.y,z:packet.path.end.z};
    return {entityId:packet.id,x:end.x,y:end.y,z:end.z,yaw:packet.yRot*DEG,pitch:packet.xRot*DEG,onGround:packet.onGround};
  },
  set_entity_motion(packet){
    // The entity layer stores velocity in 1/8000 blocks per tick.
    return {entityId:packet.id,velocity:{x:packet.movement.x*8000,y:packet.movement.y*8000,z:packet.movement.z*8000}};
  },
  remove_entities(packet){return {entityIds:packet.entityIds};},
  light_update(packet){
    return {chunkX:packet.x,chunkZ:packet.z,...lightTo758(packet)};
  },
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
