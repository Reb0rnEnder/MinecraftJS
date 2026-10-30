import { bitsetValue, compactMask, maskHas, maskHighest } from './bitset.js';
// Native Java 1.17.1 protocol 756. Reuse bodies only when the pinned schemas agree.
import {Reader754,Writer754,decodePacket754,C754} from './protocol-1.16.5.js';
import {CLIENTBOUND_754 as OLD_IN,SERVERBOUND_754 as OLD_OUT} from './protocol-1.16.5-ids.js';
import {CLIENTBOUND_756 as IN,SERVERBOUND_756 as OUT} from './protocol-1.17.1-ids.js';
import {readNbtRoot} from './nbt.js';
import {readRecipes} from './recipes.js';
export const PROTOCOL_756=756;
const list=(r,read,max=1048576)=>{const count=r.varint();if(count<0||count>max||count>r.remaining())throw Error('Invalid 756 array length');return Array.from({length:count},()=>read());};
export class Reader756 extends Reader754 {
  particleData(id){
    if(id===4||id===25)return{blockState:this.varint()};
    if(id===15||id===16){const data={red:this.f32(),green:this.f32(),blue:this.f32(),scale:this.f32()};if(id===16)Object.assign(data,{toRed:this.f32(),toGreen:this.f32(),toBlue:this.f32()});return data;}
    if(id===36)return{item:this.slot()};
    if(id===37)return readVibration(this,true);
    return {};
  }
}
export class Writer756 extends Writer754 {}
function readVibration(r,particle=false){
  const origin=r.position(),positionType=r.string(),kind=positionType.replace(/^minecraft:/,'');
  let destination;if(kind==='block')destination=r.position();else if(kind==='entity'||kind==='entityId')destination=r.varint();else throw Error('Unknown vibration destination '+positionType);
  return{origin,positionType,destination,ticks:r.varint(),particle};
}
const masks=r=>list(r,()=>r.i64(),4);
const numericMask=words=>compactMask(bitsetValue(words));
const attributes=r=>({entityId:r.varint(),properties:list(r,()=>({key:r.string().replace(/^minecraft:/,''),value:r.f64(),modifiers:list(r,()=>({uuid:r.uuid(),amount:r.f64(),operation:r.i8()}))}))});
const ATTRIBUTE_NAMES={'generic.max_health':'generic.maxHealth','generic.movement_speed':'generic.movementSpeed','generic.flying_speed':'generic.flyingSpeed','generic.attack_damage':'generic.attackDamage','generic.attack_speed':'generic.attackSpeed','generic.knockback_resistance':'generic.knockbackResistance','generic.follow_range':'generic.followRange','horse.jump_strength':'horse.jumpStrength','zombie.spawn_reinforcements':'zombie.spawnReinforcements'};
function changed(name,r){switch(name){
  case 'window_items':return{windowId:r.u8(),stateId:r.varint(),items:list(r,()=>r.slot()),carriedItem:r.slot()};
  case 'set_slot':return{windowId:r.i8(),stateId:r.varint(),slot:r.i16(),item:r.slot()};
  case 'map_chunk':{const x=r.i32(),z=r.i32(),sectionMask=masks(r),heightmaps=readNbtRoot(r),biomes=list(r,()=>r.varint()),chunkData=r.bytesN(r.varint()).slice(),blockEntities=list(r,()=>readNbtRoot(r));return{x,z,groundUp:true,sectionMask,bitMap:numericMask(sectionMask),heightmaps,biomes,chunkData,blockEntities};}
  case 'update_light':{
    const p={chunkX:r.varint(),chunkZ:r.varint(),trustEdges:r.bool()};
    for(const key of['skyLightMask','blockLightMask','emptySkyLightMask','emptyBlockLightMask']){p[key+'Words']=masks(r);p[key]=numericMask(p[key+'Words']);}
    for(const [key,mask]of[['skyLight',p.skyLightMask],['blockLight',p.blockLightMask]]){const arrays=list(r,()=>r.bytesN(r.varint()).slice(),256),data={};let next=0;for(let i=0;i<=maskHighest(mask);i++)if(maskHas(mask,i)){if(arrays[next]?.length!==2048)throw Error('Invalid 756 light array');data[i-1]=arrays[next++];}if(next!==arrays.length)throw Error('756 light array count does not match mask');p[key]=data;}return p;
  }
  case 'position':return{x:r.f64(),y:r.f64(),z:r.f64(),yaw:r.f32(),pitch:r.f32(),flags:r.i8(),teleportId:r.varint(),dismountVehicle:r.bool()};
  case 'spawn_position':return{location:r.position(),angle:r.f32()};
  case 'explosion':return{x:r.f32(),y:r.f32(),z:r.f32(),radius:r.f32(),records:list(r,()=>({x:r.i8(),y:r.i8(),z:r.i8()})),motionX:r.f32(),motionY:r.f32(),motionZ:r.f32()};
  case 'resource_pack_send':return{url:r.string(),hash:r.string(),forced:r.bool(),promptMessage:r.bool()?r.string():null};
  case 'entity_update_attributes':{const p=attributes(r);for(const a of p.properties)a.key=ATTRIBUTE_NAMES[a.key]||a.key;return{name:'update_attributes',...p};}
  case 'tags':{const tags={},registries={};for(const entry of list(r,()=>{const registry=r.string(),values={};for(const [name,ids]of list(r,()=>{const name=r.string();return[name,list(r,()=>r.varint())];}))values[name]=ids;return{registry,values};})){registries[entry.registry]=entry.values;const kind={'minecraft:block':'blocks','minecraft:item':'items','minecraft:fluid':'fluids','minecraft:entity_type':'entities'}[entry.registry];if(kind)tags[kind]=entry.values;}return{tags,registries};}
  case 'map':{const p={itemDamage:r.varint(),scale:r.i8(),locked:r.bool(),icons:r.bool()?list(r,()=>({type:r.varint(),x:r.i8(),z:r.i8(),direction:r.u8(),displayName:r.bool()?r.string():null})):null,columns:r.u8()};if(p.columns){p.rows=r.u8();p.x=r.u8();p.y=r.u8();p.data=r.bytesN(r.varint()).slice();if(p.columns>128||p.rows>128||p.x+p.columns>128||p.y+p.rows>128||p.data.length!==p.columns*p.rows)throw Error('Invalid map rectangle');}return p;}
  case 'entity_metadata':return{entityId:r.varint(),metadata:r.metadata()};
  case 'world_particles':{const particleId=r.i32(),longDistance=r.bool();return{particleId,longDistance,x:r.f64(),y:r.f64(),z:r.f64(),offsetX:r.f32(),offsetY:r.f32(),offsetZ:r.f32(),particleData:r.f32(),particles:r.i32(),data:r.particleData(particleId)};}
  case 'declare_recipes':return{recipes:readRecipes(r,756)};
  case 'clear_titles':return{name:'title',action:r.bool()?5:4};
  case 'action_bar':return{name:'title',action:2,text:r.string()};
  case 'set_title_text':return{name:'title',action:0,text:r.string()};
  case 'set_title_subtitle':return{name:'title',action:1,text:r.string()};
  case 'set_title_time':return{name:'title',action:3,fadeIn:r.i32(),stay:r.i32(),fadeOut:r.i32()};
  case 'initialize_world_border':return{name:'world_border',action:3,x:r.f64(),z:r.f64(),oldRadius:r.f64(),newRadius:r.f64(),speed:r.varlong(),portalBoundary:r.varint(),warningBlocks:r.varint(),warningTime:r.varint()};
  case 'world_border_center':return{name:'world_border',action:2,x:r.f64(),z:r.f64()};
  case 'world_border_lerp_size':return{name:'world_border',action:1,oldRadius:r.f64(),newRadius:r.f64(),speed:r.varlong()};
  case 'world_border_size':return{name:'world_border',action:0,radius:r.f64()};
  case 'world_border_warning_delay':return{name:'world_border',action:4,warningTime:r.varint()};
  case 'world_border_warning_reach':return{name:'world_border',action:5,warningBlocks:r.varint()};
  case 'enter_combat_event':return{name:'combat_event',event:0};
  case 'end_combat_event':return{name:'combat_event',event:1,duration:r.varint(),entityId:r.i32()};
  case 'death_combat_event':return{name:'combat_event',event:2,playerId:r.varint(),entityId:r.i32(),message:r.string()};
  case 'ping':return{pingId:r.i32()};
  case 'sculk_vibration_signal':return readVibration(r);
  default:return null;
}}
const names=Object.fromEntries(Object.entries(IN).map(([name,id])=>[id,name]));
export function decodePacket756(bytes){
  const r=new Reader756(bytes),id=r.varint(),name=names[id];if(!name)return{name:'unsupported',id,data:r.rest()};
  const p=changed(name,r);if(p){if(r.remaining())throw Error('Trailing data in 756 '+name);return{name,id,...p};}
  if(OLD_IN[name]===undefined)return{name:'unsupported',packetName:name,id,data:r.rest()};
  const prefix=new Writer756().varint(OLD_IN[name]).build(),body=r.rest(),copy=new Uint8Array(prefix.length+body.length);copy.set(prefix);copy.set(body,prefix.length);return{...decodePacket754(copy),id};
}
const oldNames=Object.fromEntries(Object.entries(OLD_OUT).map(([name,id])=>[id,name])),packet=name=>new Writer756().varint(OUT[name]);
function remap(bytes){const r=new Reader756(bytes),name=oldNames[r.varint()],id=OUT[name];if(id===undefined)throw Error('No 756 outgoing packet '+name);const head=new Writer756().varint(id).build(),body=r.rest(),copy=new Uint8Array(head.length+body.length);copy.set(head);copy.set(body,head.length);return copy;}
export const C756={...Object.fromEntries(Object.entries(C754).filter(([name])=>name!=='transaction').map(([name,fn])=>[name,(...args)=>remap(fn(...args))])),
  pong:id=>packet('pong').i32(id).build(),
  settings:(locale='en_us',distance=4,disableTextFiltering=false)=>packet('settings').string(locale).i8(distance).varint(0).bool(true).u8(127).varint(1).bool(disableTextFiltering).build(),
  windowClick:(windowId,slot,button,stateId,mode,changedSlots,cursor)=>{const w=packet('window_click').u8(windowId).varint(stateId).i16(slot).i8(button).varint(mode).varint(changedSlots.length);for(const entry of changedSlots)w.i16(entry.slot).slot(entry.item);return w.slot(cursor).build();},
  editBook:(slot,pages,title=null)=>{const w=packet('edit_book').varint(slot).varint(pages.length);for(const page of pages)w.string(page);w.bool(title!==null);if(title!==null)w.string(title);return w.build();},
};
