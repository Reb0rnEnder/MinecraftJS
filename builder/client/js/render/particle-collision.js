import {calcXOffset,calcYOffset,calcZOffset} from '../game/physics.js';
// Particle collision uses its small swept AABB and actual block shapes, not block opacity.
export function moveParticle(p,world){
 const dx=p.mx||0,dy=p.my||0,dz=p.mz||0;p.onGround=false;
 if(!p.collide){p.x+=dx;p.y+=dy;p.z+=dz;return;}
 const width=p.width??.2,height=p.height??.2,r=width/2,bb=[p.x-r,p.y,p.z-r,p.x+r,p.y+height,p.z+r];
 const swept=[bb[0]+Math.min(0,dx),bb[1]+Math.min(0,dy),bb[2]+Math.min(0,dz),bb[3]+Math.max(0,dx),bb[4]+Math.max(0,dy),bb[5]+Math.max(0,dz)];
 const boxes=world.getCollisions(swept);let x=dx,y=dy,z=dz;
 for(const box of boxes)y=calcYOffset(box,bb,y);bb[1]+=y;bb[4]+=y;
 for(const box of boxes)x=calcXOffset(box,bb,x);bb[0]+=x;bb[3]+=x;
 for(const box of boxes)z=calcZOffset(box,bb,z);bb[2]+=z;bb[5]+=z;
 p.x=(bb[0]+bb[3])/2;p.y=bb[1];p.z=(bb[2]+bb[5])/2;p.onGround=dy<0&&y!==dy;
 if(x!==dx)p.mx=0;if(y!==dy)p.my=0;if(z!==dz)p.mz=0;
}
