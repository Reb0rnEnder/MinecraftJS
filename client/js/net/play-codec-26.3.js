// Native 26.3 Play codecs. Every layout here came from javap on the 26.3 client jar,
// never from an older protocol schema. Packets without a verified layout stay undecoded
// and are surfaced as raw bytes instead of being guessed at.
import {PLAY_CLIENTBOUND_26_3} from './protocol-26.3-ids.js';
import {readAnonymousNbt} from './nbt-anonymous.js';
import {readCommands26_3} from './commands-26.3.js';

const NAME_BY_ID=new Map(Object.entries(PLAY_CLIENTBOUND_26_3).map(([name,id])=>[id,name]));

function readItemStack(r){
  const count=r.varint();
  if(count===0)return null;
  throw Error('26.3 item stacks with components are not decoded yet');
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
  // 26.3 move packets take VecDelta (three shorts) plus an onGround flag.
  move_entity_pos(r){return {entityId:r.varint(),dx:r.i16(),dy:r.i16(),dz:r.i16(),onGround:r.bool()};},
  bundle_delimiter(){return {};},
  // 26.3 post effects are a list of identifiers (was a single effect in 1.20.6).
  post_effects(r){
    const count=r.varint();
    const effects=[];
    for(let i=0;i<count;i++)effects.push(r.string());
    return {effects};
  },
  // Empty slots are a zero VarInt count. Item stacks with components are not decoded yet;
  // they throw instead of silently consuming the wrong number of bytes.
  container_set_content(r){
    const containerId=r.varint();
    const stateId=r.varint();
    const count=r.varint();
    const items=[];
    for(let i=0;i<count;i++)items.push(readItemStack(r));
    return {containerId,stateId,items,carried:readItemStack(r)};
  },
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
  const data=decoder(reader);
  return {id,name,decoded:true,data};
}
