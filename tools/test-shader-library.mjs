import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{ShaderLibrary}from'../client/js/render/shader-library.js';import{ShaderPackFinal}from'../client/js/render/shader-pack.js';import{setPlatform}from'../client/js/platform/platform.js';
const bytes=readFileSync(new URL('fixtures/shader-pack-final-test.zip',import.meta.url));
function fixture(){const settings=new Map(),files=new Map();setPlatform({loadSetting:k=>settings.get(k),saveSetting:(k,v)=>settings.set(k,v),files:{get:async k=>files.get(k),put:async(k,v)=>files.set(k,v),delete:async k=>files.delete(k)}});const make=()=>new ShaderLibrary(new ShaderPackFinal({device:{createFinalShaderPass:()=>({destroy(){}})}}));return{settings,files,make};}
test('multiple shader ZIPs survive restart, switch independently, and removing one preserves the other',async()=>{
 const{make,files}=fixture(),library=make();const a=await library.add('First.zip',bytes),b=await library.add('Second.zip',bytes);assert.equal(library.entries.length,2);assert.equal(library.pack.name,'Second.zip');
 const restored=make();await restored.load();assert.equal(restored.entries.length,2);assert.equal(restored.pack.name,'Second.zip');await restored.select(a.id);assert.equal(restored.pack.name,'First.zip');
 await restored.remove();assert.equal(files.has(a.id),false);assert.equal(files.has(b.id),true);assert.equal(restored.entries.length,1);await restored.select(b.id);assert.equal(restored.pack.name,'Second.zip');
 await restored.select(null);const off=make();await off.load();assert.equal(off.enabled,false);assert.equal(off.entries.length,1);await off.select(b.id);assert.equal(off.pack.enabled,true);
});
test('the previous single-pack save migrates without deleting its ZIP or duplicating on each startup',async()=>{
 const{make,files,settings}=fixture();files.set('shaderpacks/final-stage',bytes);settings.set('shaderpacks/final-stage.meta',JSON.stringify({name:'Existing.zip',enabled:true,options:{}}));
 const library=make();await library.load();assert.equal(library.pack.name,'Existing.zip');assert.equal(library.entries.length,1);assert.equal(files.has('shaderpacks/final-stage'),true);
 const again=make();await again.load();assert.equal(again.entries.length,1);assert.equal(again.selected,library.selected);
});
