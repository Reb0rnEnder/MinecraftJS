// Native 26.3 reports: data generator, identity assertions, recorded baseline.
// 26.3 emits per-item component defaults instead of one items.json, and a native packets.json.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ZipFile} from '../../lib/zip.js';
import {prepare,cache,target} from './prepare.mjs';

const run=promisify(execFile);
const baselineUrl=new URL('./baseline.json',import.meta.url);
const sha1=bytes=>createHash('sha1').update(bytes).digest('hex');
const canonical=value=>JSON.stringify(value,(key,item)=>{
  if(item&&typeof item==='object'&&!Array.isArray(item))return Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b)));
  return item;
});

function assertContiguousIds(label,entries){
  const ids=Object.values(entries).map(entry=>entry.protocol_id).filter(id=>Number.isInteger(id)).sort((a,b)=>a-b);
  assert.ok(ids.length,label+' has no protocol IDs');
  assert.ok(ids.every((id,index)=>id===index),label+' protocol IDs must be contiguous from zero');
}

async function generateNativeReports(){
  const generated=join(cache,'generated');
  await rm(generated,{recursive:true,force:true});
  const result=await run(process.env.JAVA||'java',[
    '-DbundlerMainClass=net.minecraft.data.Main','-jar',join(cache,'server.jar'),'--reports','--output',generated
  ],{cwd:cache,maxBuffer:64*1024*1024,timeout:600000});
  await writeFile(join(cache,'data-generator.log'),result.stdout+result.stderr);
  return generated;
}

async function itemComponents(generated){
  const dir=join(generated,'reports','minecraft','components','item');
  const files=(await readdir(dir)).filter(name=>name.endsWith('.json'));
  const items={};
  for(const file of files){
    const body=JSON.parse(await readFile(join(dir,file),'utf8'));
    items[file.slice(0,-5)]=body.components||{};
  }
  return items;
}

export async function reports(check=false){
  const {hashes}=await prepare();
  const generated=await generateNativeReports();
  const report={};
  for(const name of ['blocks','items','registries','commands','packets']){
    let bytes;
    try{bytes=await readFile(join(generated,'reports',name+'.json'));}
    catch(e){if(name==='items')continue;throw e;}
    report[name]=JSON.parse(bytes);
    hashes['report_'+name]=sha1(Buffer.from(canonical(report[name])));
  }
  const items=await itemComponents(generated);

  const blockStateIds=[];
  for(const [name,block] of Object.entries(report.blocks)){
    assert.equal(block.states.filter(state=>state.default).length,1,name+' must have one default state');
    for(const state of block.states)blockStateIds.push(state.id);
  }
  blockStateIds.sort((a,b)=>a-b);
  assert.ok(blockStateIds.every((id,index)=>id===index),'Block-state IDs must be contiguous from zero');

  for(const [name,registry] of Object.entries(report.registries))assertContiguousIds(name,registry.entries);

  const itemRegistry=report.registries['minecraft:item'].entries;
  const componentRegistry=report.registries['minecraft:data_component_type'].entries;
  assert.equal(Object.keys(itemRegistry).length,Object.keys(items).length,'Item registry and generated component files must have the same size');
  assertContiguousIds('minecraft:data_component_type',componentRegistry);

  let defaultComponentEntries=0;
  const componentUsage=Object.fromEntries(Object.keys(componentRegistry).map(name=>[name,0]));
  for(const [itemName,components] of Object.entries(items)){
    assert.ok(itemRegistry['minecraft:'+itemName],'Generated components for unknown item '+itemName);
    for(const [type,value] of Object.entries(components)){
      assert.ok(componentRegistry[type],itemName+' uses unknown component '+type);
      componentUsage[type]++;defaultComponentEntries++;
    }
  }

  const packets={};
  for(const [phase,directions] of Object.entries(report.packets)){
    packets[phase]={};
    for(const [direction,entries] of Object.entries(directions)){
      assertContiguousIds(phase+'/'+direction,entries);
      packets[phase][direction]=Object.keys(entries).length;
    }
  }
  await writeFile(join(cache,'packet-ids.json'),JSON.stringify(report.packets,null,2)+'\n');

  const jar=new ZipFile(join(cache,'client.jar'));
  const count=prefix=>jar.list(prefix).length;
  const version=JSON.parse(jar.read('version.json'));

  const summary={
    minecraftVersion:target.minecraftVersion,
    protocol:target.protocol,
    dataVersion:target.dataVersion,
    resourcePackFormat:target.resourcePackFormat,
    dataPackFormat:target.dataPackFormat,
    javaVersion:target.javaVersion,
    nativeVersion:version,
    sources:{...hashes,assetIndex:target.assetIndex.sha1},
    blocks:Object.keys(report.blocks).length,
    blockStates:blockStateIds.length,
    lastBlockState:blockStateIds.at(-1),
    items:Object.keys(itemRegistry).length,
    defaultComponentEntries,
    componentTypes:Object.fromEntries(Object.entries(componentRegistry).sort((a,b)=>a[1].protocol_id-b[1].protocol_id).map(([name,entry])=>[name,entry.protocol_id])),
    componentUsage,
    registries:Object.fromEntries(Object.entries(report.registries).sort(([a],[b])=>a.localeCompare(b)).map(([name,registry])=>[name,Object.keys(registry.entries).length])),
    commands:Object.keys(report.commands.children||{}).sort(),
    packets,
    resources:{textures:count('assets/minecraft/textures/'),models:count('assets/minecraft/models/'),blockstates:count('assets/minecraft/blockstates/'),languages:count('assets/minecraft/lang/')}
  };

  if(check)assert.deepEqual(summary,JSON.parse(await readFile(baselineUrl,'utf8')),'Regenerated native 26.3 baseline differs');
  else await writeFile(baselineUrl,JSON.stringify(summary,null,2)+'\n');

  console.log((check?'Verified':'Recorded')+' '+summary.blocks+' blocks / '+summary.blockStates+' states, '+summary.items+' items / '+Object.keys(summary.componentTypes).length+' component types, '+Object.keys(summary.registries).length+' registries, play packets '+packets.play.clientbound+'/'+packets.play.serverbound);
  return summary;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await reports(process.argv.includes('--check'));
