//! Port of `client/js/gfx/webgpu.js`: the shader math as testable Rust kernels.
//!
//! `webgpu.rs` carries the verbatim WGSL sources (`HEADER_WGSL` plus the six
//! `SHADERS` entries) and the device state machine; this module re-implements
//! the pure math those shaders perform — fog, projection, lightmap lookup
//! coordinates, terrain position decoding, entity lighting, end-portal texgen,
//! post-processing helpers, the scissor rectangle and the frame-readback pixel
//! conversion — with hand-checked unit tests. WGSL semantics (`clamp`, `mix`,
//! `fract`, column-major `mat4x4f`, `d - d.brg` swizzles) are reproduced
//! exactly.
//!
//! This module also hosts the `client/js/gfx/device.js` helpers that
//! `webgpu.js` imports — `FORMAT` / `vertexLayout`, `TERRAIN_POS_SCALE`,
//! `PIPELINE_FORMAT`, the params builders plus `EntityParams` and
//! `DEFAULT_PARAMS`, `quadIndices` and `buildMips` — so `webgpu.rs` and any
//! other backend port share one table instead of duplicating it.

use wasm_bindgen::prelude::*;

// ------------------------------------------------------------ WGSL helpers

/// WGSL `clamp(x, 0.0, 1.0)`.
pub fn clamp01(x: f32) -> f32 {
    x.max(0.0).min(1.0)
}

/// WGSL `mix(x, y, a)` = `x * (1 - a) + y * a` (vec4, used by the post shader).
pub fn mix4(x: [f32; 4], y: [f32; 4], a: f32) -> [f32; 4] {
    let t = 1.0 - a;
    [
        x[0] * t + y[0] * a,
        x[1] * t + y[1] * a,
        x[2] * t + y[2] * a,
        x[3] * t + y[3] * a,
    ]
}

/// WGSL `fract(x)` = `x - floor(x)` (matches WGSL, not Rust's `fract`).
pub fn fract1(x: f32) -> f32 {
    x - x.floor()
}

/// JS: `Math.max(0, v | 0)` — ToInt32 truncates toward zero and wraps modulo
/// 2^32; NaN and ±Infinity convert to 0.
pub fn js_to_int32_max0(v: f64) -> u32 {
    if !v.is_finite() {
        return 0;
    }
    let t = v.trunc().rem_euclid(4294967296.0) as u32; // ToInt32
    (t as i32).max(0) as u32
}

// ------------------------------------------------------------ fogFactor (HEADER)

/// JS: WGSL `fn fogFactor(d: f32) -> f32` in `HEADER`.
///
/// `fog` is the uploaded `G.fog` vec4: `[fogStart(x), fogEnd(y), fogDensity(z),
/// fogMode(w)]` — mode 0 linear, 1 exp, 2 none, 3 exp2.
pub fn fog_factor(d: f32, fog: [f32; 4]) -> f32 {
    let (start, end, density, mode) = (fog[0], fog[1], fog[2], fog[3]);
    if mode > 1.5 && mode < 2.5 {
        return 0.0;
    }
    if mode > 2.5 {
        // 1.0 - clamp(exp(-pow(G.fog.z * d, 2.0)), 0.0, 1.0)
        let e = (-(density * d) * (density * d)).exp();
        return 1.0 - clamp01(e);
    }
    if mode < 0.5 {
        // clamp((d - G.fog.x) / max(0.0001, G.fog.y - G.fog.x), 0.0, 1.0)
        return clamp01((d - start) / 0.0001f32.max(end - start));
    }
    1.0 - clamp01((-density * d).exp())
}

// ------------------------------------------------------------ project (HEADER)

/// JS: WGSL `fn project(mv: vec4f) -> vec4f { var p = G.proj * mv; p.z = p.z * 0.5 + p.w * 0.5; return p; }`
///
/// `proj` is the 16-float `G.proj` upload interpreted exactly as WGSL's
/// column-major `mat4x4f` does.
pub fn project(proj: &[f32; 16], mv: [f32; 4]) -> [f32; 4] {
    // WGSL mat4x4f * vec4f: result[i] = dot(column i, mv)
    let mut p = [
        proj[0] * mv[0] + proj[4] * mv[1] + proj[8] * mv[2] + proj[12] * mv[3],
        proj[1] * mv[0] + proj[5] * mv[1] + proj[9] * mv[2] + proj[13] * mv[3],
        proj[2] * mv[0] + proj[6] * mv[1] + proj[10] * mv[2] + proj[14] * mv[3],
        proj[3] * mv[0] + proj[7] * mv[1] + proj[11] * mv[2] + proj[15] * mv[3],
    ];
    p[2] = p[2] * 0.5 + p[3] * 0.5;
    p
}

// ------------------------------------------------------------ lightmap (HEADER)

/// JS: WGSL `fn lightmap(l: vec2f) -> vec3f` — the lookup coordinates only
/// (`vec2f((l.y + 0.5) / 16.0, (l.x + 0.5) / 16.0)`); `l` = [sky, block] in 0..15.
/// The `textureSampleLevel(...).rgb` fetch itself is browser-bound.
pub fn lightmap_uv(l: [f32; 2]) -> [f32; 2] {
    [(l[1] + 0.5) / 16.0, (l[0] + 0.5) / 16.0]
}

// ------------------------------------------------------------ terrain vs

/// JS: terrain vertex shader — `let p = pp.xyz * (65535.0 / 2048.0) - 8.0;`
///
/// `pp` is the unorm16x4 position attribute decoded to 0..1 (its `w` carries
/// the state ID and is ignored here). For a raw packed value `q`:
/// `pp = q / 65535` so `p = q / 2048 - 8` on the 1/2048 block grid.
pub fn terrain_vertex_pos(pp: [f32; 3]) -> [f32; 3] {
    let s = 65535.0f32 / 2048.0;
    [pp[0] * s - 8.0, pp[1] * s - 8.0, pp[2] * s - 8.0]
}

// ------------------------------------------------------------ entity vs

/// JS: entity vertex shader — the GUI item light directions
/// (`select(..., vec3f(-0.237910, -0.634435, 0.735453), gui)`).
pub const ENTITY_GUI_LIGHT0: [f32; 3] = [-0.237910, -0.634435, 0.735453];
/// JS: entity vertex shader — second GUI light vector.
pub const ENTITY_GUI_LIGHT1: [f32; 3] = [0.028667, -0.927375, -0.373034];

/// JS: entity vertex shader — `let n = normalize(m3 * nrm);` where
/// `m3 = mat3x3f(D.model[0].xyz, D.model[1].xyz, D.model[2].xyz)` (the model's
/// three columns). `model_cols` = those columns.
pub fn entity_world_normal(model_cols: [[f32; 3]; 3], nrm: [f32; 3]) -> [f32; 3] {
    // WGSL mat3x3f * vec3f: result = col0 * v.x + col1 * v.y + col2 * v.z
    let x = model_cols[0][0] * nrm[0] + model_cols[1][0] * nrm[1] + model_cols[2][0] * nrm[2];
    let y = model_cols[0][1] * nrm[0] + model_cols[1][1] * nrm[1] + model_cols[2][1] * nrm[2];
    let z = model_cols[0][2] * nrm[0] + model_cols[1][2] * nrm[1] + model_cols[2][2] * nrm[2];
    normalize3([x, y, z])
}

/// WGSL `normalize(v)` — division by the length (a zero vector yields the same
/// infinities/NaNs WGSL produces).
pub fn normalize3(v: [f32; 3]) -> [f32; 3] {
    let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    [v[0] / l, v[1] / l, v[2] / l]
}

/// WGSL `dot(a, b)` for vec3f.
pub fn dot3(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/// JS: entity vertex shader — the two light vectors:
/// `l0 = select(normalize(vec3f(0.2, 1.0, -0.7)), GUI0, gui)` and the `l1`
/// counterpart, with `gui = D.p[2].w > 1.5`. `lighting` = `D.p[2].w`
/// (0 world item lighting, 1 none, 2 GUI item lighting).
pub fn entity_light_dirs(lighting: f32) -> ([f32; 3], [f32; 3]) {
    if lighting > 1.5 {
        (ENTITY_GUI_LIGHT0, ENTITY_GUI_LIGHT1)
    } else {
        (normalize3([0.2, 1.0, -0.7]), normalize3([-0.2, 1.0, 0.7]))
    }
}

/// JS: entity vertex shader —
/// `d = 0.4 + 0.6 * (max(dot(n, l0), 0.0) + max(dot(n, l1), 0.0));`
/// `o.shade = select(min(1.0, d), 1.0, D.p[2].w > 0.5 && !gui);`
pub fn entity_shade(n: [f32; 3], lighting: f32) -> f32 {
    let gui = lighting > 1.5;
    let (l0, l1) = entity_light_dirs(lighting);
    let d = 0.4 + 0.6 * (dot3(n, l0).max(0.0) + dot3(n, l1).max(0.0));
    if lighting > 0.5 && !gui {
        1.0
    } else {
        1.0f32.min(d)
    }
}

// ------------------------------------------------------------ endportal fs

/// JS: endportal fragment shader — screen-space texgen
/// (TileEntityEndPortalRenderer). `frag` is the framebuffer-space position
/// (`i.pos.xy`), `target_size` = `D.p[2].xy`, `scale` = `D.p[1].x`,
/// `angle` = `D.p[1].y` (radians), `offset` = `D.p[1].zw`. Returns
/// `fract(0.5 + 0.5 * r)` — the coordinates passed to `textureSample`.
pub fn endportal_texgen(
    frag: [f32; 2],
    target_size: [f32; 2],
    scale: f32,
    angle: f32,
    offset: [f32; 2],
) -> [f32; 2] {
    // let ndc = vec2f(i.pos.x / D.p[2].x * 2.0 - 1.0, 1.0 - i.pos.y / D.p[2].y * 2.0);
    let ndc = [frag[0] / target_size[0] * 2.0 - 1.0, 1.0 - frag[1] / target_size[1] * 2.0];
    // let s = ndc * D.p[1].x;
    let s = [ndc[0] * scale, ndc[1] * scale];
    // let r = vec2f(s.x * c - s.y * sn, s.x * sn + s.y * c) + D.p[1].zw;
    let c = angle.cos();
    let sn = angle.sin();
    let r = [s[0] * c - s[1] * sn + offset[0], s[0] * sn + s[1] * c + offset[1]];
    // textureSample(tex0, samp0, fract(0.5 + 0.5 * r))
    [fract1(0.5 + 0.5 * r[0]), fract1(0.5 + 0.5 * r[1])]
}

// ------------------------------------------------------------ post fs helpers

/// JS: post fragment shader `fetchIn` / `fetchAux` — the per-axis texel index:
/// `clamp(vec2i(floor(vec2f(c.x, 1.0 - c.y) * vec2f(n))), vec2i(0), n - 1)`.
/// `v` is one axis of the coordinate AFTER the y-flip (`1.0 - c.y`), `size`
/// the texture dimension on that axis.
pub fn post_fetch_texel(v: f32, size: i32) -> i32 {
    ((v * size as f32).floor() as i32).clamp(0, size - 1)
}

/// JS: post fragment shader mode 4 (blur):
/// `one = 1.0 / inSize; R = D.p[1].z;` accumulate
/// `fetchIn(tc + one * r * D.p[1].xy)` for `r` from `-R` to `R` stepping 1.0,
/// then return `vec4f(acc.rgb / (R * 2.0 + 1.0), ta)` — alpha is the raw sum.
pub fn post_blur(
    tc: [f32; 2],
    in_size: [f32; 2],
    blur_dir: [f32; 2],
    radius: f32,
    fetch_in: impl Fn([f32; 2]) -> [f32; 4],
) -> [f32; 4] {
    let one = [1.0 / in_size[0], 1.0 / in_size[1]];
    let mut acc = [0.0f32; 4];
    let mut r = -radius;
    while r <= radius {
        let s = fetch_in([tc[0] + one[0] * r * blur_dir[0], tc[1] + one[1] * r * blur_dir[1]]);
        for i in 0..4 {
            acc[i] += s[i];
        }
        r += 1.0;
    }
    let n = radius * 2.0 + 1.0;
    [acc[0] / n, acc[1] / n, acc[2] / n, acc[3]]
}

/// JS: post fragment shader mode 14 — hue rotation by `t` turns (the shader's
/// `T = D.p[0].y`), exact port of the WGSL including the `d - d.brg` swizzle
/// arithmetic. `rgb` is the sampled (offset) pixel; returns the output rgb.
pub fn post_hsv_shift(rgb: [f32; 3], t: f32) -> [f32; 3] {
    // var hsv = vec3f(0.0, 0.0, max(rgb.r, max(rgb.g, rgb.b)));
    let mut hsv = [0.0f32, 0.0, rgb[0].max(rgb[1]).max(rgb[2])];
    // let c = hsv.z - min(rgb.r, min(rgb.g, rgb.b));
    let c = hsv[2] - rgb[0].min(rgb[1]).min(rgb[2]);
    if c != 0.0 {
        hsv[1] = c / hsv[2];
        // var d = (hsv.z - rgb) / c; d = d - d.brg; d = vec3f(d.r + 2.0, d.g + 4.0, d.b);
        let d0 = [(hsv[2] - rgb[0]) / c, (hsv[2] - rgb[1]) / c, (hsv[2] - rgb[2]) / c];
        // d.brg == (d.b, d.r, d.g): d - d.brg == (r - b, g - r, b - g)
        let d1 = [d0[0] - d0[2], d0[1] - d0[0], d0[2] - d0[1]];
        let d = [d1[0] + 2.0, d1[1] + 4.0, d1[2]];
        // var hx = d.g; if (rgb.r >= hsv.z) { hx = d.b; } else if (rgb.g >= hsv.z) { hx = d.r; }
        let mut hx = d[1];
        if rgb[0] >= hsv[2] {
            hx = d[2];
        } else if rgb[1] >= hsv[2] {
            hx = d[0];
        }
        hsv[0] = fract1(hx / 6.0);
    }
    hsv[0] = fract1(hsv[0] + t);
    let x = hsv[0] * 6.0;
    let h = [
        clamp01((x - 3.0).abs() - 1.0),
        clamp01(2.0 - (x - 2.0).abs()),
        clamp01(2.0 - (x - 4.0).abs()),
    ];
    [
        ((h[0] - 1.0) * hsv[1] + 1.0) * hsv[2],
        ((h[1] - 1.0) * hsv[1] + 1.0) * hsv[2],
        ((h[2] - 1.0) * hsv[1] + 1.0) * hsv[2],
    ]
}

/// JS: post fragment shader mode 5 / default branch (spider: rotscale +
/// spiderclip). `in_rotation` = `D.p[0].y` (degrees), `in_scale` = `D.p[1].xy`,
/// `in_offset` = `D.p[1].zw`, `scissor` = `D.p[2]` (S), `vignette` = `D.p[3]`
/// (V). `fetch_in` / `fetch_aux` are the texture fetches (`fetchIn` on
/// DiffuseSampler, `fetchAux` on the lightmap slot = BlurSampler).
pub fn post_rotscale_clip(
    tc: [f32; 2],
    in_rotation: f32,
    in_scale: [f32; 2],
    in_offset: [f32; 2],
    scissor: [f32; 4],
    vignette: [f32; 4],
    fetch_in: impl Fn([f32; 2]) -> [f32; 4],
    fetch_aux: impl Fn([f32; 2]) -> [f32; 4],
) -> [f32; 4] {
    // let a = D.p[0].y * 0.0174532925; let cs = cos(a); let sn = sin(a);
    let a = in_rotation * 0.0174532925;
    let cs = a.cos();
    let sn = a.sin();
    // let sc = vec2f(tc.x * cs - tc.y * sn, tc.y * cs + tc.x * sn) * D.p[1].xy + D.p[1].zw;
    let sc = [
        (tc[0] * cs - tc[1] * sn) * in_scale[0] + in_offset[0],
        (tc[1] * cs + tc[0] * sn) * in_scale[1] + in_offset[1],
    ];
    let s = scissor;
    let v = vignette;
    let b = fetch_aux(tc);
    let mut o = fetch_in(sc);
    if sc[0] < s[0] || sc[1] < s[1] || sc[0] > s[2] || sc[1] > s[3] {
        o = b;
    }
    if sc[0] < v[0] {
        o = mix4(b, o, (s[0] - sc[0]) / (s[0] - v[0]));
    }
    if sc[1] < v[1] {
        o = mix4(b, o, (s[1] - sc[1]) / (s[1] - v[1]));
    }
    if sc[0] > v[2] {
        o = mix4(b, o, (s[2] - sc[0]) / (s[2] - v[2]));
    }
    if sc[1] > v[3] {
        o = mix4(b, o, (s[3] - sc[1]) / (s[3] - v[3]));
    }
    [o[0], o[1], o[2], 1.0]
}

// ------------------------------------------------------------ setScissorRect math

/// JS: `_applyScissor` —
/// `x = max(0, floor(r[0])); y = max(0, floor(r[1]));`
/// `w = max(0, min(tw - x, ceil(r[2]))); h = max(0, min(th - y, ceil(r[3])));`
/// `r` is the scissor rect `[x, y, w, h]`, `tw`/`th` the target size. The
/// `!r` branch (`setScissorRect(0, 0, tw, th)`) is handled by the caller.
pub fn scissor_rect(r: &[f64; 4], tw: u32, th: u32) -> (u32, u32, u32, u32) {
    let x = r[0].floor().max(0.0);
    let y = r[1].floor().max(0.0);
    let w = (tw as f64 - x).min(r[2].ceil()).max(0.0);
    let h = (th as f64 - y).min(r[3].ceil()).max(0.0);
    (x as u32, y as u32, w as u32, h as u32)
}

// ------------------------------------------------------------ frame readback

/// JS: `endFrame` — `const bpr = Math.ceil(this.width * 4 / 256) * 256;`
pub fn readback_bytes_per_row(width: u32) -> u32 {
    ((width as f64 * 4.0 / 256.0).ceil() * 256.0) as u32
}

/// JS: `_finishReadback` — the per-pixel conversion after `mapAsync(READ)` +
/// `getMappedRange()` (the mapping itself is browser-bound; callers supply the
/// mapped bytes `src`, `bpr` bytes per row, `w` x `h` pixels):
/// `out[o] = src[s + (bgra ? 2 : 0)]; out[o+1] = src[s+1];`
/// `out[o+2] = src[s + (bgra ? 0 : 2)]; out[o+3] = 255;`
pub fn readback_pixels(src: &[u8], bpr: usize, w: u32, h: u32, bgra: bool) -> Vec<u8> {
    let mut out = vec![0u8; (w as usize) * (h as usize) * 4];
    for y in 0..h as usize {
        for x in 0..w as usize {
            let s = y * bpr + x * 4;
            let o = (y * w as usize + x) * 4;
            out[o] = src[s + if bgra { 2 } else { 0 }];
            out[o + 1] = src[s + 1];
            out[o + 2] = src[s + if bgra { 0 } else { 2 }];
            out[o + 3] = 255;
        }
    }
    out
}

// ------------------------------------------------------------ device.js FORMAT / vertexLayout / PIPELINE_FORMAT
// (webgpu.js: `import { ... vertexLayout } from './device.js'`)

/// JS (device.js): `TERRAIN_POS_SCALE = 2048` — the packed terrain grid scale
/// (`(p + 8) * 2048`, see `terrain_vertex_pos` above).
pub const TERRAIN_POS_SCALE: f64 = 2048.0;

/// JS (device.js): float-format attribute types `'f32' | 'unorm16' | 'unorm8'`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AttrType {
    /// Plain 32-bit float attribute.
    F32,
    /// 16-bit normalised attribute (0..1 in the shader).
    Unorm16,
    /// 8-bit normalised attribute (0..1 in the shader).
    Unorm8,
}

/// JS (device.js): one `[name, components, offset, type]` entry of a `FORMAT`
/// attr list. `offset` is a byte offset for packed formats and a float offset
/// otherwise (matching the raw device.js arrays).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FormatAttr {
    /// Attribute name ('pos', 'uv', 'col', 'light', 'nrm').
    pub name: &'static str,
    /// Component count.
    pub size: u32,
    /// Byte offset (packed formats) or float offset (float formats).
    pub offset: u32,
    /// Attribute type.
    pub ty: AttrType,
}

/// JS (device.js): a `FORMAT` entry. Packed formats carry `byteStride` and
/// byte offsets; float formats carry `stride` in floats (byteStride = stride * 4).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Format {
    /// Format name ('terrain', 'lit', 'entity', 'color').
    pub name: &'static str,
    /// Whether the format is packed (byte-oriented).
    pub packed: bool,
    /// Byte stride (packed formats only; 0 otherwise).
    pub byte_stride: u32,
    /// Stride in floats (float formats only; 0 otherwise).
    pub stride: u32,
    /// Attribute list.
    pub attrs: &'static [FormatAttr],
}

/// JS (device.js): `FORMAT.terrain` — 20 bytes/vertex (like Sodium's compact
/// format): pos unorm16 x4, uv unorm16 x2, col unorm8 x4, light unorm8 x2.
pub const FORMAT_TERRAIN: Format = Format {
    name: "terrain",
    packed: true,
    byte_stride: 20,
    stride: 0,
    attrs: &[
        FormatAttr { name: "pos", size: 4, offset: 0, ty: AttrType::Unorm16 },
        FormatAttr { name: "uv", size: 2, offset: 8, ty: AttrType::Unorm16 },
        FormatAttr { name: "col", size: 4, offset: 12, ty: AttrType::Unorm8 },
        FormatAttr { name: "light", size: 2, offset: 16, ty: AttrType::Unorm8 },
    ],
};

/// JS (device.js): `FORMAT.lit` — stride 11 floats: pos 3, uv 2, col 4, light 2.
pub const FORMAT_LIT: Format = Format {
    name: "lit",
    packed: false,
    byte_stride: 0,
    stride: 11,
    attrs: &[
        FormatAttr { name: "pos", size: 3, offset: 0, ty: AttrType::F32 },
        FormatAttr { name: "uv", size: 2, offset: 3, ty: AttrType::F32 },
        FormatAttr { name: "col", size: 4, offset: 5, ty: AttrType::F32 },
        FormatAttr { name: "light", size: 2, offset: 9, ty: AttrType::F32 },
    ],
};

/// JS (device.js): `FORMAT.entity` — stride 11 floats: pos 3, uv 2, nrm 3, col 3.
pub const FORMAT_ENTITY: Format = Format {
    name: "entity",
    packed: false,
    byte_stride: 0,
    stride: 11,
    attrs: &[
        FormatAttr { name: "pos", size: 3, offset: 0, ty: AttrType::F32 },
        FormatAttr { name: "uv", size: 2, offset: 3, ty: AttrType::F32 },
        FormatAttr { name: "nrm", size: 3, offset: 5, ty: AttrType::F32 },
        FormatAttr { name: "col", size: 3, offset: 8, ty: AttrType::F32 },
    ],
};

/// JS (device.js): `FORMAT.color` — stride 9 floats: pos 3, uv 2, col 4.
pub const FORMAT_COLOR: Format = Format {
    name: "color",
    packed: false,
    byte_stride: 0,
    stride: 9,
    attrs: &[
        FormatAttr { name: "pos", size: 3, offset: 0, ty: AttrType::F32 },
        FormatAttr { name: "uv", size: 2, offset: 3, ty: AttrType::F32 },
        FormatAttr { name: "col", size: 4, offset: 5, ty: AttrType::F32 },
    ],
};

/// JS (device.js): `FORMAT[name]` — the four vertex formats.
pub fn format_by_name(name: &str) -> Option<&'static Format> {
    match name {
        "terrain" => Some(&FORMAT_TERRAIN),
        "lit" => Some(&FORMAT_LIT),
        "entity" => Some(&FORMAT_ENTITY),
        "color" => Some(&FORMAT_COLOR),
        _ => None,
    }
}

/// JS (device.js): `PIPELINE_FORMAT` — the vertex format each shading pipeline
/// uses (endportal and post share the color format).
pub fn pipeline_format(name: &str) -> Option<&'static Format> {
    match name {
        "terrain" => Some(&FORMAT_TERRAIN),
        "lit" => Some(&FORMAT_LIT),
        "entity" => Some(&FORMAT_ENTITY),
        "color" | "endportal" | "post" => Some(&FORMAT_COLOR),
        _ => None,
    }
}

/// JS (device.js): one `vertexLayout(f)` attribute (`{ size, byteOffset, type }`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LayoutAttr {
    /// Component count.
    pub size: u32,
    /// Byte offset within the vertex.
    pub byte_offset: u32,
    /// Attribute type.
    pub ty: AttrType,
}

/// JS (device.js): `vertexLayout(f)` result — `{ byteStride, attrs }`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VertexLayout {
    /// Byte stride between vertices.
    pub byte_stride: u32,
    /// Per-attribute layout.
    pub attrs: Vec<LayoutAttr>,
}

/// JS (device.js): `vertexLayout(f)` — byte stride and offsets for any format.
pub fn vertex_layout(f: &Format) -> VertexLayout {
    if f.packed {
        VertexLayout {
            byte_stride: f.byte_stride,
            attrs: f.attrs.iter().map(|a| LayoutAttr { size: a.size, byte_offset: a.offset, ty: a.ty }).collect(),
        }
    } else {
        VertexLayout {
            byte_stride: f.stride * 4,
            attrs: f.attrs.iter().map(|a| LayoutAttr { size: a.size, byte_offset: a.offset * 4, ty: AttrType::F32 }).collect(),
        }
    }
}

// ------------------------------------------------------------ device.js quadIndices / buildMips
// (webgpu.js: `import { quadIndices, buildMips } from './device.js'`)

/// JS (device.js): `quadIndices(quads)` — `Uint32Array(quads * 6)` with, per
/// quad `i`, the two triangles `[v, v+1, v+2]`, `[v, v+2, v+3]` (`v = i * 4`).
pub fn quad_indices(quads: u32) -> Vec<u32> {
    let mut idx = vec![0u32; quads as usize * 6];
    for i in 0..quads {
        let v = i * 4;
        let o = i as usize * 6;
        idx[o] = v;
        idx[o + 1] = v + 1;
        idx[o + 2] = v + 2;
        idx[o + 3] = v;
        idx[o + 4] = v + 2;
        idx[o + 5] = v + 3;
    }
    idx
}

/// JS (device.js): one `buildMips` level `{ width, height, data }` (RGBA,
/// level 0 excluded).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MipLevel {
    /// Level width in pixels.
    pub width: u32,
    /// Level height in pixels.
    pub height: u32,
    /// RGBA bytes.
    pub data: Vec<u8>,
}

/// JS (device.js): `buildMips(width, height, data, maxLevels = 4)` — a
/// box-filtered mip chain. Colour is alpha-weighted
/// (`dst.rgb = sum(c * a) / sum(a)`, kept 0 when `a == 0`) and the alpha is a
/// plain average over the 2x2 footprint (`dst.a = sum(a) / n`). Source texels
/// are clamped for odd sizes (`Math.min(w - 1, x * 2 + dx)`).
pub fn build_mips(width: u32, height: u32, data: &[u8], max_levels: u32) -> Vec<MipLevel> {
    let mut out = Vec::new();
    let (mut w, mut h) = (width, height);
    let mut src = data.to_vec();
    let mut l = 0u32;
    while l < max_levels && (w > 1 || h > 1) {
        let nw = (w >> 1).max(1);
        let nh = (h >> 1).max(1);
        let mut dst = vec![0u8; (nw * nh * 4) as usize];
        for y in 0..nh {
            for x in 0..nw {
                let mut r = 0f32;
                let mut g = 0f32;
                let mut b = 0f32;
                let mut a = 0f32;
                let mut n = 0f32;
                for dy in 0..2u32 {
                    for dx in 0..2u32 {
                        let sx = (w - 1).min(x * 2 + dx);
                        let sy = (h - 1).min(y * 2 + dy);
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
        out.push(MipLevel { width: nw, height: nh, data: dst.clone() });
        w = nw;
        h = nh;
        src = dst;
        l += 1;
    }
    out
}

// ------------------------------------------------------------ device.js params helpers / DEFAULT_PARAMS
// (webgpu.js: `import { DEFAULT_PARAMS } from './device.js'`)

/// JS (device.js): `terrainParams(alphaTest = 0, opacity = 1, out = new
/// Float32Array(16), mipBias = 0)` — a fresh 16-float params array with
/// `[alphaTest, opacity, mipBias]` written.
pub fn terrain_params(alpha_test: f32, opacity: f32, mip_bias: f32) -> [f32; 16] {
    let mut out = [0.0f32; 16];
    out[0] = alpha_test;
    out[1] = opacity;
    out[2] = mip_bias;
    out
}

/// JS (device.js): `litParams(alphaTest = 0.1)` — params with `[alphaTest]`.
pub fn lit_params(alpha_test: f32) -> [f32; 16] {
    let mut out = [0.0f32; 16];
    out[0] = alpha_test;
    out
}

/// JS (device.js): `colorParams(r = 1, g = 1, b = 1, a = 1, alphaTest = 0,
/// useFog = 0)` — `[r, g, b, a]` then `[alphaTest, useFog]`.
pub fn color_params(r: f32, g: f32, b: f32, a: f32, alpha_test: f32, use_fog: f32) -> [f32; 16] {
    let mut out = [0.0f32; 16];
    out[0] = r;
    out[1] = g;
    out[2] = b;
    out[3] = a;
    out[4] = alpha_test;
    out[5] = use_fog;
    out
}

/// JS (device.js): `class EntityParams` — the entity pipeline's 4 x vec4
/// params object (tint / overlay / light+mode / alphaTest+uv transform).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct EntityParams {
    /// The 16-float params array (`p`).
    pub p: [f32; 16],
}

impl EntityParams {
    /// JS: `constructor()` — tint white, light (15, 15), alphaTest 0.1.
    pub fn new() -> Self {
        let mut e = EntityParams { p: [0.0; 16] };
        e.set_tint(1.0, 1.0, 1.0, 1.0);
        e.set_light(15.0, 15.0);
        e.p[12] = 0.1;
        e
    }

    /// JS: `setTint(r, g, b, a = 1)` — `p[0..4]`.
    pub fn set_tint(&mut self, r: f32, g: f32, b: f32, a: f32) -> &mut Self {
        self.p[0] = r;
        self.p[1] = g;
        self.p[2] = b;
        self.p[3] = a;
        self
    }

    /// JS: `setOverlay(r, g, b, a)` — `p[4..8]`.
    pub fn set_overlay(&mut self, r: f32, g: f32, b: f32, a: f32) -> &mut Self {
        self.p[4] = r;
        self.p[5] = g;
        self.p[6] = b;
        self.p[7] = a;
        self
    }

    /// JS: `setLight(sky, block)` — `p[8], p[9]`.
    pub fn set_light(&mut self, sky: f32, block: f32) -> &mut Self {
        self.p[8] = sky;
        self.p[9] = block;
        self
    }

    /// JS: `setFullBright(v)` — `p[10] = v ? 1 : 0`.
    pub fn set_full_bright(&mut self, v: bool) -> &mut Self {
        self.p[10] = if v { 1.0 } else { 0.0 };
        self
    }

    /// JS: `setNoLighting(v)` — `p[11] = v ? 1 : 0`.
    pub fn set_no_lighting(&mut self, v: bool) -> &mut Self {
        self.p[11] = if v { 1.0 } else { 0.0 };
        self
    }

    /// JS: `setGuiLighting(v)` — `p[11] = v ? 2 : 0` (RenderHelper.enableGUIStandardItemLighting).
    pub fn set_gui_lighting(&mut self, v: bool) -> &mut Self {
        self.p[11] = if v { 2.0 } else { 0.0 };
        self
    }

    /// JS: `setAlphaTest(v)` — `p[12]`.
    pub fn set_alpha_test(&mut self, v: f32) -> &mut Self {
        self.p[12] = v;
        self
    }

    /// JS: `setUvTransform(du, dv, scale = 0)` — `p[13], p[14], p[15]`.
    pub fn set_uv_transform(&mut self, du: f32, dv: f32, scale: f32) -> &mut Self {
        self.p[13] = du;
        self.p[14] = dv;
        self.p[15] = scale;
        self
    }
}

/// JS (device.js): `DEFAULT_PARAMS.terrain = terrainParams(0, 1)` —
/// `[alphaTest 0, opacity 1, mipBias 0, 0...]`.
pub const DEFAULT_PARAMS_TERRAIN: [f32; 16] =
    [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

/// JS (device.js): `DEFAULT_PARAMS.lit = litParams(0)`.
pub const DEFAULT_PARAMS_LIT: [f32; 16] = [0.0; 16];

/// JS (device.js): `DEFAULT_PARAMS.entity = new EntityParams().setAlphaTest(0).p`
/// — tint (1, 1, 1, 1), light (15, 15), alphaTest 0.
pub const DEFAULT_PARAMS_ENTITY: [f32; 16] =
    [1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 15.0, 15.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

/// JS (device.js): `DEFAULT_PARAMS.color = colorParams(1, 1, 1, 1)`.
pub const DEFAULT_PARAMS_COLOR: [f32; 16] =
    [1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

/// JS (device.js): `DEFAULT_PARAMS.endportal = new Float32Array(16)`.
pub const DEFAULT_PARAMS_ENDPORTAL: [f32; 16] = [0.0; 16];

/// JS (device.js): `DEFAULT_PARAMS.post = new Float32Array([0, 0, 0, 0, 1, 1, 1, 1, 0, ...])`.
pub const DEFAULT_PARAMS_POST: [f32; 16] =
    [0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

/// JS (device.js): `DEFAULT_PARAMS[name]` — the params used when a draw passes
/// none; `None` for an unknown pipeline name (JS falls through to `ZERO16`).
pub fn default_params(name: &str) -> Option<&'static [f32; 16]> {
    match name {
        "terrain" => Some(&DEFAULT_PARAMS_TERRAIN),
        "lit" => Some(&DEFAULT_PARAMS_LIT),
        "entity" => Some(&DEFAULT_PARAMS_ENTITY),
        "color" => Some(&DEFAULT_PARAMS_COLOR),
        "endportal" => Some(&DEFAULT_PARAMS_ENDPORTAL),
        "post" => Some(&DEFAULT_PARAMS_POST),
        _ => None,
    }
}

// ------------------------------------------------------------ wasm-bindgen surface

fn at(v: &[f32], i: usize) -> f32 {
    v.get(i).copied().unwrap_or(0.0)
}

/// JS: WGSL `fogFactor` exposed to JavaScript.
#[wasm_bindgen]
pub fn js_webgpu_fog_factor(d: f32, fog: Vec<f32>) -> f32 {
    fog_factor(d, [at(&fog, 0), at(&fog, 1), at(&fog, 2), at(&fog, 3)])
}

/// JS: WGSL `lightmap` lookup coordinates exposed to JavaScript.
#[wasm_bindgen]
pub fn js_webgpu_lightmap_uv(sky: f32, block: f32) -> Vec<f32> {
    lightmap_uv([sky, block]).to_vec()
}

/// JS: terrain vertex decode exposed to JavaScript.
#[wasm_bindgen]
pub fn js_webgpu_terrain_vertex_pos(x: f32, y: f32, z: f32) -> Vec<f32> {
    terrain_vertex_pos([x, y, z]).to_vec()
}

/// JS: entity shade term exposed to JavaScript.
#[wasm_bindgen]
pub fn js_webgpu_entity_shade(nx: f32, ny: f32, nz: f32, lighting: f32) -> f32 {
    entity_shade([nx, ny, nz], lighting)
}

/// JS: end-portal texgen exposed to JavaScript.
#[wasm_bindgen]
pub fn js_webgpu_endportal_texgen(
    frag_x: f32,
    frag_y: f32,
    target_w: f32,
    target_h: f32,
    scale: f32,
    angle: f32,
    off_u: f32,
    off_v: f32,
) -> Vec<f32> {
    endportal_texgen([frag_x, frag_y], [target_w, target_h], scale, angle, [off_u, off_v]).to_vec()
}

/// JS: `endFrame` readback bytes-per-row formula exposed to JavaScript.
#[wasm_bindgen]
pub fn js_webgpu_readback_bytes_per_row(width: u32) -> u32 {
    readback_bytes_per_row(width)
}

// ------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;

    fn approx(a: f32, b: f32) {
        assert!((a - b).abs() < 1e-5, "{} != {}", a, b);
    }

    #[test]
    fn js_to_int32_matches_js_semantics() {
        assert_eq!(js_to_int32_max0(3.9), 3);
        assert_eq!(js_to_int32_max0(-2.5), 0);
        assert_eq!(js_to_int32_max0(f64::NAN), 0);
        assert_eq!(js_to_int32_max0(f64::INFINITY), 0);
        assert_eq!(js_to_int32_max0(2147483648.0), 0); // | 0 wraps to -2^31
        assert_eq!(js_to_int32_max0(5.0), 5);
    }

    #[test]
    fn fog_factor_modes() {
        // mode 2 (none): 1.5 < w < 2.5 -> 0
        assert_eq!(fog_factor(100.0, [10.0, 20.0, 0.5, 2.0]), 0.0);
        // mode 3 (exp2): 1 - clamp(exp(-(density*d)^2), 0, 1)
        approx(fog_factor(1.0, [0.0, 0.0, 0.5, 3.0]), 1.0 - f32::exp(-0.25));
        approx(fog_factor(0.0, [0.0, 0.0, 0.5, 3.0]), 0.0); // exp(0) = 1
        // mode 0 (linear)
        assert_eq!(fog_factor(15.0, [10.0, 20.0, 0.5, 0.0]), 0.5);
        assert_eq!(fog_factor(5.0, [10.0, 20.0, 0.5, 0.0]), 0.0);
        assert_eq!(fog_factor(25.0, [10.0, 20.0, 0.5, 0.0]), 1.0);
        // degenerate range: max(0.0001, 0) denominator
        assert_eq!(fog_factor(0.0001, [0.0, 0.0, 0.0, 0.0]), 1.0);
        // mode 1 (exp): 1 - exp(-density*d)
        approx(fog_factor(2.0, [0.0, 0.0, 0.5, 1.0]), 1.0 - f32::exp(-1.0));
    }

    #[test]
    fn project_multiplies_and_remaps_z() {
        // identity projection: only the z remap applies
        let proj = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
        assert_eq!(project(&proj, [1.0, 2.0, 3.0, 4.0]), [1.0, 2.0, 3.5, 4.0]);
        // scale 2 on the diagonal (column-major layout check)
        let proj2 = [2.0, 0.0, 0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 1.0];
        let p = project(&proj2, [1.0, 1.0, 1.0, 2.0]);
        assert_eq!(p, [2.0, 2.0, 2.0, 2.0]); // z = 2*0.5 + 2*0.5
    }

    #[test]
    fn lightmap_uv_swaps_sky_block() {
        assert_eq!(lightmap_uv([15.0, 0.0]), [0.03125, 0.96875]);
        assert_eq!(lightmap_uv([0.0, 0.0]), [0.03125, 0.03125]);
    }

    #[test]
    fn terrain_decode_matches_1_over_2048_grid() {
        let p = terrain_vertex_pos([0.5, 0.0, 1.0]);
        approx(p[0], 0.5 * (65535.0f32 / 2048.0) - 8.0); // 7.99975585938
        approx(p[1], -8.0);
        // pp[2] = 1.0 decodes to the top of the 1/2048 grid: 65535/2048 - 8.
        approx(p[2], (65535.0f32 / 2048.0) - 8.0);
        // a raw unorm16 value q decodes to q / 2048 - 8 (exact grid positions)
        let q = 4096.0f32 / 65535.0;
        approx(terrain_vertex_pos([q, 0.0, 0.0])[0], 2.0 - 8.0);
    }

    #[test]
    fn entity_shade_world_gui_none() {
        // world lighting, normal +z: only l1 faces it (l1.z = 0.7 / sqrt(1.53))
        let l1z = 0.7f32 / 1.53f32.sqrt();
        approx(entity_shade([0.0, 0.0, 1.0], 0.0), 0.4 + 0.6 * l1z);
        // GUI lighting: l0.z = 0.735453 (the GUI vectors are used as-is)
        approx(entity_shade([0.0, 0.0, 1.0], 2.0), 0.4 + 0.6 * 0.735453);
        // lighting mode 1 (none): shade forced to 1
        assert_eq!(entity_shade([0.0, 0.0, 1.0], 1.0), 1.0);
        // clamped at 1 for fully lit normals (min(1.0, d))
        assert_eq!(entity_shade([0.0, 1.0, 0.0], 0.0), 1.0);
        // negative contributions clamp to 0 (max(dot, 0))
        let l0 = normalize3([0.2, 1.0, -0.7]);
        approx(entity_shade([0.0, 0.0, -1.0], 0.0), 0.4 + 0.6 * dot3([0.0, 0.0, -1.0], l0).max(0.0));
    }

    #[test]
    fn entity_world_normal_uses_model_columns() {
        let ident = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let n = entity_world_normal(ident, [3.0, 4.0, 0.0]);
        approx(n[0], 0.6);
        approx(n[1], 0.8);
        approx(n[2], 0.0);
        // uniform scale does not change the normalized direction
        let scaled = [[2.0, 0.0, 0.0], [0.0, 2.0, 0.0], [0.0, 0.0, 2.0]];
        let n = entity_world_normal(scaled, [3.0, 4.0, 0.0]);
        approx(n[0], 0.6);
        approx(n[1], 0.8);
    }

    #[test]
    fn endportal_texgen_rotates_and_wraps() {
        // fragment at the target centre -> ndc (0, 0) -> pure offset
        let uv = endportal_texgen([2.0, 2.0], [4.0, 4.0], 3.0, 0.0, [0.1, 0.2]);
        approx(uv[0], 0.55);
        approx(uv[1], 0.6);
        // right edge with scale 1, angle 0, no offset: fract(0.5 + 0.5) = 0
        let uv = endportal_texgen([4.0, 2.0], [4.0, 4.0], 1.0, 0.0, [0.0, 0.0]);
        approx(uv[0], 0.0);
        approx(uv[1], 0.5);
        // quarter turn maps (1, 0) onto (0, 1)
        let uv = endportal_texgen([4.0, 2.0], [4.0, 4.0], 1.0, std::f32::consts::FRAC_PI_2, [0.0, 0.0]);
        approx(uv[0], 0.5);
        approx(uv[1], 0.0);
    }

    #[test]
    fn post_fetch_texel_clamps_like_wgsl() {
        assert_eq!(post_fetch_texel(0.999, 4), 3);
        assert_eq!(post_fetch_texel(1.5, 4), 3);
        assert_eq!(post_fetch_texel(-0.2, 4), 0);
        assert_eq!(post_fetch_texel(0.49, 2), 0);
        assert_eq!(post_fetch_texel(0.5, 2), 1);
    }

    #[test]
    fn post_blur_averages_rgb_keeps_alpha_sum() {
        let v = [0.2f32, 0.4, 0.6, 0.8];
        let out = post_blur([0.5, 0.5], [4.0, 4.0], [1.0, 0.0], 1.0, |_| v);
        approx(out[0], 0.2);
        approx(out[1], 0.4);
        approx(out[2], 0.6);
        approx(out[3], 2.4); // ta = 3 * 0.8 (alpha is NOT divided)
        // radius 0 -> single fetch
        let out = post_blur([0.5, 0.5], [4.0, 4.0], [0.0, 1.0], 0.0, |_| v);
        approx(out[3], 0.8);
    }

    #[test]
    fn post_hsv_shift_preserves_gray_and_rotates_red() {
        // achromatic: c == 0 branch, hsv.y = 0 -> grey preserved
        let g = post_hsv_shift([0.5, 0.5, 0.5], 0.25);
        approx(g[0], 0.5);
        approx(g[1], 0.5);
        approx(g[2], 0.5);
        // red at T = 0 stays red
        let r = post_hsv_shift([1.0, 0.0, 0.0], 0.0);
        approx(r[0], 1.0);
        approx(r[1], 0.0);
        approx(r[2], 0.0);
        // red at T = 1/6 becomes yellow
        let y = post_hsv_shift([1.0, 0.0, 0.0], 1.0 / 6.0);
        approx(y[0], 1.0);
        approx(y[1], 1.0);
        approx(y[2], 0.0);
        // green at T = 0 stays green
        let gr = post_hsv_shift([0.0, 1.0, 0.0], 0.0);
        approx(gr[0], 0.0);
        approx(gr[1], 1.0);
        approx(gr[2], 0.0);
    }

    #[test]
    fn post_rotscale_clip_blends_at_the_vignette_edge() {
        let fin = |_| [1.0f32, 1.0, 1.0, 1.0];
        let faux = |_| [0.0f32, 0.0, 0.0, 1.0];
        let s = [0.1, 0.1, 0.9, 0.9];
        let v = [0.2, 0.2, 0.8, 0.8];
        // inside both: plain fetch
        let o = post_rotscale_clip([0.5, 0.5], 0.0, [1.0, 1.0], [0.0, 0.0], s, v, fin, faux);
        assert_eq!(o, [1.0, 1.0, 1.0, 1.0]);
        // outside the scissor: aux
        let o = post_rotscale_clip([0.05, 0.5], 0.0, [1.0, 1.0], [0.0, 0.0], s, v, fin, faux);
        assert_eq!(o, [0.0, 0.0, 0.0, 1.0]);
        // in the vignette band: mix(B, O, (S.x - sc.x) / (S.x - V.x))
        let o = post_rotscale_clip([0.15, 0.5], 0.0, [1.0, 1.0], [0.0, 0.0], s, v, fin, faux);
        let t = (0.1 - 0.15) / (0.1 - 0.2); // 0.5
        approx(o[0], 0.0 * (1.0 - t) + 1.0 * t);
        approx(o[3], 1.0);
        // rotation is in degrees; the fetch sees the rotated coordinate
        let seen = std::cell::RefCell::new([0.0f32; 2]);
        let o = post_rotscale_clip(
            [1.0, 0.0],
            45.0,
            [1.0, 1.0],
            [0.0, 0.0],
            [-10.0, -10.0, 10.0, 10.0],
            [-20.0, -20.0, 20.0, 20.0],
            |c| {
                *seen.borrow_mut() = c;
                [0.0, 0.0, 0.0, 1.0]
            },
            |_| [1.0, 1.0, 1.0, 1.0],
        );
        approx(seen.borrow()[0], std::f32::consts::FRAC_1_SQRT_2);
        approx(seen.borrow()[1], std::f32::consts::FRAC_1_SQRT_2);
        assert_eq!(o, [0.0, 0.0, 0.0, 1.0]);
    }

    #[test]
    fn scissor_rect_math() {
        // x = max(0, floor(r[0])); w = max(0, min(tw - x, ceil(r[2])))
        assert_eq!(scissor_rect(&[10.7, 5.2, 100.3, 50.8], 1920, 1080), (10, 5, 101, 51));
        assert_eq!(scissor_rect(&[-5.0, -5.0, 20.0, 20.0], 100, 100), (0, 0, 20, 20));
        assert_eq!(scissor_rect(&[90.0, 90.0, 50.0, 50.0], 100, 100), (90, 90, 10, 10));
        assert_eq!(scissor_rect(&[0.0, 0.0, 0.0, 0.0], 64, 64), (0, 0, 0, 0));
    }

    #[test]
    fn readback_bytes_per_row_pads_to_256() {
        assert_eq!(readback_bytes_per_row(64), 256);
        assert_eq!(readback_bytes_per_row(65), 512);
        assert_eq!(readback_bytes_per_row(1), 256);
        assert_eq!(readback_bytes_per_row(128), 512);
    }

    #[test]
    fn readback_pixels_swaps_bgra_and_sets_alpha() {
        let mut src = vec![0u8; 256];
        src[0] = 10;
        src[1] = 20;
        src[2] = 30;
        src[3] = 40;
        let out = readback_pixels(&src, 256, 2, 1, false);
        assert_eq!(&out[..4], &[10, 20, 30, 255]);
        let out = readback_pixels(&src, 256, 2, 1, true);
        assert_eq!(&out[..4], &[30, 20, 10, 255]);
        // rows are addressed with the padded stride
        let mut src = vec![0u8; 512];
        src[256] = 9;
        let out = readback_pixels(&src, 256, 1, 2, false);
        assert_eq!(out[4], 9); // pixel (0, 1)
        assert_eq!(out[7], 255);
    }

    #[test]
    fn mix4_matches_wgsl() {
        assert_eq!(mix4([0.0, 0.0, 0.0, 1.0], [1.0, 1.0, 1.0, 0.0], 0.25), [0.25, 0.25, 0.25, 0.75]);
        assert_eq!(mix4([1.0; 4], [2.0; 4], 0.0), [1.0; 4]);
        assert_eq!(mix4([1.0; 4], [2.0; 4], 1.0), [2.0; 4]);
    }

    #[test]
    fn vertex_layout_packed_and_float_formats() {
        // JS (device.js): FORMAT.terrain is packed: byteStride 20, byte offsets
        let t = vertex_layout(&FORMAT_TERRAIN);
        assert_eq!(t.byte_stride, 20);
        assert_eq!(t.attrs, vec![
            LayoutAttr { size: 4, byte_offset: 0, ty: AttrType::Unorm16 },
            LayoutAttr { size: 2, byte_offset: 8, ty: AttrType::Unorm16 },
            LayoutAttr { size: 4, byte_offset: 12, ty: AttrType::Unorm8 },
            LayoutAttr { size: 2, byte_offset: 16, ty: AttrType::Unorm8 },
        ]);
        // float formats: byteStride = stride * 4, byte offsets = float offset * 4
        let l = vertex_layout(&FORMAT_LIT);
        assert_eq!(l.byte_stride, 44);
        assert_eq!(l.attrs, vec![
            LayoutAttr { size: 3, byte_offset: 0, ty: AttrType::F32 },
            LayoutAttr { size: 2, byte_offset: 12, ty: AttrType::F32 },
            LayoutAttr { size: 4, byte_offset: 20, ty: AttrType::F32 },
            LayoutAttr { size: 2, byte_offset: 36, ty: AttrType::F32 },
        ]);
        let e = vertex_layout(&FORMAT_ENTITY);
        assert_eq!(e.byte_stride, 44);
        assert_eq!(e.attrs[3], LayoutAttr { size: 3, byte_offset: 32, ty: AttrType::F32 });
        let c = vertex_layout(&FORMAT_COLOR);
        assert_eq!(c.byte_stride, 36);
        assert_eq!(c.attrs.len(), 3);
    }

    #[test]
    fn format_and_pipeline_tables_match_device_js() {
        assert!(format_by_name("terrain").is_some());
        assert!(format_by_name("bogus").is_none());
        // JS (device.js): PIPELINE_FORMAT = { terrain, lit, entity, color, endportal: FORMAT.color, post: FORMAT.color }
        assert_eq!(pipeline_format("terrain").unwrap().name, "terrain");
        assert_eq!(pipeline_format("endportal").unwrap().name, "color");
        assert_eq!(pipeline_format("post").unwrap().name, "color");
        assert!(pipeline_format("nonsense").is_none());
        assert_eq!(TERRAIN_POS_SCALE, 2048.0);
    }

    #[test]
    fn quad_indices_pattern() {
        assert_eq!(quad_indices(0), Vec::<u32>::new());
        assert_eq!(quad_indices(2), vec![0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
        let idx = quad_indices(65536);
        assert_eq!(idx.len(), 65536 * 6);
        // spot check the last quad
        let v = 65535 * 4;
        assert_eq!(&idx[(65535 * 6)..], &[v, v + 1, v + 2, v, v + 2, v + 3]);
    }

    #[test]
    fn build_mips_box_filter_alpha_weighted() {
        // 2x2 with one transparent texel: colour is weighted by alpha
        let data = vec![
            255, 0, 0, 255, // (0,0) red
            0, 255, 0, 255, // (1,0) green
            0, 0, 255, 255, // (0,1) blue
            255, 255, 255, 0, // (1,1) transparent white
        ];
        let mips = build_mips(2, 2, &data, 4);
        assert_eq!(mips.len(), 1);
        assert_eq!(mips[0].width, 1);
        assert_eq!(mips[0].height, 1);
        // sum a = 765; r = 255*255 / 765 = 85; alpha = 765 / 4 = 191.25 -> 191
        assert_eq!(mips[0].data, vec![85, 85, 85, 191]);
        // a 1x1 image produces no levels (w > 1 || h > 1 fails immediately)
        assert!(build_mips(1, 1, &data[..4], 4).is_empty());
        // maxLevels caps the chain
        let mips = build_mips(4, 2, &vec![9u8; 4 * 2 * 4], 1);
        assert_eq!(mips.len(), 1);
        assert_eq!(mips[0].width, 2);
        assert_eq!(mips[0].height, 1);
        // odd sizes clamp the source texel (Math.min(w - 1, x * 2 + dx))
        let mips = build_mips(3, 1, &vec![100u8; 3 * 1 * 4], 4);
        assert_eq!(mips.len(), 1);
        assert_eq!(mips[0].width, 1);
        assert_eq!(mips[0].height, 1);
        assert_eq!(mips[0].data, vec![100, 100, 100, 100]);
    }

    #[test]
    fn default_params_match_device_js_helpers() {
        // JS (device.js): DEFAULT_PARAMS is built from the params helpers
        assert_eq!(terrain_params(0.0, 1.0, 0.0), DEFAULT_PARAMS_TERRAIN);
        assert_eq!(lit_params(0.0), DEFAULT_PARAMS_LIT);
        assert_eq!(
            EntityParams::new().set_alpha_test(0.0).p,
            DEFAULT_PARAMS_ENTITY
        );
        assert_eq!(color_params(1.0, 1.0, 1.0, 1.0, 0.0, 0.0), DEFAULT_PARAMS_COLOR);
        assert_eq!(DEFAULT_PARAMS_POST, [0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
        assert_eq!(default_params("endportal"), Some(&DEFAULT_PARAMS_ENDPORTAL));
        assert_eq!(default_params("bogus"), None);
    }

    #[test]
    fn entity_params_setters_match_device_js() {
        let mut e = EntityParams::new();
        // constructor defaults: tint white, light (15, 15), alphaTest 0.1
        assert_eq!(e.p[0..4], [1.0, 1.0, 1.0, 1.0]);
        assert_eq!(e.p[8], 15.0);
        assert_eq!(e.p[9], 15.0);
        assert_eq!(e.p[12], 0.1);
        e.set_overlay(0.5, 0.4, 0.3, 0.2).set_full_bright(true).set_no_lighting(false).set_gui_lighting(true);
        e.set_uv_transform(1.0, 2.0, 4.0).set_alpha_test(0.25);
        assert_eq!(e.p[4..8], [0.5, 0.4, 0.3, 0.2]);
        assert_eq!(e.p[10], 1.0);
        assert_eq!(e.p[11], 2.0); // setGuiLighting overrides setNoLighting
        assert_eq!(e.p[12], 0.25);
        assert_eq!(e.p[13..16], [1.0, 2.0, 4.0]);
        e.set_full_bright(false).set_gui_lighting(false);
        assert_eq!(e.p[10], 0.0);
        assert_eq!(e.p[11], 0.0);
    }
}
