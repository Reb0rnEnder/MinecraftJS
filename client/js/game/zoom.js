import {platform} from '../platform/platform.js';
// OptiFine-style hold zoom: quarter FOV and filtered mouse movement. Separate
// transient state keeps the user's cinematic-camera preference unchanged.
export function zoomActive(game){return !!(game.inWorld&&!game.dead&&!game.screens?.current&&game.input?.locked&&game.input.isDown('zoom')&&!game.input.down?.has('F3'));}
export function zoomFov(game,fov){
 if(!game.inWorld||game.dead||game.screens?.current||!game.input?.locked){game._zoomLens=null;return fov;}
 const now=platform().now(),target=zoomActive(game)?.25:1;
 let lens=game._zoomLens;if(!lens)lens=game._zoomLens={from:1,to:1,started:now};
 const t=Math.max(0,Math.min(1,(now-lens.started)/150)),factor=lens.from+(lens.to-lens.from)*t*t*(3-2*t);
 if(target!==lens.to){lens.from=factor;lens.to=target;lens.started=now;}
 return fov*factor;
}
export function smoothCameraActive(game){
 const active=zoomActive(game);
 if(active!==!!game._zoomWasActive){game._smoothCam=null;game._zoomWasActive=active;}
 return !!game.smoothCamera||active;
}
