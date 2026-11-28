import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {crc32} from 'node:zlib';import {createRequire} from 'node:module';
import {encodePng} from '../client/js/util/png.js';
import {Assets,ResourcePack} from '../client/js/assets.js';import * as Layers from '../client/js/resource-layers.js';const {overlayDirectories,resourceFilter}=Layers;import {applyPackModels,applyPackTextures,applyPackDefinitions} from '../client/js/resource-models.js';
const require=createRequire(import.meta.url),version=require('../lib/mcassets.js').MC_VERSION,hasFilters=['1.19.4','1.20.6','1.21.11'].includes(version),hasOverlays=['1.20.6','1.21.11'].includes(version),fmt=require('../lib/mcassets.js').PACK_FORMAT,encode=s=>new TextEncoder().encode(s),decode=b=>b===null?null:new TextDecoder().decode(b);
function zip(entries){
  const local=[],central=[];let offset=0;
  for(const [name,text] of Object.entries(entries)){
    const filename=Buffer.from(name),bytes=Buffer.from(text),crc=crc32(bytes),header=Buffer.alloc(30),record=Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26);
    record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt32LE(crc,16);record.writeUInt32LE(bytes.length,20);record.writeUInt32LE(bytes.length,24);record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42);
    local.push(header,filename,bytes);central.push(record,filename);offset+=header.length+filename.length+bytes.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return new Uint8Array(Buffer.concat([...local,directory,end]));
}
function pack(id,files,metadata={}){return new ResourcePack(id,zip({'pack.mcmeta':JSON.stringify({pack:{pack_format:hasOverlays?fmt:hasFilters?13:4,description:id},...metadata}),...files}));}
function assets(packs,files={}){const a=Object.assign(Object.create(Assets.prototype),{packs,languages:{en_us:{name:'English'}},language:'en_us',version:1,source:{bytes:async n=>files[n]===undefined?null:encode(typeof files[n]==='string'?files[n]:JSON.stringify(files[n]))}});return a;}
const oracle=new URL('./fixtures/resource-pack-metadata-native.json',import.meta.url);
if(existsSync(oracle))for(const row of JSON.parse(readFileSync(oracle)).cases)test('native pack metadata '+row.label,()=>{
 const resolve=()=>row.section==='filter'?row.queries.map(q=>resourceFilter(row.value)(q.namespace,q.path)):row.queries.map(q=>overlayDirectories(row.value,q));if(row.valid)assert.deepEqual(resolve(),row.results);else assert.throws(resolve);
});
if(hasOverlays)test('native overlays select format, later entries win, namespaces/listing and root metadata are preserved',async()=>{
 const p=pack('overlay',{'assets/minecraft/lang/en_us.json':'{"name":"base"}','old/assets/minecraft/lang/en_us.json':'{"name":"old"}','first/assets/minecraft/lang/en_us.json':'{"name":"first"}','last/assets/minecraft/lang/en_us.json':'{"name":"last"}','last/assets/custom/font/new.json':'{"providers":[]}','last/pack.mcmeta':'{"pack":{"description":"wrong"}}'},{overlays:{entries:[{formats:13,directory:'old'},{formats:[fmt-1,fmt+1],directory:'first'},{formats:fmt,directory:'last'}]}}),a=assets([p]);
 assert.equal(decode(await a.readBytes('lang/en_us.json')),'{"name":"last"}');assert.equal(p.description,'overlay');assert.ok(p.zip.has('assets/custom/font/new.json'));assert.equal(p.zip.list('assets/').filter(n=>n==='assets/minecraft/lang/en_us.json').length,1);assert.equal(a.resourceNamespaces().includes('custom'),true);
});
if(!hasOverlays)test('older targets ignore later overlay metadata',async()=>{const a=assets([pack('old',{'assets/minecraft/a':'base','layer/assets/minecraft/a':'new'},{overlays:{entries:[{formats:32,directory:'layer'}]}})]);assert.equal(decode(await a.readBytes('a')),'base');});
if(hasFilters)test('filters suppress lower files and stacks, preserve own resources and cross-match namespace/path rules',async()=>{
 const high=pack('high',{'assets/minecraft/keep':'own'},{filter:{block:[{namespace:'minecraft',path:'blocked'},{namespace:'custom',path:'keep'}]}}),low=pack('low',{'assets/minecraft/blocked':'lower','assets/custom/keep':'lower','assets/minecraft/keep':'lower'}),a=assets([high,low],{'minecraft/blocked':'base','custom/keep':'base'});
 assert.equal(await a.readBytes('blocked'),null);assert.equal(await a.readResourceBytes('custom:keep'),null);assert.equal(decode(await a.readBytes('keep')),'own');assert.deepEqual((await a.readResourceStack('minecraft:keep')).map(r=>decode(r.bytes)),['own']);
});
if(!hasFilters)test('older targets ignore later filter metadata',async()=>{const a=assets([pack('old',{}, {filter:{block:[{}]}})],{'minecraft/a':'base'});assert.equal(decode(await a.readBytes('a')),'base');});
test('single resources avoid lower fetches while layered reads retain high-to-low priority',async()=>{
  const a=assets([pack('high',{'assets/minecraft/a':'top'}),pack('low',{'assets/minecraft/a':'lower'})],{'minecraft/a':'base'});let fetches=0;const read=a.source.bytes;a.source.bytes=async n=>{fetches++;return read(n);};assert.equal(decode(await a.readBytes('a')),'top');assert.equal(fetches,0);assert.equal(decode(await a.readResourceBytes(':a')),'top');assert.deepEqual((await a.readResourceStack('a')).map(r=>decode(r.bytes)),['top','lower','base']);assert.equal(fetches,1);
});
test('Default divides high-priority packs from vanilla and lower-priority fallbacks',async()=>{
 const high=pack('high',{'assets/minecraft/shared':'high'}),low=pack('low',{'assets/minecraft/shared':'low','assets/minecraft/only_low':'low','assets/custom/extra':'extra','assets/minecraft/textures/owned_vanilla.png.mcmeta':'lower-meta','assets/minecraft/textures/owned_low.png':'lower-texture','assets/minecraft/textures/owned_low.png.mcmeta':'lower-owner-meta'}),a=assets([],{'minecraft/shared':'vanilla','minecraft/only_vanilla':'vanilla','minecraft/textures/owned_vanilla.png':'vanilla-texture','minecraft/textures/owned_vanilla.png.mcmeta':'vanilla-meta'});
 a.listPacks=async()=>[high,low];a.serverPacks=[];a.serverPack=null;
 await a.activatePacks(['high','vanilla','low']);
 assert.deepEqual(a.packs,[high]);assert.deepEqual(a.lowerPacks,[low]);
 assert.deepEqual((await a.readResourceStack('minecraft:shared')).map(r=>decode(r.bytes)),['high','vanilla','low']);
 assert.equal(decode(await a.readResourceBytes('minecraft:only_vanilla')),'vanilla');
 assert.equal(decode(await a.readResourceBytes('minecraft:only_low')),'low');
 assert.deepEqual(a.resourceNamespaces().sort(),['custom','minecraft']);
 const metadata=await a.resourceMetadata('minecraft:textures/owned_vanilla.png');
 assert.equal(metadata.base,true);assert.equal(decode(metadata.bytes),'vanilla-meta');
 const lowMetadata=await a.resourceMetadata('minecraft:textures/owned_low.png');
 assert.equal(lowMetadata.base,false);assert.equal(decode(lowMetadata.bytes),'lower-owner-meta');
});
test('Default stays between active packs and fallbacks when model, item, and texture files are composed',()=>{
 const high=pack('high',{'assets/minecraft/models/block/shared.json':'{"textures":{"all":"block/high"}}','assets/minecraft/items/shared.json':'{"model":{"type":"minecraft:model","model":"minecraft:item/high"}}','assets/minecraft/textures/block/shared.png':'high'});
 const low=pack('low',{'assets/minecraft/models/block/shared.json':'{"textures":{"all":"block/low"}}','assets/minecraft/models/block/low_only.json':'{"textures":{"all":"block/low"}}','assets/minecraft/items/shared.json':'{"model":{"type":"minecraft:model","model":"minecraft:item/low"}}','assets/minecraft/items/low_only.json':'{"model":{"type":"minecraft:model","model":"minecraft:item/low"}}','assets/minecraft/textures/block/shared.png':'low','assets/minecraft/textures/block/low_only.png':'low'});
 const assetsState=assets([]);assetsState.packs=[high];assetsState.lowerPacks=[low];
 const underModels={},underStates={},underItems={};
 applyPackModels([low],underModels,underStates);applyPackDefinitions([low],'items',underItems);
  const vanillaModels={'block/shared':{textures:{all:'block/default'}}},vanillaItems={shared:{model:{type:'minecraft:model',model:'minecraft:item/default'}}};
 const models={...underModels,...vanillaModels},states={...underStates},items={...underItems,...vanillaItems};
  assert.equal(models['block/shared'].textures.all,'block/default');assert.equal(items.shared.model.model,'minecraft:item/default');
 const layeredModels={...models},layeredItems={...items};
  applyPackModels([high],layeredModels,states,assetsState);assert.equal(layeredModels['block/shared'].textures.all,'block/high');assert.equal(layeredModels['block/low_only'].textures.all,'block/low');
 applyPackDefinitions([high],'items',layeredItems,assetsState);assert.equal(layeredItems.shared.model.model,'minecraft:item/high');assert.equal(layeredItems.low_only.model.model,'minecraft:item/low');
 const files=new Map([['block/shared',()=>encode('vanilla')]]),mcmeta={'block/shared':{animation:{frametime:2}}},underFiles=new Map(),underMeta={};
 applyPackTextures([low],underFiles,underMeta,models);
 for(const [key,value] of underFiles)if(!files.has(key))files.set(key,value);
 assert.equal(decode(files.get('block/shared')()),'vanilla');
 assert.ok(files.has('block/low_only'));
 applyPackTextures([high],files,mcmeta,layeredModels,assetsState);
 assert.equal(decode(files.get('block/shared')()),'high');
});
test('sound and language stacks include namespaces and native replacement/removal order',async()=>{
 const locale=version==='1.8.9'?'en_US':'en_us',legacy=['1.8.9','1.12.2'].includes(version),ext=legacy?'lang':'json',language=value=>legacy?Object.entries(value).map(([k,v])=>k+'='+v).join('\n'):JSON.stringify(value),path='assets/custom/lang/'+locale+'.'+ext;
 const low=pack('low',{'assets/custom/sounds.json':'{"event":{"sounds":["low"]}}',[path]:language({custom:'low',baseOnly:'yes'})}),high=pack('high',{'assets/custom/sounds.json':'{"event":{"sounds":["high"]}}',[path]:language({custom:'high'})}),a=assets([high,low],{'minecraft/sounds.json':'{"base":{"sounds":["base"]}}',['minecraft/lang/'+locale+'.'+ext]:language({vanilla:'base'})});a.languages={[locale]:{name:'English'}};a.loadVillagerHats=async()=>{};
 assert.deepEqual((await a.loadSoundDefinitions())['custom:event'].sounds,['low','high']);await a.loadLanguage(locale);assert.equal(a.lang.custom,'high');assert.equal(a.lang.baseOnly,'yes');assert.equal(a.lang.vanilla,'base');
 if(hasFilters){a.packs.unshift(pack('block',{}, {filter:{block:[{namespace:'custom',path:'(sounds|lang/)'}]}}));assert.equal((await a.loadSoundDefinitions())['custom:event'],undefined);await a.loadLanguage(locale);assert.equal(a.lang.custom,undefined);}
});
test('higher model/texture resources replace lower definitions with correct metadata provenance',()=>{
 const p=pack('texture',{'assets/minecraft/models/block/test.json':'{"textures":{"all":"block/test"}}','assets/minecraft/textures/block/test.png':'new'}),a=assets([p]),models={test:{textures:{all:'block/test'}}},states={},files=new Map([['block/test',()=>encode('base')]]),mcmeta={'block/test':{animation:{}}};applyPackModels([p],models,states,a);applyPackTextures([p],files,mcmeta,models,a);assert.equal(decode(files.get('block/test')()),'new');assert.equal(mcmeta['block/test'],undefined);
 if(hasFilters){const mask=pack('mask',{}, {filter:{block:[{namespace:'minecraft',path:'(models|textures)/'}]}});a.packs.unshift(mask);applyPackModels([p,mask],models,states,a);applyPackTextures([p,mask],files,mcmeta,models,a);assert.equal(models['block/test'],undefined);assert.equal(files.has('block/test'),false);}
});
if(hasOverlays)test('texture metadata can come from above the texture owner, never below it',async()=>{
 const base={'minecraft/textures/test.png.mcmeta':'base'},high=pack('high',{'assets/minecraft/textures/test.png':'new'}),a=assets([high],base);assert.equal((await a.resourceMetadata('minecraft:textures/test.png')).bytes,null);a.packs.unshift(pack('meta',{'assets/minecraft/textures/test.png.mcmeta':'higher'}));assert.equal(decode((await a.resourceMetadata('minecraft:textures/test.png')).bytes),'higher');
});

if(!['1.8.9','1.12.2'].includes(version))test('font definitions and referenced resources share the layered resource stack',async()=>{
 const {loadFontSets}=await import('../client/js/gui/font-providers.js'),png=encodePng(2,1,Uint8Array.from([255,255,255,255,255,255,255,255]));
 const low=pack('font-low',{'assets/minecraft/font/default.json':'{"providers":[{"type":"bitmap","file":"custom:font/low.png","height":4,"ascent":3,"chars":["AB"]}]}','assets/custom/textures/font/low.png':png}),high=pack('font-high',{'assets/minecraft/font/default.json':'{"providers":[{"type":"bitmap","file":"custom:font/high.png","height":8,"ascent":7,"chars":["A "]}]}','assets/custom/textures/font/high.png':png},hasFilters?{filter:{block:[{namespace:'minecraft',path:'font/default.json'}]}}:{}),a=assets([high,low]);a.textures=new Map();const sets=await loadFontSets(a);assert.equal(sets.default.glyph('A').advance,9);assert.equal(sets.default.glyph('B').advance,hasFilters?6:5);
});
