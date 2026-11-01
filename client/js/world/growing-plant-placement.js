import {getBlock} from './blocks.js';
// GrowingPlantBlock.canSurvive: continue a matching plant or attach to its native sturdy face.
export function growingPlantSurvives(world,name,x,y,z) {
 const down=name==='weeping_vines'||name==='weeping_vines_plant';
 const up=name==='twisting_vines'||name==='twisting_vines_plant';
 if(!down&&!up)return null;
 const support=getBlock(world.getState(x,y+(down?1:-1),z));
 const family=name.replace(/_plant$/,'');
 return !!support&&(support.name===family||support.name===family+'_plant'||(down?support.sturdyBottom:support.sturdyTop)===true);
}
