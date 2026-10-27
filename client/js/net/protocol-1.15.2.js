// Native Java 1.15.2 protocol 578 codec.
// Most play packet bodies are unchanged from 1.14.4.  Changed layouts are
// decoded explicitly and all other packet IDs are translated by packet name.
import {Reader498,Writer498,decodePacket498,C498} from './protocol-1.14.4.js';
import {readNbtRoot} from './nbt.js';
import {CLIENTBOUND_498 as IN498,SERVERBOUND_498 as OUT498} from './protocol-1.14.4-ids.js';
import {CLIENTBOUND_578 as IN,SERVERBOUND_578 as OUT} from './protocol-1.15.2-ids.js';

export const PROTOCOL_578=578;
export class Reader578 extends Reader498 {}
export class Writer578 extends Writer498 {}

const names578=Object.fromEntries(Object.entries(IN).map(([name,id])=>[id,name]));
const names498=Object.fromEntries(Object.entries(IN498).map(([name,id])=>[id,name]));
const outNames498=Object.fromEntries(Object.entries(OUT498).map(([name,id])=>[id,name]));
const encodeVarInt=value=>{const out=[];let v=value|0;do{let b=v&0x7f;v>>>=7;if(v)b|=0x80;out.push(b);}while(v);return Uint8Array.from(out);};
const array=(r,read)=>{const n=r.varint();if(n<0||n>r.remaining())throw new RangeError('Invalid array length');return Array.from({length:n},()=>read(r));};
const particleData=(r,id)=>id===3||id===23?{blockState:r.varint()}:id===14?{red:r.f32(),green:r.f32(),blue:r.f32(),scale:r.f32()}:id===32?{item:r.slot()}:{};

function changedPacket(name,r){
  switch(name){
    case 'spawn_entity_living':return {name,entityId:r.varint(),entityUUID:r.uuid(),type:r.varint(),x:r.f64(),y:r.f64(),z:r.f64(),yaw:r.angle(),pitch:r.angle(),headPitch:r.angle(),velocity:{x:r.i16(),y:r.i16(),z:r.i16()},metadata:{}};
    case 'named_entity_spawn':return {name,entityId:r.varint(),playerUUID:r.uuid(),x:r.f64(),y:r.f64(),z:r.f64(),yaw:r.angle(),pitch:r.angle(),metadata:{}};
    case 'game_state_change':{const reason=r.u8(),value=r.f32();return {name,reason,value,gameMode:value};}
    case 'map_chunk':{const x=r.i32(),z=r.i32(),groundUp=r.bool(),bitMap=r.varint(),heightmaps=readNbtRoot(r),biomes=groundUp?Array.from({length:1024},()=>r.i32()>>>0):null,chunkData=r.bytesN(r.varint()).slice(),blockEntities=array(r,readNbtRoot);return {name,x,z,groundUp,bitMap,heightmaps,biomes,chunkData,blockEntities};}
    case 'world_particles':{const particleId=r.i32(),longDistance=r.bool();return {name,particleId,longDistance,x:r.f64(),y:r.f64(),z:r.f64(),offsetX:r.f32(),offsetY:r.f32(),offsetZ:r.f32(),particleData:r.f32(),particles:r.i32(),data:particleData(r,particleId)};}
    case 'login':return {name,entityId:r.i32(),gameMode:r.u8(),dimension:r.i32(),hashedSeed:r.i64(),maxPlayers:r.u8(),levelType:r.string(),viewDistance:r.varint(),reducedDebugInfo:r.bool(),enableRespawnScreen:r.bool()};
    case 'respawn':return {name,dimension:r.i32(),hashedSeed:r.i64(),gamemode:r.u8(),levelType:r.string()};
    default:return null;
  }
}

export function decodePacket578(bytes){
  const r=new Reader578(bytes),id=r.varint(),name=names578[id];
  if(!name)return {name:'unsupported',packetName:null,id,data:r.rest()};
  const changed=changedPacket(name,r);
  if(changed){if(r.remaining())throw new Error(`Trailing data in 578 ${name}: ${r.remaining()} bytes`);return {id,...changed};}
  const oldId=IN498[name];
  if(oldId===undefined)return {name:'unsupported',packetName:name,id,data:r.rest()};
  const prefix=encodeVarInt(oldId),rest=bytes.subarray(r.offset),legacy=new Uint8Array(prefix.length+rest.length);legacy.set(prefix);legacy.set(rest,prefix.length);
  const decoded=decodePacket498(legacy);return {...decoded,id};
}

function remapOutgoing(bytes){
  const r=new Reader578(bytes),oldId=r.varint(),name=outNames498[oldId],id=OUT[name];
  if(id===undefined||id===oldId)return bytes;
  const prefix=encodeVarInt(id),rest=bytes.subarray(r.offset),out=new Uint8Array(prefix.length+rest.length);out.set(prefix);out.set(rest,prefix.length);return out;
}
export const C578=Object.fromEntries(Object.entries(C498).map(([name,fn])=>[name,(...args)=>remapOutgoing(fn(...args))]));
