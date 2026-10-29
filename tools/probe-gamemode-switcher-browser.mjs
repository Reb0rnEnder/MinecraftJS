// Isolated scene with real browser pointer lock and key events; no server commands.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('minecraftjs.settings',JSON.stringify({renderDistance:2,maxFps:10,masterVolume:0,pauseOnLostFocus:false,tutorialStep:'none'})));
 await page.goto(process.env.CLIENT_URL||'http://127.0.0.1:3002');await page.waitForFunction(()=>globalThis.game,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {Reader}=await import('/js/net/buffer.js'),{C}=await import('/js/net/packets.js');const chatId=new Reader(C.chat('')).varint();
  game.inWorld=game.doneLoadingTerrain=true;game.permissionLevel=2;game.gameMode=0;game.previousGameMode=1;game.screens.current=null;game.__commands=[];
  game.send=bytes=>{const r=new Reader(bytes);if(r.varint()===chatId)game.__commands.push(r.string());};
 });
 await page.locator('canvas').first().click();await page.waitForFunction(()=>game.input.locked);
 await page.keyboard.down('F3');await page.keyboard.down('F4');await page.keyboard.up('F4');
 await page.waitForTimeout(1200);
 const held=await page.evaluate(()=>({open:!!game.screens.current,held:game.input.isKeyHeld('F3'),locked:game.input.locked,selected:game.screens.current?.selected,commands:game.__commands}));
 assert.equal(held.open,true);assert.equal(held.held,true);assert.equal(held.locked,false);assert.equal(held.selected,0);assert.deepEqual(held.commands,[]);
 await page.keyboard.press('F4');await page.keyboard.press('F4');await page.keyboard.up('F3');await page.waitForTimeout(200);
 const released=await page.evaluate(()=>({open:!!game.screens.current,commands:game.__commands,showDebug:game.showDebug,crashed:!!game.crashed}));
 assert.equal(released.open,false);assert.deepEqual(released.commands,['/gamemode adventure']);assert.equal(released.showDebug,false);assert.equal(released.crashed,false);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({held,released,errors},null,2));
}finally{await browser.close();}
