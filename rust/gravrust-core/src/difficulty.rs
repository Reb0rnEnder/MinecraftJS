//! Regional difficulty calculation (port of vanilla RegionalDifficulty)
use wasm_bindgen::prelude::*;

/// Calculate regional difficulty based on:
/// - Base difficulty setting
/// - World time (longer worlds = harder)
/// - Chunk inhabited time (longer inhabited = harder)
/// - Moon phase (full moon = harder)
#[wasm_bindgen]
pub fn calculate_regional_difficulty(
    difficulty: u8,
    world_time: i64,
    inhabited_time: i64,
    moon_phase: i32,
) -> f64 {
    let base = match difficulty {
        0 => 0.0,    // Peaceful
        1 => 0.5,    // Easy
        2 => 1.5,    // Normal
        3 => 2.5,    // Hard
        _ => 1.5,
    };
    
    // Time factor: up to +0.75 after 3.6M ticks (50 hours)
    let time_factor = (world_time as f64 / 3600000.0).min(1.0) * 0.75;
    
    // Inhabited time factor: up to +1.0 after 3.6M ticks
    let inhabited_factor = (inhabited_time as f64 / 3600000.0).min(1.0) * 1.0;
    
    // Moon phase factor: 0 (new) to 0.25 (full)
    let moon_factor = (moon_phase as f64 / 4.0) * 0.25;
    
    let total = base + time_factor + inhabited_factor + moon_factor;
    
    // Clamp by difficulty
    match difficulty {
        0 => 0.0,
        1 => total.min(1.5),
        2 => total.min(2.0),
        3 => total.min(4.0),
        _ => total.min(2.0),
    }
}

/// Check if a difficulty allows hostile spawns
#[wasm_bindgen]
pub fn difficulty_allows_hostile_spawns(difficulty: u8) -> bool {
    difficulty > 0
}

/// Get spawn probability multiplier for difficulty
#[wasm_bindgen]
pub fn difficulty_spawn_multiplier(difficulty: u8) -> f64 {
    match difficulty {
        0 => 0.0,
        1 => 0.7,
        2 => 1.0,
        3 => 1.3,
        _ => 1.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_peaceful_is_zero() {
        assert_eq!(calculate_regional_difficulty(0, 10000000, 10000000, 4), 0.0);
    }
    
    #[test]
    fn test_moon_phase_effect() {
        let base = calculate_regional_difficulty(2, 0, 0, 0); // new moon
        let full = calculate_regional_difficulty(2, 0, 0, 4); // full moon
        assert!((full - base - 0.25).abs() < 0.01);
    }
    
    #[test]
    fn test_time_factor_caps() {
        let d1 = calculate_regional_difficulty(2, 3600000, 0, 0);
        let d2 = calculate_regional_difficulty(2, 10000000, 0, 0);
        assert!((d1 - d2).abs() < 0.01); // Both capped at 0.75
    }
}