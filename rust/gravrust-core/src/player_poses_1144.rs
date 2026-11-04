// Port of `client/js/game/player-poses-1.14.4.js`
//!
//! Dimensions are vanilla floats (0.6 / 1.8), exposed as width/height rather
//! than a JS array so the boundary stays scalar.

use wasm_bindgen::prelude::*;

const POSES_1144: &[(&str, f64, f64)] = &[
    ("standing", 0.6, 1.8),
    ("sleeping", 0.2, 0.2),
    ("fall_flying", 0.6, 0.6),
    ("swimming", 0.6, 0.6),
    ("spin_attack", 0.6, 0.6),
    ("sneaking", 0.6, 1.5),
    ("dying", 0.2, 0.2),
];

fn lookup(table: &[(&str, f64, f64)], pose: &str) -> Option<(f64, f64)> {
    table
        .iter()
        .find(|(name, _, _)| *name == pose)
        .map(|(_, width, height)| (*width, *height))
}

#[wasm_bindgen]
pub fn player_pose_width_1144(pose: &str) -> f64 {
    lookup(POSES_1144, pose).map(|(w, _)| w).unwrap_or(0.0)
}

#[wasm_bindgen]
pub fn player_pose_height_1144(pose: &str) -> f64 {
    lookup(POSES_1144, pose).map(|(_, h)| h).unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tables_match_the_native_values() {
        assert_eq!(lookup(POSES_1144, "standing"), Some((0.6, 1.8)));
        assert_eq!(lookup(POSES_1144, "sneaking"), Some((0.6, 1.5)));
        assert_eq!(lookup(POSES_1144, "sleeping"), Some((0.2, 0.2)));
        assert_eq!(lookup(POSES_1144, "fall_flying"), Some((0.6, 0.6)));
        assert_eq!(lookup(POSES_1144, "swimming"), Some((0.6, 0.6)));
        assert_eq!(lookup(POSES_1144, "spin_attack"), Some((0.6, 0.6)));
        assert_eq!(lookup(POSES_1144, "dying"), Some((0.2, 0.2)));
    }

    #[test]
    fn unknown_poses_are_zero() {
        assert_eq!(player_pose_width_1144("unknown"), 0.0);
        assert_eq!(player_pose_height_1144("unknown"), 0.0);
    }
}