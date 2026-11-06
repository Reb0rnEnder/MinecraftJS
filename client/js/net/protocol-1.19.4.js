import {decodeUtf8} from '../util/utf8.js';
import {readLookAt} from './look-at.js';
// Active protocol-762 codec. Unsupported bodies remain explicit; signed chat
// outgoing account/session signing remains a separate unfinished milestone.
import {readCommands762} from './commands-1.19.4.js';
import {readRecipes762} from './recipes-1.19.4.js';
import {PARTICLES_762,BLOCK_ENTITIES_762} from './registries-1.19.4.js';
import {Reader758,Writer758,decodePacket758,C758} from './protocol-1.18.2.js';
import {CLIENTBOUND_758 as OLD_IN,SERVERBOUND_758 as OLD_OUT} from './protocol-1.18.2-ids.js';
import {CLIENTBOUND_762 as IN,SERVERBOUND_762 as OUT,CLIENTBOUND_INHERITED_762,SERVERBOUND_INHERITED_762} from './protocol-1.19.4-ids.js';
import {readNbtRoot,simplify} from './nbt.js';
import {registryEntries} from './registry-codec.js';
import {bitsetValue,maskValue,maskHighest,maskHas,compactMask} from './bitset.js';
export const PROTOCOL_762=762;
export class Reader762 extends Reader758 {
 chatMessage(){const length=this.varint();if(length<0||length>768)throw Error('Oversized 762 chat message');const text=decodeUtf8(this.bytesN(length));if(text.length>256)throw Error('Oversized 762 chat message');return text;}

 particleData(id){switch(PARTICLES_762[id]){
  case 'block':case 'block_marker':case 'falling_dust':return{blockState:this.varint()};
  case 'dust':case 'dust_color_transition':{const p={red:this.f32(),green:this.f32(),blue:this.f32(),scale:this.f32()};if(PARTICLES_762[id]==='dust_color_transition')Object.assign(p,{toRed:this.f32(),toGreen:this.f32(),toBlue:this.f32()});return p;}
  case 'item':return{item:this.slot()};
  case 'sculk_charge':return{rotation:this.f32()};
  case 'shriek':return{delayInTicksBeforeShown:this.varint()};
  case 'vibration':{const positionType=this.string();let destination,entityEyeHeight;if(positionType==='minecraft:block')destination=this.position();else if(positionType==='minecraft:entity'){destination=this.varint();entityEyeHeight=this.f32();}else throw Error('Unknown 762 vibration position source');return{positionType,destination,entityEyeHeight,ticks:this.varint(),particle:true};}
  default:return{};
 }}
 metadata(){const read=[r=>r.i8(),r=>r.varint(),r=>r.varlong(),r=>r.f32(),r=>r.string(),r=>r.string(),r=>r.bool()?r.string():null,r=>r.slot(),r=>r.bool(),r=>({pitch:r.f32(),yaw:r.f32(),roll:r.f32()}),r=>r.position(),r=>r.bool()?r.position():null,r=>r.varint(),r=>r.bool()?r.uuid():null,r=>r.varint(),r=>{const v=r.varint();return v===0?null:v;},r=>readNbtRoot(r),r=>r.particle(),r=>({villagerType:r.varint(),villagerProfession:r.varint(),level:r.varint()}),r=>{const v=r.varint();return v===0?null:v-1;},r=>r.varint(),r=>r.varint(),r=>r.varint(),r=>r.bool()?{dimensionName:r.string(),location:r.position()}:null,r=>r.varint(),r=>r.varint(),r=>[r.f32(),r.f32(),r.f32()],r=>[r.f32(),r.f32(),r.f32(),r.f32()]],metadata={};
  for(let index=this.u8();index!==255;index=this.u8()){const type=this.varint();if(!read[type])throw Error('Unknown 762 metadata serializer '+type);metadata[index]=read[type](this);}return metadata;
 }
}
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
export function targetBlockEntity762(tag,type,location){const id=BLOCK_ENTITIES_762[type];if(!id)throw Error('Unknown 762 block entity type '+type);if(tag&&tag.t!==10)throw Error('Invalid 762 block entity NBT');return{t:10,name:'',v:{...(tag?.v||{}),id:{t:8,v:id},...Object.fromEntries(Object.entries(location).map(([k,v])=>[k,{t:3,v}]))}};}
function death(r){return r.bool()?{dimensionName:r.string(),location:r.position()}:null;}
export function resolveDimension762(codec,worldType){
 const data=registryEntries(simplify(codec),'minecraft:dimension_type').find(e=>e.name===worldType)?.element;
 if(!data||!Number.isInteger(data.min_y)||!Number.isInteger(data.height)||data.height<=0||data.height%16||data.min_y%16)throw Error('Missing or invalid 762 dimension '+worldType);
 return data;
}
function changed(name,r){switch(name){
 case 'face_player':return readLookAt(r);
 case 'initialize_world_border':return{name:'world_border',action:3,x:r.f64(),z:r.f64(),oldRadius:r.f64(),newRadius:r.f64(),speed:r.varlong(),portalBoundary:r.varint(),warningBlocks:r.varint(),warningTime:r.varint()};
 case 'world_border_lerp_size':return{name:'world_border',action:1,oldRadius:r.f64(),newRadius:r.f64(),speed:r.varlong()};
 case 'chunk_biomes':return{biomes:list(r,()=>{const z=r.i32(),x=r.i32();return{x,z,data:r.bytesN(r.varint()).slice()};})};
 case 'profileless_chat':return{message:r.string(),type:r.varint(),networkName:r.string(),networkTargetName:r.bool()?r.string():null};
 case 'player_chat':{const p={sender:r.uuid(),index:r.varint(),signature:r.bool()?r.bytesN(256).slice():null,plainMessage:r.chatMessage(),timestamp:r.i64(),salt:r.i64()};p.previousMessages=list(r,()=>{const id=r.varint();return{id,signature:id===0?r.bytesN(256).slice():null};},20);p.unsignedChatContent=r.bool()?r.string():null;p.filterType=r.varint();if(p.filterType===2)p.filterTypeMask=list(r,()=>r.i64(),4096);else if(p.filterType!==0&&p.filterType!==1)throw Error('Invalid 762 chat filter');return{...p,type:r.varint(),networkName:r.string(),networkTargetName:r.bool()?r.string():null};}
 case 'hide_message':{const signatureId=r.varint();return{signatureId,signature:signatureId===0?r.bytesN(256).slice():null};}
 case 'chat_suggestions':{const action=r.varint();if(action<0||action>2)throw Error('Invalid chat completion action');return{action,entries:list(r,()=>r.string())};}
 case 'bundle_delimiter':return{};
 case 'acknowledge_player_digging':return{sequenceId:r.varint()};
 case 'feature_flags':return{features:list(r,()=>r.string(),256)};
 case 'declare_commands':return readCommands762(r);
 case 'declare_recipes':return{recipes:readRecipes762(r)};
 case 'entity_metadata':return{entityId:r.varint(),metadata:r.metadata()};
 case 'world_particles':{const particleId=r.varint(),longDistance=r.bool();return{particleId,longDistance,x:r.f64(),y:r.f64(),z:r.f64(),offsetX:r.f32(),offsetY:r.f32(),offsetZ:r.f32(),particleData:r.f32(),particles:r.i32(),data:r.particleData(particleId)};}
 case 'entity_effect':{const p={entityId:r.varint(),effectId:r.varint(),amplifier:r.u8(),duration:r.varint(),flags:r.u8(),factorCodec:r.bool()?readNbtRoot(r):null};return{...p,ambient:!!(p.flags&1),hideParticles:!(p.flags&2),showIcon:!!(p.flags&4)};}
 case 'sound_effect':case 'entity_sound_effect':{const wire=r.varint(),soundId=wire-1,soundName=wire===0?r.string():null,range=wire===0&&r.bool()?r.f32():null,soundCategory=r.varint(),p=name==='sound_effect'?{x:r.i32()/8,y:r.i32()/8,z:r.i32()/8}:{entityId:r.varint()};return{...p,soundId,soundName,range,soundCategory,volume:r.f32(),pitch:r.f32(),seed:r.i64()};}
 case 'explosion':return{x:r.f64(),y:r.f64(),z:r.f64(),radius:r.f32(),records:list(r,()=>({x:r.i8(),y:r.i8(),z:r.i8()})),motionX:r.f32(),motionY:r.f32(),motionZ:r.f32()};
 case 'multi_block_change':{const position=r.i64(),chunkX=Number(BigInt.asIntN(22,position>>42n)),chunkZ=Number(BigInt.asIntN(22,position>>20n)),sectionY=Number(BigInt.asIntN(20,position)),notTrustEdges=r.bool(),records=list(r,()=>{const n=BigInt.asUintN(64,r.varlong());return{state:Number(n>>12n),x:Number(n>>8n&15n),z:Number(n>>4n&15n),y:sectionY*16+Number(n&15n)};});return{chunkX,chunkZ,sectionY,notTrustEdges,records};}
 case 'tile_entity_data':{const location=r.position(),type=r.varint(),tag=readNbtRoot(r);return{location,type,nbtData:targetBlockEntity762(tag,type,location)};}
 case 'player_remove':return{players:list(r,()=>r.uuid())};
 case 'player_info':{const actions=r.u8();if(actions&~63)throw Error('Unknown 762 player-list action');return{actions,data:list(r,()=>{const p={uuid:r.uuid()};if(actions&1){p.name=r.string();p.properties=list(r,()=>({name:r.string(),value:r.string(),signature:r.bool()?r.string():null}));}if(actions&2)p.chatSession=r.bool()?{uuid:r.uuid(),expireTime:r.i64(),keyBytes:r.bytesN(r.varint()).slice(),keySignature:r.bytesN(r.varint()).slice()}:null;if(actions&4)p.gamemode=r.varint();if(actions&8)p.listed=r.bool();if(actions&16)p.ping=r.varint();if(actions&32)p.displayName=r.bool()?r.string():null;return p;})};}
 case 'damage_event':return{entityId:r.varint(),sourceTypeId:r.varint(),sourceCauseId:r.varint()-1,sourceDirectId:r.varint()-1,sourcePosition:r.bool()?{x:r.f64(),y:r.f64(),z:r.f64()}:null};
 case 'hurt_animation':return{entityId:r.varint(),yaw:r.f32()};
 case 'trade_list':{const windowId=r.varint(),trades=list(r,()=>({a:r.slot(),out:r.slot(),b:r.slot(),disabled:r.bool(),uses:r.i32(),max:r.i32(),xp:r.i32(),specialPrice:r.i32(),priceMultiplier:r.f32(),demand:r.i32()}));return{windowId,trades,villagerLevel:r.varint(),experience:r.varint(),isRegularVillager:r.bool(),canRestock:r.bool()};}

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
  const x=r.i32(),z=r.i32(),heightmaps=readNbtRoot(r),chunkData=r.bytesN(r.varint()).slice(),blockEntities=list(r,()=>{const packed=r.u8(),y=r.i16(),type=r.varint(),nbtData=readNbtRoot(r);return targetBlockEntity762(nbtData,type,{x:x*16+(packed>>4),y,z:z*16+(packed&15)});});
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

Object.assign(C762,{
 blockDig:(status,x,y,z,face,sequence=0)=>new Writer762().varint(OUT.block_dig).varint(status).position(x,y,z).i8(face).varint(sequence).build(),
 blockPlace:(x,y,z,face,hand,cx,cy,cz,insideBlock=false,sequence=0)=>new Writer762().varint(OUT.block_place).varint(hand).position(x,y,z).varint(face).f32(cx).f32(cy).f32(cz).bool(insideBlock).varint(sequence).build(),
 useItem:(hand=0,sequence=0)=>new Writer762().varint(OUT.use_item).varint(hand).varint(sequence).build(),
});
