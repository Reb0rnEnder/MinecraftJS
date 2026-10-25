import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {cache,target,verify} from './port-1.14.4/prepare.mjs';
import {summarize} from './port-1.14.4/reports.mjs';
import {AIR_STATES_498,BLOCK_STATE_COUNT_498} from '../client/js/world/chunk-1.14.4.js';
const baseline=JSON.parse(readFileSync(new URL('./port-1.14.4/baseline.json',import.meta.url)));

test('source pins identify native 1.14.4 and protocol 498 and match the committed baseline',()=>{
  assert.equal(target.minecraftVersion,'1.14.4');assert.equal(target.protocol,498);
  assert.equal(target.minecraftData.revision.length,40);
  for(const source of [target.metadata,...Object.values(target.downloads),...Object.values(target.minecraftData.inputs)]) {
    assert.match(source.sha1,/^[a-f0-9]{40}$/);assert.match(source.url,/^https:\/\//);
  }
  assert.equal(baseline.sources.server,target.downloads.server.sha1);
  assert.equal(baseline.sources.client,target.downloads.client.sha1);
  assert.equal(baseline.sources.minecraftDataRevision,target.minecraftData.revision);
});

test('input verification rejects altered or incomplete source bytes',()=>{
  const hash='a9993e364706816aba3e25717850c26c9cd0d89d';
  assert.equal(verify(Buffer.from('abc'),hash,'fixture'),hash);
  assert.throws(()=>verify(Buffer.from('abd'),hash,'fixture'),/fixture: SHA-1 mismatch/);
  assert.throws(()=>verify(Buffer.from('ab'),hash,'fixture'),/SHA-1 mismatch/);
});

const prepared=existsSync(join(cache,'generated/reports/blocks.json'));
test('vanilla reports reproduce the pinned state and registry baseline', {skip:!prepared},()=>{
  const json=p=>JSON.parse(readFileSync(join(cache,p)));
  const generated=name=>json('generated/reports/'+name+'.json');
  const result=summarize(generated('blocks'),generated('registries'),generated('commands'),Object.fromEntries(Object.entries(baseline.sources).filter(([key])=>key!=='minecraftDataRevision')),json('protocol-1.13.2.json'),json('protocol-1.14.4.json'));
  assert.deepEqual(result,baseline);
  const blocks=generated('blocks'),registries=generated('registries');
  assert.equal(BLOCK_STATE_COUNT_498,result.blockStates);
  assert.deepEqual([...AIR_STATES_498].sort((a,b)=>a-b),['minecraft:air','minecraft:void_air','minecraft:cave_air'].flatMap(name=>blocks[name].states.map(s=>s.id)).sort((a,b)=>a-b));
  for(const name of ['minecraft:scaffolding','minecraft:bell','minecraft:campfire','minecraft:stonecutter'])assert.ok(blocks[name]?.states.length,name);
  for(const name of ['minecraft:fox','minecraft:panda','minecraft:pillager','minecraft:ravager'])assert.ok(registries['minecraft:entity_type'].entries[name],name);
  assert.ok(registries['minecraft:item'].entries['minecraft:crossbow']);
});

test('native report validation catches duplicate states and missing default states',()=>{
  const before={types:{},play:{toClient:{types:{packet:['container',[{type:['mapper',{mappings:{}}]}]]}},toServer:{types:{packet:['container',[{type:['mapper',{mappings:{}}]}]]}}}};
  assert.throws(()=>summarize({air:{states:[{id:0}]}},{},{},{},before,before),/one default state/);
  assert.throws(()=>summarize({air:{states:[{id:0,default:true}]},stone:{states:[{id:0,default:true}]}},{},{},{},before,before),/unique and contiguous/);
});
