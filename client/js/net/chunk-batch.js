// 1.20.2+ ChunkBatchSizeCalculator: native time-weighted feedback, in ms.
// The response is desired chunks per tick, not the size of the last batch.
export class ChunkBatchCalculator {
  constructor(now = () => performance.now()) {
    this.now = now;
    this.averageMs = 2;
    this.weight = 1;
    this.started = now();
  }
  start() { this.started = this.now(); }
  finish(size) {
    if (size > 0) {
      const perChunk = (this.now() - this.started) / size;
      const sample = Math.max(this.averageMs / 3, Math.min(this.averageMs * 3, perChunk));
      this.averageMs = (this.averageMs * this.weight + sample) / (this.weight + 1);
      this.weight = Math.min(49, this.weight + 1);
    }
    return Math.fround(7 / this.averageMs);
  }
}
