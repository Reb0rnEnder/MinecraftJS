// Entity.onInsideBubbleColumn / onAboveBubbleCol. Invoked by entityInside for
// every intersecting column cell, before travel applies water drag/gravity.
export function applyBubbleColumn(entity,dragDown,aboveAir){
 if(aboveAir)entity.motionY=dragDown?Math.max(-.9,entity.motionY-.03):Math.min(1.8,entity.motionY+.1);
 else{entity.motionY=dragDown?Math.max(-.3,entity.motionY-.03):Math.min(.7,entity.motionY+.06);entity.fallDistance=0;}
}
