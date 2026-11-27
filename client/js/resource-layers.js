import {decodeUtf8} from './util/utf8.js';
function pattern(source){
  if(source===undefined)return ()=>true;
  if(typeof source!=='string')throw Error('Invalid resource filter pattern');
  let flags='u';source=source.replace(/^\(\?([ism]+)\)/,(_,s)=>{for(const c of s)if(!flags.includes(c))flags+=c;return '';});
  source=source.replace(/\\Q([\s\S]*?)\\E/g,(_,s)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const regex=new RegExp(source,flags);return value=>regex.test(value);
}
function optionalPattern(source){try{return pattern(source);}catch{return ()=>true;}}
export function resourceFilter(metadata){
  if(metadata===undefined)return ()=>false;
  if(!metadata||!Array.isArray(metadata.block))throw Error('Invalid resource filter block list');
  const entries=metadata.block.map(e=>{if(!e||typeof e!=='object'||Array.isArray(e))throw Error('Invalid resource filter entry');return [optionalPattern(e.namespace),optionalPattern(e.path)];});
  // Exact target semantics: namespaces and paths are matched independently.
  return (namespace,path)=>entries.some(e=>e[0](namespace))&&entries.some(e=>e[1](path));
}
export const resourceParts=location=>{const i=location.indexOf(':');return i<0?['minecraft',location]:[i===0?'minecraft':location.slice(0,i),location.slice(i+1)];};
export function packResource(pack,namespace,path){const key=pack.prefix+'assets/'+namespace+'/'+path;if(pack.zip?.has(key))return pack.zip.read(key);return namespace==='minecraft'&&pack.has?.(path)?pack.read(path):null;}
export function resourceBlockedAbove(packs,owner,namespace,path){for(const pack of packs){if(pack===owner)return false;if(pack.blocksResource?.(namespace,path))return true;}return false;}
export async function readResourceStack(assets,location){
  const [namespace,path]=resourceParts(location),resources=[];
  for(const pack of assets.packs||[]){const bytes=packResource(pack,namespace,path);if(bytes!==null)resources.push({pack,bytes});if(pack.blocksResource?.(namespace,path))return resources;}
  const bytes=await assets.source.bytes(namespace+'/'+path);if(bytes!==null&&bytes!==undefined)resources.push({pack:null,bytes});
  // packs moved below Default
  for(const pack of assets.lowerPacks||[]){const lower=packResource(pack,namespace,path);if(lower!==null)resources.push({pack,bytes:lower});if(pack.blocksResource?.(namespace,path))break;}
  return resources;
}
export async function readResourceBytes(assets,location){
  const [namespace,path]=resourceParts(location);
  for(const pack of assets.packs||[]){const bytes=packResource(pack,namespace,path);if(bytes!==null)return bytes;if(pack.blocksResource?.(namespace,path))return null;}
  const base=await assets.source.bytes(namespace+'/'+path);if(base!==null&&base!==undefined)return base;
  for(const pack of assets.lowerPacks||[]){const bytes=packResource(pack,namespace,path);if(bytes!==null)return bytes;if(pack.blocksResource?.(namespace,path))return null;}
  return base??null;
}
export async function resourceMetadata(assets,location){
  const [namespace,path]=resourceParts(location);let metadata=null,filtered=false;
  for(const pack of assets.packs||[]){
    if(metadata===null&&!filtered)metadata=packResource(pack,namespace,path+'.mcmeta');
    if(packResource(pack,namespace,path)!==null)return {bytes:metadata,base:false,filtered};
    if(pack.blocksResource?.(namespace,path))return {bytes:null,base:false,filtered:true};
    if(pack.blocksResource?.(namespace,path+'.mcmeta'))filtered=true;
  }
  const vanilla=await assets.source.bytes(namespace+'/'+path);
  if(vanilla!==null&&vanilla!==undefined||!(assets.lowerPacks||[]).length){
    if(metadata===null&&!filtered)metadata=await assets.source.bytes(namespace+'/'+path+'.mcmeta');
    return {bytes:metadata,base:true,filtered};
  }
  for(const pack of assets.lowerPacks){
    if(metadata===null&&!filtered)metadata=packResource(pack,namespace,path+'.mcmeta');
    if(packResource(pack,namespace,path)!==null)return {bytes:metadata,base:false,filtered};
    if(pack.blocksResource?.(namespace,path))return {bytes:null,base:false,filtered:true};
  }
  return {bytes:metadata,base:true,filtered};
}
export function resourceNamespaces(assets){const namespaces=new Set(['minecraft']);for(const pack of [...(assets.packs||[]),...(assets.lowerPacks||[])])for(const p of pack.zip?.list(pack.prefix+'assets/')||[]){const name=p.slice((pack.prefix+'assets/').length).split('/')[0];if(/^[a-z0-9_.-]+$/.test(name)&&!/[\r\n]/.test(name))namespaces.add(name);}return [...namespaces];}
