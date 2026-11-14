import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePlayPacket766,decodePlayBody766} from '../client/js/net/play-codec-1.20.6.js';
import {Reader766,Writer766} from '../client/js/net/configuration-1.20.6.js';
import {PLAY_SCHEMA_766} from '../client/js/net/play-schema-1.20.6.js';
import {PLAY_SERVERBOUND_766} from '../client/js/net/protocol-1.20.6-ids.js';
import {KNOWN_PACK_766} from '../client/js/net/known-pack-1.20.6.js';
import {builderSamples} from './port-1.20.6/packet-builder-samples.mjs';
import {Game} from '../client/js/game/game.js';
import {ChunkBatchCalculator} from '../client/js/net/chunk-batch.js';
import {VanillaSocket766} from '../client/js/net/tcp-1.20.6.js';
import {setPlatform} from '../client/js/platform/platform.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const corpus=json('./fixtures/play-packets-1.20.6.json'),inventory=json('../docs/packet-coverage-1.20.6.json');
const context={features:['minecraft:vanilla'],registries:new Map(Object.entries(KNOWN_PACK_766.registries).map(([k,v])=>[k,v.map((e,id)=>({...e,id}))]))};
const bytes=s=>Buffer.from(s.wire,'base64');
const decode=s=>decodePlayPacket766(bytes(s),context);

test('every incoming Play ID consumes native Java canonical fixtures, including reachable branches',()=>{
 assert.equal(corpus.clientJarSha1,'05b6f1c6b46a29d6ea82b4e0d42190e42402030f');
 const incoming=corpus.samples.filter(s=>s.direction==='CLIENTBOUND');
 assert.deepEqual(new Set(incoming.map(s=>s.name)),new Set(PLAY_SCHEMA_766.packets));
 for(const s of incoming)assert.equal(decode(s).name,s.normalizedName,s.label);
 assert.equal(inventory.clientbound.length,122);
 for(const p of inventory.clientbound)if(p.kind!=='transport')assert.equal(typeof Game.prototype['on_'+p.normalizedName],'function',p.name);
});

test('actual runtime senders for all 58 outgoing IDs equal native decode/re-encode bytes',()=>{
 const actual=builderSamples(),native=new Map(corpus.samples.map(s=>[s.label,s]));
 assert.equal(inventory.serverbound.length,58);
 assert.deepEqual(new Set(actual.map(s=>s.name)),new Set(Object.keys(PLAY_SERVERBOUND_766)));
 for(const s of actual)assert.equal(s.wire,native.get(s.label)?.wire,s.label);
});

test('all advancement flags and all player-info action masks preserve semantic fields',()=>{
 for(let mask=0;mask<8;mask++){
  const p=decode(corpus.samples.find(s=>s.label==='CLIENTBOUND:advancements:flags-'+mask)),display=p.added[0].display;
  assert.equal(display.hidden,!!(mask&4));assert.equal(display.showToast,!!(mask&2));
  assert.equal(display.background,mask&1?'minecraft:fixture':undefined);
 }
 for(let mask=0;mask<64;mask++){
  const p=decode(corpus.samples.find(s=>s.label==='CLIENTBOUND:player_info:actions-'+mask));
  assert.equal(p.actions,mask);assert.equal(p.data[0].name,mask&1?'Fixture':undefined);
  assert.equal(p.data[0].listed,mask&8?true:undefined);
 }
});

test('fixed-length signed chat buffers leave message body and following fields intact',()=>{
 const p=decode(corpus.samples.find(s=>s.label==='CLIENTBOUND:player_chat:dense'));
 assert.equal(p.signature.length,256);assert.equal(p.plainMessage,'minecraft:fixture');assert.equal(p.timestamp,23n);assert.equal(p.salt,23n);
 assert.ok(p.networkName.includes('Packet fixture'));
});

test('native registry-only wolf/painting variants keep ID zero, and GlobalPos includes signed coordinates',()=>{
 for(const type of [23,26])for(const id of [0,1,2]){
  const w=new Writer766().varint(7).u8(12).varint(type).varint(id).u8(255);
  assert.equal(decodePlayBody766('entity_metadata',w.build()).metadata[12],id);
 }
 const w=new Writer766().varint(7).u8(12).varint(25).bool(true).string('minecraft:the_nether').position(-123,-63,4321).u8(255);
 assert.deepEqual(decodePlayBody766('entity_metadata',w.build()).metadata[12],{dimension:'minecraft:the_nether',position:{x:-123,y:-63,z:4321}});
});

test('food and inline instrument patches use the exact 766 layout without later fields',()=>{
 for(const [label,check]of [
  ['custom_food',s=>{const f=s.componentPatch.added.find(c=>c.type==='food').data;assert.equal(f.effects.length,1);assert.equal(f.effects[0].effect.details.duration,80);assert.equal(f.secondsToEat,0.75);assert.ok(!Object.hasOwn(f,'usingConvertsTo'));}],
  ['inline_horn',s=>{const i=s.componentPatch.added.find(c=>c.type==='instrument').data.data;assert.equal(i.useDuration,17);assert.equal(i.range,64);assert.ok(!Object.hasOwn(i,'description'));}]
 ]){
  const fixture=corpus.samples.find(s=>s.label.startsWith('BUILDER:set_creative_slot:C.creativeSlot.'+label+':')),r=new Reader766(bytes(fixture));
  assert.equal(r.varint(),PLAY_SERVERBOUND_766.set_creative_slot);assert.equal(r.i16(),36);check(r.slot());assert.equal(r.remaining(),0);
 }
});

test('chunk-batch feedback uses the native clamped, capped weighted average rather than batch count',()=>{
 let t=0;const calc=new ChunkBatchCalculator(()=>t);
 assert.equal(calc.finish(0),3.5);calc.start();t=40;
 assert.equal(calc.finish(10),Math.fround(7/3));
 calc.start();assert.equal(calc.finish(10),3); // clamped from 0 to average/3=1; average becomes 7/3.
 for(let i=0;i<100;i++){calc.start();t+=10;calc.finish(1);}assert.equal(calc.weight,49);
 let time=0;setPlatform({now:()=>time});const sent=[],g=Object.assign(Object.create(Game.prototype),{send:p=>sent.push(p)});
 g.on_chunk_batch_start();time=40;g.on_chunk_batch_finished({batchSize:10});
 const r=new Reader766(sent[0]);assert.equal(r.varint(),PLAY_SERVERBOUND_766.chunk_batch_received);assert.equal(r.f32(),Math.fround(7/3));assert.equal(r.remaining(),0);
});

test('standalone transport uses the same batch calculator and graphical transport avoids duplicate acknowledgements',()=>{
 for(const autoPlayAcks of [true,false]){
  const s=new VanillaSocket766({}, {autoPlayAcks}),sent=[];let starts=0,finishes=0;
  s.state='play';s._send=p=>sent.push(p);s.chunkBatch={start(){starts++},finish(n){assert.equal(n,17);finishes++;return 2.75}};
  s._packet(new Writer766().varint(PLAY_SCHEMA_766.ids.chunk_batch_start).build());
  s._packet(new Writer766().varint(PLAY_SCHEMA_766.ids.chunk_batch_finished).varint(17).build());
  assert.equal(starts,Number(autoPlayAcks));assert.equal(finishes,Number(autoPlayAcks));assert.equal(sent.length,Number(autoPlayAcks));
  if(autoPlayAcks){const r=new Reader766(sent[0]);r.varint();assert.equal(r.f32(),2.75);}
 }
});

test('projectile power ignores non-hurting projectiles, and diagnostic samples remain bounded',()=>{
 const e={entityName:'small_fireball'},other={entityName:'arrow'},wind={entityName:'wind_charge'},map=new Map([[7,e],[8,other],[10,wind]]),g=Object.assign(Object.create(Game.prototype),{entities:{get:id=>map.get(id)}});
 for(const id of [7,8,9,10])g.on_set_projectile_power({id,power:{x:0.125,y:-0.25,z:0.5}});
 assert.equal(e.accelY,-0.25);assert.equal(wind.accelX,0.125);assert.equal(other.accelX,undefined);
 let now=1000;setPlatform({now:()=>now});for(let i=0;i<250;i++){g.on_ping_response({id:900n});g.on_debug_sample({type:0,sample:[123n,23n]});}
 assert.equal(g.pingSamples.length,240);assert.equal(g.pingSamples[0],100);assert.equal(g.serverTickSamples.length,240);
 const sample=[44n];g.on_debug_sample({type:0,sample});sample[0]=0n;assert.deepEqual(g.serverTickSamples.at(-1),[44n]);
});
