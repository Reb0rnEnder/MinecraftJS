import{ZipFile}from'../../lib/zip.js';
import{readFile,writeFile,mkdir}from'node:fs/promises';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import{join,delimiter}from'node:path';import{pathToFileURL}from'node:url';
import{nativeClasspath}from'../../lib/native-classpath.js';import{root,cache,target,verify}from'./prepare.mjs';import{Reader766,Writer766}from'../../client/js/net/configuration-1.20.6.js';import{KNOWN_PACK_766}from'../../client/js/net/known-pack-1.20.6.js';
// Native enchantment levels are a map: its byte-entry order may vary between
// JVM runs. Preserve a real native wire fixture when its decoded semantics match.
function wireSemantics(wire){
 const walk=value=>{
  if(typeof value==='bigint')return String(value);
  if(ArrayBuffer.isView(value))return Array.from(value,walk);
  if(Array.isArray(value))return value.map(walk);
  if(value&&typeof value==='object'){
   if(value.componentPatch)return stack(value);
   return Object.fromEntries(Object.keys(value).sort().map(k=>[k,walk(value[k])]));
  }return value;
 };
 const stack=value=>({id:value.id,count:value.count,added:value.componentPatch.added.map(({type,data})=>{
  if((type==='enchantments'||type==='stored_enchantments')&&data.enchantments)data={...data,enchantments:[...data.enchantments].sort((a,b)=>a.id-b.id)};
  return{type,data:walk(data)};
 }).sort((a,b)=>a.type.localeCompare(b.type)),removed:[...value.componentPatch.removed].sort()});
 const r=new Reader766(Buffer.from(wire,'base64')),value=r.slot();if(r.remaining())throw Error('Trailing native stack fixture');
 return JSON.stringify(stack(value));
}
export async function itemUxData({check=false}={}){
 verify(await readFile(join(cache,'client.jar')),target.downloads.client,'client jar');const folder=join(cache,'item-ux-audit'),classes=join(folder,'classes');await mkdir(classes,{recursive:true});
 verify(await readFile(join(cache,'client.txt')),target.downloads.client_mappings,'client mappings');
 const original=new ZipFile(join(cache,'client.jar')),unsigned=new ZipFile(join(cache,'client-model-oracle.jar'));
 for(const name of original.list('').filter(n=>n.endsWith('.class')))if(!original.read(name).equals(unsigned.read(name)))throw Error('Modified native item oracle class '+name);
 const cp=nativeClasspath(cache).split(delimiter);cp[0]=join(cache,'client-model-oracle.jar');const java=join(root,'tools/port-1.20.6/ExtractItemUx1206.java'),helper=join(root,'tools/port-1.20.6/ExtractCreative1206.java'),inputs=join(root,'tools/port-1.20.6/item-ux-inputs.json'),order=join(folder,'registry-order.json'),out=join(folder,'native.json');
 await writeFile(order,JSON.stringify(Object.fromEntries(Object.entries(KNOWN_PACK_766.registries).map(([key,entries])=>[key,entries.map(e=>e.key)]))));
 try{execFileSync(process.env.JAVAC||'javac',['-cp',cp.join(delimiter),'-d',classes,helper,java],{stdio:'pipe'});execFileSync(process.env.JAVA||'java',['-Xmx768M','-cp',[classes,...cp].join(delimiter),'ExtractItemUx1206',out,join(cache,'client.txt'),order,inputs],{stdio:'pipe',maxBuffer:16*1024*1024});}catch(e){process.stderr.write(e.stdout||'');process.stderr.write(e.stderr||e.message);throw Error('Native item UX oracle failed');}
 const data=JSON.parse(await readFile(out));
 let previous;try{previous=JSON.parse(await readFile(join(root,'tools/fixtures/item-ux-1.20.6.json')));}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const sample of data.samples){const saved=previous?.samples.find(s=>s.label===sample.label);if(saved&&wireSemantics(saved.wire)===wireSemantics(sample.wire))sample.wire=saved.wire;}
 for(const s of data.samples){const bytes=Buffer.from(s.wire,'base64'),r=new Reader766(bytes),stack=r.slot();if(r.remaining()||!Buffer.from(new Writer766().slot(stack).build()).equals(bytes))throw Error('Native UX stack roundtrip: '+s.label);}
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const meta={minecraftVersion:target.minecraftVersion,clientJarSha1:target.downloads.client.sha1,extractorSha256:createHash('sha256').update(await readFile(java)).digest('hex'),inputsSha256:createHash('sha256').update(await readFile(inputs)).digest('hex')};
 const files=[['client/js/game/item-data-1.20.6.js','// Generated native item UX metadata. See tools/port-1.20.6/item-ux-data.mjs.\nexport const ITEM_DATA_766 = '+JSON.stringify(canonical({...meta,...Object.fromEntries(Object.entries(data).filter(([k])=>!['samples','blendSamples'].includes(k)))}))+';\n'],['tools/fixtures/item-ux-1.20.6.json',JSON.stringify(canonical({...meta,samples:data.samples,blendSamples:data.blendSamples}),null,2)+'\n']];
 for(const[p,text]of files){const path=join(root,p);if(check){if(await readFile(path,'utf8')!==text)throw Error('Stale native UX data: '+p);}else await writeFile(path,text);}
 console.log('Native item UX: '+Object.keys(data.items).length+' items, '+Object.keys(data.potions).length+' potions, '+data.samples.length+' native stack cases');return data;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await itemUxData({check:process.argv.includes('--check')});
