import { calcXOffset, calcYOffset, calcZOffset } from './physics.js';
// Native ItemEntity movement, using swept block shapes instead of an opaque-cell test.
const MODERN_REST=true;
const GRAVITY=0.04, VERTICAL_DRAG=0.98;
export function tickDroppedItem(e,world){
  if(!e.noGravity)e.motionY-=GRAVITY;
  // Introduced with the 1.14 item movement optimization; older clients move every tick.
  if(MODERN_REST&&e.onGround&&e.motionX*e.motionX+e.motionZ*e.motionZ<=Math.fround(1e-5)&&((e.ticks||0)+e.id)%4!==0)return;
  let dx=e.motionX,dy=e.motionY,dz=e.motionZ;
  const half=(e.width||.25)/2,bb=[e.x-half,e.y,e.z-half,e.x+half,e.y+(e.height||.25),e.z+half];
  const swept=[bb[0]+Math.min(0,dx),bb[1]+Math.min(0,dy),bb[2]+Math.min(0,dz),bb[3]+Math.max(0,dx),bb[4]+Math.max(0,dy),bb[5]+Math.max(0,dz)];
  const boxes=world.getCollisions(swept,e);
  for(const box of boxes)dy=calcYOffset(box,bb,dy);bb[1]+=dy;bb[4]+=dy;
  // Modern Entity.collide resolves the larger horizontal displacement first.
  const zFirst=true&&Math.abs(dx)<Math.abs(dz);
  if(zFirst){for(const box of boxes)dz=calcZOffset(box,bb,dz);bb[2]+=dz;bb[5]+=dz;}
  for(const box of boxes)dx=calcXOffset(box,bb,dx);bb[0]+=dx;bb[3]+=dx;
  if(!zFirst){for(const box of boxes)dz=calcZOffset(box,bb,dz);bb[2]+=dz;bb[5]+=dz;}
  e.x=(bb[0]+bb[3])/2;e.y=bb[1];e.z=(bb[2]+bb[5])/2;
  e.onGround=dy!==e.motionY&&e.motionY<0;
  if(dx!==e.motionX)e.motionX=0;if(dy!==e.motionY)e.motionY=0;if(dz!==e.motionZ)e.motionZ=0;
  let drag=Math.fround(.98);
  if(e.onGround){const b=world.getBlockDef(Math.floor(e.x),Math.floor(e.y-1),Math.floor(e.z));drag=Math.fround(Math.fround(b?.slipperiness??.6)*Math.fround(.98));}
  e.motionX*=drag;e.motionY*=VERTICAL_DRAG;e.motionZ*=drag;
  if(e.onGround&&e.motionY<0)e.motionY*=-.5;
}
