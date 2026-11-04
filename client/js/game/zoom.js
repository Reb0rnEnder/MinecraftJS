import {platform} from '../platform/platform.js';
// OptiFine-style hold zoom: quarter FOV and filtered mouse movement. Separate
// transient state keeps the user's cinematic-camera preference unchanged.
export function zoomActive(game){return !!(game.settings?.zoomEnabled!==false&&game.inWorld&&!game.dead&&!game.screens?.current&&game.input?.locked&&game.input.isDown('zoom')&&!game.input.down?.has('F3'));}
export function zoomFov(game,fov){
 if(!game.inWorld||game.dead||game.screens?.current||!game.input?.locked){game._zoomLens=null;return fov;}
 const active=zoomActive(game);if(!active)game._zoomFactor=.25;
 const now=platform().now(),target=active?(game._zoomFactor??.25):1;
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

// Extra zoom control: up zooms in, down zooms out, only while hold zoom is active.
export function scrollZoom(game){
 const steps=game.input?.wheel;if(!steps||!zoomActive(game))return false;
 game._zoomFactor=Math.max(1/32,Math.min(.75,(game._zoomFactor??.25)*1.15**Math.max(-64,Math.min(64,steps))));
 game.input.wheel=0;return true;
}
