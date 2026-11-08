import { WATER_BIOMES } from '../world/water-biomes.js';
// FogRenderer in the pinned jar (ctx): 5-second biome transition and squared-exponential water fog.
export function waterFog(state,previous,now) {
  const id=state.biomeId??1,color=(WATER_BIOMES[id]||WATER_BIOMES[1])[1];
  let transition=previous||{target:color,from:color,time:now};
  const mix=Math.max(0,Math.min(1,(now-transition.time)/5000));
  const channels=[16,8,0].map(shift=>((transition.from>>shift)&255)*(1-mix)+((transition.target>>shift)&255)*mix);
  if(transition.target!==color)transition={target:color,from:channels.reduce((c,n,i)=>c|(Math.floor(n)<<[16,8,0][i]),0),time:now};
  const vision=Math.max(0,Math.min(1,state.waterVision||0));
  return {transition,color:channels.map(c=>c/255),density:0.05-vision*vision*0.03+([6,134].includes(id)?0.005:0)};
}
