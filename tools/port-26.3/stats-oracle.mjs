// Regenerates the native 26.3 stat registry table and the award_stats fixture. The Java side
// encodes the packet with Mojang's StreamCodec, so the bytes are the server's wire truth.
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const classes=join(cache,'generated/stat-classes');
const fixture=join(root,'tools/port-26.3/fixtures/stats-26.3.json');

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
const compile=spawnSync('javac',['-Xlint:none','-cp',classpath,'-d',classes,join(root,'tools/port-26.3/DumpStats26_3.java')],{encoding:'utf8'});
if(compile.status!==0)throw Error('javac failed\n'+compile.stdout+compile.stderr);
const run=spawnSync('java',['-Djava.awt.headless=true','-cp',classes+sep+classpath,'DumpStats26_3'],{encoding:'utf8'});
if(run.status!==0)throw Error('dumper failed\n'+run.stdout+run.stderr);
const data=JSON.parse(run.stdout);
assert.equal(data.types.length,9,'the native stat_type registry has nine entries');
assert.ok(data.custom.includes('play_time'));
assert.equal(data.custom[data.custom.indexOf('play_time')],'play_time');
assert.equal(data.expected.length,3);
assert.match(data.hex,/^[0-9a-f]+$/);
const registrySource=[
  '// Generated from the native 26.3 stat_type and custom_stat registries; do not hand-edit.',
  'export const STAT_REGISTRY_VERSION_26_3="26.3";',
  'export const STAT_TYPES_26_3=Object.freeze('+JSON.stringify(data.types)+');',
  'export const CUSTOM_STATS_26_3=Object.freeze('+JSON.stringify(data.custom)+');'
].join('\n')+'\n';
const registryPath=join(root,'client/js/game/stat-registry-26.3.js');
if(process.argv.includes('--check')){
  assert.deepEqual(JSON.parse(readFileSync(fixture,'utf8')),data,'stats fixture needs regeneration (run npm run stats:26.3)');
  assert.equal(readFileSync(registryPath,'utf8'),registrySource,'stat registry 26.3 needs regeneration (run npm run stats:26.3)');
  console.log('Verified native 26.3 stat registry and award_stats fixture ('+data.hex.length/2+' bytes)');
}else{
  writeFileSync(fixture,JSON.stringify(data,null,2)+'\n');
  writeFileSync(registryPath,registrySource);
  console.log('Wrote '+fixture+' and '+registryPath+' ('+data.hex.length/2+' bytes)');
}
