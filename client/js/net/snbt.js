import { TAG } from './nbt.js';
// Typed SNBT for chat hover payloads. Kept separate from JSON chat parsing.
export function parseSnbt(text) {
  if(typeof text!=='string'||text.length>262144)throw new Error('Invalid SNBT');
  let i=0;const skip=()=>{while(/\s/.test(text[i]||'')&&i<text.length)i++;};
  const quoted=()=>{const quote=text[i++];let out='';while(i<text.length){let c=text[i++];if(c===quote)return out;if(c==='\\'){c=text[i++];if(c!==quote&&c!=='\\')throw new Error('Invalid escape');}out+=c;}throw new Error('Unclosed string');};
  const token=()=>{const start=i;while(i<text.length&&!/[\s,\]}]/.test(text[i]))i++;if(i===start)throw new Error('Expected value');return text.slice(start,i);};
  const number=s=>{
    const m=s.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([bslfd]?)$/i);
    if(!m)return {t:TAG.STRING,v:s};
    const suffix=m[2].toLowerCase(),v=Number(m[1]),t=({b:1,s:2,l:4,f:5,d:6})[suffix]||(/^[+-]?\d+$/.test(s)?3:6);
    if(!Number.isFinite(v)||[1,2,3,4].includes(t)&&!Number.isInteger(v))return {t:TAG.STRING,v:s};
    if(t===4){try{return {t,v:BigInt(m[1])};}catch{return {t:TAG.STRING,v:s};}}
    return {t,v};
  };
  const value=depth=>{
    if(depth>128)throw new Error('SNBT too deep');skip();
    if(text[i]==='"'||text[i]==="'")return {t:8,v:quoted()};
    if(text[i]==='{') {
      i++;const v=Object.create(null);skip();while(text[i]!=='}'){
        const start=i,key=text[i]==='"'||text[i]==="'"?quoted():(()=>{while(/[\w.+-]/.test(text[i]||'')&&i<text.length)i++;return text.slice(start,i);})();
        if(i===start)throw new Error('Expected key');skip();if(text[i++]!==':')throw new Error('Expected colon');v[key]=value(depth+1);skip();if(text[i]===','){i++;skip();}else if(text[i]!=='}')throw new Error('Expected compound end');
      }i++;return {t:10,v};
    }
    if(text[i]==='['){
      i++;skip();let array=null;if(/[BIL]/.test(text[i]||'')&&text[i+1]===';'){array=text[i];i+=2;skip();}
      const entries=[];while(text[i]!==']'){
        // 1.8 NBTTagList.toString prefixes list elements with their indices.
        const index=text.slice(i).match(/^\d+:/);if(index)i+=index[0].length;
        entries.push(value(depth+1));skip();if(text[i]===','){i++;skip();}else if(text[i]!==']')throw new Error('Expected list end');
      }i++;const et=entries[0]?.t||0;if(entries.some(e=>e.t!==et))throw new Error('Mixed list');
      if(array){const t={B:7,I:11,L:12}[array],expected={B:1,I:3,L:4}[array];if(entries.some(e=>e.t!==expected))throw new Error('Invalid array');return {t,v:entries.map(e=>e.v)};}
      return {t:9,v:{et,items:entries.map(e=>e.v)}};
    }
    const s=token();if(s==='true'||s==='false')return {t:1,v:s==='true'?1:0};return number(s);
  };
  const result=value(0);skip();if(i!==text.length)throw new Error('Trailing SNBT');return result;
}
