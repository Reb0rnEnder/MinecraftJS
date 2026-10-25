import{test}from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from 'node:fs';
import{createRequire}from 'node:module';import{validateVisualRuntime}from './port-1.14.4/validate-visual-runtime.mjs';
import{initBlocks,blocksByName,getBlock,findState}from '../client/js/world/blocks.js';import{World}from '../client/js/world/world.js';import{Chunk}from '../client/js/world/chunk.js';import{LocalPlayer}from '../client/js/game/physics.js';import{Mesher,faceFlags}from '../client/js/render/mesher.js';
import{EntityManager}from '../client/js/game/entities.js';import{EntityRenderer}from '../client/js/render/entity-renderer.js';import{setJarModels}from '../client/js/render/entity-models.js';import{ENTITY_TYPES,MOB_FAMILIES}from '../client/js/game/entity-types.js';import{villagerLayers}from '../client/js/render/villager-layers.js';import{NATIVE_METADATA}from '../client/js/game/entity-metadata-1.14.4.js';
const require=createRequire(import.meta.url),{ZipFile}=require('../lib/zip'),{extractModels,assertCompleteModels}=require('../lib/modelextract');
const data=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url))),definitions=data('blocks'),shapes=data('blockCollisionShapes'),jar=new ZipFile(new URL('../cache/port-1.14.4/client.jar',import.meta.url).pathname),models=assertCompleteModels(extractModels(jar));initBlocks(definitions,shapes);setJarModels(models);
test('every native block state has jar-derived light, shade and occlusion behavior and all 64 mobs have valid native textures/models',()=>{
 assert.deepEqual(validateVisualRuntime(jar,models),{states:11271,mobs:64,textures:114});
 ENTITY_TYPES.push({id:999,name:'unmapped_future_entity',mob:false});
 try{assert.throws(()=>validateVisualRuntime(jar,models),/renderer classification/);}finally{ENTITY_TYPES.pop();}
 const missingTexture={data:jar.data,read:path=>path.endsWith('/villager/villager.png')?null:jar.read(path)};
 assert.throws(()=>validateVisualRuntime(missingTexture,models),/texture is absent/);
 for(let state=0;state<11271;state++){const p=shapes.render.values[shapes.render.states[state]],b=getBlock(state);assert.equal(b.opaque,p.solid);assert.equal(b.aoLight,p.shade);assert.equal(b.filterLight,p.lightBlock);assert.equal(b.emitLight,p.emission);}
 const stale=structuredClone(shapes);stale.render.source.clientJarSha1='stale';assert.throws(()=>validateVisualRuntime(jar,models,stale),/missing\/stale/);
});
test('campfires and other partial new blocks do not hide adjacent block faces or create full-cube ambient occlusion',()=>{
 const stone=findState('stone'),mesher={_flags:faceFlags(),options:{fancy:true}};
 for(const name of ['campfire','stonecutter','lectern','bamboo','bell','lantern','grindstone']){
  const state=blocksByName[name].defaultState;assert.equal(getBlock(state).opaque,false,name);assert.equal(getBlock(state).aoLight,1,name);assert.equal(Mesher.prototype.shouldRenderFace.call(mesher,stone,state,5),true,name);
 }
 assert.equal(getBlock(findState('campfire',{lit:'true'})).emitLight,15);assert.equal(getBlock(findState('campfire',{lit:'false'})).emitLight,0);
 assert.equal(Mesher.prototype.shouldRenderFace.call(mesher,stone,stone,5),false);
});
test('players step onto campfires and stonecutters and stay there without a false suffocation push',()=>{
 const w=new World();for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)w.chunks.set(x+','+z,new Chunk(x,z,true));
 for(let x=0;x<10;x++)for(let z=0;z<2;z++)w.getChunk(0,0).setState(x,0,z,findState('stone'));
 for(const [name,height]of [['campfire',.4375],['stonecutter',.5625]]){
  w.getChunk(0,0).setState(2,1,0,findState(name));const p=new LocalPlayer();p.setPosition(1.5,1,.5);p.onGround=true;p.yaw=-90;
  let peak=1;for(let i=0;i<15;i++){p.tick(w,{forward:true});peak=Math.max(peak,p.y);}assert.ok(peak>=1+height-1e-6,name+' step');
  p.setPosition(2.5,1+height,.5);p.motionX=p.motionY=p.motionZ=0;for(let i=0;i<25;i++)p.tick(w,{});
  assert.equal(p.x,2.5,name);assert.equal(p.y,1+height,name);assert.equal(p.z,.5,name);
 }
});
test('villagers consume native structured profession metadata and all new mobs are classified as living',()=>{
 const r=Object.create(EntityRenderer.prototype);
 for(const name of ['villager','wandering_trader','trader_llama','cat','fox','panda','pillager','ravager']){
  const def=ENTITY_TYPES.find(d=>d.name===name);assert.equal(def.mob,true,name);
  const e={kind:'mob',entityName:name,type:MOB_FAMILIES[name]?.[0]||name,metadata:{},health:20};
  if(name==='villager')e.metadata[NATIVE_METADATA.villager.DATA_VILLAGER_DATA]={villagerType:0,villagerProfession:5,level:3};
  if(name==='cat')e.metadata[NATIVE_METADATA.cat.DATA_TYPE_ID]=9;
  EntityManager.prototype._applyMeta.call({},e);assert.ok(r._modelFor(e),name);assert.ok(jar.read('assets/minecraft/textures/'+r._texFor(e)),name);
  if(name==='villager'){assert.equal(e.profession,5);assert.equal(e.villagerLevel,3);assert.equal(villagerLayers(e)[1].texture,'entity/villager/profession/farmer.png');}
  if(name==='cat')assert.equal(e.catType,9);
 }
});
test('villager biome hats honor profession metadata and resource pack overrides',()=>{
 assert.equal(villagerLayers({villagerType:2,profession:5})[0].hideHat,true);
 assert.equal(villagerLayers({villagerType:0,profession:2})[0].hideHat,true);
 assert.equal(villagerLayers({villagerType:2,profession:2})[0].hideHat,false);
 assert.equal(villagerLayers({villagerType:2,profession:5},{})[0].hideHat,false);
 assert.equal(villagerLayers({villagerType:2,profession:5,child:true}).length,1);
});
test('shadow projection uses the actual World lighting interface',async()=>{
 const {shadowGeometry}=await import('../client/js/render/shadows.js');
 const world=new World(),chunk=new Chunk(0,0,true);world.chunks.set('0,0',chunk);chunk.setState(0,0,0,findState('stone'));chunk.heightMap.fill(1);
 const mesh=shadowGeometry(world,{x:.5,y:1,z:.5},.5);assert.ok(mesh.length);
});
