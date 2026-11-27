// Movable Default pack (1.14.4).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readResourceStack,readResourceBytes,resourceMetadata} from '../client/js/resource-layers.js';
const enc=s=>new TextEncoder().encode(s),dec=b=>new TextDecoder().decode(b);
const pack=(id,files)=>({id,prefix:'',zip:{has:k=>k in files,read:k=>enc(files[k]),list:()=>Object.keys(files)}});
test('packs below Default rank under vanilla: they only supply what vanilla lacks, in their own order',async()=>{
  const vanilla={'minecraft/texts/a.txt':'vanilla-a','minecraft/texts/b.txt.mcmeta':'x'};
  const upper=pack('up',{'assets/minecraft/texts/a.txt':'upper-a'}),low1=pack('l1',{'assets/minecraft/texts/a.txt':'low-a','assets/minecraft/texts/c.txt':'low1-c'}),low2=pack('l2',{'assets/minecraft/texts/c.txt':'low2-c'});
  const assets={packs:[upper],lowerPacks:[low1,low2],source:{bytes:async k=>k in vanilla?enc(vanilla[k]):null}};
  assert.deepEqual((await readResourceStack(assets,'minecraft:texts/a.txt')).map(r=>dec(r.bytes)),['upper-a','vanilla-a','low-a']);
  assert.equal(dec(await readResourceBytes(assets,'minecraft:texts/c.txt')),'low1-c');
  assets.packs=[];assert.equal(dec(await readResourceBytes(assets,'minecraft:texts/a.txt')),'vanilla-a');
  assert.equal((await resourceMetadata(assets,'minecraft:texts/c.txt')).base,false);
  assert.equal(await readResourceBytes(assets,'minecraft:texts/none.txt'),null);
});
const socialGame=()=>({scoreboard:{players:new Map([['me',{name:'Me'}],['bob-online',{name:'bob'}],['amy-online',{name:'amy'}]])},playerUuid:'me',hiddenPlayers:new Set(['gone-hidden']),socialNames:new Map(),
  chatLog:[{uuid:'carl-offline',name:'carl'},{uuid:'bob-online',name:'bob'}]});