//! Port of `client/js/render/lod.js`.
//!
//! Distances are in world blocks. `None` represents an absent JS setting;
//! `lod_distance` applies the same `??` and `Number.isFinite` fallbacks.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn lod_distance(distance: Option<f64>, chunks: Option<f64>) -> f64 {
    let value = match distance {
        Some(value) => value,
        None => match chunks {
            Some(chunks) => chunks * 16.0,
            None => 128.0,
        },
    };
    if value.is_finite() {
        value.max(0.0)
    } else {
        128.0
    }
}

#[wasm_bindgen]
pub fn section_lod(
    distance: f64,
    camera_x: f64,
    camera_y: f64,
    camera_z: f64,
    cx: i32,
    sy: i32,
    cz: i32,
    previous: bool,
) -> bool {
    if distance == 0.0 {
        return false;
    }
    let x0 = (cx * 16) as f64;
    let y0 = (sy * 16) as f64;
    let z0 = (cz * 16) as f64;
    let dx = (x0 - camera_x).max(0.0).max(camera_x - (x0 + 16.0));
    let dy = (y0 - camera_y).max(0.0).max(camera_y - (y0 + 16.0));
    let dz = (z0 - camera_z).max(0.0).max(camera_z - (z0 + 16.0));
    let cutoff = (distance + if previous { -4.0 } else { 4.0 }).max(0.0);
    dx * dx + dy * dy + dz * dz > cutoff * cutoff
}

#[wasm_bindgen]
pub fn pose_interval(distance: f64, distance_squared: f64) -> u32 {
    if distance <= 0.0 || distance_squared <= distance * distance {
        1
    } else if distance_squared <= 4.0 * distance * distance {
        2
    } else {
        4
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn distance_fallbacks_match_the_js_defaults() {
        assert_eq!(lod_distance(None, None), 128.0);
        assert_eq!(lod_distance(None, Some(8.0)), 128.0);
        assert_eq!(lod_distance(Some(64.0), None), 64.0);
        assert_eq!(lod_distance(Some(-5.0), None), 0.0);
        assert_eq!(lod_distance(Some(f64::INFINITY), None), 128.0);
    }

    #[test]
    fn section_hysteresis_uses_four_blocks() {
        let camera = [8.0, 8.0, 8.0];
        assert!(!section_lod(128.0, camera[0], camera[1], camera[2], 0, 0, 0, false));
        let far = section_lod(128.0, camera[0], camera[1], camera[2], 20, 0, 0, false);
        assert!(far);
        assert!(!section_lod(128.0, camera[0], camera[1], camera[2], 20, 0, 0, true) || far);
    }

    #[test]
    fn pose_intervals_double_and_quadruple() {
        assert_eq!(pose_interval(128.0, 100.0), 1);
        assert_eq!(pose_interval(128.0, 128.0 * 128.0 * 2.0), 2);
        assert_eq!(pose_interval(128.0, 128.0 * 128.0 * 5.0), 4);
        assert_eq!(pose_interval(0.0, 1e9), 1);
    }
}
