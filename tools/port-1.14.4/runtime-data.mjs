import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {root,cache,target} from './prepare.mjs';
const rev=target.minecraftData.revision,licenseReadme=await (await fetch('https://raw.githubusercontent.com/PrismarineJS/minecraft-data/'+target.minecraftData.revision+'/README.md')).text(),base='https://raw.githubusercontent.com/PrismarineJS/minecraft-data/'+rev+'/data/';
async function get(path){const r=await fetch(base+path);if(!r.ok)throw new Error(path+': '+r.status);const b=Buffer.from(await r.arrayBuffer());return {data:JSON.parse(b),sha1:createHash('sha1').update(b).digest('hex')};}
const paths=(await get('dataPaths.json')).data.pc['1.14.4'],sources={};
for(const name of ['blocks','items','entities','blockCollisionShapes','biomes','foods','effects','enchantments','windows','particles','materials','recipes','sounds']){
 const path=paths[name]+'/'+name+'.json',value=await get(path);sources[name]={path,sha1:value.sha1};
 await writeFile(join(root,'client/data',name+'.json'),JSON.stringify(value.data)+'\n');
}
const reports=JSON.parse(await readFile(join(cache,'generated/reports/registries.json'))),blocks=JSON.parse(await readFile(join(cache,'generated/reports/blocks.json')));
for(const [file,registry] of [['blocks','block'],['items','item'],['entities','entity_type'],['sounds','sound_event']]){
 const data=JSON.parse(await readFile(join(root,'client/data',file+'.json')));
 for(const entry of data){const id=reports['minecraft:'+registry].entries['minecraft:'+entry.name]?.protocol_id;if(id!==entry.id)throw new Error('Native registry mismatch '+file+' '+entry.name+' '+id+' != '+entry.id);}
}
for(const b of JSON.parse(await readFile(join(root,'client/data/blocks.json')))){const state=blocks['minecraft:'+b.name].states;if(state[0].id!==b.minStateId||state.at(-1).id!==b.maxStateId||state.find(s=>s.default).id!==b.defaultState)throw new Error('State mismatch '+b.name);}
await writeFile(join(root,'client/data/runtime-source-1.14.4.json'),JSON.stringify({version:'1.14.4',protocol:498,clientJarSha1:target.downloads.client.sha1,serverJarSha1:target.downloads.server.sha1,minecraftDataRevision:rev,license:'MIT',licenseNotice:licenseReadme.split('## License')[1].split('## Related project')[0].trim(),sources},null,2)+'\n');
console.log('Native tables imported and cross-checked against vanilla reports');
