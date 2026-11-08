//! Port of `client/js/util/native-angles.js`.
//!
//! Mth.atan2 approximation and float degree wrapping, used by Entity.lookAt.
//! Math::atan2 alone gives different native float rotations in Java Minecraft.

use std::sync::OnceLock;

static LOOKUP: OnceLock<(f64, [f64; 257], [f64; 257])> = OnceLock::new();

fn get_lookup() -> &'static (f64, [f64; 257], [f64; 257]) {
    LOOKUP.get_or_init(|| {
        let bias = f64::from_bits(4805340802404319232u64);
        let mut asin = [0.0; 257];
        let mut cos = [0.0; 257];
        for i in 0..257 {
            asin[i] = (i as f64 / 256.0).asin();
            cos[i] = asin[i].cos();
        }
        (bias, asin, cos)
    })
}

fn inv_sqrt(n: f64) -> f64 {
    let half = 0.5 * n;
    let bits = n.to_bits();
    let magic = 6910469410427058090u64.wrapping_sub(bits >> 1);
    let v = f64::from_bits(magic);
    v * (1.5 - half * v * v)
}

/// Java Mth.atan2 fast table approximation.
pub fn native_atan2(mut y: f64, mut x: f64) -> f64 {
    let length = x * x + y * y;
    if length.is_nan() {
        return f64::NAN;
    }
    let negative_y = y < 0.0;
    let negative_x = x < 0.0;
    if negative_y { y = -y; }
    if negative_x { x = -x; }
    let swapped = y > x;
    if swapped {
        std::mem::swap(&mut x, &mut y);
    }

    let inv = inv_sqrt(length);
    x *= inv;
    y *= inv;

    let (bias, asin, cos) = get_lookup();
    let biased = *bias + y;
    // In DataView(8).getUint32(4) on BigEndian, or in JS bit layout:
    let index = (biased.to_bits() & 0xFFFFFFFF) as usize;
    let idx = index.min(256);

    let sampled = biased - *bias;
    let error = y * cos[idx] - x * sampled;
    let mut angle = asin[idx] + (6.0 + error * error) * error * (1.0 / 6.0);
    if swapped {
        angle = std::f64::consts::FRAC_PI_2 - angle;
    }
    if negative_x {
        angle = std::f64::consts::PI - angle;
    }
    if negative_y {
        angle = -angle;
    }
    angle
}

/// Wraps native float degrees into `[-180.0, 180.0)`.
pub fn wrap_native_degrees(n: f32) -> f32 {
    let mut v = n % 360.0;
    if v >= 180.0 {
        v -= 360.0;
    }
    if v < -180.0 {
        v += 360.0;
    }
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wrap_native_degrees() {
        assert_eq!(wrap_native_degrees(0.0), 0.0);
        assert_eq!(wrap_native_degrees(180.0), -180.0);
        assert_eq!(wrap_native_degrees(360.0), 0.0);
        assert_eq!(wrap_native_degrees(450.0), 90.0);
        assert_eq!(wrap_native_degrees(-270.0), 90.0);
    }

    #[test]
    fn test_native_atan2_basic() {
        let a = native_atan2(0.0, 1.0);
        assert!((a - 0.0).abs() < 1e-4);
        let b = native_atan2(1.0, 0.0);
        assert!((b - std::f64::consts::FRAC_PI_2).abs() < 1e-4);
    }
}
