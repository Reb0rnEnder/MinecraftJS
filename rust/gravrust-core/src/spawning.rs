//! Mob spawning logic
use wasm_bindgen::prelude::*;

/// Check if a mob should spawn at given conditions
#[wasm_bindgen]
pub fn should_spawn_mob(
    difficulty: u8,
    light_level: u8,
    sky_light: u8,
    block_light: u8,
    y: i32,
    is_slime_chunk: bool,
    is_swamp: bool,
) -> bool {
    // Peaceful = no hostile spawns
    if difficulty == 0 {
        return false;
    }
    
    // Light level check (simplified)
    let effective_light = sky_light.max(block_light);
    if effective_light > 7 {
        return false;
    }
    
    // Height restrictions
    if y < 0 || y > 255 {
        return false;
    }
    
    // Slime chunk special case
    if is_slime_chunk && y < 40 {
        return true; // Slimes can spawn in slime chunks below Y=40
    }
    
    // Swamp slime spawn at night
    if is_swamp && y >= 50 && y <= 70 {
        // Would need moon phase check here
        return true;
    }
    
    true
}

/// Get mob spawn cap for category
#[wasm_bindgen]
pub fn get_mob_cap(category: &str, difficulty: u8, total_players: u32) -> u32 {
    let base_cap = match category {
        "monster" => 70,
        "creature" => 10,
        "ambient" => 15,
        "axolotls" => 5,
        "water_creature" => 5,
        "water_ambient" => 20,
        "misc" => 10,
        _ => 10,
    };
    
    let diff_mult = match difficulty {
        0 => 0.0,
        1 => 0.7,
        2 => 1.0,
        3 => 1.3,
        _ => 1.0,
    };
    
    ((base_cap as f64 * diff_mult * total_players as f64) as u32).max(1)
}

/// Check if position is valid for spawning (solid block below, air above)
#[wasm_bindgen]
pub fn is_valid_spawn_position(
    block_below_solid: bool,
    block_at_air: bool,
    block_above_air: bool,
) -> bool {
    block_below_solid && block_at_air && block_above_air
}

/// Get spawn weight for biome/mob combination
#[wasm_bindgen]
pub fn get_spawn_weight(biome: &str, mob_type: &str) -> u32 {
    // Simplified spawn weights
    match (biome, mob_type) {
        ("plains", "cow") => 8,
        ("plains", "pig") => 10,
        ("plains", "sheep") => 8,
        ("plains", "horse") => 2,
        ("forest", "wolf") => 4,
        ("taiga", "wolf") => 4,
        ("taiga", "fox") => 2,
        ("jungle", "ocelot") => 2,
        ("jungle", "parrot") => 2,
        ("savanna", "horse") => 1,
        ("desert", "rabbit") => 4,
        ("swamp", "slime") => 1, // Night only
        ("river", "squid") => 10,
        ("ocean", "dolphin") => 5,
        ("ocean", "squid") => 10,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_peaceful_no_spawn() {
        assert!(!should_spawn_mob(0, 0, 0, 0, 64, false, false));
    }
    
    #[test]
    fn test_light_level_blocked() {
        assert!(!should_spawn_mob(2, 8, 8, 0, 64, false, false));
    }
    
    #[test]
    fn test_slime_chunk() {
        assert!(should_spawn_mob(2, 0, 0, 0, 30, true, false));
    }
    
    #[test]
    fn test_mob_cap() {
        assert_eq!(get_mob_cap("monster", 2, 1), 70);
        assert_eq!(get_mob_cap("monster", 1, 1), 49);
        assert_eq!(get_mob_cap("creature", 2, 2), 20);
    }
    
    #[test]
    fn test_valid_spawn() {
        assert!(is_valid_spawn_position(true, true, true));
        assert!(!is_valid_spawn_position(false, true, true));
        assert!(!is_valid_spawn_position(true, false, true));
        assert!(!is_valid_spawn_position(true, true, false));
    }
}