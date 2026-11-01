import {platform} from '../platform/platform.js';
const ACTIVE=Symbol.for('minecraftjs.networkCapture');
const snapshot=g=>({dimension:g.dimension,worldName:g.worldName,minY:g.world?.minY??0,height:g.world?.height??256,biomeRegistrySize:g.world?.biomeRegistrySize,position:g.player?[g.player.x,g.player.y,g.player.z]:null,gameMode:g.gameMode,cameraEntity:g.cameraEntity,ridingEntityId:g.ridingEntityId,chunks:g.world?.chunks?.size,doneLoadingTerrain:g.doneLoadingTerrain});
// Local-only bounded diagnostics. Never collect chat, login credentials, UUIDs,
// raw custom payloads/skins or server URLs which could contain a password.
export function captureNetwork(game,{limit=512}={}){
 game[ACTIVE]?.stop();limit=Math.max(32,Math.min(4096,Number(limit)||512));
 const events=[],counts={},hooks=[],started=platform().now(),initial=snapshot(game);let active=true,chunkSamples=0;
 const record=data=>{if(!active)return;events.push({ms:Math.round(platform().now()-started),...data});if(events.length>limit)events.shift();};
 const hook=(obj,key,wrap)=>{if(!obj||typeof obj[key]!=='function')return;const original=obj[key],owned=Object.hasOwn(obj,key),wrapper=wrap(original);obj[key]=wrapper;hooks.push({obj,key,original,owned,wrapper});};
 hook(game,'handlePacket',original=>function(p){counts[p.name]=(counts[p.name]||0)+1;if(p.name==='unsupported')record({type:'unsupported',id:p.id,packetName:p.packetName,bytes:p.data?.length});return original.call(this,p);});
 hook(game.conn,'emit',original=>function(type,...args){if(type==='decode_error')record({type,...args[0]});return original.call(this,type,...args);});
 for(const name of ['login','respawn','position','map_chunk','update_light','camera','set_passengers'])hook(game,'on_'+name,original=>function(p){
  const fields={};for(const key of ['id','x','y','z','yaw','pitch','flags','teleportId','dismountVehicle','dimension','worldName','gameMode','gamemode','copyMetadata','cameraId','entityId','chunkX','chunkZ'])if(p[key]!==undefined)fields[key]=p[key];if(p.dimensionData)fields.dimensionData=p.dimensionData;
  if(name==='login'||name==='respawn')chunkSamples=0;
  const sample=name==='map_chunk'?chunkSamples++<3:name!=='update_light';
  try{const result=original.call(this,p);if(sample)record({type:name,packet:fields,after:snapshot(this)});return result;}
  catch(error){record({type:'handler_error',packetName:name,packet:fields,message:String(error?.message||error),after:snapshot(this)});throw error;}
 });
 const result={dump:()=>({version:game.assets?.translate?.('minecraftjs.version')||null,initial,counts:{...counts},events:[...events],current:snapshot(game)}),download(){platform().saveFile('minecraftjs-network-capture.json',new TextEncoder().encode(JSON.stringify(this.dump(),null,2)),'application/json');},stop(){active=false;for(const h of hooks.reverse())if(h.obj[h.key]===h.wrapper){if(h.owned)h.obj[h.key]=h.original;else delete h.obj[h.key];}if(game[ACTIVE]===result)delete game[ACTIVE];return this.dump();}};
 game[ACTIVE]=result;return result;
}
