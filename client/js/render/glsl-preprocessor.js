// Conditional selection only. Macro/function bodies remain GLSL for the GPU;
// expressions are parsed as tokens, never evaluated as JavaScript.
export function glslCondition(expression,macros,chain=[]){
 const tokens=expression.match(/0x[\da-f]+|(?:\d*\.)?\d+|[A-Za-z_]\w*|&&|\|\||==|!=|<=|>=|<<|>>|[^\s]/gi)||[];let at=0;
 const rank={'||':1,'&&':2,'|':3,'^':4,'&':5,'==':6,'!=':6,'<':7,'>':7,'<=':7,'>=':7,'<<':8,'>>':8,'+':9,'-':9,'*':10,'/':10,'%':10};
 const unary=()=>{
  const t=tokens[at++];
  if(t==='!')return +!unary();if(t==='~')return ~unary();if(t==='-')return -unary();if(t==='+')return unary();
  if(t==='('){const value=parse(0);if(tokens[at++]!==')')throw Error('Unbalanced shader condition');return value;}
  if(t==='defined'){const par=tokens[at]==='(';if(par)at++;const value=+macros.has(tokens[at++]);if(par&&tokens[at++]!==')')throw Error('Invalid defined()');return value;}
  if(t&&/^\d|^\.\d/.test(t))return Number(t);
  if(t&&/^[A-Za-z_]\w*$/.test(t)){if(!macros.has(t))return 0;if(chain.includes(t)||chain.length>32)throw Error('Recursive shader condition macro: '+t);return glslCondition(macros.get(t)||'1',macros,[...chain,t]);}
  throw Error('Unsupported shader condition token: '+t);
 };
 const apply=(op,a,b)=>{switch(op){case'||':return +(!!a||!!b);case'&&':return +(!!a&&!!b);case'|':return a|b;case'^':return a^b;case'&':return a&b;case'==':return +(a===b);case'!=':return +(a!==b);case'<':return +(a<b);case'>':return +(a>b);case'<=':return +(a<=b);case'>=':return +(a>=b);case'<<':return a<<b;case'>>':return a>>b;case'+':return a+b;case'-':return a-b;case'*':return a*b;case'/':return Math.trunc(a/b);case'%':return a%b;}};
 const parse=min=>{let value=unary();while(rank[tokens[at]]>=min){const op=tokens[at++],next=parse(rank[op]+1);value=apply(op,value,next);}return value;};
 const result=parse(0);if(at!==tokens.length)throw Error('Unsupported shader condition: '+expression);return result;
}
export function activeGLSL(source,definitions={}){
 const macros=new Map(Object.entries({GL_ES:'1',__VERSION__:'300',...definitions})),stack=[];let active=true;
 const clean=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,s=>s.replace(/[^\n]/g,' ')).split('\n');
 const result=source.split('\n').map((line,index)=>{
  const directive=/^[ \t]*#(\w+)\b[ \t]*(.*)$/.exec(clean[index]);if(!directive)return active?line:'';
  const [,op,body]=directive;
  if(['if','ifdef','ifndef'].includes(op)){const yes=active&&(op==='if'?!!glslCondition(body,macros):op==='ifdef'?macros.has(body.trim()):!macros.has(body.trim()));stack.push({parent:active,taken:yes});active=yes;return '';}
  if(['elif','else','endif'].includes(op)){const top=stack.at(-1);if(!top)throw Error('Unmatched shader #'+op);if(op==='endif'){active=top.parent;stack.pop();}else{active=top.parent&&!top.taken&&(op==='else'||!!glslCondition(body,macros));top.taken||=active;}return '';}
  if(!active)return '';
  if(op==='define'){const m=/^(\w+)(\([^)]*\))?\s*(.*)$/.exec(body);if(m)macros.set(m[1],m[2]?'1':m[3]);}
  if(op==='undef')macros.delete(body.trim());
  return line;
 });if(stack.length)throw Error('Unclosed shader condition');return result.join('\n');
}
