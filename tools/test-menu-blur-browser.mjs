import {test} from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';
test('native six-pass menu blur preserves orientation and matches a box-filter reference on all three backends',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const root=resolve(new URL('../client/',import.meta.url).pathname),server=createServer(async(req,res)=>{try {res.setHeader('Content-Type',req.url==='/'?'text/html':'text/javascript');res.end(req.url==='/'?'<body></body>':await readFile(root+req.url));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--use-angle=vulkan','--enable-unsafe-swiftshader','--use-vulkan=swiftshader','--use-dawn-backend=vulkan','--enable-features=Vulkan','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface']});
try{for(const api of ['webgl2','webgpu','software']){
 const page=await browser.newPage();page.on('console',m=>{if(m.type()==='error')assert.fail(api+': '+m.text())});await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async api=>{
  const{MenuBlur}=await import('/js/render/menu-blur.js');const{FORMAT}=await import('/js/gfx/device.js');const canvas=document.createElement('canvas');canvas.width=31;canvas.height=19;document.body.append(canvas);
  const d=api==='webgpu'?await(await import('/js/gfx/webgpu.js')).WebGPUDevice.create(canvas):api==='webgl2'?new(await import('/js/gfx/webgl2.js')).WebGL2Device(canvas):new(await import('/js/gfx/software.js')).SoftwareDevice(canvas);
  const errors=[];d.device?.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  const id=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const mesh=d.createMesh(FORMAT.color,new Float32Array([-1,1,0,0,0,1,1,1,1,-1,-1,0,0,1,1,1,1,1,1,-1,0,1,1,1,1,1,1,1,1,0,1,0,1,1,1,1]),{quads:true});
  const data=new Uint8Array(31*19*4);for(let y=0;y<19;y++)for(let x=0;x<31;x++)data.set(y<7?[255,0,0,255]:[0,x%3?50:200,255,255],(y*31+x)*4);
  const tex=d.createTexture({width:31,height:19,data});
  const draw=()=>{d.beginFrame([0,0,0]);d.setGlobals({view:id,proj:id,fogMode:2});d.draw({mesh,pipeline:'color',textures:[tex],params:new Float32Array([1,1,1,1]),state:{blend:'none',depthTest:false,depthWrite:false}})};
  const capture=async()=>{const p=d.capture();d.endFrame();return Array.from((await p).data)};
  draw();const before=await capture();draw();const blur=new MenuBlur(d);blur.render(.5);const after=await capture();
  return {width:d.width,height:d.height,before,after,errors};
 },api).then(r=>{let expected=r.before;for(let pass=0;pass<6;pass++){const dst=new Uint8Array(expected.length);for(let y=0;y<19;y++)for(let x=0;x<31;x++)for(let c=0;c<4;c++){let sum=0;for(let off=-5;off<=5;off++){const xx=pass%2?x:Math.max(0,Math.min(30,x+off)),yy=pass%2?Math.max(0,Math.min(18,y+off)):y;sum+=expected[(yy*31+xx)*4+c];}dst[(y*31+x)*4+c]=Math.round(sum/11);}expected=dst;}return{width:r.width,height:r.height,errors:r.errors,maxError:Math.max(...r.after.map((v,i)=>Math.abs(v-expected[i]))),top:r.after.slice(0,4),bottom:r.after.slice(-4)}});
 assert.deepEqual(result.errors,[],api);assert.ok(result.maxError<=2,api+': error '+result.maxError);assert.ok(result.top[0]>result.top[2]&&result.bottom[2]>result.bottom[0],api+': flipped image');
 await page.close();
}}finally{await browser.close();await new Promise(r=>server.close(r));}

});
