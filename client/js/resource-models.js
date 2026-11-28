import {resourceParts,resourceBlockedAbove} from './resource-layers.js';
// ResourceLocation's default namespace is minecraft; keep other namespaces distinct.
export const resourceName=name=>typeof name==='string'?name.replace(/^minecraft:/,''):name;
export function packEntries(pack,kind){
 const prefix=pack.prefix+'assets/',out=[];
 for(const path of pack.zip.list(prefix)){
  const relative=path.slice(prefix.length),slash=relative.indexOf('/');if(slash<1)continue;
  const namespace=relative.slice(0,slash),rest=relative.slice(slash+1);if(/[^a-z0-9_.-]/.test(namespace)||!rest.startsWith(kind+'/'))continue;
  const name=rest.slice(kind.length+1),key=(namespace==='minecraft'?'':namespace+':')+name;
  out.push({name,key,namespace,path:rest,read:()=>pack.zip.read(path)});
 }
 return out;
}
export function applyPackDefinitions(packs,kind,target,assets=null){
 const priority=assets?.packs||[...packs].reverse();
 for(const key of Object.keys(target)){const [namespace,path]=resourceParts(key);if(resourceBlockedAbove(priority,null,namespace,kind+'/'+path+'.json'))delete target[key];}
 for(const pack of packs)for(const entry of packEntries(pack,kind))if(entry.name.endsWith('.json')&&!resourceBlockedAbove(priority,pack,entry.namespace,entry.path)){
  try{target[entry.key.slice(0,-5)]=JSON.parse(new TextDecoder().decode(entry.read()));}catch{ /* Ignore malformed optional files. */ }
 }
}
export function applyPackModels(packs,models,blockstates,assets=null){
 const priority=assets?.packs||[...packs].reverse();
 for(const [kind,target]of [['models',models],['blockstates',blockstates]])for(const key of Object.keys(target)){const [namespace,path]=resourceParts(key);if(resourceBlockedAbove(priority,null,namespace,kind+'/'+path+'.json'))delete target[key];}
 for(const pack of packs)for(const [kind,target]of [['models',models],['blockstates',blockstates]]){
  for(const entry of packEntries(pack,kind))if(entry.name.endsWith('.json')&&!resourceBlockedAbove(priority,pack,entry.namespace,entry.path)){
   try{target[entry.key.slice(0,-5)]=JSON.parse(new TextDecoder().decode(entry.read()));}catch{ /* Ignore malformed optional files. */ }
  }
 }
}
export function applyPackTextures(packs,files,mcmeta,models,assets=null){
 const priority=assets?.packs||[...packs].reverse();
 for(const key of [...files.keys()]){const [namespace,path]=resourceParts(key);if(resourceBlockedAbove(priority,null,namespace,'textures/'+path+'.png'))files.delete(key);}
 for(const key of Object.keys(mcmeta)){const [namespace,path]=resourceParts(key);if(resourceBlockedAbove(priority,null,namespace,'textures/'+path+'.png.mcmeta'))delete mcmeta[key];}
 const referenced=new Set();
 for(const model of Object.values(models))for(const name of Object.values(model.textures||{}))if(typeof name==='string'&&!name.startsWith('#'))referenced.add(resourceName(name));
 for(const pack of packs){
  const entries=packEntries(pack,'textures').filter(e=>!resourceBlockedAbove(priority,pack,e.namespace,e.path));
  for(const entry of entries.filter(e=>e.key.endsWith('.png'))){
   const key=entry.key.slice(0,-4);if(!/^(blocks?|items?)\//.test(entry.name)&&!referenced.has(key))continue;
   files.set(key,entry.read);delete mcmeta[key];
  }
  for(const entry of entries.filter(e=>e.key.endsWith('.png.mcmeta'))){
   const key=entry.key.slice(0,-11);if(!/^(blocks?|items?)\//.test(entry.name)&&!referenced.has(key))continue;
   try{mcmeta[key]=JSON.parse(new TextDecoder().decode(entry.read()));}catch{}
  }
 }
}
