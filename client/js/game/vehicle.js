// Vehicles the local player controls (1.9+: the client moves its vehicle and reports it with CPacketVehicleMove).
// Boats are ports of EntityBoat (water status, glide, paddles), horses of AbstractHorse.travel; both move with
// the player's collision code (a LocalPlayer used as the vehicle's body).
import { getBlock } from '../world/blocks.js';
import { getFluidState, fluidHeightAt } from '../world/fluids.js';
import { LocalPlayer, mcSin, mcCos } from './physics.js';

const f32 = Math.fround;
const DEG = f32(0.017453292);
const wrap = (a) => { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; };

// BlockLiquid.getBlockLiquidHeight / getLiquidHeight for water
function waterState(world, x, y, z) { const s = world.getState(x, y, z); return getFluidState(s)?.isWater ? s : -1; }
function blockLiquidHeight(world, s, x, y, z) {
  return f32(fluidHeightAt(world, x, y, z));
}

export class BoatController {
  constructor(world, e) {
    this.world = world;
    this.e = e;
    const b = this.body = new LocalPlayer();
    b.entity = e; // collisions skip this vehicle and its passengers
    b.width = f32(1.375); b.height = f32(0.5625); b.stepHeight = 0;
    b.setPosition(e.x, e.y, e.z);
    this.yaw = e.yaw;
    this.deltaRotation = 0;
    this.status = this.previousStatus = null;
    this.waterLevel = 0; this.lastYd = 0; this.boatGlide = 0; this.momentum = 0.05;
    this.paddles = [false, false];
  }

  bb() { return this.body.bb(); }

  // EntityBoat.getWaterLevelAbove
  _waterLevelAbove() {
    const bb = this.bb(), w = this.world;
    const i = Math.floor(bb[0]), j = Math.ceil(bb[3]), k = Math.floor(bb[4]), l = Math.ceil(bb[4] - this.lastYd);
    const i1 = Math.floor(bb[2]), j1 = Math.ceil(bb[5]);
    outer:
    for (let k1 = k; k1 < l; k1++) {
      let f = 0;
      for (let l1 = i; l1 < j; l1++) {
        for (let i2 = i1; i2 < j1; i2++) {
          const s = waterState(w, l1, k1, i2);
          if (s >= 0) f = Math.max(f, blockLiquidHeight(w, s, l1, k1, i2));
          if (f >= 1) continue outer;
        }
      }
      if (f < 1) return f32(k1 + f);
    }
    return f32(l + 1);
  }

  // EntityBoat.getBoatGlide: average slipperiness of the blocks under the boat
  _boatGlide() {
    const bb = this.bb(), w = this.world;
    const bb1 = [bb[0], bb[1] - 0.001, bb[2], bb[3], bb[1], bb[5]];
    const i = Math.floor(bb1[0]) - 1, j = Math.ceil(bb1[3]) + 1, k = Math.floor(bb1[1]) - 1, l = Math.ceil(bb1[4]) + 1;
    const i1 = Math.floor(bb1[2]) - 1, j1 = Math.ceil(bb1[5]) + 1;
    let f = 0, n = 0;
    const out = [];
    for (let l1 = i; l1 < j; l1++) {
      for (let i2 = i1; i2 < j1; i2++) {
        const j2 = (l1 !== i && l1 !== j - 1 ? 0 : 1) + (i2 !== i1 && i2 !== j1 - 1 ? 0 : 1);
        if (j2 === 2) continue;
        for (let k2 = k; k2 < l; k2++) {
          if (j2 > 0 && (k2 === k || k2 === l - 1)) continue;
          out.length = 0;
          w.collisionBoxes(l1, k2, i2, out);
          const hit = out.some((c) => c[3] > bb1[0] && c[0] < bb1[3] && c[4] > bb1[1] && c[1] < bb1[4] && c[5] > bb1[2] && c[2] < bb1[5]);
          if (hit) { const b = getBlock(w.getState(l1, k2, i2)); f = f32(f + (b ? b.slipperiness : 0.6)); n++; }
        }
      }
    }
    return f32(f / n);
  }

  // EntityBoat.checkInWater
  _checkInWater() {
    const bb = this.bb(), w = this.world;
    const i = Math.floor(bb[0]), j = Math.ceil(bb[3]), k = Math.floor(bb[1]), l = Math.ceil(bb[1] + 0.001), i1 = Math.floor(bb[2]), j1 = Math.ceil(bb[5]);
    let flag = false;
    this.waterLevel = -Number.MAX_VALUE;
    for (let x = i; x < j; x++) for (let y = k; y < l; y++) for (let z = i1; z < j1; z++) {
      const s = waterState(w, x, y, z);
      if (s < 0) continue;
      const f = f32(y + blockLiquidHeight(w, s, x, y, z));
      this.waterLevel = Math.max(f, this.waterLevel);
      flag = flag || bb[1] < f;
    }
    return flag;
  }

  // EntityBoat.getUnderwaterStatus
  _underwater() {
    const bb = this.bb(), w = this.world;
    const d0 = bb[4] + 0.001;
    const i = Math.floor(bb[0]), j = Math.ceil(bb[3]), k = Math.floor(bb[4]), l = Math.ceil(d0), i1 = Math.floor(bb[2]), j1 = Math.ceil(bb[5]);
    let flag = false;
    for (let x = i; x < j; x++) for (let y = k; y < l; y++) for (let z = i1; z < j1; z++) {
      const s = waterState(w, x, y, z);
      if (s >= 0 && d0 < y + blockLiquidHeight(w, s, x, y, z)) {
        if (!getFluidState(s).source) return 'under_flowing';
        flag = true;
      }
    }
    return flag ? 'under' : null;
  }

  // EntityBoat.getBoatStatus
  _status() {
    const u = this._underwater();
    if (u) { this.waterLevel = this.bb()[4]; return u; }
    if (this._checkInWater()) return 'water';
    const f = this._boatGlide();
    if (f > 0) { this.boatGlide = f; return 'land'; }
    return 'air';
  }

  // EntityBoat.updateMotion
  _updateMotion() {
    const b = this.body;
    let d1 = -0.03999999910593033, d2 = 0;
    this.momentum = 0.05;
    if (this.previousStatus === 'air' && this.status !== 'air' && this.status !== 'land') {
      this.waterLevel = this.bb()[1] + b.height;
      b.setPosition(b.x, this._waterLevelAbove() - b.height + 0.101, b.z);
      b.motionY = 0;
      this.lastYd = 0;
      this.status = 'water';
      return;
    }
    if (this.status === 'water') { d2 = (this.waterLevel - this.bb()[1]) / b.height; this.momentum = 0.9; }
    else if (this.status === 'under_flowing') { d1 = -7.0e-4; this.momentum = 0.9; }
    else if (this.status === 'under') { d2 = 0.009999999776482582; this.momentum = 0.45; }
    else if (this.status === 'air') this.momentum = 0.9;
    else if (this.status === 'land') { this.momentum = this.boatGlide; this.boatGlide /= 2; }
    this.momentum = f32(this.momentum);
    b.motionX *= this.momentum;
    b.motionZ *= this.momentum;
    this.deltaRotation = f32(this.deltaRotation * this.momentum);
    b.motionY += d1;
    if (d2 > 0) { b.motionY += d2 * 0.06153846016296973; b.motionY *= 0.75; }
  }

  // EntityBoat.controlBoat with the rider's movement keys
  _control(inp) {
    const b = this.body;
    let f = 0;
    if (inp.left) this.deltaRotation = f32(this.deltaRotation - 1);
    if (inp.right) this.deltaRotation = f32(this.deltaRotation + 1);
    if (inp.right !== inp.left && !inp.forward && !inp.back) f = f32(f + 0.005);
    this.yaw = f32(this.yaw + this.deltaRotation);
    if (inp.forward) f = f32(f + 0.04);
    if (inp.back) f = f32(f - 0.005);
    b.motionX += f32(mcSin(f32(-this.yaw * DEG)) * f);
    b.motionZ += f32(mcCos(f32(this.yaw * DEG)) * f);
    this.paddles = [(inp.right && !inp.left) || !!inp.forward, (inp.left && !inp.right) || !!inp.forward];
  }

  // EntityBoat.onUpdate for the controlling client; returns the packets' data
  tick(inp) {
    const b = this.body;
    this.previousStatus = this.status;
    this.status = this._status();
    b.prevX = b.x; b.prevY = b.y; b.prevZ = b.z;
    this._updateMotion();
    this._control(inp);
    b.yaw = this.yaw;
    b.moveEntity(this.world, b.motionX, b.motionY, b.motionZ);
    this.lastYd = b.motionY;
    return { paddles: this.paddles };
  }

  // EntityBoat.updatePassenger + applyYawToEntity: the rider turns with the boat, at most 105 degrees off its heading
  applyToRider(pl) {
    pl.yaw += this.deltaRotation;
    const f = wrap(pl.yaw - this.yaw);
    const f1 = Math.max(-105, Math.min(105, f));
    pl.prevYaw += f1 - f;
    pl.yaw += f1 - f;
  }

  setFromServer(x, y, z, yaw) { this.body.setPosition(x, y, z); this.yaw = yaw; }
}

export class HorseController {
  constructor(world, e) {
    this.world = world;
    this.e = e;
    const b = this.body = new LocalPlayer();
    b.entity = e; // collisions skip this vehicle and its passengers
    b.width = f32(e.width || 1.3964844); b.height = f32(e.height || 1.6); b.stepHeight = 1;
    b.setPosition(e.x, e.y, e.z);
    b.yaw = e.yaw;
    this.jumpPower = 0; this.jumping = false;
  }

  // AbstractHorse.setJumpPower (from the jump bar, 0..100)
  setJumpPower(p) {
    if (p < 0) p = 0;
    this.jumpPower = p >= 90 ? 1 : f32(0.4 + f32(0.4 * p / 90));
  }

  // AbstractHorse.travel while ridden by the local player. strafe / forward: the rider's moveStrafing / moveForward
  // (movement input x 0.98)
  tick(pl, strafe, forward, attrs) {
    const b = this.body;
    b.prevX = b.x; b.prevY = b.y; b.prevZ = b.z;
    b.yaw = pl.yaw; b.pitch = f32(pl.pitch * 0.5);
    strafe = f32(strafe * 0.5);
    if (forward <= 0) forward = f32(forward * 0.25);
    if (this.jumpPower > 0 && !this.jumping && b.onGround) {
      b.motionY = attrs.jumpStrength * this.jumpPower;
      if (attrs.jumpBoost >= 0) b.motionY += f32((attrs.jumpBoost + 1) * f32(0.1));
      this.jumping = true;
      if (forward > 0) {
        const s = mcSin(f32(b.yaw * DEG)), c = mcCos(f32(b.yaw * DEG));
        b.motionX += f32(f32(-0.4 * s) * this.jumpPower);
        b.motionZ += f32(f32(0.4 * c) * this.jumpPower);
      }
      this.jumpPower = 0;
    }
    b.jumpMovementFactor = f32(b.landMovementFactor * 0.1);
    b.landMovementFactor = f32(attrs.speed);
    b.handleWaterMovement(this.world);
    b.inLava = b.isInLava(this.world);
    b.moveEntityWithHeading(this.world, strafe, forward);
    if (b.onGround) { this.jumpPower = 0; this.jumping = false; }
  }

  setFromServer(x, y, z, yaw) { this.body.setPosition(x, y, z); this.body.yaw = yaw; }
}
