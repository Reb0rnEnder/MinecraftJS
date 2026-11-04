import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {golemCrackTexture} from '../client/js/render/iron-golem-cracks.js';
import {EntityRenderer} from '../client/js/render/entity-renderer.js';
import {EntityManager} from '../client/js/game/entities.js';
import {ENTITY_TYPES} from '../client/js/game/entity-types.js';
import {setJarModels} from '../client/js/render/entity-models.js';
import {setModelDevice} from '../client/js/render/boxmodel.js';
setJarModels(JSON.parse(readFileSync(new URL('../client/assets/bundles/entity-models.json',import.meta.url))));
function fixture(){
 const device={createMesh:(format,cpu,opts)=>({format,cpu,...opts}),destroyMesh(){}};setModelDevice(device);
 const game={device,assets:{atlasTexture:{}},ticks:0,settings:{},items:{name:()=>'',nbt:()=>null},entities:{get:()=>null},world:{getState:()=>0},player:{},inventory:{}};
 const manager=new EntityManager(game);game.entities=manager;
 const type=Object.keys(ENTITY_TYPES).find(id=>ENTITY_TYPES[id].name==='iron_golem');assert.ok(type);
 manager.spawnMob({entityId:4,type:+type,x:0,y:64,z:0,yaw:0,pitch:0,headPitch:0,entityUUID:'00000000-0000-0000-0000-000000000004',velocity:{x:0,y:0,z:0},metadata:{}});
 const e=manager.get(4),r=Object.create(EntityRenderer.prototype);Object.assign(r,{game,device,atlasTex:()=>game.assets.atlasTexture,_addShadow(){},_updateHeld(){},_updateHeadItem(){},_updateNameTag(){}});
 return {e,r,manager};
}
test('native strict thresholds include the exact 75/50/25 percent boundaries',()=>{
 for(const [hp,stage]of [[100,null],[75,null],[74,'low'],[50,'low'],[49,'medium'],[25,'medium'],[24,'high'],[0,'high']]){
  const path=golemCrackTexture(hp,100);assert.equal(path,stage?'entity/iron_golem/iron_golem_crackiness_'+stage+'.png':null);
  if(path)assert.ok(existsSync(new URL('../client/assets/minecraft/textures/'+path,import.meta.url)));
  assert.equal(golemCrackTexture(hp*2,200),path,'uses percentage, including custom maximum health');
 }
});
test('actual golem renderer tracks damage, repair, invisibility and distant pose skipping',()=>{
 const {e,r,manager}=fixture();assert.equal(e.health,100);assert.equal(e.maxHealth,100);
 manager.setAttributes({entityId:e.id,properties:[{key:'generic.maxHealth',value:200,modifiers:[]}]});assert.equal(e.maxHealth,200);e.maxHealth=100;
 const v=r._buildLiving(e),layer=v.golemCracks;assert.ok(layer);assert.equal(layer.mat.params.p[10],0,'not fullbright');
 const render=()=>r._renderLiving(e,v,{x:0,y:64,z:0},.5);
 render();assert.equal(layer.obj.visible,false);
 e.health=70;e.attackTimer=6;render();assert.equal(layer.obj.visible,true);assert.ok(layer.mat.tex.endsWith('_low.png'));
 assert.equal(layer.model.parts.rightArm.rx,v.model.parts.rightArm.rx,'overlay copies the actual animated pose');
 assert.equal(layer.obj.scale.x,1,'native overlay is not inflated');
 v.lodSkip=true;e.health=20;render();assert.ok(layer.mat.tex.endsWith('_high.png'));
 e.health=100;render();assert.equal(layer.obj.visible,false,'repair hides cracks during skipped poses');
 e.health=40;e.invisible=true;render();assert.equal(layer.obj.visible,false);
 e.invisible=false;render();assert.ok(layer.mat.tex.endsWith('_medium.png'));assert.equal(layer.obj.visible,true);
});
