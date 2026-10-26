// MobRenderer.renderLeash: two crossed 24-segment strips, native sag and alternating brown.
const radians=Math.PI/180;
const lerp=(a,b,t)=>a+(b-a)*t;
const angle=(a,b,t)=>a+(((b-a)%360+540)%360-180)*t;
export function leashEndpoints(mob,holder,partial){
 const pos=e=>[lerp(e.prevX??e.x,e.x,partial),lerp(e.prevY??e.y,e.y,partial),lerp(e.prevZ??e.z,e.z,partial)];
 const a=pos(mob),b=pos(holder),yaw=angle(mob.prevBodyYaw??mob.bodyYaw??0,mob.bodyYaw??0,partial)*radians+Math.PI/2;
 a[0]+=Math.cos(yaw)*mob.width*.4;a[2]+=Math.sin(yaw)*mob.width*.4;
 const hyaw=angle(holder.prevYaw??holder.yaw??0,holder.yaw??0,partial*.5)*radians,hpitch=lerp(holder.prevPitch??holder.pitch??0,holder.pitch??0,partial*.5)*radians;
 const knot=holder.kind==='leash',c=knot?0:Math.cos(hyaw),s=knot?0:Math.sin(hyaw),sp=knot?-1:Math.sin(hpitch);
 b[0]-=c*.7+s*.5*Math.cos(hpitch);b[1]+=(holder.eyeHeight||0)*.7-sp*.5-.25;b[2]+=-s*.7+c*.5*Math.cos(hpitch);
 return {start:a,end:b,height:mob.height};
}
export function leashGeometry({start:a,end:b,height}){
 const out=[],dx=Math.fround(b[0]-a[0]),dy=Math.fround(b[1]-a[1]),dz=Math.fround(b[2]-a[2]);
 const at=(i,strip,side)=>{const t=i/24,x=a[0]+dx*t,y=a[1]-(1.6-height)*.5+dy*(t*t+t)*.5+(24-i)/18+.125,z=a[2]+dz*t;
  return [x+(side?.025:0),y+(strip===0?(side?.025:0):(side?0:.025)),z+(strip===1&&side?.025:0)];};
 const vertex=(i,strip,side)=>{const c=i%2===0?.7:1;out.push(...at(i,strip,side),0,0,.5*c,.4*c,.3*c,1);};
 for(let strip=0;strip<2;strip++)for(let i=0;i<24;i++){vertex(i,strip,0);vertex(i,strip,1);vertex(i+1,strip,1);vertex(i+1,strip,0);}
 return new Float32Array(out);
}
