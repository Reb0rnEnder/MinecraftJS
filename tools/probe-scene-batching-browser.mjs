// Pixel and submission regression in real WebGL2; SwiftShader is not a user GPU benchmark.
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const roots=process.argv.slice(2);if(!roots.length)roots.push(resolve('.'));
for(const root of roots){
 const server=createServer(async(req,res)=>{try{const path=resolve(root,'client','.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(resolve(root,'client')+'/'))throw Error();res.setHeader('Content-Type',extname(path)==='.js'?'text/javascript':'text/html');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const result=await page.evaluate(async()=>{
   const {WebGL2Device}=await import('/js/gfx/webgl2.js'),{Node,Batcher,drawTree,material}=await import('/js/gfx/scene.js'),{FORMAT,EntityParams}=await import('/js/gfx/device.js'),{mat4}=await import('/js/gfx/math.js');
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=160;document.body.replaceChildren(canvas);const device=new WebGL2Device(canvas,{preserveDrawingBuffer:true}),root=new Node(),tex=device.createTexture({width:1,height:1,data:new Uint8Array([190,210,140,255])});
   const cpu=new Float32Array([-.04,-.08,0,0,0,0,0,1,1,1,1,.04,-.08,0,1,0,0,0,1,1,1,1,.04,.08,0,1,1,0,0,1,1,1,1,-.04,.08,0,0,1,0,0,1,1,1,1]);
   const mesh=device.createMesh(FORMAT.entity,cpu,{quads:true});mesh.cpu=cpu;
   for(let i=0;i<160;i++){const n=new Node();n.position.set((i%20-9.5)*.095,(Math.floor(i/20)-3.5)*.23,0);n.rotation.z=(i%3-1)*.1;n.scale.set(.9,.9,1);const p=new EntityParams().setNoLighting(true);if(i>=80)p.setTint(1,.7,.9,1);n.addDrawable(mesh,material('entity',tex,p,{blend:'alpha',depthWrite:true,cull:false}));root.add(n);}
   const batcher=new Batcher(device,FORMAT.entity),original=device.draw.bind(device);let calls=0;device.draw=d=>{calls++;original(d);};
   function render(batched){calls=0;device.beginFrame([.03,.04,.05]);device.setGlobals({view:mat4.create(),proj:mat4.create(),fogMode:0,fogStart:100,fogEnd:200});drawTree(device,root,batched?{batcher}:{});return{pixels:device._readPixels().data,calls};}
   const baseline=render(false),batched=render(true);let differences=0,maxDifference=0,visible=0;for(let i=0;i<baseline.pixels.length;i++){const d=Math.abs(baseline.pixels[i]-batched.pixels[i]);if(d)differences++;maxDifference=Math.max(maxDifference,d);if(i%4===0&&baseline.pixels[i]>30)visible++;}
   // Alternating measurement order and readback outside timed submission loops.
   const timings={direct:[],batched:[]};for(let round=0;round<6;round++)for(const batch of round%2?[true,false]:[false,true]){const start=performance.now();for(let i=0;i<10;i++){device.beginFrame([0,0,0]);drawTree(device,root,batch?{batcher}:{});}timings[batch?'batched':'direct'].push((performance.now()-start)/10);device.gl.finish();}
   return{api:device.name,renderer:device.info.renderer,baselineDraws:baseline.calls,batchedDraws:batched.calls,differences,maxDifference,visible,timings,scope:'Synthetic WebGL2 submission timings on test renderer; not gameplay FPS or hardware GPU timings'};
  });
  assert.equal(result.visible>100,true);assert.ok(result.maxDifference<=1,JSON.stringify(result));assert.equal(result.baselineDraws,160);assert.equal(result.batchedDraws,2);console.log(JSON.stringify({root,...result}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
