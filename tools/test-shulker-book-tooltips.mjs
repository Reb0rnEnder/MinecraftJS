// Written book generation and shulker box contents in tooltips, as each target's native appendHoverText adds them.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {Items} from '../client/js/game/items.js';import {ADVENTURE_TOOLTIP_DATA as data} from '../client/js/game/adventure-tooltip-data.js';import {initBlocks} from '../client/js/world/blocks.js';
import {parseSnbt} from '../client/js/net/snbt.js';import {ZipFile} from '../lib/zip.js';import * as Chat from '../client/js/gui/chat.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const tables=Object.fromEntries(['items','blocks','blockCollisionShapes','enchantments','creative','materials','foods','entities'].filter(n=>existsSync(new URL('../client/data/'+n+'.json',import.meta.url))).map(n=>[n,read('client/data/'+n+'.json')]));
initBlocks(tables.blocks,tables.blockCollisionShapes);
const version=data.version,legacy=data.legacy,jarPath=existsSync(new URL('../cache/port-'+version+'/client.jar',import.meta.url))?new URL('../cache/port-'+version+'/client.jar',import.meta.url):new URL('../cache/'+version+'.jar',import.meta.url),jar=new ZipFile(fileURLToPath(jarPath));
const lang={};if(legacy){for(const line of (jar.read('assets/minecraft/lang/en_US.lang')||jar.read('assets/minecraft/lang/en_us.lang')).toString('utf8').split(/\r?\n/)){const i=line.indexOf('=');if(i>=0)lang[line.slice(0,i)]=line.slice(i+1);}}else Object.assign(lang,JSON.parse(jar.read('assets/minecraft/lang/en_us.json')));
const translate=(key,args=[])=>(lang[key]??key).replace(/%(?:(\d+)\$)?([sd%])/g,((n=>((match,index,type)=>type==='%'?'%':String(args[index?+index-1:n++]??match)))(0)));
Chat.setTranslator?.(translate,(key,fallback)=>lang[key]??fallback??key);
const assets={data:tables,lang,translate,itemsById:new Map(tables.items.map(d=>[d.id,d])),itemsByName:new Map(tables.items.map(d=>[d.name,d]))},items=new Items(assets);items.registryTags=()=>({registries:{blocks:new Map()}});
const def=n=>tables.items.find(d=>d.name===n),plain=s=>s.replace(/§./g,'');
const stack=(name,snbt)=>({id:def(name).id,count:1,damage:0,nbt:parseSnbt(snbt)});
test('written books show their generation after the author',()=>{
  const lines=items.tooltip(stack('written_book','{title:"T",author:"Ann",generation:2,pages:[]}')).map(plain);
  assert.deepEqual(lines.slice(1,3),['by Ann','Copy of a copy']);
  assert.deepEqual(items.tooltip(stack('written_book','{title:"T",author:"",pages:[]}')).map(plain).slice(1,2),['Original']);
});
test('shulker boxes list five stacks by slot, then "and N more..."',{skip:!tables.items.some(d=>/shulker_box$/.test(d.name))},()=>{
  const box=tables.items.find(d=>/shulker_box$/.test(d.name)).name,entries=['stone','dirt','apple','bread','arrow','egg','stick'].map((n,i)=>`{Slot:${6-i}b,id:"minecraft:${n}",Count:${i+1}b}`).join(',');
  const lines=items.tooltip(stack(box,`{BlockEntityTag:{LootTable:"minecraft:chests/x",Items:[${entries}]}}`)).map(plain);
  assert.deepEqual(lines.slice(1,8),['???????','Stick x7','Egg x6','Arrow x5','Bread x4','Apple x3','and 2 more...']);
});
