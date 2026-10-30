import{test}from'node:test';import assert from'node:assert/strict';import{createServer}from'node:http';import{readFile}from'node:fs/promises';import{resolve,sep}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(fileURLToPath(new URL('../client/',import.meta.url)));
test('Fabulous depth-sorts six premultiplied layers on every graphics backend',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
 const{chromium}=await import(process.env.PLAYWRIGHT_MODULE),server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<body></body>');return;}const path=resolve(root,'.'+req.url);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type','text/javascript');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--use-angle=vulkan','--enable-unsafe-swiftshader','--use-vulkan=swiftshader','--use-dawn-backend=vulkan','--enable-features=Vulkan','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface']});
 for(const api of['webgl2','webgpu','software']){const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async api=>{
 const{FORMAT,colorParams}=await import('/js/gfx/device.js'),{compositeLayers}=await import('/js/gfx/transparency.js'),{Fabulous}=await import('/js/render/fabulous.js');
 const canvas=document.createElement('canvas');canvas.width=canvas.height=16;document.body.append(canvas);
 const d=api==='webgpu'?await(await import('/js/gfx/webgpu.js')).WebGPUDevice.create(canvas):api==='webgl2'?new(await import('/js/gfx/webgl2.js')).WebGL2Device(canvas):new(await import('/js/gfx/software.js')).SoftwareDevice(canvas);
 const errors=[];d.device?.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const id=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);d.setGlobals({view:id,proj:id,fogMode:2});
 const fab=new Fabulous(d),reports=[],colors=[[.2,.3,.4,1],[1,0,0,.5],[0,1,0,.25],[0,0,1,.75],[1,1,0,.2],[0,1,1,.3]];
 const names=['main','translucent','itemEntity','particles','weather','clouds'];
 for(const depths of [[.5,.8,.2,.7,.3,.4],[.9,.2,.3,.4,.5,.6],[.1,.2,.3,.4,.5,.6]]){
  d.beginFrame([0,0,0]);fab.begin([0,0,0]);
  for(let i=0;i<6;i++){
   const t=fab.targets[names[i]],z=depths[i]*2-1,c=colors[i],vertices=new Float32Array([[-1,-1],[-1,1],[1,1],[1,-1]].flatMap(([x,y])=>[x,y,z,0,0,1,1,1,1])),mesh=d.createMesh(FORMAT.color,vertices,{quads:true});
   d.setRenderTarget(t,[0,0,0,0]);d.draw({mesh,pipeline:'color',params:colorParams(...c),state:{blend:i?'alpha':'none',depthWrite:true,cull:false}});
  }
  fab.finish();const capture=d.capture();d.endFrame();const {data,width}=await capture;const pixel=[...data.slice((8*width+8)*4,(8*width+8)*4+4)],expected=compositeLayers(colors.map((c,i)=>i?[c[0]*c[3],c[1]*c[3],c[2]*c[3],c[3]]:c),depths).map(v=>Math.round(v*255));reports.push({pixel,expected});
 }
 // Depth copies preserve a previously drawn opaque surface and reject a deeper fragment.
 d.beginFrame([0,0,0]);fab.begin([0,0,0]);const main=fab.targets.main,trans=fab.targets.translucent;
 const draw=(target,z,c)=>{d.setRenderTarget(target);const mesh=d.createMesh(FORMAT.color,new Float32Array([[-1,-1],[-1,1],[1,1],[1,-1]].flatMap(([x,y])=>[x,y,z,0,0,1,1,1,1])),{quads:true});d.draw({mesh,pipeline:'color',params:colorParams(...c),state:{depthWrite:true,cull:false}});};
 draw(main,0,[1,0,0,1]);d.setRenderTarget(trans,[0,0,0,0]);d.copyDepth(main,trans);draw(trans,.5,[0,0,1,1]);
 for(const name of names.slice(2))d.setRenderTarget(fab.targets[name],[0,0,0,0]);fab.finish();const capture=d.capture();d.endFrame();const image=await capture;const copied=[...image.data.slice((8*image.width+8)*4,(8*image.width+8)*4+4)];
 const {PostChain,BUILTIN_CHAINS}=await import('/js/render/post.js');const post=new PostChain(d,BUILTIN_CHAINS.invert);
 d.beginFrame([0,0,0]);post.begin([0,0,0]);fab.begin([.2,.4,.6]);fab.prepare();fab.finish();post.render(d.white,0);const postCapture=d.capture();d.endFrame();const postImage=await postCapture;const nested=[...postImage.data.slice((8*postImage.width+8)*4,(8*postImage.width+8)*4+4)];post.destroy();
 await d.device?.queue.onSubmittedWorkDone();if(d.gl){const error=d.gl.getError();if(error)errors.push('GL '+error);}fab.destroy();return{reports,copied,nested,errors};
 },api);
 console.log(api,JSON.stringify(result));assert.deepEqual(result.errors,[],api);for(const r of result.reports)r.pixel.forEach((v,i)=>assert.ok(Math.abs(v-r.expected[i])<=3,api+' '+JSON.stringify(r)));assert.deepEqual(result.copied,[255,0,0,255],api+' copied depth');[173,143,112,255].forEach((v,i)=>assert.ok(Math.abs(result.nested[i]-v)<=2,api+' nested spectator post '+result.nested));await page.close();
 }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
