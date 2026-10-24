// Geometry-only test: no registry, packet code, renderer integration, GPU, downloads or dependencies.
// Run: node tools/test-1.13.2-entity-geometry.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as M from '../client/js/render/entity-models.js';
import { Part, entityMaterial, setModelDevice } from '../client/js/render/boxmodel.js';
import { Node } from '../client/js/gfx/scene.js';

const require = createRequire(import.meta.url);
const { ZipFile } = require('../lib/zip.js');
const { extractModels, assertCompleteModels } = require('../lib/modelextract.js');

export function testEntityGeometry({ models, jar }) {
  M.setJarModels(models);
  let meshes = 0, frames = 0;
  setModelDevice({
    createMesh(format, vertices) {
      assert.ok(vertices instanceof Float32Array && vertices.length > 0);
      assert.ok(vertices.every(Number.isFinite), 'Finite actual mesh positions, normals and UVs');
      meshes++;
      return { vertices };
    },
  });

  // Independent, audited constructor layouts. These distinguish the 1.13 hierarchy from the old
  // 39-field horse, and check that child-only geometry and inflated layers survived extraction.
  const layouts = {
    horse: [0, 3, 15, 16, 17, 18, 1, [2, 9, 10, 13, 14], [11, 12]],
    donkey: [0, 5, 17, 18, 19, 20, 1, [2, 11, 12, 15, 16], [13, 14], 3, 4],
    drowned: [0, 1, 2, 3, 4, 5, 6], drownedOuter: [0, 1, 2, 3, 4, 5, 6],
    polarBear: [0, 1, 2, 3, 4, 5], llama: [0, 1, 2, 3, 4, 5, 6, 7], llamaDecor: [0, 1, 2, 3, 4, 5, 6, 7],
    parrot: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], vex: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    illager: [0, 1, 3, 4, 6, 7, 2, 8, 9], cod: [0, 1, 2, 3, 4, 5, 6],
    salmon: [0, 2, 5, 1, 4, 3, 6, 7], pufferfishSmall: [0, 1, 2, 3, 4, 5],
    pufferfishMedium: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    pufferfishBig: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    tropicalFishA: [0, 1, 2, 3, 4], tropicalFishB: [0, 1, 2, 3, 4, 5],
    tropicalFishPatternA: [0, 1, 2, 3, 4], tropicalFishPatternB: [0, 1, 2, 3, 4, 5],
    dolphin: [0, 2, 6, 7], turtle: [0, 1, 2, 3, 4, 5, 6], phantom: [0, 4, 5, 6, 7, 3, 1, 2],
    trident: [0], llamaSpit: [0], shulkerBullet: [0], evokerFangs: [0, 1, 2],
  };
  for (const [key, layout] of Object.entries(layouts)) assert.deepEqual(models[key]?.fields, layout, `${key}: real jar fields`);
  assert.equal(models.horse.parts.length, 19);
  assert.equal(models.donkey.parts.length, 21);
  assert.deepEqual(models.horse.parts[0].children, [1, 2], 'Horse body owns tail and saddle');
  assert.deepEqual(models.donkey.parts[0].children, [1, 2, 3, 4], 'Donkey adds body-owned chests');
  assert.deepEqual(models.dolphin.parts[2].children, [3, 4, 5, 6, 0], 'Dolphin body owns fins, tail and head');
  assert.deepEqual(models.trident.parts.map((p) => p.boxes[0].slice(5, 8)), [[1, 31, 1], [3, 2, 1], [1, 4, 1], [1, 4, 1]]);
  for (const [base, layer, inflation] of [
    ['drowned', 'drownedOuter', 0.25], ['llama', 'llamaDecor', 0.5],
    ['tropicalFishA', 'tropicalFishPatternA', Math.fround(0.008)], ['tropicalFishB', 'tropicalFishPatternB', Math.fround(0.008)],
  ]) {
    models[base].parts.forEach((p, i) => p.boxes.forEach((box, b) => {
      const inflated = models[layer].parts[i].boxes[b];
      assert.deepEqual(inflated.slice(0, 8), box.slice(0, 8), `${layer}: matching UVs/dimensions`);
      assert.equal(inflated[8] - box[8], inflation, `${layer}: actual constructor inflation`);
    }));
  }

  const factories = [
    ['horse', () => M.horse()], ['donkey', () => M.horse(1)], ['mule', () => M.horse(2)],
    ['zombieHorse', () => M.horse(3)], ['skeletonHorse', () => M.horse(4)],
    ['polarBear', M.polarBear], ['llama', M.llama], ['llamaDecor', () => M.llama(true)],
    ...Array.from({ length: 5 }, (_, i) => ['parrot' + i, () => M.parrot(i)]), ['vex', M.vex],
    ...['evoker', 'vindicator', 'illusioner'].map((kind) => [kind, () => M.illager(kind)]),
    ['drowned', M.drowned], ['drownedOuter', () => M.drowned(true)], ['cod', M.cod], ['salmon', M.salmon],
    ...[0, 1, 2].map((size) => ['pufferfish' + size, () => M.pufferfish(size)]),
    ...[0, 1].flatMap((shape) => [false, true].map((pattern) => ['tropical' + shape + pattern, () => M.tropicalFish(shape, pattern)])),
    ['dolphin', M.dolphin], ['turtle', M.turtle], ['phantom', M.phantom], ['phantom3', () => M.phantom(3)],
    ['trident', M.trident], ['llamaSpit', M.llamaSpit], ['shulkerBullet', M.shulkerBullet], ['evokerFangs', M.evokerFangs],
  ];
  const poseKeys = ['px', 'py', 'pz', 'rx', 'ry', 'rz'];
  const entries = new Map();
  const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);
  const fingerprint = (m) => JSON.stringify(Object.entries(m.parts).map(([name, part]) =>
    [name, [].concat(part).map((p) => [...poseKeys.map((key) => p[key]), p.visible])]));
  const active = { age: 17.5, partial: 0.5, ls: 2.3, lsa: 0.65, yaw: 24, pitch: -13, swing: 0.4,
    onGround: false, inWater: true, swimming: true, swimAmount: 0.7, moving: true, rearing: 0.8,
    saddled: true, hasRider: true, chested: true, throwing: true, charging: true, pose: 'spellcasting',
    hasEgg: true, entityId: 23, progress: 0.45 };

  for (const [label, factory] of factories) {
    const m = factory();
    assert.ok(m.roots.length && m.roots.every((p) => p instanceof Part), label + ': renderable roots');
    assert.ok(jar.read('assets/minecraft/textures/' + m.texture), label + ': actual jar texture');
    const all = new Set();
    const visit = (p) => {
      assert.ok(!all.has(p), label + ': part is rendered exactly once, not as both root and child');
      all.add(p); p.children.forEach(visit);
    };
    m.roots.forEach(visit);
    Object.values(m.parts).flat().forEach((p) => assert.ok(all.has(p), label + ': named part is attached'));
    const raw = models[m.jarModel];
    assert.equal(all.size, raw.parts.length, label + ': no lost child-only geometry');
    const boxRecords = (p) => p.boxes.map((b) => [b.u, b.v, b.x, b.y, b.z, b.dx, b.dy, b.dz, b.inflate, b.mirror]);
    const signature = (tw, th, boxes) => JSON.stringify([tw, th, boxes]);
    assert.deepEqual([...all].map((p) => signature(p.texW, p.texH, boxRecords(p))).sort(),
      raw.parts.map((p) => signature(p.tw, p.th, p.boxes)).sort(), label + ': every box is from the jar, unchanged');
    const root = new Node();
    const mat = entityMaterial(m.texture, m.materialOptions);
    for (const p of m.roots) { root.add(p.build()); p.setMaterial(mat); }
    entries.set(label, { m, root, all, factory });

    const tick = (args, allowEmpty = false) => {
      m.animate(m, args);
      for (const p of all) {
        assert.ok(poseKeys.every((key) => Number.isFinite(p[key])), label + ': finite pose including hidden parts');
        assert.equal(typeof p.visible, 'boolean');
      }
      assert.ok(Number.isFinite(m.modelScale), label + ': finite model scale');
      root.scale.set(-m.modelScale / 16, -m.modelScale / 16, m.modelScale / 16);
      root.position.set(0, m.modelTranslateY || 0, m.modelTranslateZ || 0);
      m.roots.forEach((p) => p.sync());
      root.updateWorld();
      const draws = root.collect([]);
      if (!allowEmpty) assert.ok(draws.length > 0, label + ': drawable after animation');
      for (const { d, world } of draws) {
        assert.ok(world.every(Number.isFinite), label + ': finite world transform');
        const v = d.mesh.vertices;
        assert.ok(v.length > 0 && v.every(Number.isFinite), label + ': real finite mesh');
        for (let i = 0; i < v.length; i += 11) {
          for (let axis = 0; axis < 3; axis++) {
            assert.ok(Number.isFinite(Math.fround(world[axis] * v[i] + world[4 + axis] * v[i + 1] + world[8 + axis] * v[i + 2] + world[12 + axis])), label + ': finite transformed vertex');
          }
        }
      }
      frames++;
      return draws;
    };
    entries.get(label).tick = tick;
    tick(); const rest = fingerprint(m);
    tick({}); assert.equal(fingerprint(m), rest, label + ': empty args have defaults');
    tick({ age: NaN, ls: undefined, lsa: NaN, yaw: Infinity, pitch: undefined, swing: -1 });
    assert.equal(fingerprint(m), rest, label + ': malformed common numeric inputs cannot poison transforms');
    for (let t = 0; t <= 20; t++) tick({ ...active, age: t + 0.5, ls: t / 3, progress: t / 20 });
    tick(active); const posed = fingerprint(m);
    tick(active); assert.equal(fingerprint(m), posed, label + ': pose does not accumulate on repeated frames');
    if (!['trident', 'llamaSpit'].includes(label)) assert.notEqual(posed, rest, label + ': actual animation changes pose');
    tick({}); assert.equal(fingerprint(m), rest, label + ': active -> idle resets state');
    tick({ showParts: [] }, true); assert.equal(root.collect([]).length, 0, label + ': empty whitelist hides geometry');
    tick({}); assert.equal(fingerprint(m), rest, label + ': visibility override resets');
    const fresh = factory();
    assert.equal(fingerprint(fresh), rest, label + ': instances are isolated');
  }

  // Model-specific behavior, not merely "calling animate did not throw".
  for (const label of ['horse', 'donkey', 'mule', 'zombieHorse', 'skeletonHorse']) {
    const { m, tick } = entries.get(label), p = m.parts;
    assert.ok(p.body.children.includes(p.tail) && p.body.children.includes(p.saddle));
    assert.ok(p.neck.children.includes(p.head) && p.neck.children.includes(p.leftRein));
    assert.ok(!m.roots.includes(p.tail) && !m.roots.includes(p.head));
    tick({}); const bare = entries.get(label).root.collect([]).length;
    assert.ok(p.saddleParts.every((x) => !x.visible) && p.reins.every((x) => !x.visible));
    tick({ saddled: true, hasRider: true, chested: true, rearing: 1, ls: 1, lsa: 0.4, tailWag: true, age: 5 });
    assert.ok(p.saddleParts.every((x) => x.visible) && p.reins.every((x) => x.visible));
    assert.ok(entries.get(label).root.collect([]).length > bare, 'Saddle/reins add drawables');
    near(p.body.rx, -Math.PI / 4, 'Horse rear pose'); near(p.neck.py, -4, 'Horse neck pivot');
    near(p.leftFrontLeg.py, 2, 'Front legs follow rearing');
    assert.notEqual(p.tail.ry, 0);
    const before = [...p.head.obj.world];
    tick({ yaw: -20, pitch: 25, grazing: 1 });
    assert.notDeepEqual([...p.head.obj.world], before, 'Child head follows animated neck transform');
    near(p.neck.py, 11, 'Grazing pose');
    if (label === 'donkey' || label === 'mule') {
      assert.ok(p.body.children.includes(p.leftChest));
      tick({ chested: true }); assert.ok(p.leftChest.visible && p.rightChest.visible);
      tick({ chested: true, child: true }); assert.ok(!p.leftChest.visible && !p.rightChest.visible);
      near(p.leftEar.boxes[0].dy, 7, 'Real donkey ear geometry');
    } else near(p.leftEar.boxes[0].dy, 3, 'Real horse ear geometry');
    tick({ saddled: true, showParts: { saddleParts: false } }); assert.ok(p.saddleParts.every((x) => !x.visible));
    tick({ showParts: ['saddle'] }); assert.ok(p.saddle.visible && p.body.visible, 'Whitelist reveals optional part and ancestor');
  }
  assert.equal(entries.get('donkey').m.modelScale, 0.87); assert.equal(entries.get('mule').m.modelScale, 0.92);
  const bear = entries.get('polarBear'); bear.tick({ rearing: 1 }); near(bear.m.parts.head.py, -12, 'Bear stands');
  bear.tick({ rearing: 0 }); near(bear.m.parts.head.py, 10, 'Bear returns to all fours');
  for (const label of ['llama', 'llamaDecor']) {
    const { m, tick } = entries.get(label);
    tick({ chested: true }); assert.equal(m.parts.leftChest.visible, true);
    tick({ chested: true, child: true }); assert.equal(m.parts.leftChest.visible, false);
    tick({}); assert.equal(m.parts.rightChest.visible, false);
  }
  const parrot = entries.get('parrot0');
  parrot.tick({ sitting: true }); near(parrot.m.parts.leftLeg.py, 23.9, 'Parrot sits');
  parrot.tick({ dancing: true, age: 1 }); assert.notEqual(parrot.m.parts.head.rz, 0);
  parrot.tick({}); near(parrot.m.parts.leftLeg.py, 22, 'Parrot stands again');
  const vex = entries.get('vex');
  vex.tick({ charging: true }); near(vex.m.parts.rightArm.rx, Math.PI * 1.2, 'Vex charge arm');
  vex.tick({ charging: true, leftHanded: true }); near(vex.m.parts.leftArm.rx, Math.PI * 1.2, 'Left-handed vex');
  assert.equal(vex.m.parts.headwear.visible, false); assert.equal(vex.m.parts.leftLeg.visible, false);
  const illager = entries.get('evoker');
  for (const pose of ['attacking', 'spellcasting', 'bow', 'crossed']) {
    illager.tick({ pose, age: 5, swing: 0.5 });
    assert.equal(illager.m.parts.arms.visible, pose === 'crossed');
    assert.equal(illager.m.parts.rightArm.visible, pose !== 'crossed');
  }
  const illusioner = entries.get('illusioner'); illusioner.tick({}); assert.equal(illusioner.m.parts.hat.visible, true);
  for (const label of ['drowned', 'drownedOuter']) {
    const { m, tick } = entries.get(label);
    tick({ throwing: true }); assert.ok(m.parts.rightArm.rx < -Math.PI);
    tick({ throwing: true, leftHanded: true }); assert.ok(m.parts.leftArm.rx < -Math.PI);
    tick({ swimming: true, age: 7, pitch: 20 }); assert.equal(m.parts.head.rx, 0);
    tick({ swimming: false, pitch: 20 }); near(m.parts.head.rx, 20 * Math.PI / 180, 'Drowned stops swimming');
  }
  entries.get('drowned').tick(active); entries.get('drownedOuter').tick(active);
  assert.equal(fingerprint(entries.get('drowned').m), fingerprint(entries.get('drownedOuter').m), 'Drowned layer exactly follows pose');
  for (const label of ['cod', 'salmon', 'tropical0false', 'tropical1false']) {
    const { m, tick } = entries.get(label), tail = m.parts.backBody || m.parts.tail;
    tick({ age: 2, inWater: true }); const wet = tail.ry;
    tick({ age: 2, inWater: false }); assert.notEqual(tail.ry, wet, label + ': stranded tail changes');
  }
  for (let i = 0; i < 3; i++) {
    const { m, tick } = entries.get('pufferfish' + i);
    assert.deepEqual([m.parts.body.boxes[0].dx, m.parts.body.boxes[0].dy, m.parts.body.boxes[0].dz], [[3, 2, 3], [5, 5, 5], [8, 8, 8]][i]);
    tick({ age: 5 }); near(m.parts.rightFin.rz, -0.2 + 0.4 * Math.sin(1), 'Puffer fin');
    near(m.parts.leftFin.rz, -m.parts.rightFin.rz, 'Puffer fins mirror');
  }
  for (let shape = 0; shape <= 1; shape++) {
    const base = entries.get('tropical' + shape + 'false'), layer = entries.get('tropical' + shape + 'true');
    base.tick(active); layer.tick(active);
    assert.equal(fingerprint(base.m), fingerprint(layer.m), 'Tropical pattern follows base pose');
  }
  const dolphin = entries.get('dolphin');
  dolphin.tick({ moving: true, age: 2 }); const moving = dolphin.m.parts.tail.rx;
  dolphin.tick({ moving: false }); assert.notEqual(dolphin.m.parts.tail.rx, moving, 'Dolphin stops tail stroke');
  const turtle = entries.get('turtle');
  turtle.tick({ inWater: true, ls: 2, lsa: 0.4, hasEgg: true }); assert.equal(turtle.m.parts.eggBelly.visible, true);
  assert.notEqual(turtle.m.parts.leg3.rz, 0);
  turtle.tick({ inWater: false, onGround: true, layingEgg: true, ls: 2, lsa: 0.4 });
  assert.equal(turtle.m.parts.leg3.rz, 0); assert.notEqual(turtle.m.parts.leg3.ry, 0);
  turtle.tick({ hasEgg: true, child: true }); assert.equal(turtle.m.parts.eggBelly.visible, false);
  assert.equal(turtle.m.childScale, 1 / 6);
  const phantom = entries.get('phantom');
  phantom.tick({ age: 10, entityId: 0 }); const wing = phantom.m.parts.leftWing.rz;
  phantom.tick({ age: 10, entityId: 1 }); assert.notEqual(phantom.m.parts.leftWing.rz, wing);
  near(phantom.m.parts.leftWing.rz, -phantom.m.parts.rightWing.rz, 'Phantom wings mirror');
  assert.equal(entries.get('phantom3').m.modelScale, 1.45);
  const fangs = entries.get('evokerFangs');
  fangs.tick({ progress: 0 }); const open = fangs.m.parts.upperJaw.rz;
  fangs.tick({ progress: 0.5 }); assert.notEqual(fangs.m.parts.upperJaw.rz, open);
  near(fangs.m.parts.upperJaw.rz, Math.PI, 'Fangs close');
  fangs.tick({ progress: 0.95 }); near(fangs.m.modelScale, 0.5, 'Fangs shrink');
  fangs.tick({ progress: 0.2 }); assert.equal(fangs.m.modelScale, 1, 'Fangs shrink resets');

  // All material variants/layers needed by the caller really exist in this jar.
  const textures = [
    'entity/illager/vex_charging.png', 'entity/phantom_eyes.png',
    ...['white', 'creamy', 'chestnut', 'brown', 'black', 'gray', 'darkbrown'].map((x) => `entity/horse/horse_${x}.png`),
    ...['white', 'whitefield', 'whitedots', 'blackdots'].map((x) => `entity/horse/horse_markings_${x}.png`),
    ...['iron', 'gold', 'diamond'].map((x) => `entity/horse/armor/horse_armor_${x}.png`),
    ...['creamy', 'white', 'brown', 'gray'].map((x) => `entity/llama/${x}.png`),
    ...['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'].map((x) => `entity/llama/decor/${x}.png`),
    ...['a', 'b'].flatMap((shape) => Array.from({ length: 6 }, (_, i) => `entity/fish/tropical_${shape}_pattern_${i + 1}.png`)),
  ];
  for (const tex of textures) assert.ok(jar.read('assets/minecraft/textures/' + tex), tex);
  assert.equal(M.horse('donkey').jarModel, 'donkey'); assert.equal(M.horse('skeleton_horse').jarModel, 'horse');
  assert.equal(M.pufferfish('medium').jarModel, 'pufferfishMedium'); assert.equal(M.pufferfish(99).jarModel, 'pufferfishSmall');
  assert.equal(M.tropicalFish('b', true).jarModel, 'tropicalFishPatternB');
  // Reject the old bundle's donkey-under-horse key and an old 39-field layout explicitly.
  // Neither can be made correct by silently skipping null parts in the animation.
  try {
    M.setJarModels({ ...models, horse: models.donkey });
    assert.throws(() => M.horse(), /unexpected jar field layout; rebuild/);
    M.setJarModels({ ...models, horse: { ...models.horse, fields: Array(39).fill(0) } });
    assert.throws(() => M.horse(), /unexpected jar field layout; rebuild/);
  } finally { M.setJarModels(models); }
  return { factories: factories.length, frames, meshes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jar = new ZipFile(process.env.MC_JAR || fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));
  const result = extractModels(jar);
  const models = assertCompleteModels(result);
  const stats = testEntityGeometry({ models, jar });
  console.log(`1.13.2 geometry passed: ${Object.keys(models).length} jar models, ${stats.factories} factory variants, ${stats.frames} animation frames, ${stats.meshes} finite CPU meshes.`);
}
