//! Port of `client/js/world/biome-zoom.js` (`FuzzyOffsetBiomeZoomer`, 1.15.2).
//!
//! The seed arriving from the wire is already hashed by the server. The
//! zoomer jitters each four-block cell corner with a 64-bit LCG and picks the
//! nearest jittered corner. `sample` needs the caller's noise function, so it
//! stays in JavaScript and asks this module for `cell`.

use std::collections::{HashMap, VecDeque};
use wasm_bindgen::prelude::*;

const MULT: i64 = 6_364_136_223_846_793_005u64 as i64;
const ADD: i64 = 1_442_695_040_888_963_407u64 as i64;
const CACHE_LIMIT: usize = 16384;

fn step(seed: i64, salt: i64) -> i64 {
    seed.wrapping_mul(seed.wrapping_mul(MULT).wrapping_add(ADD))
        .wrapping_add(salt)
}

fn fiddle(seed: i64) -> f64 {
    (((seed >> 24) & 1023) as f64 / 1024.0 - 0.5) * 0.9
}

/// One zoomer instance. The cache is bounded like the JavaScript `Map`; its
/// eviction policy does not affect results because every entry is memoised
/// from deterministic arithmetic.
#[wasm_bindgen]
pub struct BiomeZoom {
    seed: i64,
    corners: HashMap<[i32; 3], [f64; 3]>,
    order: VecDeque<[i32; 3]>,
}

#[wasm_bindgen]
impl BiomeZoom {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: i64) -> BiomeZoom {
        BiomeZoom {
            seed,
            corners: HashMap::new(),
            order: VecDeque::new(),
        }
    }

    pub fn seed(&self) -> i64 {
        self.seed
    }

    /// Jitter offsets for a corner, in the same order as the JavaScript.
    pub fn offset(&mut self, x: i32, y: i32, z: i32) -> Vec<f64> {
        if let Some(value) = self.corners.get(&[x, y, z]) {
            return value.to_vec();
        }
        let mut seed = self.seed;
        for coordinate in [x, y, z, x, y, z] {
            seed = step(seed, coordinate as i64);
        }
        let a = fiddle(seed);
        seed = step(seed, self.seed);
        let b = fiddle(seed);
        seed = step(seed, self.seed);
        let value = [a, b, fiddle(seed)];
        self.insert([x, y, z], value);
        value.to_vec()
    }

    /// The corner chosen for a block position: `(qx, qy, qz)`.
    pub fn cell(&mut self, x: i32, y: i32, z: i32) -> Vec<i32> {
        let (x, y, z) = (x - 2, y - 2, z - 2);
        let (qx, qy, qz) = (x >> 2, y >> 2, z >> 2);
        let (fx, fy, fz) = ((x & 3) as f64 / 4.0, (y & 3) as f64 / 4.0, (z & 3) as f64 / 4.0);
        let mut closest = f64::INFINITY;
        let mut result = [qx, qy, qz];
        for corner in 0..8 {
            let dx = (corner >> 2) & 1;
            let dy = (corner >> 1) & 1;
            let dz = corner & 1;
            let (a, b, c) = (qx + dx, qy + dy, qz + dz);
            let offset = self.offset(a, b, c);
            let xx = fx - dx as f64 + offset[0];
            let yy = fy - dy as f64 + offset[1];
            let zz = fz - dz as f64 + offset[2];
            let distance = zz * zz + yy * yy + xx * xx;
            if distance < closest {
                closest = distance;
                result = [a, b, c];
            }
        }
        result.to_vec()
    }
}

impl BiomeZoom {
    fn insert(&mut self, key: [i32; 3], value: [f64; 3]) {
        if self.corners.len() >= CACHE_LIMIT {
            if let Some(oldest) = self.order.pop_front() {
                self.corners.remove(&oldest);
            }
        }
        self.corners.insert(key, value);
        self.order.push_back(key);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offsets_are_in_the_jitter_range() {
        let mut zoom = BiomeZoom::new(0x1234_5678_9abc_def0u64 as i64);
        for x in -3..4 {
            for z in -3..4 {
                let offset = zoom.offset(x, 0, z);
                assert_eq!(offset.len(), 3);
                for value in offset {
                    assert!((-0.45..0.45).contains(&value), "{}", value);
                }
            }
        }
    }

    #[test]
    fn offsets_are_cached_and_stable() {
        let mut zoom = BiomeZoom::new(42);
        let first = zoom.offset(1, 2, 3);
        let second = zoom.offset(1, 2, 3);
        assert_eq!(first, second);
    }

    #[test]
    fn cells_stay_within_one_corner_of_the_query() {
        let mut zoom = BiomeZoom::new(-7);
        for x in -16..16 {
            for z in -16..16 {
                let cell = zoom.cell(x, 64, z);
                assert_eq!(cell.len(), 3);
                assert!((cell[0] - ((x - 2) >> 2)).abs() <= 1);
                assert!((cell[1] - ((64 - 2) >> 2)).abs() <= 1);
                assert!((cell[2] - ((z - 2) >> 2)).abs() <= 1);
            }
        }
    }
}
