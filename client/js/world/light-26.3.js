// 26.3 light payloads to the shape the world already consumes. The native BitSet is
// FriendlyByteBuf.readByteArray: little-endian bits over its bytes, bit 0 = the section
// below minSection. Update arrays follow the set bits in ascending order.
export function bitSetToBigInt(bytes){
  let value=0n;
  for(let i=0;i<bytes.length;i++)value|=BigInt(bytes[i])<<BigInt(8*i);
  return value;
}

function countBits(value){
  let count=0;
  for(let bits=value;bits!==0n;bits&=bits-1n)count++;
  return count;
}

function updatesBySection(mask,updates){
  const bits=bitSetToBigInt(mask);
  if(countBits(bits)!==updates.length)throw Error('Light payload count does not match its mask');
  const out={};
  let index=0;
  for(let bit=0;bit<64;bit++){
    if((bits>>BigInt(bit))&1n){
      const bytes=updates[index++];
      if(bytes.length!==2048)throw Error('Light section is not 2048 bytes');
      out[bit-1]=bytes;
    }
  }
  return out;
}

export function lightTo758(light){
  return {
    skyLight:updatesBySection(light.skyYMask,light.skyUpdates),
    emptySkyLightMask:bitSetToBigInt(light.emptySkyYMask),
    blockLight:updatesBySection(light.blockYMask,light.blockUpdates),
    emptyBlockLightMask:bitSetToBigInt(light.emptyBlockYMask)
  };
}
