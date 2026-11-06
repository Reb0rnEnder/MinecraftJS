import {nativeAtan2,wrapNativeDegrees} from '../util/native-angles.js';
function eyes(e){return typeof e.eyeHeight==='function'?e.eyeHeight():e.eyeHeight??Math.fround(Math.fround(e.height)*Math.fround(.85));}
export function applyLookAt(game,p){
  const player=game.player,entity=p.isEntity?(p.entityId===game.entityId?player:game.entities.get(p.entityId)):null;
  const target=entity?[entity.x,entity.y+(p.toAnchor===1?eyes(entity):0),entity.z]:[p.x,p.y,p.z];
  const dx=target[0]-player.x,dy=target[1]-(player.y+(p.fromAnchor===1?eyes(player):0)),dz=target[2]-player.z;
  player.pitch=player.prevPitch=wrapNativeDegrees(Math.fround(-nativeAtan2(dy,Math.sqrt(dx*dx+dz*dz))*57.2957763671875));
  player.yaw=player.prevYaw=wrapNativeDegrees(Math.fround(Math.fround(nativeAtan2(dz,dx)*57.2957763671875)-90));
  player.headYaw=player.yaw;
}
