// EntityPlayer.trySleep and EntityRenderer.orientCamera, from the pinned client jars.
import { getBlock, getStateProperties } from '../world/blocks.js';
const OFFSETS = { south:[0,0,1], west:[-1,0,0], north:[0,0,-1], east:[1,0,0] };
export function bedFacing(game, pos = game.bedPos) {
  if (!pos) return null;
  const state = game.world.getState(pos.x,pos.y,pos.z),block = getBlock(state);
  return block?.name.endsWith('_bed') ? getStateProperties(state).facing : null;
}
export function startSleeping(game, pos) {
  game.sleeping=true;game.bedPos={...pos};
  const pl=game.player,facing=bedFacing(game,pos),d=OFFSETS[facing]||[0,0,0];
  pl.sleeping=true;pl.width=Math.fround(0.2);pl.height=Math.fround(0.2);
  pl.setPosition(pos.x+0.5+d[0]*Math.fround(0.4),pos.y+0.6875,pos.z+0.5+d[2]*Math.fround(0.4));
  pl.prevX=pl.x;pl.prevY=pl.y;pl.prevZ=pl.z;
  pl.motionX=pl.motionY=pl.motionZ=0;
}
export function sleepingCamera(game, partial) {
  if(!game.sleeping || game.cameraEntity!=null || game.debugCam)return null;
  const pl=game.player,facing=bedFacing(game),angle={south:0,west:90,north:180,east:270}[facing]||0;
  // T(0,.3,0) * R(bed) * R(-yaw-180) * R(-pitch) * R(pitch) * R(yaw+180)
  // * T(0,-eyeHeight-1,0): mouse look cancels, and the eye lies .7 above its sleeping height.
  return {x:pl.prevX+(pl.x-pl.prevX)*partial,y:pl.prevY+(pl.y-pl.prevY)*partial+Math.fround(0.2)+0.7,z:pl.prevZ+(pl.z-pl.prevZ)*partial,yaw:angle+180,pitch:0};
}
