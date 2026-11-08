// Minimal Profiler (vanilla's Profiler/ProfilerResult) for the Shift+F3 pie chart. Sections nest
// with start()/end(); times are smoothed over frames so the chart is readable.
import { platform } from '../platform/platform.js';

export class Profiler {
  constructor() {
    this.enabled = false;
    this.stack = [];
    this.times = new Map(); // path -> smoothed ms per frame
    this.frame = new Map(); // path -> ms in the current frame
    this.selected = 'root'; // section shown by the pie chart
  }

  start(name) {
    if (!this.enabled) return;
    const parent = this.stack.length ? this.stack[this.stack.length - 1][0] : '';
    this.stack.push([parent ? parent + '.' + name : name, platform().now()]);
  }

  end() {
    if (!this.enabled || !this.stack.length) return;
    const [path, t0] = this.stack.pop();
    this.frame.set(path, (this.frame.get(path) || 0) + platform().now() - t0);
  }

  endStart(name) { this.end(); this.start(name); }

  // Fold this frame's timings into the smoothed values
  endFrame() {
    if (!this.enabled) return;
    for (const [k, v] of this.times) this.times.set(k, v * 0.9 + (this.frame.get(k) || 0) * 0.1);
    for (const [k, v] of this.frame) if (!this.times.has(k)) this.times.set(k, v);
    this.frame.clear();
  }

  // ProfilerResult list for a section: children sorted by time, plus "unspecified" for the rest
  results(path = this.selected) {
    const total = this.times.get('root') || 0;
    const own = this.times.get(path) || 0;
    const children = [];
    for (const [k, v] of this.times) {
      if (!k.startsWith(path + '.')) continue;
      const rest = k.slice(path.length + 1);
      if (rest.includes('.')) continue;
      children.push({ name: rest, ms: v });
    }
    const sum = children.reduce((a, c) => a + c.ms, 0);
    if (own > sum + 0.0001) children.push({ name: 'unspecified', ms: own - sum });
    children.sort((a, b) => b.ms - a.ms);
    const out = children.map((c) => ({ name: c.name, parentPct: own > 0 ? c.ms / own * 100 : 0, totalPct: total > 0 ? c.ms / total * 100 : 0, color: profilerColor(c.name) }));
    return { name: path, totalPct: total > 0 ? own / total * 100 : 0, list: out };
  }

  // Minecraft.updateDebugProfilerName: 0 goes up a level, 1..9 enters that child
  navigate(i) {
    if (i === 0) {
      const p = this.selected.lastIndexOf('.');
      if (p >= 0) this.selected = this.selected.slice(0, p);
      return;
    }
    const r = this.results();
    const c = r.list[i - 1];
    if (c && c.name !== 'unspecified') this.selected += '.' + c.name;
  }
}

// ProfilerResult.getColor: (name.hashCode() & 0xAAAAAA) + 0x444444
export function profilerColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
  return ((h & 0xaaaaaa) + 0x444444) & 0xffffff;
}
