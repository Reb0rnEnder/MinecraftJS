import {FORMAT,colorParams} from '../gfx/device.js';
import {mat4} from '../gfx/math.js';
import {platform} from '../platform/platform.js';
import {decodePng} from '../util/png.js';
import {LOADING_STYLE,loadingScale,loadingLayout,loadingLogoQuads,loadingRects,loadingProgress} from './loading-overlay.js';
const PARAMS=colorParams(1,1,1,1,.004,0),STATE={blend:'alpha',depthTest:false,depthWrite:false};
const vertices=quads=>new Float32Array(quads.flatMap(([x,y,w,h,u0,v0,u1,v1,c=[1,1,1,1]])=>[x,y,0,u0,v0,...c,x,y+h,0,u0,v1,...c,x+w,y+h,0,u1,v1,...c,x+w,y,0,u1,v0,...c]));
export class Splash{
 constructor(device,settings={}){this.device=device;this.settings=settings;this.progress=0;this.target=0;this.mesh=device.createMesh(FORMAT.color,new Float32Array(0),{quads:true,dynamic:true});this.bar=device.createMesh(FORMAT.color,new Float32Array(0),{quads:true,dynamic:true});this.white=device.createTexture({width:1,height:1,data:new Uint8Array([255,255,255,255])});this.view=mat4.create();this.proj=mat4.create();}
 async load(bytes){if(bytes)try{const img=decodePng(bytes);this.tex=this.device.createTexture({width:img.width,height:img.height,data:img.data,filter:'nearest'});}catch{}}
 setProgress(percent){this.target=Math.max(0,Math.min(1,percent/100));}
 start(){this.running=true;const frame=()=>{if(!this.running)return;this.draw();platform().requestFrame(frame);};frame();}
 stop(){this.running=false;for(const t of[this.tex,this.white])if(t)this.device.destroyTexture(t);this.device.destroyMesh(this.mesh);this.device.destroyMesh(this.bar);}
 draw(){const P=platform(),d=this.device,scale=loadingScale(P.width,P.height,this.settings.guiScale),w=Math.ceil(P.width/scale),h=Math.ceil(P.height/scale),layout=loadingLayout(w,h,this.settings.darkMojangStudiosBackground);this.progress=loadingProgress(this.progress,this.target);d.beginFrame(layout.background);mat4.ortho(this.proj,0,w,h,0,-1,1);d.setGlobals({view:this.view,proj:this.proj,fogMode:2});
  if(this.tex){d.updateMesh(this.mesh,vertices(loadingLogoQuads(layout)),{quads:true});d.draw({mesh:this.mesh,pipeline:'color',textures:[this.tex],params:PARAMS,state:{...STATE,blend:LOADING_STYLE==='studios'?'add':'alpha'}});}
  const rects=loadingRects(layout,this.progress).filter(([x,y,r,b])=>r>x&&b>y).map(([x,y,r,b,c])=>[x,y,r-x,b-y,0,0,1,1,c]);
  if(rects.length){d.updateMesh(this.bar,vertices(rects),{quads:true});d.draw({mesh:this.bar,pipeline:'color',textures:[this.white],params:PARAMS,state:STATE});}d.endFrame();
 }
}
