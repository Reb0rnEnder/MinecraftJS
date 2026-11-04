//! Port of the player pose dimension tables:
//! `client/js/game/player-poses-1.14.4.js` and
//! `client/js/game/player-poses-1.15.2.js`.
//!
//! Dimensions are vanilla floats (0.6F / 1.8F), exposed as width/height rather
//! than a JS array so the boundary stays scalar.

use wasm_bindgen::prelude::*;

const POSES_114: &[(&str, f64, f64)] = &[
    ("standing", 0.6, 1.8),
    ("sleeping", 0.2, 0.2),
    ("fall_flying", 0.6, 0.6),
    ("swimming", 0.6, 0.6),
    ("spin_attack", 0.6, 0.6),
    ("sneaking", 0.6, 1.5),
    ("dying", 0.2, 0.2),
];

const POSES_115: &[(&str, f64, f64)] = &[
    ("standing", 0.6, 1.8),
    ("sleeping", 0.2, 0.2),
    ("fall_flying", 0.6, 0.6),
    ("swimming", 0.6, 0.6),
    ("spin_attack", 0.6, 0.6),
    ("crouching", 0.6, 1.5),
    ("dying", 0.2, 0.2),
];

fn lookup(table: &[(&str, f64, f64)], pose: &str) -> Option<(f64, f64)> {
    table
        .iter()
        .find(|(name, _, _)| *name == pose)
        .map(|(_, width, height)| (*width, *height))
}

#[wasm_bindgen]
pub fn player_pose_width_114(pose: &str) -> f64 {
    lookup(POSES_114, pose).map(|(w, _)| w).unwrap_or(0.0)
}

#[wasm_bindgen]
pub fn player_pose_height_114(pose: &str) -> f64 {
    lookup(POSES_114, pose).map(|(_, h)| h).unwrap_or(0.0)
}

/// 1.15.2 maps the legacy `sneaking` input to the `crouching` pose.
#[wasm_bindgen]
pub fn player_pose_width_115(pose: &str) -> f64 {
    lookup(POSES_115, if pose == "sneaking" { "crouching" } else { pose })
        .map(|(w, _)| w)
        .unwrap_or(0.0)
}

#[wasm_bindgen]
pub fn player_pose_height_115(pose: &str) -> f64 {
    lookup(POSES_115, if pose == "sneaking" { "crouching" } else { pose })
        .map(|(_, h)| h)
        .unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tables_match_the_native_values() {
        assert_eq!(lookup(POSES_114, "standing"), Some((0.6, 1.8)));
        assert_eq!(lookup(POSES_114, "sneaking"), Some((0.6, 1.5)));
        assert_eq!(lookup(POSES_114, "sleeping"), Some((0.2, 0.2)));
        assert_eq!(lookup(POSES_115, "crouching"), Some((0.6, 1.5)));
        assert_eq!(lookup(POSES_115, "fall_flying"), Some((0.6, 0.6)));
    }

    #[test]
    fn unknown_poses_are_zero() {
        assert_eq!(player_pose_width_114("unknown"), 0.0);
        assert_eq!(player_pose_height_115("unknown"), 0.0);
        assert_eq!(player_pose_height_115("sneaking"), 1.5);
    }
}
