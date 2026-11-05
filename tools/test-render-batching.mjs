import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Node,Batcher,drawTree,material,toDraw} from '../client/js/gfx/scene.js';
function fixture(){
 const calls=[],root=new Node(),tex={},cpu=new Float32Array(44);
 for(let i=0;i<4;i++)cpu.set([i&1,i>>1,0,0,0,0,1,0,1,1,1],i*11);
 const device={createMesh:()=>({}),updateMesh:(m,data)=>m.upload=new Float32Array(data),draw:d=>calls.push(d)};
 const add=(params=new Float32Array(16),state={blend:'none',depthWrite:true},texture=tex)=>{
  const node=new Node();node.addDrawable({cpu,quads:true,vertexCount:4},material('entity',texture,params,state));root.add(node);return node;
 };
 return {root,device,calls,add,batcher:new Batcher(device)};
}
test('separate equal materials batch consecutive entities and retain transformed vertices/normals',()=>{
 const f=fixture(),a=f.add(),b=f.add();a.position.set(2,3,4);b.position.set(10,20,30);b.scale.set(2,3,4);
 drawTree(f.device,f.root,{batcher:f.batcher});assert.equal(f.calls.length,1);const c=f.calls[0];assert.equal(c.count,12);
 assert.deepEqual([...c.mesh.upload.slice(0,3)],[2,3,4]);assert.deepEqual([...c.mesh.upload.slice(44,47)],[10,20,30]);assert.deepEqual([...c.mesh.upload.slice(49,52)],[0,3,0]);
});
test('different light, overlays, state keys, textures, output targets and partial draws preserve boundaries',()=>{
 for(const kind of ['light','overlay','state','extraState','texture','target','partial','primitive','nonEnumerableState']){
  const f=fixture();f.add();const b=f.add(),d=b.drawables[0];
  if(kind==='light')d.mat.params[8]=4;if(kind==='overlay')d.mat.params[7]=.5;
  if(kind==='state')d.mat.state.depthWrite=false;if(kind==='nonEnumerableState')Object.defineProperty(d.mat.state,'depthWrite',{value:false,enumerable:false});if(kind==='extraState')d.mat.state.polygonOffset=true;
  if(kind==='target'&&!Object.hasOwn(toDraw(d,b.world),'outputTarget'))continue;
  if(kind==='texture')d.mat.tex={};if(kind==='target')d.outputTarget='translucent';
  if(kind==='partial')d.count=6;if(kind==='primitive')d.primitive='lines';
  f.add();drawTree(f.device,f.root,{batcher:f.batcher});assert.equal(f.calls.length,3,kind);
 }
});
test('draw order and per-frame mutable material values are preserved',()=>{
 const f=fixture(),a=f.add(),b=f.add();b.drawables[0].order=-1;
 a.position.x=2;b.position.x=4;drawTree(f.device,f.root,{batcher:f.batcher});assert.equal(f.calls[0].mesh.upload[0],4);
 f.calls.length=0;b.drawables[0].mat.params[0]=.5;drawTree(f.device,f.root,{batcher:f.batcher});assert.equal(f.calls.length,2);
});
