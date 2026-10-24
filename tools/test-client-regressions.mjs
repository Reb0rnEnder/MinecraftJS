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
import { Particles } from '../client/js/render/particles.js';
import { Weather } from '../client/js/render/weather.js';
import { sectionLod, poseInterval } from '../client/js/render/lod.js';
const version = mcassets.MC_VERSION, native = version === '1.13.2';
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
  const g = fixture(), p = g.particles, sheet = image('particle/particles.png');
  p.rain(1,65,1); p.spark(2,65,1,0,0,0);
  p.render(0,0,64,0);
  assert.equal(p.batchP.n, 2);
  const stride = p.batchP.mesh.format.stride;
  for (let particle = 0; particle < 2; particle++) {
    const v = p.batchP.mesh.vertices, offset = particle*4*stride;
    const uv = Array.from({ length: 4 }, (_, i) => [v[offset+i*stride+3],v[offset+i*stride+4]]);
    const u0 = Math.min(...uv.map(v => v[0])), u1 = Math.max(...uv.map(v => v[0]));
    const v0 = Math.min(...uv.map(v => v[1])), v1 = Math.max(...uv.map(v => v[1]));
    assert.ok(Math.abs((u1-u0) - 0.999/(native?32:16)) < 1e-6);
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
    g.entities.setMetadata(10,{7:g.entityId});
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
    g.entities.add(c);g.entities.setMetadata(c.id,{6:{x:0,y:70,z:0}});g.entityRenderer.render(0.5);
    assert.ok(g.entityRenderer.effects.entries.has('crystal:40'),'crystal beam-target metadata renders too');
    g.entities.setMetadata(c.id,{6:null});g.entityRenderer.render(0.5);assert.equal(g.entityRenderer.effects.entries.has('crystal:40'),false);
  }
});

test(version + ': guardian and elder beams follow metadata, charge, local targets, and their own bounds', () => {
  const g=fixture(),e=g.entities._base(30,-20,64,0),t=g.entities._base(40,20,64,0);
  Object.assign(e,{kind:'mob',type:68,entityType:version==='1.12.2'?4:68,entityName:'elder_guardian',elder:true,width:1.9975,height:1.9975});
  Object.assign(t,{kind:'mob',type:90,entityType:90,entityName:'pig',width:0.9,height:0.9});g.entities.add(e);g.entities.add(t);
  const idx=version==='1.8.9'?17:13;
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
