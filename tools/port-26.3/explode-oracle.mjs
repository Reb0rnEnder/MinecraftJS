// Regenerates the native 26.3 explosion fixture. DumpExplode26_3 encodes the packet with
// Mojang's StreamCodec, so the fixture bytes are the server's wire truth.
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const classes=join(cache,'generated/explode-classes');
const fixture=join(root,'tools/port-26.3/fixtures/explode-26.3.json');

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
const compile=spawnSync('javac',['-Xlint:none','-cp',classpath,'-d',classes,join(root,'tools/port-26.3/DumpExplode26_3.java')],{encoding:'utf8'});
if(compile.status!==0)throw Error('javac failed\n'+compile.stdout+compile.stderr);
const run=spawnSync('java',['-Djava.awt.headless=true','-cp',classes+sep+classpath,'DumpExplode26_3'],{encoding:'utf8'});
if(run.status!==0)throw Error('dumper failed\n'+run.stdout+run.stderr);
const data=JSON.parse(run.stdout);
assert.equal(data.hex.length%2,0,'explode hex is whole bytes');
assert.match(data.hex,/^[0-9a-f]+$/);
assert.equal(data.expected.particle,'explosion');
assert.equal(data.expected.blockParticles.length,2);
if(process.argv.includes('--check')){
  assert.deepEqual(JSON.parse(readFileSync(fixture,'utf8')),data,'explode fixture needs regeneration (run npm run explode:26.3)');
  console.log('Verified native 26.3 explode codec fixture ('+data.hex.length/2+' bytes)');
}else{
  writeFileSync(fixture,JSON.stringify(data,null,2)+'\n');
  console.log('Wrote '+fixture+' ('+data.hex.length/2+' bytes)');
}
