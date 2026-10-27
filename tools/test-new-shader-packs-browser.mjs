import {test} from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {readFile,readdir} from 'node:fs/promises';import {resolve,sep} from 'node:path';import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../',import.meta.url)),root=resolve(repo,'client');
const packs=(await readdir(repo)).filter(name=>name.endsWith('.zip')&&/Sildur|Astra/.test(name));
for(const packName of packs)test('imported '+packName+' runs native image/plant programs in all dimensions',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),bytes=[...await readFile(resolve(repo,packName))];
 const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<canvas width="96" height="64"></canvas>');return;}const path=resolve(root,'.'+req.url);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type',path.endsWith('.json')?'application/json':'text/javascript');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  const results=await page.evaluate(async({bytes,name})=>{
   const {WebGL2Device}=await import('/js/gfx/webgl2.js'),{ShaderPackFinal}=await import('/js/render/shader-pack.js'),{initBlocks}=await import('/js/world/blocks.js');
   const [blocks,shapes]=await Promise.all(['blocks','blockCollisionShapes'].map(n=>fetch('/data/'+n+'.json').then(r=>r.json())));initBlocks(blocks,shapes);
   const d=new WebGL2Device(document.querySelector('canvas'),{preserveDrawingBuffer:true}),g={device:d,dimension:0,world:{timeOfDay:6000,rainStrength:0},player:{},settings:{gamma:.5},assets:{data:{blocks}}},p=new ShaderPackFinal(g);p.load(name,new Uint8Array(bytes));const out=[];
   for(const dimension of [0,-1,1]){
    g.dimension=dimension;d.beginFrame([0,0,0,1]);p.begin([.25,.5,.75,1]);p.prepareTerrain([0,64,0],[0,65.62,0]);p.render();const pixel=new Uint8Array(4);d.gl.readPixels(48,32,1,1,d.gl.RGBA,d.gl.UNSIGNED_BYTE,pixel);out.push({dimension,pixel:[...pixel],active:p.active,error:p.error,gl:d.gl.getError(),waving:p.hasWaving,lighting:!!p.lighting});
   }
   const options=p.availableOptions.map(o=>o.name);const option=p.availableOptions.find(o=>/^(Contrast|WAVING_GRASS|Waving_Grass)$/.test(o.name));if(option){const value=option.values.find(v=>v!==option.default);p.load(name,p.bytes,{[option.name]:value});}
   p.enabled=false;p.prepareTerrain([0,64,0],[0,65.62,0]);const off=d.terrainAnimation===null;p.clear();return {out,options,off};
  },{bytes,name:packName});
  assert.deepEqual(errors,[]);for(const r of results.out){assert.equal(r.active,true,r.error);assert.equal(r.error,'');assert.equal(r.gl,0);assert.equal(r.waving,true);assert.ok(r.pixel.slice(0,3).some(v=>v>10),'scene remains visible');assert.equal(r.pixel[3],255);}
  assert.equal(results.off,true);for(const unsupported of ['TAA','Depth_of_Field','Motionblur','Showbuffer','ARC_EN_CIEL','DISTORTION','BARREL'])assert.equal(results.options.includes(unsupported),false,unsupported);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
