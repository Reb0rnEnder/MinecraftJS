// Decodes committed native 26.3 chunk frames and checks every section against the jar's own
// block registry: nonEmptyBlockCount must match the number of non-air states we unpack.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Reader} from '../../client/js/net/buffer.js';
import {decodeLevelChunkWithLight} from '../../client/js/net/chunk-26.3.js';
import {root} from './prepare.mjs';

const fixture=JSON.parse(await readFile(join(root,'tools/port-26.3/fixtures/chunk-26.3.json'),'utf8'));
const blocks=JSON.parse(await readFile(join(root,'cache/port-26.3/generated/reports/blocks.json'),'utf8'));
const baseline=JSON.parse(await readFile(join(root,'tools/port-26.3/baseline.json'),'utf8'));

const air=new Set();
for(const name of ['minecraft:air','minecraft:cave_air','minecraft:void_air']){
  for(const state of blocks[name].states)air.add(state.id);
}
assert.ok(air.has(0),'air is native state 0');

const stateCount=Object.values(blocks).reduce((sum,block)=>sum+block.states.length,0);
assert.equal(stateCount,baseline.blockStates,'block registry agrees with the recorded baseline');

let totalSections=0,totalBlocks=0;
for(const frame of fixture.frames){
  const reader=new Reader(Buffer.from(frame.hex,'hex'));
  assert.equal(reader.varint(),46,'frame is level_chunk_with_light');
  const chunk=decodeLevelChunkWithLight(reader);
  assert.equal(reader.remaining(),0,'chunk frame must be consumed exactly');
  assert.equal(chunk.sections.length,24,'26.3 overworld chunk carries 24 sections');

  for(const section of chunk.sections){
    assert.ok(section.blockBits<=15,'block bits within the native storage range');
    const nonAir=section.stateIds.reduce((n,id)=>n+(air.has(id)?0:1),0);
    assert.equal(nonAir,section.nonEmptyBlockCount,'section '+section.index+' nonEmptyBlockCount matches unpacked states');
    assert.ok(section.fluidCount>=0&&section.fluidCount<=4096,'fluid count is a section-sized short');
    for(const id of section.stateIds)assert.ok(id<stateCount,'state id '+id+' exists in the native registry');
    for(const id of section.biomeIds)assert.ok(Number.isInteger(id)&&id>=0,'biome id is a registry id');
    totalSections++;totalBlocks+=nonAir;
  }

  const light=chunk.light;
  const maskBits=mask=>mask.reduce((n,byte)=>n+popcount(byte),0);
  assert.equal(maskBits(light.skyYMask),light.skyUpdates.length,'sky mask bits match sky update layers');
  assert.equal(maskBits(light.blockYMask),light.blockUpdates.length,'block mask bits match block update layers');
  for(const layer of light.skyUpdates)assert.ok(layer.length>0,'sky layer is non-empty');
}

function popcount(byte){let n=0;for(let i=0;i<8;i++)if(byte&(1<<i))n++;return n;}

assert.ok(totalBlocks>0,'chunks contain solid blocks');
console.log(JSON.stringify({chunks:fixture.frames.length,sections:totalSections,solidBlocks:totalBlocks,nativeStateCount:stateCount},null,2));
console.log('Native 26.3 chunks: '+fixture.frames.length+' frames, '+totalSections+' sections, '+totalBlocks+' solid blocks, all state ids native');
