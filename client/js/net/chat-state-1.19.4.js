// LastSeenMessagesTracker's 20-entry ring. An absent account signing key keeps
// outgoing messages unsigned; acknowledgement state is still mandatory.
import {Writer762} from './protocol-1.19.4.js';
import {SERVERBOUND_762 as OUT} from './protocol-1.19.4-ids.js';
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
export class ChatState762 {
 constructor(){this.reset();}
 reset(){this.entries=Array(20).fill(null);this.tail=0;this.offset=0;this.last=null;}
 process(signature,shown=true){if(!signature||same(this.last,signature))return false;this.last=signature.slice();this.entries[this.tail]=shown?{signature:signature.slice(),pending:true}:null;this.tail=(this.tail+1)%20;this.offset++;return true;}
 ignore(signature){const entry=this.entries.findIndex(e=>e?.pending&&same(e.signature,signature));if(entry>=0)this.entries[entry]=null;}
 collect(){const offset=this.offset;this.offset=0;const acknowledged=new Uint8Array(3),signatures=[];for(let i=0;i<20;i++){const e=this.entries[(this.tail+i)%20];if(e){acknowledged[i>>3]|=1<<(i&7);signatures.push(e.signature);e.pending=false;}}return{offset,acknowledged,signatures};}
 flush(){const count=this.offset;this.offset=0;return new Writer762().varint(OUT.message_acknowledgement).varint(count).build();}
 encode(text,now=Date.now()){const{offset,acknowledged}=this.collect(),command=text.startsWith('/'),w=new Writer762().varint(command?OUT.chat_command:OUT.chat_message).string((command?text.slice(1):text).slice(0,256)).i64(BigInt(now)).i64(0n);if(command)w.varint(0);else w.bool(false);return w.varint(offset).raw(acknowledged).build();}
}
export function decorateChat762(codec,packet,content){
 const registry=codec?.['minecraft:chat_type']||codec?.chat_type||codec?.[':chat_type'],entry=registry?.value?.find(e=>e.id===packet.type)?.element?.chat;
 const sender=JSON.parse(packet.networkName||packet.name||'{"text":""}'),target=packet.networkTargetName||packet.target;
 if(!entry)return {translate:'chat.type.text',with:[sender,content]};
 const args=entry.parameters.map(name=>name==='sender'?sender:name==='content'?content:target?JSON.parse(target):{text:''});return{...(entry.style||{}),translate:entry.translation_key,with:args};
}

// Native MessageSignatureCache: packed signature IDs use zero for a full
// signature and cache index + 1 otherwise. This is separate from last-seen ACKs.
export class MessageSignatureCache762 {
 constructor(){this.reset();}
 reset(){this.entries=Array(128).fill(null);}
 resolve(packed){
  if(packed.id===0)return packed.signature?.length===256?packed.signature.slice():null;
  return Number.isInteger(packed.id)&&packed.id>0&&packed.id<=128?this.entries[packed.id-1]:null;
 }
 push(previous,signature){
  const incoming=[...previous,...(signature?[signature]:[])];if(!incoming.length)return;
  const key=s=>String.fromCharCode(...s),keys=new Set(incoming.map(key));
  // A bounded deque preserves native duplicate/tail behavior; flattening to a
  // deduplicated MRU list would change the IDs used by subsequent packets.
  const queue=new Array(128+incoming.length);let head=128,tail=128+incoming.length;
  incoming.forEach((s,i)=>queue[128+i]=s.slice());
  for(let i=0;head<tail&&i<128;i++){
   const old=this.entries[i];this.entries[i]=queue[--tail];
   if(old&&!keys.has(key(old)))queue[--head]=old;
  }
 }
}

// FilterMask.applyWithFormatting uses UTF-16 positions, as does Java String.
export function filteredChat762(text,mask){
 const extra=[],filtered=i=>!!(BigInt.asUintN(64,mask[i>>6]??0n)&(1n<<BigInt(i&63)));
 for(let start=0;start<text.length;){const hidden=filtered(start);let end=start+1;while(end<text.length&&filtered(end)===hidden)end++;
  extra.push(hidden?{text:'#'.repeat(end-start),color:'dark_gray',hoverEvent:{action:'show_text',contents:{translate:'chat.filtered'}}}:{text:text.slice(start,end)});start=end;
 }
 return{text:'',extra};
}
