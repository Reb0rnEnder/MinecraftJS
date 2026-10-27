import {getBlock} from '../world/blocks.js';
import {mat4} from '../gfx/math.js';
// Portal contact is entity/block overlap, not just the block at the player's centre.
export function touchesPortal(game){
 if((game.ridingEntityId??-1)>=0)return false;
 const p=game.player,bb=p.bb?p.bb():[p.x-.3,p.y,p.z-.3,p.x+.3,p.y+1.8,p.z+.3];
 for(let x=Math.floor(bb[0]+.001);x<=Math.floor(bb[3]-.001);x++)for(let y=Math.floor(bb[1]+.001);y<=Math.floor(bb[4]-.001);y++)for(let z=Math.floor(bb[2]+.001);z<=Math.floor(bb[5]-.001);z++){
  const name=getBlock(game.world.getState(x,y,z)>>4).name;if(name==='nether_portal'||name==='portal')return true;
 }return false;
}
export function tickPortal(game){
 game.prevPortalTime=game.portalTime||0;
 if(touchesPortal(game)){
  if(!game.portalTime)game.sound.playAtPlayer('block.portal.trigger',1,Math.random()*.4+.8);
  game.portalTime=Math.min(1,game.prevPortalTime+.0125);
 }else if((game.effects?.get(9)?.duration||0)>60)game.portalTime=Math.min(1,game.prevPortalTime+.006666667);
 else game.portalTime=Math.max(0,game.prevPortalTime-.05);
}
// Native rotating anisotropic screen distortion. Teleport timing stays server-owned.
export function portalWarp(amount,ticks,nausea=false){
 const out=mat4.create();if(!(amount>0))return out;
 let factor=5/(amount*amount+5)-amount*.04;factor*=factor;
 const angle=ticks*(nausea?7:20)*Math.PI/180;
 mat4.rotate(out,out,angle,0,Math.SQRT1_2,Math.SQRT1_2);mat4.scale(out,out,1/factor,1,1);mat4.rotate(out,out,-angle,0,Math.SQRT1_2,Math.SQRT1_2);return out;
}
