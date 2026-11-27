// Gates every 26.3 component reader against bytes written by Mojang's own codec for a real
// vanilla item component value. Run with --write after changing DumpComponents26_3.java.
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Reader} from '../../client/js/net/buffer.js';
import {COMPONENT_READERS_26_3} from '../../client/js/net/item-components-26.3.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const classes=join(cache,'generated/component-classes');
const fixture=join(root,'tools/port-26.3/fixtures/components-26.3.json');

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
const compile=spawnSync('javac',['-Xlint:none','-cp',classpath,'-d',classes,join(root,'tools/port-26.3/DumpComponents26_3.java')],{encoding:'utf8'});
if(compile.status!==0)throw Error('javac failed\n'+compile.stdout+compile.stderr);
const run=spawnSync('java',['-Djava.awt.headless=true','-cp',classes+sep+classpath,'DumpComponents26_3'],{encoding:'utf8',maxBuffer:32*1024*1024});
if(run.status!==0)throw Error('dumper failed\n'+run.stdout+run.stderr);

if(process.argv.includes('--write')){
  writeFileSync(fixture,run.stdout);
  console.log('Wrote '+fixture);
}else{
  const expected=JSON.parse(readFileSync(fixture,'utf8'));
  const actual=JSON.parse(run.stdout);
  assert.deepEqual(actual,expected,'components fixture needs regeneration (run npm run components:26.3)');
}

const samples=JSON.parse(readFileSync(fixture,'utf8'));
let checked=0;
const skipped=[];
for(const [name,{hex}] of Object.entries(samples)){
  const read=COMPONENT_READERS_26_3[name];
  // Components registered without networkSynchronized are deliberately unported; their
  // presence in a vanilla item does not make them safe to read from the network.
  if(!read){skipped.push(name);continue;}
  const r=new Reader(Buffer.from(hex,'hex'));
  read(r);
  assert.equal(r.remaining(),0,'26.3 component "'+name+'" reader left '+r.remaining()+' bytes');
  checked++;
}
// The 32 synchronised components that used to fail closed (the other seven missing readers
// are registered server-only). Every one except block_transformer has a vanilla sample;
// block_transformer is a dynamic-registry holder and its layout is javap-proven.
const portedInThisSection=['use_effects','attribute_modifiers','food','consumable','use_remainder','use_cooldown','damage_resistant','tool','weapon','attack_range','enchantable','equippable','repairable','tooltip_style','death_protection','blocks_attacks','piercing_weapon','kinetic_weapon','attack_animation','interact_animation','block_transformer','villager_food','profile','compostable','cooking_fuel','brewing_fuel','mob_visibility','sign_text_front','sign_text_back','cushion/color'];
for(const name of portedInThisSection){
  assert.ok(COMPONENT_READERS_26_3[name],'ported component "'+name+'" has no reader');
  if(name!=='block_transformer')assert.ok(samples[name],'ported component "'+name+'" has no Mojang-encoded sample');
}
console.log('Verified '+checked+' native 26.3 component codecs against Mojang-encoded vanilla values'+(skipped.length?' (unported server-only: '+skipped.join(', ')+')':''));
