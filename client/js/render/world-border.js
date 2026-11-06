import {FORMAT,colorParams} from '../gfx/device.js';
import {mat4} from '../gfx/math.js';
import {platform} from '../platform/platform.js';

// LevelRenderer.renderWorldBorder, using the jar's forcefield texture. Modern
// versions center the wall's vertical extent on the camera; older targets use
// their native 0..256 wall (selected by their integration).
export function borderGeometry(border,camera,distance,now,{mode='modern',fadePosition=camera}={}){
  const legacyHeight=mode==='classic';
  const [x,y,z]=camera,[x0,z0,x1,z1]=border.bounds();
  if(x<x1-distance&&x>x0+distance&&z<z1-distance&&z>z0+distance)return null;
  let alpha=Math.pow(1-border.distance(fadePosition[0],fadePosition[2])/distance,4);
  if(!legacyHeight)alpha=Math.max(0,Math.min(1,alpha));
  const color=border.color,rgba=[(color>>16&255)/255,(color>>8&255)/255,(color&255)/255,alpha];
  const phase=Math.fround(Math.fround(now%3000)/3000),vertical=distance*4;
  const bottom=legacyHeight?-y:-vertical,top=legacyHeight?256-y:vertical;
  const startV=mode==='modern'?Math.fround(-Math.floor(y*.5)):0;
  const endV=legacyHeight?128:mode==='raised'?Math.fround(vertical-Math.ceil(y)):Math.fround(startV+vertical);
  const vTop=Math.fround(phase+startV),vBottom=Math.fround(phase+endV);
  const data=[],vertex=(a,b,c,u,v)=>data.push(a,b,c,u,v,1,1,1,1);
  function wall(axis,position,min,max,sign){
    let along=Math.max(Math.floor((axis==='x'?z:x)-distance),min),end=Math.min(Math.ceil((axis==='x'?z:x)+distance),max);
    if(legacyHeight)sign=1;
    let u=mode==='modern'?(Math.floor(along)&1)*.5:0;
    while(along<end){const length=Math.min(1,end-along),u0=Math.fround(phase+sign*u),u1=Math.fround(phase+sign*Math.fround(u+Math.fround(length*.5)));
      const point=(a,b,uv,vv)=>axis==='x'?vertex(position-x,b,a-z,uv,vv):vertex(a-x,b,position-z,uv,vv);
      point(along,bottom,u0,vBottom);point(along+length,bottom,u1,vBottom);point(along+length,top,u1,vTop);point(along,top,u0,vTop);
      along+=1;u=Math.fround(u+.5);
    }
  }
  if(x>x1-distance)wall('x',x1,z0,z1,-1);
  if(x<x0+distance)wall('x',x0,z0,z1,1);
  if(z>z1-distance)wall('z',z1,x0,x1,1);
  if(z<z0+distance)wall('z',z0,x0,x1,-1);
  return data.length?{data:new Float32Array(data),rgba}:null;
}
export class BorderRenderer {
  constructor(game,{mode='modern',fadeAtEntity=false}={}){
    this.game=game;this.mode=mode;this.fadeAtEntity=fadeAtEntity;this.mesh=null;this.model=mat4.create();
    const draw=d=>this.draw(d);draw.order=13;game.renderer.extraDraws.push(draw);
  }
  draw(device){
    const g=this.game,r=g.renderer;if(!g.inWorld)return;
    const geometry=borderGeometry(g.worldBorder,r.camPos,r.renderDistance*16,platform().now(),{mode:this.mode,fadePosition:this.fadeAtEntity?[g.player.x,g.player.y,g.player.z]:r.camPos});
    if(!geometry)return;
    const texture=g.assets.texture('misc/forcefield.png',{wrap:'repeat'});if(!texture)return;
    if(!this.mesh)this.mesh=device.createMesh(FORMAT.color,geometry.data,{quads:true,dynamic:true});else device.updateMesh(this.mesh,geometry.data);
    mat4.translate(this.model,mat4.identity(this.model),...r.camPos);
    device.draw({mesh:this.mesh,pipeline:'color',textures:[texture],model:this.model,params:colorParams(...geometry.rgba,this.mode==='classic'?.1:0),state:{blend:'add',cull:false,depthWrite:!!r.fabulousEnabled,polygonOffset:true}});
  }
}
