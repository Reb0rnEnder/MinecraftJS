//! Port of `client/js/gfx/webgl2.js` â€” the WebGL 2 implementation of the
//! graphics device contract (see `device.js`).
//!
//! The GLSL shader sources (HEADER + the six `SHADERS` entries) are transcribed
//! verbatim. The device's algorithmic helpers (vertex layouts, quad indices,
//! mip generation, default params, draw-state keys, scissor math, the
//! final-pass uniform model, `same16`, vertical flip) live in
//! [`crate::webgl2_alg`] and are reused here.
//!
//! Every `gl.*` call stays behind the [`WebGlOps`] trait with the exact call
//! order and arguments of the JavaScript; a `#[cfg(target_arch = "wasm32")]`
//! host can implement it over `web_sys::WebGl2RenderingContext`, and the tests
//! drive a recording `TraceOps` instead. GL objects are opaque `GlId` handles
//! issued by the ops implementation.

use std::collections::HashMap;

use wasm_bindgen::prelude::*;

use crate::webgl2_alg::{
    animation_pack_used, build_mips, default_params, final_pass_values, flip_rows_vertical,
    grow_quad_capacity, quad_indices, resolve_final_uniform, same16, scissor_rect, state_key,
    to_u8, validate_final_uniform, vertex_layout, BlendMode, DepthFunc, DrawState, FinalFrameInfo,
    FinalUniformKind, VertexLayout, EMPTY_STATE,
};

// JS: `const HEADER = \`#version 300 es ... \`;` â€” prepended to every shader by
// `_program`; the shared fog and lightmap GLSL helpers live here.
pub const HEADER: &str = "#version 300 es
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
  if (uFog.w > 1.5 && uFog.w < 2.5) return 0.0;
  if (uFog.w > 2.5) return 1.0 - clamp(exp(-pow(uFog.z * d, 2.0)), 0.0, 1.0);
  if (uFog.w < 0.5) return clamp((d - uFog.x) / max(0.0001, uFog.y - uFog.x), 0.0, 1.0);
  return 1.0 - clamp(exp(-uFog.z * d), 0.0, 1.0);
}
vec3 lightmap(vec2 l) { return texture(uLightmap, vec2((l.y + 0.5) / 16.0, (l.x + 0.5) / 16.0)).rgb; }
";

// JS: `const SHADERS = { terrain: {...}, ... };` â€” verbatim sources.

pub const TERRAIN_VS: &str = "
layout(location=0) in vec4 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol; layout(location=3) in vec2 aLight;
out vec2 vUv; out vec3 vCol; out vec2 vLight; out float vDepth;
void main() {
  vUv = aUv; vCol = aCol.rgb; vLight = aLight * 15.0;
  vec3 p = aPos.xyz * (65535.0 / 2048.0) - 8.0;
  vec4 mv = uView * uModel * vec4(p, 1.0); vDepth = length(mv.xyz); gl_Position = uProj * mv;
}";
pub const TERRAIN_FS: &str = "
in vec2 vUv; in vec3 vCol; in vec2 vLight; in float vDepth; out vec4 o;
void main() {
  vec4 t = texture(uTex0, vUv, uP[0].z); // uP[0].z: mip bias (far LOD sections sample a smaller mip)
  if (t.a < uP[0].x) discard;
  vec3 c = t.rgb * vCol * lightmap(vLight);
  o = vec4(mix(c, uFogColor, fogFactor(vDepth)), t.a * uP[0].y);
}";
pub const LIT_VS: &str = "
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol; layout(location=3) in vec2 aLight;
out vec2 vUv; out vec4 vCol; out vec2 vLight; out float vDepth;
void main() { vUv = aUv; vCol = aCol; vLight = aLight; vec4 mv = uView * uModel * vec4(aPos, 1.0); vDepth = length(mv.xyz); gl_Position = uProj * mv; }";
pub const LIT_FS: &str = "
in vec2 vUv; in vec4 vCol; in vec2 vLight; in float vDepth; out vec4 o;
void main() {
  vec4 t = texture(uTex0, vUv);
  if (t.a < uP[0].x) discard;
  vec3 lm = vLight.x < 0.0 ? vec3(1.0) : lightmap(vLight);
  vec3 c = t.rgb * vCol.rgb * lm;
  o = vec4(mix(c, uFogColor, fogFactor(vDepth)), t.a * vCol.a);
}";
pub const ENTITY_VS: &str = "
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec3 aNrm; layout(location=3) in vec3 aCol;
out vec2 vUv; out vec3 vCol; out float vShade; out float vDepth;
void main() {
  vUv = aUv * (uP[3].w > 0.0 ? uP[3].w : 1.0) + uP[3].yz; vCol = aCol;
  vec3 n = normalize(mat3(uModel) * aNrm);
  // lighting mode uP[2].w: 0 world item lighting, 1 none, 2 GUI item lighting (RenderHelper.enableGUIStandardItemLighting:
  // the same two lights turned -30 degrees about Y and 165 about X, in the y-down GUI space)
  bool gui = uP[2].w > 1.5;
  vec3 l0 = gui ? vec3(-0.237910, -0.634435, 0.735453) : normalize(vec3(0.2, 1.0, -0.7));
  vec3 l1 = gui ? vec3(0.028667, -0.927375, -0.373034) : normalize(vec3(-0.2, 1.0, 0.7));
  float d = 0.4 + 0.6 * (max(dot(n, l0), 0.0) + max(dot(n, l1), 0.0));
  vShade = (uP[2].w > 0.5 && !gui) ? 1.0 : min(1.0, d);
  vec4 mv = uView * uModel * vec4(aPos, 1.0); vDepth = length(mv.xyz); gl_Position = uProj * mv;
}";
pub const ENTITY_FS: &str = "
in vec2 vUv; in vec3 vCol; in float vShade; in float vDepth; out vec4 o;
void main() {
  vec4 t = texture(uTex0, vUv);
  if (t.a < uP[3].x) discard;
  vec3 lm = uP[2].z > 0.5 ? vec3(1.0) : lightmap(uP[2].xy);
  vec3 c = t.rgb * uP[0].rgb * vCol;
  c = mix(c, uP[1].rgb, uP[1].a);
  c *= vShade * lm;
  o = vec4(mix(c, uFogColor, fogFactor(vDepth)), t.a * uP[0].a);
}";
pub const COLOR_VS: &str = "
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol;
out vec2 vUv; out vec4 vCol; out float vDepth;
void main() { vUv = aUv; vCol = aCol; vec4 mv = uView * uModel * vec4(aPos, 1.0); vDepth = length(mv.xyz); gl_Position = uProj * mv; }";
pub const COLOR_FS: &str = "
in vec2 vUv; in vec4 vCol; in float vDepth; out vec4 o;
void main() {
  vec4 t = texture(uTex0, vUv) * vCol * uP[0];
  if (t.a < uP[1].x) discard;
  vec3 c = uP[1].y > 0.5 ? mix(t.rgb, uFogColor, fogFactor(vDepth)) : t.rgb;
  o = vec4(c, t.a);
}";
// JS: the TileEntityEndPortalRenderer layer â€” texgen EYE_LINEAR times projection
// * modelview = the fragment's NDC, then the layer's scale, rotation and drift.
pub const ENDPORTAL_VS: &str = "
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol;
out float vDepth;
void main() { vec4 mv = uView * uModel * vec4(aPos, 1.0); vDepth = length(mv.xyz); gl_Position = uProj * mv; }";
pub const ENDPORTAL_FS: &str = "
in float vDepth; out vec4 o;
void main() {
  vec2 ndc = gl_FragCoord.xy / uP[2].xy * 2.0 - 1.0;
  vec2 s = ndc * uP[1].x;
  float c = cos(uP[1].y), sn = sin(uP[1].y);
  vec2 r = vec2(s.x * c - s.y * sn, s.x * sn + s.y * c) + uP[1].zw;
  vec4 t = texture(uTex0, fract(0.5 + 0.5 * r));
  vec3 col = t.rgb * uP[0].rgb;
  float f = fogFactor(vDepth);
  // the sky pass blends with the scene; the portal passes add up, fogging towards black (setupFogColor(true))
  o = uP[0].w < 0.5 ? vec4(mix(col, uFogColor, f), t.a) : vec4(col * (1.0 - f), 1.0);
}";
// JS: vanilla post-processing programs; texCoord is vanilla's (origin bottom
// left) and render targets are stored bottom-up, so it addresses texels directly.
pub const POST_VS: &str = "
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol;
out vec2 vTc;
void main() { vTc = vec2(aUv.x, 1.0 - aUv.y); gl_Position = vec4(aPos.xy, 0.0, 1.0); }";
pub const POST_FS: &str = "
in vec2 vTc; out vec4 o;
vec4 fetch(sampler2D s, vec2 c) { ivec2 n = textureSize(s, 0); return texelFetch(s, clamp(ivec2(floor(c * vec2(n))), ivec2(0), n - 1), 0); }
void main() {
  int m = int(uP[0].x + 0.5);
  vec2 tc = vTc;
  vec2 inSize = vec2(textureSize(uTex0, 0));
  if (m == 0) { o = fetch(uTex0, tc) * uP[1]; }
  else if (m == 1) { vec4 d = fetch(uTex0, tc); o = vec4(mix(d, 1.0 - d, uP[0].y).rgb, 1.0); }
  else if (m == 2) {
    vec3 t = fetch(uTex0, tc).rgb;
    vec3 c = vec3(dot(t, uP[1].xyz), dot(t, uP[2].xyz), dot(t, uP[3].xyz));
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    o = vec4((c - l) * uP[0].y + l, 1.0);
  } else if (m == 3) {
    vec2 mis = inSize / uP[0].w;
    vec4 b = fetch(uTex0, tc - fract(tc * mis) / mis);
    vec3 f = b.rgb - fract(b.rgb * uP[0].y) / uP[0].y;
    float l = dot(f, vec3(0.3, 0.59, 0.11));
    o = vec4(l + (f - l) * uP[0].z, 1.0);
  } else if (m == 4) {
    vec2 one = 1.0 / inSize;
    float R = uP[1].z;
    vec4 acc = vec4(0.0); float ta = 0.0;
    for (float r = -R; r <= R; r += 1.0) { vec4 s = fetch(uTex0, tc + one * r * uP[1].xy); ta += s.a; acc += s; }
    o = vec4(acc.rgb / (R * 2.0 + 1.0), ta);
  } else if (m == 6) {
    vec2 one = 1.0 / inSize;
    vec4 c = fetch(uTex0, tc);
    vec4 t = (c - fetch(uTex0, tc - vec2(one.x, 0.0))) + (c - fetch(uTex0, tc + vec2(one.x, 0.0))) + (c - fetch(uTex0, tc - vec2(0.0, one.y))) + (c - fetch(uTex0, tc + vec2(0.0, one.y)));
    o = vec4(clamp(t, 0.0, 1.0).rgb, 1.0);
  } else if (m == 7) {
    vec2 one = 1.0 / inSize;
    vec3 rx = uP[3].xyz, ry = uP[0].yzw;
    vec3 cx = tc.x * rx + uP[1].xyz * one.x - (rx - 1.0) * 0.5;
    vec3 cy = tc.y * ry + uP[2].xyz * one.y - (ry - 1.0) * 0.5;
    o = vec4(fetch(uTex0, vec2(cx.x, cy.x)).r, fetch(uTex0, vec2(cx.y, cy.y)).g, fetch(uTex0, vec2(cx.z, cy.z)).b, 1.0);
  } else if (m == 8) {
    o = vec4(max(fetch(uLightmap, tc).rgb * uP[1].xyz, fetch(uTex0, tc).rgb), 1.0);
  } else if (m == 9) {
    vec2 one = 1.0 / inSize;
    vec4 c = fetch(uTex0, tc);
    vec4 nc = normalize(c);
    float du = dot(nc, normalize(fetch(uTex0, tc + vec2(0.0, -one.y)))), dd = dot(nc, normalize(fetch(uTex0, tc + vec2(0.0, one.y))));
    float dl = dot(nc, normalize(fetch(uTex0, tc + vec2(-one.x, 0.0)))), dr = dot(nc, normalize(fetch(uTex0, tc + vec2(one.x, 0.0))));
    float f = 1.0 + (du * 64.0 - dd * 64.0) + (dr * 64.0 - dl * 64.0);
    o = vec4((c * clamp(f, 0.5, 2.0)).rgb, 1.0);
  } else if (m == 10) {
    vec2 one = 1.0 / inSize;
    vec4 v = fetch(uTex0, tc);
    for (int i = 0; i < 12; i++) {
      vec2 k = i == 0 ? vec2(0, -1) : i == 1 ? vec2(0, 1) : i == 2 ? vec2(-1, 0) : i == 3 ? vec2(1, 0) : i == 4 ? vec2(-1, -1) : i == 5 ? vec2(1, 1)
        : i == 6 ? vec2(-1, 1) : i == 7 ? vec2(1, -1) : i == 8 ? vec2(0, -2) : i == 9 ? vec2(0, 2) : i == 10 ? vec2(-2, 0) : vec2(2, 0);
      v = min(v, fetch(uTex0, tc + k * one));
    }
    o = vec4(v.rgb, 1.0);
  } else if (m == 11) {
    vec2 one = 1.0 / inSize;
    float R = uP[0].y;
    vec4 mx = fetch(uTex0, tc);
    for (float u = 0.0; u <= R; u += 1.0) for (float v = 0.0; v <= R; v += 1.0) {
      float w = sqrt(u * u + v * v) / R > 1.0 ? 0.0 : 1.0;
      vec4 t = max(max(fetch(uTex0, tc + vec2(-u, -v) * one), fetch(uTex0, tc + vec2(u, v) * one)), max(fetch(uTex0, tc + vec2(-u, v) * one), fetch(uTex0, tc + vec2(u, -v) * one)));
      mx = mix(mx, max(mx, t), w);
    }
    o = vec4(mx.rgb, 1.0);
  } else if (m == 12) {
    vec2 one = 1.0 / inSize;
    vec4 c = fetch(uTex0, tc);
    vec4 v1 = mix(c, mix(fetch(uTex0, tc - vec2(one.x, 0.0)), fetch(uTex0, tc - vec2(one.x * 2.0, 0.0)), 0.667), 0.75);
    vec4 v2 = mix(c, mix(fetch(uTex0, tc + vec2(one.x, 0.0)), fetch(uTex0, tc + vec2(one.x * 2.0, 0.0)), 0.667), 0.75);
    vec4 v3 = mix(c, mix(fetch(uTex0, tc - vec2(0.0, one.y)), fetch(uTex0, tc - vec2(0.0, one.y * 2.0)), 0.667), 0.75);
    vec4 v4 = mix(c, mix(fetch(uTex0, tc + vec2(0.0, one.y)), fetch(uTex0, tc + vec2(0.0, one.y * 2.0)), 0.667), 0.75);
    o = vec4(mix(mix(v1, v2, 0.5), mix(v3, v4, 0.5), 0.5).rgb, 1.0);
  } else if (m == 13) {
    vec4 inT = fetch(uTex0, tc);
    vec2 pu = tc * 2.0 - 1.0;
    float r2 = pow(length(pu), 2.0);
    vec2 sc = tc * (1.0 - 0.02 * 0.2) + 0.02 * 0.1 + pu * 0.02 * r2;
    if (sc.x < 0.0 || sc.y < 0.0 || sc.x > 1.0 || sc.y > 1.0) discard;
    float bm = sin(sc.y * inSize.y * 0.25 * 3.1415926535);
    float br = mix(1.0, (bm * bm + 1.0) * 0.5, 0.8);
    vec3 t = vec3(0.05) + vec3(0.95) * (inT.rgb * br);
    o = vec4(pow(t, vec3(0.8)), 1.0);
  } else if (m == 14) {
    float T = uP[0].y;
    vec2 off = vec2(sin(tc.y * uP[1].x + T * 6.283185307) * uP[1].z, cos(tc.x * uP[1].y + T * 6.283185307) * uP[1].w);
    vec3 rgb = fetch(uTex0, tc + off).rgb;
    vec3 hsv = vec3(0.0, 0.0, max(rgb.r, max(rgb.g, rgb.b)));
    float c = hsv.z - min(rgb.r, min(rgb.g, rgb.b));
    if (c != 0.0) {
      hsv.y = c / hsv.z;
      vec3 d = (hsv.z - rgb) / c;
      d -= d.brg;
      d.rg += vec2(2.0, 4.0);
      hsv.x = fract((rgb.r >= hsv.z ? d.b : rgb.g >= hsv.z ? d.r : d.g) / 6.0);
    }
    hsv.x = fract(hsv.x + T);
    vec3 h = clamp(vec3(abs(hsv.x * 6.0 - 3.0) - 1.0, 2.0 - abs(hsv.x * 6.0 - 2.0), 2.0 - abs(hsv.x * 6.0 - 4.0)), 0.0, 1.0);
    o = vec4(((h - 1.0) * hsv.y + 1.0) * hsv.z, 1.0);
  } else if (m == 15) {
    vec2 one = 1.0 / inSize;
    vec4 c = fetch(uTex0, tc);
    vec4 sum = vec4(0.0);
    for (int i = 1; i <= 2; i++) {
      float k = float(i);
      sum += abs(c - fetch(uTex0, tc + vec2(0.0, -one.y) * k)) + abs(c - fetch(uTex0, tc + vec2(one.x, 0.0) * k))
        + abs(c - fetch(uTex0, tc + vec2(-one.x, 0.0) * k)) + abs(c - fetch(uTex0, tc + vec2(0.0, one.y) * k));
    }
    vec4 gray = vec4(0.3, 0.59, 0.11, 0.0);
    float sl = 1.0 - dot(clamp(sum, 0.0, 1.0), gray);
    float L = dot(c + (c - pow(c, vec4(uP[0].y))), gray);
    L = L - fract(L * uP[0].z) / uP[0].z;
    L = L * (uP[0].z / (uP[0].z - 1.0)) * sl;
    o = vec4(L, L, L, 1.0);
  } else if (m == 16) {
    o = fetch(uTex0, vec2(tc.x, 1.0 - tc.y)) * uP[1];
  } else {
    float a = uP[0].y * 0.0174532925; float cs = cos(a), sn = sin(a);
    vec2 sc = vec2(tc.x * cs - tc.y * sn, tc.y * cs + tc.x * sn) * uP[1].xy + uP[1].zw;
    vec4 S = uP[2], V = uP[3];
    vec4 B = fetch(uLightmap, tc), O = fetch(uTex0, sc);
    if (sc.x < S.x || sc.y < S.y || sc.x > S.z || sc.y > S.w) O = B;
    if (sc.x < V.x) O = mix(B, O, (S.x - sc.x) / (S.x - V.x));
    if (sc.y < V.y) O = mix(B, O, (S.y - sc.y) / (S.y - V.y));
    if (sc.x > V.z) O = mix(B, O, (S.z - sc.x) / (S.z - V.z));
    if (sc.y > V.w) O = mix(B, O, (S.w - sc.y) / (S.w - V.w));
    o = vec4(O.rgb, 1.0);
  }
}";

/// JS: the shader-pipeline names (`SHADERS` keys).
pub const PIPELINES: [&str; 6] = ["terrain", "lit", "entity", "color", "endportal", "post"];

// ------------------------------------------------------------------ GL surface

/// JS: an opaque GL object handle (`WebGLTexture`/`WebGLBuffer`/...).
pub type GlId = u32;

/// JS: the `gl` capability flags used by `_applyState` and the frame setup.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cap {
    Blend,
    DepthTest,
    ScissorTest,
    CullFace,
    PolygonOffsetFill,
}

/// JS: the blend-factor enums of `_applyState`'s five blend modes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BlendFactor {
    Zero,
    One,
    SrcColor,
    OneMinusSrcColor,
    DstColor,
    OneMinusDstColor,
    SrcAlpha,
    OneMinusSrcAlpha,
    DstAlpha,
    OneMinusDstAlpha,
}

/// JS: the clear bits (`COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ClearBits(pub bool, pub bool);

/// JS: the `gl` calls webgl2.js makes, in the trait the host implements.
///
/// Every method documents the JS call site(s); the argument order matches
/// `gl.*` exactly. Object creation returns fresh [`GlId`]s.
pub trait WebGlOps {
    // -- object lifecycle
    fn create_shader(&mut self, vertex: bool) -> GlId;
    fn shader_source(&mut self, shader: GlId, source: &str);
    fn compile_shader(&mut self, shader: GlId);
    fn get_shader_parameter(&mut self, shader: GlId) -> bool; // JS: COMPILE_STATUS
    fn get_shader_info_log(&mut self, shader: GlId) -> String;
    fn delete_shader(&mut self, shader: GlId);
    fn create_program(&mut self) -> GlId;
    fn attach_shader(&mut self, program: GlId, shader: GlId);
    fn link_program(&mut self, program: GlId);
    fn get_program_parameter(&mut self, program: GlId) -> bool; // JS: LINK_STATUS / ACTIVE_UNIFORMS count
    fn get_program_info_log(&mut self, program: GlId) -> String;
    fn delete_program(&mut self, program: GlId);
    fn get_uniform_location(&mut self, program: GlId, name: &str) -> Option<GlId>;
    fn get_active_uniform(&mut self, program: GlId, index: u32) -> Option<(String, i32, FinalUniformKind)>;
    fn create_texture(&mut self) -> GlId;
    fn delete_texture(&mut self, texture: GlId);
    fn create_buffer(&mut self) -> GlId;
    fn delete_buffer(&mut self, buffer: GlId);
    fn create_vertex_array(&mut self) -> GlId;
    fn delete_vertex_array(&mut self, vao: GlId);
    fn create_framebuffer(&mut self) -> GlId;
    fn delete_framebuffer(&mut self, fbo: GlId);
    fn create_renderbuffer(&mut self) -> GlId;
    fn delete_renderbuffer(&mut self, rb: GlId);
    // -- programs / uniforms
    fn use_program(&mut self, program: GlId);
    fn uniform_matrix4fv(&mut self, location: Option<GlId>, transpose: bool, value: &[f32; 16]);
    fn uniform4fv(&mut self, location: Option<GlId>, value: &[f32]);
    fn uniform3fv(&mut self, location: Option<GlId>, value: &[f32; 3]);
    fn uniform1i(&mut self, location: Option<GlId>, value: i32);
    fn uniform1f(&mut self, location: Option<GlId>, value: f32);
    fn uniform4f(&mut self, location: Option<GlId>, x: f32, y: f32, z: f32, w: f32);
    fn uniform3f(&mut self, location: Option<GlId>, x: f32, y: f32, z: f32);
    // -- state
    fn enable(&mut self, cap: Cap);
    fn disable(&mut self, cap: Cap);
    fn viewport(&mut self, x: i32, y: i32, w: i32, h: i32);
    fn scissor(&mut self, x: i32, y: i32, w: i32, h: i32);
    fn clear_color(&mut self, r: f32, g: f32, b: f32, a: f32);
    fn clear(&mut self, bits: ClearBits);
    fn depth_mask(&mut self, on: bool);
    fn depth_func(&mut self, func: DepthFunc);
    fn color_mask(&mut self, r: bool, g: bool, b: bool, a: bool);
    fn front_face(&mut self);
    fn cull_face(&mut self);
    fn blend_func(&mut self, src: BlendFactor, dst: BlendFactor);
    fn blend_func_separate(&mut self, src_rgb: BlendFactor, dst_rgb: BlendFactor, src_a: BlendFactor, dst_a: BlendFactor);
    fn polygon_offset(&mut self, factor: f32, units: f32);
    fn pixel_storei(&mut self, unpack_alignment: i32);
    // -- textures
    fn active_texture(&mut self, unit: u32);
    fn bind_texture(&mut self, texture: Option<GlId>);
    fn tex_image_2d(&mut self, level: i32, width: i32, height: i32, data: Option<&[u8]>);
    fn tex_sub_image_2d(&mut self, level: i32, x: i32, y: i32, width: i32, height: i32, data: &[u8]);
    fn tex_parameter_i(&mut self, name: TexParameter, value: i32);
    // -- buffers / vao / fbo
    fn bind_buffer(&mut self, target: BufferTarget, buffer: Option<GlId>);
    fn buffer_data(&mut self, target: BufferTarget, data: &[u8], dynamic: bool);
    fn bind_vertex_array(&mut self, vao: Option<GlId>);
    fn enable_vertex_attrib_array(&mut self, index: u32);
    fn vertex_attrib_pointer(&mut self, index: u32, size: i32, ty: AttributeTypeGl, normalized: bool, stride: i32, offset: i32);
    fn bind_renderbuffer(&mut self, rb: Option<GlId>);
    fn renderbuffer_storage(&mut self, width: i32, height: i32); // JS: DEPTH_COMPONENT24
    fn bind_framebuffer(&mut self, fbo: Option<GlId>);
    fn framebuffer_texture_2d(&mut self, texture: GlId);
    fn framebuffer_renderbuffer(&mut self, rb: GlId);
    // -- draw
    fn draw_arrays(&mut self, lines: bool, first: i32, count: i32);
    fn draw_elements(&mut self, lines: bool, count: i32, first: i32);
    // -- frame sync / readback
    fn fence_sync(&mut self) -> GlId;
    fn client_wait_sync(&mut self, sync: GlId) -> SyncStatus;
    fn delete_sync(&mut self, sync: GlId);
    fn flush(&mut self);
    fn read_pixels(&mut self, w: i32, h: i32) -> Vec<u8>;
    // -- context info
    fn get_parameter_string(&mut self, which: InfoParam) -> String;
    fn has_debug_renderer_info(&mut self) -> bool;
    fn active_uniform_count(&mut self, program: GlId) -> u32;
}

/// JS: the texture parameters set in `createTexture`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TexParameter {
    MagFilterNearest,
    MagFilterLinear,
    MinFilterNearest,
    MinFilterLinear,
    MinFilterNearestMipmapLinear,
    MinFilterLinearMipmapLinear,
    WrapSRepeat,
    WrapSClamp,
    WrapTRepeat,
    WrapTClamp,
    MaxLevel(i32),
}

/// JS: the buffer targets (`ARRAY_BUFFER` / `ELEMENT_ARRAY_BUFFER`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BufferTarget {
    Array,
    Element,
}

/// JS: the vertex attribute pointer types.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AttributeTypeGl {
    Float,
    UnsignedShort,
    UnsignedByte,
}

/// JS: `gl.clientWaitSync` results used by `busy()`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SyncStatus {
    AlreadySignaled,
    ConditionSatisfied,
    TimeoutExpired,
}

/// JS: the `gl.getParameter` strings read in the constructor.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum InfoParam {
    Vendor,
    UnmaskedVendor,
    Renderer,
    UnmaskedRenderer,
    Version,
}

// ---------------------------------------------------------------- device types

/// JS: the `createTexture` result object.
#[derive(Clone, Debug)]
pub struct Texture {
    pub tex: GlId,
    pub width: i32,
    pub height: i32,
    pub mipmaps: bool,
    pub mip_levels: i32,
    pub filter: String,
    pub wrap: String,
    // JS: `t.fbo` / `t.depth` â€” only set by `createRenderTarget`.
    pub fbo: Option<GlId>,
    pub depth: Option<GlId>,
}

/// JS: the `createMesh` result object.
#[derive(Clone, Debug)]
pub struct Mesh {
    pub format: &'static crate::webgl2_alg::MeshFormat,
    pub vao: GlId,
    pub vbo: GlId,
    pub ibo: Option<GlId>,
    pub vertex_count: i32,
    pub index_count: i32,
    pub byte_stride: i32,
    pub byte_length: i32,
    pub quads: bool,
    pub dynamic: bool,
    pub quad_gen: i64,
}

/// JS: the `{ p, uView, ..., lastModel, lastParams }` program record of `_program`.
#[derive(Clone, Debug)]
pub struct Program {
    pub p: GlId,
    pub u_view: Option<GlId>,
    pub u_proj: Option<GlId>,
    pub u_model: Option<GlId>,
    pub u_p: Option<GlId>,
    pub u_fog: Option<GlId>,
    pub u_fog_color: Option<GlId>,
    pub u_tex0: Option<GlId>,
    pub u_lightmap: Option<GlId>,
    pub globals_version: i64,
    pub last_model: [f32; 16],
    pub last_params: [f32; 16],
}

/// JS: `this.globals`.
#[derive(Clone, Debug)]
pub struct Globals {
    pub view: [f32; 16],
    pub proj: [f32; 16],
    /// JS: `new Float32Array([0, 1, 0, 2])` â€” start, end, density, mode.
    pub fog: [f32; 4],
    pub fog_color: [f32; 3],
    pub lightmap: Option<GlId>,
}

/// JS: the `createTerrainAnimation` result (`{program, programs, ids, frame, ...}`).
#[derive(Clone, Debug)]
pub struct TerrainAnimation {
    pub program: Program,
    /// JS: `programs` â€” terrain + optionally entity/lit lighting variants.
    pub programs: HashMap<String, Program>,
    pub ids: Texture,
    /// JS: `frame` â€” set by `setTerrainAnimation`.
    pub frame: Option<TerrainAnimationFrame>,
    pub u_ids: Option<GlId>,
    pub u_frame: Option<GlId>,
    pub u_camera: Option<GlId>,
    pub u_eye: Option<GlId>,
    /// JS: `uLighting` â€” the five `uPack*` locations (Ambient, Direct, Block,
    /// Minimum, Dimension) on every pack program.
    pub u_lighting: Vec<GlId>,
}

/// JS: `animation.frame` â€” `{time, worldTime, camera, eye, lighting}`.
#[derive(Clone, Debug, Default)]
pub struct TerrainAnimationFrame {
    pub time: f32,
    pub world_time: f32,
    pub camera: [f32; 3],
    pub eye: [f32; 3],
    /// JS: `f.lighting` â€” `{ambient, direct, block, minimum, dimension}`.
    pub lighting: Option<([f32; 3], [f32; 3], [f32; 3], [f32; 3], f32)>,
}

/// JS: the `createFinalShaderPass` result (`{destroy, draw}`).
#[derive(Clone, Debug)]
pub struct FinalShaderPass {
    pub program: GlId,
    pub vao: GlId,
    /// JS: `noise` â€” the pack noise texture when a `noisetex` uniform exists.
    pub noise: Option<Texture>,
    /// JS: `uniforms` â€” the validated active-uniform list.
    pub uniforms: Vec<(String, FinalUniformKind, Option<GlId>)>,
}

/// JS: `_readPixels`'s result.
#[derive(Clone, Debug)]
pub struct CapturedPixels {
    pub width: i32,
    pub height: i32,
    pub data: Vec<u8>,
}

/// JS: the device info read in the constructor.
#[derive(Clone, Debug)]
pub struct DeviceInfo {
    pub vendor: String,
    pub renderer: String,
    pub version: String,
}

/// JS: the `draw(d)` draw-call descriptor.
#[derive(Clone, Debug)]
pub struct DrawCall<'a> {
    /// JS: `d.mesh`.
    pub mesh: Option<&'a Mesh>,
    /// JS: `d.pipeline`.
    pub pipeline: &'static str,
    /// JS: `d.model || IDENTITY`.
    pub model: Option<&'a [f32; 16]>,
    /// JS: `d.params || DEFAULT_PARAMS[d.pipeline] || ZERO16`.
    pub params: Option<&'a [f32; 16]>,
    /// JS: `d.textures` â€” texture 0.
    pub texture0: Option<&'a Texture>,
    /// JS: `d.state || EMPTY_STATE`.
    pub state: Option<&'a DrawState>,
    /// JS: `d.primitive === 'lines'`.
    pub lines: bool,
    /// JS: `d.first || 0`.
    pub first: i32,
    /// JS: `d.count !== undefined ? d.count : ...`.
    pub count: Option<i32>,
}

/// JS: `const IDENTITY = new Float32Array([...]);`
pub const IDENTITY: [f32; 16] = [
    1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
];
/// JS: `const ZERO16 = new Float32Array(16);`
pub const ZERO16: [f32; 16] = [0.0; 16];

// ----------------------------------------------------------------- the device

/// Port of the JS `WebGL2Device` class. All `gl` calls go through [`WebGlOps`].
pub struct WebGL2Device {
    /// JS: `this.name = 'WebGL 2'`.
    pub name: &'static str,
    /// JS: `this.rtOriginBottom = true` â€” render targets are sampled bottom-up.
    pub rt_origin_bottom: bool,
    /// JS: `this.info` â€” GL_VENDOR / GL_RENDERER / GL_VERSION for the debug screen.
    pub info: DeviceInfo,
    /// JS: `this.width` / `this.height`.
    pub width: i32,
    pub height: i32,
    /// JS: `this.curState` / `this.curStateObj` â€” the draw state cache.
    cur_state: String,
    cur_state_obj: Option<DrawState>,
    /// JS: `this.curProgram` / `this.curVao` / `this.boundTex`.
    cur_program: Option<GlId>,
    cur_vao: Option<GlId>,
    bound_tex: [Option<GlId>; 2],
    /// JS: `this.programs` â€” one [`Program`] per `SHADERS` entry.
    pub programs: HashMap<&'static str, Program>,
    /// JS: `this.quadBuffer` / `this.quadCapacity` / `this.quadGen`.
    quad_buffer: GlId,
    quad_capacity: usize,
    quad_gen: i64,
    /// JS: `this.white` â€” the 1Ã—1 white fallback texture.
    pub white: Texture,
    /// JS: `this.globals`.
    pub globals: Globals,
    /// JS: `this.globalsVersion`.
    globals_version: i64,
    /// JS: `this.target` â€” the active render target (`None` = the screen).
    pub target: Option<Texture>,
    /// JS: `this.terrainAnimation`.
    pub terrain_animation: Option<TerrainAnimation>,
    /// JS: `this.fences` â€” the `busy()` pacing queue.
    fences: Vec<GlId>,
    /// JS: `this.captureWaiters` â€” pending `capture()` promises.
    capture_waiters: usize,
    /// Rust bookkeeping for the JS `m.quadGen = this.quadGen` in-place mutation
    /// (`take_quad_gen_update` lets the mesh owner apply it).
    last_bound_quad_gen: Option<(i64, i64)>,
}

impl WebGL2Device {
    /// JS: `constructor(canvas, opts = {})`.
    pub fn new(ops: &mut dyn WebGlOps, width: i32, height: i32, preserve_drawing_buffer: bool) -> Result<Self, String> {
        // JS: `canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: 'high-performance' });`
        // The host performs the getContext itself; if it failed it passes no ops.
        let _ = preserve_drawing_buffer;
        let mut device = WebGL2Device {
            name: "WebGL 2",
            rt_origin_bottom: true, // render targets are sampled bottom-up
            info: DeviceInfo {
                // JS: `dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)`
                vendor: if ops.has_debug_renderer_info() {
                    ops.get_parameter_string(InfoParam::UnmaskedVendor)
                } else {
                    ops.get_parameter_string(InfoParam::Vendor)
                },
                renderer: if ops.has_debug_renderer_info() {
                    ops.get_parameter_string(InfoParam::UnmaskedRenderer)
                } else {
                    ops.get_parameter_string(InfoParam::Renderer)
                },
                version: ops.get_parameter_string(InfoParam::Version),
            },
            width,
            height,
            cur_state: String::new(),
            cur_state_obj: None,
            cur_program: None,
            cur_vao: None,
            bound_tex: [None, None],
            programs: HashMap::new(),
            quad_buffer: ops.create_buffer(),
            quad_capacity: 0,
            quad_gen: 0,
            white: Texture {
                tex: 0,
                width: 1,
                height: 1,
                mipmaps: false,
                mip_levels: 0,
                filter: "nearest".to_string(),
                wrap: "clamp".to_string(),
                fbo: None,
                depth: None,
            },
            globals: Globals {
                view: [0.0; 16],
                proj: [0.0; 16],
                fog: [0.0, 1.0, 0.0, 2.0],
                fog_color: [0.0; 3],
                lightmap: None,
            },
            globals_version: 0,
            target: None,
            terrain_animation: None,
            fences: Vec::new(),
            capture_waiters: 0,
            last_bound_quad_gen: None,
        };
        // JS: `for (const [name, src] of Object.entries(SHADERS)) this.programs[name] = this._program(name, src);`
        device.programs.insert("terrain", WebGL2Device::program(ops, "terrain", TERRAIN_VS, TERRAIN_FS)?);
        device.programs.insert("lit", WebGL2Device::program(ops, "lit", LIT_VS, LIT_FS)?);
        device.programs.insert("entity", WebGL2Device::program(ops, "entity", ENTITY_VS, ENTITY_FS)?);
        device.programs.insert("color", WebGL2Device::program(ops, "color", COLOR_VS, COLOR_FS)?);
        device.programs.insert("endportal", WebGL2Device::program(ops, "endportal", ENDPORTAL_VS, ENDPORTAL_FS)?);
        device.programs.insert("post", WebGL2Device::program(ops, "post", POST_VS, POST_FS)?);
        // JS: `this._ensureQuads(1 << 16);`
        device.ensure_quads(ops, 1 << 16);
        // JS: `this.white = this.createTexture({ width: 1, height: 1, data: new Uint8Array([255,255,255,255]) });`
        device.white = device.create_texture(
            ops,
            1,
            1,
            false,
            0,
            "nearest",
            "clamp",
            Some(&[255, 255, 255, 255]),
        );
        // JS: `globals = { ..., lightmap: this.white };`
        device.globals.lightmap = Some(device.white.tex);
        // JS: `gl.frontFace(gl.CCW); gl.cullFace(gl.BACK); gl.depthFunc(gl.LEQUAL);`
        ops.front_face();
        ops.cull_face();
        ops.depth_func(DepthFunc::Lequal);
        Ok(device)
    }

    /// JS: `_program(name, src)` â€” compile+link with [`HEADER`], cache the
    /// uniform locations and the NaN `last*` uniform caches.
    fn program(
        ops: &mut dyn WebGlOps,
        name: &str,
        vs: &str,
        fs: &str,
    ) -> Result<Program, String> {
        let compile = |ops: &mut dyn WebGlOps, text: &str| -> Result<GlId, String> {
            let s = ops.create_shader(true);
            ops.shader_source(s, &format!("{HEADER}{text}"));
            ops.compile_shader(s);
            if !ops.get_shader_parameter(s) {
                return Err(format!("Shader {name}: {}", ops.get_shader_info_log(s)));
            }
            Ok(s)
        };
        let vs = compile(ops, vs)?;
        let fs = compile(ops, fs)?;
        let p = ops.create_program();
        ops.attach_shader(p, vs);
        ops.attach_shader(p, fs);
        ops.link_program(p);
        ops.delete_shader(vs);
        ops.delete_shader(fs);
        if !ops.get_program_parameter(p) {
            return Err(format!("Program {name}: {}", ops.get_program_info_log(p)));
        }
        Ok(Program {
            p,
            u_view: ops.get_uniform_location(p, "uView"),
            u_proj: ops.get_uniform_location(p, "uProj"),
            u_model: ops.get_uniform_location(p, "uModel"),
            u_p: ops.get_uniform_location(p, "uP"),
            u_fog: ops.get_uniform_location(p, "uFog"),
            u_fog_color: ops.get_uniform_location(p, "uFogColor"),
            u_tex0: ops.get_uniform_location(p, "uTex0"),
            u_lightmap: ops.get_uniform_location(p, "uLightmap"),
            globals_version: -1,
            last_model: [f32::NAN; 16],
            last_params: [f32::NAN; 16],
        })
    }

    /// JS: `_ensureQuads(quads)` â€” grow the shared quad index buffer.
    pub fn ensure_quads(&mut self, ops: &mut dyn WebGlOps, quads: usize) {
        if quads <= self.quad_capacity {
            return;
        }
        // JS: `let cap = Math.max(this.quadCapacity * 2, 1024); while (cap < quads) cap *= 2;`
        let cap = grow_quad_capacity(self.quad_capacity as f64, quads as f64) as usize;
        ops.bind_vertex_array(None);
        self.cur_vao = None;
        ops.bind_buffer(BufferTarget::Element, Some(self.quad_buffer));
        let indices = quad_indices(cap);
        let bytes: Vec<u8> = indices.iter().flat_map(|i| i.to_ne_bytes()).collect();
        ops.buffer_data(BufferTarget::Element, &bytes, false);
        self.quad_capacity = cap;
        self.quad_gen += 1;
    }

    /// JS: `resize(w, h)`.
    pub fn resize(&mut self, w: i32, h: i32) {
        self.width = w;
        self.height = h;
        // JS: `this.canvas.width = w; this.canvas.height = h;` â€” the host
        // mirrors the canvas element size.
    }

    // ---------------------------------------------------------------- textures

    /// JS: `createTexture(o)` â€” mip levels, filters, wrap, optional mips.
    #[allow(clippy::too_many_arguments)]
    pub fn create_texture(
        &mut self,
        ops: &mut dyn WebGlOps,
        width: i32,
        height: i32,
        mipmaps: bool,
        mip_levels: i32,
        filter: &str,
        wrap: &str,
        data: Option<&[u8]>,
    ) -> Texture {
        let mip_levels = if mipmaps { 4 } else { mip_levels.max(0) };
        let tex = ops.create_texture();
        ops.bind_texture(Some(tex));
        self.bound_tex[0] = None;
        ops.pixel_storei(1); // JS: gl.UNPACK_ALIGNMENT = 1
        ops.tex_image_2d(0, width, height, data.map(to_u8));
        let near = filter == "nearest";
        ops.tex_parameter_i(
            if near { TexParameter::MagFilterNearest } else { TexParameter::MagFilterLinear },
            0,
        );
        ops.tex_parameter_i(
            if mip_levels > 0 {
                if near { TexParameter::MinFilterNearestMipmapLinear } else { TexParameter::MinFilterLinearMipmapLinear }
            } else if near {
                TexParameter::MinFilterNearest
            } else {
                TexParameter::MinFilterLinear
            },
            0,
        );
        let wrap = wrap == "repeat";
        ops.tex_parameter_i(if wrap { TexParameter::WrapSRepeat } else { TexParameter::WrapSClamp }, 0);
        ops.tex_parameter_i(if wrap { TexParameter::WrapTRepeat } else { TexParameter::WrapTClamp }, 0);
        let texture = Texture {
            tex,
            width,
            height,
            mipmaps: mip_levels > 0,
            mip_levels,
            filter: filter.to_string(),
            wrap: wrap.then(|| "repeat").unwrap_or("clamp").to_string(),
            fbo: None,
            depth: None,
        };
        if texture.mipmaps {
            if let Some(d) = data {
                self.upload_mips(ops, &texture, d);
            } else {
                ops.tex_parameter_i(TexParameter::MaxLevel(0), 0);
            }
        }
        texture
    }

    /// JS: `_uploadMips(t, data)` â€” [`crate::webgl2_alg::build_mips`] + upload.
    fn upload_mips(&mut self, ops: &mut dyn WebGlOps, t: &Texture, data: &[u8]) {
        let mips = build_mips(t.width, t.height, to_u8(data), t.mip_levels);
        ops.tex_parameter_i(TexParameter::MaxLevel(mips.len() as i32), 0);
        for (i, m) in mips.iter().enumerate() {
            ops.tex_image_2d(i as i32 + 1, m.width, m.height, Some(to_u8(&m.data)));
        }
    }

    /// JS: `updateTexture(t, data, x = 0, y = 0, w = t.width, h = t.height)`.
    pub fn update_texture(&mut self, ops: &mut dyn WebGlOps, t: &Texture, data: &[u8], x: i32, y: i32, w: i32, h: i32) {
        ops.bind_texture(Some(t.tex));
        self.bound_tex[0] = None;
        ops.pixel_storei(1);
        ops.tex_sub_image_2d(0, x, y, w, h, to_u8(data));
        if t.mipmaps && x == 0 && y == 0 && w == t.width && h == t.height {
            self.upload_mips(ops, t, data);
        }
    }

    /// JS: `destroyTexture(t)`.
    pub fn destroy_texture(&mut self, ops: &mut dyn WebGlOps, t: &Texture) {
        ops.delete_texture(t.tex);
    }

    /// JS: `createRenderTarget(w, h)` â€” offscreen colour + depth; the result is
    /// also a normal (linear, clamped) texture.
    pub fn create_render_target(&mut self, ops: &mut dyn WebGlOps, w: i32, h: i32) -> Texture {
        let mut t = self.create_texture(ops, w, h, false, 0, "linear", "clamp", None);
        t.fbo = Some(ops.create_framebuffer());
        t.depth = Some(ops.create_renderbuffer());
        ops.bind_renderbuffer(Some(t.depth.unwrap()));
        ops.renderbuffer_storage(w, h); // DEPTH_COMPONENT24
        ops.bind_framebuffer(Some(t.fbo.unwrap()));
        ops.framebuffer_texture_2d(t.tex);
        ops.framebuffer_renderbuffer(t.depth.unwrap());
        ops.bind_framebuffer(self.target.as_ref().map(|t| t.fbo.unwrap()));
        t
    }

    /// JS: `setRenderTarget(t, clear)` â€” draw into a render target (None = screen).
    pub fn set_render_target(&mut self, ops: &mut dyn WebGlOps, t: Option<&Texture>, clear: Option<[f32; 4]>) {
        self.target = t.cloned();
        ops.bind_framebuffer(t.and_then(|t| t.fbo));
        let (tw, th) = t.map_or((self.width, self.height), |t| (t.width, t.height));
        ops.viewport(0, 0, tw, th);
        ops.disable(Cap::ScissorTest);
        if let Some(c) = clear {
            ops.clear_color(c[0], c[1], c[2], if c[3] == 0.0 { 1.0 } else { c[3] });
            ops.depth_mask(true);
            ops.color_mask(true, true, true, true);
            self.cur_state = String::new();
            self.cur_state_obj = None;
            ops.clear(ClearBits(true, true));
        }
    }

    /// JS: `busy()` â€” true while the GPU is more than a frame behind.
    pub fn busy(&mut self, ops: &mut dyn WebGlOps) -> bool {
        while !self.fences.is_empty() {
            let st = ops.client_wait_sync(self.fences[0]);
            if st != SyncStatus::AlreadySignaled && st != SyncStatus::ConditionSatisfied {
                break;
            }
            ops.delete_sync(self.fences.remove(0));
        }
        self.fences.len() >= 2
    }

    // ------------------------------------------------------------------ meshes

    /// JS: `createMesh(format, vertices, opts)`.
    pub fn create_mesh(
        &mut self,
        ops: &mut dyn WebGlOps,
        format: &'static crate::webgl2_alg::MeshFormat,
        vertices: &[u8],
        quads: bool,
        dynamic: bool,
    ) -> Mesh {
        let vao = ops.create_vertex_array();
        let vbo = ops.create_buffer();
        let mut mesh = Mesh {
            format,
            vao,
            vbo,
            ibo: None,
            vertex_count: 0,
            index_count: 0,
            byte_stride: 0,
            byte_length: 0,
            quads,
            dynamic,
            quad_gen: -1,
        };
        ops.bind_vertex_array(Some(vao));
        self.cur_vao = Some(vao);
        ops.bind_buffer(BufferTarget::Array, Some(vbo));
        let layout: VertexLayout = vertex_layout(format);
        mesh.byte_stride = layout.byte_stride;
        for (i, a) in layout.attrs.iter().enumerate() {
            ops.enable_vertex_attrib_array(i as u32);
            let (ty, normalized) = match a.ty {
                crate::webgl2_alg::AttributeType::Unorm16 => (AttributeTypeGl::UnsignedShort, true),
                crate::webgl2_alg::AttributeType::Unorm8 => (AttributeTypeGl::UnsignedByte, true),
                crate::webgl2_alg::AttributeType::F32 => (AttributeTypeGl::Float, false),
            };
            ops.vertex_attrib_pointer(i as u32, a.size, ty, normalized, layout.byte_stride, a.byte_offset);
        }
        ops.bind_vertex_array(None);
        self.cur_vao = None;
        self.update_mesh(ops, &mut mesh, vertices, Some(quads), None);
        mesh
    }

    /// JS: `updateMesh(m, vertices, opts)`.
    pub fn update_mesh(
        &mut self,
        ops: &mut dyn WebGlOps,
        m: &mut Mesh,
        vertices: &[u8],
        quads: Option<bool>,
        indices: Option<&[u32]>,
    ) {
        ops.bind_vertex_array(None);
        self.cur_vao = None;
        ops.bind_buffer(BufferTarget::Array, Some(m.vbo));
        ops.buffer_data(BufferTarget::Array, vertices, m.dynamic);
        m.vertex_count = (vertices.len() / m.byte_stride.max(1) as usize) as i32;
        m.byte_length = vertices.len() as i32;
        if let Some(q) = quads {
            m.quads = q;
        }
        if let Some(indices) = indices {
            if m.ibo.is_none() {
                m.ibo = Some(ops.create_buffer());
            }
            ops.bind_vertex_array(Some(m.vao));
            self.cur_vao = Some(m.vao);
            ops.bind_buffer(BufferTarget::Element, m.ibo);
            let bytes: Vec<u8> = indices.iter().flat_map(|i| i.to_ne_bytes()).collect();
            ops.buffer_data(BufferTarget::Element, &bytes, false);
            ops.bind_vertex_array(None);
            self.cur_vao = None;
            m.index_count = indices.len() as i32;
            m.quads = false;
        } else if m.quads {
            self.ensure_quads(ops, (m.vertex_count / 4) as usize);
            m.index_count = (m.vertex_count / 4) * 6;
        } else {
            m.index_count = 0;
        }
    }

    /// JS: `destroyMesh(m)`.
    pub fn destroy_mesh(&mut self, ops: &mut dyn WebGlOps, m: &Mesh) {
        ops.delete_vertex_array(m.vao);
        ops.delete_buffer(m.vbo);
        if let Some(ibo) = m.ibo {
            ops.delete_buffer(ibo);
        }
    }

    // ------------------------------------------------------------------- frame

    /// JS: `beginFrame(clear)`.
    pub fn begin_frame(&mut self, ops: &mut dyn WebGlOps, clear: [f32; 3]) {
        if self.target.is_some() {
            self.target = None;
            ops.bind_framebuffer(None);
        }
        ops.viewport(0, 0, self.width, self.height);
        ops.disable(Cap::ScissorTest);
        ops.clear_color(clear[0], clear[1], clear[2], 1.0);
        ops.depth_mask(true);
        ops.color_mask(true, true, true, true);
        self.cur_state = String::new();
        self.cur_state_obj = None;
        ops.clear(ClearBits(true, true));
    }

    /// JS: `clearDepth()`.
    pub fn clear_depth(&mut self, ops: &mut dyn WebGlOps) {
        ops.depth_mask(true);
        self.cur_state = String::new();
        ops.clear(ClearBits(false, true));
    }

    /// JS: `setGlobals(g)`.
    pub fn set_globals(
        &mut self,
        view: Option<&[f32; 16]>,
        proj: Option<&[f32; 16]>,
        fog_color: Option<&[f32; 3]>,
        fog_start: Option<f32>,
        fog_end: Option<f32>,
        fog_density: Option<f32>,
        fog_mode: Option<f32>,
        lightmap: Option<GlId>,
    ) {
        if let Some(v) = view {
            self.globals.view = *v;
        }
        if let Some(v) = proj {
            self.globals.proj = *v;
        }
        if let Some(v) = fog_color {
            self.globals.fog_color = *v;
        }
        if let Some(v) = fog_start {
            self.globals.fog[0] = v;
        }
        if let Some(v) = fog_end {
            self.globals.fog[1] = v;
        }
        if let Some(v) = fog_density {
            self.globals.fog[2] = v;
        }
        if let Some(v) = fog_mode {
            self.globals.fog[3] = v;
        }
        if let Some(lm) = lightmap {
            self.globals.lightmap = Some(lm);
        }
        self.globals_version += 1;
    }

    /// JS: `setScissor(r)`.
    pub fn set_scissor(&mut self, ops: &mut dyn WebGlOps, r: Option<&[f64; 4]>) {
        let Some(r) = r else {
            ops.disable(Cap::ScissorTest);
            return;
        };
        ops.enable(Cap::ScissorTest);
        let th = self.target.as_ref().map_or(self.height as f64, |t| t.height as f64);
        let rect = scissor_rect(r, th);
        ops.scissor(rect[0], rect[1], rect[2], rect[3]);
    }

    /// JS: `_applyState(s)` â€” the draw-state cache.
    fn apply_state(&mut self, ops: &mut dyn WebGlOps, s: &DrawState) {
        if self.cur_state_obj.as_ref() == Some(s) {
            return;
        }
        self.cur_state_obj = Some(s.clone());
        let key = state_key(s);
        if key == self.cur_state {
            return;
        }
        self.cur_state = key;
        // JS: blend modes â€” none/alpha/add/invert/darken/multiply.
        match s.blend.unwrap_or(BlendMode::None) {
            BlendMode::None => ops.disable(Cap::Blend),
            BlendMode::Alpha => {
                ops.enable(Cap::Blend);
                ops.blend_func_separate(
                    BlendFactor::SrcAlpha,
                    BlendFactor::OneMinusSrcAlpha,
                    BlendFactor::One,
                    BlendFactor::OneMinusSrcAlpha,
                );
            }
            BlendMode::Add => {
                ops.enable(Cap::Blend);
                ops.blend_func(BlendFactor::SrcAlpha, BlendFactor::One);
            }
            BlendMode::Invert => {
                ops.enable(Cap::Blend);
                ops.blend_func(BlendFactor::OneMinusDstColor, BlendFactor::OneMinusSrcColor);
            }
            BlendMode::Darken => {
                ops.enable(Cap::Blend);
                ops.blend_func(BlendFactor::Zero, BlendFactor::OneMinusSrcColor);
            }
            BlendMode::Multiply => {
                ops.enable(Cap::Blend);
                ops.blend_func(BlendFactor::DstColor, BlendFactor::SrcColor);
            }
        }
        if s.depth_test == Some(false) {
            ops.disable(Cap::DepthTest);
        } else {
            ops.enable(Cap::DepthTest);
        }
        ops.depth_mask(s.depth_write != Some(false));
        ops.depth_func(if s.depth_func == Some(DepthFunc::Equal) { DepthFunc::Equal } else { DepthFunc::Lequal });
        let cw = s.color_write != Some(false);
        ops.color_mask(cw, cw, cw, cw);
        if s.cull == Some(true) {
            ops.enable(Cap::CullFace);
        } else {
            ops.disable(Cap::CullFace);
        }
        if s.polygon_offset == Some(true) {
            ops.enable(Cap::PolygonOffsetFill);
            ops.polygon_offset(-1.0, -1.0);
        } else {
            ops.disable(Cap::PolygonOffsetFill);
        }
    }

    /// JS: `draw(d)` â€” the full draw path with all the caching.
    pub fn draw(&mut self, ops: &mut dyn WebGlOps, d: &DrawCall) {
        let Some(m) = d.mesh else { return };
        if m.vertex_count == 0 {
            return;
        }
        let defaults = default_params(d.pipeline);
        let params: &[f32; 16] = d.params.or_else(|| defaults.as_ref()).unwrap_or(&ZERO16);
        // JS: animation pack selection.
        let pack = self.terrain_animation.as_ref();
        let use_pack = animation_pack_used(
            d.pipeline,
            pack.is_some(),
            pack.map_or(false, |p| p.programs.contains_key(d.pipeline)),
            params,
        );
        // JS: `const prog = animation ? ... : this.programs[d.pipeline];`
        // (borrow dance: take the program's key + a cloned Program to avoid
        // aliasing `self` while we mutate the caches).
        let mut program: Program = if use_pack {
            let pack = self.terrain_animation.as_ref().unwrap();
            pack.programs.get(d.pipeline).cloned().unwrap_or_else(|| pack.program.clone())
        } else {
            self.programs.get(d.pipeline).expect("unknown pipeline").clone()
        };
        if self.cur_program != Some(program.p) {
            ops.use_program(program.p);
            self.cur_program = Some(program.p);
        }
        if program.globals_version != self.globals_version {
            let g = &self.globals;
            ops.uniform_matrix4fv(program.u_view, false, &g.view);
            ops.uniform_matrix4fv(program.u_proj, false, &g.proj);
            ops.uniform4fv(program.u_fog, &g.fog);
            ops.uniform3fv(program.u_fog_color, &g.fog_color);
            ops.uniform1i(program.u_tex0, 0);
            ops.uniform1i(program.u_lightmap, 1);
            program.globals_version = self.globals_version;
        }
        // JS: model/params uploads are skipped when unchanged.
        let model = d.model.unwrap_or(&IDENTITY);
        if !same16(&program.last_model, model) {
            ops.uniform_matrix4fv(program.u_model, false, model);
        }
        if !same16(&program.last_params, params) {
            ops.uniform4fv(program.u_p, params);
        }
        // Persist the program caches back (the JS mutates the record in place).
        self.put_program(d.pipeline, use_pack, program);
        // JS: texture 0 + lightmap binds.
        let t0 = d.texture0.map_or(self.white.tex, |t| t.tex);
        if self.bound_tex[0] != Some(t0) {
            ops.active_texture(0);
            ops.bind_texture(Some(t0));
            self.bound_tex[0] = Some(t0);
        }
        let lm = self.globals.lightmap.unwrap_or(self.white.tex);
        if self.bound_tex[1] != Some(lm) {
            ops.active_texture(1);
            ops.bind_texture(Some(lm));
            ops.active_texture(0);
            self.bound_tex[1] = Some(lm);
        }
        // JS: terrain-animation uniforms.
        if use_pack {
            let pack = self.terrain_animation.as_ref().unwrap();
            if let Some(f) = &pack.frame {
                if let Some(l) = &f.lighting {
                    // JS: uniform3fv for ambient/direct/block/minimum + dimension.
                    let lighting: [&[f32; 3]; 4] = [&l.0, &l.1, &l.2, &l.3];
                    for (i, v) in lighting.iter().enumerate() {
                        if let Some(loc) = pack.u_lighting.get(i) {
                            ops.uniform3fv(Some(*loc), v);
                        }
                    }
                    if let Some(loc) = pack.u_lighting.get(4) {
                        ops.uniform1f(Some(*loc), l.4);
                    }
                }
                if d.pipeline == "terrain" {
                    ops.uniform1i(pack.u_ids, 2);
                    ops.active_texture(2);
                    ops.bind_texture(Some(pack.ids.tex));
                    ops.active_texture(0);
                    ops.uniform4f(pack.u_frame, f.time, f.world_time, 0.0, 0.0);
                    ops.uniform3f(pack.u_camera, f.camera[0], f.camera[1], f.camera[2]);
                    ops.uniform3f(
                        pack.u_eye,
                        f.camera[0] - f.eye[0],
                        f.camera[1] - f.eye[1],
                        f.camera[2] - f.eye[2],
                    );
                }
            }
        }
        self.apply_state(ops, d.state.unwrap_or(&EMPTY_STATE));
        if self.cur_vao != Some(m.vao) {
            ops.bind_vertex_array(Some(m.vao));
            self.cur_vao = Some(m.vao);
        }
        let lines = d.lines;
        if m.quads {
            if m.quad_gen != self.quad_gen {
                ops.bind_buffer(BufferTarget::Element, Some(self.quad_buffer));
                self.store_quad_gen(m);
            }
            let first = d.first;
            let count = d.count.unwrap_or(m.index_count);
            if count > 0 {
                ops.draw_elements(lines, count, first);
            }
        } else if m.ibo.is_some() {
            let count = d.count.unwrap_or(m.index_count);
            if count > 0 {
                ops.draw_elements(lines, count, d.first);
            }
        } else {
            let count = d.count.unwrap_or(m.vertex_count);
            if count > 0 {
                ops.draw_arrays(lines, d.first, count);
            }
        }
    }

    // The borrow helpers below keep `draw` readable: the JS mutates the program
    // record in place; Rust clones the program out of the map, mutates the
    // clone, and `put_program` stores it back after the draw.

    fn put_program(&mut self, pipeline: &str, use_pack: bool, program: Program) {
        if use_pack {
            if let Some(pack) = &mut self.terrain_animation {
                if let Some(p) = pack.programs.get_mut(pipeline) {
                    *p = program;
                } else {
                    pack.program = program;
                }
            }
        } else if let Some(p) = self.programs.get_mut(pipeline) {
            *p = program;
        }
    }

    fn apply_lighting_uniforms(
        &mut self,
        ops: &mut dyn WebGlOps,
        pipeline: &str,
        use_pack: bool,
        l: &([f32; 3], [f32; 3], [f32; 3], [f32; 3], f32),
    ) {
        // JS: `for (const [i, key] of ['ambient','direct','block','minimum'].entries()) gl.uniform3fv(prog.uLighting[i], l[key]); gl.uniform1f(prog.uLighting[4], l.dimension);`
        if use_pack {
            if let Some(pack) = &self.terrain_animation {
                let p = pack.programs.get(pipeline).unwrap_or(&pack.program);
                let _ = p;
                let lighting: [&[f32; 3]; 4] = [&l.0, &l.1, &l.2, &l.3];
                for (i, v) in lighting.iter().enumerate() {
                    if let Some(loc) = pack.u_lighting.get(i) {
                        ops.uniform3fv(Some(*loc), v);
                    }
                }
                if let Some(loc) = pack.u_lighting.get(4) {
                    ops.uniform1f(Some(*loc), l.4);
                }
            }
        }
    }

    fn store_quad_gen(&mut self, m: &Mesh) {
        // JS: `m.quadGen = this.quadGen;` â€” meshes are stored by the caller, so
        // the device records the generation for the borrow checker here.
        self.last_bound_quad_gen = Some((m.quad_gen, self.quad_gen));
    }

    /// Rust-side bookkeeping for `store_quad_gen` (the caller applies it to the
    /// stored mesh, mirroring the JS in-place mutation).
    pub fn take_quad_gen_update(&mut self) -> Option<(i64, i64)> {
        self.last_bound_quad_gen.take()
    }

    /// JS: `endFrame()` â€” resolve captures, add a fence, flush.
    pub fn end_frame(&mut self, ops: &mut dyn WebGlOps) -> Vec<CapturedPixels> {
        let mut captured = Vec::new();
        if self.capture_waiters > 0 {
            captured.push(self.read_pixels(ops));
            self.capture_waiters = 0;
        }
        let fence = ops.fence_sync();
        self.fences.push(fence);
        if self.fences.len() > 8 {
            ops.delete_sync(self.fences.remove(0));
        }
        ops.flush();
        captured
    }

    /// JS: `capture()` â€” a pending readback (the promise resolves in `endFrame`).
    pub fn capture(&mut self) {
        self.capture_waiters += 1;
    }

    /// JS: `_readPixels()` â€” RGBA read with a vertical flip.
    fn read_pixels(&mut self, ops: &mut dyn WebGlOps) -> CapturedPixels {
        let (w, h) = (self.width, self.height);
        let buf = ops.read_pixels(w, h);
        CapturedPixels { width: w, height: h, data: flip_rows_vertical(&buf, w, h) }
    }

    /// JS: `setTerrainAnimation(animation, frame)`.
    pub fn set_terrain_animation(&mut self, animation: Option<TerrainAnimation>, frame: Option<TerrainAnimationFrame>) {
        match animation {
            Some(mut a) => {
                a.frame = frame;
                self.terrain_animation = Some(a);
            }
            None => self.terrain_animation = None,
        }
    }
}

// Rust-side bookkeeping fields live outside the struct above to keep the JS
// field mapping clean.
