import {selectGLSLFunctions,shaderBlockRules,animationLookup,glslFloatLiterals} from './glsl-functions.js';
import {getBlock,getStateProperties} from '../world/blocks.js';
import {ZipArchive} from '../util/zip.js';
const MC_VERSION=11404;

function normalize(path){
 const out=[];for(const p of path.split('/')){if(p==='..'){if(!out.length)throw Error('Shader include escapes shaders folder');out.pop();}else if(p&&p!=='.')out.push(p);}return out.join('/');
}
export function shaderPackSources(bytes,dimension=0){
 const zip=new ZipArchive(bytes),entry=zip.list('').find(p=>/(^|\/)shaders\/(world0\/)?final\.fsh$/.test(p));
 if(!entry)throw Error('Pack has no final.fsh program');
 const root=entry.slice(0,entry.lastIndexOf('shaders/')+8),world=dimension===-1?'world-1':dimension===1?'world1':'world0';
 const start=zip.has(root+world+'/final.fsh')?world+'/final.fsh':'final.fsh';let expanded=0;
 const read=(name,chain=[])=>{
  name=normalize(name);if(chain.includes(name))throw Error('Cyclic shader include: '+[...chain,name].join(' -> '));if(chain.length>32)throw Error('Too many shader include levels');
  const source=zip.readText(root+name);if(source===null)throw Error('Missing shader include: '+name);expanded+=source.length;if(expanded>2*1024*1024)throw Error('Expanded shader is too large');
  return source.replace(/^\s*#include\s+"([^"]+)"\s*$/gm,(_,path)=>read(path.startsWith('/')?path.slice(1):name.slice(0,name.lastIndexOf('/')+1)+path,[...chain,name]));
 };
 return {zip,root,start,read};
}
export function finalShaderSource(bytes,dimension=0){
 const {read,start}=shaderPackSources(bytes,dimension);
 const source=read(start).replace(/^\s*#version[^\n]*$/gm,'').replace(/^\s*#extension\s+GL_ARB_shader_texture_lod[^\n]*$/gm,'');
 if(/^\s*#extension/m.test(source))throw Error('Final pass requests an unsupported GLSL extension');
 return '#version 300 es\nprecision highp float;\nprecision highp int;\n#define MC_VERSION '+MC_VERSION+'\n#define MC_GL_VERSION 302\n#define MC_GLSL_VERSION 330\nout vec4 mcjsFinalColor;\nvec4 mcjsTextureLod(sampler2D s,vec2 uv,int lod){return textureLod(s,uv,float(lod));}\nvec4 mcjsTextureLod(sampler2D s,vec2 uv,float lod){return textureLod(s,uv,lod);}\n'+source.replace(/\bvarying\b/g,'in').replace(/\btexture2DLod\b/g,'mcjsTextureLod').replace(/\btexture2D\b/g,'texture').replace(/\bgl_FragColor\b/g,'mcjsFinalColor')+'\n';
}

// A narrow BSL vertex hook: retain pack functions/settings; no JavaScript GLSL interpreter.
export function wavingShaderSource(bytes,version=MC_VERSION){
 const {zip,root,read}=shaderPackSources(bytes);
 if(!zip.has(root+'lib/vertex/waving.glsl'))return null;
 const selected=selectGLSLFunctions(read('lib/vertex/waving.glsl'),'WavingBlocks');
 const settings=read('lib/settings.glsl');
 const source=`#define MC_VERSION ${version}
#define VSH
${settings}
uniform vec4 uWaveFrame;
uniform vec3 cameraPosition;
uniform vec3 relativeEyePosition;
#ifdef WORLD_TIME_ANIMATION
#define time (uWaveFrame.y*0.05*ANIMATION_SPEED)
#else
#define time (uWaveFrame.x*ANIMATION_SPEED)
#endif
${glslFloatLiterals(selected.source)}
`;
 const properties=zip.readText(root+'block.properties');if(properties===null)throw Error('Waving program has no block.properties mapping');
 return {source,rules:shaderBlockRules(properties,version),functions:selected.functions};
}
function blockStates(game){
 const definitions=game.assets.data.blocks,flattened=definitions.some(b=>b.minStateId!==undefined),count=flattened?Math.max(...definitions.map(b=>b.maxStateId))+1:(Math.max(...definitions.map(b=>b.id))+1)*16;
 return Array.from({length:count},(_,id)=>({id,name:getBlock(id)?.name||'',properties:getStateProperties(id)}));
}

// Experimental final stage only. The input is the client's completed scene, not a fabricated BSL gbuffer.
export class ShaderPackFinal {
 constructor(game){this.game=game;this.passes=new Map();this.enabled=true;this.name='';this.bytes=null;this.target=null;this.error='';this.frame=0;this.startTime=performance.now()/1000;this.lastTime=this.startTime;this.waving=null;this.wavingError='';}
 load(name,bytes){
  const d=this.game.device;if(!d.createFinalShaderPass)throw Error('Shader packs currently require WebGL 2');
  const pass=d.createFinalShaderPass(finalShaderSource(bytes,this.game.dimension||0));
  this.clear();this.bytes=bytes;this.name=name;this.passes.set(this.game.dimension||0,pass);this.enabled=true;this.error='';
  try{const wave=wavingShaderSource(bytes);if(wave&&d.createTerrainAnimation)this.waving=d.createTerrainAnimation(wave.source,animationLookup(wave.rules,blockStates(this.game)));}catch(e){this.wavingError=e.message;console.warn('Pack vertex animation unavailable',e.message);}
 }
 clear(){this.waving?.destroy();this.waving=null;this.wavingError='';this.game.device.setTerrainAnimation?.(null);for(const p of this.passes.values())p.destroy();this.passes.clear();if(this.target)this.releaseTarget();this.target=null;this.bytes=null;this.name='';}
 releaseTarget(){const d=this.game.device;if(this.target?.fbo)d.gl.deleteFramebuffer(this.target.fbo);if(this.target?.depth)d.gl.deleteRenderbuffer(this.target.depth);d.destroyTexture(this.target);this.target=null;}
 prepareTerrain(camera,eye){const now=performance.now()/1000;this.game.device.setTerrainAnimation?.(this.active?this.waving:null,{time:(now-this.startTime)%3600,worldTime:this.game.world.timeOfDay,camera,eye});}
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
