// Integer.parseInt(String): signed decimal UTF-16 digits, with overflow rejection.
export function parseJavaInteger(text) {
  if(typeof text!=='string')return null;
  const negative=text[0]==='-',start=negative||text[0]==='+'?1:0;
  if(start===text.length)return null;
  let n=0;
  for(let i=start;i<text.length;i++){
    const c=text[i];if(!/\p{Nd}/u.test(c))return null;
    let zero=c.charCodeAt(0);while(zero>0&&/\p{Nd}/u.test(String.fromCharCode(zero-1)))zero--;
    n=n*10+(c.charCodeAt(0)-zero)%10;if(n>2147483648)return null;
  }
  if(!negative&&n>2147483647)return null;
  return negative&&n?-n:n;
}
