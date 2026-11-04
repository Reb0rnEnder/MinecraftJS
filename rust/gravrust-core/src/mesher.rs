//! Port of `client/js/render/mesher.js`: section mesher that turns 16³ block
//! sections into vertex buffers.
//!
//! This is the core chunk meshing algorithm. It handles:
//! - Face culling with fast/fancy graphics modes
//! - Ambient occlusion (AO) computation
//! - Biome color blending
//! - Fluid rendering (water/lava)
//! - Model baking integration
//! - LOD (level of detail) rendering

use crate::blocks::{BlockDef, BlockRegistry, DIR_OFFSETS, DIR_NAMES, OPPOSITE};
use crate::biomes::{grass_color, foliage_color, water_color};
use crate::models::ModelStore;
use crate::visgraph::compute_visibility;
use serde_json::Value;
use std::collections::HashMap;

// ------------------------------------------------------------ constants

const BYTES_PER_VERTEX: usize = 20;
const FACE_SHADE: [f64; 6] = [0.5, 1.0, 0.8, 0.8, 0.6, 0.6];

// Block.EnumOffsetType: 1 = XZ (BlockFlower), 2 = XYZ (BlockTallGrass)
const OFFSET_TYPES: &[(&str, u8)] = &[
    ("dandelion", 1), ("poppy", 1), ("blue_orchid", 1), ("allium", 1), ("azure_bluet", 1),
    ("red_tulip", 1), ("orange_tulip", 1), ("white_tulip", 1), ("pink_tulip", 1), ("oxeye_daisy", 1),
    ("brown_mushroom", 1), ("red_mushroom", 1),
    ("grass", 2), ("tall_grass", 2), ("fern", 2), ("large_fern", 2),
];

// Tangent axes per face direction for AO sampling: [e1, e2]
const AO_AXES: [[[i32; 3]; 2]; 6] = [
    [[1, 0, 0], [0, 0, 1]], [[1, 0, 0], [0, 0, 1]], [[1, 0, 0], [0, 1, 0]],
    [[1, 0, 0], [0, 1, 0]], [[0, 0, 1], [0, 1, 0]], [[0, 0, 1], [0, 1, 0]],
];

// Small plants left out of far (LOD) sections
const LOD_SKIP: &[&str] = &[
    "grass", "tall_grass", "fern", "seagrass", "tall_seagrass", "dandelion", "poppy",
    "blue_orchid", "allium", "azure_bluet", "red_tulip", "orange_tulip", "white_tulip",
    "pink_tulip", "oxeye_daisy", "dead_bush", "brown_mushroom", "red_mushroom",
    "sunflower", "lilac", "rose_bush", "peony", "large_fern", "lily_pad", "cobweb",
];

const ZERO_OFFSET: [f64; 3] = [0.0, 0.0, 0.0];

// ------------------------------------------------------------ helpers

/// `MathHelper.getPositionRandom` - low 32 bits (matches JS exactly).
pub fn position_random(x: i32, y: i32, z: i32) -> i32 {
    let i = x.wrapping_mul(3129871) ^ z.wrapping_mul(116129781) ^ y;
    (i.wrapping_mul(i).wrapping_mul(42317861).wrapping_add(i.wrapping_mul(11))) | 0
}

/// `blockModelOffset` - shared with damage rendering so plants keep the same per-position model offsets.
pub fn block_model_offset(name: &str, x: i32, y: i32, z: i32) -> [f64; 3] {
    let type_ = OFFSET_TYPES.iter().find(|(n, _)| *n == name).map(|(_, t)| *t);
    if type_.is_none() { return ZERO_OFFSET; }
    let r = position_random(x, y, z);
    let t = type_.unwrap();
    let ox = (((r >> 16) & 15) as f64 / 15.0 - 0.5) * 0.5;
    let oy = if t == 2 { (((r >> 20) & 15) as f64 / 15.0 - 1.0) * 0.2 } else { 0.0 };
    let oz = (((r >> 24) & 15) as f64 / 15.0 - 0.5) * 0.5;
    [ox, oy, oz]
}

/// Per-block-id flags for the hot face test (computed once):
/// 1 = leaves, 2 = matching glass/ice/slime/portal interiors, 4 = pane end caps.
fn face_flags(blocks: &[BlockDef]) -> Vec<u8> {
    let mut flags = vec![0u8; blocks.len()];
    for (i, b) in blocks.iter().enumerate() {
        let n = &b.name;
        let mut f = 0u8;
        if n.ends_with("_leaves") { f |= 1; }
        if n == "glass" || n.ends_with("_stained_glass") || n == "ice" || n == "frosted_ice" || n == "slime_block" || n == "nether_portal" { f |= 2; }
        if b.is_pane { f |= 4; }
        flags[i] = f;
    }
    flags
}

/// Does the block's solid shape cover a whole fluid face?
fn covers_fluid_face(reg: &BlockRegistry, state: u32, dir: usize, height: f64) -> bool {
    let b = reg.def(state);
    if b.id == 0 || b.is_liquid { return false; }
    if b.opaque { return true; }
    if b.translucent || b.name == "glass" || b.name.ends_with("_leaves") { return false; }
    let axis = if dir < 2 { 1 } else if dir < 4 { 2 } else { 0 };
    let u = if axis == 0 { 2 } else { 0 };
    let v = if axis == 1 { 2 } else { 1 };
    let plane = if dir == 1 { height } else { (dir & 1) as f64 };
    let mut remaining = vec![[0.0, 0.0, 1.0, if axis == 1 { 1.0 } else { height }]];
    for box_ in reg.static_collision_boxes(state) {
        if box_[axis] > plane + 1e-6 || box_[axis + 3] < plane - 1e-6 { continue; }
        let mut next = Vec::new();
        for r in &remaining {
            let x0 = r[0].max(box_[u]); let y0 = r[1].max(box_[v]);
            let x1 = r[2].min(box_[u + 3]); let y1 = r[3].min(box_[v + 3]);
            if x0 >= x1 || y0 >= y1 { next.push(*r); continue; }
            if r[0] < x0 { next.push([r[0], r[1], x0, r[3]]); }
            if x1 < r[2] { next.push([x1, r[1], r[2], r[3]]); }
            if r[1] < y0 { next.push([x0, r[1], x1, y0]); }
            if y1 < r[3] { next.push([x0, y1, x1, r[3]]); }
        }
        remaining = next; if remaining.is_empty() { return true; }
    }
    false
}

// ------------------------------------------------------------ vertex buffer

/// Packed vertex buffer matching gfx FORMAT.terrain:
/// pos unorm16 x4, uv unorm16 x2, colour unorm8 x4, light unorm8 x2 (+2 pad)
struct VBuf {
    u16: Vec<u16>,
    u8: Vec<u8>,
    cap: usize,
    n: usize,
}

impl VBuf {
    fn new() -> Self {
        let mut buf = Self { u16: Vec::with_capacity(1024 * 10), u8: Vec::with_capacity(1024 * 20), cap: 1024, n: 0 };
        buf.u16.resize(1024 * 10, 0);
        buf.u8.resize(1024 * 20, 0);
        buf
    }
    fn reset(&mut self) -> &mut Self { self.n = 0; self }
    fn push10(&mut self, x: f64, y: f64, z: f64, u: f64, v: f64, r: f64, g: f64, b: f64, sky: u8, blk: u8, animation: u16) {
        if self.n >= self.cap {
            self.cap *= 2;
            self.u16.resize(self.cap * 10, 0);
            self.u8.resize(self.cap * 20, 0);
        }
        let w = self.n * 10;
        let by = self.n * 20;
        self.u16[w] = ((x + 8.0) * 2048.0 + 0.5) as u16;
        self.u16[w + 1] = ((y + 8.0) * 2048.0 + 0.5) as u16;
        self.u16[w + 2] = ((z + 8.0) * 2048.0 + 0.5) as u16;
        self.u16[w + 3] = animation;
        self.u16[w + 4] = (u * 65535.0 + 0.5) as u16;
        self.u16[w + 5] = (v * 65535.0 + 0.5) as u16;
        self.u8[by + 12] = (r.clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
        self.u8[by + 13] = (g.clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
        self.u8[by + 14] = (b.clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
        self.u8[by + 15] = 255;
        self.u8[by + 16] = sky.saturating_mul(17);
        self.u8[by + 17] = blk.saturating_mul(17);
        self.n += 1;
    }
    fn result(&self) -> Vec<u8> { self.u8[..self.n * BYTES_PER_VERTEX].to_vec() }
}

// ------------------------------------------------------------ model types (matching ModelStore output)

#[derive(Clone, Debug)]
pub struct BakedModel {
    pub quads: Vec<BakedQuad>,
    pub ao: bool,
}

#[derive(Clone, Debug)]
pub struct BakedQuad {
    pub pos: Vec<f64>,      // 12 floats (4 vertices * 3)
    pub uv: Vec<f64>,       // 8 floats (4 vertices * 2)
    pub dir: i32,           // face direction 0-5
    pub cull: i32,          // cull face direction (-1 = none)
    pub tint: i32,          // tint index (-1 = none)
    pub shade: bool,        // whether to apply face shading
    pub alpha: bool,        // whether texture has alpha
}

// ------------------------------------------------------------ mesher options

#[derive(Clone, Debug)]
pub struct MesherOptions {
    pub fancy: bool,
    pub smooth: i32,
    pub lod: bool,
    pub alt: bool,
    pub biome_blend_radius: i32,
}

impl Default for MesherOptions {
    fn default() -> Self {
        Self { fancy: true, smooth: 2, lod: false, alt: true, biome_blend_radius: 2 }
    }
}

// ------------------------------------------------------------ world trait

pub trait World {
    fn get_state(&self, x: i32, y: i32, z: i32) -> u32;
    fn get_light(&self, x: i32, y: i32, z: i32) -> u16;
    fn get_biome(&self, x: i32, z: i32, y: i32) -> u32;
    fn get_section_blocks(&self) -> Option<Vec<u32>>;
    fn has_tile_props(&self, x: i32, y: i32, z: i32) -> bool;
    fn get_tile_props(&self, x: i32, y: i32, z: i32) -> Option<HashMap<String, String>>;
    fn get_biome_info(&self, biome_id: u32) -> Option<(String, f64, f64)>;
}

// ------------------------------------------------------------ mesher

pub struct Mesher<'a> {
    reg: &'a BlockRegistry,
    store: &'a mut ModelStore,
    options: MesherOptions,
    world: Option<&'a dyn World>,
    face_flags: Vec<u8>,
    state_models: HashMap<u32, Option<BakedModel>>,
    cache: HashMap<String, BakedModel>,
    tint_cache: [u32; 16],
    corner_cache: [[[f64; 3]; 4]; 12],
    corner_valid: [bool; 12],
    visible: [u8; 6],
    _reads: i32,
    neighbors: [i32; 6],
}

impl<'a> Mesher<'a> {
    pub fn new(reg: &'a BlockRegistry, store: &'a mut ModelStore) -> Self {
        Self {
            reg, store, options: MesherOptions::default(), world: None,
            face_flags: Vec::new(), state_models: HashMap::new(), cache: HashMap::new(),
            tint_cache: [0; 16], corner_cache: [[[0.0; 3]; 4]; 12], corner_valid: [false; 12], visible: [0; 6],
            _reads: 0, neighbors: [0; 6],
        }
    }

    pub fn set_options(&mut self, options: MesherOptions) { self.options = options; }
    pub fn set_world(&mut self, world: &'a dyn World) {
        self.world = Some(world);
        self.face_flags = face_flags(&self.reg.blocks);
    }

    /// Compute biome color blend (average over radius).
    fn biome_blend<F>(&self, x: i32, z: i32, y: i32, fn_: F) -> u32
    where F: Fn(i32, i32, i32) -> u32 {
        let world = self.world.expect("world not set");
        let radius = self.options.biome_blend_radius.clamp(0, 7);
        let samples = ((radius * 2 + 1) * (radius * 2 + 1)) as u32;
        let (mut r, mut g, mut b) = (0u32, 0u32, 0u32);
        for dz in -radius..=radius {
            for dx in -radius..=radius {
                let c = fn_(x + dx, z + dz, y);
                r += (c >> 16) & 255;
                g += (c >> 8) & 255;
                b += c & 255;
            }
        }
        (((r / samples) << 16) | ((g / samples) << 8) | (b / samples)) & 0xFFFFFF
    }

    /// Get tint color for a block state.
    fn tint_for(&mut self, state: u32, tint: i32, x: i32, y: i32, z: i32) -> u32 {
        if tint < 0 { return 0xFFFFFF; }
        if self.tint_cache[tint as usize] != 0 { return self.tint_cache[tint as usize]; }

        let b = self.reg.def(state);
        let n = &b.name;
        let props = self.reg.props_json(state);
        let props_val: Value = serde_json::from_str(&props).unwrap_or(Value::Null);
        let props_obj = props_val.as_object();

        let color = match n.as_str() {
            "grass_block" | "grass" | "tall_grass" | "fern" | "large_fern" | "sugar_cane" =>
                self.biome_blend(x, z, y, |bx, bz, by| {
                    let world = self.world.expect("");
                    let biome_id = world.get_biome(bx, bz, by);
                    let biome_info = world.get_biome_info(biome_id).unwrap_or(("plains".to_string(), 0.8, 0.4));
                    grass_color(&biome_info.0, biome_info.1, biome_info.2, by, &[])
                }),
            "vine" => self.biome_blend(x, z, y, |bx, bz, by| {
                let world = self.world.expect("");
                let biome_id = world.get_biome(bx, bz, by);
                let biome_info = world.get_biome_info(biome_id).unwrap_or(("plains".to_string(), 0.8, 0.4));
                foliage_color(&biome_info.0, biome_info.1, biome_info.2, by, &[])
            }),
            "spruce_leaves" => 0x619961,
            "birch_leaves" => 0x80A755,
            n if n.ends_with("_leaves") => self.biome_blend(x, z, y, |bx, bz, by| {
                let world = self.world.expect("");
                let biome_id = world.get_biome(bx, bz, by);
                let biome_info = world.get_biome_info(biome_id).unwrap_or(("plains".to_string(), 0.8, 0.4));
                foliage_color(&biome_info.0, biome_info.1, biome_info.2, by, &[])
            }),
            "lily_pad" => 0x208030,
            "attached_pumpkin_stem" | "attached_melon_stem" => 0xE0C71C,
            "pumpkin_stem" | "melon_stem" => {
                let age = props_obj
                    .and_then(|o| o.get("age"))
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<i32>().ok())
                    .unwrap_or(0);
                (((age * 32) << 16) | ((255 - age * 8) << 8) | (age * 4)) as u32
            }
            "redstone_wire" => {
                let power = props_obj
                    .and_then(|o| o.get("power"))
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<f64>().ok())
                    .unwrap_or(0.0);
                let f = power / 15.0;
                let r = if power == 0.0 { 0.3 } else { f * 0.6 + 0.4 };
                let g = (f * f * 0.7 - 0.5).max(0.0);
                let bl = (f * f * 0.6 - 0.7).max(0.0);
                (((r * 255.0) as u32) << 16) | (((g * 255.0) as u32) << 8) | ((bl * 255.0) as u32)
            }
            _ => 0xFFFFFF,
        };

        self.tint_cache[tint as usize] = color;
        color
    }

    /// Combined light for AO sampling: returns (sky, block) or None if position is opaque.
    fn light_at(&self, x: i32, y: i32, z: i32) -> Option<(u8, u8)> {
        let world = self.world.expect("world not set");
        let state = world.get_state(x, y, z);
        let b = self.reg.def(state);
        if b.id != 0 && b.opaque { return None; }
        let l = world.get_light(x, y, z);
        if b.use_neighbor_brightness {
            let mut best = l;
            for o in DIR_OFFSETS {
                let nl = world.get_light(x + o[0], y + o[1], z + o[2]);
                if (nl >> 4) > (best >> 4) { best = (nl & 0xF0) | (best & 0x0F); }
                if (nl & 0x0F) > (best & 0x0F) { best = (best & 0xF0) | (nl & 0x0F); }
            }
            return Some(((best >> 4) as u8, (best & 0x0F) as u8));
        }
        Some(((l >> 4) as u8, (l & 0x0F) as u8))
    }

    /// Get light of a state at position.
    fn _light_of(&self, state: u32, x: i32, y: i32, z: i32) -> Option<(u8, u8)> {
        let b = self.reg.def(state);
        if b.id != 0 && b.opaque { return None; }
        if b.use_neighbor_brightness { return self.light_at(x, y, z); }
        let world = self.world.expect("world not set");
        let l = world.get_light(x, y, z);
        Some(((l >> 4) as u8, (l & 0x0F) as u8))
    }

    /// Compute per-corner light+AO for a face.
    fn face_corners(world: &dyn World, reg: &BlockRegistry, px: i32, py: i32, pz: i32, dir: usize, out: &mut [[f64; 3]; 4]) {
        let [e1, e2] = AO_AXES[dir];
        let s_p = world.get_state(px, py, pz);
        let b_p = reg.def(s_p);
        let center = Self::_light_of_static(world, reg, s_p, px, py, pz);
        let c_ao = b_p.ao_light;
        let c_sky = center.map(|(s, _)| s as f64).unwrap_or(0.0);
        let c_blk = center.map(|(_, b)| b as f64).unwrap_or(0.0);
        for k in 0..4 {
            let s1 = if k == 0 || k == 3 { -1.0 } else { 1.0 };
            let s2 = if k < 2 { -1.0 } else { 1.0 };
            let ax = px as f64 + e1[0] as f64 * s1;
            let ay = py as f64 + e1[1] as f64 * s1;
            let az = pz as f64 + e1[2] as f64 * s1;
            let bx = px as f64 + e2[0] as f64 * s2;
            let by = py as f64 + e2[1] as f64 * s2;
            let bz = pz as f64 + e2[2] as f64 * s2;
            let cx = ax + e2[0] as f64 * s2;
            let cy = ay + e2[1] as f64 * s2;
            let cz = az + e2[2] as f64 * s2;
            let s_a = world.get_state(ax as i32, ay as i32, az as i32);
            let s_b = world.get_state(bx as i32, by as i32, bz as i32);
            let b_a = reg.def(s_a); let b_b = reg.def(s_b);
            let ao_a = b_a.ao_light; let ao_b = b_b.ao_light;
            let t_a = b_a.id == 0 || !b_a.opaque; let t_b = b_b.id == 0 || !b_b.opaque;
            let (ao_c, l_c) = if t_a || t_b {
                let s_c = world.get_state(cx as i32, cy as i32, cz as i32);
                let b_c = reg.def(s_c);
                (b_c.ao_light, Self::_light_of_static(world, reg, s_c, cx as i32, cy as i32, cz as i32))
            } else { (ao_a, Self::_light_of_static(world, reg, s_a, ax as i32, ay as i32, az as i32)) };
            let ao = (ao_a + ao_b + ao_c + c_ao) * 0.25;
            let la = Self::_light_of_static(world, reg, s_a, ax as i32, ay as i32, az as i32);
            let lb = Self::_light_of_static(world, reg, s_b, bx as i32, by as i32, bz as i32);
            let sky = (la.as_ref().map(|(s, _)| *s as f64).unwrap_or(c_sky) + lb.as_ref().map(|(s, _)| *s as f64).unwrap_or(c_sky) + l_c.as_ref().map(|(s, _)| *s as f64).unwrap_or(c_sky) + c_sky) / 4.0;
            let blk = (la.as_ref().map(|(_, b)| *b as f64).unwrap_or(c_blk) + lb.as_ref().map(|(_, b)| *b as f64).unwrap_or(c_blk) + l_c.as_ref().map(|(_, b)| *b as f64).unwrap_or(c_blk) + c_blk) / 4.0;
            out[k] = [ao, sky, blk];
        }
    }

    /// Static version of _light_of for use in face_corners.
    fn _light_of_static(world: &dyn World, reg: &BlockRegistry, state: u32, x: i32, y: i32, z: i32) -> Option<(u8, u8)> {
        let b = reg.def(state);
        if b.id != 0 && b.opaque { return None; }
        if b.use_neighbor_brightness {
            let mut best = world.get_light(x, y, z);
            for o in DIR_OFFSETS {
                let nl = world.get_light(x + o[0], y + o[1], z + o[2]);
                if (nl >> 4) > (best >> 4) { best = (nl & 0xF0) | (best & 0x0F); }
                if (nl & 0x0F) > (best & 0x0F) { best = (best & 0xF0) | (nl & 0x0F); }
            }
            return Some(((best >> 4) as u8, (best & 0x0F) as u8));
        }
        let l = world.get_light(x, y, z);
        Some(((l >> 4) as u8, (l & 0x0F) as u8))
    }

    /// Should render face between this block and neighbor?
    fn should_render_face(&self, state: u32, n_state: u32, dir: usize) -> bool {
        let nb = self.reg.def(n_state);
        if nb.id == 0 { return true; }
        if nb.opaque { return false; }
        let own = self.reg.def(state);
        let nid = nb.id;
        let f = self.face_flags.get(own.id as usize).copied().unwrap_or(0);
        if !self.options.fancy && (self.face_flags.get(nid as usize).copied().unwrap_or(0) & 1) != 0 { return false; }
        if own.id == nid {
            if (f & 2) != 0 && !(own.name == "nether_portal" && state != n_state) { return false; }
            if (f & 4) != 0 {
                if dir < 2 { return false; }
                let p = self.reg.props_json(state); let np = self.reg.props_json(n_state);
                let p_val: Value = serde_json::from_str(&p).unwrap_or(Value::Null);
                let np_val: Value = serde_json::from_str(&np).unwrap_or(Value::Null);
                let p_obj = p_val.as_object(); let np_obj = np_val.as_object();
                let dir_name = DIR_NAMES[dir]; let opp_name = DIR_NAMES[OPPOSITE[dir]];
                if p_obj.and_then(|o| o.get(dir_name)).and_then(|v| v.as_str()) == Some("true")
                    && np_obj.and_then(|o| o.get(opp_name)).and_then(|v| v.as_str()) == Some("true") { return false; }
            }
        }
        true
    }

    /// Resolve and bake model for a block state at position.
    fn get_model(&mut self, state: u32, x: i32, y: i32, z: i32) -> Option<BakedModel> {
        let world = self.world.expect("world not set");
        let has_tp = world.has_tile_props(x, y, z);
        if !has_tp {
            if let Some(cached) = self.state_models.get(&state) {
                return cached.clone();
            }
        }

        // Use counting getter to detect if resolution reads neighbors
        self._reads = 0;
        let counting_get = |x: i32, y: i32, z: i32| {
            self._reads += 1;
            world.get_state(x, y, z)
        };

        // Resolve blockstate (simplified - using ModelStore directly)
        // In the JS version, resolveState reads neighboring blocks to determine variant.
        // For now, we use the default state model and note if it reads neighbors.
        let b = self.reg.def(state);
        let file = format!("block/{}", b.name);
        let variant = None::<String>; // Would be determined by resolveState

        // Build cache key from file + variant + properties
        let props_str = self.reg.props_json(state);
        let variant_for_key = variant.as_ref().map(|s| s.as_str()).unwrap_or("");
        let key = format!("{}|{}|{}", file, variant_for_key, props_str);

        let m = if let Some(cached) = self.cache.get(&key) {
            cached.clone()
        } else {
            // Try to find and bake the model
            let mut model_result = None;

            if let Some(bs) = self.store.blockstates().get(&file) {
                // Get properties as JSON map
                let props_val: Value = serde_json::from_str(&props_str).unwrap_or(Value::Null);
                let props_map = props_val.as_object().cloned().unwrap_or_default();

                // Find variant
                let variant_val = self.store.find_variant(&file, &props_map, variant.as_deref());

                if let Some(v) = variant_val {
                    if v.is_array() {
                        // Multiple weighted variants
                        let variants = v.as_array().unwrap();
                        let mut baked_variants = Vec::new();
                        let mut weights = Vec::new();
                        for (i, variant) in variants.iter().enumerate() {
                            let baked = self.store.bake_variant(&file, &props_map, variant.as_str(), i as f64);
                            if let Some(quads) = baked.get("quads").and_then(|q| q.as_array()) {
                                baked_variants.push(self.json_to_baked_model(&baked));
                                weights.push(variant.get("weight").and_then(|w| w.as_i64()).unwrap_or(1) as u32);
                            }
                        }
                        if !baked_variants.is_empty() {
                            model_result = Some(BakedModel {
                                quads: baked_variants.into_iter().flat_map(|m| m.quads).collect(),
                                ao: true,
                            });
                        }
                    } else {
                        // Single variant
                        let baked = self.store.bake_variant(&file, &props_map, variant.as_deref(), 0.0);
                        if let Some(quads) = baked.get("quads").and_then(|q| q.as_array()) {
                            model_result = Some(self.json_to_baked_model(&baked));
                        }
                    }
                }
            }

            // Fallback to direct model baking if no blockstate
            if model_result.is_none() {
                if let Some(model_name) = b.name.strip_prefix("minecraft:") {
                    let baked = self.store.bake_model(model_name, 0, 0, false);
                    if let Some(quads) = baked.get("quads").and_then(|q| q.as_array()) {
                        model_result = Some(self.json_to_baked_model(&baked));
                    }
                }
            }

            let m = model_result;
            self.cache.insert(key, m.clone().unwrap_or(BakedModel { quads: vec![], ao: true }));
            m.unwrap_or(BakedModel { quads: vec![], ao: true })
        };

        let static_state = self._reads == 0 && !has_tp;
        if static_state { self.state_models.insert(state, Some(m.clone())); }
        Some(m)
    }

    /// Convert JSON baked model to Rust structs.
    fn json_to_baked_model(&self, baked: &Value) -> BakedModel {
        let mut quads = Vec::new();
        if let Some(quads_arr) = baked.get("quads").and_then(|q| q.as_array()) {
            for q in quads_arr {
                let pos: Vec<f64> = q.get("pos").and_then(|p| p.as_array()).map(|a| a.iter().filter_map(|v| v.as_f64()).collect()).unwrap_or_default();
                let uv: Vec<f64> = q.get("uv").and_then(|u| u.as_array()).map(|a| a.iter().filter_map(|v| v.as_f64()).collect()).unwrap_or_default();
                let dir = q.get("dir").and_then(|d| d.as_i64()).unwrap_or(0) as i32;
                let cull = q.get("cull").and_then(|c| c.as_i64()).unwrap_or(-1) as i32;
                let tint = q.get("tint").and_then(|t| t.as_i64()).unwrap_or(-1) as i32;
                let shade = q.get("shade").and_then(|s| s.as_bool()).unwrap_or(true);
                let alpha = q.get("alpha").and_then(|a| a.as_bool()).unwrap_or(false);
                if pos.len() == 12 && uv.len() == 8 {
                    quads.push(BakedQuad { pos, uv, dir, cull, tint, shade, alpha });
                }
            }
        }
        let ao = baked.get("ao").and_then(|a| a.as_bool()).unwrap_or(true);
        BakedModel { quads, ao }
    }

    /// Build a section mesh.
    pub fn build_section(&mut self, world: &'a dyn World, cx: i32, sy: i32, cz: i32, lod: bool) -> Option<MeshResult> {
        if lod {
            let saved = self.options.clone();
            self.options = MesherOptions { fancy: false, smooth: 0, lod: true, alt: self.options.alt, biome_blend_radius: self.options.biome_blend_radius };
            let result = self.build_section(world, cx, sy, cz, false);
            self.options = saved;
            return result;
        }
        self.set_world(world);
        let w = self.world.expect("world not set");
        let mut solid = VBuf::new();
        let mut cutout = VBuf::new();
        let mut trans = VBuf::new();
        let (bx0, by0, bz0) = (cx * 16, sy * 16, cz * 16);
        let blocks_arr = w.get_section_blocks()?;

        // Pre-fetch atlas UVs for fluids
        let water_still = self.store.atlas_uv("block/water_still").unwrap_or([0.0; 4]);
        let water_flow = self.store.atlas_uv("block/water_flow").unwrap_or([0.0; 4]);
        let lava_still = self.store.atlas_uv("block/lava_still").unwrap_or([0.0; 4]);
        let lava_flow = self.store.atlas_uv("block/lava_flow").unwrap_or([0.0; 4]);

        'block_loop: for i in 0..4096 {
            let state = blocks_arr[i];
            let b = self.reg.def(state);
            if b.id == 0 { continue 'block_loop; }
            let lx = (i & 15) as i32;
            let lz = ((i >> 4) & 15) as i32;
            let ly = (i >> 8) as i32;
            let x = bx0 + lx;
            let y = by0 + ly;
            let z = bz0 + lz;

            // Fluid rendering
            let fluid = self.fluid_state(state);
            if let Some(f) = fluid {
                self.render_fluid(&f, state, x, y, z, &mut trans, lx, ly, lz,
                    &water_still, &water_flow, &lava_still, &lava_flow);
            }
            if b.is_liquid { continue 'block_loop; }
            if !b.has_model { continue 'block_loop; }
            if self.options.lod && LOD_SKIP.iter().any(|&n| n == b.name) { continue 'block_loop; }

            let model = self.get_model(state, x, y, z);
            if model.is_none() || model.as_ref().unwrap().quads.is_empty() { continue 'block_loop; }
            let model = model.unwrap();

            // Block offset for plants
            let [ox, oy, oz] = if let Some(t) = OFFSET_TYPES.iter().find(|(n, _)| *n == b.name) { block_model_offset(t.0, x, y, z) } else { ZERO_OFFSET };

            let use_ao = self.options.smooth > 0 && model.ao && b.emit_light == 0;
            let fast_leaves = !self.options.fancy && b.name.ends_with("_leaves");

            for d in 0..6 {
                let o = DIR_OFFSETS[d];
                self.visible[d] = if self.should_render_face(state, w.get_state(x + o[0], y + o[1], z + o[2]), d) { 1 } else { 0 };
            }
            self.corner_valid.fill(false);
            let own_light = self.light_at(x, y, z);
            self.tint_cache.fill(0);

            for q in &model.quads {
                if q.cull >= 0 && self.visible[q.cull as usize] == 0 { continue; }

                // Select buffer
                let buf: &mut VBuf = if b.translucent {
                    &mut trans
                } else if q.alpha && !fast_leaves {
                    &mut cutout
                } else {
                    &mut solid
                };

                let tint = if q.tint < 0 { 0xFFFFFF } else { self.tint_for(state, q.tint, x, y, z) };
                let tr = ((tint >> 16) & 255) as f64 / 255.0;
                let tg = ((tint >> 8) & 255) as f64 / 255.0;
                let tb = (tint & 255) as f64 / 255.0;
                let shade = if q.shade { FACE_SHADE[q.dir as usize] } else { 1.0 };

                let axis = q.dir >> 1;
                let ci = if axis == 0 { 1 } else if axis == 1 { 2 } else { 0 };
                let plane_val = q.pos[ci];
                let aligned = (q.pos[3 + ci] - plane_val).abs() < 1e-4 &&
                    (q.pos[6 + ci] - plane_val).abs() < 1e-4 &&
                    (q.pos[9 + ci] - plane_val).abs() < 1e-4;

                let middle_v = (q.uv[1].min(q.uv[3]).min(q.uv[5]).min(q.uv[7])
                    + q.uv[1].max(q.uv[3]).max(q.uv[5]).max(q.uv[7])) * 0.5;

                if use_ao && aligned {
                    let flush = (q.dir & 1) != 0 && plane_val > 0.9999 || (q.dir & 1) == 0 && plane_val < 0.0001;
                    let o = DIR_OFFSETS[q.dir as usize];
                    let (px, py, pz) = (
                        if flush { x + o[0] } else { x },
                        if flush { y + o[1] } else { y },
                        if flush { z + o[2] } else { z },
                    );
                    let ck = q.dir as usize * 2 + if flush { 1 } else { 0 };

                    let need_compute = !self.corner_valid[ck];
                    if need_compute {
                        let corners = &mut self.corner_cache[ck];
                        let w_ref = self.world.expect("world not set");
                        Self::face_corners(w_ref, self.reg, px, py, pz, q.dir as usize, corners);
                        self.corner_valid[ck] = true;
                    }

                    let [e1, e2] = AO_AXES[q.dir as usize];
                    for v in 0..4 {
                        let vx = q.pos[v * 3];
                        let vy = q.pos[v * 3 + 1];
                        let vz = q.pos[v * 3 + 2];
                        let t1 = vx * e1[0] as f64 + vy * e1[1] as f64 + vz * e1[2] as f64;
                        let t2 = vx * e2[0] as f64 + vy * e2[1] as f64 + vz * e2[2] as f64;
                        let w0 = (1.0 - t1) * (1.0 - t2);
                        let w1 = t1 * (1.0 - t2);
                        let w2 = t1 * t2;
                        let w3 = (1.0 - t1) * t2;
                        let corners = &self.corner_cache[ck];
                        let ao = corners[0][0] * w0 + corners[1][0] * w1 + corners[2][0] * w2 + corners[3][0] * w3;
                        let sky = corners[0][1] * w0 + corners[1][1] * w1 + corners[2][1] * w2 + corners[3][1] * w3;
                        let blk = corners[0][2] * w0 + corners[1][2] * w1 + corners[2][2] * w2 + corners[3][2] * w3;
                        let f = shade * ao;
                        let anim = (state | if q.uv[v * 2 + 1] < middle_v { 32768 } else { 0 }) as u16;
                        buf.push10(
                            lx as f64 + vx + ox, ly as f64 + vy + oy, lz as f64 + vz + oz,
                            q.uv[v * 2], q.uv[v * 2 + 1],
                            tr * f, tg * f, tb * f,
                            sky as u8, blk as u8, anim
                        );
                    }
                } else {
                    let mut l = own_light;
                    if q.cull >= 0 {
                        let o = DIR_OFFSETS[q.cull as usize];
                        if let Some(nl) = self.light_at(x + o[0], y + o[1], z + o[2]) {
                            l = Some(nl);
                        }
                    }
                    if l.is_none() {
                        l = Some(((w.get_light(x, y, z) >> 4) as u8, (w.get_light(x, y, z) & 0x0F) as u8));
                    }
                    let (sky, blk) = l.unwrap_or((0, 0));
                    for v in 0..4 {
                        let anim = (state | if q.uv[v * 2 + 1] < middle_v { 32768 } else { 0 }) as u16;
                        buf.push10(
                            lx as f64 + q.pos[v * 3] + ox, ly as f64 + q.pos[v * 3 + 1] + oy, lz as f64 + q.pos[v * 3 + 2] + oz,
                            q.uv[v * 2], q.uv[v * 2 + 1],
                            tr * shade, tg * shade, tb * shade,
                            sky, blk, anim
                        );
                    }
                }
            }
        }

        let states_u16: Vec<u16> = blocks_arr.iter().map(|&s| s as u16).collect();
        let vis = compute_visibility(&states_u16, &self.face_flags, self.options.fancy);
        Some(MeshResult {
            solid: solid.result(),
            cutout: cutout.result(),
            translucent: trans.result(),
            vis: vis.to_vec(),
            lod: self.options.lod,
        })
    }

    // ------------------------------------------------------------ Fluid rendering

    fn fluid_state(&self, state: u32) -> Option<FluidState> {
        let b = self.reg.def(state);
        if b.is_liquid {
            return Some(FluidState {
                is_lava: b.is_lava,
                level: if b.name == "water" || b.name == "lava" { 0 } else { 0 }, // Source level
                // In real impl, we'd get level from state properties
            });
        }
        // Waterlogged check would go here
        None
    }

    fn fluid_matches(&self, state: u32, lava: bool) -> bool {
        let b = self.reg.def(state);
        b.is_liquid && b.is_lava == lava
    }

    fn fluid_height(&self, x: i32, y: i32, z: i32, lava: bool) -> f64 {
        let w = self.world.expect("world not set");
        let mut count = 0.0;
        let mut sum = 0.0;
        for j in 0..4 {
            let bx = x - (j & 1);
            let bz = z - ((j >> 1) & 1);
            if self.fluid_matches(w.get_state(bx, y + 1, bz), lava) {
                return 1.0;
            }
            let s = w.get_state(bx, y, bz);
            if !self.fluid_matches(s, lava) {
                let b = self.reg.def(s);
                let solid = b.id != 0 && b.bounding_box == "block";
                if !solid {
                    sum += 1.0;
                    count += 1.0;
                }
            } else {
                // For simplicity, assume source level (0) or flowing
                // Real impl would read level from state properties
                let level = 0;
                let pct = ((if level >= 8 { 0 } else { level }) + 1) as f64 / 9.0;
                if level >= 8 || level == 0 {
                    sum += pct * 10.0;
                    count += 10.0;
                }
                sum += pct;
                count += 1.0;
            }
        }
        if count > 0.0 { 1.0 - sum / count } else { 0.0 }
    }

    fn flow_decay(&self, x: i32, y: i32, z: i32, lava: bool) -> i32 {
        let w = self.world.expect("world not set");
        let s = w.get_state(x, y, z);
        if !self.fluid_matches(s, lava) { return -1; }
        // Simplified: source = 0, flowing > 0
        0
    }

    fn flow_direction(&self, x: i32, y: i32, z: i32, lava: bool) -> f64 {
        let w = self.world.expect("world not set");
        let mut vx: f64 = 0.0;
        let mut vz: f64 = 0.0;
        let i = self.flow_decay(x, y, z, lava);
        for [dx, dz] in [[0, -1], [1, 0], [0, 1], [-1, 0]] {
            let j = self.flow_decay(x + dx, y, z + dz, lava);
            if j < 0 {
                let s = w.get_state(x + dx, y, z + dz);
                let b = self.reg.def(s);
                let blocks_movement = b.id != 0 && b.bounding_box == "block";
                if !blocks_movement {
                    let k = self.flow_decay(x + dx, y - 1, z + dz, lava);
                    if k >= 0 {
                        vx += dx as f64 * (k - (i - 8)) as f64;
                        vz += dz as f64 * (k - (i - 8)) as f64;
                    }
                }
            } else {
                vx += dx as f64 * (j - i) as f64;
                vz += dz as f64 * (j - i) as f64;
            }
        }
        if vx == 0.0 && vz == 0.0 { return -1000.0; }
        vz.atan2(vx) - std::f64::consts::PI / 2.0
    }

    fn render_fluid(
        &mut self,
        fluid: &FluidState,
        state: u32,
        x: i32, y: i32, z: i32,
        buf: &mut VBuf,
        lx: i32, ly: i32, lz: i32,
        water_still: &[f64; 4], water_flow: &[f64; 4],
        lava_still: &[f64; 4], lava_flow: &[f64; 4]
    ) {
        let w = self.world.expect("world not set");
        let lava = fluid.is_lava;

        let still = if lava { lava_still } else { water_still };
        let flow = if lava { lava_flow } else { water_flow };
        if still[0] == 0.0 && still[2] == 0.0 { return; }

        // Biome color for water
        let col = if lava {
            0xFFFFFF
        } else {
            self.biome_blend(x, z, y, |bx, bz, by| {
                let world = self.world.expect("");
                let biome_id = world.get_biome(bx, bz, by);
                let biome_info = world.get_biome_info(biome_id).unwrap_or(("plains".to_string(), 0.8, 0.4));
                water_color(biome_id, &biome_info.0, None)
            })
        };
        let cr = ((col >> 16) & 255) as f64 / 255.0;
        let cg = ((col >> 8) & 255) as f64 / 255.0;
        let cb = (col & 255) as f64 / 255.0;

        let up = w.get_state(x, y + 1, z);
        let down = w.get_state(x, y - 1, z);
        let side_states = [
            w.get_state(x, y, z - 1),
            w.get_state(x, y, z + 1),
            w.get_state(x - 1, y, z),
            w.get_state(x + 1, y, z),
        ];

        let h00 = self.fluid_height(x, y, z, lava);
        let h01 = self.fluid_height(x, y, z + 1, lava);
        let h11 = self.fluid_height(x + 1, y, z + 1, lava);
        let h10 = self.fluid_height(x + 1, y, z, lava);
        let height = h00.max(h01).max(h11).max(h10);

        let render_top = !self.fluid_matches(up, lava) && !covers_fluid_face(self.reg, state, 1, height);
        let render_bottom = !self.fluid_matches(down, lava) && !covers_fluid_face(self.reg, state, 0, height) && !covers_fluid_face(self.reg, down, 1, height);
        let sides: Vec<bool> = side_states.iter().enumerate().map(|(i, s)| {
            !self.fluid_matches(*s, lava) &&
            !covers_fluid_face(self.reg, state, i + 2, height) &&
            !covers_fluid_face(self.reg, *s, (i + 2) ^ 1, height)
        }).collect();

        if !render_top && !render_bottom && !sides.iter().any(|&v| v) { return; }

        let U = |uv: &[f64; 4], t: f64| uv[0] + (uv[2] - uv[0]) * t / 16.0;
        let V = |uv: &[f64; 4], t: f64| uv[1] + (uv[3] - uv[1]) * t / 16.0;

        let light = |lx2: i32, ly2: i32, lz2: i32| {
            let a = w.get_light(lx2, ly2, lz2);
            a
        };

        let lt = (light(x, y, z) >> 4).max(light(x, y + 1, z) >> 4) as u8;
        let lb = (light(x, y, z) & 15).max(light(x, y + 1, z) & 15) as u8;
        let emit_l = if lava { 15 } else { 0 };

        let mut add_quad = |verts: [[f64; 5]; 4], shade: f64, sky: u8, blk: u8| {
            for v in &verts {
                buf.push10(
                    lx as f64 + v[0], ly as f64 + v[1], lz as f64 + v[2],
                    v[3], v[4],
                    cr * shade, cg * shade, cb * shade,
                    sky, blk.max(emit_l), 0
                );
            }
            for v in verts.iter().rev() {
                buf.push10(
                    lx as f64 + v[0], ly as f64 + v[1], lz as f64 + v[2],
                    v[3], v[4],
                    cr * shade, cg * shade, cb * shade,
                    sky, blk.max(emit_l), 0
                );
            }
        };

        if render_top {
            let dir_a = self.flow_direction(x, y, z, lava);
            let uvs: [[f64; 2]; 4] = if dir_a < -999.0 {
                [
                    [U(still, 0.0), V(still, 0.0)],
                    [U(still, 0.0), V(still, 16.0)],
                    [U(still, 16.0), V(still, 16.0)],
                    [U(still, 16.0), V(still, 0.0)],
                ]
            } else {
                let s = dir_a.sin() * 0.25;
                let c = dir_a.cos() * 0.25;
                [
                    [U(flow, 8.0 + (-c - s) * 16.0), V(flow, 8.0 + (-c + s) * 16.0)],
                    [U(flow, 8.0 + (-c + s) * 16.0), V(flow, 8.0 + (c + s) * 16.0)],
                    [U(flow, 8.0 + (c + s) * 16.0), V(flow, 8.0 + (c - s) * 16.0)],
                    [U(flow, 8.0 + (c - s) * 16.0), V(flow, 8.0 + (-c - s) * 16.0)],
                ]
            };
            add_quad([
                [0.0, h00 - 0.001, 0.0, uvs[0][0], uvs[0][1]],
                [0.0, h01 - 0.001, 1.0, uvs[1][0], uvs[1][1]],
                [1.0, h11 - 0.001, 1.0, uvs[2][0], uvs[2][1]],
                [1.0, h10 - 0.001, 0.0, uvs[3][0], uvs[3][1]],
            ], 1.0, lt, lb);
        }

        if render_bottom {
            let l = w.get_light(x, y - 1, z);
            add_quad([
                [0.0, 0.0, 1.0, U(still, 0.0), V(still, 16.0)],
                [0.0, 0.0, 0.0, U(still, 0.0), V(still, 0.0)],
                [1.0, 0.0, 0.0, U(still, 16.0), V(still, 0.0)],
                [1.0, 0.0, 1.0, U(still, 16.0), V(still, 16.0)],
            ], 0.5, (l >> 4) as u8, (l & 15) as u8);
        }

        let side_defs = [
            (h00, h10, 0.0, 1.0, 0.001, 0.001, [0, 0, -1]),
            (h11, h01, 1.0, 0.0, 0.999, 0.999, [0, 0, 1]),
            (h01, h00, 0.001, 0.001, 1.0, 0.0, [-1, 0, 0]),
            (h10, h11, 0.999, 0.999, 0.0, 1.0, [1, 0, 0]),
        ];

        for j in 0..4 {
            if !sides[j] { continue; }
            let (f20, f21, d3, d4, d5, d6, o) = side_defs[j];
            let u0 = U(flow, 0.0);
            let u1 = U(flow, 8.0);
            let v0 = V(flow, (1.0 - f20) * 16.0 * 0.5);
            let v1 = V(flow, (1.0 - f21) * 16.0 * 0.5);
            let v2 = V(flow, 8.0);
            let l = w.get_light(x + o[0], y, z + o[2]);
            let shade = if j < 2 { 0.8 } else { 0.6 };
            add_quad([
                [d3, f20, d5, u0, v0],
                [d4, f21, d6, u1, v1],
                [d4, 0.0, d6, u1, v2],
                [d3, 0.0, d5, u0, v2],
            ], shade, (l >> 4) as u8, (l & 15) as u8);
        }
    }
}

// ------------------------------------------------------------ supporting types

#[derive(Clone, Debug)]
pub struct FluidState {
    pub is_lava: bool,
    pub level: i32,
}

pub struct MeshResult {
    pub solid: Vec<u8>,
    pub cutout: Vec<u8>,
    pub translucent: Vec<u8>,
    pub vis: Vec<u8>,
    pub lod: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn position_random_matches_js() {
        assert_eq!(position_random(0, 0, 0), 0);
        // x=1, y=0, z=0: i = 3129871, result = (i*i*42317861 + i*11) as i32
        assert_eq!(position_random(1, 0, 0), 1197169450);
    }

    #[test]
    fn block_model_offset_returns_zero_for_unknown() {
        assert_eq!(block_model_offset("stone", 0, 0, 0), ZERO_OFFSET);
    }

    #[test]
    fn block_model_offset_flower() {
        let o = block_model_offset("dandelion", 0, 0, 0);
        assert_ne!(o[0], 0.0);
        assert_eq!(o[1], 0.0);
        assert_ne!(o[2], 0.0);
    }

    #[test]
    fn block_model_offset_tall_grass() {
        let o = block_model_offset("tall_grass", 0, 0, 0);
        assert_ne!(o[0], 0.0);
        assert_ne!(o[1], 0.0);
        assert_ne!(o[2], 0.0);
    }
}