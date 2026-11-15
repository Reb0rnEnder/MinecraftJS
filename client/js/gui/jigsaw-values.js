// ResourceLocation(String) / isValidResourceLocation: an empty path is legal.
export function jigsawResourceParts(text) {
  const i=text.indexOf(':');
  return [i>0?text.slice(0,i):'minecraft',i<0?text:text.slice(i+1)];
}
export function validJigsawResource(text) {
  const [namespace,path]=jigsawResourceParts(text);
  return !/[^a-z0-9_.-]/.test(namespace)&&!/[^a-z0-9/._-]/.test(path);
}
export function jigsawResource(text) {
  const [namespace,path]=jigsawResourceParts(text);
  // ResourceLocation now escapes control and Unicode characters in diagnostics.
  const printable=(namespace+':'+path).replace(/["\\\x00-\x1f\x80-\uffff]/g,c=>({'"':'\\"','\\':'\\\\','\b':'\\b','\t':'\\t','\n':'\\n','\f':'\\f','\r':'\\r'}[c]||'\\u'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')));
  if(/[^a-z0-9_.-]/.test(namespace))throw Error('Non [a-z0-9_.-] character in namespace of location: '+printable);
  if(/[^a-z0-9/._-]/.test(path))throw Error('Non [a-z0-9/._-] character in path of location: '+printable);
  return namespace+':'+path;
}
// JigsawBlockEditScreen returns zero on Integer.parseInt failure.
export function jigsawPriority(text) {
  const negative=text[0]==='-',start=negative||text[0]==='+'?1:0;
  if(start===text.length)return 0;
  let n=0;
  for(let i=start;i<text.length;i++){
    const c=text[i];if(!/\p{Nd}/u.test(c))return 0;
    let zero=c.charCodeAt(0);while(zero>0&&/\p{Nd}/u.test(String.fromCharCode(zero-1)))zero--;
    n=n*10+(c.charCodeAt(0)-zero)%10;if(n>2147483648)return 0;
  }
  if(!n)return 0;
  return negative?-n:n<=2147483647?n:0;
}
