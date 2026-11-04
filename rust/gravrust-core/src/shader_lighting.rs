//! Port of `client/js/render/shader-lighting.js`: the BSL colour/lightmap
//! bridge. It uses the pack's authoring values and attenuation; it deliberately
//! does not emulate deferred lighting, shadow maps, PBR or exposure buffers.

use std::collections::HashMap;

use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

pub const REQUIRED_KEYS: [&str; 6] = [
    "BLOCKLIGHT_R",
    "BLOCKLIGHT_G",
    "BLOCKLIGHT_B",
    "BLOCKLIGHT_I",
    "LIGHT_DR",
    "AMBIENT_DR",
];

const PREFIXES: [&str; 12] = [
    "LIGHT_M",
    "LIGHT_D",
    "LIGHT_E",
    "LIGHT_N",
    "AMBIENT_M",
    "AMBIENT_D",
    "AMBIENT_E",
    "AMBIENT_N",
    "BLOCKLIGHT_",
    "MINLIGHT_",
    "END_",
    "NETHER_N",
];

pub fn is_lighting_option(name: &str) -> bool {
    let prefixes = ["LIGHT_", "AMBIENT_"];
    for prefix in prefixes {
        if let Some(rest) = name.strip_prefix(prefix) {
            let mut chars = rest.chars();
            let first = chars.next().unwrap_or(' ');
            let second = chars.next().unwrap_or(' ');
            if matches!(first, 'M' | 'D' | 'E' | 'N') && matches!(second, 'R' | 'G' | 'B' | 'I') {
                return true;
            }
        }
    }
    for prefix in ["BLOCKLIGHT_", "MINLIGHT_", "END_"] {
        if let Some(rest) = name.strip_prefix(prefix) {
            let mut chars = rest.chars();
            if matches!(chars.next(), Some('R' | 'G' | 'B' | 'I')) {
                return true;
            }
        }
    }
    if let Some(rest) = name.strip_prefix("NETHER_N") {
        let mut chars = rest.chars();
        return matches!(chars.next(), Some('R' | 'G' | 'B' | 'I'));
    }
    false
}

pub fn pack_lighting(
    options: &[(String, f64)],
    values: &HashMap<String, f64>,
) -> Option<HashMap<String, [f64; 3]>> {
    let defaults: HashMap<String, f64> = options.iter().cloned().collect();
    if !REQUIRED_KEYS.iter().all(|key| defaults.contains_key(*key)) {
        return None;
    }
    // A missing option is `Number(undefined)` in the JavaScript, i.e. NaN, so
    // the whole colour is dropped by the finiteness test below rather than
    // silently becoming black.
    let get = |key: &str| -> f64 {
        values
            .get(key)
            .copied()
            .or_else(|| defaults.get(key).copied())
            .unwrap_or(f64::NAN)
    };
    let color = |prefix: &str| -> [f64; 3] {
        let intensity = get(&format!("{}I", prefix));
        [
            get(&format!("{}R", prefix)) * intensity / 255.0,
            get(&format!("{}G", prefix)) * intensity / 255.0,
            get(&format!("{}B", prefix)) * intensity / 255.0,
        ]
    };
    let mut colors = HashMap::new();
    for prefix in PREFIXES {
        let value = color(prefix);
        if value.iter().all(|v| v.is_finite()) {
            colors.insert(prefix.to_string(), value);
        }
    }
    Some(colors)
}

pub struct LightingFrame {
    pub ambient: [f64; 3],
    pub direct: [f64; 3],
    pub block: [f64; 3],
    pub minimum: [f64; 3],
    pub dimension: i32,
}

fn mix(a: [f64; 3], b: [f64; 3], t: f64) -> [f64; 3] {
    [
        a[0] * (1.0 - t) + b[0] * t,
        a[1] * (1.0 - t) + b[1] * t,
        a[2] * (1.0 - t) + b[2] * t,
    ]
}

fn square(a: [f64; 3]) -> [f64; 3] {
    [a[0] * a[0], a[1] * a[1], a[2] * a[2]]
}

fn scale(a: [f64; 3], factor: f64) -> [f64; 3] {
    [a[0] * factor, a[1] * factor, a[2] * factor]
}

fn get(colors: &HashMap<String, [f64; 3]>, key: &str) -> [f64; 3] {
    colors.get(key).copied().unwrap_or([0.0, 0.0, 0.0])
}

pub fn lighting_frame(
    colors: &HashMap<String, [f64; 3]>,
    world_time: f64,
    dimension: i32,
    rain: f64,
) -> LightingFrame {
    let phase = (world_time % 24000.0 + 24000.0) % 24000.0 / 24000.0;
    let sun = (phase * std::f64::consts::PI * 2.0).sin().max(0.0);
    let evening = 1.0 - ((phase - 0.5).abs() * 8.0 - 1.5).clamp(0.0, 1.0);
    let day = 1.0 - (1.0 - sun).powf(1.5);
    let weather = |a: [f64; 3]| {
        let gray = a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114;
        mix(a, [gray, gray, gray], rain.clamp(0.0, 1.0))
    };
    let sample = |prefix: &str| -> [f64; 3] {
        let night = scale(get(colors, &format!("{}N", prefix)), 0.3);
        let morning = get(colors, &format!("{}M", prefix));
        let evening_color = get(colors, &format!("{}E", prefix));
        let day_color = get(colors, &format!("{}D", prefix));
        let lit = mix(mix(morning, evening_color, evening), day_color, day);
        square(weather(mix(night, lit, (sun * 4.0).min(1.0))))
    };
    let mut ambient = sample("AMBIENT_");
    let mut direct = sample("LIGHT_");
    if dimension == -1 {
        let nether = colors
            .get("NETHER_N")
            .copied()
            .unwrap_or([1.0, 0.4, 0.2]);
        ambient = scale(nether, 0.07);
        direct = [0.0, 0.0, 0.0];
    }
    if dimension == 1 {
        let end = colors.get("END_").copied().unwrap_or([0.5, 0.4, 0.8]);
        ambient = scale(square(end), 0.015);
        direct = scale(square(end), 0.04);
    }
    LightingFrame {
        ambient,
        direct,
        block: square(get(colors, "BLOCKLIGHT_")),
        minimum: scale(square(get(colors, "MINLIGHT_")), 0.04),
        dimension,
    }
}

// --------------------------------------------------------------------- wasm

fn parse_options(json_text: &str) -> Vec<(String, f64)> {
    let value: Value = serde_json::from_str(json_text).unwrap_or(Value::Null);
    value
        .as_array()
        .map(|list| {
            list.iter()
                .filter_map(|entry| {
                    Some((
                        entry["name"].as_str()?.to_string(),
                        entry["default"].as_f64().unwrap_or(0.0),
                    ))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn parse_colors(json_text: &str) -> HashMap<String, [f64; 3]> {
    let value: Value = serde_json::from_str(json_text).unwrap_or(Value::Null);
    let mut colors = HashMap::new();
    if let Some(map) = value.as_object() {
        for (key, entry) in map {
            if let Some(list) = entry.as_array() {
                if list.len() >= 3 {
                    colors.insert(
                        key.clone(),
                        [
                            list[0].as_f64().unwrap_or(0.0),
                            list[1].as_f64().unwrap_or(0.0),
                            list[2].as_f64().unwrap_or(0.0),
                        ],
                    );
                }
            }
        }
    }
    colors
}

#[wasm_bindgen]
pub fn pack_lighting_wasm(options_json: &str, values_json: &str) -> String {
    let options = parse_options(options_json);
    let values: HashMap<String, f64> = serde_json::from_str(values_json).unwrap_or_default();
    match pack_lighting(&options, &values) {
        None => "null".into(),
        Some(colors) => json!(colors).to_string(),
    }
}

#[wasm_bindgen]
pub fn lighting_frame_wasm(colors_json: &str, world_time: f64, dimension: i32, rain: f64) -> String {
    let colors = parse_colors(colors_json);
    let frame = lighting_frame(&colors, world_time, dimension, rain);
    json!({
        "ambient": frame.ambient,
        "direct": frame.direct,
        "block": frame.block,
        "minimum": frame.minimum,
        "dimension": frame.dimension,
    })
    .to_string()
}

#[wasm_bindgen]
pub fn is_lighting_option_wasm(name: &str) -> bool {
    is_lighting_option(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn colors() -> HashMap<String, [f64; 3]> {
        let mut map = HashMap::new();
        map.insert("BLOCKLIGHT_".into(), [1.0, 0.8, 0.6]);
        map.insert("AMBIENT_D".into(), [0.9, 0.9, 1.0]);
        map.insert("AMBIENT_N".into(), [0.1, 0.1, 0.2]);
        map.insert("LIGHT_D".into(), [1.0, 1.0, 1.0]);
        map.insert("LIGHT_N".into(), [0.2, 0.2, 0.3]);
        map
    }

    #[test]
    fn recognises_the_lighting_uniform_names() {
        assert!(is_lighting_option("LIGHT_DR"));
        assert!(is_lighting_option("AMBIENT_NI"));
        assert!(is_lighting_option("BLOCKLIGHT_R"));
        assert!(is_lighting_option("MINLIGHT_I"));
        assert!(is_lighting_option("NETHER_NG"));
        assert!(!is_lighting_option("LIGHT_XYZ"));
        assert!(!is_lighting_option("SHADOW_R"));
    }

    #[test]
    fn requires_the_blocklight_and_direct_light_uniforms() {
        let options = vec![
            ("BLOCKLIGHT_R".to_string(), 1.0),
            ("BLOCKLIGHT_G".to_string(), 1.0),
            ("BLOCKLIGHT_B".to_string(), 1.0),
            ("BLOCKLIGHT_I".to_string(), 1.0),
            ("LIGHT_DR".to_string(), 1.0),
            ("AMBIENT_DR".to_string(), 1.0),
            ("LIGHT_MR".to_string(), 0.5),
        ];
        let values = HashMap::new();
        let pack = pack_lighting(&options, &values).unwrap();
        // `LIGHT_MI` is absent, so every `LIGHT_M*` colour is NaN in the JS and
        // the key must not appear at all.
        assert_eq!(pack.get("LIGHT_M"), None);
        // Fully specified colours are kept.
        assert_eq!(pack.get("BLOCKLIGHT_"), Some(&[1.0 / 255.0; 3]));
        assert!(pack_lighting(&options[..5], &values).is_none());
    }

    #[test]
    fn frames_track_the_day_night_cycle() {
        let day = lighting_frame(&colors(), 6000.0, 0, 0.0);
        let night = lighting_frame(&colors(), 18000.0, 0, 0.0);
        assert!(day.ambient[0] > night.ambient[0]);
        assert!(day.direct[0] > night.direct[0]);
        for (index, expected) in [1.0, 0.64, 0.36].iter().enumerate() {
            assert!((day.block[index] - expected).abs() < 1e-12);
        }
        assert_eq!(day.dimension, 0);
        let nether = lighting_frame(&colors(), 6000.0, -1, 0.0);
        assert!((nether.ambient[0] - 0.07).abs() < 1e-12);
        assert_eq!(nether.direct, [0.0, 0.0, 0.0]);
    }
}
