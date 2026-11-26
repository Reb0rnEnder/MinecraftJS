// Native 26.3 Play codecs. Every layout here came from javap on the 26.3 client jar,
// never from an older protocol schema. Packets without a verified layout stay undecoded
// and are surfaced as raw bytes instead of being guessed at.
import {PLAY_CLIENTBOUND_26_3} from './protocol-26.3-ids.js';
import {readAnonymousNbt} from './nbt-anonymous.js';
import {readCommands26_3} from './commands-26.3.js';
import {decodeLevelChunkWithLight,readLightData} from './chunk-26.3.js';
import {ENTITY_DATA_SERIALIZERS_26_3} from './entity-data-26.3.js';
import {readItemStack26_3} from './item-components-26.3.js';
import {readLpVec3} from './lp-vec3-26.3.js';
import {readParticleOptions26_3,readParticles26_3} from './particles-26.3.js';

const NAME_BY_ID=new Map(Object.entries(PLAY_CLIENTBOUND_26_3).map(([name,id])=>[id,name]));
const readItemStack=readItemStack26_3;

const readVec3=r=>({x:r.f64(),y:r.f64(),z:r.f64()});

function readVecDelta(r,stepCount){
  if(stepCount>0){
    const steps=[];
    for(let i=0;i<stepCount;i++){
      const tickOffset=r.varint();
      steps.push({tickOffset,dx:r.i16(),dy:r.i16(),dz:r.i16()});
    }
    return {type:'stepped',steps};
  }
  return {type:'linear',dx:r.i16(),dy:r.i16(),dz:r.i16()};
}
function readMoveDelta(r){
  const properties=r.varint(),stepCount=properties>>>1;
  return {onGround:!!(properties&1),stepCount,delta:readVecDelta(r,stepCount)};
}

// 26.3 set_entity_data: VarInt entity id, then (index byte, serializer VarInt, value) until
// 0xff. The serializer ids are the native EntityDataSerializers registration order; values
// follow each serializer's StreamCodec. Serializers whose codec is not implemented yet
// (game profiles, the vibration particle's PositionSource) throw so the frame is skipped
// instead of corrupting the stream.
function readEntityDataValue(r,type){
  const serializer=ENTITY_DATA_SERIALIZERS_26_3[type];
  switch(serializer){
    case 'BYTE':return r.i8();
    case 'INT':return r.varint();
    case 'LONG':return String(r.varlong());
    case 'FLOAT':return r.f32();
    case 'STRING':return r.string();
    case 'COMPONENT':return readAnonymousNbt(r);
    case 'OPTIONAL_COMPONENT':return r.bool()?readAnonymousNbt(r):null;
    case 'ITEM_STACK':return readItemStack(r);
    case 'BOOLEAN':return r.bool();
    case 'ROTATIONS':return {pitch:r.f32(),yaw:r.f32(),roll:r.f32()};
    case 'BLOCK_POS':return r.position();
    case 'OPTIONAL_BLOCK_POS':return r.bool()?r.position():null;
    case 'DIRECTION':return r.varint();
    case 'OPTIONAL_LIVING_ENTITY_REFERENCE':return r.bool()?r.uuid():null;
    case 'PARTICLE':return readParticleOptions26_3(r);
    case 'PARTICLES':return readParticles26_3(r);
    case 'BLOCK_STATE':return r.varint();
    case 'OPTIONAL_BLOCK_STATE':{
      // EntityDataSerializers$2 writes Block.getId, with 0 meaning absent.
      const id=r.varint();
      return id===0?null:id;
    }
    case 'VILLAGER_DATA':return {villagerType:r.varint(),villagerProfession:r.varint(),level:r.varint()};
    case 'OPTIONAL_UNSIGNED_INT':{
      // EntityDataSerializers$3 stores value+1, 0 meaning absent.
      const value=r.varint();
      return value===0?null:value-1;
    }
    case 'POSE':return r.varint();
    case 'CAT_VARIANT':case 'CAT_SOUND_VARIANT':case 'COW_VARIANT':case 'COW_SOUND_VARIANT':
    case 'WOLF_VARIANT':case 'WOLF_SOUND_VARIANT':case 'FROG_VARIANT':case 'PIG_VARIANT':
    case 'PIG_SOUND_VARIANT':case 'CHICKEN_VARIANT':case 'CHICKEN_SOUND_VARIANT':
    case 'ZOMBIE_NAUTILUS_VARIANT':case 'PAINTING_VARIANT':case 'SNIFFER_STATE':
    case 'ARMADILLO_STATE':case 'COPPER_GOLEM_STATE':case 'WEATHERING_COPPER_STATE':
    case 'HUMANOID_ARM':case 'DYE_COLOR':return r.varint();
    case 'OPTIONAL_GLOBAL_POS':return r.bool()?{dimension:r.string(),position:r.position()}:null;
    case 'VECTOR3':return {x:r.f32(),y:r.f32(),z:r.f32()};
    case 'QUATERNION':return {x:r.f32(),y:r.f32(),z:r.f32(),w:r.f32()};
  }
  throw Error('Unsupported 26.3 entity data serializer '+type+(serializer?' '+serializer:''));
}
function readEntityData(r){
  const metadata={};
  for(;;){
    const index=r.u8();
    if(index===0xff)return metadata;
    metadata[index]=readEntityDataValue(r,r.varint());
  }
}

function bitmask(value){const bits=[];for(let i=0;i<32;i++)if(value&(1<<i))bits.push(i);return bits;}
// FriendlyByteBuf.writeFixedBitSet writes ceil(size/8) bytes, least significant bit first.
function fixedBitSet(r,size){const bytes=r.bytesN(Math.ceil(size/8));const bits=[];for(let i=0;i<size;i++)if(bytes[i>>3]&(1<<(i&7)))bits.push(i);return bits;}

// 26.3 field lists, verified with javap:
// ChangeDifficultyPacket(Difficulty, boolean locked), Difficulty codec is one byte.
// PlayerAbilitiesPacket(boolean invulnerable, isFlying, canFly, instabuild, float flyingSpeed, float walkingSpeed), flags byte then two floats.
// SetHeldSlotPacket(int slot) -> VarInt.
// EntityEventPacket(int entityId, byte eventId).
// ServerDataPacket(Component motd, Optional<byte[]> iconBytes): component as unnamed network NBT
// (NbtIo.writeAnyTag writes only the tag id, no root name, verified with javap), then icon bool + VarInt length bytes.
// PlayerInfoUpdatePacket(EnumSet<Action> actions as a fixed 1-byte bitset over 8 actions, List<Entry>).
// PlayerPositionPacket(int id, PositionMoveRotation, Set<Relative>): VarInt, pos(3 doubles), delta(3 doubles), yRot f32, xRot f32, relatives int bitmask.
// RecipeBookSettingsPacket(RecipeBookSettings): crafting, furnace, blastFurnace, smoker, each (open bool, filtering bool).
export const PLAY_DECODERS_26_3=Object.freeze({
  // ClientboundLoginPacket: playerId, hardcore, level set, maxPlayers, chunkRadius,
  // simulationDistance, reducedDebugInfo, showDeathScreen, doLimitedCrafting, spawn info, onlineMode, enforcesSecureChat.
  // CommonPlayerSpawnInfo appends seaLevel after portalCooldown in 26.3.
  login(r){
    const playerId=r.i32(),hardcore=r.bool();
    const levels=Array.from({length:r.varint()},()=>r.string());
    const maxPlayers=r.varint(),chunkRadius=r.varint(),simulationDistance=r.varint();
    const reducedDebugInfo=r.bool(),showDeathScreen=r.bool(),doLimitedCrafting=r.bool();
    const dimensionType=r.varint(),dimension=r.string(),seed=String(r.i64());
    const gameMode=r.i8(),previousGameMode=r.i8();
    const isDebug=r.bool(),isFlat=r.bool();
    const lastDeath=r.bool()?{dimension:r.string(),position:r.position()}:null;
    const portalCooldown=r.varint(),seaLevel=r.varint();
    const onlineMode=r.bool(),enforcesSecureChat=r.bool();
    return {
      playerId,hardcore,levels,maxPlayers,chunkRadius,simulationDistance,
      reducedDebugInfo,showDeathScreen,doLimitedCrafting,
      spawn:{dimensionType,dimension,seed,gameMode,previousGameMode,isDebug,isFlat,lastDeath,portalCooldown,seaLevel},
      onlineMode,enforcesSecureChat
    };
  },
  level_chunk_with_light(r){return decodeLevelChunkWithLight(r);},
  // ClientboundLevelParticlesPacket: ParticleOptions, overrideLimiter, alwaysShow, position
  // (3 doubles), spread (3 floats), per-axis max speeds (3 floats), count VarInt and the 26.3
  // RandomizationType (VarInt enum: default, alternative, alternative_with_speed).
  level_particles(r){
    const particle=readParticleOptions26_3(r);
    const overrideLimiter=r.bool(),alwaysShow=r.bool();
    const x=r.f64(),y=r.f64(),z=r.f64();
    const offsetX=r.f32(),offsetY=r.f32(),offsetZ=r.f32();
    const xMaxSpeed=r.f32(),yMaxSpeed=r.f32(),zMaxSpeed=r.f32();
    const count=r.varint(),randomization=r.varint();
    const data={};
    if(particle.color!==undefined)data.colorArgb=particle.color;
    if(particle.fromColor!==undefined)data.fromColor=particle.fromColor,data.toColor=particle.toColor,data.scale=particle.scale;
    if(particle.blockState!==undefined)data.blockState=particle.blockState;
    if(particle.item)data.itemId=particle.item.itemId;
    return {
      particle,particleName:particle.name,longDistance:overrideLimiter,alwaysShow,
      x,y,z,offsetX,offsetY,offsetZ,xMaxSpeed,yMaxSpeed,zMaxSpeed,
      particleData:xMaxSpeed,particles:count,count,randomization,data
    };
  },
  // ClientboundAnimatePacket(int id, int action): VarInt id, unsigned byte action.
  animate(r){return {entityId:r.varint(),animation:r.u8()};},
  // ClientboundTakeItemEntityPacket(int itemId, int playerId, int amount): three VarInts.
  take_item_entity(r){return {itemId:r.varint(),playerId:r.varint(),amount:r.varint()};},
  // ClientboundHurtAnimationPacket(int id, float yaw).
  hurt_animation(r){return {entityId:r.varint(),yaw:r.f32()};},
  // ClientboundBlockEventPacket(BlockPos pos, int b0, int b1, Block block): position, two
  // unsigned bytes, then the block registry id (ByteBufCodecs.registry).
  block_event(r){return {location:r.position(),b0:r.u8(),b1:r.u8(),blockId:r.varint()};},
  // ClientboundLevelEventPacket(int type, BlockPos pos, int data, boolean globalEvent).
  level_event(r){return {type:r.i32(),location:r.position(),data:r.i32(),globalEvent:r.bool()};},
  // ClientboundPlayerRotationPacket(float yRot, boolean relativeY, float xRot, boolean relativeX).
  player_rotation(r){return {yRot:r.f32(),relativeY:r.bool(),xRot:r.f32(),relativeX:r.bool()};},
  // ClientboundSetTitlesAnimationPacket(int fadeIn, int stay, int fadeOut): three fixed ints.
  set_titles_animation(r){return {fadeIn:r.i32(),stay:r.i32(),fadeOut:r.i32()};},
  // ClientboundClearTitlesPacket(boolean resetTimes).
  clear_titles(r){return {resetTimes:r.bool()};},
  // Component fields use ComponentSerialization.TRUSTED_STREAM_CODEC, which writes the unnamed
  // network NBT tag (NbtIo.writeAnyTag) the anonymous reader consumes.
  system_chat(r){return {content:readAnonymousNbt(r),overlay:r.bool()};},
  // ClientboundDisguisedChatPacket(Component message, ChatType.Bound chatType): the bound chat
  // type is a ChatType holder (VarInt; 0 means an inline datapack type, which is not implemented),
  // a name component and an optional target component. Servers send /say and similar messages here.
  disguised_chat(r){
    const message=readAnonymousNbt(r);
    const chatTypeId=r.varint();
    if(chatTypeId===0)throw Error('Inline 26.3 chat type is not implemented');
    const name=readAnonymousNbt(r);
    const target=r.bool()?readAnonymousNbt(r):null;
    return {message,chatTypeId,name,target};
  },
  tab_list(r){return {header:readAnonymousNbt(r),footer:readAnonymousNbt(r)};},
  set_title_text(r){return {content:readAnonymousNbt(r)};},
  set_subtitle_text(r){return {content:readAnonymousNbt(r)};},
  set_action_bar_text(r){return {content:readAnonymousNbt(r)};},
  // ClientboundSetPassengersPacket(int vehicle, int[] passengers): VarInt, VarInt count, ids.
  set_passengers(r){return {entityId:r.varint(),passengers:Array.from({length:r.varint()},()=>r.varint())};},
  // ClientboundSetEntityLinkPacket(int sourceId, int destId).
  set_entity_link(r){return {entityId:r.varint(),vehicleId:r.varint()};},
  // ClientboundPlayerInfoRemovePacket(List<UUID>): VarInt count then UUIDs.
  player_info_remove(r){return {players:Array.from({length:r.varint()},()=>r.uuid())};},
  // ClientboundSetCursorItemPacket(ItemStack contents).
  set_cursor_item(r){return {item:readItemStack(r)};},
  // ClientboundMoveVehiclePacket(PositionAndRotation): position Vec3 (3 doubles) + yRot/xRot floats.
  move_vehicle(r){return {x:r.f64(),y:r.f64(),z:r.f64(),yRot:r.f32(),xRot:r.f32()};},
  // ClientboundPongResponsePacket(long time): the original send timestamp as an i64.
  pong_response(r){return {id:r.i64()};},
  // ClientboundPlayerCombatEnterPacket(): no payload.
  player_combat_enter(){return {};},
  // ClientboundPlayerCombatEndPacket(int duration): VarInt combat duration.
  player_combat_end(r){return {duration:r.varint()};},
  // ClientboundSetSimulationDistancePacket(int simulationDistance): VarInt.
  set_simulation_distance(r){return {distance:r.varint()};},
  // ClientboundSetChunkCacheRadiusPacket(int radius): VarInt.
  set_chunk_cache_radius(r){return {viewDistance:r.varint()};},
  // ClientboundSetCameraPacket(int cameraId): VarInt entity id.
  set_camera(r){return {cameraId:r.varint()};},
  // ClientboundBlockChangedAckPacket(int sequence): VarInt sequence.
  block_changed_ack(r){return {sequenceId:r.varint()};},
  // ClientboundBlockDestructionPacket(int id, BlockPos pos, int progress).
  block_destruction(r){return {entityId:r.varint(),location:r.position(),destroyStage:r.u8()};},
  // ClientboundTeleportEntityPacket(int id, PositionMoveRotation, Set<Relative>, boolean):
  // PositionMoveRotation is position Vec3, delta Vec3, yRot f32, xRot f32; Relative.SET is a
  // VarInt bitmask (ByteBufCodecs.INT mapped over the enum ordinals).
  teleport_entity(r){
    const id=r.varint();
    const position={x:r.f64(),y:r.f64(),z:r.f64()};
    const delta={x:r.f64(),y:r.f64(),z:r.f64()};
    const yRot=r.f32(),xRot=r.f32();
    const relatives=r.varint();
    return {id,change:{position,delta,yRot,xRot},relatives,onGround:r.bool()};
  },
  // Shared common packets in the Play state.
  disconnect(r){return {reason:readAnonymousNbt(r)};},
  keep_alive(r){return {keepAliveId:String(r.i64())};},
  ping(r){return {id32:r.i32()};},
  cookie_request(r){return {key:r.string()};},
  store_cookie(r){const key=r.string();return {key,value:r.bytesN(r.varint()).slice()};},
  transfer(r){return {host:r.string(),port:r.varint()};},
  custom_payload(r){const channel=r.string();return {channel,data:r.rest()};},
  resource_pack_pop(r){return {uuid:r.bool()?r.uuid():null};},
  resource_pack_push(r){
    const uuid=r.uuid(),url=r.string(),hash=r.string(),forced=r.bool();
    return {uuid,url,hash,forced,prompt:r.bool()?readAnonymousNbt(r):null};
  },
  start_configuration(){return {};},
  // ClientboundAddEntityPacket(int id, UUID, EntityType registry id, double x/y/z, Vec3.LP movement,
  // byte xRot/yRot/yHeadRot, VarInt data).
  add_entity(r){
    const id=r.varint(),uuid=r.uuid(),type=r.varint();
    const x=r.f64(),y=r.f64(),z=r.f64(),movement=readLpVec3(r);
    return {id,uuid,type,x,y,z,movement,xRot:r.i8(),yRot:r.i8(),yHeadRot:r.i8(),data:r.varint()};
  },
  // ClientboundSetEntityDataPacket(int id, List<DataValue> packedItems).
  set_entity_data(r){const entityId=r.varint();return {entityId,metadata:readEntityData(r)};},
  // ClientboundSetEquipmentPacket(int entity, List<Pair<EquipmentSlot, ItemStack>>): each
  // slot is one byte whose high bit continues the list, low seven bits are the enum ordinal.
  set_equipment(r){
    const entityId=r.varint(),equipments=[];
    for(;;){
      const slot=r.u8();
      equipments.push({slot:slot&0x7f,item:readItemStack(r)});
      if(!(slot&0x80))break;
    }
    return {entityId,equipments};
  },
  // ClientboundSetEntityMotionPacket(int id, Vec3.LP movement).
  set_entity_motion(r){return {id:r.varint(),movement:readLpVec3(r)};},
  // ClientboundRemoveEntitiesPacket(IntList): VarInt count then VarInt entity ids.
  remove_entities(r){return {entityIds:Array.from({length:r.varint()},()=>r.varint())};},
  // ClientboundLightUpdatePacket(VarInt x, VarInt z, ClientboundLightUpdatePacketData).
  light_update(r){const x=r.varint(),z=r.varint();return {x,z,...readLightData(r)};},
  // ClientboundEntityPositionSyncPacket(int id, PositionPath, float yRot, xRot, boolean onGround).
  // PositionPath dispatches on Type.STREAM_CODEC: LINEAR(0) is one Vec3; STEPPED(1) is a VarInt
  // step count then (Vec3 position, VarInt tickOffset) per step. The native frame is 39 bytes for
  // one step, which proves the stepped path does not also carry an end position.
  entity_position_sync(r){
    const id=r.varint(),type=r.varint();
    let path;
    if(type===1){
      const steps=Array.from({length:r.varint()},()=>({position:readVec3(r),tickOffset:r.varint()}));
      path={type:'stepped',steps,end:steps.length?steps[steps.length-1].position:{x:0,y:0,z:0}};
    }else{
      path={type:'linear',end:readVec3(r)};
    }
    return {id,path,yRot:r.f32(),xRot:r.f32(),onGround:r.bool()};
  },
  change_difficulty(r){return {difficulty:r.u8(),locked:r.bool()};},
  player_abilities(r){
    const flags=r.u8();
    return {
      invulnerable:!!(flags&1),flying:!!(flags&2),canFly:!!(flags&4),instabuild:!!(flags&8),
      flyingSpeed:r.f32(),walkingSpeed:r.f32()
    };
  },
  set_held_slot(r){return {slot:r.varint()};},
  entity_event(r){return {entityId:r.i32(),eventId:r.u8()};},
  server_data(r){
    const motd=readAnonymousNbt(r);
    const hasIcon=r.bool();
    let icon=null;
    if(hasIcon){const length=r.varint();icon=r.bytesN(length).slice();}
    return {motd,hasIcon,iconLength:icon?icon.length:0};
  },
  player_info_update(r){
    const actions=fixedBitSet(r,8);
    const count=r.varint();
    const entries=[];
    const has=index=>actions.includes(index);
    for(let i=0;i<count;i++){
      const entry={uuid:r.uuid()};
      if(has(0)){
        entry.name=r.string();
        const propertyCount=r.varint();
        entry.properties=[];
        for(let j=0;j<propertyCount;j++){
          const name=r.string(),value=r.string();
          entry.properties.push({name,value,signature:r.bool()?r.string():null});
        }
      }
      if(has(1)){
        entry.chatSession=r.bool()?{sessionId:r.uuid(),expiresAt:String(r.i64()),key:r.bytesN(r.varint()).slice(),signature:r.bytesN(r.varint()).slice()}:null;
      }
      if(has(2))entry.gameMode=r.varint();
      if(has(3))entry.listed=r.bool();
      if(has(4))entry.latency=r.varint();
      if(has(5))entry.displayName=r.bool()?readAnonymousNbt(r):null;
      if(has(6))entry.listOrder=r.varint();
      if(has(7))entry.showHat=r.bool();
      entries.push(entry);
    }
    return {actions,count,entries};
  },
  player_position(r){
    return {
      teleportId:r.varint(),
      position:{x:r.f64(),y:r.f64(),z:r.f64()},
      delta:{x:r.f64(),y:r.f64(),z:r.f64()},
      yRot:r.f32(),xRot:r.f32(),
      relatives:bitmask(r.i32())
    };
  },
  recipe_book_settings(r){
    const read=()=>({open:r.bool(),filtering:r.bool()});
    return {crafting:read(),furnace:read(),blastFurnace:read(),smoker:read()};
  },
  // Brigadier: 26.3 sends argument types as registry ids plus per-type properties, not names.
  commands(r){return readCommands26_3(r);},
  // 26.3 set_time carries a world clock map: VarInt count, then (clock holder id, {totalTicks VarLong, partialTick f32, rate f32}).
  set_time(r){
    const gameTime=String(r.i64());
    const count=r.varint();
    const clocks={};
    for(let i=0;i<count;i++){
      const clock=r.varint();
      clocks[clock]={totalTicks:String(r.varlong()),partialTick:r.f32(),rate:r.f32()};
    }
    return {gameTime,clocks};
  },
  game_event(r){return {event:r.u8(),param:r.f32()};},
  set_chunk_cache_center(r){return {x:r.varint(),z:r.varint()};},
  chunk_batch_start(){return {};},
  chunk_batch_finished(r){return {batchSize:r.varint()};},
  set_default_spawn_position(r){
    return {dimension:r.string(),position:r.position(),yaw:r.f32(),pitch:r.f32()};
  },
  set_health(r){return {health:r.f32(),food:r.varint(),saturation:r.f32()};},
  set_experience(r){return {progress:r.f32(),level:r.varint(),total:r.varint()};},
  initialize_border(r){
    return {centerX:r.f64(),centerZ:r.f64(),oldSize:r.f64(),newSize:r.f64(),lerpTime:String(r.varlong()),maxSize:r.varint(),warningBlocks:r.varint(),warningTime:r.varint()};
  },
  block_update(r){return {position:r.position(),state:r.varint()};},
  // AttributeSnapshot: attribute holder id VarInt, base double, modifier list (Identifier, amount double, operation id).
  update_attributes(r){
    const entityId=r.varint();
    const count=r.varint();
    const attributes=[];
    for(let i=0;i<count;i++){
      const attribute=r.varint();
      const base=r.f64();
      const modifierCount=r.varint();
      const modifiers=[];
      for(let j=0;j<modifierCount;j++)modifiers.push({id:r.string(),amount:r.f64(),operation:r.varint()});
      attributes.push({attribute,base,modifiers});
    }
    return {entityId,attributes};
  },
  ticking_state(r){return {tickRate:r.f32(),frozen:r.bool()};},
  ticking_step(r){return {tickSteps:r.varint()};},
  rotate_head(r){return {entityId:r.varint(),yHeadRot:r.i8()};},
  // 26.3 entity movement packs onGround and VecDelta.stepCount into one VarInt
  // ((stepCount<<1)|onGround). stepCount 0 is a Linear 3-short delta; a positive count is
  // that many Stepped entries of (VarInt tickOffset, short dx, dy, dz).
  move_entity_pos(r){const entityId=r.varint();return {entityId,...readMoveDelta(r)};},
  move_entity_pos_rot(r){
    const entityId=r.varint(),move=readMoveDelta(r);
    return {entityId,...move,yRot:r.i8(),xRot:r.i8()};
  },
  move_entity_rot(r){return {entityId:r.varint(),onGround:r.bool(),yRot:r.i8(),xRot:r.i8()};},
  bundle_delimiter(){return {};},
  // 26.3 post effects are a list of identifiers (was a single effect in 1.20.6).
  post_effects(r){
    const count=r.varint();
    const effects=[];
    for(let i=0;i<count;i++)effects.push(r.string());
    return {effects};
  },
  // Empty slots are a zero VarInt count; a non-empty stack is a 26.3 component patch.
  container_set_content(r){
    const containerId=r.varint();
    const stateId=r.varint();
    const count=r.varint();
    const items=[];
    for(let i=0;i<count;i++)items.push(readItemStack(r));
    return {containerId,stateId,items,carried:readItemStack(r)};
  },
  // ClientboundContainerSetSlotPacket: writeContainerId (VarInt), VarInt stateId, short slot,
  // ItemStack.OPTIONAL_STREAM_CODEC. Verified with javap on writeContainerId.
  container_set_slot(r){
    return {containerId:r.varint(),stateId:r.varint(),slot:r.i16(),item:readItemStack(r)};
  },
  // ClientboundSetPlayerInventoryPacket(int slot, ItemStack): VarInt slot, VarInt item id,
  // then the component patch (a VarInt count of 0 is the empty stack).
  set_player_inventory(r){return {slot:r.varint(),item:readItemStack(r)};},
  // ClientboundContainerClosePacket(int containerId): VarInt id.
  container_close(r){return {containerId:r.varint()};},
  // ClientboundContainerSetDataPacket(int containerId, int id, int value): VarInt, short, short.
  container_set_data(r){return {containerId:r.varint(),id:r.i16(),value:r.i16()};},
  // SectionBlocksUpdate packs each change as VarLong(stateId << 12 | section-local position).
  section_blocks_update(r){
    const section=r.i64();
    const count=r.varint();
    const changes=[];
    for(let i=0;i<count;i++){
      const packed=r.varlong();
      changes.push({position:Number(packed&0xfffn),state:Number(packed>>12n)});
    }
    return {section:String(section),changes};
  }
});

export const PLAY_DECODED_26_3=Object.freeze(Object.keys(PLAY_DECODERS_26_3));

export function decodePlayPacket(reader){
  const id=reader.varint();
  const name=NAME_BY_ID.get(id)||null;
  const decoder=name?PLAY_DECODERS_26_3[name]:undefined;
  if(!decoder)return {id,name,decoded:false,raw:reader.bytes.subarray(reader.offset)};
  let data;
  try{data=decoder(reader);}catch(error){error.message='['+name+'#'+id+'] '+error.message;throw error;}
  return {id,name,decoded:true,data};
}
