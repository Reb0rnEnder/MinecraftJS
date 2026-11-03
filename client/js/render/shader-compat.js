import {activeGLSL} from './glsl-preprocessor.js';
// Desktop GLSL permits uniform-dependent global initializers; GLSL ES does not.
// Move their assignments into a function called at fragment entry, preserving
// preprocessor branches and declaration order. The GPU still compiles all GLSL.
export function deferredShaderGlobals(source){
  const init=[],clean=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|^[ \t]*#[^\n]*/gm,t=>t.replace(/[^\n]/g,' '));
  const depths=new Int32Array(source.length+1);let depth=0;for(let i=0;i<clean.length;i++){depths[i]=depth;if(clean[i]==='{')depth++;else if(clean[i]==='}')depth--;}
  const result=source.replace(/(^|\n)[ \t]*((?:(?:lowp|mediump|highp)\s+)?(?:float|int|uint|bool|[biu]?vec[234]|mat[234]))\s+(\w+)(\s*\[[^\]]+\])?\s*=\s*([^;]+);/g,(text,newline,type,name,array,value,at)=>{
    if(depths[at+newline.length])return text;
    init.push(name+' = '+value+';');return newline+type+' '+name+(array||'')+';';
  });
  if(!init.length)return source;
  return 'void mcjsInitGlobals();\n'+result.replace(/void\s+main\s*\(\s*\)\s*{/g,'void main(){mcjsInitGlobals();')+'\nvoid mcjsInitGlobals(){\n'+init.join('\n')+'\n}\n';
}
export function shaderCompatibility(zip,root){
  if(zip.has(root+'include/global.glsl')&&zip.has(root+'program/final.fsh'))return {kind:'photon',finalOptions:['CAS','CAS_INTENSITY'],disabled:['COLORED_LIGHTS','TAA','TAAU','DISTANCE_VIEW'],fixed:{DEBUG_VIEW:'0'}};
  if(zip.has(root+'lib/common.glsl')&&zip.has(root+'program/final.glsl'))return {kind:'complementary',finalOptions:['IMAGE_SHARPENING','CHROMA_ABERRATION','UNDERWATER_DISTORTION','WATER_REFRACTION_INTENSITY','VIGNETTE_R'],disabled:['TAA'],fixed:{COLORED_LIGHTING:'0',WORLD_SPACE_REFLECTIONS:'-1'}};
  if(zip.has(root+'shaders.settings'))return {kind:'sildur',disabled:['TAA','Depth_of_Field','Motionblur','Distance_Blur','smoothDof','DoF_Strength','Dof_Distance_View','MB_strength'],fixed:{Showbuffer:'0'}};
  if(zip.has(root+'settings/globalSettings.glsl')&&zip.has(root+'lib/vertex/waving.glsl'))return {kind:'astra',disabled:['DISTORTION','ARC_EN_CIEL','BARREL'],fixed:{}};
  return {kind:'bsl',disabled:[],fixed:{}};
}
export function compatibleShaderSource(source,profile,version=11502){
  source=source.replace(/\\\r?\n/g,' ');
  const disabled=new Set(profile.disabled);
  source=source.replace(/^[ \t]*#define\s+(\w+)\b([^\n]*)/gm,(line,name)=>disabled.has(name)?'#undef '+name:profile.fixed[name]!==undefined?'#define '+name+' '+profile.fixed[name]:line);
  source=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,t=>t.replace(/[^\n]/g,' '));
  source=activeGLSL(source,{MC_VERSION:String(version),MC_RENDER_QUALITY:'1.0'});
  source=source.replace(/\bnoperspective\s+/g,'');
  source=source.replace(/\b(worldTime|isEyeInWater)\s*([*/])\s*(\d+\.\d*)/g,'float($1) $2 $3').replace(/\beyeBrightnessSmooth\.([xy])\b/g,'float(eyeBrightnessSmooth.$1)');
  source=source.split('\n').map(line=>/^\s*#/.test(line)?line:line.replace(/\b([A-Z_]\w*)\s*([*+\/-])\s*(\d+\.\d*)/g,'float($1) $2 $3')).join('\n');
  source=source.replace(/(float\([^()]*\))[ \t]*([+*/-])[ \t]*(\d+)(?![\w.])/g,'$1 $2 $3.0');
  source=source.replace(/(\buniform\s+\w+\s+\w+)\s*=\s*[^;]+;/g,'$1;');
  return deferredShaderGlobals(pruneGLSLProgram(source));
}

// Keep the complete overload set for reachable functions/macros/globals. Desktop
// packs often include helpers for every render stage in their final program;
// unused helpers can request desktop-only types even when final never uses them.
export function pruneGLSLProgram(source){
 const units=[],symbols=new Map();let start=0,depth=0;
 const add=(end)=>{const text=source.slice(start,end),trim=text.trim();start=end;if(!trim)return;const macro=/^#define\s+(\w+)/.exec(trim),fn=/^(?:(?:lowp|mediump|highp)\s+)?\w+\s+(\w+)\s*\([^;]*?\)\s*\{/.exec(trim),decl=/^(?:(?:layout\([^)]*\)|uniform|const|varying|attribute|in|out|flat|smooth|centroid|lowp|mediump|highp)\s+)*\w+\s+(\w+)/.exec(trim);const names=macro?[macro[1]]:fn?[fn[1]]:decl?[decl[1]]:[];if(!macro&&!fn){for(const match of trim.matchAll(/,\s*(\w+)\s*(?=[=;,\[])/g))names.push(match[1]);const instance=/^struct\b[\s\S]*}\s*(\w+)/.exec(trim);if(instance)names.push(instance[1]);}const unit={text,start:end-text.length,names};units.push(unit);for(const name of names){if(!symbols.has(name))symbols.set(name,[]);symbols.get(name).push(unit);}};
 for(let i=0;i<source.length;i++){
  if(!depth&&source[i]==='#'&&/^\s*$/.test(source.slice(start,i))){const end=source.indexOf('\n',i);add(end<0?source.length:end+1);i=start-1;continue;}
  if(source[i]==='{')depth++;
  if(source[i]==='}'&&!--depth){const head=source.slice(start,i+1);if(/\)\s*\{/.test(head)&&!/^\s*struct\b/.test(head)){add(i+1);}}
  if(!depth&&source[i]===';')add(i+1);
 }
 add(source.length);const used=new Set(),visit=name=>{for(const unit of symbols.get(name)||[]){if(used.has(unit))continue;used.add(unit);for(const word of unit.text.match(/\b[A-Za-z_]\w*\b/g)||[])if(word!==name)visit(word);}};visit('main');
 return units.filter(u=>used.has(u)||!u.names.length||/^\s*#/.test(u.text)).map(u=>u.text).join('\n');
}
