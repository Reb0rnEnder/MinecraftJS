import {test} from 'node:test';import assert from 'node:assert/strict';
import {selectGLSLFunctions,glslFloatLiterals,shaderBlockRules,animationLookup} from '../client/js/render/glsl-functions.js';
test('small GLSL selector retains called functions/constants and ignores braces in comments',()=>{
 const source='const float pi=3.14; float unused(){return 2.0;} float noise(float x){/* } */return sin(x*pi);} vec3 wind(vec3 p){ // {\n return vec3(noise(p.x));}';const selected=selectGLSLFunctions(source,'wind');assert.deepEqual(selected.functions,['wind','noise']);assert.match(selected.source,/const float pi/);assert.doesNotMatch(selected.source,/unused/);assert.throws(()=>selectGLSLFunctions(source,'missing'),/Missing GLSL entry/);assert.throws(()=>selectGLSLFunctions('float f(){','f'),/Unbalanced/);
});
test('numeric bridge adapts mixed float math without corrupting decimals or integer loops',()=>{
 const source='const float pi=3.14; float f(float x){for(int i=0;i<2;i++){x=x+1;}return 2*pi+pi*3+2.0*pi+0.25*x;}';const result=glslFloatLiterals(source);assert.match(result,/2\.0 \* pi/);assert.match(result,/pi \* 3\.0/);assert.ok(result.includes('2.0*pi'));assert.ok(result.includes('0.25*x'));assert.ok(result.includes('int i=0;i<2;i++'));assert.doesNotMatch(result,/\d+\.\d+\.\d+/);
});
test('shader block mappings select version branches and state properties without moving ground grass',()=>{
 const source='#if MC_VERSION >= 11300\nblock.10000=minecraft:grass \\\nminecraft:fern\nblock.10200=minecraft:tall_grass:half=lower\nblock.10300=minecraft:tall_grass:half=upper\n#elif MC_VERSION >= 10800\nblock.10000=minecraft:tallgrass\n#else\nblock.10000=31\n#endif';const rules=shaderBlockRules(source,11404),old=shaderBlockRules(source,11202);assert.equal(old[0].name,'tallgrass');assert.equal(rules[0].name,'grass');const states=[{id:0,name:'grass_block',properties:{}},{id:1,name:'grass',properties:{}},{id:2,name:'tall_grass',properties:{half:'upper'}}],lookup=animationLookup(rules,states),id=i=>lookup.data[i*4]+lookup.data[i*4+1]*256;assert.equal(id(0),0);assert.equal(id(1),10000);assert.equal(id(2),10300);assert.equal(lookup.width,256);assert.equal(lookup.height,1);
});
