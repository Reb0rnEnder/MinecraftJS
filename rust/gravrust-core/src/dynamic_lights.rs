//! Port of `client/js/render/dynamic-lights.js`.
//!
//! Optional presentation effect; never changes server light or chunks.
//! Collects nearby moving light sources (torches, lanterns, lava buckets in hands).

use crate::dynamic_lighting::{dynamic_block_light, EMPTY_DYNAMIC_LIGHTS};

/// Helper to get held light level from item name and emitLight property.
pub fn held_light_level(item_name: Option<&str>, block_emit_light: Option<u8>) -> u8 {
    match item_name {
        Some("lava_bucket") => 15,
        Some(_) => block_emit_light.unwrap_or(0).min(15),
        None => 0,
    }
}

/// A collected dynamic light candidate.
#[derive(Debug, Clone, Copy)]
pub struct LightSourceCandidate {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub level: f32,
    pub distance_sq: f64,
}

/// Collects up to 6 nearest light sources into the 24-float array.
pub fn pack_dynamic_lights(mut sources: Vec<LightSourceCandidate>) -> [f32; 24] {
    sources.sort_by(|a, b| a.distance_sq.partial_cmp(&b.distance_sq).unwrap_or(std::cmp::Ordering::Equal));
    let mut data = EMPTY_DYNAMIC_LIGHTS;
    for (i, s) in sources.iter().take(6).enumerate() {
        data[i * 4] = s.x as f32;
        data[i * 4 + 1] = s.y as f32;
        data[i * 4 + 2] = s.z as f32;
        data[i * 4 + 3] = s.level;
    }
    data
}

/// Hands use camera-local matrices, so world-space light sources must be sampled
/// before that transform rather than passed to the hand shader as local positions.
pub fn first_person_block_light(
    dynamic_lights_enabled: bool,
    lights: &[f32],
    eye: [f64; 3],
    base_light: f64,
    held_level: u8,
    offhand_level: u8,
) -> f64 {
    if !dynamic_lights_enabled {
        return base_light;
    }
    let nearby = dynamic_block_light(lights, eye[0], eye[1], eye[2], base_light);
    nearby.max(held_level as f64).max(offhand_level as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_held_light_level() {
        assert_eq!(held_light_level(Some("lava_bucket"), None), 15);
        assert_eq!(held_light_level(Some("torch"), Some(14)), 14);
        assert_eq!(held_light_level(Some("dirt"), Some(0)), 0);
        assert_eq!(held_light_level(None, None), 0);
    }

    #[test]
    fn test_pack_dynamic_lights() {
        let sources = vec![
            LightSourceCandidate { x: 10.0, y: 0.0, z: 0.0, level: 10.0, distance_sq: 100.0 },
            LightSourceCandidate { x: 2.0, y: 0.0, z: 0.0, level: 15.0, distance_sq: 4.0 },
        ];
        let packed = pack_dynamic_lights(sources);
        // Nearest candidate (distance_sq: 4) should be first
        assert_eq!(packed[0], 2.0);
        assert_eq!(packed[3], 15.0);
        assert_eq!(packed[4], 10.0);
        assert_eq!(packed[7], 10.0);
    }
}
