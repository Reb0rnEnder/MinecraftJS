import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Particles} from '../client/js/render/particles.js';import {initBlocks,blocksByName,findState} from '../client/js/world/blocks.js';
import {CAVES_PARTICLES} from '../client/js/render/particles-1.17.1.js';import {animateCavesBlock,cavesWorldEvent,CANDLE_FLAMES} from '../client/js/render/block-effects-1.17.1.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(json('blocks'),json('blockCollisionShapes'));
function system(){const p=Object.create(Particles.prototype);p.list=[];p.game={settings:{particles:0},player:{creative:true},inventory:{held:()=>({id:1})},items:{name:()=> 'light'},assets:{data:{particles:json('particles')},atlas:{uv:()=>[0,0,1,1]}},entities:{get:()=>({x:8,y:64,z:0})},world:{getState:()=>0,getCollisions:()=>[]},sound:{play(){}}};return p;}
const vibration={origin:{x:0,y:64,z:0},positionType:'minecraft:block',destination:{x:10,y:64,z:0},ticks:10};
test('all seventeen new 1.17 particle packet types reach a renderer provider',()=>{
 for(const def of json('particles').filter(p=>CAVES_PARTICLES.has(p.name)||p.name==='light')){
  const p=system();p.game.world.getState=()=>blocksByName.light.defaultState;
  p.onPacket({particleId:def.id,particles:1,x:0,y:65,z:0,offsetX:0,offsetY:0,offsetZ:0,particleData:0,data:{...vibration,red:0,green:1,blue:1,toRed:1,toGreen:0,toBlue:0,scale:1}});
  assert.equal(p.list.length,1,def.name);assert.equal(p.list[0].sprite===def.name||def.name==='light',true,def.name);
  if(def.name!=='light'){p.tick();assert.ok(p.list.every(q=>[q.x,q.y,q.z,q.mx,q.my,q.mz].every(Number.isFinite)),def.name);}
 }
});
test('vibration moves to block/entity destinations and removes missing targets',()=>{
 const p=system(),q=p.vibration(vibration);for(let i=0;i<5;i++)p.tick();assert.equal(q.x,5.5);assert.equal(q.y,64.5);assert.equal(q.geometryFn(q,0,q.x,q.y,q.z).length,2);
 const moving=p.vibration({...vibration,positionType:'minecraft:entity',destination:5});p.tick();assert.ok(moving.x>.5);p.game.entities.get=()=>null;p.tick();assert.ok(!p.list.includes(moving));
});
test('dust transition interpolates both colors while small flames halve their rendered size',()=>{
 const p=system(),q=p.nativeParticle('dust_color_transition',0,0,0,0,0,0,{red:0,green:1,blue:1,scale:1,toRed:1,toGreen:0,toBlue:0});
 const start=q.colorFn(q,0);q.age=q.maxAge;const end=q.colorFn(q,0);assert.equal(start[0],0);assert.ok(end[0]>start[0]);assert.ok(end[1]<start[1]);
 const small=p.nativeParticle('small_flame',0,0,0);assert.ok(small.baseScale>=.5&&small.baseScale<=1);
});
test('candle families use native wick positions; unlit candles emit nothing',()=>{
 for(const count of [1,2,3,4]){const calls=[],s=system();s.nativeParticle=(...a)=>calls.push(a);s.smoke=()=>{};
  animateCavesBlock(s,2,64,3,findState('red_candle',{candles:String(count),lit:'true',waterlogged:'false'}),()=>.5);
  assert.deepEqual(calls.map(a=>a.slice(1)),CANDLE_FLAMES[count].map(v=>v.map((x,i)=>x+[2,64,3][i])));
  calls.length=0;animateCavesBlock(s,2,64,3,blocksByName.red_candle.defaultState,()=>.5);assert.equal(calls.length,0);
 }
});
test('copper world events emit native face/axis particle counts',()=>{
 const s=system(),calls=[];s.nativeParticle=(...a)=>calls.push(a);
 for(const [id,name]of[[3002,'electric_spark'],[3003,'wax_on'],[3004,'wax_off'],[3005,'scrape']]){calls.length=0;assert.equal(cavesWorldEvent(s,{effectId:id,data:-1,location:{x:0,y:0,z:0}},()=>.5),true);assert.equal(calls.length,24);assert.ok(calls.every(p=>p[0]===name));}
 calls.length=0;cavesWorldEvent(s,{effectId:3002,data:1,location:{x:0,y:0,z:0}},()=>.5);assert.equal(calls.length,15);
});
