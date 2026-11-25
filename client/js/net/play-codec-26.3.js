// Native 26.3 Play codecs. Every layout here came from javap on the 26.3 client jar,
// never from an older protocol schema. Packets without a verified layout stay undecoded
// and are surfaced as raw bytes instead of being guessed at.
import {PLAY_CLIENTBOUND_26_3} from './protocol-26.3-ids.js';
import {readAnonymousNbt} from './nbt-anonymous.js';
import {readCommands26_3} from './commands-26.3.js';

const NAME_BY_ID=new Map(Object.entries(PLAY_CLIENTBOUND_26_3).map(([name,id])=>[id,name]));

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
    // Entries carry one field per set action; with no set actions only the UUID is read.
    for(let i=0;i<count;i++)entries.push({uuid:r.uuid()});
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
  commands(r){return readCommands26_3(r);}
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
