import {test} from 'node:test';import assert from 'node:assert/strict';
import {soundGain} from '../client/js/audio/sound-gain.js';import {SoundManager} from '../client/js/audio/sound.js';
const settings={masterVolume:.5,soundVolumes:{block:.25}};
test('native gain clamps the combined instance/sample/category volume before master',()=>{
 assert.equal(soundGain(4*.5,'block',settings),.25);assert.equal(soundGain(20,'block',settings),.5);assert.equal(soundGain(-1,'block',settings),0);assert.equal(soundGain(2,'master',settings),.5);assert.equal(soundGain(.4,'unknown',settings),.2);
});
test('one-shot and looping sounds share native gain ordering',async()=>{
 const gains=[],voice={setVolume:v=>gains.push(v),stop(){}},sound=Object.assign(Object.create(SoundManager.prototype),{game:{settings},audio:{play:(_buf,options)=>{gains.push(options.volume);return voice;}},generation:0,playing:new Set(),_pick:()=>({file:'test',volume:.5,pitch:1}),_buffer:async()=>({}),_subtitle(){}});
 await sound.play('test',0,0,0,4,1,{category:'block'});assert.equal(gains.at(-1),.25);
 const loop=await sound.playLoop('test',0,0,0,{category:'block'});loop.setVolume(4);assert.equal(gains.at(-1),.25);loop.setVolume(40);assert.equal(gains.at(-1),.5);
});
