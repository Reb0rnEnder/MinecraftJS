// Java WorldBorder: packet sizes are diameters, not radii. Time is monotonic
// milliseconds (Util.getMillis); an injected clock makes transitions testable.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class WorldBorder {
  constructor(now=()=>performance.now(),{legacyTime=false,legacyBounds=false,collisionMode='close'}={}){this.now=now;this.legacyTime=legacyTime;this.legacyBounds=legacyBounds;this.collisionMode=collisionMode;this.reset();}
  reset(){this.x=this.z=0;this.oldSize=this.targetSize=59999968;this.started=this.now();this.duration=0;this.absoluteMaxSize=29999984;this.warningTime=15;this.warningBlocks=5;}
  get size(){const elapsed=this.now()-this.started;let t=this.duration?elapsed/this.duration:1;if(this.legacyTime&&this.duration)t=Math.fround(Math.fround(elapsed)/Math.fround(this.duration));if(t<1)return this.oldSize+t*(this.targetSize-this.oldSize);if(this.legacyTime&&this.duration)this.setSize(this.targetSize);return this.targetSize;}
  get radius(){return this.size/2;}
  get remaining(){return this.duration?Math.max(0,this.started+this.duration-this.now()):0;}
  get speed(){return this.duration?Math.abs(this.targetSize-this.oldSize)/this.duration:0;}
  get status(){return this.duration?(this.targetSize<this.oldSize?'shrinking':'growing'):'stationary';}
  get color(){return this.status==='shrinking'?0xff3030:this.status==='growing'?0x40ff80:0x20a0ff;}
  tick(){if(this.duration&&this.remaining===0)this.setSize(this.targetSize);}
  setSize(size){this.oldSize=this.targetSize=size;this.duration=0;}
  lerp(oldSize,newSize,duration){this.oldSize=oldSize;this.targetSize=newSize;this.started=this.now();this.duration=oldSize===newSize?0:Number(duration);}
  bounds(){const r=this.radius,m=this.absoluteMaxSize;if(this.legacyBounds)return[Math.max(this.x-r,-m),Math.max(this.z-r,-m),Math.min(this.x+r,m),Math.min(this.z+r,m)];return [clamp(this.x-r,-m,m),clamp(this.z-r,-m,m),clamp(this.x+r,-m,m),clamp(this.z+r,-m,m)];}
  distance(x,z){const [x0,z0,x1,z1]=this.bounds();return Math.min(x-x0,x1-x,z-z0,z1-z);}
  warning(x,z){
    const d=Math.fround(this.distance(x,z));
    const reach=Math.max(this.warningBlocks,Math.min(this.speed*this.warningTime*1000,Math.abs(this.targetSize-this.size)));
    return d<reach?Math.fround(1-Math.fround(d/reach)):0;
  }
  apply(p){switch(p.action){
    case 0:this.setSize(p.radius);break;
    case 1:this.lerp(p.oldRadius,p.newRadius,p.speed);break;
    case 2:this.x=p.x;this.z=p.z;break;
    case 3:
      this.x=p.x;this.z=p.z;
      if(Number(p.speed)>0)this.lerp(p.oldRadius,p.newRadius,p.speed);else this.setSize(p.newRadius);
      this.absoluteMaxSize=p.portalBoundary;this.warningTime=p.warningTime;this.warningBlocks=p.warningBlocks;break;
    case 4:this.warningTime=p.warningTime;break;
    case 5:this.warningBlocks=p.warningBlocks;break;
  }}
  // Modern Entity.collideBoundingBox adds the border's outside voxel shape
  // only for an entity inside/close to it, allowing an already-outside entity
  // to return. The voxel shape rounds the interior outward to whole blocks.
  collisions(query,mover,out){
    if(!mover||!Number.isFinite(mover.x)||!Number.isFinite(mover.z))return;
    const reach=Math.max(query[3]-query[0],query[5]-query[2],1),[a,b,c,d]=this.bounds();
    const x0=Math.floor(a),z0=Math.floor(b),x1=Math.ceil(c),z1=Math.ceil(d),n=-Infinity,p=Infinity;
    if(this.collisionMode==='legacy'){
      const margin=mover.outsideBorder?-1:1;
      const inside=mover.x>a-margin&&mover.x<c+margin&&mover.z>b-margin&&mover.z<d+margin;
      mover.outsideBorder=!inside;if(!inside)return;
    }else if(this.collisionMode==='inside'){
      const half=mover.width/2,box=typeof mover.bb==='function'?mover.bb():[mover.x-half,mover.y,mover.z-half,mover.x+half,mover.y+mover.height,mover.z+half],eps=1e-7;
      if(box[0]+eps<x0||box[3]-eps>x1||box[2]+eps<z0||box[5]-eps>z1)return;
    }else if(this.distance(mover.x,mover.z)>=reach*2||mover.x<=a-reach||mover.x>=c+reach||mover.z<=b-reach||mover.z>=d+reach)return;
    if(query[0]<x0)out.push([n,n,n,x0,p,p]);
    if(query[3]>x1)out.push([x1,n,n,p,p,p]);
    if(query[2]<z0)out.push([n,n,n,p,p,z0]);
    if(query[5]>z1)out.push([n,n,z1,p,p,p]);
  }
}
