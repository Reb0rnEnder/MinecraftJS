// Movable Default pack, ScreenNarrationCollector (1.17.1).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readResourceStack,readResourceBytes,resourceMetadata} from '../client/js/resource-layers.js';
import {Narrator} from '../client/js/gui/narrator.js';
import {setPlatform} from '../client/js/platform/platform.js';
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
test('narration: opening speaks title and usage at once; changes speak only changed entries after the delay',()=>{
  let now=0;setPlatform({now:()=>now});
  const said=[],n=new Narrator({settings:{narrator:1}});Object.defineProperty(n,'active',{get:()=>true});n.saySystem=t=>said.push(t);
  const a={label:'Play'},b={label:'Quit'},screen={narrationTitle:()=>'Title Screen'};
  const frame=(hoverA,hoverB,keyboard=false)=>{n.widget(a,hoverA,'Play');n.widget(b,hoverB,'Quit');n.screenFrame(screen,[a,b],keyboard);};
  frame(false,false);assert.match(said.pop(),/^Title Screen\. \S/);
  now=2500;frame(true,false);now=2600;frame(true,false);assert.equal(said.length,0); // 750 ms hover delay
  now=3300;frame(true,false);assert.match(said.pop()||'',/usage\.hovered/);
  b.focused=true;now=3400;frame(false,false,true);now=3700;frame(false,false,true);assert.match(said.pop()||'',/usage\.focused/);
});
