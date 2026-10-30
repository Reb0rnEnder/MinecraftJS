// Controlled world scenes: the view through actual worker-meshed tinted glass
// must change with the wall behind it. Does not connect to a server.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('minecraftjs.settings',JSON.stringify({proxies:[],servers:[],renderDistance:2,maxFps:10,masterVolume:0,pauseOnLostFocus:false,tutorialStep:'none',clouds:0,biomeBlendRadius:0})));
 await page.route('**/config.json',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));await page.goto(process.env.CLIENT_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>globalThis.game,null,{timeout:120000});
 const reports=[];
 for(const mode of ['none','byPlayer','nearby'])for(const fabulous of [false,true])for(const wall of ['white_wool','red_wool']){
  await page.evaluate(async({mode,fabulous,wall})=>{
   const {Chunk}=await import('/js/world/chunk.js'),{blocksByName}=await import('/js/world/blocks.js'),g=game;
   g.world.clear();g._resetMeshing();g.world.setDimension(0);g.settings.fabulousGraphics=fabulous;g.settings.prioritizeChunkUpdates=mode;g.inWorld=g.doneLoadingTerrain=true;g.screens.current=null;g.gameMode=1;g.hideGui=true;g.player.allowFlying=g.player.flying=true;g.player.setPosition(.5,.88,-2.5);g.player.yaw=g.player.prevYaw=0;g.player.pitch=g.player.prevPitch=0;g.world.timeOfDay=6000;
   for(let x=-1;x<=0;x++)for(let z=-1;z<=0;z++){const c=new Chunk(x,z,true);c.biomes.fill(1);for(let wx=-3;wx<=3;wx++)for(let y=0;y<=5;y++)if(wx>>4===x&&z===0)c.setState(wx&15,y,2,blocksByName[wall].defaultState);if(x===0&&z===0)c.setState(0,2,0,blocksByName.tinted_glass.defaultState);g.world.chunks.set(x+','+z,c);g.world._computeHeights(c);g.world.emit('chunkLoaded',c);}for(const key of g.dirty)g.playerAffectedSections.add(key);
  },{mode,fabulous,wall});
  await page.waitForFunction(()=>game.renderer.sections.size>=2&&game.dirty.size===0&&game.inFlight.size===0,null,{timeout:20000});await page.waitForTimeout(200);
  const result=await page.evaluate(async()=>{const image=await game.device.capture(),x=image.width>>1,y=image.height>>1,i=(y*image.width+x)*4;return{pixel:[...image.data.slice(i,i+4)],crashed:!!game.crashed,glError:game.device.gl.getError(),layers:[...game.renderer.sections.values()].filter(s=>s.translucent).length};});
  assert.equal(result.crashed,false);assert.equal(result.glError,0);assert.ok(result.layers>0);reports.push({mode,fabulous,wall,...result});await page.screenshot({path:'/tmp/minecraftjs-tinted-'+mode+'-'+fabulous+'-'+wall+'.png'});
 }
 for(let i=0;i<reports.length;i+=2){const white=reports[i].pixel,red=reports[i+1].pixel;assert.ok(white[1]>red[1]+5&&white[2]>red[2]+5,'wall remains visible through tinted glass: '+JSON.stringify(reports.slice(i,i+2)));}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({reports,errors},null,2));
}finally{await browser.close();}
