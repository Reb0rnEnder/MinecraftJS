// 1.17+ rendertype_end_portal as additive passes: each pass's pipeline UV must equal the native shader's
// textureProj(texProj0 * end_portal_layer(L)) evaluated with GLSL row-vector/column-major semantics.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {endPortalPasses17,updateEndPortalPasses17,shaderGameTime,END_PORTAL_COLORS_17,PORTAL_LAYERS,GATEWAY_LAYERS} from '../client/js/render/end-portal-17.js';

// GLSL mat4(...) takes columns; vec4 * mat4 gives dot(v, column j)
const col=(m,j)=>m.slice(j*4,j*4+4),vm=(v,m)=>[0,1,2,3].map(j=>col(m,j).reduce((s,x,i)=>s+x*v[i],0));
const mm=(a,b)=>{const o=[];for(let c=0;c<4;c++)for(let r=0;r<4;r++)o.push([0,1,2,3].reduce((s,k)=>s+a[k*4+r]*b[c*4+k],0));return o;};
function nativeLayer(L,time){
 const translate=[1,0,0,17/L, 0,1,0,(2+L/1.5)*(time*1.5), 0,0,1,0, 0,0,0,1];
 const r=(L*L*4321+L*9)*2*Math.PI/180,rot=[Math.cos(r),-Math.sin(r),Math.sin(r),Math.cos(r)],s=(4.5-L/4)*2;
 const m2=[s*rot[0],s*rot[1],s*rot[2],s*rot[3]];// mat2(scale) * rotate
 const A=[m2[0],m2[1],0,0, m2[2],m2[3],0,0, 0,0,1,0, 0,0,0,1];
 const ST=[0.5,0,0,0.25, 0,0.5,0,0.25, 0,0,1,0, 0,0,0,1];
 return mm(mm(A,translate),ST);
}
const fract=x=>x-Math.floor(x);
function pipelineUv(p,a,b){const nx=a*2-1,ny=b*2-1,sx=nx*p[4],sy=ny*p[4],c=Math.cos(p[5]),sn=Math.sin(p[5]);return [fract(0.5+0.5*(sx*c-sy*sn+p[6])),fract(0.5+0.5*(sx*sn+sy*c+p[7]))];}

test('every pass samples where the native shader does, with its colour; the sky pass is the screen position',()=>{
 const time=shaderGameTime(12345,0.25),passes=endPortalPasses17(PORTAL_LAYERS);updateEndPortalPasses17(passes,time,854,480);
 assert.equal(passes.length,1+PORTAL_LAYERS);assert.equal(endPortalPasses17(GATEWAY_LAYERS).length,17);
 assert.deepEqual([...passes[0].params.slice(0,3)],END_PORTAL_COLORS_17[0].map(Math.fround));assert.equal(passes[0].blend,'none');
 for(const [a,b] of [[0.1,0.2],[0.5,0.5],[0.9,0.33]]){
  const sky=pipelineUv(passes[0].params,a,b);assert.ok(Math.abs(sky[0]-a)<1e-6&&Math.abs(sky[1]-b)<1e-6);
  for(const P of passes.slice(1)){
   const v=vm([a*1,b*1,0.5,1],nativeLayer(P.layer,time)),uv=[fract(v[0]/v[3]),fract(v[1]/v[3])],got=pipelineUv(P.params,a,b);
   for(const k of [0,1]){const d=Math.abs(uv[k]-got[k]);assert.ok(Math.min(d,1-d)<2e-3,'layer '+P.layer+' uv '+k+': '+uv[k]+' vs '+got[k]);}
   assert.deepEqual([...P.params.slice(0,3)],END_PORTAL_COLORS_17[P.layer-1].map(Math.fround));assert.equal(P.blend,'add');assert.equal(P.params[3],2);
  }
 }
});

test('GameTime is (gameTime % 24000 + partial) / 24000',()=>{
 assert.equal(shaderGameTime(24000*3+6000,0.5),Math.fround(6000.5/24000));assert.equal(shaderGameTime(123456789n,0),Math.fround(Number(123456789n%24000n)/24000));
});
