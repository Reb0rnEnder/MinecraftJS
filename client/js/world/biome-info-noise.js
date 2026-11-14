import {JavaRandom} from '../util/jrandom.js';
// Biome.BIOME_INFO_NOISE: one SimplexNoise octave, legacy random seed 2345.
const random=new JavaRandom(2345);random.nextDouble();random.nextDouble();random.nextDouble();
const permutation=Uint8Array.from({length:256},(_,i)=>i);
for(let i=0;i<256;i++){const j=i+random.nextInt(256-i),v=permutation[i];permutation[i]=permutation[j];permutation[j]=v;}
const F2=.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
const gradients=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],[0,1],[0,-1],[0,1],[0,-1]];
const p=i=>permutation[i&255];
function corner(index,x,y){let t=.5-x*x-y*y;if(t<0)return 0;t*=t;const g=gradients[index];return t*t*(g[0]*x+g[1]*y);}
export function biomeInfoNoise(x,z){
 const skew=(x+z)*F2,i=Math.floor(x+skew),j=Math.floor(z+skew),unskew=(i+j)*G2;
 const a=x-(i-unskew),b=z-(j-unskew),di=a>b?1:0,dj=a>b?0:1;
 return 70*(corner(p(i+p(j))%12,a,b)+corner(p(i+di+p(j+dj))%12,a-di+G2,b-dj+G2)+corner(p(i+1+p(j+1))%12,a-1+2*G2,b-1+2*G2));
}
