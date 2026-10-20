// WebGPU implementation of the graphics device contract (see device.js).
import { DEFAULT_PARAMS, PIPELINE_FORMAT, quadIndices, buildMips, vertexLayout } from './device.js';

const HEADER = /* wgsl */`
struct Globals { view: mat4x4f, proj: mat4x4f, fog: vec4f, fogColor: vec4f };
struct Draw { model: mat4x4f, p: array<vec4f, 4> };
@group(0) @binding(0) var<uniform> G: Globals;
@group(0) @binding(1) var lmTex: texture_2d<f32>;
@group(0) @binding(2) var lmSamp: sampler;
@group(1) @binding(0) var<uniform> D: Draw;
@group(2) @binding(0) var tex0: texture_2d<f32>;
@group(2) @binding(1) var samp0: sampler;
fn fogFactor(d: f32) -> f32 {
  if (G.fog.w > 1.5) { return 0.0; }
  if (G.fog.w < 0.5) { return clamp((d - G.fog.x) / max(0.0001, G.fog.y - G.fog.x), 0.0, 1.0); }
  return 1.0 - clamp(exp(-G.fog.z * d), 0.0, 1.0);
}
fn lightmap(l: vec2f) -> vec3f { return textureSampleLevel(lmTex, lmSamp, vec2f((l.y + 0.5) / 16.0, (l.x + 0.5) / 16.0), 0.0).rgb; }
fn project(mv: vec4f) -> vec4f { var p = G.proj * mv; p.z = p.z * 0.5 + p.w * 0.5; return p; }
struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) light: vec2f, @location(3) depth: f32, @location(4) shade: f32 };
`;

const SHADERS = {
  terrain: `
@vertex fn vs(@location(0) pp: vec4f, @location(1) uv: vec2f, @location(2) col: vec4f, @location(3) light: vec2f) -> VOut {
  let p = pp.xyz * (65535.0 / 2048.0) - 8.0;
  var o: VOut; let mv = G.view * D.model * vec4f(p, 1.0);
  o.pos = project(mv); o.uv = uv; o.col = vec4f(col.rgb, 1.0); o.light = light * 15.0; o.depth = length(mv.xyz); o.shade = 1.0; return o;
}
@fragment fn fs(i: VOut) -> @location(0) vec4f {
  let t = textureSampleBias(tex0, samp0, i.uv, D.p[0].z); // D.p[0].z: mip bias (far LOD sections)
  if (t.a < D.p[0].x) { discard; }
  let c = t.rgb * i.col.rgb * lightmap(i.light);
  return vec4f(mix(c, G.fogColor.rgb, fogFactor(i.depth)), t.a * D.p[0].y);
}`,
  lit: `
@vertex fn vs(@location(0) p: vec3f, @location(1) uv: vec2f, @location(2) col: vec4f, @location(3) light: vec2f) -> VOut {
  var o: VOut; let mv = G.view * D.model * vec4f(p, 1.0);
  o.pos = project(mv); o.uv = uv; o.col = col; o.light = light; o.depth = length(mv.xyz); o.shade = 1.0; return o;
}
@fragment fn fs(i: VOut) -> @location(0) vec4f {
  let t = textureSample(tex0, samp0, i.uv);
  if (t.a < D.p[0].x) { discard; }
  var lm = vec3f(1.0);
  if (i.light.x >= 0.0) { lm = lightmap(i.light); }
  let c = t.rgb * i.col.rgb * lm;
  return vec4f(mix(c, G.fogColor.rgb, fogFactor(i.depth)), t.a * i.col.a);
}`,
  entity: `
@vertex fn vs(@location(0) p: vec3f, @location(1) uv: vec2f, @location(2) nrm: vec3f, @location(3) col: vec3f) -> VOut {
  var o: VOut; let mv = G.view * D.model * vec4f(p, 1.0);
  let m3 = mat3x3f(D.model[0].xyz, D.model[1].xyz, D.model[2].xyz);
  let n = normalize(m3 * nrm);
  // lighting mode p[2].w: 0 world item lighting, 1 none, 2 GUI item lighting (see the WebGL 2 shader)
  let gui = D.p[2].w > 1.5;
  let l0 = select(normalize(vec3f(0.2, 1.0, -0.7)), vec3f(-0.237910, -0.634435, 0.735453), gui);
  let l1 = select(normalize(vec3f(-0.2, 1.0, 0.7)), vec3f(0.028667, -0.927375, -0.373034), gui);
  let d = 0.4 + 0.6 * (max(dot(n, l0), 0.0) + max(dot(n, l1), 0.0));
  let us = select(1.0, D.p[3].w, D.p[3].w > 0.0);
  o.pos = project(mv); o.uv = uv * us + D.p[3].yz; o.col = vec4f(col, 1.0); o.light = D.p[2].xy; o.depth = length(mv.xyz);
  o.shade = select(min(1.0, d), 1.0, D.p[2].w > 0.5 && !gui); return o;
}
@fragment fn fs(i: VOut) -> @location(0) vec4f {
  let t = textureSample(tex0, samp0, i.uv);
  if (t.a < D.p[3].x) { discard; }
  var lm = vec3f(1.0);
  if (D.p[2].z < 0.5) { lm = lightmap(i.light); }
  var c = t.rgb * D.p[0].rgb * i.col.rgb;
  c = mix(c, D.p[1].rgb, D.p[1].a);
  c = c * i.shade * lm;
  return vec4f(mix(c, G.fogColor.rgb, fogFactor(i.depth)), t.a * D.p[0].a);
}`,
  color: `
@vertex fn vs(@location(0) p: vec3f, @location(1) uv: vec2f, @location(2) col: vec4f) -> VOut {
  var o: VOut; let mv = G.view * D.model * vec4f(p, 1.0);
  o.pos = project(mv); o.uv = uv; o.col = col; o.light = vec2f(0.0); o.depth = length(mv.xyz); o.shade = 1.0; return o;
}
@fragment fn fs(i: VOut) -> @location(0) vec4f {
  let t = textureSample(tex0, samp0, i.uv) * i.col * D.p[0];
  if (t.a < D.p[1].x) { discard; }
  var c = t.rgb;
  if (D.p[1].y > 0.5) { c = mix(c, G.fogColor.rgb, fogFactor(i.depth)); }
  return vec4f(c, t.a);
}`,
  // TileEntityEndPortalRenderer layer (see the WebGL 2 shader); framebuffer y grows downwards here
  endportal: `
@vertex fn vs(@location(0) p: vec3f, @location(1) uv: vec2f, @location(2) col: vec4f) -> VOut {
  var o: VOut; let mv = G.view * D.model * vec4f(p, 1.0);
  o.pos = project(mv); o.uv = uv; o.col = col; o.light = vec2f(0.0); o.depth = length(mv.xyz); o.shade = 1.0; return o;
}
@fragment fn fs(i: VOut) -> @location(0) vec4f {
  let ndc = vec2f(i.pos.x / D.p[2].x * 2.0 - 1.0, 1.0 - i.pos.y / D.p[2].y * 2.0);
  let s = ndc * D.p[1].x;
  let c = cos(D.p[1].y); let sn = sin(D.p[1].y);
  let r = vec2f(s.x * c - s.y * sn, s.x * sn + s.y * c) + D.p[1].zw;
  let t = textureSample(tex0, samp0, fract(0.5 + 0.5 * r));
  let col = t.rgb * D.p[0].rgb;
  let f = fogFactor(i.depth);
  if (D.p[0].w < 0.5) { return vec4f(mix(col, G.fogColor.rgb, f), t.a); }
  return vec4f(col * (1.0 - f), 1.0);
}`,
  // Vanilla post-processing programs (see device.js and the WebGL 2 shader); render targets are stored top-down here
  post: `
@vertex fn vs(@location(0) p: vec3f, @location(1) uv: vec2f, @location(2) col: vec4f) -> VOut {
  var o: VOut; o.pos = vec4f(p.xy, 0.0, 1.0); o.uv = vec2f(uv.x, 1.0 - uv.y); o.col = col; o.light = vec2f(0.0); o.depth = 0.0; o.shade = 1.0; return o;
}
fn fetchIn(c: vec2f) -> vec4f {
  let n = vec2i(textureDimensions(tex0, 0));
  return textureLoad(tex0, clamp(vec2i(floor(vec2f(c.x, 1.0 - c.y) * vec2f(n))), vec2i(0), n - 1), 0);
}
fn fetchAux(c: vec2f) -> vec4f {
  let n = vec2i(textureDimensions(lmTex, 0));
  return textureLoad(lmTex, clamp(vec2i(floor(vec2f(c.x, 1.0 - c.y) * vec2f(n))), vec2i(0), n - 1), 0);
}
@fragment fn fs(i: VOut) -> @location(0) vec4f {
  let m = i32(D.p[0].x + 0.5);
  let tc = i.uv;
  let inSize = vec2f(textureDimensions(tex0, 0));
  if (m == 0) { return fetchIn(tc) * D.p[1]; }
  if (m == 1) { let d = fetchIn(tc); return vec4f(mix(d, 1.0 - d, D.p[0].y).rgb, 1.0); }
  if (m == 2) {
    let t = fetchIn(tc).rgb;
    let c = vec3f(dot(t, D.p[1].xyz), dot(t, D.p[2].xyz), dot(t, D.p[3].xyz));
    let l = dot(c, vec3f(0.3, 0.59, 0.11));
    return vec4f((c - l) * D.p[0].y + l, 1.0);
  }
  if (m == 3) {
    let mis = inSize / D.p[0].w;
    let b = fetchIn(tc - fract(tc * mis) / mis);
    let f = b.rgb - fract(b.rgb * D.p[0].y) / D.p[0].y;
    let l = dot(f, vec3f(0.3, 0.59, 0.11));
    return vec4f(l + (f - l) * D.p[0].z, 1.0);
  }
  if (m == 4) {
    let one = 1.0 / inSize;
    let R = D.p[1].z;
    var acc = vec4f(0.0); var ta = 0.0;
    for (var r = -R; r <= R; r += 1.0) { let s = fetchIn(tc + one * r * D.p[1].xy); ta += s.a; acc += s; }
    return vec4f(acc.rgb / (R * 2.0 + 1.0), ta);
  }
  let a = D.p[0].y * 0.0174532925; let cs = cos(a); let sn = sin(a);
  let sc = vec2f(tc.x * cs - tc.y * sn, tc.y * cs + tc.x * sn) * D.p[1].xy + D.p[1].zw;
  let S = D.p[2]; let V = D.p[3];
  let B = fetchAux(tc);
  var O = fetchIn(sc);
  if (sc.x < S.x || sc.y < S.y || sc.x > S.z || sc.y > S.w) { O = B; }
  if (sc.x < V.x) { O = mix(B, O, (S.x - sc.x) / (S.x - V.x)); }
  if (sc.y < V.y) { O = mix(B, O, (S.y - sc.y) / (S.y - V.y)); }
  if (sc.x > V.z) { O = mix(B, O, (S.z - sc.x) / (S.z - V.z)); }
  if (sc.y > V.w) { O = mix(B, O, (S.w - sc.y) / (S.w - V.w)); }
  return vec4f(O.rgb, 1.0);
}`,
};

const BLENDS = {
  alpha: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } },
  add: { color: { srcFactor: 'src-alpha', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } },
  invert: { color: { srcFactor: 'one-minus-dst', dstFactor: 'one-minus-src' }, alpha: { srcFactor: 'one', dstFactor: 'one' } },
  darken: { color: { srcFactor: 'zero', dstFactor: 'one-minus-src' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } },
  multiply: { color: { srcFactor: 'dst', dstFactor: 'src' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } },
};

const DRAW_STRIDE = 256;
const GLOBAL_STRIDE = 256;

export class WebGPUDevice {
  static async create(canvas) {
    if (typeof navigator === 'undefined' || !navigator.gpu) throw new Error('WebGPU is not available');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter');
    const device = await adapter.requestDevice();
    const d = new WebGPUDevice(canvas, device);
    const ai = adapter.info || {};
    d.info = { vendor: ai.vendor || 'unknown', renderer: [ai.architecture, ai.device, ai.description].filter(Boolean).join(' ') || 'WebGPU adapter', version: 'WebGPU' };
    return d;
  }

  constructor(canvas, device) {
    this.name = 'WebGPU';
    this.canvas = canvas;
    this.device = device;
    this.ctx = canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.ctx.configure({ device, format: this.format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    this.width = canvas.width;
    this.height = canvas.height;
    this.modules = {};
    for (const [n, src] of Object.entries(SHADERS)) this.modules[n] = device.createShaderModule({ code: HEADER + src });
    this.bgl0 = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: true } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, sampler: {} },
    ] });
    this.bgl1 = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: true } },
    ] });
    this.bgl2 = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ] });
    this.layout = device.createPipelineLayout({ bindGroupLayouts: [this.bgl0, this.bgl1, this.bgl2] });
    this.pipelines = new Map();
    this.samplers = new Map();
    this.drawCapacity = 4096;
    this.globalCapacity = 64;
    this._allocUniforms();
    this.quadCapacity = 0;
    this._ensureQuads(1 << 16);
    this.white = this.createTexture({ width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) });
    this.lightmap = this.white;
    this.globalsData = new Float32Array(GLOBAL_STRIDE / 4);
    this.globalsData[35] = 0;
    this.deferredDestroy = [];
    this.captureWaiters = [];
    this._makeDepth();
  }

  _allocUniforms() {
    const d = this.device;
    this.drawBuf = d.createBuffer({ size: this.drawCapacity * DRAW_STRIDE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.drawData = new Float32Array(this.drawCapacity * DRAW_STRIDE / 4);
    this.globalBuf = d.createBuffer({ size: this.globalCapacity * GLOBAL_STRIDE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.globalData = new Float32Array(this.globalCapacity * GLOBAL_STRIDE / 4);
    this.bg1 = d.createBindGroup({ layout: this.bgl1, entries: [{ binding: 0, resource: { buffer: this.drawBuf, size: 128 } }] });
    this.bg0Cache = new Map();
  }

  _makeDepth() {
    if (this.depthTex) this.depthTex.destroy();
    this.depthTex = this.device.createTexture({ size: [Math.max(1, this.width), Math.max(1, this.height)], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.depthView = this.depthTex.createView();
  }

  _ensureQuads(quads) {
    if (quads <= this.quadCapacity) return;
    let cap = Math.max(this.quadCapacity * 2, 1024);
    while (cap < quads) cap *= 2;
    const idx = quadIndices(cap);
    if (this.quadBuffer) this.deferredDestroy && this.deferredDestroy.push(this.quadBuffer);
    this.quadBuffer = this.device.createBuffer({ size: idx.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(this.quadBuffer, 0, idx);
    this.quadCapacity = cap;
  }

  resize(w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.width = w; this.height = h;
    this._makeDepth();
  }

  _sampler(filter, wrap, mip) {
    const key = filter + wrap + mip;
    let s = this.samplers.get(key);
    if (!s) {
      const f = filter === 'nearest' ? 'nearest' : 'linear';
      const w = wrap === 'repeat' ? 'repeat' : 'clamp-to-edge';
      s = this.device.createSampler({ magFilter: f, minFilter: f, mipmapFilter: mip ? 'linear' : 'nearest', addressModeU: w, addressModeV: w });
      this.samplers.set(key, s);
    }
    return s;
  }

  // ---------------------------------------------------------------- textures

  createTexture(o) {
    const mipLevels = o.mipmaps === true ? 4 : Math.max(0, o.mipmaps | 0);
    const levels = mipLevels > 0 ? Math.min(1 + mipLevels, 1 + Math.floor(Math.log2(Math.max(o.width, o.height)))) : 1;
    const tex = this.device.createTexture({ size: [o.width, o.height], format: 'rgba8unorm', mipLevelCount: levels,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    const t = { gpu: tex, width: o.width, height: o.height, mipmaps: levels > 1, levels, filter: o.filter || 'nearest', wrap: o.wrap || 'clamp' };
    t.bg = this.device.createBindGroup({ layout: this.bgl2, entries: [
      { binding: 0, resource: tex.createView() }, { binding: 1, resource: this._sampler(t.filter, t.wrap, t.mipmaps) }] });
    if (o.data) this.updateTexture(t, o.data);
    return t;
  }

  updateTexture(t, data, x = 0, y = 0, w = t.width, h = t.height) {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    this.device.queue.writeTexture({ texture: t.gpu, origin: [x, y] }, u8, { bytesPerRow: w * 4, rowsPerImage: h }, [w, h]);
    if (t.mipmaps && x === 0 && y === 0 && w === t.width && h === t.height) {
      const mips = buildMips(t.width, t.height, u8, t.levels - 1);
      mips.forEach((m, i) => this.device.queue.writeTexture({ texture: t.gpu, mipLevel: i + 1 }, m.data, { bytesPerRow: m.width * 4, rowsPerImage: m.height }, [m.width, m.height]));
    }
  }

  destroyTexture(t) { if (t && t.gpu) this.deferredDestroy.push(t.gpu); }

  // Offscreen colour + depth target; the returned object is also a normal (linear, clamped) texture
  createRenderTarget(w, h) {
    const tex = this.device.createTexture({ size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST });
    const t = { gpu: tex, width: w, height: h, mipmaps: false, levels: 1, filter: 'linear', wrap: 'clamp', view: tex.createView() };
    t.bg = this.device.createBindGroup({ layout: this.bgl2, entries: [{ binding: 0, resource: t.view }, { binding: 1, resource: this._sampler('linear', 'clamp', false) }] });
    t.depthTex = this.device.createTexture({ size: [w, h], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    t.depthView = t.depthTex.createView();
    return t;
  }

  // Draw into a render target (null = the screen). clear = [r, g, b, a] clears colour + depth.
  setRenderTarget(t, clear) {
    this.target = t || null;
    if (!this.encoder) return;
    this.scissor = null;
    this._beginPass(clear ? { r: clear[0], g: clear[1], b: clear[2], a: clear[3] === undefined ? 1 : clear[3] } : null, !!clear);
  }

  // True while the GPU is more than a frame behind (used to pace uncapped frame rates)
  busy() { return (this.inflight || 0) >= 2; }

  // ---------------------------------------------------------------- meshes

  createMesh(format, vertices, opts = {}) {
    const m = { format, vbuf: null, vsize: 0, ibuf: null, vertexCount: 0, indexCount: 0, quads: !!opts.quads };
    this.updateMesh(m, vertices, opts);
    return m;
  }

  updateMesh(m, vertices, opts = {}) {
    const d = this.device;
    const bytes = Math.max(16, (vertices.byteLength + 3) & ~3);
    if (!m.vbuf || m.vsize < bytes) {
      if (m.vbuf) this.deferredDestroy.push(m.vbuf);
      m.vbuf = d.createBuffer({ size: bytes, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      m.vsize = bytes;
    }
    if (vertices.byteLength) d.queue.writeBuffer(m.vbuf, 0, vertices.buffer, vertices.byteOffset, vertices.byteLength);
    m.vertexCount = vertices.byteLength / vertexLayout(m.format).byteStride;
    m.byteLength = vertices.byteLength;
    if (opts.quads !== undefined) m.quads = !!opts.quads;
    if (opts.indices) {
      const idx = opts.indices instanceof Uint32Array ? opts.indices : new Uint32Array(opts.indices);
      if (m.ibuf) this.deferredDestroy.push(m.ibuf);
      m.ibuf = d.createBuffer({ size: Math.max(16, (idx.byteLength + 3) & ~3), usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
      d.queue.writeBuffer(m.ibuf, 0, idx);
      m.indexCount = idx.length;
      m.quads = false;
    } else if (m.quads) {
      this._ensureQuads(m.vertexCount / 4);
      m.indexCount = (m.vertexCount / 4) * 6;
    } else m.indexCount = 0;
  }

  destroyMesh(m) {
    if (!m) return;
    if (m.vbuf) this.deferredDestroy.push(m.vbuf);
    if (m.ibuf) this.deferredDestroy.push(m.ibuf);
  }

  // ---------------------------------------------------------------- pipelines

  _pipeline(name, s, primitive) {
    const fmtOut = this.target ? 'rgba8unorm' : this.format;
    const key = fmtOut + name + '|' + (s.blend || 'none') + (s.depthTest === false ? 0 : 1) + (s.depthWrite === false ? 0 : 1) + (s.cull ? 1 : 0) + (s.polygonOffset ? 1 : 0) + (s.depthFunc === 'equal' ? 'e' : '') + (s.colorWrite === false ? 'n' : '') + primitive;
    let p = this.pipelines.get(key);
    if (p) return p;
    const fmt = PIPELINE_FORMAT[name];
    const mod = this.modules[name];
    const target = { format: fmtOut };
    if (s.colorWrite === false) target.writeMask = 0;
    if (s.blend && s.blend !== 'none') target.blend = BLENDS[s.blend] || BLENDS.alpha;
    const tri = primitive !== 'lines';
    p = this.device.createRenderPipeline({
      layout: this.layout,
      vertex: {
        module: mod, entryPoint: 'vs',
        buffers: [(() => {
          const L = vertexLayout(fmt);
          const fmtName = (a) => (a.type === 'unorm16' ? 'unorm16x' : a.type === 'unorm8' ? 'unorm8x' : 'float32x') + a.size;
          return { arrayStride: L.byteStride, attributes: L.attrs.map((a, i) => ({ shaderLocation: i, offset: a.byteOffset, format: fmtName(a) })) };
        })()],
      },
      fragment: { module: mod, entryPoint: 'fs', targets: [target] },
      primitive: { topology: tri ? 'triangle-list' : 'line-list', cullMode: s.cull && tri ? 'back' : 'none', frontFace: 'ccw' },
      depthStencil: {
        format: 'depth24plus', depthWriteEnabled: s.depthWrite !== false, depthCompare: s.depthTest === false ? 'always' : s.depthFunc === 'equal' ? 'equal' : 'less-equal',
        depthBias: s.polygonOffset && tri ? -1 : 0, depthBiasSlopeScale: s.polygonOffset && tri ? -1 : 0,
      },
    });
    this.pipelines.set(key, p);
    return p;
  }

  // ---------------------------------------------------------------- frame

  beginFrame(clear) {
    this.encoder = this.device.createCommandEncoder();
    this.target = null;
    this.colorTex = this.ctx.getCurrentTexture();
    this.colorView = this.colorTex.createView();
    this.drawCount = 0;
    this.globalCount = 0;
    this._pushGlobals();
    this._beginPass({ r: clear[0], g: clear[1], b: clear[2], a: 1 }, true);
  }

  _beginPass(clearColor, clearDepth) {
    if (this.pass) this.pass.end();
    this.pass = this.encoder.beginRenderPass({
      colorAttachments: [{ view: this.target ? this.target.view : this.colorView, loadOp: clearColor ? 'clear' : 'load', clearValue: clearColor || undefined, storeOp: 'store' }],
      depthStencilAttachment: { view: this.target ? this.target.depthView : this.depthView, depthLoadOp: clearDepth ? 'clear' : 'load', depthClearValue: 1, depthStoreOp: 'store' },
    });
    if (this.scissor) this._applyScissor();
  }

  clearDepth() { this._beginPass(null, true); }

  _pushGlobals() {
    if (this.globalCount >= this.globalCapacity) return;
    this.globalData.set(this.globalsData, this.globalCount * GLOBAL_STRIDE / 4);
    this.curGlobalOffset = this.globalCount * GLOBAL_STRIDE;
    this.globalCount++;
    const lm = this.lightmap;
    let bg = this.bg0Cache.get(lm);
    if (!bg) {
      bg = this.device.createBindGroup({ layout: this.bgl0, entries: [
        { binding: 0, resource: { buffer: this.globalBuf, size: 160 } },
        { binding: 1, resource: lm.gpu.createView() },
        { binding: 2, resource: this._sampler('linear', 'clamp', false) }] });
      this.bg0Cache.set(lm, bg);
    }
    this.curBg0 = bg;
  }

  setGlobals(g) {
    const G = this.globalsData;
    if (g.view) G.set(g.view, 0);
    if (g.proj) G.set(g.proj, 16);
    if (g.fogStart !== undefined) G[32] = g.fogStart;
    if (g.fogEnd !== undefined) G[33] = g.fogEnd;
    if (g.fogDensity !== undefined) G[34] = g.fogDensity;
    if (g.fogMode !== undefined) G[35] = g.fogMode;
    if (g.fogColor) { G[36] = g.fogColor[0]; G[37] = g.fogColor[1]; G[38] = g.fogColor[2]; }
    if (g.lightmap) this.lightmap = g.lightmap;
    if (this.encoder) this._pushGlobals();
  }

  setScissor(r) {
    this.scissor = r;
    if (this.pass) this._applyScissor();
  }

  _applyScissor() {
    const r = this.scissor;
    const tw = this.target ? this.target.width : this.width, th = this.target ? this.target.height : this.height;
    if (!r) { this.pass.setScissorRect(0, 0, tw, th); return; }
    const x = Math.max(0, Math.floor(r[0])), y = Math.max(0, Math.floor(r[1]));
    const w = Math.max(0, Math.min(tw - x, Math.ceil(r[2]))), h = Math.max(0, Math.min(th - y, Math.ceil(r[3])));
    this.pass.setScissorRect(x, y, w, h);
  }

  draw(d) {
    const m = d.mesh;
    if (!m || !m.vertexCount || !this.pass) return;
    if (this.drawCount >= this.drawCapacity) return; // grows at end of frame
    const off = this.drawCount * DRAW_STRIDE;
    this.drawData.set(d.model || IDENTITY, off / 4);
    this.drawData.set(d.params || DEFAULT_PARAMS[d.pipeline] || ZERO16, off / 4 + 16);
    this.drawCount++;
    const prim = d.primitive === 'lines' ? 'lines' : 'triangles';
    const pass = this.pass;
    pass.setPipeline(this._pipeline(d.pipeline, d.state || {}, prim));
    pass.setBindGroup(0, this.curBg0, [this.curGlobalOffset]);
    pass.setBindGroup(1, this.bg1, [off]);
    const t0 = (d.textures && d.textures[0] && d.textures[0].bg) ? d.textures[0] : this.white;
    pass.setBindGroup(2, t0.bg);
    pass.setVertexBuffer(0, m.vbuf);
    if (m.quads || m.ibuf) {
      pass.setIndexBuffer(m.quads ? this.quadBuffer : m.ibuf, 'uint32');
      const count = d.count !== undefined ? d.count : m.indexCount;
      if (count > 0) pass.drawIndexed(count, 1, d.first || 0, 0, 0);
    } else {
      const count = d.count !== undefined ? d.count : m.vertexCount;
      if (count > 0) pass.draw(count, 1, d.first || 0, 0);
    }
  }

  endFrame() {
    if (!this.encoder) return;
    this.pass.end();
    this.pass = null;
    const q = this.device.queue;
    if (this.drawCount) q.writeBuffer(this.drawBuf, 0, this.drawData.buffer, 0, this.drawCount * DRAW_STRIDE);
    if (this.globalCount) q.writeBuffer(this.globalBuf, 0, this.globalData.buffer, 0, this.globalCount * GLOBAL_STRIDE);
    let readback = null;
    if (this.captureWaiters.length) {
      const bpr = Math.ceil(this.width * 4 / 256) * 256;
      readback = { buf: this.device.createBuffer({ size: bpr * this.height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), bpr, w: this.width, h: this.height, waiters: this.captureWaiters.splice(0) };
      this.encoder.copyTextureToBuffer({ texture: this.colorTex }, { buffer: readback.buf, bytesPerRow: bpr }, [this.width, this.height]);
    }
    q.submit([this.encoder.finish()]);
    this.encoder = null;
    this.target = null;
    this.inflight = (this.inflight || 0) + 1;
    q.onSubmittedWorkDone().then(() => { this.inflight--; });
    const dead = this.deferredDestroy.splice(0);
    q.onSubmittedWorkDone().then(() => { for (const b of dead) b.destroy(); });
    if (readback) this._finishReadback(readback);
    // Grow uniform rings for the next frame if this frame overflowed
    if (this.drawCount >= this.drawCapacity || this.globalCount >= this.globalCapacity) {
      this.deferredDestroy.push(this.drawBuf, this.globalBuf);
      if (this.drawCount >= this.drawCapacity) this.drawCapacity *= 2;
      if (this.globalCount >= this.globalCapacity) this.globalCapacity *= 2;
      this._allocUniforms();
    }
  }

  async _finishReadback(r) {
    await r.buf.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(r.buf.getMappedRange());
    const out = new Uint8Array(r.w * r.h * 4);
    const bgra = this.format.startsWith('bgra');
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const s = y * r.bpr + x * 4, o = (y * r.w + x) * 4;
        out[o] = src[s + (bgra ? 2 : 0)]; out[o + 1] = src[s + 1]; out[o + 2] = src[s + (bgra ? 0 : 2)]; out[o + 3] = 255;
      }
    }
    r.buf.unmap();
    r.buf.destroy();
    for (const w of r.waiters) w({ width: r.w, height: r.h, data: out });
  }

  capture() { return new Promise((res) => this.captureWaiters.push(res)); }
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const ZERO16 = new Float32Array(16);
