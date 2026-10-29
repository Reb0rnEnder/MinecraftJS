// Registry/resource coverage, not a claim that every gameplay behavior is verified.
import {readFileSync,writeFileSync}from'node:fs';import {ZipFile}from'../../lib/zip.js';
import {execFileSync}from'node:child_process';
import {target,cache}from'./prepare.mjs';import {join}from'node:path';
const root=new URL('../../',import.meta.url),jar=new ZipFile(join(cache,'client.jar'));
const current=name=>JSON.parse(readFileSync(new URL('client/data/'+name+'.json',root))),before=name=>JSON.parse(execFileSync('git',['show',target.runtimeBaselineCommit+':client/data/'+name+'.json'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}));
const report={version:target.minecraftVersion,protocol:target.protocol,clientJarSha1:target.downloads.client.sha1,scope:'Native registry/resource coverage; gameplay verification is tracked separately in parity-1.16.5.md',categories:{}};
for(const name of['blocks','items','entities','biomes','particles']){
 const old=new Set(before(name).map(d=>d.name)),added=current(name).filter(d=>!old.has(d.name));
 report.categories[name]={total:current(name).length,added:added.map(d=>({id:d.id,name:d.name,...(name==='blocks'?{blockstates:!!jar.read('assets/minecraft/blockstates/'+d.name+'.json'),nativeShapes:current('blockCollisionShapes').selection.states.length>d.maxStateId}:{}),...(name==='items'?{model:!!jar.read('assets/minecraft/models/item/'+d.name+'.json')}:{}),...(name==='biomes'?{nativeEffects:!!d.effects}:{}),...(name==='particles'?{sprites:!!current('particleSprites')[d.name]?.textures?.length}:{})}))};
}
writeFileSync(new URL('../../docs/content-1.16.5.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.categories).map(([key,value])=>[key,{total:value.total,added:value.added.length}]))));
