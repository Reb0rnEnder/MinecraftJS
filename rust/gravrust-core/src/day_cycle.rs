//! Day/night cycle calculations
use wasm_bindgen::prelude::*;

/// Day/night cycle constants
pub const DAY_LENGTH: i64 = 24000;
pub const NOON_TIME: i64 = 6000;
pub const SUNSET_TIME: i64 = 12000;
pub const MIDNIGHT_TIME: i64 = 18000;
pub const SUNRISE_TIME: i64 = 22000; // or 0

/// Check if it's day time (sun above horizon)
#[wasm_bindgen]
pub fn is_day_time(time_of_day: i64) -> bool {
    let t = time_of_day % DAY_LENGTH;
    t >= NOON_TIME && t < SUNSET_TIME
}

/// Check if it's night time (hostile mobs can spawn)
#[wasm_bindgen]
pub fn is_night_time(time_of_day: i64) -> bool {
    let t = time_of_day % DAY_LENGTH;
    t >= MIDNIGHT_TIME || t < SUNRISE_TIME
}

/// Check if players can sleep (night time in overworld)
#[wasm_bindgen]
pub fn can_sleep(time_of_day: i64, dimension: i32) -> bool {
    if dimension != 0 { return false; } // Only overworld
    let t = time_of_day % DAY_LENGTH;
    t >= 13000 && t <= 23000
}

/// Get time until next morning (ticks)
#[wasm_bindgen]
pub fn ticks_until_morning(time_of_day: i64) -> i64 {
    let t = time_of_day % DAY_LENGTH;
    if t < SUNRISE_TIME {
        SUNRISE_TIME - t
    } else {
        DAY_LENGTH - t + SUNRISE_TIME
    }
}

/// Get time until next night (ticks)
#[wasm_bindgen]
pub fn ticks_until_night(time_of_day: i64) -> i64 {
    let t = time_of_day % DAY_LENGTH;
    if t < MIDNIGHT_TIME {
        MIDNIGHT_TIME - t
    } else {
        DAY_LENGTH - t + MIDNIGHT_TIME
    }
}

/// Calculate wake-up time when sleeping
#[wasm_bindgen]
pub fn day_cycle_calculate_wake_time(current_time: i64) -> i64 {
    let time_of_day = current_time % DAY_LENGTH;
    if time_of_day >= 13000 {
        current_time + (DAY_LENGTH - time_of_day)
    } else {
        current_time + (DAY_LENGTH - time_of_day)
    }
}

/// Get day phase name
#[wasm_bindgen]
pub fn get_day_phase(time_of_day: i64) -> String {
    let t = time_of_day % DAY_LENGTH;
    if t < NOON_TIME {
        "morning".to_string()
    } else if t < SUNSET_TIME {
        "day".to_string()
    } else if t < MIDNIGHT_TIME {
        "sunset".to_string()
    } else if t < SUNRISE_TIME {
        "night".to_string()
    } else {
        "sunrise".to_string()
    }
}

/// Get celestial angle (0.0 = noon, 0.5 = midnight)
/// Ported from sky.js celestialAngle function
#[wasm_bindgen]
pub fn day_cycle_celestial_angle(world_time: i64, partial: f64) -> f64 {
    let time_of_day = (world_time % DAY_LENGTH) as f64 + partial;
    let mut angle = time_of_day / DAY_LENGTH as f64;
    // Smooth the transition at midnight
    angle = angle * angle * (3.0 - 2.0 * angle);
    angle
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_day_night_cycle() {
        assert!(is_day_time(6000)); // noon
        assert!(is_day_time(10000)); // afternoon
        assert!(!is_day_time(18000)); // midnight
        assert!(!is_day_time(2000)); // early morning
    }
    
    #[test]
    fn test_can_sleep() {
        assert!(can_sleep(14000, 0)); // night in overworld
        assert!(can_sleep(18000, 0)); // midnight
        assert!(!can_sleep(6000, 0)); // day
        assert!(!can_sleep(14000, -1)); // nether
        assert!(!can_sleep(14000, 1)); // end
    }
    
    #[test]
    fn test_ticks_until_morning() {
        assert_eq!(ticks_until_morning(18000), 4000); // midnight -> sunrise
        assert_eq!(ticks_until_morning(0), 22000); // morning -> next sunrise
    }
    
    #[test]
    fn test_celestial_angle() {
        // Noon = 0.0 (after smoothstep)
        let noon = day_cycle_celestial_angle(6000, 0.0);
        assert!((noon - 0.0).abs() < 0.01);
        
        // Midnight = 0.5
        let midnight = day_cycle_celestial_angle(18000, 0.0);
        assert!((midnight - 0.5).abs() < 0.01);
    }
}