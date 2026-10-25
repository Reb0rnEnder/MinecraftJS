// Port of vanilla 1.13.2 player movement physics (EntityPlayerSP / EntityPlayer / EntityLivingBase / Entity).
import { getBlock, getStateProperties } from '../world/blocks.js';
import { getFluidState, fluidHeightAt } from '../world/fluids.js';

const SPRINT_UUID = '662a6b8d-da3e-4c1c-8813-96ea6097278d';

// Vanilla MathHelper.sin/cos use a 65536-entry table; reproduce it for parity with the server
const SIN_TABLE = new Float32Array(65536);
for (let i = 0; i < 65536; i++) SIN_TABLE[i] = Math.sin(i * Math.PI * 2 / 65536);
const F_SIN_SCALE = Math.fround(10430.378);
const F_PI = Math.fround(Math.PI);
// MathHelper.sin / cos take a float: (int)(value * 10430.378F) & 65535 (+16384 for cos), all float maths
export const mcSin = (v) => SIN_TABLE[Math.trunc(Math.fround(Math.fround(v) * F_SIN_SCALE)) & 65535];
export const mcCos = (v) => SIN_TABLE[Math.trunc(Math.fround(Math.fround(Math.fround(v) * F_SIN_SCALE) + 16384)) & 65535];
// Vanilla float constants (as the double values the JVM widens them to)
const F = {
  p02: Math.fround(0.02), p03: 0.3, p091: Math.fround(0.91), p098: Math.fround(0.98), p08: Math.fround(0.8), p02b: Math.fround(0.2),
  p015: Math.fround(0.15), p06: Math.fround(0.6), p03f: Math.fround(0.3), p01: Math.fround(0.1), deg: Math.fround(0.017453292),
};

const f32 = Math.fround;

// MathHelper.fastInvSqrt (double bit trick + one Newton step)
const _fis = new DataView(new ArrayBuffer(8));
function fastInvSqrt(n) {
  const d0 = 0.5 * n;
  _fis.setFloat64(0, n);
  _fis.setBigInt64(0, 6910469410427058090n - (_fis.getBigInt64(0) >> 1n));
  let v = _fis.getFloat64(0);
  v = v * (1.5 - d0 * v * v);
  return v;
}

// Entity.getVectorForRotation (float maths)
function lookVec(pitch, yaw) {
  const f = mcCos(f32(f32(-yaw * F.deg) - F_PI)), f1 = mcSin(f32(f32(-yaw * F.deg) - F_PI));
  const f2 = -mcCos(f32(-pitch * F.deg)), f3 = mcSin(f32(-pitch * F.deg));
  return [f32(f1 * f2), f3, f32(f * f2)];
}

export function calcYOffset(box, bb, off) {
  if (bb[3] > box[0] && bb[0] < box[3] && bb[5] > box[2] && bb[2] < box[5]) {
    if (off > 0) {
      if (bb[4] <= box[1]) { const d = box[1] - bb[4]; if (d < off) off = d; }
    } else if (off < 0) {
      if (bb[1] >= box[4]) { const d = box[4] - bb[1]; if (d > off) off = d; }
    }
  }
  return off;
}
export function calcXOffset(box, bb, off) {
  if (bb[4] > box[1] && bb[1] < box[4] && bb[5] > box[2] && bb[2] < box[5]) {
    if (off > 0) {
      if (bb[3] <= box[0]) { const d = box[0] - bb[3]; if (d < off) off = d; }
    } else if (off < 0) {
      if (bb[0] >= box[3]) { const d = box[3] - bb[0]; if (d > off) off = d; }
    }
  }
  return off;
}
export function calcZOffset(box, bb, off) {
  if (bb[3] > box[0] && bb[0] < box[3] && bb[4] > box[1] && bb[1] < box[4]) {
    if (off > 0) {
      if (bb[5] <= box[2]) { const d = box[2] - bb[5]; if (d < off) off = d; }
    } else if (off < 0) {
      if (bb[2] >= box[5]) { const d = box[5] - bb[2]; if (d > off) off = d; }
    }
  }
  return off;
}
export const offsetBB = (bb, x, y, z) => [bb[0] + x, bb[1] + y, bb[2] + z, bb[3] + x, bb[4] + y, bb[5] + z];
function addCoord(bb, x, y, z) {
  const r = bb.slice();
  if (x < 0) r[0] += x; else r[3] += x;
  if (y < 0) r[1] += y; else r[4] += y;
  if (z < 0) r[2] += z; else r[5] += z;
  return r;
}

export class LocalPlayer {
  constructor() {
    this.x = 0; this.y = 0; this.z = 0;
    this.prevX = 0; this.prevY = 0; this.prevZ = 0;
    this.motionX = 0; this.motionY = 0; this.motionZ = 0;
    this.yaw = 0; this.pitch = 0; this.prevYaw = 0; this.prevPitch = 0;
    // Entity sizes are floats in vanilla: 0.6F / 1.8F (bb half width 0.30000001192092896, height 1.7999999523162842)
    this.width = Math.fround(0.6); this.height = Math.fround(1.8); this.stepHeight = Math.fround(0.6);
    // EntityLivingBase.landMovementFactor / jumpMovementFactor: set *after* each move (EntityPlayer.onLivingUpdate),
    // so sprint changes only affect speed from the next tick
    this.landMovementFactor = Math.fround(0.1); this.jumpMovementFactor = Math.fround(0.02);
    this.onGround = false;
    this.collidedH = false; this.collidedV = false;
    this.eyesInWater = false; this.waterVisionTicks = 0;
    this.inWater = false; this.inLava = false; this.inWeb = false;
    this.fallDistance = 0;
    this.jumpTicks = 0;
    this.sneaking = false; this.sprinting = false; this.swimming = false;
    this.flying = false; this.allowFlying = false; this.creative = false; this.invulnerable = false;
    this.spectator = false; this.noClip = false;
    this.flySpeed = 0.05; this.walkSpeed = 0.1;
    this.speedAttr = { base: 0.1, modifiers: [] };
    this.food = 20;
    this.sprintToggleTimer = 0; this.flyToggleTimer = 0;
    this.prevJump = false; this.prevForwardHeld = false; this.prevSneak = false;
    this.usingItem = false;
    this.riptideTicks = 0; this.riptide = false;
    this.blind = false;
    this.jumpBoost = -1;
    this.depthStrider = 0;
    this.distanceWalked = 0; this.prevDistanceWalked = 0;
    this.nextStepDistance = 1;
    this.cameraYaw = 0; this.prevCameraYaw = 0; this.cameraPitch = 0; this.prevCameraPitch = 0;
    this.onStep = null; // callback(x,y,z, state)
    this.onWaterEnter = null; // callback() when entering water (splash sound + particles)
    this.onFall = null; // callback(damage, landedOnState) when landing hard enough to take fall damage
    this.onSwim = null; // callback(volume) every swim "step"
    this.ticksExisted = 0;
    this.swimDistance = 0; this.nextSwimDistance = 1;
    this.ridingEntity = null;
    this.elytraFlying = false; // entity flag 7, set by the server
    this.ticksElytraFlying = 0;
    this.levitation = -1;      // levitation amplifier (-1: none)
    this.autoJump = false;     // GameSettings.autoJump (EntityPlayerSP.autoJumpEnabled)
    this.autoJumpTime = 0;
    this.sleeping = false;
    this.attackSpeed = 4;
    this._bb = null;
  }

  // ItemTrident.onPlayerStoppedUsing: apply the look-direction impulse on both sides.
  startRiptide(level, world) {
    const yaw = f32(this.yaw * F.deg), pitch = f32(this.pitch * F.deg);
    const x = f32(-mcSin(yaw) * mcCos(pitch));
    const y = f32(-mcSin(pitch));
    const z = f32(mcCos(yaw) * mcCos(pitch));
    const length = f32(Math.sqrt(f32(f32(f32(x * x) + f32(y * y)) + f32(z * z))));
    const speed = f32(3 * f32(f32(1 + level) / 4));
    this.motionX += f32(f32(x / length) * speed);
    this.motionY += f32(f32(y / length) * speed);
    this.motionZ += f32(f32(z / length) * speed);
    this.riptideTicks = 20; this.riptide = true;
    if (this.onGround) this.moveEntity(world, 0, 1.1999999284744263, 0);
  }

  // EntityPlayer.getEyeHeight (1.12)
  eyeHeight() {
    if (this.sleeping) return f32(0.2);
    if (!this.sneaking && this.height !== f32(1.65)) return this.elytraFlying || this.swimming || this.height === f32(0.6) ? f32(0.4) : f32(1.62);
    return f32(f32(1.62) - f32(0.08));
  }

  // EntityPlayer.updateSize: 0.6 x 0.6 gliding, 0.6 x 1.65 sneaking, if the new box fits
  updateSize(world) {
    let w = f32(0.6), h = f32(1.8);
    if (this.elytraFlying || this.swimming || this.riptide) h = f32(0.6);
    else if (this.sleeping) { w = f32(0.2); h = f32(0.2); }
    else if (this.sneaking) h = f32(1.65);
    if (w === this.width && h === this.height) return;
    const bb = this.bb();
    const nb = [bb[0], bb[1], bb[2], bb[0] + w, bb[1] + h, bb[2] + w];
    if (world.getCollisions(nb).length) return; // World.collidesWithAnyBlock
    // Entity.setSize: keep minX/minZ, then recentre (setPosition of the new box)
    this.width = w; this.height = h;
    this._bb = [nb[0], nb[1], nb[2], nb[0] + w, nb[1] + h, nb[2] + w];
    this.x = (this._bb[0] + this._bb[3]) / 2; this.z = (this._bb[2] + this._bb[5]) / 2;
  }

  bb() {
    if (this._bb) return this._bb.slice();
    const w = Math.fround(this.width / 2);
    return [this.x - w, this.y, this.z - w, this.x + w, this.y + this.height, this.z + w];
  }

  setPosition(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    const w = Math.fround(this.width / 2);
    this._bb = [x - w, y, z - w, x + w, y + this.height, z + w];
  }

  // EntityPlayerSP.pushOutOfBlocks: only acts when this corner is inside a normal cube (block or the one
  // above it), then sets a fixed 0.1 sideways motion towards the nearest open neighbour. Never vertical,
  // never random, and never just for touching a wall (anything else desyncs from the server).
  pushOutOfBlocks(world, x, y, z) {
    if (this.noClip) return false;
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    const d0 = x - bx, d1 = z - bz;
    const cube = (xx, yy, zz) => { const b = getBlock(world.getState(xx, yy, zz)); return !!(b && b.opaque && !b.isLiquid); };
    const open = (xx, yy, zz) => !cube(xx, yy, zz) && !cube(xx, yy + 1, zz);
    if (open(bx, by, bz)) return false;
    let i = -1, d2 = 9999;
    if (open(bx - 1, by, bz) && d0 < d2) { d2 = d0; i = 0; }
    if (open(bx + 1, by, bz) && 1 - d0 < d2) { d2 = 1 - d0; i = 1; }
    if (open(bx, by, bz - 1) && d1 < d2) { d2 = d1; i = 4; }
    if (open(bx, by, bz + 1) && 1 - d1 < d2) { d2 = 1 - d1; i = 5; }
    const f = 0.10000000149011612; // 0.1F
    if (i === 0) this.motionX = -f;
    if (i === 1) this.motionX = f;
    if (i === 4) this.motionZ = -f;
    if (i === 5) this.motionZ = f;
    return false;
  }

  aiMoveSpeed() {
    let base = this.speedAttr.base;
    let v = base;
    const mods = this.speedAttr.modifiers.filter((m) => m.uuid !== SPRINT_UUID);
    for (const m of mods) if (m.operation === 0) v += m.amount;
    let v2 = v;
    for (const m of mods) if (m.operation === 1) v2 += v * m.amount;
    for (const m of mods) if (m.operation === 2) v2 *= 1 + m.amount;
    if (this.sprinting) v2 *= 1.3;
    return f32(v2);
  }

  // --- Material checks ---

  isMaterialInBB(world, bb, test) {
    const x0 = Math.floor(bb[0]), x1 = Math.floor(bb[3] + 1);
    const y0 = Math.floor(bb[1]), y1 = Math.floor(bb[4] + 1);
    const z0 = Math.floor(bb[2]), z1 = Math.floor(bb[5] + 1);
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
      const b = getBlock(world.getState(x, y, z));
      if (b && test(b)) return true;
    }
    return false;
  }

  handleWaterMovement(world) {
    // Fluid contact is independent of the block occupying the cell. Use the
    // actual surface and a small inset so merely touching it is not immersion.
    const bb0 = this.bb();
    const bb = [bb0[0] + 0.001, bb0[1] + 0.001, bb0[2] + 0.001, bb0[3] - 0.001, bb0[4] - 0.001, bb0[5] - 0.001];
    const x0 = Math.floor(bb[0]), x1 = Math.ceil(bb[3]);
    const y0 = Math.floor(bb[1]), y1 = Math.ceil(bb[4]);
    const z0 = Math.floor(bb[2]), z1 = Math.ceil(bb[5]);
    if (this.ridingEntity && this.ridingBoat) { this.inWater = false; return false; }
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
      if (!world.isLoaded(x, z)) { this.inWater = false; return false; } // isAreaLoaded
    }
    let found = false;
    let fx = 0, fy = 0, fz = 0;
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
      const s = world.getState(x, y, z);
      const fluid = getFluidState(s);
      if (!fluid || !fluid.isWater) continue;
      if (bb[1] < y + fluidHeightAt(world, x, y, z) && bb[4] > y) {
        found = true;
        const v = this.flowVector(world, x, y, z, false);
        fx += v[0]; fy += v[1]; fz += v[2];
      }
    }
    const len = Math.sqrt(fx * fx + fy * fy + fz * fz);
    if (len > 0 && !this.flying) {
      const d = 0.014;
      this.motionX += fx / len * d; this.motionY += fy / len * d; this.motionZ += fz / len * d;
    }
    // Entity.resetHeight: splash when entering water (not on the first update)
    if (found && !this.inWater && this.ticksExisted > 1 && this.onWaterEnter) this.onWaterEnter();
    if (found) { this.fallDistance = 0; }
    this.inWater = found;
    return found;
  }

  flowVector(world, x, y, z, lava) {
    const decay = (xx, yy, zz) => {
      const s = world.getState(xx, yy, zz);
      const fluid = getFluidState(s);
      if (!fluid || fluid.isLava !== lava) return -1;
      const l = fluid.level;
      return l >= 8 ? 0 : l;
    };
    const i = decay(x, y, z);
    let vx = 0, vy = 0, vz = 0;
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      let j = decay(x + dx, y, z + dz);
      if (j < 0) {
        const b = getBlock(world.getState(x + dx, y, z + dz));
        if (!b || b.boundingBox !== 'block' || b.id === 0) {
          j = decay(x + dx, y - 1, z + dz);
          if (j >= 0) { const k = j - (i - 8); vx += dx * k; vz += dz * k; }
        }
      } else { const k = j - i; vx += dx * k; vz += dz * k; }
    }
    if ((getFluidState(world.getState(x, y, z))?.level || 0) >= 8) {
      // Falling liquid pushes down when next to solid sides
      let solidSide = false;
      for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const b = getBlock(world.getState(x + dx, y, z + dz));
        const b2 = getBlock(world.getState(x + dx, y + 1, z + dz));
        if ((b && b.opaque) || (b2 && b2.opaque)) { solidSide = true; break; }
      }
      if (solidSide) {
        const l = Math.sqrt(vx * vx + vz * vz) || 1;
        vx /= l; vz /= l; vy = -6;
      }
    }
    const l = Math.sqrt(vx * vx + vy * vy + vz * vz);
    return l > 0 ? [vx / l, vy / l, vz / l] : [0, 0, 0];
  }

  isInLava(world) {
    const bb = this.bb();
    return this.isFluidInBB(world, [bb[0] + 0.1, bb[1] + 0.4, bb[2] + 0.1, bb[3] - 0.1, bb[4] - 0.4, bb[5] - 0.1], true);
  }

  isFluidInBB(world, bb, lava) {
    for (let x = Math.floor(bb[0]); x < Math.ceil(bb[3]); x++)
      for (let y = Math.floor(bb[1]); y < Math.ceil(bb[4]); y++)
        for (let z = Math.floor(bb[2]); z < Math.ceil(bb[5]); z++) {
          const fluid = getFluidState(world.getState(x, y, z));
          if (fluid && (lava === undefined || fluid.isLava === lava) && bb[1] < y + fluidHeightAt(world, x, y, z) && bb[4] > y) return true;
        }
    return false;
  }

  isOffsetPositionInLiquid(world, dx, dy, dz) {
    const bb = offsetBB(this.bb(), dx, dy, dz);
    if (world.getCollisions(bb, this).length) return false;
    return this.isFluidInBB(world, bb);
  }

  // EntityLivingBase.isOnLadder: ladders, vines, and an open trapdoor right above a ladder facing the same way
  isOnLadder(world) {
    if (this.spectator) return false;
    const x = Math.floor(this.x), y = Math.floor(this.bb()[1]), z = Math.floor(this.z);
    const st = world.getState(x, y, z), b = getBlock(st);
    if (!b) return false;
    if (b.name === 'ladder' || b.name === 'vine') return true;
    if ((b.name === 'oak_trapdoor' || b.name === 'iron_trapdoor') && getStateProperties(st).open === 'true') {
      const below = world.getState(x, y - 1, z);
      if (getBlock(below).name !== 'ladder') return false;
      return getStateProperties(st).facing === getStateProperties(below).facing;
    }
    return false;
  }

  // --- Core movement ---

  // Entity.moveRelative (1.12; all float maths, added to the double motion; yaw * 0.017453292F)
  moveFlying(strafe, forward, friction) {
    const fr = Math.fround;
    strafe = fr(strafe); forward = fr(forward); friction = fr(friction);
    let f = fr(fr(strafe * strafe) + fr(forward * forward));
    if (f >= fr(1.0e-4)) {
      f = fr(Math.sqrt(f));
      if (f < 1) f = 1;
      f = fr(friction / f);
      strafe = fr(strafe * f); forward = fr(forward * f);
      const a = fr(fr(this.yaw) * F.deg);
      const s = mcSin(a), c = mcCos(a);
      this.motionX += fr(fr(strafe * c) - fr(forward * s));
      this.motionZ += fr(fr(forward * c) + fr(strafe * s));
    }
  }

  moveEntity(world, x, y, z) {
    if (this.noClip) {
      this.setPosition(this.x + x, this.y + y, this.z + z);
      return;
    }
    if (this.inWeb) {
      this.inWeb = false;
      x *= 0.25; y *= 0.05000000074505806; z *= 0.25;
      this.motionX = 0; this.motionY = 0; this.motionZ = 0;
    }
    const d4 = y;
    let bb = this.bb();
    const sneakEdge = this.onGround && this.sneaking;
    if (sneakEdge) {
      const d6 = 0.05;
      // 1.9+: probes stepHeight below the box (1.8 probed a whole block)
      const down = -this.stepHeight;
      const empty = (bx, bz) => world.getCollisions(offsetBB(bb, bx, down, bz), this).length === 0;
      while (x !== 0 && empty(x, 0)) {
        if (x < d6 && x >= -d6) x = 0; else if (x > 0) x -= d6; else x += d6;
      }
      while (z !== 0 && empty(0, z)) {
        if (z < d6 && z >= -d6) z = 0; else if (z > 0) z -= d6; else z += d6;
      }
      while (x !== 0 && z !== 0 && empty(x, z)) {
        if (x < d6 && x >= -d6) x = 0; else if (x > 0) x -= d6; else x += d6;
        if (z < d6 && z >= -d6) z = 0; else if (z > 0) z -= d6; else z += d6;
      }
    }
    const dx0 = x, dz0 = z; // after sneak clamp (vanilla reassigns d3/d5 inside loops)
    const list1 = world.getCollisions(addCoord(bb, x, y, z), this);
    const bbOrig = bb;
    for (const c of list1) y = calcYOffset(c, bb, y);
    bb = offsetBB(bb, 0, y, 0);
    const flag1 = this.onGround || (d4 !== y && d4 < 0);
    for (const c of list1) x = calcXOffset(c, bb, x);
    bb = offsetBB(bb, x, 0, 0);
    for (const c of list1) z = calcZOffset(c, bb, z);
    bb = offsetBB(bb, 0, 0, z);

    if (this.stepHeight > 0 && flag1 && (dx0 !== x || dz0 !== z)) {
      const d11 = x, d7 = y, d8 = z;
      const bb3 = bb;
      bb = bbOrig;
      y = this.stepHeight;
      const list = world.getCollisions(addCoord(bb, dx0, y, dz0), this);
      let bb4 = bb;
      const bb5 = addCoord(bb4, dx0, 0, dz0);
      let d9 = y;
      for (const c of list) d9 = calcYOffset(c, bb5, d9);
      bb4 = offsetBB(bb4, 0, d9, 0);
      let d15 = dx0;
      for (const c of list) d15 = calcXOffset(c, bb4, d15);
      bb4 = offsetBB(bb4, d15, 0, 0);
      let d16 = dz0;
      for (const c of list) d16 = calcZOffset(c, bb4, d16);
      bb4 = offsetBB(bb4, 0, 0, d16);
      let bb14 = bb;
      let d17 = y;
      for (const c of list) d17 = calcYOffset(c, bb14, d17);
      bb14 = offsetBB(bb14, 0, d17, 0);
      let d18 = dx0;
      for (const c of list) d18 = calcXOffset(c, bb14, d18);
      bb14 = offsetBB(bb14, d18, 0, 0);
      let d19 = dz0;
      for (const c of list) d19 = calcZOffset(c, bb14, d19);
      bb14 = offsetBB(bb14, 0, 0, d19);
      const d20 = d15 * d15 + d16 * d16;
      const d10 = d18 * d18 + d19 * d19;
      if (d20 > d10) { x = d15; z = d16; y = -d9; bb = bb4; } else { x = d18; z = d19; y = -d17; bb = bb14; }
      for (const c of list) y = calcYOffset(c, bb, y);
      bb = offsetBB(bb, 0, y, 0);
      if (d11 * d11 + d8 * d8 >= x * x + z * z) { x = d11; y = d7; z = d8; bb = bb3; }
    }
    this.x = (bb[0] + bb[3]) / 2;
    this.y = bb[1];
    this.z = (bb[2] + bb[5]) / 2;
    this._bb = bb;
    this.collidedH = dx0 !== x || dz0 !== z;
    this.collidedV = d4 !== y;
    this.onGround = this.collidedV && d4 < 0;

    // Entity.move: the block landed on / walked on, floor(y - 0.2), or the fence / wall / gate below an air block
    let lbx = Math.floor(this.x), lby = Math.floor(this.y - 0.20000000298023224), lbz = Math.floor(this.z);
    let lst = world.getState(lbx, lby, lbz), lb = getBlock(lst);
    if (!lb || lb.id === 0) {
      const b2 = getBlock(world.getState(lbx, lby - 1, lbz));
      if (b2 && (b2.isFence || b2.isWall || b2.isFenceGate)) { lby--; lst = world.getState(lbx, lby, lbz); lb = b2; }
    }

    // Entity.updateFallState -> Block.onFallenUpon -> EntityPlayer.fall (slime: no damage unless sneaking, hay: 20%,
    // bed: half)
    if (this.onGround) {
      if (this.fallDistance > 0 && this.onFall && !this.allowFlying) {
        // EntityLivingBase.fall(distance, multiplier): ceil((distance - 3 - jump boost) * multiplier); beds halve the distance
        const mult = lb && lb.name === 'slime' && !this.sneaking ? 0 : lb && lb.name === 'hay_block' ? 0.2 : 1;
        const dist = lb && lb.name === 'bed' ? this.fallDistance * 0.5 : this.fallDistance;
        const dmg = Math.ceil((dist - 3 - (this.jumpBoost >= 0 ? this.jumpBoost + 1 : 0)) * mult);
        if (dmg > 0) this.onFall(dmg, lst);
      }
      this.fallDistance = 0;
    } else if (y < 0) this.fallDistance = f32(this.fallDistance - y);

    if (dx0 !== x) this.motionX = 0;
    if (dz0 !== z) this.motionZ = 0;
    // Block.onLanded: slime bounces back fully, beds (1.12) at 66%, unless sneaking; everything else stops
    if (d4 !== y) {
      const bouncy = lb && (lb.name === 'slime' || lb.name === 'bed');
      if (!bouncy || this.sneaking) this.motionY = 0;
      else if (this.motionY < 0) this.motionY = lb.name === 'slime' ? -this.motionY : -this.motionY * f32(0.66);
    }

    // Entity.moveEntity: walked distance (view bobbing) and step distance (sounds). Counted in the air too,
    // so the first step after landing plays; not while sneaking on the ground or riding.
    const x0 = (bbOrig[0] + bbOrig[3]) / 2, y0 = bbOrig[1], z0 = (bbOrig[2] + bbOrig[5]) / 2;
    if (!(this.onGround && this.sneaking) && !this.ridingEntity) {
      const bx = lbx, by = lby, bz = lbz, st = lst, blk = lb;
      const ddx = this.x - x0, ddz = this.z - z0;
      const ddy = blk && (blk.name === 'ladder') ? this.y - y0 : 0;
      this.distanceWalked += Math.sqrt(ddx * ddx + ddz * ddz) * 0.6;
      this.stepDistance = (this.stepDistance || 0) + Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) * 0.6;
      if (this.stepDistance > this.nextStepDistance && blk && blk.id !== 0) {
        this.nextStepDistance = Math.floor(this.stepDistance) + 1;
        // 1.9+: the swim sound in water, else the step sound
        if (this.inWater) {
          if (this.onSwim) this.onSwim(Math.min(1, Math.sqrt(this.motionX * this.motionX * 0.20000000298023224 + this.motionY * this.motionY + this.motionZ * this.motionZ * 0.20000000298023224) * 0.35));
        } else if (this.onStep) this.onStep(bx, by, bz, st);
      }
    }
    this._lastX = this.x; this._lastY = this.y; this._lastZ = this.z;

    this.doBlockCollisions(world);
    // EntityPlayerSP.move: auto-jump check with this move's horizontal distance
    this.updateAutoJump(world, f32(this.x - x0), f32(this.z - z0));
  }

  // EntityPlayerSP.updateAutoJump (1.11+)
  updateAutoJump(world, dx, dz) {
    if (!this.autoJump || this.autoJumpTime > 0 || !this.onGround || this.sneaking || this.ridingEntity || !this._moveVec) return;
    const [mvx, mvy] = this._moveVec;
    if (mvx === 0 && mvy === 0) return;
    const bb = this.bb();
    const p0 = [this.x, bb[1], this.z];
    const p1 = [this.x + dx, bb[1], this.z + dz];
    let v2 = [dx, 0, dz];
    const f = this.landMovementFactor;
    let f1 = f32(v2[0] * v2[0] + v2[2] * v2[2]);
    if (f1 <= f32(0.001)) {
      const f2 = f32(f * mvx), f3 = f32(f * mvy);
      const f4 = mcSin(f32(this.yaw * F.deg)), f5 = mcCos(f32(this.yaw * F.deg));
      v2 = [f32(f32(f2 * f5) - f32(f3 * f4)), 0, f32(f32(f3 * f5) + f32(f2 * f4))];
      f1 = f32(v2[0] * v2[0] + v2[2] * v2[2]);
      if (f1 <= f32(0.001)) return;
    }
    const f12 = f32(fastInvSqrt(f1));
    const v12 = [v2[0] * f12, v2[1] * f12, v2[2] * f12];
    const fw = lookVec(this.pitch, this.yaw); // getForward
    const f13 = f32(fw[0] * v12[0] + fw[2] * v12[2]);
    if (f13 < f32(-0.15)) return;
    const boxesAt = (x, y, z) => { const out = []; world.collisionBoxes(x, y, z, out); return out; };
    let bp = [Math.floor(this.x), Math.floor(bb[4]), Math.floor(this.z)];
    if (boxesAt(...bp).length) return;
    bp = [bp[0], bp[1] + 1, bp[2]];
    if (boxesAt(...bp).length) return;
    let f7 = f32(1.2);
    if (this.jumpBoost >= 0) f7 = f32(f7 + f32((this.jumpBoost + 1) * f32(0.75)));
    const f8 = Math.max(f32(f * 7), f32(1 / f12));
    const p4 = [p1[0] + v12[0] * f8, p1[1] + v12[1] * f8, p1[2] + v12[2] * f8];
    const w = this.width, h = this.height;
    const area = [Math.min(p0[0], p4[0]) - w, Math.min(p0[1], p4[1] + h), Math.min(p0[2], p4[2]) - w,
      Math.max(p0[0], p4[0]) + w, Math.max(p0[1], p4[1] + h), Math.max(p0[2], p4[2]) + w];
    const a19 = [p0[0], p0[1] + 0.5099999904632568, p0[2]];
    const b4 = [p4[0], p4[1] + 0.5099999904632568, p4[2]];
    const cross = [-v12[2], 0, v12[0]]; // v12 x (0, 1, 0)
    const half = f32(w * 0.5);
    const v6 = [cross[0] * half, 0, cross[2] * half];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const v7 = sub(a19, v6), v8 = sub(b4, v6), v9 = add(a19, v6), v10 = add(b4, v6);
    const hits = (c, a, b) => c[3] > Math.min(a[0], b[0]) && c[0] < Math.max(a[0], b[0]) && c[4] > Math.min(a[1], b[1]) && c[1] < Math.max(a[1], b[1]) && c[5] > Math.min(a[2], b[2]) && c[2] < Math.max(a[2], b[2]);
    let f11 = -Infinity;
    outer:
    for (const c of world.getCollisions(area, this)) {
      if (!(hits(c, v7, v8) || hits(c, v9, v10))) continue;
      f11 = f32(c[4]);
      const center = [Math.floor((c[0] + c[3]) / 2), Math.floor((c[1] + c[4]) / 2), Math.floor((c[2] + c[5]) / 2)];
      for (let i = 1; i < f7; i++) {
        const up = [center[0], center[1] + i, center[2]];
        const ub = boxesAt(...up);
        if (ub.length) {
          f11 = f32(f32(Math.max(...ub.map((u) => u[4] - up[1]))) + up[1]);
          if (f11 - bb[1] > f7) return;
        }
        if (i > 1) {
          bp = [bp[0], bp[1] + 1, bp[2]];
          if (boxesAt(...bp).length) return;
        }
      }
      break outer;
    }
    if (f11 !== -Infinity) {
      const f14 = f32(f11 - bb[1]);
      if (f14 > f32(0.5) && f14 <= f7) this.autoJumpTime = 1;
    }
  }

  doBlockCollisions(world) {
    const bb = this.bb();
    const x0 = Math.floor(bb[0] + 0.001), x1 = Math.floor(bb[3] - 0.001);
    const y0 = Math.floor(bb[1] + 0.001), y1 = Math.floor(bb[4] - 0.001);
    const z0 = Math.floor(bb[2] + 0.001), z1 = Math.floor(bb[5] - 0.001);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const b = getBlock(world.getState(x, y, z));
      if (!b || b.id === 0) continue;
      if (b.name === 'web') this.inWeb = true;
      else if (b.name === 'soul_sand') { this.motionX *= 0.4; this.motionZ *= 0.4; }
    }
    // Slime: walking on it slows you
    const below = getBlock(world.getState(Math.floor(this.x), Math.floor(this.y - 0.20000000298023224), Math.floor(this.z)));
    if (below && below.name === 'slime' && this.onGround && Math.abs(this.motionY) < 0.1 && !this.sneaking) {
      const d = 0.4 + Math.abs(this.motionY) * 0.2;
      this.motionX *= d; this.motionZ *= d;
    }
  }

  jump() {
    this.motionY = 0.41999998688697815; // getJumpUpwardsMotion() = 0.42F
    if (this.jumpBoost >= 0) this.motionY += Math.fround((this.jumpBoost + 1) * F.p01);
    if (this.sprinting) {
      const f = Math.fround(Math.fround(this.yaw) * F.deg);
      this.motionX -= Math.fround(mcSin(f) * F.p02b);
      this.motionZ += Math.fround(mcCos(f) * F.p02b);
    }
  }

  // Entity.isInWaterRainOrBubble uses body contact; starting swimming uses eye immersion instead.
  isEyeInWater(world) {
    const eye=this.y+this.eyeHeight(),by=Math.floor(eye),fluid=getFluidState(world.getState(Math.floor(this.x),by,Math.floor(this.z)));
    return !!fluid&&!fluid.isLava&&eye<by+Math.fround(fluid.height+Math.fround(0.11111111))&&!this.ridingBoat;
  }

  waterVision() {
    if(!this.eyesInWater)return 0;
    return Math.min(1,this.waterVisionTicks/100)*0.6+Math.max(0,Math.min(1,(this.waterVisionTicks-100)/500))*0.4;
  }

  moveEntityWithHeading(world, strafe, forward) {
    if(this.swimming&&!this.flying) {
      const lookY=lookVec(this.pitch,this.yaw)[1],factor=lookY < -0.2 ? 0.085 : 0.06;
      const fluidAbove=getFluidState(world.getState(Math.floor(this.x),Math.floor(this.y+0.9),Math.floor(this.z)));
      if(lookY<=0||this.jumping||fluidAbove&&!fluidAbove.isLava)this.motionY+=(lookY-this.motionY)*factor;
    }
    if (this.flying && !this.ridingEntity) {
      const d3 = this.motionY;
      const jmf = Math.fround(Math.fround(this.flySpeed) * (this.sprinting ? 2 : 1));
      this._moveWithHeading(world, strafe, forward, jmf);
      this.motionY = d3 * 0.6;
      this.fallDistance = 0;
      return;
    }
    this._moveWithHeading(world, strafe, forward, this.jumpMovementFactor);
  }

  _moveWithHeading(world, strafe, forward, jumpMovementFactor) {
    if (this.elytraFlying && !this.inWater && !this.inLava && !this.flying) {
      // EntityLivingBase.travel, elytra flying
      if (this.motionY > -0.5) this.fallDistance = 1;
      const look = lookVec(this.pitch, this.yaw);
      const f = f32(this.pitch * F.deg);
      const d6 = Math.sqrt(look[0] * look[0] + look[2] * look[2]);
      const d8 = Math.sqrt(this.motionX * this.motionX + this.motionZ * this.motionZ);
      const d1 = Math.sqrt(look[0] * look[0] + look[1] * look[1] + look[2] * look[2]);
      let f4 = mcCos(f);
      f4 = f32(f4 * f4 * Math.min(1, d1 / 0.4));
      this.motionY += -0.08 + f4 * 0.06;
      if (this.motionY < 0 && d6 > 0) {
        const d2 = this.motionY * -0.1 * f4;
        this.motionY += d2;
        this.motionX += look[0] * d2 / d6;
        this.motionZ += look[2] * d2 / d6;
      }
      if (f < 0) {
        const d10 = d8 * -mcSin(f) * 0.04;
        this.motionY += d10 * 3.2;
        this.motionX -= look[0] * d10 / d6;
        this.motionZ -= look[2] * d10 / d6;
      }
      if (d6 > 0) {
        this.motionX += (look[0] / d6 * d8 - this.motionX) * 0.1;
        this.motionZ += (look[2] / d6 * d8 - this.motionZ) * 0.1;
      }
      this.motionX *= 0.9900000095367432;
      this.motionY *= 0.9800000190734863;
      this.motionZ *= 0.9900000095367432;
      this.moveEntity(world, this.motionX, this.motionY, this.motionZ);
      return;
    }
    if (this.inWater && !this.flying) {
      const d0 = this.y;
      let f1 = this.sprinting ? f32(0.9) : F.p08, f2 = F.p02;
      let f3 = this.depthStrider;
      if (f3 > 3) f3 = 3;
      if (!this.onGround) f3 *= 0.5;
      if (f3 > 0) {
        f1 = Math.fround(f1 + Math.fround(Math.fround(Math.fround(0.54600006) - f1) * f3) / 3);
        f2 = Math.fround(f2 + Math.fround(Math.fround(this.landMovementFactor - f2) * f3) / 3);
      }
      if(this.dolphinsGrace)f1=f32(0.96);
      this.moveFlying(strafe, forward, f2);
      this.moveEntity(world, this.motionX, this.motionY, this.motionZ);
      this.motionX *= f1; this.motionY *= 0.800000011920929; this.motionZ *= f1;
      // 1.13 water gravity is 0.08 / 16 and is skipped during sprint swimming.
      if(!this.noGravity&&!this.sprinting) {
        const gravity=this.slowFalling&&this.motionY<=0?0.01:0.08;
        this.motionY=this.motionY<=0&&Math.abs(this.motionY-0.005)>=0.003&&Math.abs(this.motionY-gravity/16)<0.003?-0.003:this.motionY-gravity/16;
      }
      if (this.collidedH && this.isOffsetPositionInLiquid(world, this.motionX, this.motionY + 0.6000000238418579 - this.y + d0, this.motionZ)) this.motionY = 0.30000001192092896;
    } else if (this.inLava && !this.flying) {
      const d1 = this.y;
      this.moveFlying(strafe, forward, F.p02);
      this.moveEntity(world, this.motionX, this.motionY, this.motionZ);
      this.motionX *= 0.5; this.motionY *= 0.5; this.motionZ *= 0.5;
      this.motionY -= 0.02;
      if (this.collidedH && this.isOffsetPositionInLiquid(world, this.motionX, this.motionY + 0.6000000238418579 - this.y + d1, this.motionZ)) this.motionY = 0.30000001192092896;
    } else {
      // slipperiness of the block under the box's minY, times 0.91F (float maths)
      const slip = () => {
        const b = getBlock(world.getState(Math.floor(this.x), Math.floor(this.bb()[1]) - 1, Math.floor(this.z)));
        return f32(f32(b ? b.slipperiness : 0.6) * F.p091);
      };
      let f4 = this.onGround ? slip() : F.p091;
      const f = f32(f32(0.16277136) / f32(f32(f4 * f4) * f4));
      const f5 = this.onGround ? f32(this.landMovementFactor * f) : jumpMovementFactor;
      this.moveFlying(strafe, forward, f5);
      f4 = this.onGround ? slip() : F.p091;
      const ladder = this.isOnLadder(world);
      if (ladder) {
        const f6 = F.p015;
        this.motionX = Math.min(Math.max(this.motionX, -f6), f6);
        this.motionZ = Math.min(Math.max(this.motionZ, -f6), f6);
        this.fallDistance = 0;
        if (this.motionY < -0.15) this.motionY = -0.15;
        if (this.sneaking && this.motionY < 0) this.motionY = 0;
      }
      this.moveEntity(world, this.motionX, this.motionY, this.motionZ);
      if (this.collidedH && ladder) this.motionY = 0.2;
      if (this.levitation >= 0) {
        this.motionY += (0.05 * (this.levitation + 1) - this.motionY) * 0.2;
      } else if (!world.isLoaded(Math.floor(this.x), Math.floor(this.z))) {
        this.motionY = this.y > 0 ? -0.1 : 0;
      } else {
        this.motionY -= 0.08;
      }
      this.motionY *= 0.9800000190734863;
      this.motionX *= f4;
      this.motionZ *= f4;
    }
  }

  // input: { forward, back, left, right, jump, sneak, sprint }
  // returns { abilitiesChanged }
  tick(world, input) {
    this.prevX = this.x; this.prevY = this.y; this.prevZ = this.z;
    this.prevYaw = this.yaw; this.prevPitch = this.pitch;
    this.prevDistanceWalked = this.distanceWalked;
    this.prevCameraYaw = this.cameraYaw; this.prevCameraPitch = this.cameraPitch;
    const result = { abilitiesChanged: false };

    // Entity.onEntityUpdate (before EntityPlayerSP.onLivingUpdate): water pushes and the in-water / in-lava state
    this.ticksExisted++;
    this.handleWaterMovement(world);
    this.inLava = this.isInLava(world);
    this.eyesInWater = this.isEyeInWater(world);
    this.waterVisionTicks = Math.max(0,Math.min(600,this.waterVisionTicks+(this.eyesInWater?(this.spectator?10:1):-10)));

    if (this.sprintToggleTimer > 0) this.sprintToggleTimer--;
    if (this.flyToggleTimer > 0) this.flyToggleTimer--;

    // MovementInputFromOptions
    let moveForward = 0, moveStrafe = 0;
    if (input.forward) moveForward++;
    if (input.back) moveForward--;
    if (input.left) moveStrafe++;
    if (input.right) moveStrafe--;
    let jump = !!input.jump;
    const sneakKey = !!input.sneak;
    if (sneakKey) { moveStrafe = f32(moveStrafe * 0.3); moveForward = f32(moveForward * 0.3); }
    if (this.usingItem && !this.ridingEntity) { moveStrafe = f32(moveStrafe * F.p02b); moveForward = f32(moveForward * F.p02b); this.sprintToggleTimer = 0; }
    this._moveVec = [moveStrafe, moveForward]; // MovementInput.getMoveVector
    this.autoJump = !!input.autoJump;
    if (this.autoJumpTime > 0) { this.autoJumpTime--; jump = true; }
    // vanilla: isSneaking() follows the key, even while flying
    this.sneaking = sneakKey;

    // Push out of blocks at 4 bottom corners like vanilla EntityPlayerSP
    if (!this.noClip) {
      const w35 = this.width * 0.35;
      const py = this.bb()[1] + 0.5;
      this.pushOutOfBlocks(world, this.x - w35, py, this.z + w35);
      this.pushOutOfBlocks(world, this.x - w35, py, this.z - w35);
      this.pushOutOfBlocks(world, this.x + w35, py, this.z - w35);
      this.pushOutOfBlocks(world, this.x + w35, py, this.z + w35);
    }

    // Sprint logic
    const f = 0.8;
    const foodOk = this.food > 6 || this.allowFlying;
    if ((this.onGround || this.eyesInWater) && !this.prevSneak && !this.prevForwardHeld && moveForward >= f && !this.sprinting && foodOk && !this.usingItem && !this.blind) {
      if (this.sprintToggleTimer <= 0 && !input.sprint) this.sprintToggleTimer = 7;
      else this.sprinting = true;
    }
    if (!this.sprinting && (!this.inWater || this.eyesInWater) && moveForward >= f && foodOk && !this.usingItem && !this.blind && input.sprint) this.sprinting = true;
    if(this.sprinting) {
      const stopped=moveForward<f||!foodOk;
      if(this.swimming ? (!this.onGround&&!sneakKey&&stopped||!this.inWater) : (stopped||this.collidedH||this.inWater&&!this.eyesInWater))this.sprinting=false;
    }
    // The server confirms this through entity metadata bit 4 for remote
    // players; local prediction keeps the hitbox and camera responsive.
    this.swimming = !!(this.inWater && (this.swimming || this.eyesInWater) && this.sprinting && !this.ridingEntity && !this.flying);

    // Fly toggle (double tap jump)
    if (this.allowFlying) {
      if (this.spectator) {
        if (!this.flying) { this.flying = true; result.abilitiesChanged = true; }
      } else if (!this.prevJump && jump) {
        if (this.flyToggleTimer === 0) this.flyToggleTimer = 7;
        else { this.flying = !this.flying; result.abilitiesChanged = true; this.flyToggleTimer = 0; }
      }
    }
    // ItemElytra: jumping in mid air while falling asks the server to start gliding
    if (jump && !this.prevJump && !this.onGround && this.motionY < 0 && !this.elytraFlying && !this.flying && input.elytraUsable) {
      result.startFallFlying = true;
    }
    if (this.flying) {
      // EntityPlayerSP: sneaking while flying only descends, the 0.3 slowdown is divided back out
      if (sneakKey) {
        moveStrafe = f32(moveStrafe / 0.3); moveForward = f32(moveForward / 0.3);
        this.motionY -= f32(this.flySpeed * 3);
      }
      if (jump) this.motionY += f32(this.flySpeed * 3);
    }
    this.prevJump = jump;
    this.prevForwardHeld = moveForward >= f; // movementInput.moveForward as the next tick starts
    this.prevSneak = sneakKey;

    // EntityLivingBase.onLivingUpdate
    if (this.jumpTicks > 0) this.jumpTicks--;
    // 1.9+: motion below 0.003 is dropped (1.8: 0.005)
    if (Math.abs(this.motionX) < 0.003) this.motionX = 0;
    if (Math.abs(this.motionY) < 0.003) this.motionY = 0;
    if (Math.abs(this.motionZ) < 0.003) this.motionZ = 0;

    this.jumping = jump;
    if(this.inWater&&sneakKey&&!this.flying)this.motionY-=f32(0.04);
    if (jump) {
      if (this.inWater || this.isInLava(world)) this.motionY += 0.03999999910593033; // handleJumpWater / Lava: 0.04F
      else if (this.onGround && this.jumpTicks === 0) { this.jump(); this.jumpTicks = 10; }
    } else {
      this.jumpTicks = 0;
    }
    moveStrafe = f32(moveStrafe * F.p098);
    moveForward = f32(moveForward * F.p098);

    this.noClip = this.spectator;
    this.moveEntityWithHeading(world, moveStrafe, moveForward);

    if (this.onGround && this.flying && !this.spectator) {
      this.flying = false;
      result.abilitiesChanged = true;
    }

    this.ticksElytraFlying = this.elytraFlying ? this.ticksElytraFlying + 1 : 0;
    // EntityPlayer.onLivingUpdate after super: jumpMovementFactor and setAIMoveSpeed for the *next* tick
    this.jumpMovementFactor = this.sprinting ? f32(F.p02 + F.p02 * 0.3) : F.p02;
    this.landMovementFactor = this.aiMoveSpeed();

    if (this.riptideTicks > 0) this.riptideTicks--;
    if (this.collidedH) this.riptideTicks = 0;
    if (this.riptideTicks === 0) this.riptide = false;

    // View bobbing values (EntityPlayer.onLivingUpdate)
    let f1 = Math.sqrt(this.motionX * this.motionX + this.motionZ * this.motionZ);
    let f2 = f32(Math.atan(-this.motionY * 0.20000000298023224) * 15);
    f1 = f32(f1);
    if (f1 > 0.1) f1 = 0.1;
    if (!this.onGround || this.health <= 0) f1 = 0;
    if (this.onGround || this.health <= 0) f2 = 0;
    this.cameraYaw += (f1 - this.cameraYaw) * 0.4;
    this.cameraPitch += (f2 - this.cameraPitch) * 0.8;
    // EntityPlayer.onUpdate (end): size for the next tick
    this.updateSize(world);
    return result;
  }
}
