// Exact native inputs, isolated from every existing target and user world.
import {createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';import {dirname,join,resolve} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {ZipFile} from '../../lib/zip.js';
export const root=fileURLToPath(new URL('../../',import.meta.url)),cache=join(root,'cache/port-26.3');
export const target=JSON.parse(await readFile(new URL('./target.json',import.meta.url)));
export function verify(bytes,source,label){const actual=createHash('sha1').update(bytes).digest('hex');if(actual!==source.sha1||source.size!==undefined&&source.size!==bytes.length)throw Error('Native input mismatch: '+label);return actual;}
export async function input(name,source){const path=join(cache,name);try{const b=await readFile(path);verify(b,source,name);return b;}catch(e){if(e.code!=='ENOENT')throw e;}
 const {stdout}=await promisify(execFile)('curl',['--fail','--silent','--show-error','--location','--retry','3','--max-time','300',source.url],{encoding:'buffer',maxBuffer:128*1024*1024});verify(stdout,source,name);await mkdir(dirname(path),{recursive:true});await writeFile(path+'.part',stdout);await rename(path+'.part',path);return stdout;}
// 1.20.6 packed the formats as {resource,data}; 26.3 packs them as {resource_major,resource_minor,data_major,data_minor}.
function packFormats(version){const p=version.pack_version||{};const resource=p.resource_major??p.resource,data=p.data_major??p.data;const minor=(a,b)=>a??b??0;return{resource,data,resourceMinor:minor(p.resource_minor,target.resourcePackFormatMinor),dataMinor:minor(p.data_minor,target.dataPackFormatMinor)};}
function assertLayout(jar){
 const names=jar.list('');
 const need=(condition,message)=>{if(!condition)throw Error('Native 26.3 jar layout: '+message);};
 need(names.includes(target.nativeLayout.assetsMarker),'missing '+target.nativeLayout.assetsMarker);
 need(names.includes(target.nativeLayout.dataMarker),'missing '+target.nativeLayout.dataMarker);
 need(names.some(n=>n.startsWith(target.nativeLayout.classes+'client/')),'missing native client classes');
 // An obfuscated jar would still have net/minecraft (libraries), so prove real names resolve.
 need(names.includes('net/minecraft/client/main/Main.class'),'net/minecraft/client/main/Main.class is absent (obfuscated jar?)');
 need(names.includes('net/minecraft/server/MinecraftServer.class'),'net/minecraft/server/MinecraftServer.class is absent (obfuscated jar?)');
 const count=prefix=>names.filter(n=>n.startsWith(prefix)).length;
 return {entries:names.length,classes:count(target.nativeLayout.classes),assets:count(target.nativeLayout.assets),data:count(target.nativeLayout.data)};
}
export async function prepare(){
 const metadata=JSON.parse(await input('version.json',target.metadata));if(metadata.id!==target.minecraftVersion)throw Error('Wrong native metadata version');
 const hashes={metadata:target.metadata.sha1};
 for(const [key,source] of Object.entries(target.downloads)){const native=metadata.downloads[key];if(!native)throw Error('Mojang metadata has no '+key+' download');if(JSON.stringify(native)!==JSON.stringify(source))throw Error('Unpinned download '+key);hashes[key]=verify(await input(key+'.jar',source),source,key+'.jar');}
 if(JSON.stringify(metadata.assetIndex)!==JSON.stringify(target.assetIndex))throw Error('Unpinned asset index');await input('asset-index.json',target.assetIndex);
 if(metadata.javaVersion&&metadata.javaVersion.majorVersion!==target.javaVersion)throw Error('Native javaVersion mismatch');
 const jar=new ZipFile(join(cache,'client.jar')),version=JSON.parse(jar.read('version.json')),packs=packFormats(version);
 if(version.id!==target.minecraftVersion||version.protocol_version!==target.protocol||version.world_version!==target.dataVersion||packs.resource!==target.resourcePackFormat||packs.data!==target.dataPackFormat||version.pack_version.resource_minor!==target.resourcePackFormatMinor||version.pack_version.data_minor!==target.dataPackFormatMinor||version.java_version!==target.javaVersion)throw Error('Native version.json identity mismatch');
 const layout=assertLayout(jar);
 const bundler=new ZipFile(join(cache,'server.jar'));const inner=bundler.list('META-INF/versions/').filter(n=>/^META-INF\/versions\/.*\/server-.*\.jar$/.test(n));
 if(!inner.length)throw Error('Server bundler has no versioned server jar');
 for(const name of [...inner,...bundler.list('META-INF/libraries/').filter(n=>/\.jar$/.test(n))]){const path=join(cache,'bundler',name);await mkdir(dirname(path),{recursive:true});await writeFile(path,bundler.read(name));}
 await writeFile(join(cache,'verified-inputs.json'),JSON.stringify({minecraftVersion:target.minecraftVersion,protocol:target.protocol,nativeVersion:version,layout,hashes},null,2)+'\n');return{metadata,version,hashes,layout};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const{layout}=await prepare();console.log('Verified native '+target.minecraftVersion+' inputs in '+cache+' ('+layout.classes+' classes, '+layout.assets+' assets, '+layout.data+' data entries)');}
