import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,privateDecrypt,constants,createCipheriv,createDecipheriv} from 'node:crypto';
import {VanillaSocket} from '../client/js/net/tcp.js';
import {Reader,Writer} from '../client/js/net/buffer.js';
import {setPlatform} from '../client/js/platform/platform.js';

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:1024});
export const publicDer=new Uint8Array(publicKey.export({format:'der',type:'spki'}));
const token=new Uint8Array([7,2,9,4]);
const request=()=>new Writer().string('').varint(publicDer.length).raw(publicDer).varint(token.length).raw(token).build();
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function decrypt(bytes){const block=privateDecrypt({key:privateKey,padding:constants.RSA_NO_PADDING},bytes);assert.equal(block[0],0);assert.equal(block[1],2);const end=block.indexOf(0,2);assert.ok(end>=10);return block.subarray(end+1);}

test('authenticated login encrypts the secret/token and streams AES-CFB8 independently in both directions',async()=>{
  let joined;
  setPlatform({postJson:async(url,body)=>{joined={url,body};return{status:204}}});
  const socket=new VanillaSocket({}),written=[];
  socket.auth={uuid:'12345678-1234-4234-8234-123456789abc',accessToken:'fixture-token'};
  socket.stream={write:bytes=>written.push(bytes),close(){}};
  await socket._encryption(request());
  assert.equal(socket.state,'login');assert.match(joined.url,/sessionserver/);
  assert.equal(joined.body.selectedProfile,'12345678123442348234123456789abc');
  assert.equal(joined.body.accessToken,'fixture-token');assert.match(joined.body.serverId,/^-?[0-9a-f]+$/);
  const frame=new Reader(written[0]),length=frame.varint();assert.equal(length,frame.remaining());assert.equal(frame.varint(),1);
  const secret=decrypt(frame.bytesN(frame.varint()));assert.equal(secret.length,16);
  assert.deepEqual(new Uint8Array(decrypt(frame.bytesN(frame.varint()))),token);assert.equal(frame.remaining(),0);
  const payload=new Uint8Array([3,1,2,3]),serverDecipher=createDecipheriv('aes-128-cfb8',secret,secret);
  socket._write(payload.subarray(0,1));socket._write(payload.subarray(1));
  assert.deepEqual(new Uint8Array(serverDecipher.update(Buffer.concat(written.slice(1)))),payload);
  const serverCipher=createCipheriv('aes-128-cfb8',secret,secret),encrypted=serverCipher.update(payload);
  assert.deepEqual(socket.decipher.update(encrypted),payload);
});

for(const outcome of ['resolve','reject'])test('cancelling login while session join is pending cannot revive it ('+outcome+')',async()=>{
  const pending=deferred();setPlatform({postJson:()=>pending.promise});
  const socket=new VanillaSocket({}),written=[],controls=[];
  socket.auth={uuid:'12345678-1234-4234-8234-123456789abc',accessToken:'fixture-token'};
  socket.stream={write:bytes=>written.push(bytes),close(){}};socket.on('text',text=>controls.push(text));
  const login=socket._encryption(request());assert.equal(socket.state,'encrypting');socket.close();
  if(outcome==='resolve')pending.resolve({status:204});else pending.reject(Error('fixture failure'));
  await login;assert.equal(written.length,0);assert.equal(socket.cipher,null);assert.equal(socket.decipher,null);assert.equal(controls.length,0);
});

test('cancelling transport opening sends no late handshake or login packet',async()=>{
  const pending=deferred(),socket=new VanillaSocket({}),written=[];
  socket._open=()=>pending.promise;socket._send=bytes=>written.push(bytes);
  const login=socket._connect({host:'localhost',port:25565,username:'Fixture',protocol:47});socket.close();pending.resolve();await login;
  assert.equal(written.length,0);
});
