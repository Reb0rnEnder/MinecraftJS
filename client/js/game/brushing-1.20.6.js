import{getBlock}from'../world/blocks.js';
import{mat4,D2R}from'../gfx/math.js';
import{mcCos}from'./physics.js';
const f=Math.fround;
export const BRUSH_SOUNDS_766={suspicious_sand:'item.brush.brushing.sand',suspicious_gravel:'item.brush.brushing.gravel'};
export function brushDust766(view,face){return face<2?[view[2],0,-view[0]]:({2:[1,0,-.1],3:[-1,0,.1],4:[-.1,0,-1],5:[.1,0,1]}[face]||[0,0,0]);}
export function brushTranslation766(face,dusted){const a=[.5,0,.5],d=f(f(f(dusted)/10)*.75);if(face===0)a[1]=f(f(-.23)-d);if(face===1)a[1]=f(.25+d);if(face===2)a[2]=f(.25-d);if(face===3)a[2]=f(f(.73)+d);if(face===4)a[0]=f(.25-d);if(face===5)a[0]=f(f(.73)+d);return a;}
export function brushArmPose766(part){part.rx=f(f(part.rx*.5)-f(.62831855));part.ry=0;}
export function applyBrushFrame766(m,side,ticks,partial,equip){
  mat4.translate(m,m,f(side*f(.56)),f(f(-.52)+f(equip*f(-.6))),f(-.72));
  const remaining=(200-ticks)%10,phase=f(1-f(f(f(remaining-partial)+1)/10)),angle=f(-15+f(75*mcCos(f(f(phase*2)*f(Math.PI)))));
  const rotate=(degrees,axis)=>mat4.rotate(m,m,degrees*D2R,...axis),x=[1,0,0],y=[0,1,0];
  if(side<0){mat4.translate(m,m,.1,.83,.35);rotate(-80,x);rotate(-90,y);rotate(angle,x);mat4.translate(m,m,-.3,.22,.35);}
  else{mat4.translate(m,m,-.25,.22,.35);rotate(-80,x);rotate(90,y);rotate(angle,x);}
  return m;
}
export function startBrushing766(it,held,hand){
  if(it.game.cooldownFraction(held.id,0)>0)return false;
  if(it.updateTarget(1,it.reach())?.type!=='block')return 'consume';
  it.player.usingItem=true;it.activeHand=hand;it.useTicks=0;it.brushItemId=held.id;
  return 'consume';
}
export function tickBrushing766(it,held){
  const g=it.game;
  if(!it.player.usingItem)return;
  if(!held||held.id!==it.brushItemId||it.useTicks>=200){it.stopUsingItem();return;}
  const hit=it.updateTarget(1,it.reach());if(hit?.type!=='block'){it.stopUsingItem();return;}
  if(it.useTicks%10!==5)return;
  const state=g.world.getState(hit.x,hit.y,hit.z),block=getBlock(state),view=g.lookVector(0),delta=brushDust766(view,hit.face);
  const sign=(g.settings.mainHand==='left'?-1:1)*(it.activeHand===1?-1:1);
  if(block.renderType!==0&&block.name!=='moving_piston')for(let n=7+Math.floor(Math.random()*6);n>0;n--){
    g.particles.digging(hit.hit[0]-(hit.face===4?1e-6:0),hit.hit[1],hit.hit[2]-(hit.face===2?1e-6:0),delta[0]*sign*3*Math.random(),0,delta[2]*sign*3*Math.random(),state,undefined,[hit.x,hit.y,hit.z]);
  }
  g.sound.play(BRUSH_SOUNDS_766[block.name]||'item.brush.brushing.generic',hit.x+.5,hit.y+.5,hit.z+.5,1,1,{category:'block'});
}
