import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),auth=require('../lib/msauth.js'),blocked='12345678-1234-5678-90ab-1234567890ab';
test('account block-list transport uses the native fixed URL and bearer header, validates data and rejects missing sessions',async()=>{
 const saved=globalThis.fetch;let requests=0;
 try{globalThis.fetch=async(url,options)=>{requests++;assert.equal(url,'https://api.minecraftservices.com/privacy/blocklist');assert.equal(options.headers.authorization,'Bearer test-session');return {ok:true,json:async()=>({blockedProfiles:[blocked]})};};
 assert.deepEqual(await auth.blockedProfiles('test-session'),[blocked]);await assert.rejects(auth.blockedProfiles(''),/Missing Minecraft session/);assert.equal(requests,1);
 globalThis.fetch=async()=>({ok:false,status:403});await assert.rejects(auth.blockedProfiles('test-session'),/HTTP 403/);
 globalThis.fetch=async()=>({ok:true,json:async()=>({blockedProfiles:['not-a-uuid']})});await assert.rejects(auth.blockedProfiles('test-session'),/Invalid account block list/);
 }finally{globalThis.fetch=saved;}
});

test('native account privilege response defaults missing optional privileges to false',async()=>{
 const saved=globalThis.fetch;try{globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.minecraftservices.com/privileges');assert.equal(options.headers.authorization,'Bearer test-session');return {ok:true,json:async()=>({privileges:{onlineChat:{enabled:true},multiplayerServer:{enabled:false}}})};};assert.deepEqual(await auth.socialPrivileges('test-session'),{onlineChat:true,multiplayerServer:false,multiplayerRealms:false,telemetry:false});}finally{globalThis.fetch=saved;}
});
