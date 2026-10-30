import {Reader758} from '../net/protocol-1.18.2.js';
export const BLOCK_STATE_COUNT_758=20342;
export const AIR_STATES_758=Object.freeze([0,9916,9915]);
// Native PalettedContainer strategies: blocks 0 / 4..8 / registry, biomes 0 / 1..3 / registry.
export function readPalette758(r,size,registrySize,kind){
 const wireBits=r.u8(),localMax=kind==='blocks'?8:3,minLocal=kind==='blocks'?4:1;
 if(wireBits>32||registrySize<1||!Number.isSafeInteger(registrySize))throw Error('Invalid palette registry or width');
 let bits=wireBits===0?0:wireBits<=localMax?Math.max(minLocal,wireBits):Math.max(1,Math.ceil(Math.log2(registrySize))),palette;
 if(bits===0){const id=r.varint();if(id<0||id>=registrySize)throw Error('Invalid single palette value');if(r.varint()!==0)throw Error('Single palette must have no longs');if(size===4096)r.nativeSizePadding=(r.nativeSizePadding||0)+1;return new Uint32Array(size).fill(id);}
 if(wireBits<=localMax){const n=r.varint();if(n<1||n>2**bits)throw Error('Invalid local palette length');palette=new Uint32Array(n);for(let i=0;i<n;i++){const id=r.varint();if(id<0||id>=registrySize)throw Error('Invalid palette registry value');palette[i]=id;}}
 const perLong=Math.floor(64/bits),length=r.varint();if(length!==Math.ceil(size/perLong))throw Error('Invalid padded palette length');
 const result=new Uint32Array(size),mask=2**bits-1;let index=0;
 for(let i=0;i<length;i++){const high=r.i32()>>>0,low=r.i32()>>>0;for(let e=0;e<perLong&&index<size;e++,index++){
  const shift=e*bits;let value=shift<32?low>>>shift:high>>>(shift-32);if(shift<32&&shift+bits>32)value|=high<<(32-shift);value=(value&mask)>>>0;
  if(palette){if(value>=palette.length)throw Error('Invalid local palette index');value=palette[value];}else if(value>=registrySize)throw Error('Invalid direct palette value');result[index]=value;
 }}return result;
}
export function decodeChunkData758(packet,{stateCount=BLOCK_STATE_COUNT_758,biomeCount=61,sectionCount=24}={}){
 if(!Number.isInteger(sectionCount)||sectionCount<1||sectionCount>254)throw Error('Invalid dimension section count');
 const r=new Reader758(packet.chunkData),sections=new Array(sectionCount),biomes=new Uint32Array(sectionCount*64);
 for(let y=0;y<sectionCount;y++){
  const offset=r.offset;try{const wireNonAir=r.u16(),blocks=readPalette758(r,4096,stateCount,'blocks'),sectionBiomes=readPalette758(r,64,biomeCount,'biomes');let nonAir=0;for(const state of blocks)if(!AIR_STATES_758.includes(state))nonAir++;sections[y]={blocks,nonAir,wireNonAir};biomes.set(sectionBiomes,y*64);}catch(error){throw Error(`${error.message} (chunk ${packet.x},${packet.z}, section ${y}, byte ${offset})`,{cause:error});}
 }
 // Native Data.getSerializedSize sizes the storage's entry count VarInt, but writes
 // the long-array length. Each single-value block palette can leave one zero byte
 // at the end of the allocated chunk buffer. Accept only this bounded native padding.
 if(r.remaining()>(r.nativeSizePadding||0)||r.rest().some(b=>b!==0))throw Error('Trailing 758 section data');return{sections,biomes};
}
