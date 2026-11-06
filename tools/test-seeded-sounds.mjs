import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{SoundManager}from'../client/js/audio/sound.js';import{Game}from'../client/js/game/game.js';import{JavaRandom}from'../client/js/util/jrandom.js';
import{decodePacket762,Writer762}from'../client/js/net/protocol-1.19.4.js';
const vectors=JSON.parse(readFileSync(new URL('./fixtures/seeded-sounds-native-1.19.4.json',import.meta.url)));
const defs={test:{sounds:[{name:'test/a',weight:3,volume:.5,attenuation_distance:24},{name:'test/b',weight:5},{name:'test/c',weight:11,pitch:1.5}]}};
for(const vector of vectors)test('native weighted selection: signed 64-bit seed '+vector.seed,()=>{
 const s=Object.assign(Object.create(SoundManager.prototype),{defs}),random=new JavaRandom(BigInt(vector.seed));assert.deepEqual(Array.from({length:8},()=> 'minecraft:'+s._pick('test',new Set(),random).file),vector.files);
});
test('both packet sound handlers carry the native seed through actual sample selection',async()=>{
 const files=[],calls=[],s=Object.assign(Object.create(SoundManager.prototype),{defs,game:{settings:{masterVolume:1,soundVolumes:{}}},audio:{play:(buffer,opts)=>{calls.push(opts);return{};}},_buffer:async file=>{files.push(file);return{};},_subtitle(){},playing:new Set(),generation:0});
 const g={sound:s,assets:{soundNames:['test']},entityId:5,player:{x:2,y:64,z:3},entities:{get:()=>null}};
 const point=decodePacket762(new Writer762().varint(98).varint(1).varint(4).i32(16).i32(512).i32(24).f32(1).f32(1).i64(0n).build());
 assert.equal(point.name,'sound_effect');Game.prototype.on_sound_effect.call(g,point);
 Game.prototype.on_entity_sound_effect.call(g,{entityId:5,soundId:0,volume:1,pitch:1,soundCategory:7,seed:0n});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(files,['test/b','test/b']);assert.deepEqual(calls.map(c=>c.pos),[[2,64,3],[2,64,3]]);
});
test('sound playback uses a new native RNG for each seed and keeps nested event leaf metadata',async()=>{
 const files=[],s=Object.assign(Object.create(SoundManager.prototype),{defs:{...defs,alias:{sounds:[{name:'test',type:'event',volume:.5,pitch:2}]}},game:{settings:{masterVolume:1,soundVolumes:{}}},audio:{play:()=>({})},_buffer:async file=>{files.push(file);return{};},_subtitle(){},playing:new Set(),generation:0});
 const old=Math.random;try{Math.random=()=>{throw Error('seeded selection used ambient random');};await s.play('test',0,0,0,1,1,{seed:0n});await s.play('test',0,0,0,1,1,{seed:0n});assert.deepEqual(files,['test/b','test/b']);}finally{Math.random=old;}
 const nested=s._pick('alias',new Set(),new JavaRandom(1n));assert.equal(nested.volume,.5);assert.equal(nested.pitch,3); // Parent draw consumes the same native RNG before the child draw.
});
