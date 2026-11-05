// TranslatableContents.decomposeTemplate (1.19.4). Invalid formats retain the
// entire template; absent arguments are not silently deleted from messages.
export function formatComponentTranslation(template,args){
 let out='',end=0,next=0;
 for(const match of template.matchAll(/%(?:(\d+)\$)?([A-Za-z%]|$)/g)){
  const prefix=template.slice(end,match.index);if(prefix.includes('%'))return template;
  out+=prefix;
  if(match[0]==='%%')out+='%';
  else if(match[2]==='s'){
   const index=match[1]===undefined?next++:Number(match[1])-1;
   if(!Number.isSafeInteger(index)||index<0||index>=args.length)return template;
   out+=args[index]===null?'null':String(args[index]);
  }else return template;
  end=match.index+match[0].length;
 }
 const suffix=template.slice(end);return suffix.includes('%')?template:out+suffix;
}

// Language.load normalizes numeric placeholders; component fallback templates
// are supplied by the server and do not pass through that language-file step.
export function componentTemplate(language,key,fallback){
 const value=language?.[key];
 return value!==undefined&&value!==null?String(value).replace(/%(\d+\$)?[\d.]*[df]/g,'%$1s'):fallback??key;
}
