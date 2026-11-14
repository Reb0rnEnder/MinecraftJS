import{ZipFile}from'../../lib/zip.js';
import{NATIVE_PLAY_CLIENTBOUND_NAMES_766,NATIVE_PLAY_SERVERBOUND_NAMES_766}from'../../client/js/net/native-packet-names-1.20.6.js';
import assert from 'node:assert/strict';
import{builderSamples}from'./packet-builder-samples.mjs';
import{readFile,writeFile,mkdir}from'node:fs/promises';import{execFileSync}from'node:child_process';import{join,delimiter}from'node:path';import{createHash}from'node:crypto';import{nativeClasspath}from'../../lib/native-classpath.js';import{cache,root,target,verify}from'./prepare.mjs';import{packetSample}from'./packet-samples.mjs';import{PLAY_SCHEMA_766}from'../../client/js/net/play-schema-1.20.6.js';import{KNOWN_PACK_766}from'../../client/js/net/known-pack-1.20.6.js';import{decodePlayPacket766}from'../../client/js/net/play-codec-1.20.6.js';import{Game}from'../../client/js/game/game.js';
verify(await readFile(join(cache,'client.jar')),target.downloads.client,'client jar');const folder=join(cache,'packet-audit'),classes=join(folder,'classes');await mkdir(classes,{recursive:true});
verify(await readFile(join(cache,'client.txt')),target.downloads.client_mappings,'client mappings');
const signed=new ZipFile(join(cache,'client.jar')),unsigned=new ZipFile(join(cache,'client-model-oracle.jar'));
for(const name of signed.list('').filter(n=>n.endsWith('.class')))assert.ok(signed.read(name).equals(unsigned.read(name)),'Modified native class '+name);
const protocol=JSON.parse(await readFile(join(cache,'protocol-1.20.6.json')));
verify(await readFile(join(cache,'protocol-1.20.6.json')),target.minecraftData.inputs['protocol-1.20.6.json'],'protocol schema');
const serverTypes={...protocol.types,...protocol.play.toServer.types};
const serverIds=Object.fromEntries(Object.entries(serverTypes.packet[1][0].type[1].mappings).map(([id,name])=>[name,Number(id)]));
for(const name of Object.keys(serverIds))serverTypes['packet_'+name]??=serverTypes['packet_common_'+name];
serverTypes.packet_update_structure_block[1].find(f=>f.name==='seed').type='varlong';
const serverSchema={types:serverTypes,ids:serverIds,packets:Object.keys(serverIds)};
const sampleErrors=[],samples=[];
for(const [direction,schema]of [['CLIENTBOUND',PLAY_SCHEMA_766],['SERVERBOUND',serverSchema]]){
 const currentSamples=[];
 const add=(name,mode,overrides)=>{const s=packetSample(schema,name,mode,overrides);s.direction=direction;s.label=direction+':'+s.label;currentSamples.push(s);return s;};
 for(const name of schema.packets)for(const mode of ['sparse','dense'])try{add(name,mode);}catch(e){sampleErrors.push({direction,name,mode,error:e.message});}
 const seen=new Set(),branches=new Set();for(const s of currentSamples)for(const t of s.trace)branches.add(s.name+'|'+t.path+'|'+String(t.current));
 for(let at=0;at<currentSamples.length&&currentSamples.length<3000;at++){
  const current=currentSamples[at];if(!current.label.includes('dense'))continue;
  for(const t of current.trace)for(const key of t.keys){
   const branchKey=current.name+'|'+t.path+'|'+String(key);if(branches.has(branchKey)||!t.control)continue;
   branches.add(branchKey);const v=key==='true'?true:key==='false'?false:/^-?\d+$/.test(String(key))?Number(key):key;
   const overrides={...current.overrides,[t.control]:v},sig=JSON.stringify([current.name,overrides],(_,v)=>typeof v==='bigint'?String(v):v);
   if(seen.has(sig))continue;seen.add(sig);
   try{const next=add(current.name,'dense',overrides);next.label=direction+':'+current.name+':dense:branch-'+currentSamples.length;}catch(error){sampleErrors.push({direction,name:current.name,branch:t.path,key,error:error.message});}
  }
 }
 samples.push(...currentSamples);
}
for(let mask=0;mask<8;mask++){
 const prefix='packet_advancements.advancementMapping[].value.displayData?';
 const sample=packetSample(PLAY_SCHEMA_766,'advancements','dense',Object.fromEntries(['has_background_texture','show_toast','hidden'].map((f,i)=>[prefix+'.flags.'+f,(mask>>i)&1])));
 sample.label='CLIENTBOUND:advancements:flags-'+mask;samples.push(sample);
}
for(let mask=0;mask<64;mask++){
 const sample=packetSample(PLAY_SCHEMA_766,'player_info','dense',{'packet_player_info.action':mask});
 sample.label='CLIENTBOUND:player_info:actions-'+mask;samples.push(sample);
}
for(const type of [23,26])for(const id of [0,1,2]){
 const s=packetSample(PLAY_SCHEMA_766,'entity_metadata','dense',{
  'packet_entity_metadata.metadata[].type':type,
  ['packet_entity_metadata.metadata[].value='+(type===23?'wolf_variant':'painting_variant')]:id
 });
 s.label='CLIENTBOUND:entity_metadata:registry-'+type+'-id-'+id;samples.push(s);
}
samples.push(...builderSamples());
const order=join(folder,'registry-order.json'),input=join(folder,'input.json'),output=join(folder,'native.json');await writeFile(order,JSON.stringify(Object.fromEntries(Object.entries(KNOWN_PACK_766.registries).map(([k,v])=>[k,v.map(e=>e.key)]))));await writeFile(input,JSON.stringify(samples,(_,v)=>typeof v==='bigint'?String(v):v));
const cp=nativeClasspath(cache).split(delimiter);cp[0]=join(cache,'client-model-oracle.jar');const java=join(root,'tools/port-1.20.6/PacketRoundtrip1206.java');
try{execFileSync(process.env.JAVAC||'javac',['-cp',cp.join(delimiter),'-d',classes,join(root,'tools/port-1.20.6/ExtractCreative1206.java'),java],{stdio:'pipe'});execFileSync(process.env.JAVA||'java',['-Xmx768M','-cp',[classes,...cp].join(delimiter),'PacketRoundtrip1206',output,join(cache,'client.txt'),order,input],{stdio:'pipe',maxBuffer:8*1024*1024});}catch(e){process.stderr.write(e.stdout||'');process.stderr.write(e.stderr||e.message);throw Error('Native packet oracle failed');}
const native=JSON.parse(await readFile(output)),byLabel=new Map(native.map(p=>[p.label,p])),context={features:['minecraft:vanilla'],registries:new Map(Object.entries(KNOWN_PACK_766.registries).map(([k,v])=>[k,v.map((e,id)=>({...e,id}))]))};
const results=samples.map(s=>{const n=byLabel.get(s.label);let decoded,error;try{if(s.direction==='CLIENTBOUND')decoded=decodePlayPacket766(Buffer.from(n.wire??s.wire,'base64'),context);}catch(e){error=(e.cause||e).message;}return{label:s.label,name:s.name,direction:s.direction,native:n,jsError:error,handler:decoded?typeof Game.prototype['on_'+decoded.name]==='function'?decoded.name:null:null,normalizedName:decoded?.name,canonical:n.wire===s.wire,coverage:s.coverage};});
const report={target:target.minecraftVersion,clientJarSha1:target.downloads.client.sha1,oracleSha256:createHash('sha256').update(await readFile(java)).digest('hex'),sampleErrors,results};await writeFile(join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({samples:samples.length,sampleErrors,nativeErrors:results.filter(r=>r.native.error),jsErrors:results.filter(r=>r.jsError),unhandled:[...new Set(results.filter(r=>r.direction==='CLIENTBOUND'&&!r.handler&&!r.native.error&&!r.jsError).map(r=>r.normalizedName))]},null,2));

assert.deepEqual(sampleErrors,[], 'Packet sample generation failed');
for(const r of results){const names=r.direction==='CLIENTBOUND'?NATIVE_PLAY_CLIENTBOUND_NAMES_766:NATIVE_PLAY_SERVERBOUND_NAMES_766;assert.equal(r.native.nativeType,r.name==='bundle_delimiter'?'clientbound/minecraft:bundle_delimiter':names[(r.direction==='CLIENTBOUND'?PLAY_SCHEMA_766.ids:serverIds)[r.name]],r.label+' native identity');assert.equal(r.native.error,undefined,r.label+': '+r.native.error);assert.equal(r.native.remaining,0,r.label+' native trailing bytes');assert.equal(r.jsError,undefined,r.label+': '+r.jsError);if(r.label.startsWith('BUILDER:'))assert.ok(r.canonical,r.label+' changed in native roundtrip');}
const transport={bundle_delimiter:'Connection._receivePacket / PacketBundles762',cookie_request:'VanillaSocket766._packet',start_configuration:'VanillaSocket766._packet / Configuration766',store_cookie:'VanillaSocket766._packet',transfer:'VanillaSocket766._transfer / Connection'};
const packets=PLAY_SCHEMA_766.packets.map(name=>{
 const rows=results.filter(r=>r.direction==='CLIENTBOUND'&&r.name===name),first=rows[0];
 assert.ok(first.handler||transport[first.normalizedName],'Unclassified clientbound packet '+name);
 return{name,id:PLAY_SCHEMA_766.ids[name],nativeType:first.native.nativeType,normalizedName:first.normalizedName,samples:rows.length,consumer:first.handler?'Game.on_'+first.handler:transport[first.normalizedName],kind:['enter_combat_event','end_combat_event'].includes(first.normalizedName)?'native_no_op':first.handler?'game':'transport'};
});
const outgoing=serverSchema.packets.map(name=>{
 const rows=results.filter(r=>r.direction==='SERVERBOUND'&&r.name===name),builders=samples.filter(s=>s.direction==='SERVERBOUND'&&s.name===name&&s.api);
 assert.ok(builders.length,'Missing actual runtime builder sample for '+name);
 return{name,id:serverIds[name],nativeType:rows[0].native.nativeType,samples:rows.length,builders:[...new Set(builders.map(s=>s.api))]};
});
const fixtures={minecraftVersion:target.minecraftVersion,protocol:target.protocol,clientJarSha1:target.downloads.client.sha1,oracleSha256:report.oracleSha256,scope:'Play wire codecs and runtime senders; representative branch cases, not full handler, graphical, authenticated-account or live-server acceptance.',samples:results.map(r=>({label:r.label,direction:r.direction,name:r.name,nativeType:r.native.nativeType,wire:r.native.wire,...(r.normalizedName?{normalizedName:r.normalizedName}:{})}))};
const inventory={minecraftVersion:target.minecraftVersion,clientJarSha1:target.downloads.client.sha1,samples:results.length,clientbound:packets,serverbound:outgoing,limits:['Switch branches and flag matrices are exercised; this is not exhaustive over values or all combinations.','Game handler presence does not establish feature completeness. Debug sample and ping presentation remains partial.','Login, Configuration, transfer and bundling have separate transport regressions.','Authenticated Mojang account signing and public-server compatibility still need live acceptance.']};
for(const [path,value]of [['tools/fixtures/play-packets-1.20.6.json',fixtures],['docs/packet-coverage-1.20.6.json',inventory]]){
 const text=JSON.stringify(value,null,2)+'\n';
 if(process.argv.includes('--write'))await writeFile(join(root,path),text);
 else if(process.argv.includes('--check'))assert.equal(await readFile(join(root,path),'utf8'),text,'Regenerate '+path);
}
console.log('Verified '+packets.length+' incoming IDs / '+outgoing.length+' actual outgoing packet builders across '+results.length+' native cases.');
