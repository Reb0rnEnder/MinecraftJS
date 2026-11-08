// Java UUID.nameUUIDFromBytes: MD5 digest with UUID version/variant bits.
const shifts=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
const constants=Int32Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296));
export function nameUuid(bytes){
 const size=Math.ceil((bytes.length+9)/64)*64,data=new Uint8Array(size);data.set(bytes);data[bytes.length]=128;
 const view=new DataView(data.buffer);view.setUint32(size-8,bytes.length*8,true);view.setUint32(size-4,Math.floor(bytes.length/536870912),true);
 let a=0x67452301,b=0xefcdab89|0,c=0x98badcfe|0,d=0x10325476;
 for(let offset=0;offset<size;offset+=64){let A=a,B=b,C=c,D=d;
  for(let i=0;i<64;i++){const round=i>>4,g=round===0?i:round===1?(5*i+1)%16:round===2?(3*i+5)%16:7*i%16;
   const f=round===0?(B&C)|(~B&D):round===1?(D&B)|(~D&C):round===2?B^C^D:C^(B|~D),shift=shifts[round*4+i%4];
   const sum=(A+f+constants[i]+view.getInt32(offset+g*4,true))|0;A=D;D=C;C=B;B=(B+((sum<<shift)|(sum>>>(32-shift))))|0;
  }a=(a+A)|0;b=(b+B)|0;c=(c+C)|0;d=(d+D)|0;
 }
 const result=new Uint8Array(16),out=new DataView(result.buffer);[a,b,c,d].forEach((v,i)=>out.setInt32(i*4,v,true));result[6]=(result[6]&15)|48;result[8]=(result[8]&63)|128;
 const hex=Array.from(result,v=>v.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
