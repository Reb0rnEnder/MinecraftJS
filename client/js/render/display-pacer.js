// MinecraftJS extra "Skip frames your display can't show". With VSync off the game loop runs as fast as it can;
// frames finished faster than the monitor refreshes are never seen. The loop still runs everything else (ticks,
// input, mouse look, chunk scheduling) every iteration, but only renders once per display refresh. This is not
// VSync: nothing waits for the display and the loop rate is not limited.
export class DisplayPacer {
  constructor(requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis)) {
    this.samples = [];
    this.interval = 0; // measured display refresh interval in ms (0 = unknown)
    this.raf = requestAnimationFrame;
    this.last = 0;
    if (this.raf) this.raf((t) => this._probe(t));
  }
  // A separate requestAnimationFrame probe measures the display's refresh interval (median of recent samples).
  _probe(t) {
    if (this.last) {
      const d = t - this.last;
      if (d > 2 && d < 100) { this.samples.push(d); if (this.samples.length > 60) this.samples.shift(); }
      if (this.samples.length >= 10) { const s = [...this.samples].sort((a, b) => a - b); this.interval = s[s.length >> 1]; }
    }
    this.last = t;
    this.raf((tt) => this._probe(tt));
  }
  // Whether to skip rendering now. Renders follow a deadline that advances one display refresh at a time, so the
  // rendered rate matches the display even when the loop rate is not a multiple of it (250 loop frames on 144 Hz
  // still render 144 times a second). After a stall the schedule restarts instead of bursting to catch up.
  shouldSkip(now) {
    if (!(this.interval > 0)) return false;
    if (!this.next || now - this.next > this.interval) this.next = now;
    if (now + 0.5 < this.next) return true;
    this.next += this.interval;
    return false;
  }
}
