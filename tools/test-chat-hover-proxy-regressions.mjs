import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {ZipFile} from '../lib/zip.js';
import mcassets from '../lib/mcassets.js';
import {chatToLegacy,chatSegments,wrapChatSegments,setTranslator} from '../client/js/gui/chat.js';
import {chatHoverTooltip} from '../client/js/gui/chat-hover.js';
import {parseSnbt} from '../client/js/net/snbt.js';
import {simplify} from '../client/js/net/nbt.js';
import {Hud} from '../client/js/gui/hud.js';
import {FontRenderer} from '../client/js/gui/font.js';
import {Items} from '../client/js/game/items.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {ProxyList,skinProxyUrl,fetchSkin,fetchSkinProfile,validSkinProxyTemplate,uuidSkinProxyAvailable} from '../client/js/net/proxies.js';
import {EntityRenderer} from '../client/js/render/entity-renderer.js';
const jar=new ZipFile(await mcassets.locateJar()),version=mcassets.MC_VERSION;
const langPath=jar.list('assets/minecraft/lang/').find(p=>/\/en_us\.json$/i.test(p))||jar.list('assets/minecraft/lang/').find(p=>/\/en_us\.lang$/i.test(p));
const rawLang=jar.read(langPath).toString('utf8'),lang=langPath.endsWith('.json')?JSON.parse(rawLang):Object.fromEntries(rawLang.split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const translate=(key,args=[])=>{let i=0;return (lang[key]??key).replace(/%(?:(\d+)\$)?[sd]/g,(_,n)=>args[n?Number(n)-1:i++]??'');};setTranslator(translate);
const data=Object.fromEntries(['items','creative','blocks','enchantments','foods','materials','effects'].map(n=>[n,JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)))]));
const font={width:s=>s.replace(/§./g,'').length*6,wrap:FontRenderer.prototype.wrap};
function game(){const assets={version:1,data,translate,lang,itemsById:new Map([...data.blocks,...data.items].map(d=>[d.id,d])),itemsByName:new Map([...data.blocks,...data.items].map(d=>[d.name,d]))},g={assets,settings:{chatWidth:0.1,chatScale:1,advancedItemTooltips:false,keys:{inventory:'KeyE'}},gui:{width:320,height:240,font},screens:{current:{isChatScreen:true}}};g.items=new Items(assets);g.hud=new Hud(g);return g;}
const uuid='01234567-89ab-cdef-0123-456789abcdef',id=uuid.replace(/-/g,''),url='http://textures.minecraft.net/texture/abc';

test('proxy placeholders distinguish UUID, raw URL and encoded URL, including repeated and mixed tokens',()=>{
 assert.ok(validSkinProxyTemplate('https://skins.example/%u'));assert.ok(uuidSkinProxyAvailable('https://skins.example/%u'));assert.ok(!uuidSkinProxyAvailable('https://cors.example/%R'));
 assert.equal(skinProxyUrl(url,'https://skins.example/%u',uuid),'https://skins.example/'+id);
 assert.equal(skinProxyUrl(url,'https://cors.example/%r',uuid),'https://cors.example/https://textures.minecraft.net/texture/abc');
 assert.equal(skinProxyUrl(url,'https://cors.example/?url=%R&id=%u&again=%u',uuid),'https://cors.example/?url='+encodeURIComponent(url.replace('http:','https:'))+'&id='+id+'&again='+id);
 assert.throws(()=>skinProxyUrl(url,'https://skins.example/%u'));assert.throws(()=>skinProxyUrl(url,'https://skins.example/%u','bad'));
});

test('UUID skin endpoint works for a player with no texture property, and never receives profile/cape requests',async()=>{
 const calls=[],settings={skinProxy:'https://skins.example/%u',proxies:[],proxy:-1,save(){}};
 setPlatform({fetchBytes:async u=>{calls.push(['png',u]);return new Uint8Array();},fetchJson:async u=>{calls.push(['json',u]);return {};}});new ProxyList(settings);
 const renderer=Object.create(EntityRenderer.prototype);renderer.game={scoreboard:{players:new Map()}};renderer.skins=new Map();renderer.skinFor({uuid});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls,[['png','https://skins.example/'+id]]);
 await assert.rejects(fetchSkinProfile(uuid));await assert.rejects(fetchSkin(url,uuid,'cape'));assert.equal(calls.length,1);
 settings.skinProxy='https://cors.example/%R';await fetchSkinProfile(uuid);assert.equal(calls.at(-1)[1],'https://cors.example/'+encodeURIComponent('https://sessionserver.mojang.com/session/minecraft/profile/'+id));
 new ProxyList({skinProxy:'',proxies:[],proxy:-1,save(){}});
});

test('typed hover SNBT preserves enchantment lists, escaped JSON names and legacy indexed lists',()=>{
 const nbt=parseSnbt('{id:"minecraft:diamond_sword",Count:1b,tag:{display:{Lore:["A description"]},ench:[0:{id:16s,lvl:3s}]}}');
 assert.equal(nbt.v.Count.t,1);assert.deepEqual(simplify(nbt).tag.ench,[{id:16,lvl:3}]);assert.deepEqual(simplify(nbt).tag.display.Lore,['A description']);
 assert.throws(()=>parseSnbt('{id:'));assert.throws(()=>parseSnbt('{tag:{x:[1,"mixed"]}}'));
});

test('show_item uses the existing item tooltip, including enchantments and lore, and handles invalid data',()=>{
 const g=game(),enchant=['1.13.2','1.14.4','1.15.2'].includes(version)?'Enchantments:[{id:"minecraft:sharpness",lvl:3s}]':'ench:[{id:16s,lvl:3s}]';
 const lore=['1.14.4','1.15.2'].includes(version)?JSON.stringify(JSON.stringify('Hover description')):JSON.stringify('Hover description');
 const tooltip=chatHoverTooltip(g,{hover:{action:'show_item',value:{text:'{id:"minecraft:diamond_sword",Count:1b,tag:{'+enchant+',display:{Lore:['+lore+']}}}'}}});
 assert.ok(tooltip.some(s=>s.includes('Diamond Sword')),tooltip.join('\n'));assert.ok(tooltip.some(s=>s.includes('Sharpness III')),tooltip.join('\n'));assert.ok(tooltip.some(s=>s.includes('Hover description')));
 assert.deepEqual(chatHoverTooltip(g,{hover:{action:'show_item',value:'{id:"minecraft:missing"}'}}),['§cInvalid Item!']);
});

test('translated announcements retain nested hover events and align hit regions after chat wrapping',()=>{
 const g=game(),key=version==='1.8.9'?'chat.type.achievement':'chat.type.advancement.task';
 const component={translate:key,with:[{text:'Steve'},{text:'[Achievement]',hoverEvent:{action:'show_text',value:{text:'Title\nHover description'}}}]};
 const segments=chatSegments(JSON.stringify(component));assert.ok(segments.some(s=>s.hover));
 g.hud.addChat(chatToLegacy(component,{parsed:true}),JSON.stringify(component));
 let found=0;for(let i=0;i<g.hud.chatLines.length;i++){
  const line=g.hud.chatLines[i];let x=2;for(const segment of line.comps){const hit=g.hud.chatComponentAt(x+1,g.gui.height-28-i*9-4);assert.equal(hit?.hover,segment.hover);if(segment.hover){found++;assert.deepEqual(chatHoverTooltip(g,hit),['Title','Hover description']);}x+=font.width(segment.text);}
 }
 assert.ok(found>0);assert.ok(g.hud.chatLines.length>1,'covers wrapped hit regions');
 const literal='{"text":"literal"}';assert.deepEqual(chatHoverTooltip(g,{hover:{action:'show_text',value:literal}}),[literal]);
});

if(version==='1.8.9')test('legacy achievement hover includes its translated description',()=>{
 const g=game(),lines=chatHoverTooltip(g,{hover:{action:'show_achievement',value:{text:'achievement.mineWood'}}});assert.ok(lines.includes(lang['achievement.mineWood']));assert.ok(lines.join(' ').replace(/\s+/g,' ').includes(lang['achievement.mineWood.desc'].replace(/\s+/g,' ')));
});

test('wrapped hit regions preserve literal legacy bold codes',()=>{
 const parts=wrapChatSegments(chatSegments({text:'§labcdef',hoverEvent:{action:'show_text',value:'bold'}}),['§labc','§ldef']);
 assert.equal(parts[0][0].text,'§labc');assert.equal(parts[1][0].text,'§ldef');
});
