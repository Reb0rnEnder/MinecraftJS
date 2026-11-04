// Public-key verification only. Pure JS keeps HTTP LAN/file clients functional.
import {sha1} from './mccrypto.js';
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const ror=(n,b)=>(n>>>b)|(n<<(32-b));
export function sha256(data){
 const size=Math.ceil((data.length+9)/64)*64,bytes=new Uint8Array(size);bytes.set(data);bytes[data.length]=128;const view=new DataView(bytes.buffer);view.setBigUint64(size-8,BigInt(data.length)*8n);
 const state=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64);
 for(let offset=0;offset<size;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(ror(a,7)^ror(a,18)^(a>>>3))+w[i-7]+(ror(b,17)^ror(b,19)^(b>>>10)))>>>0;}
 let[a,b,c,d,e,f,g,h]=state;for(let i=0;i<64;i++){const t1=(h+(ror(e,6)^ror(e,11)^ror(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0,t2=((ror(a,2)^ror(a,13)^ror(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}[a,b,c,d,e,f,g,h].forEach((v,i)=>state[i]=(state[i]+v)>>>0);
 }
 const out=new Uint8Array(32),ov=new DataView(out.buffer);state.forEach((v,i)=>ov.setUint32(i*4,v));return out;
}
const toBig=bytes=>{let n=0n;for(const b of bytes)n=(n<<8n)|BigInt(b);return n;};
export function parseRsaPublicKey(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>1024)throw Error('Invalid RSA public key');
 const read=(at,tag,limit=bytes.length)=>{if(at+2>limit||bytes[at++]!==tag)throw Error('Invalid RSA DER tag');let len=bytes[at++];if(len&128){const count=len&127;if(count<1||count>2||at+count>limit||bytes[at]===0)throw Error('Invalid RSA DER length');len=0;for(let i=0;i<count;i++)len=len*256+bytes[at++];if(len<128)throw Error('Non-canonical RSA DER length');}if(at+len>limit)throw Error('Truncated RSA DER');return{start:at,end:at+len};};
 const root=read(0,48);if(root.end!==bytes.length)throw Error('Trailing RSA DER');const alg=read(root.start,48,root.end),oid=read(alg.start,6,alg.end),rsaOid=[42,134,72,134,247,13,1,1,1];if(oid.end-oid.start!==rsaOid.length||rsaOid.some((v,i)=>v!==bytes[oid.start+i]))throw Error('Non-RSA key');if(oid.end!==alg.end){const nil=read(oid.end,5,alg.end);if(nil.start!==nil.end||nil.end!==alg.end)throw Error('Invalid RSA parameters');}
 const bits=read(alg.end,3,root.end);if(bits.end!==root.end||bytes[bits.start]!==0)throw Error('Invalid RSA bit string');const seq=read(bits.start+1,48,bits.end);if(seq.end!==bits.end)throw Error('Invalid RSA sequence');
 const ni=read(seq.start,2,seq.end),ei=read(ni.end,2,seq.end);if(ei.end!==seq.end)throw Error('Trailing RSA integers');
 const integer=t=>{if(t.start===t.end||bytes[t.start]&128)throw Error('Negative RSA integer');let start=t.start;if(bytes[start]===0){if(start+1===t.end||!(bytes[start+1]&128))throw Error('Non-canonical RSA integer');start++;}return bytes.subarray(start,t.end);};
 const modulus=integer(ni),exponent=integer(ei);if(![256,512].includes(modulus.length)||!(modulus[0]&128)||exponent.length>4)throw Error('Unsupported RSA key size');const n=toBig(modulus),e=toBig(exponent);if(!(n&1n)||e<3n||!(e&1n))throw Error('Invalid RSA public key');return{n,e,size:modulus.length};
}
const SHA256_PREFIX=Uint8Array.from([48,49,48,13,6,9,96,134,72,1,101,3,4,2,1,5,0,4,32]),SHA1_PREFIX=Uint8Array.from([48,33,48,9,6,5,43,14,3,2,26,5,0,4,20]);
export function verifyRsa(key,signature,data,algorithm='SHA-256'){
 try{if(signature?.length!==key.size||!['SHA-256','SHA-1'].includes(algorithm))return false;let b=toBig(signature),e=key.e,out=1n;if(b>=key.n)return false;while(e){if(e&1n)out=out*b%key.n;b=b*b%key.n;e>>=1n;}
 const encoded=new Uint8Array(key.size);for(let i=encoded.length-1;i>=0;i--){encoded[i]=Number(out&255n);out>>=8n;}
 const digest=algorithm==='SHA-1'?sha1(data):sha256(data),prefix=algorithm==='SHA-1'?SHA1_PREFIX:SHA256_PREFIX,separator=encoded.length-prefix.length-digest.length-1;
 if(separator<10||encoded[0]!==0||encoded[1]!==1||encoded[separator]!==0)return false;
 for(let i=2;i<separator;i++)if(encoded[i]!==255)return false;
 let diff=0;for(let i=0;i<prefix.length;i++)diff|=encoded[separator+1+i]^prefix[i];for(let i=0;i<digest.length;i++)diff|=encoded[separator+1+prefix.length+i]^digest[i];return diff===0;
 }catch{return false;}
}
