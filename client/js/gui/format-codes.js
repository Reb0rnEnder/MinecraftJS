// Keep RGB styles intact through the existing formatted-text API. RGB uses six
// section-sign digit pairs, so plain-text consumers remove it with the other codes.
export function formatCode(text,index){
 if(text[index]!=='§'||index+1>=text.length)return null;
 if(text[index+1]==='z'){
  let name='',end=index+2;for(;end<Math.min(text.length,index+516)&&text[end]==='§';end+=2){if(text[end+1]===';')break;name+=text[end+1]||'';}
  if(text.slice(end,end+2)==='§;'&&/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(name))return {raw:text.slice(index,end+2),length:end+2-index,font:name,code:'z'};
 }
 if(text[index+1].toLowerCase()==='x'){
  const raw=text.slice(index,index+14);
  if(/^§x(?:§[0-9a-f]){6}$/i.test(raw))return {raw,length:14,color:parseInt(raw.slice(2).replaceAll('§',''),16),code:'x'};
 }
 return {raw:text.slice(index,index+2),length:2,code:text[index+1].toLowerCase()};
}
export function activeFormatting(text){
 let font='',style='';for(let i=0;i<text.length;i++){const token=formatCode(text,i);if(!token)continue;
  if(token.font)font=token.raw;
  else if(token.code==='r'){font='';style=token.raw;}
  else style=token.color!==undefined||/[0-9a-f]/.test(token.code)?token.raw:style+token.raw;
  i+=token.length-1;
 }return font+style;
}

export const rgbCode=hex=>'§x'+[...hex.replace(/^#/,'')].map(c=>'§'+c).join('');

export const fontCode=id=>'§z'+[...id].map(c=>'§'+c).join('')+'§;';
