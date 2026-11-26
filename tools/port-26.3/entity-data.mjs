// Regenerates the native 26.3 entity data serializer table. The ids come from
// EntityDataSerializers.getSerializedId after Bootstrap, never from a protocol wiki.
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const classes=join(cache,'generated/entity-data-classes');
const fixture=join(root,'tools/port-26.3/fixtures/entity-data-serializers-26.3.json');

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
const compile=spawnSync('javac',['-Xlint:none','-cp',classpath,'-d',classes,join(root,'tools/port-26.3/DumpEntityData26_3.java')],{encoding:'utf8'});
if(compile.status!==0)throw Error('javac failed\n'+compile.stdout+compile.stderr);
const run=spawnSync('java',['-Djava.awt.headless=true','-cp',classes+sep+classpath,'DumpEntityData26_3'],{encoding:'utf8'});
if(run.status!==0)throw Error('dumper failed\n'+run.stdout+run.stderr);
const table=JSON.parse(run.stdout);
const ids=Object.keys(table).map(Number);
assert.ok(ids.every((id,index)=>id===index),'serializer ids are contiguous');
assert.ok(ids.length>40,'the native serializer table is complete');
if(process.argv.includes('--check')){
  assert.deepEqual(JSON.parse(readFileSync(fixture,'utf8')),table,'entity data serializer fixture needs regeneration (run npm run entity-data:26.3)');
  console.log('Verified native 26.3 entity data serializer ids ('+ids.length+')');
}else{
  writeFileSync(fixture,JSON.stringify(table,null,2)+'\n');
  console.log('Wrote '+fixture+' ('+ids.length+' serializers)');
}
