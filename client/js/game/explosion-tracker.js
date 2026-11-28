// Port of 26.3 ClientExplosionTracker. The server sends an explosion's centre, radius,
// destroyed-block count and weighted block-particle list; the client spreads at most 512
// particles over the next tick, choosing a tracked explosion by block count and a particle
// type by weight, and skips positions inside solid blocks.
const MAX_PARTICLES_PER_TICK = 512;

function normalize(x, y, z) {
  const length = Math.sqrt(x * x + y * y + z * z);
  return length < 1e-4 ? [0, 0, 0] : [x / length, y / length, z / length];
}

// WeightedRandom.getRandomItem: one uniform draw over the summed weights, then a walk.
function pickWeighted(list, total, weightOf) {
  if (!(total > 0)) return null;
  let selection = Math.floor(Math.random() * total);
  for (const entry of list) {
    selection -= weightOf(entry);
    if (selection < 0) return entry;
  }
  return null;
}

export class ExplosionTracker {
  constructor(game) {
    this.game = game;
    this.explosions = [];
  }

  // ClientExplosionTracker.track only keeps lists that can actually spawn something.
  track(center, radius, blockCount, blockParticles) {
    if (blockParticles && blockParticles.length) this.explosions.push({ center, radius, blockCount, blockParticles });
  }

  clear() { this.explosions.length = 0; }

  tick() {
    if (!this.explosions.length) return;
    // Particle setting must be ALL; decreased/minimal drop the queued explosion effects.
    if (this.game.particles.setting() !== 0) { this.explosions.length = 0; return; }
    const totalBlocks = this.explosions.reduce((sum, explosion) => sum + explosion.blockCount, 0);
    const particles = Math.min(totalBlocks, MAX_PARTICLES_PER_TICK);
    for (let i = 0; i < particles; i++) {
      const explosion = pickWeighted(this.explosions, totalBlocks, (entry) => entry.blockCount);
      if (explosion) this._addParticle(explosion);
    }
    this.explosions.length = 0;
  }

  // ClientExplosionTracker.addParticle.
  _addParticle(explosion) {
    const [dx, dy, dz] = normalize(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    const distance = Math.cbrt(Math.random()) * explosion.radius;
    const x = explosion.center.x + dx * distance;
    const y = explosion.center.y + dy * distance;
    const z = explosion.center.z + dz * distance;
    const block = this.game.world.getBlockDef(Math.floor(x), Math.floor(y), Math.floor(z));
    if (block && !block.isAir) return;
    const speed = 0.5 / (distance / explosion.radius + 0.1) * Math.random() * Math.random() + 0.3;
    const totalWeight = explosion.blockParticles.reduce((sum, entry) => sum + entry.weight, 0);
    const picked = pickWeighted(explosion.blockParticles, totalWeight, (entry) => entry.weight);
    if (!picked) return;
    const info = picked.value;
    const px = explosion.center.x + dx * distance * info.scaling;
    const py = explosion.center.y + dy * distance * info.scaling;
    const pz = explosion.center.z + dz * distance * info.scaling;
    this.game.particles.at(info.particle, px, py, pz, dx * speed * info.speed, dy * speed * info.speed, dz * speed * info.speed);
  }
}
