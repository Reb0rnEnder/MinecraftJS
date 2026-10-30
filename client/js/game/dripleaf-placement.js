import {DEFAULT_TAGS} from './default-tags.js';
import {getBlock} from '../world/blocks.js';
import {getFluidState} from '../world/fluids.js';
const hasTag=(world,name,id)=>world.registryTags?world.registryTags.contains('blocks','minecraft:'+name,id):(DEFAULT_TAGS.blocks['minecraft:'+name]||[]).includes(id);
// Native target BlockItem.canPlace / dripleaf canSurvive. Null means another block.
export function dripleafCanSurvive(world,name,x,y,z){
 if(name!=='big_dripleaf'&&name!=='small_dripleaf')return null;
 const below=getBlock(world.getState(x,y-1,z));
 if(name==='big_dripleaf')return below.name==='big_dripleaf'||below.name==='big_dripleaf_stem'||below.sturdyTop===true;
 return hasTag(world,'small_dripleaf_placeable',below.id)||!!getFluidState(world.getState(x,y,z))?.isWater&&(hasTag(world,'dirt',below.id)||below.name==='farmland');
}
