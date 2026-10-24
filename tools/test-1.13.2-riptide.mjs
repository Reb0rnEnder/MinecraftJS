import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ZipFile } from '../lib/zip.js';
import { Jvm, JObject } from '../lib/jvm.js';
import { Interaction } from '../client/js/game/interaction.js';
import { Items } from '../client/js/game/items.js';
import { LocalPlayer, mcSin, mcCos } from '../client/js/game/physics.js';
import { nbt } from '../client/js/net/nbt.js';
import { Reader } from '../client/js/net/buffer.js';
import { initBlocks } from '../client/js/world/blocks.js';
import { initBiomes } from '../client/js/world/biomes.js';
import { World } from '../client/js/world/world.js';
import { Chunk } from '../client/js/world/chunk.js';
import { findState } from '../client/js/world/blocks.js';
const data = n => JSON.parse(readFileSync(new URL('../client/data/' + n + '.json', import.meta.url)));
initBlocks(data('blocks'), data('blockCollisionShapes')); initBiomes(data('biomes'));
const jar = new ZipFile(fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));
function fixture(level = 3) {
  const items = new Items({ data: { items: data('items'), creative: data('creative') } });
  const stack = { id: items.byName.get('trident').id, count: 1, nbt: nbt.compound({ Enchantments: nbt.list(10, level ? [{ id: nbt.string('minecraft:riptide'), lvl: nbt.short(level) }] : []) }) };
  const player = new LocalPlayer(); player.setPosition(8.5, 64, 8.5);
  const world = new World();
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
    const c = new Chunk(x, z, true); c.biomes.fill(1); world.chunks.set(World.key(x, z), c);
  }
  const chunk = world.getChunk(0, 0);
  const sent = [], sounds = [];
  const g = { items, player, world, gameMode: 0, food: 20, cooldownFraction: () => 0,
    inventory: { getHand: () => stack }, send: p => sent.push(p), sound: { playAtPlayer: (...v) => sounds.push(v) } };
  return { g, player, world, chunk, stack, sent, sounds, it: new Interaction(g) };
}

test('Riptide charges only when wet and releases into a boost without losing the enchanted stack', () => {
  for (const hand of [0, 1]) {
    const { g, player, stack, it, sent, sounds } = fixture();
    assert.equal(it.sendUseItem(stack, hand), false, 'dry Riptide cannot start charging');
    player.inWater = true;
    assert.equal(it.sendUseItem(stack, hand), true); assert.equal(it.activeHand, hand);
    it.useTicks = 10; it.stopUsingItem();
    const release = new Reader(sent.at(-1)); assert.equal(release.varint(), 0x18); assert.equal(release.varint(), 5);
    assert.equal(player.motionZ, 3, 'Riptide III adds three blocks per tick facing forward');
    assert.equal(player.riptideTicks, 20); assert.equal(player.usingItem, false);
    assert.equal(g.inventory.getHand(hand), stack); assert.equal(stack.count, 1);
    assert.deepEqual(sounds, [['item.trident.riptide_3', 1, 1]]);
    const initial = player.z;
    player.tick(g.world, {});
    assert.ok(player.z > initial + 2, 'normal movement consumes the impulse on the next tick');
    assert.equal(player.height, Math.fround(0.6), 'Riptide uses the low spin hitbox');
    assert.equal(player.eyeHeight(), Math.fround(0.4));
    for (let i = 0; i < 19; i++) player.tick(g.world, {});
    assert.equal(player.riptideTicks, 0); assert.equal(player.riptide, false);
    assert.equal(player.height, Math.fround(1.8), 'standing hitbox returns after the spin');
  }
});

test('short charges, leaving water before release, broken stacks and normal throwing remain distinct', () => {
  const f = fixture(); f.player.inWater = true;
  assert.ok(f.it.sendUseItem(f.stack)); f.it.useTicks = 9; f.it.stopUsingItem();
  assert.equal(f.sent.length, 2, 'short release still informs the server'); assert.equal(f.player.motionZ, 0);
  assert.ok(f.it.sendUseItem(f.stack)); f.it.useTicks = 10; f.player.inWater = false; f.it.stopUsingItem();
  assert.equal(f.player.motionZ, 0, 'wetness is checked again at release');
  f.stack.nbt = nbt.compound({ Damage: nbt.int(250), Enchantments: nbt.list(10, [{ id: nbt.string('minecraft:riptide'), lvl: nbt.short(3) }]) });
  f.player.inWater = true; assert.equal(f.it.sendUseItem(f.stack), false);
  const normal = fixture(0);
  normal.stack.nbt = nbt.compound({ Enchantments: nbt.list(10, [{ id: nbt.string('minecraft:loyalty'), lvl: nbt.short(3) }]) });
  assert.ok(normal.it.sendUseItem(normal.stack)); normal.it.useTicks = 10; normal.it.stopUsingItem();
  assert.equal(normal.sent.length, 2); assert.equal(normal.player.riptideTicks, 0);
  assert.equal(normal.player.motionZ, 0, 'projectile creation stays server authoritative');
});

test('rain permits Riptide only in exposed rainy biomes; ground launches respect ceilings', () => {
  const { it, stack, world, player, chunk } = fixture(); world.rainStrength = 1;
  assert.ok(it.sendUseItem(stack), 'exposed rain qualifies');
  chunk.setState(8, 66, 8, findState('stone'));
  assert.equal(world.isRainingAt(player.x, player.y, player.z), false, 'roof blocks rain');
  assert.equal(it.sendUseItem(stack), false);
  chunk.setState(8, 66, 8, 0);
  for (const name of ['desert', 'snowy_tundra']) {
    chunk.biomes.fill(data('biomes').find(b => b.name === name).id);
    assert.equal(it.sendUseItem(stack), false, name + ' has no rain');
  }
  chunk.biomes.fill(1); world.rainStrength = 0.2; assert.equal(it.sendUseItem(stack), false);
  world.rainStrength = 1; world.hasSky = false; assert.equal(it.sendUseItem(stack), false);
  world.hasSky = true;
  player.onGround = true; player.startRiptide(3, world);
  assert.ok(Math.abs(player.y - 65.19999992847443) < 1e-6, 'ground launch lifts by 1.2 through collisions');
  player.setPosition(8.5, 64, 8.5); player.onGround = true;
  chunk.setState(8, 66, 8, findState('stone'));
  player.startRiptide(3, world);
  assert.ok(player.bb()[4] <= 66, 'lift never teleports through a ceiling');
});

test('Riptide impulses match ItemTrident bytecode for every level and multiple aim directions', () => {
  let level, impulse;
  const vm = new Jvm(jar, { intercept: {
    'aun.c(Late;)I': () => 72000, 'awg.g(Late;)I': () => level, 'aog.ao()Z': () => 1,
    'wr.b(Ljava/lang/Object;)Lwp;': () => null, 'aog.b(Lwp;)V': () => {},
    'xq.a(F)F': ([v]) => mcSin(v), 'xq.b(F)F': ([v]) => mcCos(v), 'xq.c(F)F': ([v]) => Math.fround(Math.sqrt(v)),
    'aog.f(DDD)V': v => { impulse = v; }, 'aog.o(I)V': () => {}, 'axy.a(Laog;DDDLwi;Lwk;FF)V': () => {},
  } });
  vm.statics.set('ws', { 'ws.c': new JObject('wr') }); vm.statics.set('wj', {}); vm.statics.set('wk', {});
  const world = new JObject('axy'); world.fields['axy.B'] = 1;
  for (level of [1, 2, 3]) for (const [yaw, pitch] of [[0, 0], [90, 0], [40, -35], [-120, 65], [0, -90]]) {
    const p = new LocalPlayer(); p.yaw = yaw; p.pitch = pitch;
    p.motionX = 0.2; p.motionY = 0.3; p.motionZ = -0.1;
    const native = new JObject('aog'); native.fields['aer.w'] = yaw; native.fields['aer.x'] = pitch;
    vm.invoke('aun', 'a', '(Late;Laxy;Lafa;I)V', new JObject('aun'), [new JObject('ate'), world, native, 71990]);
    p.startRiptide(level, {});
    for (const [index, key, before] of [[0, 'motionX', 0.2], [1, 'motionY', 0.3], [2, 'motionZ', -0.1]]) {
      assert.ok(Math.abs(p[key] - before - impulse[index]) < 1e-6, `${level} ${yaw}/${pitch} ${key} matches jar`);
    }
  }
});
