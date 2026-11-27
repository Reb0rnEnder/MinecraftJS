// TickRateManager (1.20.3+, the client copy kept by ClientLevel): server tick rate, freezing and stepping from
// ClientboundTickingStatePacket / ClientboundTickingStepPacket.
export class TickRateManager {
  constructor() { this.tickrate = 20; this.msPerTick = 50; this.frozenTicksToRun = 0; this.runGameElements = true; this.frozen = false; }
  setTickRate(rate) { if (!Number.isFinite(rate)) return; this.tickrate = Math.max(rate, 1); this.msPerTick = 1000 / this.tickrate; }
  setFrozen(frozen) { this.frozen = !!frozen; }
  setFrozenTicksToRun(n) { this.frozenTicksToRun = Number.isFinite(n) ? n : 0; }
  runsNormally() { return this.runGameElements; }
  isSteppingForward() { return this.frozenTicksToRun > 0; }
  // Minecraft.tick, once per client tick unless paused
  tick() {
    this.runGameElements = !this.frozen || this.frozenTicksToRun > 0;
    if (this.frozenTicksToRun > 0) this.frozenTicksToRun--;
  }
  // isEntityFrozen: everything but players and entities carrying a player stops while the game does not run
  isEntityFrozen(e, carriesPlayer) { return !this.runGameElements && e.kind !== 'player' && !carriesPlayer; }
}

// Minecraft.getTickTargetMillis: a slower server slows the client's ticks; a faster one does not speed them up
export function clientTickMillis(manager, inLevel, defaultMs = 50) {
  return inLevel && manager && manager.runsNormally() ? Math.max(defaultMs, manager.msPerTick) : defaultMs;
}
