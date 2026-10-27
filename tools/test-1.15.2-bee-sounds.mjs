import{test}from'node:test';import assert from'node:assert/strict';import{beeSoundParameters,tickBeeSound,stopBeeSound}from'../client/js/game/bee-sound.js';
const flush=()=>new Promise(r=>setImmediate(r));
test('native bee sound follows horizontal speed and age, with silent stationary flight',()=>{
 assert.deepEqual(beeSoundParameters({motionY:1}),{volume:0,pitch:0});const adult=beeSoundParameters({motionX:.2}),baby=beeSoundParameters({motionX:.2,child:true});assert.ok(Math.abs(adult.volume-.24)<1e-6);assert.ok(Math.abs(adult.pitch-.98)<1e-6);assert.ok(baby.pitch>adult.pitch);assert.ok(Math.abs(beeSoundParameters({motionX:2}).volume-.6)<1e-6);
});
test('bee anger switches loop, silent metadata stops it, and destruction cancels a pending decode',async()=>{
 const calls=[],voices=[],e={id:1,x:1,y:65,z:1,motionX:.2},manager={map:new Map([[1,e]]),game:{sound:{async playLoop(name){calls.push(name);const h={stopped:false,stop(){this.stopped=true;},setVolume(v){this.volume=v;},setPitch(v){this.pitch=v;},setPosition(p){this.pos=p;}};voices.push(h);return h;}}}};
 tickBeeSound(manager,e);await flush();assert.ok(voices[0].volume>0);assert.deepEqual(voices[0].pos,[1,65,1]);
 e.angry=true;tickBeeSound(manager,e);await flush();assert.equal(voices[0].stopped,true);assert.deepEqual(calls,['entity.bee.loop','entity.bee.loop_aggressive']);
 e.silent=true;tickBeeSound(manager,e);assert.equal(voices[1].stopped,true);
 e.silent=false;tickBeeSound(manager,e);stopBeeSound(e);manager.map.delete(e.id);await flush();assert.equal(voices[2].stopped,true);
});
