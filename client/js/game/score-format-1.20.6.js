import{componentFromNbt}from'../net/component-nbt-1.20.6.js';import{chatToLegacy}from'../gui/chat.js';
const STYLE_KEYS=['color','bold','italic','underlined','strikethrough','obfuscated','clickEvent','hoverEvent','insertion','font'];
export function readScoreFormat766(id,nbt){
 if(id===null||id===undefined)return null;
 if(id===0)return{type:'blank'};
 if(id===2)return{type:'fixed',value:componentFromNbt(nbt)};
 if(id!==1||nbt?.t!==10)throw Error('Invalid scoreboard number format');
 const style=Object.fromEntries(STYLE_KEYS.filter(key=>Object.hasOwn(nbt.v,key)).map(key=>[key,nbt.v[key]]));
 const decoded=componentFromNbt({t:10,v:{...style,text:{t:8,v:''}}});delete decoded.text;return{type:'styled',style:decoded};
}
export function formatScore766(value,format,context='sidebar'){
 if(format?.type==='blank')return '';
 if(format?.type==='fixed')return chatToLegacy(format.value,{parsed:true});
 const style=format?.style??(context==='sidebar'?{color:'red'}:context==='list'?{color:'yellow'}:{});
 return chatToLegacy({...style,text:String(value)},{parsed:true});
}
