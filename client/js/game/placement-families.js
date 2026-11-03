import{getBlock,blockFaceSupports,nativePlacementRule,nativePlantSoil,nativeRigidTop,nativeReplaceable}from'../world/blocks.js';
import{getFluidState}from'../world/fluids.js';
// Rules are classified from native canSurvive ownership, not a list of item
// names. New variants of these native families inherit the same checked rules.
// Context-dependent overrides remain explicit in the generated audit report.
export function familyCanSurvive(world,name,p){
 const rule=nativePlacementRule(name);if(!rule)return null;
 const below=world.getState(p.x,p.y-1,p.z),above=world.getState(p.x,p.y+1,p.z);
 switch(rule.kind){
  case'plate':return nativeRigidTop(below)||blockFaceSupports(below,1,true);
  case'rail':return nativeRigidTop(below);
  case'carpet':return !getBlock(below).isAir;
  case'hanging_roots':return blockFaceSupports(above,0,false);
  case'spore_blossom':return blockFaceSupports(above,0,true)&&!getFluidState(world.getState(p.x,p.y,p.z))?.isWater;
  case'bush':case'double_bush':{
   const soil=rule.dirtTag&&world.registryTags?getBlock(below).name==='farmland'||world.registryTags.contains('blocks','minecraft:dirt',getBlock(below).id):nativePlantSoil(name,below);
   if(!soil)return false;
   if(rule.kind==='double_bush')return p.y+1<(world.maxY??256)&&(getBlock(above).name==='snow'?getBlock(above).defaultState===above:nativeReplaceable(above)===true);
   return true;
  }
 }
 return null;
}
