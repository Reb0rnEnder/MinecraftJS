// P02: reproducible table manifest for the 26.3 client data.
//
// This does not replace the individual generators. It pins the exact committed files, the
// native jar/report inputs they were derived from, and the command that verifies each table.
// --check fails on a modified table, a stale native input, or any table from another version.
//
// Usage: node tools/port-26.3/table-manifest.mjs [--check]
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {ZipFile} from '../../lib/zip.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const manifestPath=join(root,'docs/transition-26.3.table-manifest.json');
const target=JSON.parse(readFileSync(join(root,'tools/port-26.3/target.json'),'utf8'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

// Every committed table/list that the 26.3 client consumes. `verify` is the reproducible
// command that regenerates and compares it. Effects come from MobEffects bytecode plus the
// native registry report; they have no generator yet, so the manifest pins their bytes and
// test:26.3 asserts the native ids/names in the item gate.
const tables=[
  ['client/data/blocks.json','block table','node tools/port-26.3/build-blocks.mjs'],
  ['client/data/blockCollisionShapes.json','collision shapes','node tools/port-26.3/build-runtime.mjs --check'],
  ['client/data/biomes.json','biomes','node tools/port-26.3/build-biomes.mjs --check'],
  ['client/data/enchantments.json','enchantments','node tools/port-26.3/build-enchantments.mjs --check'],
  ['client/data/foods.json','foods','node tools/port-26.3/build-foods.mjs --check'],
  ['client/data/items.json','items','node tools/port-26.3/build-recipes.mjs --check'],
  ['client/data/recipes.json','recipes','node tools/port-26.3/build-recipes.mjs --check'],
  ['client/data/effects.json','mob effects','native MobEffects bytecode + registries report (see components/items gates)'],
  ['client/data/sounds.json','sound events','node tools/port-26.3/registry-tables.mjs --check'],
  ['client/data/particles.json','particle types','node tools/port-26.3/registry-tables.mjs --check'],
  ['client/data/entities.json','entity display table','node tools/port-26.3/entity-registry.mjs --check'],
  ['client/js/net/item-defaults-26.3.js','item defaults','node tools/port-26.3/build-item-defaults.mjs --check'],
  ['client/js/net/enchantment-names-26.3.js','enchantment names','node tools/port-26.3/build-enchantments.mjs --check'],
  ['client/js/net/items-26.3.js','item names','node tools/port-26.3/build-items.mjs'],
  ['client/js/net/blocks-26.3.js','block names','node tools/port-26.3/build-blocks.mjs'],
  ['client/js/game/entity-registry-26.3.js','entity registry','node tools/port-26.3/entity-registry.mjs --check'],
  ['client/js/game/entity-metadata-26.3.js','entity metadata','node tools/port-26.3/entity-metadata.mjs --check'],
  ['client/js/net/entity-data-26.3.js','entity data serializers','node tools/port-26.3/entity-data.mjs --check'],
  ['client/js/render/animations-26.3.js','keyframe animations','node tools/port-26.3/extract-keyframe-animations.mjs'],
  ['client/js/game/block-tags-26.3.js','block tags','node tools/port-26.3/build-block-tags.mjs --check'],
  ['client/js/game/block-tools-26.3.js','block tools','node tools/port-26.3/build-block-tools.mjs --check'],
  ['client/js/game/stat-registry-26.3.js','stat registry','node tools/port-26.3/stats-oracle.mjs --check'],
  ['tools/port-26.3/fixtures/data-component-codecs-26.3.json','component codec manifest','node tools/port-26.3/component-codecs.mjs --check'],
  ['tools/port-26.3/fixtures/data-particle-codecs-26.3.json','particle codec manifest','node tools/port-26.3/particle-codecs.mjs --check'],
  ['tools/port-26.3/fixtures/entity-metadata-26.3.json','entity metadata fixture','node tools/port-26.3/entity-metadata.mjs --check'],
  ['tools/port-26.3/fixtures/components-26.3.json','component oracle fixture','node tools/port-26.3/components-oracle.mjs'],
  ['tools/port-26.3/fixtures/advancements-26.3.json','advancement oracle','node tools/port-26.3/advancements-oracle.mjs --check'],
  ['tools/port-26.3/fixtures/explode-26.3.json','explosion oracle','node tools/port-26.3/explode-oracle.mjs --check'],
  ['tools/port-26.3/fixtures/stats-26.3.json','stat oracle','node tools/port-26.3/stats-oracle.mjs --check'],
  ['docs/transition-26.3.release-index.json','release source index','node tools/port-26.3/release-crosswalk.mjs --check'],
  ['docs/transition-26.3.crosswalk.json','release topic crosswalk','node tools/port-26.3/release-crosswalk.mjs --check']
];

function bytesOf(path){
  assert.ok(existsSync(join(root,path)),path+' is missing');
  return readFileSync(join(root,path));
}
function nativeIdentity(){
  assert.ok(existsSync(join(cache,'verified-inputs.json')),'native inputs are not prepared');
  const verified=JSON.parse(readFileSync(join(cache,'verified-inputs.json'),'utf8'));
  assert.equal(verified.minecraftVersion,target.minecraftVersion,'verified inputs are another Minecraft version');
  assert.equal(verified.hashes.client,target.downloads.client.sha1,'client jar is not the pinned 26.3 object');
  assert.equal(verified.hashes.server,target.downloads.server.sha1,'server jar is not the pinned 26.3 object');
  const version=JSON.parse(verified.nativeVersion?JSON.stringify(verified.nativeVersion):'{}');
  assert.equal(version.id,target.minecraftVersion,'native version.json id is another version');
  assert.equal(version.protocol_version,target.protocol,'native protocol is not 777');
  assert.equal(version.world_version,target.dataVersion,'native world version is not 5023');
  return {
    clientSha1:verified.hashes.client,
    serverSha1:verified.hashes.server,
    metadataSha1:verified.hashes.metadata,
    assetIndexSha1:target.assetIndex.sha1,
    version:{id:version.id,protocol:version.protocol_version,worldVersion:version.world_version,resourcePackFormat:target.resourcePackFormat,dataPackFormat:target.dataPackFormat}
  };
}
function reportHashes(){
  const reports=join(cache,'generated/reports');
  const out={};
  for(const name of ['blocks','registries','packets','commands']){
    const path=join(reports,name+'.json');
    if(!existsSync(path))continue;
    out[name]={bytes:readFileSync(path).length,sha256:sha256(readFileSync(path))};
  }
  assert.ok(out.blocks&&out.registries,'native reports are missing; run npm run reports:26.3');
  return out;
}

const native=nativeIdentity();
const rows=tables.map(([path,label,verify])=>({path,label,verify,bytes:bytesOf(path).length,sha256:sha256(bytesOf(path))}));
// Reject mixed-version tables with content probes, not just filenames.
const items=JSON.parse(readFileSync(join(root,'client/data/items.json'),'utf8'));
for(const name of ['sulfur','poplar_planks','white_cushion','iron_nautilus_armor','straw_bed'])assert.ok(items.some(item=>item.name===name),'26.3 item table is missing '+name);
const blocks=JSON.parse(readFileSync(join(root,'client/data/blocks.json'),'utf8'));
for(const name of ['poplar_log','sulfur','creaking_heart'])assert.ok(blocks.some(block=>block.name===name),'26.3 block table is missing '+name);
const biomes=JSON.parse(readFileSync(join(root,'client/data/biomes.json'),'utf8'));
for(const name of ['dappled_forest','pale_garden','sulfur_caves'])assert.ok(biomes.some(biome=>biome.name===name),'26.3 biome table is missing '+name);

const manifest={
  schemaVersion:1,
  target:target.minecraftVersion,
  protocol:target.protocol,
  dataVersion:target.dataVersion,
  recordedOn:'2026-11-27',
  native,
  nativeReports:reportHashes(),
  counts:{tables:rows.length,bytes:rows.reduce((sum,row)=>sum+row.bytes,0)},
  tables:rows
};
if(process.argv.includes('--check')){
  assert.deepEqual(JSON.parse(readFileSync(manifestPath,'utf8')),manifest,'table manifest needs regeneration (run node tools/port-26.3/table-manifest.mjs)');
  console.log('Verified '+rows.length+' native 26.3 tables / '+manifest.counts.bytes+' bytes against the pinned jar and reports');
}else{
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log('Wrote '+manifestPath+' ('+rows.length+' tables, '+manifest.counts.bytes+' bytes)');
}
