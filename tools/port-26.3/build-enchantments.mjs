// Builds the 26.3 enchantment table from the native jar. The registry order is the
// native alphabetical order sent in configuration (id 0 aqua_affinity ... id 42 wind_burst);
// levels, costs, slots, supported items, exclusivity and effects come from each enchantment's
// data JSON, with membership tags and display names from the same jar.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const jar=join(cache,'client.jar');
const output=join(root,'client/data/enchantments.json');
const namesOutput=join(root,'client/js/net/enchantment-names-26.3.js');
const check=process.argv.includes('--check');

function unzip(path){
  const result=spawnSync('unzip',['-p',jar,path],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
  if(result.status!==0)throw Error('unzip failed for '+path+': '+result.stderr);
  return result.stdout;
}
function unzipJson(path){return JSON.parse(unzip(path));}
function listing(prefix,suffix){
  const result=spawnSync('unzip',['-Z1',jar,prefix+'*'+suffix],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.status!==0)throw Error('unzip listing failed: '+result.stderr);
  return result.stdout.trim().split(/\r?\n/).sort();
}
const short=value=>typeof value==='string'?value.replace(/^#?minecraft:/,''):value;
const tagFile=name=>unzipJson('data/minecraft/tags/enchantment/'+name+'.json');

export async function buildEnchantments(){
  const files=listing('data/minecraft/enchantment/','.json');
  const names=files.map(path=>path.replace(/^.*\/enchantment\//,'').replace(/\.json$/,''));
  assert.equal(names.length,43,'the jar carries 43 native enchantments');
  assert.deepEqual(names,[...names].sort(),'native registry order is alphabetical');
  const strings=unzipJson('assets/minecraft/lang/en_us.json');
  const previous=JSON.parse(await readFile(output,'utf8'));
  const old=new Map(previous.map(enchantment=>[enchantment.name,enchantment]));

  const tags={curse:new Set(tagFile('curse').values.map(short)),treasure:new Set(tagFile('treasure').values.map(short)),tradeable:new Set(tagFile('tradeable').values.map(short)),discoverable:new Set(tagFile('in_enchanting_table').values.map(short))};
  const exclusives=new Map();
  for(const path of listing('data/minecraft/tags/enchantment/exclusive_set/','.json')){
    const name=path.replace(/^.*\/exclusive_set\//,'').replace(/\.json$/,'');
    exclusives.set('minecraft:exclusive_set/'+name,tagFile('exclusive_set/'+name).values.map(short));
  }

  const enchantments=names.map((name,id)=>{
    const data=unzipJson('data/minecraft/enchantment/'+name+'.json');
    const base=old.get(name)||{};
    const exclusive=typeof data.exclusive_set==='string'?exclusives.get(data.exclusive_set.replace(/^#/,'')):null;
    assert.ok(!data.exclusive_set||exclusive,'exclusive set resolves for '+name);
    return {
      id,
      name,
      displayName:strings['enchantment.minecraft.'+name]||base.displayName||name.replace(/_/g,' '),
      maxLevel:data.max_level,
      minCost:{a:data.min_cost.base,b:data.min_cost.per_level_above_first??0},
      maxCost:{a:data.max_cost.base,b:data.max_cost.per_level_above_first??0},
      treasureOnly:tags.treasure.has(name),
      curse:tags.curse.has(name),
      exclude:(exclusive||[]).filter(value=>value!==name).map(short),
      category:base.category||'none',
      weight:data.weight,
      tradeable:tags.tradeable.has(name),
      discoverable:tags.discoverable.has(name),
      anvilCost:data.anvil_cost,
      slots:data.slots,
      supportedItems:data.supported_items,
      primaryItems:data.primary_items??null,
      exclusiveSet:data.exclusive_set??null,
      effects:data.effects??{}
    };
  });

  const byName=new Map(enchantments.map(enchantment=>[enchantment.name,enchantment]));
  assert.equal(enchantments[0].name,'aqua_affinity','native id 0 is aqua_affinity');
  assert.equal(enchantments[21].name,'lunge','native id 21 is the new lunge enchantment');
  assert.equal(enchantments[42].name,'wind_burst','native id 42 is wind_burst');
  assert.equal(byName.get('sharpness').id,33,'sharpness uses its native alphabetical id');
  assert.equal(byName.get('sharpness').maxLevel,5,'sharpness max level');
  assert.equal(byName.get('mending').maxLevel,1,'mending max level');
  assert.equal(byName.get('binding_curse').curse,true,'binding curse membership');
  assert.equal(byName.get('mending').treasureOnly,true,'mending is treasure-only');
  assert.equal(byName.get('protection').treasureOnly,false,'protection is not treasure-only');
  assert.ok(byName.get('sharpness').exclude.includes('smite'),'damage exclusivity resolves');
  assert.ok(!byName.get('sharpness').exclude.includes('sharpness'),'an enchantment excludes itself');
  assert.equal(byName.get('lunge').displayName,'Lunge','lunge display name');
  assert.deepEqual(byName.get('protection').slots,['armor'],'protection slots');

  const serialized=JSON.stringify(enchantments)+'\n';
  const namesSource='// Generated from the native 26.3 enchantment registry order; do not hand-edit.\n'+
    'export const ENCHANTMENT_NAMES_26_3=Object.freeze('+JSON.stringify(enchantments.map(enchantment=>'minecraft:'+enchantment.name))+');\n';
  if(check){
    assert.equal(await readFile(output,'utf8'),serialized,'client/data/enchantments.json is regenerated from the native jar');
    assert.equal(await readFile(namesOutput,'utf8'),namesSource,'enchantment name table is current');
  }else{
    await writeFile(output,serialized);
    await writeFile(namesOutput,namesSource);
  }
  console.log('Native 26.3 enchantment table: 43 enchantments, alphabetical registry ids, native costs/slots/effects');
  return enchantments;
}

if(process.argv[1]&&process.argv[1].endsWith('build-enchantments.mjs'))await buildEnchantments();
