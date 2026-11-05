import{performance}from'node:perf_hooks';import{readFileSync}from'node:fs';
import{Node,Batcher,drawTree}from'../client/js/gfx/scene.js';import{mat4}from'../client/js/gfx/math.js';import{setJarModels,zombie}from'../client/js/render/entity-models.js';import{setModelDevice}from'../client/js/render/boxmodel.js';import{EntityRenderer}from'../client/js/render/entity-renderer.js';
setJarModels(JSON.parse(readFileSync(new URL('../client/assets/bundles/entity-models.json',import.meta.url))));
let uploads=0,bytes=0,draws=0;
const device={createMesh:(format,cpu,opts)=>({format,cpu,vertexCount:cpu.length/11,...opts}),updateMesh:(m,data)=>{m.vertexCount=data.length/11;uploads++;bytes+=data.byteLength;},draw:()=>draws++};setModelDevice(device);
const root=new Node(),models=[],r=Object.create(EntityRenderer.prototype),texture={};
for(let i=0;i<300;i++){const m=zombie(),group=new Node(),material={pipeline:'entity',tex:texture,params:new Float32Array(16),state:{depthWrite:true}};group.position.set(i%20*2,0,Math.floor(i/20)*2);group.scale.set(1/16,1/16,1/16);group.add(r._makeModelObject(m,material));root.add(group);models.push(m);}
const batcher=new Batcher(device),frame=i=>{for(let j=0;j<models.length;j++){const m=models[j];m.parts.head.ry=Math.sin(i*.03+j)*.3;m.parts.leftLeg.rx=Math.sin(i*.05+j)*.5;for(const part of m.roots)part.sync();}drawTree(device,root,{batcher});};
for(let i=0;i<40;i++)frame(i);
const rounds=[];for(let round=0;round<5;round++){const start=performance.now();for(let i=0;i<100;i++)frame(i);rounds.push((performance.now()-start)/100);}
console.log(JSON.stringify({scope:'CPU native zombie-model animation, scene transforms, batching and fake-device submission; no measured GPU execution',entities:models.length,node:process.version,roundsMsPerFrame:rounds,medianMsPerFrame:[...rounds].sort((a,b)=>a-b)[2],draws,uploads,bytes},null,2));
