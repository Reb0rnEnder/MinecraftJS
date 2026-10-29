import{readdirSync}from'node:fs';
import{test}from'node:test';import assert from'node:assert/strict';import{createServer}from'node:http';import{readFile}from'node:fs/promises';import{resolve,sep}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(fileURLToPath(new URL('../client/',import.meta.url)));
test('the browser audio adapter decodes every shipped sound sample',{skip:!process.env.PLAYWRIGHT_MODULE,timeout:180000},async()=>{
 const{chromium}=await import(process.env.PLAYWRIGHT_MODULE),server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<body></body>');return;}const path=resolve(root,'.'+req.url);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.json')?'application/json':'audio/ogg');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--js-flags=--expose-gc']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  const list=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(resolve(dir,e.name)):[resolve(dir,e.name)]);
  const shipped=list(resolve(root,'assets/minecraft/sounds')).filter(p=>p.endsWith('.ogg')).map(p=>p.slice(resolve(root,'assets/minecraft/sounds').length+1).replaceAll('\\','/').slice(0,-4));
  const result=await page.evaluate(async(shipped)=>{
   const{BrowserPlatform}=await import('/js/platform/browser.js'),audio=BrowserPlatform.prototype.createAudio.call({}),defs=await fetch('/assets/minecraft/sounds.json').then(r=>r.json()),files=new Set(shipped),errors=[];
   for(const def of Object.values(defs))for(const raw of def.sounds||[]){const s=typeof raw==='string'?{name:raw}:raw;if(s.type!=='event')files.add(s.name.replace(/^minecraft:/,''));}
   const queue=[...files];let decoded=0;
   await Promise.all(Array.from({length:2},async()=>{while(queue.length){const file=queue.shift();try{const response=await fetch('/assets/minecraft/sounds/'+file+'.ogg');if(!response.ok)throw Error('HTTP '+response.status);const b=await audio.decode(new Uint8Array(await response.arrayBuffer()));if(!(b.length>0&&b.duration>0))throw Error('empty decoded sample');decoded++;}catch(e){errors.push({file,error:e.message});}if(decoded%50===0)globalThis.gc?.();}}));
   await audio.ctx?.close();return{decoded,total:files.size,errors};
  },shipped);
  assert.ok(result.total>0);assert.deepEqual(result.errors,[]);assert.equal(result.decoded,result.total);console.log('Decoded '+result.decoded+' native Ogg samples through the browser audio adapter');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
