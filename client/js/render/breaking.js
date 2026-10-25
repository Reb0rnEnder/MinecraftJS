import { FORMAT } from '../gfx/device.js';
import { mat4 } from '../gfx/math.js';
import { DIR_OFFSETS } from '../world/blocks.js';
import { Mesher, faceFlags, blockModelOffset } from './mesher.js';
const SHADE=[.5,1,.8,.8,.6,.6];

// Damage follows the same baked quads and UV rotations as the world model.
export function breakingVertices(model,atlas,visible=63,offset=[0,0,0]) {
  const out=[];
  for(const q of model?.quads||[]) {
    if(q.cull>=0&&!(visible&(1<<q.cull)))continue;
    const uv=atlas.uv(q.tex);if(!uv)continue;
    const du=uv[2]-uv[0],dv=uv[3]-uv[1],shade=q.shade?SHADE[q.dir]:1;
    for(let i=0;i<4;i++)out.push(q.pos[i*3]+offset[0],q.pos[i*3+1]+offset[1],q.pos[i*3+2]+offset[2],(q.uv[i*2]-uv[0])/du,(q.uv[i*2+1]-uv[1])/dv,shade,shade,shade,1);
  }
  return new Float32Array(out);
}

function tileVertices(tile,pos) {
  const out=[],draws=[];tile.root.updateWorld(null);tile.root.collect(draws);
  for(const {d,world:m} of draws) {
    const src=d.mesh.cpu;if(!src||d.mat?.pipeline!=='entity')continue; // Sign lettering and beam effects are not block surfaces.
    const size=d.mesh.textureSize||[64,32],su=size[0]/16,sv=(tile.type==='skull'||tile.type==='sign')?2:size[1]/16;
    const first=d.first||0,end=d.count===undefined?src.length/11:first+d.count;
    for(let i=first;i<end;i++) {
      const a=i*11,x=src[a],y=src[a+1],z=src[a+2],nx=src[a+5],ny=src[a+6],nz=src[a+7];
      let dx=m[0]*nx+m[4]*ny+m[8]*nz,dy=m[1]*nx+m[5]*ny+m[9]*nz,dz=m[2]*nx+m[6]*ny+m[10]*nz;
      const len=Math.hypot(dx,dy,dz)||1;dx/=len;dy/=len;dz/=len;
      const shade=.6*dx*dx+.8*dz*dz+(dy<0?.5:1)*dy*dy;
      out.push(m[0]*x+m[4]*y+m[8]*z+m[12]-pos.x,m[1]*x+m[5]*y+m[9]*z+m[13]-pos.y,m[2]*x+m[6]*y+m[10]*z+m[14]-pos.z,(src[a+3]+.0625)*su,(src[a+4]+.0625)*sv,shade,shade,shade,1);
    }
  }
  return new Float32Array(out);
}

export class BreakingOverlay {
  constructor(device,assets){this.device=device;this.assets=assets;this.mesh=null;this.store=null;this.version=-1;}
  clear(){if(this.mesh)this.device.destroyMesh(this.mesh);this.mesh=null;this.store=null;this.last=null;this.mesher=null;}
  update(context,pos,state) {
    const {world,tileRenderer,tileProps,alternatives=true,fancy=true}=context||{};
    if(!world||!state)return null;
    const store=this.assets.modelStore;
    if(this.store!==store||this.version!==this.assets.version){this.clear();this.store=store;this.version=this.assets.version;this.mesher=new Mesher(null,store);}
    const tile=tileRenderer?.breakingModel(pos,state);let vertices;
    if(tile){vertices=tile.root?tileVertices(tile,pos):new Float32Array(0);this.last=null;}
    else {
      const b=world.getBlockDef(pos.x,pos.y,pos.z);if(!b?.hasModel)return null;
      const m=this.mesher;m.world={getState:(x,y,z)=>world.getState(x,y,z),tileProps};m.options.alt=alternatives;m.options.fancy=fancy;m._flags=faceFlags();
      const model=m.getModel(state,pos.x,pos.y,pos.z);if(!model?.quads.length)return null;
      let visible=0;for(let dir=0;dir<6;dir++){const d=DIR_OFFSETS[dir];if(m.shouldRenderFace(state,world.getState(pos.x+d[0],pos.y+d[1],pos.z+d[2]),dir))visible|=1<<dir;}
      const offset=blockModelOffset(b.name,pos.x,pos.y,pos.z),key=visible+':'+offset.join(',');
      if(!this.mesh||this.last?.model!==model||this.last.key!==key){vertices=breakingVertices(model,store.atlas,visible,offset);this.last={model,key};}
    }
    if(vertices){if(this.mesh)this.device.updateMesh(this.mesh,vertices);else this.mesh=this.device.createMesh(FORMAT.color,vertices,{quads:true,dynamic:true});this.count=vertices.length/9;}
    if(!this.count)return null;
    const model=mat4.create();mat4.translate(model,model,pos.x,pos.y,pos.z);
    return {mesh:this.mesh,model};
  }
}
