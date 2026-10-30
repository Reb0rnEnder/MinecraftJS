import {test} from 'node:test';import assert from 'node:assert/strict';import {SocialBlocking,socialUuid} from '../client/js/game/social-blocking.js';import {Game} from '../client/js/game/game.js';import {ChatScreen} from '../client/js/gui/screens/chat.js';
const A='11111111-2222-3333-4444-555555555555',B='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',blocked='12345678-1234-5678-90ab-1234567890ab';
const account=uuid=>({type:'microsoft',uuid});
test('offline accounts never query the service; normalized UUIDs exclude the nil sender',async()=>{
 let calls=0;const game={accounts:{active:()=>({type:'offline'}),blockedProfiles:async()=>{calls++;return[blocked.replace(/-/g,'')];}}},s=new SocialBlocking(game);
 await s.sync();assert.equal(calls,0);await s.sync(account(A),0);assert.equal(calls,1);assert.ok(s.isBlocked(blocked.toUpperCase()));assert.equal(s.isBlocked('00000000-0000-0000-0000-000000000000'),false);assert.equal(socialUuid('garbage'),null);
});
test('a completed list is cached and concurrent requests are coalesced',async()=>{
 let calls=0,resolve;const game={accounts:{blockedProfiles:()=>{calls++;return new Promise(r=>resolve=r);}}},s=new SocialBlocking(game),a=account(A);
 const first=s.sync(a,0),second=s.sync(a,1);await Promise.resolve();assert.equal(calls,1);resolve([blocked]);await Promise.all([first,second]);await s.sync(a,1000000);assert.equal(calls,1);assert.ok(s.isBlocked(blocked));
});
test('failed requests use native 120-second retry cooldown; switching account discards late previous responses',async()=>{
 let calls=0;const game={accounts:{blockedProfiles:async()=>{calls++;throw Error('unavailable');}}},s=new SocialBlocking(game),a=account(A);
 await s.sync(a,0);await s.sync(a,119999);assert.equal(calls,1);await s.sync(a,120000);assert.equal(calls,2);assert.equal(s.error,'unavailable');
 let done;game.accounts.blockedProfiles=()=>new Promise(r=>done=r);const pending=s.sync(account(B),120001);await Promise.resolve();await s.sync({type:'offline'},120002);done([blocked]);await pending;assert.equal(game.blockedPlayers.size,0);
});
test('blocked senders cannot enter chat or narration while system messages remain visible',async()=>{
 const visible=[],spoken=[],g={accounts:{blockedProfiles:async()=>[blocked]},settings:{hideMatchedNames:false},hud:{queueChatMessage:m=>visible.push(m),addChat:m=>visible.push(m)},narrator:{onChat:m=>spoken.push(m)}};g.socialBlocking=new SocialBlocking(g);await g.socialBlocking.sync(account(A),0);
 Game.prototype.on_chat.call(g,{sender:blocked,message:'blocked',position:0});assert.deepEqual(visible,[]);assert.deepEqual(spoken,[]);
 Game.prototype.on_chat.call(g,{sender:'00000000-0000-0000-0000-000000000000',message:'system',position:1});assert.equal(visible.length,1);
});


test('account privileges are applied before chat and multiplayer input, without blocking system messages',async()=>{
 const g={accounts:{socialPrivileges:async()=>({onlineChat:false,multiplayerServer:false}),blockedProfiles:async()=>[]}},service=new SocialBlocking(g);await service.sync(account(A),0);assert.equal(g.accountPrivileges.onlineChat,false);assert.equal(g.accountPrivileges.multiplayerServer,false);await service.sync({type:'offline'},1);assert.equal(g.accountPrivileges,null);
});

test('account-disabled chat remains read-only and cannot transmit typed or clicked commands',()=>{
 const sent=[],g={gui:{width:320,height:200},settings:{chatLinks:true},accountPrivileges:{onlineChat:false},hud:{sentHistory:[],queuedChatClick:()=>false,chatComponentAt:()=>({click:{action:'run_command',value:'/test'}})},send:p=>sent.push(p),screens:{close(){},open(){}}};const screen=new ChatScreen(g,'hello');screen.init();assert.equal(screen.input.enabled,false);screen.input.setText('blocked');screen.key({code:'Enter'});screen.mouseDown(10,10,0);assert.deepEqual(sent,[]);assert.deepEqual(g.hud.sentHistory,[]);
});
