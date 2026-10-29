// Native 1.16 particle providers. Sprite animations come from the target jar.
export const NETHER_PARTICLES=new Set(['ash','white_ash','crimson_spore','warped_spore','soul','soul_fire_flame','reverse_portal','dripping_obsidian_tear','falling_obsidian_tear','landing_obsidian_tear']);
const gaussian=()=>Math.sqrt(-2*Math.log(Math.max(Number.MIN_VALUE,Math.random())))*Math.cos(Math.random()*Math.PI*2);
export function netherParticle(system,type,x,y,z,mx=0,my=0,mz=0){
 const rand=Math.random,world=system.game.world;
 if(type==='soul_fire_flame'){const p=system.flame(x,y,z,mx,my,mz);if(p)p.sprite=type;return p;}
 if(type==='soul'){
  const p=system.fx(x,y,z,mx,my,mz,{sprite:type,fullBright:true,scale:(rand()*.5+.5)*3,maxAge:Math.floor(8/(rand()*.8+.2))+4,collide:false});
  p.mx=p.mx*.01+mx;p.my=p.my*.01+my;p.mz=p.mz*.01+mz;p.drag=.96;return system.add(p);
 }
 if(type==='reverse_portal'){
  const p={x,y,z,mx,my,mz,sprite:type,spriteMode:'random',maxAge:60+Math.floor(rand()*2),scale:(rand()*.2+.5)*1.5,r:1,g:1,b:1,collide:false};
  const brightness=rand()*.6+.4;p.r=brightness*.9;p.g=brightness*.3;p.b=brightness;
  p.sizeFn=(q,t)=>q.scale*(1-(q.age+t)/(q.maxAge*1.5));p.update=q=>{const f=q.age/q.maxAge;q.x+=q.mx*f;q.y+=q.my*f;q.z+=q.mz*f;};return system.add(p);
 }
 if(type.includes('obsidian_tear')){
  const hanging=type==='dripping_obsidian_tear',landing=type==='landing_obsidian_tear';
  const p={x,y,z,mx:0,my:0,mz:0,sprite:type,spriteMode:'random',fullBright:true,r:.51171875,g:.03125,b:.890625,scale:1,maxAge:hanging?101:Math.floor((landing?28:64)/(rand()*.8+.2)),collide:!landing};
  p.update=q=>{
   if(landing)return;
   if(hanging&&q.age>100){netherParticle(system,'falling_obsidian_tear',q.x,q.y,q.z);return false;}
   q.my-=hanging?.000012:.01;system.move(q,world);const drag=hanging?.0196:.98;q.mx*=drag;q.my*=drag;q.mz*=drag;
   if(!hanging&&q.onGround){netherParticle(system,'landing_obsidian_tear',q.x,q.y,q.z);return false;}
  };return system.add(p);
 }
 if(type==='crimson_spore'||type==='warped_spore'){
  const crimson=type==='crimson_spore',p={x,y:y-.125,z,sprite:type,spriteMode:'random',scale:(rand()*.5+.5)*(rand()*.6+.6)*2,maxAge:Math.floor(16/(rand()*.8+.2)),collide:false,r:crimson?.9:.1,g:crimson?.4:.1,b:crimson?.5:.3};
  p.mx=crimson?gaussian()*.000001:0;p.my=crimson?gaussian()*.0001:rand()*-1.9*rand()*.1;p.mz=crimson?gaussian()*.000001:0;p.drag=1;return system.add(p);
 }
 // Ash and WhiteAsh extend BaseAshSmokeParticle with downward acceleration.
 const white=type==='white_ash',p=system.fx(x,y,z,0,0,0,{sprite:type,scale:(rand()*.5+.5)*1.5,maxAge:Math.max(1,Math.floor(20/(rand()*.8+.2))),collide:false});
 p.mx*=.1;p.my*=-.1;p.mz*=.1;
 if(white){p.mx+=rand()*-1.9*rand()*.1;p.my+=rand()*-.5*rand()*.1*5;p.mz+=rand()*-1.9*rand()*.1;p.r=.7294118;p.g=.69411767;p.b=.7607843;}
 else p.r=p.g=p.b=rand()*.5;
 p.sizeFn=(q,t)=>q.scale*Math.min(1,(q.age+t)/q.maxAge*32);
 p.update=q=>{q.my-=white?.0005:.004;system.move(q,world);q.mx*=.96;q.my*=.96;q.mz*=.96;};return system.add(p);
}
