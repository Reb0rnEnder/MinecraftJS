// Native sign renderers draw the first wrapped line for each of four messages.
// Hanging-sign limits differ by release and are supplied by the caller.
export function signTextItems(font,lines,style={},width=90,lineHeight=10){
 const items=[];for(let i=0;i<4;i++){const text=font.wrap(lines[i]||'',width)[0]||'';if(text)items.push({text,x:Math.trunc(-font.width(text)/2),y:(i-2)*lineHeight,...style});}return items;
}
