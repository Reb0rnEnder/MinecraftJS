// Exact native inputs, isolated from every existing target and user world.
import {createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';import {dirname,join,resolve} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {ZipFile} from '../../lib/zip.js';
export const root=fileURLToPath(new URL('../../',import.meta.url)),cache=join(root,'cache/port-1.20.6');
export const target=JSON.parse(await readFile(new URL('./target.json',import.meta.url)));
export function verify(bytes,source,label){const actual=createHash('sha1').update(bytes).digest('hex');if(actual!==source.sha1||source.size!==undefined&&source.size!==bytes.length)throw Error('Native input mismatch: '+label);return actual;}
export async function input(name,source){const path=join(cache,name);try{const b=await readFile(path);verify(b,source,name);return b;}catch(e){if(e.code!=='ENOENT')throw e;}
 const {stdout}=await promisify(execFile)('curl',['--fail','--silent','--show-error','--location','--retry','3','--max-time','120',source.url],{encoding:'buffer',maxBuffer:128*1024*1024});verify(stdout,source,name);await mkdir(dirname(path),{recursive:true});await writeFile(path+'.part',stdout);await rename(path+'.part',path);return stdout;}
export async function prepare(){
 const metadata=JSON.parse(await input('version.json',target.metadata));if(metadata.id!==target.minecraftVersion)throw Error('Wrong native metadata version');
 const hashes={metadata:target.metadata.sha1};
 for(const [key,source] of Object.entries(target.downloads)){if(JSON.stringify(metadata.downloads[key])!==JSON.stringify(source))throw Error('Unpinned download '+key);const name=key.replace('_mappings','')+(key.endsWith('_mappings')?'.txt':'.jar');hashes[key]=verify(await input(name,source),source,name);}
 if(JSON.stringify(metadata.assetIndex)!==JSON.stringify(target.assetIndex))throw Error('Unpinned asset index');await input('asset-index.json',target.assetIndex);
 for(const [name,source] of Object.entries(target.minecraftData.inputs))await input(name,source);
 const jar=new ZipFile(join(cache,'client.jar')),version=JSON.parse(jar.read('version.json'));
 if(version.id!==target.minecraftVersion||version.protocol_version!==target.protocol||version.world_version!==target.dataVersion||version.pack_version.resource!==target.resourcePackFormat||version.pack_version.data!==target.dataPackFormat||version.java_version!==target.javaVersion)throw Error('Native version.json identity mismatch');
 const bundler=new ZipFile(join(cache,'server.jar'));for(const name of bundler.list('META-INF/').filter(n=>/^META-INF\/(libraries|versions)\/.*\.jar$/.test(n))){const path=join(cache,'bundler',name);await mkdir(dirname(path),{recursive:true});await writeFile(path,bundler.read(name));}
 await writeFile(join(cache,'verified-inputs.json'),JSON.stringify({minecraftVersion:target.minecraftVersion,protocol:target.protocol,nativeVersion:version,hashes},null,2)+'\n');return{metadata,version,hashes};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){await prepare();console.log('Verified native 1.20.6 inputs in '+cache);}
