// Native 1.20.6 appendHoverText lines and ArmorTrim.addToTooltip in item tooltips.
import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{Items}from'../client/js/game/items.js';import{Assets}from'../client/js/assets.js';import{ZipFile}from'../lib/zip.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url))),jar=new ZipFile(new URL('../cache/port-1.20.6/client.jar',import.meta.url));
const assets={data:{items:json('../client/data/items.json'),creative:json('../client/data/creative.json'),entities:json('../client/data/entities.json')},lang:JSON.parse(jar.read('assets/minecraft/lang/en_us.json')),translate:Assets.prototype.translate};
import{setTranslator}from'../client/js/gui/chat.js';
setTranslator((k,a)=>assets.translate(k,a));
const items=new Items(assets),id=n=>items.byName.get(n).id,plain=s=>s.replace(/§./g,'');
const tip=(name,componentValues,opts=[false,false])=>items.tooltip({id:id(name),count:1,componentValues},...opts).map(plain);
test('shulker box lists five items and the rest, written books their generation, maps their id',()=>{
  const contents=['diamond','stone','dirt','apple','bread','arrow','egg'].map((n,i)=>({itemCount:i+1,itemId:id(n)}));
  assert.deepEqual(tip('shulker_box',{container:{contents}}).slice(1),['Diamond x1','Stone x2','Dirt x3','Apple x4','Bread x5','and 2 more...']);
  assert.deepEqual(tip('written_book',{written_book_content:{title:'T',author:'Ann',generation:1,pages:[]}}).slice(1),['by Ann','Copy of original']);
  assert.deepEqual(tip('filled_map',{map_id:7}),['Map','Id #7']);
  items.maps.set(7,{scale:2,locked:true});assert.deepEqual(tip('filled_map',{map_id:7},[true,false]).slice(1,5),['Locked','Id #7','Scaling at 1:4','(Level 2/4)']);
});
test('templates, spawners, pots, ominous bottles, banner patterns, fish buckets and paintings',()=>{
  assert.deepEqual(tip('netherite_upgrade_smithing_template',{}).slice(1),['Netherite Upgrade','','Applies to:',' Diamond Equipment','Ingredients:',' Netherite Ingot']);
  assert.equal(tip('sentry_armor_trim_smithing_template',{})[1],'Sentry Armor Trim');
  assert.deepEqual(tip('spawner',{}).slice(1),['','Interact with Spawn Egg:',' Sets Mob Type']);
  assert.deepEqual(tip('spawner',{block_entity_data:{SpawnData:{entity:{id:'minecraft:zombie'}}}}).slice(1),['Zombie']);
  assert.deepEqual(tip('decorated_pot',{pot_decorations:{decorations:[id('brick'),id('angler_pottery_sherd'),id('brick'),id('skull_pottery_sherd')]}}).slice(1),['','Skull Pottery Sherd','Angler Pottery Sherd','Brick','Brick']);
  assert.deepEqual(tip('ominous_bottle',{ominous_bottle_amplifier:2}).slice(1,2),['Bad Omen III (01:40:00)']);
  assert.deepEqual(tip('flower_banner_pattern',{}).slice(1),['Flower Charge']);
  assert.deepEqual(tip('tropical_fish_bucket',{bucket_entity_data:{BucketVariantTag:(1<<8)|(1<<16)|(7<<24)}}).slice(1),['Sunstreak','Orange, Gray']);
  const anemone=1|(1<<8)|(1<<16)|(7<<24);assert.deepEqual(tip('tropical_fish_bucket',{bucket_entity_data:{BucketVariantTag:anemone}}).slice(1),['Anemone']);
  assert.deepEqual(tip('painting',{entity_data:{id:'minecraft:painting',variant:'minecraft:kebab'}}).slice(1),['Kebab med tre pepperoni','Kristoffer Zetterstrand','1x1']);
  assert.deepEqual(tip('painting',{},[false,true]).slice(1),['Random variant']);
});
test('armor trims and banner/shield layers read their registry descriptions',async()=>{
  const{KNOWN_PACK_766}=await import('../client/js/net/known-pack-1.20.6.js');const at=(r,k)=>KNOWN_PACK_766.registries[r].findIndex(e=>e.key===k);
  const trim={material:{materialId:at('minecraft:trim_material','minecraft:gold')},pattern:{patternId:at('minecraft:trim_pattern','minecraft:sentry')},showInTooltip:true};
  const lines=items.tooltip({id:id('iron_chestplate'),count:1,componentValues:{trim}});
  assert.deepEqual(lines.slice(1,4).map(plain),['Upgrade: ',' Sentry Armor Trim',' Gold Material']);assert.match(lines[2],/§x§D§E§B§1§2§D/i);
  const layers=[{pattern:{patternId:at('minecraft:banner_pattern','minecraft:stripe_bottom')},colorId:14}];
  assert.deepEqual(tip('shield',{banner_patterns:{layers}}).slice(1),['Red Base']);
});
