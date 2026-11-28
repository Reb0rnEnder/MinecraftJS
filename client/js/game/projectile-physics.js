// Native client-side movement (1.13+, as in 1.20.6) of non-living projectiles between server updates (the client runs the same
// tick() as the server for these): ThrowableProjectile, AbstractArrow / ThrownTrident, LlamaSpit,
// AbstractHurtingProjectile (fireballs, wither skulls, wind charges), ShulkerBullet, PrimedTnt and ExperienceOrb.
// Position packets snap them (Entity.lerpTo = setPos), velocity packets replace the motion (lerpMotion).
import { calcXOffset, calcYOffset, calcZOffset } from './physics.js';
import { getBlock, getStateProperties } from '../world/blocks.js';

const f32 = Math.fround;
// getDefaultGravity
const THROWABLE_GRAVITY = { potion: 0.05, experience_bottle: 0.07 }; // snowball, egg, ender_pearl: 0.03
export const THROWABLES = new Set(['snowball', 'egg', 'ender_pearl', 'potion', 'experience_bottle']);
export const ARROWS = new Set(['arrow', 'spectral_arrow', 'trident']);
export const HURTING = new Set(['fireball', 'small_fireball', 'dragon_fireball', 'wither_skull', 'wind_charge', 'breeze_wind_charge']);

// Entity.isInWater, by the fluid at the entity's block
function inWater(e, world) {
  const st = world.getState(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)), b = getBlock(st);
  return !!b && (b.name === 'water' || b.name === 'bubble_column' || getStateProperties(st)?.waterlogged === 'true');
}

// Entity.move(SELF) with block collisions for a box of `width` x `height`; sets onGround and zeroes blocked axes
function collideMove(e, world, width, height) {
  let dx = e.motionX, dy = e.motionY, dz = e.motionZ;
  const half = width / 2, bb = [e.x - half, e.y, e.z - half, e.x + half, e.y + height, e.z + half];
  const swept = [bb[0] + Math.min(0, dx), bb[1] + Math.min(0, dy), bb[2] + Math.min(0, dz), bb[3] + Math.max(0, dx), bb[4] + Math.max(0, dy), bb[5] + Math.max(0, dz)];
  const boxes = world.getCollisions(swept, e);
  for (const box of boxes) dy = calcYOffset(box, bb, dy); bb[1] += dy; bb[4] += dy;
  const zFirst = Math.abs(dx) < Math.abs(dz);
  if (zFirst) { for (const box of boxes) dz = calcZOffset(box, bb, dz); bb[2] += dz; bb[5] += dz; }
  for (const box of boxes) dx = calcXOffset(box, bb, dx); bb[0] += dx; bb[3] += dx;
  if (!zFirst) { for (const box of boxes) dz = calcZOffset(box, bb, dz); bb[2] += dz; bb[5] += dz; }
  e.x = (bb[0] + bb[3]) / 2; e.y = bb[1]; e.z = (bb[2] + bb[5]) / 2;
  e.onGround = dy !== e.motionY && e.motionY < 0;
  if (dx !== e.motionX) e.motionX = 0; if (dy !== e.motionY) e.motionY = 0; if (dz !== e.motionZ) e.motionZ = 0;
}

// Projectile.updateRotation: rotations ease 0.2 of the way toward the motion's direction (yaw atan2(x, z))
function lerpRotation(prev, cur) { while (cur - prev < -180) prev -= 360; while (cur - prev >= 180) prev += 360; return prev + 0.2 * (cur - prev); }
function updateRotation(e, v, reverse = false) {
  const h = Math.hypot(v[0], v[2]);
  e.pitch = f32(lerpRotation(e.pitch || 0, f32(Math.atan2(v[1], h) * 57.2957763671875)));
  e.yaw = f32(lerpRotation(e.yaw || 0, f32((reverse ? Math.atan2(-v[0], -v[2]) : Math.atan2(v[0], v[2])) * 57.2957763671875)));
}

// ThrowableProjectile.tick: move by the old motion, then motion * 0.99 (0.8 in water), then gravity. A client-side
// hit changes nothing for these; the server removes them.
function tickThrowable(e, world) {
  const v = [e.motionX, e.motionY, e.motionZ];
  updateRotation(e, v);
  const drag = inWater(e, world) ? 0.8 : f32(0.99);
  e.motionX = v[0] * drag; e.motionY = v[1] * drag; e.motionZ = v[2] * drag;
  if (!e.noGravity) e.motionY -= THROWABLE_GRAVITY[e.entityName] ?? 0.03;
  e.x += v[0]; e.y += v[1]; e.z += v[2];
}

// AbstractArrow.tick (client): a block in the path sticks the arrow (onHitBlock runs on both sides), otherwise
// move, motion * 0.99 (water inertia 0.6, trident 0.99), then gravity 0.05 unless no gravity / no physics
function tickArrow(e, world) {
  // the block at the arrow's position: inside its collision shape the arrow is in the ground; a stuck arrow whose
  // block no longer holds it starts falling (motion scaled by random 0..0.2)
  if (!e.noPhysics) {
    const inside = world.getCollisions([e.x - 1e-4, e.y - 1e-4, e.z - 1e-4, e.x + 1e-4, e.y + 1e-4, e.z + 1e-4], e).some((b) => e.x >= b[0] && e.x <= b[3] && e.y >= b[1] && e.y <= b[4] && e.z >= b[2] && e.z <= b[5]);
    if (inside) { e.inGround = true; return; }
    if (e.inGround) { e.inGround = false; e.motionX *= Math.random() * 0.2; e.motionY *= Math.random() * 0.2; e.motionZ *= Math.random() * 0.2; }
  }
  const v = [e.motionX, e.motionY, e.motionZ], len = Math.hypot(...v);
  if (!e.noPhysics && len > 0) {
    const hit = world.raycast(e.x, e.y, e.z, v[0] / len, v[1] / len, v[2] / len, len, false, true);
    if (hit && hit.dist <= len) {
      const d = [hit.hit[0] - e.x, hit.hit[1] - e.y, hit.hit[2] - e.z], n = Math.hypot(...d) || 1;
      e.motionX = d[0]; e.motionY = d[1]; e.motionZ = d[2];
      e.x = hit.hit[0] - d[0] / n * 0.05; e.y = hit.hit[1] - d[1] / n * 0.05; e.z = hit.hit[2] - d[2] / n * 0.05;
      e.inGround = true; e.shakeTime = 7;
      return;
    }
  }
  updateRotation(e, v, !!e.noPhysics);
  const drag = inWater(e, world) ? (e.entityName === 'trident' ? f32(0.99) : f32(0.6)) : f32(0.99);
  e.motionX = v[0] * drag; e.motionY = v[1] * drag; e.motionZ = v[2] * drag;
  if (!e.noGravity && !e.noPhysics) e.motionY -= 0.05;
  e.x += v[0]; e.y += v[1]; e.z += v[2];
}

// LlamaSpit.tick: motion * 0.99 then gravity 0.06
function tickLlamaSpit(e) {
  const v = [e.motionX, e.motionY, e.motionZ];
  updateRotation(e, v);
  e.motionX = v[0] * f32(0.99); e.motionY = v[1] * f32(0.99); e.motionZ = v[2] * f32(0.99);
  if (!e.noGravity) e.motionY -= 0.06;
  e.x += v[0]; e.y += v[1]; e.z += v[2];
}

// AbstractHurtingProjectile.tick: move, then (motion + power) * inertia (0.95; wind charge 1.0; dangerous wither
// skull 0.73; liquids 0.8)
function tickHurting(e, world) {
  const v = [e.motionX, e.motionY, e.motionZ];
  const inertia = inWater(e, world) ? f32(0.8) : e.entityName === 'wind_charge' || e.entityName === 'breeze_wind_charge' ? 1 : e.entityName === 'wither_skull' && e.dangerous ? f32(0.73) : f32(0.95);
  e.motionX = (v[0] + (e.accelX || 0)) * inertia; e.motionY = (v[1] + (e.accelY || 0)) * inertia; e.motionZ = (v[2] + (e.accelZ || 0)) * inertia;
  e.x += v[0]; e.y += v[1]; e.z += v[2];
}

// PrimedTnt.tick: gravity 0.04, collide, motion * 0.98, on ground * (0.7, -0.5, 0.7)
function tickTnt(e, world) {
  if (!e.noGravity) e.motionY -= 0.04;
  collideMove(e, world, f32(0.98), f32(0.98));
  e.motionX *= f32(0.98); e.motionY *= f32(0.98); e.motionZ *= f32(0.98);
  if (e.onGround) { e.motionX *= f32(0.7); e.motionY *= -0.5; e.motionZ *= f32(0.7); }
}

// ExperienceOrb.tick: water lifts it (setUnderwaterMovement) else gravity 0.03; it drifts to the nearest player
// within 8 blocks (re-chosen every 20 ticks), collides, then friction and a bounce on the ground
function tickOrb(e, world, players) {
  if (inWater(e, world)) { e.motionX *= f32(0.99); e.motionY = Math.min(e.motionY + 5e-4, 0.06); e.motionZ *= f32(0.99); }
  else if (!e.noGravity) e.motionY -= 0.03;
  e.orbTicks = (e.orbTicks || 0) + 1;
  if (e.orbTicks % 20 === 1 && (!e.following || dist2(e.following, e) > 64)) e.following = nearest(players, e, 8);
  if (e.following?.removed) e.following = null;
  const p = e.following;
  if (p) {
    const d = [p.x - e.x, p.y + (p.eyeHeight?.() ?? 1.62) / 2 - e.y, p.z - e.z], l = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    if (l < 64) { const k = 1 - Math.sqrt(l) / 8, n = Math.sqrt(l) || 1; e.motionX += d[0] / n * k * k * 0.1; e.motionY += d[1] / n * k * k * 0.1; e.motionZ += d[2] / n * k * k * 0.1; }
  }
  collideMove(e, world, 0.5, 0.5);
  let friction = f32(0.98);
  if (e.onGround) { const b = world.getBlockDef(Math.floor(e.x), Math.floor(e.y - 1), Math.floor(e.z)); friction = f32(f32(b?.slipperiness ?? 0.6) * f32(0.98)); }
  e.motionX *= friction; e.motionY *= f32(0.98); e.motionZ *= friction;
  if (e.onGround) e.motionY *= -0.9;
}
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
function nearest(players, e, range) { let best = null, bd = range * range; for (const p of players) { const d = dist2(p, e); if (d < bd) { bd = d; best = p; } } return best; }

// One client tick for a non-living projectile-like entity; returns false for kinds it does not handle
export function tickProjectile766(e, world, players = []) {
  if (e.kind === 'tnt') { tickTnt(e, world); return true; }
  if (e.kind === 'xp') { tickOrb(e, world, players); return true; }
  const n = e.entityName;
  if (ARROWS.has(n)) tickArrow(e, world);
  else if (THROWABLES.has(n)) tickThrowable(e, world);
  else if (HURTING.has(n)) tickHurting(e, world);
  else if (n === 'llama_spit') tickLlamaSpit(e);
  else if (n === 'shulker_bullet') { e.x += e.motionX; e.y += e.motionY; e.z += e.motionZ; } // client: plain move
  else return false;
  return true;
}
