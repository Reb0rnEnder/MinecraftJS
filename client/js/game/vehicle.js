// The boat the local player rides. In 1.8 the server moves the boat from the rider's steering input (C0C), but the
// client runs EntityBoat.onUpdate's physics for a boat it sits in (isBoatEmpty false) and only takes the server's
// position on a teleport: this is that simulation, moving with the player's collision code (a LocalPlayer as the body).
import { blocks } from '../world/blocks.js';
import { LocalPlayer } from './physics.js';

const f32 = Math.fround;
const wrap = (a) => { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; };

// World.isAABBInMaterial for water: floor(min) .. floor(max + 1), the water surface at y + 1 - level / 8
function inWater(world, bb) {
  const x0 = Math.floor(bb[0]), x1 = Math.floor(bb[3] + 1), y0 = Math.floor(bb[1]), y1 = Math.floor(bb[4] + 1);
  const z0 = Math.floor(bb[2]), z1 = Math.floor(bb[5] + 1);
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
    const s = world.getState(x, y, z), b = blocks[s >> 4];
    if (!b || !b.isWater) continue;
    const lvl = s & 15;
    const top = lvl < 8 ? y + 1 - lvl / 8 : y + 1;
    if (top >= bb[1]) return true;
  }
  return false;
}

export class BoatController {
  constructor(world, e) {
    this.world = world;
    this.e = e;
    const b = this.body = new LocalPlayer();
    b.entity = e; // collisions skip this boat and its rider
    b.width = f32(1.5); b.height = f32(0.6); b.stepHeight = 0;
    b.setPosition(e.x, e.y, e.z);
    b.motionX = e.motionX || 0; b.motionY = e.motionY || 0; b.motionZ = e.motionZ || 0;
    this.yaw = e.yaw;
    this.speedMultiplier = 0.07;
  }

  // EntityBoat.onUpdate (not empty). strafe / forward: the rider's moveStrafing / moveForward, yaw its rotationYaw
  tick(strafe, forward, riderYaw) {
    const b = this.body, w = this.world;
    b.prevX = b.x; b.prevY = b.y; b.prevZ = b.z;
    // how much of the boat is in water, in five slices
    const bb = b.bb();
    let d0 = 0;
    for (let i = 0; i < 5; i++) {
      const y0 = bb[1] + (bb[4] - bb[1]) * i / 5 - 0.125, y1 = bb[1] + (bb[4] - bb[1]) * (i + 1) / 5 - 0.125;
      if (inWater(w, [bb[0], y0, bb[2], bb[3], y1, bb[5]])) d0 += 1 / 5;
    }
    const d3 = Math.sqrt(b.motionX * b.motionX + b.motionZ * b.motionZ);
    if (d0 < 1) b.motionY += 0.03999999910593033 * (d0 * 2 - 1);
    else {
      if (b.motionY < 0) b.motionY /= 2;
      b.motionY += 0.007000000216066837;
    }
    // the rider steers
    const f = f32(riderYaw + f32(-strafe * 90));
    const a = f32(f32(f * f32(Math.PI)) / 180);
    b.motionX += -Math.sin(a) * this.speedMultiplier * forward * 0.05000000074505806;
    b.motionZ += Math.cos(a) * this.speedMultiplier * forward * 0.05000000074505806;
    let d4 = Math.sqrt(b.motionX * b.motionX + b.motionZ * b.motionZ);
    if (d4 > 0.35) {
      const k = 0.35 / d4;
      b.motionX *= k; b.motionZ *= k;
      d4 = 0.35;
    }
    if (d4 > d3 && this.speedMultiplier < 0.35) {
      this.speedMultiplier += (0.35 - this.speedMultiplier) / 35;
      if (this.speedMultiplier > 0.35) this.speedMultiplier = 0.35;
    } else {
      this.speedMultiplier -= (this.speedMultiplier - 0.07) / 35;
      if (this.speedMultiplier < 0.07) this.speedMultiplier = 0.07;
    }
    if (b.onGround) { b.motionX *= 0.5; b.motionY *= 0.5; b.motionZ *= 0.5; }
    b.moveEntity(w, b.motionX, b.motionY, b.motionZ);
    // a fast crash breaks the boat on the server; the client keeps its motion until then
    if (!(b.collidedH && d3 > 0.2975)) {
      b.motionX *= 0.9900000095367432; b.motionY *= 0.949999988079071; b.motionZ *= 0.9900000095367432;
    }
    // turn towards the direction of travel, at most 20 degrees a tick
    let d10 = this.yaw;
    const dx = b.prevX - b.x, dz = b.prevZ - b.z;
    if (dx * dx + dz * dz > 0.001) d10 = f32(Math.atan2(dz, dx) * 180 / Math.PI);
    const d = Math.max(-20, Math.min(20, wrap(d10 - this.yaw)));
    this.yaw = f32(this.yaw + d) % 360;
  }

  // S18PacketEntityTeleport (setPositionAndRotation2 with the teleport flag): the ridden boat snaps there and stops
  setFromServer(x, y, z, yaw) {
    const b = this.body;
    b.setPosition(x, y, z);
    b.prevX = x; b.prevY = y; b.prevZ = z;
    b.motionX = b.motionY = b.motionZ = 0;
    this.yaw = yaw;
  }
}
