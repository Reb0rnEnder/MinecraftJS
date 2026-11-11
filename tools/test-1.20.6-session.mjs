import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {VanillaSocket766} from '../client/js/net/tcp-1.20.6.js';
import {Connection} from '../client/js/net/connection.js';
import {ProxyList} from '../client/js/net/proxies.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {Reader766,Writer766} from '../client/js/net/configuration-1.20.6.js';
import {LOGIN_CLIENTBOUND_766 as LI, CONFIGURATION_CLIENTBOUND_766 as CI, PLAY_CLIENTBOUND_766 as PI, PLAY_SERVERBOUND_766 as PO} from '../client/js/net/protocol-1.20.6-ids.js';
import {Game} from '../client/js/game/game.js';
import {chatState762} from '../client/js/net/packets.js';

const uuid='12345678-1234-4234-8234-123456789abc';
const packet=id=>new Writer766().varint(id);
const frame=bytes=>new Writer766().varint(bytes.length).raw(bytes).build();
const next=()=>new Promise(resolve=>setImmediate(resolve));
function transport() {
  const sockets=[];
  setPlatform({now:()=>0,postJson:async()=>{throw Error('Unexpected real authentication request')},openSocket:async()=>{
    const ws={handlers:{},written:[],on(event,fn){(this.handlers[event]??=[]).push(fn)},emit(event,value){for(const fn of this.handlers[event]||[])fn(value)},
      sendText(text){const msg=JSON.parse(text);assert.equal(msg.type,'raw_connect');this.emit('text',JSON.stringify({type:'raw_ready'}))},
      sendBinary(bytes){this.written.push(bytes)},close(){this.emit('close')},receive(bytes){this.emit('binary',frame(bytes))}};
    sockets.push(ws);return ws;
  }});
  new ProxyList({proxy:0,proxies:[{url:'ws://fixture',type:'minecraftjs'}]});
  return sockets;
}
function play(ws) {
  ws.receive(packet(LI.success).uuid(uuid).string('Fixture').varint(0).bool(true).build());
  ws.receive(packet(CI.finish_configuration).build());
}

test('766 native encryption flag permits encrypted offline login without a session join',async()=>{
  transport();let joins=0;setPlatform({postJson:async()=>{joins++;throw Error('must not join')}});
  const {publicKey}=generateKeyPairSync('rsa',{modulusLength:1024});
  const key=new Uint8Array(publicKey.export({format:'der',type:'spki'}));
  const s=new VanillaSocket766({}),sent=[];s._send=bytes=>sent.push(bytes);s.state='login';
  await s._packet(packet(LI.encryption_begin).string('').varint(key.length).raw(key).varint(4).raw(new Uint8Array([1,2,3,4])).bool(false).build());
  assert.equal(joins,0);assert.equal(s.closed,false);assert.equal(s.state,'login');assert.ok(s.cipher);assert.ok(s.decipher);
  const r=new Reader766(sent[0]);assert.equal(r.varint(),1);assert.equal(r.varint(),128);r.bytesN(128);assert.equal(r.varint(),128);r.bytesN(128);assert.equal(r.remaining(),0);
});

test('766 authenticated encryption rejects a missing account with the actual disconnect reason',async()=>{
  const s=new VanillaSocket766({}),messages=[];s.state='login';s.on('text',text=>messages.push(JSON.parse(text)));
  await s._packet(packet(LI.encryption_begin).string('').varint(1).u8(0).varint(1).u8(0).bool(true).build());
  assert.equal(s.closed,true);assert.equal(JSON.parse(messages[0].reason).translate,'minecraftjs.disconnect.online');
});

test('graphical Connection delivers bundles atomically and answers bounded Play cookies',async()=>{
  const sockets=transport(),conn=new Connection(),received=[];conn.on('packet',p=>received.push(p));
  await conn.connect('localhost',25565,'Fixture');await next();const ws=sockets[0];play(ws);
  ws.receive(packet(PI.bundle_delimiter).build());
  ws.receive(packet(PI.update_health).f32(12).varint(15).f32(3).build());
  assert.equal(received.length,0);
  ws.receive(packet(PI.bundle_delimiter).build());assert.equal(received[0].health,12);
  const source=packet(PI.store_cookie).string('minecraft:session').varint(2).u8(4).u8(2).build();ws.receive(source);source[source.length-1]=9;
  ws.receive(packet(PI.cookie_request).string('minecraft:session').build());
  const r=new Reader766(ws.written.at(-1));r.varint();assert.equal(r.varint(),PO.cookie_response);assert.equal(r.string(),'minecraft:session');assert.equal(r.bool(),true);assert.equal(r.varint(),2);assert.deepEqual([...r.rest()],[4,2]);
  assert.throws(()=>conn.ws._packet(packet(PI.store_cookie).string('minecraft:large').varint(5121).raw(new Uint8Array(5121)).build()),/limit/);
  conn.close();
});

test('server transfer copies cookies and uses native handshake intent 3; ordinary joins do not inherit them',async()=>{
  const sockets=transport(),conn=new Connection();await conn.connect('localhost',25565,'Fixture');await next();play(sockets[0]);
  sockets[0].receive(packet(PI.store_cookie).string('minecraft:session').varint(1).u8(42).build());
  let transfer;conn.on('transfer',p=>transfer=p);sockets[0].receive(packet(PI.transfer).string('next.example').varint(25566).build());
  assert.equal(conn.ws.state,'transferring');assert.equal(transfer.host,'next.example');assert.equal(transfer.port,25566);
  conn.ws.cookies.get('minecraft:session')[0]=8;assert.equal(transfer.cookies.get('minecraft:session')[0],42);
  const nextConn=new Connection();await nextConn.connect(transfer.host,transfer.port,'Fixture',null,transfer);await next();
  const handshake=new Reader766(sockets[1].written[0]);handshake.varint();assert.equal(handshake.varint(),0);assert.equal(handshake.varint(),766);assert.equal(handshake.string(),'next.example');assert.equal(handshake.u16(),25566);assert.equal(handshake.varint(),3);
  sockets[1].receive(packet(LI.cookie_request).string('minecraft:session').build());const reply=new Reader766(sockets[1].written.at(-1));reply.varint();assert.equal(reply.varint(),4);assert.equal(reply.string(),'minecraft:session');assert.equal(reply.bool(),true);assert.equal(reply.varint(),1);assert.equal(reply.u8(),42);
  const normal=new Connection();await normal.connect('localhost',25565,'Fixture');await next();assert.equal(normal.ws.cookies.size,0);
  conn.close();nextConn.close();normal.close();
});

test('Game suspends the old world on reconfiguration, retains visible history, flushes acknowledgements, and honors reset_chat',async()=>{
  const sockets=transport(),history=['/help'],chat=[{text:'keep'}],left=[];
  const g=Object.assign(Object.create(Game.prototype),{
    disconnect(){this.conn?.close();this.conn=null},reset(){},socialBlocking:{async sync(){}},
    screens:{current:null,open(s){this.current=s}},hud:{sentHistory:history,chat,clearChat(){this.chat=[]}},
    leaveWorld(preserve){left.push(preserve);this.inWorld=false},inWorld:true
  });
  await g.connect('localhost',25565,'Fixture');await next();const ws=sockets[0];play(ws);
  chatState762.reset();chatState762.process(new Uint8Array(256).fill(1));const before=ws.written.length;
  ws.receive(packet(PI.start_configuration).build());
  assert.deepEqual(left,[true]);assert.equal(g.inWorld,false);assert.equal(g.conn.state,'configuration');assert.equal(g.hud.chat,chat);assert.equal(g.hud.sentHistory,history);
  const ids=ws.written.slice(before).map(bytes=>{const r=new Reader766(bytes);r.varint();return r.varint()});
  assert.deepEqual(ids.slice(0,2),[PO.message_acknowledgement,PO.configuration_acknowledged]);
  assert.equal(ids.length,2,'reconfiguration does not resend initial brand/settings');
  assert.equal(chatState762.offset,0);
  ws.receive(packet(CI.reset_chat).build());assert.deepEqual(g.hud.chat,[]);assert.deepEqual(g.hud.sentHistory,[]);
  ws.receive(packet(CI.finish_configuration).build());assert.equal(g.conn.state,'play');g.conn.close();
});

test('typed Configuration/Play disconnect reasons reach the normal connection control path',()=>{
  for(const phase of ['configuration','play']){
    const s=new VanillaSocket766({}),messages=[];s.on('text',text=>messages.push(JSON.parse(text)));
    s._send=()=>{};s.profile={uuid,username:'Fixture'};s._beginConfiguration();
    if(phase==='play')s._packet(packet(CI.finish_configuration).build());
    s._packet(packet(phase==='configuration'?CI.disconnect:PI.kick_disconnect).component({text:'precise reason'}).build());
    assert.equal(s.closed,true);assert.equal(messages.at(-1).type,'kicked');assert.equal(messages.at(-1).reason,'precise reason');
  }
});
