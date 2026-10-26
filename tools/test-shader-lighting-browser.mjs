import{test}from'node:test';import assert from'node:assert/strict';import{createServer}from'node:http';import{readFile,access}from'node:fs/promises';import{resolve,sep}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(fileURLToPath(new URL('../client/',import.meta.url))),file=process.env.BSL_SHADER_PACK||fileURLToPath(new URL('../BSL_v10.1.8.zip',import.meta.url));const hasBSL=await access(file).then(()=>true,()=>false);
test('BSL lighting settings change rendered terrain pixels and Off restores the native lightmap',{skip:!process.env.PLAYWRIGHT_MODULE||!hasBSL},async()=>{
 const{chromium}=await import(process.env.PLAYWRIGHT_MODULE),server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<canvas width="32" height="32"></canvas>');return;}const path=resolve(root,'.'+req.url);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type','text/javascript');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async bytes=>{
  const{WebGL2Device}=await import('/js/gfx/webgl2.js'),{ShaderPackFinal}=await import('/js/render/shader-pack.js'),{FORMAT}=await import('/js/gfx/device.js');
  const d=new WebGL2Device(document.querySelector('canvas')),g={device:d,dimension:0,world:{timeOfDay:6000,rainStrength:0}},p=new ShaderPackFinal(g);const data=new Uint8Array(80),v=new DataView(data.buffer);
  for(const[i,[x,y]]of[[-.5,-.5],[-.5,.5],[.5,.5],[.5,-.5]].entries()){for(const[k,n]of[x,y,0].entries())v.setUint16(i*20+k*2,Math.round((n+8)*2048),true);data.fill(255,i*20+12,i*20+16);data[i*20+16]=0;data[i*20+17]=128;}
  const mesh=d.createMesh(FORMAT.terrain,data,{quads:true}),id=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);d.setGlobals({view:id,proj:id,fogMode:2});
  const draw=()=>{d.beginFrame([0,0,0,1]);p.prepareTerrain([0,0,0],[0,0,0]);d.draw({mesh,pipeline:'terrain',model:id,textures:[d.white],state:{depthTest:false,depthWrite:false,cull:false}});const px=new Uint8Array(4);d.gl.readPixels(16,16,1,1,d.gl.RGBA,d.gl.UNSIGNED_BYTE,px);return[...px];};
  const native=draw();p.load('BSL',new Uint8Array(bytes));const noon=draw();p.load(p.name,p.bytes,{LIGHT_DI:'0.05',AMBIENT_DI:'0.05'});const dim=draw();p.enabled=false;const disabled=draw();p.enabled=true;
  const dims=[];for(const dimension of[-1,1]){g.dimension=dimension;dims.push(draw());}p.clear();const cleared=draw();d.destroyMesh(mesh);return{native,noon,dim,disabled,cleared,dims,error:d.gl.getError()};
 },[...await readFile(file)]);
 assert.equal(result.error,0);assert.notDeepEqual(result.noon,result.native);assert.ok(result.noon.slice(0,3).some((v,i)=>v>result.dim[i]));assert.deepEqual(result.disabled,result.native);assert.deepEqual(result.cleared,result.native);assert.notDeepEqual(result.dims[0],result.dims[1]);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
