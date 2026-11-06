import{test}from'node:test';import assert from'node:assert/strict';import{createServer}from'node:http';import{readFile}from'node:fs/promises';import{resolve,sep}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(fileURLToPath(new URL('../client/',import.meta.url)));
test('native forcefield texture draws with scene depth on WebGL2, WebGPU and Software',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
  const{chromium}=await import(process.env.PLAYWRIGHT_MODULE);
  const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.end('<body></body>');return;}const path=resolve(root,'.'+req.url);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type',path.endsWith('.png')?'image/png':'text/javascript');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--use-angle=vulkan','--enable-unsafe-swiftshader','--use-vulkan=swiftshader','--use-dawn-backend=vulkan','--enable-features=Vulkan','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface']});
    for(const api of['webgl2','webgpu','software']){
      const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
      const result=await page.evaluate(async api=>{
        const{WorldBorder}=await import('/js/world/world-border.js'),{borderGeometry}=await import('/js/render/world-border.js'),{FORMAT,colorParams}=await import('/js/gfx/device.js'),{mat4}=await import('/js/gfx/math.js');
        const canvas=document.createElement('canvas');canvas.width=canvas.height=64;document.body.append(canvas);
        const d=api==='webgpu'?await(await import('/js/gfx/webgpu.js')).WebGPUDevice.create(canvas):api==='webgl2'?new(await import('/js/gfx/webgl2.js')).WebGL2Device(canvas):new(await import('/js/gfx/software.js')).SoftwareDevice(canvas);
        const image=await createImageBitmap(await(await fetch('/assets/minecraft/textures/misc/forcefield.png')).blob()),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
        const texture=d.createTexture({width:image.width,height:image.height,data:ctx.getImageData(0,0,image.width,image.height).data,wrap:'repeat'}),b=new WorldBorder(()=>0);b.setSize(20);
        const geo=borderGeometry(b,[0,70,9],8,750),mesh=d.createMesh(FORMAT.color,geo.data,{quads:true}),view=mat4.create(),proj=mat4.create();mat4.rotateY(view,view,Math.PI);mat4.perspective(proj,Math.PI/2,1,.1,100);d.setGlobals({view,proj,fogMode:2,lightmap:d.white});
        const blocker=d.createMesh(FORMAT.color,new Float32Array([-.3,-.3,.5,0,0,1,1,1,1,.3,-.3,.5,1,0,1,1,1,1,.3,.3,.5,1,1,1,1,1,1,-.3,.3,.5,0,1,1,1,1,1]),{quads:true});
        async function render(wall,block){d.beginFrame([.02,.02,.02,1]);if(block)d.draw({mesh:blocker,pipeline:'color',params:colorParams(.3,.3,.3,1),state:{blend:'none',cull:false}});if(wall)d.draw({mesh,pipeline:'color',textures:[texture],params:colorParams(...geo.rgba),state:{blend:'add',depthWrite:false,cull:false,polygonOffset:true}});const pending=d.capture();d.endFrame();return(await pending).data;}
        const base=await render(false,false),wall=await render(true,false),blockedBase=await render(false,true),blocked=await render(true,true);let visible=0,blue=0,occlusionLeaks=0;const values=new Set();
        for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4;if(wall[i+2]>base[i+2]+2){visible++;values.add(wall[i+2]);if(wall[i+2]>wall[i]+10)blue++;}if(x>=20&&x<44&&y>=20&&y<44&&Math.abs(blocked[i+2]-blockedBase[i+2])>2)occlusionLeaks++;}
        return{visible,blue,distinctLevels:values.size,occlusionLeaks};
      },api);
      assert.ok(result.visible>100,api+' textured wall visible');assert.ok(result.blue>100,api+' native stationary blue tint');assert.ok(result.distinctLevels>1,api+' samples actual stripe texture');assert.equal(result.occlusionLeaks,0,api+' opaque world geometry occludes border');await page.close();
    }
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
