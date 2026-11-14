import {readFile,writeFile,mkdir} from 'node:fs/promises';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import{join,delimiter}from'node:path';
import{nativeClasspath}from'../../lib/native-classpath.js';import{root,cache,target,verify}from'./prepare.mjs';import{KNOWN_PACK_766}from'../../client/js/net/known-pack-1.20.6.js';import{simplify}from'../../client/js/net/nbt.js';
verify(await readFile(join(cache,'client.jar')),target.downloads.client,'client jar');
const input=Object.fromEntries(KNOWN_PACK_766.registries['minecraft:worldgen/biome'].map(e=>{const b=simplify(e.value);return[e.key,{has_precipitation:!!b.has_precipitation,temperature:b.temperature,downfall:b.downfall,effects:Object.fromEntries(Object.entries(b.effects).filter(([k])=>['fog_color','water_color','water_fog_color','sky_color','grass_color','foliage_color','grass_color_modifier'].includes(k)))}];}));
const folder=join(cache,'foliage-audit');await mkdir(folder,{recursive:true});const source=join(root,'tools/port-1.20.6/ExtractFoliage1206.java'),inputFile=join(folder,'biomes.json'),out=join(folder,'native.json');await writeFile(inputFile,JSON.stringify(input));
const cp=nativeClasspath(cache).split(delimiter);cp[0]=join(cache,'client-model-oracle.jar');
try{execFileSync(process.env.JAVA||'java',['-cp',cp.join(delimiter),source,out,inputFile],{stdio:'pipe',maxBuffer:4*1024*1024});}catch(e){process.stderr.write(e.stderr||e.message);throw e;}
const raw=JSON.parse(await readFile(out)),data={clientJarSha1:target.downloads.client.sha1,sourceSha256:createHash('sha256').update(await readFile(source)).digest('hex'),...raw};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const file=join(root,'tools/fixtures/foliage-1.20.6.json'),text=JSON.stringify(canonical(data),null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Stale native foliage fixtures');}else await writeFile(file,text);
console.log('Native foliage oracle: '+Object.keys(raw.blocks).length+' blocks, '+Object.keys(raw.biomes).length+' biomes, '+raw.noise.length+' noise positions');
