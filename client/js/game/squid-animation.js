import {getBlock} from '../world/blocks.js';
function isPointInFluid(world,x,y,z){const by=Math.floor(y),state=world.getState(x,by,z);if(!getBlock(state)?.isWater)return false;const level=state&15;return y<by+1-(level>=8?1:level+1)/9;}
import {JavaRandom} from '../util/jrandom.js';
import {mcSin} from './physics.js';
import {mat4} from '../gfx/math.js';
const f=Math.fround,PI=f(Math.PI),TAU=f(Math.PI*2),RAD=Math.PI/180;
export const isSquid=e=>e.kind==='mob'&&(e.type===94||e.entityName==='glow_squid');
// Squid.aiStep, client branch. The server owns movement and sends status 19
// when a cycle completes; clients clamp rather than wrapping independently.
export function initSquid(e){
 const random=new JavaRandom((e.id+1)|0);
 e.squid={phase:0,speed:f(f(1/f(random.nextFloat()+1))*f(.2)),tentacle:0,oldTentacle:0,xRot:0,oldXRot:0,zRot:0,oldZRot:0,rotateSpeed:0};
}
export function tickSquid(e,inWater){
 if(!e.squid)initSquid(e);
 const s=e.squid;s.oldTentacle=s.tentacle;s.oldXRot=s.xRot;s.oldZRot=s.zRot;
 s.phase=f(s.phase+s.speed);if(s.phase>Math.PI*2)s.phase=TAU;
 if(inWater){
  if(s.phase<PI){const t=f(s.phase/PI);s.tentacle=f(f(mcSin(f(f(t*t)*PI))*PI)*f(.25));s.rotateSpeed=t>.75?1:f(s.rotateSpeed*f(.8));}
  else{s.tentacle=0;s.rotateSpeed=f(s.rotateSpeed*f(.99));}
  const mx=e.motionX||0,my=e.motionY||0,mz=e.motionZ||0;
  e.bodyYaw=f(f(e.bodyYaw||0)+f(f(f(f(-f(Math.atan2(mx,mz)))*f(180))/PI-f(e.bodyYaw||0))*f(.1)));
  e.yaw=e.bodyYaw;
  s.zRot=f(s.zRot+Math.PI*s.rotateSpeed*1.5);
  s.xRot=f(s.xRot+f(f(f(f(-f(Math.atan2(f(Math.hypot(mx,mz)),my)))*f(180))/PI-s.xRot)*f(.1)));
 }else{s.tentacle=f(f(Math.abs(mcSin(s.phase))*PI)*f(.25));s.xRot=f(s.xRot+f(-90-s.xRot)*.02);}
}
export function squidTentacle(e,partial){const s=e.squid;return s?s.oldTentacle+(s.tentacle-s.oldTentacle)*partial:0;}
export function squidMatrix(e,bodyYaw,partial){
 const s=e.squid,m=mat4.create();mat4.translate(m,m,0,.5,0);mat4.rotateY(m,m,(180-bodyYaw)*RAD);
 if(s){mat4.rotateX(m,m,(s.oldXRot+(s.xRot-s.oldXRot)*partial)*RAD);mat4.rotateY(m,m,(s.oldZRot+(s.zRot-s.oldZRot)*partial)*RAD);}
 mat4.translate(m,m,0,-f(1.2),0);return m;
}

export function squidInWater(e,world){
 const half=(e.width||.8)/2,lo=e.y+.001,hi=e.y+(e.height||.8)-.001;
 for(let x=Math.floor(e.x-half+.001);x<Math.ceil(e.x+half-.001);x++)for(let z=Math.floor(e.z-half+.001);z<Math.ceil(e.z+half-.001);z++)for(let y=Math.floor(lo);y<Math.ceil(hi);y++)if(isPointInFluid(world,x,Math.max(y,lo),z))return true;
 return false;
}
