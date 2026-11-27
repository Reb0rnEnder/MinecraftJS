// LocalChatSession / SignedMessageChain.Encoder (1.20.6): a random session id, the account's Mojang-signed profile
// key, and one signature per message body linked by (sender, session, index). Signing is synchronous so the chat
// packet and its last-seen acknowledgement leave in order.
import {parseRsaPrivateKey,signRsaSha256} from '../util/signature-crypto.js';
import {signedMessagePayload762} from './chat-verifier-1.19.4.js';

const hex=(bytes)=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
export function randomUuid(random=(n)=>crypto.getRandomValues(new Uint8Array(n))){
  const b=random(16);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=hex(b);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
// Crypt.SaltSupplier: a random long
export function randomSalt(random=(n)=>crypto.getRandomValues(new Uint8Array(n))){
  const b=random(8);let v=0n;for(const x of b)v=(v<<8n)|BigInt(x);return BigInt.asIntN(64,v);
}
// PEM from player/certificates -> DER bytes
export function pemBytes(pem){
  const body=String(pem).replace(/-----[^-]+-----/g,'').replace(/\s+/g,'');
  const bin=atob(body),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;
}

export class LocalChatSession766 {
  // keys: {privateKey: DER, publicKey: DER (X.509), signature: publicKeySignatureV2 bytes, expiresAt: ms}
  constructor(keys,sender,sessionId=randomUuid()){
    this.keys=keys;this.sender=sender;this.sessionId=sessionId;this.index=0;
    this.privateKey=parseRsaPrivateKey(keys.privateKey);
  }
  // ServerboundChatSessionUpdatePacket(RemoteChatSession.Data)
  sessionData(){return {sessionUUID:this.sessionId,expireTime:BigInt(this.keys.expiresAt),publicKey:this.keys.publicKey,signature:this.keys.signature};}
  // SignedMessageChain.Encoder.pack: sign PlayerChatMessage.updateSignature(link, body), then advance the link
  sign({content,timestamp,salt,lastSeen}){
    const payload=signedMessagePayload762({plainMessage:content,timestamp,sender:this.sender,index:this.index,salt},this.sessionId,lastSeen);
    this.index++;
    return signRsaSha256(this.privateKey,payload);
  }
}
