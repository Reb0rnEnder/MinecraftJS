import{componentFromNbt}from'../net/component-nbt-1.20.6.js';import{chatToLegacy}from'../gui/chat.js';
const STYLE_KEYS=['color','bold','italic','underlined','strikethrough','obfuscated','clickEvent','hoverEvent','insertion','font'];
// 26.3's Style map codec uses snake_case for the shadow colour; the visual number-format
// fields are shared. Click/hover events are not part of a score's number format and stay out.
const STYLE_KEYS_26_3=[['color','color'],['shadow_color','shadowColor'],['bold','bold'],['italic','italic'],['underlined','underlined'],['strikethrough','strikethrough'],['obfuscated','obfuscated'],['insertion','insertion'],['font','font']];
export function readScoreFormat766(id,nbt){
 if(id===null||id===undefined)return null;
 if(id===0)return{type:'blank'};
 if(id===2)return{type:'fixed',value:componentFromNbt(nbt)};
 if(id!==1||nbt?.t!==10)throw Error('Invalid scoreboard number format');
 const style=Object.fromEntries((nbt?.t===10&&nbt.v?.shadow_color?STYLE_KEYS_26_3:STYLE_KEYS.map(key=>[key,key])).filter(([key])=>Object.hasOwn(nbt?.v||{},key)).map(([key,out])=>[out,nbt.v[key]]));
 const decoded=componentFromNbt({t:10,v:{...style,text:{t:8,v:''}}});delete decoded.text;return{type:'styled',style:decoded};
}
export function formatScore766(value,format,context='sidebar'){
 if(format?.type==='blank')return '';
 if(format?.type==='fixed')return chatToLegacy(format.value,{parsed:true});
 const style=format?.style??(context==='sidebar'?{color:'red'}:context==='list'?{color:'yellow'}:{});
 return chatToLegacy({...style,text:String(value)},{parsed:true});
}
