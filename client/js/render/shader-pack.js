import {parseShaderOptions,validateShaderOptions,applyShaderOptions} from './shader-options.js';
import {packLighting,lightingFrame,lightingOption,basicLightingGLSL} from './shader-lighting.js';
import {selectGLSLFunctions,shaderBlockRules,animationLookup,glslFloatLiterals} from './glsl-functions.js';
import {getBlock as getBlockById} from '../world/blocks.js';
const getBlock=state=>getBlockById(state>>4);
import {resolveState} from '../world/blockstates.js';
const getStateProperties=state=>resolveState(state,()=>0,0,0,0)?.props||{};
import {ZipArchive} from '../util/zip.js';
const MC_VERSION=10809;

function normalize(path){
 const out=[];for(const p of path.split('/')){if(p==='..'){if(!out.length)throw Error('Shader include escapes shaders folder');out.pop();}else if(p&&p!=='.')out.push(p);}return out.join('/');
}
export function shaderPackSources(bytes,dimension=0,options={}){
 const zip=new ZipArchive(bytes),entry=zip.list('').find(p=>/(^|\/)shaders\/(world0\/)?final\.fsh$/.test(p));
 if(!entry)throw Error('Pack has no final.fsh program');
 const root=entry.slice(0,entry.lastIndexOf('shaders/')+8),world=dimension===-1?'world-1':dimension===1?'world1':'world0';
 const start=zip.has(root+world+'/final.fsh')?world+'/final.fsh':'final.fsh';let expanded=0;
 const read=(name,chain=[])=>{
  name=normalize(name);if(chain.includes(name))throw Error('Cyclic shader include: '+[...chain,name].join(' -> '));if(chain.length>32)throw Error('Too many shader include levels');
  let source=zip.readText(root+name);if(source===null)throw Error('Missing shader include: '+name);source=applyShaderOptions(source,options);expanded+=source.length;if(expanded>2*1024*1024)throw Error('Expanded shader is too large');
  return source.replace(/^\s*#include\s+"([^"]+)"\s*$/gm,(_,path)=>read(path.startsWith('/')?path.slice(1):name.slice(0,name.lastIndexOf('/')+1)+path,[...chain,name]));
 };
 return {zip,root,start,read};
}
export function finalShaderSource(bytes,dimension=0,options={}){
 const {read,start}=shaderPackSources(bytes,dimension,options);
 const source=read(start).replace(/^\s*#version[^\n]*$/gm,'').replace(/^\s*#extension\s+GL_ARB_shader_texture_lod[^\n]*$/gm,'');
 if(/^\s*#extension/m.test(source))throw Error('Final pass requests an unsupported GLSL extension');
 return '#version 300 es\nprecision highp float;\nprecision highp int;\n#define MC_VERSION '+MC_VERSION+'\n#define MC_GL_VERSION 302\n#define MC_GLSL_VERSION 330\nout vec4 mcjsFinalColor;\nvec4 mcjsTextureLod(sampler2D s,vec2 uv,int lod){return textureLod(s,uv,float(lod));}\nvec4 mcjsTextureLod(sampler2D s,vec2 uv,float lod){return textureLod(s,uv,lod);}\n'+source.replace(/\bvarying\b/g,'in').replace(/\btexture2DLod\b/g,'mcjsTextureLod').replace(/\btexture2D\b/g,'texture').replace(/\bgl_FragColor\b/g,'mcjsFinalColor')+'\n';
}

// A narrow BSL vertex hook: retain pack functions/settings; no JavaScript GLSL interpreter.
export function wavingShaderSource(bytes,version=MC_VERSION,options={}){
 const {zip,root,read}=shaderPackSources(bytes,0,options);
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

// Only offer authoring options referenced by the supported programs or the colour/lightmap bridge.
export function supportedShaderOptions(bytes){
 const {zip,root}=shaderPackSources(bytes),all=new Map();
 for(const path of zip.list(root))if(/\.(?:glsl|fsh|vsh)$/.test(path))for(const o of parseShaderOptions(zip.readText(path)))if(!all.has(o.name))all.set(o.name,o);
 let used=finalShaderSource(bytes);try{used+='\n'+(wavingShaderSource(bytes)?.source||'');}catch{}
 const settings=zip.readText(root+'lib/settings.glsl');if(settings)used=used.split(settings).join('');
 used=used.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'').replace(/#if(?:def|ndef)?[^\n]*\n\s*#endif/g,'');
 const hasLighting=all.has('BLOCKLIGHT_R')&&all.has('LIGHT_DR')&&all.has('AMBIENT_DR');
 const names=new Set(used.match(/\b[A-Za-z_]\w*\b/g)||[]);
 const lang=zip.readText(root+'lang/en_US.lang')||'',labels=Object.fromEntries(lang.split(/\r?\n/).filter(s=>s.includes('=')).map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));
 return [...all.values()].filter(o=>!['FSH','VSH','OVERWORLD','NETHER','END'].includes(o.name)&&(names.has(o.name)||hasLighting&&lightingOption.test(o.name))&&!(hasLighting&&['TAA','FXAA','WAVING_LAVA','WAVING_FIRE','WAVING_LANTERN'].includes(o.name))).map(o=>({...o,label:labels['option.'+o.name]||o.name,description:labels['option.'+o.name+'.comment']||''}));
}

export class ShaderPackFinal {
 constructor(game){this.game=game;this.passes=new Map();this.enabled=true;this.name='';this.bytes=null;this.target=null;this.error='';this.frame=0;this.startTime=performance.now()/1000;this.lastTime=this.startTime;this.waving=null;this.wavingError='';this.options={};this.availableOptions=[];this.lighting=null;}
 load(name,bytes,options={}){
  const d=this.game.device;if(!d.createFinalShaderPass)throw Error('Shader packs currently require WebGL 2');
  const available=supportedShaderOptions(bytes),valid=validateShaderOptions(available,options);
  const pass=d.createFinalShaderPass(finalShaderSource(bytes,this.game.dimension||0,valid));
  let terrain=null,wave=null,lighting=packLighting(available,valid);
  try{wave=this.game.assets?.data?.blocks?wavingShaderSource(bytes,MC_VERSION,valid):null;if((wave||lighting)&&d.createTerrainAnimation)terrain=d.createTerrainAnimation(wave?.source||'',wave?animationLookup(wave.rules,blockStates(this.game)):null,lighting?basicLightingGLSL:'');}
  catch(e){pass.destroy();throw Error('Shader terrain settings could not compile: '+e.message);}
  this.clear();this.bytes=bytes;this.name=name;this.options=valid;this.availableOptions=available;this.lighting=lighting;this.hasWaving=!!wave;this.waving=terrain;this.wavingError='';this.passes.set(this.game.dimension||0,pass);this.enabled=true;this.error='';
 }
 clear(){this.waving?.destroy();this.waving=null;this.wavingError='';this.game.device.setTerrainAnimation?.(null);for(const p of this.passes.values())p.destroy();this.passes.clear();if(this.target)this.releaseTarget();this.target=null;this.bytes=null;this.name='';this.options={};this.availableOptions=[];this.lighting=null;this.hasWaving=false;}
 releaseTarget(){const d=this.game.device;if(this.target?.fbo)d.gl.deleteFramebuffer(this.target.fbo);if(this.target?.depth)d.gl.deleteRenderbuffer(this.target.depth);d.destroyTexture(this.target);this.target=null;}
 prepareTerrain(camera,eye){const now=performance.now()/1000;this.game.device.setTerrainAnimation?.(this.active?this.waving:null,{time:(now-this.startTime)%3600,worldTime:this.game.world.timeOfDay,camera,eye,lighting:this.lighting?lightingFrame(this.lighting,this.game.world.timeOfDay,this.game.dimension||0,this.game.world.rainStrength||0):null});}
 get active(){return this.enabled&&!!this.bytes;}
 begin(clear){
  const d=this.game.device;if(!this.target||this.target.width!==d.width||this.target.height!==d.height){if(this.target)this.releaseTarget();this.target=d.createRenderTarget(d.width,d.height);}d.setRenderTarget(this.target,clear);
 }
 render(){
  const g=this.game,d=g.device,dimension=g.dimension||0,now=performance.now()/1000;
  const frame={time:(now-this.startTime)%3600,delta:now-this.lastTime,frame:this.frame++,worldTime:g.world.timeOfDay,underwater:!!g.player.eyesInWater,gamma:g.settings.gamma};this.lastTime=now;d.setRenderTarget(null);
  try{if(!this.passes.has(dimension))this.passes.set(dimension,d.createFinalShaderPass(finalShaderSource(this.bytes,dimension,this.options)));this.passes.get(dimension).draw(this.target,frame);}
  catch(e){this.error=e.message;this.enabled=false;console.warn('Shader pack disabled',e.message);this.passes.values().next().value.draw(this.target,frame);}
 }
}
