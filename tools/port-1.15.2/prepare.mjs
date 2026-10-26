// Stage 1: verified upstream inputs, kept separate from the still-1.14.4 runtime.
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve, join} from 'node:path';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const target=JSON.parse(await readFile(new URL('./target.json',import.meta.url),'utf8'));
export const cache=join(root,'cache','port-1.15.2');
export function verify(bytes,expected,label) {
  const actual=createHash('sha1').update(bytes).digest('hex');
  if(actual!==expected)throw new Error(`${label}: SHA-1 mismatch (${actual}; expected ${expected})`);
  return actual;
}
async function download(url) {
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
export async function input(name,source) {
  const path=join(cache,name);
  try {const bytes=await readFile(path);verify(bytes,source.sha1,name);return bytes;}
  catch(error){if(error.code!=='ENOENT')throw error;} // Corrupt cached inputs require explicit removal.
  const bytes=await download(source.url);verify(bytes,source.sha1,name);
  await mkdir(cache,{recursive:true});
  await writeFile(path+'.part',bytes);await rename(path+'.part',path);
  return bytes;
}
export async function prepare() {
  const metadata=JSON.parse(await input('version.json',target.metadata));
  if(metadata.id!==target.minecraftVersion)throw new Error('Unexpected Minecraft version');
  const hashes={metadata:target.metadata.sha1};
  for(const [key,source] of Object.entries(target.downloads)) {
    if(metadata.downloads[key]?.sha1!==source.sha1 || metadata.downloads[key]?.url!==source.url)throw new Error(`Metadata does not match pinned ${key}`);
    const name=key.replace('_mappings','')+(key.endsWith('_mappings')?'.txt':'.jar');
    const bytes=await input(name,source);
    if(bytes.length!==source.size)throw new Error(`Unexpected size: ${key}`);
    hashes[key]=source.sha1;
    console.log(`Verified ${name}: ${source.sha1}`);
  }
  if(JSON.stringify(metadata.assetIndex)!==JSON.stringify(target.assetIndex))throw Error('Asset index does not match target');
  await input('asset-index.json',target.assetIndex);
  for(const [name,source]of Object.entries(target.minecraftData.inputs))await input(name,source);
  const version=JSON.parse(await input('version-1.15.2.json',target.minecraftData.inputs['version-1.15.2.json']));
  if(version.minecraftVersion!==target.minecraftVersion||version.version!==target.protocol)throw Error('Protocol identity mismatch');
  await writeFile(join(cache,'verified-inputs.json'),JSON.stringify({minecraftVersion:target.minecraftVersion,protocol:target.protocol,hashes},null,2)+'\n');
  return {metadata,hashes};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  await prepare();console.log(`Prepared ${target.minecraftVersion} inputs in ${cache}`);
}
