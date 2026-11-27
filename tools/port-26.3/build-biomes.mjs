// Builds the 26.3 biome fallback table from the pinned client jar. Registry order is the
// native alphabetical order (the same order the server sends in configuration); climate,
// precipitation and visual colours come from each biome's own data JSON, display names from
// the jar's en_us.json. Existing presentation fields survive by name.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const jar=join(cache,'client.jar');
const output=join(root,'client/data/biomes.json');
const check=process.argv.includes('--check');

function entry(name){
  const result=spawnSync('unzip',['-p',jar,'data/minecraft/worldgen/biome/'+name+'.json'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.status!==0)throw Error('unzip failed for '+name+': '+result.stderr);
  return JSON.parse(result.stdout);
}
function language(){
  const result=spawnSync('unzip',['-p',jar,'assets/minecraft/lang/en_us.json'],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
  if(result.status!==0)throw Error('unzip failed: '+result.stderr);
  return JSON.parse(result.stdout);
}
function listing(){
  const result=spawnSync('unzip',['-Z1',jar,'data/minecraft/worldgen/biome/*.json'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.status!==0)throw Error('unzip listing failed: '+result.stderr);
  return result.stdout.trim().split(/\r?\n/).map(line=>line.replace(/^.*\/worldgen\/biome\//,'').replace(/\.json$/,'')).sort();
}
const rgb=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?parseInt(value.slice(1),16):undefined;
const title=name=>name.split('_').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');

export async function buildBiomes(){
  const names=listing();
  assert.equal(names.length,67,'the jar carries 67 native biomes');
  const strings=language();
  const previous=JSON.parse(await readFile(output,'utf8'));
  const old=new Map(previous.map(biome=>[biome.name,biome]));
  const biomes=[];

  for(const [id,name] of names.entries()){
    const data=entry(name);
    const base=old.get(name)||{};
    const effects=data.effects||{};
    const attributes=data.attributes||{};
    const nativeEffects={...base.effects};
    for(const [native,key] of [
      ['minecraft:visual/sky_color','sky_color'],
      ['minecraft:visual/fog_color','fog_color'],
      ['minecraft:visual/water_fog_color','water_fog_color']
    ]){
      const colour=rgb(attributes[native]);
      if(colour!==undefined&&nativeEffects[key]===undefined)nativeEffects[key]=colour;
    }
    const waterColor=rgb(effects.water_color);
    if(waterColor!==undefined&&nativeEffects.water_color===undefined)nativeEffects.water_color=waterColor;
    for(const key of ['grass_color','foliage_color','dry_foliage_color']){
      const colour=rgb(effects[key]);
      if(colour!==undefined)nativeEffects[key]=colour;
    }
    if(effects.grass_color_modifier&&nativeEffects.grass_color_modifier===undefined)nativeEffects.grass_color_modifier=effects.grass_color_modifier;
    const music=attributes['minecraft:audio/background_music']?.default;
    if(music&&nativeEffects.music===undefined)nativeEffects.music={
      replace_current_music:0,
      max_delay:music.max_delay,
      sound:music.sound,
      min_delay:music.min_delay
    };

    const temperature=typeof base.temperature==='number'?base.temperature:data.temperature;
    const has_precipitation=typeof base.has_precipitation==='boolean'?base.has_precipitation:!!data.has_precipitation;
    biomes.push({
      id,
      name,
      category:base.category||'none',
      temperature,
      has_precipitation,
      dimension:base.dimension||'overworld',
      displayName:strings['biome.minecraft.'+name]||base.displayName||title(name),
      color:base.color??nativeEffects.grass_color??0,
      rainfall:typeof base.rainfall==='number'?base.rainfall:data.downfall,
      precipitation:base.precipitation||(has_precipitation?(temperature<0.15?'snow':'rain'):'none'),
      effects:nativeEffects
    });
  }

  assert.equal(biomes.length,67,'biome table covers every native jar biome');
  const byName=new Map(biomes.map(biome=>[biome.name,biome]));
  for(const name of ['dappled_forest','pale_garden','sulfur_caves'])assert.ok(byName.has(name),'26.3 biome is present: '+name);
  assert.equal(byName.get('badlands').id,0,'badlands keeps registry id 0');
  assert.equal(byName.get('dappled_forest').id,names.indexOf('dappled_forest'),'dappled_forest sits in native registry order');
  assert.equal(byName.get('sulfur_caves').id,names.indexOf('sulfur_caves'),'sulfur_caves sits in native registry order');
  assert.equal(names.indexOf('dappled_forest')-names.indexOf('crimson_forest'),1,'dappled_forest follows crimson_forest');
  assert.equal(names.indexOf('sunflower_plains')-names.indexOf('sulfur_caves'),1,'sulfur_caves precedes sunflower_plains');
  assert.equal(byName.get('dappled_forest').displayName,'Dappled Forest','new display name comes from en_us.json');
  assert.equal(byName.get('dappled_forest').effects.grass_color,0xdf6827,'new grass colour is native');
  assert.equal(byName.get('sulfur_caves').effects.water_color,0x34bf89,'new water colour is native');
  assert.equal(byName.get('pale_garden').temperature,0.7,'pale garden climate comes from the jar');
  assert.equal(byName.get('snowy_plains').precipitation,'snow','snowy biome precipitation is preserved');

  const serialized=JSON.stringify(biomes)+'\n';
  if(check){
    const current=await readFile(output,'utf8');
    assert.equal(current,serialized,'client/data/biomes.json is regenerated from the native jar');
  }else await writeFile(output,serialized);
  console.log('Native 26.3 biome table: '+biomes.length+' biomes, alphabetical registry ids, climate and colours from the jar');
  return biomes;
}

if(process.argv[1]&&process.argv[1].endsWith('build-biomes.mjs'))await buildBiomes();
