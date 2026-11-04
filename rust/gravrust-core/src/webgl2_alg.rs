//! Pure algorithms of the `client/js/gfx/webgl2.js` port.
//!
//! `webgl2.rs` holds the GLSL sources, the documented `gl.*` stub trait and the
//! device state machine. This file holds everything that runs without a WebGL
//! context: fog math, mip generation, quad index buffers, vertex layout math,
//! draw-state keys, scissor math, the capture row flip, the final-pass uniform
//! tables and the parameter defaults webgl2.js reads from `device.js` and
//! `shader-frame.js` (those two modules get their own ports; only the data
//! webgl2.js actually consumes is re-hosted here, marked per item).
//!
//! Every ported item carries a `// JS:` comment pointing at the original.

use std::borrow::Cow;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

// JS: the GLSL fogFactor helper in HEADER (webgl2.js), mirrored as an
// executable kernel so the fog math can be tested against the shader.
//   if (uFog.w > 1.5 && uFog.w < 2.5) return 0.0;
//   if (uFog.w > 2.5) return 1.0 - clamp(exp(-pow(uFog.z * d, 2.0)), 0.0, 1.0);
//   if (uFog.w < 0.5) return clamp((d - uFog.x) / max(0.0001, uFog.y - uFog.x), 0.0, 1.0);
//   return 1.0 - clamp(exp(-uFog.z * d), 0.0, 1.0);
// `fog` is `uFog`: [start, end, density, mode] (0 linear, 1 exp, 2 none, 3 exp2).
pub fn fog_factor(d: f32, fog: &[f32; 4]) -> f32 {
    let (start, end, density, mode) = (fog[0], fog[1], fog[2], fog[3]);
    if mode > 1.5 && mode < 2.5 {
        return 0.0;
    }
    if mode > 2.5 {
        // GLSL pow(x, 2.0) squares; powi(2) is the exact equivalent here.
        return 1.0 - (-((density * d).powi(2))).exp().clamp(0.0, 1.0);
    }
    if mode < 0.5 {
        return ((d - start) / (end - start).max(0.0001)).clamp(0.0, 1.0);
    }
    1.0 - (-density * d).exp().clamp(0.0, 1.0)
}

// JS: `vec3 lightmap(vec2 l) { return texture(uLightmap, vec2((l.y + 0.5) / 16.0, (l.x + 0.5) / 16.0)).rgb; }`
// The uv math is pure; the texture fetch itself is browser-bound.
pub fn lightmap_uv(l: [f32; 2]) -> [f32; 2] {
    [(l[1] + 0.5) / 16.0, (l[0] + 0.5) / 16.0]
}

// JS (device.js): `export const TERRAIN_POS_SCALE = 2048;`
pub const TERRAIN_POS_SCALE: f32 = 2048.0;

// JS (terrain vs): `vec3 p = aPos.xyz * (65535.0 / 2048.0) - 8.0;`
// `a_pos` is the normalized unorm16 attribute (the GPU normalizes before the shader runs).
pub fn decode_terrain_position(a_pos: [f32; 4]) -> [f32; 3] {
    let scale = 65535.0 / TERRAIN_POS_SCALE;
    [a_pos[0] * scale - 8.0, a_pos[1] * scale - 8.0, a_pos[2] * scale - 8.0]
}

// JS (device.js): `export function quadIndices(quads)` — two CCW triangles per quad.
pub fn quad_indices(quads: usize) -> Vec<u32> {
    let mut idx = Vec::with_capacity(quads * 6);
    for i in 0..quads {
        let v = (i * 4) as u32;
        idx.push(v);
        idx.push(v + 1);
        idx.push(v + 2);
        idx.push(v);
        idx.push(v + 2);
        idx.push(v + 3);
    }
    idx
}

// JS (device.js): `export function buildMips(width, height, data, maxLevels = 4)` —
// box-filtered RGBA mip chain excluding level 0. Colour is alpha-weighted; alpha
// is the plain average; Uint8Array stores truncate the floats.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MipLevel {
    pub width: i32,
    pub height: i32,
    pub data: Vec<u8>,
}

pub fn build_mips(width: i32, height: i32, data: &[u8], max_levels: i32) -> Vec<MipLevel> {
    let mut out = Vec::new();
    let mut w = width;
    let mut h = height;
    let mut src: Cow<[u8]> = Cow::Borrowed(data);
    let mut level = 0;
    while level < max_levels && (w > 1 || h > 1) {
        let nw = std::cmp::max(1, w >> 1);
        let nh = std::cmp::max(1, h >> 1);
        let mut dst = vec![0u8; (nw * nh * 4) as usize];
        for y in 0..nh {
            for x in 0..nw {
                let mut r = 0.0f32;
                let mut g = 0.0f32;
                let mut b = 0.0f32;
                let mut a = 0.0f32;
                let mut n = 0.0f32;
                for dy in 0..2 {
                    for dx in 0..2 {
                        let sx = std::cmp::min(w - 1, x * 2 + dx);
                        let sy = std::cmp::min(h - 1, y * 2 + dy);
                        let i = ((sy * w + sx) * 4) as usize;
                        let al = src[i + 3] as f32;
                        r += src[i] as f32 * al;
                        g += src[i + 1] as f32 * al;
                        b += src[i + 2] as f32 * al;
                        a += al;
                        n += 1.0;
                    }
                }
                let o = ((y * nw + x) * 4) as usize;
                if a > 0.0 {
                    dst[o] = (r / a) as u8;
                    dst[o + 1] = (g / a) as u8;
                    dst[o + 2] = (b / a) as u8;
                }
                dst[o + 3] = (a / n) as u8;
            }
        }
        w = nw;
        h = nh;
        src = Cow::Owned(dst.clone());
        out.push(MipLevel { width: nw, height: nh, data: dst });
        level += 1;
    }
    out
}

// ---------------------------------------------------------------------------
// Vertex formats (re-hosted from client/js/gfx/device.js)
// ---------------------------------------------------------------------------

/// One attribute spec of a device.js FORMAT entry: `[name, size, offset, type?]`.
/// Offsets are in floats for unpacked formats, in bytes for packed formats.
#[derive(Clone, Copy, Debug)]
pub struct MeshAttrSpec {
    pub name: &'static str,
    pub size: i32,
    pub offset: i32,
    /// JS: the optional 4th tuple element (`'unorm16' | 'unorm8'`), absent for float formats.
    pub attr_type: Option<&'static str>,
}

/// JS (device.js): a `FORMAT` entry — `{ name, packed?, byteStride?, stride?, attrs }`.
#[derive(Clone, Copy, Debug)]
pub struct MeshFormat {
    pub name: &'static str,
    pub packed: bool,
    /// JS: `byteStride` (packed formats, bytes).
    pub byte_stride: i32,
    /// JS: `stride` (float formats, floats).
    pub stride: i32,
    pub attrs: &'static [MeshAttrSpec],
}

// JS (device.js): export const FORMAT = { terrain, lit, entity, color }.
pub static FORMAT_TERRAIN: MeshFormat = MeshFormat {
    name: "terrain",
    packed: true,
    byte_stride: 20,
    stride: 0,
    attrs: &[
        MeshAttrSpec { name: "pos", size: 4, offset: 0, attr_type: Some("unorm16") },
        MeshAttrSpec { name: "uv", size: 2, offset: 8, attr_type: Some("unorm16") },
        MeshAttrSpec { name: "col", size: 4, offset: 12, attr_type: Some("unorm8") },
        MeshAttrSpec { name: "light", size: 2, offset: 16, attr_type: Some("unorm8") },
    ],
};

pub static FORMAT_LIT: MeshFormat = MeshFormat {
    name: "lit",
    packed: false,
    byte_stride: 0,
    stride: 11,
    attrs: &[
        MeshAttrSpec { name: "pos", size: 3, offset: 0, attr_type: None },
        MeshAttrSpec { name: "uv", size: 2, offset: 3, attr_type: None },
        MeshAttrSpec { name: "col", size: 4, offset: 5, attr_type: None },
        MeshAttrSpec { name: "light", size: 2, offset: 9, attr_type: None },
    ],
};

pub static FORMAT_ENTITY: MeshFormat = MeshFormat {
    name: "entity",
    packed: false,
    byte_stride: 0,
    stride: 11,
    attrs: &[
        MeshAttrSpec { name: "pos", size: 3, offset: 0, attr_type: None },
        MeshAttrSpec { name: "uv", size: 2, offset: 3, attr_type: None },
        MeshAttrSpec { name: "nrm", size: 3, offset: 5, attr_type: None },
        MeshAttrSpec { name: "col", size: 3, offset: 8, attr_type: None },
    ],
};

pub static FORMAT_COLOR: MeshFormat = MeshFormat {
    name: "color",
    packed: false,
    byte_stride: 0,
    stride: 9,
    attrs: &[
        MeshAttrSpec { name: "pos", size: 3, offset: 0, attr_type: None },
        MeshAttrSpec { name: "uv", size: 2, offset: 3, attr_type: None },
        MeshAttrSpec { name: "col", size: 4, offset: 5, attr_type: None },
    ],
};

// JS (device.js): `export const PIPELINE_FORMAT = { terrain: FORMAT.terrain, lit: FORMAT.lit,
// entity: FORMAT.entity, color: FORMAT.color, endportal: FORMAT.color, post: FORMAT.color };`
pub static PIPELINE_FORMAT: [(&str, &MeshFormat); 6] = [
    ("terrain", &FORMAT_TERRAIN),
    ("lit", &FORMAT_LIT),
    ("entity", &FORMAT_ENTITY),
    ("color", &FORMAT_COLOR),
    ("endportal", &FORMAT_COLOR),
    ("post", &FORMAT_COLOR),
];

// JS (device.js): `export function vertexLayout(f)` — per-attribute layout of any format.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AttributeType {
    F32,
    Unorm16,
    Unorm8,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LayoutAttr {
    pub size: i32,
    pub byte_offset: i32,
    pub ty: AttributeType,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VertexLayout {
    pub byte_stride: i32,
    pub attrs: Vec<LayoutAttr>,
}

pub fn vertex_layout(f: &MeshFormat) -> VertexLayout {
    if f.packed {
        // JS: { byteStride: f.byteStride, attrs: f.attrs.map(([, size, byteOffset, type]) => ({ size, byteOffset, type })) }
        VertexLayout {
            byte_stride: f.byte_stride,
            attrs: f
                .attrs
                .iter()
                .map(|a| LayoutAttr {
                    size: a.size,
                    byte_offset: a.offset,
                    ty: match a.attr_type {
                        Some("unorm16") => AttributeType::Unorm16,
                        Some("unorm8") => AttributeType::Unorm8,
                        _ => AttributeType::F32,
                    },
                })
                .collect(),
        }
    } else {
        // JS: { byteStride: f.stride * 4, attrs: f.attrs.map(([, size, off]) => ({ size, byteOffset: off * 4, type: 'f32' })) }
        VertexLayout {
            byte_stride: f.stride * 4,
            attrs: f
                .attrs
                .iter()
                .map(|a| LayoutAttr { size: a.size, byte_offset: a.offset * 4, ty: AttributeType::F32 })
                .collect(),
        }
    }
}

// JS (device.js): `export const DEFAULT_PARAMS` — params used when a draw passes none
// (white, no alpha test). Derived exactly from the device.js helpers:
//   terrain: terrainParams(0, 1)            -> out[0]=0 alphaTest, out[1]=1 opacity, out[2]=0 mipBias
//   lit:     litParams(0)                   -> out[0]=0
//   entity:  new EntityParams().setAlphaTest(0).p
//            (setTint(1,1,1,1), setLight(15,15), p[12]=0.1, setAlphaTest(0))
//   color:   colorParams(1, 1, 1, 1)        -> out[0..4]=1,1,1,1
//   endportal: new Float32Array(16)
//   post:    new Float32Array([0,0,0,0, 1,1,1,1, 0,0,0,0, 0,0,0,0])
pub fn default_params(pipeline: &str) -> Option<[f32; 16]> {
    match pipeline {
        "terrain" => Some([0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "lit" => Some([0.0; 16]),
        "entity" => Some([1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 15.0, 15.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "color" => Some([1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "endportal" => Some([0.0; 16]),
        "post" => Some([0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Draw state (webgl2.js `_applyState`)
// ---------------------------------------------------------------------------

/// JS: `state.blend` — `'none' | 'alpha' | 'add' | 'invert' | 'darken' | 'multiply'`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BlendMode {
    None,
    Alpha,
    Add,
    Invert,
    Darken,
    Multiply,
}

/// JS: `state.depthFunc` — `'lequal' | 'equal'`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DepthFunc {
    Lequal,
    Equal,
}

/// JS: the `state` draw object. Fields may be absent in JS (undefined), which
/// selects the documented default; `Option` models that exactly.
#[derive(Clone, Debug, PartialEq)]
pub struct DrawState {
    pub blend: Option<BlendMode>,
    pub depth_test: Option<bool>,
    pub depth_write: Option<bool>,
    pub cull: Option<bool>,
    pub polygon_offset: Option<bool>,
    pub depth_func: Option<DepthFunc>,
    pub color_write: Option<bool>,
}

impl Default for DrawState {
    fn default() -> Self {
        DrawState {
            blend: None,
            depth_test: None,
            depth_write: None,
            cull: None,
            polygon_offset: None,
            depth_func: None,
            color_write: None,
        }
    }
}

// JS: `const EMPTY_STATE = {};` — the default draw state (all fields absent).
pub const EMPTY_STATE: DrawState = DrawState {
    blend: None,
    depth_test: None,
    depth_write: None,
    cull: None,
    polygon_offset: None,
    depth_func: None,
    color_write: None,
};

// JS (webgl2.js `_applyState`): the draw-state cache key —
// `(s.blend || 'none') + (s.depthTest === false ? 0 : 1) + (s.depthWrite === false ? 0 : 1)
//  + (s.cull ? 1 : 0) + (s.polygonOffset ? 1 : 0) + (s.depthFunc === 'equal' ? 'e' : '')
//  + (s.colorWrite === false ? 'n' : '')`
pub fn state_key(s: &DrawState) -> String {
    let blend = match s.blend {
        Some(BlendMode::Alpha) => "alpha",
        Some(BlendMode::Add) => "add",
        Some(BlendMode::Invert) => "invert",
        Some(BlendMode::Darken) => "darken",
        Some(BlendMode::Multiply) => "multiply",
        _ => "none", // JS: s.blend || 'none' (None and an absent field both fall back)
    };
    format!(
        "{}{}{}{}{}{}{}",
        blend,
        if s.depth_test == Some(false) { "0" } else { "1" },
        if s.depth_write == Some(false) { "0" } else { "1" },
        if s.cull == Some(true) { "1" } else { "0" },
        if s.polygon_offset == Some(true) { "1" } else { "0" },
        if s.depth_func == Some(DepthFunc::Equal) { "e" } else { "" },
        if s.color_write == Some(false) { "n" } else { "" },
    )
}

// JS (webgl2.js `setScissor`): the scissor rect math —
// `gl.scissor(Math.floor(r[0]), Math.floor(th - r[1] - r[3]), Math.ceil(r[2]), Math.ceil(r[3]))`
// where `th` is the render-target height when drawing into one (the device's
// render targets are bottom-up, the scissor input is top-left origin).
pub fn scissor_rect(r: &[f64; 4], target_height: f64) -> [i32; 4] {
    [
        r[0].floor() as i32,
        (target_height - r[1] - r[3]).floor() as i32,
        r[2].ceil() as i32,
        r[3].ceil() as i32,
    ]
}

// JS (webgl2.js `_readPixels`): the vertical flip —
// `for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);`
pub fn flip_rows_vertical(buf: &[u8], w: i32, h: i32) -> Vec<u8> {
    let stride = (w * 4) as usize;
    let mut out = vec![0u8; buf.len()];
    for y in 0..h as usize {
        let src = (h as usize - 1 - y) * stride;
        out[y * stride..(y + 1) * stride].copy_from_slice(&buf[src..src + stride]);
    }
    out
}

// JS: `function same16(a, b)` — the uniform-cache comparison. `!==` on floats
// means NaN never matches, which the program caches rely on (they start
// NaN-filled so the first draw always uploads).
pub fn same16(a: &[f32; 16], b: &[f32; 16]) -> bool {
    for i in 0..16 {
        if a[i] != b[i] {
            return false;
        }
    }
    true
}

// JS: `const toU8 = (d) => (d instanceof Uint8Array ? d : new Uint8Array(d.buffer, d.byteOffset, d.byteLength));`
// The Rust host layer hands the port byte views, so this is the identity; the
// byte reinterpretation of other typed-array views stays in the host.
pub fn to_u8(d: &[u8]) -> &[u8] {
    d
}

// JS (webgl2.js `_ensureQuads`): `let cap = Math.max(this.quadCapacity * 2, 1024); while (cap < quads) cap *= 2;`
// Only called once `quads > quadCapacity` has failed the early return.
pub fn grow_quad_capacity(current: f64, quads: f64) -> f64 {
    let mut cap = (current * 2.0).max(1024.0);
    while cap < quads {
        cap *= 2.0;
    }
    cap
}

// ---------------------------------------------------------------------------
// Final pass uniforms (createFinalShaderPass)
// ---------------------------------------------------------------------------

// JS (render/shader-frame.js): `export const FINAL_UNIFORMS = new Set('...'.split(' '));`
// Re-hosted here because webgl2.js validates final-pass uniforms against it;
// shader-frame.js gets its own port for the value computation.
pub const FINAL_UNIFORMS: [&str; 32] = [
    "viewWidth",
    "viewHeight",
    "aspectRatio",
    "frameTimeCounter",
    "frameTime",
    "worldTime",
    "frameCounter",
    "isEyeInWater",
    "screenBrightness",
    "rainStrength",
    "eyeBrightnessSmooth",
    "GRAVRUSTEyeBrightness",
    "sunAngle",
    "gbufferModelView",
    "gbufferModelViewInverse",
    "blindness",
    "sprintingSmooth",
    "sneakSmooth",
    "burningSmooth",
    "rainStrengthS",
    "rainStrengthS2",
    "biomeHasRainSmooth",
    "biomeisNotColdSmooth",
    "biomeHasHeatSmooth",
    "biomeHasHeatSmooth2",
    "biomeHasHeatSmooth3",
    "moonPhase",
    "wetness",
    "isEyeInCave",
    "nightVision",
    "starter",
    "touchmybody",
];

// JS: `const supported = FINAL_UNIFORMS;` … `!supported.has(u.name)`
pub fn is_final_uniform(name: &str) -> bool {
    FINAL_UNIFORMS.contains(&name)
}

// JS (createFinalShaderPass): the only scene-buffer samplers a final pass may use —
// `['colortex0','colortex1','colortex4','noisetex','gcolor','composite']`
pub const FINAL_PASS_SAMPLERS: [&str; 6] = ["colortex0", "colortex1", "colortex4", "noisetex", "gcolor", "composite"];

/// JS: a uniform value as uploaded by the final-pass draw closure. The variant
/// mirrors the gl.uniform* dispatch (`FLOAT -> uniform1f`, `INT_VEC2 ->
/// uniform2iv`, `FLOAT_VEC2 -> uniform2fv`, `FLOAT_VEC3 -> uniform3fv`,
/// `FLOAT_MAT4 -> uniformMatrix4fv`, everything else -> `uniform1i`).
#[derive(Clone, Debug, PartialEq)]
pub enum UniformValue {
    F32(f32),
    I32(i32),
    I32Vec2([i32; 2]),
    F32Vec2([f32; 2]),
    F32Vec3([f32; 3]),
    Mat4([f32; 16]),
}

/// JS: `frame.uniforms?.[u.name]` / `values[u.name]` / `defaults[u.name]` maps.
pub type FrameUniformValues = HashMap<String, UniformValue>;

/// JS: the `frame` argument of the final-pass draw closure.
#[derive(Clone, Debug, Default)]
pub struct FinalFrameInfo {
    pub time: f32,          // JS: frame.time
    pub delta: f32,         // JS: frame.delta
    pub world_time: f32,    // JS: frame.worldTime
    pub frame: i32,         // JS: frame.frame
    pub underwater: bool,   // JS: frame.underwater
    pub gamma: f32,         // JS: frame.gamma
    pub rain: Option<f32>,  // JS: frame.rain || 0
    pub uniforms: Option<FrameUniformValues>, // JS: frame.uniforms
}

// JS (createFinalShaderPass draw closure):
// `const values = { viewWidth: this.width, viewHeight: this.height, aspectRatio: this.width / this.height,
//   frameTimeCounter: frame.time, frameTime: frame.delta, worldTime: frame.worldTime, frameCounter: frame.frame,
//   isEyeInWater: frame.underwater ? 1 : 0, screenBrightness: frame.gamma, rainStrength: frame.rain || 0 };`
pub fn final_pass_values(width: i32, height: i32, frame: &FinalFrameInfo) -> FrameUniformValues {
    let mut values = FrameUniformValues::new();
    values.insert("viewWidth".to_string(), UniformValue::F32(width as f32));
    values.insert("viewHeight".to_string(), UniformValue::F32(height as f32));
    values.insert("aspectRatio".to_string(), UniformValue::F32(width as f32 / height as f32));
    values.insert("frameTimeCounter".to_string(), UniformValue::F32(frame.time));
    values.insert("frameTime".to_string(), UniformValue::F32(frame.delta));
    values.insert("worldTime".to_string(), UniformValue::F32(frame.world_time));
    values.insert("frameCounter".to_string(), UniformValue::I32(frame.frame));
    values.insert("isEyeInWater".to_string(), UniformValue::I32(if frame.underwater { 1 } else { 0 }));
    values.insert("screenBrightness".to_string(), UniformValue::F32(frame.gamma));
    values.insert("rainStrength".to_string(), UniformValue::F32(frame.rain.unwrap_or(0.0)));
    values
}

// JS (createFinalShaderPass): the `gl.UNIFORM_*` type of an active uniform, mapped
// from `u.type` (compared against gl.SAMPLER_2D / gl.FLOAT / gl.INT / gl.BOOL /
// gl.INT_VEC2 / gl.FLOAT_VEC2 / gl.FLOAT_VEC3 / gl.FLOAT_MAT4 in webgl2.js).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FinalUniformKind {
    Float,
    Int,
    Bool,
    IntVec2,
    FloatVec2,
    FloatVec3,
    Mat4,
    Sampler2D,
}

// JS (createFinalShaderPass): the uniform validation chain —
//   `if(u.size!==1)throw Error('Final-pass uniform arrays are unsupported: '+u.name);`
//   `if(u.type===gl.SAMPLER_2D){if(!['colortex0','colortex1','colortex4','noisetex','gcolor','composite'].includes(u.name))throw Error('Final pass needs an unavailable scene buffer: '+u.name);}`
//   `else if(!supported.has(u.name)||![gl.FLOAT,gl.INT,gl.BOOL,gl.INT_VEC2,gl.FLOAT_VEC2,gl.FLOAT_VEC3,gl.FLOAT_MAT4].includes(u.type))throw Error('Unsupported final-pass uniform: '+u.name);`
// (a `u.type` outside all eight known enums fails the third arm with the same message)
pub fn validate_final_uniform(name: &str, size: i32, kind: FinalUniformKind) -> Result<(), String> {
    if size != 1 {
        return Err(format!("Final-pass uniform arrays are unsupported: {}", name));
    }
    if kind == FinalUniformKind::Sampler2D {
        if !FINAL_PASS_SAMPLERS.contains(&name) {
            return Err(format!("Final pass needs an unavailable scene buffer: {}", name));
        }
        return Ok(());
    }
    if !FINAL_UNIFORMS.contains(&name) {
        return Err(format!("Unsupported final-pass uniform: {}", name));
    }
    Ok(())
}

// JS (createFinalShaderPass draw closure): the value chain —
// `frame.uniforms?.[u.name] ?? values[u.name] ?? defaults[u.name]` (`??` keeps 0/false;
// only null/undefined fall through, which `HashMap::get` models exactly).
pub fn resolve_final_uniform(
    frame: &FinalFrameInfo,
    name: &str,
    values: &FrameUniformValues,
    defaults: Option<&FrameUniformValues>,
) -> Option<UniformValue> {
    if let Some(uniforms) = &frame.uniforms {
        if let Some(v) = uniforms.get(name) {
            return Some(v.clone());
        }
    }
    if let Some(v) = values.get(name) {
        return Some(v.clone());
    }
    if let Some(defaults) = defaults {
        if let Some(v) = defaults.get(name) {
            return Some(v.clone());
        }
    }
    None
}

// JS (draw): `const animation = pack && (d.pipeline === 'terrain' || pack.programs?.[d.pipeline]
//   && (d.pipeline !== 'entity' || params[11] < 1.5)) ? pack : null;`
// `pack_present` is `this.terrainAnimation` truthiness, `pack_has_pipeline_program` is
// `pack.programs?.[d.pipeline]` truthiness, `params[11]` is the entity lighting mode
// (0 world, 1 none, 2 GUI — the pack never replaces a GUI-lit entity draw).
pub fn animation_pack_used(pipeline: &str, pack_present: bool, pack_has_pipeline_program: bool, params: &[f32; 16]) -> bool {
    if !pack_present {
        return false;
    }
    if pipeline == "terrain" {
        return true;
    }
    if !pack_has_pipeline_program {
        return false;
    }
    if pipeline != "entity" {
        return true;
    }
    params[11] < 1.5
}

// ---------------------------------------------------------------------------
// wasm-bindgen exports (pure kernels callable from the JS glue)
// ---------------------------------------------------------------------------

// JS: the fogFactor GLSL helper in HEADER.
#[wasm_bindgen]
pub fn wasm_fog_factor(d: f32, fog_start: f32, fog_end: f32, fog_density: f32, fog_mode: f32) -> f32 {
    fog_factor(d, &[fog_start, fog_end, fog_density, fog_mode])
}

// JS: the lightmap GLSL helper in HEADER (uv math only).
#[wasm_bindgen]
pub fn wasm_lightmap_uv(x: f32, y: f32) -> Vec<f32> {
    lightmap_uv([x, y]).to_vec()
}

// JS (device.js): `export function quadIndices(quads)`.
#[wasm_bindgen]
pub fn wasm_quad_indices(quads: u32) -> Vec<u32> {
    quad_indices(quads as usize)
}

// JS (terrain vs): the position decode `aPos.xyz * (65535.0 / 2048.0) - 8.0`.
#[wasm_bindgen]
pub fn wasm_decode_terrain_position(x: f32, y: f32, z: f32, w: f32) -> Vec<f32> {
    decode_terrain_position([x, y, z, w]).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fog_factor_matches_the_glsl_header() {
        // linear (mode 0): clamp((d - start) / max(0.0001, end - start))
        assert_eq!(fog_factor(100.0, &[0.0, 200.0, 0.0, 0.0]), 0.5);
        assert_eq!(fog_factor(-5.0, &[0.0, 200.0, 0.0, 0.0]), 0.0);
        assert_eq!(fog_factor(250.0, &[0.0, 200.0, 0.0, 0.0]), 1.0);
        // mode 2 (none) -> 0
        assert_eq!(fog_factor(100.0, &[0.0, 200.0, 0.0, 2.0]), 0.0);
        // anything in (1.5, 2.5) is "none"
        assert_eq!(fog_factor(100.0, &[0.0, 200.0, 0.0, 2.2]), 0.0);
        // mode 1 (exp): 1 - exp(-density * d); density 0.1, d 10 -> 1 - e^-1
        let v = fog_factor(10.0, &[0.0, 0.0, 0.1, 1.0]);
        assert!((v - (1.0 - (-1.0f32).exp())).abs() < 1e-6, "{}", v);
        // mode 3 (exp2): 1 - exp(-(density * d)^2); density 0.2, d 10 -> 1 - e^-4
        let v2 = fog_factor(10.0, &[0.0, 0.0, 0.2, 3.0]);
        assert!((v2 - (1.0 - (-4.0f32).exp())).abs() < 1e-6, "{}", v2);
        // d = 0 never fogs
        assert_eq!(fog_factor(0.0, &[0.0, 200.0, 0.1, 3.0]), 0.0);
    }

    #[test]
    fn lightmap_uv_swaps_and_offsets_the_components() {
        assert_eq!(lightmap_uv([13.0, 7.0]), [0.46875, 0.84375]);
        assert_eq!(lightmap_uv([0.0, 0.0]), [0.03125, 0.03125]);
    }

    #[test]
    fn terrain_positions_decode_from_the_unorm16_grid() {
        // 65535 / 2048 = 31.99951171875
        let p = decode_terrain_position([1.0, 0.0, 0.5, 0.0]);
        assert!((p[0] - (65535.0f32 / 2048.0 - 8.0)).abs() < 1e-6);
        assert_eq!(p[1], -8.0);
        assert!((p[2] - (0.5 * 65535.0f32 / 2048.0 - 8.0)).abs() < 1e-6);
    }

    #[test]
    fn quad_indices_make_two_ccw_triangles_per_quad() {
        assert_eq!(quad_indices(2), vec![0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
        assert!(quad_indices(0).is_empty());
    }

    #[test]
    fn build_mips_box_filters_with_alpha_weighting() {
        // 2x2 of one colour -> 1x1 of the same colour
        let px = [10u8, 20, 30, 255].repeat(4);
        let mips = build_mips(2, 2, &px, 4);
        assert_eq!(mips.len(), 1);
        assert_eq!((mips[0].width, mips[0].height), (1, 1));
        assert_eq!(mips[0].data, vec![10, 20, 30, 255]);

        // transparent + opaque: colour is alpha-weighted, alpha is the average
        // (Uint8Array stores truncate: 255 / 2 = 127.5 -> 127)
        let px2 = [0u8, 0, 0, 0, 255, 255, 255, 255];
        let mips2 = build_mips(2, 1, &px2, 4);
        assert_eq!(mips2.len(), 1);
        assert_eq!(mips2[0].data, vec![255, 255, 255, 127]);

        // maxLevels caps the chain length
        let px4 = [9u8, 9, 9, 255].repeat(16);
        let mips3 = build_mips(4, 4, &px4, 1);
        assert_eq!(mips3.len(), 1);
        assert_eq!((mips3[0].width, mips3[0].height), (2, 2));

        // maxLevels 0 -> no mips; 1x1 sources never grow
        assert!(build_mips(4, 4, &px4, 0).is_empty());
        assert!(build_mips(1, 1, &[1, 2, 3, 4], 4).is_empty());
    }

    #[test]
    fn quad_capacity_doubles_from_1024() {
        assert_eq!(grow_quad_capacity(0.0, 1000.0), 1024.0);
        assert_eq!(grow_quad_capacity(0.0, 1024.0), 1024.0);
        assert_eq!(grow_quad_capacity(0.0, 65536.0), 65536.0);
        assert_eq!(grow_quad_capacity(0.0, 70000.0), 131072.0);
        assert_eq!(grow_quad_capacity(32768.0, 40000.0), 65536.0);
    }

    #[test]
    fn same16_treats_nan_as_unequal_like_js() {
        let nan16 = [f32::NAN; 16];
        assert!(!same16(&nan16, &nan16)); // program caches start NaN-filled => first draw uploads
        let a = [1.0f32; 16];
        assert!(same16(&a, &a));
        let mut b = a;
        b[7] = 2.0;
        assert!(!same16(&a, &b));
    }

    #[test]
    fn state_key_concatenates_exactly_like_the_js() {
        assert_eq!(state_key(&EMPTY_STATE), "none1100");
        let mut alpha_cull = DrawState::default();
        alpha_cull.blend = Some(BlendMode::Alpha);
        alpha_cull.cull = Some(true);
        // JS: 'alpha' + depthTest 1 + depthWrite 1 + cull 1 + polygonOffset 0.
        assert_eq!(state_key(&alpha_cull), "alpha1110");
        let mut s = DrawState::default();
        s.depth_test = Some(false);
        s.polygon_offset = Some(true);
        s.depth_func = Some(DepthFunc::Equal);
        s.color_write = Some(false);
        assert_eq!(state_key(&s), "none0101en");
        let mut additive = DrawState::default();
        additive.blend = Some(BlendMode::Add);
        assert_eq!(state_key(&additive), "add1100");
    }

    #[test]
    fn scissor_flips_y_into_the_bottom_left_origin() {
        // r = [x, y, w, h] top-left; th = target height
        assert_eq!(scissor_rect(&[10.6, 3.2, 20.3, 30.7], 600.0), [10, 566, 21, 31]);
        assert_eq!(scissor_rect(&[0.0, 0.0, 100.0, 100.0], 100.0), [0, 0, 100, 100]);
    }

    #[test]
    fn readback_flips_rows_to_top_left_origin() {
        let buf = [1u8, 1, 1, 1, 2, 2, 2, 2];
        assert_eq!(flip_rows_vertical(&buf, 1, 2), vec![2, 2, 2, 2, 1, 1, 1, 1]);
        assert!(flip_rows_vertical(&[], 0, 0).is_empty());
    }

    #[test]
    fn vertex_layout_matches_the_device_formats() {
        let terrain = vertex_layout(&FORMAT_TERRAIN);
        assert_eq!(terrain.byte_stride, 20);
        assert_eq!(terrain.attrs.len(), 4);
        assert_eq!(terrain.attrs[0], LayoutAttr { size: 4, byte_offset: 0, ty: AttributeType::Unorm16 });
        assert_eq!(terrain.attrs[1], LayoutAttr { size: 2, byte_offset: 8, ty: AttributeType::Unorm16 });
        assert_eq!(terrain.attrs[2], LayoutAttr { size: 4, byte_offset: 12, ty: AttributeType::Unorm8 });
        assert_eq!(terrain.attrs[3], LayoutAttr { size: 2, byte_offset: 16, ty: AttributeType::Unorm8 });

        let color = vertex_layout(&FORMAT_COLOR);
        assert_eq!(color.byte_stride, 36); // stride 9 floats * 4
        assert_eq!(color.attrs[1].byte_offset, 12); // uv at float offset 3
        assert!(color.attrs.iter().all(|a| a.ty == AttributeType::F32));

        let entity = vertex_layout(&FORMAT_ENTITY);
        assert_eq!(entity.attrs.len(), 4);
        assert_eq!(entity.attrs[2], LayoutAttr { size: 3, byte_offset: 20, ty: AttributeType::F32 });
    }

    #[test]
    fn pipeline_format_maps_endportal_and_post_to_color() {
        for (name, format) in PIPELINE_FORMAT {
            let expected = match name {
                "terrain" => &FORMAT_TERRAIN,
                "lit" => &FORMAT_LIT,
                "entity" => &FORMAT_ENTITY,
                _ => &FORMAT_COLOR,
            };
            assert!(std::ptr::eq(format, expected), "{}", name);
        }
    }

    #[test]
    fn default_params_match_device_js() {
        let terrain = default_params("terrain").unwrap();
        assert_eq!(&terrain[0..3], &[0.0, 1.0, 0.0]); // alphaTest, opacity, mipBias
        assert_eq!(default_params("lit").unwrap(), [0.0; 16]);
        assert_eq!(
            default_params("entity").unwrap(),
            [1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 15.0, 15.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        );
        let color = default_params("color").unwrap();
        assert_eq!(&color[0..4], &[1.0, 1.0, 1.0, 1.0]);
        assert_eq!(default_params("endportal").unwrap(), [0.0; 16]);
        let post = default_params("post").unwrap();
        assert_eq!(&post[0..8], &[0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0]);
        assert_eq!(default_params("unknown"), None);
    }

    #[test]
    fn final_uniform_names_match_shader_frame_js() {
        assert_eq!(FINAL_UNIFORMS.len(), 32);
        assert!(is_final_uniform("viewWidth"));
        assert!(is_final_uniform("touchmybody"));
        assert!(!is_final_uniform("gdepth"));
        assert!(!is_final_uniform("customThing"));
    }

    #[test]
    fn final_pass_values_fill_the_js_shape() {
        let frame = FinalFrameInfo {
            time: 2.0,
            delta: 0.016,
            world_time: 12000.0,
            frame: 42,
            underwater: true,
            gamma: 0.8,
            rain: None,
            uniforms: None,
        };
        let values = final_pass_values(800, 600, &frame);
        assert_eq!(values["viewWidth"], UniformValue::F32(800.0));
        assert_eq!(values["viewHeight"], UniformValue::F32(600.0));
        assert_eq!(values["aspectRatio"], UniformValue::F32(800.0 / 600.0));
        assert_eq!(values["frameTimeCounter"], UniformValue::F32(2.0));
        assert_eq!(values["frameTime"], UniformValue::F32(0.016));
        assert_eq!(values["worldTime"], UniformValue::F32(12000.0));
        assert_eq!(values["frameCounter"], UniformValue::I32(42));
        assert_eq!(values["isEyeInWater"], UniformValue::I32(1));
        assert_eq!(values["screenBrightness"], UniformValue::F32(0.8));
        assert_eq!(values["rainStrength"], UniformValue::F32(0.0));
        assert_eq!(values.len(), 10);
    }

    #[test]
    fn final_uniform_validation_reproduces_the_js_errors() {
        assert!(validate_final_uniform("viewWidth", 1, FinalUniformKind::Float).is_ok());
        assert!(validate_final_uniform("touchmybody", 1, FinalUniformKind::Int).is_ok());
        // sampler whitelist (createFinalShaderPass)
        assert!(validate_final_uniform("colortex0", 1, FinalUniformKind::Sampler2D).is_ok());
        assert!(validate_final_uniform("noisetex", 1, FinalUniformKind::Sampler2D).is_ok());
        // size !== 1 is checked first
        assert_eq!(
            validate_final_uniform("frameCounter", 2, FinalUniformKind::Int).unwrap_err(),
            "Final-pass uniform arrays are unsupported: frameCounter"
        );
        assert_eq!(
            validate_final_uniform("gdepth", 1, FinalUniformKind::Sampler2D).unwrap_err(),
            "Final pass needs an unavailable scene buffer: gdepth"
        );
        assert_eq!(
            validate_final_uniform("customThing", 1, FinalUniformKind::Float).unwrap_err(),
            "Unsupported final-pass uniform: customThing"
        );
    }

    #[test]
    fn resolve_final_uniform_prefers_frame_then_values_then_defaults() {
        let mut frame = FinalFrameInfo::default();
        let mut uniforms = FrameUniformValues::new();
        uniforms.insert("blindness".to_string(), UniformValue::F32(0.5));
        frame.uniforms = Some(uniforms);
        let values = final_pass_values(100, 100, &frame);
        // frame.uniforms wins over the computed values
        assert_eq!(resolve_final_uniform(&frame, "blindness", &values, None), Some(UniformValue::F32(0.5)));
        // computed values fill the rest
        assert_eq!(resolve_final_uniform(&frame, "viewWidth", &values, None), Some(UniformValue::F32(100.0)));
        // defaults (shaderFrameUniforms({})) fill what neither provided
        let mut defaults = FrameUniformValues::new();
        defaults.insert("moonPhase".to_string(), UniformValue::I32(3));
        assert_eq!(resolve_final_uniform(&frame, "moonPhase", &values, Some(&defaults)), Some(UniformValue::I32(3)));
        assert_eq!(resolve_final_uniform(&frame, "gdepth", &values, Some(&defaults)), None);
    }

    #[test]
    fn animation_pack_used_follows_the_js_boolean_logic() {
        let p = [0.0f32; 16];
        // terrain: the pack applies even without a per-pipeline program entry
        assert!(animation_pack_used("terrain", true, false, &p));
        // no pack at all -> never
        assert!(!animation_pack_used("terrain", false, true, &p));
        // non-terrain pipelines need a pack program for that pipeline
        assert!(!animation_pack_used("entity", true, false, &p));
        assert!(!animation_pack_used("lit", true, false, &p));
        // JS: a per-pipeline program entry is enough for non-entity pipelines
        // (params[11] only gates entity draws).
        assert!(animation_pack_used("color", true, true, &p));
        // entity additionally requires lighting mode params[11] < 1.5 (not GUI lighting)
        assert!(animation_pack_used("entity", true, true, &p));
        let mut gui = p;
        gui[11] = 2.0;
        assert!(!animation_pack_used("entity", true, true, &gui));
        let mut none_lighting = p;
        none_lighting[11] = 1.0;
        assert!(animation_pack_used("entity", true, true, &none_lighting));
        // lit: only the pack-program requirement
        assert!(animation_pack_used("lit", true, true, &p));
    }
}
