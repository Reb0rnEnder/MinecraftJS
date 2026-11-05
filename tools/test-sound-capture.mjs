import {test} from 'node:test';import assert from 'node:assert/strict';
import {captureSounds} from '../client/js/debug/capture-sounds.js';import {setPlatform} from '../client/js/platform/platform.js';
let saved;setPlatform({now:()=>100,saveFile:(name,bytes)=>saved={name,text:new TextDecoder().decode(bytes)}});
function fixture(){const sound={play(){return 42;}},g={sound,world:{getState:()=>0},assets:{translate:()=> 'MinecraftJS'},on_world_event(p){return this.sound.play('block.stone.break',1,64,2,1,.8,{category:'block'});},interaction:{destroyBlockClient(){return sound.play('block.wood.break',1,64,2,1,.8);}}};return g;}
test('sound capture distinguishes local and wire sources without changing return values',()=>{
 const g=fixture(),capture=captureSounds(g);assert.equal(g.interaction.destroyBlockClient({x:1,y:64,z:2}),42);assert.equal(g.on_world_event({effectId:2001,data:1,location:{x:1,y:64,z:2},secret:'DO NOT EXPORT'}),42);g.sound.play('unrelated');
 const plays=capture.dump().events.filter(e=>e.type==='play');assert.equal(plays[0].cause.source,'local.destroyBlockClient');assert.equal(plays[1].cause.source,'server.world_event');assert.equal(plays[1].cause.data,1);assert.equal(plays[2].cause,null);capture.download();assert.equal(saved.name,'minecraftjs-sound-capture.json');assert.ok(!saved.text.includes('DO NOT EXPORT'));capture.stop();
});
test('capture stays bounded and restores inherited and replaced handlers safely',()=>{
 const g=fixture(),play=g.sound.play,first=captureSounds(g,{limit:32}),next=captureSounds(g,{limit:32});for(let i=0;i<100;i++)g.sound.play('test');assert.equal(first.dump().events.length,0);assert.equal(next.dump().events.length,32);next.stop();assert.equal(g.sound.play,play);
 const c=captureSounds(g),replacement=()=>{};g.sound.play=replacement;c.stop();assert.equal(g.sound.play,replacement);
});
