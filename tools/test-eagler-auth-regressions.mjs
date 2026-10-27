import{test}from'node:test';import assert from'node:assert/strict';import{EaglerSocket}from'../client/js/net/eagler.js';import*as packets from'../client/js/net/packets.js';import{Writer}from'../client/js/net/buffer.js';
const protocol=packets.PROTOCOL_VERSION??47;
function version(auth){return new Writer().u8(2).u16(3).u16(protocol).u8(0).u8(0).u8(auth).u16(0).build();}
function fixture(password){const sent=[],s=new EaglerSocket({});s.state='version';s.username='User';s.password=password;s.sock={sendBinary:b=>sent.push(b),close(){s.state='closed';}};return{s,sent};}
test('V3 plaintext authentication uses upstream method 255 and UTF-8 password bytes',()=>{
 const{s,sent}=fixture('pąss');s._handshake(version(255));assert.equal(s.state,'login');assert.equal(sent.length,1);assert.equal(sent[0][0],4);assert.deepEqual([...sent[0].slice(-5)],[112,196,133,115,115]);
});
test('unknown auth methods and overlong UTF-8 passwords never send a malformed login',()=>{
 for(const[method,password]of[[3,'secret'],[255,'ą'.repeat(128)]]){const{s,sent}=fixture(password);s._handshake(version(method));assert.equal(sent.length,0);assert.equal(s.state,'closed');}
});
