// Wire-only section decoding; native world/lighting lifecycle is a later port stage.
import {Reader498} from '../net/protocol-1.14.4.js';
// From the verified vanilla 1.14.4 Block List report (not inherited 1.13 IDs).
export const BLOCK_STATE_COUNT_498=11271;
export const AIR_STATES_498=Object.freeze([0,9129,9130]);
export function decodeChunkData498(packet,{stateCount=BLOCK_STATE_COUNT_498}={}) {
  const {bitMap,groundUp,chunkData}=packet;
  if(!Number.isInteger(bitMap)||bitMap<0||bitMap>65535)throw new Error('Invalid terrain section mask');
  if(!Number.isInteger(stateCount)||stateCount<1)throw new Error('Invalid state registry size');
  const r=new Reader498(chunkData),sections=new Array(16).fill(null),globalBits=Math.ceil(Math.log2(stateCount));
  for(let y=0;y<16;y++)if(bitMap&(1<<y)) {
    // 1.14.4's native recount also counts non-empty fluids (bxu.h), so the
    // transmitted count can exceed 4096. Recount actual occupied cells below.
    const wireNonAir=r.u16(),wireBits=r.i8(),bits=wireBits<=4?4:wireBits<9?wireBits:globalBits;

    let palette=null;
    if(bits<=8) {
      const n=r.varint();if(n<1||n>1<<bits)throw new Error('Invalid local palette size');
      palette=new Uint32Array(n);
      for(let i=0;i<n;i++){const id=r.varint();if(id<0||id>=stateCount)throw new Error('Invalid registry state');palette[i]=id;}
    }
    const longs=r.varint();if(longs!==64*bits)throw new Error('Invalid packed section length');
    const words=new Uint32Array(longs*2);
    for(let i=0;i<longs;i++){words[i*2+1]=r.i32()>>>0;words[i*2]=r.i32()>>>0;}
    const blocks=new Uint32Array(4096),mask=(1<<bits)-1;
    for(let i=0;i<4096;i++) {
      const offset=i*bits,word=offset>>>5,shift=offset&31;
      let value=words[word]>>>shift;if(shift+bits>32)value|=words[word+1]<<(32-shift);value&=mask;
      if(palette){if(value>=palette.length)throw new Error('Invalid local palette index');value=palette[value];}
      else if(value>=stateCount)throw new Error('Invalid registry state');
      blocks[i]=value;
    }
    let nonAir=0;for(const state of blocks)if(state!==0&&state!==9129&&state!==9130)nonAir++;
    sections[y]={blocks,nonAir,wireNonAir};
  }
  let biomes=null;
  if(groundUp){biomes=new Uint32Array(256);for(let i=0;i<256;i++)biomes[i]=r.i32()>>>0;}
  if(r.remaining())throw new Error('Trailing 498 section data');
  return {sections,biomes};
}
