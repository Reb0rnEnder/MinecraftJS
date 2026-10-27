import {platform} from '../platform/platform.js';
import {chatToLegacy} from '../gui/chat.js';
const ACTIVE=Symbol.for('minecraftjs.textCapture');
const clone=value=>JSON.parse(JSON.stringify(value,(_key,value)=>value instanceof Map?[...value]:value instanceof Set?[...value]:typeof value==='bigint'?String(value):value));
function scoreboard(game){
 const s=game.scoreboard;if(!s)return null;
 return clone({sidebar:s.sidebar,defaultSidebar:s.defaultSidebar,teamSidebars:s.teamSidebars,objectives:s.objectives,teams:s.teams,header:s.header,footer:s.footer,
  entries:[...s.objectives].map(([name,o])=>({name,displayName:o.displayName,rows:[...o.scores].map(([name,score])=>({name,formatted:s.formatName(name),score}))}))});
}
// An opt-in, local-only capture. No connection/authentication packets or settings.
export function captureText(game,{limit=100}={}){
 game[ACTIVE]?.stop();limit=Math.max(1,Math.min(500,Math.trunc(limit)||100));
 const packets=[],translations=Object.create(null),hooks=[],initial={chat:clone(game.hud?.chat||[]),scoreboard:scoreboard(game)};
 const collect=value=>{
  if(typeof value==='string'){try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object')collect(parsed);}catch{}return;}
  if(!value||typeof value!=='object')return;
  if(typeof value.translate==='string')translations[value.translate]=game.assets.lang?.[value.translate]??null;
  for(const v of Object.values(value))if(v&&typeof v==='object'||typeof v==='string')collect(v);
 };
 for(const message of initial.chat)collect(message.raw);
 for(const name of ['chat','scoreboard_objective','scoreboard_score','scoreboard_display_objective','scoreboard_team','playerlist_header','player_info','title']){
  const key='on_'+name,original=game[key];if(typeof original!=='function')continue;
  const wrapper=function(packet,...rest){
   const raw=clone(packet);collect(raw);
   try{return original.call(this,packet,...rest);}
   finally{
    const entry={type:name,packet:raw};
    if(name==='chat')entry.formatted=chatToLegacy(packet.message);
    if(name.startsWith('scoreboard_')||name==='playerlist_header')entry.scoreboard=scoreboard(game);
    packets.push(entry);if(packets.length>limit)packets.shift();
   }
  };
  const owned=Object.prototype.hasOwnProperty.call(game,key);game[key]=wrapper;hooks.push({key,original,wrapper,owned});
 }
 const result={
  dump:()=>clone({version:game.assets.translate('minecraftjs.version'),initial,packets,translations}),
  download(){const bytes=new TextEncoder().encode(JSON.stringify(this.dump(),null,2));platform().saveFile('minecraftjs-text-capture.json',bytes,'application/json');},
  stop(){for(const {key,original,wrapper,owned}of hooks)if(game[key]===wrapper){if(owned)game[key]=original;else delete game[key];}if(game[ACTIVE]===result)delete game[ACTIVE];return this.dump();}
 };
 game[ACTIVE]=result;return result;
}
