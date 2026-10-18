// Texture atlas built from decoded block + item textures (pure JS), with .mcmeta animation support.

// Sprites whose frame is chosen by game state instead of time (TextureCompass, TextureClock)
const MANUAL = new Set(['items/compass', 'items/clock']);

export class Atlas {
  constructor() {
    this.size = 1024;
    this.entries = new Map(); // name -> { x, y, w, h, uv, alpha }
    this.data = null; // Uint8Array RGBA
    this.animations = [];
  }

  // textures: [{ name, image: { width, height, data } }], mcmeta: { name: json }
  build(textures, mcmeta) {
    const items = [];
    for (const t of textures) {
      const img = t.image;
      if (!img) continue;
      const meta = mcmeta[t.name];
      const w = img.width;
      let h = img.height;
      let frames = 1;
      if (meta && meta.animation && h > w) { frames = Math.floor(h / w); h = w; }
      items.push({ name: t.name, img, w, h, frames, meta });
    }
    items.sort((a, b) => b.h - a.h || b.w - a.w || (a.name < b.name ? -1 : 1));
    let area = 0;
    for (const it of items) area += it.w * it.h;
    let size = 256;
    while (size * size < area * 1.15) size *= 2;
    // Shelf packing; grow if needed
    for (;;) {
      let x = 0, y = 0, rowH = 0, ok = true;
      for (const it of items) {
        if (x + it.w > size) { x = 0; y += rowH; rowH = 0; }
        if (y + it.h > size) { ok = false; break; }
        it.x = x; it.y = y;
        x += it.w;
        rowH = Math.max(rowH, it.h);
      }
      if (ok) break;
      size *= 2;
    }
    this.size = size;
    const data = new Uint8Array(size * size * 4);
    this.data = data;
    this.entries.clear();
    this.animations = [];
    for (const it of items) {
      const src = it.img.data, sw = it.img.width;
      let alpha = false;
      for (let yy = 0; yy < it.h; yy++) {
        const so = yy * sw * 4, d = ((it.y + yy) * size + it.x) * 4;
        data.set(src.subarray(so, so + it.w * 4), d);
        if (!alpha) for (let xx = 0; xx < it.w; xx++) if (src[so + xx * 4 + 3] < 255) { alpha = true; break; }
      }
      const eps = 0.0005 / size;
      const uv = [it.x / size + eps, it.y / size + eps, (it.x + it.w) / size - eps, (it.y + it.h) / size - eps];
      const entry = { x: it.x, y: it.y, w: it.w, h: it.h, uv, alpha };
      this.entries.set(it.name, entry);
      if (it.frames > 1) {
        const a = it.meta.animation;
        const frametime = a.frametime || 1;
        let frames = a.frames ? a.frames.map((f) => (typeof f === 'number' ? { index: f, time: frametime } : { index: f.index, time: f.time || frametime })) : null;
        if (!frames) frames = Array.from({ length: it.frames }, (_, i) => ({ index: i, time: frametime }));
        this.animations.push({ entry, full: it.img, frames, interpolate: !!a.interpolate, frame: 0, ticks: 0, manual: MANUAL.has(it.name), name: it.name });
      }
    }
    this.dirty = null;
  }

  uv(name) {
    const e = this.entries.get(name) || this.entries.get('blocks/stone');
    return e ? e.uv : null;
  }

  has(name) { return this.entries.has(name); }
  hasAlpha(name) { const e = this.entries.get(name); return e ? e.alpha : false; }

  // Advance animations by one game tick. Returns the list of changed entries.
  tick() {
    const changed = [];
    for (const an of this.animations) {
      if (an.manual) continue;
      an.ticks++;
      const cur = an.frames[an.frame];
      let advanced = false;
      if (an.ticks >= cur.time) {
        an.ticks = 0;
        an.frame = (an.frame + 1) % an.frames.length;
        advanced = true;
      }
      if (advanced || an.interpolate) {
        this._writeFrame(an);
        changed.push(an.entry);
      }
    }
    return changed;
  }

  // Show a specific frame of a manually driven animation (compass / clock). Returns the entry if it changed.
  setFrame(name, frame) {
    const an = this.animations.find((a) => a.name === name);
    if (!an || !an.frames.length) return null;
    frame = ((frame % an.frames.length) + an.frames.length) % an.frames.length;
    if (an.frame === frame && an.written) return null;
    an.frame = frame;
    an.ticks = 0;
    an.written = true;
    this._writeFrame(an);
    return an.entry;
  }

  frameCount(name) { const an = this.animations.find((a) => a.name === name); return an ? an.frames.length : 0; }

  // RGBA pixels of a sub rectangle (for partial texture uploads)
  region(e) {
    const out = new Uint8Array(e.w * e.h * 4);
    for (let y = 0; y < e.h; y++) {
      const s = ((e.y + y) * this.size + e.x) * 4;
      out.set(this.data.subarray(s, s + e.w * 4), y * e.w * 4);
    }
    return out;
  }

  _writeFrame(an) {
    const e = an.entry;
    const w = e.w, h = e.h;
    const src = an.full.data;
    const f = an.frames[an.frame];
    const srcOff = f.index * w * h * 4;
    let mix = 0, nextOff = 0;
    if (an.interpolate) {
      const next = an.frames[(an.frame + 1) % an.frames.length];
      mix = an.ticks / f.time;
      nextOff = next.index * w * h * 4;
    }
    const dst = this.data;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const si = srcOff + (yy * w + xx) * 4;
        const di = ((e.y + yy) * this.size + e.x + xx) * 4;
        if (mix > 0) {
          const ni = nextOff + (yy * w + xx) * 4;
          for (let k = 0; k < 4; k++) dst[di + k] = src[si + k] * (1 - mix) + src[ni + k] * mix;
        } else {
          dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2]; dst[di + 3] = src[si + 3];
        }
      }
    }
  }

  // Serializable lookup for the mesher
  exportLookup() {
    const out = {};
    for (const [k, v] of this.entries) out[k] = { uv: v.uv, alpha: v.alpha };
    return out;
  }
}

export class AtlasLookup {
  constructor(table) { this.table = table; }
  uv(name) { const e = this.table[name] || this.table['blocks/stone']; return e ? e.uv : null; }
  hasAlpha(name) { const e = this.table[name]; return e ? e.alpha : false; }
  has(name) { return !!this.table[name]; }
}
