// Protocol BitSet words are unsigned little-indexed 64-bit words. JS bitwise
// operators silently truncate to 32 bits; retain the entire native bit set.
export function bitsetValue(words){let value=0n;for(let i=words.length-1;i>=0;i--)value=(value<<64n)|BigInt.asUintN(64,BigInt(words[i]));return value;}
export function maskValue(value){if(typeof value==='bigint'){if(value<0n)throw Error('Invalid negative section mask');return value;}if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid section mask');return BigInt(value);}
export const maskHas=(value,bit)=>bit>=0&&!!(maskValue(value)&(1n<<BigInt(bit)));
export const maskFits=(value,bits)=>(maskValue(value)>>BigInt(bits))===0n;
export const maskHighest=value=>{const n=maskValue(value);return n===0n?-1:n.toString(2).length-1;};
export const compactMask=value=>value<=BigInt(Number.MAX_SAFE_INTEGER)?Number(value):value;
