import{mat4}from'../gfx/math.js';
const clamp=v=>Math.max(0,Math.min(1,v));
function quads(x,y,z,size,rotations){return rotations.map(([yaw,pitch,roll=0])=>{const m=mat4.create();mat4.rotateY(m,m,yaw);mat4.rotateX(m,m,pitch);mat4.rotateY(m,m,roll);return[[-1,-1],[-1,1],[1,1],[1,-1]].flatMap(([u,v])=>[x+size*(m[0]*u+m[4]*v),y+size*(m[1]*u+m[5]*v),z+size*(m[2]*u+m[6]*v)]);});}
// VibrationParticleOption no longer contains an origin BlockPos. The emitter's
// floating point coordinates are the origin; entity targets include an eye offset.
export function vibrationParticle762(system,x,y,z,data){
 const end=()=>{if(typeof data.destination==='number'){const e=system.game.entities.get(data.destination);return e?{x:e.x,y:e.y+(data.entityEyeHeight||0),z:e.z}:null;}const p=data.destination;return p?{x:p.x+.5,y:p.y+.5,z:p.z+.5}:null;};
 if(!end()||!Number.isFinite(data.ticks)||data.ticks<=0)return;
 const angles=p=>{const t=end(),dx=p.x-t.x,dy=p.y-t.y,dz=p.z-t.z;return[Math.atan2(dx,dz),Math.atan2(dy,Math.hypot(dx,dz))];},initial=angles({x,y,z}),p={x,y,z,sprite:'vibration',scale:3,maxAge:data.ticks,collide:false,lightFn:()=>[0,15],yaw:initial[0],pitch:initial[1],prevYaw:initial[0],prevPitch:initial[1]};
 p.update=q=>{const target=end(),remaining=q.maxAge-q.age;if(!target||remaining<=0)return false;const t=1/remaining;q.x+=(target.x-q.x)*t;q.y+=(target.y-q.y)*t;q.z+=(target.z-q.z)*t;q.prevYaw=q.yaw;q.prevPitch=q.pitch;[q.yaw,q.pitch]=angles(q);};
 p.geometryFn=(q,t,x,y,z)=>{const yaw=q.prevYaw+(q.yaw-q.prevYaw)*t,pitch=q.prevPitch+(q.pitch-q.prevPitch)*t+Math.PI/2,roll=Math.sin((q.age+t-Math.PI*2)*.05)*2;return quads(x,y,z,.3,[[yaw,-pitch,roll],[yaw-Math.PI,pitch,roll]]);};
 return system.add(p);
}
// ShriekParticle: delayed, expanding/fading pairs of tilted rings.
export function shriekParticle762(system,x,y,z,data={}){
 const p={x,y,z,mx:0,my:.1,mz:0,sprite:'shriek',scale:8.5,maxAge:30,gravity:0,collide:true,delay:Math.max(0,data.delayInTicksBeforeShown|0),lightFn:()=>[0,15]};p.invisible=p.delay>0;
 p.update=q=>{if(q.delay>0){q.delay--;q.age--;return;}q.invisible=false;system.move(q,system.game.world);q.my*=.98;};
 p.alphaFn=(q,t)=>1-clamp((q.age+t)/q.maxAge);
 p.geometryFn=(q,t,x,y,z)=>quads(x,y,z,.85*clamp((q.age+t)/q.maxAge*.75),[[0,-1.0472],[-Math.PI,1.0472]]);
 return system.add(p);
}
export function sculkWorldEvent762(system,packet){
 if(packet.effectId!==3007)return false;const{x,y,z}=packet.location;
 for(let i=0;i<10;i++)shriekParticle762(system,x+.5,y+.5,z+.5,{delayInTicksBeforeShown:i*5});
 system.game.sound.play('block.sculk_shrieker.shriek',x+.5,y+.5,z+.5,2,.6+Math.random()*.4,{category:'block'});return true;
}
