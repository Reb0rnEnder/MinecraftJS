import {test} from 'node:test';
import assert from 'node:assert/strict';
import mcassets from '../lib/mcassets.js';
import {Hud} from '../client/js/gui/hud.js';
import {setPlatform} from '../client/js/platform/platform.js';
const version=mcassets.MC_VERSION,absorptionIndex=version==='1.14.4'?13:version==='1.8.9'?17:11;
function fixture(metadata){
 setPlatform({now:()=>2000});const draws=[],g={health:20,maxHealth:20,food:20,saturation:5,selfMetadata:metadata,effects:new Map(),inventory:{armor:[],armorPoints:()=>0},player:{ridingEntity:null},world:{getState:()=>0},eyePosition:()=>[0,65,0],settings:{},thirdPerson:1,input:{isDown:()=>false},screens:{current:null}};
 const hud=new Hud(g),gui={width:320,height:240,blit:(...a)=>draws.push(a)};
 for(const name of ['renderHotbar','_crosshair','renderBossBar','renderStatusEffects','renderXp','renderSubtitles','renderSidebar','renderChat'])hud[name]=()=>{};
 return {g,hud,gui,draws};
}
test(version+': normal survival and adventure hearts/hunger survive shoulder NBT metadata',()=>{
 for(const mode of [0,2]){
  const meta={[absorptionIndex]:0};if(version==='1.14.4')meta[17]={t:10,v:{}};else if(version==='1.13.2'||version==='1.12.2')meta[15]={t:10,v:{}};
  const {g,hud,gui,draws}=fixture(meta);g.gameMode=mode;hud.render(gui,0,{});
  assert.equal(draws.filter(a=>a[4]===0&&a[3]===16).length,10,'ten normal heart backgrounds');assert.equal(draws.filter(a=>a[4]===27).length,20,'ten hunger backgrounds and filled icons');assert.ok(draws.every(a=>a.slice(1).every(Number.isFinite)));
 }
});
test(version+': absorption adds golden hearts using the target player metadata field',()=>{
 const {hud,gui,draws}=fixture({[absorptionIndex]:4});hud.renderStats(gui);assert.equal(draws.filter(a=>a[4]===0&&a[3]===16).length,12);assert.equal(draws.filter(a=>a[4]===0&&a[3]===160).length,2,'two golden full hearts');
});
