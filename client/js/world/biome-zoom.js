// FuzzyOffsetBiomeZoomer, native 1.15.2. The wire seed is already hashed.
const step=(seed,salt)=>BigInt.asIntN(64,seed*(seed*6364136223846793005n+1442695040888963407n)+salt);
const fiddle=seed=>(Number((seed>>24n)&1023n)/1024-.5)*.9;
export class BiomeZoom {
 constructor(seed){this.seed=BigInt.asIntN(64,BigInt(seed));this.corners=new Map();}
 offset(x,y,z){
  const key=x+','+y+','+z;let value=this.corners.get(key);if(value)return value;
  let seed=this.seed;for(const coordinate of [x,y,z,x,y,z])seed=step(seed,BigInt(coordinate));
  const a=fiddle(seed);seed=step(seed,this.seed);const b=fiddle(seed);seed=step(seed,this.seed);value=[a,b,fiddle(seed)];
  if(this.corners.size>=16384)this.corners.delete(this.corners.keys().next().value);this.corners.set(key,value);return value;
 }
 sample(x,y,z,noise){
  const qx=(x-2)>>2,qy=(y-2)>>2,qz=(z-2)>>2,first=noise(qx,qy,qz);let uniform=true;
  for(let i=1;i<8;i++)if(noise(qx+((i>>2)&1),qy+((i>>1)&1),qz+(i&1))!==first){uniform=false;break;}
  return uniform?first:noise(...this.cell(x,y,z));
 }
 cell(x,y,z){
  x-=2;y-=2;z-=2;const qx=x>>2,qy=y>>2,qz=z>>2,fx=(x&3)/4,fy=(y&3)/4,fz=(z&3)/4;
  let closest=Infinity,result;
  for(let corner=0;corner<8;corner++){
   const dx=(corner>>2)&1,dy=(corner>>1)&1,dz=corner&1,a=qx+dx,b=qy+dy,c=qz+dz,offset=this.offset(a,b,c);
   const xx=fx-dx+offset[0],yy=fy-dy+offset[1],zz=fz-dz+offset[2],distance=zz*zz+yy*yy+xx*xx;
   if(distance<closest){closest=distance;result=[a,b,c];}
  }
  return result;
 }
}
