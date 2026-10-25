// Opt-in browser regression; install Playwright separately and set PLAYWRIGHT_MODULE
// to its index.mjs if it is not available in this checkout's module search path.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(fileURLToPath(new URL('../client',import.meta.url)));
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://test').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<link rel="stylesheet" href="/style.css"><canvas></canvas>');return;}
  const path=resolve(root,'.'+pathname);if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/plain');res.end(await readFile(path));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--no-proxy-server','--host-resolver-rules=MAP crash-http.test 127.0.0.1']});
const report='---- MinecraftJS Crash Report ----\nTypeError: mover.bb is not a function\nUnicode: ą → 🐢\n'+'at game loop\n'.repeat(150);
try{
 for(const mode of ['http','clipboard','rejected','manual']){
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const host=mode==='clipboard'?'localhost':'crash-http.test';await page.goto(`http://${host}:${port}/`);
  await page.evaluate(async({mode,report})=>{
   const {BrowserPlatform}=await import('/js/platform/browser.js');
   const platform=Object.create(BrowserPlatform.prototype);platform.canvas=document.querySelector('canvas');platform.handlers={};platform.dpr=1;platform._userGesture=()=>{};platform._bindInput();
   window.gameKeys=0;platform.on('keydown',()=>window.gameKeys++);
   if(mode==='rejected')Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('permission denied');}}});
   if(mode==='manual')document.execCommand=()=>false;
   const {showCrashScreen}=await import('/js/crash.js');showCrashScreen(report);
  },{mode,report});
  const text=page.getByRole('textbox',{name:'Crash report'});
  assert.equal(await text.inputValue(),report);assert.equal(await text.evaluate(el=>el.readOnly),true);
  assert.equal(await text.evaluate(el=>getComputedStyle(el).userSelect),'text');
  if(mode==='http')assert.equal(await page.evaluate(()=>isSecureContext||!!navigator.clipboard),false);
  const bounds=await text.boundingBox();await page.mouse.move(bounds.x+15,bounds.y+20);await page.mouse.down();await page.mouse.move(bounds.x+180,bounds.y+20,{steps:8});await page.mouse.up();
  assert.ok(await text.evaluate(el=>el.selectionEnd>el.selectionStart),'mouse selection works');
  await text.press('Control+A');assert.equal(await text.evaluate(el=>el.selectionEnd-el.selectionStart),report.length);
  await text.hover();await page.mouse.wheel(0,350);await page.waitForFunction(()=>document.querySelector('#crash textarea').scrollTop>0);
  assert.equal(await text.evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))),true);
  await page.getByRole('button',{name:'Copy crash report'}).click();
  if(mode==='manual'){
   assert.equal(await page.getByRole('button',{name:'Press Ctrl+C to copy'}).count(),1);
   assert.equal(await text.evaluate(el=>el.selectionEnd-el.selectionStart),report.length);await text.press('Control+C');
  }else await page.getByRole('button',{name:'Copied!',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.gameKeys),0,'game input does not intercept report shortcuts');
  const reader=await context.newPage();await reader.goto(`http://localhost:${port}/`);
  assert.equal(await reader.evaluate(()=>navigator.clipboard.readText()),report,'actual clipboard contains complete report');
  assert.deepEqual(errors,[]);await context.close();console.log('PASS crash screen: '+mode);
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
