// LocalChatSession / SignedMessageChain signing, chat_session_update and SignableCommand routing (1.19.4: one chat_command packet carries the argument signatures).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createVerify} from 'node:crypto';
import {LocalChatSession762,pemBytes,randomSalt} from '../client/js/net/chat-signing-1.19.4.js';
import {signedMessagePayload762} from '../client/js/net/chat-verifier-1.19.4.js';
import {ChatState762} from '../client/js/net/chat-state-1.19.4.js';
import {CommandTree} from '../client/js/game/commands.js';
import {parseRsaPublicKey,verifyRsa} from '../client/js/util/signature-crypto.js';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const keys={privateKey:new Uint8Array(privateKey.export({type:'pkcs8',format:'der'})),publicKey:new Uint8Array(publicKey.export({type:'spki',format:'der'})),signature:new Uint8Array(512),expiresAt:Date.UTC(2030,0,1)};
const sender='11111111-2222-3333-4444-555555555555';
test('signatures are SHA256withRSA over PlayerChatMessage.updateSignature and advance the link index',()=>{
  const s=new LocalChatSession762(keys,sender,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),seen=[new Uint8Array(256).fill(7)];
  for(let index=0;index<2;index++){
    const body={content:'hello '+index,timestamp:1700000000123,salt:-42n,lastSeen:index?seen:[]};
    const sig=s.sign(body),payload=signedMessagePayload762({plainMessage:body.content,timestamp:body.timestamp,sender,index,salt:body.salt},s.sessionId,body.lastSeen);
    assert.equal(sig.length,256);
    assert.ok(createVerify('sha256').update(payload).verify(publicKey,sig),'Node verifies index '+index);
    assert.ok(verifyRsa(parseRsaPublicKey(keys.publicKey),sig,payload));
  }
  assert.equal(s.index,2);
  const data=s.sessionData();assert.equal(data.sessionUUID,s.sessionId);assert.equal(data.expireTime,BigInt(keys.expiresAt));assert.equal(data.publicKey,keys.publicKey);
});
test('PEM certificates decode to DER; salts are random signed longs',()=>{
  const pem=publicKey.export({type:'spki',format:'pem'});assert.deepEqual(pemBytes(pem),keys.publicKey);
  const a=randomSalt(),b=randomSalt();assert.equal(typeof a,'bigint');assert.notEqual(a,b);assert.ok(a>=-(2n**63n)&&a<2n**63n);
});
// root -> msg -> targets (entity) -> message (message); root -> tp -> targets (entity)
const tree=new CommandTree({root:0,nodes:[{type:0,children:[1,4]},{type:1,name:'msg',children:[2]},{type:2,name:'targets',parser:'minecraft:entity',properties:{flags:0},children:[3]},{type:2,name:'message',parser:'minecraft:message',properties:{},children:[],executable:true},{type:1,name:'tp',children:[5]},{type:2,name:'targets',parser:'minecraft:entity',properties:{flags:0},children:[],executable:true}]},{assets:{data:{}}});
test('commands carry their message-argument signatures in chat_command; chat is signed with a session',()=>{
  assert.deepEqual(tree.signableArguments('msg Steve hi there'),[{name:'message',value:'hi there'}]);
  const state=new ChatState762();state.signableArguments=c=>tree.signableArguments(c);
  const unsigned=state.encode('/msg Steve hi',{now:1,salt:2n}),plain=state.encode('/tp Steve',{now:1,salt:2n});assert.equal(unsigned[0],4);assert.equal(plain[0],4);
  const session=new LocalChatSession762(keys,sender);state.signer=b=>session.sign(b);
  const signed=state.encode('/msg Steve hi',{now:1,salt:2n});assert.equal(signed[0],4);assert.ok(signed.length>unsigned.length+256);
  const chat=state.encode('hello',{now:5,salt:3n});assert.equal(chat[0],5);assert.equal(session.index,2);
});
