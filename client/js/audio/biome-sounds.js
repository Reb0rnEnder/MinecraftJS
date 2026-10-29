import {biomeInfo} from '../world/biomes.js';
// BiomeAmbientSoundsHandler: 40-tick loop fades, additions and light-driven mood accumulation.
export function tickBiomeSounds(sound){
 const g=sound.game,w=g.world,p=g.player;
 let state=sound.biomeSounds;
 if(!state||state.generation!==sound.generation)state=sound.biomeSounds={generation:sound.generation,loops:new Map(),mood:0};
 if(!g.inWorld)return;
 const id=w.getBiome(Math.floor(p.x),Math.floor(p.z),Math.floor(p.y)),effects=biomeInfo(id).effects||{},name=effects.ambient_sound?.replace(/^minecraft:/,'');
 for(const [key,entry]of state.loops){entry.fade+=key===name?1:-1;entry.fade=Math.max(-1,Math.min(40,entry.fade));entry.handle?.setVolume(Math.max(0,entry.fade)/40);if(entry.fade<0){entry.handle?.stop();state.loops.delete(key);}}
 if(name&&!state.loops.has(name)){
  const entry={fade:0,handle:null};state.loops.set(name,entry);
  sound.playLoop(name,p.x,p.y,p.z,{category:'ambient',global:true}).then(handle=>{
   if(state!==sound.biomeSounds||state.loops.get(name)!==entry){handle?.stop();return;}entry.handle=handle;
  }).catch(()=>{if(state.loops.get(name)===entry)state.loops.delete(name);});
 }
 const additions=effects.additions_sound;
 if(additions&&Math.random()<additions.tick_chance)sound.play(additions.sound,0,0,0,1,1,{global:true,category:'ambient'});
 const mood=effects.mood_sound;if(!mood)return;
 const radius=mood.block_search_extent,size=radius*2+1,eye=p.y+(typeof p.eyeHeight==='function'?p.eyeHeight():p.eyeHeight??1.62),x=Math.floor(p.x+Math.floor(Math.random()*size)-radius),y=Math.floor(eye+Math.floor(Math.random()*size)-radius),z=Math.floor(p.z+Math.floor(Math.random()*size)-radius),sky=w.getSkyLight(x,y,z);
 state.mood=sky>0?state.mood-sky/15*.001:state.mood-(w.getBlockLight(x,y,z)-1)/mood.tick_delay;
 if(state.mood>=1){const dx=x+.5-p.x,dy=y+.5-eye,dz=z+.5-p.z,length=Math.hypot(dx,dy,dz)||1,f=(length+mood.offset)/length;sound.play(mood.sound,p.x+dx*f,eye+dy*f,p.z+dz*f,1,1,{category:'ambient'});state.mood=0;}
 else state.mood=Math.max(0,state.mood);
}
