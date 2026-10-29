// Opt-in real browser/server integration. Install Playwright separately and set PLAYWRIGHT_MODULE.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[],missing=[],warnings=[];
 page.on('pageerror',e=>{errors.push(e.stack);console.log('PAGE ERROR',e.stack);});
 page.on('console',msg=>{if(msg.type()==='error'){errors.push(msg.text());console.log('CONSOLE ERROR',msg.text());}if(msg.type()==='warning')warnings.push(msg.text());});
 page.on('response',res=>{if(res.status()>=400)missing.push({status:res.status(),url:res.url()});});
 await page.addInitScript(()=>localStorage.setItem('minecraftjs.settings',JSON.stringify({renderDistance:2,maxFps:10,entityShadows:false,graphicsApi:'webgl2',clouds:0,biomeBlendRadius:0,masterVolume:0,pauseOnLostFocus:false,tutorialStep:'none'})));
 await page.goto(process.env.CLIENT_URL||'http://127.0.0.1:3002');
 await page.waitForFunction(()=>globalThis.game,null,{timeout:120000});
 await page.evaluate(()=>{game.__packets={};const crash=game.crash.bind(game);game.crash=(error,...args)=>{console.error(error.stack);return crash(error,...args);};const handle=game.handlePacket.bind(game);game.handlePacket=p=>{game.__packets[p.name]=(game.__packets[p.name]||0)+1;return handle(p);};game.connect('localhost',25565,'Codex1171Browser');});
 await page.waitForFunction(()=>game.inWorld&&game.doneLoadingTerrain&&!game.screens.current,null,{timeout:90000});
 console.log("SPAWN",await page.evaluate(()=>({packets:game.__packets,connected:game.connected})));
 await page.waitForFunction(()=>game.__packets.keep_alive>=1||game.crashed,null,{timeout:45000}).catch(async e=>{console.log("TIMEOUT",await page.evaluate(()=>({packets:game.__packets,inWorld:game.inWorld,screen:game.screens.current?.constructor.name})),errors,missing,warnings);throw e;});
 await page.keyboard.down('KeyW');await page.waitForTimeout(350);await page.keyboard.up('KeyW');await page.waitForTimeout(1500);
 const report=await page.evaluate(()=>({inWorld:game.inWorld,connected:game.connected,crashed:!!game.crashed,crashReport:document.querySelector('#crash textarea')?.value,screen:game.screens.current?.constructor.name||null,chunks:game.world.chunks.size,entities:game.entities.map.size,packets:game.__packets,position:[game.player.x,game.player.y,game.player.z],title:document.title,knownRecipes:game.recipeBook?.known.size}));
 await page.screenshot({path:process.env.SCREENSHOT||'/tmp/minecraftjs-1.17.1-join.png'});
 console.log(JSON.stringify({report,errors,missing,warnings},null,2));assert.equal(report.crashed,false);assert.ok(report.inWorld);assert.equal(report.screen,null);assert.ok(report.chunks>0);assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert.deepEqual(warnings.filter(w=>/decode packet|Bad font provider/.test(w)),[]);
}finally{await browser.close();}
