import {shaderPackSources} from './shader-pack.js';

// Read the pack author's OptiFine menu, including continued properties lines.
// Hide categories which contain no options implemented by our renderer.
export function shaderMenu(bytes,options){
 const {zip,root}=shaderPackSources(bytes),properties=Object.create(null);
 for(const line of (zip.readText(root+'shaders.properties')||'').replace(/\\\r?\n\s*/g,' ').split(/\r?\n/)){
  const m=/^\s*([^#!\s=]+)\s*=\s*(.*?)\s*$/.exec(line);if(m)properties[m[1]]=m[2];
 }
 const lang=Object.create(null);
 for(const line of (zip.readText(root+'lang/en_US.lang')||'').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)lang[line.slice(0,i)]=line.slice(i+1);}
 const names=new Set(options.map(o=>o.name)),assigned=new Set();
 for(const [key,value]of Object.entries(properties))if(/^screen(?:\.[^.]+)?$/.test(key))for(const name of value.split(/\s+/))if(names.has(name))assigned.add(name);
 const build=(name='',parents=new Set())=>{
  if(parents.has(name))return null;
  const seen=new Set(parents).add(name),key='screen'+(name?'.'+name:''),entries=[];
  const tokens=properties[key]?.split(/\s+/)||(!name?['*']:[]);
  for(const token of tokens){
   if(token==='<empty>'){entries.push(null);continue;}
   if(token==='*'){for(const option of options)if(!assigned.has(option.name))entries.push({option:option.name});continue;}
   if(token.startsWith('[')&&token.endsWith(']')){const child=build(token.slice(1,-1),seen);if(child)entries.push({menu:child});}
   else if(names.has(token))entries.push({option:token});
  }
  if(!entries.some(Boolean))return null;
  // Leading/trailing empty authoring cells become confusing when unsupported
  // options have been removed. Keep interior spacing, but trim empty edges.
  while(entries.length&&!entries[0])entries.shift();while(entries.length&&!entries.at(-1))entries.pop();
  return {name,label:lang['screen.'+name]||name.replace(/_/g,' '),columns:Math.max(1,Math.min(3,Number(properties[key+'.columns'])||2)),entries};
 };
 const menu=build()||{name:'',label:'',columns:2,entries:options.map(o=>({option:o.name}))};
 return {root:menu,sliders:properties.sliders?new Set(properties.sliders.split(/\s+/)):null};
}
