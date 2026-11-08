// HTML raw-text-safe base85: no '<', '>' or '&'; the payload cannot close its script element.
const alphabet=Array.from({length:94},(_,i)=>String.fromCharCode(33+i)).filter(c=>!'<>&'.includes(c)).slice(0,85).join('');
function encodeBase85(bytes){
 const out=Buffer.alloc(Math.ceil(bytes.length/4)*5);let pos=0;
 for(let i=0;i<bytes.length;i+=4){let v=((bytes[i]||0)*0x1000000)+((bytes[i+1]||0)<<16)+((bytes[i+2]||0)<<8)+(bytes[i+3]||0);for(let j=4;j>=0;j--){out[pos+j]=alphabet.charCodeAt(v%85);v=Math.floor(v/85);}pos+=5;}
 return out.toString('ascii');
}
module.exports={encodeBase85};
