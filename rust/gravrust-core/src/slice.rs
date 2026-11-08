//! Port of `client/js/world/slice.js`.
//!
//! World slices (like Sodium's WorldSlice): a self-contained copy of the blocks,
//! light, and biomes around one 16^3 section with a 2-block margin, so mesh
//! workers need no copy of the whole world and can build geometry in parallel.

pub const SLICE: usize = 20; // edge length: section (16) + 2 blocks each side
pub const SLICE_MARGIN: i32 = 2;
pub const SLICE_AREA: usize = SLICE * SLICE; // 400
pub const SLICE_VOLUME: usize = SLICE_AREA * SLICE; // 8000

/// Holds a cloned neighbourhood for parallel section meshing.
#[derive(Debug, Clone, PartialEq)]
pub struct WorldSlice {
    pub cx: i32,
    pub cy: i32,
    pub cz: i32,
    pub ox: i32,
    pub oy: i32,
    pub oz: i32,
    pub has_sky: bool,
    pub states: Vec<u16>,
    pub light: Vec<u8>,
    pub biomes: Vec<u8>,
}

impl WorldSlice {
    pub fn new(cx: i32, cy: i32, cz: i32, has_sky: bool) -> Self {
        Self {
            cx,
            cy,
            cz,
            ox: cx * 16 - SLICE_MARGIN,
            oy: cy * 16 - SLICE_MARGIN,
            oz: cz * 16 - SLICE_MARGIN,
            has_sky,
            states: vec![0; SLICE_VOLUME],
            light: vec![0xf0; SLICE_VOLUME],
            biomes: vec![1; SLICE_AREA],
        }
    }

    /// Linear index in the 20x20x20 slice array from local coordinates (0..20).
    #[inline]
    pub fn index(lx: usize, ly: usize, lz: usize) -> usize {
        ly * SLICE_AREA + lz * SLICE + lx
    }

    /// Block state at local slice coordinates.
    #[inline]
    pub fn get_block_state(&self, lx: usize, ly: usize, lz: usize) -> u16 {
        self.states[Self::index(lx, ly, lz)]
    }

    /// Packed light (sky << 4 | block) at local slice coordinates.
    #[inline]
    pub fn get_light(&self, lx: usize, ly: usize, lz: usize) -> u8 {
        self.light[Self::index(lx, ly, lz)]
    }

    /// Biome ID at local slice X/Z coordinates.
    #[inline]
    pub fn get_biome(&self, lx: usize, lz: usize) -> u8 {
        self.biomes[lz * SLICE + lx]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slice_dimensions() {
        assert_eq!(SLICE, 20);
        assert_eq!(SLICE_MARGIN, 2);
        assert_eq!(SLICE_AREA, 400);
        assert_eq!(SLICE_VOLUME, 8000);
    }

    #[test]
    fn test_slice_offsets() {
        let slice = WorldSlice::new(2, 3, 4, true);
        assert_eq!(slice.cx, 2);
        assert_eq!(slice.cy, 3);
        assert_eq!(slice.cz, 4);
        assert_eq!(slice.ox, 30); // 2 * 16 - 2
        assert_eq!(slice.oy, 46); // 3 * 16 - 2
        assert_eq!(slice.oz, 62); // 4 * 16 - 2
        assert_eq!(slice.states.len(), SLICE_VOLUME);
        assert_eq!(slice.light.len(), SLICE_VOLUME);
        assert_eq!(slice.biomes.len(), SLICE_AREA);
    }

    #[test]
    fn test_slice_indexing() {
        assert_eq!(WorldSlice::index(0, 0, 0), 0);
        assert_eq!(WorldSlice::index(19, 0, 0), 19);
        assert_eq!(WorldSlice::index(0, 0, 1), 20);
        assert_eq!(WorldSlice::index(0, 1, 0), 400);
        assert_eq!(WorldSlice::index(19, 19, 19), 7999);
    }
}
