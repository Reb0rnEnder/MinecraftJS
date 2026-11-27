// Native 26.3 Creative catalogue. The pinned client's CreativeModeTabs are rebuilt for all
// eight feature-flag combinations, and every stack is encoded with ItemStack.OPTIONAL_STREAM_CODEC.
// The resulting bytes are decoded again with the JavaScript play codec so item ids, component
// patches and empty slots cannot drift from what the client will receive.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {join,delimiter} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Reader26_3,Writer26_3} from '../../client/js/net/configuration-26.3.js';
import {readItemStack26_3,writeItemStack26_3,writeHashedStack26_3} from '../../client/js/net/item-components-26.3.js';
import {creativeStack263} from '../../client/js/gui/creative-data-26.3.js';
import {cache,root,target,verify} from './prepare.mjs';

const arrays={Int8Array,Uint8Array,Int32Array,BigInt64Array};
function canonical(value){
  if(typeof value==='bigint')return{$big:String(value)};
  if(ArrayBuffer.isView(value))return{$ta:value.constructor.name,a:Array.from(value,n=>typeof n==='bigint'?String(n):n)};
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
async function nativeClasspath(){
  const files=[join(cache,'client.jar')];
  async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(entry.name.endsWith('.jar'))files.push(path);}}
  await walk(join(cache,'libraries'));
  return files.join(delimiter);
}
function readVarint(bytes,offset){
  let value=0,shift=0,byte;
  do{byte=bytes[offset++];value|=(byte&0x7f)<<shift;shift+=7;if(shift>35)throw Error('Invalid stack VarInt');}while(byte&0x80);
  return {value:value|0,offset};
}
function patchOfWire(wire){
  const bytes=Buffer.from(wire,'base64'),count=readVarint(bytes,0);
  if(count.value<=0)return {stack:null,patch:null};
  const item=readVarint(bytes,count.offset);
  return {patch:count.value>0&&bytes.length>item.offset?bytes.subarray(item.offset).toString('base64'):null};
}
export async function creativeData({check=false}={}){
  verify(await readFile(join(cache,'client.jar')),target.downloads.client,'client jar');
  const java=join(root,'tools/port-26.3/ExtractCreative263.java'),rawFile=join(cache,'creative-native-263.json');
  const raw=await (async()=>{
    const cp=await nativeClasspath();
    execFileSync(process.env.JAVA||'java',['-Xmx1G','-cp',cp,java,rawFile,join(cache,'client.jar')],{stdio:'pipe',maxBuffer:32*1024*1024});
    return JSON.parse(await readFile(rawFile,'utf8'));
  })();
  const decoded=new Map(),pool=new Map();
  const decode=wire=>{
    if(decoded.has(wire))return decoded.get(wire);
    const bytes=Buffer.from(wire,'base64'),r=new Reader26_3(bytes),stack=readItemStack26_3(r);
    if(r.remaining())throw Error('Native Creative stack has '+r.remaining()+' trailing bytes');
    const patched=!!stack&&(stack.added.length||stack.removed.length);
    const wirePatch=patched?patchOfWire(wire).patch:null;
    if(patched&&!wirePatch)throw Error('Creative stack lost its component patch');
    const value=canonical(stack),key=JSON.stringify(value),nativeHashes=raw.hashes?.[wire];
    if(!pool.has(key))pool.set(key,{stack:value,patch:wirePatch||undefined,hashes:nativeHashes?{added:nativeHashes.added,removed:nativeHashes.removed}:undefined,hashedWire:nativeHashes?.wire});
    const entry=pool.get(key),expected=entry.patch||null;
    if(expected!==(wirePatch||null))throw Error('Two native Creative stacks disagree on their component patch');
    const hashes=nativeHashes?{added:nativeHashes.added,removed:nativeHashes.removed}:undefined;
    if(JSON.stringify(entry.hashes)!==JSON.stringify(hashes))throw Error('Two native Creative stacks disagree on their component hashes');
    decoded.set(wire,key);return key;
  };
  for(const catalog of raw.featureCatalogs)for(const name of ['tabs','operatorTabs'])for(const tab of catalog[name]){decode(tab.icon);tab.items.forEach(decode);}
  const keys=[...pool.keys()].sort(),ids=new Map(keys.map((key,index)=>[key,index]));
  const featureCatalogs=raw.featureCatalogs.map(catalog=>({...catalog,...Object.fromEntries(['tabs','operatorTabs'].map(name=>[name,catalog[name].map(tab=>({...tab,icon:ids.get(decode(tab.icon)),items:tab.items.map(wire=>ids.get(decode(wire)))}))]))}));
  const stacks=keys.map(key=>pool.get(key));
  if(stacks.some(entry=>entry.stack&&!Number.isInteger(entry.stack.itemId)))throw Error('Creative stack has no native item id');
  if(stacks.some(entry=>entry.stack&&entry.stack.itemId>=1700))throw Error('Creative stack item id is outside the native item table');
  for(const entry of stacks){
    if(!!entry.patch!==!!entry.hashes)throw Error('Creative component patch has no native hash');
    const stack=creativeStack263(entry),bytes=writeItemStack26_3(new Writer26_3(),stack).build(),r=new Reader26_3(bytes),round=readItemStack26_3(r);
    if(r.remaining())throw Error('Creative catalogue writer left '+r.remaining()+' trailing bytes');
    if(JSON.stringify(canonical(round))!==JSON.stringify(entry.stack))throw Error('Creative catalogue writer changed a native stack');
    if(entry.patch){
      const count=readVarint(bytes,0),item=readVarint(bytes,count.offset);
      const writtenPatch=Buffer.from(bytes).subarray(item.offset).toString('base64');
      if(writtenPatch!==entry.patch)throw Error('Creative catalogue writer changed a component patch (item '+entry.stack.itemId+', '+writtenPatch.length+'/'+entry.patch.length+')');
      const hashed=Buffer.from(writeHashedStack26_3(new Writer26_3(),stack).build()).toString('base64');
      if(hashed!==entry.hashedWire)throw Error('Creative catalogue writer changed a native component hash (item '+entry.stack.itemId+')');
    }
  }
  const output={version:target.minecraftVersion,protocol:target.protocol,dataVersion:target.dataVersion,source:{clientJarSha1:target.downloads.client.sha1,extractorSha256:createHash('sha256').update(await readFile(java)).digest('hex'),serverJarSha1:target.downloads.server.sha1},stackFormat:'native-components-263',stacks,tabs:featureCatalogs[0].tabs,operatorTabs:featureCatalogs[0].operatorTabs,featureCatalogs,
    potions:{'minecraft:empty':{name:'empty',effects:[]}},effects:{},eggs:{},itemMechanics:{},toolSpeeds:{},instruments:{}};
  const text=JSON.stringify(output)+'\n',file=join(root,'client/data/creative.json');
  if(check){if(await readFile(file,'utf8')!==text)throw Error('Stale native 26.3 Creative catalogue');}
  else{await writeFile(file,text);await mkdir(join(cache,'runtime-data'),{recursive:true});await writeFile(join(cache,'runtime-data/creative.json'),text);}
  console.log('Native 26.3 Creative catalogue: '+stacks.length+' stacks / '+featureCatalogs.length+' feature combinations / '+stacks.filter(entry=>entry.patch).length+' patched stacks');
  return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await creativeData({check:process.argv.includes('--check')});
