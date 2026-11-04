//! Port of 'client/js/game/vehicle.js': vehicle physics for boats and horses.
//!
//! Pure algorithmic functions for vehicle physics calculations.

use crate::physics::{mc_sin, mc_cos};
use wasm_bindgen::prelude::*;

const DEG: f64 = 0.017453292;
const WRAP_DEG: f64 = 360.0;
const WRAP_HALF: f64 = 180.0;

/// Wrap angle to [-180, 180]
#[wasm_bindgen]
pub fn wrap(a: f64) -> f64 {
    let mut a = a % 360.0;
    if a >= 180.0 { a -= 360.0; }
    if a < -180.0 { a += 360.0; }
    a
}

/// Convert degrees to radians
#[wasm_bindgen]
pub fn vehicle_deg_to_rad(deg: f64) -> f64 {
    deg * 0.017453292
}

/// Horse jump power calculation
#[wasm_bindgen]
pub fn horse_jump_power(p: f64) -> f64 {
    let p = p.max(0.0);
    if p >= 90.0 { 1.0 } else { 0.4 + 0.4 * p / 90.0 }
}

/// Boat status check
#[wasm_bindgen]
pub fn boat_status(underwater: &str, check_in_water: bool, boat_glide: f64) -> String {
    if !underwater.is_empty() { return underwater.to_string(); }
    if check_in_water { return "water".to_string(); }
    if boat_glide > 0.0 { return "land".to_string(); }
    "air".to_string()
}

/// Rider yaw adjustment
#[wasm_bindgen]
pub fn apply_to_rider(
    rider_yaw: f64,
    delta_rotation: f64,
    yaw: f64,
) -> f64 {
    let mut rider_yaw = rider_yaw + delta_rotation;
    let f = wrap(rider_yaw - yaw);
    let f1 = f.max(-105.0).min(105.0);
    rider_yaw = rider_yaw + f1 - f;
    rider_yaw
}

/// Wrap angle to [-180, 180]
#[wasm_bindgen]
pub fn vehicle_wrap(a: f64) -> f64 {
    let mut a = a % 360.0;
    if a >= 180.0 { a -= 360.0; }
    if a < -180.0 { a += 360.0; }
    a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wrap_deg() {
        assert_eq!(wrap(180.0), -180.0);
        assert_eq!(wrap(270.0), -90.0);
        assert_eq!(wrap(-270.0), 90.0);
        assert_eq!(wrap(720.0), 0.0);
    }

    #[test]
    fn horse_jump_power_curve() {
        assert_eq!(horse_jump_power(0.0), 0.4);
        assert_eq!(horse_jump_power(90.0), 1.0);
        assert_eq!(horse_jump_power(100.0), 1.0);
    }
}
