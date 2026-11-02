import {DEFAULT_SKINS_762,DEFAULT_SKIN_762} from './default-skin-data-1.19.4.js';
export {DEFAULT_SKIN_762 as DEFAULT_SKIN};
// Java UUID.hashCode, followed by Math.floorMod(hash, 18), not abs or a parity bit.
export function uuidHash(uuid){
 const hex=typeof uuid==='string'?uuid.replace(/-/g,''):'';
 if(!/^[0-9a-f]{32}$/i.test(hex))return null;
 return (parseInt(hex.slice(0,8),16)^parseInt(hex.slice(8,16),16)^parseInt(hex.slice(16,24),16)^parseInt(hex.slice(24,32),16))|0;
}
export function defaultSkin(uuid){const hash=uuidHash(uuid);return hash===null?{path:DEFAULT_SKIN_762,slim:true}:DEFAULT_SKINS_762[((hash%18)+18)%18];}

export function profileDefaultSkin(owner){const id=owner?.Id??owner?.id;if((Array.isArray(id)||ArrayBuffer.isView(id))&&id.length===4)return defaultSkin(Array.from(id,n=>(n>>>0).toString(16).padStart(8,'0')).join(''));return defaultSkin(id);}
