import { tr } from './i18n.js';
// Native 1.19.4 GuiMessageTag. A signature's presence alone never establishes trust.
export const SYSTEM_CHAT_TAG=Object.freeze({color:0xd0d0d0,key:'chat.tag.system',logTag:'System'});
export const UNVERIFIED_CHAT_TAG=Object.freeze({color:0xd0d0d0,key:'chat.tag.not_secure',logTag:'Not Secure'});
export function chatTrustTag(trust,original=''){
 if(trust==='secure')return null;
 if(trust==='modified')return{color:0x606060,key:'chat.tag.modified',icon:true,original,logTag:'Modified'};
 return UNVERIFIED_CHAT_TAG;
}
export function chatTagTooltip(tag){return tag?[tr(tag.key),...(tag.original!==undefined?['§o'+tag.original]:[])]:null;}
