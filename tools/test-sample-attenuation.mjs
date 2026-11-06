import{test}from'node:test';import assert from'node:assert/strict';import mcassets from'../lib/mcassets.js';
import{SoundManager}from'../client/js/audio/sound.js';import{sampleAttenuation}from'../client/js/audio/sample-attenuation.js';
const v=mcassets.MC_VERSION,legacy=v==='1.8.9',custom=!['1.8.9','1.12.2'].includes(v);
function fixture(){const calls=[],s=Object.assign(Object.create(SoundManager.prototype),{game:{settings:{masterVolume:1,soundVolumes:{}}},defs:{test:{sounds:[{name:'test/a',volume:.5,pitch:1,attenuation_distance:24}]}},audio:{play:(b,o)=>{calls.push(o);return{};}},_buffer:async()=>({}),_subtitle(){},playing:new Set(),generation:0});return{s,calls};}
test('sound attenuation preserves sample-volume and distance release boundaries',()=>{
 assert.equal(sampleAttenuation(4,{volume:.5,attenuationDistance:24}),legacy?64:custom?48:32);assert.equal(sampleAttenuation(.2,{volume:.5,attenuationDistance:24}),custom?24:16);
});
test('one-shot sound uses the chosen sample distance and ignores packet fixed range like Java',async()=>{
 const{s,calls}=fixture();await s.play('test',0,64,0,4,1,{category:'block',range:2});assert.equal(calls[0].maxDistance,legacy?64:custom?48:32);assert.equal(calls[0].volume,1);
});
test('event references retain leaf attenuation and looping voices use sample distance',async()=>{
 const{s,calls}=fixture();s.defs.alias={sounds:[{name:'test',type:'event',attenuation_distance:3,volume:2}]};const chosen=s._pick('alias');assert.equal(chosen.volume,1);assert.equal(chosen.attenuationDistance,custom?24:undefined);await s.playLoop('alias',0,64,0,{category:'block'});assert.equal(calls[0].maxDistance,custom?24:16);
});
