import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,delimiter} from 'node:path';
import {createHash} from 'node:crypto';
import {nativeClasspath} from '../../lib/native-classpath.js';
import {root,cache,target,verify} from './prepare.mjs';
import {KNOWN_PACK_766} from '../../client/js/net/known-pack-1.20.6.js';
import {ZipFile} from '../../lib/zip.js';
verify(await readFile(join(cache,'client.jar')),target.downloads.client,'adventure jar');verify(await readFile(join(cache,'client.txt')),target.downloads.client_mappings,'adventure mappings');
const jar=new ZipFile(join(cache,'client.jar')),unsigned=new ZipFile(join(cache,'client-model-oracle.jar'));
for(const n of jar.list('').filter(n=>n.endsWith('.class')))if(!jar.read(n).equals(unsigned.read(n)))throw Error('Modified adventure oracle class '+n);
const inputs=[];
function add(label,block,state,predicates,actualNbt=null,component='can_break',show=true){const e={label,block:'minecraft:'+block,state,component,stack:{id:'minecraft:diamond_pickaxe',count:1,components:{['minecraft:'+component]:{predicates,show_in_tooltip:show}}}};if(actualNbt!==null)e.actualNbt=actualNbt;inputs.push(e);}
for(const component of ['can_break','can_place_on']){
 add(component+' any','stone',{},[{}],null,component);add(component+' none','stone',{},[],null,component);inputs.at(-1).directEmpty=true;
 add(component+' stone','stone',{},[{blocks:'minecraft:stone'}],null,component);add(component+' mismatch','dirt',{},[{blocks:'minecraft:stone'}],null,component);
 add(component+' OR','dirt',{},[{blocks:'minecraft:stone'},{blocks:'minecraft:dirt'}],null,component,false);
 add(component+' ID set','dirt',{},[{blocks:['minecraft:stone','minecraft:dirt']}],null,component);
 for(const block of ['oak_log','birch_log','stone'])add(component+' logs '+block,block,{},[{blocks:'#minecraft:logs'}],null,component);
 for(const [prop,value,state]of [['age','4',{age:'4'}],['age','04',{age:'4'}],['age','+4',{age:'4'}],['age','8',{age:'4'}],['age','bad',{age:'4'}],['age','4.0',{age:'4'}],['missing','4',{age:'4'}]])add(component+' exact '+prop+' '+value,'wheat',state,[{state:{[prop]:value}}],null,component);
 for(const range of [{min:'2',max:'5'},{min:'5'},{max:'3'},{min:'04',max:'4'},{},{min:'-1'},{max:'8'},{min:'bad'},{min:'7',max:'2'}])add(component+' range '+JSON.stringify(range),'wheat',{age:'4'},[{state:{age:range}}],null,component);
 for(const range of [{min:'south',max:'east'},{min:'east',max:'west'},{max:'north'},{min:'east'},{min:'invalid'}])add(component+' direction '+JSON.stringify(range),'oak_stairs',{facing:'west'},[{state:{facing:range}}],null,component);
 for(const range of [{min:'false',max:'true'},{min:'true'},{max:'false'},{min:'TRUE'}])add(component+' boolean '+JSON.stringify(range),'oak_stairs',{waterlogged:'false'},[{state:{waterlogged:range}}],null,component);
 add(component+' state and blocks AND','stone',{},[{blocks:'minecraft:stone',state:{age:{}}}],null,component);
 add(component+' NBT missing','chest',{},[{blocks:'minecraft:chest',nbt:'{}'}],null,component);
 add(component+' NBT subset','chest',{},[{blocks:'minecraft:chest',nbt:'{x:0,Items:[]}'}],'{id:"minecraft:chest",x:0,y:64,z:0,Items:[]}',component);
 add(component+' NBT wrong type','chest',{},[{blocks:'minecraft:chest',nbt:'{x:0b}'}],'{id:"minecraft:chest",x:0,y:64,z:0,Items:[]}',component);
}
const folder=join(cache,'adventure-audit'),classes=join(folder,'classes'),java=join(root,'tools/port-1.20.6/ExtractAdventure1206.java'),helper=join(root,'tools/port-1.20.6/ExtractCreative1206.java'),order=join(folder,'registry-order.json'),input=join(folder,'input.json'),out=join(folder,'native.json');
await mkdir(classes,{recursive:true});await writeFile(order,JSON.stringify(Object.fromEntries(Object.entries(KNOWN_PACK_766.registries).map(([key,entries])=>[key,entries.map(e=>e.key)]))));await writeFile(input,JSON.stringify(inputs));
const cp=nativeClasspath(cache).split(delimiter);cp[0]=join(cache,'client-model-oracle.jar');
try{execFileSync(process.env.JAVAC||'javac',['-cp',cp.join(delimiter),'-d',classes,helper,java],{stdio:'pipe'});execFileSync(process.env.JAVA||'java',['-cp',[classes,...cp].join(delimiter),'ExtractAdventure1206',out,join(cache,'client.txt'),order,input],{stdio:'pipe',maxBuffer:16*1024*1024});}catch(e){process.stderr.write(e.stdout||'');process.stderr.write(e.stderr||e.message);throw Error('Native adventure oracle failed');}
const native=JSON.parse(await readFile(out)),canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const data={minecraftVersion:target.minecraftVersion,clientJarSha1:target.downloads.client.sha1,extractorSha256:createHash('sha256').update(await readFile(java)).digest('hex'),samples:native.cases.map((row,i)=>({...row,block:inputs[i].block,state:inputs[i].state,component:inputs[i].component,actualNbt:inputs[i].actualNbt??null}))};
for(const [path,text]of [[join(root,'tools/fixtures/adventure-1.20.6.json'),JSON.stringify(canonical(data),null,2)+'\n'],[join(root,'client/js/game/adventure-properties-1.20.6.js'),'// Native Property value/comparison domains, generated by adventure-fixtures.mjs.\nexport const ADVENTURE_PROPERTIES_766='+JSON.stringify(canonical({properties:native.properties,types:native.propertyTypes}))+';\n']]){
 if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==text)throw Error('Stale native adventure data '+path);}else await writeFile(path,text);
}
console.log('Native adventure: '+inputs.length+' stack/predicate cases; '+Object.keys(native.properties).length+' block property maps, '+native.propertyTypes.length+' comparable domains');
