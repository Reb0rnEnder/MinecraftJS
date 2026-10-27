import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as soundModule from '../client/js/audio/sound.js';
import mcassets from '../lib/mcassets.js';
import {Assets} from '../client/js/assets.js';
const {SoundManager}=soundModule,soundAssetName=soundModule.soundAssetName||((s)=>s.replace(/^minecraft:/,''));
const json = name => JSON.parse(readFileSync(new URL('../client/'+name,import.meta.url)));
test('every registered sound and referenced event resolves, and every shipped sample is an Ogg file',async()=>{
 const built=existsSync(new URL('../client/assets/minecraft/sounds.json',import.meta.url)),index=built?null:await mcassets.loadAssetIndex();
 const defs=built?json('assets/minecraft/sounds.json'):JSON.parse(await index.read('minecraft/sounds.json')),files=new Set();
 for(const event of existsSync(new URL('../client/data/sounds.json',import.meta.url))?json('data/sounds.json'):[])assert.ok(defs[soundAssetName(event.name)],event.name);
 for(const [name,def]of Object.entries(defs))for(const raw of def.sounds||[]){const s=typeof raw==='string'?{name:raw}:raw;if(s.type==='event')assert.ok(defs[soundAssetName(s.name)],name+' -> '+s.name);else files.add(s.name.replace(/^minecraft:/,''));}
 for(const file of files){const data=built?readFileSync(new URL('../client/assets/minecraft/sounds/'+file+'.ogg',import.meta.url)):await index.read('minecraft/sounds/'+file+'.ogg');assert.ok(data,file);assert.equal(data.toString('ascii',0,4),'OggS',file);assert.ok(data.length>32,file);}
});
test('nested sound events use native event weights and multiply volume, pitch and stream flags',()=>{
 const s=Object.create(SoundManager.prototype);s.defs={child:{sounds:[{name:'a',weight:3,volume:.4,pitch:.8}]},parent:{sounds:[{name:'child',type:'event',weight:99,volume:.5,pitch:.5,stream:true}]},cycle:{sounds:[{name:'cycle',type:'event'}]}};
 assert.equal(s._weight('parent'),3);assert.deepEqual(s._pick('minecraft:parent'),{file:'a',volume:.2,pitch:.4,stream:true});assert.equal(s._pick('cycle'),null);
});
test('resource-pack audio resolves explicit namespaces through the pack-aware source',async()=>{
 const paths=[],a=Object.create(Assets.prototype);a.readResourceBytes=async path=>{paths.push(path);return path;};
 await a.readSound('demo:custom/chime.ogg');await a.readSound('minecraft:random/click.ogg');await a.readSound('random/click.ogg');assert.deepEqual(paths,['demo:sounds/custom/chime.ogg','minecraft:sounds/random/click.ogg','minecraft:sounds/random/click.ogg']);
});
