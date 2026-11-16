import{BAT_ANIMATIONS_766}from'./animations-bat-1.20.6.js';
import{animateKeyframes762}from'./keyframes-1.19.4.js';
export function tickBat766(entity){
  if(entity.hanging){entity.batFlyStart=undefined;entity.batRestStart??=entity.ticks;}
  else{entity.batRestStart=undefined;entity.batFlyStart??=entity.ticks;}
}
export function animateBat766(model,a){
  const e=a.entity||{};
  if(a.hanging)model.parts.head.ry=Math.fround(Math.fround(a.yaw)*Math.fround(Math.PI/180));
  if(e.batFlyStart!==undefined)animateKeyframes762(model.parts,BAT_ANIMATIONS_766.bat.BAT_FLYING,(a.age-e.batFlyStart)*50);
  if(e.batRestStart!==undefined)animateKeyframes762(model.parts,BAT_ANIMATIONS_766.bat.BAT_RESTING,(a.age-e.batRestStart)*50);
}
