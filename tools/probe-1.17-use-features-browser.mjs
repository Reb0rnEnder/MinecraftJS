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
  const g=game,state=name=>blocksByName[name].defaultState;
  g.playerUuid='00000000-0000-0000-0000-000000000002';g.username='Parity';g.entityRenderer.skins.set(g.playerUuid,{path:'entity/steve.png',slim:false,texture:null,propValue:null});g.inWorld=g.doneLoadingTerrain=true;g.screens.current=null;g.gameMode=1;g.player.setPosition(.5,65,3.5);g.player.allowFlying=g.player.flying=true;g.player.yaw=g.player.prevYaw=180;g.player.pitch=g.player.prevPitch=0;
  for(let x=-1;x<=0;x++)for(let z=-1;z<=0;z++){const c=new Chunk(x,z,true);c.biomes.fill(1);for(let a=0;a<16;a++)for(let b=0;b<16;b++)c.setState(a,64,b,state('stone'));g.world.chunks.set(x+','+z,c);g.world.emit('chunkLoaded',c,1<<4,true);}
  for(const [x,color,glow,name]of[[0,'red',1,'oak_sign'],[-1,'black',1,'warped_sign'],[1,'red',0,'crimson_sign']]){
   g.world.setState(x,65,0,state(name));g.tileRenderer.setTileEntity({x,y:65,z:0},9,{Text1:JSON.stringify({text:'Glow '+color}),Text2:'"TEST"',Color:color,GlowingText:glow});
  }
  const stack={id:g.items.byName.get('spyglass').id,count:1,damage:0};g.inventory.main[g.heldSlot]=stack;
  g._testSpyglass=stack;g.interaction.activeHand=0;g.player.usingItem=true;g.input.isDown=action=>action==='use';Object.defineProperty(g.input,'locked',{get:()=>true,configurable:true});
 });
 await page.waitForTimeout(1500);
 const report=await page.evaluate(async()=>{
  const {usingSpyglass,isScoping}=await import('/js/game/spyglass.js');
  const g=game,held=g.inventory.getHand(0),tiles=[...g.tileRenderer.tiles.values()].filter(t=>t.type==='sign');
  return {crashed:!!g.crashed,held:held&&g.items.name(held.id),using:usingSpyglass(g),scoping:isScoping(g),scopeScale:g.hud.scopeScale,model:g.itemRenderer.modelFor(g._testSpyglass,null,true).name,handHidden:g.handRenderer.prepare(0)===null,signs:tiles.map(t=>({wood:t.type,built:t.built,outlined:t.signOutlined,glow:!!t.data?.GlowingText,params:t.signTextParams?.[0]?.[0]}))};
 });
 assert.equal(report.crashed,false);assert.equal(report.held,'spyglass');assert.equal(report.scoping,true);assert.equal(report.model,'spyglass_in_hand');assert.equal(report.handHidden,true);assert.equal(report.signs.length,3);assert.ok(report.signs.filter(t=>t.glow).every(t=>t.outlined&&t.params===1));assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 await page.screenshot({path:process.env.SCREENSHOT||'/tmp/minecraftjs-spyglass-signs.png'});
 const thirdPerson=[];
 for(const primary of ['right','left'])for(const hand of [0,1]){
  await page.evaluate(({primary,hand})=>{const g=game;g.thirdPerson=1;g.settings.mainHand=primary;g.interaction.activeHand=hand;g.inventory.main[g.heldSlot]=hand===0?g._testSpyglass:null;g.inventory.offhand=hand===1?g._testSpyglass:null;g.player.usingItem=true;g.input.isDown=action=>action==='use';},{primary,hand});
  await page.waitForFunction(()=>game.entityRenderer.visuals.has(-1),null,{timeout:10000}).catch(async e=>{console.log(JSON.stringify(await page.evaluate(()=>({crashed:!!game.crashed,inWorld:game.inWorld,ticks:game.ticks,thirdPerson:game.thirdPerson,cameraEntity:game.cameraEntity,self:game.entities.self&&{id:game.entities.self.id,kind:game.entities.self.kind},visuals:[...game.entityRenderer.visuals.keys()]}))));console.log(errors);throw e;});
  await page.waitForTimeout(200);
  const attachment=await page.evaluate(({primary,hand})=>{const v=game.entityRenderer.visuals.get(-1),right=(primary==='right')===(hand===0),holder=right?v.itemHolder:v.leftHolder;return {attachedToHead:holder.parent===v.model.parts.head.obj.parent,armPitch:(right?v.model.parts.rightArm:v.model.parts.leftArm).rx,headPitch:v.model.parts.head.rx};},{primary,hand});
  assert.equal(attachment.attachedToHead,true);assert.ok(attachment.armPitch < -1);thirdPerson.push({primary,hand,...attachment});
 }
 await page.evaluate(()=>{game.thirdPerson=0;game.settings.mainHand='right';game.inventory.main[game.heldSlot]=game._testSpyglass;game.inventory.offhand=null;});
 await page.evaluate(async()=>{
  const {blocksByName}=await import('/js/world/blocks.js'),g=game;
  g.input.isDown=()=>false;g.player.usingItem=false;g.gameMode=0;g.health=g.maxHealth=20;g.food=20;g.player.setPosition(.5,65,.5);
  g.world.setState(0,66,0,blocksByName.powder_snow.defaultState);
  g.on_entity_metadata({entityId:g.entityId,metadata:{7:140}});
  g._frostDraws=[];g._frozenHearts=[];
  const quad=g.gui.quad.bind(g.gui),blit=g.gui.blit.bind(g.gui),frost=g.gui.tex('misc/powder_snow_outline.png');
  g.gui.quad=(...args)=>{if(args[0]===g.gui.tex('misc/powder_snow_outline.png'))g._frostDraws.push(args.at(-1));return quad(...args);};
  g.gui.blit=(...args)=>{if(args[0]==='gui/icons.png'&&args[3]===178)g._frozenHearts.push(args);return blit(...args);};
 });
 await page.waitForFunction(()=>game._frostDraws.length>0,null,{timeout:15000});
 const freezing=await page.evaluate(()=>({ticks:game.player.frozenTicks,overlay:game._frostDraws.at(-1),heartCount:game._frozenHearts.length,fog:game.renderer.fog,crashed:!!game.crashed}));
 assert.equal(freezing.crashed,false);assert.equal(freezing.ticks,140);assert.deepEqual(freezing.overlay,[1,1,1,1]);assert.ok(freezing.heartCount>=10);assert.equal(freezing.fog.end,2);assert.deepEqual(freezing.fog.color,[.623,.734,.785]);assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 await page.screenshot({path:'/tmp/minecraftjs-freezing.png'});
 console.log(JSON.stringify({report,thirdPerson,freezing,errors,missing},null,2));
}finally{await browser.close();}
