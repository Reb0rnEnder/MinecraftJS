// The native-symbol metadata pass: given a complete packet for this release (every accessor present, each with a
// distinct value), the corrected fields come from their native accessors, and removed fields are cleared.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EntityManager} from '../client/js/game/entities.js';
import {NATIVE_ENTITY_METADATA as T} from '../client/js/game/entity-metadata-native.js';
const E=Object.create(EntityManager.prototype);E.game={ticks:0,assets:{data:{}},settings:{},items:{def:()=>null}};E.map=new Map();
function apply(name,overrides={}){
  const ids=T[name],wire={};for(const [s,i] of Object.entries(ids))wire[i]=1000+i;
  for(const [s,v] of Object.entries(overrides))wire[ids[s]]=v;
  const e={id:1,entityName:name,kind:'mob',type:name,ticks:0,metadata:{...wire},equipment:[]};E._applyMeta(e,e.metadata);return {e,ids,v:s=>wire[ids[s]]};
}
test('horses and llamas read variant, chest, strength and carpet from their own accessors',()=>{
  const {e,v}=apply('horse',{DATA_ID_FLAGS:2|4});assert.equal(e.horseVariant,v('DATA_ID_TYPE_VARIANT'));
  if(T.horse.DATA_ID_OWNER_UUID===undefined)assert.equal(e.ownerUuid,undefined);
  const l=apply('llama',{DATA_ID_CHEST:true,DATA_ID_FLAGS:2});assert.equal(l.e.llamaVariant,l.v('DATA_VARIANT_ID'));assert.equal(l.e.llamaStrength,l.v('DATA_STRENGTH_ID'));assert.equal(l.e.horseChest,true);
  if(T.llama.DATA_SWAG_ID!==undefined)assert.equal(l.e.llamaCarpet,l.v('DATA_SWAG_ID'));
  const d=apply('donkey',{DATA_ID_CHEST:false,DATA_ID_FLAGS:2});assert.equal(d.e.horseChest,false);assert.equal((d.e.horseFlags??0)&8,0);
});
test('zombies and skeletons raise arms only when aggressive; conversions shake without raising arms',()=>{
  for(const name of ['zombie','zombie_villager','husk','drowned']){if(!T[name])continue;
    const calm=apply(name,{DATA_MOB_FLAGS_ID:0,DATA_DROWNED_CONVERSION_ID:false,...(T[name].DATA_CONVERTING_ID!==undefined?{DATA_CONVERTING_ID:false}:{})});
    assert.equal(calm.e.armsRaised,false,name);assert.equal(calm.e.converting,false,name+' does not shake while its villager data is set');
    const angry=apply(name,{DATA_MOB_FLAGS_ID:4,DATA_DROWNED_CONVERSION_ID:true});assert.equal(angry.e.armsRaised,true);assert.equal(angry.e.converting,true);
  }
  const s=apply('skeleton',{DATA_MOB_FLAGS_ID:4});assert.equal(s.e.armsRaised,true);
});
test('shulker peek, colour and attachment, and witch drinking read their own accessors',()=>{
  const {e,v}=apply('shulker');assert.equal(e.peekTick,v('DATA_PEEK_ID'));assert.equal(e.shulkerColor,v('DATA_COLOR_ID'));
  if(T.shulker.DATA_ATTACH_POS_ID===undefined)assert.equal(e.attachPosition,undefined);else assert.equal(e.attachPosition,v('DATA_ATTACH_POS_ID'));
  if(T.witch.DATA_USING_ITEM!==undefined){assert.equal(apply('witch',{DATA_USING_ITEM:true}).e.witchAggressive,true);assert.equal(apply('witch',{DATA_USING_ITEM:false}).e.witchAggressive,false);}
});
