import mcassets from '../lib/mcassets.js';
import {initBlocks} from '../client/js/world/blocks.js';
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {finalShaderSource,ShaderPackFinal} from '../client/js/render/shader-pack.js';
const bytes=readFileSync(new URL('fixtures/shader-pack-final-test.zip',import.meta.url));
test('final-stage loader expands pack-root includes and adapts desktop GLSL 120 sampling',()=>{
 const source=finalShaderSource(bytes,0);assert.ok(source.startsWith('#version 300 es'));assert.match(source,/in vec2 texCoord/);assert.match(source,/mcjsFinalColor=mcjsTextureLod/);assert.doesNotMatch(source,/#include|#version 120/);
 assert.throws(()=>finalShaderSource(bytes,-1),/escapes shaders folder/);assert.throws(()=>finalShaderSource(bytes,1),/Cyclic shader include/);
});
test('failed shader compilation leaves the currently loaded pack and resources intact',()=>{
 let destroyed=0;const device={createFinalShaderPass:()=>({destroy:()=>destroyed++})},g={device,dimension:0};const pack=new ShaderPackFinal(g);pack.load('working.zip',bytes);device.createFinalShaderPass=()=>{throw Error('compile failed');};assert.throws(()=>pack.load('bad.zip',bytes),/compile failed/);assert.equal(pack.name,'working.zip');assert.equal(pack.active,true);assert.equal(destroyed,0);pack.clear();assert.equal(destroyed,1);assert.equal(pack.active,false);
});

test('shader settings and vegetation lookup use this client version and real block states',()=>{
 const version={'1.15.2':11502,'1.14.4':11404,'1.13.2':11302,'1.12.2':11202,'1.8.9':10809}[mcassets.MC_VERSION];assert.ok(finalShaderSource(bytes).includes('#define MC_VERSION '+version+'\n'));
 const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url))),blocks=read('blocks');initBlocks(blocks,read('blockCollisionShapes'));let lookup;
 const device={createFinalShaderPass:()=>({destroy(){}}),createTerrainAnimation:(source,table)=>{lookup=table;return{destroy(){}};}},pack=new ShaderPackFinal({device,dimension:0,assets:{data:{blocks}}});pack.load('fixture.zip',bytes);assert.ok(pack.waving,pack.wavingError);
 const flattened=version>=11300,grass=blocks.find(b=>b.name===(flattened?'grass':'tallgrass')),ground=blocks.find(b=>b.name===(flattened?'grass_block':'grass')),state=b=>flattened?b.defaultState:b.id<<4,id=b=>lookup.data[state(b)*4]+lookup.data[state(b)*4+1]*256;assert.equal(id(grass),10000);assert.equal(id(ground),0);pack.clear();
});
