// Native Java 1.14.4 protocol 498 codec.
import {Reader,Writer} from './buffer.js';
import {readPacketBody404} from './packets-1.13.2.js';
import {BODY_404} from './protocol-1.14.4-reuse.js';
import {readCommandTree} from './command-tree.js';
import {readNbtRoot} from './nbt.js';
import {CLIENTBOUND_498 as IN,SERVERBOUND_498 as OUT} from './protocol-1.14.4-ids.js';
export const PROTOCOL_498=498;

export class Reader498 extends Reader {
  _check(n) { if(!Number.isInteger(n)||n<0)throw new RangeError("Invalid byte length");super._check(n); }
  position() {
    const bits=this.i64();
    return {x:Number(BigInt.asIntN(26,bits>>38n)),y:Number(BigInt.asIntN(12,bits)),z:Number(BigInt.asIntN(26,bits>>12n))};
  }
  particleData(id) {
    if(id===3||id===23)return {blockState:this.varint()};
    if(id===14)return {red:this.f32(),green:this.f32(),blue:this.f32(),scale:this.f32()};
    if(id===32)return {item:this.slot()};
    return {};
  }
  metadata() {
    const read=[r=>r.i8(),r=>r.varint(),r=>r.f32(),r=>r.string(),r=>r.string(),
      r=>r.bool()?r.string():null,r=>r.slot(),r=>r.bool(),r=>({pitch:r.f32(),yaw:r.f32(),roll:r.f32()}),
      r=>r.position(),r=>r.bool()?r.position():null,r=>r.varint(),r=>r.bool()?r.uuid():null,
      r=>r.varint(),r=>r.optionalNbt(),r=>r.particle(),
      r=>({villagerType:r.varint(),villagerProfession:r.varint(),level:r.varint()}),
      r=>{const v=r.varint();return v===0?null:v-1;},r=>r.varint()];
    const meta={};
    for(let index=this.u8();index!==255;index=this.u8()) {
      const type=this.varint();if(!read[type])throw new Error('Unknown 498 metadata type '+type);
      meta[index]=read[type](this);
    }
    return meta;
  }
}
export class Writer498 extends Writer {
  position(x,y,z) {
    for(const [n,bits] of [[x,26],[y,12],[z,26]])if(!Number.isInteger(n)||n<-(2**(bits-1))||n>=2**(bits-1))throw new RangeError('Packed position out of range');
    return this.i64(BigInt.asIntN(64,(BigInt(x)&0x3ffffffn)<<38n|(BigInt(z)&0x3ffffffn)<<12n|BigInt(y)&0xfffn));
  }
}
const array=(r,read)=>{const n=r.varint();if(n<0||n>r.remaining())throw new RangeError('Invalid array length');return Array.from({length:n},()=>read(r));};
const lightArrays=(r,mask)=>{
  if(mask<0||mask>0x3ffff)throw new Error('Invalid light mask');
  const result={};
  for(let section=0;section<18;section++)if(mask&(1<<section)) {
    const n=r.varint();if(n!==2048)throw new Error('Invalid light array length');
    result[section-1]=r.bytesN(n).slice();
  }
  return result;
};
const decoders={
  spawn_entity:r=>({entityId:r.varint(),objectUUID:r.uuid(),type:r.varint(),x:r.f64(),y:r.f64(),z:r.f64(),pitch:r.angle(),yaw:r.angle(),objectData:r.i32(),velocity:{x:r.i16(),y:r.i16(),z:r.i16()}}),
  statistics:r=>({entries:array(r,r=>({categoryId:r.varint(),statisticId:r.varint(),value:r.varint()}))}),
  declare_commands:r=>readCommandTree(r),
  login:r=>({entityId:r.i32(),gameMode:r.u8(),dimension:r.i32(),maxPlayers:r.u8(),levelType:r.string(),viewDistance:r.varint(),reducedDebugInfo:r.bool()}),
  respawn:r=>({dimension:r.i32(),gameMode:r.u8(),levelType:r.string()}),
  difficulty:r=>({difficulty:r.u8(),difficultyLocked:r.bool()}),
  keep_alive:r=>({keepAliveId:r.i64()}),
  kick_disconnect:r=>({reason:r.string()}),
  chat:r=>({message:r.string(),position:r.i8()}),
  custom_payload:r=>({channel:r.string(),data:r.rest()}),
  position:r=>({x:r.f64(),y:r.f64(),z:r.f64(),yaw:r.f32(),pitch:r.f32(),flags:r.u8(),teleportId:r.varint()}),
  spawn_position:r=>({location:r.position()}),
  abilities:r=>({flags:r.u8(),flyingSpeed:r.f32(),walkingSpeed:r.f32()}),
  held_item_slot:r=>({slot:r.i8()}),
  entity_status:r=>({entityId:r.i32(),entityStatus:r.i8()}),
  update_view_position:r=>({chunkX:r.varint(),chunkZ:r.varint()}),
  update_view_distance:r=>({viewDistance:r.varint()}),
  update_time:r=>({age:r.i64(),time:r.i64()}),
  update_health:r=>({health:r.f32(),food:r.varint(),foodSaturation:r.f32()}),
  map_chunk:r=>({x:r.i32(),z:r.i32(),groundUp:r.bool(),bitMap:r.varint(),heightmaps:readNbtRoot(r),chunkData:r.bytesN(r.varint()).slice(),blockEntities:array(r,readNbtRoot)}),
  update_light:r=>{
    const p={chunkX:r.varint(),chunkZ:r.varint(),skyLightMask:r.varint(),blockLightMask:r.varint(),emptySkyLightMask:r.varint(),emptyBlockLightMask:r.varint()};
    if(p.emptySkyLightMask<0||p.emptySkyLightMask>0x3ffff||p.emptyBlockLightMask<0||p.emptyBlockLightMask>0x3ffff)throw new Error('Invalid empty light mask');
    if(p.skyLightMask&p.emptySkyLightMask||p.blockLightMask&p.emptyBlockLightMask)throw new Error('Conflicting light masks');
    p.skyLight=lightArrays(r,p.skyLightMask);p.blockLight=lightArrays(r,p.blockLightMask);return p;
  },
  unload_chunk:r=>({chunkX:r.i32(),chunkZ:r.i32()}),
  block_change:r=>({location:r.position(),state:r.varint()}),
  block_break_animation:r=>({entityId:r.varint(),location:r.position(),destroyStage:r.i8()}),
  acknowledge_player_digging:r=>({location:r.position(),block:r.varint(),status:r.varint(),successful:r.bool()}),
  entity_metadata:r=>({entityId:r.varint(),metadata:r.metadata()}),
  set_slot:r=>({windowId:r.i8(),slot:r.i16(),item:r.slot()}),
  window_items:r=>{const windowId=r.u8(),count=r.i16();if(count<0||count>r.remaining())throw new Error('Invalid slot count');return {windowId,items:Array.from({length:count},()=>r.slot())};},
  open_window:r=>({windowId:r.varint(),inventoryType:r.varint(),windowTitle:r.string()}),
  open_horse_window:r=>({windowId:r.u8(),nbSlots:r.varint(),entityId:r.i32()}),
  open_book:r=>({hand:r.varint()}),
  map:r=>{
    const p={itemDamage:r.varint(),scale:r.i8(),trackingPosition:r.bool(),locked:r.bool(),icons:array(r,r=>({type:r.varint(),x:r.i8(),z:r.i8(),direction:r.u8(),displayName:r.bool()?r.string():null}))};
    p.columns=r.u8();
    if(p.columns){p.rows=r.u8();p.x=r.u8();p.y=r.u8();p.data=r.bytesN(r.varint()).slice();if(p.columns>128||p.rows>128||p.x+p.columns>128||p.y+p.rows>128||p.data.length!==p.columns*p.rows)throw new Error('Invalid map rectangle');}
    return p;
  },
  trade_list:r=>{
    const windowId=r.varint(),count=r.u8(),trades=[];
    for(let i=0;i<count;i++)trades.push({a:r.slot(),out:r.slot(),b:r.bool()?r.slot():null,disabled:r.bool(),uses:r.i32(),max:r.i32(),xp:r.i32(),specialPrice:r.i32(),priceMultiplier:r.f32(),demand:r.i32()});
    return {windowId,trades,villagerLevel:r.varint(),experience:r.varint(),isRegularVillager:r.bool(),canRestock:r.bool()};
  },
  declare_recipes:r=>({recipes:array(r,r=>{
    const type=r.string(),recipeId=r.string(),data={},kind=type.replace(/^minecraft:/,'');
    const ingredient=()=>array(r,r=>r.slot());
    if(kind==='crafting_shaped'){data.width=r.varint();data.height=r.varint();if(data.width<1||data.width>3||data.height<1||data.height>3)throw new Error('Invalid recipe size');data.group=r.string();data.ingredients=Array.from({length:data.width*data.height},ingredient);data.result=r.slot();}
    else if(kind==='crafting_shapeless'){data.group=r.string();data.ingredients=array(r,ingredient);data.result=r.slot();}
    else if(['smelting','blasting','smoking','campfire_cooking'].includes(kind)){data.group=r.string();data.ingredient=ingredient();data.result=r.slot();data.experience=r.f32();data.cookingTime=r.varint();}
    else if(kind==='stonecutting'){data.group=r.string();data.ingredient=ingredient();data.result=r.slot();}
    else if(!kind.startsWith('crafting_special_'))throw new Error('Unsupported recipe serializer '+type);
    return {type,recipeId,data};
  })}),
  tags:r=>{
    const tags={};for(const kind of ['blocks','items','fluids','entities'])tags[kind]=Object.fromEntries(array(r,r=>[r.string(),array(r,r=>r.varint())]));
    return {tags};
  },
};
const names=Object.fromEntries(Object.entries(IN).map(([name,id])=>[id,name]));
export function decodePacket498(bytes) {
  const r=new Reader498(bytes),id=r.varint(),name=names[id];
  const body = decoders[name] ? decoders[name](r) : BODY_404[id] !== undefined ? readPacketBody404(BODY_404[id],r) : null;
  if(!body)return {name:'unsupported',packetName:name||null,id,data:r.rest()};
  const p={name,id,...body};
  if(r.remaining())throw new Error(`Trailing data in 498 ${name}: ${r.remaining()} bytes`);
  return p;
}
const packet=name=>new Writer498().varint(OUT[name]);
export const C498={
  teleportConfirm:id=>packet('teleport_confirm').varint(id).build(),
  keepAlive:id=>packet('keep_alive').i64(id).build(),
  settings:(locale='en_us',distance=4)=>packet('settings').string(locale).i8(distance).varint(0).bool(true).u8(127).varint(1).build(),
  positionLook:(x,y,z,yaw,pitch,onGround)=>packet('position_look').f64(x).f64(y).f64(z).f32(yaw).f32(pitch).bool(onGround).build(),
  blockDig:(status,x,y,z,face)=>packet('block_dig').varint(status).position(x,y,z).i8(face).build(),
  blockPlace:(x,y,z,face,hand,cx,cy,cz,insideBlock=false)=>packet('block_place').varint(hand).position(x,y,z).varint(face).f32(cx).f32(cy).f32(cz).bool(insideBlock).build(),
};
