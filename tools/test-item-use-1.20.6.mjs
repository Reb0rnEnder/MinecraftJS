// Item.useOn / Item.use on the 1.20.6 client: predicted states, the local player's sounds and level events.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initBlocks,findState,getBlock,getStateProperties,staticCollisionBoxes} from '../client/js/world/blocks.js';
import {useOn766,use766,STRIPPABLES,PREVIOUS_COPPER,WAXABLES} from '../client/js/game/item-use-1.20.6.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
initBlocks(json('../client/data/blocks.json'),json('../client/data/blockCollisionShapes.json'));
function game(blocks={},look=[0,-1,0]){
  const states=new Map(Object.entries(blocks)),sounds=[],events=[];
  return {sounds,events,dimension:0,gameMode:0,player:{x:0.5,y:65,z:0.5},
    world:{getState:(x,y,z)=>states.get(x+','+y+','+z)??0,setState:(x,y,z,s)=>states.set(x+','+y+','+z,s),
      raycast:(ox,oy,oz,dx,dy,dz,range)=>{for(let d=0;d<range;d+=0.01){const py=oy+dy*d,x=Math.floor(ox+dx*d),y=Math.floor(py),z=Math.floor(oz+dz*d),s=states.get(x+','+y+','+z);if(s&&!getBlock(s).isLiquid){const top=Math.max(0,...staticCollisionBoxes(s).map(b=>b[4]??b.maxY??1));if(py-y<=top)return{x,y,z,face:1,dist:d,state:s};}}return null;}},
    eyePosition:()=>[0.5,66.62,0.5],lookVector:()=>look,interaction:{reach:()=>4.5},
    items:{name:id=>id},sound:{play:(n,...a)=>sounds.push(n)},particles:{onWorldEvent:e=>events.push(e.effectId),campfireSmoke(){},nativeParticle(){}},state:k=>states.get(k)};
}
const at=(name,props={})=>findState(name,props),t={x:0,y:64,z:0,face:1};
const nameAt=(g)=>getBlock(g.state('0,64,0')).name;
test('axes strip logs keeping the axis, scrape copper one stage with 3005, and take wax off with 3004',()=>{
  let g=game({'0,64,0':at('oak_log',{axis:'x'})});assert.deepEqual(useOn766(g,{id:'iron_axe'},t),{success:true});
  assert.equal(nameAt(g),'stripped_oak_log');assert.equal(getStateProperties(g.state('0,64,0')).axis,'x');assert.deepEqual(g.sounds,['item.axe.strip']);
  g=game({'0,64,0':at('weathered_cut_copper_stairs',{facing:'east',half:'top'})});useOn766(g,{id:'stone_axe'},t);
  assert.equal(nameAt(g),'exposed_cut_copper_stairs');assert.equal(getStateProperties(g.state('0,64,0')).facing,'east');assert.deepEqual([g.sounds,g.events],[['item.axe.scrape'],[3005]]);
  g=game({'0,64,0':at('waxed_copper_bulb',{lit:'true'})});useOn766(g,{id:'golden_axe'},t);assert.equal(nameAt(g),'copper_bulb');assert.deepEqual([g.sounds,g.events],[['item.axe.wax_off'],[3004]]);
  g=game({'0,64,0':at('stone')});assert.deepEqual(useOn766(g,{id:'iron_axe'},t),{success:false});assert.equal(g.sounds.length,0);
  assert.equal(STRIPPABLES.bamboo_block,'stripped_bamboo_block');assert.equal(PREVIOUS_COPPER.oxidized_copper,'weathered_copper');assert.equal(WAXABLES.copper_block,'waxed_copper_block');
});
test('shovels and hoes only play their sound on the client; fire and lighting are predicted; flint fails otherwise',()=>{
  let g=game({'0,64,0':at('grass_block')});assert.deepEqual(useOn766(g,{id:'iron_shovel'},t),{success:true});assert.equal(nameAt(g),'grass_block');assert.deepEqual(g.sounds,['item.shovel.flatten']);
  g=game({'0,64,0':at('dirt'),'0,65,0':at('stone')});assert.deepEqual(useOn766(g,{id:'iron_hoe'},t),{success:false});
  g=game({'0,64,0':at('rooted_dirt'),'0,65,0':at('stone')});assert.deepEqual(useOn766(g,{id:'iron_hoe'},{...t,face:0}),{success:true});assert.deepEqual(g.sounds,['item.hoe.till']);
  g=game({'0,64,0':at('campfire',{lit:'false',waterlogged:'false'})});useOn766(g,{id:'flint_and_steel'},t);assert.equal(getStateProperties(g.state('0,64,0')).lit,'true');assert.deepEqual(g.sounds,['item.flintandsteel.use']);
  g=game({'0,64,0':at('netherrack')});useOn766(g,{id:'flint_and_steel'},t);assert.equal(getBlock(g.state('0,65,0')).name,'fire');
  g=game({'0,64,0':at('soul_sand')});const charge={id:'fire_charge',count:2};useOn766(g,charge,t);assert.equal(getBlock(g.state('0,65,0')).name,'soul_fire');assert.equal(charge.count,1);assert.equal(g.sounds.length,0);
  g=game({'0,64,0':at('stone'),'0,65,0':at('stone')});assert.deepEqual(useOn766(g,{id:'flint_and_steel'},t),{success:false,fail:true});
  g=game({'0,64,0':at('cut_copper')});const comb={id:'honeycomb',count:3};useOn766(g,comb,t);assert.equal(nameAt(g),'waxed_cut_copper');assert.deepEqual(g.events,[3003]);assert.equal(comb.count,2);
});
test('buckets pick up sources and waterlogging, place fluids in front, and bottles fill from water',()=>{
  let g=game({'0,63,0':at('water',{level:0})});let r=use766(g,{id:'bucket'});assert.deepEqual(r,{success:true,result:'water_bucket'});assert.equal(getBlock(g.state('0,63,0')).name,'air');assert.deepEqual(g.sounds,['item.bucket.fill']);
  g=game({'0,63,0':at('water',{level:3})});assert.deepEqual(use766(g,{id:'bucket'}),{success:false});
  g=game({'0,63,0':at('oak_slab',{type:'bottom',waterlogged:'true'})});use766(g,{id:'bucket'});assert.equal(getStateProperties(g.state('0,63,0')).waterlogged,'false');
  g=game({'0,63,0':at('stone')});r=use766(g,{id:'lava_bucket'});assert.deepEqual(r,{success:true,result:'bucket'});assert.equal(getBlock(g.state('0,64,0')).name,'lava');assert.deepEqual(g.sounds,['item.bucket.empty_lava']);
  g=game({'0,63,0':at('water',{level:0})});assert.deepEqual(use766(g,{id:'glass_bottle'}),{success:true,result:'potion'});assert.deepEqual(g.sounds,['item.bottle.fill']);
  assert.equal(use766(game(),{id:'stick'}),null);
});
