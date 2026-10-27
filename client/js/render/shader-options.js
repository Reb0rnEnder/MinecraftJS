// OptiFine-style option declarations. Values stay tokens, never executable JavaScript.
const token=/^(?:[A-Za-z_]\w*|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/;
export function parseShaderOptions(source){
 const options=new Map();let blockComment=false;
 for(const raw of source.split(/\r?\n/)){
  let line=raw;
  if(blockComment){const end=line.indexOf('*/');if(end<0)continue;line=line.slice(end+2);blockComment=false;}
  line=line.replace(/\/\*.*?\*\//g,'');if(line.includes('/*')){blockComment=true;line=line.slice(0,line.indexOf('/*'));}
  if(/^\s*\/\/\s*Undefine/i.test(line))break;
  const m=/^\s*(\/\/\s*)?#define\s+(\w+)(?:\s+([^/]*?))?\s*(?:\/\/\s*(.*))?$/.exec(line);
  const c=/^\s*const\s+(?:int|float)\s+(\w+)\s*=\s*([^;]+);\s*\/\/\s*(.*)$/.exec(line);
  if(!m&&!c)continue;
  const name=c?c[1]:m[2],value=(c?c[2]:m[3]||'').trim(),comment=c?c[3]:m[4]||'',range=/\[([^\]]+)\]/.exec(comment);
  let values,initial;
  if(range){values=range[1].trim().split(/\s+/);if(!values.every(v=>token.test(v))||!values.includes(value))continue;initial=value;}
  else if(!value&&!c){values=['false','true'];initial=m[1]?'false':'true';}
  else continue;
  if(!options.has(name))options.set(name,{name,values,default:initial,toggle:!value&&!c,constant:!!c});
 }
 return [...options.values()];
}
export function validateShaderOptions(options,values={}){
 const out={};for(const [name,value]of Object.entries(values)){const o=options.find(o=>o.name===name);if(!o||!o.values.includes(String(value)))throw Error('Invalid shader option: '+name);out[name]=String(value);}return out;
}
export function applyShaderOptions(source,values){
 if(!Object.keys(values).length)return source;
 const options=parseShaderOptions(source),valid=validateShaderOptions(options,Object.fromEntries(Object.entries(values).filter(([name])=>options.some(o=>o.name===name))));
 const changed=new Set();return source.replace(/^([^\n]*)$/gm,line=>{
  for(const o of options.filter(o=>valid[o.name]!==undefined)){if(changed.has(o.name)||valid[o.name]===undefined)continue;
   const re=o.constant?new RegExp('^(\\s*const\\s+(?:int|float)\\s+'+o.name+'\\s*=\\s*)[^;]+(;.*)$'):new RegExp('^\\s*(?://\\s*)?#define\\s+'+o.name+'(?:\\s|$)');
   if(!re.test(line))continue;changed.add(o.name);
   if(o.constant)return line.replace(re,(_,a,b)=>a+valid[o.name]+b);
   return (o.toggle&&valid[o.name]==='false'?'//':'')+'#define '+o.name+(o.toggle?'':' '+valid[o.name]);
  }return line;
 });
}
