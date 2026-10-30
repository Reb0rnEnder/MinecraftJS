import {test} from 'node:test';import assert from 'node:assert/strict';import {Game} from '../client/js/game/game.js';
const A='11111111-2222-3333-4444-555555555555';
test('canceling a connection while account data is pending prevents a late connection',async()=>{
 let resolve;const g={connectAttempt:0,disconnect:Game.prototype.disconnect,leaveWorld(){},reset(){},accounts:{active:()=>({type:'microsoft',name:'Account',uuid:A}),ensureFresh:()=>new Promise(r=>resolve=r)},socialBlocking:{sync:async()=>{}},screens:{open(){},openMainMenu(){}}};
 const pending=Game.prototype.connect.call(g,'localhost',25565);g.disconnect();resolve({name:'Account',uuid:A,accessToken:'test-session'});await pending;assert.equal(g.conn,undefined);assert.equal(g.username,undefined);
});
