// Clipboard API requires a secure context. Canvas text fields also need to work
// on ordinary HTTP/LAN hosting, using the browser's copy command when necessary.
export async function writeClipboard(text,nav=globalThis.navigator,doc=globalThis.document){
 text=String(text);
 if(nav?.clipboard?.writeText)try{await nav.clipboard.writeText(text);return true;}catch{}
 if(!doc?.body||!doc.execCommand)return false;
 const previous=doc.activeElement,field=doc.createElement('textarea');
 field.value=text;field.readOnly=true;field.tabIndex=-1;
 Object.assign(field.style,{position:'fixed',left:'-10000px',top:'0',opacity:'0'});
 doc.body.appendChild(field);
 try{field.focus({preventScroll:true});field.select();return !!doc.execCommand('copy');}
 catch{return false;}
 finally{field.remove();previous?.focus?.({preventScroll:true});}
}
