// LivingEntity.startSleeping and Camera.setup in the pinned 1.14/1.15 jars.
import { getBlock, getStateProperties } from '../world/blocks.js';
export function bedFacing(game, pos = game.bedPos) {
  if (!pos) return null;
  const state = game.world.getState(pos.x,pos.y,pos.z),block = getBlock(state);
  return block?.name.endsWith('_bed') ? getStateProperties(state).facing : null;
}
export function startSleeping(game, pos) {
  game.sleeping=true;game.bedPos={...pos};
  const pl=game.player;
  pl.sleeping=true;pl.pose='sleeping';pl.crouching=false;
  pl.width=Math.fround(0.2);pl.height=Math.fround(0.2);
  pl.setPosition(pos.x+0.5,pos.y+0.6875,pos.z+0.5);
  pl.prevX=pl.x;pl.prevY=pl.y;pl.prevZ=pl.z;
  pl.motionX=pl.motionY=pl.motionZ=0;
  pl.pitch=pl.prevPitch=0;
}
export function stopSleeping(game) {
  game.sleeping=false;game.bedPos=null;
  const pl=game.player;
  pl.sleeping=false;pl.pose='standing';pl.width=Math.fround(0.6);pl.height=Math.fround(1.8);pl._bb=null;
}
// Sleeping position is optional metadata; a null value explicitly wakes the entity.
export function updateSleeping(game, delta, index) {
  if (Object.hasOwn(delta,index)) {
    const pos=delta[index];
    if (pos) {
      const changed=!game.sleeping || !game.bedPos || ['x','y','z'].some(k=>game.bedPos[k]!==pos[k]);
      if(changed){startSleeping(game,pos);return 'start';}
    } else if(game.sleeping){stopSleeping(game);return 'stop';}
  } else if(delta[6]!==undefined && delta[6]!==2 && game.sleeping){stopSleeping(game);return 'stop';}
  return null;
}
export function sleepingCamera(game, partial) {
  if(!game.sleeping || game.cameraEntity!=null || game.debugCam || game.thirdPerson>0)return null;
  const pl=game.player,facing=bedFacing(game),angle={south:0,west:90,north:180,east:270}[facing];
  const eye=game.cameraEye?.height(partial,pl.eyeHeight()) ?? Math.fround(0.2);
  return {x:pl.prevX+(pl.x-pl.prevX)*partial,y:pl.prevY+(pl.y-pl.prevY)*partial+eye+0.3,z:pl.prevZ+(pl.z-pl.prevZ)*partial,yaw:angle===undefined?0:angle-180,pitch:0};
}
