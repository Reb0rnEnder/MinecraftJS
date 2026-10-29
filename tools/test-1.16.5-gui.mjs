import {test}from'node:test';import assert from'node:assert/strict';
import {GameModeSwitcherScreen}from'../client/js/gui/screens/gamemode-switcher.js';import {SocialInteractionsScreen}from'../client/js/gui/screens/social.js';
import {ChatOptionsScreen,AccessibilityScreen}from'../client/js/gui/screens/options.js';
import {Hud}from'../client/js/gui/hud.js';import {Game}from'../client/js/game/game.js';import {Reader754}from'../client/js/net/protocol-1.16.5.js';import {SERVERBOUND_754}from'../client/js/net/protocol-1.16.5-ids.js';import {setPlatform}from'../client/js/platform/platform.js';import {VANILLA_UI}from'../client/js/gui/vanilla-layout.js';
function fixture(){const g={gui:{width:480,height:240,textWidth:s=>String(s).length*6},settings:{keys:{socialInteractions:'KeyP'},chatLineSpacing:0,chatDelay:0},gameMode:0,previousGameMode:1,permissionLevel:2,input:{down:new Set(['F3'])},screens:{close(){this.closed=true;}},narrator:{active:false,label:()=>''},scoreboard:{players:new Map()},sound:{playUi(){}},hud:{addChat(){}},sent:[],send(b){this.sent.push(b);},debugFeedback(){}};return g;}
test('F3+F4 commits exactly one selected game-mode command on F3 release; permission is required',()=>{
 const g=fixture(),s=new GameModeSwitcherScreen(g);s.key({code:'F4'});s.keyUp({code:'F3'});assert.equal(g.sent.length,0,'cycling back to current survival mode sends no redundant command');
 const t=new GameModeSwitcherScreen(g);t.keyUp({code:'F3'});let r=new Reader754(g.sent[0]);assert.equal(r.varint(),SERVERBOUND_754.chat);assert.equal(r.string(),'/gamemode creative');
 g.permissionLevel=1;new GameModeSwitcherScreen(g).keyUp({code:'F3'});assert.equal(g.sent.length,1);
});
test('Social Interactions filters names and retains hidden offline entries; hidden sender chat and matched names are suppressed',()=>{
 const g=fixture();g.scoreboard.players.set('uuid',{uuid:'uuid',name:'Hidden'});const s=new SocialInteractionsScreen(g);s.init();assert.equal(s.entries().length,1);s.hide(s.entries()[0]);assert.ok(g.hiddenPlayers.has('uuid'));g.scoreboard.players.clear();s.page='hidden';assert.equal(s.entries()[0].name,'Hidden');s.search.text='other';assert.deepEqual(s.entries(),[]);
 const visible=[];g.settings.hideMatchedNames=true;g.scoreboard.players.set('uuid',{name:'Hidden'});g.hud={queueChatMessage:t=>visible.push(t),addChat:t=>visible.push(t)};g.narrator={onChat(){}};
 Game.prototype.on_chat.call(g,{position:0,sender:'uuid',message:'{"text":"Hidden message"}'});Game.prototype.on_chat.call(g,{position:0,sender:'nil',message:'{"text":"<Hidden> test"}'});Game.prototype.on_chat.call(g,{position:1,sender:'nil',message:'{"text":"Server message"}'});assert.equal(visible.length,1);
});
test('native Chat/Accessibility screens scroll their rows and keep footer controls visible on small windows',()=>{
 const g=fixture();for(const [Screen,keys]of[[ChatOptionsScreen,VANILLA_UI.chatOptions],[AccessibilityScreen,VANILLA_UI.accessibilityOptions]]){
  const s=new Screen(g,null);s.init();assert.equal(s.list.top,32);assert.equal(s.list.bottom,208);assert.deepEqual(s.rows.flat().map(b=>b.optionKey),keys);assert.ok(s.buttons.every(b=>b.y===213));
 }
 assert.equal(VANILLA_UI.videoOptions.length,18);assert.ok(VANILLA_UI.bindingCategories['key.socialInteractions']);
});
test('chat delay preserves order, pending clicks advance one message, and spacing changes line hit testing',()=>{
 let now=0;setPlatform({now:()=>now});const g=fixture(),out=[];g.settings.chatDelay=2;const h=Object.assign(Object.create(Hud.prototype),{game:g,addChat:t=>out.push(t)});
 h.queueChatMessage('first');h.queueChatMessage('second');assert.deepEqual(out,['first']);now=1999;h.processQueuedChat();assert.equal(out.length,1);now=2000;h.processQueuedChat();assert.deepEqual(out,['first','second']);h.queueChatMessage('third');h.processQueuedChat(true);assert.equal(out.at(-1),'third');
});
