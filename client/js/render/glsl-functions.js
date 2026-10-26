// Deliberately small GLSL function selector. GLSL itself is compiled by the GPU, never evaluated as JavaScript.
export function selectGLSLFunctions(source,root){
 const tokens=[];const lex=/\/\*[\s\S]*?\*\/|\/\/[^\n]*|^\s*#[^\n]*|[A-Za-z_]\w*|[^\s]/gm;let m;
 while((m=lex.exec(source)))if(!m[0].startsWith('/*')&&!m[0].startsWith('//')&&!m[0].trimStart().startsWith('#'))tokens.push({text:m[0],start:m.index,end:lex.lastIndex});
 const match=(at,open,close)=>{let depth=0;for(let j=at;j<tokens.length;j++){if(tokens[j].text===open)depth++;if(tokens[j].text===close&&!--depth)return j;}throw Error('Unbalanced GLSL '+open);};
 const functions=new Map(),constants=new Map();let depth=0;
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i];
  if(!depth&&t.text==='const'){
   let j=i;while(j<tokens.length&&tokens[j].text!==';')j++;if(j===tokens.length)throw Error('Unterminated GLSL constant');
   constants.set(tokens[i+2]?.text,{start:t.start,end:tokens[j].end,text:source.slice(t.start,tokens[j].end)});i=j;continue;
  }
  if(!depth&&t.text==='('&&i>=2&&/^[A-Za-z_]\w*$/.test(tokens[i-1].text)){
   const endParams=match(i,'(',')');if(tokens[endParams+1]?.text==='{'){
    const end=match(endParams+1,'{','}'),name=tokens[i-1].text;
    if(functions.has(name))throw Error('GLSL function overloads are not supported by the selector: '+name);
    functions.set(name,{start:tokens[i-2].start,end:tokens[end].end,text:source.slice(tokens[i-2].start,tokens[end].end)});i=end;continue;
   }
  }
  if(t.text==='{')depth++;if(t.text==='}')depth--;
 }
 if(!functions.has(root))throw Error('Missing GLSL entry function: '+root);
 const selected=new Map();const visit=name=>{
  if(selected.has(name))return;const item=functions.get(name)||constants.get(name);if(!item)return;selected.set(name,item);
  for(const word of item.text.match(/[A-Za-z_]\w*/g)||[])if(word!==name)visit(word);
 };visit(root);
 return {source:[...selected.values()].sort((a,b)=>a.start-b.start).map(v=>v.text).join('\n'),functions:[...selected.keys()].filter(k=>functions.has(k))};
}

// The block.properties subset used by BSL: version comparisons, continuations and block-state selectors.
export function shaderBlockRules(source,version){
 const lines=source.replace(/\\\r?\n/g,' ').split(/\r?\n/),stack=[],rules=[];let active=true;
 const condition=s=>{const m=/^MC_VERSION\s*(>=|<=|==|>|<)\s*(\d+)$/.exec(s.trim());if(!m)throw Error('Unsupported block.properties condition: '+s);const n=Number(m[2]);return m[1]==='>='?version>=n:m[1]==='<='?version<=n:m[1]==='=='?version===n:m[1]==='>'?version>n:version<n;};
 for(const line of lines){
  const d=/^\s*#(if|elif|else|endif)\b\s*(.*)$/.exec(line);
  if(d){const [,op,expr]=d;if(op==='if'){const yes=condition(expr);stack.push({parent:active,taken:yes});active=active&&yes;}else{const top=stack.at(-1);if(!top)throw Error('Unmatched block.properties '+op);if(op==='endif'){active=top.parent;stack.pop();}else{const yes=op==='else'||condition(expr);active=top.parent&&!top.taken&&yes;top.taken||=yes;}}continue;}
  if(!active)continue;const rule=/^\s*block\.(\d+)\s*=\s*(.*)$/.exec(line);if(!rule)continue;
  const id=Number(rule[1]);if(id>65535)throw Error('Block animation ID exceeds packed lookup range');
  for(const selector of rule[2].split(/\s+/).filter(Boolean)){const parts=selector.split(':');const name=parts[0]==='minecraft'?parts[1]:parts[0],properties={};for(const p of parts.slice(parts[0]==='minecraft'?2:1)){const [key,value]=p.split('=');if(!key||!value)throw Error('Unsupported block selector: '+selector);properties[key]=value.split(',');}rules.push({id,name,properties});}
 }
 if(stack.length)throw Error('Unclosed block.properties conditional');return rules;
}
export function animationLookup(rules,states){
 const data=new Uint8Array(256*Math.ceil(states.length/256)*4),byName=new Map();for(const r of rules){if(!byName.has(r.name))byName.set(r.name,[]);byName.get(r.name).push(r);}
 for(const state of states){let id=0;for(const r of byName.get(state.name)||[])if(Object.entries(r.properties).every(([key,values])=>values.includes(String(state.properties[key]))))id=r.id;
  data[state.id*4]=id&255;data[state.id*4+1]=id>>8;data[state.id*4+3]=255;
 }return {width:256,height:Math.ceil(states.length/256),data};
}

// Small desktop-to-ES numeric bridge: desktop GLSL permits int literals next to float/vector symbols.
// Preserve integer loop counters and indices; remaining type checking belongs to the GLSL compiler.
export function glslFloatLiterals(source){
 const names=[...new Set([...source.matchAll(/\b(?:float|vec[234]|mat[234])\s+([A-Za-z_]\w*)/g)].map(m=>m[1]))];
 if(!names.length)return source;const symbols='(?:'+names.join('|')+')';
 return source.replace(new RegExp('(?<![\\w.])(\\d+)\\s*([*/+\\-])\\s*('+symbols+')\\b','g'),'$1.0 $2 $3').replace(new RegExp('\\b('+symbols+')\\s*([*/+\\-])\\s*(\\d+)(?![.\\w])','g'),'$1 $2 $3.0');
}
