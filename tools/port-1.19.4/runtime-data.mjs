// Import pinned upstream tables, validating IDs and properties against native
// reports before installing them. Target-native shapes and mechanics follow.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';import{promisify}from'node:util';
import {createHash} from 'node:crypto';import{join}from'node:path';
import {prepare,root,cache,target} from './prepare.mjs';
import {initBlocks,getStateProperties} from '../../client/js/world/blocks.js';
await prepare();
const revision=target.minecraftData.revision,base='https://raw.githubusercontent.com/PrismarineJS/minecraft-data/'+revision+'/data/';
async function get(path){const file=join(cache,'upstream',path);let data;try{data=await readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;const{stdout}=await promisify(execFile)('curl',['--fail','--silent','--show-error','--location','--retry','3',base+path],{encoding:'buffer',maxBuffer:32*1024*1024});data=stdout;await mkdir(join(file,'..'),{recursive:true});await writeFile(file,data);}return{data:JSON.parse(data),sha1:createHash('sha1').update(data).digest('hex')};}
const paths=(await get('dataPaths.json')).data.pc['1.19.4'],sources={},tables={};
for(const name of ['blocks','items','entities','blockCollisionShapes','biomes','foods','effects','enchantments','windows','particles','materials','recipes','sounds']){const path=paths[name]+'/'+name+'.json',input=await get(path);tables[name]=input.data;sources[name]={path,sha1:input.sha1};}
const reports=JSON.parse(await readFile(join(cache,'generated/reports/registries.json'))),blocks=JSON.parse(await readFile(join(cache,'generated/reports/blocks.json')));
// Sounds are sometimes aliased by minecraft-data; the native report owns IDs.
const oldSounds=new Map(tables.sounds.map(e=>[e.name,e]));tables.sounds=Object.entries(reports['minecraft:sound_event'].entries).map(([name,e])=>({...oldSounds.get(name.slice(10)),id:e.protocol_id,name:name.slice(10)})).sort((a,b)=>a.id-b.id);
for(const[file,registry]of[['blocks','block'],['items','item'],['entities','entity_type'],['sounds','sound_event']])for(const e of tables[file])if(reports['minecraft:'+registry].entries['minecraft:'+e.name]?.protocol_id!==e.id)throw Error('Native registry mismatch '+file+' '+e.name);
for(const b of tables.blocks){const states=blocks['minecraft:'+b.name]?.states;if(states?.[0].id!==b.minStateId||states?.at(-1).id!==b.maxStateId||states?.find(s=>s.default)?.id!==b.defaultState)throw Error('Native states mismatch '+b.name);}
initBlocks(tables.blocks,null);for(const[name,b]of Object.entries(blocks))for(const s of b.states){const actual=getStateProperties(s.id),expected=s.properties||{};if(JSON.stringify(Object.entries(actual).sort())!==JSON.stringify(Object.entries(expected).sort()))throw Error('Property mismatch '+name+' '+s.id);}
for(const[name,data]of Object.entries(tables))await writeFile(join(root,'client/data',name+'.json'),JSON.stringify(data)+'\n');
await writeFile(join(root,'client/js/game/entity-registry-1.19.4.js'),'// Native 1.19.4 entity registry, checked against pinned reports.\nexport const ENTITY_REGISTRY_1194='+JSON.stringify(tables.entities.map(e=>[e.name,e.width,e.height]))+';\n');
await writeFile(join(root,'client/data/runtime-source-1.19.4.json'),JSON.stringify({version:target.minecraftVersion,protocol:762,clientJarSha1:target.downloads.client.sha1,serverJarSha1:target.downloads.server.sha1,minecraftDataRevision:revision,sources},null,2)+'\n');
console.log('Imported and validated '+tables.blocks.length+' native blocks and '+tables.entities.length+' entity types');
await import('./finalize-runtime-data.mjs');
