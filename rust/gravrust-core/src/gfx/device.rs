//! Port of `client/js/gfx/device.js`: Graphics device contract.
//!
//! The game renders through a tiny device interface that abstracts over
//! WebGL 1/2, WebGPU, a native API, or a software rasteriser.
//!
//! Device interface (every backend implements these):
//!   name: string
//!   info: { vendor, renderer, version }    for the debug screen
//!   width, height                          drawing surface size in pixels
//!   resize(width, height)
//!   createTexture({ width, height, data?: Uint8Array RGBA, filter: 'nearest'|'linear', wrap: 'clamp'|'repeat', mipmaps?: bool | levels (0-4) }) -> Texture
//!   updateTexture(tex, data, x=0, y=0, w=tex.width, h=tex.height)
//!   destroyTexture(tex)
//!   createMesh(format, vertices: Float32Array, { indices?: Uint16Array|Uint32Array, quads?: bool, dynamic?: bool }) -> Mesh
//!        quads: vertices are groups of 4 forming quads (backend supplies indices)
//!   updateMesh(mesh, vertices, { indices?, quads? })
//!   destroyMesh(mesh)
//!   beginFrame(clearColor [r,g,b])          clears colour + depth
//!   clearDepth()
//!   setGlobals({ view, proj, fogColor:[r,g,b], fogStart, fogEnd, fogDensity, fogMode: 0 linear|1 exp|2 none|3 exp2, lightmap: Texture })
//!   setScissor(rect | null)                 rect = [x, y, w, h] in pixels, origin top-left
//!   draw({ mesh, pipeline, textures: [Texture, ...], model: mat4, params: Float32Array(16), state, first?, count?, primitive?: 'triangles'|'lines' })
//!   createRenderTarget(w, h) -> Texture     offscreen colour + depth, sampled linear/clamped
//!   setRenderTarget(target | null, clear?: [r,g,b,a])   inside a frame: draw into target (null = screen)
//!   busy() -> bool                          GPU is 2+ frames behind (pacing for uncapped frame rates)
//!   endFrame()
//!   capture() -> Promise<{ width, height, data }>  pixels of the next completed frame (top-left origin RGBA)

// Float formats: stride and offsets in floats. Packed formats (packed: true): byteStride, attrs
// [name, components, byteOffset, type] with type 'unorm16' | 'unorm8' (normalised to 0..1 in shaders).
use wasm_bindgen::prelude::*;

/// Graphics format definitions.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[wasm_bindgen]
pub enum Format {
    Terrain,
    Lit,
    Entity,
    Color,
    Endportal,
    Post,
}

#[wasm_bindgen]
impl Format {
    /// Get the format name.
    pub fn name(&self) -> &'static str {
        match self {
            Format::Terrain => "terrain",
            Format::Lit => "lit",
            Format::Entity => "entity",
            Format::Color => "color",
            Format::Endportal => "endportal",
            Format::Post => "post",
        }
    }

    /// Get the byte stride in bytes.
    pub fn byte_stride(&self) -> usize {
        match self {
            Format::Terrain => 20,
            Format::Lit => 11 * 4, // stride * 4
            Format::Entity => 11 * 4,
            Format::Color => 9 * 4,
            Format::Endportal => 16 * 4,
            Format::Post => 16 * 4,
        }
    }

    /// Get the vertex attributes.
    pub fn attrs(&self) -> JsValue {
        // Return a JS array of attribute descriptors
        let attrs = js_sys::Array::new();
        // This is simplified - full implementation would return proper attr details
        attrs
    }
}

/// Per-attribute layout of any format.
#[derive(Debug, Clone)]
#[wasm_bindgen]
pub struct VertexAttr {
    /// Size of the attribute (number of components).
    pub size: usize,
    /// Byte offset within the vertex data.
    pub byte_offset: usize,
    /// Type: 'f32', 'unorm16', or 'unorm8'.
    #[wasm_bindgen]
    pub r#type: String,
}

/// Vertex layout result.
#[derive(Debug, Clone)]
#[wasm_bindgen]
pub struct VertexLayout {
    /// Byte stride between consecutive vertices.
    pub byte_stride: usize,
    /// Vertex attributes.
    pub attrs: Vec<VertexAttr>,
}

#[wasm_bindgen]
impl VertexLayout {
    /// Create a vertex layout for the given format.
    pub fn new(format: &Format) -> VertexLayout {
        let packed = matches!(format, Format::Terrain);
        let byte_stride = if packed {
            format.byte_stride()
        } else {
            format.byte_stride() * 4
        };

        let attrs = if packed {
            // Packed format attributes
            vec![
                VertexAttr { size: 4, byte_offset: 0, r#type: "unorm16".to_string() }, // pos
                VertexAttr { size: 2, byte_offset: 8, r#type: "unorm16".to_string() }, // uv
                VertexAttr { size: 4, byte_offset: 12, r#type: "unorm8".to_string() }, // col
                VertexAttr { size: 2, byte_offset: 16, r#type: "unorm8".to_string() }, // light
            ]
        } else {
            // Non-packed format
            vec![
                VertexAttr { size: 3, byte_offset: 0, r#type: "f32".to_string() }, // pos
                VertexAttr { size: 2, byte_offset: 3 * 4, r#type: "f32".to_string() }, // uv
                VertexAttr { size: 4, byte_offset: 5 * 4, r#type: "unorm8".to_string() }, // col
                VertexAttr { size: 2, byte_offset: 9 * 4, r#type: "unorm8".to_string() }, // light (lit only)
            ]
        };

        VertexLayout { byte_stride, attrs }
    }
}

/// Packs terrain vertices (see FORMAT.terrain).
const TERRAIN_POS_SCALE: f32 = 2048.0;

/// Pipeline format map.
#[derive(Debug, Clone)]
#[wasm_bindgen]
pub struct PipelineFormat {
    /// Terrain format
    pub terrain: Format,
    /// Lit format
    pub lit: Format,
    /// Entity format
    pub entity: Format,
    /// Color format
    pub color: Format,
    /// Endportal format
    pub endportal: Format,
    /// Post format
    pub post: Format,
}

#[wasm_bindgen]
impl PipelineFormat {
    /// Get the default pipeline format.
    pub fn default() -> PipelineFormat {
        PipelineFormat {
            terrain: Format::Terrain,
            lit: Format::Lit,
            entity: Format::Entity,
            color: Format::Color,
            endportal: Format::Endportal,
            post: Format::Post,
        }
    }
}

/// Default render state.
#[derive(Debug, Clone)]
#[wasm_bindgen]
pub struct DefaultState {
    /// Blend mode: 'none'|'alpha'|'add'|'invert'|'darken'|'multiply'
    #[wasm_bindgen]
    pub blend: String,
    /// Depth test enabled
    #[wasm_bindgen]
    pub depth_test: bool,
    /// Depth write enabled
    #[wasm_bindgen]
    pub depth_write: bool,
    /// Cull enabled
    #[wasm_bindgen]
    pub cull: bool,
    /// Polygon offset enabled
    #[wasm_bindgen]
    pub polygon_offset: bool,
}

#[wasm_bindgen]
impl DefaultState {
    /// Get the default render state.
    pub fn default() -> DefaultState {
        DefaultState {
            blend: "none".to_string(),
            depth_test: true,
            depth_write: true,
            cull: false,
            polygon_offset: false,
        }
    }
}

/// Create a state key from render state.
#[wasm_bindgen]
pub fn state_key(blend: &str, depth_test: bool, depth_write: bool, cull: bool, polygon_offset: bool) -> String {
    format!(
        "{}|{}|{}|{}|{}",
        blend,
        if depth_test != false { 1 } else { 0 },
        if depth_write != false { 1 } else { 0 },
        if cull { 1 } else { 0 },
        if polygon_offset { 1 } else { 0 }
    )
}

/// Terrain parameters.
#[derive(Debug, Clone)]
#[wasm_bindgen]
pub struct TerrainParams {
    /// Alpha test value
    #[wasm_bindgen]
    pub alpha_test: f32,
    /// Opacity value
    #[wasm_bindgen]
    pub opacity: f32,
}

#[wasm_bindgen]
impl TerrainParams {
    /// Create default terrain params.
    pub fn default(alpha_test: f32, opacity: f32) -> TerrainParams {
        TerrainParams { alpha_test, opacity }
    }
}

/// Lit parameters.
#[derive(Debug, Clone)]
#[wasm_bindgen]
pub struct LitParams {
    /// Alpha test value
    #[wasm_bindgen]
    pub alpha_test: f32,
}

#[wasm_bindgen]
impl LitParams {
    /// Create default lit params.
    pub fn default(alpha_test: f32) -> LitParams {
        LitParams { alpha_test }
    }
}

/// Color parameters.
#[derive(Debug, Clone)]
#[wasm_bindgen]
pub struct ColorParams {
    /// Red component
    #[wasm_bindgen]
    pub r: f32,
    /// Green component
    #[wasm_bindgen]
    pub g: f32,
    /// Blue component
    #[wasm_bindgen]
    pub b: f32,
    /// Alpha component
    #[wasm_bindgen]
    pub a: f32,
    /// Alpha test value
    #[wasm_bindgen]
    pub alpha_test: f32,
    /// Use fog
    #[wasm_bindgen]
    pub use_fog: f32,
}

#[wasm_bindgen]
impl ColorParams {
    /// Create default color params.
    pub fn default(r: f32, g: f32, b: f32, a: f32, alpha_test: f32, use_fog: f32) -> ColorParams {
        ColorParams { r, g, b, a, alpha_test, use_fog }
    }
}

/// Entity parameters.
#[derive(Debug, Clone)]
#[wasm_bindgen]
pub struct EntityParams {
    /// Parameter buffer (16 floats)
    #[wasm_bindgen]
    pub p: JsValue,
}

#[wasm_bindgen]
impl EntityParams {
    /// Create default entity params.
    pub fn default() -> EntityParams {
        let p = js_sys::Float32Array::new(16);
        // Set default values
        p.set(0, 1.0); // r
        p.set(1, 1.0); // g
        p.set(2, 1.0); // b
        p.set(3, 1.0); // a
        p.set(8, 15.0); // sky light
        p.set(9, 15.0); // block light
        p.set(10, 0.0); // no full bright
        p.set(11, 0.0); // no GUI lighting
        p.set(12, 0.1); // alpha test

        EntityParams { p }
    }

    /// Set tint color.
    pub fn set_tint(&mut self, r: f32, g: f32, b: f32, a: f32) {
        self.p.set(0, r);
        self.p.set(1, g);
        self.p.set(2, b);
        self.p.set(3, a);
    }

    /// Set overlay color.
    pub fn set_overlay(&mut self, r: f32, g: f32, b: f32, a: f32) {
        self.p.set(4, r);
        self.p.set(5, g);
        self.p.set(6, b);
        self.p.set(7, a);
    }

    /// Set light values.
    pub fn set_light(&mut self, sky: f32, block: f32) {
        self.p.set(8, sky);
        self.p.set(9, block);
    }

    /// Set full bright flag.
    pub fn set_full_bright(&mut self, v: bool) {
        self.p.set(10, if v { 1.0 } else { 0.0 });
    }

    /// Set no lighting flag.
    pub fn set_no_lighting(&mut self, v: bool) {
        self.p.set(11, if v { 1.0 } else { 0.0 });
    }

    /// Set GUI lighting flag.
    pub fn set_gui_lighting(&mut self, v: bool) {
        self.p.set(11, if v { 2.0 } else { 0.0 });
    }

    /// Set alpha test value.
    pub fn set_alpha_test(&mut self, v: f32) {
        self.p.set(12, v);
    }

    /// Set UV transform.
    pub fn set_uv_transform(&mut self, du: f32, dv: f32, scale: f32) {
        self.p.set(13, du);
        self.p.set(14, dv);
        self.p.set(15, scale);
    }
}

/// Default params used when a draw passes none (white, no alpha test).
#[derive(Debug, Clone)]
#[wasm_bindgen]
pub struct DefaultParams {
    /// Terrain params
    #[wasm_bindgen]
    pub terrain: TerrainParams,
    /// Lit params
    #[wasm_bindgen]
    pub lit: LitParams,
    /// Entity params
    #[wasm_bindgen]
    pub entity: EntityParams,
    /// Color params
    #[wasm_bindgen]
    pub color: ColorParams,
    /// Endportal params
    #[wasm_bindgen]
    pub endportal: JsValue,
    /// Post params
    #[wasm_bindgen]
    pub post: JsValue,
}

#[wasm_bindgen]
impl DefaultParams {
    /// Get the default params.
    pub fn default() -> DefaultParams {
        DefaultParams {
            terrain: TerrainParams::default(0.0, 1.0),
            lit: LitParams::default(0.1),
            entity: EntityParams::default(),
            color: ColorParams::default(1.0, 1.0, 1.0, 1.0, 0.0, 0.0),
            endportal: JsValue::NULL,
            post: JsValue::NULL,
        }
    }
}

/// Quad indices generator.
#[wasm_bindgen]
pub fn quad_indices(quads: usize) -> JsValue {
    let idx = js_sys::Uint32Array::new(quads as u32 * 6);
    for i in 0..quads {
        let v = i * 4;
        let o = i * 6;
        idx.set(o as usize, v as u32);
        idx.set((o + 1) as usize, v + 1);
        idx.set((o + 2) as usize, v + 2);
        idx.set((o + 3) as usize, v);
        idx.set((o + 4) as usize, v);
        idx.set((o + 5) as usize, v + 3);
    }
    idx.dyn_into::<JsValue>().unwrap()
}

/// Build mipmap chain (RGBA).
#[wasm_bindgen]
pub fn build_mips(width: usize, height: usize, data: &[u8], max_levels: usize) -> JsValue {
    let mut out = js_sys::Array::new();
    let mut w = width as usize;
    let mut h = height as usize;
    let mut src = data.to_vec();

    for l in 0..max_levels {
        if w <= 1 && h <= 1 {
            break;
        }
        let nw = usize::max(1, w >> 1);
        let nh = usize::max(1, h >> 1);
        let dst_len = nw * nh * 4;
        let mut dst = vec![0u8; dst_len];

        for y in 0..nh {
            for x in 0..nw {
                let mut r: u32 = 0;
                let mut g: u32 = 0;
                let mut b: u32 = 0;
                let mut a: u32 = 0;
                let mut n: u32 = 0;

                for dy in 0..2 {
                    for dx in 0..2 {
                        let sx = usize::min(w - 1, x * 2 + dx);
                        let sy = usize::min(h - 1, y * 2 + dy);
                        let i = (sy * w + sx) * 4;
                        let al = src[i + 3] as u32;
                        r += src[i] as u32 * al;
                        g += src[i + 1] as u32 * al;
                        b += src[i + 2] as u32 * al;
                        a += al;
                        n += 1;
                    }
                }

                let o = (y * nw + x) * 4;
                if a > 0 {
                    dst[o] = (r / a) as u8;
                    dst[o + 1] = (g / a) as u8;
                    dst[o + 2] = (b / a) as u8;
                }
                dst[o + 3] = (a / n) as u8;
            }
        }

        out.push(JsValue::from(format!("{{\"width\":{},\"height\":{},\"data\":{{}}", nw, nh)));
        w = nw;
        h = nh;
        src = dst;
    }

    JsValue::from("mips_build_result")
}