import{DIR_OFFSETS,DIR_NAMES,OPPOSITE,getBlock,getStateProperties,findState,blockFaceSupports}from'../world/blocks.js';
// BlockPlaceContext promotes the opposite clicked face, then uses the player's
// nearest look directions. Both wall and standing item variants use this order.
export function attachmentDirections(player,face,replaceClicked){
 const yaw=(player.yaw||0)*Math.PI/180,pitch=(player.pitch||0)*Math.PI/180,look=[-Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
 const directions=[0,1,2,3,4,5].sort((a,b)=>DIR_OFFSETS[b].reduce((v,n,i)=>v+n*look[i],0)-DIR_OFFSETS[a].reduce((v,n,i)=>v+n*look[i],0));
 if(!replaceClicked){const toward=OPPOSITE[face];directions.splice(directions.indexOf(toward),1);directions.unshift(toward);}return directions;
}
export function attachmentPlacement(world,block,pos,player,face,replaceClicked){
 const name=block.name,lantern=/^(soul_)?lantern$/.test(name),torch=/^(soul_|redstone_)?torch$/.test(name);
 if(!lantern&&!torch)return undefined;
 const directions=attachmentDirections(player,face,replaceClicked),supported=(dir,center)=>{const d=DIR_OFFSETS[dir];return blockFaceSupports(world.getState(pos.x+d[0],pos.y+d[1],pos.z+d[2]),OPPOSITE[dir],center);};
 const waterlogged=String(getBlock(world.getState(pos.x,pos.y,pos.z)).isWater===true);
 if(lantern){for(const dir of directions)if(dir<2&&supported(dir,true)){const props={...getStateProperties(block.defaultState),hanging:String(dir===1)};if('waterlogged'in props)props.waterlogged=waterlogged;return findState(name,props);}return null;}
 // WallTorchBlock resolves its first supported horizontal face independently.
 let wall=null;const wallName=name.replace(/torch$/,'wall_torch');
 for(const dir of directions)if(dir>=2&&supported(dir,false)){wall=findState(wallName,{facing:DIR_NAMES[OPPOSITE[dir]],...(name==='redstone_torch'?{lit:'true'}:{})});break;}
 for(const dir of directions){if(dir===1)continue;if(dir===0){if(supported(0,true))return block.defaultState;}else if(wall!==null)return wall;}
 return null;
}
