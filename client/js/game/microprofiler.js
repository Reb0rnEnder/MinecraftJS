// MinecraftJS extra: MicroProfiler. While enabled it keeps the sectioned Profiler running every frame, wraps the
// main subsystems so each call becomes a nested section, times every network packet by type and counts draw calls.
// Every frame lands in a ring buffer (section times, frame time, rendered or skipped, draw calls, heap, chunk and
// entity counts) that feeds an on-screen overlay and can be exported as JSON or as a Chrome/Perfetto trace.
// Disabling it unwraps everything, so it costs nothing when off.
import { platform } from '../platform/platform.js';
import { profilerColor } from './profiler.js';

export const CAPACITY = 1200; // frames kept (about 10-20 s)
// [object path on the game, method, section name]. Missing objects/methods are skipped, so every release works.
const TARGETS = [
  ['', 'tick', 'gameTick'], ['', 'renderFrame', 'frame'],
  ['entities', 'tick', 'entities'], ['world', 'tick', 'world'], ['interaction', 'tick', 'interaction'],
  ['renderer', 'tick', 'rendererTick'], ['renderer', 'render', 'world'], ['renderer', 'renderPanorama', 'panorama'],
  ['entityRenderer', 'render', 'entities'], ['tileRenderer', 'render', 'blockEntities'], ['tileRenderer', 'tick', 'blockEntitiesTick'],
  ['particles', 'tick', 'particlesTick'], ['particles', 'render', 'particles'],
  ['hud', 'tick', 'hudTick'], ['screens', 'tick', 'screenTick'],
  ['sound', 'tick', 'sound'], ['menuBlur', 'render', 'menuBlur'], ['gui', 'end', 'guiSubmit'], ['device', 'endFrame', 'present'],
];

export class MicroProfiler {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.paused = false;
    this.overlay = 'compact'; // 'off' | 'compact' | 'detailed'
    this.wrapped = [];
    this.reset();
  }

  reset() {
    this.count = 0; this.head = 0;
    this.time = new Float64Array(CAPACITY); this.frameMs = new Float32Array(CAPACITY);
    this.rendered = new Uint8Array(CAPACITY); this.draws = new Uint32Array(CAPACITY);
    this.heap = new Float32Array(CAPACITY); this.entityCount = new Uint32Array(CAPACITY); this.chunkCount = new Uint32Array(CAPACITY);
    this.paths = []; this.pathIndex = new Map(); this.series = [];
    this.packets = new Map(); // name -> { count, ms, max }
    this.packetFrame = 0; this.drawFrame = 0; this.lastStamp = 0;
  }

  setEnabled(on) {
    on = !!on;
    if (on === this.enabled) return;
    this.enabled = on;
    const P = this.game.profiler;
    if (on) {
      this.reset();
      this._wrapAll();
      if (P) P.onFrame = (frame) => this.record(frame);
    } else {
      this._unwrapAll();
      if (P && P.onFrame) P.onFrame = null;
    }
  }

  _wrap(obj, method, fn) {
    const original = obj[method];
    if (typeof original !== 'function' || original.__microprofiled) return;
    const hadOwn = Object.prototype.hasOwnProperty.call(obj, method), wrapper = fn(original);
    wrapper.__microprofiled = true;
    obj[method] = wrapper;
    this.wrapped.push([obj, method, original, hadOwn]);
  }
  _wrapAll() {
    const g = this.game, P = g.profiler;
    for (const [path, method, name] of TARGETS) {
      const obj = path ? g[path] : g;
      if (!obj) continue;
      this._wrap(obj, method, (original) => function (...args) { P.start(name); try { return original.apply(this, args); } finally { P.end(); } });
    }
    const self = this;
    // Network packets: time each handler by packet name (handled outside the render frame)
    this._wrap(g, 'handlePacket', (original) => function (p) {
      const t0 = platform().now();
      try { return original.call(this, p); } finally {
        const ms = platform().now() - t0, key = p?.name || '?', s = self.packets.get(key) || { count: 0, ms: 0, max: 0 };
        s.count++; s.ms += ms; if (ms > s.max) s.max = ms; self.packets.set(key, s); self.packetFrame += ms;
      }
    });
    // Menus outside a world have no HUD pass: draw the overlay after the screen there
    if (g.screens) this._wrap(g.screens, 'render', (original) => function (gui, ...rest) { let r; P.start('screen'); try { r = original.call(this, gui, ...rest); } finally { P.end(); } if (!g.inWorld && self.overlay !== 'off') self.drawOverlay(gui); return r; });
    if (g.device) this._wrap(g.device, 'draw', (original) => function (...args) { self.drawFrame++; return original.apply(this, args); });
    // HUD time is measured as 'hud'; the overlay draws after it, outside the measurement
    if (g.hud) this._wrap(g.hud, 'render', (original) => function (gui, ...rest) { let r; P.start('hud'); try { r = original.call(this, gui, ...rest); } finally { P.end(); } if (self.overlay !== 'off') self.drawOverlay(gui); return r; });
  }
  _unwrapAll() {
    for (const [obj, method, original, hadOwn] of this.wrapped.reverse()) { if (hadOwn) obj[method] = original; else delete obj[method]; }
    this.wrapped = [];
  }

  _series(path) {
    let i = this.pathIndex.get(path);
    if (i === undefined) { i = this.paths.length; this.paths.push(path); this.pathIndex.set(path, i); this.series.push(new Float32Array(CAPACITY)); }
    return this.series[i];
  }

  // Profiler.endFrame hands over this frame's section times
  record(frame) {
    const now = platform().now(), g = this.game;
    if (this.paused) { this.packetFrame = 0; this.drawFrame = 0; this.lastStamp = now; return; }
    const i = this.head;
    this.time[i] = now;
    this.frameMs[i] = this.lastStamp ? now - this.lastStamp : 0;
    this.lastStamp = now;
    this.rendered[i] = frame.has('root.gameRenderer') || frame.has('root.gameRenderer.frame') ? 1 : 0;
    this.draws[i] = this.drawFrame; this.drawFrame = 0;
    this.heap[i] = (globalThis.performance?.memory?.usedJSHeapSize || 0) / 1048576;
    this.entityCount[i] = g.entities?.map?.size ?? 0;
    this.chunkCount[i] = g.world?.chunks?.size ?? 0;
    for (const s of this.series) s[i] = 0;
    for (const [path, ms] of frame) this._series(path)[i] = ms;
    this._series('packets')[i] = this.packetFrame; this.packetFrame = 0;
    this.head = (i + 1) % CAPACITY;
    if (this.count < CAPACITY) this.count++;
  }

  // Indexes of the last n recorded frames, oldest first
  recent(n = this.count) {
    n = Math.min(n, this.count);
    const out = [];
    for (let k = n; k > 0; k--) out.push((this.head - k + CAPACITY) % CAPACITY);
    return out;
  }

  // Section statistics over the last n frames: average, maximum and share of frame time
  stats(n = 120) {
    const idx = this.recent(n), frames = idx.length || 1;
    const frameAvg = idx.reduce((a, i) => a + this.frameMs[i], 0) / frames;
    const rows = this.paths.map((path, p) => {
      let sum = 0, max = 0; const s = this.series[p];
      for (const i of idx) { sum += s[i]; if (s[i] > max) max = s[i]; }
      return { path, name: path.replace(/^root\./, ''), avg: sum / frames, max, share: frameAvg > 0 ? sum / frames / frameAvg : 0 };
    });
    // Time between frame ends that no game-loop section covers: GPU work the browser waits on, compositing,
    // garbage collection, other tabs and idle time between loop iterations.
    const root = rows.find((r) => r.path === 'root'), outside = Math.max(0, frameAvg - (root ? root.avg : 0));
    if (frames > 1) rows.push({ path: 'outside', name: 'outside game loop (GPU, browser, GC, idle)', avg: outside, max: outside, share: frameAvg > 0 ? outside / frameAvg : 0 });
    rows.sort((a, b) => b.avg - a.avg);
    const sorted = idx.map((i) => this.frameMs[i]).sort((a, b) => a - b);
    const pct = (q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
    const span = idx.length > 1 ? (this.time[idx[idx.length - 1]] - this.time[idx[0]]) / 1000 : 0;
    const renderedCount = idx.reduce((a, i) => a + this.rendered[i], 0);
    return {
      frames: idx.length, frameAvg, p50: pct(.5), p95: pct(.95), p99: pct(.99), max: sorted[sorted.length - 1] || 0,
      processedFps: span > 0 ? (idx.length - 1) / span : 0, renderedFps: span > 0 ? renderedCount / span : 0,
      draws: idx.length ? idx.reduce((a, i) => a + this.draws[i], 0) / idx.length : 0,
      heap: idx.length ? this.heap[idx[idx.length - 1]] : 0, rows,
    };
  }

  packetStats() {
    return [...this.packets].map(([name, s]) => ({ name, count: s.count, ms: s.ms, avg: s.ms / s.count, max: s.max })).sort((a, b) => b.ms - a.ms);
  }

  // ------------------------------------------------------------------ export

  toJSON() {
    const idx = this.recent();
    return {
      format: 'minecraftjs-microprofiler', version: 1, capturedAt: new Date().toISOString(),
      userAgent: globalThis.navigator?.userAgent || null,
      settings: (({ renderDistance, maxFps, enableVsync, fancyGraphics, fabulousGraphics, skipUndisplayedFrames, simulationDistance, graphicsApi }) =>
        ({ renderDistance, maxFps, enableVsync, fancyGraphics, fabulousGraphics, skipUndisplayedFrames, simulationDistance, graphicsApi }))(this.game.settings || {}),
      device: this.game.device?.name || null,
      summary: this.stats(this.count),
      packets: this.packetStats(),
      frames: idx.map((i) => ({
        t: +this.time[i].toFixed(3), ms: +this.frameMs[i].toFixed(3), rendered: !!this.rendered[i], draws: this.draws[i],
        heapMB: +this.heap[i].toFixed(1), entities: this.entityCount[i], chunks: this.chunkCount[i],
        sections: Object.fromEntries(this.paths.map((p, k) => [p, +this.series[k][i].toFixed(3)]).filter(([, v]) => v > 0)),
      })),
    };
  }

  // Chrome trace event format (chrome://tracing, ui.perfetto.dev): each frame's sections become nested complete
  // events laid out from the frame start, plus counter tracks for frame time, draw calls and heap.
  toTrace() {
    const events = [{ name: 'process_name', ph: 'M', pid: 1, args: { name: 'MinecraftJS' } }, { name: 'thread_name', ph: 'M', pid: 1, tid: 1, args: { name: 'game loop' } }];
    for (const i of this.recent()) {
      const end = this.time[i] * 1000, start = end - this.frameMs[i] * 1000;
      events.push({ name: this.rendered[i] ? 'frame' : 'frame (not rendered)', ph: 'X', pid: 1, tid: 1, ts: start, dur: this.frameMs[i] * 1000 });
      // children start where their previous sibling ended, inside their parent
      const cursor = new Map([['', start]]);
      const present = this.paths.map((p, k) => [p, this.series[k][i]]).filter(([, v]) => v > 0).sort((a, b) => a[0].split('.').length - b[0].split('.').length);
      for (const [path, ms] of present) {
        const parent = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '';
        const ts = cursor.get(parent) ?? start;
        events.push({ name: path.slice(path.lastIndexOf('.') + 1), ph: 'X', pid: 1, tid: 1, ts, dur: ms * 1000, args: { path } });
        cursor.set(parent, ts + ms * 1000); cursor.set(path, ts);
      }
      events.push({ name: 'frame ms', ph: 'C', pid: 1, ts: end, args: { ms: this.frameMs[i] } });
      events.push({ name: 'draw calls', ph: 'C', pid: 1, ts: end, args: { draws: this.draws[i] } });
      if (this.heap[i]) events.push({ name: 'JS heap MB', ph: 'C', pid: 1, ts: end, args: { MB: this.heap[i] } });
    }
    return { traceEvents: events, displayTimeUnit: 'ms' };
  }

  export(kind = 'json') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const data = kind === 'trace' ? this.toTrace() : this.toJSON();
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    platform().saveFile?.(`minecraftjs-${kind === 'trace' ? 'trace' : 'profile'}-${stamp}.json`, bytes, 'application/json');
    return bytes.length;
  }

  // ------------------------------------------------------------------ overlay

  drawOverlay(gui) {
    if (!this.count) return;
    const s = this.stats(120), detailed = this.overlay === 'detailed';
    const W = Math.min(300, gui.width - 8), x = gui.width - W - 4, y0 = 4;
    const rows = s.rows.filter((r) => r.path !== 'root' && r.avg > 0.005 && (detailed || r.path === 'outside' || r.path.split('.').length <= 3)).slice(0, detailed ? 18 : 8);
    const packets = detailed ? this.packetStats().slice(0, 5) : [];
    const graphH = 48, lineH = 9;
    const H = 4 + lineH * 2 + graphH + 6 + rows.length * lineH + (packets.length ? (packets.length + 1) * lineH : 0) + 4;
    gui.rect(x, y0, x + W, y0 + H, 0xc0000000);
    let y = y0 + 3;
    const fmt = (v) => v >= 10 ? v.toFixed(1) : v.toFixed(2);
    gui.text(`MicroProfiler${this.paused ? ' (paused)' : ''}  ${fmt(s.frameAvg)} ms  p99 ${fmt(s.p99)}`, x + 3, y, 0xffffff); y += lineH;
    gui.text(`${Math.round(s.renderedFps)}/${Math.round(s.processedFps)} fps  ${Math.round(s.draws)} draws${s.heap ? '  ' + Math.round(s.heap) + ' MB' : ''}`, x + 3, y, 0xa0a0a0); y += lineH + 2;
    // frame-time graph: one column per frame, stacked by top-level section, with 60 Hz and 144 Hz lines
    const frames = this.recent(W - 6), gx = x + 3, scale = graphH / Math.max(33.4, s.p99 * 1.2);
    const tops = this.paths.map((p, k) => [p, k]).filter(([p]) => p.startsWith('root.') && p.split('.').length === 2);
    frames.forEach((i, col) => {
      let h = 0;
      for (const [p, k] of tops) {
        const v = this.series[k][i] * scale; if (v <= 0) continue;
        const c = profilerColor(p.slice(5));
        gui.rect(gx + col, y + graphH - h - v, gx + col + 1, y + graphH - h, (0xff000000 | c) >>> 0); h += v;
      }
      const total = this.frameMs[i] * scale;
      if (total > h) gui.rect(gx + col, y + graphH - Math.min(graphH, total), gx + col + 1, y + graphH - h, this.rendered[i] ? 0xff606060 : 0xff303030);
    });
    for (const [ms, color] of [[1000 / 60, 0x80ffff00], [1000 / 144, 0x8000ff00]]) { const ly = y + graphH - ms * scale; if (ly > y) gui.rect(gx, ly, gx + W - 6, ly + 1, color >>> 0); }
    y += graphH + 4;
    for (const r of rows) {
      const depth = r.path === 'outside' ? 0 : r.path.split('.').length - 2, c = r.path === 'outside' ? 0x505050 : profilerColor(r.name.slice(r.name.lastIndexOf('.') + 1));
      gui.rect(x + 3 + depth * 4, y + 1, x + 9 + depth * 4, y + 7, (0xff000000 | c) >>> 0);
      gui.text(r.path === 'outside' ? 'outside game loop' : r.name.slice(r.name.lastIndexOf('.') + 1), x + 12 + depth * 4, y, r.path === 'outside' ? 0xffd080 : 0xe0e0e0);
      const right = `${fmt(r.avg)}  ${fmt(r.max)}  ${Math.round(r.share * 100)}%`;
      gui.text(right, x + W - 3 - gui.textWidth(right), y, 0xe0e0e0); y += lineH;
    }
    if (packets.length) {
      gui.text('packets (total ms, count)', x + 3, y, 0xa0a0a0); y += lineH;
      for (const p of packets) { const right = `${fmt(p.ms)}  ${p.count}`; gui.text(p.name, x + 6, y, 0xe0e0e0); gui.text(right, x + W - 3 - gui.textWidth(right), y, 0xe0e0e0); y += lineH; }
    }
  }
}
