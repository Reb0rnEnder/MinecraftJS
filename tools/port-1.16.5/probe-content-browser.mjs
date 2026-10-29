// Isolated client scene; never connects to or changes a game server.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('minecraftjs.settings',JSON.stringify({renderDistance:2,maxFps:30,entityShadows:true,masterVolume:0,pauseOnLostFocus:false,tutorialStep:'none'})));
 await page.goto(process.env.CLIENT_URL||'http://127.0.0.1:3001');await page.waitForFunction(()=>globalThis.game,null,{timeout:120000});
 const report=await page.evaluate(async()=>{
  const {Chunk,Section}=await import('/js/world/chunk.js'),{findState}=await import('/js/world/blocks.js'),{NATIVE_METADATA}=await import('/js/game/entity-metadata-1.16.5.js'),{openContainerScreen}=await import('/js/gui/screens/containers.js'),{ContainerWindow}=await import('/js/game/container.js');
  const g=game;g.inWorld=true;g.doneLoadingTerrain=true;g.world.timeOfDay=6000;g.player.setPosition(0,2,-10);g.player.yaw=g.player.prevYaw=0;g.player.pitch=g.player.prevPitch=0;g.player.allowFlying=g.player.flying=true;g.player.creative=true;g.gameMode=1;
  for(let x=-1;x<=0;x++)for(let z=-1;z<=0;z++){
   const chunk=new Chunk(x,z,true),section=new Section(true);for(let i=0;i<256;i++)section.blocks[i]=findState('stone');section.nonAir=256;section.skyLight.fill(255);chunk.sections[0]=section;chunk.biomes.fill(1);g.world.chunks.set(x+','+z,chunk);g.world.emit('chunkLoaded',chunk);
  }
  const names=['hoglin','zoglin','piglin','piglin_brute','zombified_piglin','strider'];
  for(let i=0;i<12;i++){
   const name=names[i%6],def=g.assets.data.entities.find(d=>d.name===name),id=10000+i,metadata={},ids=NATIVE_METADATA[name];
   if(i>=6&&ids.DATA_BABY_ID!==undefined)metadata[ids.DATA_BABY_ID]=true;
   if(name==='strider'){metadata[ids.DATA_SADDLE_ID]=true;metadata[ids.DATA_SUFFOCATING]=i>=6;}
   if(name==='piglin')metadata[ids.DATA_IS_DANCING]=true;
   g.entities.spawnMob({entityId:id,entityUUID:'00000000-0000-0000-0000-'+id.toString().padStart(12,'0'),type:def.id,x:(i%6-2.5)*2.5,y:1,z:i>=6?4:0,yaw:180,pitch:0,headPitch:180,velocity:{x:0,y:0,z:0},metadata});
   if(['piglin','piglin_brute','zombified_piglin'].includes(name)){g.entities.setEquipment(id,0,{id:g.assets.itemsByName.get('netherite_sword').id,count:1});g.entities.setEquipment(id,3,{id:g.assets.itemsByName.get('netherite_chestplate').id,count:1});}
  }
  g.screens.close();g.hideGui=true;
  await new Promise(r=>setTimeout(r,1500));
  const rendered=[...g.entityRenderer.visuals].filter(([id])=>id>=10000).map(([id,v])=>({id,parts:v.model?.jarModel,mesh:v.bodyDrawables?.length}));
  const win=new ContainerWindow(g,99,'minecraft:smithing','Upgrade',3);openContainerScreen(g,win);
  const menu={type:g.screens.current.container.type,slots:g.screens.current.slotPos.slice(0,3),title:[g.screens.current.titleX,g.screens.current.titleY]};g.screens.close();
  const {OptionsScreen,ChatOptionsScreen,AccessibilityScreen}=await import('/js/gui/screens/options.js'),{SocialInteractionsScreen}=await import('/js/gui/screens/social.js'),{GameModeSwitcherScreen}=await import('/js/gui/screens/gamemode-switcher.js');
  const options=new OptionsScreen(g,null);g.screens.open(options);options.buttons.find(b=>b.id===101).onClick();const video=g.screens.current.rows.flat().filter(b=>b.optionKey).map(b=>b.optionKey);
  const chat=new ChatOptionsScreen(g,null);g.screens.open(chat);const chatRows=chat.rows.flat().map(b=>b.optionKey);
  const accessibility=new AccessibilityScreen(g,null);g.screens.open(accessibility);const accessibilityRows=accessibility.rows.flat().map(b=>b.optionKey);
  g.screens.open(new SocialInteractionsScreen(g));await new Promise(r=>setTimeout(r,100));
  g.input.down.add('F3');g.input.heldKeys.add('F3');g.screens.open(new GameModeSwitcherScreen(g));await new Promise(r=>setTimeout(r,100));g.screens.close();g.input.down.delete('F3');g.input.heldKeys.delete('F3');
  return {rendered,menu,video,chatRows,accessibilityRows};
 });
 await page.screenshot({path:process.env.SCREENSHOT||'/tmp/minecraftjs-1.16.5-nether.png'});console.log(JSON.stringify({report,errors},null,2));assert.equal(report.rendered.length,12);assert.ok(report.rendered.every(e=>e.parts&&e.mesh>0));assert.equal(report.menu.type,'minecraft:smithing');assert.equal(report.video.length,18);assert.equal(report.chatRows.length,16);assert.equal(report.accessibilityRows.length,12);assert.deepEqual(errors,[]);
}finally{await browser.close();}
