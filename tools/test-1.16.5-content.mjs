import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
import {Items}from'../client/js/game/items.js';import {Inventory,ContainerWindow}from'../client/js/game/container.js';
import {smithingResult}from'../client/js/game/workstations-1.16.5.js';
import {openContainerScreen}from'../client/js/gui/screens/containers.js';
import {applyNetherMetadata}from'../client/js/game/nether-metadata.js';
import {NATIVE_METADATA}from'../client/js/game/entity-metadata-1.16.5.js';
import {setJarModels,hoglin,piglin,strider}from'../client/js/render/entity-models.js';
const data=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));
function fixture(){
 const assets={data:{items:data('items'),creative:data('creative')},itemsByName:new Map(data('items').map(d=>[d.name,d])),translate:k=>k,textures:new Map()};
 const g={assets,settings:{},gui:{width:480,height:320},sound:{playUi(){}},screens:{open(s){this.current=s;s.init();}},serverRecipes:[]};
 g.items=new Items(assets);g.inventory=new Inventory(g);
 const stack=(name,count=1)=>({id:assets.itemsByName.get(name).id,count,nbt:null});
 g.serverRecipes=[{type:'minecraft:smithing',recipeId:'minecraft:netherite_sword',data:{base:[stack('diamond_sword')],addition:[stack('netherite_ingot')],result:stack('netherite_sword')}}];
 return {g,stack};
}
test('smithing preserves full base NBT without aliasing and consumes exactly one item from each input',()=>{
 const {g,stack}=fixture(),win=new ContainerWindow(g,7,'minecraft:smithing','Upgrade',3),base=stack('diamond_sword');
 base.nbt={t:10,name:'',v:{Damage:{t:3,v:17},display:{t:10,v:{Name:{t:8,v:'{"text":"Named"}'}}}}};
 const result=smithingResult(g,base,stack('netherite_ingot'));assert.equal(g.items.name(result.id),'netherite_sword');assert.deepEqual(result.nbt,base.nbt);assert.notEqual(result.nbt,base.nbt);
 win.put(0,base);win.put(1,stack('netherite_ingot',3));assert.equal(win.canTake(2),true);assert.equal(win.isValid(2,base),false);
 win.slotClick(2,0,0);assert.equal(g.items.name(g.inventory.cursor.id),'netherite_sword');assert.equal(win.get(0),null);assert.equal(win.get(1).count,2);assert.equal(win.get(2),null);assert.equal(base.nbt.v.Damage.v,17);
});
test('smithing shift-click sends addition to slot 1 and base to slot 0; GUI has native slots and labels',()=>{
 const {g,stack}=fixture(),win=new ContainerWindow(g,7,'minecraft:smithing','Upgrade',3);
 g.inventory.main[9]=stack('netherite_ingot',2);win.transferStackInSlot(3);assert.equal(g.items.name(win.get(1).id),'netherite_ingot');
 g.inventory.main[9]=stack('diamond_sword');win.transferStackInSlot(3);assert.equal(g.items.name(win.get(0).id),'diamond_sword');
 openContainerScreen(g,win);const s=g.screens.current;assert.equal(s.titleX,60);assert.equal(s.titleY,18);assert.deepEqual(s.slotPos.slice(0,3),[[0,27,47],[1,76,47],[2,134,47]]);
 win.transferStackInSlot(2);assert.equal(win.get(0),null);assert.equal(win.get(1).count,1);assert.ok(g.inventory.main.some(it=>it&&g.items.name(it.id)==='netherite_sword'));
});
test('native Nether metadata distinguishes immunity, baby, dance, charging, cold and saddle flags',()=>{
 for(const name of['hoglin','zoglin','piglin','piglin_brute','zombified_piglin','strider']){
  const ids=NATIVE_METADATA[name],e={entityName:name},wire={};if(ids.DATA_BABY_ID!==undefined)wire[ids.DATA_BABY_ID]=true;
  for(const key of['DATA_IS_DANCING','DATA_IS_CHARGING_CROSSBOW','DATA_SUFFOCATING','DATA_SADDLE_ID'])if(ids[key]!==undefined)wire[ids[key]]=true;
  applyNetherMetadata(e,wire);if(ids.DATA_BABY_ID!==undefined)assert.equal(e.child,true,name);
  if(name==='piglin'){assert.equal(e.dancing,true);assert.equal(e.crossbowCharging,true);}
  if(name==='strider'){assert.equal(e.striderCold,true);assert.equal(e.saddled,true);}
  applyNetherMetadata(e,{0:0});if(name==='piglin')assert.equal(e.dancing,true,'unrelated delta preserves state');
 }
});
test('native Nether models have finite resettable poses and retain child part hierarchies',()=>{
 setJarModels(JSON.parse(readFileSync(new URL('../client/assets/bundles/entity-models.json',import.meta.url))));
 for(const make of[hoglin,piglin,()=>piglin(true),strider]){
  const m=make();for(const piglinPose of['dancing','attacking','admiring','crossbow_hold','crossbow_charge','default'])for(const child of[false,true]){
   m.animate(m,{ls:2,lsa:.2,age:30,yaw:15,pitch:-10,swing:.3,attackTicks:5,piglinPose,child});
   const visit=p=>{for(const key of['px','py','pz','rx','ry','rz'])assert.ok(Number.isFinite(p[key]),m.jarModel+'.'+key);p.children.forEach(visit);};m.roots.forEach(visit);
  }
 }
 const m=hoglin();m.animate(m,{attackTicks:5});assert.ok(Math.abs(m.parts.head.rx+.34906584)<1e-6);m.animate(m,{attackTicks:0});assert.ok(Math.abs(m.parts.head.rx-.87266463)<1e-6);
});

test('tool speed tables include hoe-effective Nether blocks and Netherite tools',()=>{
 const {g,stack}=fixture();
 assert.equal(g.items.strVsBlock(stack('netherite_hoe'),{name:'shroomlight'}),9);
 assert.equal(g.items.strVsBlock(stack('diamond_hoe'),{name:'oak_leaves'}),8);
 assert.equal(g.items.strVsBlock(stack('netherite_pickaxe'),{name:'stone'}),9);
 assert.equal(g.items.strVsBlock(stack('netherite_sword'),{name:'cobweb'}),15);
 assert.equal(g.items.strVsBlock(stack('netherite_hoe'),{name:'stone'}),1);
});
test('lodestone compasses glint, use their target dimension, and keep yaw wobble stable within a tick',async()=>{
 const {compassProperty}=await import('../client/js/render/compass.js'),{g,stack}=fixture(),item=stack('compass');
 item.nbt={t:10,name:'',v:{LodestoneDimension:{t:8,v:'minecraft:the_nether'},LodestonePos:{t:10,v:{X:{t:3,v:10},Y:{t:3,v:20},Z:{t:3,v:0}}}}};
 assert.equal(g.items.hasEffect(item),true);Object.assign(g,{worldName:'minecraft:the_nether',world:{worldAge:1},dimension:-1,player:{x:0,y:20,z:0,yaw:0},entityId:1});
 const state={},first=compassProperty(g,item,null,state);assert.equal(compassProperty(g,item,null,state),first);assert.ok(first>=0&&first<1);
 g.worldName='minecraft:overworld';compassProperty(g,item,null,state);assert.ok(state.random,'wrong dimension uses random wobble');
});
