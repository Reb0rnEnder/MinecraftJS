// AbstractContainerMenu.doClick SWAP (hotbar 0-8 or offhand 40) and ItemInHandRenderer re-equip behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ContainerScreen } from '../client/js/gui/screens/containers.js';
import { Inventory, stackable, stackMatchesForSwapAnimation } from '../client/js/game/container.js';
import { Interaction } from '../client/js/game/interaction.js';

const items = {
  maxStack: () => 64,
  name: () => 'stone',
  component: (item, type) => item?.componentPatch?.added?.find((entry) => entry.type === type)?.data,
  components: (item) => Object.fromEntries((item?.componentPatch?.added || []).map(({ type, data }) => [type, data]))
};

const stack = (id, count = 1, damage, extra = {}) => {
  const added = [
    ...(damage === undefined ? [] : [{ type: 'damage', data: damage }]),
    ...Object.entries(extra).map(([type, data]) => ({ type, data }))
  ];
  return { id, count, damage: damage ?? 0, ...(added.length ? { componentPatch: { added, removed: [] } } : {}) };
};

function game() {
  const sent = [];
  const game = {
    sent,
    items,
    send: (packet) => sent.push(packet),
    player: { creative: false },
    effects: { get: () => null },
    settings: { keys: { inventory: 'KeyE', swapHands: 'KeyF', drop: 'KeyQ' } },
    inventory: null
  };
  game.inventory = new Inventory(game);
  return game;
}

test('button 40 swaps a hovered inventory slot with the offhand in both directions', () => {
  const gameState = game();
  const inventory = gameState.inventory;
  inventory.main[12] = stack(5, 10);
  inventory.offhand = stack(7, 3);
  const slot = inventory.slots.findIndex((entry) => entry.playerIndex === 12);

  inventory.slotClick(slot, 40, 2);
  assert.deepEqual([inventory.main[12].id, inventory.offhand.id], [7, 5]);

  inventory.offhand = null;
  inventory.slotClick(slot, 40, 2);
  assert.equal(inventory.main[12], null);
  assert.equal(inventory.offhand.id, 7);

  inventory.slotClick(slot, 40, 2);
  assert.equal(inventory.main[12].id, 7);
  assert.equal(inventory.offhand, null);
});

test('the swap-hands key clicks the hovered container slot with button 40', () => {
  const gameState = game();
  const inventory = gameState.inventory;
  const calls = [];
  const screen = Object.create(ContainerScreen.prototype);
  Object.assign(screen, {
    game: gameState,
    container: inventory,
    hovered: 36,
    handleClick: (...args) => calls.push(args),
    fields: []
  });

  assert.equal(screen.key({ code: 'KeyF' }), true);
  assert.deepEqual(calls, [[36, 36, 40, 2]]);
});

test('client-item hand_animation_on_swap can suppress an otherwise required hand swap animation', () => {
  const gameState = game();
  gameState.assets = { itemModels: { stone: { hand_animation_on_swap: false } } };
  gameState.inventory.main[0] = stack(5, 1, undefined, { item_model: 'minecraft:stone' });
  gameState.heldSlot = 0;
  const interaction = Object.create(Interaction.prototype);
  Object.assign(interaction, {
    game: gameState,
    equipProgress: 1,
    equipProgressOff: 1,
    cooledAttackStrength: () => 1
  });

  interaction.updateEquip();
  assert.equal(interaction.equipProgress, 1);
  gameState.inventory.main[0] = stack(5, 1, undefined, { item_model: 'minecraft:stone', repair_cost: 2 });
  interaction.updateEquip();
  assert.equal(interaction.equipProgress, 1);
  assert.equal(interaction.shownHandStacks()[0].componentPatch.added.some((entry) => entry.type === 'repair_cost'), true);
});

test('hands keep the old rendered stacks while re-equipping a changed component stack', () => {
  const gameState = game();
  const inventory = gameState.inventory;
  inventory.main[0] = stack(5, 10, 7);
  inventory.offhand = stack(7, 1);
  gameState.heldSlot = 0;

  const interaction = Object.create(Interaction.prototype);
  Object.assign(interaction, {
    game: gameState,
    equipProgress: 1,
    equipProgressOff: 1,
    cooledAttackStrength: () => 1
  });

  for (let tick = 0; tick < 10; tick++) interaction.updateEquip();
  assert.equal(interaction.equipProgressOff, 1);
  assert.equal(stackable(inventory.main[0], stack(5, 2, 7)), true);
  assert.equal(stackable(inventory.main[0], stack(5, 2, 8)), false);
  assert.equal(stackMatchesForSwapAnimation(inventory.main[0], stack(5, 10, 8)), true, 'damage is ignored for re-equip');
  assert.equal(stackMatchesForSwapAnimation(inventory.main[0], stack(5, 10, 7, { repair_cost: 1 })), false, 'other components still trigger re-equip');
  assert.equal(stackMatchesForSwapAnimation(inventory.main[0], stack(5, 9, 7)), false, 'count changes trigger re-equip');

  // A count change to the same object is an in-place use/eat update, not a re-equip.
  inventory.main[0].count--;
  interaction.updateEquip();
  assert.equal(interaction.equipProgress, 1);

  // A damage-only replacement does not animate, even though damage matters for stacking.
  inventory.main[0] = stack(5, 9, 8);
  interaction.updateEquip();
  assert.equal(interaction.equipProgress, 1);

  // A non-ignored component change in each hand lowers both and keeps the old copies visible.
  inventory.main[0] = stack(5, 1, 8, { repair_cost: 1 });
  inventory.offhand = stack(5, 10, 7);
  interaction.updateEquip();
  assert.ok(interaction.equipProgress < 1 && interaction.equipProgressOff < 1);
  assert.deepEqual(interaction.shownHandStacks().map((item) => item.id), [5, 7]);
  assert.equal(interaction.shownHandStacks()[0].componentPatch.added.find((entry) => entry.type === 'damage').data, 8);

  for (let tick = 0; tick < 6; tick++) interaction.updateEquip();
  assert.deepEqual(interaction.shownHandStacks().map((item) => item.id), [5, 5]);
  assert.equal(interaction.shownHandStacks()[0].componentPatch.added.find((entry) => entry.type === 'repair_cost').data, 1);
  assert.equal(interaction.equipProgressOff, 1);
});
