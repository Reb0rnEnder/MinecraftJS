// Native identities must survive beyond spawn dispatch into creative picking and sound.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ZipFile } from '../lib/zip.js';
import { parseClass } from '../lib/classfile.js';
import { ENTITY_TYPES } from '../client/js/game/entity-types.js';
import { EntityManager } from '../client/js/game/entities.js';
import { SoundManager } from '../client/js/audio/sound.js';
import { Interaction, pickBlockItem } from '../client/js/game/interaction.js';
import { Items } from '../client/js/game/items.js';
import { copy } from '../client/js/game/container.js';
import { Reader } from '../client/js/net/buffer.js';
import { initBlocks, findState, blocksByName } from '../client/js/world/blocks.js';

const data = Object.fromEntries(['blocks', 'blockCollisionShapes', 'items', 'creative', 'enchantments'].map(name =>
  [name, JSON.parse(readFileSync(new URL('../client/data/' + name + '.json', import.meta.url)))]));
initBlocks(data.blocks, data.blockCollisionShapes);
const jar = new ZipFile(process.env.MC_JAR || fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));
// sounds.json is an indexed asset, not a jar entry. Audit sound identifiers from
// the jar's actual SoundEvents constants instead of depending on a prior build.
const sounds = new Set();
for (const path of jar.list('').filter(p => /^[^/]+\.class$/.test(p))) {
  const raw = jar.read(path);
  if (raw.includes('entity.pig.hurt') && raw.includes('entity.phantom.hurt') && raw.includes('block.note_block.harp')) {
    for (const name of parseClass(raw).strings) sounds.add(name);
  }
}
assert.ok(sounds.size > 500, 'found native sound-event registry');
function game() {
  const g = { assets: { data }, heldSlot: 0, gameMode: 1, player: {}, sent: [],
    inventory: { main: Array(36).fill(null) }, send(bytes) { this.sent.push(bytes); },
    selectSlot(slot) { this.heldSlot = slot; }, particles: {} };
  g.items = new Items(g.assets);
  g.interaction = new Interaction(g);
  return g;
}
const stack = (g, name) => ({ id: g.items.byName.get(name).id, count: 1, damage: 0 });

test('creative entity picking uses canonical eggs, cart/boat variants and native item IDs on the wire', () => {
  const g = game();
  const cases = [
    [{ kind: 'mob', entityName: 'pig', entityType: 51, type: 90 }, 'pig_spawn_egg'],
    [{ kind: 'mob', entityName: 'parrot', entityType: 50, type: 'parrot' }, 'parrot_spawn_egg'],
    [{ kind: 'mob', entityName: 'phantom', entityType: 90, type: 'phantom' }, 'phantom_spawn_egg'],
    [{ kind: 'minecart', entityName: 'chest_minecart', entityType: 10 }, 'chest_minecart'],
    [{ kind: 'boat', boatType: 5, entityType: 1 }, 'dark_oak_boat'],
    [{ kind: 'painting' }, 'painting'], [{ kind: 'itemframe' }, 'item_frame'],
    [{ kind: 'armorstand' }, 'armor_stand'], [{ kind: 'crystal' }, 'end_crystal'],
  ];
  for (const [entity, name] of cases) {
    g.inventory.main.fill(null); g.sent.length = 0;
    g.interaction.target = { type: 'entity', entity }; g.interaction.middleClick();
    assert.equal(g.items.name(g.inventory.main[g.heldSlot]?.id), name);
    const r = new Reader(g.sent[0]);
    assert.equal(r.varint(), 0x24); assert.equal(r.i16(), 36 + g.heldSlot);
    assert.equal(g.items.name(r.slot().id), name); assert.equal(r.remaining(), 0);
  }
  g.inventory.main.fill(null); g.sent.length = 0;
  g.interaction.target = { type: 'entity', entity: { kind: 'mob', entityName: 'ender_dragon' } };
  g.interaction.middleClick(); assert.equal(g.sent.length, 0, 'no invented dragon egg item');
  const item = { ...stack(g, 'filled_map'), nbt: { t: 10, name: '', v: { map: { t: 3, v: 42 } } } };
  g.interaction.target = { type: 'entity', entity: { kind: 'itemframe', item } };
  g.interaction.middleClick();
  assert.deepEqual(g.inventory.main[g.heldSlot], { ...item, nbtRaw: undefined });
  assert.notEqual(g.inventory.main[g.heldSlot].nbt, item.nbt, 'independent item-frame copy');
});

test('pick-block resolves direct states by name; placement never treats item IDs as block IDs', () => {
  const g = game();
  for (const [name, props, itemName] of [
    ['stone', {}, 'stone'], ['oak_planks', {}, 'oak_planks'], ['oak_log', { axis: 'y' }, 'oak_log'],
    ['red_wool', {}, 'red_wool'], ['blue_stained_glass', {}, 'blue_stained_glass'],
    ['stone_slab', { type: 'double' }, 'stone_slab'], ['skeleton_wall_skull', {}, 'skeleton_skull'],
    ['red_wall_banner', {}, 'red_banner'], ['potted_fern', {}, 'fern'], ['redstone_wire', {}, 'redstone'],
    ['wheat', { age: 7 }, 'wheat_seeds'], ['piston_head', { type: 'sticky' }, 'sticky_piston'],
    ['wall_sign', {}, 'sign'], ['tall_seagrass', {}, 'seagrass'],
  ]) {
    const state = findState(name, props); assert.ok(state, name + ' fixture exists');
    const item = pickBlockItem(state, g);
    assert.equal(g.items.name(item?.id), itemName, name); assert.equal(item.damage, 0);
  }
  assert.equal(pickBlockItem(findState('water'), g), null);
  assert.equal(pickBlockItem(0, g), null);
  for (const name of ['oak_planks', 'blue_stained_glass', 'prismarine_brick_slab', 'carved_pumpkin']) {
    assert.equal(g.interaction._placedBlock(stack(g, name))?.name, name);
  }
  assert.equal(g.interaction._placedBlock(stack(g, 'redstone'))?.name, 'redstone_wire');
  assert.equal(g.interaction._placedBlock(stack(g, 'string'))?.name, 'tripwire');
  assert.equal(g.interaction._placedBlock(stack(g, 'pig_spawn_egg')), null);
});

test('mob hurt/death sounds and categories follow native identities, not old numeric collisions', () => {
  const s = Object.create(SoundManager.prototype);
  for (const def of ENTITY_TYPES.filter(d => d.mob)) {
    const e = { entityName: def.name, entityType: def.id, kind: 'mob' };
    for (const event of s._mobSounds(e)) assert.ok(sounds.has(event), `${def.name}: jar sound ${event}`);
  }
  const pig = { entityName: 'pig', entityType: 51, type: 90, kind: 'mob' };
  assert.deepEqual(s._mobSounds(pig), ['entity.pig.hurt', 'entity.pig.death']);
  assert.equal(s._mobCategory(pig), 'neutral');
  assert.deepEqual(s._mobSounds({ entityName: 'ender_dragon' }), ['entity.ender_dragon.hurt', 'entity.ender_dragon.death']);
  assert.deepEqual(s._mobSounds({ entityName: 'pufferfish' }), ['entity.puffer_fish.hurt', 'entity.puffer_fish.death']);
  for (const name of ['phantom', 'drowned', 'evoker', 'enderman']) assert.equal(s._mobCategory({ entityName: name }), 'hostile');
  assert.deepEqual(s._mobSounds({ entityName: 'magma_cube', size: 1 }), ['entity.magma_cube.hurt_small', 'entity.magma_cube.death_small']);
  s.play = () => assert.fail('silent entity played a sound');
  s.playEntityHurt({ ...pig, silent: true }); s.playEntityDeath({ ...pig, silent: true });
});

test('block-action sound uses registry IDs; block-break event uses direct states', () => {
  const s = Object.create(SoundManager.prototype), calls = [];
  s.game = { particles: {}, world:{getState:()=>findState('note_block',{instrument:'guitar',note:'16',powered:'false'})} }; s.play = (...args) => calls.push(args);
  s.onBlockAction({ blockId: blocksByName.note_block.id, byte1: 0, byte2: 12, location: { x: 1, y: 2, z: 3 } });
  assert.equal(calls[0][0], 'block.note_block.guitar'); assert.equal(calls[0][5],Math.pow(2,4/12)); assert.ok(sounds.has(calls[0][0]));
  s.playBlockBreak = (...args) => calls.push(args);
  const state = findState('blue_stained_glass');
  s.onWorldEvent({ effectId: 2001, data: state, location: { x: 1, y: 2, z: 3 } });
  assert.deepEqual(calls[1], [1, 2, 3, state]);
});

test('entity interactions recognize native tools and new horse-family identities', () => {
  const g = game(), manager = new EntityManager(g);
  for (const [entityName, tool] of [['cow', 'bucket'], ['sheep', 'shears'], ['pig', 'name_tag'], ['pig', 'lead'], ['llama', null]]) {
    assert.equal(manager.isInteractive({ kind: 'mob', entityName }, tool ? stack(g, tool) : null), true, entityName + '/' + tool);
  }
  assert.equal(manager.isInteractive({ kind: 'mob', entityName: 'cow' }, stack(g, 'stone')), false);
});

test('stack copies isolate nested typed NBT, long arrays and raw buffers', () => {
  const source = { id: 1, count: 3, damage: 0, nbt: { t: 10, name: '', v: {
    longs: { t: 12, v: new BigInt64Array([9007199254740993n]) },
    nested: { t: 10, v: { Name: { t: 8, v: 'Original' } } },
  } }, nbtRaw: new Uint8Array([10, 0, 0, 0]) };
  const clone = copy(source); assert.deepEqual(clone, source);
  clone.nbt.v.longs.v[0] = -1n; clone.nbt.v.nested.v.Name.v = 'Changed'; clone.nbtRaw[0] = 0;
  assert.equal(source.nbt.v.longs.v[0], 9007199254740993n);
  assert.equal(source.nbt.v.nested.v.Name.v, 'Original'); assert.equal(source.nbtRaw[0], 10);
});
