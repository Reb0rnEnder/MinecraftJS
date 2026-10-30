// Java 1.18.2 / protocol 758. Bodies are inherited only when the pinned schemas agree.
import {Reader756,Writer756,decodePacket756,C756} from './protocol-1.17.1.js';
import {CLIENTBOUND_756 as OLD_IN,SERVERBOUND_756 as OLD_OUT} from './protocol-1.17.1-ids.js';
import {CLIENTBOUND_758 as IN,SERVERBOUND_758 as OUT} from './protocol-1.18.2-ids.js';
import {readNbtRoot,simplify,TAG} from './nbt.js';
import {bitsetValue,maskValue,maskHighest,maskHas,compactMask} from './bitset.js';
import {BLOCK_ENTITY_TYPES} from './block-entity-types-1.18.2.js';
export const PROTOCOL_758=758;
export class Writer758 extends Writer756 {}
export class Reader758 extends Reader756 {
 particleData(id){
  if(id===2||id===3||id===24)return{blockState:this.varint()};
  if(id===14||id===15){const data={red:this.f32(),green:this.f32(),blue:this.f32(),scale:this.f32()};if(id===15)Object.assign(data,{toRed:this.f32(),toGreen:this.f32(),toBlue:this.f32()});return data;}
  if(id===35)return{item:this.slot()};
  if(id===36){const origin=this.position(),positionType=this.string();let destination;if(positionType==='minecraft:block')destination=this.position();else if(positionType==='minecraft:entity')destination=this.varint();else throw Error('Invalid vibration destination');return{origin,positionType,destination,ticks:this.varint(),particle:true};}
  return{};
 }
}
function list(r,read,max=1048576){const n=r.varint();if(n<0||n>max||n>r.remaining())throw Error('Invalid 758 array length');return Array.from({length:n},read);}
const words=r=>list(r,()=>r.i64(),4);
function light(r){
 const p={trustEdges:r.bool()};
 for(const key of ['skyLightMask','blockLightMask','emptySkyLightMask','emptyBlockLightMask']){p[key+'Words']=words(r);p[key]=compactMask(bitsetValue(p[key+'Words']));}
 if((maskValue(p.skyLightMask)&maskValue(p.emptySkyLightMask))||(maskValue(p.blockLightMask)&maskValue(p.emptyBlockLightMask)))throw Error('Overlapping light masks');
 for(const [key,mask]of[['skyLight',p.skyLightMask],['blockLight',p.blockLightMask]]){const arrays=list(r,()=>r.bytesN(r.varint()).slice(),256),data={};let next=0;for(let i=0;i<=maskHighest(mask);i++)if(maskHas(mask,i)){if(arrays[next]?.length!==2048)throw Error('Invalid 758 light array');data[i-1]=arrays[next++];}if(next!==arrays.length)throw Error('Light arrays do not match mask');p[key]=data;}
 return p;
}
export function blockEntityNbt(tag,type,location){
 const name=BLOCK_ENTITY_TYPES[type];if(name===undefined)throw Error('Unknown native block entity type '+type);
 if(tag&&tag.t!==TAG.COMPOUND)throw Error('Invalid block entity NBT');
 return{t:TAG.COMPOUND,name:'',v:{...(tag?.v||{}),id:{t:TAG.STRING,v:name},...Object.fromEntries(Object.entries(location).map(([k,v])=>[k,{t:TAG.INT,v}]))}};
}
function changed(name,r){switch(name){
 case 'login':{
  const entityId=r.i32(),isHardcore=r.bool(),gameMode=r.u8(),previousGameMode=r.i8(),worldNames=list(r,()=>r.string(),1024),dimensionCodec=readNbtRoot(r),tag=readNbtRoot(r),worldName=r.string(),data=simplify(tag)||{},effects=data.effects||worldName;
  const p={entityId,isHardcore,gameMode,previousGameMode,worldNames,dimensionCodec,worldName,dimension:effects==='minecraft:the_nether'?-1:effects==='minecraft:the_end'?1:0,dimensionData:data,hashedSeed:r.i64(),maxPlayers:r.varint(),viewDistance:r.varint(),simulationDistance:r.varint(),reducedDebugInfo:r.bool(),enableRespawnScreen:r.bool(),isDebug:r.bool(),isFlat:r.bool()};p.levelType=p.isFlat?'flat':'default';return p;
 }
 case 'map_chunk':{
  const x=r.i32(),z=r.i32(),heightmaps=readNbtRoot(r),chunkData=r.bytesN(r.varint()).slice(),blockEntities=list(r,()=>{const packed=r.u8(),y=r.i16(),type=r.varint(),tag=readNbtRoot(r);return blockEntityNbt(tag,type,{x:x*16+(packed>>4),y,z:z*16+(packed&15)});});
  return{x,z,groundUp:true,heightmaps,chunkData,blockEntities,...light(r)};
 }
 case 'update_light':{const chunkX=r.varint(),chunkZ=r.varint();return{chunkX,chunkZ,...light(r)};}
 case 'tile_entity_data':{const location=r.position(),type=r.varint(),tag=readNbtRoot(r);return{location,type,nbtData:blockEntityNbt(tag,type,location)};}
 case 'simulation_distance':return{distance:r.varint()};
 case 'remove_entity_effect':return{entityId:r.varint(),effectId:r.varint()};
 case 'entity_effect':{const p={entityId:r.varint(),effectId:r.varint(),amplifier:r.u8(),duration:r.varint(),flags:r.u8()};return{...p,ambient:!!(p.flags&1),hideParticles:!(p.flags&2),showIcon:!!(p.flags&4)};}
 case 'entity_metadata':return{entityId:r.varint(),metadata:r.metadata()};
 case 'world_particles':{const particleId=r.i32(),longDistance=r.bool();return{particleId,longDistance,x:r.f64(),y:r.f64(),z:r.f64(),offsetX:r.f32(),offsetY:r.f32(),offsetZ:r.f32(),particleData:r.f32(),particles:r.i32(),data:r.particleData(particleId)};}
 default:return null;
}}
const names=Object.fromEntries(Object.entries(IN).map(([name,id])=>[id,name]));
export function decodePacket758(bytes){
 const r=new Reader758(bytes),id=r.varint(),name=names[id];if(!name)return{name:'unsupported',id,data:r.rest()};
 const p=changed(name,r);if(p){if(r.remaining())throw Error('Trailing data in 758 '+name);return{name,id,...p};}
 if(OLD_IN[name]===undefined)return{name:'unsupported',packetName:name,id,data:r.rest()};
 const head=new Writer758().varint(OLD_IN[name]).build(),body=r.rest(),copy=new Uint8Array(head.length+body.length);copy.set(head);copy.set(body,head.length);return{...decodePacket756(copy),id};
}
const oldNames=Object.fromEntries(Object.entries(OLD_OUT).map(([name,id])=>[id,name]));
function remap(bytes){const r=new Reader758(bytes),name=oldNames[r.varint()],id=OUT[name];if(id===undefined)throw Error('No 758 outgoing packet '+name);const head=new Writer758().varint(id).build(),body=r.rest(),copy=new Uint8Array(head.length+body.length);copy.set(head);copy.set(body,head.length);return copy;}
export const C758={...Object.fromEntries(Object.entries(C756).map(([name,fn])=>[name,(...args)=>remap(fn(...args))])),
 settings:(locale='en_us',distance=4,enableTextFiltering=false,enableServerListing=true)=>new Writer758().varint(OUT.settings).string(locale).i8(distance).varint(0).bool(true).u8(127).varint(1).bool(enableTextFiltering).bool(enableServerListing).build(),
};
