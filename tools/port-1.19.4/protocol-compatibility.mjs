// Shared-type dependency checks for candidate packet inheritance.
export function compatible(before,after,state,direction,name){
 const a={...before.types,...before[state][direction].types},b={...after.types,...after[state][direction].types},seen=new Set();
 function check(name){if(seen.has(name))return true;seen.add(name);if(JSON.stringify(a[name])!==JSON.stringify(b[name]))return false;
  function refs(value){if(typeof value==='string')return !(value in a||value in b)||check(value);if(Array.isArray(value))return value.every(refs);if(value&&typeof value==='object')return Object.values(value).every(refs);return true;}
  return refs(a[name]);
 }
 return !!a['packet_'+name]&&check('packet_'+name);
}
