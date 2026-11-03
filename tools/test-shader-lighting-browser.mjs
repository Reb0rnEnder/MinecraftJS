import{test}from'node:test';import assert from'node:assert/strict';import{createServer}from'node:http';import{readFile,access}from'node:fs/promises';import{resolve,sep}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(fileURLToPath(new URL('../client/',import.meta.url))),file=process.env.BSL_SHADER_PACK||fileURLToPath(new URL('../BSL_v10.1.8.zip',import.meta.url));const hasBSL=await access(file).then(()=>true,()=>false);
test('native BSL lighting is not replaced with a fabricated colour/lightmap bridge',{skip:!process.env.PLAYWRIGHT_MODULE||!hasBSL},async()=>{
 const {supportedShaderOptions,finalShaderSource}=await import('../client/js/render/shader-pack.js'),bytes=await readFile(file);assert.match(finalShaderSource(bytes),/uniform sampler2D colortex1/);const options=supportedShaderOptions(bytes).map(o=>o.name);for(const name of ['BLOCKLIGHT_R','BLOCKLIGHT_G','BLOCKLIGHT_B','LIGHT_DI','AMBIENT_DI'])assert.equal(options.includes(name),false,name);
});
