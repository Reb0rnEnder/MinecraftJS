const f=Math.fround,clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
// 1.20.3+: blocking arms follow the head with native pitch/yaw limits.
export function shieldArmPose766(arm,head,right){
  arm.rx=f(f(f(arm.rx*.5)-f(.9424779))+clamp(head.rx,f(-1.3962634),f(.43633232)));
  arm.ry=f(f((right?-30:30)*f(Math.PI/180))+clamp(head.ry,f(-.5235988),f(.5235988)));
}
