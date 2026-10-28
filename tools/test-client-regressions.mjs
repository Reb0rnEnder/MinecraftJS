import { Renderer } from '../client/js/render/renderer.js';
import { BreakingOverlay } from '../client/js/render/breaking.js';
import { blockModelOffset } from '../client/js/render/mesher.js';
import { Interaction } from '../client/js/game/interaction.js';
import { Assets } from '../client/js/assets.js';
import { ProxyList as GameProxyList, validSkinProxyTemplate, skinProxyUrl, fetchSkin, fetchSkinProfile } from '../client/js/net/proxies.js';
import { SkinProxyScreen } from '../client/js/gui/screens/proxies.js';
import { platform } from '../client/js/platform/platform.js';
import { debugTargets } from '../client/js/gui/debug-targets.js';
import { VANILLA_UI } from '../client/js/gui/vanilla-layout.js';
import { VideoScreen, ControlsScreen } from '../client/js/gui/screens/options.js';
import { ResourcePacksScreen } from '../client/js/gui/screens/packs.js';
import { ConfirmScreen } from '../client/js/gui/screens/menus.js';
import { setTranslator } from '../client/js/gui/i18n.js';
import { buildSlice, SliceWorld } from '../client/js/world/slice.js';
import { Hud } from '../client/js/gui/hud.js';
import { createHash } from 'node:crypto';
import { jarSelectionBox, getBlock, findState } from '../client/js/world/blocks.js';
import { startSleeping, stopSleeping, updateSleeping, sleepingCamera } from '../client/js/game/bed-sleep.js';
import { TileEntityRenderer } from '../client/js/render/tile-renderer.js';
import { World } from '../client/js/world/world.js';
import { Chunk } from '../client/js/world/chunk.js';
import { Mesher } from '../client/js/render/mesher.js';
import { resolveState } from '../client/js/world/blockstates.js';
import { SoftwareDevice } from '../client/js/gfx/software.js';
import { crystalBeam, guardianBeam, dragonDeathRays, tickEntityEffects } from '../client/js/render/entity-effects.js';
// Identical offline regression suite for 1.8.9, 1.12.2 and 1.13.2; uses each checkout's jar/data.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { ZipFile } from '../lib/zip.js';
import { extractModels } from '../lib/modelextract.js';
import mcassets from '../lib/mcassets.js';
import { initBlocks } from '../client/js/world/blocks.js';
import { Items } from '../client/js/game/items.js';
import { Inventory, copy, stackable } from '../client/js/game/container.js';
import { LocalPlayer } from '../client/js/game/physics.js';
import { Game } from '../client/js/game/game.js';
import { Settings } from '../client/js/game/settings.js';
import { setPlatform } from '../client/js/platform/platform.js';
import { chatToLegacy } from '../client/js/gui/chat.js';
import { nbt } from '../client/js/net/nbt.js';
import { EntityManager } from '../client/js/game/entities.js';
import { EntityRenderer } from '../client/js/render/entity-renderer.js';
import { HandRenderer } from '../client/js/render/hand-renderer.js';
import { ItemRenderer } from '../client/js/render/item-renderer.js';
import { setModelDevice } from '../client/js/render/boxmodel.js';
import { setJarModels } from '../client/js/render/entity-models.js';
import { Atlas } from '../client/js/render/atlas.js';
import { ModelStore } from '../client/js/render/models.js';
import { decodePng } from '../client/js/util/png.js';
import { Node } from '../client/js/gfx/scene.js';
import { mat4 } from '../client/js/gfx/math.js';
import { loadParticleSprites } from '../client/js/render/particle-sprites.js';
import { Particles } from '../client/js/render/particles.js';
import { Weather } from '../client/js/render/weather.js';
import { sectionLod, poseInterval } from '../client/js/render/lod.js';
const version = mcassets.MC_VERSION, native = ['1.13.2','1.14.4','1.15.2'].includes(version), target14=['1.14.4','1.15.2'].includes(version);
const jar = new ZipFile(await mcassets.locateJar());
const data = Object.fromEntries(['blocks','items','creative','blockCollisionShapes','enchantments','particles','foods','materials']
  .map(n => [n, JSON.parse(readFileSync(new URL('../client/data/' + n + '.json', import.meta.url)))]));
initBlocks(data.blocks, data.blockCollisionShapes);
const extracted = extractModels(jar);
const absent189 = new Set(['strayOverlay','shulker','polarBear','llama','parrot','vex','illager','elytra','evokerFangs','llamaSpit','shulkerBullet','bed','dragonHead']);
assert.deepEqual(extracted.errors.filter(e => version !== '1.8.9' || !absent189.has(e.split(':')[0])), []);
setJarModels(extracted.models);
const prefix = 'assets/minecraft/';
const jsonAssets = dir => Object.fromEntries(jar.list(prefix + dir + '/').filter(n => n.endsWith('.json'))
  .map(n => [n.slice((prefix + dir + '/').length, -5), JSON.parse(jar.read(n))]));
const images = new Map();
const image = name => {
  if (!images.has(name)) { const raw = jar.read(prefix + 'textures/' + name); assert.ok(raw, name); images.set(name, decodePng(raw)); }
  return images.get(name);
};
const atlas = new Atlas();
atlas.build(jar.list(prefix + 'textures/').filter(n => /^assets\/minecraft\/textures\/(blocks?|items?)\/.*\.png$/.test(n))
  .map(n => ({ name: n.slice((prefix + 'textures/').length, -4), image: image(n.slice((prefix + 'textures/').length)) })), {});
const assets = { data, atlas, atlasTexture: {}, version: 1, textures: new Map(), image, texture: image,
  modelStore: new ModelStore(jsonAssets('models'), jsonAssets('blockstates'), atlas), translate: key => key,
  itemsById: new Map(data.items.map(i => [i.id,i])), itemsByName: new Map(data.items.map(i => [i.name,i])),
  makeTexture: (name, width, height, data) => ({ name, width, height, data }) };
const device = {
  createMesh: (format, vertices, options = {}) => ({ format, vertices, ...options }), destroyMesh() {},
  updateMesh(mesh, vertices) { mesh.vertices = vertices; }, createTexture: opts => opts,
  destroyTexture() {}, updateTexture() {}, draw() {}, setGlobals() {},
};
setModelDevice(device);
if(target14){assets.packs=[];assets.device=device;assets.data.particleSprites=JSON.parse(readFileSync(new URL('../client/data/particleSprites.json',import.meta.url)));assets.readResourceBytes=async name=>jar.read('assets/'+name.replace(':','/'));await loadParticleSprites(assets);}
let saved = {};
setPlatform({ now: () => 1000, width: 320, height: 240, loadSetting: () => JSON.stringify(saved), saveSetting() {} });
const state = name => { const b = data.blocks.find(b => b.name === name); assert.ok(b, name); return native ? b.defaultState : b.id << 4; };
function fixture() {
  const player = new LocalPlayer(); player.setPosition(0, 64, 0);
  const g = { assets, device, player, entityId: 99, heldSlot: 0, gameMode: 1, settings: { renderDistance: 16, lodDistance: 32, mainHand: 'right', skinParts: 127, particles: 0, entityShadows: false },
    renderer: { entityRoot: new Node(), extraDraws: [], camPos: [0, 64, 0], camRot: mat4.create(), boxVisible: () => true },
    world: { getState: () => 0, getSkyLight: () => 15, getBlockLight: () => 0, getBiome: () => 1 },
    scoreboard: { players: new Map() }, interaction: { equipProgress: 1, prevEquipProgress: 1, equipProgressOff: 1, prevEquipProgressOff: 1, swingProgress: 0, prevSwingProgress: 0 },
    thirdPerson: 0, cameraEntity: null, effects: new Map(), hurtTime: 0, send() {}, sound: { play() {} }, ticks: 20,
    eyePosition: () => [0, 65.62, 0], lookVector: () => [0, 0, 1], gui: { font: { width: text => text.length * 6 } },
  };
  g.items = new Items(assets); g.inventory = new Inventory(g);
  g.entityRenderer = new EntityRenderer(g); g.itemRenderer = new ItemRenderer(g); g.entities = new EntityManager(g);
  g.handRenderer = new HandRenderer(g); g.particles = new Particles(g);
  return g;
}
const item = (g, name, count = 1) => ({ id: g.items.byName.get(name).id, count, damage: 0 });

test(version + ': stack copies own NBT; structured tag differences and legacy metadata remain distinct', () => {
  const a = { id: 1, count: 1, damage: 0, nbt: nbt.compound({ Name: nbt.string('A') }), nbtRaw: new Uint8Array([1,2]) };
  const b = copy(a); b.nbt.v.Name.v = 'B'; b.nbtRaw[0] = 9;
  assert.equal(a.nbt.v.Name.v, 'A'); assert.equal(a.nbtRaw[0], 1); assert.equal(stackable(a, b), false);
  assert.equal(stackable({ ...a, nbtRaw: null }, { ...b, nbtRaw: null }), false);
  if (!native) assert.equal(stackable({ id: 1, damage: 0 }, { id: 1, damage: 1 }), false);
  assert.equal(stackable({ id: 1, damage: 0, nbt: nbt.compound({ a: nbt.int(1), b: nbt.int(2) }) },
    { id: 1, damage: 0, nbt: nbt.compound({ b: nbt.int(2), a: nbt.int(1) }) }), true);
  assert.equal(chatToLegacy({ text: 'X', bold: 'false' }).includes('§l'), false);
});

test(version + ': server crafting output survives input packet order, and local clicks still predict', () => {
  const g = fixture(), inv = g.inventory;
  const output = item(g, 'diamond', 8);
  inv.setSlot(0, output); inv.setSlot(1, item(g, 'stone'));
  assert.equal(inv.craftResult, output);
  inv.setAll([output, item(g, 'stone')]); assert.equal(inv.craftResult, output);
  inv.put(1, null); assert.equal(inv.craftResult, null, 'local edits still run prediction');
  const invalid = item(g, 'stone', 2); assert.equal(inv.mergeItemStack(invalid, 5, 6, false), false);
  const helmet = item(g, 'iron_helmet', 2); inv.mergeItemStack(helmet, 5, 6, false);
  assert.equal(inv.get(5).count, 1); assert.equal(helmet.count, 1);
});

test(version + ': camera-distance LOD includes diagonal/vertical distance and has a stable boundary', () => {
  const settings = { lodDistance: 32 }, camera = [0, 8, 0];
  assert.equal(sectionLod(settings, camera, 1, 0, 0), false);
  assert.equal(sectionLod(settings, camera, 2, 0, 2), true, 'diagonal is farther than axial sections');
  assert.equal(sectionLod(settings, camera, 0, 4, 0), true, 'altitude counts');
  assert.equal(sectionLod(settings, [0,8,0], 2,0,0,false), false);
  assert.equal(sectionLod(settings, [0,8,0], 2,0,0,true), true, 'hysteresis preserves current detail in the boundary band');
  const g = { settings, player: { x: 1000, y: 64, z: 1000 }, renderer: { camPos: [0,8,0], sections: new Map() }, dirty: new Set() };
  g._lodCamera = Game.prototype._lodCamera; g._lodFor = Game.prototype._lodFor;
  g.renderer.sections.set('1,0,0', { cx: 1, sy: 0, cz: 0, lod: true });
  Game.prototype._updateLod.call(g); assert.ok(g.dirty.has('1,0,0'), 'terrain follows camera rather than player');
  g.dirty.clear(); Game.prototype._updateLod.call(g); assert.equal(g.dirty.size, 0, 'stationary camera skips rescanning');
  assert.equal(poseInterval(settings, 31**2), 1); assert.equal(poseInterval(settings, 40**2), 2); assert.equal(poseInterval(settings, 70**2), 4);
  assert.equal(sectionLod({ lodDistance: 0 }, camera, 100,100,100), false);
});

test(version + ': saved chunk LOD settings migrate once to blocks, including Off', () => {
  for (const chunks of [0,2,8,30]) { saved = { lodChunks: chunks }; const s = new Settings(); assert.equal(s.lodDistance, chunks*16); assert.equal(s.lodChunks, undefined); }
  saved = { lodChunks: 8, lodDistance: 48 }; assert.equal(new Settings().lodDistance, 48); saved = {};
});

test(version + ': rain and rocket spark UVs sample nontransparent pixels from the real particle sheet', () => {
  const g = fixture(), p = g.particles, sheet = target14?{width:assets.particleAtlas.size,height:assets.particleAtlas.size,data:assets.particleAtlas.data}:image('particle/particles.png');
  p.rain(1,65,1); p.spark(2,65,1,0,0,0);
  p.render(0,0,64,0);
  assert.equal(p.batchP.n, 2);
  const stride = p.batchP.mesh.format.stride;
  for (let particle = 0; particle < 2; particle++) {
    const v = p.batchP.mesh.vertices, offset = particle*4*stride;
    const uv = Array.from({ length: 4 }, (_, i) => [v[offset+i*stride+3],v[offset+i*stride+4]]);
    const u0 = Math.min(...uv.map(v => v[0])), u1 = Math.max(...uv.map(v => v[0]));
    const v0 = Math.min(...uv.map(v => v[1])), v1 = Math.max(...uv.map(v => v[1]));
    if(!target14)assert.ok(Math.abs((u1-u0) - 0.999/(native?32:16)) < 1e-6);else assert.ok(u1>u0&&v1>v0);
    let opaque = 0;
    for (let y = Math.floor(v0*sheet.height); y < Math.ceil(v1*sheet.height); y++) for (let x = Math.floor(u0*sheet.width); x < Math.ceil(u1*sheet.width); x++) opaque += sheet.data[(y*sheet.width+x)*4+3] > 0;
    assert.ok(opaque > 0, particle === 0 ? 'visible rain sprite' : 'visible rocket spark sprite');
  }
  const rain = p.list[0], before = rain.my;
  p.move = q => { q.y += q.my; q.onGround = false; };
  p.tick(); assert.ok(Math.abs(rain.my - (before - 0.06)*0.98) < 1e-8, 'rain gravity is direct vanilla acceleration');
});

test(version + ': barrier markers are unique and disappear on item changes or block removal', () => {
  const g = fixture(), p = g.particles; let current = state('barrier'); g.player.creative = true;
  g.world.getState = () => current; g.inventory.main[0] = item(g, 'barrier');
  p.randomDisplayTick(1,64,1,current); p.randomDisplayTick(1,64,1,current);
  assert.equal(p.list.length, 1); assert.equal(p.barrierIndex.size, 1);
  const list = p.list; p.tick(); assert.equal(p.list, list, 'particle storage is compacted in place');
  g.inventory.main[0] = null; p.render(0,0,64,0); assert.equal(p.batchA.n, 0); p.tick(); assert.equal(p.barrierIndex.size, 0);
  g.inventory.main[0] = item(g, 'barrier'); p.barrier(1,64,1); current = 0;
  p.render(0,0,64,0); assert.equal(p.batchA.n,0); p.tick(); assert.equal(p.list.length,0);
  p.clear(); assert.equal(p.barrierIndex.size,0);
});

test(version + ': invisible living bodies keep their equipped items, including skipped LOD frames', () => {
  const g = fixture();
  const e = g.entities._base(1, 90,64,0,0,0); e.kind='player'; e.typeName='Player'; e.uuid='00000000-0000-0000-0000-000000000001'; e.name=''; e.mainHand=1;
  e.equipment[0]=item(g,'snowball'); g.entities.add(e);
  g.entityRenderer.render(0.5); const visual = g.entityRenderer.visuals.get(1); assert.ok(visual);
  e.invisible=true; g.entityRenderer.render(0.5);
  assert.ok(visual.bodyDrawables.every(d=>d.visible===false));
  visual.root.updateWorld(); assert.ok(visual.root.collect([]).some(({d})=>d.visible!==false && d.mat.pipeline==='entity'), 'held item still draws');
  e.invisible=false; g.entityRenderer.render(0.5); assert.ok(visual.bodyDrawables.every(d=>d.visible===true));
});

test(version + ': deferred hand-skin resets occur at the next prepare boundary', () => {
  const g=fixture(), hand=g.handRenderer; g.inventory.main[0]=item(g,'snowball');
  hand.prepare(0.5,70); const old=hand.content.children.slice();
  hand.invalidateSkin(); assert.deepEqual(hand.content.children,old,'invalidation does not destroy a tree while rendering');
  hand.prepare(0.5,70); assert.equal(hand.skinDirty,false); assert.ok(hand.content.children.length);
});

test(version + ': ground rain uses the rain factory and precipitation scans skip empty sections', t => {
  const g = fixture(), weather = new Weather(g); g.dimension=0; g.world.rainStrength=1;
  let rain=0, splashes=0; g.particles.rain=()=>{rain++;}; g.particles.splash=()=>{splashes++;};
  weather.precipHeight=()=>65; g.world.getState=()=>state('stone');
  t.mock.method(Math,'random',()=>0.5);
  weather._rainParticles(); assert.ok(rain>0); assert.equal(splashes,0);
  let reads=0;
  const section={ nonAir:1, get(x,y,z) { reads++; return y===0 ? state('stone') : 0; } };
  const sections=[]; sections[4]=section;
  const scan=Object.create(Weather.prototype); scan.game={world:{getChunk:()=>({sections}),getState:()=>{throw Error('unnecessary world lookup');}}};
  assert.equal(scan.precipHeight(1,1),65); assert.equal(reads,16,'only the populated section is scanned');
});

test(version + ': rocket entities emit persistent visible trails as their attached elytra rider moves', () => {
  const g=fixture(), e=g.entities._base(10,0,64,0,0,0);
  e.kind='projectile'; e.type=76; e.entityName='firework_rocket'; g.entities.add(e);
  if (version!=='1.8.9') {
    g.player.elytraFlying=true; g.player.motionZ=1.5;
    g.entities.setMetadata(10,{[target14?8:7]:g.entityId});
    g.player.setPosition(4,64,10);
    g.entities._fireworkTick(e);
    assert.equal(e.x,4); assert.equal(e.z,10);
    g.player.setPosition(4,64,12); g.entities._fireworkTick(e);
    assert.equal(g.particles.list[0].z,10,'earlier sparks stay behind the moving rider');
    assert.equal(g.particles.list[1].z,12);
  } else {
    g.entities._fireworkTick(e); g.entities._fireworkTick(e);
    assert.equal(g.particles.list.length,2,'1.8.9 retains normal fireworks without adding elytra');
  }
  assert.equal(g.particles.list.length,2);
  g.particles.render(0,0,64,0); assert.equal(g.particles.batchP.n,2);
});

test(version + ': crystal beams have the jar taper, scrolling UVs, and moving world-space endpoints', () => {
  for (const end of [[10,0,0],[0,10,0],[0,0,-10],[3,4,5]]) {
    const start=[0,0,0],v=crystalBeam(start,end,25),center=[0,0,0];
    assert.equal(v.length,32*9);
    for(let face=0;face<8;face++)for(let axis=0;axis<3;axis++)center[axis]+=v[(face*4+1)*9+axis]/8;
    end.forEach((n,i)=>assert.ok(Math.abs(center[i]-n)<1e-5, 'crystal end centre'));
    assert.deepEqual(Array.from(v.slice(5,9)),[0,0,0,1]);
    assert.ok(Math.abs(v[4]+0.25)<1e-6);
    assert.ok(Math.abs(v[13]-(Math.hypot(...end)/32-0.25))<1e-6);
  }
  const g=fixture(),d=g.entities._base(30,0,64,0),c=g.entities._base(40,8,72,0);
  Object.assign(d,{kind:'mob',type:63,entityType:63,entityName:'ender_dragon',width:16,height:8});
  Object.assign(c,{kind:'crystal',entityName:'end_crystal',width:2,height:2});g.entities.add(d);g.entities.add(c);
  tickEntityEffects(d,g.entities);assert.equal(d.healingCrystal,c.id);
  g.entityRenderer.render(0.5);const effect=g.entityRenderer.effects.entries.get('heal:30');assert.ok(effect);
  assert.ok(image(g.entityRenderer.effects.beamTexture).data.some(n=>n>0));
  const before=effect.mesh.vertices.slice();c.x=12;c.prevX=10;g.entityRenderer.render(0.5);
  assert.equal(g.entityRenderer.effects.entries.get('heal:30').mesh,effect.mesh,'moving beams reuse their GPU mesh');
  assert.notDeepEqual(effect.mesh.vertices,before);
  g.entities.map.delete(c.id);g.entityRenderer.render(0.5);assert.equal(g.entityRenderer.effects.entries.has('heal:30'),false);
  if(version!=='1.8.9') {
    g.entities.add(c);g.entities.setMetadata(c.id,{[target14?7:6]:{x:0,y:70,z:0}});g.entityRenderer.render(0.5);
    assert.ok(g.entityRenderer.effects.entries.has('crystal:40'),'crystal beam-target metadata renders too');
    g.entities.setMetadata(c.id,{[target14?7:6]:null});g.entityRenderer.render(0.5);assert.equal(g.entityRenderer.effects.entries.has('crystal:40'),false);
  }
});

test(version + ': guardian and elder beams follow metadata, charge, local targets, and their own bounds', () => {
  const g=fixture(),e=g.entities._base(30,-20,64,0),t=g.entities._base(40,20,64,0);
  Object.assign(e,{kind:'mob',type:68,entityType:version==='1.12.2'?4:68,entityName:'elder_guardian',elder:true,width:1.9975,height:1.9975});
  Object.assign(t,{kind:'mob',type:90,entityType:90,entityName:'pig',width:0.9,height:0.9});g.entities.add(e);g.entities.add(t);
  const idx=version==='1.8.9'?17:version==='1.15.2'?16:target14?15:13;
  g.entities.setMetadata(e.id,{[idx]:t.id});assert.equal(e.guardianTarget,t.id);assert.equal(e.guardianBeamTicks,0);
  for(let i=0;i<100;i++)tickEntityEffects(e,g.entities);assert.equal(e.guardianBeamTicks,60);
  g.renderer.frustum=[];g.renderer.boxVisible=(x,y,z,X)=>X-x>10;
  g.entityRenderer.render(0.5);
  assert.ok(!g.entityRenderer.visuals.has(e.id),'owner body is outside the view');
  const beam=g.entityRenderer.effects.entries.get('guardian:30');assert.ok(beam,'crossing beam survives body culling');
  assert.equal(beam.mesh.vertices.length,12*9);assert.ok(image('entity/guardian_beam.png'));
  assert.deepEqual(Array.from(beam.mesh.vertices.slice(5,9)),Array.from(new Float32Array([1,223/255,64/255,1])));
  g.entities.updateSelf();g.entities.setMetadata(e.id,{[idx]:g.entityId});assert.equal(e.guardianBeamTicks,0);
  g.entityRenderer.render(0.5);assert.ok(g.entityRenderer.effects.entries.has('guardian:30'),'the local player is a valid beam target');
  g.entities.setMetadata(e.id,{[idx]:0});g.entityRenderer.render(0.5);assert.equal(g.entityRenderer.effects.entries.size,0);
  const v=guardianBeam([0,0,0],[10,0,0],0,0,0);assert.ok(Math.abs(v[0]-11)<1e-6,'beam extends one block through its target');
  e.elder=false;e.guardianTarget=t.id;for(let i=0;i<100;i++)tickEntityEffects(e,g.entities);assert.equal(e.guardianBeamTicks,80);
});

test(version + ': dragon death lasts 200 ticks with dissolve depth, deterministic fading rays and explosion emitters', () => {
  const g=fixture(),e=g.entities._base(30,0,64,0);
  Object.assign(e,{kind:'mob',type:63,entityType:63,entityName:'ender_dragon',width:16,height:8,dead:true,health:0});g.entities.add(e);
  let poofs=0,large=0,huge=0;g.particles.deathPoof=()=>poofs++;g.particles.largeExplode=()=>large++;g.particles.hugeExplode=()=>huge++;
  for(let i=0;i<200;i++)g.entities.tick();
  assert.equal(e.deathTime,200);assert.equal(poofs,0);assert.equal(large,200);assert.equal(huge,21);
  assert.ok(Math.abs(e.y-84)<1e-8);assert.equal(e.yaw,4000);
  e.deathTime=100;g.entityRenderer.render(0.5);const v=g.entityRenderer.visuals.get(e.id);
  assert.ok(v.dragonMaskDraws.every(d=>d.visible));assert.ok(Math.abs(v.dragonMask.params.p[12]-0.5)<2e-6);
  assert.equal(v.dragonMask.state.colorWrite,false);assert.equal(v.dragonSkin.state.depthFunc,'equal');assert.equal(v.dragonEyes.state.depthFunc,'equal');
  assert.ok(image('entity/enderdragon/dragon_exploding.png'));
  const a=dragonDeathRays(e,0),b=dragonDeathRays(e,0);assert.deepEqual(a,b);assert.equal(a.length,23*12*9);
  const end=dragonDeathRays({...e,deathTime:200},0);assert.equal(end.length,60*12*9);assert.equal(end[8],0);
  const fading=dragonDeathRays({...e,deathTime:190},0);assert.ok(Math.abs(fading[8]-0.25)<1e-6);
  e.deathTime=0;e.dead=false;g.entityRenderer.render(0.5);assert.ok(v.dragonMaskDraws.every(d=>!d.visible));
  assert.equal(v.dragonSkin.state.depthFunc,undefined);assert.equal(g.entityRenderer.effects.entries.has('death:30'),false);
  e.dead=true;e.deathTime=100;g.entityRenderer.render(0.5);g.entityRenderer.reset();assert.equal(g.entityRenderer.effects.entries.size,0);
  const p=new Particles(fixture());let bursts=0;p.largeExplode=()=>bursts++;p.hugeExplode(0,64,0);
  for(let i=0;i<10;i++)p.tick();assert.equal(bursts,48);assert.equal(p.explosionEmitters.length,0);
  p.hugeExplode(0,64,0);p.clear();p.tick();assert.equal(bursts,48,'world changes clear pending explosion emitters');
});

if(native)test('1.13.2: Riptide uses the vanilla 64x64 shells and clears when the spin ends', () => {
  const g=fixture(),e=g.entities._base(30,2,64,2);
  Object.assign(e,{kind:'player',typeName:'Player',uuid:'00000000-0000-0000-0000-000000000001',name:'',mainHand:1,riptide:true});g.entities.add(e);
  g.entityRenderer.render(0.5);const v=g.entityRenderer.visuals.get(e.id);assert.ok(v.riptideLayer.visible);
  assert.equal(v.riptideShells.length,3);assert.deepEqual(v.riptideShells.map(n=>n.scale.x),[0,0.75,1.5]);
  assert.ok(Math.abs(v.riptideShells[1].rotation.y-(-25*Math.PI/180))<1e-8);
  v.root.updateWorld();assert.ok(v.riptideLayer.collect([]).some(({d})=>d.mat.tex==='entity/trident_riptide.png'));
  assert.ok(image('entity/trident_riptide.png'));
  e.riptide=false;g.entityRenderer.render(0.5);assert.equal(v.riptideLayer.visible,false);
});

test(version + ': actual rasterisation dissolves the dragon completely at tick 200', () => {
  const original=globalThis.ImageData;
  globalThis.ImageData=class {constructor(data,width,height){Object.assign(this,{data,width,height});}};
  try {
    const canvas={width:192,height:192,getContext:()=>({})},soft=new SoftwareDevice(canvas),g=fixture(),textures=new Map();
    g.device=soft;setModelDevice(soft);
    g.assets={...assets,texture:(name,options={})=>{if(!textures.has(name))textures.set(name,soft.createTexture({...image(name),...options}));return textures.get(name);}};
    g.renderer.entityRoot=new Node();g.renderer.extraDraws=[];g.entityRenderer=new EntityRenderer(g);
    const e=g.entities._base(30,0,64,0);Object.assign(e,{kind:'mob',type:63,entityType:63,entityName:'ender_dragon',width:16,height:8});g.entities.add(e);g.entities._dragonUpdate(e);
    const view=mat4.create(),proj=mat4.create();mat4.translate(view,view,0,-69,-25);mat4.perspective(proj,Math.PI/3,1,0.1,200);
    soft.setGlobals({view,proj,fogStart:1000,fogEnd:2000});
    const render=tick=>{e.deathTime=tick;e.dead=tick>0;g.entityRenderer.render(0);g.entityRenderer.effects.root.visible=false;soft.beginFrame([0.02,0.02,0.02]);const bg=soft.screen.color[0];g.entityRenderer.draw(soft,mat4.create());return { pixels:soft.screen.color.reduce((n,c)=>n+(c!==bg),0), depth:soft.screen.depth.reduce((n,z)=>n+(z<1),0) };};
    const alive=render(0),half=render(100),gone=render(200);
    assert.ok(alive.pixels>100,'real model and jar texture render visible pixels');assert.ok(half.depth>0 && half.depth<alive.depth,'death mask removes skin fragments');assert.equal(gone.depth,0);assert.equal(gone.pixels,0,'skin and eyes disappear completely');
    if(process.env.EFFECTS_PREVIEW){render(100);writeFileSync(process.env.EFFECTS_PREVIEW,Buffer.concat([Buffer.from('P6\n192 192\n255\n'),Buffer.from(new Uint8Array(soft.screen.color.buffer).filter((_,i)=>i%4!==3))]));}
    g.entityRenderer.reset();
  } finally {if(original===undefined)delete globalThis.ImageData;else globalThis.ImageData=original;setModelDevice(device);}
});

test(version + ': selection bounds use jar provenance and bed bounds rather than visual model bounds', () => {
  const selection=data.blockCollisionShapes.selection;
  assert.equal(selection.source.version,version);assert.equal(selection.source.clientJarSha1,createHash('sha1').update(jar.data).digest('hex'));
  const g=fixture();
  const names=native?['white_bed','red_bed','light_gray_bed','black_bed']:['bed'];
  for(const name of names){const b=data.blocks.find(b=>b.name===name);for(let i=0;i<16;i++){
    const st=native?b.minStateId+i:(b.id<<4)+i;
    assert.deepEqual(jarSelectionBox(st),[0,0,0,1,0.5625,1]);
    assert.deepEqual(Game.prototype.selectionBox.call(g,st,0,64,0),[0,0,0,1,0.5625,1]);
  }}
  assert.ok(selection.states.filter(s=>s!==null&&s!==undefined).length>1000,'bounds extracted across the block registry');
});

test(version + ': sleeping anchors the player and camera to each bed direction and cancels mouse look', () => {
  const g=fixture(),pos={x:4,y:64,z:8};
  for(const [i,facing] of ['south','west','north','east'].entries()){
    g.world.getState=()=>native?findState('red_bed',{facing,part:'head'}):state('bed')|i|8;
    g.player.yaw=61;g.player.pitch=37;g.player.motionX=1;
    startSleeping(g,pos);const view=sleepingCamera(g,0.5),d=[[0,1],[-1,0],[0,-1],[1,0]][i];
    assert.equal(g.player.sleeping,true);assert.equal(g.player.width,Math.fround(0.2));
    assert.ok(Math.abs(g.player.x-(4.5+d[0]*(target14?0:0.4)))<1e-7);assert.ok(Math.abs(g.player.z-(8.5+d[1]*(target14?0:0.4)))<1e-7);
    assert.equal(g.player.y,64.6875);assert.equal(g.player.motionX,0);assert.equal(view.yaw,i*90+(target14?-180:180));assert.equal(view.pitch,0);
    assert.ok(Math.abs(view.y-(target14?65.1875:65.5875))<1e-7);assert.deepEqual([view.x,view.z],[g.player.x,g.player.z]);
    g.player.yaw=-120;g.player.pitch=-45;assert.deepEqual(sleepingCamera(g,0.5),view);
  }
  g.sleeping=false;assert.equal(sleepingCamera(g,0.5),null);
});

test(version + ': End portal surfaces survive chunk load, unload and reload', () => {
  const g=fixture(),portal=state('end_portal'),c=new Chunk(0,0,true);c.setState(3,64,5,portal);
  g.world.getState=(x,y,z)=>x===3&&y===64&&z===5?portal:0;
  const tiles=new TileEntityRenderer(g);tiles.scanChunk(c);const t=tiles.tiles.get('3,64,5');assert.equal(t?.type,'endportal');
  tiles._build(t);assert.ok(t.obj.drawables.some(d=>d.mat.pipeline==='endportal'),'surface has the real portal rendering layers');
  tiles.removeChunk(0,0);assert.equal(tiles.tiles.size,0);tiles.scanChunk(c);assert.equal(tiles.tiles.get('3,64,5')?.type,'endportal');tiles.clear();
});

if(native)test('1.13.2: placed bed colours come from all sixteen block identities, including light gray', () => {
  const g=fixture(),tiles=new TileEntityRenderer(g);
  for(const color of ['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black']) {
    const st=findState(color+'_bed',{part:'head',facing:'north'});g.world.getState=()=>st;
    const t=tiles._ensure(0,64,0,st);t.data={color:14};tiles._build(t);
    const mats=[];t.obj.traverse(n=>mats.push(...n.drawables.map(d=>d.mat)));
    assert.ok(mats.some(m=>m.tex==='entity/bed/'+color+'.png'));assert.ok(image('entity/bed/'+color+'.png'));tiles.clear();
  }
});

if(native)test('1.13.2: turtle eggs retain the floor face and can be stepped onto without sideways ejection', () => {
  const stone=state('stone'),w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);
  for(let x=0;x<8;x++)for(let z=0;z<8;z++)c.setState(x,64,z,stone);
  const mesher=new Mesher(null,assets.modelStore);mesher._flags=new Uint8Array(data.blocks.length);
  for(let eggs=1;eggs<=4;eggs++)for(let hatch=0;hatch<=2;hatch++) {
    const st=findState('turtle_egg',{eggs,hatch});c.setState(3,65,3,st);
    assert.equal(getBlock(st).opaque,false);assert.equal(mesher.shouldRenderFace(stone,st,1),true);
    const pl=new LocalPlayer();pl.setPosition(2.5,65,3.5);pl.onGround=true;
    for(let i=0;i<5;i++)pl.moveEntity(w,0.2,-0.08,0);
    assert.ok(Math.abs(pl.y-65.4375)<1e-7,`steps onto eggs=${eggs},hatch=${hatch}`);assert.equal(pl.onGround,true);
    pl.motionX=pl.motionZ=0;pl.pushOutOfBlocks(w,pl.x,pl.y+0.5,pl.z);assert.equal(pl.motionX,0);assert.equal(pl.motionZ,0);
    for(let i=0;i<4;i++)pl.moveEntity(w,0,-0.08,0);assert.ok(Math.abs(pl.y-65.4375)<1e-7,'rests on the egg collision shape');
  }
});

if(version==='1.13.2')test('1.13.2: global chunk palettes have no length header and retain filled portal-frame states', () => {
  const bits=14,count=4096,words=Array.from({length:Math.ceil(count*bits/64)},()=>0n);
  const value=findState('end_portal_frame',{eye:true,facing:'north'});
  for(let i=0;i<count;i++){const bit=i*bits,word=Math.floor(bit/64),shift=bit%64;words[word]|=BigInt(value)<<BigInt(shift);if(shift+bits>64)words[word+1]|=BigInt(value)>>BigInt(64-shift);}
  const varint=n=>{const out=[];do{let b=n&127;n>>>=7;out.push(b|(n?128:0));}while(n);return out;};
  const out=[bits,...varint(words.length)];for(const word of words)for(let k=7;k>=0;k--)out.push(Number((word>>BigInt(k*8))&255n));out.push(...new Uint8Array(4096));
  const chunk=new Chunk(0,0,true);assert.equal(chunk.load(new Uint8Array(out),0,1,false,true),out.length);
  for(const i of [0,1,2,3,4,31,32,63,64,4095])assert.equal(chunk.sections[0].blocks[i],value);
  const rs=resolveState(value,()=>0,0,0,0),baked=assets.modelStore.bakeVariant(rs.file,rs.props);
  assert.equal(baked.bounds[4],1,'persisted state retains the eye geometry');
});

test(version + ': video and controls match jar option/category order, preserving version-specific options', () => {
  assert.equal(VANILLA_UI.clientJarSha1,createHash('sha1').update(jar.data).digest('hex'));
  const g=fixture();g.settings=new Settings();g.gui.width=420;g.gui.height=300;g.gui.textWidth=s=>s.length*6;
  const video=new VideoScreen(g,null);video.init();
  assert.deepEqual(video.rows.flat().filter(b=>b.optionKey).map(b=>b.optionKey),VANILLA_UI.videoOptions);
  assert.ok(video.rows.flat().slice(VANILLA_UI.videoOptions.length).every(b=>b.optionKey===null),'client-only settings follow the vanilla options');
  const controls=new ControlsScreen(g,null);controls.init();
  const headers=controls.entries.filter(e=>e.header).map(e=>e.header);
  if(VANILLA_UI.categoryOrder.length)assert.deepEqual(headers,VANILLA_UI.categoryOrder.filter(c=>headers.includes(c)));
  let category;for(const e of controls.entries){if(e.header)category=e.header;else if(e.key==='drop')assert.equal(category,version==='1.8.9'?'key.categories.gameplay':'key.categories.inventory');}
  assert.equal(VANILLA_UI.videoOptions.includes('options.biomeBlendRadius'),native);
  if(native) {
    const lang=JSON.parse(jar.read('assets/minecraft/lang/en_us.json'));setTranslator(k=>lang[k]||k);
    try {for(const [key,label] of [['ShiftLeft','Left Shift'],['ControlLeft','Left Control'],['ShiftRight','Right Shift'],['Space','Space'],['mouse0','Left Button'],['mouse1','Middle Button'],['','Not bound']])assert.equal(g.settings.keyName(key),label);}
    finally {setTranslator(k=>k);}
  } else assert.equal(g.settings.keyName('ShiftLeft'),'LSHIFT','older clients retain their native LWJGL key labels');
});

test(version + ': incompatible resource packs are tinted and require affirmative selection before activation', async () => {
  const g=fixture();let current=null;g.screens={open:s=>{current=s;}};g.sound.playUi=()=>{};
  g.assets={...assets,listPacks:async()=>[]};g.settings.resourcePacks=[];
  const packs=new ResourcePacksScreen(g,null);await packs._load();
  const old={id:'old',name:'Old pack',format:VANILLA_UI.packFormat-1,description:'Description'},newer={...old,id:'new',format:VANILLA_UI.packFormat+1},compatible={...old,id:'ok',format:VANILLA_UI.packFormat};
  packs.available=[old,newer,compatible];const L={side:0};
  packs._click(L,old,0,2,2);assert.ok(current instanceof ConfirmScreen);assert.deepEqual(packs.selected,[]);assert.equal(current.line2,'resourcePack.incompatible.confirm.old');
  current.callback(false);assert.deepEqual(packs.selected,[]);assert.equal(current,packs);
  packs._click(L,old,0,2,2);current.callback(true);assert.equal(packs.selected[0],old);assert.equal(current,packs);
  packs._click(L,newer,0,2,2);assert.equal(current.line2,'resourcePack.incompatible.confirm.new');current.close();assert.equal(packs.available[0],newer);
  packs._click(L,compatible,1,2,2);assert.equal(packs.selected[0],compatible,'compatible packs move without confirmation');
  const rects=[],texts=[],gui={rect:(...a)=>rects.push(a),tex:()=>null,textWidth:s=>s.length*6,font:{wrap:s=>[s],trimToWidth:s=>s},text:(s)=>texts.push(s),blit(){}};
  packs._entry(gui,L,old,0,0,0,80,10);assert.ok(rects.some(r=>r[4]===0xff770000));assert.ok(texts.includes('resourcePack.incompatible'));
  rects.length=0;texts.length=0;packs._entry(gui,L,compatible,0,0,0,500,500);assert.equal(rects.length,0);assert.ok(texts.includes('Old pack'));
});

test(version + ': rendered crystal beam retains the jar texture cutouts instead of filling a gradient bar', () => {
  const original=globalThis.ImageData;globalThis.ImageData=class {constructor(data,width,height){Object.assign(this,{data,width,height});}};
  try {
    const soft=new SoftwareDevice({width:256,height:128,getContext:()=>({})}),g=fixture(),textures=new Map();g.device=soft;setModelDevice(soft);
    g.assets={...assets,texture:(name,options={})=>{if(!textures.has(name))textures.set(name,soft.createTexture({...image(name),...options}));return textures.get(name);}};
    g.renderer.entityRoot=new Node();g.renderer.extraDraws=[];g.entityRenderer=new EntityRenderer(g);
    const fx=g.entityRenderer.effects;fx._set('beam',1,crystalBeam([-5,0,0],[5,0,0],34),fx.beamTexture);
    const entry=fx.entries.get('beam'),params=entry.node.drawables[0].mat.params;
    assert.ok(params[4]>0,'transparent texels must be discarded in the opaque beam pass');
    const view=mat4.create(),proj=mat4.create();mat4.translate(view,view,0,0,-12);mat4.perspective(proj,Math.PI/3,2,0.1,200);soft.setGlobals({view,proj});
    const count=()=>{soft.beginFrame([0,0,0]);g.entityRenderer.draw(soft,mat4.create());return soft.screen.depth.reduce((n,z)=>n+(z<1),0);};
    const cutout=count();params[4]=0;const filled=count();assert.ok(cutout>10 && cutout<filled*0.8,`beam cutouts visible: ${cutout}/${filled}`);
    fx.reset();
  } finally {if(original===undefined)delete globalThis.ImageData;else globalThis.ImageData=original;setModelDevice(device);}
});

if(native)test('1.13.2: biome blend averages the selected radius with complete biome samples at section edges', () => {
  const chunks=new Map();for(let cz=-1;cz<=1;cz++)for(let cx=-1;cx<=1;cx++){const c=new Chunk(cx,cz,true);for(let z=0;z<16;z++)for(let x=0;x<16;x++)c.biomes[z*16+x]=(cx*16+x+64)%200;chunks.set(World.key(cx,cz),c);}
  const w=new World();w.chunks=chunks;const sl=buildSlice(w,0,4,0,null,7),sw=new SliceWorld(sl);
  assert.equal(sl.biomeSize,30);assert.equal(sl.states.length,20**3,'block/light margin does not grow for biome blending');
  for(const x of [-7,-1,0,15,22])assert.equal(sw.getBiome(x,0),w.getBiome(x,0));
  const mesher=new Mesher(sw,assets.modelStore),fn=id=>id*0x010101;
  for(const radius of [0,1,2,7]){
    mesher.options.biomeBlendRadius=radius;const actual=mesher.biomeBlend(15,64,0,fn);let sum=0;
    for(let z=-radius;z<=radius;z++)for(let x=15-radius;x<=15+radius;x++)sum+=w.getBiome(x,z);
    const c=Math.floor(sum/(radius*2+1)**2);assert.equal(actual,c*0x010101);
  }
  const g=fixture();g.settings=new Settings();g.gui.width=420;g.gui.height=300;let rebuilt=0;g.applyGraphicsSettings=()=>rebuilt++;
  const video=new VideoScreen(g,null);video.init();const slider=video.rows.flat().find(b=>b.optionKey==='options.biomeBlendRadius');
  assert.equal(g.settings.biomeBlendRadius,2);
  slider.onChange(1);assert.equal(g.settings.biomeBlendRadius,7);assert.equal(rebuilt,1);
  slider.onChange(1);assert.equal(rebuilt,1,'unchanged radius does not rebuild terrain');
  slider.onChange(0);assert.equal(g.settings.biomeBlendRadius,0);assert.equal(rebuilt,2);
  assert.equal(VANILLA_UI.videoOptions.at(-1),'options.biomeBlendRadius');
});

if(native)test('1.13.2: F3 traces block and any-fluid targets separately at 20 blocks, including flowing and waterlogged fluid', () => {
  const g=fixture(),w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);g.world=w;g.eyePosition=()=>[0.5,65.5,0.5];g.lookVector=()=>[0,0,1];
  c.setState(0,65,8,findState('stone'));c.setState(0,65,3,findState('water',{level:3}));
  let targets=debugTargets(g);assert.equal(targets.block.z,8);assert.equal(targets.fluid.z,3);assert.ok(targets.block.dist>5,'debug reach is independent of interaction reach');
  const h=Object.create(Hud.prototype);h.game=g;h.debugTargets=targets;g.interaction.target=null;
  g.renderer.sections=new Map();g.dirty=new Set();g.inFlight=new Map();g.settings=new Settings();
  const left=h._debugLeft();assert.ok(left.includes('Biome: minecraft:plains'));assert.ok(left.includes('Looking at block: 0 65 8'));assert.ok(left.includes('Looking at liquid: 0 65 3'));assert.ok(!left.some(s=>s.startsWith('Looking at:')));
  const right=h._debugRight();assert.ok(right.includes('§nTargeted Block'));assert.ok(right.includes('§nTargeted Fluid'));assert.ok(right.includes('minecraft:flowing_water'));
  c.setState(0,65,3,findState('oak_slab',{type:'bottom',waterlogged:true}));g.eyePosition=()=>[0.5,65.75,0.5];targets=debugTargets(g);assert.equal(targets.fluid.z,3);
  h.debugTargets=targets;assert.ok(h._debugRight().includes('minecraft:water'));
});

test(version + ': explicit empty selection shapes stay empty instead of becoming full blocks', () => {
  const w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);
  c.setState(2,64,0,state('stone'));c.setState(5,64,0,state('stone'));
  w.selectionProvider=(s,x)=>x===2?null:undefined;
  assert.equal(w.selectionBox(state('stone'),2,64,0),null);
  assert.equal(w.raycast(0.5,64.5,0.5,1,0,0,10).x,5,'ray skips the explicitly unselectable block');
  w.selectionProvider=()=>undefined;assert.equal(w.raycast(0.5,64.5,0.5,1,0,0,10).x,2,'undefined retains the generic fallback');
});

if(native)test('1.13.2: cave air and void air are not targetable with or without the game selection provider', () => {
  const g=fixture(),w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);g.world=w;
  c.setState(1,64,0,findState('cave_air'));c.setState(2,64,0,findState('void_air'));c.setState(4,64,0,state('stone'));
  for(const name of ['air','cave_air','void_air']){const st=findState(name);assert.equal(getBlock(st).isAir,true);assert.equal(w.selectionBox(st,1,64,0),null);assert.equal(Game.prototype.selectionBox.call(g,st,1,64,0),null);}
  assert.equal(w.raycast(0.5,64.5,0.5,1,0,0,10).x,4);
  w.selectionProvider=(...args)=>Game.prototype.selectionBox.call(g,...args);assert.equal(w.raycast(0.5,64.5,0.5,1,0,0,10).x,4);
});

if(native)test('1.13.2: F3 identifies each vanilla dimension immediately after the multiplayer cache line', () => {
  const g=fixture();g.renderer.sections=new Map();g.dirty=new Set();g.inFlight=new Map();g.settings=new Settings();g.world=new World();
  const hud=Object.create(Hud.prototype);hud.game=g;hud.debugTargets={block:null,fluid:null};
  for(const [dim,name] of [[0,'overworld'],[-1,'the_nether'],[1,'the_end']]) {
    g.dimension=dim;const lines=hud._debugLeft(),index=lines.findIndex(s=>s.startsWith('MultiplayerChunkCache:'));
    assert.equal(lines[index+1],'minecraft:'+name+' FC: n/a');
  }
  g.reducedDebug=true;assert.ok(!hud._debugLeft().some(s=>s.includes(' FC: ')),'reduced-debug mode omits the dimension section like the jar');
});

test(version + ': skin proxy templates are configurable, validate URL formats, and persist independently of relay settings', () => {
  saved={};const template='https://skins.example/?url=%R',settings=new Settings({skinProxy:template});assert.equal(settings.skinProxy,template);
  saved={skinProxy:'https://other.example/%r'};assert.equal(new Settings({skinProxy:template}).skinProxy,saved.skinProxy);saved={};
  for(const text of ['',template,'https://proxy.example/%r'])assert.equal(validSkinProxyTemplate(text),true,text);
  for(const text of ['javascript:%R','file:///%R','https://proxy.example/','not a URL %R'])assert.equal(validSkinProxyTemplate(text),false,text);
  const target='https://textures.minecraft.net/texture/abc?x=1&y=2';
  assert.equal(skinProxyUrl(target,template),'https://skins.example/?url='+encodeURIComponent(target));
  assert.equal(skinProxyUrl(target,'https://skins.example/%r'),'https://skins.example/'+target);
  assert.equal(skinProxyUrl('http://textures.minecraft.net/texture/abc',template),'https://skins.example/?url='+encodeURIComponent('https://textures.minecraft.net/texture/abc'));
  const original=platform();let stored;setPlatform({...original,saveSetting:(key,text)=>{stored=JSON.parse(text);}});
  try{settings.save();assert.equal(stored.skinProxy,template);}finally{setPlatform(original);}
});

test(version + ': configured CORS route fetches public textures and profiles without a MinecraftJS proxy', async () => {
  const original=platform(),calls=[];setPlatform({...original,fetchBytes:async url=>{calls.push(['bytes',url]);return new Uint8Array([1]);},fetchJson:async url=>{calls.push(['json',url]);return {properties:[]};}});
  const settings={skinProxy:'https://cors.example/?url=%R',proxies:[{url:'wss://relay.example',type:'relay'}],proxy:0,save(){}};
  try {
    new GameProxyList(settings);await fetchSkin('https://textures.minecraft.net/texture/test');await fetchSkinProfile('00000000-0000-0000-0000-000000000001');
    assert.equal(calls[0][1],'https://cors.example/?url='+encodeURIComponent('https://textures.minecraft.net/texture/test'));
    assert.equal(calls[1][1],'https://cors.example/?url='+encodeURIComponent('https://sessionserver.mojang.com/session/minecraft/profile/00000000000000000000000000000001'));
    assert.ok(calls.every(([,url])=>url.startsWith('https://cors.example/')));
    settings.skinProxy='https://cors.example/%r';await fetchSkin('https://textures.minecraft.net/texture/test');assert.equal(calls[2][1],'https://cors.example/https://textures.minecraft.net/texture/test');
    settings.skinProxy='';settings.proxies=[{url:'wss://game.example',type:'minecraftjs'}];new GameProxyList(settings);
    await fetchSkin('https://textures.minecraft.net/texture/test');assert.equal(calls[3][1],'https://game.example/skin?url='+encodeURIComponent('https://textures.minecraft.net/texture/test'));
    settings.skinProxy='javascript:%R';await assert.rejects(fetchSkin('https://textures.minecraft.net/texture/test'));assert.equal(calls.length,4,'invalid custom templates do not silently route through the game proxy');
    await assert.rejects(fetchSkinProfile('../bad-id'));
  } finally {setPlatform(original);new GameProxyList({skinProxy:'',proxies:[],proxy:-1,save(){}});}
});

test(version + ': saving the skin proxy reloads current skins, cancels leave settings alone, and stale downloads cannot overwrite them', async () => {
  const g=fixture();g.gui.width=420;g.gui.height=300;g.settings=new Settings();let stored=0,reloads=0,current=null;
  g.settings.save=()=>stored++;g.screens={open:s=>current=s};g.entityRenderer.reloadSkins=()=>reloads++;
  const parent={},screen=new SkinProxyScreen(g,parent);screen.init();screen.urlField.text='https://cors.example/%R';screen.done();
  assert.equal(g.settings.skinProxy,screen.urlField.text);assert.equal(stored,1);assert.equal(reloads,1);assert.equal(current,parent);
  screen.urlField.text='https://cancelled.example/%R';screen.close();assert.equal(g.settings.skinProxy,'https://cors.example/%R');
  screen.urlField.text='javascript:%R';screen.done();assert.equal(stored,1);
  const renderer=new EntityRenderer(g),uuid='00000000-0000-0000-0000-000000000001',record={};renderer.skins.set(uuid,record);
  let complete,uploaded=0;const original=platform();setPlatform({...original,fetchBytes:()=>new Promise(resolve=>complete=resolve)});
  try {
    new GameProxyList({skinProxy:'https://cors.example/%R',proxies:[],proxy:-1,save(){}});
    g.assets={...assets,makeTexture:()=>{uploaded++;return {};}};
    const property=Buffer.from(JSON.stringify({textures:{SKIN:{url:'https://textures.minecraft.net/texture/test'}}})).toString('base64');
    renderer._loadTextures(record,uuid,property);renderer.reloadSkins();assert.equal(renderer.skins.size,0);assert.equal(g.handRenderer.skinDirty,true);
    complete(new Uint8Array(jar.read('assets/minecraft/textures/entity/steve.png')));await Promise.resolve();await Promise.resolve();assert.equal(uploaded,0);
  } finally {setPlatform(original);new GameProxyList({skinProxy:'',proxies:[],proxy:-1,save(){}});}
});

if(native)test('1.13.2: turtle eggs preserve the sand surface lighting for every egg/hatch state',()=>{
 const w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);c.biomes.fill(1);
 for(let x=0;x<16;x++)for(let z=0;z<16;z++){
  c.setState(x,64,z,findState('sand'));
  for(let y=64;y<70;y++)c.setSkyLight(x,y,z,15);
 }
 w._computeHeights(c);
 const mesh=new Mesher(null,assets.modelStore),packed=n=>Math.round((n+8)*2048);
 const surface=()=>{
  const bytes=mesh.buildSection(new SliceWorld(buildSlice(w,0,4,0)),0,4,0).solid,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=[];
  for(let i=0;i<bytes.length;i+=80){
   const corners=Array.from({length:4},(_,v)=>{const at=i+v*20;return {x:view.getUint16(at,true),y:view.getUint16(at+2,true),z:view.getUint16(at+4,true),shade:[...bytes.slice(at+12,at+15),...bytes.slice(at+16,at+18)]};});
   if(corners.every(p=>p.y===packed(1)&&[packed(3),packed(4)].includes(p.x)&&[packed(3),packed(4)].includes(p.z)))out.push(...corners.sort((a,b)=>a.x-b.x||a.z-b.z).map(p=>p.shade));
  }
  assert.equal(out.length,4,'the complete support-block top remains present');return out;
 };
 for(const smooth of [0,2]){
  mesh.options.smooth=smooth;w.setState(3,65,3,0);const expected=surface();
  for(let eggs=1;eggs<=4;eggs++)for(let hatch=0;hatch<3;hatch++){
   const st=findState('turtle_egg',{eggs,hatch});w.setState(3,65,3,st);
   assert.equal(w.opacity(st),0);assert.equal(getBlock(st).aoLight,1);assert.equal(w.getSkyLight(3,65,3),15);
   assert.deepEqual(surface(),expected,`smooth=${smooth},eggs=${eggs},hatch=${hatch}`);
  }
 }
});

if(native)test('1.13.2: controls use printable key names and video GUI scale uses native numeric labels',()=>{
 const lang=JSON.parse(jar.read('assets/minecraft/lang/en_us.json'));
 setTranslator((key,args)=>Assets.prototype.translate.call({lang},key,args));
 try{
  const g=fixture();g.settings=new Settings();g.gui.width=420;g.gui.height=300;g.gui.textWidth=s=>s.length*6;g.gui.resize=()=>{};
  for(let n=0;n<26;n++)assert.equal(g.settings.keyName('Key'+String.fromCharCode(65+n)),String.fromCharCode(97+n));
  for(let n=0;n<10;n++)assert.equal(g.settings.keyName('Digit'+n),String(n));
  for(const [code,label] of [['ShiftLeft','Left Shift'],['Numpad3','Keypad 3'],['F12','F12'],['Slash','/'],['mouse4','Button 5']])assert.equal(g.settings.keyName(code),label);
  const controls=new ControlsScreen(g,null);controls.init();g.settings.keys.forward='KeyR';const labels=[];
  controls._drawEntry({text(){},button:(x,y,w,h,label)=>labels.push(label)},controls.entries.find(e=>e.key==='forward'),0,0,20,0,0);
  assert.ok(labels.includes('r'));assert.ok(!labels.some(s=>s.includes('key.keyboard.')));
  const video=new VideoScreen(g,null);video.init();const button=video.rows.flat().find(b=>b.optionKey==='options.guiScale');
  for(const [value,label] of [[0,'Auto'],[1,'1'],[2,'2'],[3,'3']]){g.settings.guiScale=value;assert.equal(button.label(),'GUI Scale: '+label);}
 }finally{setTranslator(k=>k);}
});

test(version + ': breaking overlays use baked model geometry and UVs instead of selection bounds',()=>{
 const w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);const pos={x:3,y:64,z:3};
 const overlay=new BreakingOverlay(device,assets),context={world:w};
 for(const name of ['oak_stairs','stone_slab','lever',native?'oak_fence':'fence',native?'dandelion':'yellow_flower',...(native?['turtle_egg']:[])]){
  const st=state(name);c.setState(3,64,3,st);const result=overlay.update(context,pos,st);assert.ok(result,name);
  const model=overlay.mesher.getModel(st,3,64,3),offset=blockModelOffset(name,3,64,3),vertices=result.mesh.vertices;
  assert.equal(vertices.length,model.quads.length*4*9,name);
  let at=0;for(const q of model.quads){const uv=assets.atlas.uv(q.tex);for(let i=0;i<4;i++){
   for(let axis=0;axis<3;axis++)assert.ok(Math.abs(vertices[at+axis]-q.pos[i*3+axis]-offset[axis])<1e-6,name+' position');
   assert.ok(Math.abs(vertices[at+3]-(q.uv[i*2]-uv[0])/(uv[2]-uv[0]))<1e-5,name+' U');
   assert.ok(Math.abs(vertices[at+4]-(q.uv[i*2+1]-uv[1])/(uv[3]-uv[1]))<1e-5,name+' V');at+=9;
  }}
  if(name==='oak_stairs')assert.ok(vertices.some((n,i)=>i%9===1&&Math.abs(n-.5)<1e-6),'cracks cover the stair tread inside its selection box');
 }
 overlay.clear();
});

test(version + ': damage geometry refreshes exposed faces and resource packs without re-uploading unchanged stages',()=>{
 let created=0,updated=0,destroyed=0;
 const d={...device,createMesh:(...args)=>{created++;return device.createMesh(...args);},updateMesh:(mesh,v)=>{updated++;device.updateMesh(mesh,v);},destroyMesh:()=>{destroyed++;}};
 const a={...assets},w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);c.setState(3,64,3,state('stone'));
 const overlay=new BreakingOverlay(d,a),context={world:w},pos={x:3,y:64,z:3};let result=overlay.update(context,pos,state('stone'));
 assert.equal(result.mesh.vertices.length,24*9);overlay.update(context,pos,state('stone'));assert.equal(created,1);assert.equal(updated,0);
 c.setState(4,64,3,state('stone'));result=overlay.update(context,pos,state('stone'));assert.equal(result.mesh.vertices.length,20*9);assert.equal(updated,1);
 a.version++;overlay.update(context,pos,state('stone'));assert.equal(created,2);assert.equal(destroyed,1);
 overlay.clear();assert.equal(destroyed,2);assert.equal(overlay.update(context,pos,0),null);
});

test(version + ': chest cracks follow the live lid and include both halves of a double chest',()=>{
 const g=fixture(),w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);g.world=w;g.renderer.camPos=[3,65,3];
 const st=state('chest'),pos={x:3,y:64,z:3};c.setState(3,64,3,st);
 const tiles=new TileEntityRenderer(g);tiles.scanChunk(c);tiles.render(0);
 const overlay=new BreakingOverlay(device,assets),context={world:w,tileRenderer:tiles};
 const first=overlay.update(context,pos,st);assert.ok(first);const closed=new Float32Array(first.mesh.vertices);assert.ok(closed.length>24*9,'lid, base and latch are separate model geometry');
 const t=tiles.tiles.get('3,64,3');t.prevLid=0;t.lid=1;tiles.render(1);const open=overlay.update(context,pos,st).mesh.vertices;
 assert.notDeepEqual(open,closed,'damage geometry follows the animated lid');assert.ok(open.some((n,i)=>i%9===1&&n>1),'open lid extends above a unit selection box');
 tiles.clear();c.setState(4,64,3,st);tiles.scanChunk(c);tiles.render(0);
 if(version==='1.15.2'){
   // From 1.15 each half has its own geometry and damage pass.
   const left=findState('chest',{facing:'north',type:'left',waterlogged:'false'}),right=findState('chest',{facing:'north',type:'right',waterlogged:'false'});
   tiles.clear();c.setState(3,64,3,left);c.setState(4,64,3,right);tiles.scanChunk(c);tiles.render(0);
   const first=tiles.breakingModel(pos,left),second=tiles.breakingModel({x:4,y:64,z:3},right);assert.ok(first.root);assert.ok(second.root);assert.notEqual(first.root,second.root);overlay.clear();tiles.clear();return;
 }
 const primary=overlay.update(context,pos,st),a=new Float32Array(primary.mesh.vertices);const secondaryPos={x:4,y:64,z:3},secondary=overlay.update(context,secondaryPos,st),b=secondary.mesh.vertices;
 assert.equal(a.length,b.length);for(let i=0;i<a.length;i+=9){assert.ok(Math.abs(a[i]+pos.x-b[i]-secondaryPos.x)<1e-6);assert.ok(Math.abs(a[i+1]-b[i+1])<1e-6);assert.ok(Math.abs(a[i+2]-b[i+2])<1e-6);}
 overlay.clear();tiles.clear();
});

test(version + ': local and remote break rendering receive block state while selection outline keeps its own box',()=>{
 const g=fixture(),w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);g.world=w;c.setState(3,64,3,state('oak_stairs'));
 const calls=[],outlines=[];g.renderer.setOutline=b=>outlines.push(b);g.renderer.setBreakProgress=(...args)=>calls.push(args);
 w.selectionBox=()=>{throw new Error('damage must not use selection geometry');};
 const it=new Interaction(g);it.updateTarget=()=>it.target;it.isHitting=true;it.curBlock={x:3,y:64,z:3};it.curDamage=.5;it.prevDamage=.5;it.target={type:'block',x:3,y:64,z:3,box:[0,0,0,1,1,1]};
 it.renderSelection(.5);assert.equal(calls.at(-1)[2],state('oak_stairs'));assert.deepEqual(outlines.at(-1),[3,64,3,4,65,4]);
 it.isHitting=false;it.setRemoteBreak(8,{x:3,y:64,z:3},4);it.renderSelection(.5);assert.equal(calls.at(-1)[2],state('oak_stairs'));
 it.remoteBreaks.clear();it.renderSelection(.5);assert.equal(calls.at(-1)[0],null);
});

test(version + ': renderer damage stages keep model scale, reuse geometry and clear on reset',()=>{
 const w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);c.setState(3,64,3,state('oak_stairs'));
 const r=Object.create(Renderer.prototype);r.breaking=new BreakingOverlay(device,assets);r.breakContext=()=>({world:w});r.sections=new Map();
 r.setBreakProgress({x:3,y:64,z:3},2,state('oak_stairs'));const first=r.breakState;
 assert.ok(first.mesh);assert.equal(first.model[0],1);assert.equal(first.model[5],1);assert.equal(first.model[10],1);assert.deepEqual([...first.model.slice(12,15)],[3,64,3]);
 assert.equal(first.tex,(native?'block/':'blocks/')+'destroy_stage_2.png');r.setBreakProgress({x:3,y:64,z:3},99,state('oak_stairs'));assert.equal(r.breakState.mesh,first.mesh);assert.ok(r.breakState.tex.endsWith('destroy_stage_9.png'));
 r.setBreakProgress(null,-1);assert.equal(r.breakState,null);r.clearSections();assert.equal(r.breaking.mesh,null);
});

// GPU animation reuses padding in the packed position; worker/world snapshots keep the existing stride.
test(version + ': packed terrain preserves block identity and native top-UV flags without changing geometry layout',()=>{
 const w=new World(),c=new Chunk(0,0,true);w.chunks.set(World.key(0,0),c);c.biomes.fill(1);const plant=state(native?'grass':'tallgrass'),stone=state('stone');c.setState(2,1,2,plant);c.setState(4,1,2,stone);
 const mesh=new Mesher(null,assets.modelStore),result=mesh.buildSection(new SliceWorld(buildSlice(w,0,0,0)),0,0,0);let seenPlant=0,seenStone=0;
 for(const key of ['solid','cutout','translucent']){const bytes=result[key],view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);assert.equal(bytes.length%80,0);for(let q=0;q<bytes.length;q+=80){const vv=Array.from({length:4},(_,i)=>view.getUint16(q+i*20+10,true)),mid=(Math.min(...vv)+Math.max(...vv))*.5;for(let i=0;i<4;i++){const tag=view.getUint16(q+i*20+6,true),id=tag&32767;assert.ok(id===plant||id===stone);if(id===plant)seenPlant++;else seenStone++;assert.equal(!!(tag&32768),vv[i]<mid);}}}
 assert.ok(seenPlant>0);assert.ok(seenStone>0);
});


test(version + ': sleeping metadata enters bed, remains still, and wakes on a null position',()=>{
 const g=fixture(),pos={x:4,y:64,z:8};g.world.getState=()=>findState('red_bed',{facing:'east',part:'head'});
 const index=13;
 assert.equal(updateSleeping(g,{6:2},index),null);
 assert.equal(updateSleeping(g,{[index]:pos},index),'start');
 assert.equal(g.player.pose,'sleeping');assert.equal(g.player.x,4.5);assert.equal(g.player.z,8.5);
 const before=[g.player.x,g.player.y,g.player.z];
 for(let i=0;i<20;i++)g.player.tick(g.world,{forward:true,jump:true,sneak:true});
 assert.deepEqual([g.player.x,g.player.y,g.player.z],before);
 assert.equal(updateSleeping(g,{0:0},index),null);assert.equal(g.sleeping,true);
 g.thirdPerson=1;assert.equal(sleepingCamera(g,.5),null);g.thirdPerson=0;
 assert.equal(updateSleeping(g,{[index]:null},index),'stop');assert.equal(g.player.sleeping,false);assert.equal(g.player.pose,'standing');
 assert.equal(g.player.height,Math.fround(1.8));assert.equal(sleepingCamera(g,.5),null);
 const m=new EntityManager(g),e=m._base(42,4.5,64.6875,8.5);e.kind='player';e.entityName='player';
 m._applyMeta(e,{6:2,[index]:pos});assert.equal(e.sleeping,true);assert.deepEqual(e.bedPos,pos);
 m._applyMeta(e,{0:0});assert.equal(e.sleeping,true);
 m._applyMeta(e,{[index]:null,6:0});assert.equal(e.sleeping,false);assert.equal(e.bedPos,null);
});

test(version + ': camera rays use collision shapes while selection still hits plants',()=>{
 const w=new World(),plant=findState('tall_grass',{half:'lower'}),stone=findState('stone');
 w.getState=(x,y,z)=>x===0&&y===64&&z===1?plant:x===0&&y===64&&z===3?stone:0;
 assert.equal(w.raycast(.5,64.2,.5,0,0,1,4).z,1);
 assert.equal(w.raycast(.5,64.2,.5,0,0,1,4,false,true).z,3);
});


test(version + ': local wire metadata opens the sleep screen once and closes it on waking',()=>{
 const g=fixture(),pos={x:4,y:64,z:8};let opened=0,closed=0;
 g.screens={current:null,open(s){this.current=s;opened++;},close(){this.current=null;closed++;}};
 Game.prototype.on_entity_metadata.call(g,{entityId:g.entityId,metadata:{6:2,[13]:pos}});
 assert.equal(g.sleeping,true);assert.equal(g.screens.current.constructor.name,'SleepScreen');
 Game.prototype.on_entity_metadata.call(g,{entityId:g.entityId,metadata:{[13]:pos,0:0}});assert.equal(opened,1);
 Game.prototype.on_entity_metadata.call(g,{entityId:g.entityId,metadata:{6:0,[13]:null}});
 assert.equal(g.sleeping,false);assert.equal(closed,1);
});

test(version + ': rendered sleeping players lie along all four bed directions',()=>{
 const g=fixture(),pos={x:4,y:64,z:8};
 g.entities.spawnPlayer({entityId:42,x:4.5,y:64.6875,z:8.5,yaw:0,pitch:0,metadata:{},playerUUID:'00000000-0000-0000-0000-000000000000'});
 const e=g.entities.get(42);
 for(const [facing,dx,dz] of [['south',0,1],['west',-1,0],['north',0,-1],['east',1,0]]){
  g.world.getState=()=>findState('red_bed',{facing,part:'head'});
  g.entities.setMetadata(42,{6:2,[13]:pos});
  g.entityRenderer.render(.5);
  const v=g.entityRenderer.visuals.get(42),m=v.yawGroup.matrix;
  assert.ok(m,'sleep pose uses native bed rotation');assert.ok(Math.abs(m[5])<1e-6,'model vertical axis becomes horizontal');
  assert.ok(Math.abs(m[12]+dx*1.52)<1e-6);assert.ok(Math.abs(m[14]+dz*1.52)<1e-6);
 }
 g.entities.setMetadata(42,{6:0,[13]:null});g.entityRenderer.render(.5);
 assert.equal(g.entityRenderer.visuals.get(42).yawGroup.matrix,null);
});
