// WebGL 2 implementation of the graphics device contract (see device.js).
import { DEFAULT_PARAMS, PIPELINE_FORMAT, quadIndices, buildMips, vertexLayout } from './device.js';

const HEADER = `#version 300 es
precision highp float;
uniform mat4 uView;
uniform mat4 uProj;
uniform mat4 uModel;
uniform vec4 uP[4];
uniform vec4 uFog;       // start, end, density, mode (0 linear, 1 exp, 2 none)
uniform vec3 uFogColor;
uniform sampler2D uTex0;
uniform sampler2D uLightmap;
float fogFactor(float d) {
  if (uFog.w > 1.5) return 0.0;
  if (uFog.w < 0.5) return clamp((d - uFog.x) / max(0.0001, uFog.y - uFog.x), 0.0, 1.0);
  return 1.0 - clamp(exp(-uFog.z * d), 0.0, 1.0);
}
vec3 lightmap(vec2 l) { return texture(uLightmap, vec2((l.y + 0.5) / 16.0, (l.x + 0.5) / 16.0)).rgb; }
`;

const SHADERS = {
  terrain: {
    vs: `
layout(location=0) in vec4 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol; layout(location=3) in vec2 aLight;
out vec2 vUv; out vec3 vCol; out vec2 vLight; out float vDepth;
void main() {
  vUv = aUv; vCol = aCol.rgb; vLight = aLight * 15.0;
  vec3 p = aPos.xyz * (65535.0 / 2048.0) - 8.0;
  vec4 mv = uView * uModel * vec4(p, 1.0); vDepth = length(mv.xyz); gl_Position = uProj * mv;
}`,
    fs: `
in vec2 vUv; in vec3 vCol; in vec2 vLight; in float vDepth; out vec4 o;
void main() {
  vec4 t = texture(uTex0, vUv);
  if (t.a < uP[0].x) discard;
  vec3 c = t.rgb * vCol * lightmap(vLight);
  o = vec4(mix(c, uFogColor, fogFactor(vDepth)), t.a * uP[0].y);
}`,
  },
  lit: {
    vs: `
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol; layout(location=3) in vec2 aLight;
out vec2 vUv; out vec4 vCol; out vec2 vLight; out float vDepth;
void main() { vUv = aUv; vCol = aCol; vLight = aLight; vec4 mv = uView * uModel * vec4(aPos, 1.0); vDepth = length(mv.xyz); gl_Position = uProj * mv; }`,
    fs: `
in vec2 vUv; in vec4 vCol; in vec2 vLight; in float vDepth; out vec4 o;
void main() {
  vec4 t = texture(uTex0, vUv);
  if (t.a < uP[0].x) discard;
  vec3 lm = vLight.x < 0.0 ? vec3(1.0) : lightmap(vLight);
  vec3 c = t.rgb * vCol.rgb * lm;
  o = vec4(mix(c, uFogColor, fogFactor(vDepth)), t.a * vCol.a);
}`,
  },
  entity: {
    vs: `
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec3 aNrm; layout(location=3) in vec3 aCol;
out vec2 vUv; out vec3 vCol; out float vShade; out float vDepth;
void main() {
  vUv = aUv * (uP[3].w > 0.0 ? uP[3].w : 1.0) + uP[3].yz; vCol = aCol;
  vec3 n = normalize(mat3(uModel) * aNrm);
  vec3 l0 = normalize(vec3(0.2, 1.0, -0.7)), l1 = normalize(vec3(-0.2, 1.0, 0.7));
  float d = 0.4 + 0.6 * (max(dot(n, l0), 0.0) + max(dot(n, l1), 0.0));
  vShade = uP[2].w > 0.5 ? 1.0 : min(1.0, d);
  vec4 mv = uView * uModel * vec4(aPos, 1.0); vDepth = length(mv.xyz); gl_Position = uProj * mv;
}`,
    fs: `
in vec2 vUv; in vec3 vCol; in float vShade; in float vDepth; out vec4 o;
void main() {
  vec4 t = texture(uTex0, vUv);
  if (t.a < uP[3].x) discard;
  vec3 lm = uP[2].z > 0.5 ? vec3(1.0) : lightmap(uP[2].xy);
  vec3 c = t.rgb * uP[0].rgb * vCol;
  c = mix(c, uP[1].rgb, uP[1].a);
  c *= vShade * lm;
  o = vec4(mix(c, uFogColor, fogFactor(vDepth)), t.a * uP[0].a);
}`,
  },
  color: {
    vs: `
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol;
out vec2 vUv; out vec4 vCol; out float vDepth;
void main() { vUv = aUv; vCol = aCol; vec4 mv = uView * uModel * vec4(aPos, 1.0); vDepth = length(mv.xyz); gl_Position = uProj * mv; }`,
    fs: `
in vec2 vUv; in vec4 vCol; in float vDepth; out vec4 o;
void main() {
  vec4 t = texture(uTex0, vUv) * vCol * uP[0];
  if (t.a < uP[1].x) discard;
  vec3 c = uP[1].y > 0.5 ? mix(t.rgb, uFogColor, fogFactor(vDepth)) : t.rgb;
  o = vec4(c, t.a);
}`,
  },
};

export class WebGL2Device {
  constructor(canvas, opts = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL 2 is not available');
    this.name = 'WebGL 2';
    this.rtOriginBottom = true; // render targets are sampled bottom-up
    // GL_VENDOR / GL_RENDERER / GL_VERSION for the debug screen (unmasked when the browser allows it)
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.info = {
      vendor: String(dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)),
      renderer: String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
      version: String(gl.getParameter(gl.VERSION)),
    };
    this.gl = gl;
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    // draw state cache (must exist before any texture / mesh is created)
    this.curState = '';
    this.curStateObj = null;
    this.curProgram = null;
    this.curVao = null;
    this.boundTex = [null, null];
    this.programs = {};
    for (const [name, src] of Object.entries(SHADERS)) this.programs[name] = this._program(name, src);
    this.quadBuffer = gl.createBuffer();
    this.quadCapacity = 0;
    this.quadGen = 0;
    this._ensureQuads(1 << 16);
    this.white = this.createTexture({ width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) });
    this.globals = { view: new Float32Array(16), proj: new Float32Array(16), fog: new Float32Array([0, 1, 0, 2]), fogColor: new Float32Array(3), lightmap: this.white };
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);
    gl.depthFunc(gl.LEQUAL);
  }

  _program(name, src) {
    const gl = this.gl;
    const compile = (type, text) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, HEADER + text);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Shader ${name}: ` + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, src.vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src.fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Program ${name}: ` + gl.getProgramInfoLog(p));
    const u = (n) => gl.getUniformLocation(p, n);
    return {
      p, uView: u('uView'), uProj: u('uProj'), uModel: u('uModel'), uP: u('uP'), uFog: u('uFog'), uFogColor: u('uFogColor'),
      uTex0: u('uTex0'), uLightmap: u('uLightmap'), globalsVersion: -1,
      lastModel: new Float32Array(16).fill(NaN), lastParams: new Float32Array(16).fill(NaN),
    };
  }

  _ensureQuads(quads) {
    if (quads <= this.quadCapacity) return;
    const gl = this.gl;
    let cap = Math.max(this.quadCapacity * 2, 1024);
    while (cap < quads) cap *= 2;
    gl.bindVertexArray(null); this.curVao = null;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices(cap), gl.STATIC_DRAW);
    this.quadCapacity = cap;
    this.quadGen++;
  }

  resize(w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.width = w; this.height = h;
  }

  // ---------------------------------------------------------------- textures

  createTexture(o) {
    const gl = this.gl;
    const mipLevels = o.mipmaps === true ? 4 : Math.max(0, o.mipmaps | 0);
    const t = { tex: gl.createTexture(), width: o.width, height: o.height, mipmaps: mipLevels > 0, mipLevels, filter: o.filter || 'nearest', wrap: o.wrap || 'clamp' };
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    this.boundTex[0] = null;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, o.width, o.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, o.data ? toU8(o.data) : null);
    const near = t.filter === 'nearest';
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, near ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, t.mipmaps ? (near ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR) : (near ? gl.NEAREST : gl.LINEAR));
    const wrap = t.wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (t.mipmaps && o.data) this._uploadMips(t, o.data);
    else if (t.mipmaps) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 0);
    return t;
  }

  // Offscreen colour + depth target; the returned object is also a normal (linear, clamped) texture
  createRenderTarget(w, h) {
    const gl = this.gl;
    const t = this.createTexture({ width: w, height: h, filter: 'linear', wrap: 'clamp' });
    t.fbo = gl.createFramebuffer();
    t.depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, t.depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, t.depth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target ? this.target.fbo : null);
    return t;
  }

  // Draw into a render target (null = the screen). clear = [r, g, b, a] clears colour + depth.
  setRenderTarget(t, clear) {
    const gl = this.gl;
    this.target = t || null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    gl.viewport(0, 0, t ? t.width : this.width, t ? t.height : this.height);
    gl.disable(gl.SCISSOR_TEST);
    if (clear) {
      gl.clearColor(clear[0], clear[1], clear[2], clear[3] === undefined ? 1 : clear[3]);
      gl.depthMask(true);
      gl.colorMask(true, true, true, true);
      this.curState = '';
      this.curStateObj = null;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
  }

  // True while the GPU is more than a frame behind (used to pace uncapped frame rates)
  busy() {
    const gl = this.gl, f = this.fences || (this.fences = []);
    while (f.length) {
      const st = gl.clientWaitSync(f[0], 0, 0);
      if (st !== gl.ALREADY_SIGNALED && st !== gl.CONDITION_SATISFIED) break;
      gl.deleteSync(f.shift());
    }
    return f.length >= 2;
  }

  _uploadMips(t, data) {
    const gl = this.gl;
    const mips = buildMips(t.width, t.height, toU8(data), t.mipLevels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, mips.length);
    mips.forEach((m, i) => gl.texImage2D(gl.TEXTURE_2D, i + 1, gl.RGBA, m.width, m.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, m.data));
  }

  updateTexture(t, data, x = 0, y = 0, w = t.width, h = t.height) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    this.boundTex[0] = null;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, toU8(data));
    if (t.mipmaps && x === 0 && y === 0 && w === t.width && h === t.height) this._uploadMips(t, data);
  }

  destroyTexture(t) { if (t && t.tex) this.gl.deleteTexture(t.tex); }

  // ---------------------------------------------------------------- meshes

  createMesh(format, vertices, opts = {}) {
    const gl = this.gl;
    const m = { format, vao: gl.createVertexArray(), vbo: gl.createBuffer(), ibo: null, vertexCount: 0, indexCount: 0, quads: !!opts.quads, dynamic: !!opts.dynamic, quadGen: -1 };
    gl.bindVertexArray(m.vao); this.curVao = m.vao;
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
    const L = vertexLayout(format);
    m.byteStride = L.byteStride;
    L.attrs.forEach((a, i) => {
      gl.enableVertexAttribArray(i);
      const type = a.type === 'unorm16' ? gl.UNSIGNED_SHORT : a.type === 'unorm8' ? gl.UNSIGNED_BYTE : gl.FLOAT;
      gl.vertexAttribPointer(i, a.size, type, a.type !== 'f32', L.byteStride, a.byteOffset);
    });
    gl.bindVertexArray(null); this.curVao = null;
    this.updateMesh(m, vertices, opts);
    return m;
  }

  updateMesh(m, vertices, opts = {}) {
    const gl = this.gl;
    gl.bindVertexArray(null); this.curVao = null;
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, m.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    m.vertexCount = vertices.byteLength / m.byteStride;
    m.byteLength = vertices.byteLength;
    if (opts.quads !== undefined) m.quads = !!opts.quads;
    if (opts.indices) {
      if (!m.ibo) m.ibo = gl.createBuffer();
      gl.bindVertexArray(m.vao); this.curVao = m.vao;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, opts.indices instanceof Uint32Array ? opts.indices : new Uint32Array(opts.indices), gl.STATIC_DRAW);
      gl.bindVertexArray(null); this.curVao = null;
      m.indexCount = opts.indices.length;
      m.quads = false;
    } else if (m.quads) {
      this._ensureQuads(m.vertexCount / 4);
      m.indexCount = (m.vertexCount / 4) * 6;
    } else m.indexCount = 0;
  }

  destroyMesh(m) {
    if (!m) return;
    const gl = this.gl;
    gl.deleteVertexArray(m.vao);
    gl.deleteBuffer(m.vbo);
    if (m.ibo) gl.deleteBuffer(m.ibo);
  }

  // ---------------------------------------------------------------- frame

  beginFrame(clear) {
    const gl = this.gl;
    if (this.target) { this.target = null; gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.depthMask(true);
    gl.colorMask(true, true, true, true);
    this.curState = '';
    this.curStateObj = null;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  clearDepth() {
    const gl = this.gl;
    gl.depthMask(true);
    this.curState = '';
    gl.clear(gl.DEPTH_BUFFER_BIT);
  }

  setGlobals(g) {
    const G = this.globals;
    if (g.view) G.view.set(g.view);
    if (g.proj) G.proj.set(g.proj);
    if (g.fogColor) G.fogColor.set(g.fogColor);
    if (g.fogStart !== undefined) G.fog[0] = g.fogStart;
    if (g.fogEnd !== undefined) G.fog[1] = g.fogEnd;
    if (g.fogDensity !== undefined) G.fog[2] = g.fogDensity;
    if (g.fogMode !== undefined) G.fog[3] = g.fogMode;
    if (g.lightmap) G.lightmap = g.lightmap;
    this.globalsVersion = (this.globalsVersion || 0) + 1;
  }

  setScissor(r) {
    const gl = this.gl;
    if (!r) { gl.disable(gl.SCISSOR_TEST); return; }
    gl.enable(gl.SCISSOR_TEST);
    const th = this.target ? this.target.height : this.height;
    gl.scissor(Math.floor(r[0]), Math.floor(th - r[1] - r[3]), Math.ceil(r[2]), Math.ceil(r[3]));
  }

  _applyState(s) {
    if (s === this.curStateObj) return;
    this.curStateObj = s;
    const key = (s.blend || 'none') + (s.depthTest === false ? 0 : 1) + (s.depthWrite === false ? 0 : 1) + (s.cull ? 1 : 0) + (s.polygonOffset ? 1 : 0) + (s.depthFunc === 'equal' ? 'e' : '') + (s.colorWrite === false ? 'n' : '');
    if (key === this.curState) return;
    this.curState = key;
    const gl = this.gl;
    const b = s.blend || 'none';
    if (b === 'none') gl.disable(gl.BLEND);
    else {
      gl.enable(gl.BLEND);
      switch (b) {
        case 'alpha': gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
        case 'add': gl.blendFunc(gl.SRC_ALPHA, gl.ONE); break;
        case 'invert': gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_COLOR); break;
        case 'darken': gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR); break;
        case 'multiply': gl.blendFunc(gl.DST_COLOR, gl.SRC_COLOR); break;
        default: gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
    }
    if (s.depthTest === false) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
    gl.depthMask(s.depthWrite !== false);
    gl.depthFunc(s.depthFunc === 'equal' ? gl.EQUAL : gl.LEQUAL);
    const cw = s.colorWrite !== false;
    gl.colorMask(cw, cw, cw, cw);
    if (s.cull) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
    if (s.polygonOffset) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1); } else gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  draw(d) {
    const gl = this.gl;
    const m = d.mesh;
    if (!m || !m.vertexCount) return;
    const prog = this.programs[d.pipeline];
    if (this.curProgram !== prog) { gl.useProgram(prog.p); this.curProgram = prog; }
    if (prog.globalsVersion !== this.globalsVersion) {
      const G = this.globals;
      gl.uniformMatrix4fv(prog.uView, false, G.view);
      gl.uniformMatrix4fv(prog.uProj, false, G.proj);
      gl.uniform4fv(prog.uFog, G.fog);
      gl.uniform3fv(prog.uFogColor, G.fogColor);
      gl.uniform1i(prog.uTex0, 0);
      gl.uniform1i(prog.uLightmap, 1);
      prog.globalsVersion = this.globalsVersion;
    }
    // Skip uniform uploads / binds that would not change anything (draw state caching)
    const model = d.model || IDENTITY;
    if (!same16(prog.lastModel, model)) { gl.uniformMatrix4fv(prog.uModel, false, model); prog.lastModel.set(model); }
    const params = d.params || DEFAULT_PARAMS[d.pipeline] || ZERO16;
    if (!same16(prog.lastParams, params)) { gl.uniform4fv(prog.uP, params); prog.lastParams.set(params); }
    const t0 = ((d.textures && d.textures[0]) || this.white).tex;
    if (this.boundTex[0] !== t0) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t0); this.boundTex[0] = t0; }
    const lm = (this.globals.lightmap || this.white).tex;
    if (this.boundTex[1] !== lm) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lm); gl.activeTexture(gl.TEXTURE0); this.boundTex[1] = lm; }
    this._applyState(d.state || EMPTY_STATE);
    if (this.curVao !== m.vao) { gl.bindVertexArray(m.vao); this.curVao = m.vao; }
    const mode = d.primitive === 'lines' ? gl.LINES : gl.TRIANGLES;
    if (m.quads) {
      if (m.quadGen !== this.quadGen) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadBuffer); m.quadGen = this.quadGen; }
      const first = d.first || 0;
      const count = d.count !== undefined ? d.count : m.indexCount;
      if (count > 0) gl.drawElements(mode, count, gl.UNSIGNED_INT, first * 4);
    } else if (m.ibo) {
      const count = d.count !== undefined ? d.count : m.indexCount;
      if (count > 0) gl.drawElements(mode, count, gl.UNSIGNED_INT, (d.first || 0) * 4);
    } else {
      const count = d.count !== undefined ? d.count : m.vertexCount;
      if (count > 0) gl.drawArrays(mode, d.first || 0, count);
    }
  }

  endFrame() {
    if (this.captureWaiters && this.captureWaiters.length) {
      const px = this._readPixels();
      for (const r of this.captureWaiters.splice(0)) r(px);
    }
    const gl = this.gl;
    (this.fences || (this.fences = [])).push(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0));
    if (this.fences.length > 8) gl.deleteSync(this.fences.shift());
    gl.flush();
  }

  capture() { return new Promise((res) => { (this.captureWaiters ||= []).push(res); }); }

  _readPixels() {
    const gl = this.gl;
    const w = this.width, h = this.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return { width: w, height: h, data: out };
  }
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const ZERO16 = new Float32Array(16);
const EMPTY_STATE = {};
function same16(a, b) {
  for (let i = 0; i < 16; i++) if (a[i] !== b[i]) return false;
  return true;
}
const toU8 = (d) => (d instanceof Uint8Array ? d : new Uint8Array(d.buffer, d.byteOffset, d.byteLength));
export { PIPELINE_FORMAT };
