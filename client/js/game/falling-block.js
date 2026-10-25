import { getBlock } from '../world/blocks.js';
import { calcXOffset, calcYOffset, calcZOffset } from './physics.js';
// EntityFallingBlock client movement: remove the source once, collide the 0.98-wide body,
// and leave landing/block creation to server updates.
export function tickFallingBlock(e,world) {
  if(!e.fallingStarted){
    e.fallingStarted=true;
    const x=Math.floor(e.x),y=Math.floor(e.y),z=Math.floor(e.z);
    if(getBlock(world.getState(x,y,z)).id===getBlock(e.blockState).id)world.setState(x,y,z,0);
  }
  // The block update and destroy packet can arrive on adjacent frames. Do not move the
  // redundant entity onto the top of its synchronized block and obstruct placement there.
  e.fallingSettled=world.getState(Math.floor(e.x),Math.floor(e.y),Math.floor(e.z))===e.blockState;
  if(e.fallingSettled){e.motionX=e.motionY=e.motionZ=0;return;}
  if(!e.noGravity)e.motionY-=Math.fround(.04);
  let dx=e.motionX,dy=e.motionY,dz=e.motionZ;
  const half=(e.width||Math.fround(.98))/2,bb=[e.x-half,e.y,e.z-half,e.x+half,e.y+(e.height||Math.fround(.98)),e.z+half];
  const swept=[bb[0]+Math.min(0,dx),bb[1]+Math.min(0,dy),bb[2]+Math.min(0,dz),bb[3]+Math.max(0,dx),bb[4]+Math.max(0,dy),bb[5]+Math.max(0,dz)];
  const boxes=world.getCollisions(swept,e);
  for(const box of boxes)dy=calcYOffset(box,bb,dy);bb[1]+=dy;bb[4]+=dy;
  for(const box of boxes)dx=calcXOffset(box,bb,dx);bb[0]+=dx;bb[3]+=dx;
  for(const box of boxes)dz=calcZOffset(box,bb,dz);bb[2]+=dz;bb[5]+=dz;
  e.x=(bb[0]+bb[3])/2;e.y=bb[1];e.z=(bb[2]+bb[5])/2;
  e.onGround=dy!==e.motionY&&e.motionY<0;
  if(dx!==e.motionX)e.motionX=0;if(dy!==e.motionY)e.motionY=0;if(dz!==e.motionZ)e.motionZ=0;
  e.motionX*=Math.fround(.98);e.motionY*=Math.fround(.98);e.motionZ*=Math.fround(.98);
}
