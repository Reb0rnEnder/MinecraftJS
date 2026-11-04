import{test}from'node:test';import assert from'node:assert/strict';import{createServer}from'node:http';import{readFile}from'node:fs/promises';import{resolve,sep}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(fileURLToPath(new URL('../client/',import.meta.url)));
test('browser range scheduling and eviction release actual WebGL buffers without stale-job resurrection',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
 const{chromium}=await import(process.env.PLAYWRIGHT_MODULE),server=createServer(async(req,res)=>{try{if(req.url==='/'){res.end('<body></body>');return;}const p=resolve(root,'.'+req.url);if(!p.startsWith(root+sep))throw Error();res.setHeader('Content-Type','text/javascript');res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const[{Game},{Renderer},{WebGL2Device},{FORMAT},{DirtySections},{trimMeshResidency},{sectionKey},{setPlatform}]=await Promise.all(['/js/game/game.js','/js/render/renderer.js','/js/gfx/webgl2.js','/js/gfx/device.js','/js/render/dirty-sections.js','/js/render/mesh-residency.js','/js/render/culling.js','/js/platform/platform.js'].map(p=>import(p)));
  setPlatform({now:()=>performance.now()});const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const device=new WebGL2Device(canvas),r=Object.create(Renderer.prototype);Object.assign(r,{device,sections:new Map(),invalidateVisibility(){}});
  const near=device.createMesh(FORMAT.terrain,new Uint8Array(80),{quads:true}),far=device.createMesh(FORMAT.terrain,new Uint8Array(80),{quads:true}),g={world:{getChunk:()=>null},renderer:r,assets:{worker:{}},settings:{renderDistance:10,prioritizeChunkUpdates:'none'},_updateLod(){},_lodCamera:()=>[0,64,0]};
  Game.prototype._setupWorker.call(g);r.sections.set(sectionKey(0,4,0),{cx:0,sy:4,cz:0,solid:near});r.sections.set(sectionKey(30,4,0),{cx:30,sy:4,cz:0,solid:far});
  const before=device.gl.isBuffer(far.vbo);trimMeshResidency(g,[0,64,0]);const active=g.dirty.within(0,0,11);g.dirty.add('31,4,0');const sameQuery=g.dirty.within(0,0,11)===active;Game.prototype._scheduleMeshes.call(g);
  g.buildTokens.set('30,4,0',2);g.inFlight.set('30,4,0',2);g.assets.worker.onmessage({data:{type:'built',x:30,y:4,z:0,gen:g.meshGen,token:1}});
  return{before,farAlive:device.gl.isBuffer(far.vbo),nearAlive:device.gl.isBuffer(near.vbo),sameQuery,pending:g.dirty.has('30,4,0'),newLease:g.inFlight.get('30,4,0'),uploads:g._meshUploads.length,error:device.gl.getError()};
 });assert.deepEqual(result,{before:true,farAlive:false,nearAlive:true,sameQuery:true,pending:true,newLease:2,uploads:0,error:0});
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
