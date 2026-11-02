import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{setJarModels,wildMob}from'../client/js/render/entity-models.js';import{ANIMATIONS_762}from'../client/js/render/animations-1.19.4.js';import{animateKeyframes762}from'../client/js/render/keyframes-1.19.4.js';
setJarModels(JSON.parse(readFileSync(new URL('../client/assets/bundles/entity-models.json',import.meta.url))));
const oracle=JSON.parse(readFileSync(new URL('./fixtures/keyframes-1.19.4.json',import.meta.url))),keys=['px','py','pz','rx','ry','rz','sx','sy','sz'];
for(const family of ['frog','warden','camel','sniffer'])test(family+': JS poses match native Java KeyframeAnimations samples',()=>{
 const samples=oracle.samples.filter(s=>s.family===family);assert.ok(samples.length>=12);
 for(const sample of samples){const model=wildMob(family);model.resetPose();animateKeyframes762(model.parts,ANIMATIONS_762[family][sample.clip],sample.millis,sample.weight);for(const[bone,expected]of Object.entries(sample.parts)){const part=model.parts[bone]||(bone==='root'?model.parts.$root:null);assert.ok(part,bone);keys.forEach((key,i)=>assert.ok(Math.abs(part[key]-expected[i])<.00003,`${sample.clip} ${sample.millis} ${bone}.${key}: ${part[key]} vs Java ${expected[i]}`));}}
});
