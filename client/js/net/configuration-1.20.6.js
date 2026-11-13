import {Reader,Writer} from './buffer.js';
import {readAnonymousNbt} from './nbt-anonymous.js';
import {readComponentNbt,writeComponentNbt} from './component-nbt-1.20.6.js';
import {readSlot766,writeSlot766} from './item-components-1.20.6.js';
import {KNOWN_PACK_766} from './known-pack-1.20.6.js';
import {LOGIN_CLIENTBOUND_766 as LI,LOGIN_SERVERBOUND_766 as LO,CONFIGURATION_CLIENTBOUND_766 as IN,CONFIGURATION_SERVERBOUND_766 as OUT,PLAY_CLIENTBOUND_766 as PI,PLAY_SERVERBOUND_766 as PO} from './protocol-1.20.6-ids.js';
export class Reader766 extends Reader{
 _check(n){if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid packet length');super._check(n);}
 position(){const v=this.i64();return{x:Number(BigInt.asIntN(26,v>>38n)),y:Number(BigInt.asIntN(12,v)),z:Number(BigInt.asIntN(26,v>>12n))};}
 component(){return readComponentNbt(this);}
 slot(){return readSlot766(this);}
}
export class Writer766 extends Writer{
 position(x,y,z){return this.i64(BigInt.asIntN(64,(BigInt(x)&0x3ffffffn)<<38n|(BigInt(z)&0x3ffffffn)<<12n|(BigInt(y)&0xfffn)));}
 component(value){writeComponentNbt(this,value);return this;}
 slot(item){return writeSlot766(this,item);}
}
const names=ids=>Object.fromEntries(Object.entries(ids).map(([name,id])=>[id,name]));
const loginNames=names(LI),configNames=names(IN),playNames=names(PI),qualified=name=>name.includes(':')?name:'minecraft:'+name;
function count(r,max=1048576){const n=r.varint();if(n<0||n>max)throw Error('Invalid packet count');return n;}
function array(r,fn,max){return Array.from({length:count(r,max)},()=>fn(r));}
const bytes=r=>r.bytesN(count(r)),option=(r,fn)=>r.bool()?fn(r):null,packet=id=>new Writer766().varint(id),knownPacks=r=>array(r,r=>({namespace:r.string(),id:r.string(),version:r.string()}),1024);
function complete(r,p){if(r.remaining())throw Error('Trailing '+p.name+' data');return p;}
export function decodeLogin766(data){const r=new Reader766(data),id=r.varint(),name=loginNames[id];let p={name};
 switch(name){
  case 'disconnect':p.reason=r.string();break;
  case 'encryption_begin':p.serverId=r.string();p.publicKey=bytes(r);p.verifyToken=bytes(r);p.shouldAuthenticate=r.bool();break;
  case 'success':p.uuid=r.uuid();p.username=r.string();p.properties=array(r,r=>({name:r.string(),value:r.string(),signature:option(r,r=>r.string())}),1024);p.strictErrorHandling=r.bool();break;
  case 'compress':p.threshold=r.varint();if(p.threshold<0)throw Error('Invalid compression threshold');break;
  case 'login_plugin_request':p.messageId=r.varint();p.channel=r.string();p.data=r.rest();break;
  case 'cookie_request':p.key=r.string();break;
  default:throw Error('Unknown protocol-766 login packet '+id);
 }return complete(r,p);
}
export function decodeConfiguration766(data){const r=new Reader766(data),id=r.varint(),name=configNames[id];let p={name};
 switch(name){
  case 'cookie_request':p.key=r.string();break;
  case 'custom_payload':p.channel=r.string();p.data=r.rest();break;
  case 'disconnect':p.reason=r.component();break;
  case 'finish_configuration':case 'reset_chat':break;
  case 'keep_alive':p.keepAliveId=r.i64();break;
  case 'ping':p.id=r.i32();break;
  case 'registry_data':p.registry=qualified(r.string());p.entries=array(r,r=>({key:qualified(r.string()),value:option(r,readAnonymousNbt)}));break;
  case 'remove_resource_pack':p.uuid=option(r,r=>r.uuid());break;
  case 'add_resource_pack':p.uuid=r.uuid();p.url=r.string();p.hash=r.string();p.forced=r.bool();p.prompt=option(r,r=>r.component());break;
  case 'store_cookie':p.key=r.string();p.value=bytes(r);if(p.value.length>5120)throw Error('Cookie exceeds native limit');break;
  case 'transfer':p.host=r.string();p.port=r.varint();if(p.port<1||p.port>65535)throw Error('Invalid transfer port');break;
  case 'feature_flags':p.features=array(r,r=>r.string(),1024);break;
  case 'tags':p.registries=array(r,r=>({registry:qualified(r.string()),tags:array(r,r=>({name:qualified(r.string()),entries:array(r,r=>r.varint())}))}));break;
  case 'select_known_packs':p.packs=knownPacks(r);break;
  default:throw Error('Unknown protocol-766 configuration packet '+id);
 }return complete(r,p);
}
export const C766={
 loginStart:(name,uuid)=>packet(LO.login_start).string(name).uuid(uuid).build(),
 loginAcknowledged:()=>packet(LO.login_acknowledged).build(),
 loginPluginResponse:id=>packet(LO.login_plugin_response).varint(id).bool(false).build(),
 loginCookieResponse:(key,value)=>cookie(LO.cookie_response,key,value),
 settings:(locale='en_us',distance=8,chatVisibility=0,chatColors=true,skinParts=127,mainHand=1,allowServerListing=true)=>packet(OUT.settings).string(locale).i8(distance).varint(chatVisibility).bool(chatColors).u8(skinParts).varint(mainHand).bool(false).bool(allowServerListing).build(),
 brand:brand=>packet(OUT.custom_payload).string('minecraft:brand').raw(new Writer().string(brand).build()).build(),
 knownPacks:(packs=[])=>{const w=packet(OUT.select_known_packs).varint(packs.length);for(const p of packs)w.string(p.namespace).string(p.id).string(p.version);return w.build();},
 finishConfiguration:()=>packet(OUT.finish_configuration).build(),
 keepAlive:id=>packet(OUT.keep_alive).i64(id).build(),pong:id=>packet(OUT.pong).i32(id).build(),
 cookieResponse:(key,value)=>cookie(OUT.cookie_response,key,value),
 playCookieResponse:(key,value)=>cookie(PO.cookie_response,key,value),
 resourcePackStatus:(uuid,status)=>packet(OUT.resource_pack_receive).uuid(uuid).varint(status).build(),
 acknowledgeReconfiguration:()=>packet(PO.configuration_acknowledged).build(),
 playKeepAlive:id=>packet(PO.keep_alive).i64(id).build(),
 teleportConfirm:id=>packet(PO.teleport_confirm).varint(id).build(),
 positionLook:(x,y,z,yaw,pitch,onGround)=>packet(PO.position_look).f64(x).f64(y).f64(z).f32(yaw).f32(pitch).bool(onGround).build(),
 chunkBatchReceived:rate=>packet(PO.chunk_batch_received).f32(rate).build(),
};
function cookie(id,key,value){const w=packet(id).string(key).bool(!!value);if(value){if(value.length>5120)throw Error('Cookie exceeds native limit');w.varint(value.length).raw(value);}return w.build();}
export class Configuration766{
 constructor(send,emit=()=>{},cookies=new Map(),knownPack=KNOWN_PACK_766){this.send=send;this.emit=emit;this.cookies=cookies;this.knownPack=knownPack;this.selectedKnownPacks=[];this.cachedRegistryValues=0;this.registries=new Map();this.features=[];this.tags=new Map();this.complete=false;}
 start({locale='en_us',distance=8,chatVisibility=0,chatColors=true,skinParts=127,mainHand=1,allowServerListing=true}={}){this.send(C766.brand('MinecraftJS'));this.send(C766.settings(locale,distance,chatVisibility,chatColors,skinParts,mainHand,allowServerListing));}
 handle(data){if(this.complete)throw Error('Configuration already finished');const p=decodeConfiguration766(data);
  switch(p.name){
   case 'keep_alive':this.send(C766.keepAlive(p.keepAliveId));break;
   case 'ping':this.send(C766.pong(p.id));break;
   case 'select_known_packs':{const cached=this.knownPack?.pack;this.selectedKnownPacks=cached&&p.packs.some(x=>x.namespace===cached.namespace&&x.id===cached.id&&x.version===cached.version)?[cached]:[];this.send(C766.knownPacks(this.selectedKnownPacks));break;}
   case 'cookie_request':this.send(C766.cookieResponse(p.key,this.cookies.get(p.key)));break;
   case 'store_cookie':this.cookies.set(p.key,p.value.slice());break;
   case 'registry_data':{const seen=new Set(),cachedEntries=this.selectedKnownPacks.length?this.knownPack?.registries?.[p.registry]:null,cachedByKey=cachedEntries?new Map(cachedEntries.map(e=>[e.key,e.value])):null;this.registries.set(p.registry,p.entries.map((e,id)=>{if(seen.has(e.key))throw Error('Duplicate registry key '+e.key);seen.add(e.key);let value=e.value;if(value===null){if(!cachedByKey?.has(e.key))throw Error('Omitted registry payload without a matching negotiated known-pack value: '+p.registry+' / '+e.key);value=cachedByKey.get(e.key);this.cachedRegistryValues++;}return{...e,value,id};}));break;}
   case 'feature_flags':this.features=p.features;break;
   case 'tags':for(const registry of p.registries)this.tags.set(registry.registry,registry.tags);break;
   case 'finish_configuration':this.send(C766.finishConfiguration());this.complete=true;break;
  }
  this.emit(p);return p;
 }
}
// Minimal first-Play gate. The inventory/component and graphical play codecs
// deliberately are not inherited from protocol 762.
export function decodeBootstrapPlay766(data){const r=new Reader766(data),id=r.varint(),name=playNames[id],p={name:name||'unknown',id};
 if(name==='login'){
  p.entityId=r.i32();p.isHardcore=r.bool();p.worldNames=array(r,r=>r.string(),1024);p.maxPlayers=r.varint();p.viewDistance=r.varint();p.simulationDistance=r.varint();p.reducedDebugInfo=r.bool();p.enableRespawnScreen=r.bool();p.doLimitedCrafting=r.bool();
  p.dimensionType=r.varint();p.worldName=r.string();p.hashedSeed=r.i64();p.gameMode=r.i8();p.previousGameMode=r.u8();p.isDebug=r.bool();p.isFlat=r.bool();p.death=option(r,r=>({dimension:r.string(),position:r.position()}));p.portalCooldown=r.varint();p.enforcesSecureChat=r.bool();
 }else if(name==='keep_alive')p.keepAliveId=r.i64();
 else if(name==='position'){p.x=r.f64();p.y=r.f64();p.z=r.f64();p.yaw=r.f32();p.pitch=r.f32();p.flags=r.u8();p.teleportId=r.varint();}
 else if(name==='chunk_batch_finished')p.batchSize=r.varint();
 else if(name==='kick_disconnect')p.reason=r.component();
 else if(name!=='start_configuration'&&name!=='chunk_batch_start'){p.data=r.rest();return p;}
 return complete(r,p);
}
