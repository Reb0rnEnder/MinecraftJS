// 1.21.11 LivingEntity.getJumpPower / jumpFromGround and calculateFallDamage: attribute-driven jump power (no jump,
// not even the sprint boost, at <= 1e-5) and fall damage from safe_fall_distance, which already carries Jump Boost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initBlocks, blocksByName } from '../client/js/world/blocks.js';
import { World } from '../client/js/world/world.js';
import { Chunk } from '../client/js/world/chunk.js';
import { LocalPlayer } from '../client/js/game/physics.js';

const json = (n) => JSON.parse(readFileSync(new URL('../client/data/' + n + '.json', import.meta.url), 'utf8'));
initBlocks(json('blocks'), json('blockCollisionShapes'));
function floor() {
  const world = new World(), chunk = new Chunk(0, 0, true, world);
  world.chunks.set('0,0', chunk);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) chunk.setState(x, 0, z, blocksByName.stone.defaultState);
  return world;
}

test('jump power is jump_strength * block factor + 0.1 * (Jump Boost level), and nothing happens at zero', () => {
  const world = floor(), p = new LocalPlayer();
  p.setPosition(5.5, 1, 5.5);
  p.jumpStrength = 0.6;
  p.jumpBoost = 1;
  p.jump(world);
  assert.equal(p.motionY, Math.fround(Math.fround(0.6) + Math.fround(0.2)));
  const z = new LocalPlayer();
  z.setPosition(5.5, 1, 5.5);
  z.jumpStrength = 0;
  z.sprinting = true;
  z.yaw = 90;
  z.motionX = z.motionY = z.motionZ = 0;
  z.jump(world);
  assert.deepEqual([z.motionX, z.motionY, z.motionZ], [0, 0, 0], 'no jump and no sprint boost');
});

test('fall damage subtracts safe_fall_distance only (Jump Boost arrives as its modifier)', () => {
  for (const [safe, boost, expected] of [[3, -1, 7], [5, 1, 5], [3, 1, 7]]) {
    const world = floor(), p = new LocalPlayer();
    p.setPosition(5.5, 1.2, 5.5);
    let damage = 0;
    p.onFall = (d) => { damage = d; };
    p.safeFallDistance = safe;
    p.jumpBoost = boost;
    p.fallDistance = 10;
    p.moveEntity(world, 0, -0.5, 0);
    assert.equal(damage, expected, `safe ${safe} boost ${boost}`);
  }
});

test('LivingEntity.getEffectiveGravity: Slow Falling caps the gravity attribute at 0.01 while falling, on land too', () => {
  const step = (gravity, slow, motionY) => {
    const world = floor(), p = new LocalPlayer();
    p.setPosition(5.5, 10, 5.5);
    p.gravity = gravity;
    p.slowFalling = slow;
    p.motionY = motionY;
    p.motionX = p.motionZ = 0;
    p._moveWithHeading(world, 0, 0, 0.02);
    return p.motionY;
  };
  const drag = 0.98;
  assert.ok(Math.abs(step(0.08, true, -0.2) - (-0.2 - 0.01) * drag) < 1e-6, 'slow falling');
  assert.ok(Math.abs(step(0.005, true, -0.2) - (-0.2 - 0.005) * drag) < 1e-6, 'a lower gravity attribute stays');
  assert.ok(Math.abs(step(0.08, true, 0.2) - (0.2 - 0.08) * drag) < 1e-6, 'rising is not capped');
  assert.ok(Math.abs(step(0.16, false, -0.2) - (-0.2 - 0.16) * drag) < 1e-6, 'gravity attribute');
});

test('Slow Falling and Levitation clear the fall distance every tick', () => {
  for (const [slow, lev] of [[true, -1], [false, 0]]) {
    const world = floor(), p = new LocalPlayer();
    p.setPosition(5.5, 10, 5.5);
    p.slowFalling = slow;
    p.levitation = lev;
    p.fallDistance = 12;
    p.motionY = -0.3;
    p._moveWithHeading(world, 0, 0, 0.02);
    assert.ok(p.fallDistance < 0.5, `only this tick's drop remains: ${p.fallDistance}`);
  }
});
