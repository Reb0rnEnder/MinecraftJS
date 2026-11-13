import {test} from 'node:test';
import assert from 'node:assert/strict';
import {networkExceptionReason,DecoderError} from '../client/js/net/network-errors.js';
import {VanillaSocket} from '../client/js/net/tcp.js';

test('connection exceptions use native wording with actual JavaScript error names',()=>{
 const cause=new SyntaxError('Invalid text component');
 const error=new DecoderError("Failed to decode packet 'clientbound/minecraft:system_chat'",{cause,packet:'clientbound/minecraft:system_chat',byteOffset:377});
 assert.equal(networkExceptionReason(error),"Internal Exception: DecoderError: Failed to decode packet 'clientbound/minecraft:system_chat'");
 assert.equal(error.cause,cause);assert.equal(error.byteOffset,377);
 assert.equal(networkExceptionReason(Object.assign(new Error(),{name:'TimeoutError'})),'Timed out');
 assert.equal(networkExceptionReason(new RangeError('Buffer underflow')),'Internal Exception: RangeError: Buffer underflow');
 const messages=[],s=Object.create(VanillaSocket.prototype);s._control=m=>messages.push(m);s.close=()=>messages.push('closed');
 const before=console.error;try{console.error=()=>{};s._badPacket(error);}finally{console.error=before;}
 assert.equal(messages[0].message,networkExceptionReason(error));assert.equal(messages[1],'closed');
});
