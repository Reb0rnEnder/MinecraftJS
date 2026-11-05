// Entity.turn and Boat.onPassengerTurned: mouse input changes both interpolation
// endpoints, then the vehicle clamps rotation immediately, between game ticks.
const f=Math.fround;
export const BOAT_LOOK_LIMIT=105;
export function clampBoatYaw(player,yaw){
 let delta=f(player.yaw-yaw);delta=f(((delta+180)%360+360)%360-180);
 const limit=Math.max(-BOAT_LOOK_LIMIT,Math.min(BOAT_LOOK_LIMIT,delta)),correction=f(limit-delta);
 player.prevYaw=f(player.prevYaw+correction);
 player.yaw=f(f(player.yaw+limit)-delta);
}
export function turnPlayer(player,dx,dy){
 dx=f(dx);dy=f(dy);
 player.yaw=f(player.yaw+dx);player.pitch=Math.max(-90,Math.min(90,f(player.pitch+dy)));
 player.prevYaw=f(player.prevYaw+dx);player.prevPitch=Math.max(-90,Math.min(90,f(player.prevPitch+dy)));
 if(player.ridingEntity?.kind==='boat')clampBoatYaw(player,player.ridingEntity.yaw);
}
