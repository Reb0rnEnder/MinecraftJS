// Port of vanilla 1.8.9 player movement physics (EntityPlayerSP / EntityLivingBase / Entity).
import { blocks } from '../world/blocks.js';

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
const offsetBB = (bb, x, y, z) => [bb[0] + x, bb[1] + y, bb[2] + z, bb[3] + x, bb[4] + y, bb[5] + z];
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
    this.inWater = false; this.inLava = false; this.inWeb = false;
    this.fallDistance = 0;
    this.jumpTicks = 0;
    this.sneaking = false; this.sprinting = false;
    this.flying = false; this.allowFlying = false; this.creative = false; this.invulnerable = false;
    this.spectator = false; this.noClip = false;
    this.flySpeed = 0.05; this.walkSpeed = 0.1;
    this.speedAttr = { base: 0.1, modifiers: [] };
    this.food = 20;
    this.sprintToggleTimer = 0; this.flyToggleTimer = 0;
    this.prevJump = false; this.prevForwardHeld = false; this.prevSneak = false;
    this.usingItem = false;
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
    this._bb = null;
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
    const cube = (xx, yy, zz) => { const b = blocks[world.getState(xx, yy, zz) >> 4]; return !!(b && b.opaque && !b.isLiquid); };
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
      const b = blocks[world.getState(x, y, z) >> 4];
      if (b && test(b)) return true;
    }
    return false;
  }

  handleWaterMovement(world) {
    // Entity.handleWaterMovement: the box shrunk by 0.4F at top and bottom (expand(0, -0.4F, 0)), then by 0.001;
    // World.handleMaterialAcceleration walks floor(min) .. floor(max + 1) exclusive, if the area is loaded
    const bb0 = this.bb();
    const bb = [bb0[0] + 0.001, bb0[1] + 0.4000000059604645 + 0.001, bb0[2] + 0.001, bb0[3] - 0.001, bb0[4] - 0.4000000059604645 - 0.001, bb0[5] - 0.001];
    const x0 = Math.floor(bb[0]), x1 = Math.floor(bb[3] + 1);
    const y0 = Math.floor(bb[1]), y1 = Math.floor(bb[4] + 1);
    const z0 = Math.floor(bb[2]), z1 = Math.floor(bb[5] + 1);
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
      if (!world.isLoaded(x, z)) { this.inWater = false; return false; }
    }
    let found = false;
    let fx = 0, fy = 0, fz = 0;
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
      const s = world.getState(x, y, z);
      const b = blocks[s >> 4];
      if (!b || !b.isWater) continue;
      const lvl = s & 15;
      const pct = f32(((lvl >= 8 ? 0 : lvl) + 1) / 9); // BlockLiquid.getLiquidHeightPercent
      if (y1 >= f32(f32(y + 1) - pct)) {
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
      const b = blocks[s >> 4];
      if (!b || !b.isLiquid || b.isLava !== lava) return -1;
      const l = s & 15;
      return l >= 8 ? 0 : l;
    };
    const i = decay(x, y, z);
    let vx = 0, vy = 0, vz = 0;
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      let j = decay(x + dx, y, z + dz);
      if (j < 0) {
        const b = blocks[world.getState(x + dx, y, z + dz) >> 4];
        if (!b || b.boundingBox !== 'block' || b.id === 0) {
          j = decay(x + dx, y - 1, z + dz);
          if (j >= 0) { const k = j - (i - 8); vx += dx * k; vz += dz * k; }
        }
      } else { const k = j - i; vx += dx * k; vz += dz * k; }
    }
    if ((world.getState(x, y, z) & 15) >= 8) {
      // Falling liquid pushes down when next to solid sides
      let solidSide = false;
      for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const b = blocks[world.getState(x + dx, y, z + dz) >> 4];
        const b2 = blocks[world.getState(x + dx, y + 1, z + dz) >> 4];
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
    return this.isMaterialInBB(world, [bb[0] + 0.1, bb[1] + 0.4, bb[2] + 0.1, bb[3] - 0.1, bb[4] - 0.4, bb[5] - 0.1], (b) => b.isLava);
  }

  isOffsetPositionInLiquid(world, dx, dy, dz) {
    const bb = offsetBB(this.bb(), dx, dy, dz);
    if (world.getCollisions(bb, this).length) return false;
    return !this.isMaterialInBB(world, bb, (b) => b.isLiquid) ? false : true;
  }

  isOnLadder(world) {
    const b = blocks[world.getState(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)) >> 4];
    return !!b && (b.name === 'ladder' || b.name === 'vine') && !this.spectator;
  }

  // --- Core movement ---

  // Entity.moveFlying (all float maths, added to the double motion)
  moveFlying(strafe, forward, friction) {
    const fr = Math.fround;
    strafe = fr(strafe); forward = fr(forward); friction = fr(friction);
    let f = fr(fr(strafe * strafe) + fr(forward * forward));
    if (f >= fr(1.0e-4)) {
      f = fr(Math.sqrt(f));
      if (f < 1) f = 1;
      f = fr(friction / f);
      strafe = fr(strafe * f); forward = fr(forward * f);
      const a = fr(fr(fr(this.yaw) * F_PI) / 180);
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
      const empty = (bx, bz) => world.getCollisions(offsetBB(bb, bx, -1, bz), this).length === 0;
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

    // Entity.moveEntity: the block landed on / walked on, floor(y - 0.2), or the fence / wall / gate below an air block
    let lbx = Math.floor(this.x), lby = Math.floor(this.y - 0.20000000298023224), lbz = Math.floor(this.z);
    let lst = world.getState(lbx, lby, lbz), lb = blocks[lst >> 4];
    if (!lb || lb.id === 0) {
      const b2 = blocks[world.getState(lbx, lby - 1, lbz) >> 4];
      if (b2 && (b2.isFence || b2.isWall || b2.isFenceGate)) { lby--; lst = world.getState(lbx, lby, lbz); lb = b2; }
    }

    // Entity.updateFallState -> Block.onFallenUpon -> EntityPlayer.fall (slime: no damage unless sneaking, hay: 20%)
    if (this.onGround) {
      if (this.fallDistance > 0 && this.onFall && !this.allowFlying) {
        const st = lst;
        const mult = lb && lb.name === 'slime' && !this.sneaking ? 0 : lb && lb.name === 'hay_block' ? 0.2 : 1;
        const dmg = Math.ceil((this.fallDistance - 3 - (this.jumpBoost >= 0 ? this.jumpBoost + 1 : 0)) * mult);
        if (dmg > 0) this.onFall(dmg, st);
      }
      this.fallDistance = 0;
    } else if (y < 0) this.fallDistance = f32(this.fallDistance - y);

    if (dx0 !== x) this.motionX = 0;
    if (dz0 !== z) this.motionZ = 0;
    if (d4 !== y) {
      // Block.onLanded: slime bounces back unless sneaking
      if (!lb || lb.name !== 'slime' || this.sneaking) this.motionY = 0;
      else if (this.motionY < 0) this.motionY = -this.motionY;
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
        if (this.inWater) {
          if (this.onSwim) this.onSwim(Math.min(1, Math.sqrt(this.motionX * this.motionX * 0.2 + this.motionY * this.motionY + this.motionZ * this.motionZ * 0.2) * 0.35));
        }
        if (this.onStep) this.onStep(bx, by, bz, st); // Block.playStepSound skips liquids
      }
    }
    this._lastX = this.x; this._lastY = this.y; this._lastZ = this.z;

    this.doBlockCollisions(world);
  }

  doBlockCollisions(world) {
    const bb = this.bb();
    const x0 = Math.floor(bb[0] + 0.001), x1 = Math.floor(bb[3] - 0.001);
    const y0 = Math.floor(bb[1] + 0.001), y1 = Math.floor(bb[4] - 0.001);
    const z0 = Math.floor(bb[2] + 0.001), z1 = Math.floor(bb[5] - 0.001);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const b = blocks[world.getState(x, y, z) >> 4];
      if (!b || b.id === 0) continue;
      if (b.name === 'web') this.inWeb = true;
      else if (b.name === 'soul_sand') { this.motionX *= 0.4; this.motionZ *= 0.4; }
    }
    // Slime: walking on it slows you
    const below = blocks[world.getState(Math.floor(this.x), Math.floor(this.y - 0.20000000298023224), Math.floor(this.z)) >> 4];
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

  moveEntityWithHeading(world, strafe, forward) {
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
    if (this.inWater && !this.flying) {
      const d0 = this.y;
      let f1 = F.p08, f2 = F.p02;
      let f3 = this.depthStrider;
      if (f3 > 3) f3 = 3;
      if (!this.onGround) f3 *= 0.5;
      if (f3 > 0) {
        f1 = Math.fround(f1 + Math.fround(Math.fround(Math.fround(0.54600006) - f1) * f3) / 3);
        f2 = Math.fround(f2 + Math.fround(Math.fround(this.landMovementFactor - f2) * f3) / 3);
      }
      this.moveFlying(strafe, forward, f2);
      this.moveEntity(world, this.motionX, this.motionY, this.motionZ);
      this.motionX *= f1; this.motionY *= 0.800000011920929; this.motionZ *= f1;
      this.motionY -= 0.02;
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
        const b = blocks[world.getState(Math.floor(this.x), Math.floor(this.bb()[1]) - 1, Math.floor(this.z)) >> 4];
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
      if (!world.isLoaded(Math.floor(this.x), Math.floor(this.z))) {
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

    if (this.sprintToggleTimer > 0) this.sprintToggleTimer--;
    if (this.flyToggleTimer > 0) this.flyToggleTimer--;

    // MovementInputFromOptions
    let moveForward = 0, moveStrafe = 0;
    if (input.forward) moveForward++;
    if (input.back) moveForward--;
    if (input.left) moveStrafe++;
    if (input.right) moveStrafe--;
    const jump = !!input.jump;
    const sneakKey = !!input.sneak;
    if (sneakKey) { moveStrafe = f32(moveStrafe * 0.3); moveForward = f32(moveForward * 0.3); }
    if (this.usingItem && !this.ridingEntity) { moveStrafe = f32(moveStrafe * F.p02b); moveForward = f32(moveForward * F.p02b); this.sprintToggleTimer = 0; }
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
    if (this.onGround && !this.prevSneak && !this.prevForwardHeld && moveForward >= f && !this.sprinting && foodOk && !this.usingItem && !this.blind) {
      if (this.sprintToggleTimer <= 0 && !input.sprint) this.sprintToggleTimer = 7;
      else this.sprinting = true;
    }
    if (!this.sprinting && moveForward >= f && foodOk && !this.usingItem && !this.blind && input.sprint) this.sprinting = true;
    if (this.sprinting && (moveForward < f || this.collidedH || !foodOk)) this.sprinting = false;

    // Fly toggle (double tap jump)
    if (this.allowFlying) {
      if (this.spectator) {
        if (!this.flying) { this.flying = true; result.abilitiesChanged = true; }
      } else if (!this.prevJump && jump) {
        if (this.flyToggleTimer === 0) this.flyToggleTimer = 7;
        else { this.flying = !this.flying; result.abilitiesChanged = true; this.flyToggleTimer = 0; }
      }
    }
    if (this.flying) {
      if (sneakKey) this.motionY -= f32(this.flySpeed * 3);
      if (jump) this.motionY += f32(this.flySpeed * 3);
    }
    this.prevJump = jump;
    this.prevForwardHeld = moveForward >= f;
    this.prevSneak = sneakKey;

    // EntityLivingBase.onLivingUpdate
    if (this.jumpTicks > 0) this.jumpTicks--;
    if (Math.abs(this.motionX) < 0.005) this.motionX = 0;
    if (Math.abs(this.motionY) < 0.005) this.motionY = 0;
    if (Math.abs(this.motionZ) < 0.005) this.motionZ = 0;

    if (jump) {
      if (this.inWater || this.isInLava(world)) this.motionY += 0.03999999910593033; // updateAITick / handleJumpLava: 0.04F
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

    // EntityPlayer.onLivingUpdate after super: jumpMovementFactor and setAIMoveSpeed for the *next* tick
    this.jumpMovementFactor = this.sprinting ? f32(F.p02 + F.p02 * 0.3) : F.p02;
    this.landMovementFactor = this.aiMoveSpeed();

    // View bobbing values (EntityPlayer.onLivingUpdate)
    let f1 = Math.sqrt(this.motionX * this.motionX + this.motionZ * this.motionZ);
    let f2 = f32(Math.atan(-this.motionY * 0.20000000298023224) * 15);
    f1 = f32(f1);
    if (f1 > 0.1) f1 = 0.1;
    if (!this.onGround || this.health <= 0) f1 = 0;
    if (this.onGround || this.health <= 0) f2 = 0;
    this.cameraYaw += (f1 - this.cameraYaw) * 0.4;
    this.cameraPitch += (f2 - this.cameraPitch) * 0.8;
    return result;
  }
}
