// Every WebGL 2 and WebGPU shader source keeps balanced braces and parentheses (a cheap guard against broken
// generated or hand-edited shader code that only fails when the browser compiles it).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
function templates(src){const out=[];const re=/`([\s\S]*?)`/g;let m;while((m=re.exec(src)))if(/void main|fn fs|fn vs|@fragment|@vertex/.test(m[1]))out.push(m[1].replace(/\$\{[^}]*\}/g,'0'));return out;}
for(const file of ['webgl2','webgpu']){
 test(file+' shader sources are balanced',()=>{
  const src=readFileSync(new URL('../client/js/gfx/'+file+'.js',import.meta.url),'utf8'),list=templates(src);assert.ok(list.length>3);
  for(const s of list){const body=s.replace(/\/\/.*$/gm,'');for(const [o,c] of [['{','}'],['(',')']]){const n=(x)=>body.split(x).length-1;assert.equal(n(o),n(c),file+': unbalanced '+o+c+' in\n'+s.slice(0,200));}
   assert.doesNotMatch(body,/;\s*\n\s*else\b/,file+': else without a closing brace');}
 });
}
