// Import the protocol-754 registries and gameplay tables from the pinned
// minecraft-data revision, then cross-check registry/state IDs against the
// verified vanilla 1.16.5 reports.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepare,root,cache,target} from './prepare.mjs';
import {ZipFile} from '../../lib/zip.js';

await prepare();
const revision=target.minecraftData.revision;
const base='https://raw.githubusercontent.com/PrismarineJS/minecraft-data/'+revision+'/data/';
const paths=(await (await fetch(base+'dataPaths.json')).json()).pc['1.16.5'];
const sources={};
async function get(path){const r=await fetch(base+path);if(!r.ok)throw new Error(path+': '+r.status);const b=Buffer.from(await r.arrayBuffer());return {data:JSON.parse(b),sha1:createHash('sha1').update(b).digest('hex')};}
for(const name of ['blocks','items','entities','blockCollisionShapes','biomes','foods','effects','enchantments','windows','particles','materials','recipes','sounds']){
  const path=paths[name]+'/'+name+'.json',value=await get(path);sources[name]={path,sha1:value.sha1};await writeFile(join(root,'client/data',name+'.json'),JSON.stringify(value.data)+'\n');
}
const reports=JSON.parse(await readFile(join(cache,'generated/reports/registries.json')));
const blocksReport=JSON.parse(await readFile(join(cache,'generated/reports/blocks.json')));
// 1.16.5 reuses upstream tables from several 1.16 point releases. Registry IDs
// (notably sounds) come from the verified target reports, never the alias table.
for(const [file,registry] of [['sounds','sound_event']]){
 const old=JSON.parse(await readFile(join(root,'client/data',file+'.json'))),byName=new Map(old.map(e=>[e.name,e]));
 const data=Object.entries(reports['minecraft:'+registry].entries).map(([name,e])=>({...byName.get(name.replace('minecraft:','')),id:e.protocol_id,name:name.replace('minecraft:','')})).sort((a,b)=>a.id-b.id);
 await writeFile(join(root,'client/data',file+'.json'),JSON.stringify(data)+'\n');
}

for(const [file,registry] of [['blocks','block'],['items','item'],['entities','entity_type'],['sounds','sound_event']]){
  const data=JSON.parse(await readFile(join(root,'client/data',file+'.json')));
  for(const entry of data){const id=reports['minecraft:'+registry]?.entries['minecraft:'+entry.name]?.protocol_id;if(id!==entry.id)throw new Error('Native registry mismatch '+file+' '+entry.name+' '+id+' != '+entry.id);}
}
const blockData=JSON.parse(await readFile(join(root,'client/data','blocks.json')));
for(const b of blockData){const states=blocksReport['minecraft:'+b.name]?.states;if(!states||states[0].id!==b.minStateId||states.at(-1).id!==b.maxStateId||states.find(s=>s.default)?.id!==b.defaultState)throw new Error('State mismatch '+b.name);}
const entityData=JSON.parse(await readFile(join(root,'client/data','entities.json')));
await writeFile(join(root,'client/js/game/entity-registry-1.16.5.js'),'// Native 1.16.5 entity registry and dimensions, generated from client/data/entities.json.\nexport const ENTITY_REGISTRY_1165='+JSON.stringify(entityData.map(e=>[e.name,e.width,e.height]))+';\n');
const jar=new ZipFile(join(cache,'client.jar')),tags={source:{version:'1.16.5',clientJarSha1:target.downloads.client.sha1}};
const particleSprites={};for(const name of jar.list('assets/minecraft/particles/'))if(name.endsWith('.json'))particleSprites[name.slice('assets/minecraft/particles/'.length,-5)]=JSON.parse(jar.read(name));
await writeFile(join(root,'client/data/particleSprites.json'),JSON.stringify(particleSprites)+'\n');
for(const [kind,registry] of [['blocks','block'],['items','item'],['fluids','fluid'],['entity_types','entity_type']]){
  const prefix='data/minecraft/tags/'+kind+'/',defs={};
  for(const name of jar.list(prefix))if(name.endsWith('.json'))defs['minecraft:'+name.slice(prefix.length,-5)]=JSON.parse(jar.read(name));
  const resolved={},resolve=(name,seen=new Set())=>{if(resolved[name])return resolved[name];if(seen.has(name))throw new Error('Cyclic tag '+name);seen.add(name);const values=[];for(const value of defs[name]?.values||[]){if(value[0]==='#')values.push(...resolve(value.slice(1),new Set(seen)));else{const id=reports['minecraft:'+registry]?.entries[value]?.protocol_id;if(id===undefined)throw new Error('Unknown tag entry '+value);values.push(id);}}return resolved[name]=[...new Set(values)].sort((a,b)=>a-b);};
  for(const name of Object.keys(defs))resolve(name);tags[kind==='entity_types'?'entities':kind]=resolved;
}
await writeFile(join(root,'client/js/game/default-tags.js'),'// Extracted native 1.16.5 tags.\nexport const DEFAULT_TAGS = '+JSON.stringify(tags)+';\n');
await writeFile(join(root,'client/data','runtime-source-1.16.5.json'),JSON.stringify({version:'1.16.5',protocol:754,clientJarSha1:target.downloads.client.sha1,serverJarSha1:target.downloads.server.sha1,minecraftDataRevision:revision,sources},null,2)+'\n');
console.log(`Imported native 1.16.5 tables: ${blockData.length} blocks, ${JSON.parse(await readFile(join(root,'client/data','items.json'))).length} items`);

// Never publish raw tables without target-native mechanics, rendering and shapes.
await import('./finalize-runtime-data.mjs');
