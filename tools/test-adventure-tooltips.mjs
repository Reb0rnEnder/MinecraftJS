import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Items} from '../client/js/game/items.js';import {Assets} from '../client/js/assets.js';import {initBlocks,blocksByName} from '../client/js/world/blocks.js';import {Reader774} from '../client/js/net/configuration-1.21.11.js';import {createItemStack774} from '../client/js/net/item-components-1.21.11.js';import {setTranslator,chatComponentString,chatToLegacy} from '../client/js/gui/chat.js';import {RegistryTags} from '../client/js/game/tags.js';import {ZipFile} from '../lib/zip.js';
import {CreativeScreen} from '../client/js/gui/screens/containers.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url))),jar=new ZipFile(new URL('../cache/port-1.21.11/client.jar',import.meta.url)),data=Object.fromEntries(['items','creative','enchantments'].map(n=>[n,read('client/data/'+n+'.json')])),assets={data,lang:JSON.parse(jar.read('assets/minecraft/lang/en_us.json')),translate:Assets.prototype.translate};setTranslator(assets.translate.bind(assets),(k,f)=>assets.lang[k]??f??k);initBlocks(read('client/data/blocks.json'),null);
const items=new Items(assets),fixture=read('tools/fixtures/adventure-1.21.11.json'),plain=s=>s.replace(/§[0-9a-z]/gi,''),color=s=>{let c='f';for(let i=0;i<s.length&&s[i]==='§';i+=2){if(/[0-9a-f]/.test(s[i+1]))c=s[i+1];else if(s[i+1]==='r')c='f';}return c;};
function sections(lines){const a=lines.slice();const end=a.findIndex(s=>plain(s)==='minecraft:diamond_pickaxe');if(end>=0)a.length=end;const start=a.findIndex(s=>plain(s)===assets.translate('item.canBreak')||plain(s)===assets.translate('item.canPlace'));return start<0?[]:a.slice(start>0&&!plain(a[start-1])?start-1:start).map(s=>({text:plain(s),color:plain(s)?color(s):null}));}
for(const f of fixture.samples)test('native component tooltip '+f.label,()=>{
 const item=new Reader774(new Uint8Array(Buffer.from(f.wire,'base64'))).slot();
 for(const [advanced,key,creative]of [[false,'normal',false],[true,'advanced',false],...(f.normal_creative?[[false,'normal_creative',true],[true,'advanced_creative',true]]:[])]){const actual=items.tooltip(item,advanced,creative);assert.deepEqual(actual.map(plain),f[key].map(chatComponentString),key+' full tooltip');assert.deepEqual(sections(actual),sections(f[key].map(c=>chatToLegacy(c,{parsed:true}))),key+' permission styles');}
});
test('component holder sets follow current server tag order and deduplicate block IDs',()=>{
 const tags=new RegistryTags({blocks:{'custom:ordered':[blocksByName.dirt.id,blocksByName.stone.id]}});items.registryTags=()=>tags;
 const item=createItemStack774(data.items.find(i=>i.name==='stone').id,1,{added:[{type:'can_break',data:{predicates:[{blockSet:{name:'custom:ordered'},properties:null,nbt:null},{blockSet:{blockIds:[blocksByName.stone.id]},properties:null,nbt:null}],showTooltip:true}}]});
 const result=items.tooltip(item);assert.ok(result.indexOf('§8Dirt')<result.indexOf('§8Stone'));assert.equal(result.filter(s=>s==='§8Stone').length,1);tags.replace({blocks:{'custom:ordered':[]}});assert.equal(items.tooltip(item).filter(s=>s==='§8Dirt').length,0);items.registryTags=null;
});
test('Creative catalog tooltips use the native Creative flag while inventory slots keep normal hiding',()=>{
 const f=fixture.samples.find(s=>s.label==='tooltip hidden'),item=new Reader774(new Uint8Array(Buffer.from(f.wire,'base64'))).slot(),screen=Object.assign(Object.create(CreativeScreen.prototype),{game:{items,settings:{advancedItemTooltips:false}},tabLabel:()=> 'buildingBlocks'});
 assert.deepEqual(screen._tooltip(item),[]);assert.deepEqual(screen._tooltip(item,true).map(plain),f.normal_creative.map(chatComponentString));
});
