import {blocksByName} from '../world/blocks.js';
// ItemSlab (pre-flattening): clicked-cell merging only uses Up/Down;
// adjacent-cell merging uses the matching material variant. No waterlogging.
const pairs={stone_slab:'double_stone_slab',wooden_slab:'double_wooden_slab',stone_slab2:'double_stone_slab2',purpur_slab:'purpur_double_slab'};
export const isSlab=block=>!!block&&!!pairs[block.name];
export function canMergeSlab(world,block,held,pos,target=null){
 if(!isSlab(block))return false;
 const state=world.getState(pos.x,pos.y,pos.z),variant=block.name==='purpur_slab'?0:held.damage&7;
 if((state>>4)!==block.id||(state&7)!==variant)return false;
 return !target||(state&8?target.face===0:target.face===1);
}
export function slabPlacementState(world,block,held,pos,target){
 if(!isSlab(block))return undefined;
 const variant=block.name==='purpur_slab'?0:held.damage&7;
 if(canMergeSlab(world,block,held,pos))return (blocksByName[pairs[block.name]].id<<4)|variant;
 const top=target.face===0||target.face!==1&&target.hit[1]-pos.y>.5;
 return (block.id<<4)|variant|(top?8:0);
}
