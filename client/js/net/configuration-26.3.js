// Native 26.3 (protocol 777) login and configuration codecs.
// Every field order below came from javap on the 26.3 client jar; nothing is inherited
// from 1.20.6 because 26.3 renumbered and reshaped both states (plugin queries, cookies,
// registry entries carrying anonymous NBT, tag payloads).
import {Reader,Writer} from './buffer.js';
import {readAnonymousNbt} from './nbt-anonymous.js';
import {
  LOGIN_CLIENTBOUND_26_3 as LI,LOGIN_SERVERBOUND_26_3 as LO,
  CONFIGURATION_CLIENTBOUND_26_3 as CI,CONFIGURATION_SERVERBOUND_26_3 as CO,
  PLAY_SERVERBOUND_26_3 as PO
} from './protocol-26.3-ids.js';
import {KNOWN_PACK_26_3} from './known-pack-26.3.js';

// 26.3 packs BlockPos as x(26)<<38 | z(26)<<12 | y(12); BlockPos.Y_OFFSET=0,
// Z_OFFSET=PACKED_Y_LENGTH(12), X_OFFSET=Y+PACKED_HORIZONTAL_LENGTH(38).
export class Reader26_3 extends Reader{
  _check(n){if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid packet length');super._check(n);}
  u32(){this._check(4);const v=this.view.getUint32(this.offset);this.offset+=4;return v;}
  position(){
    const v=this.i64();
    return {
      x:Number(BigInt.asIntN(26,v>>38n)),
      y:Number(BigInt.asIntN(12,v)),
      z:Number(BigInt.asIntN(26,(v>>12n)&0x3ffffffn))
    };
  }
}
export class Writer26_3 extends Writer{
  position(x,y,z){
    const v=(BigInt(x)&0x3ffffffn)<<38n|(BigInt(z)&0x3ffffffn)<<12n|(BigInt(y)&0xfffn);
    return this.i64(BigInt.asIntN(64,v));
  }
}

const byId=ids=>new Map(Object.entries(ids).map(([name,id])=>[id,name]));
const loginNames=byId(LI),configNames=byId(CI);
function count(r,max=1048576){const n=r.varint();if(n<0||n>max)throw Error('Invalid packet count');return n;}
function list(r,fn,max=1048576){return Array.from({length:count(r,max)},()=>fn(r));}
function byteArray(r,max=8388608){return r.bytesN(count(r,max)).slice();}
function complete(r,p){if(r.remaining())throw Error('Trailing '+p.name+' data: '+r.remaining()+' bytes');return p;}
const identifier=r=>r.string();

// ClientboundLoginFinishedPacket(GameProfile, UUID sessionId). GameProfile writes
// UUID, name, properties(name, value, optional signature); 26.3 appends the session id.
function readGameProfile(r){
  const uuid=r.uuid(),name=r.string();
  const properties=list(r,r=>{
    const propertyName=r.string(),value=r.string();
    return {name:propertyName,value,signature:r.bool()?r.string():null};
  },1024);
  return {uuid,name,properties};
}

export function decodeLogin26_3(data){
  const r=new Reader26_3(data),id=r.varint(),name=loginNames.get(id);
  const p={name:name||'unknown',id};
  switch(name){
    case 'login_disconnect':p.reason=r.string();break;
    case 'hello':p.serverId=r.string();p.publicKey=byteArray(r,1<<20);p.challenge=byteArray(r,1<<20);p.shouldAuthenticate=r.bool();break;
    case 'login_finished':p.profile=readGameProfile(r);p.uuid=p.profile.uuid;p.username=p.profile.name;p.sessionId=r.uuid();break;
    case 'login_compression':p.threshold=r.varint();if(p.threshold<0)throw Error('Invalid compression threshold');break;
    case 'custom_query':p.messageId=r.varint();p.channel=identifier(r);p.data=r.rest();break;
    case 'cookie_request':p.key=identifier(r);break;
    default:throw Error('Unknown protocol-777 login packet '+id);
  }
  return complete(r,p);
}

// ClientboundRegistryDataPacket(ResourceKey registry, List<PackedRegistryEntry>).
// PackedRegistryEntry(Identifier id, Optional<Tag> data): the tag is anonymous network NBT.
function readRegistryData(r){
  const registry=identifier(r);
  const entries=list(r,r=>{
    const key=identifier(r);
    return {key,value:r.bool()?readAnonymousNbt(r):null};
  });
  return {registry,entries};
}

// ClientboundUpdateTagsPacket(Map<ResourceKey, NetworkPayload>).
// NetworkPayload(Map<Identifier, List<Integer>>): both sizes are VarInt, ids are VarInt.
function readUpdateTags(r){
  return list(r,r=>({
    registry:identifier(r),
    tags:list(r,r=>({name:identifier(r),entries:list(r,r=>r.varint())}))
  }));
}

// Optional<Component> with ComponentSerialization.TRUSTED_CONTEXT_FREE_STREAM_CODEC:
// ByteBufCodecs.fromCodecTrusted writes the anonymous NBT tag (verified by play server_data).
function component(r){return readAnonymousNbt(r);}
function readServerLinks(r){
  const count=r.varint(),links=[];
  for(let i=0;i<count;i++){
    const known=r.bool();
    const type=known?r.varint():null;
    const name=known?null:component(r);
    links.push({type,name,link:r.string()});
  }
  return {links};
}
function readDialogHolder(r){
  const holder=r.varint();
  return holder===0?{dialogId:null,dialog:readAnonymousNbt(r)}:{dialogId:holder-1};
}

export function decodeConfiguration26_3(data){
  const r=new Reader26_3(data),id=r.varint(),name=configNames.get(id);
  const p={name:name||'unknown',id,decoded:true};
  switch(name){
    case 'cookie_request':p.key=identifier(r);break;
    case 'custom_payload':
      p.channel=identifier(r);
      p.data=r.rest();
      if(p.channel==='minecraft:brand'){
        const brandReader=new Reader26_3(p.data);
        p.brand=brandReader.string();
        if(brandReader.remaining())throw Error('Trailing brand payload');
      }
      break;
    case 'disconnect':p.reason=component(r);break;
    case 'finish_configuration':case 'reset_chat':break;
    case 'keep_alive':p.keepAliveId=r.i64();break;
    case 'ping':p.id32=r.i32();break;
    case 'registry_data':Object.assign(p,readRegistryData(r));break;
    case 'resource_pack_pop':p.uuid=r.bool()?r.uuid():null;break;
    case 'resource_pack_push':
      p.uuid=r.uuid();p.url=r.string();p.hash=r.string();p.forced=r.bool();p.prompt=r.bool()?component(r):null;
      break;
    case 'post_effects':p.effects=list(r,r=>identifier(r));break;
    case 'store_cookie':p.key=identifier(r);p.value=byteArray(r,5120);break;
    case 'transfer':p.host=r.string();p.port=r.varint();if(p.port<1||p.port>65535)throw Error('Invalid transfer port');break;
    case 'update_enabled_features':p.features=list(r,r=>identifier(r));break;
    case 'update_tags':p.registries=readUpdateTags(r);break;
    case 'select_known_packs':p.packs=list(r,r=>({namespace:r.string(),id:r.string(),version:r.string()}),1024);break;
    case 'custom_report_details':p.details=list(r,r=>({title:r.string(),description:r.string()}),32);break;
    case 'code_of_conduct':p.codeOfConduct=r.string();break;
    case 'clear_dialog':break;
    // ClientboundShowDialogPacket uses Dialog.STREAM_CODEC (a Holder<Dialog>); server links
    // are an either(known type, component) plus URL. Both are native common-packet codecs.
    case 'show_dialog':Object.assign(p,readDialogHolder(r));break;
    case 'server_links':Object.assign(p,readServerLinks(r));break;
    default:throw Error('Unknown protocol-777 configuration packet '+id);
  }
  if(!p.decoded)return p;
  return complete(r,p);
}

const packet=id=>new Writer26_3().varint(id);
const bytesOf=(w,value)=>{if(value.length>5120)throw Error('Cookie exceeds native limit');return w.varint(value.length).raw(value);};
function cookie(id,key,value){
  const w=packet(id).string(key).bool(!!value);
  return value?bytesOf(w,value).build():w.build();
}

// Serverbound encoders. ClientInformation layout verified from ClientInformation.write:
// language, viewDistance(byte), chatVisibility(VarInt), chatColors(bool), modelCustomisation(byte),
// mainHand(VarInt), textFilteringEnabled(bool), allowsListing(bool), particleStatus(VarInt).
export const C26_3={
  loginStart:(name,uuid)=>packet(LO.hello).string(name).uuid(uuid).build(),
  loginAcknowledged:()=>packet(LO.login_acknowledged).build(),
  loginPluginResponse:(id,data=null)=>{
    const w=packet(LO.custom_query_answer).varint(id).bool(!!data);
    return data?bytesOf(w,data).build():w.build();
  },
  loginCookieResponse:(key,value)=>cookie(LO.cookie_response,key,value),
  settings:({
    locale='en_us',distance=8,chatVisibility=0,chatColors=true,skinParts=127,
    mainHand=1,textFiltering=false,allowServerListing=true,particleStatus=0
  }={})=>packet(CO.client_information)
    .string(locale).i8(distance).varint(chatVisibility).bool(chatColors).u8(skinParts)
    .varint(mainHand).bool(textFiltering).bool(allowServerListing).varint(particleStatus).build(),
  brand:text=>packet(CO.custom_payload).string('minecraft:brand').string(text).build(),
  // Only packs whose data this client actually ships may be claimed: the server then omits
  // their registry payloads, so claiming an absent pack yields empty registries.
  knownPacks:(packs=[])=>{
    const w=packet(CO.select_known_packs).varint(packs.length);
    for(const p of packs)w.string(p.namespace).string(p.id).string(p.version);
    return w.build();
  },
  finishConfiguration:()=>packet(CO.finish_configuration).build(),
  keepAlive:id=>packet(CO.keep_alive).i64(id).build(),
  pong:id32=>packet(CO.pong).i32(id32).build(),
  cookieResponse:(key,value)=>cookie(CO.cookie_response,key,value),
  playCookieResponse:(key,value)=>cookie(PO.cookie_response,key,value),
  resourcePackStatus:(uuid,status)=>packet(CO.resource_pack).uuid(uuid).varint(status).build(),
  playResourcePackStatus:(uuid,status)=>packet(PO.resource_pack).uuid(uuid).varint(status).build(),
  acceptCodeOfConduct:()=>packet(CO.accept_code_of_conduct).build(),
  acknowledgeReconfiguration:()=>packet(PO.configuration_acknowledged).build(),
  playKeepAlive:id=>packet(PO.keep_alive).i64(id).build(),
  // 26.3 ServerboundAcceptTeleportationPacket(int id, double x, y, z, float yRot, xRot):
  // the client echoes its position after applying the teleport (ClientPacketListener 45..73).
  teleportConfirm:(id,x,y,z,yaw,pitch)=>packet(PO.accept_teleportation)
    .varint(id).f64(x).f64(y).f64(z).f32(yaw).f32(pitch).build(),
  // ServerboundMovePlayerPacket gained horizontalCollision after onGround in 26.3.
  positionLook:(x,y,z,yaw,pitch,onGround,horizontalCollision=false)=>packet(PO.move_player_pos_rot)
    .f64(x).f64(y).f64(z).f32(yaw).f32(pitch).bool(onGround).bool(horizontalCollision).build(),
  chunkBatchReceived:rate=>packet(PO.chunk_batch_received).f32(rate).build(),
  playPong:id32=>packet(PO.pong).i32(id32).build(),
  clientInformation(settings){
    const w=packet(PO.client_information).string(settings.locale??'en_us')
      .i8(settings.distance??8).varint(settings.chatVisibility??0).bool(settings.chatColors!==false)
      .u8(settings.skinParts??127).varint(settings.mainHand??1)
      .bool(!!settings.textFiltering).bool(settings.allowServerListing!==false)
      .varint(settings.particleStatus??0);
    return w.build();
  }
};

export class Configuration26_3{
  constructor(send,emit=()=>{},cookies=new Map(),options={}){
    this.send=send;
    this.emit=emit;
    this.cookies=cookies;
    this.knownPacks=options.knownPacks?.length ? options.knownPacks : [KNOWN_PACK_26_3];
    this.selectedKnownPacks=[];
    this.registries=new Map();
    this.tags=new Map();
    this.features=[];
    this.elidedRegistryValues=0;
    this.complete=false;
    this.received=[];
  }

  start(settings={}){
    this.send(C26_3.brand('MinecraftJS'));
    this.send(C26_3.settings(settings));
  }

  handle(data){
    if(this.complete)throw Error('Configuration already finished');
    const p=decodeConfiguration26_3(data);
    this.received.push(p.name);
    switch(p.name){
      case 'keep_alive':this.send(C26_3.keepAlive(p.keepAliveId));break;
      case 'ping':this.send(C26_3.pong(p.id32));break;
      case 'select_known_packs':{
        const offered=new Set(p.packs.map(x=>x.namespace+'\0'+x.id+'\0'+x.version));
        this.selectedKnownPacks=this.knownPacks.filter(x=>offered.has(x.namespace+'\0'+x.id+'\0'+x.version));
        this.send(C26_3.knownPacks(this.selectedKnownPacks));
        break;
      }
      case 'cookie_request':this.send(C26_3.cookieResponse(p.key,this.cookies.get(p.key)));break;
      case 'store_cookie':this.cookies.set(p.key,p.value.slice());break;
      case 'registry_data':{
        const seen=new Set();
        this.registries.set(p.registry,p.entries.map((entry,id)=>{
          if(seen.has(entry.key))throw Error('Duplicate registry key '+p.registry+' / '+entry.key);
          seen.add(entry.key);
          if(entry.value===null)this.elidedRegistryValues++;
          return {...entry,id};
        }));
        break;
      }
      case 'update_enabled_features':this.features=p.features;break;
      case 'update_tags':for(const registry of p.registries)this.tags.set(registry.registry,registry.tags);break;
      case 'code_of_conduct':this.send(C26_3.acceptCodeOfConduct());break;
      case 'finish_configuration':this.send(C26_3.finishConfiguration());this.complete=true;break;
    }
    this.emit(p);
    return p;
  }
}
