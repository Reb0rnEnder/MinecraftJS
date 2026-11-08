import {C} from '../net/packets.js';
import {platform} from '../platform/platform.js';
import {getBlock,getStateProperties} from '../world/blocks.js';
export class NbtQueries{
 constructor(game){this.game=game;this.serial=0;this.pending=null;}
 clear(){this.pending=null;}
 block(position,callback){return this._request(id=>C.queryBlockNbt(id,position),callback);}
 entity(entityId,callback){return this._request(id=>C.queryEntityNbt(id,entityId),callback);}
 _request(encode,callback){const id=++this.serial;this.pending={id,callback,conn:this.game.conn};this.game.send(encode(id));return id;}
 handle(packet){const p=this.pending;if(!p||p.id!==packet.transactionId||p.conn!==this.game.conn)return false;this.pending=null;p.callback(packet.nbt);return true;}
}
const quote=s=>/^[A-Za-z0-9_.+-]+$/.test(s)?s:JSON.stringify(s);
export function snbt(tag){
 if(!tag)return '{}';const value=tag.v;
 switch(tag.t){
  case 1:return value+'b';case 2:return value+'s';case 3:return String(value);case 4:return value+'L';case 5:return value+'f';case 6:return value+'d';case 8:return JSON.stringify(value);
  case 7:return '[B;'+Array.from(value,v=>v+'B').join(',')+']';case 11:return '[I;'+Array.from(value).join(',')+']';case 12:return '[L;'+Array.from(value,v=>v+'L').join(',')+']';
  case 9:return '['+value.items.map(v=>snbt({t:value.et,v})).join(',')+']';
  case 10:return '{'+Object.entries(value).map(([k,v])=>quote(k)+':'+snbt(v)).join(',')+'}';default:return '{}';
 }
}
export function copyInspect(game,clientOnly=false){
 const target=game.interaction.target;if(!target)return;
 const connection=game.conn,server=!clientOnly&&(game.permissionLevel|0)>=2;
 const finish=(kind,base,tag)=>{
  if(game.conn!==connection)return;
  if(tag?.t===10){tag=structuredClone(tag);for(const key of kind==='block'?['x','y','z','id']:['UUID','UUIDMost','UUIDLeast','Pos','Dimension','id'])delete tag.v[key];}
  platform().setClipboard(base+(tag?' '+snbt(tag):''));game.debugFeedback('debug.inspect.'+(server?'server':'client')+'.'+kind);
 };
 if(target.type==='block'){
  const {x,y,z}=target,state=game.world.getState(x,y,z),name=getBlock(state).name,props=getStateProperties(state),entries=Object.entries(props||{});
  const block='minecraft:'+name+(entries.length?'['+entries.map(([k,v])=>k+'='+v).join(',')+']':''),base=`/setblock ${x} ${y} ${z} ${block}`;
  // Block NBT directly follows its state in /setblock; it is not a separate argument.
  const done=tag=>{if(game.conn!==connection)return;let value=tag;if(tag?.t===10){value=structuredClone(tag);for(const key of ['x','y','z','id'])delete value.v[key];}platform().setClipboard(base+(value?snbt(value):''));game.debugFeedback('debug.inspect.'+(server?'server':'client')+'.block');};
  if(server)game.nbtQueries.block({x,y,z},done);else done(game.tileRenderer.tiles.get(x+','+y+','+z)?.nbt||null);
 }else if(target.type==='entity'){
  const entity=target.entity;if(!entity.entityName)return;
  const base=`/summon minecraft:${entity.entityName} ${entity.x.toFixed(2)} ${entity.y.toFixed(2)} ${entity.z.toFixed(2)}`;
  if(server)game.nbtQueries.entity(entity.id,tag=>finish('entity',base,tag));else finish('entity',base,null);
 }
}
