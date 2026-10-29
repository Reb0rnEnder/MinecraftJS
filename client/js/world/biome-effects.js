import {biomeInfo} from './biomes.js';
const KERNEL=[0,1,4,6,4,1,0];
// CubicSampler.gaussianSample uses quart positions with the camera offset by two blocks.
export function sampleBiomeFog(world,x,y,z){
 const position=[(x-2)/4,(y-2)/4,(z-2)/4],base=position.map(Math.floor),fraction=position.map((v,i)=>v-base[i]);
 const weights=fraction.map(f=>Array.from({length:6},(_,i)=>KERNEL[i+1]+f*(KERNEL[i]-KERNEL[i+1]))),sum=[0,0,0];let total=0;
 for(let a=0;a<6;a++)for(let b=0;b<6;b++)for(let c=0;c<6;c++){
  const weight=weights[0][a]*weights[1][b]*weights[2][c];if(!weight)continue;
  const id=world.getNoiseBiome(base[0]-2+a,base[1]-2+b,base[2]-2+c),color=biomeInfo(id).effects?.fog_color??0xc0d8ff;
  sum[0]+=(color>>16&255)*weight;sum[1]+=(color>>8&255)*weight;sum[2]+=(color&255)*weight;total+=weight;
 }
 return sum.map(v=>v/(total*255));
}
