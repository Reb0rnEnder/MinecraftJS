//! Port of `client/js/util/jrandom.js` (`java.util.Random`, 48-bit LCG).

use wasm_bindgen::prelude::*;

const MULTIPLIER: u64 = 0x0005_deece66d;
const ADDEND: u64 = 0x0b;
const MASK: u64 = (1u64 << 48) - 1;

#[wasm_bindgen]
pub struct JavaRandom {
    seed: u64,
}

impl JavaRandom {
    fn from_seed(seed: i64) -> JavaRandom {
        let mut random = JavaRandom { seed: 0 };
        random.set_seed(seed);
        random
    }
}

#[wasm_bindgen]
impl JavaRandom {
    /// `seed` is a Java long, so JavaScript passes a BigInt.
    #[wasm_bindgen(constructor)]
    pub fn new(seed: Option<i64>) -> JavaRandom {
        JavaRandom::from_seed(seed.unwrap_or(0))
    }

    pub fn set_seed(&mut self, seed: i64) {
        self.seed = ((seed as u64) ^ MULTIPLIER) & MASK;
    }

    pub fn next(&mut self, bits: u32) -> i32 {
        self.seed = self.seed.wrapping_mul(MULTIPLIER).wrapping_add(ADDEND) & MASK;
        (self.seed >> (48 - bits)) as u32 as i32
    }

    /// `bound = undefined` is represented by `None`.
    pub fn next_int(&mut self, bound: Option<i32>) -> i32 {
        let Some(bound) = bound else {
            return self.next(32);
        };
        let b = bound as i64;
        if (b & -b) == b {
            return ((b * self.next(31) as i64) >> 31) as i32;
        }
        loop {
            let bits = self.next(31);
            let value = bits % bound;
            if (bits as i64 - value as i64 + b - 1) <= 0x7fff_ffff {
                return value;
            }
        }
    }

    pub fn next_float(&mut self) -> f64 {
        self.next(24) as f64 / (1u32 << 24) as f64
    }

    pub fn next_double(&mut self) -> f64 {
        (self.next(26) as f64 * 134_217_728.0 + self.next(27) as f64) / 9_007_199_254_740_992.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_java_sequences() {
        let mut random = JavaRandom::from_seed(0);
        // java.util.Random(0).nextInt() sequence
        assert_eq!(random.next(32), -1155484576);
        assert_eq!(random.next(32), -723955400);
        let mut random = JavaRandom::from_seed(12345);
        assert_eq!(random.next_int(Some(100)), 51);
        assert_eq!(random.next_int(Some(100)), 80);
    }

    #[test]
    fn bounded_draws_stay_in_range() {
        let mut random = JavaRandom::from_seed(42);
        for bound in [1, 2, 3, 5, 16, 17, 1000] {
            for _ in 0..100 {
                let value = random.next_int(Some(bound));
                assert!((0..bound).contains(&value));
            }
        }
    }
}
