// Isolated native-data scene. This probe never connects to or changes a game server.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:854,height:480}}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await page.addInitScript(()=>localStorage.setItem('minecraftjs.settings',JSON.stringify({proxies:[],servers:[],renderDistance:2,maxFps:10,masterVolume:0,pauseOnLostFocus:false,tutorialStep:'none',clouds:0,biomeBlendRadius:0})));
 await page.route('**/config.json',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await page.goto(process.env.CLIENT_URL||'http://127.0.0.1:3002');await page.waitForFunction(()=>globalThis.game,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {Chunk}=await import('/js/world/chunk.js'),{blocksByName}=await import('/js/world/blocks.js');
  const g=game,state=name=>{const b=blocksByName[name];return b.defaultState??b.id<<4;};g.inWorld=g.doneLoadingTerrain=true;g.screens.current=null;g.player.setPosition(.5,65,.5);g.player.allowFlying=g.player.flying=true;g.player.yaw=g.player.prevYaw=180;g.player.pitch=g.player.prevPitch=20;g.gameMode=1;g.serverBrand='vanilla';g.serverViewDistance=10;g.showDebug=true;
  for(let x=-1;x<=0;x++)for(let z=-1;z<=0;z++){const c=new Chunk(x,z,true);c.biomes.fill(1);for(let a=0;a<16;a++)for(let b=0;b<16;b++)c.setState(a,64,b,state('stone'));g.world.chunks.set(x+','+z,c);g.world.emit('chunkLoaded',c,1<<4,true);}
  g.world.setState(0,65,-3,state('water'));
 });
 await page.waitForTimeout(1500);
 const report=await page.evaluate(()=>({title:document.title,crashed:!!game.crashed,left:game.hud._debugLeft(),right:game.hud._debugRight()}));
 assert.equal(report.crashed,false);assert.ok(report.left.some(s=>s.startsWith('XYZ:')));assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 await page.screenshot({path:process.env.SCREENSHOT||'/tmp/minecraftjs-f3-overlay.png'});
 console.log(JSON.stringify({report,errors,missing},null,2));
}finally{await browser.close();}
