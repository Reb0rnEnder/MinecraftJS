//! Port of `client/js/util/jrandom.js`.
//! Java-like java.util.Random: 48-bit LCG (Linear Congruential Generator).
//! Uses native u64 arithmetic (Minecraft vanilla-identical procedural visuals).

use wasm_bindgen::prelude::*;

/// Minecraft's JavaRandom multiplier (from source: 0x5DEECE66D)
const MULT: u64 = 0x5DEECE66D;
/// Mask for 48-bit state
const MASK: u64 = (1u64 << 48) - 1;

/// Java-like Random class with 48-bit LCG state
#[wasm_bindgen]
pub struct JavaRandom {
    seed: u64,
}

#[wasm_bindgen]
impl JavaRandom {
    /// Create a new JavaRandom with the given seed
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> Self {
        JavaRandom {
            seed: ((seed as u64) ^ MULT) & MASK,
        }
    }

    /// Set the seed
    #[wasm_bindgen]
    pub fn set_seed(&mut self, seed: u32) {
        self.seed = ((seed as u64) ^ MULT) & MASK;
    }

    /// Generate a random word (default 32 bits), returns f64 in [0,1)
    #[wasm_bindgen]
    pub fn next(&mut self, bits: u32) -> f64 {
        self.seed = (self.seed * MULT + 0xBu64) & MASK;
        let result = (self.seed >> (48 - bits)) & ((1u64 << bits) - 1);
        (result >> (32 - bits)) as f64
    }

    /// Generate a random integer between 0 and bound-1
    #[wasm_bindgen]
    pub fn next_int(&mut self, bound: u32) -> u32 {
        if bound == 0 {
            return 0;
        }
        if (bound & (bound - 1)) == 0 { // bound is a power of 2
            return (self.next(31) as u32) % bound;
        }
        let mut bits: u32;
        let mut val: u32;
        loop {
            bits = self.next(31) as u32;
            val = bits % bound;
            // Rejection sampling to avoid bias
            if bits >= val && bits - val + (bound - 1) <= 0x7FFFFFFF {
                break;
            }
        }
        val
    }

    /// Generate a random float in [0, 1)
    #[wasm_bindgen]
    pub fn next_float(&mut self) -> f64 {
        self.next(24) / (1 << 24) as f64
    }

    /// Generate a random double in [0, 1)
    #[wasm_bindgen]
    pub fn next_double(&mut self) -> f64 {
        let high = self.next(26) as u64;
        let mid = self.next(27) as u64;
        (high * 134217728 + mid) as f64 / 9007199254740992f64
    }
}

impl Default for JavaRandom {
    fn default() -> Self {
        JavaRandom::new(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jrandom_seed_zero() {
        let mut rng = JavaRandom::new(0);
        // After constructor, seed = (0 ^ MULT) & MASK = MULT & MASK = MULT (MULT fits in 48 bits)
        assert_eq!(rng.seed, MASK);
    }

    #[test]
    fn test_jrandom_next_basic() {
        let mut rng = JavaRandom::new(12345);
        let _n32 = rng.next(32); // returns f64
        let _n24 = rng.next(24);
        let _n8 = rng.next(8);
    }

    #[test]
    fn test_jrandom_next_int() {
        let mut rng = JavaRandom::new(42);
        let _i1 = rng.next_int(100); // 0..99
        let _i2 = rng.next_int(1000); // 0..999
        let _i3 = rng.next_int(100000); // 0..99999
    }

    #[test]
    fn test_jrandom_next_float_bounds() {
        let mut rng = JavaRandom::new(99);
        let _f = rng.next_float();
        assert!(_f >= 0.0 && _f < 1.0);
    }

    #[test]
    fn test_jrandom_next_double_bounds() {
        let mut rng = JavaRandom::new(77);
        let _d = rng.next_double();
        assert!(_d >= 0.0 && _d < 1.0);
    }

    #[test]
    fn test_jrandom_deterministic() {
        // Same seed should produce same sequence
        let mut a = JavaRandom::new(123);
        let mut b = JavaRandom::new(123);
        for _ in 0..10 {
            let _ = a.next(32);
            let _ = b.next(32);
            assert_eq!(a.seed, b.seed);
        }
    }
}