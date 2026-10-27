import{test}from'node:test';import assert from'node:assert/strict';import{createServer}from'node:http';import{readFile}from'node:fs/promises';import{resolve,sep}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(fileURLToPath(new URL('../client/',import.meta.url)));
test('all graphics backends render world formats, leads, render targets and readback',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
 const{chromium}=await import(process.env.PLAYWRIGHT_MODULE),server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<body></body>');return;}const path=resolve(root,'.'+req.url);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type','text/javascript');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--use-angle=vulkan','--enable-unsafe-swiftshader','--use-vulkan=swiftshader','--use-dawn-backend=vulkan','--enable-features=Vulkan','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface']});
 for(const api of['webgl2','webgpu','software']){const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 let renderTimer;const result=await Promise.race([page.evaluate(async api=>{
 const{FORMAT,EntityParams,DEFAULT_PARAMS}=await import('/js/gfx/device.js');const canvas=document.createElement('canvas');canvas.width=canvas.height=32;document.body.append(canvas);
 let d;if(api==='webgpu')d=await(await import('/js/gfx/webgpu.js')).WebGPUDevice.create(canvas);else if(api==='webgl2')d=new(await import('/js/gfx/webgl2.js')).WebGL2Device(canvas);else d=new(await import('/js/gfx/software.js')).SoftwareDevice(canvas);
 const errors=[];d.device?.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const id=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),quad=[[-.5,-.5],[-.5,.5],[.5,.5],[.5,-.5]],state={depthTest:false,depthWrite:false,cull:false};d.setGlobals({view:id,proj:id,fogMode:2});
 const pixel=async()=>{const capture=d.capture();d.endFrame();const {data,width,height}=await capture;return [...data.slice(((height>>1)*width+(width>>1))*4,((height>>1)*width+(width>>1))*4+4)];};const out={};
 for(const pipeline of['color','lit','entity','terrain','endportal','post']){
  let data;if(pipeline==='terrain'){data=new Uint8Array(80);const v=new DataView(data.buffer);quad.forEach(([x,y],i)=>{for(const[k,n]of[x,y,0].entries())v.setUint16(i*20+k*2,Math.round((n+8)*2048),true);data.fill(255,i*20+12,i*20+18);});}
  else data=new Float32Array(quad.flatMap(([x,y])=>pipeline==='entity'?[x,y,0,0,0,0,0,1,1,1,1]:pipeline==='lit'?[x,y,0,0,0,1,1,1,1,-1,-1]:[x,y,0,0,0,1,1,1,1]));
  const mesh=d.createMesh(FORMAT[pipeline]||FORMAT.color,data,{quads:true}),params=pipeline==='entity'?new EntityParams().setFullBright(true).setNoLighting(true).p:pipeline==='endportal'?new Float32Array([1,1,1,0,1,0,0,0,32,32,0,0,0,0,0,0]):DEFAULT_PARAMS[pipeline];
  d.beginFrame([0,0,0,1]);d.draw({mesh,pipeline,model:id,params,textures:[d.white],state});out[pipeline]=await pixel();d.destroyMesh(mesh);
 }
 const mesh=d.createMesh(FORMAT.color,new Float32Array(quad.flatMap(([x,y])=>[x,y,0,.5,.5,1,1,1,1])),{quads:true}),rt=d.createRenderTarget(16,16);
 d.beginFrame([0,0,0,1]);d.setRenderTarget(rt,[.2,.4,.6,1]);d.setRenderTarget(null);d.draw({mesh,pipeline:'color',model:id,textures:[rt],state});out.target=await pixel();d.destroyMesh(mesh);d.destroyTexture(rt);
 const{leashGeometry}=await import('/js/render/leash.js');const rope=d.createMesh(FORMAT.color,leashGeometry({start:[-.5,-1.3,0],end:[.5,0,0],height:1.6}),{quads:true});d.beginFrame([0,0,0,1]);d.draw({mesh:rope,pipeline:'color',model:id,state});const capture=d.capture();d.endFrame();const image=await capture;out.ropePixels=0;for(let i=0;i<image.data.length;i+=4)if(image.data[i])out.ropePixels++;d.destroyMesh(rope);
 const{fireOverlayVertices,fireOverlayProjection}=await import('/js/render/fire-overlay.js'),{mat4}=await import('/js/gfx/math.js');
 const fire=d.createMesh(FORMAT.color,fireOverlayVertices([0,0,1,1]),{quads:true});d.setGlobals({view:id,proj:mat4.ortho(mat4.create(),0,32,32,0,-400000,400000),fogMode:2});d.beginFrame([0,0,0,1]);d.draw({mesh:fire,pipeline:'color',model:fireOverlayProjection(32,32),textures:[d.white],state:{...state,blend:'alpha'}});out.fire=await pixel();d.destroyMesh(fire);
 await d.device?.queue.onSubmittedWorkDone();return{out,errors,name:d.name};
 },api),new Promise((_,reject)=>renderTimer=setTimeout(()=>reject(Error(api+' render timed out')),15000))]);
 clearTimeout(renderTimer);assert.deepEqual(result.errors,[],api);for(const name of['color','lit','entity','terrain','endportal','post'])assert.deepEqual(result.out[name],[255,255,255,255],api+' '+name);for(const[i,n]of[51,102,153,255].entries())assert.ok(Math.abs(result.out.target[i]-n)<=1,api+' render target '+result.out.target);assert.ok(result.out.ropePixels>0,api+' visible lead');assert.ok(result.out.fire[0]>230,api+' fire spans the screen center');console.log(api,JSON.stringify(result));await page.close();
 }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
