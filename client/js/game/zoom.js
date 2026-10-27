// OptiFine-style hold zoom: quarter FOV and filtered mouse movement. Separate
// transient state keeps the user's cinematic-camera preference unchanged.
export function zoomActive(game){return !!(game.inWorld&&!game.dead&&!game.screens?.current&&game.input?.locked&&game.input.isDown('zoom')&&!game.input.down?.has('F3'));}
export function zoomFov(game,fov){return zoomActive(game)?fov/4:fov;}
export function smoothCameraActive(game){
 const active=zoomActive(game);
 if(active!==!!game._zoomWasActive){game._smoothCam=null;game._zoomWasActive=active;}
 return !!game.smoothCamera||active;
}
