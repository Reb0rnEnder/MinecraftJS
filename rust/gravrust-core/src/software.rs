//! Port of `client/js/gfx/software.js`.
//!
//! CPU software rasteriser implementing the graphics-device contract from
//! `client/js/gfx/device.js`: a `Uint32` colour buffer plus a `Float32` depth
//! buffer, the four fixed shading pipelines, blend modes, depth testing, a
//! scissor rectangle, render targets, and the vanilla post-processing
//! programs of the 1.8 "Super Secret Settings".
//!
//! Ported here (pure maths / state / tables):
//!   * packed colour maths (`pack_color`), 4x4 matrix multiply (`mul4`)
//!   * vertex-format decoding into the unified float layout (`decode_vertices`)
//!   * box-filtered (alpha weighted) mip chain construction (`Texture::upload`)
//!   * per-vertex lighting / tint / fog folding into `texel * mul + add`
//!   * per-vertex lightmap table (16x16 bilinear, rebuilt on version change)
//!   * near-plane Sutherland-Hodgman clipping, edge-function triangle
//!     rasterisation, perspective-correct uv, mip selection, blend modes
//!   * `GL_LINES` 1-pixel line rasterisation
//!   * the whole post-processing pass (`post_pass`, programs 0..=16)
//!
//! Left in JavaScript (browser-bound, not algorithmic): the 2D canvas context
//! and `ImageData` / `putImageData` presentation, texture fetching and
//! decoding, the `capture()` promise plumbing, and the WebGL/WebGPU choice.

use serde_json::Value;
use wasm_bindgen::prelude::*;

/// Unified vertex layout after decoding any format: x y z | u v | r g b a | sky block | nx ny nz
pub const V: usize = 14;
/// Transformed vertex: clip x y z w | u v | mul r g b | add r g b | alpha mul
pub const T: usize = 13;
/// Attributes carried per pixel by the rasteriser plane set.
const NA: usize = 11;
/// Lightmap table resolution: 0 .. 15 in steps of 0.25.
const LM_N: usize = 61;
/// terrain position unorm16 scale (see `FORMAT.terrain` / `TERRAIN_POS_SCALE`).
const TERRAIN_POS_SCALE: f64 = 65535.0 / 2048.0;
const DEG_TO_RAD: f64 = 0.0174532925;

/// The identity matrix used when a draw passes no model matrix.
pub const IDENTITY: [f64; 16] = [
    1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
];
const ZERO16: [f64; 16] = [0.0; 16];
const ONE3: [f64; 3] = [1.0, 1.0, 1.0];
/// `RenderHelper.enableGUIStandardItemLighting` directions (already normalised).
const GUI_L0: [f64; 3] = [-0.237910, -0.634435, 0.735453];
const GUI_L1: [f64; 3] = [0.028667, -0.927375, -0.373034];

// ------------------------------------------------------------------ helpers

#[inline]
fn clamp01(v: f64) -> f64 {
    if v < 0.0 {
        0.0
    } else if v > 1.0 {
        1.0
    } else {
        v
    }
}

#[inline]
fn fract(v: f64) -> f64 {
    v - v.floor()
}

/// JavaScript `Math.round` (ties go towards +infinity).
#[inline]
fn js_round(v: f64) -> f64 {
    (v + 0.5).floor()
}

fn norm3(x: f64, y: f64, z: f64) -> [f64; 3] {
    let l = (x * x + y * y + z * z).sqrt();
    if l == 0.0 {
        [x, y, z]
    } else {
        [x / l, y / l, z / l]
    }
}

/// `packColor(r, g, b, a)` -> 0xAABBGGRR.
#[inline]
pub fn pack_color(r: f64, g: f64, b: f64, a: f64) -> u32 {
    let r8 = chan(r);
    let g8 = chan(g);
    let b8 = chan(b);
    let a8 = chan(a);
    ((a8 << 24) | (b8 << 16) | (g8 << 8) | r8) as u32
}

#[inline]
fn chan(v: f64) -> u32 {
    if v <= 0.0 {
        0
    } else if v >= 1.0 {
        255
    } else {
        (v * 255.0 + 0.5) as u32
    }
}

/// `mul4(out, a, b)`: column-major 4x4 matrix product.
pub fn mul4(out: &mut [f64], a: &[f64], b: &[f64]) {
    for i in 0..4 {
        let b0 = b[i * 4];
        let b1 = b[i * 4 + 1];
        let b2 = b[i * 4 + 2];
        let b3 = b[i * 4 + 3];
        out[i * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        out[i * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        out[i * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        out[i * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
}

/// RGBA bytes -> packed little-endian texels (the `Uint32Array` view of JS).
pub fn as_u32(bytes: &[u8]) -> Vec<u32> {
    let n = bytes.len() / 4;
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let o = i * 4;
        out.push(u32::from_le_bytes([bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]]));
    }
    out
}

/// Packed texels -> RGBA bytes (for `ImageData` on the JS side).
pub fn as_u8(px: &[u32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(px.len() * 4);
    for c in px {
        out.extend_from_slice(&c.to_le_bytes());
    }
    out
}

pub fn f32s_to_bytes(d: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(d.len() * 4);
    for v in d {
        out.extend_from_slice(&v.to_le_bytes());
    }
    out
}

// ------------------------------------------------------------ vertex layouts

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum AttrType {
    F32,
    Unorm16,
    Unorm8,
}

#[derive(Clone, Copy, Debug)]
pub struct Attr {
    pub size: u32,
    pub offset: u32,
    pub ty: AttrType,
}

#[derive(Clone, Copy, Debug)]
pub struct Layout {
    pub byte_stride: u32,
    pub attrs: [Attr; 4],
}

const fn at(size: u32, offset: u32, ty: AttrType) -> Attr {
    Attr { size, offset, ty }
}

/// `vertexLayout(FORMAT[name])` from `device.js`.
pub fn vertex_layout(name: &str) -> Layout {
    match name {
        "terrain" => Layout {
            byte_stride: 20,
            attrs: [
                at(4, 0, AttrType::Unorm16),
                at(2, 8, AttrType::Unorm16),
                at(4, 12, AttrType::Unorm8),
                at(2, 16, AttrType::Unorm8),
            ],
        },
        "entity" => Layout {
            byte_stride: 44,
            attrs: [
                at(3, 0, AttrType::F32),
                at(2, 12, AttrType::F32),
                at(3, 20, AttrType::F32),
                at(3, 32, AttrType::F32),
            ],
        },
        "color" => Layout {
            byte_stride: 36,
            attrs: [
                at(3, 0, AttrType::F32),
                at(2, 12, AttrType::F32),
                at(4, 20, AttrType::F32),
                at(4, 20, AttrType::F32),
            ],
        },
        // "lit" is the fallback, matching `FORMAT.lit`
        _ => Layout {
            byte_stride: 44,
            attrs: [
                at(3, 0, AttrType::F32),
                at(2, 12, AttrType::F32),
                at(4, 20, AttrType::F32),
                at(2, 36, AttrType::F32),
            ],
        },
    }
}

fn read_attr(bytes: &[u8], l: &Layout, i: usize, ai: usize, k: usize) -> f64 {
    let a = l.attrs[ai];
    let o = i * l.byte_stride as usize + a.offset as usize;
    match a.ty {
        AttrType::Unorm16 => {
            let p = o + k * 2;
            if p + 2 <= bytes.len() {
                u16::from_le_bytes([bytes[p], bytes[p + 1]]) as f64 / 65535.0
            } else {
                0.0
            }
        }
        AttrType::Unorm8 => {
            let p = o + k;
            if p < bytes.len() {
                bytes[p] as f64 / 255.0
            } else {
                0.0
            }
        }
        AttrType::F32 => {
            let p = o + k * 4;
            if p + 4 <= bytes.len() {
                f32::from_le_bytes([bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]]) as f64
            } else {
                0.0
            }
        }
    }
}

/// `SoftwareDevice.updateMesh`: decode any vertex format into the unified
/// float layout once, so drawing never looks at formats.
pub fn decode_vertices(name: &str, bytes: &[u8]) -> (Vec<f32>, usize) {
    let l = vertex_layout(name);
    let stride = l.byte_stride.max(1) as usize;
    let n = bytes.len() / stride;
    let mut out = vec![0.0f32; n * V];
    for i in 0..n {
        let b = i * V;
        // colour rgb defaults, light defaults and normal defaults as in JS
        out[b + 6] = 1.0;
        out[b + 7] = 1.0;
        out[b + 8] = 1.0;
        out[b + 9] = 1.0;
        out[b + 10] = 15.0;
        out[b + 11] = 15.0;
        match name {
            "terrain" => {
                out[b] = (read_attr(bytes, &l, i, 0, 0) * TERRAIN_POS_SCALE - 8.0) as f32;
                out[b + 1] = (read_attr(bytes, &l, i, 0, 1) * TERRAIN_POS_SCALE - 8.0) as f32;
                out[b + 2] = (read_attr(bytes, &l, i, 0, 2) * TERRAIN_POS_SCALE - 8.0) as f32;
                out[b + 3] = read_attr(bytes, &l, i, 1, 0) as f32;
                out[b + 4] = read_attr(bytes, &l, i, 1, 1) as f32;
                out[b + 5] = read_attr(bytes, &l, i, 2, 0) as f32;
                out[b + 6] = read_attr(bytes, &l, i, 2, 1) as f32;
                out[b + 7] = read_attr(bytes, &l, i, 2, 2) as f32;
                out[b + 8] = 1.0;
                out[b + 9] = (read_attr(bytes, &l, i, 3, 0) * 15.0) as f32;
                out[b + 10] = (read_attr(bytes, &l, i, 3, 1) * 15.0) as f32;
            }
            "entity" => {
                out[b] = read_attr(bytes, &l, i, 0, 0) as f32;
                out[b + 1] = read_attr(bytes, &l, i, 0, 1) as f32;
                out[b + 2] = read_attr(bytes, &l, i, 0, 2) as f32;
                out[b + 3] = read_attr(bytes, &l, i, 1, 0) as f32;
                out[b + 4] = read_attr(bytes, &l, i, 1, 1) as f32;
                out[b + 11] = read_attr(bytes, &l, i, 2, 0) as f32;
                out[b + 12] = read_attr(bytes, &l, i, 2, 1) as f32;
                out[b + 13] = read_attr(bytes, &l, i, 2, 2) as f32;
                out[b + 5] = read_attr(bytes, &l, i, 3, 0) as f32;
                out[b + 6] = read_attr(bytes, &l, i, 3, 1) as f32;
                out[b + 7] = read_attr(bytes, &l, i, 3, 2) as f32;
                out[b + 8] = 1.0;
            }
            _ => {
                out[b] = read_attr(bytes, &l, i, 0, 0) as f32;
                out[b + 1] = read_attr(bytes, &l, i, 0, 1) as f32;
                out[b + 2] = read_attr(bytes, &l, i, 0, 2) as f32;
                out[b + 3] = read_attr(bytes, &l, i, 1, 0) as f32;
                out[b + 4] = read_attr(bytes, &l, i, 1, 1) as f32;
                out[b + 5] = read_attr(bytes, &l, i, 2, 0) as f32;
                out[b + 6] = read_attr(bytes, &l, i, 2, 1) as f32;
                out[b + 7] = read_attr(bytes, &l, i, 2, 2) as f32;
                out[b + 8] = read_attr(bytes, &l, i, 2, 3) as f32;
                if name == "lit" {
                    out[b + 9] = read_attr(bytes, &l, i, 3, 0) as f32;
                    out[b + 10] = read_attr(bytes, &l, i, 3, 1) as f32;
                }
            }
        }
    }
    (out, n)
}

// ------------------------------------------------------------------ textures

#[derive(Clone)]
pub struct MipLevel {
    pub w: u32,
    pub h: u32,
    pub px: Vec<u32>,
}

#[derive(Clone)]
pub struct Texture {
    pub width: u32,
    pub height: u32,
    pub filter: String,
    pub wrap: String,
    pub mip_levels: i32,
    pub version: i64,
    pub u32_px: Vec<u32>,
    pub levels: Vec<MipLevel>,
    /// Set for render targets: index into the device framebuffer list.
    pub rt: Option<usize>,
}

impl Texture {
    /// `createTexture({width, height, filter, wrap, mipmaps})`.
    pub fn create(
        width: u32,
        height: u32,
        filter: &str,
        wrap: &str,
        mipmaps: bool,
        mipmap_levels: i32,
    ) -> Texture {
        let mip_levels = if mipmaps {
            4
        } else {
            mipmap_levels.max(0)
        };
        let n = width as usize * height as usize;
        let u32_px = vec![0u32; n];
        Texture {
            width,
            height,
            filter: filter.to_string(),
            wrap: wrap.to_string(),
            mip_levels,
            version: 0,
            levels: vec![MipLevel {
                w: width,
                h: height,
                px: u32_px.clone(),
            }],
            u32_px,
            rt: None,
        }
    }

    /// `updateTexture(t, data, x, y, w, h)`: upload plus the box-filtered,
    /// alpha-weighted mip chain, rebuilt only over the changed rectangle.
    pub fn upload(&mut self, data: &[u8], x: u32, y: u32, w: u32, h: u32) {
        if self.rt.is_some() || self.width == 0 || self.height == 0 {
            return;
        }
        self.version += 1;
        let src = as_u32(data);
        let full = x == 0 && y == 0 && w == self.width && h == self.height;
        if full {
            let n = (w as usize * h as usize).min(src.len()).min(self.u32_px.len());
            self.u32_px[..n].copy_from_slice(&src[..n]);
        } else {
            for r in 0..h {
                for c in 0..w {
                    let si = (r * w + c) as usize;
                    let di = ((y + r) * self.width + x + c) as usize;
                    if si < src.len() && di < self.u32_px.len() {
                        self.u32_px[di] = src[si];
                    }
                }
            }
        }
        if self.levels.is_empty() || full {
            self.levels = vec![MipLevel {
                w: self.width,
                h: self.height,
                px: self.u32_px.clone(),
            }];
            let (mut pw, mut ph) = (self.width, self.height);
            let mut l = 0;
            while l < self.mip_levels && (pw > 1 || ph > 1) {
                pw = (pw >> 1).max(1);
                ph = (ph >> 1).max(1);
                self.levels.push(MipLevel {
                    w: pw,
                    h: ph,
                    px: vec![0u32; pw as usize * ph as usize],
                });
                l += 1;
            }
        }
        // box-filtered mips weighted by alpha (like buildMips in device.js),
        // only over the changed rectangle
        let (mut x0, mut y0) = (x, y);
        let (mut x1, mut y1) = (x + w, y + h);
        for l in 1..self.levels.len() {
            let (prev, rest) = self.levels.split_at_mut(l);
            let s = &prev[l - 1];
            let d = &mut rest[0];
            x0 >>= 1;
            y0 >>= 1;
            x1 = ((x1 + 1) >> 1).min(d.w);
            y1 = ((y1 + 1) >> 1).min(d.h);
            let (pw, ph, nw) = (s.w, s.h, d.w);
            if pw == 0 || ph == 0 || nw == 0 || d.h == 0 {
                continue;
            }
            for yy in y0..y1 {
                for xx in x0..x1 {
                    let mut r: u32 = 0;
                    let mut g: u32 = 0;
                    let mut b: u32 = 0;
                    let mut a: u32 = 0;
                    for dy in 0..2u32 {
                        for dx in 0..2u32 {
                            let sy = (yy * 2 + dy).min(ph - 1) as usize;
                            let sx = (xx * 2 + dx).min(pw - 1) as usize;
                            let c = match s.px.get(sy * pw as usize + sx) {
                                Some(c) => *c,
                                None => 0,
                            };
                            let al = c >> 24;
                            r += (c & 255) * al;
                            g += ((c >> 8) & 255) * al;
                            b += ((c >> 16) & 255) * al;
                            a += al;
                        }
                    }
                    let idx = (yy * nw + xx) as usize;
                    if idx >= d.px.len() {
                        continue;
                    }
                    d.px[idx] = if a != 0 {
                        ((a >> 2) << 24) | ((b / a) << 16) | ((g / a) << 8) | (r / a)
                    } else {
                        0
                    };
                }
            }
        }
    }
}

// -------------------------------------------------------------------- meshes

#[derive(Clone)]
pub struct Mesh {
    pub format: String,
    pub quads: bool,
    pub data: Vec<f32>,
    pub vertex_count: usize,
    pub indices: Vec<u32>,
    pub has_indices: bool,
    pub index_count: usize,
}

impl Mesh {
    pub fn new(format: &str, bytes: &[u8], quads: bool, indices: &[u32]) -> Mesh {
        let mut m = Mesh {
            format: format.to_string(),
            quads,
            data: Vec::new(),
            vertex_count: 0,
            indices: Vec::new(),
            has_indices: false,
            index_count: 0,
        };
        m.update(bytes, None, indices);
        m
    }

    /// `updateMesh(m, vertices, opts)`. `quads_opt` mirrors
    /// `opts.quads !== undefined`; an empty `indices` mirrors a missing array.
    pub fn update(&mut self, bytes: &[u8], quads_opt: Option<bool>, indices: &[u32]) {
        let (data, n) = decode_vertices(&self.format, bytes);
        self.data = data;
        self.vertex_count = n;
        if let Some(q) = quads_opt {
            self.quads = q;
        }
        if !indices.is_empty() {
            self.indices = indices.to_vec();
            self.has_indices = true;
            self.quads = false;
        } else if !self.quads {
            self.indices.clear();
            self.has_indices = false;
        }
        self.index_count = if self.has_indices {
            self.indices.len()
        } else if self.quads {
            (n / 4) * 6
        } else {
            n
        };
    }
}

// ------------------------------------------------------------------- globals

#[derive(Clone)]
pub struct Globals {
    pub view: [f64; 16],
    pub proj: [f64; 16],
    pub fog: [f64; 4],
    pub fog_color: [f64; 3],
    pub lightmap: Option<usize>,
}

impl Default for Globals {
    fn default() -> Self {
        Globals {
            view: [0.0; 16],
            proj: [0.0; 16],
            fog: [0.0, 1.0, 0.0, 2.0],
            fog_color: [0.0, 0.0, 0.0],
            lightmap: None,
        }
    }
}

#[derive(Clone)]
pub struct DrawState {
    pub blend: String,
    pub depth_test: bool,
    pub depth_write: bool,
    pub cull: bool,
    pub polygon_offset: bool,
    pub depth_equal: bool,
    pub color_write: bool,
}

impl Default for DrawState {
    fn default() -> Self {
        DrawState {
            blend: "none".to_string(),
            depth_test: true,
            depth_write: true,
            cull: false,
            polygon_offset: false,
            depth_equal: false,
            color_write: true,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Pipeline {
    Terrain,
    Lit,
    Entity,
    Color,
    EndPortal,
    Post,
}

impl Pipeline {
    pub fn from_name(s: &str) -> Pipeline {
        match s {
            "terrain" => Pipeline::Terrain,
            "lit" => Pipeline::Lit,
            "entity" => Pipeline::Entity,
            "endportal" => Pipeline::EndPortal,
            "post" => Pipeline::Post,
            _ => Pipeline::Color,
        }
    }

    /// `PIPELINE_FORMAT` from `device.js`.
    pub fn format_name(self) -> &'static str {
        match self {
            Pipeline::Terrain => "terrain",
            Pipeline::Lit => "lit",
            Pipeline::Entity => "entity",
            Pipeline::Color | Pipeline::EndPortal | Pipeline::Post => "color",
        }
    }

    /// `DEFAULT_PARAMS` from `device.js`.
    pub fn default_params(self) -> [f64; 16] {
        let mut p = ZERO16;
        match self {
            Pipeline::Terrain => {
                p[0] = 0.0;
                p[1] = 1.0;
            }
            Pipeline::Lit => {
                p[0] = 0.0;
            }
            Pipeline::Entity => {
                // new EntityParams(): tint white, light 15/15, alphaTest 0
                p[0] = 1.0;
                p[1] = 1.0;
                p[2] = 1.0;
                p[3] = 1.0;
                p[8] = 15.0;
                p[9] = 15.0;
                p[12] = 0.0;
            }
            Pipeline::Color => {
                p[0] = 1.0;
                p[1] = 1.0;
                p[2] = 1.0;
                p[3] = 1.0;
            }
            Pipeline::EndPortal => {}
            Pipeline::Post => {
                p[4] = 1.0;
                p[5] = 1.0;
                p[6] = 1.0;
                p[7] = 1.0;
            }
        }
        p
    }
}

// ------------------------------------------------------------- framebuffers

#[derive(Clone)]
pub struct FrameBuffer {
    pub width: u32,
    pub height: u32,
    pub color: Vec<u32>,
    pub depth: Vec<f32>,
}

impl FrameBuffer {
    /// `_buffers(w, h)`: colour zeroed, depth zeroed (filled with 1 on clear).
    pub fn new(w: u32, h: u32) -> FrameBuffer {
        let n = w as usize * h as usize;
        FrameBuffer {
            width: w,
            height: h,
            color: vec![0u32; n],
            depth: vec![0.0f32; n],
        }
    }

    pub fn clear_color(&mut self, c: u32) {
        for p in self.color.iter_mut() {
            *p = c;
        }
    }

    pub fn clear_depth(&mut self) {
        for d in self.depth.iter_mut() {
            *d = 1.0;
        }
    }
}

// ------------------------------------------------------------------ lightmap

/// `lightmap(vec2(sky, block))` source pixels.
pub struct LmSrc<'a> {
    pub id: usize,
    pub version: i64,
    pub w: u32,
    pub h: u32,
    pub px: &'a [u32],
}

/// Per-vertex lightmap lookup table, rebuilt when the texture (or its
/// version) changes, exactly like the JS module-level `lmTable`/`lmTex`.
pub struct LightmapCache {
    pub table: Vec<f32>,
    pub tex_id: Option<usize>,
    pub version: i64,
}

impl LightmapCache {
    pub fn new() -> LightmapCache {
        LightmapCache {
            table: Vec::new(),
            tex_id: None,
            version: -1,
        }
    }

    /// `buildLightmapTable(tex)`: 16 x 16 lightmap bilinear, sampled in
    /// quarter steps.
    pub fn build(&mut self, src: &LmSrc) {
        if self.table.len() != LM_N * LM_N * 3 {
            self.table = vec![0.0f32; LM_N * LM_N * 3];
        }
        let (w, h) = (src.w, src.h);
        if w == 0 || h == 0 || src.px.is_empty() {
            for v in self.table.iter_mut() {
                *v = 1.0;
            }
            self.tex_id = Some(src.id);
            self.version = src.version;
            return;
        }
        for sy in 0..LM_N {
            for bx in 0..LM_N {
                let fx = ((bx as f64) / 4.0).min((w - 1) as f64);
                let fy = ((sy as f64) / 4.0).min((h - 1) as f64);
                let x0 = fx as u32;
                let y0 = fy as u32;
                let x1 = (x0 + 1).min(w - 1);
                let y1 = (y0 + 1).min(h - 1);
                let tx = fx - x0 as f64;
                let ty = fy - y0 as f64;
                let get = |x: u32, y: u32| -> u32 {
                    let i = y as usize * w as usize + x as usize;
                    src.px.get(i).copied().unwrap_or(0)
                };
                let c00 = get(x0, y0);
                let c10 = get(x1, y0);
                let c01 = get(x0, y1);
                let c11 = get(x1, y1);
                let o = (sy * LM_N + bx) * 3;
                for k in 0..3 {
                    let sh = k as u32 * 8;
                    let a = ((c00 >> sh) & 255) as f64 * (1.0 - tx)
                        + ((c10 >> sh) & 255) as f64 * tx;
                    let b = ((c01 >> sh) & 255) as f64 * (1.0 - tx)
                        + ((c11 >> sh) & 255) as f64 * tx;
                    self.table[o + k] = ((a * (1.0 - ty) + b * ty) / 255.0) as f32;
                }
            }
        }
        self.tex_id = Some(src.id);
        self.version = src.version;
    }

    /// `lightmap(tex, sky, block)`: 1,1,1 when there is no lightmap texture.
    pub fn sample(&mut self, src: Option<&LmSrc>, sky: f64, block: f64) -> [f64; 3] {
        let src = match src {
            Some(s) if !s.px.is_empty() && s.w > 0 && s.h > 0 => s,
            _ => return ONE3,
        };
        if self.tex_id != Some(src.id) || self.version != src.version {
            self.build(src);
        }
        let mut si = (sky * 4.0 + 0.5) as i64;
        let mut bi = (block * 4.0 + 0.5) as i64;
        si = si.clamp(0, LM_N as i64 - 1);
        bi = bi.clamp(0, LM_N as i64 - 1);
        let o = (si as usize * LM_N + bi as usize) * 3;
        if o + 2 >= self.table.len() {
            return ONE3;
        }
        [
            self.table[o] as f64,
            self.table[o + 1] as f64,
            self.table[o + 2] as f64,
        ]
    }
}

impl Default for LightmapCache {
    fn default() -> Self {
        LightmapCache::new()
    }
}

// -------------------------------------------------------- rasteriser context

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Blend {
    None,
    Alpha,
    Add,
    Invert,
    Darken,
    Multiply,
}

impl Blend {
    fn from_name(s: &str) -> Blend {
        match s {
            "alpha" => Blend::Alpha,
            "add" => Blend::Add,
            "invert" => Blend::Invert,
            "darken" => Blend::Darken,
            "multiply" => Blend::Multiply,
            _ => Blend::None,
        }
    }
}

struct RasterCtx {
    alpha_test: f64,
    test_final: bool,
    mip_bias: f64,
    blend: Blend,
    depth_test: bool,
    depth_write: bool,
    depth_equal: bool,
    color_write: bool,
    offset: f64,
    repeat: bool,
    portal: bool,
    params: [f64; 16],
    opaque_out: bool,
    min_x: i64,
    min_y: i64,
    max_x: i64,
    max_y: i64,
}

struct LevelRef<'a> {
    w: u32,
    h: u32,
    px: &'a [u32],
}

/// A texture resolved to sampleable pixel levels (render targets read live).
struct TexRef<'a> {
    width: u32,
    height: u32,
    repeat: bool,
    levels: Vec<LevelRef<'a>>,
}

fn tex_ref<'a>(t: &'a Texture, fbs: &'a [FrameBuffer]) -> TexRef<'a> {
    let (width, height, levels) = match t.rt {
        Some(i) => match fbs.get(i) {
            Some(f) => (
                f.width,
                f.height,
                vec![LevelRef {
                    w: f.width,
                    h: f.height,
                    px: f.color.as_slice(),
                }],
            ),
            None => (t.width, t.height, Vec::new()),
        },
        None => (
            t.width,
            t.height,
            t.levels
                .iter()
                .map(|l| LevelRef {
                    w: l.w,
                    h: l.h,
                    px: l.px.as_slice(),
                })
                .collect(),
        ),
    };
    TexRef {
        width,
        height,
        repeat: t.wrap == "repeat",
        levels,
    }
}

// -------------------------------------------------------------- per-vertex

#[allow(clippy::too_many_arguments)]
fn transform_vertices(
    mesh: &Mesh,
    v0: usize,
    v1: usize,
    pipe: Pipeline,
    params: &[f64; 16],
    tv: &mut Vec<f64>,
    mvp: &[f64; 16],
    mv: &[f64; 16],
    globals: &Globals,
    model: &[f64; 16],
    lm: Option<&LmSrc>,
    lmcache: &mut LightmapCache,
) {
    let need = v1 * T;
    if tv.len() < need {
        tv.resize(need, 0.0);
    }
    let src = &mesh.data;
    let fog = globals.fog;
    let fc = globals.fog_color;
    let mut er = 1.0f64;
    let mut eg = 1.0f64;
    let mut eb = 1.0f64;
    let mut ea = 1.0f64;
    let mut o_r = 0.0f64;
    let mut o_g = 0.0f64;
    let mut o_b = 0.0f64;
    let mut o_a = 0.0f64;
    let mut lr = 1.0f64;
    let mut lg = 1.0f64;
    let mut lb = 1.0f64;
    let mut light_mode = 0.0f64;
    if pipe == Pipeline::Entity {
        er = params[0];
        eg = params[1];
        eb = params[2];
        ea = params[3];
        o_r = params[4];
        o_g = params[5];
        o_b = params[6];
        o_a = params[7];
        if params[10] < 0.5 {
            let c = lmcache.sample(lm, params[8], params[9]);
            lr = c[0];
            lg = c[1];
            lb = c[2];
        }
        light_mode = params[11];
    }
    let terrain_alpha = if pipe == Pipeline::Terrain {
        params[1]
    } else {
        1.0
    };
    let color_use_fog = if pipe == Pipeline::Color {
        params[5] > 0.5
    } else {
        true
    };
    let portal = pipe == Pipeline::EndPortal;
    // entity normals turn with mat3(model)
    let d = model;
    let mut out = std::mem::take(tv);
    for i in v0..v1 {
        let s = i * V;
        let o = i * T;
        if s + 4 > src.len() || o + T > out.len() {
            continue;
        }
        let x = src[s] as f64;
        let y = src[s + 1] as f64;
        let z = src[s + 2] as f64;
        out[o] = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
        out[o + 1] = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
        out[o + 2] = mvp[2] * x + mvp[6] * y + mvp[10] * z + mvp[14];
        out[o + 3] = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
        out[o + 4] = src[s + 3] as f64;
        out[o + 5] = src[s + 4] as f64;
        // eye distance for fog
        let mut f = 0.0f64;
        if (fog[3] < 1.5 || fog[3] > 2.5) && color_use_fog && !portal {
            let ex = mv[0] * x + mv[4] * y + mv[8] * z + mv[12];
            let ey = mv[1] * x + mv[5] * y + mv[9] * z + mv[13];
            let ez = mv[2] * x + mv[6] * y + mv[10] * z + mv[14];
            let dist = (ex * ex + ey * ey + ez * ez).sqrt();
            f = if fog[3] < 0.5 {
                clamp01((dist - fog[0]) / (fog[1] - fog[0]).max(0.0001))
            } else {
                let e = if fog[3] > 2.5 {
                    -((fog[2] * dist) * (fog[2] * dist))
                } else {
                    -fog[2] * dist
                };
                1.0 - clamp01(e.exp())
            };
        }
        let nf = 1.0 - f;
        let mut mr;
        let mut mg;
        let mut mb;
        let mut ar = 0.0f64;
        let mut ag = 0.0f64;
        let mut ab = 0.0f64;
        let am;
        if pipe == Pipeline::Terrain {
            let c = lmcache.sample(lm, src[s + 9] as f64, src[s + 10] as f64);
            mr = src[s + 5] as f64 * c[0];
            mg = src[s + 6] as f64 * c[1];
            mb = src[s + 7] as f64 * c[2];
            am = terrain_alpha;
        } else if pipe == Pipeline::Lit {
            let mut c = ONE3;
            if src[s + 9] >= 0.0 {
                c = lmcache.sample(lm, src[s + 9] as f64, src[s + 10] as f64);
            }
            mr = src[s + 5] as f64 * c[0];
            mg = src[s + 6] as f64 * c[1];
            mb = src[s + 7] as f64 * c[2];
            am = src[s + 8] as f64;
        } else if pipe == Pipeline::Entity {
            // shade from the model-space normal turned by the model matrix
            let nx0 = src[s + 11] as f64;
            let ny0 = src[s + 12] as f64;
            let nz0 = src[s + 13] as f64;
            let mut nx = d[0] * nx0 + d[4] * ny0 + d[8] * nz0;
            let mut ny = d[1] * nx0 + d[5] * ny0 + d[9] * nz0;
            let mut nz = d[2] * nx0 + d[6] * ny0 + d[10] * nz0;
            let nl = {
                let l = (nx * nx + ny * ny + nz * nz).sqrt();
                if l == 0.0 {
                    1.0
                } else {
                    l
                }
            };
            nx /= nl;
            ny /= nl;
            nz /= nl;
            let mut shade = 1.0f64;
            let gui = light_mode > 1.5;
            if !(light_mode > 0.5 && !gui) {
                let (l0, l1) = if gui {
                    (GUI_L0, GUI_L1)
                } else {
                    (norm3(0.2, 1.0, -0.7), norm3(-0.2, 1.0, 0.7))
                };
                shade = (0.4
                    + 0.6
                        * ((nx * l0[0] + ny * l0[1] + nz * l0[2]).max(0.0)
                            + (nx * l1[0] + ny * l1[1] + nz * l1[2]).max(0.0)))
                .min(1.0);
            }
            let k = (1.0 - o_a) * shade;
            mr = er * src[s + 5] as f64 * k * lr;
            mg = eg * src[s + 6] as f64 * k * lg;
            mb = eb * src[s + 7] as f64 * k * lb;
            ar = o_r * o_a * shade * lr;
            ag = o_g * o_a * shade * lg;
            ab = o_b * o_a * shade * lb;
            am = ea;
        } else if pipe == Pipeline::Color {
            mr = src[s + 5] as f64 * params[0];
            mg = src[s + 6] as f64 * params[1];
            mb = src[s + 7] as f64 * params[2];
            am = src[s + 8] as f64 * params[3];
        } else {
            // endportal: colour from params, the uv comes from the screen
            mr = params[0];
            mg = params[1];
            mb = params[2];
            am = 1.0;
        }
        out[o + 6] = mr * nf;
        out[o + 7] = mg * nf;
        out[o + 8] = mb * nf;
        out[o + 9] = ar * nf + fc[0] * f;
        out[o + 10] = ag * nf + fc[1] * f;
        out[o + 11] = ab * nf + fc[2] * f;
        out[o + 12] = am;
    }
    *tv = out;
}

// --------------------------------------------------------------- per-draw

#[allow(clippy::too_many_arguments)]
fn setup_ctx(
    pipe: Pipeline,
    params: &[f64; 16],
    st: &DrawState,
    repeat: bool,
    fb_w: u32,
    fb_h: u32,
    scissor: Option<[i64; 4]>,
    opaque_out: bool,
) -> RasterCtx {
    let alpha_test = match pipe {
        Pipeline::Terrain => params[0],
        Pipeline::Lit => params[0],
        Pipeline::Entity => params[12],
        Pipeline::Color => params[4],
        _ => 0.0,
    };
    let (min_x, min_y, max_x, max_y) = match scissor {
        Some(s) => (
            s[0].max(0),
            s[1].max(0),
            (s[0] + s[2]).min(fb_w as i64),
            (s[1] + s[3]).min(fb_h as i64),
        ),
        None => (0, 0, fb_w as i64, fb_h as i64),
    };
    RasterCtx {
        alpha_test,
        test_final: pipe == Pipeline::Color,
        mip_bias: if pipe == Pipeline::Terrain {
            params[2]
        } else {
            0.0
        },
        blend: Blend::from_name(&st.blend),
        depth_test: st.depth_test,
        depth_write: st.depth_write,
        depth_equal: st.depth_equal,
        color_write: st.color_write,
        offset: if st.polygon_offset { -0.00002 } else { 0.0 },
        repeat,
        portal: pipe == Pipeline::EndPortal,
        params: *params,
        opaque_out,
        min_x,
        min_y,
        max_x,
        max_y,
    }
}

// ---------------------------------------------------------------- triangles

/// `_triangle`: clip against the near plane (z > -w) when needed, then fan.
#[allow(clippy::too_many_arguments)]
fn raster_triangle(
    verts: &[f64],
    a: usize,
    b: usize,
    c: usize,
    clip: &mut Vec<f64>,
    cull: bool,
    ctx: &RasterCtx,
    tex: &TexRef,
    fb: &mut FrameBuffer,
    att: &mut [f64],
) {
    let in_a = verts[a + 2] > -verts[a + 3];
    let in_b = verts[b + 2] > -verts[b + 3];
    let in_c = verts[c + 2] > -verts[c + 3];
    if in_a && in_b && in_c {
        raster_tri(fb, tex, ctx, verts, a, b, c, cull, att);
        return;
    }
    if !in_a && !in_b && !in_c {
        return;
    }
    // Sutherland-Hodgman against one plane, up to 4 output vertices
    let need = T * 8;
    if clip.len() < need {
        clip.resize(need, 0.0);
    }
    let vs = [a, b, c];
    let ins = [in_a, in_b, in_c];
    let mut n = 0usize;
    for i in 0..3 {
        let p = vs[i];
        let q = vs[(i + 1) % 3];
        let pin = ins[i];
        let qin = ins[(i + 1) % 3];
        if pin {
            for k in 0..T {
                clip[n * T + k] = verts[p + k];
            }
            n += 1;
        }
        if pin != qin {
            let dp = verts[p + 2] + verts[p + 3];
            let dq = verts[q + 2] + verts[q + 3];
            let t = dp / (dp - dq);
            for k in 0..T {
                clip[n * T + k] = verts[p + k] + (verts[q + k] - verts[p + k]) * t;
            }
            n += 1;
        }
    }
    for i in 1..n.saturating_sub(1) {
        raster_tri(fb, tex, ctx, clip, 0, i * T, (i + 1) * T, cull, att);
    }
}

/// `_raster`: project one clip-space triangle and walk it.
#[allow(clippy::too_many_arguments)]
fn raster_tri(
    fb: &mut FrameBuffer,
    tex: &TexRef,
    ctx: &RasterCtx,
    verts: &[f64],
    a: usize,
    b: usize,
    c: usize,
    cull: bool,
    att: &mut [f64],
) {
    let w = fb.width as f64;
    let h = fb.height as f64;
    // project
    let wa = 1.0 / verts[a + 3];
    let wb = 1.0 / verts[b + 3];
    let wc = 1.0 / verts[c + 3];
    let x0 = (verts[a] * wa * 0.5 + 0.5) * w;
    let y0 = (0.5 - verts[a + 1] * wa * 0.5) * h;
    let z0 = verts[a + 2] * wa * 0.5 + 0.5;
    let x1 = (verts[b] * wb * 0.5 + 0.5) * w;
    let y1 = (0.5 - verts[b + 1] * wb * 0.5) * h;
    let z1 = verts[b + 2] * wb * 0.5 + 0.5;
    let x2 = (verts[c] * wc * 0.5 + 0.5) * w;
    let y2 = (0.5 - verts[c + 1] * wc * 0.5) * h;
    let z2 = verts[c + 2] * wc * 0.5 + 0.5;
    // signed area (screen y down: counter-clockwise in GL becomes clockwise here)
    let area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if area == 0.0 {
        return;
    }
    if cull && area > 0.0 {
        return;
    }
    let min_x = ctx.min_x.max(x0.min(x1).min(x2).floor() as i64);
    let max_x = (ctx.max_x - 1).min(x0.max(x1).max(x2).ceil() as i64);
    let min_y = ctx.min_y.max(y0.min(y1).min(y2).floor() as i64);
    let max_y = (ctx.max_y - 1).min(y0.max(y1).max(y2).ceil() as i64);
    if min_x > max_x || min_y > max_y {
        return;
    }
    let inv = 1.0 / area;
    // edge function steps (e0 opposite vertex 0, ...)
    let e0dx = (y1 - y2) * inv;
    let e0dy = (x2 - x1) * inv;
    let e1dx = (y2 - y0) * inv;
    let e1dy = (x0 - x2) * inv;
    let e2dx = (y0 - y1) * inv;
    let e2dy = (x1 - x0) * inv;
    let px = min_x as f64 + 0.5;
    let py = min_y as f64 + 0.5;
    // barycentrics at the first pixel centre
    let e0r = ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)) * inv;
    let e1r = ((x0 - x2) * (py - y2) - (y0 - y2) * (px - x2)) * inv;
    let e2r = ((x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)) * inv;
    // attribute planes: value = e0 * v0 + e1 * v1 + e2 * v2
    // [depth, 1 / w, u / w, v / w, mul rgb, add rgb, alpha] x 3 vertices
    if att.len() < NA * 3 {
        return;
    }
    att[0] = z0 + ctx.offset;
    att[1] = z1 + ctx.offset;
    att[2] = z2 + ctx.offset;
    att[3] = wa;
    att[4] = wb;
    att[5] = wc;
    att[6] = verts[a + 4] * wa;
    att[7] = verts[b + 4] * wb;
    att[8] = verts[c + 4] * wc;
    att[9] = verts[a + 5] * wa;
    att[10] = verts[b + 5] * wb;
    att[11] = verts[c + 5] * wc;
    for k in 0..7 {
        att[12 + k * 3] = verts[a + 6 + k];
        att[13 + k * 3] = verts[b + 6 + k];
        att[14 + k * 3] = verts[c + 6 + k];
    }
    // mip level from texel area / pixel area
    if tex.levels.is_empty() {
        return;
    }
    let mut li = 0usize;
    if tex.levels.len() > 1 {
        let u0 = verts[a + 4];
        let v0 = verts[a + 5];
        let u1 = verts[b + 4];
        let v1 = verts[b + 5];
        let u2 = verts[c + 4];
        let v2 = verts[c + 5];
        let ta = ((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)).abs()
            * tex.width as f64
            * tex.height as f64;
        let lod = 0.5 * (ta / area.abs() + 1e-9).log2() + ctx.mip_bias;
        let l = js_round(lod).max(0.0) as usize;
        li = l.min(tex.levels.len() - 1);
    }
    let lvl = &tex.levels[li];
    // nearly constant w: affine texture coordinates are indistinguishable
    let wmin = wa.min(wb).min(wc);
    let wmax = wa.max(wb).max(wc);
    let affine = wmax - wmin < wmin * 0.02;
    raster_loop(
        fb, lvl, ctx, min_x, max_x, min_y, max_y, e0r, e1r, e2r, e0dx, e1dx, e2dx, e0dy, e1dy,
        e2dy, att, affine,
    );
}

/// The pixel loop: per-attribute planes over the screen, one span per row.
#[allow(clippy::too_many_arguments)]
fn raster_loop(
    fb: &mut FrameBuffer,
    lvl: &LevelRef,
    ctx: &RasterCtx,
    min_x: i64,
    max_x: i64,
    min_y: i64,
    max_y: i64,
    e0r: f64,
    e1r: f64,
    e2r: f64,
    e0dx: f64,
    e1dx: f64,
    e2dx: f64,
    e0dy: f64,
    e1dy: f64,
    e2dy: f64,
    a: &[f64],
    affine: bool,
) {
    let fb_w = fb.width as i64;
    let fb_h = fb.height as i64;
    let tw = lvl.w as i64;
    let th = lvl.h as i64;
    if tw == 0 || th == 0 || fb_w == 0 || fb_h == 0 {
        return;
    }
    let px_src = lvl.px;
    let repeat = ctx.repeat;
    let alpha_test = ctx.alpha_test;
    let test_final = ctx.test_final;
    let blend = ctx.blend;
    let depth_test = ctx.depth_test;
    let depth_write = ctx.depth_write;
    let depth_equal = ctx.depth_equal;
    let color_write = ctx.color_write;
    let opaque_out = ctx.opaque_out;
    let portal = ctx.portal;
    let p = &ctx.params;
    let no_blend = blend == Blend::None;
    let depth_less = depth_test && !depth_equal;

    let mut plane = [0.0f64; NA * 3];
    for k in 0..NA {
        let a0 = a[k * 3];
        let a1 = a[k * 3 + 1];
        let a2 = a[k * 3 + 2];
        plane[k * 3] = e0r * a0 + e1r * a1 + e2r * a2;
        plane[k * 3 + 1] = e0dx * a0 + e1dx * a1 + e2dx * a2;
        plane[k * 3 + 2] = e0dy * a0 + e1dy * a1 + e2dy * a2;
    }
    // affine texture coordinates: rebuild the u / v planes from the plain
    // per-vertex values
    if affine {
        let iw0 = 1.0 / a[3];
        let iw1 = 1.0 / a[4];
        let iw2 = 1.0 / a[5];
        let u0 = a[6] * iw0;
        let u1 = a[7] * iw1;
        let u2 = a[8] * iw2;
        let v0 = a[9] * iw0;
        let v1 = a[10] * iw1;
        let v2 = a[11] * iw2;
        plane[6] = e0r * u0 + e1r * u1 + e2r * u2;
        plane[7] = e0dx * u0 + e1dx * u1 + e2dx * u2;
        plane[8] = e0dy * u0 + e1dy * u1 + e2dy * u2;
        plane[9] = e0r * v0 + e1r * v1 + e2r * v2;
        plane[10] = e0dx * v0 + e1dx * v1 + e2dx * v2;
        plane[11] = e0dy * v0 + e1dy * v1 + e2dy * v2;
    }
    let zdx = plane[1];
    let wdx = plane[4];
    let udx = plane[7];
    let vdx = plane[10];
    let mrdx = plane[13];
    let mgdx = plane[16];
    let mbdx = plane[19];
    let ardx = plane[22];
    let agdx = plane[25];
    let abdx = plane[28];
    let amdx = plane[31];
    let mut pc = 1.0f64;
    let mut ps = 0.0f64;
    let mut ang = 0.0f64;
    if portal {
        pc = p[5].cos();
        ps = p[5].sin();
        ang = p[4];
    }
    for y in min_y..=max_y {
        let dyr = (y - min_y) as f64;
        let e0 = e0r + e0dy * dyr;
        let e1 = e1r + e1dy * dyr;
        let e2 = e2r + e2dy * dyr;
        let mut lo: i64 = 0;
        let mut hi: i64 = max_x - min_x;
        if e0dx > 0.0 {
            lo = lo.max((-e0 / e0dx).ceil() as i64);
        } else if e0dx < 0.0 {
            hi = hi.min((-e0 / e0dx).floor() as i64);
        } else if e0 < 0.0 {
            continue;
        }
        if e1dx > 0.0 {
            lo = lo.max((-e1 / e1dx).ceil() as i64);
        } else if e1dx < 0.0 {
            hi = hi.min((-e1 / e1dx).floor() as i64);
        } else if e1 < 0.0 {
            continue;
        }
        if e2dx > 0.0 {
            lo = lo.max((-e2 / e2dx).ceil() as i64);
        } else if e2dx < 0.0 {
            hi = hi.min((-e2 / e2dx).floor() as i64);
        } else if e2 < 0.0 {
            continue;
        }
        if lo > hi {
            continue;
        }
        let ox = lo as f64;
        let oy = dyr;
        let mut z = plane[0] + zdx * ox + plane[2] * oy;
        let mut w = plane[3] + wdx * ox + plane[5] * oy;
        let mut u = plane[6] + udx * ox + plane[8] * oy;
        let mut v = plane[9] + vdx * ox + plane[11] * oy;
        let mut mr = plane[12] + mrdx * ox + plane[14] * oy;
        let mut mg = plane[15] + mgdx * ox + plane[17] * oy;
        let mut mb = plane[18] + mbdx * ox + plane[20] * oy;
        let mut ar = plane[21] + ardx * ox + plane[23] * oy;
        let mut ag = plane[24] + agdx * ox + plane[26] * oy;
        let mut ab = plane[27] + abdx * ox + plane[29] * oy;
        let mut am = plane[30] + amdx * ox + plane[32] * oy;
        let mut row = (y * fb_w + min_x + lo) as usize;
        let end = (y * fb_w + min_x + hi) as usize;
        while row <= end && row < fb.color.len() && row < fb.depth.len() {
            if depth_less {
                if z > fb.depth[row] as f64 {
                    row += 1;
                    z += zdx;
                    w += wdx;
                    u += udx;
                    v += vdx;
                    mr += mrdx;
                    mg += mgdx;
                    mb += mbdx;
                    ar += ardx;
                    ag += agdx;
                    ab += abdx;
                    am += amdx;
                    continue;
                }
            } else if depth_equal && depth_test {
                let dz = fb.depth[row] as f64;
                if z - dz > 1e-6 || dz - z > 1e-6 {
                    row += 1;
                    z += zdx;
                    w += wdx;
                    u += udx;
                    v += vdx;
                    mr += mrdx;
                    mg += mgdx;
                    mb += mbdx;
                    ar += ardx;
                    ag += agdx;
                    ab += abdx;
                    am += amdx;
                    continue;
                }
            }
            let mut tu;
            let mut tv;
            if portal {
                // TileEntityEndPortalRenderer: screen-space layers
                let sx = (row - (y * fb_w) as usize) as f64;
                let nx = ((sx + 0.5) / fb_w as f64 * 2.0 - 1.0) * ang;
                let ny = (1.0 - (y as f64 + 0.5) / fb_h as f64 * 2.0) * ang;
                tu = 0.5 + 0.5 * (nx * pc - ny * ps + p[6]);
                tv = 0.5 + 0.5 * (nx * ps + ny * pc + p[7]);
                tu -= tu.floor();
                tv -= tv.floor();
            } else if affine {
                tu = u;
                tv = v;
                if repeat {
                    tu -= tu.floor();
                    tv -= tv.floor();
                }
            } else {
                let iw = 1.0 / w;
                tu = u * iw;
                tv = v * iw;
                if repeat {
                    tu -= tu.floor();
                    tv -= tv.floor();
                }
            }
            // nearest texel
            let mut ix = (tu * tw as f64) as i64;
            let mut iy = (tv * th as f64) as i64;
            if ix < 0 {
                ix = 0;
            } else if ix >= tw {
                ix = tw - 1;
            }
            if iy < 0 {
                iy = 0;
            } else if iy >= th {
                iy = th - 1;
            }
            let t = match px_src.get((iy * tw + ix) as usize) {
                Some(c) => *c,
                None => 0xFFFF_FFFF,
            };
            let ta = (t >> 24) as f64 * (1.0 / 255.0);
            let mut sa = ta * am;
            if (if test_final { sa } else { ta }) < alpha_test {
                row += 1;
                z += zdx;
                w += wdx;
                u += udx;
                v += vdx;
                mr += mrdx;
                mg += mgdx;
                mb += mbdx;
                ar += ardx;
                ag += agdx;
                ab += abdx;
                am += amdx;
                continue;
            }
            if portal {
                sa = if p[3] < 0.5 { ta } else { 1.0 };
            }
            if depth_write {
                fb.depth[row] = z as f32;
            }
            if !color_write {
                row += 1;
                z += zdx;
                w += wdx;
                u += udx;
                v += vdx;
                mr += mrdx;
                mg += mgdx;
                mb += mbdx;
                ar += ardx;
                ag += agdx;
                ab += abdx;
                am += amdx;
                continue;
            }
            let mut r = (t & 255) as f64 * (1.0 / 255.0) * mr + ar;
            let mut g = ((t >> 8) & 255) as f64 * (1.0 / 255.0) * mg + ag;
            let mut b = ((t >> 16) & 255) as f64 * (1.0 / 255.0) * mb + ab;
            if !no_blend {
                let d = fb.color[row];
                let dr = (d & 255) as f64 * (1.0 / 255.0);
                let dg = ((d >> 8) & 255) as f64 * (1.0 / 255.0);
                let db = ((d >> 16) & 255) as f64 * (1.0 / 255.0);
                let da = (d >> 24) as f64 * (1.0 / 255.0);
                match blend {
                    Blend::Alpha => {
                        let ia = 1.0 - sa;
                        r = r * sa + dr * ia;
                        g = g * sa + dg * ia;
                        b = b * sa + db * ia;
                        sa = sa + da * ia;
                    }
                    Blend::Add => {
                        r = r * sa + dr;
                        g = g * sa + dg;
                        b = b * sa + db;
                        sa = sa + da;
                    }
                    Blend::Invert => {
                        r = (1.0 - dr) * r + dr * (1.0 - r);
                        g = (1.0 - dg) * g + dg * (1.0 - g);
                        b = (1.0 - db) * b + db * (1.0 - b);
                        sa = 1.0;
                    }
                    Blend::Darken => {
                        r = dr * (1.0 - r);
                        g = dg * (1.0 - g);
                        b = db * (1.0 - b);
                        sa = da;
                    }
                    Blend::Multiply => {
                        r = 2.0 * dr * r;
                        g = 2.0 * dg * g;
                        b = 2.0 * db * b;
                        sa = da;
                    }
                    Blend::None => {}
                }
            }
            fb.color[row] = pack_color(r, g, b, if opaque_out { 1.0 } else { sa });
            row += 1;
            z += zdx;
            w += wdx;
            u += udx;
            v += vdx;
            mr += mrdx;
            mg += mgdx;
            mb += mbdx;
            ar += ardx;
            ag += agdx;
            ab += abdx;
            am += amdx;
        }
    }
}

/// `_lines`: a 1-pixel line per vertex pair, depth from the first vertex.
fn raster_lines(m: &Mesh, tv: &[f64], first: usize, count: usize, ctx: &RasterCtx, fb: &mut FrameBuffer) {
    let w = fb.width as f64;
    let h = fb.height as f64;
    let fb_w = fb.width as i64;
    let mut k = first;
    while k + 1 < first + count {
        let ai = if m.has_indices {
            *m.indices.get(k).unwrap_or(&0) as usize
        } else {
            k
        } * T;
        let bi = if m.has_indices {
            *m.indices.get(k + 1).unwrap_or(&0) as usize
        } else {
            k + 1
        } * T;
        k += 2;
        if ai + T > tv.len() || bi + T > tv.len() {
            continue;
        }
        if tv[ai + 3] <= 0.001 || tv[bi + 3] <= 0.001 {
            continue;
        }
        let x0 = (tv[ai] / tv[ai + 3] * 0.5 + 0.5) * w;
        let y0 = (0.5 - tv[ai + 1] / tv[ai + 3] * 0.5) * h;
        let x1 = (tv[bi] / tv[bi + 3] * 0.5 + 0.5) * w;
        let y1 = (0.5 - tv[bi + 1] / tv[bi + 3] * 0.5) * h;
        let za = tv[ai + 2] / tv[ai + 3] * 0.5 + 0.5;
        let zb = tv[bi + 2] / tv[bi + 3] * 0.5 + 0.5;
        let span = (x1 - x0).abs().max((y1 - y0).abs()).ceil();
        let span = if span > 0.0 { span } else { 1.0 };
        let steps = span.min(4096.0);
        let col = pack_color(
            tv[ai + 6] + tv[ai + 9],
            tv[ai + 7] + tv[ai + 10],
            tv[ai + 8] + tv[ai + 11],
            1.0,
        );
        let mut i = 0.0f64;
        while i <= steps {
            let t = i / steps;
            let x = (x0 + (x1 - x0) * t) as i64;
            let y = (y0 + (y1 - y0) * t) as i64;
            i += 1.0;
            if x < ctx.min_x || y < ctx.min_y || x >= ctx.max_x || y >= ctx.max_y {
                continue;
            }
            let p = (y * fb_w + x) as usize;
            if p >= fb.color.len() {
                continue;
            }
            let z = za + (zb - za) * t;
            if ctx.depth_test && z > fb.depth[p] as f64 + 1e-5 {
                continue;
            }
            fb.color[p] = col;
        }
    }
}

// -------------------------------------------------------------- post pass

fn fetch_px(p: &[u32], w: u32, h: u32, x: f64, y: f64) -> [f64; 4] {
    if w == 0 || h == 0 || p.is_empty() {
        return [0.0, 0.0, 0.0, 0.0];
    }
    let mut i = (x * w as f64).floor() as i64;
    let mut j = ((1.0 - y) * h as f64).floor() as i64;
    if i < 0 {
        i = 0;
    } else if i >= w as i64 {
        i = w as i64 - 1;
    }
    if j < 0 {
        j = 0;
    } else if j >= h as i64 {
        j = h as i64 - 1;
    }
    let c = match p.get(j as usize * w as usize + i as usize) {
        Some(c) => *c,
        None => 0,
    };
    [
        (c & 255) as f64 / 255.0,
        ((c >> 8) & 255) as f64 / 255.0,
        ((c >> 16) & 255) as f64 / 255.0,
        (c >> 24) as f64 / 255.0,
    ]
}

fn len4(v: &[f64; 4]) -> f64 {
    (v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]).sqrt()
}

fn ndot(a: &[f64; 4], b: &[f64; 4]) -> f64 {
    let la = len4(a);
    let lb = len4(b);
    (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) / (la * lb)
}

/// `_post`: a full-screen pass of a vanilla post-processing program over the
/// whole target, per pixel like the fragment shader.
pub fn post_pass(
    fb: &mut FrameBuffer,
    src: &TexRef,
    aux: &TexRef,
    params: &[f64; 16],
    blend_alpha: bool,
) {
    let out_w = fb.width as usize;
    let out_h = fb.height as usize;
    if out_w == 0 || out_h == 0 || fb.color.len() < out_w * out_h {
        return;
    }
    let (sw, sh, sp): (u32, u32, &[u32]) = match src.levels.first() {
        Some(l) => (l.w, l.h, l.px),
        None => (0, 0, &[]),
    };
    let (aw, ah, ap): (u32, u32, &[u32]) = match aux.levels.first() {
        Some(l) => (l.w, l.h, l.px),
        None => (0, 0, &[]),
    };
    let p = *params;
    let ox = if sw > 0 { 1.0 / sw as f64 } else { 0.0 };
    let oy = if sh > 0 { 1.0 / sh as f64 } else { 0.0 };
    let t = |x: f64, y: f64| -> [f64; 4] { fetch_px(sp, sw, sh, x, y) };

    let progs = |m: i64, tx: f64, ty: f64| -> Option<[f64; 3]> {
        if m == 6 {
            let c = t(tx, ty);
            let l = t(tx - ox, ty);
            let rr = t(tx + ox, ty);
            let u = t(tx, ty - oy);
            let dd = t(tx, ty + oy);
            let mut o = [0.0f64; 3];
            for i in 0..3 {
                o[i] = (4.0 * c[i] - l[i] - rr[i] - u[i] - dd[i]).clamp(0.0, 1.0);
            }
            return Some(o);
        }
        if m == 7 {
            let rx = [p[12], p[13], p[14]];
            let ry = [p[1], p[2], p[3]];
            let mut o = [0.0f64; 3];
            for i in 0..3 {
                let cx = tx * rx[i] + p[4 + i] * ox - (rx[i] - 1.0) * 0.5;
                let cy = ty * ry[i] + p[8 + i] * oy - (ry[i] - 1.0) * 0.5;
                o[i] = t(cx, cy)[i];
            }
            return Some(o);
        }
        if m == 8 {
            let prev = fetch_px(ap, aw, ah, tx, ty);
            let cur = t(tx, ty);
            let mut o = [0.0f64; 3];
            for i in 0..3 {
                o[i] = (prev[i] * p[4 + i]).max(cur[i]);
            }
            return Some(o);
        }
        if m == 9 {
            let c = t(tx, ty);
            let du = ndot(&c, &t(tx, ty - oy));
            let dd = ndot(&c, &t(tx, ty + oy));
            let dl = ndot(&c, &t(tx - ox, ty));
            let dr = ndot(&c, &t(tx + ox, ty));
            let f = (1.0 + (du * 64.0 - dd * 64.0) + (dr * 64.0 - dl * 64.0)).clamp(0.5, 2.0);
            return Some([c[0] * f, c[1] * f, c[2] * f]);
        }
        if m == 10 {
            let mut v = t(tx, ty);
            const K: [(f64, f64); 12] = [
                (0.0, -1.0),
                (0.0, 1.0),
                (-1.0, 0.0),
                (1.0, 0.0),
                (-1.0, -1.0),
                (1.0, 1.0),
                (-1.0, 1.0),
                (1.0, -1.0),
                (0.0, -2.0),
                (0.0, 2.0),
                (-2.0, 0.0),
                (2.0, 0.0),
            ];
            for (kx, ky) in K.iter() {
                let q = t(tx + kx * ox, ty + ky * oy);
                for i in 0..3 {
                    if q[i] < v[i] {
                        v[i] = q[i];
                    }
                }
            }
            return Some([v[0], v[1], v[2]]);
        }
        if m == 11 {
            let r = p[1];
            let mut mx = t(tx, ty);
            let n = r.floor() as i64;
            for u in 0..=n {
                for v in 0..=n {
                    let (uf, vf) = (u as f64, v as f64);
                    if (uf * uf + vf * vf).sqrt() / r > 1.0 {
                        continue;
                    }
                    for (a, b2) in [(-uf, -vf), (uf, vf), (-uf, vf), (uf, -vf)] {
                        let q = t(tx + a * ox, ty + b2 * oy);
                        for i in 0..3 {
                            if q[i] > mx[i] {
                                mx[i] = q[i];
                            }
                        }
                    }
                }
            }
            return Some([mx[0], mx[1], mx[2]]);
        }
        if m == 12 {
            let c = t(tx, ty);
            let side = |dx: f64, dy: f64| -> [f64; 3] {
                let a1 = t(tx + dx, ty + dy);
                let a2 = t(tx + dx * 2.0, ty + dy * 2.0);
                let mut o = [0.0f64; 3];
                for i in 0..3 {
                    o[i] = c[i] + ((a1[i] + (a2[i] - a1[i]) * 0.667) - c[i]) * 0.75;
                }
                o
            };
            let v1 = side(-ox, 0.0);
            let v2 = side(ox, 0.0);
            let v3 = side(0.0, -oy);
            let v4 = side(0.0, oy);
            let mut o = [0.0f64; 3];
            for i in 0..3 {
                o[i] = ((v1[i] + v2[i]) * 0.5 + (v3[i] + v4[i]) * 0.5) * 0.5;
            }
            return Some(o);
        }
        if m == 13 {
            let c = t(tx, ty);
            let px2 = tx * 2.0 - 1.0;
            let py2 = ty * 2.0 - 1.0;
            let r2 = px2 * px2 + py2 * py2;
            let sx = tx * (1.0 - 0.02 * 0.2) + 0.02 * 0.1 + px2 * 0.02 * r2;
            let sy = ty * (1.0 - 0.02 * 0.2) + 0.02 * 0.1 + py2 * 0.02 * r2;
            if sx < 0.0 || sy < 0.0 || sx > 1.0 || sy > 1.0 {
                return None;
            }
            let bm = (sy * sh as f64 * 0.25 * std::f64::consts::PI).sin();
            let br = 1.0 + ((bm * bm + 1.0) * 0.5 - 1.0) * 0.8;
            let mut o = [0.0f64; 3];
            for i in 0..3 {
                o[i] = (0.05 + 0.95 * c[i] * br).powf(0.8);
            }
            return Some(o);
        }
        if m == 14 {
            let time = p[1];
            let c = t(
                tx + (ty * p[4] + time * 6.283185307).sin() * p[6],
                ty + (tx * p[5] + time * 6.283185307).cos() * p[7],
            );
            let mxv = c[0].max(c[1]).max(c[2]);
            let ch = mxv - c[0].min(c[1]).min(c[2]);
            let mut hh = 0.0f64;
            let mut sat = 0.0f64;
            if ch != 0.0 {
                sat = ch / mxv;
                let d = [(mxv - c[0]) / ch, (mxv - c[1]) / ch, (mxv - c[2]) / ch];
                let e = [d[0] - d[2] + 2.0, d[1] - d[0] + 4.0, d[2] - d[1]];
                hh = factor_hue(c, mxv, e);
            }
            hh = fract(hh + time);
            let cl = |v: f64| v.clamp(0.0, 1.0);
            let hue = [
                cl((hh * 6.0 - 3.0).abs() - 1.0),
                cl(2.0 - (hh * 6.0 - 2.0).abs()),
                cl(2.0 - (hh * 6.0 - 4.0).abs()),
            ];
            let mut o = [0.0f64; 3];
            for i in 0..3 {
                o[i] = ((hue[i] - 1.0) * sat + 1.0) * mxv;
            }
            return Some(o);
        }
        if m == 15 {
            let c = t(tx, ty);
            let mut sum = [0.0f64; 3];
            let dirs = [(0.0, -oy), (ox, 0.0), (-ox, 0.0), (0.0, oy)];
            for k in 1..=2i32 {
                for (dx, dy) in dirs.iter() {
                    let q = t(tx + dx * k as f64, ty + dy * k as f64);
                    for i in 0..3 {
                        sum[i] += (c[i] - q[i]).abs();
                    }
                }
            }
            let gray = [0.3, 0.59, 0.11];
            let mut sl = 1.0f64;
            for i in 0..3 {
                sl -= sum[i].min(1.0) * gray[i];
            }
            let mut l = 0.0f64;
            for i in 0..3 {
                l += (c[i] + (c[i] - c[i].powf(p[1]))) * gray[i];
            }
            l -= fract(l * p[2]) / p[2];
            l = l * (p[2] / (p[2] - 1.0)) * sl;
            return Some([l, l, l]);
        }
        // 16: flip (blit with the image upside down)
        let c = t(tx, 1.0 - ty);
        Some([c[0] * p[4], c[1] * p[5], c[2] * p[6]])
    };

    let mode = js_round(p[0]) as i64;
    let cs = (p[1] * DEG_TO_RAD).cos();
    let sn = (p[1] * DEG_TO_RAD).sin();
    let r = p[6];
    let dst = &mut fb.color;
    for y in 0..out_h {
        let ty = 1.0 - (y as f64 + 0.5) / out_h as f64;
        for x in 0..out_w {
            let tx = (x as f64 + 0.5) / out_w as f64;
            let mut rr;
            let mut gg;
            let mut bb;
            let mut aa = 1.0f64;
            if mode == 0 {
                let px = fetch_px(sp, sw, sh, tx, ty);
                rr = px[0] * p[4];
                gg = px[1] * p[5];
                bb = px[2] * p[6];
                aa = px[3] * p[7];
                if blend_alpha && aa < 1.0 {
                    // srcalpha, 1-srcalpha over what the target holds
                    let o = dst[y * out_w + x];
                    let k = 1.0 - aa;
                    rr = rr * aa + (o & 255) as f64 / 255.0 * k;
                    gg = gg * aa + ((o >> 8) & 255) as f64 / 255.0 * k;
                    bb = bb * aa + ((o >> 16) & 255) as f64 / 255.0 * k;
                    aa = aa + (o >> 24) as f64 / 255.0 * k;
                }
            } else if mode == 1 {
                let px = fetch_px(sp, sw, sh, tx, ty);
                let k = p[1];
                rr = px[0] + (1.0 - 2.0 * px[0]) * k;
                gg = px[1] + (1.0 - 2.0 * px[1]) * k;
                bb = px[2] + (1.0 - 2.0 * px[2]) * k;
            } else if mode == 2 {
                let px = fetch_px(sp, sw, sh, tx, ty);
                let cr = px[0] * p[4] + px[1] * p[5] + px[2] * p[6];
                let cg = px[0] * p[8] + px[1] * p[9] + px[2] * p[10];
                let cb = px[0] * p[12] + px[1] * p[13] + px[2] * p[14];
                let l = cr * 0.3 + cg * 0.59 + cb * 0.11;
                rr = (cr - l) * p[1] + l;
                gg = (cg - l) * p[1] + l;
                bb = (cb - l) * p[1] + l;
            } else if mode == 3 {
                let mx = sw as f64 / p[3];
                let my = sh as f64 / p[3];
                let px = fetch_px(
                    sp,
                    sw,
                    sh,
                    tx - fract(tx * mx) / mx,
                    ty - fract(ty * my) / my,
                );
                let q = p[1];
                let fr = px[0] - fract(px[0] * q) / q;
                let fg = px[1] - fract(px[1] * q) / q;
                let fb2 = px[2] - fract(px[2] * q) / q;
                let l = fr * 0.3 + fg * 0.59 + fb2 * 0.11;
                rr = l + (fr - l) * p[2];
                gg = l + (fg - l) * p[2];
                bb = l + (fb2 - l) * p[2];
            } else if mode == 4 {
                let mut ar = 0.0f64;
                let mut ag = 0.0f64;
                let mut ab = 0.0f64;
                let mut ta = 0.0f64;
                let mut k = -r;
                while k <= r {
                    let px = fetch_px(
                        sp,
                        sw,
                        sh,
                        tx + k * p[4] / sw as f64,
                        ty + k * p[5] / sh as f64,
                    );
                    ar += px[0];
                    ag += px[1];
                    ab += px[2];
                    ta += px[3];
                    k += 1.0;
                }
                let n = r * 2.0 + 1.0;
                rr = ar / n;
                gg = ag / n;
                bb = ab / n;
                aa = ta;
            } else if (6..=16).contains(&mode) {
                match progs(mode, tx, ty) {
                    Some(c) => {
                        rr = c[0];
                        gg = c[1];
                        bb = c[2];
                    }
                    // discarded: the target keeps its clear colour
                    None => continue,
                }
            } else {
                let sx = (tx * cs - ty * sn) * p[4] + p[6];
                let sy = (ty * cs + tx * sn) * p[5] + p[7];
                let bx = fetch_px(ap, aw, ah, tx, ty);
                let px = fetch_px(sp, sw, sh, sx, sy);
                let mut o0 = px[0];
                let mut o1 = px[1];
                let mut o2 = px[2];
                if sx < p[8] || sy < p[9] || sx > p[10] || sy > p[11] {
                    o0 = bx[0];
                    o1 = bx[1];
                    o2 = bx[2];
                }
                if sx < p[12] {
                    let m = (p[8] - sx) / (p[8] - p[12]);
                    o0 = bx[0] + (o0 - bx[0]) * m;
                    o1 = bx[1] + (o1 - bx[1]) * m;
                    o2 = bx[2] + (o2 - bx[2]) * m;
                }
                if sy < p[13] {
                    let m = (p[9] - sy) / (p[9] - p[13]);
                    o0 = bx[0] + (o0 - bx[0]) * m;
                    o1 = bx[1] + (o1 - bx[1]) * m;
                    o2 = bx[2] + (o2 - bx[2]) * m;
                }
                if sx > p[14] {
                    let m = (p[10] - sx) / (p[10] - p[14]);
                    o0 = bx[0] + (o0 - bx[0]) * m;
                    o1 = bx[1] + (o1 - bx[1]) * m;
                    o2 = bx[2] + (o2 - bx[2]) * m;
                }
                if sy > p[15] {
                    let m = (p[11] - sy) / (p[11] - p[15]);
                    o0 = bx[0] + (o0 - bx[0]) * m;
                    o1 = bx[1] + (o1 - bx[1]) * m;
                    o2 = bx[2] + (o2 - bx[2]) * m;
                }
                rr = o0;
                gg = o1;
                bb = o2;
            }
            dst[y * out_w + x] = pack_color(rr, gg, bb, aa);
        }
    }
}

fn factor_hue(c: [f64; 4], mxv: f64, e: [f64; 3]) -> f64 {
    let sel = if c[0] >= mxv {
        e[2]
    } else if c[1] >= mxv {
        e[0]
    } else {
        e[1]
    };
    fract(sel / 6.0)
}

// --------------------------------------------------------------- the device

/// Draw command parsed from the JSON given to `draw_json`.
struct DrawCmd {
    mesh: usize,
    pipeline: Pipeline,
    textures: Vec<usize>,
    model: [f64; 16],
    params: [f64; 16],
    state: DrawState,
    first: usize,
    count: Option<usize>,
    lines: bool,
}

/// The software device. Browser-bound presentation stays in JS; this owns the
/// buffers, textures, meshes, globals and the whole draw path.
#[wasm_bindgen]
pub struct SoftwareDevice {
    width: u32,
    height: u32,
    /// The framebuffer currently being drawn into (the bound target's data).
    cur: FrameBuffer,
    /// Persistent buffers: index 0 is the screen, the rest are render targets.
    /// `fbs[cur_idx]` is a scratch placeholder, see `bind_fb`.
    fbs: Vec<FrameBuffer>,
    cur_idx: usize,
    target_tex: Option<u32>,
    textures: Vec<Texture>,
    meshes: Vec<Mesh>,
    white: u32,
    globals: Globals,
    scissor: Option<[i64; 4]>,
    mvp: [f64; 16],
    mv: [f64; 16],
    last_model: [f64; 16],
    tv: Vec<f64>,
    clip: Vec<f64>,
    att: Vec<f64>,
    lm_cache: LightmapCache,
    vp_dirty: bool,
}

impl Default for SoftwareDevice {
    fn default() -> Self {
        SoftwareDevice::new(1, 1)
    }
}

impl SoftwareDevice {
    fn bind_fb(&mut self, idx: usize) {
        if idx == self.cur_idx || idx >= self.fbs.len() {
            return;
        }
        let old = self.cur_idx;
        std::mem::swap(&mut self.cur, &mut self.fbs[old]);
        std::mem::swap(&mut self.cur, &mut self.fbs[idx]);
        self.cur_idx = idx;
    }

    /// The live screen pixels (only `cur` holds live data for the bound slot).
    pub fn screen_color(&self) -> &[u32] {
        if self.cur_idx == 0 {
            &self.cur.color
        } else {
            &self.fbs[0].color
        }
    }

    /** Resolve a sampleable texture handle, refusing the bound render target. */
    fn sample_handle(&self, h: usize) -> Option<&Texture> {
        let t = self.textures.get(h)?;
        if t.rt == Some(self.cur_idx) {
            return None;
        }
        Some(t)
    }

    fn lm_src(&self, handle: Option<usize>) -> Option<LmSrc<'_>> {
        let h = handle?;
        let t = self.sample_handle(h)?;
        let (w, hh, px) = match t.rt {
            Some(i) => {
                let f = self.fbs.get(i)?;
                (f.width, f.height, f.color.as_slice())
            }
            None => (t.width, t.height, t.u32_px.as_slice()),
        };
        Some(LmSrc {
            id: h,
            version: t.version,
            w,
            h: hh,
            px,
        })
    }

    /// `_post(d)`: run a post-processing program over the current target.
    fn post(&mut self, cmd: &DrawCmd) {
        let white = self.white as usize;
        let src_h = cmd.textures.first().copied().unwrap_or(white);
        let src_h = if self.sample_handle(src_h).is_none() {
            white
        } else {
            src_h
        };
        let aux_h = self.globals.lightmap.unwrap_or(white);
        let aux_h = if self.sample_handle(aux_h).is_none() {
            white
        } else {
            aux_h
        };
        let blend_alpha = cmd.state.blend == "alpha";
        let params = cmd.params;
        let SoftwareDevice {
            cur,
            fbs,
            textures,
            ..
        } = self;
        let src = tex_ref(&textures[src_h], fbs);
        let aux = tex_ref(&textures[aux_h], fbs);
        post_pass(cur, &src, &aux, &params, blend_alpha);
    }

    /// `draw(d)`: transform, set up and rasterise one draw call.
    fn draw(&mut self, cmd: &DrawCmd) {
        if cmd.pipeline == Pipeline::Post {
            self.post(cmd);
            return;
        }
        let verts_n = match self.meshes.get(cmd.mesh) {
            Some(m) => m.vertex_count,
            None => return,
        };
        if verts_n == 0 {
            return;
        }
        let pipeline = cmd.pipeline;
        let params = cmd.params;
        let state = &cmd.state;
        // matrices: mv = view * model, mvp = proj * mv
        let model = cmd.model;
        self.last_model = model;
        mul4(&mut self.mv, &self.globals.view, &model);
        {
            let mv = self.mv;
            mul4(&mut self.mvp, &self.globals.proj, &mv);
        }
        // index range
        let lines = cmd.lines;
        let first = cmd.first;
        let count = match cmd.count {
            Some(c) => c,
            None => self.meshes[cmd.mesh].index_count,
        };
        if count == 0 {
            return;
        }
        let (quads, has_indices, vertex_count) = {
            let m = &self.meshes[cmd.mesh];
            (m.quads, m.has_indices, m.vertex_count)
        };
        // vertex range used by the draw
        let (v0, v1) = if quads {
            let v0 = (first / 6) * 4;
            let v1 = vertex_count.min(v0 + ((count + 5) / 6) * 4);
            (v0, v1)
        } else if !has_indices {
            (first, vertex_count.min(first + count))
        } else {
            (0, vertex_count)
        };
        if v0 >= v1 {
            return;
        }
        // texture + lightmap resolution (never the bound target itself)
        let white = self.white as usize;
        let mut tex_h = cmd.textures.first().copied().unwrap_or(white);
        if self.sample_handle(tex_h).is_none() {
            tex_h = white;
        }
        let lm_handle = self.globals.lightmap;
        let lm_handle = match lm_handle {
            Some(h) if self.sample_handle(h).is_none() => None,
            other => other,
        };
        let repeat = self.textures[tex_h].wrap == "repeat";
        // lm_src is computed after the field destructure below to avoid a borrow conflict
        let opaque_out = self.target_tex.is_none();
        let scissor = self.scissor;
        let fb_w = self.cur.width;
        let fb_h = self.cur.height;
        let globals = self.globals.clone();
        let mvp = self.mvp;
        let mv = self.mv;
        let SoftwareDevice {
            cur,
            fbs,
            textures,
            meshes,
            tv,
            clip,
            att,
            lm_cache,
            ..
        } = self;
        let lm_src = self_lm_src(textures, fbs, lm_handle);
        let mesh = &meshes[cmd.mesh];
        transform_vertices(
            mesh, v0, v1, pipeline, &params, tv, &mvp, &mv, &globals, &model, lm_src.as_ref(),
            lm_cache,
        );
        let ctx = setup_ctx(pipeline, &params, state, repeat, fb_w, fb_h, scissor, opaque_out);
        if lines {
            raster_lines(mesh, tv, first, count, &ctx, cur);
            return;
        }
        let tref = tex_ref(&textures[tex_h], fbs);
        let cull = state.cull;
        let mut k = first;
        while k + 2 < first + count {
            let (a, b, c) = if quads {
                let q = (k / 6) * 4;
                let r = k % 6;
                let base = q;
                if r == 0 {
                    (base, base + 1, base + 2)
                } else {
                    (base, base + 2, base + 3)
                }
            } else if has_indices {
                let idx = &mesh.indices;
                (
                    *idx.get(k).unwrap_or(&0) as usize,
                    *idx.get(k + 1).unwrap_or(&0) as usize,
                    *idx.get(k + 2).unwrap_or(&0) as usize,
                )
            } else {
                (k, k + 1, k + 2)
            };
            raster_triangle(
                tv,
                a * T,
                b * T,
                c * T,
                clip,
                cull,
                &ctx,
                &tref,
                cur,
                att,
            );
            k += 3;
        }
    }
}

#[wasm_bindgen]
impl SoftwareDevice {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> SoftwareDevice {
        let iw = width.max(1);
        let ih = height.max(1);
        let mut white = Texture::create(1, 1, "nearest", "clamp", false, 0);
        white.upload(&[255, 255, 255, 255], 0, 0, 1, 1);
        SoftwareDevice {
            width: iw,
            height: ih,
            cur: FrameBuffer::new(iw, ih),
            fbs: vec![FrameBuffer::new(iw, ih)],
            cur_idx: 0,
            target_tex: None,
            textures: vec![white],
            meshes: Vec::new(),
            white: 0,
            globals: Globals::default(),
            scissor: None,
            mvp: ZERO16,
            mv: ZERO16,
            last_model: IDENTITY,
            tv: vec![0.0; T * 1024],
            clip: vec![0.0; T * 8],
            att: vec![0.0; NA * 3],
            lm_cache: LightmapCache::new(),
            vp_dirty: false,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    /// `resize(w, h)`.
    pub fn resize(&mut self, w: f64, h: f64) {
        let iw = js_round(w).max(1.0) as u32;
        let ih = js_round(h).max(1.0) as u32;
        self.width = iw;
        self.height = ih;
        let fresh = FrameBuffer::new(iw, ih);
        if self.cur_idx == 0 {
            self.cur = fresh;
        } else {
            self.fbs[0] = fresh;
        }
    }

    /// `beginFrame(clear)`.
    pub fn begin_frame(&mut self, r: f64, g: f64, b: f64) {
        self.bind_fb(0);
        self.target_tex = None;
        self.scissor = None;
        let c = pack_color(r, g, b, 1.0);
        self.cur.clear_color(c);
        self.cur.clear_depth();
    }

    pub fn clear_depth(&mut self) {
        self.cur.clear_depth();
    }

    /// `setScissor(rect)`, rect = [x, y, w, h] in pixels, origin top-left.
    pub fn set_scissor(&mut self, x: f64, y: f64, w: f64, h: f64) {
        self.scissor = Some([
            x.floor() as i64,
            y.floor() as i64,
            w.ceil() as i64,
            h.ceil() as i64,
        ]);
    }

    pub fn clear_scissor(&mut self) {
        self.scissor = None;
    }

    /// `setGlobals(g)` from a JSON object.
    pub fn set_globals_json(&mut self, json: &str) -> bool {
        let v: Value = match serde_json::from_str(json) {
            Ok(v) => v,
            Err(_) => return false,
        };
        if let Some(a) = v.get("view").and_then(|x| x.as_array()) {
            for i in 0..16 {
                if let Some(x) = a.get(i).and_then(|y| y.as_f64()) {
                    self.globals.view[i] = x;
                }
            }
        }
        if let Some(a) = v.get("proj").and_then(|x| x.as_array()) {
            for i in 0..16 {
                if let Some(x) = a.get(i).and_then(|y| y.as_f64()) {
                    self.globals.proj[i] = x;
                }
            }
        }
        if let Some(a) = v.get("fogColor").and_then(|x| x.as_array()) {
            for i in 0..3 {
                if let Some(x) = a.get(i).and_then(|y| y.as_f64()) {
                    self.globals.fog_color[i] = x;
                }
            }
        }
        if let Some(x) = v.get("fogStart").and_then(|x| x.as_f64()) {
            self.globals.fog[0] = x;
        }
        if let Some(x) = v.get("fogEnd").and_then(|x| x.as_f64()) {
            self.globals.fog[1] = x;
        }
        if let Some(x) = v.get("fogDensity").and_then(|x| x.as_f64()) {
            self.globals.fog[2] = x;
        }
        if let Some(x) = v.get("fogMode").and_then(|x| x.as_f64()) {
            self.globals.fog[3] = x;
        }
        if let Some(x) = v.get("lightmap") {
            self.globals.lightmap = if x.is_null() {
                None
            } else {
                x.as_u64().map(|h| h as usize)
            };
        }
        self.vp_dirty = true;
        true
    }

    /// `createTexture({...})` -> handle.
    pub fn create_texture(
        &mut self,
        width: u32,
        height: u32,
        filter: &str,
        wrap: &str,
        mipmaps: bool,
        mipmap_levels: i32,
    ) -> u32 {
        self.textures
            .push(Texture::create(width, height, filter, wrap, mipmaps, mipmap_levels));
        (self.textures.len() - 1) as u32
    }

    /// `updateTexture(t, data, x, y, w, h)` with RGBA bytes.
    pub fn upload_texture(&mut self, handle: u32, data: &[u8], x: u32, y: u32, w: u32, h: u32) {
        if let Some(t) = self.textures.get_mut(handle as usize) {
            let (w, h) = if w == 0 || h == 0 {
                (t.width, t.height)
            } else {
                (w, h)
            };
            t.upload(data, x, y, w, h);
        }
    }

    /// Packed texels of a texture (level 0), for JS-side inspection.
    pub fn texel_data(&self, handle: u32) -> Vec<u32> {
        match self.textures.get(handle as usize) {
            Some(t) => {
                if let Some(i) = t.rt {
                    self.fbs
                        .get(i)
                        .map(|f| f.color.clone())
                        .unwrap_or_default()
                } else {
                    t.u32_px.clone()
                }
            }
            None => Vec::new(),
        }
    }

    /// `createRenderTarget(w, h)` -> handle.
    pub fn create_render_target(&mut self, w: u32, h: u32) -> u32 {
        let idx = self.fbs.len();
        self.fbs.push(FrameBuffer::new(w.max(1), h.max(1)));
        let mut t = Texture::create(w.max(1), h.max(1), "linear", "clamp", false, 0);
        t.levels.clear();
        t.u32_px.clear();
        t.rt = Some(idx);
        self.textures.push(t);
        (self.textures.len() - 1) as u32
    }

    /// `setRenderTarget(target)`: bind a render target, or the screen (-1).
    pub fn set_render_target(&mut self, handle: i32) {
        let idx = if handle < 0 {
            0
        } else {
            match self.textures.get(handle as usize).and_then(|t| t.rt) {
                Some(i) => i,
                None => return,
            }
        };
        self.bind_fb(idx);
        self.target_tex = if idx == 0 { None } else { Some(handle as u32) };
    }

    /// `setRenderTarget(t, clear)` colour+depth clear of the bound target.
    pub fn clear_current(&mut self, r: f64, g: f64, b: f64, a: f64) {
        let c = pack_color(r, g, b, a);
        self.cur.clear_color(c);
        self.cur.clear_depth();
    }

    /// `createMesh(format, vertices, opts)` with raw bytes -> handle.
    pub fn create_mesh(&mut self, format: &str, data: &[u8], quads: bool, indices: &[u32]) -> u32 {
        self.meshes.push(Mesh::new(format, data, quads, indices));
        (self.meshes.len() - 1) as u32
    }

    /// `createMesh` with `Float32Array` data.
    pub fn create_mesh_f32(
        &mut self,
        format: &str,
        data: &[f32],
        quads: bool,
        indices: &[u32],
    ) -> u32 {
        let bytes = f32s_to_bytes(data);
        self.create_mesh(format, &bytes, quads, indices)
    }

    /// `updateMesh(m, vertices, opts)`. `quads`: -1 = undefined, 0 = false, 1 = true.
    pub fn update_mesh(&mut self, handle: u32, data: &[u8], quads: i32, indices: &[u32]) {
        if let Some(m) = self.meshes.get_mut(handle as usize) {
            let q = match quads {
                -1 => None,
                n => Some(n != 0),
            };
            m.update(data, q, indices);
        }
    }

    /// `updateMesh` with `Float32Array` data.
    pub fn update_mesh_f32(&mut self, handle: u32, data: &[f32], quads: i32, indices: &[u32]) {
        let bytes = f32s_to_bytes(data);
        self.update_mesh(handle, &bytes, quads, indices);
    }

    pub fn mesh_vertex_count(&self, handle: u32) -> u32 {
        self.meshes
            .get(handle as usize)
            .map(|m| m.vertex_count as u32)
            .unwrap_or(0)
    }

    pub fn mesh_index_count(&self, handle: u32) -> u32 {
        self.meshes
            .get(handle as usize)
            .map(|m| m.index_count as u32)
            .unwrap_or(0)
    }

    pub fn destroy_mesh(&mut self, handle: u32) {
        if let Some(m) = self.meshes.get_mut(handle as usize) {
            m.data.clear();
            m.vertex_count = 0;
            m.indices.clear();
            m.has_indices = false;
            m.index_count = 0;
        }
    }

    pub fn destroy_texture(&mut self, handle: u32) {
        if let Some(t) = self.textures.get_mut(handle as usize) {
            t.levels.clear();
            t.u32_px.clear();
        }
    }

    /// `draw(d)` from a JSON descriptor.
    pub fn draw_json(&mut self, json: &str) -> bool {
        let v: Value = match serde_json::from_str(json) {
            Ok(v) => v,
            Err(_) => return false,
        };
        let pipeline = Pipeline::from_name(
            v.get("pipeline").and_then(|x| x.as_str()).unwrap_or("color"),
        );
        let params = json_mat(v.get("params"), pipeline.default_params());
        let model = json_mat(v.get("model"), IDENTITY);
        let state = state_from_json(v.get("state"));
        let textures = v
            .get("textures")
            .and_then(|x| x.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|x| x.as_u64().map(|h| h as usize))
                    .collect()
            })
            .unwrap_or_default();
        let cmd = DrawCmd {
            mesh: v.get("mesh").and_then(|x| x.as_u64()).unwrap_or(0) as usize,
            pipeline,
            textures,
            model,
            params,
            state,
            first: v.get("first").and_then(|x| x.as_u64()).unwrap_or(0) as usize,
            count: v.get("count").and_then(|x| x.as_u64()).map(|c| c as usize),
            lines: v.get("primitive").and_then(|x| x.as_str()) == Some("lines"),
        };
        self.draw(&cmd);
        true
    }

    /// `endFrame()`: the screen as RGBA bytes (top-left origin, for ImageData).
    pub fn end_frame(&mut self) -> Vec<u8> {
        as_u8(self.screen_color())
    }

    /// `endFrame()` pixels as packed texels.
    pub fn end_frame_u32(&mut self) -> Vec<u32> {
        self.screen_color().to_vec()
    }

    /// `capture()`: pixels of the last completed frame (the promise stays in JS).
    pub fn capture(&self) -> Vec<u8> {
        as_u8(self.screen_color())
    }

    /// `busy()`: the software rasteriser is never behind.
    pub fn busy(&self) -> bool {
        false
    }
}

// ---------------------------------------------------------------- JSON glue

fn json_mat(v: Option<&Value>, d: [f64; 16]) -> [f64; 16] {
    let mut m = d;
    if let Some(a) = v.and_then(|x| x.as_array()) {
        for i in 0..16 {
            if let Some(x) = a.get(i).and_then(|y| y.as_f64()) {
                m[i] = x;
            }
        }
    }
    m
}

fn json_bool(v: &Value, key: &str, d: bool) -> bool {
    v.get(key).and_then(|x| x.as_bool()).unwrap_or(d)
}

fn state_from_json(v: Option<&Value>) -> DrawState {
    let mut s = DrawState::default();
    if let Some(v) = v {
        s.blend = v
            .get("blend")
            .and_then(|x| x.as_str())
            .unwrap_or("none")
            .to_string();
        s.depth_test = json_bool(v, "depthTest", true);
        s.depth_write = json_bool(v, "depthWrite", true);
        s.cull = json_bool(v, "cull", false);
        s.polygon_offset = json_bool(v, "polygonOffset", false);
        s.depth_equal = v.get("depthFunc").and_then(|x| x.as_str()) == Some("equal");
        s.color_write = json_bool(v, "colorWrite", true);
    }
    s
}

// ------------------------------------------------------------- flat exports

/// `packColor(r, g, b, a)`.
#[wasm_bindgen]
pub fn sw_pack_color(r: f64, g: f64, b: f64, a: f64) -> u32 {
    pack_color(r, g, b, a)
}

/// `mul4(out, a, b)` returning the product.
#[wasm_bindgen]
pub fn sw_mul4(a: &[f64], b: &[f64]) -> Vec<f64> {
    let mut out = vec![0.0f64; 16];
    if a.len() >= 16 && b.len() >= 16 {
        mul4(&mut out, a, b);
    }
    out
}

/// `vertexLayout(FORMAT[name])` as JSON.
#[wasm_bindgen]
pub fn sw_vertex_layout(name: &str) -> String {
    let l = vertex_layout(name);
    let attrs: Vec<String> = l
        .attrs
        .iter()
        .map(|a| {
            format!(
                "{{\"size\":{},\"byteOffset\":{},\"type\":\"{}\"}}",
                a.size,
                a.offset,
                match a.ty {
                    AttrType::F32 => "f32",
                    AttrType::Unorm16 => "unorm16",
                    AttrType::Unorm8 => "unorm8",
                }
            )
        })
        .collect();
    format!(
        "{{\"byteStride\":{},\"attrs\":[{}]}}",
        l.byte_stride,
        attrs.join(",")
    )
}

/// `updateMesh` decode: bytes -> unified float vertex layout.
#[wasm_bindgen]
pub fn sw_decode_vertices(format: &str, data: &[u8]) -> Vec<f32> {
    decode_vertices(format, data).0
}

/// `PIPELINE_FORMAT[pipeline]`'s format name.
#[wasm_bindgen]
pub fn sw_pipeline_format(pipeline: &str) -> String {
    Pipeline::from_name(pipeline).format_name().to_string()
}

/// `DEFAULT_PARAMS[pipeline]`.
#[wasm_bindgen]
pub fn sw_default_params(pipeline: &str) -> Vec<f64> {
    Pipeline::from_name(pipeline).default_params().to_vec()
}

/// `buildLightmapTable(tex)` -> the 61 x 61 x 3 lookup table.
#[wasm_bindgen]
pub fn sw_lightmap_table(px: &[u32], w: u32, h: u32) -> Vec<f32> {
    let src = LmSrc {
        id: 0,
        version: 0,
        w,
        h,
        px,
    };
    let mut c = LightmapCache::new();
    c.build(&src);
    c.table
}

/// `lightmap(tex, sky, block)` against a table built by `sw_lightmap_table`.
#[wasm_bindgen]
pub fn sw_lightmap_sample(table: &[f32], sky: f64, block: f64) -> Vec<f64> {
    let mut si = (sky * 4.0 + 0.5) as i64;
    let mut bi = (block * 4.0 + 0.5) as i64;
    si = si.clamp(0, LM_N as i64 - 1);
    bi = bi.clamp(0, LM_N as i64 - 1);
    let o = (si as usize * LM_N + bi as usize) * 3;
    if o + 2 >= table.len() {
        return vec![1.0, 1.0, 1.0];
    }
    vec![table[o] as f64, table[o + 1] as f64, table[o + 2] as f64]
}

/// `_post(d)` as a standalone full-screen pass.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn sw_post_process(
    params: &[f64],
    src: &[u32],
    src_w: u32,
    src_h: u32,
    aux: &[u32],
    aux_w: u32,
    aux_h: u32,
    dst: &[u32],
    dst_w: u32,
    dst_h: u32,
    blend_alpha: bool,
) -> Vec<u32> {
    let mut p = [0.0f64; 16];
    for i in 0..16 {
        if let Some(x) = params.get(i) {
            p[i] = *x;
        }
    }
    let mut fb = FrameBuffer {
        width: dst_w,
        height: dst_h,
        color: dst.to_vec(),
        depth: Vec::new(),
    };
    let sref = TexRef {
        width: src_w,
        height: src_h,
        repeat: false,
        levels: vec![LevelRef {
            w: src_w,
            h: src_h,
            px: src,
        }],
    };
    let aref = TexRef {
        width: aux_w,
        height: aux_h,
        repeat: false,
        levels: vec![LevelRef {
            w: aux_w,
            h: aux_h,
            px: aux,
        }],
    };
    post_pass(&mut fb, &sref, &aref, &p, blend_alpha);
    fb.color
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pack_color_orders_channels() {
        assert_eq!(pack_color(1.0, 0.0, 0.0, 1.0), 0xFF0000FF);
        assert_eq!(pack_color(0.0, 0.0, 0.0, 0.0), 0x00000000);
        assert_eq!(pack_color(0.5, 0.5, 0.5, 1.0), 0xFF808080);
    }

    #[test]
    fn mul4_identity() {
        let mut out = [0.0f64; 16];
        mul4(&mut out, &IDENTITY, &IDENTITY);
        for i in 0..16 {
            assert!((out[i] - IDENTITY[i]).abs() < 1e-12);
        }
    }

    #[test]
    fn terrain_decode_unpacks_positions() {
        // one terrain vertex at (0, 0, 0) with uv 0 and light 15/15
        let mut b = vec![0u8; 20];
        for i in 0..4 {
            let v: u16 = 8 * 2048;
            b[i * 2] = (v & 255) as u8;
            b[i * 2 + 1] = (v >> 8) as u8;
        }
        b[16] = 255;
        b[17] = 255;
        let (verts, n) = decode_vertices("terrain", &b);
        assert_eq!(n, 1);
        assert!(verts[0].abs() < 1e-4);
        assert!((verts[9] - 15.0).abs() < 1e-4);
    }

    #[test]
    fn lightmap_sample_is_white_for_a_white_texture() {
        let px = vec![0xFFFFFFFFu32; 16 * 16];
        let table = {
            let src = LmSrc {
                id: 0,
                version: 0,
                w: 16,
                h: 16,
                px: &px,
            };
            let mut c = LightmapCache::new();
            c.build(&src);
            c.table
        };
        let s = sw_lightmap_sample(&table, 15.0, 15.0);
        assert!((s[0] - 1.0).abs() < 1e-5 && (s[2] - 1.0).abs() < 1e-5);
    }
}

/// Free-function form of `SoftwareDevice::lm_src`, usable after the device has
/// been destructured into its fields.
fn self_lm_src<'a>(
    textures: &'a [Texture],
    fbs: &'a [FrameBuffer],
    handle: Option<usize>,
) -> Option<LmSrc<'a>> {
    let h = handle?;
    let t = textures.get(h)?;
    let (w, hh, px) = match t.rt {
        Some(i) => {
            let f = fbs.get(i)?;
            (f.width, f.height, f.color.as_slice())
        }
        None => (t.width, t.height, t.u32_px.as_slice()),
    };
    Some(LmSrc {
        id: h,
        version: t.version,
        w,
        h: hh,
        px,
    })
}
