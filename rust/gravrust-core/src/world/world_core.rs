//! Port of the data half of `client/js/world/world.js` plus
//! `client/js/world/chunk.js` and `client/js/world/slice.js`.
//!
//! The `chunk` module contains the direct port of `client/js/world/chunk.js`
//! (Section and Chunk classes) for use by other modules.
//!
//! This is the Rust voxel engine: chunk storage, 1.13 chunk packets, sky and
//! block light propagation, heightmaps, biome sampling and the 20^3 mesh
//! slices the mesher consumes. The JavaScript `World` class is still the live
//! object while the renderer/UI are migrated; the parity suite runs both
//! worlds side by side and compares every block, light value, heightmap and
//! slice.
//!
//! Not yet here: the 1.15 native light columns (`loadChunk578` /
//! `updateLight578`) and the special collision shapes (fences, stairs, doors,
//! shulker boxes). Those need the block-shape data table and are the next
//! world milestone.

pub mod chunk;

use std::collections::{HashMap, HashSet};

use wasm_bindgen::prelude::*;

// Re-export the WASM chunk functions from the crate root under a different name
// to avoid conflict with the `chunk` module above.
use crate::chunk as wasm_chunk;

pub const WORLD_HEIGHT: i32 = 256;
pub const SLICE: i32 = 20;
pub const SLICE_MARGIN: i32 = 2;
const SLICE_AREA: usize = (SLICE * SLICE) as usize;
const SLICE_VOLUME: usize = SLICE_AREA * SLICE as usize;
const SECTION_VOLUME: usize = 4096;
const LIGHT_BYTES: usize = 2048;

const DIRS: [[i32; 3]; 6] = [
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
    [-1, 0, 0],
    [1, 0, 0],
];

#[derive(Clone)]
struct Section {
    blocks: Vec<u32>,
    block_light: Vec<u8>,
    sky_light: Vec<u8>,
}

impl Section {
    fn new(has_sky: bool) -> Section {
        Section {
            blocks: vec![0; SECTION_VOLUME],
            block_light: vec![0; LIGHT_BYTES],
            sky_light: if has_sky {
                vec![0xff; LIGHT_BYTES]
            } else {
                vec![0; LIGHT_BYTES]
            },
        }
    }

    fn sky(&self, index: usize) -> u8 {
        (self.sky_light[index >> 1] >> ((index & 1) << 2)) & 15
    }

    fn block_light_at(&self, index: usize) -> u8 {
        (self.block_light[index >> 1] >> ((index & 1) << 2)) & 15
    }

    fn set_sky(&mut self, index: usize, value: u8) {
        let byte = index >> 1;
        if index & 1 == 1 {
            self.sky_light[byte] = (self.sky_light[byte] & 0x0f) | ((value & 15) << 4);
        } else {
            self.sky_light[byte] = (self.sky_light[byte] & 0xf0) | (value & 15);
        }
    }

    fn set_block_light(&mut self, index: usize, value: u8) {
        let byte = index >> 1;
        if index & 1 == 1 {
            self.block_light[byte] = (self.block_light[byte] & 0x0f) | ((value & 15) << 4);
        } else {
            self.block_light[byte] = (self.block_light[byte] & 0xf0) | (value & 15);
        }
    }
}

struct Chunk {
    has_sky: bool,
    sections: Vec<Option<Section>>,
    biomes: Vec<u32>,
    height_map: Vec<u8>,
}

impl Chunk {
    fn new(has_sky: bool) -> Chunk {
        Chunk {
            has_sky,
            sections: (0..16).map(|_| None).collect(),
            biomes: vec![0; 256],
            height_map: vec![0; 256],
        }
    }

    fn state(&self, x: i32, y: i32, z: i32) -> u32 {
        if !(0..WORLD_HEIGHT).contains(&y) {
            return 0;
        }
        match &self.sections[(y >> 4) as usize] {
            Some(section) => section.blocks[(((y & 15) << 8) | ((z & 15) << 4) | (x & 15)) as usize],
            None => 0,
        }
    }

    fn set_state(&mut self, x: i32, y: i32, z: i32, state: u32) {
        if !(0..WORLD_HEIGHT).contains(&y) {
            return;
        }
        let index = (y >> 4) as usize;
        if self.sections[index].is_none() {
            if state == 0 {
                return;
            }
            self.sections[index] = Some(Section::new(self.has_sky));
        }
        let section = self.sections[index].as_mut().unwrap();
        section.blocks[(((y & 15) << 8) | ((z & 15) << 4) | (x & 15)) as usize] = state;
    }

    fn sky_light(&self, x: i32, y: i32, z: i32) -> u8 {
        if y < 0 {
            return 0;
        }
        if y > 255 {
            return if self.has_sky { 15 } else { 0 };
        }
        match &self.sections[(y >> 4) as usize] {
            Some(section) => section.sky((((y & 15) << 8) | ((z & 15) << 4) | (x & 15)) as usize),
            None => {
                if self.has_sky {
                    15
                } else {
                    0
                }
            }
        }
    }

    fn block_light(&self, x: i32, y: i32, z: i32) -> u8 {
        if !(0..WORLD_HEIGHT).contains(&y) {
            return 0;
        }
        match &self.sections[(y >> 4) as usize] {
            Some(section) => section.block_light_at((((y & 15) << 8) | ((z & 15) << 4) | (x & 15)) as usize),
            None => 0,
        }
    }

    fn set_sky_light(&mut self, x: i32, y: i32, z: i32, value: u8) {
        if !(0..WORLD_HEIGHT).contains(&y) {
            return;
        }
        let index = (y >> 4) as usize;
        if self.sections[index].is_none() {
            self.sections[index] = Some(Section::new(self.has_sky));
        }
        let section = self.sections[index].as_mut().unwrap();
        section.set_sky((((y & 15) << 8) | ((z & 15) << 4) | (x & 15)) as usize, value);
    }

    fn set_block_light(&mut self, x: i32, y: i32, z: i32, value: u8) {
        if !(0..WORLD_HEIGHT).contains(&y) {
            return;
        }
        let index = (y >> 4) as usize;
        if self.sections[index].is_none() {
            self.sections[index] = Some(Section::new(self.has_sky));
        }
        let section = self.sections[index].as_mut().unwrap();
        section.set_block_light((((y & 15) << 8) | ((z & 15) << 4) | (x & 15)) as usize, value);
    }
}

#[derive(Clone, Copy)]
struct Change {
    x: i32,
    y: i32,
    z: i32,
    old: u32,
    new: u32,
}

/// World data exposed to JavaScript and native tests.
#[wasm_bindgen]
pub struct WorldCore {
    chunks: HashMap<(i32, i32), Chunk>,
    opacity: Vec<u8>,
    emit: Vec<u8>,
    has_sky: bool,
    batch: Option<Vec<Change>>,
    last_dirty: Vec<(i32, i32, i32)>,
}

impl WorldCore {
    fn opacity_of(table: &[u8], state: u32) -> u8 {
        table.get(state as usize).copied().unwrap_or(0)
    }

    fn chunk(&self, cx: i32, cz: i32) -> Option<&Chunk> {
        self.chunks.get(&(cx, cz))
    }

    fn set_light(&mut self, sky: bool, x: i32, y: i32, z: i32, value: u8, dirty: &mut HashSet<(i32, i32, i32)>) {
        if !(0..WORLD_HEIGHT).contains(&y) {
            return;
        }
        let Some(chunk) = self.chunks.get_mut(&(x >> 4, z >> 4)) else {
            return;
        };
        if sky {
            chunk.set_sky_light(x, y, z, value);
        } else {
            chunk.set_block_light(x, y, z, value);
        }
        Self::mark_block(dirty, x, y, z);
    }

    fn light(&self, sky: bool, x: i32, y: i32, z: i32) -> i32 {
        if y < 0 {
            return 0;
        }
        if y > 255 {
            return if sky { 15 } else { 0 };
        }
        let Some(chunk) = self.chunk(x >> 4, z >> 4) else {
            return -1;
        };
        if sky {
            chunk.sky_light(x, y, z) as i32
        } else {
            chunk.block_light(x, y, z) as i32
        }
    }

    fn source_level(&self, sky: bool, x: i32, y: i32, z: i32) -> i32 {
        let state = self.state(x, y, z);
        if !sky {
            return Self::opacity_of(&self.emit, state) as i32;
        }
        if Self::opacity_of(&self.opacity, state) > 0 {
            return 0;
        }
        match self.chunk(x >> 4, z >> 4) {
            Some(chunk) if y >= chunk.height_map[(((z & 15) << 4) | (x & 15)) as usize] as i32 => 15,
            _ => 0,
        }
    }

    fn state(&self, x: i32, y: i32, z: i32) -> u32 {
        if !(0..WORLD_HEIGHT).contains(&y) {
            return 0;
        }
        match self.chunk(x >> 4, z >> 4) {
            Some(chunk) => chunk.state(x, y, z),
            None => 0,
        }
    }

    fn mark_block(set: &mut HashSet<(i32, i32, i32)>, x: i32, y: i32, z: i32) {
        let cx = x >> 4;
        let cy = y >> 4;
        let cz = z >> 4;
        let lx = x & 15;
        let ly = y & 15;
        let lz = z & 15;
        let x0 = if lx == 0 { -1 } else { 0 };
        let x1 = if lx == 15 { 1 } else { 0 };
        let y0 = if ly == 0 && cy > 0 { -1 } else { 0 };
        let y1 = if ly == 15 && cy < 15 { 1 } else { 0 };
        let z0 = if lz == 0 { -1 } else { 0 };
        let z1 = if lz == 15 { 1 } else { 0 };
        for dx in x0..=x1 {
            for dy in y0..=y1 {
                for dz in z0..=z1 {
                    set.insert((cx + dx, cy + dy, cz + dz));
                }
            }
        }
    }

    fn compute_heights(&mut self, cx: i32, cz: i32) {
        let opacity = &self.opacity;
        let Some(chunk) = self.chunks.get_mut(&(cx, cz)) else {
            return;
        };
        for i in 0..256 {
            let lx = i & 15;
            let lz = i >> 4;
            let mut h = 0u16;
            for sy in (0..16).rev() {
                if h != 0 {
                    break;
                }
                let Some(section) = &chunk.sections[sy] else {
                    continue;
                };
                for ly in (0..16).rev() {
                    let state = section.blocks[((ly << 8) | (lz << 4) | lx) as usize];
                    if WorldCore::opacity_of(opacity, state) > 0 {
                        h = (sy * 16 + ly + 1) as u16;
                        break;
                    }
                }
            }
            chunk.height_map[i] = h as u8;
        }
    }

    fn update_height(&mut self, x: i32, y: i32, z: i32, state: u32) {
        let opacity = &self.opacity;
        let Some(chunk) = self.chunks.get_mut(&(x >> 4, z >> 4)) else {
            return;
        };
        let index = (((z & 15) << 4) | (x & 15)) as usize;
        let h = chunk.height_map[index] as i32;
        if WorldCore::opacity_of(opacity, state) > 0 {
            if y + 1 > h {
                chunk.height_map[index] = (y + 1) as u8;
            }
            return;
        }
        if y + 1 != h {
            return;
        }
        let mut ny = y - 1;
        while ny >= 0 && WorldCore::opacity_of(opacity, chunk.state(x, ny, z)) == 0 {
            ny -= 1;
        }
        chunk.height_map[index] = (ny + 1) as u8;
    }

    fn apply_changes(&mut self, changes: Vec<Change>) {
        let mut dirty: HashSet<(i32, i32, i32)> = HashSet::new();
        let mut block_seeds: Vec<i32> = Vec::new();
        let mut sky_seeds: Vec<i32> = Vec::new();
        for change in &changes {
            Self::mark_block(&mut dirty, change.x, change.y, change.z);
            let opacity_changed = Self::opacity_of(&self.opacity, change.old)
                != Self::opacity_of(&self.opacity, change.new);
            if Self::opacity_of(&self.emit, change.old) != Self::opacity_of(&self.emit, change.new)
                || opacity_changed
            {
                block_seeds.extend([change.x, change.y, change.z]);
            }
            if self.has_sky && opacity_changed {
                sky_seeds.extend([change.x, change.y, change.z]);
            }
        }
        if !block_seeds.is_empty() {
            self.relight(false, &block_seeds, &mut dirty);
        }
        if !sky_seeds.is_empty() {
            self.relight(true, &sky_seeds, &mut dirty);
        }
        self.last_dirty = dirty.into_iter().collect();
    }

    fn relight(&mut self, sky: bool, seeds: &[i32], dirty: &mut HashSet<(i32, i32, i32)>) {
        let mut remove_q: Vec<i32> = Vec::new();
        let mut add_q: Vec<i32> = Vec::new();

        for seed in (0..seeds.len()).step_by(3) {
            let (x, y, z) = (seeds[seed], seeds[seed + 1], seeds[seed + 2]);
            let old = self.light(sky, x, y, z);
            if old > 0 {
                self.set_light(sky, x, y, z, 0, dirty);
                remove_q.extend([x, y, z, old]);
            }
        }

        // Removal BFS
        let mut guard = 0;
        while !remove_q.is_empty() && guard < 400_000 {
            guard += 1;
            let level = remove_q.pop().unwrap();
            let z = remove_q.pop().unwrap();
            let y = remove_q.pop().unwrap();
            let x = remove_q.pop().unwrap();
            for (direction, offset) in DIRS.iter().enumerate() {
                let (nx, ny, nz) = (x + offset[0], y + offset[1], z + offset[2]);
                let neighbour = self.light(sky, nx, ny, nz);
                if neighbour <= 0 {
                    continue;
                }
                if neighbour < level || (sky && direction == 0 && level == 15 && neighbour == 15) {
                    self.set_light(sky, nx, ny, nz, 0, dirty);
                    remove_q.extend([nx, ny, nz, neighbour]);
                } else {
                    add_q.extend([nx, ny, nz]);
                }
            }
        }

        // Re-seed the changed blocks, exposed sky columns and lit neighbours
        for seed in (0..seeds.len()).step_by(3) {
            let (x, y, z) = (seeds[seed], seeds[seed + 1], seeds[seed + 2]);
            let source = self.source_level(sky, x, y, z);
            if source > 0 && source > self.light(sky, x, y, z) {
                self.set_light(sky, x, y, z, source as u8, dirty);
                add_q.extend([x, y, z]);
            }
            if sky && source == 15 {
                let mut yy = y - 1;
                while yy >= 0 {
                    if Self::opacity_of(&self.opacity, self.state(x, yy, z)) > 0 {
                        break;
                    }
                    if self.light(true, x, yy, z) < 15 {
                        self.set_light(true, x, yy, z, 15, dirty);
                        add_q.extend([x, yy, z]);
                    }
                    yy -= 1;
                }
            }
            for offset in DIRS {
                if self.light(sky, x + offset[0], y + offset[1], z + offset[2]) > 0 {
                    add_q.extend([x + offset[0], y + offset[1], z + offset[2]]);
                }
            }
        }

        // Addition BFS
        let mut index = 0usize;
        let mut guard = 0;
        while index < add_q.len() && guard < 800_000 {
            guard += 1;
            let (x, y, z) = (add_q[index], add_q[index + 1], add_q[index + 2]);
            index += 3;
            let level = self.light(sky, x, y, z);
            if level <= 1 {
                continue;
            }
            for (direction, offset) in DIRS.iter().enumerate() {
                let (nx, ny, nz) = (x + offset[0], y + offset[1], z + offset[2]);
                if !(0..WORLD_HEIGHT).contains(&ny) {
                    continue;
                }
                let neighbour = self.light(sky, nx, ny, nz);
                if neighbour < 0 {
                    continue;
                }
                let opacity = Self::opacity_of(&self.opacity, self.state(nx, ny, nz)) as i32;
                if opacity >= 15 {
                    continue;
                }
                let mut value = level - opacity.max(1);
                if sky && direction == 0 && level == 15 && opacity == 0 {
                    value = 15;
                }
                if value > neighbour {
                    self.set_light(sky, nx, ny, nz, value as u8, dirty);
                    add_q.extend([nx, ny, nz]);
                }
            }
        }
    }
}

#[wasm_bindgen]
impl WorldCore {
    /// `opacity[state]` = 0..15 (15 = fully opaque); `emit[state]` = 0..15.
    #[wasm_bindgen(constructor)]
    pub fn new(opacity: &[u8], emit: &[u8]) -> WorldCore {
        WorldCore {
            chunks: HashMap::new(),
            opacity: opacity.to_vec(),
            emit: emit.to_vec(),
            has_sky: true,
            batch: None,
            last_dirty: Vec::new(),
        }
    }

    pub fn set_has_sky(&mut self, has_sky: bool) {
        self.has_sky = has_sky;
    }

    pub fn has_sky(&self) -> bool {
        self.has_sky
    }

    pub fn clear(&mut self) {
        self.chunks.clear();
    }

    pub fn unload_chunk(&mut self, cx: i32, cz: i32) {
        self.chunks.remove(&(cx, cz));
    }

    pub fn is_loaded(&self, cx: i32, cz: i32) -> bool {
        self.chunks.contains_key(&(cx, cz))
    }

    pub fn chunk_count(&self) -> usize {
        self.chunks.len()
    }

    /// `World.loadChunk` for the 1.9+/1.13 chunk-data packet. Returns bytes consumed.
    pub fn load_chunk_113(
        &mut self,
        cx: i32,
        cz: i32,
        ground_up: bool,
        bit_map: u32,
        data: &[u8],
        offset: usize,
        sky_light: bool,
    ) -> usize {
        if offset > data.len() {
            return 0;
        }
        let mut o = offset;
        let has_sky = self.has_sky;
        let entry = self
            .chunks
            .entry((cx, cz))
            .or_insert_with(|| Chunk::new(has_sky));
        for s in 0..16usize {
            if bit_map & (1 << s) == 0 {
                if ground_up {
                    entry.sections[s] = None;
                }
                continue;
            }
            let mut blocks = vec![0u32; SECTION_VOLUME];
            let consumed = match wasm_chunk::decode_section_at(data, o, &mut blocks) {
                Ok(consumed) => consumed,
                Err(_) => return 0,
            };
            o += consumed;
            if o + LIGHT_BYTES > data.len() {
                return 0;
            }
            let mut section = match entry.sections[s].take() {
                Some(section) => section,
                None => Section::new(entry.has_sky),
            };
            section.blocks = blocks;
            section.block_light.copy_from_slice(&data[o..o + LIGHT_BYTES]);
            o += LIGHT_BYTES;
            if sky_light {
                if o + LIGHT_BYTES > data.len() {
                    return 0;
                }
                section.sky_light.copy_from_slice(&data[o..o + LIGHT_BYTES]);
                o += LIGHT_BYTES;
            }
            entry.sections[s] = Some(section);
        }
        if ground_up {
            if o + 1024 > data.len() {
                return 0;
            }
            let mut biomes = vec![0u32; 256];
            for (i, biome) in biomes.iter_mut().enumerate() {
                let b = &data[o + i * 4..o + i * 4 + 4];
                *biome = u32::from_be_bytes([b[0], b[1], b[2], b[3]]);
            }
            o += 1024;
            entry.biomes = biomes;
        }
        self.compute_heights(cx, cz);
        o - offset
    }

    pub fn get_state(&self, x: i32, y: i32, z: i32) -> u32 {
        self.state(x, y, z)
    }

    pub fn set_state(&mut self, x: i32, y: i32, z: i32, state: u32) -> bool {
        if !(0..WORLD_HEIGHT).contains(&y) {
            return false;
        }
        let Some(chunk) = self.chunks.get_mut(&(x >> 4, z >> 4)) else {
            return false;
        };
        let old = chunk.state(x, y, z);
        if old == state {
            return false;
        }
        chunk.set_state(x, y, z, state);
        self.update_height(x, y, z, state);
        let change = Change { x, y, z, old, new: state };
        match &mut self.batch {
            Some(batch) => batch.push(change),
            None => self.apply_changes(vec![change]),
        }
        true
    }

    pub fn begin_batch(&mut self) {
        if self.batch.is_none() {
            self.batch = Some(Vec::new());
        }
    }

    pub fn end_batch(&mut self) {
        if let Some(changes) = self.batch.take() {
            if !changes.is_empty() {
                self.apply_changes(changes);
            }
        }
    }

    pub fn get_sky_light(&self, x: i32, y: i32, z: i32) -> u8 {
        let Some(chunk) = self.chunk(x >> 4, z >> 4) else {
            return if self.has_sky { 15 } else { 0 };
        };
        chunk.sky_light(x, y, z)
    }

    pub fn get_block_light(&self, x: i32, y: i32, z: i32) -> u8 {
        match self.chunk(x >> 4, z >> 4) {
            Some(chunk) => chunk.block_light(x, y, z),
            None => 0,
        }
    }

    pub fn get_biome(&self, x: i32, z: i32, y: i32) -> u32 {
        let Some(chunk) = self.chunk(x >> 4, z >> 4) else {
            return 1;
        };
        if chunk.biomes.len() == 1024 {
            let cy = y.div_euclid(4).clamp(0, 63) as usize;
            chunk.biomes[(cy << 4) | ((((z & 15) >> 2) as usize) << 2) | (((x & 15) >> 2) as usize)]
        } else if chunk.biomes.is_empty() {
            0
        } else {
            chunk.biomes[((((z & 15) as usize) << 4) | ((x & 15) as usize)).min(chunk.biomes.len() - 1)]
        }
    }

    // ---- debug accessors used by the parity suite and future Rust clients ----

    pub fn section_blocks(&self, cx: i32, sy: u32, cz: i32) -> Vec<u32> {
        self.chunk(cx, cz)
            .and_then(|chunk| chunk.sections.get(sy as usize))
            .and_then(|section| section.as_ref())
            .map(|section| section.blocks.clone())
            .unwrap_or_default()
    }

    pub fn section_sky_light(&self, cx: i32, sy: u32, cz: i32) -> Vec<u8> {
        self.chunk(cx, cz)
            .and_then(|chunk| chunk.sections.get(sy as usize))
            .and_then(|section| section.as_ref())
            .map(|section| section.sky_light.clone())
            .unwrap_or_default()
    }

    pub fn section_block_light(&self, cx: i32, sy: u32, cz: i32) -> Vec<u8> {
        self.chunk(cx, cz)
            .and_then(|chunk| chunk.sections.get(sy as usize))
            .and_then(|section| section.as_ref())
            .map(|section| section.block_light.clone())
            .unwrap_or_default()
    }

    pub fn height_map(&self, cx: i32, cz: i32) -> Vec<u8> {
        self.chunk(cx, cz)
            .map(|chunk| chunk.height_map.clone())
            .unwrap_or_default()
    }

    pub fn chunk_biomes(&self, cx: i32, cz: i32) -> Vec<u32> {
        self.chunk(cx, cz)
            .map(|chunk| chunk.biomes.clone())
            .unwrap_or_default()
    }

    pub fn last_dirty(&self) -> Vec<i32> {
        let mut out = Vec::with_capacity(self.last_dirty.len() * 3);
        for (x, y, z) in &self.last_dirty {
            out.extend([*x, *y, *z]);
        }
        out
    }

    /// Build the 20^3 section neighbourhood the mesher consumes
    /// (`world/slice.js`). Coordinates are section coordinates.
    pub fn build_slice(&self, cx: i32, sy: i32, cz: i32, biome_blend_radius: i32) -> SliceData {
        let mut states = vec![0u16; SLICE_VOLUME];
        let mut light = vec![0u8; SLICE_VOLUME];
        let ox = cx * 16 - SLICE_MARGIN;
        let oy = sy * 16 - SLICE_MARGIN;
        let oz = cz * 16 - SLICE_MARGIN;
        let center = self.chunk(cx, cz);
        let has_sky = center.map(|chunk| chunk.has_sky).unwrap_or(true);

        let biome_margin = biome_blend_radius.clamp(0, 7).max(SLICE_MARGIN);
        let biome_size = 16 + biome_margin * 2;
        let biome_ox = cx * 16 - biome_margin;
        let biome_oz = cz * 16 - biome_margin;
        let mut biomes = vec![0u8; (SLICE * biome_size * biome_size) as usize];

        let segments: [(i32, i32, i32, i32); 3] = [(0, 2, -1, 14), (2, 16, 0, 0), (18, 2, 1, 0)];
        for ly in 0..SLICE {
            let y = oy + ly;
            for lz in 0..SLICE {
                let z = oz + lz;
                let cz_offset = (z >> 4) - cz;
                let bz = z & 15;
                let row = (ly as usize) * SLICE_AREA + (lz as usize) * SLICE as usize;
                for (lx0, len, dx, bx0) in segments {
                    let chunk = self.chunk(cx + dx, cz + cz_offset);
                    let start = row + lx0 as usize;
                    let end = start + len as usize;
                    let Some(chunk) = chunk else {
                        light[start..end].fill(0xf0);
                        continue;
                    };
                    if y < 0 {
                        continue;
                    }
                    if y > 255 {
                        light[start..end].fill(0xf0);
                        continue;
                    }
                    let Some(section) = &chunk.sections[(y >> 4) as usize] else {
                        if chunk.has_sky {
                            light[start..end].fill(0xf0);
                        }
                        continue;
                    };
                    let base = ((y & 15) << 8) | (bz << 4);
                    for k in 0..len as usize {
                        let index = (base | (bx0 + k as i32)) as usize;
                        states[start + k] = section.blocks[index] as u16;
                        light[start + k] = (section.sky(index) << 4) | section.block_light_at(index);
                    }
                }
            }
        }

        for ly in 0..SLICE {
            for lz in 0..biome_size {
                let z = biome_oz + lz;
                let cz_offset = (z >> 4) - cz;
                for lx in 0..biome_size {
                    let x = biome_ox + lx;
                    let cx_offset = (x >> 4) - cx;
                    let value = if self.chunk(cx + cx_offset, cz + cz_offset).is_some() {
                        self.get_biome(x, z, oy + ly) as u8
                    } else {
                        1
                    };
                    biomes[((ly * biome_size + lz) * biome_size + lx) as usize] = value;
                }
            }
        }

        SliceData {
            x: cx,
            y: sy,
            z: cz,
            ox,
            oy,
            oz,
            has_sky,
            states,
            light,
            biomes,
            biome_ox,
            biome_oz,
            biome_size,
            biome_layers: SLICE,
        }
    }
}

/// The Rust equivalent of `world/slice.js`'s `{ states, light, biomes, ... }`.
#[wasm_bindgen]
pub struct SliceData {
    x: i32,
    y: i32,
    z: i32,
    ox: i32,
    oy: i32,
    oz: i32,
    has_sky: bool,
    states: Vec<u16>,
    light: Vec<u8>,
    biomes: Vec<u8>,
    biome_ox: i32,
    biome_oz: i32,
    biome_size: i32,
    biome_layers: i32,
}

#[wasm_bindgen]
impl SliceData {
    #[wasm_bindgen(getter)]
    pub fn x(&self) -> i32 { self.x }
    #[wasm_bindgen(getter)]
    pub fn y(&self) -> i32 { self.y }
    #[wasm_bindgen(getter)]
    pub fn z(&self) -> i32 { self.z }
    #[wasm_bindgen(getter)]
    pub fn ox(&self) -> i32 { self.ox }
    #[wasm_bindgen(getter)]
    pub fn oy(&self) -> i32 { self.oy }
    #[wasm_bindgen(getter)]
    pub fn oz(&self) -> i32 { self.oz }
    #[wasm_bindgen(getter)]
    pub fn has_sky(&self) -> bool { self.has_sky }
    #[wasm_bindgen(getter)]
    pub fn states(&self) -> Vec<u16> { self.states.clone() }
    #[wasm_bindgen(getter)]
    pub fn light(&self) -> Vec<u8> { self.light.clone() }
    #[wasm_bindgen(getter)]
    pub fn biomes(&self) -> Vec<u8> { self.biomes.clone() }
    #[wasm_bindgen(getter)]
    pub fn biome_ox(&self) -> i32 { self.biome_ox }
    #[wasm_bindgen(getter)]
    pub fn biome_oz(&self) -> i32 { self.biome_oz }
    #[wasm_bindgen(getter)]
    pub fn biome_size(&self) -> i32 { self.biome_size }
    #[wasm_bindgen(getter)]
    pub fn biome_layers(&self) -> i32 { self.biome_layers }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn push_varint(out: &mut Vec<u8>, mut value: u32) {
        loop {
            let mut byte = (value & 0x7f) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80;
            }
            out.push(byte);
            if value == 0 {
                break;
            }
        }
    }

    fn section_bytes(bits: u8, palette: &[u32], values: &[u32], block_light: u8, sky_light: u8) -> Vec<u8> {
        // Build the same 1.9+ section layout the server sends.
        let mut out = vec![bits];
        if bits <= 8 {
            push_varint(&mut out, palette.len() as u32);
            for value in palette {
                push_varint(&mut out, *value);
            }
        }
        let long_count = (4096 * bits as usize).div_ceil(64);
        push_varint(&mut out, long_count as u32);
        let mask = (1u64 << bits) - 1;
        let mut longs = vec![0u64; long_count];
        for (i, value) in values.iter().enumerate() {
            let bit = i * bits as usize;
            let word = bit / 64;
            let shift = bit % 64;
            longs[word] |= ((*value as u64) & mask) << shift;
            if shift + bits as usize > 64 {
                longs[word + 1] |= ((*value as u64) & mask) >> (64 - shift);
            }
        }
        for long in longs {
            out.extend_from_slice(&long.to_be_bytes());
        }
        out.extend(std::iter::repeat(block_light).take(LIGHT_BYTES));
        out.extend(std::iter::repeat(sky_light).take(LIGHT_BYTES));
        out
    }

    fn empty_world() -> WorldCore {
        // state 0 = air, state 1 = opaque stone, state 2 = glowing lamp
        WorldCore::new(&[0, 15, 0], &[0, 0, 14])
    }

    #[test]
    fn loads_a_chunk_and_computes_heights() {
        let values = vec![0u32; 4096];
        let section = section_bytes(4, &[0], &values, 0, 0xff);
        let mut data = section.clone();
        data.extend(std::iter::repeat(0u32).take(256).flat_map(|v| v.to_be_bytes()));
        let mut world = empty_world();
        let consumed = world.load_chunk_113(0, 0, true, 1, &data, 0, true);
        assert_eq!(consumed, data.len());
        assert_eq!(world.get_state(0, 64, 0), 0);
        assert_eq!(world.get_sky_light(0, 64, 0), 15);
        assert_eq!(world.height_map(0, 0)[0], 0);

        world.set_state(0, 64, 0, 1);
        assert_eq!(world.get_state(0, 64, 0), 1);
        assert_eq!(world.height_map(0, 0)[0], 65);
        assert_eq!(world.get_sky_light(0, 64, 0), 0);
        // The column below is dark, but open neighbours still spread 14 into it.
        assert_eq!(world.get_sky_light(0, 63, 0), 14);

        world.set_state(0, 64, 0, 0);
        assert_eq!(world.height_map(0, 0)[0], 0);
        assert_eq!(world.get_sky_light(0, 64, 0), 15);
    }

    #[test]
    fn propagates_block_light() {
        let values = vec![0u32; 4096];
        let section = section_bytes(4, &[0], &values, 0, 0xff);
        let mut data = section.clone();
        data.extend(std::iter::repeat(0u32).take(256).flat_map(|v| v.to_be_bytes()));
        let mut world = empty_world();
        world.load_chunk_113(0, 0, true, 1, &data, 0, true);

        world.set_state(4, 64, 4, 2);
        assert_eq!(world.get_block_light(4, 64, 4), 14);
        assert_eq!(world.get_block_light(5, 64, 4), 13);
        assert_eq!(world.get_block_light(6, 64, 4), 12);
        world.set_state(4, 64, 4, 0);
        assert_eq!(world.get_block_light(4, 64, 4), 0);
        assert_eq!(world.get_block_light(5, 64, 4), 0);
    }

    #[test]
    fn builds_a_slice() {
        let values = vec![0u32; 4096];
        let section = section_bytes(4, &[0], &values, 0xff, 0xff);
        let mut data = section.clone();
        data.extend(std::iter::repeat(0u32).take(256).flat_map(|v| v.to_be_bytes()));
        let mut world = empty_world();
        world.load_chunk_113(0, 0, true, 1, &data, 0, true);

        let slice = world.build_slice(0, 0, 0, 2);
        assert_eq!(slice.states.len(), SLICE_VOLUME);
        assert_eq!(slice.light.len(), SLICE_VOLUME);
        assert_eq!(slice.biomes.len(), (SLICE * 20 * 20) as usize);
        assert_eq!(slice.has_sky, true);
        // The slice origin is section (-2,-2,-2), outside the loaded chunk, so
        // the copy is filled with open sky by the same rule as buildSlice.
        assert_eq!(slice.states[0], 0);
        assert_eq!(slice.light[0], 0xf0);
    }
}
