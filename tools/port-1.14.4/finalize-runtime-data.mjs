import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,delimiter} from 'node:path';
import {root,cache,target} from './prepare.mjs';
import {ZipFile} from '../../lib/zip.js';
import {Reader} from '../../client/js/net/buffer.js';
import {readNbtRoot} from '../../client/js/net/nbt.js';
execFileSync(process.env.JAVA||'java',['-cp',[join(cache,'client.jar'),join(cache,'server.jar')].join(delimiter),join(root,'tools/port-1.14.4/ExtractRuntime.java'),join(cache,'runtime.json')],{cwd:cache,stdio:'pipe',maxBuffer:8*1024*1024});
const native=JSON.parse(await readFile(join(cache,'runtime.json')));if(native.errors.length)throw new Error(native.errors.join('\n'));
const path=name=>join(root,'client/data',name+'.json');
const old=JSON.parse(await readFile(path('creative')));
const stack=s=>[s[0],0,s[2]?readNbtRoot(new Reader(Buffer.from(s[2],'base64'))).v:null];
const creative={...old,version:'1.14.4',protocol:498,dataVersion:1976,source:{clientJarSha1:target.downloads.client.sha1},tabs:native.tabs.map(t=>({...t,scrollbar:t.scroll,right:t.column===5,items:t.items.map(stack)}))};
await writeFile(path('creative'),JSON.stringify(creative)+'\n');
const shapes=JSON.parse(await readFile(path('blockCollisionShapes'))),boxes=[null],keys=new Map([['null',0]]),states=[];
for(const shape of native.selections){const key=JSON.stringify(shape);if(!keys.has(key)){keys.set(key,boxes.length);boxes.push(shape);}states.push(keys.get(key));}
const definitions=JSON.parse(await readFile(path('blocks'))),collisionShapes={0:[]},collisionKeys=new Map([['[]',0]]),collisionBlocks={};
for(const b of definitions){const ids=[];for(let state=b.minStateId;state<=b.maxStateId;state++){const boxes=native.collisions[state],key=JSON.stringify(boxes);if(!collisionKeys.has(key)){const id=collisionKeys.size;collisionKeys.set(key,id);collisionShapes[id]=boxes;}ids.push(collisionKeys.get(key));}collisionBlocks[b.name]=ids.every(id=>id===ids[0])?ids[0]:ids;}
shapes.blocks=collisionBlocks;shapes.shapes=collisionShapes;
shapes.selection={source:{version:'1.14.4',clientJarSha1:target.downloads.client.sha1},boxes,states};
await writeFile(path('blockCollisionShapes'),JSON.stringify(shapes)+'\n');
// Native tags resolve through native registries, including nested tag references.
const reports=JSON.parse(await readFile(join(cache,'generated/reports/registries.json'))),jar=new ZipFile(join(cache,'client.jar'));
const tags={source:{version:'1.14.4',clientJarSha1:target.downloads.client.sha1}};
for(const [kind,registry] of [['blocks','block'],['items','item'],['fluids','fluid'],['entity_types','entity_type']]){
 const prefix='data/minecraft/tags/'+kind+'/',defs={};for(const name of jar.list(prefix))if(name.endsWith('.json'))defs['minecraft:'+name.slice(prefix.length,-5)]=JSON.parse(jar.read(name));
 const resolved={},resolve=(name,seen=new Set())=>{if(resolved[name])return resolved[name];if(seen.has(name))throw new Error('Cyclic tag');seen.add(name);const values=[];for(const value of defs[name]?.values||[]){if(value[0]==='#')values.push(...resolve(value.slice(1),new Set(seen)));else{const id=reports['minecraft:'+registry].entries[value]?.protocol_id;if(id===undefined)throw new Error('Unknown tag entry '+value);values.push(id);}}return resolved[name]=[...new Set(values)].sort((a,b)=>a-b);};
 for(const name of Object.keys(defs))resolve(name);tags[kind==='entity_types'?'entities':kind]=resolved;
}
await writeFile(join(root,'client/js/game/default-tags.js'),'// Extracted native 1.14.4 tags.\nexport const DEFAULT_TAGS = '+JSON.stringify(tags)+';\n');
console.log('Native creative catalog, selection shapes and default tags generated');
