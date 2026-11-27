// ItemHoe / ItemSpade / ItemFlintAndSteel / ItemBucket / ItemGlassBottle on this version's client.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initBlocks,blocksByName} from '../client/js/world/blocks.js';
import {NATIVE,useOnLegacy,useLegacy} from '../client/js/game/item-use-legacy.js';
const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(read('blocks'),read('blockCollisionShapes'));
const st=(n,m=0)=>(blocksByName[n].id<<4)|m;
function game(b={}){const s=new Map(Object.entries(b)),sounds=[];return{sounds,gameMode:0,dimension:0,player:{x:.5,y:65,z:.5},items:{name:i=>i},sound:{play:n=>sounds.push(n)},
  world:{getState:(x,y,z)=>s.get(x+','+y+','+z)??0,setState:(x,y,z,v)=>s.set(x+','+y+','+z,v),raycast:(ox,oy,oz,dx,dy,dz,r)=>{for(let d=0;d<r;d+=.01){const x=Math.floor(ox+dx*d),y=Math.floor(oy+dy*d),z=Math.floor(oz+dz*d),v=s.get(x+','+y+','+z);if(v&&!blocksByName.water||v&&![blocksByName.water.id,blocksByName.flowing_water.id,blocksByName.lava.id].includes(v>>4))return{x,y,z,face:1,dist:d,state:v};}return null;}},
  eyePosition:()=>[.5,66.62,.5],lookVector:()=>[0,-1,0],interaction:{reach:()=>4.5},get:k=>s.get(k)};}
const t={x:0,y:64,z:0,face:1};
test('hoes till grass and plain or coarse dirt only, flint and steel sets fire on air, sounds only from 1.9',()=>{
  let g=game({'0,64,0':st('dirt',2)});assert.deepEqual(useOnLegacy(g,{id:'iron_hoe'},t),{success:false}); // podzol
  g=game({'0,64,0':st('grass')});assert.deepEqual(useOnLegacy(g,{id:'iron_hoe'},t),{success:true});assert.deepEqual(g.sounds,NATIVE.sounds?['item.hoe.till']:[]);
  g=game({'0,64,0':st('stone')});assert.deepEqual(useOnLegacy(g,{id:'flint_and_steel'},t),{success:true});assert.equal(g.get('0,65,0')>>4,blocksByName.fire.id);
  g=game({'0,64,0':st('grass')});const shovel=useOnLegacy(g,{id:'iron_shovel'},t);assert.deepEqual(shovel,NATIVE.path?{success:true}:null);
});
test('buckets pick up sources and place flowing fluid in front; bottles fill from water',()=>{
  let g=game({'0,63,0':st('water')});assert.deepEqual(useLegacy(g,{id:'bucket'}),{success:true,result:'water_bucket'});assert.equal(g.get('0,63,0'),0);assert.deepEqual(g.sounds,NATIVE.sounds?['item.bucket.fill']:[]);
  g=game({'0,63,0':st('water',3)});assert.deepEqual(useLegacy(g,{id:'bucket'}),{success:false});
  g=game({'0,63,0':st('stone')});assert.deepEqual(useLegacy(g,{id:'lava_bucket'}),{success:true,result:'bucket'});assert.equal(g.get('0,64,0')>>4,blocksByName.flowing_lava.id);
  g=game({'0,63,0':st('water')});assert.deepEqual(useLegacy(g,{id:'glass_bottle'}),{success:true,result:'potion'});
});
