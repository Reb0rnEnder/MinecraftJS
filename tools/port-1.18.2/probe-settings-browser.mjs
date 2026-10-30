import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('minecraftjs.settings',JSON.stringify({renderDistance:2,maxFps:10,clouds:0,masterVolume:0,biomeBlendRadius:0,tutorialStep:'none'})));
 await page.goto(process.env.CLIENT_URL||'http://127.0.0.1:3003');await page.waitForFunction(()=>globalThis.game,null,{timeout:120000});
 const result=await page.evaluate(async()=>{const {VideoScreen}=await import('/js/gui/screens/options.js'),{VANILLA_UI}=await import('/js/gui/vanilla-layout.js'),g=game;g.screens.open(new VideoScreen(g,g.screens.current));const rows=g.screens.current.rows.flat(),keys=rows.map(b=>b.optionKey).filter(Boolean);const priority=rows.find(b=>b.optionKey==='options.prioritizeChunkUpdates'),modes=[];for(let i=0;i<3;i++){modes.push(g.settings.prioritizeChunkUpdates);priority.onClick();}return{version:VANILLA_UI.version,keys,expected:VANILLA_UI.videoOptions,modes,crashed:!!g.crashed};});
 assert.deepEqual(result.keys,result.expected);assert.equal(result.version,'1.18.2');assert.deepEqual(result.modes,['none','byPlayer','nearby']);assert.equal(result.crashed,false);assert.deepEqual(errors,[]);console.log(JSON.stringify({result,errors},null,2));
}finally{await browser.close();}
