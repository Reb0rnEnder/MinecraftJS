// Real protocol spawn -> EntityManager -> renderer pose -> textured draw commands.
// Offline CPU integration; no GPU or live server needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ZipFile } from '../lib/zip.js';
import { extractModels, assertCompleteModels } from '../lib/modelextract.js';
import { ENTITY_TYPES, OBJECT_TYPES } from '../client/js/game/entity-types.js';
import { EntityManager } from '../client/js/game/entities.js';
import { EntityRenderer } from '../client/js/render/entity-renderer.js';
import { ItemRenderer } from '../client/js/render/item-renderer.js';
import { Items } from '../client/js/game/items.js';
import { Assets } from '../client/js/assets.js';
import { Writer } from '../client/js/net/buffer.js';
import { decodePacket } from '../client/js/net/packets.js';
import { initBlocks, findState } from '../client/js/world/blocks.js';
import { Atlas } from '../client/js/render/atlas.js';
import { ModelStore } from '../client/js/render/models.js';
import { decodePng } from '../client/js/util/png.js';
import { Node } from '../client/js/gfx/scene.js';
import { FontRenderer } from '../client/js/gui/font.js';
import { setPlatform } from '../client/js/platform/platform.js';
import { setModelDevice } from '../client/js/render/boxmodel.js';
import { Jvm, JObject } from '../lib/jvm.js';
import * as Models from '../client/js/render/entity-models.js';
import { Particles } from '../client/js/render/particles.js';
import { HandRenderer } from '../client/js/render/hand-renderer.js';
import { mat4 } from '../client/js/gfx/math.js';
import { setJarModels } from '../client/js/render/entity-models.js';

const jar = new ZipFile(process.env.MC_JAR || fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));
const prefix = 'assets/minecraft/';
const jsonAssets = dir => Object.fromEntries(jar.list(prefix + dir + '/').filter(p => p.endsWith('.json'))
  .map(p => [p.slice((prefix + dir + '/').length, -5), JSON.parse(jar.read(p))]));
const data = Object.fromEntries(['blocks', 'blockCollisionShapes', 'items', 'creative', 'enchantments', 'particles']
  .map(name => [name, JSON.parse(readFileSync(new URL('../client/data/' + name + '.json', import.meta.url)))]));
initBlocks(data.blocks, data.blockCollisionShapes);
setJarModels(assertCompleteModels(extractModels(jar)));
setPlatform({ now: () => 1000 });
const images = new Map();
const image = name => {
  if (!images.has(name)) {
    const raw = jar.read(prefix + 'textures/' + name);
    assert.ok(raw, 'Missing texture actually requested by renderer: ' + name);
    images.set(name, { ...decodePng(raw), name });
  }
  return images.get(name);
};
const atlas = new Atlas();
const pngs = ['block', 'item'].flatMap(dir => jar.list(prefix + 'textures/' + dir + '/').filter(p => p.endsWith('.png')));
const mcmeta = {};
for (const path of pngs) {
  const raw = jar.read(path + '.mcmeta');
  if (raw) mcmeta[path.slice((prefix + 'textures/').length, -4)] = JSON.parse(raw);
}
atlas.build(pngs.map(path => ({ name: path.slice((prefix + 'textures/').length, -4),
  image: image(path.slice((prefix + 'textures/').length)) })), mcmeta);
const assets = {
  data, atlas, atlasTexture: { name: 'atlas' }, version: 1, textures: new Map(), image, texture: image,
  modelStore: new ModelStore(jsonAssets('models'), jsonAssets('blockstates'), atlas),
  lang: JSON.parse(jar.read(prefix + 'lang/en_us.json')),
  makeTexture(name, width, height, data) { return { name, width, height, data }; },
};
assets.translate = Assets.prototype.translate.bind(assets);
const commands = [];
const device = {
  createMesh(format, vertices, options = {}) {
    assert.ok(vertices.every(Number.isFinite), 'Mesh vertices are finite');
    return { format, vertices, ...options };
  },
  createTexture(options) { return { ...options }; },
  updateTexture(texture, data) { texture.data = data; },
  updateMesh(mesh, vertices) { mesh.vertices = vertices; }, destroyMesh() {}, destroyTexture() {},
  draw(cmd) {
    assert.ok(cmd.model?.every(Number.isFinite), 'Finite draw transform');
    assert.ok(cmd.mesh?.vertices?.length, 'Nonempty submitted mesh');
    assert.ok(!cmd.textures || cmd.textures.every(Boolean), 'Draw texture resolved');
    commands.push(cmd);
  },
};
setModelDevice(device);
const uuid = '00000000-0000-0000-0000-000000000001';
function fixture() {
  const g = {
    assets, device, items: new Items(assets), entityId: 9999, cameraEntity: null, thirdPerson: 0,
    renderer: { entityRoot: new Node(), extraDraws: [], camPos: [0, 64, 0], boxVisible: () => true },
    settings: { renderDistance: 16, lodChunks: 0, entityShadows: false },
    world: { getState: () => 0, getSkyLight: () => 15, getBlockLight: () => 0, getBiome: () => 1 },
    scoreboard: { players: new Map() }, interaction: {},
    player: { yaw: 0, prevYaw: 0 }, inventory: { held: () => null, offhand: null },
    particles: { events: [], spawn() {}, spell(...args) { this.events.push(args); } }, sound: { play() {} }, ticks: 20,
  };
  g.gui = { font: new FontRenderer({ assets }), white: { name: 'white' } };
  g.entityRenderer = new EntityRenderer(g); g.entityRenderer.noBatch = true;
  g.itemRenderer = new ItemRenderer(g);
  g.entities = new EntityManager(g);
  return g;
}
function spawnMob(g, type, id = 1) {
  const w = new Writer().varint(3).varint(id).uuid(uuid).varint(type)
    .f64(4).f64(64).f64(8).i8(0).i8(0).i8(0).i16(0).i16(0).i16(0).u8(0xff);
  const packet = decodePacket(w.build());
  assert.equal(packet.name, 'spawn_entity_living'); assert.equal(packet._extra, undefined);
  g.entities.spawnMob(packet);
  return g.entities.get(id);
}
function spawnObject(g, type, data = 0, id = 1) {
  const w = new Writer().varint(0).varint(id).uuid(uuid).i8(type)
    .f64(4).f64(64).f64(8).i8(0).i8(0).i32(data).i16(0).i16(0).i16(0);
  const p = decodePacket(w.build());
  assert.equal(p.name, 'spawn_entity'); assert.equal(p._extra, undefined);
  g.entities.spawnObject(p);
  return g.entities.get(id);
}
const stack = (g, name, nbt = null) => ({ id: g.items.byName.get(name).id, count: 1, damage: 0, nbt });
function frame(g) {
  commands.length = 0;
  g.entityRenderer.render(0.5);
  g.entityRenderer.draw(device);
  return commands;
}
function failOnRenderWarning(t) {
  t.mock.method(console, 'warn', (...args) => assert.fail(args.map(String).join(' ')));
}
function assertTree(root, label) {
  root.updateWorld();
  const draws = root.collect([]).filter(({ d }) => d.mat?.pipeline === 'entity');
  assert.ok(draws.length, label + ': visible model geometry, not just a nametag');
  for (const { d, world } of draws) {
    assert.ok(world.every(Number.isFinite), label + ': finite transform');
    if (typeof d.mat.tex === 'string') image(d.mat.tex);
  }
  return draws;
}

test('every native living type resolves its own model/texture and survives a real render frame', () => {
  const g = fixture();
  for (const def of ENTITY_TYPES.filter(d => d.mob)) {
    const e = spawnMob(g, def.id);
    assert.equal(e.entityName, def.name);
    const v = g.entityRenderer._build(e);
    assert.ok(v, def.name + ': renderer implemented');
    assert.notEqual(v.texPath, 'entity/steve.png', def.name + ': not an unrelated fallback player');
    const p = g.entities.interp(e, 0.5);
    if (v.kind === 'dragon') g.entityRenderer._renderDragon(e, v, 0.5);
    else g.entityRenderer._renderLiving(e, v, p, 0.5); // Let exceptions fail, not the render loop logging catch.
    assertTree(v.root, def.name);
    commands.length = 0;
    g.entityRenderer.render(0.5);
    g.entityRenderer.draw(device);
    assert.ok(commands.some(cmd => cmd.pipeline === 'entity'), def.name + ': textured commands submitted');
    g.entities.clear();
  }
});

test('shifted IDs identify pig/parrot/polar bear/phantom rather than old families', () => {
  const g = fixture();
  for (const [id, name, tex] of [[51, 'pig', 'entity/pig/pig.png'], [50, 'parrot', 'entity/parrot/parrot_red_blue.png'],
    [54, 'polar_bear', 'entity/bear/polarbear.png'], [90, 'phantom', 'entity/phantom.png']]) {
    const e = spawnMob(g, id);
    assert.equal(e.entityName, name);
    assert.equal(g.entityRenderer._texFor(e), tex);
  }
});

test('all 28 spawn-object kinds produce geometry or their intentional particle-only effect', t => {
  failOnRenderWarning(t);
  const g = fixture();
  assert.equal(Object.keys(OBJECT_TYPES).length, 28);
  for (const def of Object.values(OBJECT_TYPES)) {
    const e = spawnObject(g, def.id, def.name === 'falling_block' ? findState('sand') : 0);
    if (e.kind === 'item') g.entities.setMetadata(e.id, { 6: stack(g, 'diamond') });
    if (e.kind === 'evoker_fangs') {
      g.entities.onStatus({ entityId: e.id, entityStatus: 4 });
      e.prevFangsProgress = 0.2; e.fangsProgress = 0.3;
    }
    const draws = frame(g);
    assert.ok(g.entityRenderer.visuals.get(e.id), def.name + ': intentional renderer');
    if (e.kind === 'area_effect_cloud') {
      assert.equal(draws.length, 0, 'cloud is not an invented solid model');
      assert.ok(g.particles.events.length > 0, 'cloud emits particles');
      const n = g.particles.events.length;
      frame(g); assert.equal(g.particles.events.length, n, 'no per-frame over-emission');
    } else assert.ok(draws.length, def.name + ': visible textured draw commands');
    g.entities.clear();
  }
});

test('invisible named stands retain equipment but do not reveal their body; plain holograms stay text-only', t => {
  failOnRenderWarning(t);
  const g = fixture(), e = spawnMob(g, 1);
  g.entities.setMetadata(e.id, { 0: 32, 2: '{"text":"Hologram"}', 3: true, 11: 20 });
  frame(g);
  let v = g.entityRenderer.visuals.get(e.id);
  assert.equal(e.invisible, true); assert.equal(e.marker, true);
  assert.ok(v.tag?.visible);
  assert.ok(v.bodyDrawables.every(d => d.visible === false));
  assert.equal(commands.filter(c => c.pipeline === 'entity').length, 0, 'no visible body for a hologram');
  for (const name of ['diamond_helmet', 'golden_helmet', 'leather_helmet', 'turtle_helmet', 'player_head', 'carved_pumpkin']) {
    g.entities.setEquipment(e.id, 5, stack(g, name)); // protocol HEAD=5 -> internal slot 4
    frame(g); assert.ok(commands.some(c => c.pipeline === 'entity'), name + ': equipment still drawn');
    assert.ok(v.bodyDrawables.every(d => d.visible === false), 'equipment never reveals stand');
  }
  g.entities.setEquipment(e.id, 5, null);
  g.entities.setEquipment(e.id, 0, stack(g, 'trident'));
  frame(g); assert.ok(commands.some(c => c.pipeline === 'entity'), 'held native item remains visible');
  g.entities.setEquipment(e.id, 0, null);
  g.entities.setMetadata(e.id, { 0: 0 });
  frame(g); assert.ok(v.bodyDrawables.some(d => d.visible), 'visibility updates restore body');
  g.entities.clear();
  const mob = spawnMob(g, 87);
  g.entities.setMetadata(mob.id, { 0: 32, 2: '{"text":"Hidden zombie"}', 3: true });
  frame(g); v = g.entityRenderer.visuals.get(mob.id);
  assert.equal(commands.length, 0, 'invisible unarmored mob stays invisible, including name');
  g.entities.setEquipment(mob.id, 4, stack(g, 'iron_chestplate'));
  frame(g); assert.ok(commands.some(c => c.pipeline === 'entity'), 'invisible mob armor stays visible');
});

test('metadata updates rebuild fish/phantom geometry and use actual variant textures', t => {
  failOnRenderWarning(t);
  const g = fixture();
  for (const [id, field, values] of [[52, 13, [0, 1, 2]], [90, 12, [0, 1, 4]],
    [72, 13, [0, 1, (5 << 8) | (14 << 16) | (11 << 24)]], [50, 15, [0, 1, 2, 3, 4]],
    [59, 15, [16, 0, 8, 15]], [36, 18, [0, 1, 2, 3]], [29, 15, [0, 1, 256, 1024]]]) {
    const e = spawnMob(g, id);
    let old = null;
    for (const value of values) {
      g.entities.setMetadata(e.id, { [field]: value }); frame(g);
      const v = g.entityRenderer.visuals.get(e.id);
      assert.notEqual(v, old, `${e.entityName}: variant rebuild`); old = v;
      assertTree(v.root, e.entityName);
    }
    g.entities.clear();
  }
  const llama = spawnMob(g, 36);
  for (let color = 0; color < 16; color++) {
    g.entities.setMetadata(llama.id, { 17: color }); frame(g);
    const decor = g.entityRenderer.visuals.get(llama.id).llamaDecor;
    assert.equal(decor.obj.visible, true); image(decor.mat.tex);
  }
  g.entities.setMetadata(llama.id, { 17: -1 }); frame(g);
  assert.equal(g.entityRenderer.visuals.get(llama.id).llamaDecor.obj.visible, false);
});

test('all six frame orientations match picking bounds and native filled maps update after data arrives', t => {
  failOnRenderWarning(t);
  const g = fixture();
  for (let facing = 0; facing < 6; facing++) {
    const e = spawnObject(g, 71, facing);
    frame(g);
    const v = g.entityRenderer.visuals.get(e.id), matrix = v.frame.world;
    const vertices = v.frame.drawables[0].mesh.vertices;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < vertices.length; i += 11) {
      for (let axis = 0; axis < 3; axis++) {
        const value = matrix[axis] * vertices[i] + matrix[4 + axis] * vertices[i + 1]
          + matrix[8 + axis] * vertices[i + 2] + matrix[12 + axis];
        min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
      }
    }
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(min[axis] - e.box[axis]) < 0.00001, `frame ${facing}: minimum axis ${axis}`);
      assert.ok(Math.abs(max[axis] - e.box[axis + 3]) < 0.00001, `frame ${facing}: maximum axis ${axis}`);
    }
    g.entities.clear();
  }
  const e = spawnObject(g, 71, 2);
  g.entities.setMetadata(e.id, { 6: stack(g, 'filled_map', { t: 10, name: '', v: { map: { t: 3, v: 42 } } }), 7: 3 });
  frame(g);
  const v = g.entityRenderer.visuals.get(e.id), before = v.itemKey;
  assert.equal(v.frameModel, 'true');
  g.items.updateMap({ itemDamage: 42, scale: 0, columns: 1, rows: 1, x: 0, y: 0, data: new Uint8Array([5]), icons: [] });
  frame(g);
  assert.notEqual(v.itemKey, before, 'late map packet replaces generic item picture');
  assert.ok(commands.some(c => c.textures?.some(tex => tex.width === 128 && tex.height === 128)), 'actual map texture submitted');
  g.entities.setMetadata(e.id, { 6: stack(g, 'diamond') }); frame(g);
  assert.equal(v.frameModel, 'false');
});

test('direct block states, cart display/wood metadata, fangs lifetime and unknown identities stay distinct', t => {
  failOnRenderWarning(t);
  const g = fixture();
  for (let cartType = 0; cartType <= 6; cartType++) {
    const cart = spawnObject(g, 10, cartType); frame(g);
    let old = g.entityRenderer.visuals.get(cart.id);
    g.entities.setMetadata(cart.id, { 9: findState('diamond_block'), 10: 10, 11: true }); frame(g);
    assert.notEqual(g.entityRenderer.visuals.get(cart.id), old, 'custom block display rebuild');
    const states = ['north_south', 'east_west'].map(shape => findState('powered_rail', { shape, powered: false }));
    const rotations = states.map(state => {
      g.world.getState = (x, y, z) => x === 4 && y === 64 && z === 8 ? state : 0;
      frame(g); return g.entityRenderer.visuals.get(cart.id).inner.rotation.y;
    });
    assert.ok(Math.abs(Math.cos(rotations[0] - rotations[1])) < 1e-6, `rail shapes give perpendicular yaw: ${rotations}`);
    g.world.getState = () => 0; g.entities.clear();
  }
  const boat = spawnObject(g, 1);
  for (let wood = 0; wood < 6; wood++) {
    g.entities.setMetadata(boat.id, { 9: wood }); frame(g);
    assert.ok(commands.some(c => c.textures?.some(tex => tex.name === 'entity/boat/' + ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'][wood] + '.png')));
  }
  g.entities.clear();
  const enderman = spawnMob(g, 18);
  g.entities.setMetadata(enderman.id, { 12: findState('grass_block', { snowy: false }) }); frame(g);
  const v = g.entityRenderer.visuals.get(enderman.id);
  assert.equal(v.carriedState, findState('grass_block', { snowy: false })); assert.ok(v.carriedBlock);
  g.entities.setMetadata(enderman.id, { 12: 0 }); frame(g); assert.equal(v.carriedBlock, null);
  g.entities.clear();
  const fangs = spawnObject(g, 79); frame(g);
  assert.equal(commands.length, 0, 'inactive fangs hidden');
  g.entities.onStatus({ entityId: fangs.id, entityStatus: 4 }); frame(g);
  assert.ok(commands.length, 'active fangs visible');
  fangs.prevFangsProgress = fangs.fangsProgress = 1; frame(g);
  assert.equal(commands.length, 0, 'finished fangs hidden');
  g.entities.clear();
  spawnMob(g, 1000); spawnObject(g, 100, 0, 2); frame(g);
  assert.equal(commands.length, 0, 'unknown identities never borrow a mob model');
});

test('named remote players draw actual skins and visibility changes take effect even on skipped LOD frames', t => {
  failOnRenderWarning(t);
  const g = fixture(); g.settings.lodChunks = 1;
  g.scoreboard.players.set(uuid, { name: 'Test player', properties: [] });
  const packet = decodePacket(new Writer().varint(5).varint(1).uuid(uuid)
    .f64(40).f64(64).f64(8).u8(0).u8(0).u8(0xff).build());
  assert.equal(packet.name, 'named_entity_spawn'); assert.equal(packet._extra, undefined);
  g.entities.spawnPlayer(packet);
  for (const invisible of [false, true, false, true]) {
    g.entities.setMetadata(1, { 0: invisible ? 32 : 0 }); frame(g);
    const v = g.entityRenderer.visuals.get(1);
    assert.ok(v.bodyDrawables.every(d => d.visible === !invisible));
    assert.equal(v.tag?.visible, !invisible);
    assert.equal(commands.some(c => c.pipeline === 'entity'), !invisible);
  }
  g.entities.clear();
  const dragon = spawnMob(g, 17);
  g.entities.setMetadata(dragon.id, { 0: 32 }); frame(g);
  assert.equal(commands.length, 0, 'special dragon renderer also honors invisibility');
});

test('remote swimming metadata changes the living pose instead of only the name-tag state', t => {
  failOnRenderWarning(t);
  const g = fixture();
  const e = spawnMob(g, 51);
  g.entities.setMetadata(e.id, { 0: 16 });
  frame(g);
  const v = g.entityRenderer.visuals.get(e.id);
  assert.equal(e.swimming, true); assert.ok(v.yawGroup.matrix, 'swimming uses a horizontal pose matrix');
  assert.ok(commands.some(c => c.pipeline === 'entity'), 'swimming mob still submits geometry');
  e.prevPitch = e.pitch = 30; e.prevSwimAmount = e.swimAmount = 1;
  frame(g);
  const expected = mat4.create();
  mat4.rotateY(expected, expected, Math.PI);
  mat4.rotateX(expected, expected, -120 * Math.PI / 180);
  mat4.translate(expected, expected, 0, -1, 0.3);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(expected[i] - v.yawGroup.matrix[i]) < 1e-6, 'pitch follows X with vanilla swim translation');
  e.swimAmount = e.prevSwimAmount = 0; e.swimming = false;
  frame(g); assert.equal(v.yawGroup.matrix, null, 'standing restores the normal body transform');
  e.swimming = true;
  g.entities._livingUpdate(e);
  assert.equal(e.prevSwimAmount, 0); assert.equal(e.swimAmount, 0.09);
  for (let i = 0; i < 11; i++) g.entities._livingUpdate(e);
  assert.equal(e.swimAmount, 1, 'vanilla blend reaches the full pose');
  e.swimming = false; g.entities._livingUpdate(e);
  assert.equal(e.prevSwimAmount, 1); assert.equal(e.swimAmount, 0.91);
});

test('held tridents use the jar 3D model and throwing override while inventory keeps its sprite', () => {
  const g = fixture(), ir = g.itemRenderer;
  const stack = { id: g.items.byName.get('trident').id, count: 1, damage: 0 };
  g.inventory.held = () => stack;
  assert.equal(ir.modelFor(stack).kind, 'generated');
  const hand = ir.modelFor(stack, null, true);
  assert.equal(hand.kind, 'builtin'); assert.equal(hand.path, 'item/trident_in_hand');
  assert.deepEqual(hand.display.firstperson_righthand.translation, [-3, 17, 1]);
  const obj = ir.objectFor(stack, null, true);
  assert.ok(obj, 'trident has held geometry');
  const meshes = [];
  obj.obj.traverse(n => { for (const d of n.drawables) meshes.push(d); });
  assert.ok(meshes.length >= 4, 'shaft and three prongs retain the jar hierarchy');
  assert.ok(meshes.every(d => d.mesh.vertices.length && d.mesh.vertices.every(Number.isFinite)));
  g.player.usingItem = true;
  assert.equal(ir.modelFor(stack, null, true).path, 'item/trident_throwing');
  const other = { id: 2, usingItem: false, mainHand: 1 };
  assert.equal(ir.modelFor(stack, other, true).path, 'item/trident_in_hand');
  other.usingItem = true;
  assert.equal(ir.modelFor(stack, other, true).path, 'item/trident_throwing');
  assert.equal(ir.modelFor(stack).path, 'item/trident', 'charging never changes inventory model');
});

test('player swimming limbs match the jar bytecode throughout the stroke and blend transitions', () => {
  const vm = new Jvm(jar, { intercept: {
    'aer.bb()Z': () => 1, 'cot$a.ordinal()I': () => 0,
    'xq.b(F)F': ([v]) => Math.cos(v), 'xq.a(F)F': ([v]) => Math.sin(v),
  } });
  vm.statics.set('cot$1', { 'cot$1.a': [1] });
  const empty = new JObject('cot$a');
  vm.statics.set('cot$a', Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map(k => ['cot$a.' + k, k === 'a' ? empty : new JObject('cot$a')])));
  const bones = { head: 'c', body: 'e', rightArm: 'f', leftArm: 'g', rightLeg: 'h', leftLeg: 'i' };
  for (const amount of [0.09, 0.5, 1]) for (let frame = 0; frame < 52; frame++) {
    const model = Models.playerModel(false);
    model.animate(model, { ls: frame, lsa: 0.5, age: 0, yaw: 0, pitch: 0, swimAmount: amount, swimming: true, swing: -9999 });
    const native = new JObject('cot');
    for (const k of ['c', 'd', 'e', 'f', 'g', 'h', 'i']) native.fields['cot.' + k] = new JObject('cqw');
    native.fields['cot.j'] = native.fields['cot.k'] = empty;
    native.fields['cot.m'] = amount; native.fields['cpc.n'] = -9999;
    vm.invoke('cot', 'a', '(FFFFFFLaer;)V', native, [frame, 0.5, 0, 0, 0, 0.0625, new JObject('aer')]);
    for (const [bone, field] of Object.entries(bones)) for (const [axis, nativeAxis] of [['rx', 'f'], ['ry', 'g'], ['rz', 'h']]) {
      const actual = model.parts[bone][axis], expected = native.fields['cot.' + field].fields['cqw.' + nativeAxis] || 0;
      const delta = Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected));
      assert.ok(Math.abs(delta) < 1e-5, `${bone}.${axis}, stroke ${frame}, blend ${amount}: ${actual} vs jar ${expected}`);
    }
    assert.equal(model.parts.leftArmwear.rx, model.parts.leftArm.rx);
    assert.equal(model.parts.rightLegwear.rx, model.parts.rightLeg.rx);
  }
});

test('creative barrier markers appear only with the main-hand barrier and refresh without piling up', () => {
  const g = fixture(); g.settings.particles = 0; g.player.creative = true;
  const p = Object.create(Particles.prototype); p.game = g; p.list = [];
  const barrier = findState('barrier'), stone = findState('stone');
  g.world.getState = () => barrier;
  const stack = { id: g.items.byName.get('barrier').id, count: 1 };
  p.randomDisplayTick(2, 64, 3, barrier); assert.equal(p.list.length, 0);
  g.inventory.held = () => stack; g.player.creative = false;
  p.randomDisplayTick(2, 64, 3, barrier); assert.equal(p.list.length, 0);
  g.player.creative = true;
  p.randomDisplayTick(2, 64, 3, stone); assert.equal(p.list.length, 0);
  p.randomDisplayTick(2, 64, 3, barrier);
  assert.equal(p.list.length, 1);
  const marker = p.list[0];
  assert.deepEqual([marker.x, marker.y, marker.z], [2.5, 64.5, 3.5]);
  assert.deepEqual(marker.atlas, atlas.uv('item/barrier'));
  for (let i = 0; i < 40; i++) p.tick();
  p.randomDisplayTick(2, 64, 3, barrier);
  assert.equal(p.list.length, 1); assert.equal(marker.age, 0);
  assert.equal(marker.scale, 5, 'one-block-wide marker');
  g.inventory.held = () => null;
  p.tick();
  assert.equal(p.list.length, 0, 'markers disappear immediately after switching away');
});

test('first-person spear charging uses a distinct finite pose in each hand', () => {
  const g = fixture(); const hand = new HandRenderer(g);
  const trident = { id: g.items.byName.get('trident').id, count: 1 };
  g.player.usingItem = true; g.interaction.activeHand = 0;
  for (const side of [-1, 1]) {
    const charging = mat4.create(), ready = mat4.create();
    g.interaction.useTicks = 1; hand._itemMatrix(charging, trident, 0, side, 0, 0, 0);
    g.interaction.useTicks = 10; hand._itemMatrix(ready, trident, 0, side, 0, 0, 0);
    assert.ok(ready.every(Number.isFinite)); assert.notDeepEqual(ready, charging);
  }
});

test('living Riptide metadata drives the vanilla pitch and spin body transform', () => {
  const g = fixture(), e = spawnMob(g, 51);
  g.entities.setMetadata(e.id, { 6: 4 });
  e.prevPitch = e.pitch = -20; e.ticks = 8;
  frame(g);
  const v = g.entityRenderer.visuals.get(e.id), expected = mat4.create();
  mat4.rotateY(expected, expected, Math.PI);
  mat4.rotateX(expected, expected, -70 * Math.PI / 180);
  mat4.rotateY(expected, expected, -75 * 8.5 * Math.PI / 180);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(expected[i] - v.yawGroup.matrix[i]) < 1e-6);
  g.entities.setMetadata(e.id, { 6: 0 }); frame(g);
  assert.equal(v.yawGroup.matrix, null);
});

test('barrier markers stop drawing before the next tick on item changes, removal and unload', () => {
  const g = fixture(); g.renderer.camRot = mat4.create(); g.player.creative = true;
  let state = findState('barrier'), held = stack(g, 'barrier');
  g.world.getState = () => state; g.inventory.held = () => held;
  const p = new Particles(g);
  const draw = () => { p.render(0.5, 0, 64, 0); return p.batchA.n; };
  p.barrier(2, 64, 3); assert.equal(draw(), 1);
  held = null; assert.equal(draw(), 0, 'switching away hides the marker in the same frame');
  p.tick(); assert.equal(p.list.length, 0);
  held = stack(g, 'barrier'); assert.equal(draw(), 0, 'switching back cannot revive an old marker');
  p.barrier(2, 64, 3); assert.equal(draw(), 1);
  state = 0; assert.equal(draw(), 0, 'breaking the block hides its marker in the same frame');
  p.tick(); assert.equal(p.list.length, 0);
  assert.equal(draw(), 0, 'turning back toward a removed block cannot revive the marker');
  p.barrier(2, 64, 3); assert.equal(p.list.length, 0, 'air and unloaded blocks never create markers');
  state = findState('barrier'); p.barrier(2, 64, 3);
  g.player.creative = false; assert.equal(draw(), 0, 'leaving creative hides markers immediately');
  p.tick(); assert.equal(p.list.length, 0);
});
