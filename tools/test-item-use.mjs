// Item.useOn / Item.use on this version's client (rules from client/js/game/item-use.js NATIVE).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initBlocks,findState,getBlock,getStateProperties,staticCollisionBoxes} from '../client/js/world/blocks.js';
import {NATIVE,useOnNative,useNative} from '../client/js/game/item-use.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
initBlocks(json('../client/data/blocks.json'),json('../client/data/blockCollisionShapes.json'));
function game(blocks={}){
  const states=new Map(Object.entries(blocks)),sounds=[],events=[];
  return {sounds,events,dimension:0,gameMode:0,player:{x:0.5,y:65,z:0.5},
    world:{getState:(x,y,z)=>states.get(x+','+y+','+z)??0,setState:(x,y,z,s)=>states.set(x+','+y+','+z,s),
      raycast:(ox,oy,oz,dx,dy,dz,range)=>{for(let d=0;d<range;d+=0.01){const py=oy+dy*d,x=Math.floor(ox+dx*d),y=Math.floor(py),z=Math.floor(oz+dz*d),s=states.get(x+','+y+','+z);if(s&&!getBlock(s).isLiquid){const top=Math.max(0,...staticCollisionBoxes(s).map(b=>b[4]??b.maxY??1));if(py-y<=top)return{x,y,z,face:1,dist:d,state:s};}}return null;}},
    eyePosition:()=>[0.5,66.62,0.5],lookVector:()=>[0,-1,0],interaction:{reach:()=>4.5},
    items:{name:id=>id},sound:{play:n=>sounds.push(n)},particles:{onWorldEvent:e=>events.push(e.effectId),campfireSmoke(){}},state:k=>states.get(k)};
}
const at=(n,p={})=>findState(n,p),t={x:0,y:64,z:0,face:1},nameAt=g=>getBlock(g.state('0,64,0')).name;
test('axe stripping follows this version (predicted only from 1.17), copper only where native',()=>{
  const g=game({'0,64,0':at('oak_log',{axis:'z'})});assert.deepEqual(useOnNative(g,{id:'iron_axe'},t),{success:true});assert.deepEqual(g.sounds,['item.axe.strip']);
  assert.equal(nameAt(g),NATIVE.predictAxe?'stripped_oak_log':'oak_log');
  if(NATIVE.copper.length){const c=game({'0,64,0':at('exposed_cut_copper')});useOnNative(c,{id:'iron_axe'},t);assert.equal(nameAt(c),'cut_copper');assert.deepEqual(c.events,[3005]);}
  else assert.equal(useOnNative(game({'0,64,0':at('stone')}),{id:'honeycomb'},t),null);
});
test('shovel, hoe and flint and steel follow this version',()=>{
  let g=game({'0,64,0':at('grass_block')});assert.deepEqual(useOnNative(g,{id:'iron_shovel'},t),{success:true});assert.deepEqual(g.sounds,['item.shovel.flatten']);
  g=game({'0,64,0':at('podzol')});assert.deepEqual(useOnNative(g,{id:'iron_shovel'},t),{success:NATIVE.flatten.includes('podzol')});
  const path=NATIVE.till.dirt_path!==undefined?'dirt_path':'grass_path';g=game({'0,64,0':at(path)});assert.deepEqual(useOnNative(g,{id:'iron_hoe'},t),{success:true});assert.deepEqual(g.sounds,['item.hoe.till']);
  g=game({'0,64,0':at('stone')});useOnNative(g,{id:'flint_and_steel'},t);assert.equal(getBlock(g.state('0,65,0')).name,'fire');
  g=game({'0,64,0':at('stone'),'0,65,0':at('stone')});assert.deepEqual(useOnNative(g,{id:'flint_and_steel'},t),{success:false,fail:true});
  if(NATIVE.campfire){g=game({'0,64,0':at('campfire',{lit:'false',waterlogged:'false'}),'0,65,0':at('stone')});useOnNative(g,{id:'flint_and_steel'},t);assert.equal(getStateProperties(g.state('0,64,0')).lit,'true');}
});
test('buckets and bottles',()=>{
  let g=game({'0,63,0':at('water',{level:0})});assert.deepEqual(useNative(g,{id:'bucket'}),{success:true,result:'water_bucket'});assert.equal(getBlock(g.state('0,63,0')).name,'air');assert.deepEqual(g.sounds,['item.bucket.fill']);
  g=game({'0,63,0':at('stone')});useNative(g,{id:'water_bucket'});assert.equal(getBlock(g.state('0,64,0')).name,'water');assert.deepEqual(g.sounds,['item.bucket.empty']);
  g=game({'0,63,0':at('water',{level:0})});assert.deepEqual(useNative(g,{id:'glass_bottle'}),{success:true,result:'potion'});
});
