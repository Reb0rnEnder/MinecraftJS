import {encodeUtf8} from '../util/utf8.js';
import{Writer762}from'./protocol-1.19.4.js';
import{parseRsaPublicKey,verifyRsa,sha256}from'../util/signature-crypto.js';
import{CHAT_CERTIFICATE_KEYS}from'./chat-trust-roots.js';
const decode64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const same=(a,b)=>a?.length===b?.length&&a.every((v,i)=>v===b[i]);
const uuid=value=>{const s=String(value).replace(/-/g,'').toLowerCase();if(!/^[a-f0-9]{32}$/.test(s))throw Error('Invalid UUID');return s;};
const invalid=key=>Object.assign(Error(key),{key});
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export function certificatePayload762(sender,session){return new Writer762().uuid(uuid(sender)).i64(session.expireTime).raw(session.keyBytes).build();}
export function signedMessagePayload762(packet,sessionId,previous){
 const text=encodeUtf8(packet.plainMessage),timestamp=BigInt(packet.timestamp),seconds=timestamp/1000n-(timestamp<0n&&timestamp%1000n?1n:0n);
 const w=new Writer762().i32(1).uuid(uuid(packet.sender)).uuid(uuid(sessionId)).i32(packet.index).i64(packet.salt).i64(seconds).i32(text.length).raw(text).i32(previous.length);
 for(const signature of previous)w.raw(signature);return w.build();
}
export class ChatVerifier762{
 constructor({roots=CHAT_CERTIFICATE_KEYS,now=()=>Date.now()}={}){this.now=now;this.roots=roots.map(k=>parseRsaPublicKey(typeof k==='string'?decode64(k):k));this.sessions=new Map();}
 reset(){this.sessions.clear();}
 remove(sender){this.sessions.delete(uuid(sender));}
 install(sender,session){
  const id=uuid(sender);this.sessions.delete(id);if(!session)return;
  if(BigInt(session.expireTime)+28800000n<BigInt(Math.floor(this.now())))throw invalid('multiplayer.disconnect.expired_public_key');
  let key,body;try{uuid(session.uuid);key=parseRsaPublicKey(session.keyBytes);if(key.size!==256)throw Error('Player RSA key must be 2048 bits');body=certificatePayload762(id,session);}catch{throw invalid('multiplayer.disconnect.invalid_public_key_signature');}
  if(!this.roots.some(root=>verifyRsa(root,session.keySignature,body,'SHA-1')))throw invalid('multiplayer.disconnect.invalid_public_key_signature');
  this.sessions.set(id,{uuid:session.uuid,key,valid:true,last:null});
 }
 validate(packet,previous,{enforced=false}={}){
  const session=this.sessions.get(uuid(packet.sender));
  if(!session)return{valid:!packet.signature&&!enforced,signed:false};
  if(!session.valid)return{valid:false,signed:false};
  try{
   if(!Number.isInteger(packet.index)||packet.index<0||packet.index>2147483647||packet.plainMessage.length>256||previous.length>20||previous.some(s=>s?.length!==256))throw Error('Invalid signed message');
   const body=signedMessagePayload762(packet,session.uuid,previous);
   if(!verifyRsa(session.key,packet.signature,body))throw Error('Invalid message signature');
   const digest=sha256(body),decoration=JSON.stringify([packet.unsignedChatContent?canonical(JSON.parse(packet.unsignedChatContent)):null,packet.filterType,(packet.filterTypeMask||[]).map(String)]),last=session.last;
   if(last&&!(packet.index>last.index||packet.index===last.index&&same(last.digest,digest)&&same(last.signature,packet.signature)&&last.decoration===decoration&&last.timestamp===String(packet.timestamp)))throw Error('Broken message chain');
   session.last={index:packet.index,digest,signature:packet.signature.slice(),decoration,timestamp:String(packet.timestamp)};
   return{valid:true,signed:true,stale:BigInt(Math.floor(this.now()))>BigInt(packet.timestamp)+420000n};
  }catch{session.valid=false;return{valid:false,signed:false};}
 }
}

export function hasNonDefaultChatFont(component){
 if(Array.isArray(component))return component.some(hasNonDefaultChatFont);
 if(!component||typeof component!=='object')return false;
 const font=component.font&&(component.font.includes(':')?component.font:'minecraft:'+component.font);
 return !!(font&&font!=='minecraft:default')||(component.extra||[]).some(hasNonDefaultChatFont)||(component.with||[]).some(hasNonDefaultChatFont);
}
