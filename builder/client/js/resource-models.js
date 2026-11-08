// ResourceLocation's default namespace is minecraft; keep other namespaces distinct.
export const resourceName=name=>typeof name==='string'?name.replace(/^minecraft:/,''):name;
export function packEntries(pack,kind){
 const prefix=pack.prefix+'assets/',out=[];
 for(const path of pack.zip.list(prefix)){
  const relative=path.slice(prefix.length),slash=relative.indexOf('/');if(slash<1)continue;
  const namespace=relative.slice(0,slash),rest=relative.slice(slash+1);if(!rest.startsWith(kind+'/'))continue;
  const name=rest.slice(kind.length+1),key=(namespace==='minecraft'?'':namespace+':')+name;
  out.push({name,key,read:()=>pack.zip.read(path)});
 }
 return out;
}
export function applyPackModels(packs,models,blockstates){
 for(const pack of packs)for(const [kind,target]of [['models',models],['blockstates',blockstates]]){
  for(const entry of packEntries(pack,kind))if(entry.name.endsWith('.json')){
   try{target[entry.key.slice(0,-5)]=JSON.parse(new TextDecoder().decode(entry.read()));}catch{ /* Ignore malformed optional files. */ }
  }
 }
}
export function applyPackTextures(packs,files,mcmeta,models){
 const referenced=new Set();
 for(const model of Object.values(models))for(const name of Object.values(model.textures||{}))if(typeof name==='string'&&!name.startsWith('#'))referenced.add(resourceName(name));
 for(const pack of packs)for(const entry of packEntries(pack,'textures')){
  const png=entry.key.endsWith('.png'),metadata=entry.key.endsWith('.png.mcmeta');if(!png&&!metadata)continue;
  const key=entry.key.slice(0,png?-4:-11);
  if(!/^(blocks?|items?)\//.test(entry.name)&&!referenced.has(key))continue;
  if(png)files.set(key,entry.read);
  else try{mcmeta[key]=JSON.parse(new TextDecoder().decode(entry.read()));}catch{ /* Invalid animation metadata. */ }
 }
}
