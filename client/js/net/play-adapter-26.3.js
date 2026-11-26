// Translates decoded 26.3 Play packets into the packet vocabulary and field names the game
// handlers already use. Every mapping is taken from the 1.20.6 game handler's reads, so a
// packet is only adapted when the fields it needs are known; anything else is skipped
// (never guessed) and reported by the adapter gate.
import {HANDLED_PLAY_CLIENTBOUND_26_3} from './game-names-26.3.js';
import {ENTITY_TYPES_26_3} from './entity-data-26.3.js';
import {ITEM_NAMES_26_3} from './items-26.3.js';
import {lightTo758} from '../world/light-26.3.js';
import {componentFromNbt} from './component-nbt-1.20.6.js';
import {EFFECT_766} from '../game/effects-1.20.6.js';

// Reverse the native item table so a 26.3 cooldown group (an item identifier by default) can be
// expressed as the item id the existing CooldownTracker is keyed by.
const ITEM_ID_BY_NAME_26_3=Object.freeze(Object.fromEntries(ITEM_NAMES_26_3.map((name,id)=>[name,id])));
const effectId26_3=effect=>EFFECT_766[effect.name.replace(/^minecraft:/,'')];

const DEG=180/Math.PI;

// Native rotations travel as either a byte (1/256 turn) or a radians float; the entity layer
// stores degrees.
const byteAngle=value=>value*360/256;

// VecDelta shorts are 1/4096 block units (VecDeltaCodec); the game's relMove consumes blocks.
function moveTotals(move){
  if(move.delta.type==='linear')return {dx:move.delta.dx/4096,dy:move.delta.dy/4096,dz:move.delta.dz/4096};
  const total={dx:0,dy:0,dz:0};
  for(const step of move.delta.steps){total.dx+=step.dx;total.dy+=step.dy;total.dz+=step.dz;}
  return {dx:total.dx/4096,dy:total.dy/4096,dz:total.dz/4096};
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

// A decoded 26.3 component patch becomes the slot shape the game already reads: numeric id,
// count, and the effective components the UI needs. Defaults live in the item prototype, so a
// value is only present when the patch added it; nothing is synthesized.
function itemStack(stack){
  if(!stack)return null;
  const components=Object.fromEntries(stack.added.map(component=>[component.name,component.value]));
  return {
    id:stack.itemId,
    itemId:stack.itemId,
    itemKey:ITEM_NAMES_26_3[stack.itemId],
    count:stack.count,
    damage:Number(components.damage||0),
    maxDamage:components.max_damage??null,
    maxStackSize:components.max_stack_size??null,
    customName:components.custom_name??null,
    componentPatch:{added:stack.added,removed:stack.removed},
    components
  };
}

const componentJson=value=>value==null?null:JSON.stringify(componentFromNbt(value));

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
  move_vehicle(packet){return {x:packet.x,y:packet.y,z:packet.z,yaw:packet.yRot};},
  boss_event(packet){
    const out={uuid:packet.uuid,action:packet.action};
    if(packet.action===0){out.title=componentJson(packet.name);out.health=packet.progress;out.color=packet.color;out.dividers=packet.overlay;out.flags=packet.flags;}
    else if(packet.action===2)out.health=packet.progress;
    else if(packet.action===3)out.title=componentJson(packet.name);
    else if(packet.action===4){out.color=packet.color;out.dividers=packet.overlay;}
    else if(packet.action===5)out.flags=packet.flags;
    return out;
  },
  // The sound handler accepts a registry name directly, so the native holder never has to be
  // renumbered; positions travel in eighths of a block, exactly as the 766 handler expects.
  sound(packet){return {soundName:packet.sound.name,x:packet.x/8,y:packet.y/8,z:packet.z/8,volume:packet.volume,pitch:packet.pitch,seed:packet.seed,soundCategory:packet.source};},
  sound_entity(packet){return {soundName:packet.sound.name,entityId:packet.entityId,volume:packet.volume,pitch:packet.pitch,seed:packet.seed,soundCategory:packet.source};},
  stop_sound(packet){return {source:packet.source,sound:packet.sound};},
  cooldown(packet){
    const itemId=ITEM_ID_BY_NAME_26_3[packet.group.replace(/^minecraft:/,'')];
    // A custom cooldown group has no item identity in the current UI; leave it unadapted.
    if(itemId===undefined)return null;
    return {itemId,cooldownTicks:packet.duration};
  },
  update_mob_effect(packet){
    const effectId=effectId26_3(packet.effect);
    if(effectId===undefined)return null;
    const flags=packet.flags;
    return {entityId:packet.entityId,effectId,amplifier:packet.amplifier,duration:packet.duration,flags,
      ambient:!!(flags&1),hideParticles:!(flags&2),showIcon:!!(flags&4),shouldBlend:!!(flags&8)};
  },
  remove_mob_effect(packet){
    const effectId=effectId26_3(packet.effect);
    if(effectId===undefined)return null;
    return {entityId:packet.entityId,effectId};
  },
  forget_level_chunk(packet){return {chunkX:packet.pos.x,chunkZ:packet.pos.z};},
  // The 766 handler applies the block entity NBT directly; the 26.3 type id is only a
  // registry hint and the NBT already carries id/x/y/z.
  block_entity_data(packet){return {location:packet.pos,nbtData:packet.tag};},
  open_sign_editor(packet){return {location:packet.pos,isFrontText:packet.slot===1};},
  select_advancements_tab(packet){return {id:packet.tab};},
  // Respawn keeps the 766 spawn-info vocabulary and resolves the dimension from worldType.
  respawn(packet){
    const {spawn}=packet;
    return {worldType:spawn.dimensionType,worldName:spawn.dimension,hashedSeed:Number(spawn.seed),gameMode:spawn.gameMode,
      previousGameMode:spawn.previousGameMode??-1,isDebug:spawn.isDebug,isFlat:spawn.isFlat,death:spawn.lastDeath,
      portalCooldown:spawn.portalCooldown,seaLevel:spawn.seaLevel,dataToKeep:packet.dataToKeep};
  },
  player_look_at(packet){return {isEntity:packet.atEntity,entityId:packet.entity,x:packet.x,y:packet.y,z:packet.z,fromAnchor:packet.fromAnchor,toAnchor:packet.toAnchor};},
  open_book(packet){return {hand:packet.hand};},
  command_suggestions(packet){return {transactionId:packet.id,start:packet.start,length:packet.length,matches:packet.matches};},
  pong_response(packet){return {id:packet.id};},
  player_combat_enter(packet){return {};},
  player_combat_end(packet){return {duration:packet.duration};},
  set_simulation_distance(packet){return {distance:packet.distance};},
  set_chunk_cache_radius(packet){return {viewDistance:packet.viewDistance};},
  set_camera(packet){return {cameraId:packet.cameraId};},
  block_changed_ack(packet){return {sequenceId:packet.sequenceId};},
  block_destruction(packet){return {entityId:packet.entityId,location:packet.location,destroyStage:packet.destroyStage};},
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
  // 26.3 add_entity carries every entity type (there is no separate living-entity packet),
  // a Vec3.LP movement instead of three velocity shorts, and VarInt object data.
  add_entity(packet){
    const entityTypeName=ENTITY_TYPES_26_3[packet.type];
    if(!entityTypeName)return null;
    return {
      entityId:packet.id,
      objectUUID:packet.uuid,
      type:packet.type,
      wireType:packet.type,
      entityTypeName,
      x:packet.x,y:packet.y,z:packet.z,
      pitch:byteAngle(packet.xRot),
      yaw:byteAngle(packet.yRot),
      headPitch:byteAngle(packet.yHeadRot),
      objectData:packet.data,
      velocity:{x:packet.movement.x*8000,y:packet.movement.y*8000,z:packet.movement.z*8000}
    };
  },
  set_entity_data(packet){return {entityId:packet.entityId,metadata:packet.metadata};},
  set_equipment(packet){
    return {entityId:packet.entityId,equipments:packet.equipments.map(equipment=>({slot:equipment.slot,item:itemStack(equipment.item)}))};
  },
  container_set_content(packet){
    return {windowId:packet.containerId,stateId:packet.stateId,items:packet.items.map(itemStack),carriedItem:itemStack(packet.carried)};
  },
  container_set_slot(packet){
    return {windowId:packet.containerId,stateId:packet.stateId,slot:packet.slot,item:itemStack(packet.item)};
  },
  // 26.3 splits player-inventory writes out of set_slot; the game's handler already treats
  // windowId -2 as "player inventory, direct index".
  set_player_inventory(packet){return {windowId:-2,stateId:0,slot:packet.slot,item:itemStack(packet.item)};},
  container_close(packet){return {windowId:packet.containerId};},
  container_set_data(packet){return {windowId:packet.containerId,property:packet.id,value:packet.value};},
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
  keep_alive(packet){return {keepAliveId:String(packet.keepAliveId)};},
  ping(packet){return {pingId:packet.id32};},
  disconnect(packet){return {reason:packet.reason};},
  animate(packet){return {entityId:packet.entityId,animation:packet.animation};},
  take_item_entity(packet){return {collectedEntityId:packet.itemId,collectorEntityId:packet.playerId,amount:packet.amount};},
  hurt_animation(packet){return {entityId:packet.entityId,yaw:packet.yaw};},
  block_event(packet){return {location:packet.location,byte1:packet.b0,byte2:packet.b1,blockId:packet.blockId};},
  level_event(packet){return {type:packet.type,location:packet.location,data:packet.data,global:packet.globalEvent};},
  // Titles share one handler: action 0/1/2 text, 3 times, 4/5 clear (5 also resets times).
  set_title_text(packet){return {name:'title',action:0,text:componentJson(packet.content)};},
  set_subtitle_text(packet){return {name:'title',action:1,text:componentJson(packet.content)};},
  set_action_bar_text(packet){return {name:'title',action:2,text:componentJson(packet.content)};},
  set_titles_animation(packet){return {name:'title',action:3,fadeIn:packet.fadeIn,stay:packet.stay,fadeOut:packet.fadeOut};},
  clear_titles(packet){return {name:'title',action:packet.resetTimes?5:4};},
  system_chat(packet){return {content:componentJson(packet.content),isActionBar:packet.overlay};},
  disguised_chat(packet){return {message:componentJson(packet.message),networkName:componentJson(packet.name),networkTargetName:componentJson(packet.target)};},
  tab_list(packet){return {header:componentJson(packet.header),footer:componentJson(packet.footer)};},
  set_passengers(packet){return {entityId:packet.entityId,passengers:packet.passengers};},
  set_entity_link(packet){return {entityId:packet.entityId,vehicleId:packet.vehicleId};},
  player_info_remove(packet){return {players:packet.players};},
  set_cursor_item(packet){return {item:itemStack(packet.item)};},
  // Relative teleports need the entity's current position, which the adapter does not have;
  // they stay skipped instead of teleporting to a delta as if it were absolute.
  teleport_entity(packet){
    if(packet.relatives)return null;
    const {position,yRot,xRot}=packet.change;
    // PositionMoveRotation stores rotations in degrees, so they pass through unchanged.
    return {entityId:packet.id,x:position.x,y:position.y,z:position.z,yaw:yRot,pitch:xRot,onGround:packet.onGround};
  }
};

export function adaptPlay26_3(packet,context){
  if(!packet?.decoded)return null;
  const name=HANDLED_PLAY_CLIENTBOUND_26_3[packet.name];
  const adapt=ADAPTERS[packet.name];
  if(!name||!adapt)return null;
  const data=adapt(packet.data,context);
  if(!data)return null;
  return {name,...data};
}

export const ADAPTED_26_3=Object.freeze(Object.keys(ADAPTERS));
export {HANDLED_PLAY_CLIENTBOUND_26_3};
