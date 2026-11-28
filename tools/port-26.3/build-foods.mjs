// Builds the 26.3 food table from the native item-component reports. Every item with
// minecraft:food is included; nutrition and saturation are the native component values,
// ids and display names come from the native item table. 26.3 makes the four fish buckets
// edible and no longer marks the ominous bottle as food.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const reports=join(cache,'generated/reports/minecraft/components/item');
const output=join(root,'client/data/foods.json');
const check=process.argv.includes('--check');

export async function buildFoods(){
  const items=JSON.parse(await readFile(join(root,'client/data/items.json'),'utf8'));
  const byName=new Map(items.map(item=>[item.name,item]));
  const foods=[];
  for(const file of (await readdir(reports)).sort()){
    const components=JSON.parse(await readFile(join(reports,file),'utf8')).components;
    const food=components['minecraft:food'];
    if(!food)continue;
    const name=file.replace(/\.json$/,'');
    const item=byName.get(name);
    assert.ok(item,'native item exists for food '+name);
    const foodPoints=food.nutrition;
    const saturation=food.saturation;
    assert.equal(typeof foodPoints,'number','nutrition is numeric for '+name);
    assert.equal(typeof saturation,'number','saturation is numeric for '+name);
    foods.push({
      id:item.id,
      name,
      stackSize:item.stackSize,
      displayName:item.displayName,
      foodPoints,
      saturation,
      effectiveQuality:foodPoints+saturation,
      saturationRatio:saturation/foodPoints,
      canAlwaysEat:food.can_always_eat??false
    });
  }
  foods.sort((a,b)=>a.id-b.id);

  assert.equal(foods.length,44,'the native component reports carry 44 foods');
  const names=new Set(foods.map(food=>food.name));
  for(const name of ['cod_bucket','pufferfish_bucket','salmon_bucket','tropical_fish_bucket'])assert.ok(names.has(name),'26.3 edible bucket is present: '+name);
  assert.ok(!names.has('ominous_bottle'),'the ominous bottle is no longer a food');
  const apple=foods.find(food=>food.name==='apple');
  assert.equal(apple.id,byName.get('apple').id,'food ids follow the native item table');
  assert.deepEqual([apple.foodPoints,apple.saturation,apple.effectiveQuality,apple.saturationRatio],[4,2.4,6.4,0.6],'apple food values');
  assert.equal(foods.find(food=>food.name==='golden_apple').canAlwaysEat,true,'golden apple can always be eaten');

  const serialized=JSON.stringify(foods)+'\n';
  if(check)assert.equal(await readFile(output,'utf8'),serialized,'client/data/foods.json is regenerated from the native reports');
  else await writeFile(output,serialized);
  console.log('Native 26.3 food table: '+foods.length+' foods, native nutrition/saturation and item ids');
  return foods;
}

if(process.argv[1]&&process.argv[1].endsWith('build-foods.mjs'))await buildFoods();
