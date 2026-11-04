// Discover the pack's own stage files. Never synthesize sky/water programs.
export function shaderStagePlan(zip,root,dimension=0){
 const world=dimension===-1?'world-1':dimension===1?'world1':'world0',stages=new Map();
 for(const name of zip.list(root)){const rel=name.slice(root.length),m=/^(?:(world-?\d+)\/)?([^/]+)\.fsh$/.exec(rel);if(!m||m[1]&&m[1]!==world)continue;const previous=stages.get(m[2]);if(!previous||m[1]===world)stages.set(m[2],rel);}
 const ordered=[...stages.keys()].filter(n=>/^(deferred|composite)\d*$/.test(n)).sort((a,b)=>{const group=n=>n.startsWith('deferred')?0:1;return group(a)-group(b)||(Number(a.match(/\d+$/)?.[0]||0)-Number(b.match(/\d+$/)?.[0]||0));});
 return {post:ordered,geometry:[...stages.keys()].filter(n=>/^gbuffers_/.test(n)).sort(),shadow:[...stages.keys()].filter(n=>/^shadow/.test(n)).sort(),files:Object.fromEntries(stages)};
}
// The native scene inputs available to a post stage. Best-effort imports may
// explicitly report colour/depth fallbacks; this does not implement those buffers.
export const POST_SCENE_SAMPLERS=new Set(['colortex0','gcolor','depthtex0','noisetex']);
export function validatePostOutputs(source,name){
 for(const m of source.matchAll(/const\s+int\s+colortex\d+Format\s*=\s*(\w+)/g))if(!['RGBA','RGBA8'].includes(m[1]))throw Error(name+' needs unsupported scene format: '+m[1]);
 if(/const\s+bool\s+colortex\d+(?:Clear\s*=\s*false|MipmapEnabled\s*=\s*true)/.test(source))throw Error(name+' needs persistent or mipmapped scene attachments');
 const outputs=[...source.matchAll(/\bgl_FragData\s*\[\s*(\d+)\s*\]/g)].map(m=>Number(m[1]));
 const layout=[...source.matchAll(/layout\s*\([^)]*location\s*=\s*(\d+)[^)]*\)\s*out/g)].map(m=>Number(m[1]));
 const buffers=[...source.matchAll(/\/\*\s*(?:DRAWBUFFERS|RENDERTARGETS)\s*:\s*([^*]+)\*\//g)].map(m=>m[1].trim());
 if(outputs.some(n=>n!==0)||layout.some(n=>n!==0)||buffers.some(s=>s!=='0'))throw Error(name+' requires multiple or nonzero colour attachments');
}

export function shaderProgramEnabled(properties,dimension,name){
 const world=dimension===-1?'world-1':dimension===1?'world1':'world0',entries=new Map();
 for(const line of properties.replace(/\\\r?\n/g,' ').split(/\r?\n/)){const m=/^[ \t]*([^#!\s=]+)[ \t]*=[ \t]*(.*)$/.exec(line);if(m)entries.set(m[1],m[2].trim());}
 const value=entries.get('program.'+world+'/'+name+'.enabled')??entries.get('program.'+name+'.enabled');
 if(value&&value!=='true'&&value!=='false')throw Error(name+' has an unsupported program-enable expression: '+value);
 for(const key of ['size.buffer.colortex0','scale.'+name,'flip.'+name+'.colortex0'])if(entries.has(key))throw Error(name+' needs unsupported attachment configuration: '+key);
 return value!=='false';
}
