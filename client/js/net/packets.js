// Active native Java 1.14.4 codec (protocol 498).
import {C as OLD} from './packets-1.13.2.js';
import {Reader} from './buffer.js';
import {Writer498,C498,decodePacket498} from './protocol-1.14.4.js';
import {OUT_498} from './protocol-1.14.4-reuse.js';
export const PROTOCOL_VERSION=498;
export const decodePacket=decodePacket498;
export const C=Object.fromEntries(Object.entries(OLD).map(([name,encode])=>[name,(...args)=>{
 const bytes=encode(...args),r=new Reader(bytes),old=r.varint(),id=OUT_498[old];
 if(id===undefined)throw new Error('No native 498 packet for '+name);
 return new Writer498().varint(id).raw(r.rest()).build();
}]));
Object.assign(C,{blockDig:C498.blockDig,blockPlace:C498.blockPlace,
 recipeInfoSettings:(open,filtering)=>new Writer498().varint(0x1d).varint(1).bool(open).bool(filtering).bool(false).bool(false).bool(false).bool(false).bool(false).bool(false).build(),
 updateSign:(x,y,z,lines)=>{const w=new Writer498().varint(0x29).position(x,y,z);for(let i=0;i<4;i++)w.string(lines[i]||'');return w.build();}});
export const mcStringBytes=s=>new Writer498().string(s).build();
