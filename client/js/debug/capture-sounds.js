import {platform} from '../platform/platform.js';
import {blocks} from '../world/blocks.js';
const ACTIVE=Symbol.for('minecraftjs.soundCapture');
// Opt-in diagnostics: event IDs, block states and requested sounds only.
// No chat, custom payloads, server addresses or authentication information.
export function captureSounds(game,{limit=512}={}){
 game[ACTIVE]?.stop();limit=Math.max(32,Math.min(4096,Math.trunc(limit)||512));
 const events=[],hooks=[],started=platform().now();let context=null,active=true;
 const record=data=>{if(!active)return;events.push({ms:Math.round(platform().now()-started),...data});if(events.length>limit)events.shift();};
 const block=pos=>{if(!pos)return null;const state=game.world?.getState(pos.x,pos.y,pos.z);return{x:pos.x,y:pos.y,z:pos.z,state,name:state===undefined?null:blocks[state>>4]?.name};};
 const hook=(obj,key,wrap)=>{if(typeof obj?.[key]!=='function')return;const original=obj[key],owned=Object.hasOwn(obj,key),wrapper=wrap(original);obj[key]=wrapper;hooks.push({obj,key,original,owned,wrapper});};
 for(const name of ['world_event','sound_effect','named_sound_effect','entity_sound_effect'])hook(game,'on_'+name,original=>function(p,...rest){
  const previous=context,fields={};for(const key of ['effectId','data','soundId','soundName','soundCategory','x','y','z','volume','pitch','entityId'])if(p[key]!==undefined)fields[key]=p[key];
  if(p.location)fields.block=block(p.location);context={source:'server.'+name,...fields};record({type:'packet',...context});
  try{return original.call(this,p,...rest);}finally{context=previous;}
 });
 for(const key of ['destroyBlockClient','onPlayerDamageBlock','_onItemUse'])hook(game.interaction,key,original=>function(pos,...rest){const previous=context;context={source:'local.'+key,block:block(pos)};try{return original.call(this,pos,...rest);}finally{context=previous;}});
 hook(game.sound,'play',original=>function(name,x,y,z,volume,pitch,options){record({type:'play',cause:context?{...context}:null,name,x,y,z,volume,pitch,category:options?.category});return original.apply(this,arguments);});
 const result={dump:()=>({version:game.assets?.translate?.('minecraftjs.version')||null,events:events.map(e=>({...e}))}),download(){platform().saveFile('minecraftjs-sound-capture.json',new TextEncoder().encode(JSON.stringify(this.dump(),null,2)),'application/json');},stop(){active=false;for(const h of hooks.reverse())if(h.obj[h.key]===h.wrapper){if(h.owned)h.obj[h.key]=h.original;else delete h.obj[h.key];}if(game[ACTIVE]===result)delete game[ACTIVE];return this.dump();}};
 game[ACTIVE]=result;return result;
}
