//! Port of `client/js/world/chunk.js` - Chunk and Section types.
//!
//! This module contains the core chunk storage types ported from the JavaScript
//! `Section` and `Chunk` classes. The hot section decoding loop lives in
//! `crate::chunk::decode_section` (WASM) with a JS fallback in `chunk.js`.

use crate::chunk::{LIGHT_BYTES, SECTION_VOLUME};

/// A single 16x16x16 chunk section.
///
/// Stores block states, block light, sky light, and a non-air block count.
#[derive(Clone, Debug)]
pub struct Section {
    pub blocks: Vec<u32>,
    pub block_light: Vec<u8>,
    pub sky_light: Vec<u8>,
    pub non_air: u32,
}

impl Section {
    /// Creates a new empty section.
    ///
    /// `has_sky` determines whether the sky light array is initialized to 0xff (full sky)
    /// or 0 (no sky, e.g. in the Nether/End).
    pub fn new(has_sky: bool) -> Self {
        Section {
            blocks: vec![0; SECTION_VOLUME],
            block_light: vec![0; LIGHT_BYTES],
            sky_light: if has_sky {
                vec![0xff; LIGHT_BYTES]
            } else {
                vec![0; LIGHT_BYTES]
            },
            non_air: 0,
        }
    }

    /// Computes the flattened index for a block within the section: `(y << 8) | (z << 4) | x`.
    #[inline]
    pub fn index(x: u32, y: u32, z: u32) -> usize {
        ((y << 8) | (z << 4) | x) as usize
    }

    /// Gets the block state at the given local coordinates.
    #[inline]
    pub fn get(&self, x: u32, y: u32, z: u32) -> u32 {
        self.blocks[Self::index(x, y, z)]
    }

    /// Sets the block state at the given local coordinates.
    ///
    /// Updates the `non_air` counter based on whether the old/new states are air.
    /// The air state list is passed in so the registry stays in JavaScript/WASM glue.
    pub fn set(&mut self, x: u32, y: u32, z: u32, state: u32, air_states: &[u32]) {
        let i = Self::index(x, y, z);
        let old = self.blocks[i];
        let was_air = air_states.iter().any(|&a| a == old);
        let now_air = air_states.iter().any(|&a| a == state);
        if was_air && !now_air {
            self.non_air += 1;
        } else if !was_air && now_air {
            self.non_air -= 1;
        }
        self.blocks[i] = state;
    }

    /// Gets the sky light value at a linear index (0..4095).
    #[inline]
    pub fn get_sky(&self, index: usize) -> u8 {
        (self.sky_light[index >> 1] >> ((index & 1) << 2)) & 15
    }

    /// Gets the block light value at a linear index (0..4095).
    #[inline]
    pub fn get_block_light(&self, index: usize) -> u8 {
        (self.block_light[index >> 1] >> ((index & 1) << 2)) & 15
    }

    /// Sets the sky light value at a linear index.
    pub fn set_sky(&mut self, index: usize, value: u8) {
        let byte = index >> 1;
        let value = value & 15;
        if index & 1 == 1 {
            self.sky_light[byte] = (self.sky_light[byte] & 0x0f) | (value << 4);
        } else {
            self.sky_light[byte] = (self.sky_light[byte] & 0xf0) | value;
        }
    }

    /// Sets the block light value at a linear index.
    pub fn set_block_light(&mut self, index: usize, value: u8) {
        let byte = index >> 1;
        let value = value & 15;
        if index & 1 == 1 {
            self.block_light[byte] = (self.block_light[byte] & 0x0f) | (value << 4);
        } else {
            self.block_light[byte] = (self.block_light[byte] & 0xf0) | value;
        }
    }

    /// Recounts the number of non-air blocks in the section.
    ///
    /// Uses the WASM `count_non_air` function when available, falls back to JS.
    /// The air state list is passed in from the registry.
    pub fn recount(&mut self, air_states: &[u32]) {
        self.non_air = crate::chunk::count_non_air(&self.blocks, air_states);
    }
}

/// A full 16x256x16 chunk column (16 sections tall).
#[derive(Clone, Debug)]
pub struct Chunk {
    pub x: i32,
    pub z: i32,
    pub has_sky: bool,
    pub sections: Vec<Option<Section>>,
    pub biomes: Vec<u32>,
    pub height_map: Vec<u8>,
    // Tile entities are kept in JavaScript (Map<string, NBT>) for simplicity.
    // The Rust side only deals with block states, light, and biomes.
}

impl Chunk {
    /// Creates a new empty chunk at the given chunk coordinates.
    pub fn new(x: i32, z: i32, has_sky: bool) -> Self {
        Chunk {
            x,
            z,
            has_sky,
            sections: (0..16).map(|_| None).collect(),
            biomes: vec![0; 256],
            height_map: vec![0; 256],
        }
    }

    /// Gets the block state at world coordinates.
    pub fn get_state(&self, x: i32, y: i32, z: i32) -> u32 {
        if !(0..256).contains(&y) {
            return 0;
        }
        let section_idx = (y >> 4) as usize;
        match &self.sections[section_idx] {
            Some(section) => {
                let lx = (x & 15) as u32;
                let ly = (y & 15) as u32;
                let lz = (z & 15) as u32;
                section.get(lx, ly, lz)
            }
            None => 0,
        }
    }

    /// Sets the block state at world coordinates.
    ///
    /// Lazily creates the section if it doesn't exist and the state is not air (0).
    /// Returns whether the state actually changed.
    pub fn set_state(&mut self, x: i32, y: i32, z: i32, state: u32, air_states: &[u32]) -> bool {
        if !(0..256).contains(&y) {
            return false;
        }
        let section_idx = (y >> 4) as usize;
        if self.sections[section_idx].is_none() {
            if state == 0 {
                return false;
            }
            self.sections[section_idx] = Some(Section::new(self.has_sky));
        }
        let section = self.sections[section_idx].as_mut().unwrap();
        let lx = (x & 15) as u32;
        let ly = (y & 15) as u32;
        let lz = (z & 15) as u32;
        let old = section.get(lx, ly, lz);
        if old == state {
            return false;
        }
        section.set(lx, ly, lz, state, air_states);
        true
    }

    /// Gets the sky light at world coordinates.
    pub fn get_sky_light(&self, x: i32, y: i32, z: i32) -> u8 {
        if y < 0 {
            return 0;
        }
        if y > 255 {
            return if self.has_sky { 15 } else { 0 };
        }
        let section_idx = (y >> 4) as usize;
        match &self.sections[section_idx] {
            Some(section) => {
                let lx = (x & 15) as u32;
                let ly = (y & 15) as u32;
                let lz = (z & 15) as u32;
                section.get_sky(Section::index(lx, ly, lz))
            }
            None => {
                if self.has_sky {
                    15
                } else {
                    0
                }
            }
        }
    }

    /// Gets the block light at world coordinates.
    pub fn get_block_light(&self, x: i32, y: i32, z: i32) -> u8 {
        if !(0..256).contains(&y) {
            return 0;
        }
        let section_idx = (y >> 4) as usize;
        match &self.sections[section_idx] {
            Some(section) => {
                let lx = (x & 15) as u32;
                let ly = (y & 15) as u32;
                let lz = (z & 15) as u32;
                section.get_block_light(Section::index(lx, ly, lz))
            }
            None => 0,
        }
    }

    /// Sets the sky light at world coordinates.
    ///
    /// Lazily creates the section if it doesn't exist.
    pub fn set_sky_light(&mut self, x: i32, y: i32, z: i32, value: u8) {
        if !(0..256).contains(&y) {
            return;
        }
        let section_idx = (y >> 4) as usize;
        if self.sections[section_idx].is_none() {
            self.sections[section_idx] = Some(Section::new(self.has_sky));
        }
        let section = self.sections[section_idx].as_mut().unwrap();
        let lx = (x & 15) as u32;
        let ly = (y & 15) as u32;
        let lz = (z & 15) as u32;
        section.set_sky(Section::index(lx, ly, lz), value);
    }

    /// Sets the block light at world coordinates.
    ///
    /// Lazily creates the section if it doesn't exist.
    pub fn set_block_light(&mut self, x: i32, y: i32, z: i32, value: u8) {
        if !(0..256).contains(&y) {
            return;
        }
        let section_idx = (y >> 4) as usize;
        if self.sections[section_idx].is_none() {
            self.sections[section_idx] = Some(Section::new(self.has_sky));
        }
        let section = self.sections[section_idx].as_mut().unwrap();
        let lx = (x & 15) as u32;
        let ly = (y & 15) as u32;
        let lz = (z & 15) as u32;
        section.set_block_light(Section::index(lx, ly, lz), value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn section_index_and_get_set() {
        let mut section = Section::new(true);
        assert_eq!(Section::index(0, 0, 0), 0);
        assert_eq!(Section::index(15, 15, 15), 4095);
        assert_eq!(section.get(0, 0, 0), 0);
        section.set(0, 0, 0, 42, &[0]);
        assert_eq!(section.get(0, 0, 0), 42);
        assert_eq!(section.non_air, 1);
        section.set(0, 0, 0, 0, &[0]);
        assert_eq!(section.non_air, 0);
    }

    #[test]
    fn section_light_nibbles() {
        let mut section = Section::new(true);
        for i in 0..4096 {
            assert_eq!(section.get_sky(i), 15);
        }
        section.set_sky(0, 3);
        section.set_sky(1, 12);
        assert_eq!(section.get_sky(0), 3);
        assert_eq!(section.get_sky(1), 12);
        // Low nibble is even index, high nibble is odd index
        assert_eq!(section.sky_light[0], 0xc3);
    }

    #[test]
    fn chunk_get_set_state() {
        let mut chunk = Chunk::new(0, 0, true);
        assert_eq!(chunk.get_state(0, 64, 0), 0);
        assert!(chunk.set_state(0, 64, 0, 1, &[0]));
        assert_eq!(chunk.get_state(0, 64, 0), 1);
        assert!(!chunk.set_state(0, 64, 0, 1, &[0])); // no change
        assert_eq!(chunk.get_state(0, 64, 0), 1);
        assert!(chunk.set_state(0, 64, 0, 0, &[0]));
        assert_eq!(chunk.get_state(0, 64, 0), 0);
    }

    #[test]
    fn chunk_light_access() {
        let mut chunk = Chunk::new(0, 0, true);
        // Sky light defaults to 15 for empty sections
        assert_eq!(chunk.get_sky_light(0, 64, 0), 15);
        chunk.set_sky_light(0, 64, 0, 5);
        assert_eq!(chunk.get_sky_light(0, 64, 0), 5);
        // Block light defaults to 0
        assert_eq!(chunk.get_block_light(0, 64, 0), 0);
        chunk.set_block_light(0, 64, 0, 10);
        assert_eq!(chunk.get_block_light(0, 64, 0), 10);
    }

    #[test]
    fn chunk_bounds() {
        let chunk = Chunk::new(0, 0, true);
        assert_eq!(chunk.get_state(0, -1, 0), 0);
        assert_eq!(chunk.get_state(0, 256, 0), 0);
        assert_eq!(chunk.get_sky_light(0, -1, 0), 0);
        assert_eq!(chunk.get_sky_light(0, 256, 0), 15); // above world = full sky
        assert_eq!(chunk.get_block_light(0, -1, 0), 0);
        assert_eq!(chunk.get_block_light(0, 256, 0), 0);
    }
}