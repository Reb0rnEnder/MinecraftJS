//! Port of `client/js/render/sky.js`: celestial angle, sun/star brightness, sky,
//! fog and cloud colours, the lightmap table and the 10842-seeded star field.
//!
//! Everything here is arithmetic; the renderer still owns the buffers and the
//! draw calls.

use wasm_bindgen::prelude::*;

const TAU: f64 = std::f64::consts::PI * 2.0;

fn clamp01(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

/// Vanilla `World.getCelestialAngle`.
pub fn celestial_angle(world_time: f64, partial: f64) -> f64 {
    let i = ((world_time.floor() as i64 % 24000) + 24000) % 24000;
    let mut f = (i as f64 + partial) / 24000.0 - 0.25;
    if f < 0.0 {
        f += 1.0;
    }
    if f > 1.0 {
        f -= 1.0;
    }
    let first = f;
    f = 1.0 - ((f * std::f64::consts::PI).cos() + 1.0) / 2.0;
    first + (f - first) / 3.0
}

pub fn sun_brightness(angle: f64, rain: f64, thunder: f64) -> f64 {
    let mut value = 1.0 - ((angle * TAU).cos() * 2.0 + 0.2);
    value = clamp01(value);
    value = 1.0 - value;
    value *= 1.0 - rain * 5.0 / 16.0;
    value *= 1.0 - thunder * 5.0 / 16.0;
    value * 0.8 + 0.2
}

pub fn star_brightness(angle: f64) -> f64 {
    let mut value = 1.0 - ((angle * TAU).cos() * 2.0 + 0.25);
    value = clamp01(value);
    value * value * 0.5
}

fn hsb_to_rgb(h: f64, s: f64, v: f64) -> [f64; 3] {
    let h = (h - h.floor()) * 6.0;
    let i = h.floor() as i64;
    let f = h - i as f64;
    let p = v * (1.0 - s);
    let q = v * (1.0 - s * f);
    let t = v * (1.0 - s * (1.0 - f));
    let table = [
        [v, t, p],
        [q, v, p],
        [p, v, t],
        [p, q, v],
        [t, p, v],
        [v, p, q],
    ];
    table[i.rem_euclid(6) as usize]
}

pub fn sky_color(angle: f64, temperature: f64, rain: f64, thunder: f64) -> [f64; 3] {
    let mut f1 = (angle * TAU).cos() * 2.0 + 0.5;
    f1 = clamp01(f1);
    let t = (temperature / 3.0).clamp(-1.0, 1.0);
    let [mut r, mut g, mut b] = hsb_to_rgb(0.62222224 - t * 0.05, 0.5 + t * 0.1, 1.0);
    r *= f1;
    g *= f1;
    b *= f1;
    if rain > 0.0 {
        let gray = (r * 0.3 + g * 0.59 + b * 0.11) * 0.6;
        let keep = 1.0 - rain * 0.75;
        r = r * keep + gray * (1.0 - keep);
        g = g * keep + gray * (1.0 - keep);
        b = b * keep + gray * (1.0 - keep);
    }
    if thunder > 0.0 {
        let gray = (r * 0.3 + g * 0.59 + b * 0.11) * 0.2;
        let keep = 1.0 - thunder * 0.75;
        r = r * keep + gray * (1.0 - keep);
        g = g * keep + gray * (1.0 - keep);
        b = b * keep + gray * (1.0 - keep);
    }
    [r, g, b]
}

pub fn base_fog_color(angle: f64) -> [f64; 3] {
    let mut f = (angle * TAU).cos() * 2.0 + 0.5;
    f = clamp01(f);
    [
        0.7529412 * (f * 0.94 + 0.06),
        0.84705883 * (f * 0.94 + 0.06),
        1.0 * (f * 0.91 + 0.09),
    ]
}

/// `null` when the sun is not near the horizon.
pub fn sunrise_colors(angle: f64) -> Option<[f64; 4]> {
    let f = 0.4;
    let f1 = (angle * TAU).cos();
    if !(-f..=f).contains(&f1) {
        return None;
    }
    let f3 = f1 / f * 0.5 + 0.5;
    let mut f4 = 1.0 - (1.0 - (f3 * std::f64::consts::PI).sin()) * 0.99;
    f4 *= f4;
    Some([f3 * 0.3 + 0.7, f3 * f3 * 0.7 + 0.2, 0.2, f4])
}

pub fn cloud_color(angle: f64, rain: f64, thunder: f64) -> [f64; 3] {
    let mut f1 = (angle * TAU).cos() * 2.0 + 0.5;
    f1 = clamp01(f1);
    let mut r = f1 * 0.9 + 0.1;
    let mut g = f1 * 0.9 + 0.1;
    let mut b = f1 * 0.85 + 0.15;
    if rain > 0.0 {
        let gray = (r * 0.3 + g * 0.59 + b * 0.11) * 0.6;
        let keep = 1.0 - rain * 0.95;
        r = r * keep + gray * (1.0 - keep);
        g = g * keep + gray * (1.0 - keep);
        b = b * keep + gray * (1.0 - keep);
    }
    let bright = 1.0 - thunder * 0.5;
    [r * bright, g * bright, b * bright]
}

pub fn brightness_table(dimension: i32) -> Vec<f64> {
    let f = if dimension == -1 { 0.1 } else { 0.0 };
    (0..=15)
        .map(|i| {
            let f1 = 1.0 - i as f64 / 15.0;
            (1.0 - f1) / (f1 * 3.0 + 1.0) * (1.0 - f) + f
        })
        .collect()
}

/// `EntityRenderer.updateLightmap`: writes `16 * 16 * 4` bytes, index
/// `(sky * 16 + block) * 4`.
#[allow(clippy::too_many_arguments)]
pub fn update_lightmap(
    data: &mut [u8],
    sun: f64,
    dimension: i32,
    torch_flicker: f64,
    gamma: f64,
    night_vision: f64,
    lightning: f64,
) {
    let table = brightness_table(dimension);
    let f1 = sun * 0.95 + 0.05;
    for i in 0..256usize {
        let sky_index = i >> 4;
        let block_index = i & 15;
        let mut f2 = table[sky_index] * f1;
        let f3 = table[block_index] * (torch_flicker * 0.1 + 1.5);
        if lightning > 0.0 {
            f2 = table[sky_index];
        }
        let f4 = f2 * (sun * 0.65 + 0.35);
        let f5 = f2 * (sun * 0.65 + 0.35);
        let f6 = f3 * ((f3 * 0.6 + 0.4) * 0.6 + 0.4);
        let f7 = f3 * (f3 * f3 * 0.6 + 0.4);
        let mut r = f4 + f3;
        let mut g = f5 + f6;
        let mut b = f2 + f7;
        r = r * 0.96 + 0.03;
        g = g * 0.96 + 0.03;
        b = b * 0.96 + 0.03;
        if dimension == 1 {
            r = 0.22 + f3 * 0.75;
            g = 0.28 + f6 * 0.75;
            b = 0.25 + f7 * 0.75;
        }
        if night_vision > 0.0 {
            let mut f15 = 1.0 / r.max(g).max(b);
            if !f15.is_finite() {
                f15 = 1.0;
            }
            r = r * (1.0 - night_vision) + r * f15 * night_vision;
            g = g * (1.0 - night_vision) + g * f15 * night_vision;
            b = b * (1.0 - night_vision) + b * f15 * night_vision;
        }
        r = clamp01(r);
        g = clamp01(g);
        b = clamp01(b);
        let rr = 1.0 - (1.0 - r).powi(4);
        let gg = 1.0 - (1.0 - g).powi(4);
        let bb = 1.0 - (1.0 - b).powi(4);
        r = r * (1.0 - gamma) + rr * gamma;
        g = g * (1.0 - gamma) + gg * gamma;
        b = b * (1.0 - gamma) + bb * gamma;
        r = clamp01(r * 0.96 + 0.03);
        g = clamp01(g * 0.96 + 0.03);
        b = clamp01(b * 0.96 + 0.03);
        let index = (sky_index * 16 + block_index) * 4;
        if index + 3 < data.len() {
            data[index] = (r * 255.0) as u8;
            data[index + 1] = (g * 255.0) as u8;
            data[index + 2] = (b * 255.0) as u8;
            data[index + 3] = 255;
        }
    }
}

/// Java `Random(10842L)` sequence used by `RenderGlobal.renderStars`.
struct JavaRandom {
    seed: u64,
}

const MULTIPLIER: u64 = 0x5DEECE66D;
const ADDEND: u64 = 0xB;
const MASK: u64 = (1u64 << 48) - 1;

impl JavaRandom {
    fn new(seed: i64) -> JavaRandom {
        JavaRandom { seed: ((seed as u64) ^ MULTIPLIER) & MASK }
    }

    fn next(&mut self, bits: u32) -> i32 {
        self.seed = self.seed.wrapping_mul(MULTIPLIER).wrapping_add(ADDEND) & MASK;
        (self.seed >> (48 - bits)) as u32 as i32
    }

    fn next_float(&mut self) -> f64 {
        (self.next(24) as u32) as f64 / (1 << 24) as f64
    }

    fn next_double(&mut self) -> f64 {
        let hi = (self.next(26) as u32) as f64;
        let lo = (self.next(27) as u32) as f64;
        (hi * 134217728.0 + lo) / 9007199254740992.0
    }
}

/// Triangle positions (x, y, z per vertex) for the vanilla star field.
pub fn build_star_positions() -> Vec<f64> {
    let mut rng = JavaRandom::new(10842);
    let mut positions = Vec::new();
    for _ in 0..1500 {
        let mut d0 = rng.next_float() * 2.0 - 1.0;
        let mut d1 = rng.next_float() * 2.0 - 1.0;
        let mut d2 = rng.next_float() * 2.0 - 1.0;
        let d3 = 0.15 + rng.next_float() * 0.1;
        let mut d4 = d0 * d0 + d1 * d1 + d2 * d2;
        if d4 < 1.0 && d4 > 0.01 {
            d4 = 1.0 / d4.sqrt();
            d0 *= d4;
            d1 *= d4;
            d2 *= d4;
            let d5 = d0 * 100.0;
            let d6 = d1 * 100.0;
            let d7 = d2 * 100.0;
            let d8 = d0.atan2(d2);
            let d9 = d8.sin();
            let d10 = d8.cos();
            let d11 = (d0 * d0 + d2 * d2).sqrt().atan2(d1);
            let d12 = d11.sin();
            let d13 = d11.cos();
            let d14 = rng.next_double() * std::f64::consts::PI * 2.0;
            let d15 = d14.sin();
            let d16 = d14.cos();
            let mut quad = [[0.0f64; 3]; 4];
            for (j, corner) in quad.iter_mut().enumerate() {
                let j = j as i32;
                let d18 = ((j & 2) - 1) as f64 * d3;
                let d19 = (((j + 1) & 2) - 1) as f64 * d3;
                let d21 = d18 * d16 - d19 * d15;
                let d22 = d19 * d16 + d18 * d15;
                let d23 = d21 * d12 + 0.0 * d13;
                let d24 = 0.0 * d12 - d21 * d13;
                let d25 = d24 * d9 - d22 * d10;
                let d26 = d22 * d9 + d24 * d10;
                *corner = [d5 + d25, d6 + d23, d7 + d26];
            }
            for vertex in [quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]] {
                positions.extend_from_slice(&vertex);
            }
        }
    }
    positions
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub fn celestial_angle_wasm(world_time: f64, partial: f64) -> f64 {
    celestial_angle(world_time, partial)
}

#[wasm_bindgen]
pub fn sun_brightness_wasm(angle: f64, rain: f64, thunder: f64) -> f64 {
    sun_brightness(angle, rain, thunder)
}

#[wasm_bindgen]
pub fn star_brightness_wasm(angle: f64) -> f64 {
    star_brightness(angle)
}

#[wasm_bindgen]
pub fn sky_color_wasm(angle: f64, temperature: f64, rain: f64, thunder: f64) -> Vec<f64> {
    sky_color(angle, temperature, rain, thunder).to_vec()
}

#[wasm_bindgen]
pub fn base_fog_color_wasm(angle: f64) -> Vec<f64> {
    base_fog_color(angle).to_vec()
}

#[wasm_bindgen]
pub fn sunrise_colors_wasm(angle: f64) -> Vec<f64> {
    sunrise_colors(angle).map(|c| c.to_vec()).unwrap_or_default()
}

#[wasm_bindgen]
pub fn cloud_color_wasm(angle: f64, rain: f64, thunder: f64) -> Vec<f64> {
    cloud_color(angle, rain, thunder).to_vec()
}

#[wasm_bindgen]
pub fn brightness_table_wasm(dimension: i32) -> Vec<f64> {
    brightness_table(dimension)
}

#[wasm_bindgen]
pub fn update_lightmap_wasm(
    data: &mut [u8],
    sun: f64,
    dimension: i32,
    torch_flicker: f64,
    gamma: f64,
    night_vision: f64,
    lightning: f64,
) {
    update_lightmap(data, sun, dimension, torch_flicker, gamma, night_vision, lightning);
}

#[wasm_bindgen]
pub fn build_star_positions_wasm() -> Vec<f64> {
    build_star_positions()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn celestial_angle_stays_in_range() {
        for time in [0.0, 6000.0, 12000.0, 18000.0, 24000.0, -6000.0] {
            let angle = celestial_angle(time, 0.5);
            assert!((0.0..=1.0).contains(&angle), "{time} -> {angle}");
        }
        // Noon is the darkest point of the cosine, midnight the brightest.
        assert!(celestial_angle(18000.0, 0.0) < celestial_angle(0.0, 0.0));
    }

    #[test]
    fn brightness_tables_have_sixteen_entries() {
        let overworld = brightness_table(0);
        assert_eq!(overworld.len(), 16);
        // Index 0 is unlit, index 15 is fully lit.
        assert!(overworld[0] < 0.05);
        assert!((overworld[15] - 1.0).abs() < 1e-12);
        // The nether floor raises the unlit end to 0.1 and keeps the lit end at 1.
        let nether = brightness_table(-1);
        assert!((nether[0] - 0.1).abs() < 1e-12);
        assert!((nether[15] - 1.0).abs() < 1e-12);
    }

    #[test]
    fn lightmap_writes_opaque_pixels() {
        let mut data = vec![0u8; 16 * 16 * 4];
        update_lightmap(&mut data, 1.0, 0, 0.0, 0.0, 0.0, 0.0);
        assert_eq!(data[3], 255);
        assert_eq!(data[data.len() - 1], 255);
        // Index 0 is (sky 0, block 0): dark. Index 255 is fully lit.
        assert!(data[0] < data[(15 * 16 + 15) * 4]);
    }

    #[test]
    fn star_field_is_deterministic_and_sized() {
        let first = build_star_positions();
        let second = build_star_positions();
        assert_eq!(first, second);
        assert!(!first.is_empty());
        assert_eq!(first.len() % 18, 0);
    }
}
