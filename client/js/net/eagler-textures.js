import {EAGLER_SKINS,EAGLER_CAPES} from './eagler-presets.js';
import {decodeBase64} from '../util/base64.js';
import {decodePng} from '../util/png.js';
import {C} from './packets.js';
const PROTOCOL_VERSION=47;
import {Reader,Writer} from './buffer.js';
// Eaglercraft V3 plugin messages, as defined by EaglerXServer's protocol-game
// module. V2/V3 handshakes both use the V3 skin and cape channels.
const validUuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s);
export function skinPixelsV3(bytes){
 if(bytes.length!==16384)throw Error('Invalid Eagler skin size');const out=new Uint8Array(16384);
 for(let i=0;i<out.length;i+=4){out[i]=bytes[i+3];out[i+1]=bytes[i+2];out[i+2]=bytes[i+1];out[i+3]=bytes[i];}return out;
}
export function capePixelsV3(bytes){
 if(bytes.length!==1173)throw Error('Invalid Eagler cape size');const out=new Uint8Array(64*32*4);
 const pixel=(x,y,source)=>{const i=(y*64+x)*4;out[i]=bytes[source+2];out[i+1]=bytes[source+1];out[i+2]=bytes[source];out[i+3]=255;};
 for(let y=0;y<17;y++)for(let x=0;x<22;x++)pixel(x,y,(y*23+x)*3);
 for(let y=0;y<11;y++)pixel(22,y+11,((y+6)*23+22)*3);return out;
}
export class EaglerTextures {
 constructor(game){this.game=game;this.records=new Map();this.presets=new Map();}
 get active(){return !!this.game.conn?.ws?.isEagler;}
 _dispose(uuid,record){for(const type of ['skin','cape']){const key='eagler-'+type+':'+uuid,texture=this.game.assets.textures?.get(key);if(texture){this.game.assets.device?.destroyTexture(texture);this.game.assets.textures.delete(key);}}}
 clear(){for(const [uuid,record]of this.records)this._dispose(uuid,record);this.records.clear();for(const key of this.presets.keys()){const texture=this.game.assets.textures?.get(key);if(texture){this.game.assets.device?.destroyTexture(texture);this.game.assets.textures.delete(key);}}this.presets.clear();}
 drop(uuid){const record=this.records.get(uuid);if(record){this._dispose(uuid,record);this.records.delete(uuid);}}
 _preset(type,id){
  const entry=(type==='skin'?EAGLER_SKINS:EAGLER_CAPES).find(p=>p.id===id);if(!entry)return null;
  const key='eagler-preset-'+type+':'+id;let cached=this.presets.get(key);if(cached)return cached;
  let image=decodePng(decodeBase64(entry.png));
  if(type==='cape'&&image.width===32){const data=new Uint8Array(64*32*4);for(let y=0;y<32;y++)data.set(image.data.subarray(y*128,y*128+128),y*256);image={width:64,height:32,data};}
  cached={image,slim:!!entry.slim,texture:this.game.assets.makeTexture(key,image.width,image.height,image.data)};this.presets.set(key,cached);return cached;
 }
 request(uuid){
  if(!this.active||!validUuid(uuid))return null;uuid=uuid.toLowerCase();let record=this.records.get(uuid);if(record)return record;
  if(this.records.size>=512){const [old,value]=this.records.entries().next().value;this._dispose(old,value);this.records.delete(old);}
  record={path:'entity/steve.png',slim:false,texture:null,legacy:false};this.records.set(uuid,record);
  const bytes=new Writer().u8(3).uuid(uuid).build();
  this.game.send(C.customPayload(PROTOCOL_VERSION>=393?'eagler:skins-1-8':'EAG|Skins-1.8',bytes));
  this.game.send(C.customPayload(PROTOCOL_VERSION>=393?'eagler:capes-1-8':'EAG|Capes-1.8',bytes));
  return record;
 }
 handle(channel,bytes){
  const skin=channel==='EAG|Skins-1.8'||channel==='eagler:skins-1-8',cape=channel==='EAG|Capes-1.8'||channel==='eagler:capes-1-8';
  if(!skin&&!cape)return false;if(!this.active)return true;
  const expected=bytes?.[0]===4?21:bytes?.[0]===5?(skin?16402:1190):0;if(!expected||bytes.length!==expected)return true;
  const r=new Reader(bytes),type=r.u8(),uuid=r.uuid(),record=this.records.get(uuid);if(!record)return true;
  if(type===4){
   const preset=r.i32(),asset=this._preset(skin?'skin':'cape',preset);if(skin){record.preset=preset;record.slim=asset?.slim||false;record.path=record.slim?'entity/alex.png':'entity/steve.png';record.texture=asset?.texture||null;record.image=asset?.image;}
   else record.cape=asset?.texture||null;
  }else if(skin){
   record.model=r.u8();record.slim=record.model===1;record.image={width:64,height:64,data:skinPixelsV3(r.rest())};record.texture=this.game.assets.makeTexture('eagler-skin:'+uuid,64,64,record.image.data);
  }else{const data=capePixelsV3(r.rest());record.cape=this.game.assets.makeTexture('eagler-cape:'+uuid,64,32,data);}
  this.game.entityRenderer._rebuild(uuid);return true;
 }
}
