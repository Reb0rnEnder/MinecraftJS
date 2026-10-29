// Isolated browser world: no game-server connection or world edits.
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('minecraftjs.settings', JSON.stringify({renderDistance:2,maxFps:30,masterVolume:0,pauseOnLostFocus:false,tutorialStep:'none'})));
  await page.goto(process.env.CLIENT_URL || 'http://127.0.0.1:3001');
  await page.waitForFunction(() => globalThis.game, null, {timeout:120000});
  const result = await page.evaluate(async () => {
    const {Chunk,Section} = await import('/js/world/chunk.js');
    const {findState} = await import('/js/world/blocks.js');
    const g = game, sounds = [];
    g.send = () => {}; // this scene cannot send gameplay packets
    g.sound.play = (...args) => { sounds.push(args); return Promise.resolve(null); };
    g.inWorld = g.doneLoadingTerrain = true;
    g.entityId = 123;
    g.gameMode = 1;
    g.player.setPosition(.5,1,.5);
    g.player.yaw = g.player.pitch = 0;
    for (let x=-1;x<=0;x++) for (let z=-1;z<=0;z++) {
      const chunk = new Chunk(x,z,true), section = new Section(true);
      for (let i=0;i<256;i++) section.blocks[i] = findState('stone');
      section.nonAir = 256; section.skyLight.fill(255); chunk.sections[0] = section; chunk.biomes.fill(1);
      g.world.chunks.set(x+','+z,chunk); g.world.emit('chunkLoaded',chunk);
    }
    const item = {id:g.assets.itemsByName.get('stone').id,count:64,damage:0};
    const target = {type:'block',x:1,y:0,z:2,face:1,hit:[1.5,1,2.5]};
    g.interaction.target = target; g.inventory.setHeld(item);
    g.interaction.rightClickMouse();
    const boat = g.entities._base(10001,.5,1,.5,0,0);
    Object.assign(boat,{kind:'boat',width:1.375,height:.5625,passengerList:[g.entityId],controlled:true});
    g.entities.add(boat); g.ridingEntityId=boat.id; g.player.ridingEntity=boat; g.player.ridingBoat=true; g.vehicle={e:boat};
    g.on_entity_destroy({entityIds:[boat.id]});
    g.screens.current=null; g.input.locked=true; g.input.down.add(g.settings.keys.forward);
    const before = [g.player.x,g.player.y,g.player.z];
    for(let tick=0;tick<6;tick++)g.tick();
    g.input.down.clear();
    return {sounds:sounds.filter(s=>s[0]==='block.stone.place'),riding:g.ridingEntityId,boat:g.player.ridingBoat,controller:!!g.vehicle,before,after:[g.player.x,g.player.y,g.player.z]};
  });
  assert.equal(result.sounds.length,1);
  assert.deepEqual(result.sounds[0].slice(1,4),[1.5,1.5,2.5]);
  assert.equal(result.riding,-1); assert.equal(result.boat,false); assert.equal(result.controller,false);
  assert.ok(Math.hypot(result.after[0]-result.before[0],result.after[2]-result.before[2])>.1);
  assert.deepEqual(errors,[]); console.log(JSON.stringify({result,errors},null,2));
} finally { await browser.close(); }
