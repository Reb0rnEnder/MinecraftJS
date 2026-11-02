// Initial protocol-762 transport/terrain milestone. Not wired into the browser
// until target assets, entities, metadata and signed chat have passed their gates.
import {Reader758,Writer758,decodePacket758,C758} from './protocol-1.18.2.js';
import {CLIENTBOUND_758 as OLD_IN,SERVERBOUND_758 as OLD_OUT} from './protocol-1.18.2-ids.js';
import {CLIENTBOUND_762 as IN,SERVERBOUND_762 as OUT,CLIENTBOUND_INHERITED_762,SERVERBOUND_INHERITED_762} from './protocol-1.19.4-ids.js';
import {readNbtRoot,simplify} from './nbt.js';
import {registryEntries} from './registry-codec.js';
import {bitsetValue,maskValue,maskHighest,maskHas,compactMask} from './bitset.js';
export const PROTOCOL_762=762;
export class Reader762 extends Reader758 {}
export class Writer762 extends Writer758 {}
const inheritedIn=new Set(CLIENTBOUND_INHERITED_762),inheritedOut=new Set(SERVERBOUND_INHERITED_762);
const names=Object.fromEntries(Object.entries(IN).map(([name,id])=>[id,name]));
const oldOutNames=Object.fromEntries(Object.entries(OLD_OUT).map(([name,id])=>[id,name]));
function list(r,read,max=1048576){const n=r.varint();if(n<0||n>max||n>r.remaining())throw Error('Invalid 762 array length');return Array.from({length:n},read);}
function light(r){
 const p={trustEdges:r.bool()};
 for(const key of ['skyLightMask','blockLightMask','emptySkyLightMask','emptyBlockLightMask']){const words=list(r,()=>r.i64(),4);p[key+'Words']=words;p[key]=compactMask(bitsetValue(words));}
 if((maskValue(p.skyLightMask)&maskValue(p.emptySkyLightMask))||(maskValue(p.blockLightMask)&maskValue(p.emptyBlockLightMask)))throw Error('Overlapping 762 light masks');
 for(const[key,mask]of[['skyLight',p.skyLightMask],['blockLight',p.blockLightMask]]){const arrays=list(r,()=>r.bytesN(r.varint()).slice(),256),data={};let next=0;for(let i=0;i<=maskHighest(mask);i++)if(maskHas(mask,i)){if(arrays[next]?.length!==2048)throw Error('Invalid 762 light array');data[i-1]=arrays[next++];}if(next!==arrays.length)throw Error('762 light arrays do not match mask');p[key]=data;}
 return p;
}
function death(r){return r.bool()?{dimensionName:r.string(),location:r.position()}:null;}
export function resolveDimension762(codec,worldType){
 const data=registryEntries(simplify(codec),'minecraft:dimension_type').find(e=>e.name===worldType)?.element;
 if(!data||!Number.isInteger(data.min_y)||!Number.isInteger(data.height)||data.height<=0||data.height%16||data.min_y%16)throw Error('Missing or invalid 762 dimension '+worldType);
 return data;
}
function changed(name,r){switch(name){
 case 'login':{
  const entityId=r.i32(),isHardcore=r.bool(),gameMode=r.u8(),previousGameMode=r.i8(),worldNames=list(r,()=>r.string(),1024),dimensionCodec=readNbtRoot(r),worldType=r.string(),worldName=r.string(),dimensionData=resolveDimension762(dimensionCodec,worldType),effects=dimensionData.effects||worldName;
  const p={entityId,isHardcore,gameMode,previousGameMode,worldNames,dimensionCodec,worldType,worldName,dimensionData,dimension:effects==='minecraft:the_nether'?-1:effects==='minecraft:the_end'?1:0,hashedSeed:r.i64(),maxPlayers:r.varint(),viewDistance:r.varint(),simulationDistance:r.varint(),reducedDebugInfo:r.bool(),enableRespawnScreen:r.bool(),isDebug:r.bool(),isFlat:r.bool(),death:death(r)};p.levelType=p.isFlat?'flat':'default';return p;
 }
 case 'respawn':{
  // Native ClientboundRespawnPacket uses a bit field, despite the pinned
  // upstream schema describing this byte as a boolean.
  const p={worldType:r.string(),worldName:r.string(),hashedSeed:r.i64(),gameMode:r.u8(),previousGameMode:r.i8(),isDebug:r.bool(),isFlat:r.bool(),dataToKeep:r.u8(),death:death(r)};return{...p,keepAttributes:!!(p.dataToKeep&1),copyMetadata:!!(p.dataToKeep&2)};
 }
 case 'position':return{x:r.f64(),y:r.f64(),z:r.f64(),yaw:r.f32(),pitch:r.f32(),flags:r.i8(),teleportId:r.varint()};
 case 'spawn_entity':return{entityId:r.varint(),objectUUID:r.uuid(),type:r.varint(),x:r.f64(),y:r.f64(),z:r.f64(),pitch:r.i8()*360/256,yaw:r.i8()*360/256,headPitch:r.i8()*360/256,objectData:r.varint(),velocity:{x:r.i16(),y:r.i16(),z:r.i16()}};
 case 'map_chunk':{
  const x=r.i32(),z=r.i32(),heightmaps=readNbtRoot(r),chunkData=r.bytesN(r.varint()).slice(),blockEntities=list(r,()=>{const packed=r.u8(),y=r.i16(),type=r.varint(),nbtData=readNbtRoot(r);return{x:x*16+(packed>>4),y,z:z*16+(packed&15),type,nbtData};});
  return{x,z,groundUp:true,heightmaps,chunkData,blockEntities,...light(r)};
 }
 case 'update_light':return{chunkX:r.varint(),chunkZ:r.varint(),...light(r)};
 case 'system_chat':return{content:r.string(),isActionBar:r.bool()};
 case 'server_data':return{motd:r.string(),iconBytes:r.bool()?r.bytesN(r.varint()).slice():null,enforcesSecureChat:r.bool()};
 default:return null;
}}
function replaceId(id,body){const h=new Writer762().varint(id).build(),copy=new Uint8Array(h.length+body.length);copy.set(h);copy.set(body,h.length);return copy;}
export function decodePacket762(bytes){
 const r=new Reader762(bytes),id=r.varint(),name=names[id];if(!name)return{name:'unsupported',id,data:r.rest()};
 const p=changed(name,r);if(p){if(r.remaining())throw Error('Trailing data in 762 '+name);return{name,id,...p};}
 if(!inheritedIn.has(name))return{name:'unsupported',id,packetName:name,data:r.rest()};
 return{...decodePacket758(replaceId(OLD_IN[name],r.rest())),id};
}
export const C762=Object.fromEntries(Object.entries(C758).map(([name,fn])=>[name,(...args)=>{
 const r=new Reader762(fn(...args)),packetName=oldOutNames[r.varint()];if(!inheritedOut.has(packetName))throw Error('Unported 762 outgoing packet '+packetName);return replaceId(OUT[packetName],r.rest());
}]));
