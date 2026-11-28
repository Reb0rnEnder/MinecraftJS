import { WorldBorder } from './world-border.js';

// 1.21.11 MovingBorderExtent counts game ticks, not Util.getMillis(). Keep
// the older helper separate: packet fields retain their historical names.
export class WorldBorder774 extends WorldBorder {
  constructor() { super(() => 0); }

  reset() {
    super.reset();
    this.previousSize = this.currentSize = this.targetSize;
    this.remainingTicks = 0n;
    this.totalTicks = 0n;
  }

  get size() { return this.currentSize; }
  get remaining() { return this.remainingTicks; }
  get speed() { return this.totalTicks > 0n ? Math.abs(this.targetSize - this.oldSize) / Number(this.totalTicks) : 0; }

  setSize(size) {
    super.setSize(size);
    this.previousSize = this.currentSize = size;
    this.remainingTicks = this.totalTicks = 0n;
  }

  lerp(oldSize, newSize, ticks) {
    if (oldSize === newSize) { this.setSize(newSize); return; }
    this.oldSize = oldSize;
    this.targetSize = newSize;
    this.remainingTicks = this.totalTicks = BigInt(ticks);
    this.duration = Number(ticks);
    this.previousSize = this.currentSize = oldSize;
  }

  tick() {
    if (!this.duration) return;
    this.remainingTicks--;
    this.previousSize = this.currentSize;
    // Native stores duration as double, converting the long countdown before
    // subtraction (including its rounding for very long transitions).
    const progress = (Number(this.totalTicks) - Number(this.remainingTicks)) / Number(this.totalTicks);
    this.currentSize = progress < 1 ? this.oldSize + progress * (this.targetSize - this.oldSize) : this.targetSize;
    if (this.remainingTicks <= 0n) this.setSize(this.targetSize);
  }

  bounds(partial = 0) {
    const size = this.previousSize + Math.fround(partial) * (this.currentSize - this.previousSize);
    const r = size / 2, m = this.absoluteMaxSize;
    const clamp = n => Math.max(-m, Math.min(m, n));
    return [clamp(this.x - r), clamp(this.z - r), clamp(this.x + r), clamp(this.z + r)];
  }

  warning(x, z) {
    const distance = Math.fround(this.distance(x, z));
    const reach = Math.max(this.warningBlocks, Math.min(this.speed * this.warningTime, Math.abs(this.targetSize - this.size)));
    return distance < reach ? Math.fround(1 - Math.fround(distance / reach)) : 0;
  }
}
