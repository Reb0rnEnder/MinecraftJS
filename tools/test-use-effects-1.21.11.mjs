// Pinned 1.21.11: UseEffects.DEFAULT = (false, true, 0.2F).
// Native LocalPlayer (cache/port-1.21.11/cfr-client/hnh.java): T/U at
// 430-435, modifyInput at 575-581, sprint eligibility at 957-958.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LocalPlayer } from '../client/js/game/physics.js';
import { Items } from '../client/js/game/items.js';
import { Inventory } from '../client/js/game/container.js';
import { Interaction } from '../client/js/game/interaction.js';
import { BlockPrediction762 } from '../client/js/game/block-prediction-1.19.4.js';
import { World } from '../client/js/world/world.js';
import { Chunk } from '../client/js/world/chunk.js';
import { initBlocks, blocksByName } from '../client/js/world/blocks.js';
import { createItemStack774, readSlot774, writeSlot774 } from '../client/js/net/item-components-1.21.11.js';
import { Reader, Writer } from '../client/js/net/buffer.js';

const json = (name) => JSON.parse(readFileSync(new URL('../client/data/' + name + '.json', import.meta.url)));
initBlocks(json('blocks'), json('blockCollisionShapes'));
const items = new Items({ data: { items: json('items'), enchantments: json('enchantments') } });
const f32 = Math.fround;
const scaled = (speed) => f32(f32(0.98) * f32(speed));
const stack = (name, effects, removed = false) => createItemStack774(items.byName.get(name).id, 1, {
  added: effects === undefined ? [] : [{ type: 'use_effects', data: effects }],
  removed: removed ? ['use_effects'] : []
});
const wireStack = (name, effects) => readSlot774(new Reader(writeSlot774(new Writer(), stack(name, effects)).build()));

function fixture(main = stack('iron_spear'), offhand = stack('shield'), hand = 0) {
  const world = new World(), chunk = new Chunk(0, 0, true, world);
  world.chunks.set('0,0', chunk);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) chunk.setState(x, 0, z, blocksByName.stone.defaultState);
  const player = new LocalPlayer();
  player.setPosition(5.5, 1, 5.5);
  player.onGround = true;
  const game = { player, world, items, heldSlot: 0, gameMode: 0, food: 0, send() {}, cooldownFraction: () => 0 };
  game.inventory = new Inventory(game);
  game.inventory.main[0] = main;
  game.inventory.offhand = offhand;
  game.interaction = new Interaction(game);
  world.prediction = new BlockPrediction762(game);
  player.usingItem = true;
  game.interaction.activeHand = hand;
  // Capture the actual travel input while still running real world collisions.
  const travel = player.moveEntityWithHeading;
  player.moveEntityWithHeading = function (w, strafe, forward) {
    this.travelInput = [strafe, forward];
    return travel.call(this, w, strafe, forward);
  };
  const tick = (input = {}) => player.tick(world, { forward: true, ...input });
  return { player, game, world, tick };
}

test('all default spears allow full-speed use and sprint; food/shield retain native defaults', () => {
  for (const material of ['wooden', 'stone', 'copper', 'iron', 'golden', 'diamond', 'netherite']) {
    const item = stack(material + '_spear');
    assert.equal(items.component(item, 'use_effects').can_sprint, true);
    assert.equal(items.component(item, 'use_effects').speed_multiplier, 1);
    const { player, tick } = fixture(item);
    tick({ sprint: true, left: true });
    assert.equal(player.sprinting, true, material);
    assert.deepEqual(player.travelInput, [scaled(1), scaled(1)], material);
  }
  for (const name of ['apple', 'shield']) {
    const { player, tick } = fixture(stack(name));
    player.sprintToggleTimer = 5;
    tick({ sprint: true, left: true });
    assert.equal(player.sprinting, false, name);
    assert.equal(player.sprintToggleTimer, 0, name);
    assert.deepEqual(player.travelInput, [scaled(0.2), scaled(0.2)], name);
  }
});

test('active offhand, not the selected main hand, controls use speed and sprint', () => {
  const { player, game, tick } = fixture(stack('iron_spear'), stack('shield'));
  player.usingItem = false;
  assert.equal(game.interaction.sendUseItem(game.inventory.offhand, 1), true);
  assert.equal(game.interaction.activeHand, 1);
  tick({ sprint: true });
  assert.equal(player.sprinting, false);
  assert.equal(player.travelInput[1], scaled(0.2));
  game.inventory.offhand = stack('iron_spear');
  game.inventory.main[0] = stack('shield');
  tick({ sprint: true });
  assert.equal(player.sprinting, true);
  assert.equal(player.travelInput[1], scaled(1));
});

test('decoded wire patches replace defaults and sprint permission is independent of speed', () => {
  for (const speed of [0, 0.25, 0.37, 1]) {
    const item = wireStack('apple', { can_sprint: true, interact_vibrations: false, speed_multiplier: speed });
    assert.equal(items.component(item, 'use_effects').speed_multiplier, f32(speed));
    const { player, tick } = fixture(item);
    player.sprintToggleTimer = 5;
    tick({ sprint: true, right: true });
    assert.equal(player.sprinting, true, 'can sprint even with low/zero use speed');
    assert.equal(player.sprintToggleTimer, 4, 'permitted use does not clear double-tap timer');
    assert.deepEqual(player.travelInput, [-scaled(speed), scaled(speed)]);
  }
  const { player, tick } = fixture(wireStack('iron_spear', { can_sprint: false, interact_vibrations: true, speed_multiplier: 1 }));
  tick({ sprint: true });
  assert.equal(player.sprinting, false, 'false patch overrides spear default true');
  assert.equal(player.travelInput[1], scaled(1));
});

test('empty, partial and removed components use field defaults, not spear defaults', () => {
  for (const item of [stack('iron_spear', {}), stack('iron_spear', undefined, true), null]) {
    const { player, tick } = fixture(item);
    tick({ sprint: true });
    assert.equal(player.sprinting, false);
    assert.equal(player.travelInput[1], scaled(0.2));
  }
  const sprintOnly = fixture(stack('iron_spear', { can_sprint: true }));
  sprintOnly.tick({ sprint: true });
  assert.equal(sprintOnly.player.sprinting, true);
  assert.equal(sprintOnly.player.travelInput[1], scaled(0.2));
  const speedOnly = fixture(stack('iron_spear', { speed_multiplier: 1 }));
  speedOnly.tick({ sprint: true });
  assert.equal(speedOnly.player.sprinting, false);
  assert.equal(speedOnly.player.travelInput[1], scaled(1));
});

test('locally-created and unmaterialized patched stacks use the existing effective component reader', () => {
  const id = items.byName.get('iron_spear').id;
  for (const [item, sprint, speed] of [
    [{ id, count: 1 }, true, 1],
    [{ id, count: 1, componentPatch: { added: [], removed: ['use_effects'] } }, false, 0.2],
    [{ id, count: 1, componentPatch: { added: [{ type: 'use_effects', data: { speed_multiplier: 0 } }], removed: [] } }, false, 0]
  ]) {
    const { player, tick } = fixture(item);
    tick({ sprint: true });
    assert.equal(player.sprinting, sprint);
    assert.equal(player.travelInput[1], scaled(speed));
  }
});

test('permitted item use preserves double-tap sprint; ordinary hunger/blindness restrictions remain', () => {
  const { player, tick } = fixture();
  tick();
  assert.equal(player.sprintToggleTimer, 7);
  tick({ forward: false });
  tick();
  assert.equal(player.sprinting, true);
  for (const restriction of [{ food: 6 }, { blind: true }]) {
    const f = fixture();
    Object.assign(f.player, restriction);
    f.tick({ sprint: true });
    assert.equal(f.player.sprinting, false);
  }
});

test('use restrictions gate starting sprint, not an existing sprint with raw forward input', () => {
  const { player, tick } = fixture(stack('shield'));
  player.sprinting = true;
  tick();
  assert.equal(player.sprinting, true, 'native stop-sprint checks do not use item speed/permission');
  assert.equal(player.travelInput[1], scaled(0.2));
});

test('stopped use, riding, ownerless physics and non-player bodies do not leak active-hand effects', () => {
  const idle = fixture(stack('shield'));
  idle.player.usingItem = false;
  idle.tick({ sprint: true });
  assert.equal(idle.player.sprinting, true);
  assert.equal(idle.player.travelInput[1], scaled(1));
  const riding = fixture(stack('shield'));
  riding.player.ridingEntity = {};
  riding.tick();
  assert.equal(riding.player.travelInput[1], scaled(1), 'riders skip use slowdown');
  for (const otherOwner of [null, new LocalPlayer()]) {
    const f = fixture();
    if (otherOwner) f.game.player = otherOwner;
    else delete f.world.prediction;
    f.tick({ sprint: true });
    assert.equal(f.player.sprinting, false);
    assert.equal(f.player.travelInput[1], scaled(0.2), 'missing use context retains native defaults');
  }
});
