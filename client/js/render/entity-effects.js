// Vanilla RenderDragon, RenderGuardian and LayerEnderDragonDeath, from the pinned client jars.
// Effects have their own visibility bounds: a beam can cross the view while its owner is off screen.
import { Node, material } from '../gfx/scene.js';
import { FORMAT, colorParams } from '../gfx/device.js';
import { mat4, D2R } from '../gfx/math.js';
import { JavaRandom } from '../util/jrandom.js';

const TAU = Math.PI * 2;
const vertex = (out, p, u, v, c = [1, 1, 1, 1]) => out.push(...p, u, v, ...c);
const transform = (m, x, y, z) => [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
const point = (p, y = 0) => [p.x, p.y + y, p.z];
export const crystalBob = age => { const f = Math.sin(age * 0.2) / 2 + 0.5; return (f*f+f)*0.2; };
export const isDragon = e => e.kind === 'mob' && e.type === 63;

// RenderDragon's octagonal taper, black at the dragon and white at the crystal.
export function crystalBeam(start, end, age) {
  const dx=end[0]-start[0], dy=end[1]-start[1], dz=end[2]-start[2], len=Math.hypot(dx,dy,dz);
  const m=mat4.create(); mat4.translate(m,m,...start);
  mat4.rotateY(m,m,-Math.atan2(dz,dx)-Math.PI/2);
  mat4.rotateX(m,m,-Math.atan2(Math.hypot(dx,dz),dy)-Math.PI/2);
  const out=[], v0=-age*0.01, v1=len/32+v0;
  for(let i=0;i<8;i++) {
    const a=i/8*TAU,b=(i+1)/8*TAU;
    vertex(out,transform(m,Math.sin(a)*0.15,Math.cos(a)*0.15,0),i/8,v0,[0,0,0,1]);
    vertex(out,transform(m,Math.sin(a)*0.75,Math.cos(a)*0.75,len),i/8,v1);
    vertex(out,transform(m,Math.sin(b)*0.75,Math.cos(b)*0.75,len),(i+1)/8,v1);
    vertex(out,transform(m,Math.sin(b)*0.15,Math.cos(b)*0.15,0),(i+1)/8,v0,[0,0,0,1]);
  }
  return new Float32Array(out);
}

// Two rotating crossed planes plus an alternating end cap; attack charge changes the beam colour.
export function guardianBeam(start, end, age, ticks, charge) {
  const dx=end[0]-start[0],dy=end[1]-start[1],dz=end[2]-start[2], dist=Math.hypot(dx,dy,dz);
  if (!dist) return new Float32Array(0);
  const len=dist+1,m=mat4.create(); mat4.translate(m,m,...start);
  mat4.rotateY(m,m,Math.PI/2-Math.atan2(dz,dx)); mat4.rotateX(m,m,Math.acos(dy/dist));
  const out=[],a=-age*0.075,f=charge*charge,c=[(64+Math.floor(f*191))/255,(32+Math.floor(f*191))/255,(128-Math.floor(f*64))/255,1];
  const pos=(angle,r,y)=>transform(m,Math.cos(angle)*r,y,Math.sin(angle)*r);
  const v0=-1+(age*0.5%1),v1=len*2.5+v0;
  for(const offset of [0,Math.PI/2]) {
    vertex(out,pos(a+offset+Math.PI,0.2,len),0.4999,v1,c);
    vertex(out,pos(a+offset+Math.PI,0.2,0),0.4999,v0,c);
    vertex(out,pos(a+offset,0.2,0),0,v0,c);
    vertex(out,pos(a+offset,0.2,len),0,v1,c);
  }
  const v=ticks%2===0?0.5:0;
  for(const [angle,u,w] of [[3*Math.PI/4,0.5,v+0.5],[Math.PI/4,1,v+0.5],[7*Math.PI/4,1,v],[5*Math.PI/4,0.5,v]]) vertex(out,pos(a+angle,0.282,len),u,w,c);
  return new Float32Array(out);
}

export function dragonCorpseMatrix(e, partial) {
  const wrap=a=>((a%360)+540)%360-180;
  const off=i=>{ const j=(e.ringIdx-i)&63,k=(j-1)&63,a=e.ring?.[j]||[e.yaw,e.y],b=e.ring?.[k]||a,t=e.dead?0:1-partial; return [a[0]+wrap(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]; };
  const m=mat4.create();mat4.rotateY(m,m,-off(7)[0]*D2R);mat4.rotateX(m,m,(off(5)[1]-off(10)[1])*10*D2R);mat4.translate(m,m,0,0,1);
  mat4.scale(m,m,-1,-1,1);mat4.translate(m,m,0,-1.5078125,0);return m;
}

export function dragonDeathRays(e, partial) {
  const f=Math.min(1,((e.deathTime||0)+partial)/200),fade=f>=1?1:f>0.8?(f-0.8)/0.2:0;
  const random=new JavaRandom(432),out=[];
  // The layer's rotations accumulate between ray fans, as they do on vanilla's matrix stack.
  const local=dragonCorpseMatrix(e,partial);mat4.translate(local,local,0,-1,-2);
  for(let i=0;i<(f+f*f)/2*60;i++) {
    for(const axis of ['X','Y','Z','X','Y','Z']) mat4['rotate'+axis](local,local,random.nextFloat()*TAU);
    // The sixth rotation also includes the death progress.
    mat4.rotateZ(local,local,f*90*D2R);
    const length=random.nextFloat()*20+5+fade*10,width=random.nextFloat()*2+1+fade*2;
    const origin=transform(local,0,0,0),ends=[[-0.866*width,length,-0.5*width],[0.866*width,length,-0.5*width],[0,length,width]];
    const world=p=>[p[0]+e.x,p[1]+e.y,p[2]+e.z];
    for(let j=0;j<3;j++) {
      vertex(out,world(origin),0,0,[1,1,1,1-fade]);
      vertex(out,world(transform(local,...ends[j])),0,0,[1,0,1,0]);
      const tip=world(transform(local,...ends[(j+1)%3]));vertex(out,tip,0,0,[1,0,1,0]);vertex(out,tip,0,0,[1,0,1,0]);
    }
  }
  return new Float32Array(out);
}

// Client-only state. Health, targets, movement packets and entity removal remain server authoritative.
export function tickEntityEffects(e,entities) {
  if(e.type===68 && e.kind==='mob' && e.guardianTarget) e.guardianBeamTicks=Math.min(e.elder?60:80,(e.guardianBeamTicks||0)+1);
  if(!isDragon(e) || e.dead) return;
  const old=entities.get(e.healingCrystal);
  if (e.crystalSearchTick !== undefined && e.ticks - e.crystalSearchTick < 10 && (e.healingCrystal === undefined || old && !old.dead)) return;
  e.crystalSearchTick = e.ticks;
  let nearest=null,best=Infinity;
  for(const c of entities.all()) {
    if(c.kind!=='crystal'||c.dead) continue;
    const hw=(e.width||16)/2;
    if(Math.abs(c.x-e.x)>32+hw || Math.abs(c.z-e.z)>32+hw || c.y<e.y-32 || c.y>e.y+(e.height||8)+32) continue;
    const d=(c.x-e.x)**2+(c.y-e.y)**2+(c.z-e.z)**2;
    if(d<best){best=d;nearest=c;}
  }
  e.healingCrystal=nearest?.id;
}

export function tickDragonDeath(e,g) {
  e.y+=0.1;e.yaw+=20;e.bodyYaw=e.yaw;
  // EntityDragon emits a large explosion each death tick, and a huge explosion at 180..200.
  const x=e.x+(Math.random()-0.5)*8,y=e.y+2+(Math.random()-0.5)*4,z=e.z+(Math.random()-0.5)*8;
  g.particles.largeExplode(x,y,z);
  if(e.deathTime>=180 && e.deathTime<=200) g.particles.hugeExplode(x,y,z);
}

export class EntityEffects {
  constructor(game) {this.game=game;this.entries=new Map();this.root=new Node();game.renderer.entityRoot.add(this.root);
    this.beamTexture=game.assets.data?.items?.some(i=>i.name==='trident')?'entity/end_crystal/end_crystal_beam.png':'entity/endercrystal/endercrystal_beam.png';}
  remove(id) {for(const [key,v] of this.entries)if(v.id===id){this.root.remove(v.node);this.game.device.destroyMesh(v.mesh);this.entries.delete(key);}}
  reset(){for(const v of this.entries.values()){this.root.remove(v.node);this.game.device.destroyMesh(v.mesh);}this.entries.clear();}
  _set(key,id,vertices,texture,state={blend:'none',cull:false},order=1) {
    let v=this.entries.get(key);const g=this.game;
    if(!v){const node=new Node(),mesh=g.device.createMesh(FORMAT.color,new Float32Array(0),{quads:true,dynamic:true});
      const tex=texture?()=>g.assets.texture(texture,{wrap:'repeat'}):null;
      node.addDrawable(mesh,material('color',tex,colorParams(1,1,1,1,texture ? 0.1 : 0,0),state),{order});this.root.add(node);v={id,node,mesh};this.entries.set(key,v);}
    v.node.visible=true;v.used=true;g.device.updateMesh(v.mesh,vertices,{quads:true});
  }
  update(partial) {
    const g=this.game,entities=g.entities;
    for(const v of this.entries.values())v.used=false;
    const visible=(a,b,pad=1)=>{
      const cam=g.renderer.camPos,dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=dx*dx+dy*dy+dz*dz;
      const t=len?Math.max(0,Math.min(1,((cam[0]-a[0])*dx+(cam[1]-a[1])*dy+(cam[2]-a[2])*dz)/len)):0;
      if(Math.hypot(cam[0]-a[0]-t*dx,cam[1]-a[1]-t*dy,cam[2]-a[2]-t*dz)>g.settings.renderDistance*16+pad)return false;
      return g.renderer.boxVisible(Math.min(a[0],b[0])-pad,Math.min(a[1],b[1])-pad,Math.min(a[2],b[2])-pad,Math.max(a[0],b[0])+pad,Math.max(a[1],b[1])+pad,Math.max(a[2],b[2])+pad);
    };
    const beamTex=this.beamTexture;
    for(const e of entities.all()) {
      const age=(e.ticks||0)+partial,p=entities.interp(e,partial);
      if(isDragon(e)) {
        const c=entities.get(e.healingCrystal);
        if(c && !c.dead) {
          const a=point(p,2),b=[c.x,c.y+1+crystalBob((c.ticks||0)+partial),c.z];
          if(visible(a,b))this._set('heal:'+e.id,e.id,crystalBeam(a,b,age),beamTex);
        }
        if(e.deathTime>0 && e.deathTime<=200 && visible(point(p),point(p),45))this._set('death:'+e.id,e.id,dragonDeathRays({...e,...p},partial),null,{blend:'add',depthWrite:false,cull:false},3);
      }
      if(e.kind==='crystal' && e.beamTarget) {
        const t=e.beamTarget,a=[t.x+0.5,t.y+2.5,t.z+0.5],b=point(p,1+crystalBob(age));
        if(visible(a,b))this._set('crystal:'+e.id,e.id,crystalBeam(a,b,age),beamTex);
      }
      if(e.type===68 && e.kind==='mob' && !e.dead && e.guardianTarget) {
        const t=e.guardianTarget===g.entityId?entities.self:entities.get(e.guardianTarget);
        if(t && !t.dead) {
          const a=point(p,e.height*0.5||0.425),b=point(entities.interp(t,partial),(t.height||1.8)*0.5);
          if(visible(a,b))this._set('guardian:'+e.id,e.id,guardianBeam(a,b,(g.ticks||0)+partial,e.ticks,Math.min(1,((e.guardianBeamTicks||0)+partial)/(e.elder?60:80))),'entity/guardian_beam.png');
        }
      }
    }
    for(const [key,v] of this.entries)if(!v.used){this.root.remove(v.node);g.device.destroyMesh(v.mesh);this.entries.delete(key);}
  }
}
