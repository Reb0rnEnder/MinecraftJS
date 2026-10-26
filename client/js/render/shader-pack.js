import {ZipArchive} from '../util/zip.js';

function normalize(path){
 const out=[];for(const p of path.split('/')){if(p==='..'){if(!out.length)throw Error('Shader include escapes shaders folder');out.pop();}else if(p&&p!=='.')out.push(p);}return out.join('/');
}
export function finalShaderSource(bytes,dimension=0){
 const zip=new ZipArchive(bytes),entry=zip.list('').find(p=>/(^|\/)shaders\/(world0\/)?final\.fsh$/.test(p));
 if(!entry)throw Error('Pack has no final.fsh program');
 const root=entry.slice(0,entry.lastIndexOf('shaders/')+8),world=dimension===-1?'world-1':dimension===1?'world1':'world0';
 const start=zip.has(root+world+'/final.fsh')?world+'/final.fsh':'final.fsh';let expanded=0;
 const read=(name,chain=[])=>{
  name=normalize(name);if(chain.includes(name))throw Error('Cyclic shader include: '+[...chain,name].join(' -> '));if(chain.length>32)throw Error('Too many shader include levels');
  const source=zip.readText(root+name);if(source===null)throw Error('Missing shader include: '+name);expanded+=source.length;if(expanded>2*1024*1024)throw Error('Expanded shader is too large');
  return source.replace(/^\s*#include\s+"([^"]+)"\s*$/gm,(_,path)=>read(path.startsWith('/')?path.slice(1):name.slice(0,name.lastIndexOf('/')+1)+path,[...chain,name]));
 };
 const source=read(start).replace(/^\s*#version[^\n]*$/gm,'').replace(/^\s*#extension\s+GL_ARB_shader_texture_lod[^\n]*$/gm,'');
 if(/^\s*#extension/m.test(source))throw Error('Final pass requests an unsupported GLSL extension');
 return '#version 300 es\nprecision highp float;\nprecision highp int;\n#define MC_VERSION 11404\n#define MC_GL_VERSION 302\n#define MC_GLSL_VERSION 330\nout vec4 mcjsFinalColor;\nvec4 mcjsTextureLod(sampler2D s,vec2 uv,int lod){return textureLod(s,uv,float(lod));}\nvec4 mcjsTextureLod(sampler2D s,vec2 uv,float lod){return textureLod(s,uv,lod);}\n'+source.replace(/\bvarying\b/g,'in').replace(/\btexture2DLod\b/g,'mcjsTextureLod').replace(/\btexture2D\b/g,'texture').replace(/\bgl_FragColor\b/g,'mcjsFinalColor')+'\n';
}

// Experimental final stage only. The input is the client's completed scene, not a fabricated BSL gbuffer.
export class ShaderPackFinal {
 constructor(game){this.game=game;this.passes=new Map();this.enabled=true;this.name='';this.bytes=null;this.target=null;this.error='';this.frame=0;this.startTime=performance.now()/1000;this.lastTime=this.startTime;}
 load(name,bytes){
  const d=this.game.device;if(!d.createFinalShaderPass)throw Error('Shader packs currently require WebGL 2');
  const pass=d.createFinalShaderPass(finalShaderSource(bytes,this.game.dimension||0));
  this.clear();this.bytes=bytes;this.name=name;this.passes.set(this.game.dimension||0,pass);this.enabled=true;this.error='';
 }
 clear(){for(const p of this.passes.values())p.destroy();this.passes.clear();if(this.target)this.releaseTarget();this.target=null;this.bytes=null;this.name='';}
 releaseTarget(){const d=this.game.device;if(this.target?.fbo)d.gl.deleteFramebuffer(this.target.fbo);if(this.target?.depth)d.gl.deleteRenderbuffer(this.target.depth);d.destroyTexture(this.target);this.target=null;}
 get active(){return this.enabled&&!!this.bytes;}
 begin(clear){
  const d=this.game.device;if(!this.target||this.target.width!==d.width||this.target.height!==d.height){if(this.target)this.releaseTarget();this.target=d.createRenderTarget(d.width,d.height);}d.setRenderTarget(this.target,clear);
 }
 render(){
  const g=this.game,d=g.device,dimension=g.dimension||0,now=performance.now()/1000;
  const frame={time:(now-this.startTime)%3600,delta:now-this.lastTime,frame:this.frame++,worldTime:g.world.timeOfDay,underwater:!!g.player.eyesInWater,gamma:g.settings.gamma};this.lastTime=now;d.setRenderTarget(null);
  try{if(!this.passes.has(dimension))this.passes.set(dimension,d.createFinalShaderPass(finalShaderSource(this.bytes,dimension)));this.passes.get(dimension).draw(this.target,frame);}
  catch(e){this.error=e.message;this.enabled=false;console.warn('Shader pack disabled',e.message);this.passes.values().next().value.draw(this.target,frame);}
 }
}
