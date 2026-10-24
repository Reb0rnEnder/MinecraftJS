import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { Reader, Writer } from '../client/js/net/buffer.js';
import { decodePacket } from '../client/js/net/packets.js';
import { writeNbtRoot, simplify } from '../client/js/net/nbt.js';
import { EntityManager } from '../client/js/game/entities.js';
import { ENTITY_TYPES, OBJECT_TYPES, MOB_FAMILIES, PAINTINGS } from '../client/js/game/entity-types.js';

const uuid = '12345678-1234-5678-9abc-123456789abc';
const pos = { x: -12, y: 73, z: -345 };
const pose = { pitch: 10, yaw: -20, roll: 30 };
const nbt = { t: 10, name: '', v: {
  id: { t: 8, v: 'minecraft:parrot' }, Variant: { t: 3, v: 4 },
  nested: { t: 10, v: { Name: { t: 8, v: '{"text":"A name"}' } } },
  longs: { t: 12, v: new BigInt64Array([1n, -2n]) },
} };
const slot = { id: 777, count: 2, nbt };
const packet = id => new Writer().varint(id);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

// Test-side protocol fixture writer, independent of the production metadata reader.
// The optional jar audit below checks every fixture's serializer against class inheritance.
function field(w, index, type, value) {
  w.u8(index).varint(type);
  switch (type) {
    case 0: return w.i8(value);
    case 1: case 11: case 13: return w.varint(value);
    case 2: return w.f32(value);
    case 3: case 4: return w.string(value);
    case 5: w.bool(value !== null); return value === null ? w : w.string(value);
    case 6: return w.slot(value);
    case 7: return w.bool(value);
    case 8: return w.f32(value.pitch).f32(value.yaw).f32(value.roll);
    case 9: return w.position(value.x, value.y, value.z);
    case 10: w.bool(value !== null); return value === null ? w : w.position(value.x, value.y, value.z);
    case 12: w.bool(value !== null); return value === null ? w : w.uuid(value);
    case 14: return writeNbtRoot(w, value);
    case 15:
      w.varint(value.particleId);
      if (value.particleId === 3 || value.particleId === 20) w.varint(value.data.blockState);
      else if (value.particleId === 11) w.f32(value.data.red).f32(value.data.green).f32(value.data.blue).f32(value.data.scale);
      else if (value.particleId === 27) w.slot(value.data.item);
      return w;
    default: throw new Error('Invalid test serializer');
  }
}
function metadata(w, fields = []) {
  for (const f of fields) field(w, ...f);
  return w.u8(0xff);
}
function mob(type, fields = [], id = 7) {
  return metadata(packet(0x03).varint(id).uuid(uuid).varint(type).f64(1.5).f64(64).f64(-3)
    .u8(64).u8(32).u8(128).i16(800).i16(-400).i16(1600), fields);
}
function object(type, data = 0, id = 7, velocity = [800, -400, 1600]) {
  return packet(0x00).varint(id).uuid(uuid).i8(type).f64(1).f64(64).f64(-3)
    .u8(32).u8(64).i32(data).i16(velocity[0]).i16(velocity[1]).i16(velocity[2]);
}
function player(fields = [], id = 7) {
  return metadata(packet(0x05).varint(id).uuid(uuid).f64(1).f64(64).f64(2).u8(0).u8(0), fields);
}
function harness() {
  const g = { entityId: -1, scoreboard: { players: new Map() }, entityRenderer: { remove() {} },
    player: { spectator: true, elytraFlying: false }, world: { getState: () => 0 },
    particles: { spark() {}, deathPoof() {} }, sound: { play() {}, playLoop: async () => null } };
  const em = new EntityManager(g);
  // Remote-entity tests do not synthesize a local player's inventory/rendering state.
  em.updateSelf = () => {};
  return em;
}
function deliver(em, w) {
  const p = decodePacket(w.build());
  assert.equal(p._extra, undefined, `${p.name} left bytes unread`);
  switch (p.name) {
    case 'spawn_entity_living': em.spawnMob(p); break;
    case 'spawn_entity': em.spawnObject(p); break;
    case 'named_entity_spawn': em.spawnPlayer(p); break;
    case 'spawn_entity_painting': em.spawnPainting(p); break;
    case 'spawn_entity_experience_orb': em.spawnXpOrb(p); break;
    case 'spawn_entity_weather': em.spawnLightning(p); break;
    case 'entity_metadata': em.setMetadata(p.entityId, p.metadata); break;
    case 'entity_equipment': em.setEquipment(p.entityId, p.slot, p.item); break;
    case 'entity_teleport': em.teleport(p); break;
    case 'entity_status': em.onStatus(p); break;
    default: assert.fail(`Unhandled test packet ${p.name}`);
  }
  return em.get(p.entityId);
}
const update = (em, fields, id = 7) => deliver(em, metadata(packet(0x3f).varint(id), fields));

// Wire IDs and internal selectors are deliberately literal, so shifted IDs cannot
// pass just by changing production constants and test fixtures together.
const families = [
  [10, 'creeper', 50], [62, 'skeleton', 51], [84, 'wither_skeleton', 51, { wither: true }],
  [71, 'stray', 51, { stray: true }], [69, 'spider', 52], [27, 'giant', 53],
  [87, 'zombie', 54], [30, 'husk', 54, { husk: true }], [89, 'zombie_villager', 54, { villagerZombie: true }],
  [64, 'slime', 55], [26, 'ghast', 56], [53, 'zombie_pigman', 57], [18, 'enderman', 58],
  [6, 'cave_spider', 59], [61, 'silverfish', 60], [4, 'blaze', 61], [38, 'magma_cube', 62],
  [17, 'ender_dragon', 63], [83, 'wither', 64], [3, 'bat', 65], [82, 'witch', 66],
  [19, 'endermite', 67], [28, 'guardian', 68], [15, 'elder_guardian', 68, { elder: true }], [59, 'shulker', 69],
  [51, 'pig', 90], [58, 'sheep', 91], [9, 'cow', 92], [7, 'chicken', 93], [70, 'squid', 94],
  [86, 'wolf', 95], [47, 'mooshroom', 96], [66, 'snow_golem', 97], [48, 'ocelot', 98], [80, 'iron_golem', 99],
  [29, 'horse', 100, { horseType: 0 }], [11, 'donkey', 100, { horseType: 1 }], [46, 'mule', 100, { horseType: 2 }],
  [88, 'zombie_horse', 100, { horseType: 3 }], [63, 'skeleton_horse', 100, { horseType: 4 }],
  [56, 'rabbit', 101], [79, 'villager', 120],
];
const newMobs = [[8, 'cod'], [12, 'dolphin'], [14, 'drowned'], [21, 'evoker'], [31, 'illusioner'],
  [36, 'llama'], [50, 'parrot'], [54, 'polar_bear'], [52, 'pufferfish'], [57, 'salmon'],
  [72, 'tropical_fish'], [73, 'turtle'], [78, 'vex'], [81, 'vindicator'], [90, 'phantom']];

test('every implemented family is selected by canonical identity, retaining its native ID', () => {
  const em = harness();
  assert.equal(Object.keys(MOB_FAMILIES).length, families.length);
  for (const [id, name, type, flags = {}] of families) {
    const e = deliver(em, mob(id));
    assert.equal(e.entityType, id); assert.equal(e.entityName, name); assert.equal(e.type, type);
    assert.equal(e.kind, 'mob'); assert.equal(e.uuid, uuid); assert.equal(e.entityNamespace, 'entity');
    for (const key of ['wither', 'stray', 'husk', 'villagerZombie', 'elder', 'horseType']) assert.equal(e[key], flags[key], `${name}.${key}`);
    near(e.motionX, 0.1); near(e.motionY, -0.05); near(e.motionZ, 0.2);
  }
  for (const [id, name] of newMobs) {
    const e = deliver(em, mob(id));
    assert.equal(e.entityName, name); assert.equal(e.type, name); assert.equal(e.kind, 'mob');
  }
});

test('names and visibility survive real spawn/metadata packets, including hologram stands', () => {
  const em = harness(), raw = '{"text":"Named mob","color":"gold"}';
  const e = deliver(em, mob(87, [[0, 0, 0], [2, 5, raw], [3, 7, true]]));
  assert.equal(e.customName, '§6Named mob§r'); assert.equal(e.metadata[2], raw);
  assert.equal(e.invisible, false); assert.equal(e.nameVisible, true);
  update(em, [[0, 0, 0xfb], [1, 1, 240], [4, 7, true], [5, 7, true]]);
  for (const k of ['onFire', 'sneaking', 'sprinting', 'swimming', 'invisible', 'glowing', 'elytraFlying', 'silent', 'noGravity']) assert.equal(e[k], true, k);
  assert.equal(e.air, 240); assert.equal(e.customName, '§6Named mob§r');
  update(em, [[2, 5, null], [3, 7, false], [0, 0, 0]]);
  assert.equal(e.customName, ''); assert.equal(e.nameVisible, false); assert.equal(e.invisible, false);
  const stand = deliver(em, mob(1, [[0, 0, 32], [2, 5, raw], [3, 7, true], [11, 0, 16], [12, 8, pose]]));
  assert.equal(stand.entityName, 'armor_stand'); assert.equal(stand.kind, 'armorstand');
  assert.equal(stand.invisible, true); assert.equal(stand.marker, true); assert.equal(stand.pickable, false);
  assert.equal(stand.width, 0); assert.equal(stand.height, 0); assert.deepEqual(stand.poses.head, pose);
  update(em, [[11, 0, 13], [17, 8, pose]]);
  assert.equal(stand.marker, false); assert.equal(stand.small, true); assert.equal(stand.showArms, true); assert.equal(stand.noBasePlate, true);
  assert.equal(stand.invisible, true); near(stand.width, 0.25); near(stand.height, 0.9875);
  assert.deepEqual(stand.poses.rightLeg, pose);
  update(em, [[11, 0, 0]]); near(stand.height, 1.975);
  const unknown = deliver(em, mob(1000, [[0, 0, 0], [2, 5, raw], [3, 7, true], [12, 7, true]]));
  assert.equal(unknown.entityType, 1000); assert.equal(unknown.entityName, null);
  assert.equal(unknown.kind, 'unknown_mob'); assert.equal(unknown.type, 'unknown:1000');
  assert.equal(unknown.child, undefined); assert.equal(unknown.invisible, false);
  assert.equal(unknown.width, 0); assert.equal(unknown.height, 0);
});

test('all 16 serializers stay aligned through EntityManager, including slot NBT and particle parameters', () => {
  const values = [-7, 300, 1.25, 'string', '{"text":"chat"}', '{"text":"optional"}', slot, true,
    pose, pos, pos, 5, uuid, 8191, nbt, { particleId: 27, data: { item: slot } }];
  const fields = values.map((v, type) => [32 + type, type, v]);
  const em = harness(), e = deliver(em, player(fields));
  for (let t = 0; t < 16; t++) {
    const actual = e.metadata[32 + t];
    if (t === 6) {
      assert.equal(actual.id, 777); assert.deepEqual(actual.nbt, nbt); assert.equal(actual.damage, 0);
      const r = new Reader(new Writer().slot(actual).build()); assert.deepEqual(r.slot(), actual); assert.equal(r.remaining(), 0);
    } else if (t === 15) assert.deepEqual(actual.data.item.nbt, nbt);
    else assert.deepEqual(actual, values[t], `serializer ${t}`);
  }
  const r = new Reader(metadata(new Writer(), fields).i32(0x12345678).build());
  r.metadata(); assert.equal(r.i32(), 0x12345678); assert.equal(r.remaining(), 0);
  update(em, [[2, 5, null], [32, 6, null], [33, 10, null], [34, 12, null], [35, 13, 0], [36, 14, null], [3, 7, true]]);
  assert.equal(e.customName, ''); assert.equal(e.nameVisible, true);
  for (const i of [32, 33, 34, 36]) assert.equal(e.metadata[i], null);
  assert.equal(e.metadata[35], 0);
  const shortSlot = update(em, [[37, 6, { id: 900, count: 1 }]]).metadata[37];
  assert.equal(shortSlot.nbt, null); assert.equal(shortSlot.nbtRaw, null);
  assert.throws(() => new Reader(new Writer().u8(0).varint(16).u8(0xff).build()).metadata(), /Unknown metadata type 16/);
  assert.throws(() => new Reader(new Writer().u8(9).varint(15).varint(11).f32(1).build()).metadata(), /underflow/);
});

test('every particle payload variant is consumed before the next metadata field', () => {
  const em = harness(); deliver(em, object(3));
  const particles = [{ particleId: 0, data: {} }, { particleId: 3, data: { blockState: 8191 } },
    { particleId: 20, data: { blockState: 1234 } }, { particleId: 11, data: { red: 0.5, green: 0.25, blue: 1, scale: 2 } },
    { particleId: 27, data: { item: slot } }, { particleId: 27, data: { item: null } }];
  for (const p of particles) {
    const e = update(em, [[9, 15, p], [6, 2, 2.5], [7, 1, 0xaabbcc], [8, 7, true], [2, 5, '{"text":"Cloud"}'], [3, 7, true]]);
    assert.equal(e.particle.particleId, p.particleId); assert.equal(e.customName, 'Cloud'); assert.equal(e.nameVisible, true);
    if (p.particleId !== 27 || p.data.item === null) assert.deepEqual(e.particle, p);
    else assert.deepEqual(e.particle.data.item.nbt, nbt);
    assert.equal(e.radius, 2.5); assert.equal(e.width, 5); assert.equal(e.height, 0.5); assert.equal(e.singlePoint, true);
  }
});

test('player base parameters, shoulder NBT and equipment slots decode without shifting skin/hand flags', () => {
  const em = harness(), e = deliver(em, player([[6, 0, 7], [7, 2, 18], [8, 1, 0x112233], [9, 7, true], [10, 1, 3],
    [11, 2, 4], [12, 1, 100], [13, 0, 127], [14, 0, 0], [15, 14, nbt], [16, 14, { t: 10, name: '', v: {} }]]));
  assert.equal(e.entityName, 'player'); assert.equal(e.usingItem, true); assert.equal(e.activeHand, 1); assert.equal(e.riptide, true);
  assert.equal(e.health, 18); assert.equal(e.potionColor, 0x112233); assert.equal(e.potionAmbient, true); assert.equal(e.arrowCount, 3);
  assert.equal(e.absorption, 4); assert.equal(e.score, 100); assert.equal(e.skinFlags, 127); assert.equal(e.mainHand, 0);
  assert.equal(simplify(e.leftShoulder).id, 'minecraft:parrot'); assert.deepEqual(simplify(e.rightShoulder), {});
  deliver(em, packet(0x42).varint(7).varint(1).slot(slot)); assert.equal(e.offhand.id, 777);
  deliver(em, packet(0x42).varint(7).varint(5).slot(slot)); assert.equal(e.equipment[4].id, 777);
  deliver(em, packet(0x42).varint(7).varint(1).slot(null)); assert.equal(e.offhand, null);
  update(em, [[7, 2, 0]]); assert.equal(e.dead, true);
});

// Explicit variant fixtures cover all metadata-bearing mob subclasses, not only
// the ones the old renderer happened to draw. Also checked against jar serializers.
const variants = [
  [3, 'bat', [[12, 0, 1]], { hanging: true }],
  [4, 'blaze', [[12, 0, 1]], { blazeOnFire: true }],
  [10, 'creeper', [[12, 1, 1], [13, 7, true], [14, 7, true]], { creeperState: 1, powered: true, ignited: true }],
  [62, 'skeleton', [[12, 7, true]], { armsRaised: true }], [71, 'stray', [[12, 7, true]], { armsRaised: true }],
  [84, 'wither_skeleton', [[12, 7, true]], { armsRaised: true }],
  [69, 'spider', [[12, 0, 1]], { climbing: true }], [6, 'cave_spider', [[12, 0, 1]], { climbing: true }],
  [64, 'slime', [[12, 1, 4]], { size: 4 }], [38, 'magma_cube', [[12, 1, 2]], { size: 2 }],
  [18, 'enderman', [[12, 13, 8191], [13, 7, true]], { carriedBlockState: 8191, carried: 8191, screaming: true }],
  [17, 'ender_dragon', [[12, 1, 3]], { dragonPhase: 3 }], [26, 'ghast', [[12, 7, true]], { attacking: true }],
  [28, 'guardian', [[12, 7, true], [13, 1, 99]], { guardianMoving: true, guardianTarget: 99 }],
  [15, 'elder_guardian', [[12, 7, false], [13, 1, 22]], { guardianMoving: false, guardianTarget: 22 }],
  [59, 'shulker', [[12, 11, 4], [13, 10, pos], [14, 0, 100], [15, 0, 2]], { attachFace: 4, attachPosition: pos, peekTick: 100, shulkerColor: 2 }],
  [83, 'wither', [[12, 1, 10], [13, 1, 11], [14, 1, 12], [15, 1, 100]], { witherTargets: [10, 11, 12], invulTime: 100 }],
  [82, 'witch', [[12, 7, true]], { witchAggressive: true }],
  [21, 'evoker', [[12, 0, 1], [13, 0, 2]], { armsRaised: true, spell: 2 }],
  [31, 'illusioner', [[12, 0, 1], [13, 0, 4]], { armsRaised: true, spell: 4 }],
  [81, 'vindicator', [[12, 0, 1]], { armsRaised: true }], [78, 'vex', [[12, 0, 1]], { charging: true }],
  [51, 'pig', [[12, 7, true], [13, 7, true], [14, 1, 30]], { child: true, saddled: true, boostTime: 30 }],
  [58, 'sheep', [[12, 7, false], [13, 0, 30]], { child: false, fleece: 14, sheared: true }],
  [86, 'wolf', [[12, 7, true], [13, 0, 7], [14, 12, uuid], [15, 2, 8], [16, 7, true], [17, 1, 14]],
    { child: true, sitting: true, angry: true, tamed: true, ownerUuid: uuid, wolfHealth: 8, begging: true, collar: 14 }],
  [48, 'ocelot', [[12, 7, false], [13, 0, 5], [14, 12, uuid], [15, 1, 3]], { child: false, sitting: true, tamed: true, catType: 3 }],
  [50, 'parrot', [[12, 7, false], [13, 0, 5], [14, 12, uuid], [15, 1, 4]], { sitting: true, tamed: true, parrotVariant: 4 }],
  [56, 'rabbit', [[13, 1, 99]], { rabbitType: 99 }], [79, 'villager', [[12, 7, true], [13, 1, 3]], { child: true, profession: 3 }],
  [29, 'horse', [[12, 7, false], [13, 0, 126], [14, 12, uuid], [15, 1, 1026], [16, 1, 3]],
    { horseType: 0, horseFlags: 230, horseBred: true, horseVariant: 1026, horseArmor: 3, ownerUuid: uuid }],
  [11, 'donkey', [[13, 0, 6], [14, 12, null], [15, 7, true]], { horseType: 1, horseChest: true, horseFlags: 14, ownerUuid: null }],
  [46, 'mule', [[13, 0, 6], [15, 7, true]], { horseType: 2, horseChest: true, horseFlags: 14 }],
  [63, 'skeleton_horse', [[12, 7, true], [13, 0, 6]], { horseType: 4, child: true, horseFlags: 6 }],
  [88, 'zombie_horse', [[12, 7, false], [13, 0, 6]], { horseType: 3, child: false, horseFlags: 6 }],
  [36, 'llama', [[12, 7, false], [13, 0, 2], [14, 12, uuid], [15, 7, true], [16, 1, 4], [17, 1, 5], [18, 1, 2]],
    { horseChest: true, horseFlags: 10, llamaStrength: 4, llamaCarpet: 5, llamaVariant: 2 }],
  [54, 'polar_bear', [[12, 7, false], [13, 7, true]], { child: false, standing: true }],
  [66, 'snow_golem', [[12, 0, 16]], { hasPumpkin: true }], [80, 'iron_golem', [[12, 0, 1]], { playerCreated: true }],
  [12, 'dolphin', [[12, 9, pos], [13, 7, true], [14, 1, 200]], { treasurePosition: pos, gotFish: true, moistness: 200 }],
  [73, 'turtle', [[12, 7, true], [13, 9, pos], [14, 7, true], [15, 7, true], [16, 9, pos], [17, 7, true], [18, 7, false]],
    { child: true, homePosition: pos, hasEgg: true, layingEgg: true, travelPosition: pos, goingHome: true, travelling: false }],
  [8, 'cod', [[12, 7, true]], { fromBucket: true }], [57, 'salmon', [[12, 7, true]], { fromBucket: true }],
  [52, 'pufferfish', [[12, 7, true], [13, 1, 2]], { fromBucket: true, puffState: 2 }],
  [72, 'tropical_fish', [[12, 7, true], [13, 1, 0x03040501]], { fromBucket: true, fishVariant: 0x03040501 }],
  [90, 'phantom', [[12, 1, 5]], { phantomSize: 5 }],
  ...[[87, 'zombie'], [30, 'husk'], [53, 'zombie_pigman'], [14, 'drowned']].map(([id, name]) =>
    [id, name, [[12, 7, true], [13, 1, 0], [14, 7, true], [15, 7, true]], { child: true, armsRaised: true, convertingToDrowned: true }]),
  [89, 'zombie_villager', [[12, 7, true], [13, 1, 0], [14, 7, true], [15, 7, false], [16, 7, true], [17, 1, 4]],
    { child: true, armsRaised: true, convertingToDrowned: false, converting: true, villagerProfession: 4 }],
];

test('all metadata-bearing mob variants dispatch to their own class fields', () => {
  for (const [id, name, fields, expected] of variants) {
    const em = harness(), e = deliver(em, mob(id, [[11, 0, 3], ...fields]));
    assert.equal(e.entityName, name); assert.equal(e.noAI, true); assert.equal(e.leftHanded, true);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(e[key], value, `${name}.${key}`);
    // Every subtype's data survives later unrelated updates.
    update(em, [[2, 5, '{"text":"Still here"}']]);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(e[key], value, `${name}.${key} after delta`);
    if (['guardian', 'elder_guardian', 'ghast', 'cod', 'salmon', 'pufferfish', 'tropical_fish', 'witch', 'skeleton', 'stray', 'wither_skeleton'].includes(name)) assert.equal(e.child, undefined, name);
  }
});

test('variant state changes resize hitboxes and clear nullable fields without damaging identity', () => {
  const em = harness();
  const z = deliver(em, mob(89, [[12, 7, true], [16, 7, true], [17, 1, 4]]));
  near(z.height, 0.975); near(z.eyeHeight, 0.93);
  update(em, [[16, 7, false]]); assert.equal(z.villagerProfession, 4); assert.equal(z.converting, false);
  update(em, [[12, 7, false]]); near(z.height, 1.95);
  const enderman = deliver(em, mob(18, [[12, 13, 8191]]));
  update(em, [[12, 13, 0]]); assert.equal(enderman.carriedBlockState, 0); assert.equal(enderman.carried, 0);
  const shulker = deliver(em, mob(59, [[13, 10, pos]]));
  update(em, [[13, 10, null]]); assert.equal(shulker.attachPosition, null);
  const donkey = deliver(em, mob(11, [[13, 0, 6], [15, 7, true]]));
  update(em, [[15, 7, false]]); assert.equal(donkey.horseFlags, 6);
  update(em, [[13, 0, 0]]); assert.equal(donkey.horseFlags, 0);
  const fish = deliver(em, mob(52, [[13, 1, 0]])); near(fish.width, 0.35);
  update(em, [[13, 1, 1]]); near(fish.width, 0.49);
  update(em, [[13, 1, 2]]); near(fish.width, 0.7);
  const phantom = deliver(em, mob(90, [[12, 1, 5]])); near(phantom.width, 1.9); near(phantom.height, 1);
  const slime = deliver(em, mob(64, [[12, 1, 4]])); near(slime.width, 2.0400002);
  const turtle = deliver(em, mob(73, [[12, 7, true]])); near(turtle.width, 0.36); near(turtle.height, 0.12);
  update(em, [[12, 7, false]]); near(turtle.width, 1.2);
});

const objectCases = [
  [1, 'boat', 'boat', 1.375, 0.5625], [2, 'item', 'item', 0.25, 0.25], [3, 'area_effect_cloud', 'area_effect_cloud', 6, 0.5],
  [10, 'minecart', 'minecart', 0.98, 0.7], [50, 'tnt', 'tnt', 0.98, 0.98], [51, 'end_crystal', 'crystal', 2, 2],
  [60, 'arrow', 'arrow', 0.5, 0.5], [61, 'snowball', 'projectile', 0.25, 0.25], [62, 'egg', 'projectile', 0.25, 0.25],
  [63, 'fireball', 'projectile', 1, 1], [64, 'small_fireball', 'projectile', 0.3125, 0.3125], [65, 'ender_pearl', 'projectile', 0.25, 0.25],
  [66, 'wither_skull', 'projectile', 0.3125, 0.3125], [67, 'shulker_bullet', 'shulker_bullet', 0.3125, 0.3125],
  [68, 'llama_spit', 'llama_spit', 0.25, 0.25], [70, 'falling_block', 'falling', 0.98, 0.98],
  [71, 'item_frame', 'itemframe', 0.5, 0.5], [72, 'eye_of_ender', 'projectile', 0.25, 0.25],
  [73, 'potion', 'projectile', 0.25, 0.25], [75, 'experience_bottle', 'projectile', 0.25, 0.25],
  [76, 'firework_rocket', 'projectile', 0.25, 0.25], [77, 'leash_knot', 'leash', 0.375, 0.5],
  [78, 'armor_stand', 'armorstand', 0.5, 1.975], [79, 'evoker_fangs', 'evoker_fangs', 0.5, 0.8],
  [90, 'fishing_bobber', 'fishhook', 0.25, 0.25], [91, 'spectral_arrow', 'spectral_arrow', 0.5, 0.5],
  [93, 'dragon_fireball', 'dragon_fireball', 1, 1], [94, 'trident', 'trident', 0.5, 0.5],
];

test('the separate object namespace dispatches every protocol-404 object with correct dimensions', () => {
  const em = harness();
  for (const [id, name, kind, width, height] of objectCases) {
    const e = deliver(em, object(id));
    assert.equal(e.entityType, id); assert.equal(e.type, id); assert.equal(e.entityName, name); assert.equal(e.kind, kind);
    assert.equal(e.entityNamespace, 'object'); assert.equal(e.uuid, uuid); near(e.width, width); near(e.height, height);
    update(em, [[2, 5, '{"text":"Object name"}'], [0, 0, 32], [3, 7, true]]);
    assert.equal(e.customName, 'Object name'); assert.equal(e.invisible, true); assert.equal(e.nameVisible, true);
  }
  assert.equal(deliver(em, mob(1)).kind, 'armorstand'); assert.equal(deliver(em, object(1)).kind, 'boat');
  assert.equal(deliver(em, mob(50)).entityName, 'parrot'); assert.equal(deliver(em, object(50)).kind, 'tnt');
  const unknown = deliver(em, object(99)); assert.equal(unknown.kind, 'unknown_object'); assert.equal(unknown.entityName, null);
  assert.equal(unknown.pickable, false);
});

test('object payloads keep direct states, subtype data, six-direction frames and constructor motion', () => {
  const em = harness(), falling = deliver(em, object(70, 8191));
  assert.equal(falling.blockState, 8191); assert.equal(falling.objectData, 8191); assert.equal(falling.motionX, 0);
  update(em, [[6, 9, pos]]); assert.deepEqual(falling.origin, pos);
  for (const id of [60, 91, 94]) {
    const e = deliver(em, object(id, 43)); assert.equal(e.owner, 42); near(e.motionX, 0.1);
    update(em, [[6, 0, 1], [7, 12, uuid], ...(id === 60 ? [[8, 1, 0x123456]] : id === 94 ? [[8, 0, 3]] : [])]);
    assert.equal(e.critical, true); assert.equal(e.ownerUuid, uuid);
    if (id === 60) assert.equal(e.arrowColor, 0x123456);
    if (id === 94) assert.equal(e.loyalty, 3);
  }
  for (const id of [67, 68]) near(deliver(em, object(id, 0)).motionZ, 0.2);
  for (const id of [63, 64, 66, 93]) {
    const e = deliver(em, object(id, 0, 7, [800, 0, 0])); assert.equal(e.motionX, 0); near(e.accelX, 0.1);
  }
  for (const face of [0, 1, 2, 3, 4, 5]) {
    const e = deliver(em, object(71, face)); assert.equal(e.facing, face); assert.equal(e.motionX, 0);
    const size = e.box.slice(3).map((v, i) => v - e.box[i]);
    assert.deepEqual(size, face < 2 ? [0.75, 0.0625, 0.75] : face < 4 ? [0.75, 0.75, 0.0625] : [0.0625, 0.75, 0.75]);
  }
  const hook = deliver(em, object(90, 42)); assert.equal(hook.owner, 42); assert.equal(hook.motionX, 0);
  update(em, [[6, 1, 100]]); assert.equal(hook.hookedEntityId, 99);
  update(em, [[6, 1, 0]]); assert.equal(hook.hookedEntityId, -1);
});

test('boat, cart, crystal, item, potion, firework, skull and standalone stand metadata', () => {
  const em = harness(), boat = deliver(em, object(1));
  update(em, [[6, 1, 10], [7, 1, -1], [8, 2, 3.5], [9, 1, 5], [10, 7, true], [11, 7, false], [12, 1, 60]]);
  assert.deepEqual([boat.timeSinceHit, boat.forwardDirection, boat.damageTaken, boat.boatType, boat.paddleLeft, boat.paddleRight, boat.bubbleTime], [10, -1, 3.5, 5, true, false, 60]);
  const names = ['minecart', 'chest_minecart', 'furnace_minecart', 'tnt_minecart', 'spawner_minecart', 'hopper_minecart', 'command_block_minecart'];
  names.forEach((name, type) => {
    const e = deliver(em, object(10, type)); assert.equal(e.entityName, name); assert.equal(e.cartType, type); assert.equal(e.entityType, 10);
    update(em, [[6, 1, 2], [7, 1, -1], [8, 2, 4.5], [9, 1, 8191], [10, 1, 7], [11, 7, true]]);
    assert.equal(e.displayBlock, 8191); assert.equal(e.customDisplay, true); assert.equal(e.displayOffset, 7);
    if (type === 2) { update(em, [[12, 7, true]]); assert.equal(e.furnacePowered, true); }
    if (type === 6) { update(em, [[12, 3, 'say hello'], [13, 4, '{"text":"done"}']]); assert.equal(e.command, 'say hello'); assert.equal(e.lastOutput, '{"text":"done"}'); }
  });
  const crystal = deliver(em, object(51)); update(em, [[6, 10, pos], [7, 7, false]]);
  assert.deepEqual(crystal.beamTarget, pos); assert.equal(crystal.showBottom, false);
  update(em, [[6, 10, null]]); assert.equal(crystal.beamTarget, null);
  for (const id of [2, 71, 73, 76]) {
    const e = deliver(em, object(id)); update(em, [[6, 6, slot]]); assert.equal(e.item.id, 777);
    update(em, [[6, 6, null]]); assert.equal(e.item, null);
  }
  const frame = deliver(em, object(71)); update(em, [[7, 1, 5]]); update(em, [[2, 5, null]]); assert.equal(frame.rotation, 5);
  const rocket = deliver(em, object(76)); update(em, [[7, 1, 42]]); assert.equal(rocket.boostedId, 42);
  const skull = deliver(em, object(66)); update(em, [[6, 7, true]]); assert.equal(skull.invulnerable, true);
  const stand = deliver(em, object(78)); update(em, [[0, 0, 32], [11, 0, 16], [15, 8, pose]]);
  assert.equal(stand.kind, 'armorstand'); assert.equal(stand.entityName, 'armor_stand'); assert.equal(stand.entityType, 78);
  assert.equal(stand.marker, true); assert.equal(stand.invisible, true); assert.deepEqual(stand.poses.rightArm, pose);
});

test('painting motive VarInt is translated for the atlas, including its location and bounds', () => {
  const em = harness();
  for (const [motive, name, title, width, height] of [[0, 'kebab', 'Kebab', 1, 1], [18, 'skull_and_roses', 'SkullAndRoses', 2, 2], [25, 'donkey_kong', 'DonkeyKong', 4, 3]]) {
    const e = deliver(em, packet(0x04).varint(7).uuid(uuid).varint(motive).position(-12, 73, -345).u8(2));
    assert.equal(e.paintingId, motive); assert.equal(e.paintingName, name); assert.equal(e.title, title);
    assert.deepEqual(e.blockPos, pos); assert.equal(e.facing, 2); assert.equal(e.width, width); assert.equal(e.height, height);
    near(e.box[3] - e.box[0], width); near(e.box[4] - e.box[1], height); near(e.box[5] - e.box[2], 1 / 16);
  }
  assert.equal(deliver(em, packet(0x01).varint(7).f64(1).f64(2).f64(3).i16(5)).entityName, 'experience_orb');
  const bolt = deliver(em, packet(0x02).varint(7).i8(1).f64(1).f64(2).f64(3));
  assert.equal(bolt.entityName, 'lightning_bolt'); assert.equal(bolt.entityType, 1);
});

test('ticking and boat passenger offsets use canonical identity instead of colliding wire IDs', () => {
  const em = harness();
  const spider = deliver(em, mob(69, [[12, 0, 1]], 1));
  const shulker = deliver(em, mob(59, [[14, 0, 100]], 2));
  const horse = deliver(em, mob(63, [], 3));
  const dragon = deliver(em, mob(17, [], 4));
  const rocket = deliver(em, object(76, 0, 5));
  const tnt = deliver(em, object(50, 0, 6)); update(em, [[6, 1, 2]], 6);
  em.tick();
  assert.equal(spider.peek, undefined); near(shulker.peek, 0.05); near(Math.abs(shulker.bodyYaw), 180);
  assert.equal(horse.ring, undefined); assert.equal(dragon.parts.length, 7); assert.equal(tnt.fuse, 1); assert.ok(rocket.y > 64);
  update(em, [[2, 5, '{"text":"TNT"}']], 6); assert.equal(tnt.fuse, 1);
  em.tick(); assert.equal(tnt.fuse, 0); em.tick(); assert.equal(tnt.fuse, 0);
  const boat = deliver(em, object(1, 0, 10)); boat.passengerList = [11, 12];
  deliver(em, mob(51, [], 11)); deliver(em, mob(62, [], 12));
  const pig = em.riderPos(boat, 11, 'mob'), skeleton = em.riderPos(boat, 12, 'mob');
  near(Math.hypot(pig[0] - boat.x, pig[2] - boat.z), 0.4);
  near(Math.hypot(skeleton[0] - boat.x, skeleton[2] - boat.z), 0.6);
  for (const [id, kind] of [[67, 'shulker_bullet'], [68, 'llama_spit'], [91, 'spectral_arrow'], [94, 'trident']]) {
    const e = deliver(em, object(id, 1)); assert.equal(e.kind, kind);
    deliver(em, packet(0x50).varint(7).f64(20).f64(70).f64(30).u8(0).u8(0).bool(false));
    assert.equal(e.inc, 1); em.tick(); assert.equal(e.x, 20); assert.equal(e.y, 70);
  }
});

test('JSON registry and runtime tables agree on both distinct namespaces', () => {
  const data = JSON.parse(readFileSync(new URL('../client/data/entities.json', import.meta.url)));
  const mobs = data.filter(e => e.type === 'mob'), objects = data.filter(e => e.type === 'object');
  assert.equal(mobs.length, 95); assert.equal(objects.length, 28);
  assert.deepEqual(mobs.map(e => [e.id, e.name, e.width, e.height]), ENTITY_TYPES.map(e => [e.id, e.name, e.width, e.height]));
  assert.deepEqual(objects.map(e => [e.id, e.name, e.width, e.height]), Object.values(OBJECT_TYPES).map(e => [e.id, e.name, e.width, e.height]));
  for (const e of objects) assert.equal(mobs[e.internalId].name, e.name);
});

test('fangs wait for their status packet and expose the actual attack animation lifetime', () => {
  const em = harness(), e = deliver(em, object(79));
  em.tick(); assert.equal(e.fangsActive, false); assert.equal(e.fangsLife, 22); assert.equal(e.fangsProgress, 0);
  deliver(em, packet(0x1c).i32(7).i8(4)); assert.equal(e.fangsActive, true);
  em.tick(); assert.equal(e.fangsLife, 21); near(e.fangsProgress, 0.05); assert.equal(e.prevFangsProgress, 0);
  for (let i = 0; i < 19; i++) em.tick();
  assert.equal(e.fangsLife, 2); assert.equal(e.fangsProgress, 1);
  const evoker = deliver(em, mob(21)); deliver(em, packet(0x1c).i32(7).i8(4));
  assert.equal(evoker.fangsActive, undefined);
});

const jarPath = new URL('../cache/1.13.2.jar', import.meta.url);
test('pinned Mojang jar independently verifies the registry, serializers, inheritance and painting order', { skip: !existsSync(jarPath) }, () => {
  const require = createRequire(import.meta.url);
  const { ZipFile } = require('../lib/zip.js'), { parseClass } = require('../lib/classfile.js'), { walk } = require('../lib/bytecode.js');
  assert.equal(createHash('sha1').update(readFileSync(jarPath)).digest('hex'), '30bfe37a8db404db11c7edf02cb5165817afb4d9');
  const jar = new ZipFile(jarPath.pathname), classes = new Map();
  const cls = name => { if (!classes.has(name)) classes.set(name, parseClass(jar.read(name + '.class'))); return classes.get(name); };
  const ops = (c, m) => [...walk(m.code)].map(i => ({ ...i,
    constant: [18, 19, 20].includes(i.op) ? c.constant(i.op === 18 ? i.u1 : i.u2) : null,
    ref: i.op >= 178 && i.op <= 185 ? c.ref(i.u2) : null,
  }));
  const registry = [], c = cls('aev'); let name, entityClass;
  for (const i of ops(c, c.methods.find(m => m.name === '<clinit>'))) {
    if (i.constant?.type === 'string') name = i.constant.value;
    if (i.constant?.type === 'class') entityClass = i.constant.value;
    if (i.op === 179 && i.ref.desc === 'Laev;') registry.push({ name, cls: entityClass });
  }
  assert.deepEqual(ENTITY_TYPES.map(e => e.name), registry.map(e => e.name));
  const ot = cls('ot'), serializers = {};
  for (const i of ops(ot, ot.methods.find(m => m.name === '<clinit>'))) {
    if (i.op === 178 && i.ref.owner === 'ot') serializers[i.ref.name] = Object.keys(serializers).length;
  }
  assert.equal(Object.keys(serializers).length, 16); assert.equal(serializers.p, 14); assert.equal(serializers.j, 15);
  function schema(c) {
    const result = c.superName === 'java/lang/Object' ? [] : schema(cls(c.superName));
    const clinit = c.methods.find(m => m.name === '<clinit>'); let type;
    if (clinit) for (const i of ops(c, clinit)) {
      if (i.op === 178 && i.ref.owner === 'ot') type = serializers[i.ref.name];
      if (i.op === 179 && i.ref.desc === 'Lor;') result.push(type);
    }
    return result;
  }
  assert.deepEqual(schema(cls('aer')), [0, 1, 5, 7, 7, 7]);
  assert.deepEqual(schema(cls('aog')), [0, 1, 5, 7, 7, 7, 0, 2, 1, 7, 1, 2, 1, 0, 0, 14, 14]);
  assert.deepEqual(schema(cls('alz')), [0, 1, 5, 7, 7, 7, 0, 2, 1, 7, 1, 0, 8, 8, 8, 8, 8, 8]);
  assert.deepEqual(schema(cls('aep')), [0, 1, 5, 7, 7, 7, 2, 1, 7, 15]);
  for (const [id, name, fields] of variants) {
    assert.equal(registry[id].name, name);
    const types = schema(cls(registry[id].cls));
    for (const [index, type] of fields) assert.equal(type, types[index], `${name} index ${index} uses jar serializer ${types[index]}`);
  }
  // The entire jar inheritance chain decides which native IDs may be living mobs.
  for (const [id, entry] of registry.entries()) {
    let c = cls(entry.cls), livingMob = false;
    while (c.name !== 'aer') { if (c.name === 'afb') livingMob = true; c = cls(c.superName); }
    assert.equal(ENTITY_TYPES[id].mob, livingMob, entry.name);
  }
  const art = cls('amd');
  assert.deepEqual(PAINTINGS.map(p => p[0]), ops(art, art.methods.find(m => m.name === '<clinit>')).filter(i => i.constant?.type === 'string').map(i => i.constant.value));
});
