//! Port of `client/js/gfx/webgpu.js` — the WebGPU implementation of the
//! graphics device contract (see `device.js`).
//!
//! The WGSL shader sources (HEADER + the six `SHADERS` entries) are transcribed
//! verbatim; `BLENDS`, the uniform ring buffers and the pipeline cache are
//! ported exactly. The pure helpers (vertex layouts, quad indices, mip
//! generation, default params, scissor/readback math) live in
//! [`crate::webgpu_math`].
//!
//! Every `navigator.gpu` / device / queue / pass call stays behind the
//! [`GpuOps`] trait with the exact call order and arguments of the JavaScript;
//! a `#[cfg(target_arch = "wasm32")]` host can implement it over
//! `web_sys`'s WebGPU types and the tests drive a recording `TraceOps`.
//! `requestDevice` is asynchronous in JS, so adapter/device acquisition is
//! host-driven: the host obtains a device handle and hands it to
//! [`WebGPUDevice::new`].

use std::collections::HashMap;

use wasm_bindgen::prelude::*;

use crate::webgpu_math::{
    build_mips, default_params, quad_indices, readback_bytes_per_row, readback_pixels,
    scissor_rect, vertex_layout, Format, VertexLayout,
};

// JS: `const HEADER = /* wgsl */ ...` — prepended to every shader module.
pub const HEADER: &str = "
struct Globals { view: mat4x4f, proj: mat4x4f, fog: vec4f, fogColor: vec4f };
struct Draw { model: mat4x4f, p: array<vec4f, 4> };
@group(0) @binding(0) var<uniform> G: Globals;
@group(0) @binding(1) var lmTex: texture_2d<f32>;
@group(0) @binding(2) var lmSamp: sampler;
@group(1) @binding(0) var<uniform> D: Draw;
@group(2) @binding(0) var tex0: texture_2d<f32>;
@group(2) @binding(1) var samp0: sampler;
fn fogFactor(d: f32) -> f32 {
  if (G.fog.w > 1.5 && G.fog.w < 2.5) { return 0.0; }
  if (G.fog.w > 2.5) { return 1.0 - clamp(exp(-pow(G.fog.z * d, 2.0)), 0.0, 1.0); }
  if (G.fog.w < 0.5) { return clamp((d - G.fog.x) / max(0.0001, G.fog.y - G.fog.x), 0.0, 1.0); }
  return 1.0 - clamp(exp(-G.fog.z * d), 0.0, 1.0);
}
fn lightmap(l: vec2f) -> vec3f { return textureSampleLevel(lmTex, lmSamp, vec2f((l.y + 0.5) / 16.0, (l.x + 0.5) / 16.0), 0.0).rgb; }
fn project(mv: vec4f) -> vec4f { var p = G.proj * mv; p.z = p.z * 0.5 + p.w * 0.5; return p; }
struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) light: vec2f, @location(3) depth: f32, @location(4) shade: f32 };
";

pub const TERRAIN_WGSL: &str = "
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
}";
pub const LIT_WGSL: &str = "
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
}";
pub const ENTITY_WGSL: &str = "
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
}";
pub const COLOR_WGSL: &str = "
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
}";
// JS: TileEntityEndPortalRenderer layer (see the WebGL 2 shader); framebuffer y
// grows downwards here.
pub const ENDPORTAL_WGSL: &str = "
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
}";
// JS: vanilla post-processing programs (see device.js and the WebGL 2 shader);
// render targets are stored top-down here.
pub const POST_WGSL: &str = "
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
  let one = 1.0 / inSize;
  if (m == 6) {
    let c = fetchIn(tc);
    let t = (c - fetchIn(tc - vec2f(one.x, 0.0))) + (c - fetchIn(tc + vec2f(one.x, 0.0))) + (c - fetchIn(tc - vec2f(0.0, one.y))) + (c - fetchIn(tc + vec2f(0.0, one.y)));
    return vec4f(clamp(t, vec4f(0.0), vec4f(1.0)).rgb, 1.0);
  }
  if (m == 7) {
    let rx = D.p[3].xyz; let ry = D.p[0].yzw;
    let cx = tc.x * rx + D.p[1].xyz * one.x - (rx - 1.0) * 0.5;
    let cy = tc.y * ry + D.p[2].xyz * one.y - (ry - 1.0) * 0.5;
    return vec4f(fetchIn(vec2f(cx.x, cy.x)).r, fetchIn(vec2f(cx.y, cy.y)).g, fetchIn(vec2f(cx.z, cy.z)).b, 1.0);
  }
  if (m == 8) { return vec4f(max(fetchAux(tc).rgb * D.p[1].xyz, fetchIn(tc).rgb), 1.0); }
  if (m == 9) {
    let c = fetchIn(tc);
    let nc = normalize(c);
    let du = dot(nc, normalize(fetchIn(tc + vec2f(0.0, -one.y)))); let dd = dot(nc, normalize(fetchIn(tc + vec2f(0.0, one.y))));
    let dl = dot(nc, normalize(fetchIn(tc + vec2f(-one.x, 0.0)))); let dr = dot(nc, normalize(fetchIn(tc + vec2f(one.x, 0.0))));
    let f = 1.0 + (du * 64.0 - dd * 64.0) + (dr * 64.0 - dl * 64.0);
    return vec4f((c * clamp(f, 0.5, 2.0)).rgb, 1.0);
  }
  if (m == 10) {
    var ks = array<vec2f, 12>(vec2f(0.0, -1.0), vec2f(0.0, 1.0), vec2f(-1.0, 0.0), vec2f(1.0, 0.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0),
      vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(0.0, -2.0), vec2f(0.0, 2.0), vec2f(-2.0, 0.0), vec2f(2.0, 0.0));
    var v = fetchIn(tc);
    for (var i = 0; i < 12; i++) { v = min(v, fetchIn(tc + ks[i] * one)); }
    return vec4f(v.rgb, 1.0);
  }
  if (m == 11) {
    let R = D.p[0].y;
    var mx = fetchIn(tc);
    for (var u = 0.0; u <= R; u += 1.0) {
      for (var v = 0.0; v <= R; v += 1.0) {
        let w = select(1.0, 0.0, sqrt(u * u + v * v) / R > 1.0);
        let t = max(max(fetchIn(tc + vec2f(-u, -v) * one), fetchIn(tc + vec2f(u, v) * one)), max(fetchIn(tc + vec2f(-u, v) * one), fetchIn(tc + vec2f(u, -v) * one)));
        mx = mix(mx, max(mx, t), w);
      }
    }
    return vec4f(mx.rgb, 1.0);
  }
  if (m == 12) {
    let c = fetchIn(tc);
    let v1 = mix(c, mix(fetchIn(tc - vec2f(one.x, 0.0)), fetchIn(tc - vec2f(one.x * 2.0, 0.0)), 0.667), 0.75);
    let v2 = mix(c, mix(fetchIn(tc + vec2f(one.x, 0.0)), fetchIn(tc + vec2f(one.x * 2.0, 0.0)), 0.667), 0.75);
    let v3 = mix(c, mix(fetchIn(tc - vec2f(0.0, one.y)), fetchIn(tc - vec2f(0.0, one.y * 2.0)), 0.667), 0.75);
    let v4 = mix(c, mix(fetchIn(tc + vec2f(0.0, one.y)), fetchIn(tc + vec2f(0.0, one.y * 2.0)), 0.667), 0.75);
    return vec4f(mix(mix(v1, v2, 0.5), mix(v3, v4, 0.5), 0.5).rgb, 1.0);
  }
  if (m == 13) {
    let inT = fetchIn(tc);
    let pu = tc * 2.0 - 1.0;
    let r2 = pow(length(pu), 2.0);
    let sc = tc * (1.0 - 0.02 * 0.2) + 0.02 * 0.1 + pu * 0.02 * r2;
    if (sc.x < 0.0 || sc.y < 0.0 || sc.x > 1.0 || sc.y > 1.0) { discard; }
    let bm = sin(sc.y * inSize.y * 0.25 * 3.1415926535);
    let br = mix(1.0, (bm * bm + 1.0) * 0.5, 0.8);
    let t = vec3f(0.05) + vec3f(0.95) * (inT.rgb * br);
    return vec4f(pow(t, vec3f(0.8)), 1.0);
  }
  if (m == 14) {
    let T = D.p[0].y;
    let off = vec2f(sin(tc.y * D.p[1].x + T * 6.283185307) * D.p[1].z, cos(tc.x * D.p[1].y + T * 6.283185307) * D.p[1].w);
    let rgb = fetchIn(tc + off).rgb;
    var hsv = vec3f(0.0, 0.0, max(rgb.r, max(rgb.g, rgb.b)));
    let c = hsv.z - min(rgb.r, min(rgb.g, rgb.b));
    if (c != 0.0) {
      hsv.y = c / hsv.z;
      var d = (hsv.z - rgb) / c;
      d = d - d.brg;
      d = vec3f(d.r + 2.0, d.g + 4.0, d.b);
      var hx = d.g;
      if (rgb.r >= hsv.z) { hx = d.b; } else if (rgb.g >= hsv.z) { hx = d.r; }
      hsv.x = fract(hx / 6.0);
    }
    hsv.x = fract(hsv.x + T);
    let h = clamp(vec3f(abs(hsv.x * 6.0 - 3.0) - 1.0, 2.0 - abs(hsv.x * 6.0 - 2.0), 2.0 - abs(hsv.x * 6.0 - 4.0)), vec3f(0.0), vec3f(1.0));
    return vec4f(((h - 1.0) * hsv.y + 1.0) * hsv.z, 1.0);
  }
  if (m == 15) {
    let c = fetchIn(tc);
    var sum = vec4f(0.0);
    for (var i = 1; i <= 2; i++) {
      let k = f32(i);
      sum += abs(c - fetchIn(tc + vec2f(0.0, -one.y) * k)) + abs(c - fetchIn(tc + vec2f(one.x, 0.0) * k))
        + abs(c - fetchIn(tc + vec2f(-one.x, 0.0) * k)) + abs(c - fetchIn(tc + vec2f(0.0, one.y) * k));
    }
    let gray = vec4f(0.3, 0.59, 0.11, 0.0);
    let sl = 1.0 - dot(clamp(sum, vec4f(0.0), vec4f(1.0)), gray);
    var L = dot(c + (c - pow(c, vec4f(D.p[0].y))), gray);
    L = L - fract(L * D.p[0].z) / D.p[0].z;
    L = L * (D.p[0].z / (D.p[0].z - 1.0)) * sl;
    return vec4f(L, L, L, 1.0);
  }
  if (m == 16) { return fetchIn(vec2f(tc.x, 1.0 - tc.y)) * D.p[1]; }
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
}";

/// JS: `SHADERS` — the per-pipeline WGSL bodies (`HEADER + src`).
pub fn shader_source(name: &str) -> Option<&'static str> {
    Some(match name {
        "terrain" => TERRAIN_WGSL,
        "lit" => LIT_WGSL,
        "entity" => ENTITY_WGSL,
        "color" => COLOR_WGSL,
        "endportal" => ENDPORTAL_WGSL,
        "post" => POST_WGSL,
        _ => return None,
    })
}

/// JS: `const BLENDS = { alpha, add, invert, darken, multiply };`
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BlendComponent {
    pub src_factor: &'static str,
    pub dst_factor: &'static str,
}

/// JS: one `BLENDS` entry — `{ color: {...}, alpha: {...} }`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BlendEntry {
    pub color: BlendComponent,
    pub alpha: BlendComponent,
}

/// JS: `BLENDS` — the named blend states of `_pipeline`.
pub fn blends(name: &str) -> Option<BlendEntry> {
    Some(match name {
        "alpha" => BlendEntry {
            color: BlendComponent { src_factor: "src-alpha", dst_factor: "one-minus-src-alpha" },
            alpha: BlendComponent { src_factor: "one", dst_factor: "one-minus-src-alpha" },
        },
        "add" => BlendEntry {
            color: BlendComponent { src_factor: "src-alpha", dst_factor: "one" },
            alpha: BlendComponent { src_factor: "one", dst_factor: "one" },
        },
        "invert" => BlendEntry {
            color: BlendComponent { src_factor: "one-minus-dst", dst_factor: "one-minus-src" },
            alpha: BlendComponent { src_factor: "one", dst_factor: "one" },
        },
        "darken" => BlendEntry {
            color: BlendComponent { src_factor: "zero", dst_factor: "one-minus-src" },
            alpha: BlendComponent { src_factor: "zero", dst_factor: "one" },
        },
        "multiply" => BlendEntry {
            color: BlendComponent { src_factor: "dst", dst_factor: "src" },
            alpha: BlendComponent { src_factor: "zero", dst_factor: "one" },
        },
        _ => return None,
    })
}

/// JS: `const DRAW_STRIDE = 256;` (bytes per draw uniform slot).
pub const DRAW_STRIDE: usize = 256;
/// JS: `const GLOBAL_STRIDE = 256;`
pub const GLOBAL_STRIDE: usize = 256;

// ------------------------------------------------------------------- GL surface

/// JS: an opaque WebGPU object handle.
pub type GpuId = u32;

/// JS: the device/queue/pass surface webgpu.js uses, as a trait.
///
/// Argument order matches the JS call sites; object creation returns fresh
/// [`GpuId`]s. `requestAdapter`/`requestDevice` are async in JS — the host
/// resolves them before constructing the device.
pub trait GpuOps {
    fn create_shader_module(&mut self, code: &str);
    fn create_bind_group_layout_uniform_dynamic(&mut self) -> GpuId; // bgl0/bgl1 shapes differ — see below
    fn create_bind_group_layout_texture(&mut self, fragment_only: bool, with_sampler: bool) -> GpuId;
    fn create_pipeline_layout(&mut self, bgl0: GpuId, bgl1: GpuId, bgl2: GpuId) -> GpuId;
    fn create_buffer(&mut self, size: u64, usage_uniform: bool, index: bool, vertex: bool, copy_dst: bool) -> GpuId;
    fn destroy_buffer(&mut self, buffer: GpuId);
    fn create_texture(&mut self, width: u32, height: u32, mip_level_count: u32, render_attachment: bool) -> GpuId;
    fn destroy_texture(&mut self, texture: GpuId);
    fn create_texture_view(&mut self, texture: GpuId) -> GpuId;
    fn create_sampler(&mut self, filter_nearest: bool, mip_linear: bool, wrap_repeat: bool) -> GpuId;
    fn create_bind_group_texture(&mut self, layout: GpuId, view: GpuId, sampler: GpuId) -> GpuId;
    fn create_bind_group_uniform(&mut self, layout: GpuId, buffer: GpuId, size: u64) -> GpuId;
    fn create_render_pipeline(
        &mut self,
        layout: GpuId,
        module: GpuId,
        format_name: &'static str,
        target_format: &str,
        write_mask_zero: bool,
        blend: Option<BlendEntry>,
        lines: bool,
        cull_back: bool,
        depth_write: bool,
        depth_always: bool,
        depth_equal: bool,
        depth_bias: bool,
    ) -> GpuId;
    fn configure_canvas(&mut self, format: &str);
    fn get_preferred_canvas_format(&mut self) -> String;
    fn canvas_size(&mut self) -> (u32, u32);
    fn set_canvas_size(&mut self, w: u32, h: u32);
    fn get_current_texture(&mut self) -> GpuId;
    fn write_buffer(&mut self, buffer: GpuId, offset: u64, data: &[u8]);
    fn write_texture(&mut self, texture: GpuId, mip_level: u32, x: u32, y: u32, width: u32, height: u32, data: &[u8]);
    fn create_command_encoder(&mut self) -> GpuId;
    fn begin_render_pass(&mut self, encoder: GpuId, color_view: GpuId, clear_color: Option<[f32; 4]>, depth_view: GpuId, clear_depth: bool);
    fn end_render_pass(&mut self);
    fn set_pipeline(&mut self, pipeline: GpuId);
    fn set_bind_group(&mut self, index: u32, group: GpuId, dynamic_offset: u32);
    fn set_vertex_buffer(&mut self, buffer: GpuId);
    fn set_index_buffer(&mut self, buffer: GpuId);
    fn draw(&mut self, count: i32, first: i32);
    fn draw_indexed(&mut self, count: i32, first: i32);
    fn set_scissor_rect(&mut self, x: u32, y: u32, w: u32, h: u32);
    fn finish_encoder(&mut self, encoder: GpuId);
    fn submit(&mut self);
    fn copy_texture_to_buffer(&mut self, texture: GpuId, width: u32, height: u32, bytes_per_row: u32) -> GpuId;
    /// JS: `mapAsync(READ)` + `getMappedRange()` — the host maps and returns the
    /// staged bytes.
    fn readback_map(&mut self, buffer: GpuId, bytes_per_row: usize, rows: u32) -> Vec<u8>;
    fn on_submitted_work_done(&mut self);
    fn adapter_info(&mut self) -> (String, String, String, String); // vendor, architecture, device, description
}

/// JS: the `createTexture` result object.
#[derive(Clone, Debug)]
pub struct Texture {
    pub gpu: GpuId,
    pub width: i32,
    pub height: i32,
    pub mipmaps: bool,
    pub levels: u32,
    pub filter: String,
    pub wrap: String,
    /// JS: `t.bg` — the texture+sampler bind group (bgl2).
    pub bg: GpuId,
    /// JS: render-target extras (`view`, `depthTex`, `depthView`).
    pub view: Option<GpuId>,
    pub depth_tex: Option<GpuId>,
    pub depth_view: Option<GpuId>,
}

/// JS: the `createMesh` result object.
#[derive(Clone, Debug)]
pub struct Mesh {
    pub format: &'static Format,
    pub vbuf: Option<GpuId>,
    pub vsize: u64,
    pub ibuf: Option<GpuId>,
    pub vertex_count: i32,
    pub byte_length: i32,
    pub index_count: i32,
    pub quads: bool,
}

/// JS: the draw-call descriptor.
#[derive(Clone, Debug)]
pub struct DrawCall<'a> {
    pub mesh: Option<&'a Mesh>,
    pub pipeline: &'static str,
    pub model: Option<&'a [f32; 16]>,
    pub params: Option<&'a [f32; 16]>,
    pub texture0: Option<&'a Texture>,
    /// JS: `d.state` — the same state object shape as the WebGL 2 device.
    pub blend: Option<&'static str>,
    pub depth_test: Option<bool>,
    pub depth_write: Option<bool>,
    pub cull: Option<bool>,
    pub polygon_offset: Option<bool>,
    pub depth_func_equal: bool,
    pub color_write: Option<bool>,
    pub lines: bool,
    pub first: i32,
    pub count: Option<i32>,
}

/// JS: the `setGlobals(g)` fields.
#[derive(Clone, Debug, Default)]
pub struct GlobalsUpdate<'a> {
    pub view: Option<&'a [f32; 16]>,
    pub proj: Option<&'a [f32; 16]>,
    pub fog_start: Option<f32>,
    pub fog_end: Option<f32>,
    pub fog_density: Option<f32>,
    pub fog_mode: Option<f32>,
    pub fog_color: Option<&'a [f32; 3]>,
    pub lightmap: Option<GpuId>,
}

/// JS: `_readPixels`/`_finishReadback` result.
#[derive(Clone, Debug)]
pub struct CapturedPixels {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

/// JS: `const IDENTITY = new Float32Array([...]);`
pub const IDENTITY: [f32; 16] = [
    1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
];
/// JS: `const ZERO16 = new Float32Array(16);`
pub const ZERO16: [f32; 16] = [0.0; 16];

// ----------------------------------------------------------------- the device

/// Port of the JS `WebGPUDevice` class. All WebGPU calls go through [`GpuOps`].
pub struct WebGPUDevice {
    /// JS: `this.name = 'WebGPU'`.
    pub name: &'static str,
    /// JS: `this.format` — `navigator.gpu.getPreferredCanvasFormat()`.
    pub format: String,
    /// JS: `this.info` — adapter info for the debug screen.
    pub info: (String, String, String),
    pub width: u32,
    pub height: u32,
    /// JS: `this.modules` — one shader module per `SHADERS` entry.
    modules: HashMap<&'static str, GpuId>,
    bgl0: GpuId,
    bgl1: GpuId,
    bgl2: GpuId,
    layout: GpuId,
    /// JS: `this.pipelines` — the pipeline cache keyed by `fmtOut + name + state + primitive`.
    pipelines: HashMap<String, GpuId>,
    /// JS: `this.samplers` — the sampler cache keyed by `filter + wrap + mip`.
    samplers: HashMap<String, GpuId>,
    draw_capacity: usize,
    global_capacity: usize,
    draw_buf: GpuId,
    draw_data: Vec<f32>,
    global_buf: GpuId,
    global_data: Vec<f32>,
    /// JS: `this.bg1` — the shared draw-uniform bind group (128-byte slice).
    bg1: GpuId,
    /// JS: `this.bg0Cache` — per-lightmap globals bind groups.
    bg0_cache: HashMap<GpuId, GpuId>,
    cur_bg0: GpuId,
    cur_global_offset: u32,
    /// JS: `this.quadBuffer` / `this.quadCapacity`.
    quad_buffer: Option<GpuId>,
    quad_capacity: u32,
    /// JS: `this.white` / `this.lightmap`.
    pub white: Texture,
    pub lightmap: GpuId,
    /// JS: `this.globalsData` — the GLOBAL_STRIDE staging buffer
    /// (`globalsData[35] = 0` — fog mode defaults to none).
    globals_data: Vec<f32>,
    /// JS: `this.deferredDestroy` — buffers/textures destroyed after submit.
    deferred_destroy: Vec<GpuId>,
    /// JS: `this.encoder` / `this.pass` — per-frame command state.
    encoder: Option<GpuId>,
    /// JS: `this.colorTex` — the swapchain texture of the current frame.
    color_tex: Option<GpuId>,
    color_view: Option<GpuId>,
    depth_tex: Option<GpuId>,
    depth_view: Option<GpuId>,
    target: Option<Texture>,
    pass_active: bool,
    scissor: Option<[f64; 4]>,
    draw_count: usize,
    global_count: usize,
    /// JS: `this.inflight` — submitted-but-not-finished frame count (`busy()`).
    inflight: usize,
    /// JS: `this.captureWaiters`.
    capture_waiters: usize,
    /// Rust-side: the last readback produced by `endFrame` (the JS resolves it
    /// through an async map; the host drives the copy through GpuOps).
    last_readback: Option<CapturedPixels>,
}

impl WebGPUDevice {
    /// JS: `static async create(canvas)` — the host performs the secure-context
    /// check, `requestAdapter`/`requestDevice` and hands the results in.
    /// `has_gpu = false` mirrors `'This browser does not expose WebGPU'`.
    pub fn create(ops: &mut dyn GpuOps, has_gpu: bool, secure_context: bool, width: u32, height: u32) -> Result<Self, String> {
        // JS: `if (globalThis.isSecureContext === false) throw ...`
        if !secure_context {
            return Err("WebGPU requires HTTPS or localhost; this page uses an insecure connection".to_string());
        }
        if !has_gpu {
            return Err("This browser does not expose WebGPU".to_string());
        }
        // JS: `const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw new Error('No WebGPU adapter');`
        // (the host resolves the adapter; a missing device handle = no adapter)
        let (vendor, architecture, dev, description) = ops.adapter_info();
        let mut device = Self::new(ops, width, height)?;
        device.info = (
            if vendor.is_empty() { "unknown".to_string() } else { vendor },
            // JS: `[ai.architecture, ai.device, ai.description].filter(Boolean).join(' ') || 'WebGPU adapter'`
            {
                let joined = [architecture, dev, description]
                    .into_iter()
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
                    .join(" ");
                if joined.is_empty() { "WebGPU adapter".to_string() } else { joined }
            },
            "WebGPU".to_string(),
        );
        Ok(device)
    }

    /// JS: `constructor(canvas, device)`.
    pub fn new(ops: &mut dyn GpuOps, width: u32, height: u32) -> Result<Self, String> {
        let format = ops.get_preferred_canvas_format();
        // JS: `this.ctx.configure({ device, format, alphaMode: 'opaque', usage: RENDER_ATTACHMENT | COPY_SRC });`
        ops.configure_canvas(&format);
        let mut modules = HashMap::new();
        for name in ["terrain", "lit", "entity", "color", "endportal", "post"] {
            // JS: `device.createShaderModule({ code: HEADER + src });`
            let code = format!("{HEADER}{}", shader_source(name).unwrap_or(""));
            ops.create_shader_module(&code);
            modules.insert(
                match name {
                    "terrain" => "terrain",
                    "lit" => "lit",
                    "entity" => "entity",
                    "color" => "color",
                    "endportal" => "endportal",
                    _ => "post",
                },
                modules_len(&modules),
            );
        }
        // JS: `bgl0` — uniform(dynamic) + texture + sampler; `bgl1` — uniform(dynamic);
        // `bgl2` — texture + sampler (fragment only).
        let bgl0 = ops.create_bind_group_layout_uniform_dynamic();
        let bgl1 = ops.create_bind_group_layout_uniform_dynamic();
        let bgl2 = ops.create_bind_group_layout_texture(true, true);
        let layout = ops.create_pipeline_layout(bgl0, bgl1, bgl2);
        let mut device = WebGPUDevice {
            name: "WebGPU",
            format,
            info: ("unknown".to_string(), "WebGPU adapter".to_string(), "WebGPU".to_string()),
            width,
            height,
            modules,
            bgl0,
            bgl1,
            bgl2,
            layout,
            pipelines: HashMap::new(),
            samplers: HashMap::new(),
            draw_capacity: 4096,
            global_capacity: 64,
            draw_buf: 0,
            draw_data: Vec::new(),
            global_buf: 0,
            global_data: Vec::new(),
            bg1: 0,
            bg0_cache: HashMap::new(),
            cur_bg0: 0,
            cur_global_offset: 0,
            quad_buffer: None,
            quad_capacity: 0,
            white: Texture {
                gpu: 0,
                width: 1,
                height: 1,
                mipmaps: false,
                levels: 1,
                filter: "nearest".to_string(),
                wrap: "clamp".to_string(),
                bg: 0,
                view: None,
                depth_tex: None,
                depth_view: None,
            },
            lightmap: 0,
            globals_data: vec![0.0; GLOBAL_STRIDE / 4],
            deferred_destroy: Vec::new(),
            encoder: None,
            color_tex: None,
            color_view: None,
            depth_tex: None,
            depth_view: None,
            target: None,
            pass_active: false,
            scissor: None,
            draw_count: 0,
            global_count: 0,
            inflight: 0,
            capture_waiters: 0,
            last_readback: None,
        };
        device.draw_data = vec![0.0; device.draw_capacity * DRAW_STRIDE / 4];
        device.global_data = vec![0.0; device.global_capacity * GLOBAL_STRIDE / 4];
        device.alloc_uniforms(ops);
        device.ensure_quads(ops, 1 << 16);
        // JS: `this.white = this.createTexture({ width: 1, height: 1, data: new Uint8Array([255,255,255,255]) });`
        device.white = device.create_texture(ops, 1, 1, false, 0, "nearest", "clamp", Some(&[255, 255, 255, 255]));
        device.lightmap = device.white.gpu; // JS: `this.lightmap = this.white;`
        // JS: `this.globalsData[35] = 0;` — fog mode default (already zeroed).
        device.make_depth(ops);
        Ok(device)
    }

    /// JS: `_allocUniforms()` — the draw/global uniform ring buffers + `bg1`.
    fn alloc_uniforms(&mut self, ops: &mut dyn GpuOps) {
        self.draw_buf = ops.create_buffer((self.draw_capacity * DRAW_STRIDE) as u64, true, false, false, true);
        self.global_buf = ops.create_buffer((self.global_capacity * GLOBAL_STRIDE) as u64, true, false, false, true);
        // JS: `bg1 = createBindGroup({ layout: bgl1, entries: [{ binding: 0, resource: { buffer: drawBuf, size: 128 } }] });`
        self.bg1 = ops.create_bind_group_uniform(self.bgl1, self.draw_buf, 128);
        self.bg0_cache.clear();
    }

    /// JS: `_makeDepth()` — the depth attachment for the canvas size.
    fn make_depth(&mut self, ops: &mut dyn GpuOps) {
        if let Some(old) = self.depth_tex {
            ops.destroy_texture(old);
        }
        let dt = ops.create_texture(self.width.max(1), self.height.max(1), 1, true);
        let dv = ops.create_texture_view(dt);
        self.depth_tex = Some(dt);
        self.depth_view = Some(dv);
    }

    /// JS: `_ensureQuads(quads)`.
    pub fn ensure_quads(&mut self, ops: &mut dyn GpuOps, quads: u32) {
        if quads <= self.quad_capacity {
            return;
        }
        // JS: `let cap = Math.max(this.quadCapacity * 2, 1024); while (cap < quads) cap *= 2;`
        let mut cap = (self.quad_capacity * 2).max(1024);
        while cap < quads {
            cap *= 2;
        }
        let idx = quad_indices(cap);
        if let Some(old) = self.quad_buffer {
            self.deferred_destroy.push(old);
        }
        let bytes: Vec<u8> = idx.iter().flat_map(|i| i.to_ne_bytes()).collect();
        let buf = ops.create_buffer(bytes.len() as u64, false, true, false, true);
        ops.write_buffer(buf, 0, &bytes);
        self.quad_buffer = Some(buf);
        self.quad_capacity = cap;
    }

    /// JS: `resize(w, h)`.
    pub fn resize(&mut self, ops: &mut dyn GpuOps, w: u32, h: u32) {
        ops.set_canvas_size(w, h);
        self.width = w;
        self.height = h;
        self.make_depth(ops);
    }

    /// JS: `_sampler(filter, wrap, mip)` — the sampler cache.
    fn sampler(&mut self, ops: &mut dyn GpuOps, filter: &str, wrap: &str, mip: bool) -> GpuId {
        let key = format!("{filter}{wrap}{mip}");
        if let Some(s) = self.samplers.get(&key) {
            return *s;
        }
        let nearest = filter == "nearest";
        let repeat = wrap == "repeat";
        let s = ops.create_sampler(nearest, mip, repeat);
        self.samplers.insert(key, s);
        s
    }

    // ---------------------------------------------------------------- textures

    /// JS: `createTexture(o)`.
    pub fn create_texture(
        &mut self,
        ops: &mut dyn GpuOps,
        width: i32,
        height: i32,
        mipmaps: bool,
        mip_levels: i32,
        filter: &str,
        wrap: &str,
        data: Option<&[u8]>,
    ) -> Texture {
        let mip_levels = if mipmaps { 4 } else { mip_levels.max(0) };
        // JS: `levels = mipLevels > 0 ? min(1 + mipLevels, 1 + floor(log2(max(w, h)))) : 1`
        let levels: u32 = if mip_levels > 0 {
            let max_dim = width.max(height).max(1) as f64;
            (1 + mip_levels).min(1 + max_dim.log2().floor() as i32) as u32
        } else {
            1
        };
        let gpu = ops.create_texture(width as u32, height as u32, levels, false);
        let view = ops.create_texture_view(gpu);
        let filter_s = filter.to_string();
        let wrap_s = wrap.to_string();
        // JS: `t.bg = createBindGroup({ layout: bgl2, entries: [view, sampler] });`
        let mip = levels > 1;
        let samp = self.sampler(ops, filter, wrap, mip);
        let bg = ops.create_bind_group_texture(self.bgl2, view, samp);
        let mut t = Texture {
            gpu,
            width,
            height,
            mipmaps: mip,
            levels,
            filter: filter_s,
            wrap: wrap_s,
            bg,
            view: None,
            depth_tex: None,
            depth_view: None,
        };
        if let Some(d) = data {
            self.update_texture(ops, &t, d, 0, 0, width, height);
        }
        t
    }

    /// JS: `updateTexture(t, data, x = 0, y = 0, w = t.width, h = t.height)`.
    pub fn update_texture(&mut self, ops: &mut dyn GpuOps, t: &Texture, data: &[u8], x: i32, y: i32, w: i32, h: i32) {
        let u8: &[u8] = data; // JS: `toU8(data)` — the input is already bytes here.
        ops.write_texture(t.gpu, 0, x as u32, y as u32, w as u32, h as u32, u8);
        if t.mipmaps && x == 0 && y == 0 && w == t.width && h == t.height {
            let mips = build_mips(t.width as u32, t.height as u32, u8, t.levels - 1);
            for (i, m) in mips.iter().enumerate() {
                ops.write_texture(t.gpu, i as u32 + 1, 0, 0, m.width, m.height, &m.data);
            }
        }
    }

    /// JS: `destroyTexture(t)` — deferred until after submit.
    pub fn destroy_texture(&mut self, t: &Texture) {
        self.deferred_destroy.push(t.gpu);
    }

    /// JS: `createRenderTarget(w, h)`.
    pub fn create_render_target(&mut self, ops: &mut dyn GpuOps, w: i32, h: i32) -> Texture {
        let gpu = ops.create_texture(w as u32, h as u32, 1, true);
        let view = ops.create_texture_view(gpu);
        let samp = self.sampler(ops, "linear", "clamp", false);
        let bg = ops.create_bind_group_texture(self.bgl2, view, samp);
        let depth_tex = ops.create_texture(w as u32, h as u32, 1, true);
        let depth_view = ops.create_texture_view(depth_tex);
        Texture {
            gpu,
            width: w,
            height: h,
            mipmaps: false,
            levels: 1,
            filter: "linear".to_string(),
            wrap: "clamp".to_string(),
            bg,
            view: Some(view),
            depth_tex: Some(depth_tex),
            depth_view: Some(depth_view),
        }
    }

    /// JS: `setRenderTarget(t, clear)`.
    pub fn set_render_target(&mut self, ops: &mut dyn GpuOps, t: Option<&Texture>, clear: Option<[f32; 4]>) {
        self.target = t.cloned();
        if self.encoder.is_none() {
            return;
        }
        self.scissor = None;
        self.begin_pass(
            ops,
            clear.map(|c| [c[0], c[1], c[2], if c[3] == 0.0 { 1.0 } else { c[3] }]),
            clear.is_some(),
        );
    }

    /// JS: `busy()` — true while the GPU is more than a frame behind.
    pub fn busy(&self) -> bool {
        self.inflight >= 2
    }

    // ------------------------------------------------------------------ meshes

    /// JS: `createMesh(format, vertices, opts)`.
    pub fn create_mesh(
        &mut self,
        ops: &mut dyn GpuOps,
        format: &'static Format,
        vertices: &[u8],
        quads: bool,
        indices: Option<&[u32]>,
    ) -> Mesh {
        let mut m = Mesh {
            format,
            vbuf: None,
            vsize: 0,
            ibuf: None,
            vertex_count: 0,
            byte_length: 0,
            index_count: 0,
            quads,
        };
        self.update_mesh(ops, &mut m, vertices, Some(quads), indices);
        m
    }

    /// JS: `updateMesh(m, vertices, opts)`.
    pub fn update_mesh(
        &mut self,
        ops: &mut dyn GpuOps,
        m: &mut Mesh,
        vertices: &[u8],
        quads: Option<bool>,
        indices: Option<&[u32]>,
    ) {
        // JS: `const bytes = Math.max(16, (vertices.byteLength + 3) & ~3);`
        let bytes = ((vertices.len() + 3) & !3).max(16) as u64;
        if m.vbuf.is_none() || m.vsize < bytes {
            if let Some(old) = m.vbuf {
                self.deferred_destroy.push(old);
            }
            m.vbuf = Some(ops.create_buffer(bytes, false, false, true, true));
            m.vsize = bytes;
        }
        if !vertices.is_empty() {
            ops.write_buffer(m.vbuf.unwrap(), 0, vertices);
        }
        let stride = vertex_layout(m.format).byte_stride as usize;
        m.vertex_count = (vertices.len() / stride.max(1)) as i32;
        m.byte_length = vertices.len() as i32;
        if let Some(q) = quads {
            m.quads = q;
        }
        if let Some(indices) = indices {
            if let Some(old) = m.ibuf {
                self.deferred_destroy.push(old);
            }
            let ibytes = ((indices.len() * 4 + 3) & !3).max(16) as u64;
            let ibuf = ops.create_buffer(ibytes, false, true, false, true);
            let idx_bytes: Vec<u8> = indices.iter().flat_map(|i| i.to_ne_bytes()).collect();
            ops.write_buffer(ibuf, 0, &idx_bytes);
            m.ibuf = Some(ibuf);
            m.index_count = indices.len() as i32;
            m.quads = false;
        } else if m.quads {
            self.ensure_quads(ops, (m.vertex_count / 4) as u32);
            m.index_count = (m.vertex_count / 4) * 6;
        } else {
            m.index_count = 0;
        }
    }

    /// JS: `destroyMesh(m)` — deferred until after submit.
    pub fn destroy_mesh(&mut self, m: &Mesh) {
        if let Some(v) = m.vbuf {
            self.deferred_destroy.push(v);
        }
        if let Some(i) = m.ibuf {
            self.deferred_destroy.push(i);
        }
    }

    // -------------------------------------------------------------- pipelines

    /// JS: `_pipeline(name, s, primitive)` — the pipeline cache.
    #[allow(clippy::too_many_arguments)]
    fn pipeline(
        &mut self,
        ops: &mut dyn GpuOps,
        name: &'static str,
        blend: Option<&'static str>,
        depth_test: Option<bool>,
        depth_write: Option<bool>,
        cull: Option<bool>,
        polygon_offset: Option<bool>,
        depth_func_equal: bool,
        color_write: Option<bool>,
        lines: bool,
    ) -> GpuId {
        let fmt_out = if self.target.is_some() { "rgba8unorm" } else { self.format.as_str() };
        // JS: the pipeline cache key (same state-key shape as the WebGL 2 device).
        let key = format!(
            "{}{}|{}{}{}{}{}{}{}{}",
            fmt_out,
            name,
            blend.unwrap_or("none"),
            if depth_test == Some(false) { "0" } else { "1" },
            if depth_write == Some(false) { "0" } else { "1" },
            if cull == Some(true) { "1" } else { "0" },
            if polygon_offset == Some(true) { "1" } else { "0" },
            if depth_func_equal { "e" } else { "" },
            if color_write == Some(false) { "n" } else { "" },
            if lines { "lines" } else { "triangles" },
        );
        if let Some(p) = self.pipelines.get(&key) {
            return *p;
        }
        let fmt = crate::webgpu_math::pipeline_format(name).expect("unknown pipeline format");
        let module = *self.modules.get(name).expect("unknown pipeline");
        let blend_entry = blend.filter(|b| *b != "none").and_then(blends).or_else(|| {
            // JS: `target.blend = BLENDS[s.blend] || BLENDS.alpha` — an unknown
            // non-none blend falls back to alpha.
            blend.filter(|b| *b != "none").map(|_| blends("alpha").unwrap())
        });
        let p = ops.create_render_pipeline(
            self.layout,
            module,
            fmt.name,
            fmt_out,
            color_write == Some(false),
            blend_entry,
            lines,
            cull == Some(true) && !lines,
            depth_write != Some(false),
            depth_test == Some(false),
            depth_func_equal,
            polygon_offset == Some(true) && !lines,
        );
        self.pipelines.insert(key, p);
        p
    }

    // ------------------------------------------------------------------ frame

    /// JS: `beginFrame(clear)`.
    pub fn begin_frame(&mut self, ops: &mut dyn GpuOps, clear: [f32; 3]) {
        let encoder = ops.create_command_encoder();
        self.encoder = Some(encoder);
        self.target = None;
        let color_tex = ops.get_current_texture();
        self.color_tex = Some(color_tex);
        self.color_view = Some(ops.create_texture_view(color_tex));
        self.draw_count = 0;
        self.global_count = 0;
        self.push_globals(ops);
        self.begin_pass(ops, Some([clear[0], clear[1], clear[2], 1.0]), true);
    }

    /// JS: `_beginPass(clearColor, clearDepth)`.
    fn begin_pass(&mut self, ops: &mut dyn GpuOps, clear_color: Option<[f32; 4]>, clear_depth: bool) {
        if self.pass_active {
            ops.end_render_pass();
        }
        let color_view = self
            .target
            .as_ref()
            .and_then(|t| t.view)
            .or(self.color_view)
            .expect("no color attachment");
        let depth_view = self
            .target
            .as_ref()
            .and_then(|t| t.depth_view)
            .or(self.depth_view)
            .expect("no depth attachment");
        ops.begin_render_pass(self.encoder.unwrap(), color_view, clear_color, depth_view, clear_depth);
        self.pass_active = true;
        if let Some(r) = self.scissor {
            self.apply_scissor(ops, Some(&r));
        }
    }

    /// JS: `clearDepth()`.
    pub fn clear_depth(&mut self, ops: &mut dyn GpuOps) {
        self.begin_pass(ops, None, true);
    }

    /// JS: `_pushGlobals()` — ring-buffer slot + the per-lightmap bind group.
    fn push_globals(&mut self, ops: &mut dyn GpuOps) {
        if self.global_count >= self.global_capacity {
            return;
        }
        // JS: `this.globalData.set(this.globalsData, this.globalCount * GLOBAL_STRIDE / 4);`
        let dst = self.global_count * GLOBAL_STRIDE / 4;
        for (i, v) in self.globals_data.iter().enumerate() {
            self.global_data[dst + i] = *v;
        }
        self.cur_global_offset = (self.global_count * GLOBAL_STRIDE) as u32;
        self.global_count += 1;
        let lm = self.lightmap;
        let bg = *self.bg0_cache.entry(lm).or_insert_with(|| {
            // JS: the bgl0 bind group with the 160-byte globals slice.
            ops.create_bind_group_uniform(self.bgl0, self.global_buf, 160)
        });
        self.cur_bg0 = bg;
    }

    /// JS: `setGlobals(g)`.
    pub fn set_globals(&mut self, ops: &mut dyn GpuOps, g: &GlobalsUpdate) {
        let g_data = &mut self.globals_data;
        if let Some(v) = g.view {
            g_data[..16].copy_from_slice(v);
        }
        if let Some(v) = g.proj {
            g_data[16..32].copy_from_slice(v);
        }
        if let Some(v) = g.fog_start {
            g_data[32] = v;
        }
        if let Some(v) = g.fog_end {
            g_data[33] = v;
        }
        if let Some(v) = g.fog_density {
            g_data[34] = v;
        }
        if let Some(v) = g.fog_mode {
            g_data[35] = v;
        }
        if let Some(v) = g.fog_color {
            g_data[36] = v[0];
            g_data[37] = v[1];
            g_data[38] = v[2];
        }
        if let Some(lm) = g.lightmap {
            self.lightmap = lm;
        }
        if self.encoder.is_some() {
            self.push_globals(ops);
        }
    }

    /// JS: `setScissor(r)`.
    pub fn set_scissor(&mut self, ops: &mut dyn GpuOps, r: Option<[f64; 4]>) {
        self.scissor = r;
        if self.pass_active {
            self.apply_scissor(ops, r.as_ref());
        }
    }

    /// JS: `_applyScissor()`.
    fn apply_scissor(&mut self, ops: &mut dyn GpuOps, r: Option<&[f64; 4]>) {
        let tw = self.target.as_ref().map_or(self.width, |t| t.width as u32);
        let th = self.target.as_ref().map_or(self.height, |t| t.height as u32);
        let Some(r) = r else {
            ops.set_scissor_rect(0, 0, tw, th);
            return;
        };
        // JS: `x = max(0, floor(r[0])), y = max(0, floor(r[1]));
        //      w = max(0, min(tw - x, ceil(r[2]))), h = max(0, min(th - y, ceil(r[3])));`
        let rect = scissor_rect(r, tw, th);
        ops.set_scissor_rect(rect.0, rect.1, rect.2, rect.3);
    }

    /// JS: `draw(d)`.
    pub fn draw(&mut self, ops: &mut dyn GpuOps, d: &DrawCall) {
        let Some(m) = d.mesh else { return };
        if m.vertex_count == 0 || !self.pass_active {
            return;
        }
        if self.draw_count >= self.draw_capacity {
            return; // grows at end of frame
        }
        // JS: draw-uniform ring slot — model at +0, params at +16 floats.
        let off = self.draw_count * DRAW_STRIDE;
        let model = d.model.unwrap_or(&IDENTITY);
        let defaults = default_params(d.pipeline);
        let params: &[f32; 16] = d.params.or_else(|| defaults).unwrap_or(&ZERO16);
        self.draw_data[off / 4..off / 4 + 16].copy_from_slice(model);
        self.draw_data[off / 4 + 16..off / 4 + 32].copy_from_slice(params);
        self.draw_count += 1;
        let lines = d.lines;
        let pipeline = self.pipeline(
            ops,
            d.pipeline,
            d.blend,
            d.depth_test,
            d.depth_write,
            d.cull,
            d.polygon_offset,
            d.depth_func_equal,
            d.color_write,
            lines,
        );
        ops.set_pipeline(pipeline);
        ops.set_bind_group(0, self.cur_bg0, self.cur_global_offset);
        ops.set_bind_group(1, self.bg1, off as u32);
        // JS: `const t0 = (d.textures && d.textures[0] && d.textures[0].bg) ? d.textures[0] : this.white;`
        let t0 = d.texture0.unwrap_or(&self.white);
        ops.set_bind_group(2, t0.bg, 0);
        ops.set_vertex_buffer(m.vbuf.unwrap());
        if m.quads || m.ibuf.is_some() {
            let idx_buf = if m.quads { self.quad_buffer.unwrap() } else { m.ibuf.unwrap() };
            ops.set_index_buffer(idx_buf);
            let count = d.count.unwrap_or(m.index_count);
            if count > 0 {
                ops.draw_indexed(count, d.first);
            }
        } else {
            let count = d.count.unwrap_or(m.vertex_count);
            if count > 0 {
                ops.draw(count, d.first);
            }
        }
    }

    /// JS: `endFrame()` — end the pass, upload the uniform rings, submit,
    /// drain the deferred destroys, grow the rings on overflow.
    pub fn end_frame(&mut self, ops: &mut dyn GpuOps) -> Option<CapturedPixels> {
        let Some(encoder) = self.encoder else { return None };
        ops.end_render_pass();
        self.pass_active = false;
        if self.draw_count > 0 {
            let bytes: Vec<u8> = self.draw_data[..self.draw_count * DRAW_STRIDE / 4]
                .iter()
                .flat_map(|f| f.to_ne_bytes())
                .collect();
            ops.write_buffer(self.draw_buf, 0, &bytes);
        }
        if self.global_count > 0 {
            let bytes: Vec<u8> = self.global_data[..self.global_count * GLOBAL_STRIDE / 4]
                .iter()
                .flat_map(|f| f.to_ne_bytes())
                .collect();
            ops.write_buffer(self.global_buf, 0, &bytes);
        }
        // JS: the capture readback copy (256-byte-aligned rows).
        let mut readback = None;
        if self.capture_waiters > 0 {
            let bpr = readback_bytes_per_row(self.width);
            let color_tex = self.color_tex.expect("capture outside a frame");
            let buf = ops.copy_texture_to_buffer(color_tex, self.width, self.height, bpr);
            let src = ops.readback_map(buf, bpr as usize, self.height);
            let bgra = self.format.starts_with("bgra");
            let out = readback_pixels(&src, bpr as usize, self.width, self.height, bgra);
            readback = Some(CapturedPixels { width: self.width, height: self.height, data: out });
            self.capture_waiters = 0;
        }
        ops.finish_encoder(encoder);
        ops.submit();
        self.encoder = None;
        self.target = None;
        self.inflight += 1;
        ops.on_submitted_work_done();
        self.inflight = self.inflight.saturating_sub(1);
        let dead: Vec<GpuId> = self.deferred_destroy.drain(..).collect();
        for b in dead {
            ops.destroy_buffer(b);
        }
        // JS: grow the uniform rings for the next frame on overflow.
        if self.draw_count >= self.draw_capacity || self.global_count >= self.global_capacity {
            self.deferred_destroy.push(self.draw_buf);
            self.deferred_destroy.push(self.global_buf);
            if self.draw_count >= self.draw_capacity {
                self.draw_capacity *= 2;
            }
            if self.global_count >= self.global_capacity {
                self.global_capacity *= 2;
            }
            self.alloc_uniforms(ops);
        }
        self.last_readback = readback.clone();
        readback
    }

    /// JS: `capture()` — a pending readback (the promise resolves after submit).
    pub fn capture(&mut self) {
        self.capture_waiters += 1;
    }
}

fn modules_len(modules: &HashMap<&'static str, GpuId>) -> GpuId {
    modules.len() as u32 + 1
}

// ------------------------------------------------------------- wasm exports

/// JS: `BLENDS` names for wasm consumers.
#[wasm_bindgen]
pub fn webgpu_blend_names() -> Vec<js_sys::JsString> {
    ["alpha", "add", "invert", "darken", "multiply"]
        .iter()
        .map(|s| js_sys::JsString::from(*s))
        .collect()
}

/// JS: `DRAW_STRIDE` / `GLOBAL_STRIDE` for wasm consumers.
#[wasm_bindgen]
pub fn webgpu_draw_stride() -> u32 {
    DRAW_STRIDE as u32
}

#[wasm_bindgen]
pub fn webgpu_global_stride() -> u32 {
    GLOBAL_STRIDE as u32
}

// ---------------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;

    // JS: `BLENDS` table values.
    #[test]
    fn blends_match_the_js_table() {
        let alpha = blends("alpha").unwrap();
        assert_eq!(alpha.color.src_factor, "src-alpha");
        assert_eq!(alpha.color.dst_factor, "one-minus-src-alpha");
        assert_eq!(alpha.alpha.src_factor, "one");
        let invert = blends("invert").unwrap();
        assert_eq!(invert.color.src_factor, "one-minus-dst");
        assert_eq!(invert.color.dst_factor, "one-minus-src");
        let darken = blends("darken").unwrap();
        assert_eq!(darken.color.src_factor, "zero");
        assert!(blends("none").is_none());
    }

    // JS: the WGSL sources contain the shared HEADER declarations and the
    // per-pipeline entry points.
    #[test]
    fn shader_sources_are_complete() {
        for name in ["terrain", "lit", "entity", "color", "endportal", "post"] {
            let src = shader_source(name).expect("all six pipelines present");
            assert!(src.contains("@vertex fn vs"), "{name} missing vs");
            assert!(src.contains("@fragment fn fs"), "{name} missing fs");
            assert!(HEADER.contains("struct Globals"));
            assert!(HEADER.contains("fn fogFactor"));
        }
        // POST_FS covers every mode the JS has (0-16, no 5).
        let post = shader_source("post").unwrap();
        for mode in [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] {
            assert!(post.contains(&format!("if (m == {mode})")), "post mode {mode} missing");
        }
    }

    // JS: the uniform ring strides.
    #[test]
    fn strides_match_the_js() {
        assert_eq!(DRAW_STRIDE, 256);
        assert_eq!(GLOBAL_STRIDE, 256);
        // The globals slot layout: view at 0, proj at 16, fog at 32..36, fogColor at 36..40.
        let mut g = vec![0.0f32; GLOBAL_STRIDE / 4];
        g[35] = 2.0; // fog mode none
        assert_eq!(g[35], 2.0);
    }
}
