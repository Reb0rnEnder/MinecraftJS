import{test}from'node:test';import assert from'node:assert/strict';import{mkdtempSync,mkdirSync,writeFileSync,rmSync}from'node:fs';import{join}from'node:path';import{tmpdir}from'node:os';import signatures from'../lib/model-bundle-signature.js';
const{modelSourceSignature,modelBundleStamp,builtModelBundleMatches}=signatures;
test('cached models require matching jar, source layout and complete bundle content',()=>{
 const root=mkdtempSync(join(tmpdir(),'minecraftjs-model-cache-'));try{
  mkdirSync(join(root,'lib'));mkdirSync(join(root,'tools/port-test'),{recursive:true});writeFileSync(join(root,'lib/modelextract.js'),'extract version A');writeFileSync(join(root,'tools/port-test/model-layers.json'),'old fields');
  const jar=Buffer.from('pinned jar'),bundle=Buffer.from('{"model":"native"}'),stamp=modelBundleStamp(jar,bundle,root);
  assert.equal(builtModelBundleMatches(stamp,jar,bundle,root),true);assert.equal(builtModelBundleMatches({},jar,bundle,root),false);assert.equal(builtModelBundleMatches(stamp,Buffer.from('different jar'),bundle,root),false);assert.equal(builtModelBundleMatches(stamp,jar,bundle.subarray(0,8),root),false);
  writeFileSync(join(root,'README.md'),'unrelated documentation');assert.equal(builtModelBundleMatches(stamp,jar,bundle,root),true);
  writeFileSync(join(root,'tools/port-test/model-layers.json'),'new root/feet/pot fields');assert.equal(builtModelBundleMatches(stamp,jar,bundle,root),false);
  const newStamp=modelBundleStamp(jar,bundle,root);writeFileSync(join(root,'lib/modelextract.js'),'extract version B');assert.equal(builtModelBundleMatches(newStamp,jar,bundle,root),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('model source signatures are deterministic for the current checkout',()=>{assert.match(modelSourceSignature(),/^[a-f0-9]{64}$/);assert.equal(modelSourceSignature(),modelSourceSignature());});
