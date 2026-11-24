// Native 1.20.6 entity metadata: the generated accessor table drives consumers whose layout changed after 1.19.4
// (effect particles, area effect clouds, llamas, horses, zombies, skeletons, shulkers, witches), plus horse armour.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EntityManager,effectParticleColor} from '../client/js/game/entities.js';
import {NATIVE_METADATA} from '../client/js/game/entity-metadata-1.20.6.js';
import {horseArmor766} from '../client/js/render/horse-armor-1.20.6.js';
const E=Object.create(EntityManager.prototype);E.game={ticks:0,assets:{data:{}},settings:{},items:{def:id=>({7:{name:'red_carpet'}})[id]||null}};E.map=new Map();
const run=(entityName,kind,symbols)=>{const ids=NATIVE_METADATA[entityName],wire={};for(const [k,v] of Object.entries(symbols)){assert.ok(ids[k]!==undefined,entityName+'.'+k);wire[ids[k]]=v;}const e={id:1,entityName,kind,ticks:0,type:entityName,metadata:wire,equipment:[]};E._applyMeta(e,wire);return e;};
test('the 1.20.6 table carries the 1.20.2/1.20.5 layout changes',()=>{
  assert.equal(NATIVE_METADATA.zombie.DATA_EFFECT_PARTICLES,10);assert.equal(NATIVE_METADATA.zombie.DATA_EFFECT_COLOR_ID,undefined);
  assert.equal(NATIVE_METADATA.text_display.DATA_TEXT_ID,23);assert.equal(NATIVE_METADATA.llama.DATA_VARIANT_ID,20);assert.equal(NATIVE_METADATA.llama.DATA_SWAG_ID,undefined);
  assert.deepEqual([NATIVE_METADATA.area_effect_cloud.DATA_WAITING,NATIVE_METADATA.area_effect_cloud.DATA_PARTICLE],[9,10]);
});
test('living effect particles and area effect clouds read native particle options',()=>{
  const z=run('zombie','mob',{DATA_EFFECT_PARTICLES:[{type:'entity_effect',data:0xff336699}],DATA_EFFECT_AMBIENCE_ID:true});
  assert.equal(effectParticleColor(z.effectParticles[0]),0x336699);assert.equal(z.potionAmbient,true);assert.equal(z.potionColor,undefined);
  const c=run('area_effect_cloud','object',{DATA_RADIUS:2.5,DATA_WAITING:true,DATA_PARTICLE:{type:'entity_effect',data:0xff00ff00}});
  assert.deepEqual([c.radius,c.singlePoint,c.cloudColor],[2.5,true,0x00ff00]);
});
test('horses, llamas and chested horses read their own fields',()=>{
  const h=run('horse','mob',{DATA_ID_FLAGS:2|4,DATA_ID_TYPE_VARIANT:0x0203});assert.equal(h.horseVariant,0x0203);assert.equal(h.ownerUuid,undefined);
  const l=run('llama','mob',{DATA_ID_FLAGS:2,DATA_ID_CHEST:true,DATA_STRENGTH_ID:3,DATA_VARIANT_ID:2});assert.deepEqual([l.horseChest,l.llamaStrength,l.llamaVariant],[true,3,2]);
  const d=run('donkey','mob',{DATA_ID_CHEST:true});assert.equal(d.horseChest,true);
  E.map.set(1,l);E.setEquipment(1,6,{id:7,count:1});assert.equal(l.llamaCarpet,14,'red carpet in the body slot');E.setEquipment(1,6,null);assert.equal(l.llamaCarpet,-1);
});
test('zombie/skeleton arms follow Mob.isAggressive; conversions shake; shulker and witch fields',()=>{
  const z=run('zombie','mob',{DATA_MOB_FLAGS_ID:4,DATA_DROWNED_CONVERSION_ID:false});assert.equal(z.armsRaised,true);assert.equal(z.converting,false);
  const zd=run('zombie','mob',{DATA_MOB_FLAGS_ID:0,DATA_DROWNED_CONVERSION_ID:true});assert.equal(zd.armsRaised,false);assert.equal(zd.converting,true);
  const zv=run('zombie_villager','mob',{DATA_CONVERTING_ID:true});assert.equal(zv.curing,true);assert.equal(zv.converting,true);
  const s=run('skeleton','mob',{DATA_MOB_FLAGS_ID:4,DATA_STRAY_CONVERSION_ID:true});assert.equal(s.armsRaised,true);assert.equal(s.converting,true);
  const sh=run('shulker','mob',{DATA_ATTACH_FACE_ID:2,DATA_PEEK_ID:30,DATA_COLOR_ID:5});assert.deepEqual([sh.attachFace,sh.peekTick,sh.shulkerColor],[2,30,5]);
  const w=run('witch','mob',{DATA_USING_ITEM:true});assert.equal(w.witchAggressive,true);
});
test('horse armour layer: native materials, default and dyed leather colour',()=>{
  const items={name:id=>({1:'diamond_horse_armor',2:'leather_horse_armor',3:'golden_horse_armor',4:'saddle'})[id],component:(s,k)=>s.dye};
  assert.equal(horseArmor766(items,{id:1}).texture,'entity/horse/armor/horse_armor_diamond.png');assert.equal(horseArmor766(items,{id:3}).texture,'entity/horse/armor/horse_armor_gold.png');
  assert.deepEqual(horseArmor766(items,{id:2}).color.map(c=>Math.round(c*255)),[0xa0,0x65,0x40]);assert.deepEqual(horseArmor766(items,{id:2,dye:{rgb:0x112233}}).color.map(c=>Math.round(c*255)),[0x11,0x22,0x33]);
  assert.equal(horseArmor766(items,{id:4}),null);assert.equal(horseArmor766(items,null),null);
});
