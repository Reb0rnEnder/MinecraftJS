//! Port of `client/js/world/biomes.js` and the pinned water-color table in
//! `client/js/world/water-biomes.js`.
//!
//! Biome records and colormap pixels are supplied as plain values/bytes; the
//! client's JSON registry stays in JavaScript until the asset loader moves.

use wasm_bindgen::prelude::*;

const WATER_BIOMES: [u32; 168] = [
    4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 6388580, 4159204, 4159204, 4159204, 3750089, 3750089,
    4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204,
    4159204, 4159204, 4020182, 4159204, 4159204, 4159204, 4020182, 4020182, 4159204, 4159204, 4159204, 4159204,
    4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4445678, 4566514, 4020182, 4445678,
    4566514, 4020182, 3750089, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 4159204, 0, 4159204, 4159204, 4159204,
    4159204, 4159204, 6388580, 0, 0, 0, 0, 0, 4159204, 0, 0, 0,
    0, 0, 0, 0, 0, 4159204, 0, 4159204, 0, 0, 0, 4159204,
    4159204, 4159204, 4020182, 0, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204, 4159204,
];

fn is_swamp(name: &str) -> bool {
    name == "swamp" || name == "swamp_hills"
}

fn is_roofed(name: &str) -> bool {
    name == "dark_forest" || name == "dark_forest_hills"
}

fn is_mesa(name: &str) -> bool {
    name.contains("badlands")
}

fn temp_at(temperature: f64, y: i32) -> f64 {
    let mut temp = temperature;
    if y > 64 {
        temp -= (y - 64) as f64 * 0.05 / 30.0;
    }
    temp
}

fn sample_color(map: &[u8], temperature: f64, rainfall: f64) -> u32 {
    if map.len() < 256 * 256 * 4 {
        return 0x7fb238;
    }
    let temperature = temperature.clamp(0.0, 1.0);
    let rainfall = rainfall.clamp(0.0, 1.0) * temperature;
    let i = ((1.0 - temperature) * 255.0) as usize;
    let j = ((1.0 - rainfall) * 255.0) as usize;
    let k = ((j << 8) | i) * 4;
    ((map[k] as u32) << 16) | ((map[k + 1] as u32) << 8) | map[k + 2] as u32
}

#[wasm_bindgen]
pub fn grass_color(
    name: &str,
    temperature: f64,
    rainfall: f64,
    y: i32,
    map: &[u8],
) -> u32 {
    if is_swamp(name) {
        return 0x6a7039;
    }
    if is_mesa(name) {
        return 0x90814d;
    }
    let color = sample_color(map, temp_at(temperature, y), rainfall);
    if is_roofed(name) {
        ((color & 0xfefefe) + 0x28340a) >> 1
    } else {
        color
    }
}

#[wasm_bindgen]
pub fn foliage_color(
    name: &str,
    temperature: f64,
    rainfall: f64,
    y: i32,
    map: &[u8],
) -> u32 {
    if is_swamp(name) {
        return 0x6a7039;
    }
    if is_mesa(name) {
        return 0x9e814d;
    }
    sample_color(map, temp_at(temperature, y), rainfall)
}

/// `override_color` is `None` when the biome record has no `waterColor`.
#[wasm_bindgen]
pub fn water_color(id: u32, name: &str, override_color: Option<u32>) -> u32 {
    if let Some(value) = WATER_BIOMES.get(id as usize) {
        if *value != 0 {
            return *value;
        }
    }
    if let Some(color) = override_color {
        return color;
    }
    if is_swamp(name) {
        0x617b64
    } else {
        0x3f76e4
    }
}

#[wasm_bindgen]
pub fn biome_rain_type(
    precipitation: &str,
    temperature: f64,
    rainfall: f64,
    y: i32,
) -> String {
    if precipitation == "none" || rainfall == 0.0 {
        return "none".to_string();
    }
    if temp_at(temperature, y) < 0.15 {
        "snow".to_string()
    } else {
        "rain".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gradient_map() -> Vec<u8> {
        let mut map = vec![0u8; 256 * 256 * 4];
        for i in 0..map.len() / 4 {
            map[i * 4] = (i & 255) as u8;
            map[i * 4 + 1] = (i >> 3) as u8;
            map[i * 4 + 2] = (i >> 7) as u8;
            map[i * 4 + 3] = 255;
        }
        map
    }

    #[test]
    fn special_biomes_use_fixed_colors() {
        let map = gradient_map();
        assert_eq!(grass_color("swamp", 0.8, 0.4, 64, &map), 0x6a7039);
        assert_eq!(grass_color("badlands", 2.0, 0.0, 64, &map), 0x90814d);
        assert_eq!(foliage_color("badlands", 2.0, 0.0, 64, &map), 0x9e814d);
    }

    #[test]
    fn grass_and_foliage_sample_the_colormap() {
        let map = gradient_map();
        assert_eq!(grass_color("plains", 0.8, 0.4, 64, &map), sample_color(&map, 0.8, 0.4));
        assert_eq!(foliage_color("plains", 0.8, 0.4, 64, &map), sample_color(&map, 0.8, 0.4));
        assert_ne!(grass_color("plains", 0.8, 0.4, 94, &map), grass_color("plains", 0.8, 0.4, 64, &map));
    }

    #[test]
    fn water_table_and_fallbacks_match() {
        assert_eq!(water_color(6, "plains", None), 6388580);
        assert_eq!(water_color(999, "plains", None), 0x3f76e4);
        assert_eq!(water_color(999, "swamp", None), 0x617b64);
        assert_eq!(water_color(999, "plains", Some(0x123456)), 0x123456);
    }

    #[test]
    fn rain_type_uses_temperature_and_precipitation() {
        assert_eq!(biome_rain_type("none", 0.8, 0.4, 64), "none");
        assert_eq!(biome_rain_type("rain", 0.1, 0.4, 64), "snow");
        assert_eq!(biome_rain_type("rain", 0.8, 0.4, 64), "rain");
    }
}
