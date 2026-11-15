import {readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {ZipFile} from '../../lib/zip.js';import {root,cache,target,verify} from './prepare.mjs';
const bytes=await readFile(join(cache,'client.jar'));verify(bytes,target.downloads.client,'default-tag jar');const jar=new ZipFile(join(cache,'client.jar')),registries=JSON.parse(await readFile(join(cache,'generated/reports/registries.json'))),result={};
const qualified=name=>name.includes(':')?name:'minecraft:'+name;
for(const [kind,registry,path]of [['blocks','block','blocks'],['items','item','items'],['fluids','fluid','fluids'],['entities','entity_type','entity_types']]){
 const entries=registries['minecraft:'+registry].entries,prefix='data/minecraft/tags/'+path+'/',raw=new Map(jar.list(prefix).filter(p=>p.endsWith('.json')).map(p=>['minecraft:'+p.slice(prefix.length,-5),JSON.parse(jar.read(p)).values])),tags={};
 function resolve(name,chain=[]){
  if(Object.hasOwn(tags,name))return tags[name];if(chain.includes(name))throw Error('Recursive native tag '+name);if(!raw.has(name))throw Error('Missing native tag '+name);
  const ids=[];
  for(const entry of raw.get(name)){
   const id=typeof entry==='string'?entry:entry.id,required=typeof entry==='string'||entry.required!==false;
   if(id.startsWith('#')){const tag=qualified(id.slice(1));if(!raw.has(tag)&&!required)continue;ids.push(...resolve(tag,[...chain,name]));}
   else{const key=qualified(id),value=entries[key];if(!value&&!required)continue;if(!value)throw Error('Unknown '+registry+' in native tag '+key);ids.push(value.protocol_id);}
  }
  return tags[name]=[...new Set(ids)];
 }
 for(const name of [...raw.keys()].sort())resolve(name);result[kind]=Object.fromEntries(Object.entries(tags).sort(([a],[b])=>a.localeCompare(b)));
}
const data={source:{version:target.minecraftVersion,clientJarSha1:target.downloads.client.sha1},...result},text='// Extracted from this target jar and native registry IDs; server Tags replace these defaults.\nexport const DEFAULT_TAGS = '+JSON.stringify(data)+';\n',out=join(root,'client/js/game/default-tags.js');
if(process.argv.includes('--check')){if(await readFile(out,'utf8')!==text)throw Error('Stale native default tags');}else await writeFile(out,text);
console.log('Native 1.20.6 default tags: '+Object.entries(result).map(([kind,tags])=>kind+'='+Object.keys(tags).length).join(', '));
