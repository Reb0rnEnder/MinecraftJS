// Generate native 1.17.1 data in the ignored cache and record a small, reviewable baseline.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ZipFile} from '../../lib/zip.js';
import {prepare,input,cache,target} from './prepare.mjs';
const run=promisify(execFile);
const baseline=new URL('./baseline.json',import.meta.url);
const sha=bytes=>createHash('sha1').update(bytes).digest('hex');
export function protocolChanges(before,after,direction) {
  const types=d=>d.play[direction].types;
  const names=d=>Object.fromEntries(Object.entries(types(d).packet[1][0].type[1].mappings).map(([id,name])=>[name,Number(id)]));
  const a=names(before),b=names(after),added=[],removed=[],moved=[],changed=[];
  for(const [name,id] of Object.entries(b)) {
    if(a[name]===undefined)added.push({name,id});
    else {
      if(a[name]!==id)moved.push({name,from:a[name],to:id});
      if(JSON.stringify(types(before)['packet_'+name])!==JSON.stringify(types(after)['packet_'+name]))changed.push(name);
    }
  }
  for(const name of Object.keys(a))if(b[name]===undefined)removed.push({name,id:a[name]});
  return {beforeCount:Object.keys(a).length,afterCount:Object.keys(b).length,added,removed,moved,changed};
}
export function summarize(blocks,registries,commands,hashes,before,after) {
  const ids=[];
  for(const [name,block] of Object.entries(blocks)) {
    assert.equal(block.states.filter(s=>s.default).length,1,`${name}: one default state`);
    for(const state of block.states)ids.push(state.id);
  }
  ids.sort((a,b)=>a-b);
  assert.ok(ids.every((id,i)=>id===i),'native state IDs must be unique and contiguous from zero');
  return {
    minecraftVersion:target.minecraftVersion,protocol:target.protocol,
    sources:{...hashes,minecraftDataRevision:target.minecraftData.revision},
    blocks:Object.keys(blocks).length,blockStates:ids.length,lastBlockState:ids.at(-1),
    registries:Object.fromEntries(Object.entries(registries).map(([name,r])=>[name,Object.keys(r.entries).length])),
    commands:Object.keys(commands.children||{}).sort(),
    protocolChanges:{toClient:protocolChanges(before,after,'toClient'),toServer:protocolChanges(before,after,'toServer')},
    sharedTypeChanges:Object.keys(after.types).filter(name=>JSON.stringify(before.types[name])!==JSON.stringify(after.types[name])),
  };
}
export async function reports(check=false) {
  const {hashes}=await prepare();
  const schemas={};
  for(const [name,source] of Object.entries(target.minecraftData.inputs))schemas[name]=JSON.parse(await input(name,source));
  // Running the data generator never accepts an EULA, starts a server, or opens a world.
  // Keep vanilla's logs/config side effects within the ignored port cache.
  const generated=join(cache,'generated');
  const {stdout,stderr}=await run(process.env.JAVA||'java',['-cp',join(cache,'server.jar'),'net.minecraft.data.Main','--reports','--output',generated],{cwd:cache,maxBuffer:8*1024*1024,timeout:60000});
  await writeFile(join(cache,'data-generator.log'),stdout+stderr);
  const data={};
  for(const name of ['blocks','registries','commands']) {
    const bytes=await readFile(join(generated,'reports',name+'.json'));data[name]=JSON.parse(bytes);hashes['report_'+name]=sha(bytes);
  }
  const result=summarize(data.blocks,data.registries,data.commands,hashes,schemas['protocol-1.16.5.json'],schemas['protocol-1.17.1.json']);
  const jar=new ZipFile(join(cache,'client.jar'));
  result.resources={beeTextures:jar.list('assets/minecraft/textures/entity/bee/'),honeyBlocks:jar.list('assets/minecraft/blockstates/').filter(p=>/honey|beehive|bee_nest/.test(p)),recipes:jar.list('data/minecraft/recipes/').length,packMetadata:JSON.parse(jar.read('pack.mcmeta'))};
  if(check)assert.deepEqual(result,JSON.parse(await readFile(baseline,'utf8')),'regenerated native baseline differs');
  else await writeFile(baseline,JSON.stringify(result,null,2)+'\n');
  console.log(`${check?'Verified':'Recorded'} ${result.blocks} blocks / ${result.blockStates} states, ${Object.keys(result.registries).length} registries and ${result.commands.length} root commands`);
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await reports(process.argv.includes('--check'));
