import {getBlock,getStateProperties} from '../world/blocks.js';
import {getFluidState} from '../world/fluids.js';
const DIRECTIONS=[[0,-1,0],[0,1,0],[0,0,-1],[0,0,1],[-1,0,0],[1,0,0]];
export const CANDLE_FLAMES={1:[[.5,.5,.5]],2:[[.375,.44,.5],[.625,.5,.44]],3:[[.5,.313,.625],[.375,.44,.5],[.56,.5,.44]],4:[[.44,.313,.56],[.625,.44,.56],[.375,.44,.375],[.56,.5,.375]]};
export function candleFlames(name,props){return /^(?:[a-z_]+_)?candle_cake$/.test(name)?[[.5,1,.5]]:CANDLE_FLAMES[Number(props.candles||1)]||CANDLE_FLAMES[1];}
// Native BlockBehaviour offset hash and PointedDripstoneBlock's 0.125 clamp.
export function dripstoneOffset(x,z){let seed=Math.imul(x,3129871)^Math.imul(z,116129781);seed=(Math.imul(Math.imul(seed,seed),42317861)+Math.imul(seed,11))|0;return [Math.max(-.125,Math.min(.125,(((seed>>>16)&15)/15-.5)*.5)),Math.max(-.125,Math.min(.125,(((seed>>>24)&15)/15-.5)*.5))];}
export function animateCavesBlock(system,x,y,z,state,random=Math.random){
 const game=system.game,world=game.world,block=getBlock(state),name=block.name,props=getStateProperties(state);
 if(/(?:^|_)candle(?:_cake)?$/.test(name)&&props.lit==='true'){
  for(const offset of candleFlames(name,props)){const [px,py,pz]=offset.map((v,i)=>[x,y,z][i]+v),r=random();
   if(r<.3){system.smoke(px,py,pz,0,0,0);if(r<.17)game.sound?.play('block.candle.ambient',px+.5,py+.5,pz+.5,1+random(),random()*.7+.3,{category:'block'});}
   system.nativeParticle('small_flame',px,py,pz);
  }
 }else if(name==='spore_blossom'){
  system.nativeParticle('falling_spore_blossom',x+random(),y+.7,z+random());
  for(let i=0;i<14;i++){const px=x+Math.floor(random()*21)-10,py=y-Math.floor(random()*10),pz=z+Math.floor(random()*21)-10;if(!getBlock(world.getState(px,py,pz)).collisionFull)system.nativeParticle('spore_blossom_air',px+random(),py+random(),pz+random());}
 }else if(name==='sculk_sensor'&&props.sculk_sensor_phase==='active'){
  const dir=DIRECTIONS[Math.floor(random()*6)];if(!dir||dir[1])return;
  system.nativeParticle('dust_color_transition',x+.5+(dir[0]?dir[0]*.6:.5-random()),y+.25,z+.5+(dir[2]?dir[2]*.6:.5-random()),0,random()*.04,0,{red:57/255,green:213/255,blue:224/255,scale:1,toRed:1,toGreen:0,toBlue:0});
 }else if(name==='pointed_dripstone'&&props.vertical_direction==='down'&&props.thickness==='tip'&&props.waterlogged!=='true'){
  const chance=random();if(chance>.12)return;
  let support;
  for(let i=1;i<11;i++){const b=world.getState(x,y+i,z);if(getBlock(b).name!=='pointed_dripstone'){support={x,y:y+i,z};break;}if(getStateProperties(b).vertical_direction!=='down')return;}
  if(!support)return;
  const fluid=getFluidState(world.getState(x,support.y+1,z));if(chance>=.02&&!fluid)return;
  const lava=fluid?fluid.isLava:game.dimension===-1,[ox,oz]=dripstoneOffset(x,z);
  system.nativeParticle(lava?'dripping_dripstone_lava':'dripping_dripstone_water',x+.5+ox,y+.25,z+.5+oz);
 }
}
export function cavesWorldEvent(system,event,random=Math.random){
 const type={3002:'electric_spark',3003:'wax_on',3004:'wax_off',3005:'scrape'}[event.effectId];if(!type)return false;
 const {x,y,z}=event.location,axis=event.effectId===3002&&event.data>=0&&event.data<3?event.data:-1;
 if(axis>=0){for(let n=10+Math.floor(random()*10),i=0;i<n;i++){const pos=[x,y,z].map((v,j)=>v+.5+(random()*2-1)*(j===axis?.5:.125)),velocity=[0,0,0];velocity[axis]=random()*2-1;system.nativeParticle(type,...pos,...velocity);}}
 else for(const dir of DIRECTIONS)for(let n=3+Math.floor(random()*3),i=0;i<n;i++){const pos=[x,y,z].map((v,j)=>v+.5+(dir[j]?dir[j]*.55:random()-.5)),velocity=dir.map(v=>v?0:random()*2-1);system.nativeParticle(type,...pos,...velocity);}
 if(event.effectId===3003)system.game.sound?.play('item.honeycomb.wax_on',x+.5,y+.5,z+.5,1,1,{category:'block'});
 return true;
}
