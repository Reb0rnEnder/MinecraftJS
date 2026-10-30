import {getBlock} from '../world/blocks.js';
import {getFluidState} from '../world/fluids.js';
import {mat4} from '../gfx/math.js';
const rand=Math.random, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const CAVES_PARTICLES=new Set(['dust_color_transition','vibration','falling_spore_blossom','spore_blossom_air','small_flame','snowflake','dripping_dripstone_lava','falling_dripstone_lava','dripping_dripstone_water','falling_dripstone_water','glow_squid_ink','glow','wax_on','wax_off','electric_spark','scrape']);
function ordinaryTick(system,p,gravity=0,drag=.96,boost=false){p.my-=gravity;system.move(p,system.game.world);if(boost&&p.y===p.prevY){p.mx*=1.1;p.mz*=1.1;}p.mx*=drag;p.my*=drag;p.mz*=drag;if(p.onGround){p.mx*=.7;p.mz*=.7;}}
export function cavesParticle(system,type,x,y,z,mx=0,my=0,mz=0,data={}){
 if(type==='vibration')return vibrationParticle(system,data);
 if(type==='small_flame'){const p=system.flame(x,y,z,mx,my,mz);if(p){p.sprite=type;p.scale*=.5;p.baseScale*=.5;}return p;}
 const p={x,y,z,mx,my,mz,sprite:type,scale:(rand()*.5+.5)*2,maxAge:20,collide:false};
 if(type==='snowflake'){
  Object.assign(p,{mx:mx+(rand()*2-1)*.05,my:my+(rand()*2-1)*.05,mz:mz+(rand()*2-1)*.05,r:.923,g:.964,b:.999,scale:1+rand()*rand(),maxAge:Math.floor(16/(rand()*.8+.2))+2,collide:true});
  p.update=q=>{ordinaryTick(system,q,.009,1);q.mx*=.95;q.my*=.9;q.mz*=.95;};
 }else if(type.includes('dripstone')||type==='falling_spore_blossom'){
  const lava=type.endsWith('lava'),hang=type.startsWith('dripping'),spore=type==='falling_spore_blossom';
  Object.assign(p,{mx:0,my:0,mz:0,spriteMode:'random',width:.01,height:.01,collide:true,maxAge:hang?40:spore?Math.floor(64/(.1+rand()*.8)):Math.floor(64/(rand()*.8+.2)),r:spore?.32:lava?1:.2,g:spore?.5:lava?.2857143:.3,b:spore?.22:lava?.083333336:1});
  p.update=q=>{
   if(hang&&q.age>=q.maxAge){cavesParticle(system,lava?'falling_dripstone_lava':'falling_dripstone_water',q.x,q.y,q.z);return false;}
   q.my-=spore?.005:hang?.0012:.06;system.move(q,system.game.world);const drag=hang?.0196:.98;q.mx*=drag;q.my*=drag;q.mz*=drag;
   if(hang&&lava){q.r=1;q.g=16/(40-q.age+16);q.b=4/(40-q.age+8);}
   if(q.onGround){if(!hang&&!spore){if(lava)system.fallingDrop(q.x,q.y,q.z,true,true);else system.splash(q.x,q.y,q.z);system.game.sound?.play('block.pointed_dripstone.drip_'+(lava?'lava':'water'),q.x,q.y,q.z,.3+rand()*.7,1,{category:'block'});}return false;}
   const fluid=getFluidState(system.game.world.getState(Math.floor(q.x),Math.floor(q.y),Math.floor(q.z)));
   if(!spore&&fluid&&(lava?fluid.isLava:!fluid.isLava)&&q.y<Math.floor(q.y)+fluid.height)return false;
  };
 }else if(type==='spore_blossom_air'){
  const q=system.fx(x,y-.125,z,0,-.8,0,{...p,y:y-.125,r:.32,g:.5,b:.22,scale:(rand()*.5+.5)*(rand()*.6+.6)*2,maxAge:500+Math.floor(rand()*501),collide:false});
  q.update=p=>ordinaryTick(system,p,.0004,1);return system.add(q);
 }else if(type==='dust_color_transition'){
  const scale=clamp(Number(data.scale)||1,.01,4),brightness=rand()*.4+.6;
  const from=[data.red??1,data.green??0,data.blue??0].map(c=>(rand()*.2+.8)*c*brightness),to=[data.toRed??0,data.toGreen??0,data.toBlue??1].map(c=>(rand()*.2+.8)*c*brightness);
  const q=system.fx(x,y,z,mx,my,mz,{...p,collide:true,scale:(rand()*.5+.5)*2*.75*scale,maxAge:Math.max(1,Math.floor(Math.floor(8/(rand()*.8+.2))*scale))});
  q.mx*=.1;q.my*=.1;q.mz*=.1;q.update=p=>ordinaryTick(system,p,0,.96,true);
  q.colorFn=(p,t)=>{const f=(p.age+t)/(p.maxAge+1);return from.map((c,i)=>c+(to[i]-c)*f);};q.sizeFn=(p,t)=>p.scale*clamp((p.age+t)/p.maxAge*32,0,1);return system.add(q);
 }else if(type==='glow_squid_ink'){
  Object.assign(p,{r:.8,g:31/255,b:.4,scale:5,fullBright:true,maxAge:Math.floor(6/(rand()*.8+.2))});
  p.update=q=>{ordinaryTick(system,q,0,.92);if(getBlock(system.game.world.getState(Math.floor(q.x),Math.floor(q.y),Math.floor(q.z)))?.isAir)q.my-=.0074;if(q.age>q.maxAge/2)q.a=1-(q.age-Math.floor(q.maxAge/2))/q.maxAge;};
 }else{
  // GlowParticle's electric/wax/scrape providers explicitly replace the
  // randomized base motion; glow-squid sparks retain the base random motion.
  const electric=type==='electric_spark',scrape=type==='scrape',glow=type==='glow';
  const colors=glow?(rand()<.5?[.6,1,.8]:[.08,.4,.4]):scrape?(rand()<.5?[.29,.58,.51]:[.43,.77,.62]):type==='wax_on'?[.91,.55,.08]:[1,.9,1];
  let q;
  if(glow){q=system.fx(x,y,z,.5-rand(),my,.5-rand(),{...p});q.my*=.2;if(mx===0&&mz===0){q.mx*=.1;q.mz*=.1;}}
  else q=p;
  Object.assign(q,{r:colors[0],g:colors[1],b:colors[2],scale:(rand()*.5+.5)*2*.75,maxAge:glow?Math.floor(8/(rand()*.8+.2)):electric?2+Math.floor(rand()*2):10+Math.floor(rand()*30)});
  if(!glow){const speed=electric?.25:.01;q.mx=mx*speed*(electric||scrape?1:.5);q.my=my*speed;q.mz=mz*speed*(electric||scrape?1:.5);}
  q.lightFn=(p,t,sky,block)=>[sky,Math.min(15,block+Math.floor(clamp((p.age+t)/p.maxAge,0,1)*240)/16)];q.update=p=>ordinaryTick(system,p,0,.96,true);
  return system.add(q);
 }
 return system.add(p);
}
export function vibrationParticle(system,data){
 const origin=data.origin;if(!origin||!Number.isFinite(data.ticks)||data.ticks<=0)return;
 const destination=()=>{if(typeof data.destination==='number'){const e=system.game.entities.get(data.destination);return e?{x:Math.floor(e.x),y:Math.floor(e.y),z:Math.floor(e.z)}:null;}return data.destination;};
 if(!destination())return;
 const p={x:origin.x+.5,y:origin.y+.5,z:origin.z+.5,sprite:'vibration',scale:3,maxAge:data.ticks,collide:false,fullBright:true,yaw:0,prevYaw:0};
 p.update=q=>{const end=destination();if(!end)return false;const t=q.age/q.maxAge;q.x=origin.x+.5+(end.x-origin.x)*t;q.y=origin.y+.5+(end.y-origin.y)*t;q.z=origin.z+.5+(end.z-origin.z)*t;q.prevYaw=q.yaw;q.yaw=Math.atan2(q.x-end.x,q.z-end.z);};
 p.geometryFn=(q,partial,x,y,z)=>{
  const roll=Math.sin((q.age+partial-Math.PI*2)*.05)*2,yaw=q.prevYaw+(q.yaw-q.prevYaw)*partial;
  return [0,1].map(side=>{const m=mat4.create();mat4.rotateY(m,m,yaw-(side?Math.PI:0));mat4.rotateX(m,m,side?1.0472:-1.0472);mat4.rotateY(m,m,roll);
   return [[-1,-1],[-1,1],[1,1],[1,-1]].flatMap(([u,v])=>[x+.3*(m[0]*u+m[4]*v),y+.3*(m[1]*u+m[5]*v),z+.3*(m[2]*u+m[6]*v)]);});
 };
 return system.add(p);
}
