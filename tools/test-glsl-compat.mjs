import{test}from'node:test';import assert from'node:assert/strict';
import{activeGLSL,glslCondition}from'../client/js/render/glsl-preprocessor.js';import{deferredShaderGlobals,compatibleShaderSource}from'../client/js/render/shader-compat.js';
test('conditional GLSL selects version/options with integer operator precedence and no evaluation',()=>{
 const macros=new Map([['MC_VERSION','11502'],['AA','2'],['USE_WIND','']]);assert.equal(glslCondition('defined(USE_WIND) && MC_VERSION >= 11300 && (AA + 1) * 2 == 6',macros),1);assert.equal(glslCondition('1 << 3 | 2',macros),10);assert.equal(glslCondition('UNDEFINED || 0',macros),0);
 assert.throws(()=>glslCondition('globalThis.process.exit()',macros),/Unsupported/);assert.throws(()=>glslCondition('A',new Map([['A','A']])),/Recursive/);
 const selected=activeGLSL('#define WIND\n#if MC_VERSION >= 11300\n#ifdef WIND\nfloat result=1.0;\n#endif\n#else\nfloat wrong=0.0;\n#endif',{MC_VERSION:'11502'});assert.match(selected,/float result/);assert.doesNotMatch(selected,/wrong/);
});
test('desktop globals are initialized at shader entry without moving local variables or corrupting comments',()=>{
 const source='uniform float time;\n// A comment with /* is not an opening block.\nfloat phase=time*.5;\nfloat f(float x){\nfloat local=x;\nreturn local;\n}\nvoid main(){\nfloat local=phase;\n}';const result=deferredShaderGlobals(source);assert.match(result,/float phase;/);assert.match(result,/phase = time\*\.5;/);assert.match(result,/float local=x;/);assert.match(result,/float local=phase;/);assert.match(result,/void main\(\)\{mcjsInitGlobals\(\);/);
});
test('unavailable temporal/depth stages are disabled and native target versions select the correct branch',()=>{
 const profile={disabled:['TAA'],fixed:{}};for(const version of [10809,11202,11302,11404,11502]){const source=compatibleShaderSource('#define TAA\n#ifdef TAA\nfloat temporal=1.0;\n#endif\n#if MC_VERSION >= 11300\nfloat flat=1.0;\n#else\nfloat legacy=1.0;\n#endif',profile,version);assert.doesNotMatch(source,/temporal/);assert.match(source,version>=11300?/flat/:/legacy/);}
});
