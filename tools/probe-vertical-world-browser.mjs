// Isolated source/worker/GPU scenes at negative Y and above 255. No server changes.
import assert from 'node:assert/strict';const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:854,height:480}}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await page.addInitScript(()=>localStorage.setItem('minecraftjs.settings',JSON.stringify({proxies:[],servers:[],renderDistance:2,maxFps:10,masterVolume:0,pauseOnLostFocus:false,tutorialStep:'none',clouds:0,biomeBlendRadius:0})));
 await page.route('**/config.json',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));await page.goto(process.env.CLIENT_URL||'http://127.0.0.1:3002');await page.waitForFunction(()=>globalThis.game,null,{timeout:120000});
 const reports=[];
 for(const floor of[-32,304]){
  await page.evaluate(async floor=>{
   const {Chunk}=await import('/js/world/chunk.js'),{blocksByName}=await import('/js/world/blocks.js'),g=game;
   g.world.clear();g._resetMeshing();g.world.setDimension(0,{min_y:-64,height:384,has_skylight:true});
   g.inWorld=g.doneLoadingTerrain=true;g.screens.current=null;g.gameMode=1;g.showDebug=true;g.player.allowFlying=g.player.flying=true;g.player.setPosition(.5,floor+1,.5);g.player.yaw=g.player.prevYaw=0;g.player.pitch=g.player.prevPitch=35;
   for(let x=-1;x<=0;x++)for(let z=-1;z<=0;z++){const c=new Chunk(x,z,true,g.world);c.biomes.fill(1);for(let a=0;a<16;a++)for(let b=0;b<16;b++)c.setState(a,floor,b,blocksByName.stone.defaultState);g.world.chunks.set(x+','+z,c);g.world._computeHeights(c);g.world.emit('chunkLoaded',c);}
  },floor);
  await page.waitForFunction(()=>game.renderer.sections.size>=4,null,{timeout:15000});await page.waitForTimeout(200);
  const r=await page.evaluate(()=>({crashed:!!game.crashed,position:game.player.y,sections:[...game.renderer.sections.values()].map(s=>s.sy),visible:game.renderer.visibleSections,f3:game.hud._debugLeft(),precipitation:game.weather.precipHeight(0,0),fog:game.renderer.fog.color}));
  assert.equal(r.crashed,false);assert.ok(r.sections.every(y=>y===Math.floor(floor/16)));assert.ok(r.visible>0);assert.equal(r.precipitation,floor+1);assert.ok(r.f3.some(l=>l.startsWith('Biome:')));assert.ok(r.f3.some(l=>l===`CH S: ${floor} M: ${floor}`));assert.ok(r.fog.some(c=>c>0));reports.push(r);await page.screenshot({path:'/tmp/minecraftjs-height-'+floor+'.png'});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log(JSON.stringify({reports,errors,missing},null,2));
}finally{await browser.close();}
