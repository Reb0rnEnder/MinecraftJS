// Graphics device contract.
//
// The game never talks to WebGL/WebGPU/etc. directly. It renders through a tiny device interface
// that only needs: RGBA textures, float vertex buffers, triangle/line lists, four fixed shading
// "pipelines", a few blend modes, depth testing and a scissor rectangle. That is small enough to be
// implemented on top of WebGL 1/2, WebGPU, a native API, or even a software rasteriser.
//
// Device interface (every backend implements these):
//   name: string
//   info: { vendor, renderer, version }    for the debug screen
//   width, height                          drawing surface size in pixels
//   resize(width, height)
//   createTexture({ width, height, data?: Uint8Array RGBA, filter: 'nearest'|'linear', wrap: 'clamp'|'repeat', mipmaps?: bool | levels (0-4) }) -> Texture
//   updateTexture(tex, data, x=0, y=0, w=tex.width, h=tex.height)   (data covers the given rectangle)
//   destroyTexture(tex)
//   createMesh(format, vertices: Float32Array, { indices?: Uint16Array|Uint32Array, quads?: bool, dynamic?: bool }) -> Mesh
//        quads: vertices are groups of 4 forming quads (backend supplies indices)
//   updateMesh(mesh, vertices, { indices?, quads? })
//   destroyMesh(mesh)
//   beginFrame(clearColor [r,g,b])          clears colour + depth
//   clearDepth()
//   setGlobals({ view, proj, fogColor:[r,g,b], fogStart, fogEnd, fogDensity, fogMode: 0 linear|1 exp|2 none, lightmap: Texture })
//   setScissor(rect | null)                 rect = [x, y, w, h] in pixels, origin top-left
//   draw({ mesh, pipeline, textures: [Texture, ...], model: mat4, params: Float32Array(16), state, first?, count?, primitive?: 'triangles'|'lines' })
//   createRenderTarget(w, h) -> Texture     offscreen colour + depth, sampled linear/clamped
//   setRenderTarget(target | null, clear?: [r,g,b,a])   inside a frame: draw into target (null = screen)
//   busy() -> bool                          GPU is 2+ frames behind (pacing for uncapped frame rates)
//   endFrame()
//   capture() -> Promise<{ width, height, data }>  pixels of the next completed frame (top-left origin RGBA)
//
// Pipelines (fixed shading programs) and their vertex formats / params layout (4 x vec4):
//   terrain : FORMAT.terrain  tex0 = atlas, uses globals.lightmap        params[0] = [alphaTest, opacity, -, -]
//   lit     : FORMAT.lit      tex0 = any, uses globals.lightmap          params[0] = [alphaTest, -, -, -]   (light.x < 0 => full bright)
//   entity  : FORMAT.entity   tex0 = any, uses globals.lightmap          params = [tint rgba], [overlay rgba], [sky, block, fullBright, lighting (0 world, 1 none, 2 GUI)], [alphaTest, uOffset, vOffset, uvScale (0 = 1)]
//   color   : FORMAT.color    tex0 = any (white texture for flat colour) params = [colour rgba], [alphaTest, useFog, -, -]
//   endportal: FORMAT.color   tex0 = layer texture, sampled at the fragment's screen position (TileEntityEndPortalRenderer's
//              texgen): params = [colour rgb, layer (0: blended sky, 1+: additive)], [scale, angle (rad), offset u, v],
//              [target width, target height, -, -]
//   post    : FORMAT.color  a full-screen pass of a vanilla post-processing program (shaders/program/*), vertices in clip
//              space with uv (0, 0) at the top left. tex0 = DiffuseSampler, globals.lightmap = BlurSampler (aux); both
//              read with nearest texel fetches like vanilla's framebuffers. params[0].x = program: 0 blit
//              [ColorModulate = p1], 1 invert [InverseAmount = p0.y], 2 color_convolve [Saturation = p0.y, Red / Green /
//              BlueMatrix = p1 / p2 / p3 .xyz], 3 bits [Resolution, Saturation, MosaicSize = p0.yzw], 4 blur [BlurDir =
//              p1.xy, Radius = p1.z], 5 spider (rotscale + spiderclip) [InRotation = p0.y, InScale = p1.xy, InOffset =
//              p1.zw, Scissor = p2, Vignette = p3]
//
// state: { blend: 'none'|'alpha'|'add'|'invert'|'darken'|'multiply', depthTest: bool, depthWrite: bool, cull: bool, polygonOffset: bool, depthFunc: 'lequal'|'equal', colorWrite: bool }

// Float formats: stride and offsets in floats. Packed formats (packed: true): byteStride, attrs
// [name, components, byteOffset, type] with type 'unorm16' | 'unorm8' (normalised to 0..1 in shaders).
export const FORMAT = {
  // Section meshes, 20 bytes/vertex (like Sodium's compact format):
  //   pos  unorm16 x4: (p + 8) * 2048 (1/2048 block grid, integer positions exact), w unused
  //   uv   unorm16 x2: atlas uv * 65535
  //   col  unorm8 x4:  r g b (a unused)
  //   light unorm8 x2: sky / 15, block / 15
  terrain: { name: 'terrain', packed: true, byteStride: 20, attrs: [['pos', 4, 0, 'unorm16'], ['uv', 2, 8, 'unorm16'], ['col', 4, 12, 'unorm8'], ['light', 2, 16, 'unorm8']] },
  lit: { name: 'lit', stride: 11, attrs: [['pos', 3, 0], ['uv', 2, 3], ['col', 4, 5], ['light', 2, 9]] },
  entity: { name: 'entity', stride: 11, attrs: [['pos', 3, 0], ['uv', 2, 3], ['nrm', 3, 5], ['col', 3, 8]] },
  color: { name: 'color', stride: 9, attrs: [['pos', 3, 0], ['uv', 2, 3], ['col', 4, 5]] },
};

// Per-attribute layout of any format: { byteStride, attrs: [{ size, byteOffset, type: 'f32'|'unorm16'|'unorm8' }] }
export function vertexLayout(f) {
  if (f.packed) return { byteStride: f.byteStride, attrs: f.attrs.map(([, size, byteOffset, type]) => ({ size, byteOffset, type })) };
  return { byteStride: f.stride * 4, attrs: f.attrs.map(([, size, off]) => ({ size, byteOffset: off * 4, type: 'f32' })) };
}

// Packs terrain vertices (see FORMAT.terrain)
export const TERRAIN_POS_SCALE = 2048;

export const PIPELINE_FORMAT = { terrain: FORMAT.terrain, lit: FORMAT.lit, entity: FORMAT.entity, color: FORMAT.color, endportal: FORMAT.color, post: FORMAT.color };

export const DEFAULT_STATE = { blend: 'none', depthTest: true, depthWrite: true, cull: false, polygonOffset: false };

export function stateKey(s) {
  return `${s.blend || 'none'}|${s.depthTest !== false ? 1 : 0}|${s.depthWrite !== false ? 1 : 0}|${s.cull ? 1 : 0}|${s.polygonOffset ? 1 : 0}`;
}

// Params helpers -----------------------------------------------------------

export function terrainParams(alphaTest = 0, opacity = 1, out = new Float32Array(16), mipBias = 0) {
  out[0] = alphaTest; out[1] = opacity; out[2] = mipBias;
  return out;
}

export function litParams(alphaTest = 0.1, out = new Float32Array(16)) {
  out[0] = alphaTest;
  return out;
}

export function colorParams(r = 1, g = 1, b = 1, a = 1, alphaTest = 0, useFog = 0, out = new Float32Array(16)) {
  out[0] = r; out[1] = g; out[2] = b; out[3] = a;
  out[4] = alphaTest; out[5] = useFog;
  return out;
}

export class EntityParams {
  constructor() {
    this.p = new Float32Array(16);
    this.setTint(1, 1, 1, 1);
    this.setLight(15, 15);
    this.p[12] = 0.1;
  }
  setTint(r, g, b, a = 1) { this.p[0] = r; this.p[1] = g; this.p[2] = b; this.p[3] = a; return this; }
  setOverlay(r, g, b, a) { this.p[4] = r; this.p[5] = g; this.p[6] = b; this.p[7] = a; return this; }
  setLight(sky, block) { this.p[8] = sky; this.p[9] = block; return this; }
  setFullBright(v) { this.p[10] = v ? 1 : 0; return this; }
  setNoLighting(v) { this.p[11] = v ? 1 : 0; return this; }
  setGuiLighting(v) { this.p[11] = v ? 2 : 0; return this; } // RenderHelper.enableGUIStandardItemLighting
  setAlphaTest(v) { this.p[12] = v; return this; }
  setUvTransform(du, dv, scale = 0) { this.p[13] = du; this.p[14] = dv; this.p[15] = scale; return this; }
}

// Params used when a draw passes none (white, no alpha test)
export const DEFAULT_PARAMS = {
  terrain: terrainParams(0, 1),
  lit: litParams(0),
  entity: new EntityParams().setAlphaTest(0).p,
  color: colorParams(1, 1, 1, 1),
  endportal: new Float32Array(16),
  post: new Float32Array([0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
};

// Shared helpers ------------------------------------------------------------

export function quadIndices(quads) {
  const idx = new Uint32Array(quads * 6);
  for (let i = 0; i < quads; i++) {
    const v = i * 4, o = i * 6;
    idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2;
    idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3;
  }
  return idx;
}

// Box-filtered mip chain (RGBA). Returns [{width, height, data}, ...] excluding level 0.
export function buildMips(width, height, data, maxLevels = 4) {
  const out = [];
  let w = width, h = height, src = data;
  for (let l = 0; l < maxLevels && (w > 1 || h > 1); l++) {
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1);
    const dst = new Uint8Array(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(w - 1, x * 2 + dx), sy = Math.min(h - 1, y * 2 + dy);
          const i = (sy * w + sx) * 4;
          const al = src[i + 3];
          r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n++;
        }
        const o = (y * nw + x) * 4;
        if (a > 0) { dst[o] = r / a; dst[o + 1] = g / a; dst[o + 2] = b / a; }
        dst[o + 3] = a / n;
      }
    }
    out.push({ width: nw, height: nh, data: dst });
    w = nw; h = nh; src = dst;
  }
  return out;
}

// A device that does nothing (headless / unsupported environments)
export class NullDevice {
  constructor() { this.name = 'null'; this.width = 1; this.height = 1; }
  resize(w, h) { this.width = w; this.height = h; }
  createTexture(o) { return { width: o.width, height: o.height }; }
  updateTexture() {}
  destroyTexture() {}
  createMesh(format, vertices, opts = {}) { return { format, vertexCount: vertices.byteLength / vertexLayout(format).byteStride, indexCount: 0, ...opts }; }
  updateMesh(m, v) { m.vertexCount = v.byteLength / vertexLayout(m.format).byteStride; }
  destroyMesh() {}
  beginFrame() {}
  clearDepth() {}
  setGlobals() {}
  setScissor() {}
  draw() {}
  createRenderTarget(w, h) { return { width: w, height: h }; }
  setRenderTarget() {}
  busy() { return false; }
  endFrame() {}
  capture() { return Promise.resolve({ width: 1, height: 1, data: new Uint8Array(4) }); }
}
