// 26.3 low-precision Vec3 (Vec3.LP_STREAM_CODEC -> LpVec3). Header byte 0 is the zero vector;
// otherwise bit 2 marks an extended scale, the low two bits hold scale/1..3, and the scale is
// (low bits) | (VarInt << 2). The 48-bit payload packs three 15-bit axis values at bit offsets
// 3/18/33, decoded as (2q/32766 - 1) * scale. Verified with javap on Vec3 and the clientbound
// add_entity path; this module owns both directions so they cannot drift apart.

const Q=32766;

export function readLpVec3(r){
  const header=r.u8();
  if(header===0)return {x:0,y:0,z:0};
  const second=r.u8(),high=r.i32()>>>0;
  const packed=(BigInt(high)<<16n)|(BigInt(second)<<8n)|BigInt(header);
  let scale=BigInt(header&3);
  if(header&4)scale|=BigInt(r.varint())<<2n;
  const factor=Number(scale);
  const unpack=shift=>{
    const q=Math.min(Number((packed>>BigInt(shift))&0x7fffn),Q);
    return (q*2/Q-1)*factor;
  };
  return {x:unpack(3),y:unpack(18),z:unpack(33)};
}

// The encoder picks the smallest extended scale that holds every axis, so a decoded vector
// re-encodes to a payload the same decoder turns back into the same point within 1/32766.
export function writeLpVec3(w,{x=0,y=0,z=0}={}){
  if(x===0&&y===0&&z===0){w.u8(0);return w;}
  const max=Math.max(Math.abs(x),Math.abs(y),Math.abs(z));
  const scale=Math.max(4,Math.ceil(max/4)*4);
  const quantize=value=>{
    const q=Math.round((value/scale+1)*Q/2);
    return Math.max(0,Math.min(Q,q));
  };
  const packed=(BigInt(quantize(x))<<3n)|(BigInt(quantize(y))<<18n)|(BigInt(quantize(z))<<33n)|0x4n;
  w.u8(Number(packed&0xffn));
  w.u8(Number((packed>>8n)&0xffn));
  w.i32(Number(packed>>16n)|0);
  w.varint(scale>>2);
  return w;
}

export {Q as LP_VEC3_QUANTUM};
