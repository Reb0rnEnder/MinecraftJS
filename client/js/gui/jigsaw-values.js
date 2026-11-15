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
  if(/[^a-z0-9_.-]/.test(namespace))throw Error('Non [a-z0-9_.-] character in namespace of location: '+namespace+':'+path);
  if(/[^a-z0-9/._-]/.test(path))throw Error('Non [a-z0-9/._-] character in path of location: '+namespace+':'+path);
  return namespace+':'+path;
}
