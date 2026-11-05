import {getBlock,getStateProperties,findState} from '../world/blocks.js';
import {getFluidState} from '../world/fluids.js';

// SlabBlock.canBeReplaced/getStateForPlacement. A side click merges only
// through the empty half of the clicked slab. An adjacent destination slab
// can merge regardless of clicked face. Sneaking does not disable merging.
export function isSlab(block){return !!block?.name.endsWith('_slab')&&block.stateProperties?.some(p=>p.name==='type');}
export function canMergeSlab(world,block,pos,target=null){
 if(!isSlab(block))return false;
 const state=world.getState(pos.x,pos.y,pos.z);
 if(getBlock(state).name!==block.name)return false;
 const type=getStateProperties(state).type;
 if(type==='double')return false;
 if(!target)return type==='top'||type==='bottom';
 const high=target.hit[1]-pos.y>.5,side=target.face>=2;
 return type==='bottom'?(target.face===1||side&&high):(target.face===0||side&&!high);
}
export function slabPlacementState(world,block,pos,target){
 if(!isSlab(block))return undefined;
 const existing=world.getState(pos.x,pos.y,pos.z),props={...getStateProperties(block.defaultState)};
 if(getBlock(existing).name===block.name){props.type='double';if('waterlogged'in props)props.waterlogged='false';}
 else{
  props.type=target.face===0||target.face!==1&&target.hit[1]-pos.y>.5?'top':'bottom';
  const fluid=getFluidState(existing);
  if('waterlogged'in props)props.waterlogged=String(!!fluid?.isWater&&fluid.source);
 }
 return findState(block.name,props);
}
