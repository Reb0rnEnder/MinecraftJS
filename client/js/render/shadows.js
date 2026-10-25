import {getBlock,staticCollisionBoxes} from '../world/blocks.js';
import {celestialAngle} from './sky.js';
// Native 1.14 EntityRenderer.renderShadow: project onto eligible ground cells,
// retain world-space circle UVs, and fade with height, distance and local light.
export function shadowGeometry(world,p,radius,strength=1){
 if(!(radius>0)||strength<=0)return new Float32Array(0);
 const out=[],angle=celestialAngle(Number(world.timeOfDay)||0,0);
 let daylight=1-(Math.cos(angle*Math.PI*2)*2+.5);daylight=Math.max(0,Math.min(1,daylight));
 daylight=1-daylight;daylight*=1-(world.rainStrength||0)*5/16;daylight*=1-(world.thunderStrength||0)*5/16;
 const darken=world.hasSky===false?0:Math.floor((1-daylight)*11);
 for(let x=Math.floor(p.x-radius);x<=Math.floor(p.x+radius);x++)for(let z=Math.floor(p.z-radius);z<=Math.floor(p.z+radius);z++){
  for(let y=Math.floor(p.y-radius);y<=Math.floor(p.y);y++){
   const state=world.getState(x,y-1,z),block=getBlock(state);
   if(!block||block.isAir||(block.renderType!==undefined?block.renderType===0:!block.hasModel))continue;
   const full=block.collisionFull??staticCollisionBoxes(state).some(b=>b.every((v,i)=>v===(i<3?0:1)));
   if(!full)continue;
   const light=(world.getSkyLight(x,y,z)<<4)|world.getBlockLight(x,y,z),level=Math.max((light>>4)-darken,light&15);if(level<=3)continue;
   const f=level/15,brightness=world.dimension===-1?.1+(f/(4-3*f))*.9:f/(4-3*f);
   const alpha=Math.min(1,(strength-(p.y-y)/2)*.5*brightness);if(alpha<=0)continue;
   const x0=Math.max(x,p.x-radius),x1=Math.min(x+1,p.x+radius),z0=Math.max(z,p.z-radius),z1=Math.min(z+1,p.z+radius);
   if(x0>=x1||z0>=z1)continue;
   for(const [vx,vz] of [[x0,z0],[x0,z1],[x1,z1],[x1,z0]])out.push(vx-p.x,y-p.y+.015625,vz-p.z,(p.x-vx)/(radius*2)+.5,(p.z-vz)/(radius*2)+.5,1,1,1,alpha);
  }
 }
 return new Float32Array(out);
}
