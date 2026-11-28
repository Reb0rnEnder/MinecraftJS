// Native 26.3 spear behaviour: item components, spear input action and animation formulas.
// Sources: cache/port-26.3/client.jar (ItemUseAnimation, SwingAnimationType, AttackRange,
// KineticWeapon, PiercingWeapon, SpearAnimations, ServerboundPlayerActionPacket).
import test from 'node:test';
import assert from 'node:assert/strict';
import {Items} from '../client/js/game/items.js';
import {ITEM_DEFAULTS_26_3} from '../client/js/net/item-defaults-26.3.js';
import {
  spearUseParams, spearSwingProgress, spearThirdPersonAttackArm, spearThirdPersonHandUse,
  spearFirstPersonUse, spearFirstPersonAttack, spearThirdPersonAttackItem, spearThirdPersonUseItem
} from '../client/js/render/spear-animations-26.3.js';
import {C} from '../client/js/net/packets.js';
import {PLAY_SERVERBOUND_26_3 as OUT} from '../client/js/net/protocol-26.3-ids.js';
import {Reader26_3} from '../client/js/net/configuration-26.3.js';

const items = new Items({data: {items: []}});
const itemId = name => ITEM_DEFAULTS_26_3.items.findIndex(entry => entry.name === name);
const stack = name => ({version: '26.3', itemId: itemId(name)});

test('all seven 26.3 spears use the native kinetic/piercing components', () => {
  const spears = ITEM_DEFAULTS_26_3.items.filter(entry => entry.name.endsWith('_spear'));
  assert.deepEqual(spears.map(entry => entry.name), [
    'wooden_spear', 'stone_spear', 'copper_spear', 'iron_spear',
    'golden_spear', 'diamond_spear', 'netherite_spear'
  ]);
  for (const entry of spears) {
    const item = {version: '26.3', itemId: ITEM_DEFAULTS_26_3.items.indexOf(entry)};
    assert.equal(items.useAction(item), 'spear', entry.name);
    assert.deepEqual(items.attackAnimation(item), {type: 'stab', duration: entry.defaults.attack_animation.duration});
    assert.equal(items.minimumAttackCharge(item), 1);
    const range = items.attackRange(item);
    assert.deepEqual(range, {
      minReach: 2, maxReach: 4.5, minCreativeReach: 2,
      maxCreativeReach: 6.5, hitboxMargin: 0.125, mobFactor: 0.5
    });
    assert.equal(items.kineticWeapon(item).delayTicks, entry.defaults.kinetic_weapon.delay_ticks);
    assert.equal(items.piercingWeapon(item).sound, entry.defaults.piercing_weapon.sound.replace(/^minecraft:/, ''));
  }
  assert.deepEqual(items.attackAnimation(null), {type: 'whack', duration: 6});
  assert.equal(items.piercingWeapon(stack('stick')), null);
});

test('STAB uses the native player_action id and the native action ordinal', () => {
  const r = new Reader26_3(C.stab(7));
  assert.equal(r.varint(), OUT.player_action);
  assert.equal(r.varint(), 8);
  assert.deepEqual([r.i64(), r.u8()], [0n, 0]);
  assert.equal(r.varint(), 7);
  assert.equal(r.remaining(), 0);
});

test('spear animation phases follow SpearAnimations formulas', () => {
  const kinetic = items.kineticWeapon(stack('diamond_spear'));
  const params = spearUseParams(kinetic, kinetic.delayTicks);
  assert.equal(params.raiseProgress, 1);
  assert.equal(params.raiseProgressStart, 1);
  assert.equal(params.swayProgress, 0);
  const early = spearUseParams(kinetic, 0);
  assert.equal(early.raiseProgress, 0);
  const swing = spearSwingProgress(0.1);
  assert.equal(swing.prepare, 1);
  assert.ok(swing.attack > 0 && swing.retract === 0);

  const parts = {
    body: {ry: 0.3},
    rightArm: {rx: 0, ry: 0, rz: 0},
    leftArm: {rx: 0, ry: 0, rz: 0}
  };
  spearThirdPersonAttackArm(parts, 0.1, 1);
  assert.equal(parts.rightArm.ry, -0.3);
  assert.equal(parts.leftArm.ry, -0.3);
  assert.ok(parts.leftArm.rx < 0);
  assert.notEqual(parts.rightArm.rx, 0);

  const arm = {rx: 0, ry: 0, rz: 0}, head = {rx: 0.2, ry: 0.4};
  spearThirdPersonHandUse(arm, head, 1, kinetic, 10, {});
  assert.ok(arm.rx < -1 && arm.rx > -1.5);
  assert.ok(Math.abs(arm.ry - 0.3) < 1e-9);
});

test('spear pose matrices stay finite through use and attack', async () => {
  const {mat4} = await import('../client/js/gfx/math.js');
  const kinetic = items.kineticWeapon(stack('wooden_spear'));
  for (const time of [0, 1, 10, 60, 200, 300]) {
    const m = mat4.create();
    spearFirstPersonUse(m, kinetic, time, 1, 0);
    assert.ok(m.every(Number.isFinite), `firstPersonUse ${time}`);
    const u = mat4.create();
    spearThirdPersonUseItem(u, kinetic, time, 1, 0, 0.3);
    assert.ok(u.every(Number.isFinite), `thirdPersonUseItem ${time}`);
  }
  for (const attack of [0, 0.05, 0.1, 0.4, 1]) {
    const m = mat4.create();
    spearFirstPersonAttack(m, attack, 1);
    assert.ok(m.every(Number.isFinite), `firstPersonAttack ${attack}`);
    const a = mat4.create();
    spearThirdPersonAttackItem(a, kinetic, attack);
    assert.ok(a.every(Number.isFinite), `thirdPersonAttackItem ${attack}`);
  }
});
