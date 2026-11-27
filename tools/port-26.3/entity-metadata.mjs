// Regenerates the native 26.3 metadata indices for the 26.3-only entity classes. Indices come
// from SynchedEntityData.defineId inside the pinned client jar, never from a protocol wiki.
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const classes=join(cache,'generated/entity-metadata-classes');
const fixture=join(root,'tools/port-26.3/fixtures/entity-metadata-26.3.json');
const output=join(root,'client/js/game/entity-metadata-26.3.js');

function jars(dir){
  const out=[];
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory())out.push(...jars(path));
    else if(entry.name.endsWith('.jar'))out.push(path);
  }
  return out;
}

const libraryJars=jars(join(cache,'libraries'));
assert.ok(libraryJars.length>20,'the 26.3 libraries are extracted');
const sep=process.platform==='win32'?';':':';
const classpath=[join(cache,'client.jar'),...libraryJars].join(sep);
mkdirSync(classes,{recursive:true});
const compile=spawnSync('javac',['-Xlint:none','-cp',classpath,'-d',classes,join(root,'tools/port-26.3/DumpEntityMetadata26_3.java')],{encoding:'utf8'});
if(compile.status!==0)throw Error('javac failed\n'+compile.stdout+compile.stderr);
const run=spawnSync('java',['-Djava.awt.headless=true','-cp',classes+sep+classpath,'DumpEntityMetadata26_3'],{encoding:'utf8'});
if(run.status!==0)throw Error('metadata dumper failed\n'+run.stdout+run.stderr);
const table=JSON.parse(run.stdout);
assert.equal(Object.keys(table).length,10,'all 26.3-only entities are dumped');
for(const [name,fields] of Object.entries(table)){
  assert.ok(Object.keys(fields).length>0,name+' has metadata');
  assert.ok(Object.values(fields).every(value=>Number.isInteger(value)&&value>=0),name+' indices are non-negative');
}
if(process.argv.includes('--check')){
  assert.deepEqual(JSON.parse(readFileSync(fixture,'utf8')),table,'entity metadata fixture needs regeneration (run npm run entity-metadata:26.3)');
  console.log('Verified native 26.3 entity metadata indices');
}else{
  writeFileSync(fixture,JSON.stringify(table,null,2)+'\n');
  writeFileSync(output,'// Synched metadata indices extracted from the pinned 26.3 client jar.\nexport const NATIVE_METADATA_26_3='+JSON.stringify(table)+';\n');
  console.log('Wrote '+fixture+' and '+output);
}
