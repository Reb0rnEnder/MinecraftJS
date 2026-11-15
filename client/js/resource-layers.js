import {decodeUtf8} from './util/utf8.js';
const nativeInt=n=>{if(typeof n!=='number'||!Number.isFinite(n))throw Error('Invalid overlay format');return Math.trunc(n)|0;};
export function overlayDirectories(metadata,format){
  if(metadata===undefined)return [];
  if(!metadata||!Array.isArray(metadata.entries))throw Error('Invalid overlays entries');
  return metadata.entries.filter(entry=>{
    if(typeof entry.directory!=='string'||!/^[A-Za-z0-9_.-]+$/.test(entry.directory)||/[\r\n]/.test(entry.directory))throw Error('Invalid overlay directory');
    const v=entry.formats;let min,max;
    if(typeof v==='number')min=max=v;
    else if(Array.isArray(v)&&v.length===2)[min,max]=v;
    else if(v&&typeof v==='object'&&!Array.isArray(v)){min=v.min_inclusive;max=v.max_inclusive;}
    min=nativeInt(min);max=nativeInt(max);if(min>max)throw Error('Invalid overlay format range');
    return format>=min&&format<=max;
  }).map(e=>e.directory);
}
function pattern(source){
  if(source===undefined)return ()=>true;
  if(typeof source!=='string')throw Error('Invalid resource filter pattern');
  let flags='u';source=source.replace(/^\(\?([ism]+)\)/,(_,s)=>{for(const c of s)if(!flags.includes(c))flags+=c;return '';});
  source=source.replace(/\\Q([\s\S]*?)\\E/g,(_,s)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const regex=new RegExp(source,flags);return value=>regex.test(value);
}
export function resourceFilter(metadata){
  if(metadata===undefined)return ()=>false;
  if(!metadata||!Array.isArray(metadata.block))throw Error('Invalid resource filter block list');
  const entries=metadata.block.map(e=>{if(!e||typeof e!=='object'||Array.isArray(e))throw Error('Invalid resource filter entry');return [pattern(e.namespace),pattern(e.path)];});
  // Exact target semantics: namespaces and paths are matched independently.
  return (namespace,path)=>entries.some(e=>e[0](namespace))&&entries.some(e=>e[1](path));
}
export class OverlayZip {
  constructor(zip,prefix,directories){this.raw=zip;this.prefix=prefix;this.directories=[...directories].reverse();this.entries=zip.entries;}
  rootPrefix(){return this.prefix;}
  _paths(path){const rel=path.slice(this.prefix.length);return path.startsWith(this.prefix)&&/^(assets|data)\//.test(rel)?[...this.directories.map(d=>this.prefix+d+'/'+rel),path]:[path];}
  has(path){return this._paths(path).some(p=>this.raw.has(p));}
  read(path){for(const p of this._paths(path))if(this.raw.has(p))return this.raw.read(p);return null;}
  readText(path){const bytes=this.read(path);return bytes?decodeUtf8(bytes):null;}
  list(prefix=''){
    if(!prefix.startsWith(this.prefix)||! /^(assets|data)\//.test(prefix.slice(this.prefix.length)))return this.raw.list(prefix);
    const names=new Set();for(const base of [...this.directories.map(d=>this.prefix+d+'/'),this.prefix])for(const path of this.raw.list(base+prefix.slice(this.prefix.length)))names.add(this.prefix+path.slice(base.length));return [...names];
  }
}
export const resourceParts=location=>{const i=location.indexOf(':');return i<0?['minecraft',location]:[i===0?'minecraft':location.slice(0,i),location.slice(i+1)];};
export function packResource(pack,namespace,path){const key=pack.prefix+'assets/'+namespace+'/'+path;if(pack.zip?.has(key))return pack.zip.read(key);return namespace==='minecraft'&&pack.has?.(path)?pack.read(path):null;}
export function resourceBlockedAbove(packs,owner,namespace,path){for(const pack of packs){if(pack===owner)return false;if(pack.blocksResource?.(namespace,path))return true;}return false;}
export async function readResourceStack(assets,location){
  const [namespace,path]=resourceParts(location),resources=[];
  for(const pack of assets.packs||[]){const bytes=packResource(pack,namespace,path);if(bytes!==null)resources.push({pack,bytes});if(pack.blocksResource?.(namespace,path))return resources;}
  const bytes=await assets.source.bytes(namespace+'/'+path);if(bytes!==null&&bytes!==undefined)resources.push({pack:null,bytes});return resources;
}
export async function readResourceBytes(assets,location){
  const [namespace,path]=resourceParts(location);
  for(const pack of assets.packs||[]){const bytes=packResource(pack,namespace,path);if(bytes!==null)return bytes;if(pack.blocksResource?.(namespace,path))return null;}
  return assets.source.bytes(namespace+'/'+path);
}
export async function resourceMetadata(assets,location){
  const [namespace,path]=resourceParts(location);let metadata=null,filtered=false;
  for(const pack of assets.packs||[]){
    if(metadata===null&&!filtered)metadata=packResource(pack,namespace,path+'.mcmeta');
    if(packResource(pack,namespace,path)!==null)return {bytes:metadata,base:false,filtered};
    if(pack.blocksResource?.(namespace,path))return {bytes:null,base:false,filtered:true};
    if(pack.blocksResource?.(namespace,path+'.mcmeta'))filtered=true;
  }
  if(metadata===null&&!filtered)metadata=await assets.source.bytes(namespace+'/'+path+'.mcmeta');
  return {bytes:metadata,base:true,filtered};
}
export function resourceNamespaces(assets){const namespaces=new Set(['minecraft']);for(const pack of assets.packs||[])for(const p of pack.zip?.list(pack.prefix+'assets/')||[]){const name=p.slice((pack.prefix+'assets/').length).split('/')[0];if(/^[a-z0-9_.-]+$/.test(name)&&!/[\r\n]/.test(name))namespaces.add(name);}return [...namespaces];}
