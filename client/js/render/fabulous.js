import {FORMAT} from '../gfx/device.js';
const names=['main','translucent','itemEntity','particles','weather','clouds'];
const BLIT=new Float32Array([0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0]);
const STATE={blend:'none',depthTest:false,depthWrite:false,cull:false};
// LevelRenderer's transparency targets, kept independent of spectator/shaderpack
// post-processing. Composition returns to the caller's existing output target.
export class Fabulous {
 constructor(device){this.device=device;this.targets={};this.width=0;this.height=0;this.queue=[];
  this.quad=device.createMesh(FORMAT.color,new Float32Array([-1,1,0,0,0,1,1,1,1,-1,-1,0,0,1,1,1,1,1,1,-1,0,1,1,1,1,1,1,1,1,0,1,0,1,1,1,1]),{quads:true});
  this.entityDevice=new Proxy(device,{get:(d,key)=>key==='draw'?draw=>{if(draw.outputTarget==='itemEntity')this.queue.push(draw);else d.draw(draw);}:typeof d[key]==='function'?d[key].bind(d):d[key]});
 }
 begin(color){const d=this.device;this.output=d.target;this.queue.length=0;
  if(this.width!==d.width||this.height!==d.height){for(const t of Object.values(this.targets))d.destroyTexture(t);this.targets={};this.width=d.width;this.height=d.height;for(const n of [...names,'final'])this.targets[n]=d.createRenderTarget(d.width,d.height,{sampleDepth:true});}
  d.setRenderTarget(this.targets.main,[...color,1]);
 }
 prepare(){const d=this.device,t=this.targets;for(const name of names.slice(1)){d.setRenderTarget(t[name],[0,0,0,0]);if(['translucent','itemEntity','particles'].includes(name))d.copyDepth(t.main,t[name]);}d.setRenderTarget(t.itemEntity);for(const draw of this.queue)d.draw(draw);d.setRenderTarget(t.main);}
 layer(name,draw,depthWrite=false){const d=this.device;d.setRenderTarget(this.targets[name]);if(!depthWrite){draw(d);return;}const wrapped=new Proxy(d,{get:(device,key)=>key==='draw'?cmd=>device.draw({...cmd,state:{...cmd.state,depthWrite:true}}):typeof device[key]==='function'?device[key].bind(device):device[key]});draw(wrapped);}
 finish(){const d=this.device;d.compositeTransparency(names.map(n=>this.targets[n]),this.targets.final);d.setRenderTarget(this.output);d.draw({mesh:this.quad,pipeline:'post',textures:[this.targets.final],params:BLIT,state:STATE});}
 destroy(){for(const t of Object.values(this.targets))this.device.destroyTexture(t);this.targets={};this.device.destroyMesh(this.quad);}
}
