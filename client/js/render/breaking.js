import { FORMAT } from '../gfx/device.js';
import { mat4 } from '../gfx/math.js';
import { DIR_OFFSETS, getBlock } from '../world/blocks.js';
import { Mesher, faceFlags, blockModelOffset } from './mesher.js';
const SHADE=[.5,1,.8,.8,.6,.6];

// Damage follows the same baked quads and UV rotations as the world model.
export function breakingVertices(model,atlas,visible=63,offset=[0,0,0],colors=null) {
  const out=[];
  let qi=0;for(const q of model?.quads||[]) {
    const colorBase=qi++*4;
    if(q.cull>=0&&!(visible&(1<<q.cull)))continue;
    const uv=atlas.uv(q.tex);if(!uv)continue;
    const du=uv[2]-uv[0],dv=uv[3]-uv[1],shade=q.shade?SHADE[q.dir]:1;
    for(let i=0;i<4;i++){const color=colors?colors[colorBase+i]:shade;out.push(q.pos[i*3]+offset[0],q.pos[i*3+1]+offset[1],q.pos[i*3+2]+offset[2],(q.uv[i*2]-uv[0])/du,(q.uv[i*2+1]-uv[1])/dv,color,color,color,1);}
  }
  return new Float32Array(out);
}

// SheetedDecalTextureGenerator projects transformed positions onto the nearest
// face, independently of the block entity's skin atlas (native 1.15+).
export function decalUV(x,y,z,nx,ny,nz) {
  const ax=Math.abs(nx),ay=Math.abs(ny),az=Math.abs(nz);
  if (ay>=ax && ay>=az) return [x,ny<0?-z:z];
  if (az>=ax) return [nz<0?-x:x,-y];
  return [nx<0?-z:z,-y];
}

function tileVertices(tile,pos) {
  const out=[],draws=[];tile.root.updateWorld(null);tile.root.collect(draws);
  for(const {d,world:m} of draws) {
    const src=d.mesh.cpu;if(!src||d.mat?.pipeline!=='entity')continue; // Sign lettering and beam effects are not block surfaces.
    const first=d.first||0,end=d.count===undefined?src.length/11:first+d.count;
    for(let i=first;i<end;i++) {
      const a=i*11,x=src[a],y=src[a+1],z=src[a+2],nx=src[a+5],ny=src[a+6],nz=src[a+7];
      let dx=m[0]*nx+m[4]*ny+m[8]*nz,dy=m[1]*nx+m[5]*ny+m[9]*nz,dz=m[2]*nx+m[6]*ny+m[10]*nz;
      const len=Math.hypot(dx,dy,dz)||1;dx/=len;dy/=len;dz/=len;
      const shade=1; // SheetedDecalTextureGenerator overrides the source color with white.
      const px=m[0]*x+m[4]*y+m[8]*z+m[12]-pos.x,py=m[1]*x+m[5]*y+m[9]*z+m[13]-pos.y,pz=m[2]*x+m[6]*y+m[10]*z+m[14]-pos.z;
      const [u,v]=decalUV(px,py,pz,dx,dy,dz);
      out.push(px,py,pz,u,v,shade,shade,shade,1);
    }
  }
  return new Float32Array(out);
}

// Native model damage retains directional shade/AO in its vertex colors,
// but the crumbling render type never multiplies a lightmap into those colors.
export function breakingColors(m,model,state,pos,smooth){
 const colors=[],useAO=smooth&&model.ao&&getBlock(state).emitLight===0,axes=[[[1,0,0],[0,0,1]],[[1,0,0],[0,0,1]],[[1,0,0],[0,1,0]],[[1,0,0],[0,1,0]],[[0,0,1],[0,1,0]],[[0,0,1],[0,1,0]]];m._cornerValid.fill(0);
 for(const q of model.quads){const shade=q.shade?SHADE[q.dir]:1,axis=q.dir>>1,ci=axis===0?1:axis===1?2:0,plane=q.pos[ci],aligned=[3,6,9].every(i=>Math.abs(q.pos[i+ci]-plane)<1e-4);
  let corners=null;
  if(useAO&&aligned){const flush=q.dir&1?plane>.9999:plane<.0001,d=DIR_OFFSETS[q.dir],ck=q.dir*2+(flush?1:0);corners=m._corners[ck];if(!m._cornerValid[ck]){m.faceCorners(pos.x+(flush?d[0]:0),pos.y+(flush?d[1]:0),pos.z+(flush?d[2]:0),q.dir,corners);m._cornerValid[ck]=1;}}
  for(let i=0;i<4;i++){let ao=1;if(corners){const[e1,e2]=axes[q.dir],p=q.pos.slice(i*3,i*3+3),u=p.reduce((v,n,j)=>v+n*e1[j],0),v=p.reduce((r,n,j)=>r+n*e2[j],0);ao=corners[0][0]*(1-u)*(1-v)+corners[1][0]*u*(1-v)+corners[2][0]*u*v+corners[3][0]*(1-u)*v;}colors.push(shade*ao);}
 }
 return colors;
}

export class BreakingOverlay {
  constructor(device,assets){this.device=device;this.assets=assets;this.mesh=null;this.store=null;this.version=-1;}
  clear(){if(this.mesh)this.device.destroyMesh(this.mesh);this.mesh=null;this.store=null;this.last=null;this.mesher=null;}
  update(context,pos,state) {
    const {world,tileRenderer,tileProps,alternatives=true,fancy=true,smooth=true}=context||{};
    if(!world||!state)return null;
    const store=this.assets.modelStore;
    if(this.store!==store||this.version!==this.assets.version){this.clear();this.store=store;this.version=this.assets.version;this.mesher=new Mesher(null,store);}
    const tile=tileRenderer?.breakingModel(pos,state);let vertices;
    if(tile){vertices=tile.root?tileVertices(tile,pos):new Float32Array(0);this.last=null;}
    else {
      const b=world.getBlockDef(pos.x,pos.y,pos.z);if(!b?.hasModel)return null;
      const m=this.mesher;m.world={getState:(x,y,z)=>world.getState(x,y,z),getLight:(x,y,z)=>(world.getSkyLight(x,y,z)<<4)|world.getBlockLight(x,y,z),tileProps};m.options.alt=alternatives;m.options.fancy=fancy;m._flags=faceFlags();
      const model=m.getModel(state,pos.x,pos.y,pos.z);if(!model?.quads.length)return null;
      let visible=0;for(let dir=0;dir<6;dir++){const d=DIR_OFFSETS[dir];if(m.shouldRenderFace(state,world.getState(pos.x+d[0],pos.y+d[1],pos.z+d[2]),dir))visible|=1<<dir;}
      const offset=blockModelOffset(b.name,pos.x,pos.y,pos.z),colors=breakingColors(m,model,state,pos,smooth),key=visible+':'+offset.join(',')+':'+colors.join(',');
      if(!this.mesh||this.last?.model!==model||this.last.key!==key){vertices=breakingVertices(model,store.atlas,visible,offset,colors);this.last={model,key};}
    }
    if(vertices){if(this.mesh)this.device.updateMesh(this.mesh,vertices);else this.mesh=this.device.createMesh(FORMAT.color,vertices,{quads:true,dynamic:true});this.count=vertices.length/9;}
    if(!this.count)return null;
    const model=mat4.create();mat4.translate(model,model,pos.x,pos.y,pos.z);
    return {mesh:this.mesh,model};
  }
}
