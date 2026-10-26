// Optional browser/GPU check. Set PLAYWRIGHT_MODULE to a separately installed Playwright index.mjs.
import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {readFile,access} from 'node:fs/promises';import {resolve,sep} from 'node:path';import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../client/',import.meta.url)));
async function renderPack(file,dimensions){
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const bytes=await readFile(file);
 const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<canvas width="64" height="64"></canvas>');return;}const path=resolve(root,'.'+req.url);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type','text/javascript');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const results=await page.evaluate(async({bytes,dimensions})=>{
   const {WebGL2Device}=await import('/js/gfx/webgl2.js'),{ShaderPackFinal}=await import('/js/render/shader-pack.js');const d=new WebGL2Device(document.querySelector('canvas'),{preserveDrawingBuffer:true}),g={device:d,dimension:0,ticks:10,partial:.5,world:{timeOfDay:6000},player:{},settings:{gamma:.5}},p=new ShaderPackFinal(g);p.load('test.zip',new Uint8Array(bytes));const out=[];
   for(const dimension of dimensions){g.dimension=dimension;d.beginFrame([0,0,0,1]);p.begin([.25,.5,.75,1]);d.gl.enable(d.gl.SCISSOR_TEST);d.gl.scissor(0,32,64,32);d.gl.clearColor(.75,.25,.5,1);d.gl.clear(d.gl.COLOR_BUFFER_BIT);p.render();const pixel=new Uint8Array(4),top=new Uint8Array(4);d.gl.readPixels(32,16,1,1,d.gl.RGBA,d.gl.UNSIGNED_BYTE,pixel);d.gl.readPixels(32,48,1,1,d.gl.RGBA,d.gl.UNSIGNED_BYTE,top);out.push({dimension,pixel:[...pixel],top:[...top],error:d.gl.getError(),active:p.active});}p.clear();return out;
  },{bytes:[...bytes],dimensions});assert.deepEqual(errors,[]);for(const r of results){assert.equal(r.error,0);assert.equal(r.active,true);assert.deepEqual(r.pixel,[64,128,191,255]);assert.deepEqual(r.top,[191,64,128,255]);}
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
test('final pass produces correct WebGL2 pixels with no GL errors',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>renderPack(new URL('fixtures/shader-pack-final-test.zip',import.meta.url),[0]));
const bsl=process.env.BSL_SHADER_PACK||fileURLToPath(new URL('../BSL_v10.1.8.zip',import.meta.url));const hasBSL=await access(bsl).then(()=>true,()=>false);
test('locally supplied BSL final programs compile and render in all three dimensions',{skip:!process.env.PLAYWRIGHT_MODULE||!hasBSL},async()=>renderPack(bsl,[0,-1,1]));
