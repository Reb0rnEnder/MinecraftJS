// Software rasteriser implementing the graphics device contract (see device.js), for browsers with neither WebGL 2
// nor WebGPU. Everything runs on the CPU into a Uint32 colour buffer and a Float32 depth buffer, presented with
// putImageData. The platform keeps Super Potato Mode (reduced resolution) on while this device runs.
//
// Speed comes from doing as little per pixel as possible:
// - all lighting, tinting, overlay and fog work happens per vertex and is folded into colour = texel * mul + add
//   (fog included: mix(c, fog, f) = c * (1 - f) + fog * f), interpolated linearly in screen space;
// - only the texture coordinates are perspective-correct (u / w, v / w, 1 / w); depth is linear in screen space;
// - one mip level per triangle (texel area / pixel area), nearest sampling from Uint32 texels;
// - triangles are walked with incremental edge functions over their bounding box; the inner loops are
//   specialised per blend mode and depth test.
import { DEFAULT_PARAMS, PIPELINE_FORMAT, vertexLayout } from './device.js';

// Unified vertex layout after decoding any format: x y z | u v | r g b a | sky block | nx ny nz
const V = 14;
// Transformed vertex: clip x y z w | u v | mul r g b | add r g b | alpha mul
const T = 13;

export class SoftwareDevice {
  constructor(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('No 2D canvas');
    this.name = 'Software';
    this.info = { vendor: 'MinecraftJS', renderer: 'Software rasteriser (CPU)', version: '1' };
    this.canvas = canvas;
    this.ctx = ctx;
    this.rtOriginBottom = false;
    this.white = this.createTexture({ width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) });
    this.globals = { view: new Float32Array(16), proj: new Float32Array(16), fog: [0, 1, 0, 2], fogColor: [0, 0, 0], lightmap: null };
    this.scissor = null;
    this.target = null;
    this.mvp = new Float64Array(16);
    this.mv = new Float64Array(16);
    this.tv = new Float64Array(T * 1024); // transformed vertices (grown as needed)
    this.clipA = new Float64Array(T * 8); this.clipB = new Float64Array(T * 8); // near-plane clipping scratch
    this.captureWaiters = [];
    this.resize(canvas.width || 1, canvas.height || 1);
  }

  // ---------------------------------------------------------------- surface

  resize(w, h) {
    const iw = Math.max(1, Math.round(w)), ih = Math.max(1, Math.round(h));
    this.canvas.width = iw; this.canvas.height = ih;
    this.width = iw; this.height = ih;
    this.screen = this._buffers(iw, ih);
    this.screen.image = new ImageData(new Uint8ClampedArray(this.screen.color.buffer), iw, ih);
    if (!this.target) this.cur = this.screen;
  }

  _buffers(w, h) { return { width: w, height: h, color: new Uint32Array(w * h), depth: new Float32Array(w * h) }; }

  // ---------------------------------------------------------------- textures

  createTexture(o) {
    const t = { width: o.width, height: o.height, filter: o.filter || 'nearest', wrap: o.wrap || 'clamp', mipLevels: o.mipmaps === true ? 4 : Math.max(0, o.mipmaps | 0) };
    t.u32 = new Uint32Array(o.width * o.height);
    t.tex = t; // what other code checks for a live texture (WebGL: .tex, WebGPU: .bg)
    if (o.data) this.updateTexture(t, o.data);
    else t.levels = [{ w: t.width, h: t.height, px: t.u32 }];
    return t;
  }

  updateTexture(t, data, x = 0, y = 0, w = t.width, h = t.height) {
    t.version = (t.version || 0) + 1;
    const src = asU32(data);
    if (x === 0 && y === 0 && w === t.width && h === t.height) t.u32.set(src.subarray(0, w * h));
    else for (let r = 0; r < h; r++) t.u32.set(src.subarray(r * w, r * w + w), (y + r) * t.width + x);
    const full = !t.levels || (x === 0 && y === 0 && w === t.width && h === t.height);
    if (full) {
      t.levels = [{ w: t.width, h: t.height, px: t.u32 }];
      for (let l = 0, pw = t.width, ph = t.height; l < t.mipLevels && (pw > 1 || ph > 1); l++) {
        pw = Math.max(1, pw >> 1); ph = Math.max(1, ph >> 1);
        t.levels.push({ w: pw, h: ph, px: new Uint32Array(pw * ph) });
      }
    }
    // box-filtered mips weighted by alpha (like buildMips in device.js), only over the changed rectangle
    let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
    for (let l = 1; l < t.levels.length; l++) {
      const S = t.levels[l - 1], D = t.levels[l];
      x0 >>= 1; y0 >>= 1; x1 = Math.min(D.w, (x1 + 1) >> 1); y1 = Math.min(D.h, (y1 + 1) >> 1);
      const p = S.px, pw = S.w, ph = S.h, np = D.px, nw = D.w;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const c = p[Math.min(ph - 1, yy * 2 + dy) * pw + Math.min(pw - 1, xx * 2 + dx)], al = c >>> 24;
          r += (c & 255) * al; g += ((c >>> 8) & 255) * al; b += ((c >>> 16) & 255) * al; a += al;
        }
        np[yy * nw + xx] = a ? (((a >> 2) << 24) | (((b / a) | 0) << 16) | (((g / a) | 0) << 8) | ((r / a) | 0)) >>> 0 : 0;
      }
    }
  }

  destroyTexture() {}

  createRenderTarget(w, h) {
    const b = this._buffers(w, h);
    const t = { width: w, height: h, filter: 'linear', wrap: 'clamp', u32: b.color, levels: [{ w, h, px: b.color }], rt: b, mipLevels: 0 };
    t.tex = t;
    return t;
  }

  setRenderTarget(t, clear) {
    this.target = t || null;
    this.cur = t ? t.rt : this.screen;
    if (clear) {
      this.cur.color.fill(packColor(clear[0], clear[1], clear[2], clear[3] === undefined ? 1 : clear[3]));
      this.cur.depth.fill(1);
    }
  }

  busy() { return false; }

  // ---------------------------------------------------------------- meshes

  createMesh(format, vertices, opts = {}) {
    const m = { format, quads: !!opts.quads, data: null, vertexCount: 0, indices: null };
    this.updateMesh(m, vertices, opts);
    return m;
  }

  // Decode any vertex format into the unified float layout once, so drawing never looks at formats
  updateMesh(m, vertices, opts = {}) {
    const L = vertexLayout(m.format);
    const bytes = toU8(vertices);
    const n = Math.floor(bytes.byteLength / L.byteStride);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const out = m.data && m.data.length >= n * V ? m.data : new Float32Array(n * V);
    const name = m.format.name;
    const attr = (i, a, k) => {
      const o = i * L.byteStride + a.byteOffset;
      if (a.type === 'unorm16') return dv.getUint16(o + k * 2, true) / 65535;
      if (a.type === 'unorm8') return dv.getUint8(o + k) / 255;
      return dv.getFloat32(o + k * 4, true);
    };
    const A = L.attrs;
    for (let i = 0; i < n; i++) {
      const b = i * V;
      out[b + 6] = out[b + 7] = out[b + 8] = out[b + 9] = 1;
      out[b + 10] = out[b + 11] = 15;
      if (name === 'terrain') {
        out[b] = attr(i, A[0], 0) * (65535 / 2048) - 8; out[b + 1] = attr(i, A[0], 1) * (65535 / 2048) - 8; out[b + 2] = attr(i, A[0], 2) * (65535 / 2048) - 8;
        out[b + 3] = attr(i, A[1], 0); out[b + 4] = attr(i, A[1], 1);
        out[b + 5] = attr(i, A[2], 0); out[b + 6] = attr(i, A[2], 1); out[b + 7] = attr(i, A[2], 2);
        out[b + 8] = 1;
        out[b + 9] = attr(i, A[3], 0) * 15; out[b + 10] = attr(i, A[3], 1) * 15;
      } else {
        out[b] = attr(i, A[0], 0); out[b + 1] = attr(i, A[0], 1); out[b + 2] = attr(i, A[0], 2);
        out[b + 3] = attr(i, A[1], 0); out[b + 4] = attr(i, A[1], 1);
        if (name === 'entity') {
          out[b + 11] = attr(i, A[2], 0); out[b + 12] = attr(i, A[2], 1); out[b + 13] = attr(i, A[2], 2);
          out[b + 5] = attr(i, A[3], 0); out[b + 6] = attr(i, A[3], 1); out[b + 7] = attr(i, A[3], 2); out[b + 8] = 1;
        } else {
          out[b + 5] = attr(i, A[2], 0); out[b + 6] = attr(i, A[2], 1); out[b + 7] = attr(i, A[2], 2); out[b + 8] = attr(i, A[2], 3);
          if (name === 'lit') { out[b + 9] = attr(i, A[3], 0); out[b + 10] = attr(i, A[3], 1); }
        }
      }
    }
    // the unified layout keeps colour in 5..8, light in 9..10, normal in 11..13
    m.data = out;
    m.vertexCount = n;
    if (opts.quads !== undefined) m.quads = !!opts.quads;
    if (opts.indices) { m.indices = opts.indices instanceof Uint32Array ? opts.indices : new Uint32Array(opts.indices); m.quads = false; }
    else if (!m.quads) m.indices = null;
    m.indexCount = m.indices ? m.indices.length : m.quads ? (n / 4) * 6 : n;
  }

  destroyMesh() {}

  // ---------------------------------------------------------------- frame

  beginFrame(clear) {
    this.target = null;
    this.cur = this.screen;
    this.scissor = null;
    this.screen.color.fill(packColor(clear[0], clear[1], clear[2], 1));
    this.screen.depth.fill(1);
  }

  clearDepth() { this.cur.depth.fill(1); }

  setGlobals(g) {
    const G = this.globals;
    if (g.view) G.view.set(g.view);
    if (g.proj) G.proj.set(g.proj);
    if (g.fogColor) G.fogColor = [g.fogColor[0], g.fogColor[1], g.fogColor[2]];
    if (g.fogStart !== undefined) G.fog[0] = g.fogStart;
    if (g.fogEnd !== undefined) G.fog[1] = g.fogEnd;
    if (g.fogDensity !== undefined) G.fog[2] = g.fogDensity;
    if (g.fogMode !== undefined) G.fog[3] = g.fogMode;
    if (g.lightmap) G.lightmap = g.lightmap;
    this.vpDirty = true;
  }

  setScissor(r) { this.scissor = r ? [Math.floor(r[0]), Math.floor(r[1]), Math.ceil(r[2]), Math.ceil(r[3])] : null; }

  endFrame() {
    if (this.captureWaiters.length) {
      const w = this.width, h = this.height, out = new Uint8Array(w * h * 4);
      out.set(new Uint8Array(this.screen.color.buffer));
      for (const r of this.captureWaiters.splice(0)) r({ width: w, height: h, data: out });
    }
    this.ctx.putImageData(this.screen.image, 0, 0);
  }

  capture() { return new Promise((res) => this.captureWaiters.push(res)); }

  // The post pipeline (see device.js) over the whole target, per pixel like the fragment shader. Textures are stored
  // top-down; texCoord is vanilla's (origin bottom left).
  _post(d) {
    const P = d.params || DEFAULT_PARAMS.post;
    const src = (d.textures && d.textures[0]) || this.white, aux = this.globals.lightmap || this.white;
    const out = this.cur, W = out.width, H = out.height, dst = out.color;
    const sw = src.width, sh = src.height, sp = src.u32, aw = aux.width, ah = aux.height, ap = aux.u32;
    const px = [0, 0, 0, 0], bx = [0, 0, 0, 0];
    const fetch = (o, p, w, h, x, y) => {
      let i = Math.floor(x * w), j = Math.floor((1 - y) * h);
      i = i < 0 ? 0 : i >= w ? w - 1 : i; j = j < 0 ? 0 : j >= h ? h - 1 : j;
      const c = p[j * w + i];
      o[0] = (c & 255) / 255; o[1] = ((c >>> 8) & 255) / 255; o[2] = ((c >>> 16) & 255) / 255; o[3] = (c >>> 24) / 255;
      return o;
    };
    const fract = (v) => v - Math.floor(v);
    const mode = Math.round(P[0]);
    const cs = Math.cos(P[1] * 0.0174532925), sn = Math.sin(P[1] * 0.0174532925);
    const R = P[6];
    for (let y = 0; y < H; y++) {
      const ty = 1 - (y + 0.5) / H;
      for (let x = 0; x < W; x++) {
        const tx = (x + 0.5) / W;
        let r, g, b, a = 1;
        if (mode === 0) { fetch(px, sp, sw, sh, tx, ty); r = px[0] * P[4]; g = px[1] * P[5]; b = px[2] * P[6]; a = px[3] * P[7]; }
        else if (mode === 1) { fetch(px, sp, sw, sh, tx, ty); const k = P[1]; r = px[0] + (1 - 2 * px[0]) * k; g = px[1] + (1 - 2 * px[1]) * k; b = px[2] + (1 - 2 * px[2]) * k; }
        else if (mode === 2) {
          fetch(px, sp, sw, sh, tx, ty);
          const cr = px[0] * P[4] + px[1] * P[5] + px[2] * P[6], cg = px[0] * P[8] + px[1] * P[9] + px[2] * P[10], cb = px[0] * P[12] + px[1] * P[13] + px[2] * P[14];
          const l = cr * 0.3 + cg * 0.59 + cb * 0.11;
          r = (cr - l) * P[1] + l; g = (cg - l) * P[1] + l; b = (cb - l) * P[1] + l;
        } else if (mode === 3) {
          const mx = sw / P[3], my = sh / P[3];
          fetch(px, sp, sw, sh, tx - fract(tx * mx) / mx, ty - fract(ty * my) / my);
          const q = P[1];
          const fr = px[0] - fract(px[0] * q) / q, fg = px[1] - fract(px[1] * q) / q, fb = px[2] - fract(px[2] * q) / q;
          const l = fr * 0.3 + fg * 0.59 + fb * 0.11;
          r = l + (fr - l) * P[2]; g = l + (fg - l) * P[2]; b = l + (fb - l) * P[2];
        } else if (mode === 4) {
          let ar = 0, ag = 0, ab = 0, ta = 0;
          for (let k = -R; k <= R; k += 1) {
            fetch(px, sp, sw, sh, tx + k * P[4] / sw, ty + k * P[5] / sh);
            ar += px[0]; ag += px[1]; ab += px[2]; ta += px[3];
          }
          const n = R * 2 + 1;
          r = ar / n; g = ag / n; b = ab / n; a = ta;
        } else {
          const sx = (tx * cs - ty * sn) * P[4] + P[6], sy = (ty * cs + tx * sn) * P[5] + P[7];
          fetch(bx, ap, aw, ah, tx, ty);
          fetch(px, sp, sw, sh, sx, sy);
          let o0 = px[0], o1 = px[1], o2 = px[2];
          if (sx < P[8] || sy < P[9] || sx > P[10] || sy > P[11]) { o0 = bx[0]; o1 = bx[1]; o2 = bx[2]; }
          const mixB = (t) => { o0 = bx[0] + (o0 - bx[0]) * t; o1 = bx[1] + (o1 - bx[1]) * t; o2 = bx[2] + (o2 - bx[2]) * t; };
          if (sx < P[12]) mixB((P[8] - sx) / (P[8] - P[12]));
          if (sy < P[13]) mixB((P[9] - sy) / (P[9] - P[13]));
          if (sx > P[14]) mixB((P[10] - sx) / (P[10] - P[14]));
          if (sy > P[15]) mixB((P[11] - sy) / (P[11] - P[15]));
          r = o0; g = o1; b = o2;
        }
        dst[y * W + x] = packColor(r, g, b, a);
      }
    }
  }

  // ---------------------------------------------------------------- drawing

  draw(d) {
    const m = d.mesh;
    if (!m || !m.vertexCount) return;
    if (d.pipeline === 'post') { this._post(d); return; }
    const pipe = d.pipeline;
    const P = d.params || DEFAULT_PARAMS[pipe] || ZERO16;
    const st = d.state || EMPTY;
    const tex = (d.textures && d.textures[0]) || this.white;
    const G = this.globals;
    // matrices: mv = view * model, mvp = proj * mv
    this._lastModel = d.model || IDENTITY;
    mul4(this.mv, G.view, this._lastModel);
    mul4(this.mvp, G.proj, this.mv);
    // index range
    const lines = d.primitive === 'lines';
    const first = d.first || 0;
    const count = d.count !== undefined ? d.count : m.indexCount;
    if (count <= 0) return;
    // vertex range used by the draw
    let v0 = 0, v1 = m.vertexCount;
    if (m.quads) { v0 = (first / 6) * 4; v1 = Math.min(m.vertexCount, v0 + Math.ceil(count / 6) * 4); }
    else if (!m.indices) { v0 = first; v1 = Math.min(m.vertexCount, first + count); }
    if (this.tv.length < v1 * T) this.tv = new Float64Array(Math.max(v1, this.tv.length / T * 2) * T);
    this._vertices(m, v0, v1, pipe, P, tex);
    const ctx = this._setup(pipe, P, st, tex);
    if (lines) { this._lines(m, first, count, ctx); return; }
    const idx = m.indices;
    const tv = this.tv;
    const cull = !!st.cull;
    for (let k = first; k + 2 < first + count; k += 3) {
      let a, b, c;
      if (m.quads) { const q = (k / 6) | 0, r = k % 6, base = q * 4; if (r === 0) { a = base; b = base + 1; c = base + 2; } else { a = base; b = base + 2; c = base + 3; } }
      else if (idx) { a = idx[k]; b = idx[k + 1]; c = idx[k + 2]; }
      else { a = k; b = k + 1; c = k + 2; }
      this._triangle(tv, a * T, b * T, c * T, cull, ctx);
    }
  }

  // Per-vertex work: clip position and the colour terms (texel * mul + add, alpha mul) with lighting and fog
  _vertices(m, v0, v1, pipe, P, tex) {
    const src = m.data, tv = this.tv, M = this.mvp, MV = this.mv, G = this.globals;
    const fog = G.fog, fc = G.fogColor;
    const lmTex = G.lightmap;
    // entity constants
    let er = 1, eg = 1, eb = 1, ea = 1, oR = 0, oG = 0, oB = 0, oA = 0, lr = 1, lg = 1, lb = 1, lightMode = 0;
    if (pipe === 'entity') {
      er = P[0]; eg = P[1]; eb = P[2]; ea = P[3]; oR = P[4]; oG = P[5]; oB = P[6]; oA = P[7];
      if (P[10] < 0.5) { const c = lightmap(lmTex, P[8], P[9]); lr = c[0]; lg = c[1]; lb = c[2]; }
      lightMode = P[11];
    }
    const terrainAlpha = pipe === 'terrain' ? P[1] : 1;
    const colorUseFog = pipe === 'color' ? P[5] > 0.5 : true;
    const portal = pipe === 'endportal';
    const D = this._lastModel; // entity normals turn with mat3(model)
    for (let i = v0; i < v1; i++) {
      const s = i * V, o = i * T;
      const x = src[s], y = src[s + 1], z = src[s + 2];
      tv[o] = M[0] * x + M[4] * y + M[8] * z + M[12];
      tv[o + 1] = M[1] * x + M[5] * y + M[9] * z + M[13];
      tv[o + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
      tv[o + 3] = M[3] * x + M[7] * y + M[11] * z + M[15];
      tv[o + 4] = src[s + 3]; tv[o + 5] = src[s + 4];
      // eye distance for fog
      let f = 0;
      if (fog[3] < 1.5 && colorUseFog && !portal) {
        const ex = MV[0] * x + MV[4] * y + MV[8] * z + MV[12], ey = MV[1] * x + MV[5] * y + MV[9] * z + MV[13], ez = MV[2] * x + MV[6] * y + MV[10] * z + MV[14];
        const dist = Math.sqrt(ex * ex + ey * ey + ez * ez);
        f = fog[3] < 0.5 ? clamp01((dist - fog[0]) / Math.max(0.0001, fog[1] - fog[0])) : 1 - clamp01(Math.exp(-fog[2] * dist));
      }
      const nf = 1 - f;
      let mr, mg, mb, ar = 0, ag = 0, ab = 0, am;
      if (pipe === 'terrain') {
        const c = lightmap(lmTex, src[s + 9], src[s + 10]);
        mr = src[s + 5] * c[0]; mg = src[s + 6] * c[1]; mb = src[s + 7] * c[2]; am = terrainAlpha;
      } else if (pipe === 'lit') {
        let c = ONE3;
        if (src[s + 9] >= 0) c = lightmap(lmTex, src[s + 9], src[s + 10]);
        mr = src[s + 5] * c[0]; mg = src[s + 6] * c[1]; mb = src[s + 7] * c[2]; am = src[s + 8];
      } else if (pipe === 'entity') {
        // shade from the model-space normal turned by the model matrix (see the WebGL 2 entity shader)
        const nx0 = src[s + 11], ny0 = src[s + 12], nz0 = src[s + 13];
        let nx = D[0] * nx0 + D[4] * ny0 + D[8] * nz0, ny = D[1] * nx0 + D[5] * ny0 + D[9] * nz0, nz = D[2] * nx0 + D[6] * ny0 + D[10] * nz0;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        let shade = 1;
        const gui = lightMode > 1.5;
        if (!(lightMode > 0.5 && !gui)) {
          const L0 = gui ? GUI_L0 : WORLD_L0, L1 = gui ? GUI_L1 : WORLD_L1;
          shade = Math.min(1, 0.4 + 0.6 * (Math.max(nx * L0[0] + ny * L0[1] + nz * L0[2], 0) + Math.max(nx * L1[0] + ny * L1[1] + nz * L1[2], 0)));
        }
        const k = (1 - oA) * shade;
        mr = er * src[s + 5] * k * lr; mg = eg * src[s + 6] * k * lg; mb = eb * src[s + 7] * k * lb;
        ar = oR * oA * shade * lr; ag = oG * oA * shade * lg; ab = oB * oA * shade * lb;
        am = ea;
      } else if (pipe === 'color') {
        mr = src[s + 5] * P[0]; mg = src[s + 6] * P[1]; mb = src[s + 7] * P[2]; am = src[s + 8] * P[3];
      } else { // endportal: colour from params, the uv comes from the screen
        mr = P[0]; mg = P[1]; mb = P[2]; am = 1;
      }
      tv[o + 6] = mr * nf; tv[o + 7] = mg * nf; tv[o + 8] = mb * nf;
      tv[o + 9] = ar * nf + fc[0] * f; tv[o + 10] = ag * nf + fc[1] * f; tv[o + 11] = ab * nf + fc[2] * f;
      tv[o + 12] = am;
    }
  }

  // Per-draw constants for the rasteriser
  _setup(pipe, P, st, tex) {
    const c = this._ctx || (this._ctx = {});
    c.tex = tex;
    c.alphaTest = pipe === 'terrain' ? P[0] : pipe === 'lit' ? P[0] : pipe === 'entity' ? P[12] : pipe === 'color' ? P[4] : 0;
    c.testFinal = pipe === 'color'; // the colour pipeline tests the multiplied alpha
    c.mipBias = pipe === 'terrain' ? P[2] : 0;
    c.blend = st.blend || 'none';
    c.depthTest = st.depthTest !== false;
    c.depthWrite = st.depthWrite !== false;
    c.depthEqual = st.depthFunc === 'equal';
    c.colorWrite = st.colorWrite !== false;
    c.offset = st.polygonOffset ? -0.00002 : 0;
    c.repeat = tex.wrap === 'repeat';
    c.portal = pipe === 'endportal';
    c.P = P;
    c.opaqueOut = !this.target; // the screen ignores alpha
    const s = this.scissor, W = this.cur.width, H = this.cur.height;
    c.minX = s ? Math.max(0, s[0]) : 0; c.minY = s ? Math.max(0, s[1]) : 0;
    c.maxX = s ? Math.min(W, s[0] + s[2]) : W; c.maxY = s ? Math.min(H, s[1] + s[3]) : H;
    return c;
  }

  // Clip a triangle against the near plane (z > -w) when needed, then rasterise
  _triangle(tv, a, b, c, cull, ctx) {
    const inA = tv[a + 2] > -tv[a + 3], inB = tv[b + 2] > -tv[b + 3], inC = tv[c + 2] > -tv[c + 3];
    if (inA && inB && inC) { this._raster(tv, a, tv, b, tv, c, cull, ctx); return; }
    if (!inA && !inB && !inC) return;
    // Sutherland-Hodgman against one plane, up to 4 output vertices
    const out = this.clipA;
    let n = 0;
    const vs = [a, b, c], ins = [inA, inB, inC];
    for (let i = 0; i < 3; i++) {
      const p = vs[i], q = vs[(i + 1) % 3], pin = ins[i], qin = ins[(i + 1) % 3];
      if (pin) { for (let k = 0; k < T; k++) out[n * T + k] = tv[p + k]; n++; }
      if (pin !== qin) {
        const dp = tv[p + 2] + tv[p + 3], dq = tv[q + 2] + tv[q + 3];
        const t = dp / (dp - dq);
        for (let k = 0; k < T; k++) out[n * T + k] = tv[p + k] + (tv[q + k] - tv[p + k]) * t;
        n++;
      }
    }
    for (let i = 1; i + 1 < n; i++) this._raster(out, 0, out, i * T, out, (i + 1) * T, cull, ctx);
  }

  // Rasterise one clip-space triangle
  _raster(A, a, B, b, C, c, cull, ctx) {
    const W = this.cur.width, H = this.cur.height;
    // project
    const wa = 1 / A[a + 3], wb = 1 / B[b + 3], wc = 1 / C[c + 3];
    const x0 = (A[a] * wa * 0.5 + 0.5) * W, y0 = (0.5 - A[a + 1] * wa * 0.5) * H, z0 = A[a + 2] * wa * 0.5 + 0.5;
    const x1 = (B[b] * wb * 0.5 + 0.5) * W, y1 = (0.5 - B[b + 1] * wb * 0.5) * H, z1 = B[b + 2] * wb * 0.5 + 0.5;
    const x2 = (C[c] * wc * 0.5 + 0.5) * W, y2 = (0.5 - C[c + 1] * wc * 0.5) * H, z2 = C[c + 2] * wc * 0.5 + 0.5;
    // signed area (screen y down: counter-clockwise in GL becomes clockwise here)
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0) return;
    if (cull && area > 0) return; // back face (GL front face CCW)
    let minX = Math.max(ctx.minX, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(ctx.maxX - 1, Math.ceil(Math.max(x0, x1, x2)));
    let minY = Math.max(ctx.minY, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(ctx.maxY - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) return;
    const inv = 1 / area;
    // edge function steps (e0 opposite vertex 0, ...)
    const e0dx = (y1 - y2) * inv, e0dy = (x2 - x1) * inv;
    const e1dx = (y2 - y0) * inv, e1dy = (x0 - x2) * inv;
    const e2dx = (y0 - y1) * inv, e2dy = (x1 - x0) * inv;
    const px = minX + 0.5, py = minY + 0.5;
    // barycentrics at the first pixel centre: w0 = edge(p1, p2, p) / area, ...
    const e0r = ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)) * inv;
    const e1r = ((x0 - x2) * (py - y2) - (y0 - y2) * (px - x2)) * inv;
    const e2r = ((x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)) * inv;
    // attribute planes: value = e0 * v0 + e1 * v1 + e2 * v2 (barycentrics); store per-attribute deltas
    // [depth, 1 / w, u / w, v / w, mul rgb, add rgb, alpha] x 3 vertices
    const att = this._att || (this._att = new Float64Array(33));
    att[0] = z0 + ctx.offset; att[1] = z1 + ctx.offset; att[2] = z2 + ctx.offset;
    att[3] = wa; att[4] = wb; att[5] = wc;
    att[6] = A[a + 4] * wa; att[7] = B[b + 4] * wb; att[8] = C[c + 4] * wc;
    att[9] = A[a + 5] * wa; att[10] = B[b + 5] * wb; att[11] = C[c + 5] * wc;
    for (let k = 0; k < 7; k++) { att[12 + k * 3] = A[a + 6 + k]; att[13 + k * 3] = B[b + 6 + k]; att[14 + k * 3] = C[c + 6 + k]; }
    // mip level from texel area / pixel area
    const tex = ctx.tex;
    let lvl = tex.levels[0];
    if (tex.levels.length > 1) {
      const u0 = A[a + 4], v0 = A[a + 5], u1 = B[b + 4], v1 = B[b + 5], u2 = C[c + 4], v2 = C[c + 5];
      const ta = Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) * tex.width * tex.height;
      const lod = 0.5 * Math.log2(ta / Math.abs(area) + 1e-9) + ctx.mipBias;
      const li = Math.max(0, Math.min(tex.levels.length - 1, Math.round(lod)));
      lvl = tex.levels[li];
    }
    // nearly constant w (small or distant triangles): affine texture coordinates are indistinguishable
    const wmin = Math.min(wa, wb, wc), wmax = Math.max(wa, wb, wc);
    const affine = wmax - wmin < wmin * 0.02;
    rasterLoop(this.cur, lvl, ctx, minX, maxX, minY, maxY, e0r, e1r, e2r, e0dx, e1dx, e2dx, e0dy, e1dy, e2dy, att, W, H, affine);
  }

  // GL_LINES: a 1-pixel line per vertex pair, depth from the first vertex, colour from its mul term
  _lines(m, first, count, ctx) {
    const tv = this.tv, W = this.cur.width, H = this.cur.height, idx = m.indices;
    const color = this.cur.color, depth = this.cur.depth;
    for (let k = first; k + 1 < first + count; k += 2) {
      const a = (idx ? idx[k] : k) * T, b = (idx ? idx[k + 1] : k + 1) * T;
      if (tv[a + 3] <= 0.001 || tv[b + 3] <= 0.001) continue;
      let x0 = (tv[a] / tv[a + 3] * 0.5 + 0.5) * W, y0 = (0.5 - tv[a + 1] / tv[a + 3] * 0.5) * H;
      const x1 = (tv[b] / tv[b + 3] * 0.5 + 0.5) * W, y1 = (0.5 - tv[b + 1] / tv[b + 3] * 0.5) * H;
      const za = tv[a + 2] / tv[a + 3] * 0.5 + 0.5, zb = tv[b + 2] / tv[b + 3] * 0.5 + 0.5;
      const steps = Math.min(4096, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1);
      const col = packColor(tv[a + 6] + tv[a + 9], tv[a + 7] + tv[a + 10], tv[a + 8] + tv[a + 11], 1);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = (x0 + (x1 - x0) * t) | 0, y = (y0 + (y1 - y0) * t) | 0;
        if (x < ctx.minX || y < ctx.minY || x >= ctx.maxX || y >= ctx.maxY) continue;
        const p = y * W + x, z = za + (zb - za) * t;
        if (ctx.depthTest && z > depth[p] + 1e-5) continue;
        color[p] = col;
      }
      void x0;
    }
  }
}

// The pixel loop. Each attribute is a plane over the screen (value at the first pixel centre plus x / y steps,
// from the barycentric derivatives); every row walks only its covered span. A holds per-attribute [v0, v1, v2]:
// depth, 1 / w, u / w, v / w, mul rgb, add rgb, alpha. affine: w hardly varies, so u and v skip the divide.
const NA = 11;
const PLANE = new Float64Array(NA * 3); // [start, dx, dy] per attribute
function rasterLoop(fb, lvl, ctx, minX, maxX, minY, maxY, e0r, e1r, e2r, e0dx, e1dx, e2dx, e0dy, e1dy, e2dy, A, W, H, affine) {
  const color = fb.color, depth = fb.depth;
  const px = lvl.px, tw = lvl.w, th = lvl.h, repeat = ctx.repeat;
  const alphaTest = ctx.alphaTest, testFinal = ctx.testFinal;
  const blend = ctx.blend, depthTest = ctx.depthTest, depthWrite = ctx.depthWrite, depthEqual = ctx.depthEqual, colorWrite = ctx.colorWrite;
  const opaqueOut = ctx.opaqueOut, portal = ctx.portal, P = ctx.P;
  const noBlend = blend === 'none';
  const depthLess = depthTest && !depthEqual;
  for (let k = 0; k < NA; k++) {
    const a0 = A[k * 3], a1 = A[k * 3 + 1], a2 = A[k * 3 + 2];
    PLANE[k * 3] = e0r * a0 + e1r * a1 + e2r * a2;
    PLANE[k * 3 + 1] = e0dx * a0 + e1dx * a1 + e2dx * a2;
    PLANE[k * 3 + 2] = e0dy * a0 + e1dy * a1 + e2dy * a2;
  }
  // affine texture coordinates: use u and v themselves (u / w divided by the triangle's mean 1 / w is not exact;
  // instead rebuild the planes from the plain per-vertex values)
  if (affine) {
    const iw0 = 1 / A[3], iw1 = 1 / A[4], iw2 = 1 / A[5];
    const u0 = A[6] * iw0, u1 = A[7] * iw1, u2 = A[8] * iw2, v0 = A[9] * iw0, v1 = A[10] * iw1, v2 = A[11] * iw2;
    PLANE[6] = e0r * u0 + e1r * u1 + e2r * u2; PLANE[7] = e0dx * u0 + e1dx * u1 + e2dx * u2; PLANE[8] = e0dy * u0 + e1dy * u1 + e2dy * u2;
    PLANE[9] = e0r * v0 + e1r * v1 + e2r * v2; PLANE[10] = e0dx * v0 + e1dx * v1 + e2dx * v2; PLANE[11] = e0dy * v0 + e1dy * v1 + e2dy * v2;
  }
  const zdx = PLANE[1], wdx = PLANE[4], udx = PLANE[7], vdx = PLANE[10];
  const mrdx = PLANE[13], mgdx = PLANE[16], mbdx = PLANE[19], ardx = PLANE[22], agdx = PLANE[25], abdx = PLANE[28], amdx = PLANE[31];
  let pc = 1, ps = 0, ang = 0;
  if (portal) { pc = Math.cos(P[5]); ps = Math.sin(P[5]); ang = P[4]; }
  for (let y = minY; y <= maxY; y++) {
    const dyr = y - minY;
    const E0 = e0r + e0dy * dyr, E1 = e1r + e1dy * dyr, E2 = e2r + e2dy * dyr;
    // covered span: every edge value E + d * i >= 0 for i = x - minX
    let lo = 0, hi = maxX - minX;
    if (e0dx > 0) lo = Math.max(lo, Math.ceil(-E0 / e0dx)); else if (e0dx < 0) hi = Math.min(hi, Math.floor(-E0 / e0dx)); else if (E0 < 0) continue;
    if (e1dx > 0) lo = Math.max(lo, Math.ceil(-E1 / e1dx)); else if (e1dx < 0) hi = Math.min(hi, Math.floor(-E1 / e1dx)); else if (E1 < 0) continue;
    if (e2dx > 0) lo = Math.max(lo, Math.ceil(-E2 / e2dx)); else if (e2dx < 0) hi = Math.min(hi, Math.floor(-E2 / e2dx)); else if (E2 < 0) continue;
    if (lo > hi) continue;
    // attribute values at the span start
    const ox = lo, oy = dyr;
    let z = PLANE[0] + zdx * ox + PLANE[2] * oy, w = PLANE[3] + wdx * ox + PLANE[5] * oy;
    let u = PLANE[6] + udx * ox + PLANE[8] * oy, v = PLANE[9] + vdx * ox + PLANE[11] * oy;
    let mr = PLANE[12] + mrdx * ox + PLANE[14] * oy, mg = PLANE[15] + mgdx * ox + PLANE[17] * oy, mb = PLANE[18] + mbdx * ox + PLANE[20] * oy;
    let ar = PLANE[21] + ardx * ox + PLANE[23] * oy, ag = PLANE[24] + agdx * ox + PLANE[26] * oy, ab = PLANE[27] + abdx * ox + PLANE[29] * oy;
    let am = PLANE[30] + amdx * ox + PLANE[32] * oy;
    let row = y * W + minX + lo;
    const end = y * W + minX + hi;
    for (; row <= end; row++, z += zdx, w += wdx, u += udx, v += vdx, mr += mrdx, mg += mgdx, mb += mbdx, ar += ardx, ag += agdx, ab += abdx, am += amdx) {
      if (depthLess) { if (z > depth[row]) continue; }
      else if (depthEqual && depthTest) { const dz = depth[row]; if (z - dz > 1e-6 || dz - z > 1e-6) continue; }
      let tu, tv2;
      if (portal) {
        // TileEntityEndPortalRenderer: screen-space layers (see the WebGL 2 endportal shader)
        const x = row - y * W;
        const nx = ((x + 0.5) / W * 2 - 1) * ang, ny = (1 - (y + 0.5) / H * 2) * ang;
        tu = 0.5 + 0.5 * (nx * pc - ny * ps + P[6]); tv2 = 0.5 + 0.5 * (nx * ps + ny * pc + P[7]);
        tu -= Math.floor(tu); tv2 -= Math.floor(tv2);
      } else if (affine) {
        tu = u; tv2 = v;
        if (repeat) { tu -= Math.floor(tu); tv2 -= Math.floor(tv2); }
      } else {
        const iw = 1 / w;
        tu = u * iw; tv2 = v * iw;
        if (repeat) { tu -= Math.floor(tu); tv2 -= Math.floor(tv2); }
      }
      let ix = (tu * tw) | 0, iy = (tv2 * th) | 0;
      if (ix < 0) ix = 0; else if (ix >= tw) ix = tw - 1;
      if (iy < 0) iy = 0; else if (iy >= th) iy = th - 1;
      const t = px[iy * tw + ix];
      const ta = (t >>> 24) * (1 / 255);
      let sa = ta * am;
      if ((testFinal ? sa : ta) < alphaTest) continue;
      if (portal) sa = P[3] < 0.5 ? ta : 1;
      if (depthWrite) depth[row] = z;
      if (!colorWrite) continue;
      let r = (t & 255) * (1 / 255) * mr + ar;
      let g = ((t >>> 8) & 255) * (1 / 255) * mg + ag;
      let b = ((t >>> 16) & 255) * (1 / 255) * mb + ab;
      if (!noBlend) {
        const d = color[row];
        const dr = (d & 255) * (1 / 255), dg = ((d >>> 8) & 255) * (1 / 255), db = ((d >>> 16) & 255) * (1 / 255), da = (d >>> 24) * (1 / 255);
        if (blend === 'alpha') { const ia = 1 - sa; r = r * sa + dr * ia; g = g * sa + dg * ia; b = b * sa + db * ia; sa = sa + da * ia; }
        else if (blend === 'add') { r = r * sa + dr; g = g * sa + dg; b = b * sa + db; sa = sa + da; }
        else if (blend === 'invert') { r = (1 - dr) * r + dr * (1 - r); g = (1 - dg) * g + dg * (1 - g); b = (1 - db) * b + db * (1 - b); sa = 1; }
        else if (blend === 'darken') { r = dr * (1 - r); g = dg * (1 - g); b = db * (1 - b); sa = da; }
        else if (blend === 'multiply') { r = 2 * dr * r; g = 2 * dg * g; b = 2 * db * b; sa = da; }
      }
      color[row] = packColor(r, g, b, opaqueOut ? 1 : sa);
    }
  }
}

function packColor(r, g, b, a) {
  const R = r <= 0 ? 0 : r >= 1 ? 255 : (r * 255 + 0.5) | 0;
  const G = g <= 0 ? 0 : g >= 1 ? 255 : (g * 255 + 0.5) | 0;
  const B = b <= 0 ? 0 : b >= 1 ? 255 : (b * 255 + 0.5) | 0;
  const A = a <= 0 ? 0 : a >= 1 ? 255 : (a * 255 + 0.5) | 0;
  return ((A << 24) | (B << 16) | (G << 8) | R) >>> 0;
}

// lightmap(vec2(sky, block)): the 16 x 16 lightmap texture at (block, sky), bilinear like the GPU sampler. Looked up
// per vertex from a table in quarter steps, rebuilt when the lightmap texture changes.
const LM = [1, 1, 1];
const LM_N = 61; // 0 .. 15 in steps of 0.25
let lmTable = null, lmTex = null, lmVersion = -1;
function buildLightmapTable(tex) {
  const px = tex.u32, w = tex.width, h = tex.height;
  lmTable = lmTable || new Float32Array(LM_N * LM_N * 3);
  for (let sy = 0; sy < LM_N; sy++) for (let bx = 0; bx < LM_N; bx++) {
    const fx = Math.min(w - 1, bx / 4), fy = Math.min(h - 1, sy / 4);
    const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const c00 = px[y0 * w + x0], c10 = px[y0 * w + x1], c01 = px[y1 * w + x0], c11 = px[y1 * w + x1];
    const o = (sy * LM_N + bx) * 3;
    for (let k = 0; k < 3; k++) {
      const sh = k * 8;
      const a = ((c00 >>> sh) & 255) * (1 - tx) + ((c10 >>> sh) & 255) * tx, b = ((c01 >>> sh) & 255) * (1 - tx) + ((c11 >>> sh) & 255) * tx;
      lmTable[o + k] = (a * (1 - ty) + b * ty) / 255;
    }
  }
  lmTex = tex; lmVersion = tex.version || 0;
}
function lightmap(tex, sky, block) {
  if (!tex || !tex.u32) { LM[0] = LM[1] = LM[2] = 1; return LM; }
  if (tex !== lmTex || (tex.version || 0) !== lmVersion) buildLightmapTable(tex);
  let si = (sky * 4 + 0.5) | 0, bi = (block * 4 + 0.5) | 0;
  if (si < 0) si = 0; else if (si >= LM_N) si = LM_N - 1;
  if (bi < 0) bi = 0; else if (bi >= LM_N) bi = LM_N - 1;
  const o = (si * LM_N + bi) * 3;
  LM[0] = lmTable[o]; LM[1] = lmTable[o + 1]; LM[2] = lmTable[o + 2];
  return LM;
}

function mul4(out, a, b) {
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    out[i * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[i * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[i * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[i * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const norm3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const WORLD_L0 = norm3(0.2, 1, -0.7), WORLD_L1 = norm3(-0.2, 1, 0.7);
const GUI_L0 = [-0.237910, -0.634435, 0.735453], GUI_L1 = [0.028667, -0.927375, -0.373034];
const ONE3 = [1, 1, 1];
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const ZERO16 = new Float32Array(16);
const EMPTY = {};
const toU8 = (d) => (d instanceof Uint8Array ? d : new Uint8Array(d.buffer, d.byteOffset, d.byteLength));
// RGBA bytes as packed texels, without copying when the bytes are 4-aligned
const asU32 = (d) => {
  if (d instanceof Uint32Array) return d;
  const b = toU8(d);
  return b.byteOffset % 4 === 0 ? new Uint32Array(b.buffer, b.byteOffset, b.byteLength >> 2) : new Uint32Array(b.slice().buffer);
};
export { PIPELINE_FORMAT };
