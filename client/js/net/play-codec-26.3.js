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
import {SOUND_NAMES_26_3,MOB_EFFECT_NAMES_26_3} from './registry-names-26.3.js';

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
function readNumberFormat26_3(r){
  if(!r.bool())return null;
  const type=r.varint();
  if(type===0)return {type:'blank'};
  if(type===2)return {type:'fixed',value:readAnonymousNbt(r)};
  throw Error('Unsupported 26.3 number format type '+type);
}
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
  // ClientboundBossEventPacket(UUID id, Operation operation): OperationType is a VarInt 0..5
  // (ADD, REMOVE, UPDATE_PROGRESS, UPDATE_NAME, UPDATE_STYLE, UPDATE_PROPERTIES) and each
  // operation reads its own fields (Component name, float progress, colour/overlay enums, flags byte).
  boss_event(r){
    const uuid=r.uuid();
    const action=r.varint();
    const out={uuid,action};
    if(action===0){out.name=readAnonymousNbt(r);out.progress=r.f32();out.color=r.varint();out.overlay=r.varint();out.flags=r.u8();}
    else if(action===2)out.progress=r.f32();
    else if(action===3)out.name=readAnonymousNbt(r);
    else if(action===4){out.color=r.varint();out.overlay=r.varint();}
    else if(action===5)out.flags=r.u8();
    else if(action!==1)throw Error('Unknown 26.3 boss event action '+action);
    return out;
  },
  // ByteBufCodecs.holder writes protocol id + 1 and reserves 0 for an inline value; a sound's
  // inline form is SoundEvent.createFixedRangeEvent(Identifier, float), verified from its codec.
  sound(r){
    const id=r.varint();
    const sound=id===0?{name:r.string(),fixedRange:r.f32()}:{id:id-1,name:SOUND_NAMES_26_3[id-1]};
    if(!sound.name)throw Error('Unknown 26.3 sound event '+(id-1));
    return {sound,source:r.varint(),x:r.i32(),y:r.i32(),z:r.i32(),volume:r.f32(),pitch:r.f32(),seed:r.i64()};
  },
  sound_entity(r){
    const id=r.varint();
    const sound=id===0?{name:r.string(),fixedRange:r.f32()}:{id:id-1,name:SOUND_NAMES_26_3[id-1]};
    if(!sound.name)throw Error('Unknown 26.3 sound event '+(id-1));
    return {sound,source:r.varint(),entityId:r.varint(),volume:r.f32(),pitch:r.f32(),seed:r.i64()};
  },
  // ClientboundStopSoundPacket: flags byte, then the source enum for bit 1 and the sound
  // identifier for bit 2 (either, both or neither).
  stop_sound(r){
    const flags=r.i8();
    return {flags,source:flags&1?r.varint():null,sound:flags&2?r.string():null};
  },
  // ClientboundCooldownPacket(Identifier cooldownGroup, int duration).
  cooldown(r){return {group:r.string(),duration:r.varint()};},
  // Mob effects are holders too: wire id = native mob-effect protocol id + 1.
  update_mob_effect(r){
    const entityId=r.varint(), id=r.varint();
    if(id===0)throw Error('Inline 26.3 mob effects are not implemented');
    const name=MOB_EFFECT_NAMES_26_3[id-1];
    if(!name)throw Error('Unknown 26.3 mob effect '+(id-1));
    return {entityId,effect:{id:id-1,name},amplifier:r.varint(),duration:r.varint(),flags:r.i8()};
  },
  remove_mob_effect(r){
    const entityId=r.varint(), id=r.varint();
    if(id===0)throw Error('Inline 26.3 mob effects are not implemented');
    const name=MOB_EFFECT_NAMES_26_3[id-1];
    if(!name)throw Error('Unknown 26.3 mob effect '+(id-1));
    return {entityId,effect:{id:id-1,name}};
  },
  // ClientboundForgetLevelChunkPacket: ChunkPos is one packed long, x in the low 32 bits and
  // z in the high 32 bits (ChunkPos.pack/unpack).
  forget_level_chunk(r){
    const packed=r.i64();
    return {pos:{x:Number(BigInt.asIntN(32,packed)),z:Number(BigInt.asIntN(32,packed>>32n))}};
  },
  // ClientboundBlockEntityDataPacket(BlockPos, BlockEntityType registry id, CompoundTag).
  block_entity_data(r){return {pos:r.position(),type:r.varint(),tag:readAnonymousNbt(r)};},
  // ClientboundOpenSignEditorPacket: BlockPos + SignTextSlot (0 BACK, 1 FRONT).
  open_sign_editor(r){return {pos:r.position(),slot:r.varint()};},
  // ClientboundSelectAdvancementsTabPacket: a nullable Identifier.
  select_advancements_tab(r){return {tab:r.bool()?r.string():null};},
  // ClientboundRespawnPacket: CommonPlayerSpawnInfo then a dataToKeep byte. GameType is a
  // VarInt and the previous type is OPTIONAL_VAR_INT (0 = none), verified from GameType's codec.
  respawn(r){
    const dimensionType=r.varint(),dimension=r.string(),seed=r.i64();
    const gameMode=r.varint(),previous=r.varint();
    const isDebug=r.bool(),isFlat=r.bool();
    const lastDeath=r.bool()?{dimension:r.string(),position:r.position()}:null;
    const portalCooldown=r.varint(),seaLevel=r.varint();
    return {spawn:{dimensionType,dimension,seed,gameMode,previousGameMode:previous===0?null:previous-1,isDebug,isFlat,lastDeath,portalCooldown,seaLevel},dataToKeep:r.i8()};
  },
  // ClientboundPlayerLookAtPacket: fromAnchor, x/y/z, then the entity id and toAnchor only
  // when the look target is an entity.
  player_look_at(r){
    const fromAnchor=r.varint(),x=r.f64(),y=r.f64(),z=r.f64(),atEntity=r.bool();
    const entity=atEntity?r.varint():0,toAnchor=atEntity?r.varint():0;
    return {fromAnchor,x,y,z,atEntity,entity,toAnchor};
  },
  // ClientboundOpenBookPacket: InteractionHand (VarInt id).
  open_book(r){return {hand:r.varint()};},
  // ClientboundDeleteChatPacket(MessageSignature.Packed): the packed codec reads VarInt id+1 and
  // treats 0 as a full 256-byte MessageSignature (MessageSignature$Packed.read subtracts one and
  // compares with -1), so no signature table is guessed here.
  delete_chat(r){
    const id=r.varint()-1;
    return id===-1?{signatureId:-1,signature:Array.from(r.bytesN(256))}:{signatureId:id,signature:null};
  },
  // NumberFormatTypes: optional dispatch on the number_format_type registry id (0 blank, 1 styled,
  // 2 fixed). blank has no payload and fixed carries one trusted component; the styled form is
  // fail-closed until the Style stream codec is ported.
  set_score(r){
    return {owner:r.string(),objectiveName:r.string(),value:r.varint(),
      display:r.bool()?readAnonymousNbt(r):null,numberFormat:readNumberFormat26_3(r)};
  },
  // ClientboundChunksBiomesPacket: list of (ChunkPos packed long, VarInt-length biome buffer).
  // Each buffer holds one PalettedContainerRO<Holder<Biome>> per section, same wire shape the
  // existing 762 palette reader consumes.
  // ClientboundMapItemDataPacket: map id, scale byte, locked bool, optional decorations
  // (VarInt type, three bytes, optional component NBT), optional MapPatch (four bytes + byte array).
  // ClientboundPlayerChatPacket: global index, sender, index, optional 256-byte signature,
  // packed body (content, timestamp, salt, last-seen signature ids), optional unsigned
  // component, filter mask, then the bound chat type (holder id, name, optional target).
  player_chat(r){
    const globalIndex=r.varint(),sender=r.uuid(),index=r.varint();
    const signature=r.bool()?r.bytesN(256).slice():null;
    const body={
      content:r.string(),timestamp:r.i64(),salt:r.i64(),
      lastSeen:Array.from({length:r.varint()},()=>{
        const id=r.varint()-1;
        return id===-1?r.bytesN(256).slice():id;
      })
    };
    const unsignedContent=r.bool()?readAnonymousNbt(r):null;
    const filterType=r.varint();
    let filterMask=null;
    if(filterType===2)filterMask=r.bytesN(r.varint()).slice();
    else if(filterType!==0&&filterType!==1)throw Error('Invalid 26.3 chat filter');
    const chatType=r.varint(),name=readAnonymousNbt(r),targetName=r.bool()?readAnonymousNbt(r):null;
    return {globalIndex,sender,index,signature,body,unsignedContent,filterType,filterMask,chatType,name,targetName};
  },
  // ClientboundAnimatePacket: VarInt entity id, unsigned byte action.
  swing_animation(r){return {entityId:r.varint(),animation:r.u8()};},
  map_item_data(r){
    const mapId=r.varint(),scale=r.i8(),locked=r.bool();
    let decorations=null;
    if(r.bool()){
      decorations=Array.from({length:r.varint()},()=>({
        type:r.varint(),x:r.i8(),y:r.i8(),rot:r.i8(),name:r.bool()?readAnonymousNbt(r):null
      }));
    }
    let patch=null;
    if(r.bool())patch={startX:r.u8(),startY:r.u8(),width:r.u8(),height:r.u8(),
      colors:r.bytesN(r.varint()).slice()};
    return {mapId,scale,locked,decorations,patch};
  },
  chunks_biomes(r){
    const count=r.varint(),chunks=[];
    for(let i=0;i<count;i++){
      const packed=r.i64(),length=r.varint();
      chunks.push({
        x:Number(BigInt.asIntN(32,packed)),
        z:Number(BigInt.asIntN(32,packed>>32n)),
        data:r.bytesN(length).slice()
      });
    }
    return {chunks};
  },
  set_objective(r){
    const objectiveName=r.string(),method=r.i8();
    if(method!==0&&method!==2)return {objectiveName,method,displayName:null,renderType:0,numberFormat:null};
    return {objectiveName,method,displayName:readAnonymousNbt(r),renderType:r.varint(),numberFormat:readNumberFormat26_3(r)};
  },
  reset_score(r){return {owner:r.string(),objectiveName:r.bool()?r.string():null};},
  // ClientboundSetPlayerTeamPacket: method byte, name, optional Parameters (3 components, two
  // VarInt enums, optional TeamColor, friendly-fire byte), then the player list.
  set_player_team(r){
    const method=r.i8(),name=r.string();
    let parameters=null;
    if(r.bool())parameters={displayName:readAnonymousNbt(r),prefix:readAnonymousNbt(r),suffix:readAnonymousNbt(r),
      visibility:r.varint(),collision:r.varint(),color:r.bool()?r.varint():15,friendlyFire:r.i8()};
    const players=Array.from({length:r.varint()},()=>r.string());
    return {method,name,parameters,players};
  },
  // ClientboundPlayerCombatKillPacket(int playerId, Component message): the death screen message.
  player_combat_kill(r){return {playerId:r.varint(),message:readAnonymousNbt(r)};},
  // ClientboundOpenScreenPacket(int containerId, MenuType<?> type, Component title):
  // ByteBufCodecs.CONTAINER_ID (VarInt), registry(Registries.MENU) (VarInt id; the 26.3 order is
  // identical to protocol 766 by name), and ComponentSerialization.TRUSTED_STREAM_CODEC (network NBT).
  open_screen(r){return {containerId:r.varint(),type:r.varint(),title:readAnonymousNbt(r)};},
  // ClientboundCommandSuggestionsPacket: id/start/length VarInts, then (String text,
  // optional Component tooltip) entries.
  command_suggestions(r){
    const id=r.varint(),start=r.varint(),length=r.varint();
    const matches=Array.from({length:r.varint()},()=>({match:r.string(),tooltip:r.bool()?readAnonymousNbt(r):null}));
    return {id,start,length,matches};
  },
  // ClientboundCustomChatCompletionsPacket: Action enum VarInt (ADD/REMOVE/SET) + strings.
  custom_chat_completions(r){return {action:r.varint(),entries:Array.from({length:r.varint()},()=>r.string())};},
  // ClientboundTagQueryPacket: transaction id and the queried compound as network NBT.
  tag_query(r){return {transactionId:r.varint(),nbt:readAnonymousNbt(r)};},
  // ClientboundSetDisplayObjectivePacket: DisplaySlot id VarInt + objective name.
  set_display_objective(r){return {slot:r.varint(),objective:r.string()};},
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
    return {motd,hasIcon,icon,iconLength:icon?icon.length:0};
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
