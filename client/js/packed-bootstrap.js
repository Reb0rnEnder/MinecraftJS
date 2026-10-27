import {decodeBase85} from './util/base85.js';
import {ungzip} from './lib/pako.esm.mjs';
export async function loadPackedModule(element){
 const bytes=decodeBase85(element.textContent.trim(),Number(element.dataset.bytes));element.remove();
 const source=ungzip(bytes),url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 try{await import(/* @vite-ignore */ url);}finally{URL.revokeObjectURL(url);}
}
const script=globalThis.document?.getElementById('minecraftjs-code');
if(script)loadPackedModule(script).catch(error=>{console.error(error);const node=document.getElementById('loading-text');if(node){node.textContent='Could not start MinecraftJS: '+error.message;node.style.color='#ff5555';}});
