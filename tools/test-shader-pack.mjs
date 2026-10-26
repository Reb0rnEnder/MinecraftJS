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
