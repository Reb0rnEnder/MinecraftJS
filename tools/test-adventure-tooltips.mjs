import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {Items} from '../client/js/game/items.js';import {ADVENTURE_TOOLTIP_DATA as data} from '../client/js/game/adventure-tooltip-data.js';import * as Blocks from '../client/js/world/blocks.js';const {initBlocks,blocksByName,findState,getStateProperties}=Blocks;import {parseSnbt} from '../client/js/net/snbt.js';import {adventureAllows} from '../client/js/game/adventure.js';import * as Chat from '../client/js/gui/chat.js';import {ZipFile} from '../lib/zip.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url))),fixture=read('tools/fixtures/adventure-tooltips-native.json'),require=createRequire(import.meta.url),version=data.version,legacy=data.legacy;
const tables=Object.fromEntries(['items','blocks','blockCollisionShapes','enchantments','creative','materials','foods','entities'].filter(n=>existsSync(new URL('../client/data/'+n+'.json',import.meta.url))).map(n=>[n,read('client/data/'+n+'.json')]));
initBlocks(tables.blocks,tables.blockCollisionShapes);
const jarPath=existsSync(new URL('../cache/port-'+version+'/client.jar',import.meta.url))?new URL('../cache/port-'+version+'/client.jar',import.meta.url):new URL('../cache/'+version+'.jar',import.meta.url),jar=new ZipFile(fileURLToPath(jarPath));
const lang=legacy?{}:JSON.parse(jar.read('assets/minecraft/lang/en_us.json'));
if(legacy)for(const line of (jar.read('assets/minecraft/lang/en_US.lang')||jar.read('assets/minecraft/lang/en_us.lang')).toString('utf8').split(/\r?\n/)){const i=line.indexOf('=');if(i>=0)lang[line.slice(0,i)]=line.slice(0,i);}
const translate=(key,args=[])=>legacy?key:(lang[key]??key).replace(/%(?:(\d+)\$)?([sd%])/g,((n=>((match,index,type)=>type==='%'?'%':String(args[index?+index-1:n++]??match)))(0)));
Chat.setTranslator(translate,(key,fallback)=>lang[key]??fallback??key);
const assets={data:tables,lang,translate,itemsById:new Map(tables.items.map(d=>[d.id,d])),itemsByName:new Map(tables.items.map(d=>[d.name,d]))},items=new Items(assets);items.registryTags=()=>({registries:{blocks:new Map()}});
const plain=s=>s.replace(/§[0-9a-z]/gi,''),color=s=>{let c='f';for(let i=0;i<s.length&&s[i]==='§';i+=2){if(/[0-9a-f]/.test(s[i+1]))c=s[i+1];else if(s[i+1]==='r')c='f';}return c;},normal=s=>({text:plain(s),color:plain(s)?color(s):null});
function relevant(lines){const limit=lines.findIndex(s=>plain(s)==='minecraft:stone'),a=limit<0?lines:lines.slice(0,limit),start=a.findIndex(s=>['item.canBreak','item.canPlace','item.unbreakable'].some(k=>plain(s)===translate(k)));return start<0?[]:a.slice(start>0&&!plain(a[start-1])?start-1:start).map(normal);}
const stone=tables.items.find(d=>d.name==='stone').id;
for(const row of fixture.cases)test('native '+version+' permission tooltip '+row.label,()=>{
 const stack={id:stone,count:1,damage:0,nbt:parseSnbt(row.nbt,{nativeNumbers:true})};
 for(const [advanced,key]of [[false,'normal'],[true,'advanced']]){
  const expected=row[key].map(c=>typeof c==='string'?c:Chat.chatToLegacy(c,{parsed:true}));assert.deepEqual(relevant(items.tooltip(stack,advanced)),relevant(expected),key);
 }
});
test('localized block-name aliases are read from the target jar',()=>{if(legacy){assert.ok(data.blockNames[1]);return;}assert.equal(data.blockNames.wall_torch,data.blockNames.torch);assert.equal(data.blockNames.redstone_wall_torch,data.blockNames.redstone_torch);});
if(!legacy)test('tag order and registered empty tags use the live registry',()=>{
 const map=new Map([['custom:ordered',[blocksByName.dirt.id,blocksByName.stone.id]],['custom:empty',[]]]);items.registryTags=()=>({registries:{blocks:map}});
 const stack={id:stone,count:1,damage:0,nbt:parseSnbt('{CanDestroy:["#custom:ordered"]}')};assert.deepEqual(relevant(items.tooltip(stack)).map(x=>x.text),['',translate('item.canBreak'),translate(data.blockNames.dirt),translate(data.blockNames.stone)]);
 stack.nbt=parseSnbt('{CanDestroy:["#custom:empty"]}');delete stack._simple;assert.deepEqual(relevant(items.tooltip(stack)).map(x=>x.text),['',translate('item.canBreak'),...(data.emptyTagFallback?['missingno']:[])]);items.registryTags=()=>({registries:{blocks:new Map()}});
});
test('native numeric property and legacy name resolution also govern actual Adventure permissions',()=>{
 const block=legacy?blocksByName.stone:blocksByName.wheat,state=legacy?block.id<<4:findState('wheat',{age:'4'}),game={world:{getState:()=>state},tileRenderer:{tiles:new Map()}};
 for(const [text,expected]of legacy?[['1',true],['١',true],['STONE',version==='1.12.2']]:[['wheat[age=04]',true],['wheat[age=+4]',true],['wheat[age=8]',false]])assert.equal(adventureAllows(game,{id:stone,count:1,nbt:parseSnbt('{CanDestroy:['+JSON.stringify(text)+']}')},'CanDestroy',{x:0,y:64,z:0}),expected,text);
});
