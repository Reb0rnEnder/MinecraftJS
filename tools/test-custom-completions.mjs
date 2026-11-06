import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{Game}from'../client/js/game/game.js';import{playerSuggestions,CommandTree}from'../client/js/game/commands.js';import{ChatScreen}from'../client/js/gui/screens/chat.js';import{setPlatform}from'../client/js/platform/platform.js';
import{decodePacket762}from'../client/js/net/protocol-1.19.4.js';import{Writer}from'../client/js/net/buffer.js';
setPlatform({loadSetting:()=>null});
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/custom-completions-native-1.19.4.json',import.meta.url)));
const decode=hex=>decodePacket762(Uint8Array.of(22,...Buffer.from(hex,'hex')));
test('native JVM ADD/REMOVE/SET wire vectors apply to Game with set semantics',()=>{
 const g={};for(const f of fixtures){const p=decode(f.wireHex);assert.equal(p.name,'chat_suggestions');assert.equal(p.action,f.action);assert.deepEqual(p.entries,f.entries);Game.prototype.on_chat_suggestions.call(g,p);assert.deepEqual([...g.customChatCompletions].sort(),f.result);}
 for(const n of[-1,3])assert.throws(()=>decodePacket762(new Writer().varint(22).varint(n).varint(0).build()),/Invalid chat completion action/);
});
test('normal-chat union retains online names when a matching custom entry is removed',()=>{
 const g={scoreboard:{players:new Map([['id',{name:'Alice'}],['id2',{name:'Bob'}]])}};Game.prototype.on_chat_suggestions.call(g,{action:0,entries:['Alice','Alpine']});
 assert.deepEqual(playerSuggestions(g,'hello Al',8).matches.map(m=>m.match),['Alice','Alpine']);Game.prototype.on_chat_suggestions.call(g,{action:1,entries:['Alice']});assert.deepEqual(playerSuggestions(g,'Al').matches.map(m=>m.match),['Alice','Alpine']);
 Game.prototype.on_chat_suggestions.call(g,{action:2,entries:['Beta']});assert.deepEqual(playerSuggestions(g,'').matches.map(m=>m.match),['Alice','Beta','Bob']);
 const r=playerSuggestions(g,'hello Be trailing',8);assert.deepEqual([r.start,r.end,r.matches[0].match],[6,8,'Beta']);
});
test('ChatScreen Tab uses custom normal-chat entries; command entity providers remain online-only',()=>{
 const g={customChatCompletions:new Set(['Alpine']),scoreboard:{players:new Map([['a',{name:'Alice'}]])},gui:{width:320,height:240},assets:{translate:k=>k},settings:{},send(){},hud:{chatScroll:0,sentHistory:[]},screens:{close(){}}};
 const s=new ChatScreen(g,'Al');s.init();s.requestSuggestions(true);assert.deepEqual(s.tabMatches.map(m=>m.match),['Alice','Alpine']);s.onClose();
 const nodes=[{type:0,children:[1]},{type:1,name:'test',children:[2]},{type:2,name:'player',parser:'minecraft:game_profile',properties:{},children:[],executable:true}];
 const commands=new CommandTree({nodes,root:0},g);assert.deepEqual(commands.suggestions('/test Al').matches.map(m=>m.match),['Alice']);
});
test('a new connection clears completion state before initializing the new world',()=>{
 const stop=new Error('stop at world initialization'),g={customChatCompletions:new Set(['old server']),worldBorder:{reset(){throw stop;}}};
 assert.throws(()=>Game.prototype.on_login.call(g,{}),error=>error===stop);assert.equal(g.customChatCompletions.size,0);
});
