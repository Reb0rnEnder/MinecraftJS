// Native BeeSoundInstance / BeeFlyingSoundInstance / BeeAggressiveSoundInstance.
export function stopBeeSound(e){e.beeSoundToken=null;e.beeSoundName=null;e.beeSound?.stop();e.beeSound=null;}
export function beeSoundParameters(e){
 const f=Math.fround,speed=f(Math.hypot(e.motionX||0,e.motionZ||0)),min=f(e.child?1.1:.7),max=f(e.child?1.5:1.1);
 if(speed<.01)return {volume:0,pitch:0};
 return {volume:f(f(Math.min(.5,speed))*f(1.2)),pitch:f(min+f(Math.max(min,Math.min(max,speed))*f(max-min)))};
}
export function tickBeeSound(manager,e){
 const sound=manager.game.sound;
 if(e.dead||e.silent||!sound?.playLoop){stopBeeSound(e);return;}
 const name=e.angry?'entity.bee.loop_aggressive':'entity.bee.loop';
 const update=()=>{const p=beeSoundParameters(e);e.beeSound?.setPosition([e.x,e.y,e.z]);e.beeSound?.setVolume(p.volume);e.beeSound?.setPitch?.(p.pitch);};
 if(e.beeSoundName!==name){
  stopBeeSound(e);e.beeSoundName=name;const token=e.beeSoundToken={};
  Promise.resolve(sound.playLoop(name,e.x,e.y,e.z,{category:'neutral'})).then(handle=>{
   if(e.beeSoundToken!==token||manager.map.get(e.id)!==e){handle?.stop();return;}
   if(!handle){stopBeeSound(e);return;}e.beeSound=handle;update();
  }).catch(()=>{if(e.beeSoundToken===token)stopBeeSound(e);});
 }
 update();
}
