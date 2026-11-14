import{readFile,writeFile}from'node:fs/promises';import{execFileSync}from'node:child_process';import{join,delimiter}from'node:path';import{pathToFileURL}from'node:url';
import{ZipFile}from'../../lib/zip.js';import{nativeClasspath}from'../../lib/native-classpath.js';import{root,cache,target,verify}from'./prepare.mjs';
export async function supportData({check=false,output=join(root,'client/data/blockCollisionShapes.json')}={}){
 verify(await readFile(join(cache,'client.jar')),target.downloads.client,'support client');verify(await readFile(join(cache,'client.txt')),target.downloads.client_mappings,'support mappings');
 const jar=new ZipFile(join(cache,'client.jar')),unsigned=new ZipFile(join(cache,'client-model-oracle.jar'));
 for(const n of jar.list('').filter(n=>n.endsWith('.class')))if(!jar.read(n).equals(unsigned.read(n)))throw Error('Modified native support class '+n);
 const blocks=JSON.parse(await readFile(join(root,'client/data/blocks.json'))),count=Math.max(...blocks.map(b=>b.maxStateId))+1,cp=nativeClasspath(cache).split(delimiter);cp[0]=join(cache,'client-model-oracle.jar');
 const out=join(cache,'support.json');execFileSync(process.env.JAVA||'java',['-cp',cp.join(delimiter),join(root,'tools/ExtractSupport.java'),out,join(cache,'client.txt'),String(count),target.minecraftVersion],{cwd:cache,stdio:'pipe'});
 const states=JSON.parse(await readFile(out));if(states.length!==count||states.some(v=>!Array.isArray(v)||v.length!==2||v.some(n=>!Number.isInteger(n)||n<0||n>63)))throw Error('Incomplete native support predicates');
 const support={source:{version:target.minecraftVersion,clientJarSha1:target.downloads.client.sha1},states},data=JSON.parse(await readFile(output));
 if(check){if(JSON.stringify(data.support)!==JSON.stringify(support))throw Error('Stale native placement support data');}else{data.support=support;await writeFile(output,JSON.stringify(data)+'\n');}
 console.log('Native placement support: '+count+' states');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await supportData({check:process.argv.includes('--check')});
