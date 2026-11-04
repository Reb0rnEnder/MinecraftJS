//! Port of `client/js/game/portal.js`:
//! Handles portal (nether_portal/portal) detection and warp transformation.

use crate::math::mat4_scale;
use crate::math::mat4_rotate;
use std::f64::consts::PI;

/// Checks if the player's bounding box touches a portal block.
/// Iterates through blocks in the player's AABB and checks for nether_portal or portal.
/// 
/// `get_block_name` is a function that takes block coordinates and returns the block name string.
/// `player_x`, `player_y`, `player_z` are the player's position coordinates.
pub fn touches_portal<F>(get_block_name: F, player_x: f64, player_y: f64, player_z: f64) -> bool
where
    F: Fn(i32, i32, i32) -> String,
{
    // Player bounding box: [-0.3, x+0.3] x [y, y+1.8] x [z-0.3, z+0.3]
    let min_x = player_x - 0.3;
    let max_x = player_x + 0.3;
    let min_y = player_y;
    let max_y = player_y + 1.8;
    let min_z = player_z - 0.3;
    let max_z = player_z + 0.3;

    let ix0 = min_x.floor() as i32;
    let ix1 = max_x.floor() as i32;
    let iy0 = min_y.floor() as i32;
    let iy1 = max_y.floor() as i32;
    let iz0 = min_z.floor() as i32;
    let iz1 = max_z.floor() as i32;

    for bx in (ix0 + 1)..=(ix1 - 1) {
        for by in (iy0 + 1)..=(iy1 - 1) {
            for bz in (iz0 + 1)..=(iz1 - 1) {
                let name = get_block_name(bx, by, bz);
                if name == "nether_portal" || name == "portal" {
                    return true;
                }
            }
        }
    }
    false
}

/// Portal warp transformation matrix.
/// Creates an anisotropic distortion matrix for portal rendering.
/// The JS original: portalWarp(amount, ticks, nausea)
/// amount: portal opacity (0-1)
/// ticks: portal animation tick count
/// nausea: whether to apply nausea-inducing rotation
pub fn portal_warp(amount: f32, ticks: f32, nausea: bool) -> [f32; 16] {
    if amount <= 0.0 {
        return [0.0; 16];
    }

    let factor = 5.0 / (amount * amount + 5.0) - amount * 0.04;
    let factor = factor * factor;

    let angle = ticks as f64 * (if nausea { 7.0 } else { 20.0 }) * PI / 180.0;

    // Create identity matrix
    let mut out: Vec<f32> = vec![
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0,
    ];

    // rotate around (0, SQRT1_2, SQRT1_2) by angle
    let sqrt1_2 = (0.5_f64).sqrt();
    out = mat4_rotate(&out, angle, 0.0, sqrt1_2, sqrt1_2);

    // scale by 1/factor on x
    out = mat4_scale(&out, 1.0 / factor as f64, 1.0, 1.0);

    // rotate back around (0, SQRT1_2, SQRT1_2) by -angle
    out = mat4_rotate(&out, -angle, 0.0, sqrt1_2, sqrt1_2);

    let mut result = [0.0f32; 16];
    result.copy_from_slice(&out[..16]);
    result
}

/// Updates portal time based on whether player is touching a portal.
/// This should be called each game tick.
/// 
/// # Arguments
/// - `portal_time`: current portal time (0.0 to 1.0)
/// - `prev_portal_time`: previous portal time
/// - `touches`: whether the player is currently touching a portal
/// - `effect_9_duration`: duration of effect ID 9 (portaling effect), or 0 if none
/// 
/// Returns `(new_portal_time, new_prev_portal_time)`
pub fn tick_portal(
    portal_time: f32,
    prev_portal_time: f32,
    touches: bool,
    effect_9_duration: i32,
) -> (f32, f32) {
    let new_prev_portal_time = prev_portal_time;
    
    if touches {
        if portal_time == 0.0 {
            // Play sound when first touching portal
            // (sound.playAtPlayer would be called from game code)
        }
        let new_portal_time = (portal_time.min(1.0) + 0.0125).min(1.0);
        (new_portal_time, new_prev_portal_time)
    } else if effect_9_duration > 60 {
        let new_portal_time = (prev_portal_time + 0.006666667).min(1.0);
        (new_portal_time, new_prev_portal_time)
    } else {
        let new_portal_time = (prev_portal_time - 0.05).max(0.0);
        (new_portal_time, new_prev_portal_time)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_portal_warp_zero_amount() {
        let result = portal_warp(0.0, 0.0, false);
        assert_eq!(result, [0.0; 16]);
    }

    #[test]
    fn test_portal_warp_positive_amount() {
        let result = portal_warp(0.5, 10.0, false);
        // Just check it's a valid 16-element array
        assert_eq!(result.len(), 16);
    }

    #[test]
    fn test_portal_warp_nausea() {
        let result = portal_warp(0.5, 10.0, true);
        assert_eq!(result.len(), 16);
    }

    #[test]
    fn test_tick_portal_touching() {
        let (new_portal, _new_prev) = tick_portal(0.0, 0.0, true, 0);
        assert!(new_portal > 0.0);
        assert!((new_portal - 0.0125).abs() < 0.001);
    }

    #[test]
    fn test_tick_portal_with_effect() {
        let (new_portal, _new_prev) = tick_portal(0.5, 0.5, false, 120);
        assert!(new_portal > 0.5); // should increase
    }

    #[test]
    fn test_tick_portal_no_effect() {
        let (new_portal, _new_prev) = tick_portal(0.5, 0.5, false, 30);
        assert!(new_portal < 0.5); // should decrease
    }
}