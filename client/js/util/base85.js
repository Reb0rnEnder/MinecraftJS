const alphabet=Array.from({length:94},(_,i)=>String.fromCharCode(33+i)).filter(c=>!'<>&'.includes(c)).slice(0,85).join('');
export function decodeBase85(text,length){
 if(!Number.isSafeInteger(length)||length<0||text.length!==Math.ceil(length/4)*5)throw Error('Invalid packed data length');
 const table=new Int16Array(128).fill(-1);for(let i=0;i<85;i++)table[alphabet.charCodeAt(i)]=i;
 const out=new Uint8Array(length);let pos=0;
 for(let i=0;i<text.length;i+=5){let value=0;for(let j=0;j<5;j++){const n=table[text.charCodeAt(i+j)];if(n===undefined||n<0)throw Error('Invalid packed data');value=value*85+n;}if(value>0xffffffff)throw Error('Invalid packed word');for(let j=3;j>=0&&pos<length;j--)out[pos++]=value>>>(j*8);}
 return out;
}
