import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {Reader,Writer} from '../client/js/net/buffer.js';
import {decodePacket} from '../client/js/net/packets.js';
import {CommandTree} from '../client/js/game/commands.js';
import {RegistryTags} from '../client/js/game/tags.js';
import {Game} from '../client/js/game/game.js';
import {Hud} from '../client/js/gui/hud.js';
import {ChatScreen} from '../client/js/gui/screens/chat.js';
import {CommandMinecartScreen} from '../client/js/gui/screens/commandblock.js';
import {initBlocks,findState} from '../client/js/world/blocks.js';
import {setPlatform} from '../client/js/platform/platform.js';
const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const data=Object.fromEntries(['blocks','items','effects','enchantments','entities','sounds','blockCollisionShapes'].map(n=>[n,json('../client/data/'+n+'.json')]));
initBlocks(data.blocks,data.blockCollisionShapes);
setPlatform({info:()=>({runtime:'test',bits:64,cpu:'test'}),width:320,height:240});
const oracle=json('./fixtures/commands-1.13.2.json');
const packet=()=>decodePacket(Uint8Array.from([0x11,...Buffer.from(oracle.body,'base64')]));
function fixture(text='') {
 const sent=[],g={assets:{data,translate:(key,args)=>key+' '+args.join(' ')},gui:{width:320,height:240},tags:new RegistryTags(),
 scoreboard:{players:new Map([['a',{name:'Alex'}],['b',{name:'Alice'}],['c',{name:'Steve'}]])},
 hud:{chatScroll:0,sentHistory:[],chatComponentAt:()=>null,scrollChat(){}},send:p=>sent.push(p),screens:{close(){}},interaction:{target:null},device:{name:'test'},settings:{}};
 g.commands=new CommandTree(packet(),g);const screen=new ChatScreen(g,text);screen.init();return {g,screen,sent};
}
const font={width:s=>s.replace(/§./g,'').length*6,trimToWidth:(s,w)=>s.slice(0,Math.max(0,Math.floor(w/6)))};
const render=screen=>{const text=[];screen.render({font,rect(){},text:s=>text.push(s),tooltip(){}},0,0);return text;};

test('real vanilla command-tree packet decodes fully, including redirects and argument serializer payloads',()=>{
 const p=packet();assert.equal(p.name,'declare_commands');assert.equal(p._extra,undefined);assert.equal(p.nodes.length,755);
 assert.ok(p.nodes.some(n=>n.redirect!==undefined));assert.ok(p.nodes.some(n=>n.suggestions==='minecraft:ask_server'));
 const {g}=fixture();
 // Vanilla's Gson component reader can report one character past the end; display ranges clamp to input.
 for(const row of oracle.cases){const parsed=g.commands.parse(row.input);assert.equal(parsed.cursor,Math.min(row.input.length,row.cursor),row.input);
  assert.deepEqual(parsed.spans.map(s=>[s.start,s.end]).sort((a,b)=>a[0]-b[0]),row.ranges.map(([a,b])=>[a,Math.min(row.input.length,b)]).sort((a,b)=>a[0]-b[0]),row.input);
  assert.equal(!!parsed.error,row.unread,row.input);
 }
});

test('tags use block registry IDs, include nested vanilla sand membership, and replace on server reload',()=>{
 const {g}=fixture(),sand=data.blocks.find(b=>b.name==='sand');
 assert.deepEqual(g.tags.forEntry('blocks',sand.id),['minecraft:enderman_holdable','minecraft:sand']);
 const hud=Object.create(Hud.prototype);hud.game=g;hud.debugTargets={block:{state:findState('sand')},fluid:null};
 const lines=hud._debugRight();assert.ok(lines.includes('minecraft:sand'));assert.ok(lines.includes('#minecraft:enderman_holdable'));assert.ok(lines.includes('#minecraft:sand'));
 const w=new Writer().varint(0x55).varint(1).string('test:custom').varint(1).varint(sand.id).varint(0).varint(1).string('test:liquid').varint(1).varint(2);
 const p=decodePacket(w.build());assert.equal(p.name,'tags');assert.equal(p._extra,undefined);Game.prototype.on_tags.call(g,p);
 assert.deepEqual(g.tags.forEntry('blocks',sand.id),['test:custom']);assert.deepEqual(g.tags.names('items'),[]);assert.ok(g.tags.contains('fluids','test:liquid',2));
 assert.ok(!hud._debugRight().includes('#minecraft:sand'));assert.ok(hud._debugRight().includes('#test:custom'));
 g.reducedDebug=true;assert.ok(!hud._debugRight().includes('#test:custom'));
 Game.prototype.reset.call(g);assert.equal(g.commands,null);assert.deepEqual(g.tags.forEntry('blocks',sand.id),['minecraft:enderman_holdable','minecraft:sand']);
});

test('command text colours parsed arguments aqua then yellow, and unread errors red without changing input',()=>{
 const {g,screen}=fixture('/give Alex sand nope');
 assert.deepEqual(g.commands.parse('/give Alex sand 0').error.args,[1,0]);
 assert.equal(g.commands.format('/give Alex sand nope'),'§7/give §bAlex§7 §esand§7 §cnope');
 assert.equal(g.commands.format('Alex',6,screen.input.text),'§bAlex');
 const before=[screen.input.text,screen.input.cursor,screen.input.selEnd];const drawn=render(screen);
 assert.ok(drawn.some(s=>s.includes('§bAlex')));assert.ok(drawn.some(s=>s.includes('parsing.int.invalid')));
 assert.deepEqual([screen.input.text,screen.input.cursor,screen.input.selEnd],before);
 screen.input.setText("/say it's fine");assert.equal(screen.commandState.error,undefined);
 screen.onClose();
});

test('local suggestions respect the server tree, support command names and player arguments, and preserve suffixes',()=>{
 const {screen,sent,g}=fixture('/gi');assert.ok(screen.tabMatches.some(m=>m.match==='give'));assert.equal(sent.length,0);
 screen.input.setText('/give Al rest');screen.input.cursor=8;screen.input.selEnd=8;screen.requestSuggestions();
 assert.deepEqual(screen.tabMatches.map(m=>m.match),['Alex','Alice']);screen.tabComplete();assert.equal(screen.input.text,'/give Alex rest');
 screen.tabComplete();assert.equal(screen.input.text,'/give Alice rest');screen.tabComplete(true);assert.equal(screen.input.text,'/give Alex rest');
 const p=packet(),root={...p.nodes[p.root],children:p.nodes[p.root].children.filter(i=>p.nodes[i].name==='say')};p.nodes[p.root]=root;
 Game.prototype.on_declare_commands.call({...g,screens:{current:screen}},p);
 assert.deepEqual(g.commands.suggestions('/setblock ~ ~ ~ oak_stairs[fa').matches,[{match:'facing='}]);
 assert.deepEqual(g.commands.suggestions('/setblock ~ ~ ~ oak_stairs[facing=ea').matches,[{match:'east'}]);
 const limited=new CommandTree(p,g);assert.deepEqual(limited.suggestions('/gi').matches,[],'no invented permission roots');screen.onClose();
});

test('ordinary chat shows player suggestions only after Tab, including an empty field',()=>{
 const {screen,sent}=fixture('hello Al');assert.equal(screen.tabMatches,null);screen.tabComplete();assert.deepEqual(screen.tabMatches.map(m=>m.match),['Alex','Alice']);
 screen.tabComplete();assert.equal(screen.input.text,'hello Alex');screen.key({code:'ArrowDown'});screen.tabComplete();assert.equal(screen.input.text,'hello Alice');
 screen.input.setText('');assert.equal(screen.tabMatches,null);screen.tabComplete();assert.deepEqual(screen.tabMatches.map(m=>m.match),['Alex','Alice','Steve']);assert.equal(sent.length,0);screen.onClose();
});

test('browser wheel scrolls suggestions down and up and clamps at both ends',()=>{
 const {screen}=fixture('/');render(screen);screen.mouseMove(screen.tabBox.x+2,screen.tabBox.y+2);
 screen.wheel(1);assert.equal(screen.tabOffset,1);screen.wheel(-1);assert.equal(screen.tabOffset,0);screen.wheel(-1);assert.equal(screen.tabOffset,0);
 for(let i=0;i<100;i++)screen.wheel(1);assert.equal(screen.tabOffset,screen.tabMatches.length-10);screen.onClose();
});

test('server completion keeps range and transaction validation for dynamic arguments',()=>{
 const {screen,sent}=fixture('/function te');screen.tabComplete();assert.equal(sent.length,1);
 const transaction=screen.tabTransaction;screen.onTabComplete({transactionId:transaction-1,start:10,length:2,matches:[{match:'wrong'}]});assert.equal(screen.tabMatches,null);
 screen.onTabComplete({transactionId:transaction,start:10,length:2,matches:[{match:'test:run'}]});screen.tabComplete();assert.equal(screen.input.text,'/function test:run');
 screen.input.setText('chat');screen.onTabComplete({transactionId:transaction,start:0,length:4,matches:[{match:'stale'}]});assert.equal(screen.tabMatches,null);screen.onClose();
});

test('command block input shares syntax and suggestions without requiring a slash or importing chat history',()=>{
 const {g}=fixture();const screen=new CommandMinecartScreen(g,{id:5,metadata:{1:'give Al',2:null}},1,2);screen.init();
 assert.deepEqual(screen.completions.tabMatches.map(m=>m.match),['Alex','Alice']);screen.key({code:'Tab'});assert.equal(screen.commandField.text,'give Alex');
 assert.ok(screen.commandField.formatter(screen.commandField.text,0).includes('§bAlex'));
 screen.commandField.setText('say hello');screen.key({code:'ArrowUp'});assert.equal(screen.commandField.text,'say hello');screen.onClose();
});
