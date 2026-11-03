import {test} from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {readFile,readdir} from 'node:fs/promises';import {resolve,sep} from 'node:path';import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../',import.meta.url)),root=resolve(repo,'client');
const packs=(process.env.MODERN_SHADER_PACKS||'').split('|').filter(Boolean);
for(const packName of packs)test('imported '+packName+' reports missing native pipeline resources without substitutions',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),bytes=[...await readFile(resolve(packName))];
 const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<canvas width="96" height="64"></canvas>');return;}const path=resolve(root,'.'+req.url);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type',path.endsWith('.json')?'application/json':'text/javascript');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  const results=await page.evaluate(async({bytes,name})=>{
   const {WebGL2Device}=await import('/js/gfx/webgl2.js'),{ShaderPackFinal}=await import('/js/render/shader-pack.js'),{initBlocks}=await import('/js/world/blocks.js');
   const [blocks,shapes]=await Promise.all(['blocks','blockCollisionShapes'].map(n=>fetch('/data/'+n+'.json').then(r=>r.json())));initBlocks(blocks,shapes);
   const d=new WebGL2Device(document.querySelector('canvas'),{preserveDrawingBuffer:true}),g={device:d,dimension:0,world:{timeOfDay:6000,rainStrength:0},player:{},settings:{gamma:.5},assets:{data:{blocks}}},p=new ShaderPackFinal(g);let failure='';try{p.load(name,new Uint8Array(bytes));}catch(e){failure=e.message;}const active=p.active,gl=d.gl.getError();p.clear();return{failure,active,gl};
  },{bytes,name:packName});
  assert.deepEqual(errors,[]);assert.equal(results.active,false);assert.equal(results.gl,0);assert.match(results.failure,/unavailable scene buffer|Shader pipeline not yet supported:/);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
