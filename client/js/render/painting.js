// Native paintings consist of 16-pixel tiles, including repeated backing and
// one-pixel edge strips. Each tile samples the light at its own world position.
export function paintingTiles(width,height,front=[0,0,width,height],frontSize=[width,height],back=[0,0,16,16],backSize=[16,16]){
 const columns=width/16,rows=height/16,tiles=[];
 for(let column=0;column<columns;column++)for(let row=0;row<rows;row++){
  const x0=-width/32+column,x1=x0+1,y0=-height/32+row,y1=y0+1,z0=-1/32,z1=1/32,f=[],b=[];
  const quad=(out,points,rect,size,n)=>{const uv=[[rect[0],rect[1]],[rect[0],rect[3]],[rect[2],rect[3]],[rect[2],rect[1]]];points.forEach((p,i)=>out.push(...p,uv[i][0]/size[0],uv[i][1]/size[1],...n,1,1,1));};
  const du=(front[2]-front[0])/columns,dv=(front[3]-front[1])/rows;
  quad(f,[[x0,y1,z1],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1]],[front[0]+column*du,front[1]+(rows-row-1)*dv,front[0]+(column+1)*du,front[1]+(rows-row)*dv],frontSize,[0,0,1]);
  quad(b,[[x1,y1,z0],[x1,y0,z0],[x0,y0,z0],[x0,y1,z0]],back,backSize,[0,0,-1]);
  const vertical=[back[0],back[1],back[0]+1,back[3]],horizontal=[back[0],back[1],back[2],back[1]+1];
  quad(b,[[x1,y1,z1],[x1,y0,z1],[x1,y0,z0],[x1,y1,z0]],vertical,backSize,[1,0,0]);
  quad(b,[[x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1]],vertical,backSize,[-1,0,0]);
  quad(b,[[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]],horizontal,backSize,[0,1,0]);
  quad(b,[[x0,y0,z1],[x0,y0,z0],[x1,y0,z0],[x1,y0,z1]],horizontal,backSize,[0,-1,0]);
  tiles.push({x:(x0+x1)/2,y:(y0+y1)/2,front:new Float32Array(f),back:new Float32Array(b)});
 }
 return tiles;
}
export function paintingTileLight(sample,x,y,z,facing,tile){const angle=[0,-Math.PI/2,Math.PI,Math.PI/2][facing]||0;return sample(x+Math.cos(angle)*tile.x,y+tile.y,z-Math.sin(angle)*tile.x);}
