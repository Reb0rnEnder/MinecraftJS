// Extracts the native 26.3 data component network codecs. Every component registered in
// DataComponents is built by a lambda$static$<id> that ends in networkSynchronized(codec);
// javap shows exactly which stream codecs that expression is built from, so the JS reader
// table is derived from the jar instead of from a protocol wiki.
//
// The fixture records, per component id, the ordered symbol list of the codec expression.
// It is a manifest, not a decoder: play-codec-26.3.js maps each symbol to a reader and fails
// closed on symbols it has not verified.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const fixture=join(root,'tools/port-26.3/fixtures/data-component-codecs-26.3.json');
const registries=JSON.parse(readFileSync(join(cache,'generated/reports/registries.json'),'utf8'));
const components=registries['minecraft:data_component_type'].entries;

function jars(dir){
  const out=[];
  for(const entry of readdirSafe(dir)){
    const path=join(dir,entry.name);
    if(entry.isDirectory())out.push(...jars(path));
    else if(entry.name.endsWith('.jar'))out.push(path);
  }
  return out;
}
function readdirSafe(dir){
  try{return require$readdir(dir);}catch{return [];}
}
// fs.readdirSync with Dirent, imported lazily to keep the top of the file readable.
import {readdirSync} from 'node:fs';
function require$readdir(dir){return readdirSync(dir,{withFileTypes:true});}

const sep=process.platform==='win32'?';':':';
const classpath=[join(cache,'client.jar'),...jars(join(cache,'libraries'))].join(sep);
const javap=spawnSync('javap',['-p','-c','-classpath',classpath,'net.minecraft.core.component.DataComponents'],{encoding:'utf8',maxBuffer:64*1024*1024});
assert.equal(javap.status,0,'javap must read the 26.3 client');
const text=javap.stdout.replace(/\r\n/g,'\n');

// Each component registration lambda is a contiguous block; the id in its name is the
// registry protocol id, which the native registry report also fixes.
const blocks=new Map();
const header=/^  private static net\.minecraft\.core\.component\.DataComponentType\$Builder lambda\$static\$(\d+)\(/gm;
let match;
const starts=[];
while((match=header.exec(text)))starts.push({id:Number(match[1]),index:match.index});
for(let i=0;i<starts.length;i++){
  const end=i+1<starts.length?starts[i+1].index:text.length;
  blocks.set(starts[i].id,text.slice(starts[i].index,end));
}

// Symbols inside the codec expression, in bytecode order. getstatic fields carry the codec
// field name; invokestatic/invokeinterface entries carry the builder call that combines them.
// A component without networkSynchronized is server-only and can never appear in a patch;
// the fixture records that explicitly instead of inventing a codec for it.
function symbols(block){
  const cut=block.indexOf('networkSynchronized');
  if(cut<0)return null;
  const expression=block.slice(0,cut);
  const out=[];
  for(const line of expression.split('\n')){
    const field=line.match(/getstatic\s+#\d+\s+\/\/ Field ([\w/$]+)\.([\w$]+):/);
    if(field)out.push(field[1].replace(/^net\/minecraft\//,'').replace(/\//g,'.')+'.'+field[2]);
    const call=line.match(/\/\/ (?:Interface)?Method ([\w/$]+)\.([\w$]+):/);
    if(call)out.push(call[1].replace(/^net\/minecraft\//,'').replace(/\//g,'.')+'.'+call[2]);
  }
  return out;
}

const table={};
for(const [name,entry] of Object.entries(components)){
  const block=blocks.get(entry.protocol_id);
  assert.ok(block,'no DataComponents lambda for '+name+' (id '+entry.protocol_id+')');
  table[entry.protocol_id]={name:name.replace(/^minecraft:/,''),codec:symbols(block),synced:block.includes('networkSynchronized')};
}
const ids=Object.keys(table).map(Number).sort((a,b)=>a-b);
assert.equal(ids.length,Object.keys(components).length,'every component has a codec expression');
assert.ok(ids.every((id,index)=>id===index),'component ids are dense');

const serialized=JSON.stringify(table,null,2)+'\n';
if(process.argv.includes('--check')){
  assert.equal(readFileSync(fixture,'utf8'),serialized,'data component codec fixture needs regeneration (run npm run component-codecs:26.3)');
  console.log('Verified native 26.3 data component codecs ('+ids.length+' components)');
}else{
  mkdirSync(dirname(fixture),{recursive:true});
  writeFileSync(fixture,serialized);
  console.log('Wrote '+fixture+' ('+ids.length+' components)');
}
