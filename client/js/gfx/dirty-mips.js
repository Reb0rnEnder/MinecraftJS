import { buildMips } from './device.js';
// Rebuild only the mip texels affected by a base-level atlas edit. Alignment to
// the coarsest grid makes local box-filtering identical to a full-atlas rebuild.
export function dirtyMipRegions(width,height,source,x,y,w,h,maxLevels=4){
  const levels=Math.min(maxLevels,Math.floor(Math.log2(Math.max(width,height))));
  if(levels<=0||w<=0||h<=0)return[];
  const grid=2**levels,x0=Math.max(0,Math.floor(x/grid)*grid),y0=Math.max(0,Math.floor(y/grid)*grid);
  const x1=Math.min(width,Math.ceil((x+w)/grid)*grid),y1=Math.min(height,Math.ceil((y+h)/grid)*grid),pw=x1-x0,ph=y1-y0;
  if(pw<=0||ph<=0)return[];
  const patch=new Uint8Array(pw*ph*4);
  for(let row=0;row<ph;row++)patch.set(source.subarray(((y0+row)*width+x0)*4,((y0+row)*width+x1)*4),row*pw*4);
  const out=[];
  for(const [i,m] of buildMips(pw,ph,patch,levels).entries()){
    const level=i+1,scale=2**level,mx=Math.floor(x0/scale),my=Math.floor(y0/scale),mw=Math.max(1,Math.floor(width/scale)),mh=Math.max(1,Math.floor(height/scale));
    if(mx+m.width<=mw&&my+m.height<=mh)out.push({...m,x:mx,y:my,level});
  }
  return out;
}
