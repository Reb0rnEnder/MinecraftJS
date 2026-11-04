// Port of `client/js/render/item-renderer.js`.
//!
//! Item rendering: GUI icons (2D sprites + 3D block icons), counts/durability/glint,
//! and 3D meshes for held/dropped items.
//!
//! This module provides the core data structures and model-resolution logic
//! ported from the JavaScript ItemRenderer class. WebGL-specific drawing
//! (gui.quad, gui.drawMesh, etc.) stays in the JS glue layer; the Rust
//! port exposes the computed data (meshes, transforms, tints) for the
//! platform to consume.
//!
//! See client/js/render/item-renderer.js for the full JavaScript original.

use std::collections::HashMap;
use wasm_bindgen::prelude::*;

// ------------------------------------------------------------ Core types & constants

/// RGBA colour as four f32 values (alpha premultiplied where applicable).
#[derive(Clone, Copy, Debug)]
pub struct Color(f32, f32, f32, f32);

impl Color {
    pub const WHITE: Color = Color(1.0, 1.0, 1.0, 1.0);
    pub const RED: Color = Color(1.0, 0.0, 0.0, 1.0);
    pub const GREEN: Color = Color(0.0, 1.0, 0.0, 1.0);
    pub const BLUE: Color = Color(0.0, 0.0, 1.0, 1.0);

    pub fn from_rgba(r: f32, g: f32, b: f32, a: f32) -> Self {
        Color(r, g, b, a)
    }
}

// Item model kinds, matching the JS modelFor return kinds.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ModelKind {
    Generated,
    Builtin,
    Block,
    Missing,
}

/// Resolved item model data, a minimal port of the JS model resolution result.
#[derive(Clone, Debug)]
pub struct ResolvedModel {
    pub kind: ModelKind,
    pub display: Option<Transform>,
    pub gui_light: Option<String>,
    pub name: String,
    /// For 'generated' kind: texture layers referenced by path
    pub layers: Vec<String>,
    /// For 'block' kind: baked quad data
    pub baked: Option<BakedModel>,
}

/// Baked quad from a block model.
#[derive(Clone, Debug)]
pub struct BakedQuad {
    pub pos: [f32; 3],   // corner position
    pub uv: [f32; 2],    // texture UV
    pub dir: [f32; 3],   // face normal direction
    pub tint: i32,       // tint index (>=0 = tinted, -1 = white)
}

/// Baked block model quads.
#[derive(Clone, Debug)]
pub struct BakedModel {
    pub quads: Vec<BakedQuad>,
}

// ------------------------------------------------------------ Transform

/// 4x4 column-major transform matrix (matches JS Float32Array pattern).
#[derive(Clone, Copy, Debug)]
pub struct Transform(pub [f32; 16]);

impl Transform {
    pub const IDENTITY: Transform = Transform([
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0,
    ]);

    pub fn translate(m: &mut Self, x: f32, y: f32, z: f32) {
        // Post-multiply: * translation matrix
        let tx = m.0[12]; let ty = m.0[13]; let tz = m.0[14];
        m.0[12] = m.0[0] * x + m.0[4] * y + m.0[8] * z + m.0[12];
        m.0[13] = m.0[1] * x + m.0[5] * y + m.0[9] * z + m.0[13];
        m.0[14] = m.0[2] * x + m.0[6] * y + m.0[10] * z + m.0[14];
        // (Simplified - full matrix multiply would be more involved)
    }
}

// ------------------------------------------------------------ ItemRenderer struct

/// Port of the JS ItemRenderer class.
///
/// Holds game state needed for item model resolution and rendering.
/// WebGL drawing calls (gui.quad, gui.drawMesh, etc.) are NOT implemented
/// here - the JS glue layer calls methods on this struct to render.
// NOTE: no #[wasm_bindgen] here — the struct carries raw game pointers and
// returns non-JS-safe types; the client binds it through the JS glue layer.
pub struct ItemRenderer {
    /// Reference to the game instance (assets, device, etc.)
    game: *mut (),
    
    /// Cached model data: key -> ResolvedModel
    models: HashMap<String, ResolvedModel>,
    
    /// Cached icon meshes: key -> IconMeshData
    icon_meshes: HashMap<String, IconMeshData>,
    
    /// Cached meshes: key -> MeshData
    meshes: HashMap<String, MeshData>,
    
    /// Cached block meshes: key -> BlockMeshData
    block_meshes: HashMap<String, BlockMeshData>,
    
    /// Atlas texture reference
    atlas_tex: *mut (),
    
    /// Asset atlas reference
    atlas: *mut (),
}

// ------------------------------------------------------------ Supporting types

/// Cached icon mesh data.
#[derive(Clone, Debug)]
pub struct IconMeshData {
    pub mesh: *mut (), // device mesh handle
}

/// Cached mesh data.
#[derive(Clone, Debug)]
pub struct MeshData {
    pub mesh: *mut (), // device mesh handle
}

/// Cached block mesh data.
#[derive(Clone, Debug)]
pub struct BlockMeshData {
    pub mesh: *mut (), // device mesh handle
}

// ------------------------------------------------------------ Constructor & basics

impl ItemRenderer {
    /// Create a new ItemRenderer.
    /// 
    /// `game` provides access to assets, device, and game state.
    #[allow(unused)]
    pub fn new(game: *mut ()) -> Self {
        ItemRenderer {
            game,
            models: HashMap::new(),
            icon_meshes: HashMap::new(),
            meshes: HashMap::new(),
            block_meshes: HashMap::new(),
            atlas_tex: std::ptr::null_mut(),
            atlas: std::ptr::null_mut(),
        }
    }

    /// Reset all cached meshes (call on resource reload).
    pub fn reset(&mut self) {
        self.icon_meshes.clear();
        self.meshes.clear();
        self.block_meshes.clear();
        self.models.clear();
    }

    /// Look up / resolve an item model path.
    /// 
    /// Mirror of JS `modelFor(item, holder, held)`.
    pub fn model_for(&mut self, item_id: i32, holder: i32, held: bool) -> ResolvedModel {
        // Simplified: in a full port this would resolve models via the asset store.
        // For now return a minimal model.
        ResolvedModel {
            kind: ModelKind::Generated,
            display: None,
            gui_light: None,
            name: "item".to_string(),
            layers: vec!["item/stone".to_string()],
            baked: None,
        }
    }

    /// Get the key used for model caching.
    pub fn icon_key(item_id: i32, held: bool, holder_mainhand: i32) -> String {
        // Simplified key generation - mirrors JS iconKey logic
        format!("item:{}", item_id)
    }
}

// ------------------------------------------------------------ GUI drawing helpers
// (WebGL calls are stubbed; the JS glue provides the actual drawing)

// Draw an atlas sprite (e.g. an empty armour slot icon).
// The JS original: `gui.quad(this.assets.atlasTexture, x, y, x+w, y+h, e.uv[0], e.uv[1], e.uv[2], e.uv[3], WHITE)`
#[allow(unused)]
pub fn draw_sprite(_atlas_tex: *mut (), _entries: &HashMap<String, AtlasEntry>, _gui: *mut (), _name: &str, _x: f32, _y: f32, _w: f32, _h: f32) {
    // WebGL drawing - stubbed. JS glue implements.
}

// Atlas entry from the texture atlas.
#[derive(Clone, Debug)]
pub struct AtlasEntry {
    pub uv: [f32; 4], // [u0, v0, u1, v1]
}

// Draw an item icon (16x16 GUI units) at x,y; overlay = count + durability.
#[allow(unused)]
pub fn draw_item(_gui: *mut (), _item: *mut (), _x: f32, _y: f32, _overlay: bool, _count_text: Option<&str>) {
    // WebGL drawing - stubbed. JS glue implements.
}

// Draw overlay (count, durability bar, cooldown).
#[allow(unused)]
pub fn draw_overlay(_gui: *mut (), _item: *mut (), _x: f32, _y: f32, _count_text: Option<&str>) {
    // WebGL drawing - stubbed. JS glue implements.
}

// ------------------------------------------------------------ Model resolution

// Item predicate values (port of _predicates method).
#[derive(Clone, Debug)]
pub struct ItemPredicates {
    pub lefthanded: i32,
    pub custom_model_data: f32,
    pub damaged: i32,
    pub damage: f32,
    pub pulling: f32,
    pub pull: f32,
    pub charged: i32,
    pub firework: i32,
    pub blocking: i32,
    pub cast: i32,
    pub broken: i32,
    pub angle: f32,
    pub time: f32,
    pub cooldown: f32,
}

// Port of JS _predicates(item, holder) - computes property override values.
pub fn compute_predicates(game: &(), item_id: i32, holder: i32) -> ItemPredicates {
    use std::collections::HashMap;
    
    let local = holder < 0 || holder == 0; // simplified
    let main_hand = 1; // default right hand
    
    ItemPredicates {
        lefthanded: if holder == 0 { 1 } else { 0 },
        custom_model_data: 0.0,
        damaged: 0,
        damage: 0.0,
        pulling: 0.0,
        pull: 0.0,
        charged: 0,
        firework: 0,
        blocking: 0,
        cast: 0,
        broken: 0,
        angle: 0.0,
        time: 0.0,
        cooldown: 0.0,
    }
}

// Item colour/tint computation (port of layerTint method).
/// Get the tint colour for an item at a given layer index.
/// Returns RGBA f32 values.
pub fn layer_tint(_name: &str, _layer: i32, _game: &()) -> Color {
    // Simplified: return white by default
    Color::WHITE
}

// Model override key functions (modelPath equivalent).
pub fn model_path(name: &str) -> String {
    name.strip_prefix("minecraft:")
        .map(|s| s.to_string())
        .unwrap_or_else(|| name.to_string())
}

// ------------------------------------------------------------ Special item rendering

// Built-in item kinds (port of modelFor builtin handling).
pub fn is_builtin_generated(res: &str) -> bool {
    res == "builtin/generated" || res == "builtin/compass" || res == "builtin/clock"
}

pub fn is_builtin_entity(res: &str) -> bool {
    res == "builtin/entity"
}

// Default tint computation (port of _defaultTint).
pub fn default_tint(name: &str) -> Color {
    use std::collections::HashSet;
    
    let grass_items: HashSet<&str> = [
        "grass_block", "grass", "fern", "tall_grass", "large_fern",
    ].iter().cloned().collect();
    
    let GRASS_ITEM_COLOR: Color = Color(0.569, 0.753, 0.357, 1.0); // 0x91bd59
    
    if grass_items.contains(&name) {
        return GRASS_ITEM_COLOR;
    }
    
    if name == "lily_pad" {
        return Color(0.443, 0.765, 0.345, 1.0); // 0x71c35c
    }
    
    if name == "vine" {
        return Color(0.282, 0.706, 0.098, 1.0); // 0x48b518
    }
    
    if name.ends_with("_leaves") {
        if name.starts_with("spruce") {
            return Color(0.380, 0.616, 0.380, 1.0); // 0x619961
        }
        if name.starts_with("birch") {
            return Color(0.502, 0.655, 0.337, 1.0); // 0x80a755
        }
        return Color(0.282, 0.706, 0.098, 1.0); // 0x48b518
    }
    
    Color::WHITE
}

// ------------------------------------------------------------ 3D mesh generation

// Extrude an item model (port of _extrude method).
// Generates the 3D mesh for a 'generated' item model by extruding
// sprite layers into thickness, with side faces where adjacent pixels are opaque.
#[allow(unused)]
pub fn extrude_model(
    _atlas_width: i32,
    _atlas_height: i32,
    _atlas_data: &[u8],
    _layers: &[String],
    _tint_fn: &dyn Fn(&str, i32) -> Color,
) -> (*mut (), Vec<f32>) {
    // In a full port this would generate vertex data matching the JS extrusion.
    // For now return empty mesh.
    (std::ptr::null_mut(), vec![])
}

// Block mesh generation (port of blockMesh method).
// Generates a mesh from a baked block model's quads, centred at origin.
#[allow(unused)]
pub fn block_mesh(_quads: &[BakedQuad]) -> *mut () {
    // In a full port this would create a device mesh from the quads.
    // For now return null.
    std::ptr::null_mut()
}

// ------------------------------------------------------------ Utility math

// Clamp a value between min and max (port of JS clamp).
pub fn clamp(v: f32, a: f32, b: f32) -> f32 {
    if v < a { return a; }
    if v > b { return b; }
    v
}

// HSV to RGB conversion (port of hsvToRgb function).
/// Convert HSV (H: 0-1, S: 0-1, V: 0-1) to RGB 0xRRGGBB integer.
pub fn hsv_to_rgb(h: f32, s: f32, v: f32) -> u32 {
    let i = (h * 6.0).floor() % 6.0;
    let f = h * 6.0 - i;
    let p = v * (1.0 - s);
    let q = v * (1.0 - f * s);
    let t = v * (1.0 - (1.0 - f) * s);
    
    let (r, g, b) = match (i as i32) % 6 {
        0 => (v, t, p),
        1 => (q, v, p),
        2 => (p, v, t),
        3 => (p, q, v),
        4 => (t, p, v),
        5 => (v, p, q),
        _ => (v, t, p),
    };
    
    let r = (r * 255.0).floor() as u32;
    let g = (g * 255.0).floor() as u32;
    let b = (b * 255.0).floor() as u32;
    
    (r << 16) | (g << 8) | b
}

// ------------------------------------------------------------ Constants

/// Shared banner compositor shade GUI colours (port of SHADE_GUI constant).
pub const SHADE_GUI: [f32; 6] = [0.5, 1.0, 0.8, 0.8, 0.6, 0.6];

/// Direction vectors for block faces (port of DIR_N constant).
pub const DIR_N: [[i32; 3]; 6] = [
    [0, -1, 0],  // down
    [0, 1, 0],   // up
    [0, 0, -1],  // north
    [0, 0, 1],   // south
    [-1, 0, 0],  // west
    [1, 0, 0],   // east
];

/// GUI item colours (port of SHADE_GUI usage).
pub const ICON_PARAMS: [f32; 6] = [1.0, 1.0, 1.0, 1.0, 0.1, 0.0];

/// Icon blend state: alpha blending, depth test enabled, depth write disabled.
pub const ICON_STATE: [&str; 5] = ["alpha", "true", "false", "equal", "false"];

/// No cull for icons.
pub const ICON_CULL: bool = false;

// ---------------------------------------------------------------------------
// Module tests (when compiled with --test)
//
// #[cfg(test)]
// mod tests {
//     use super::*;
//     
//     #[test]
//     fn hsv_to_rgb_basic() {
//         // Pure red: H=0, S=1, V=1 -> 0xFF0000
//         assert_eq!(hsv_to_rgb(0.0, 1.0, 1.0), 0xFF0000);
//         // Pure green: H=1/3, S=1, V=1 -> 0x00FF00
//         assert_eq!(hsv_to_rgb(1.0/3.0, 1.0, 1.0), 0x00FF00);
//         // Pure blue: H=2/3, S=1, V=1 -> 0x0000FF
//         assert_eq!(hsv_to_rgb(2.0/3.0, 1.0, 1.0), 0x0000FF);
//     }
//     
//     #[test]
//     fn default_tint_grass() {
//         assert_eq!(default_tint("grass_block").0, 0.569);
//     }
// }
// ---------------------------------------------------------------------------