// GPU construction of all new providers in an isolated scene, no server changes.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:854,height:480}}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await page.addInitScript(()=>localStorage.setItem('minecraftjs.settings',JSON.stringify({proxies:[],servers:[],renderDistance:2,maxFps:10,masterVolume:0,pauseOnLostFocus:false,tutorialStep:'none',clouds:0,biomeBlendRadius:0})));
 await page.route('**/config.json',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await page.goto(process.env.CLIENT_URL||'http://127.0.0.1:3002');await page.waitForFunction(()=>globalThis.game,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {CAVES_PARTICLES}=await import('/js/render/particles-1.17.1.js'),{blocksByName}=await import('/js/world/blocks.js'),{Chunk}=await import('/js/world/chunk.js');
  const g=game;g.inWorld=g.doneLoadingTerrain=true;g.screens.current=null;g.gameMode=1;g.player.creative=true;g.player.allowFlying=g.player.flying=true;g.player.setPosition(0,65,-8);g.player.yaw=g.player.prevYaw=0;g.player.pitch=g.player.prevPitch=0;
  const c=new Chunk(0,0,true);c.biomes.fill(1);g.world.chunks.set('0,0',c);g.world.emit('chunkLoaded',c);g.particles.clear();
  for(const [i,type]of [...CAVES_PARTICLES].entries())g.particles.nativeParticle(type,(i%6-2.5)*1.5,66+Math.floor(i/6)*.5,2,0,.01,0,{origin:{x:0,y:66,z:2},positionType:'minecraft:block',destination:{x:4,y:66,z:2},ticks:20,red:0,green:1,blue:1,scale:1,toRed:1,toGreen:0,toBlue:0});
  g.world.setState(0,66,0,blocksByName.light.defaultState);g.inventory.main[g.heldSlot]={id:g.items.byName.get('light').id,count:1};g.particles.barrier(0,66,0,'light');
  g.particles.tick=()=>{};g.weather.tick=()=>{};
 });
 await page.waitForTimeout(700);
 const report=await page.evaluate(async()=>{
  const {particleSprite}=await import('/js/render/particle-sprites.js');return{crashed:!!game.crashed,particles:game.particles.list.map(p=>({sprite:p.sprite,marker:p.markerBlock,valid:p.markerBlock==='light'||!!particleSprite(game.assets,p,0)})),quads:game.particles.batchP.n,atlasQuads:game.particles.batchA.n};
 });
 assert.equal(report.crashed,false);assert.equal(report.particles.length,17);assert.ok(report.particles.every(p=>p.valid));assert.ok(report.quads>=17);assert.equal(report.atlasQuads,1);assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 await page.screenshot({path:'/tmp/minecraftjs-caves-particles.png'});console.log(JSON.stringify({report,errors,missing},null,2));
}finally{await browser.close();}
