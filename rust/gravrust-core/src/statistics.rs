//! Statistics tracking (port of StatFileWriter / statistics handling)
use wasm_bindgen::prelude::*;
use std::collections::HashMap;

/// Update a statistic value. Stats cross the JS boundary as a JSON object.
#[wasm_bindgen]
pub fn update_statistic(stats_json: &str, name: &str, value: i64) -> String {
    let mut stats: HashMap<String, i64> = serde_json::from_str(stats_json).unwrap_or_default();
    stats.insert(name.to_string(), value);
    serde_json::to_string(&stats).unwrap_or_else(|_| "{}".to_string())
}

/// Add to a statistic (for incrementing).
#[wasm_bindgen]
pub fn add_statistic(stats_json: &str, name: &str, delta: i64) -> String {
    let mut stats: HashMap<String, i64> = serde_json::from_str(stats_json).unwrap_or_default();
    *stats.entry(name.to_string()).or_insert(0) += delta;
    serde_json::to_string(&stats).unwrap_or_else(|_| "{}".to_string())
}

/// Get a statistic value.
#[wasm_bindgen]
pub fn get_statistic(stats_json: &str, name: &str) -> i64 {
    let stats: HashMap<String, i64> = serde_json::from_str(stats_json).unwrap_or_default();
    stats.get(name).copied().unwrap_or(0)
}

/// Native helper used by other Rust modules: update in place.
pub fn update_statistic_map(stats: &mut HashMap<String, i64>, name: &str, value: i64) {
    stats.insert(name.to_string(), value);
}

/// Native helper used by other Rust modules: add a delta to a value.
pub fn add_statistic_map(stats: &mut HashMap<String, i64>, name: &str, delta: i64) {
    let next = stats.get(name).copied().unwrap_or(0) + delta;
    stats.insert(name.to_string(), next);
}

/// Native helper used by other Rust modules: read a value.
pub fn get_statistic_map(stats: &HashMap<String, i64>, name: &str) -> i64 {
    stats.get(name).copied().unwrap_or(0)
}

/// Common statistic names (vanilla)
pub mod stat_names {
    pub const PLAY_ONE_MINUTE: &str = "minecraft:custom:minecraft:play_one_minute";
    pub const TIME_SINCE_DEATH: &str = "minecraft:custom:minecraft:time_since_death";
    pub const TIME_SINCE_REST: &str = "minecraft:custom:minecraft:time_since_rest";
    pub const JUMP: &str = "minecraft:custom:minecraft:jump";
    pub const DROP: &str = "minecraft:custom:minecraft:drop";
    pub const DAMAGE_DEALT: &str = "minecraft:custom:minecraft:damage_dealt";
    pub const DAMAGE_TAKEN: &str = "minecraft:custom:minecraft:damage_taken";
    pub const DEATHS: &str = "minecraft:custom:minecraft:deaths";
    pub const MOB_KILLS: &str = "minecraft:custom:minecraft:mob_kills";
    pub const PLAYER_KILLS: &str = "minecraft:custom:minecraft:player_kills";
    pub const FISH_CAUGHT: &str = "minecraft:custom:minecraft:fish_caught";
    pub const TALKED_TO_VILLAGER: &str = "minecraft:custom:minecraft:talked_to_villager";
    pub const TRADED_WITH_VILLAGER: &str = "minecraft:custom:minecraft:traded_with_villager";
    pub const CAKE_SLICES_EATEN: &str = "minecraft:custom:minecraft:cake_slices_eaten";
    pub const CAULDRON_FILLED: &str = "minecraft:custom:minecraft:cauldron_filled";
    pub const CAULDRON_USED: &str = "minecraft:custom:minecraft:cauldron_used";
    pub const ARMOR_CLEANED: &str = "minecraft:custom:minecraft:armor_cleaned";
    pub const BANNER_CLEANED: &str = "minecraft:custom:minecraft:banner_cleaned";
    pub const BREWINGSTAND_INTERACTION: &str = "minecraft:custom:minecraft:brewingstand_interaction";
    pub const BEACON_INTERACTION: &str = "minecraft:custom:minecraft:beacon_interaction";
    pub const DROPPER_INSPECTED: &str = "minecraft:custom:minecraft:dropper_inspected";
    pub const HOPPER_INSPECTED: &str = "minecraft:custom:minecraft:hopper_inspected";
    pub const DISPENSER_INSPECTED: &str = "minecraft:custom:minecraft:dispenser_inspected";
    pub const NOTEBLOCK_PLAYED: &str = "minecraft:custom:minecraft:noteblock_played";
    pub const NOTEBLOCK_TUNED: &str = "minecraft:custom:minecraft:noteblock_tuned";
    pub const FLOWER_POTTED: &str = "minecraft:custom:minecraft:flower_potted";
    pub const TRAPPED_CHEST_TRIGGERED: &str = "minecraft:custom:minecraft:trapped_chest_triggered";
    pub const ENDERCHEST_OPENED: &str = "minecraft:custom:minecraft:enderchest_opened";
    pub const ITEM_ENCHANTED: &str = "minecraft:custom:minecraft:item_enchanted";
    pub const RECORD_PLAYED: &str = "minecraft:custom:minecraft:record_played";
    pub const FURNACE_INTERACTION: &str = "minecraft:custom:minecraft:furnace_interaction";
    pub const CRAFTING_TABLE_INTERACTION: &str = "minecraft:custom:minecraft:crafting_table_interaction";
    pub const CHEST_OPENED: &str = "minecraft:custom:minecraft:chest_opened";
    pub const SLEEP_IN_BED: &str = "minecraft:custom:minecraft:sleep_in_bed";
    pub const CLEAN_SHULKER_BOX: &str = "minecraft:custom:minecraft:clean_shulker_box";
    pub const OPEN_SHULKER_BOX: &str = "minecraft:custom:minecraft:open_shulker_box";
    
    // Distance stats
    pub const WALK_ONE_CM: &str = "minecraft:custom:minecraft:walk_one_cm";
    pub const CROUCH_ONE_CM: &str = "minecraft:custom:minecraft:crouch_one_cm";
    pub const SPRINT_ONE_CM: &str = "minecraft:custom:minecraft:sprint_one_cm";
    pub const SWIM_ONE_CM: &str = "minecraft:custom:minecraft:swim_one_cm";
    pub const FALL_ONE_CM: &str = "minecraft:custom:minecraft:fall_one_cm";
    pub const CLIMB_ONE_CM: &str = "minecraft:custom:minecraft:climb_one_cm";
    pub const FLY_ONE_CM: &str = "minecraft:custom:minecraft:fly_one_cm";
    pub const WALK_UNDER_WATER_ONE_CM: &str = "minecraft:custom:minecraft:walk_under_water_one_cm";
    pub const WALK_ON_WATER_ONE_CM: &str = "minecraft:custom:minecraft:walk_on_water_one_cm";
    pub const MINECART_ONE_CM: &str = "minecraft:custom:minecraft:minecart_one_cm";
    pub const BOAT_ONE_CM: &str = "minecraft:custom:minecraft:boat_one_cm";
    pub const PIG_ONE_CM: &str = "minecraft:custom:minecraft:pig_one_cm";
    pub const HORSE_ONE_CM: &str = "minecraft:custom:minecraft:horse_one_cm";
    pub const AVIATE_ONE_CM: &str = "minecraft:custom:minecraft:aviate_one_cm";
    
    // Block/item stats
    pub const MINE_BLOCK_PREFIX: &str = "minecraft:mined:minecraft:";
    pub const CRAFT_ITEM_PREFIX: &str = "minecraft:crafted:minecraft:";
    pub const USE_ITEM_PREFIX: &str = "minecraft:used:minecraft:";
    pub const BREAK_ITEM_PREFIX: &str = "minecraft:broken:minecraft:";
    pub const PICKUP_ITEM_PREFIX: &str = "minecraft:picked_up:minecraft:";
    pub const DROP_ITEM_PREFIX: &str = "minecraft:dropped:minecraft:";
    pub const KILL_ENTITY_PREFIX: &str = "minecraft:killed:minecraft:";
    pub const KILLED_BY_PREFIX: &str = "minecraft:killed_by:minecraft:";
}

/// Generate a statistic key for a block/item/entity
#[wasm_bindgen]
pub fn stat_key(category: &str, namespace: &str, name: &str) -> String {
    format!("minecraft:{}:{}:{}", category, namespace, name)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_update_get_statistic() {
        let mut stats = HashMap::new();
        update_statistic_map(&mut stats, "test.stat", 42);
        assert_eq!(get_statistic_map(&stats, "test.stat"), 42);
    }
    
    #[test]
    fn test_add_statistic() {
        let mut stats = HashMap::new();
        add_statistic_map(&mut stats, "test.stat", 10);
        add_statistic_map(&mut stats, "test.stat", 5);
        assert_eq!(get_statistic_map(&stats, "test.stat"), 15);
    }
    
    #[test]
    fn test_missing_statistic() {
        let stats = HashMap::new();
        assert_eq!(get_statistic_map(&stats, "missing"), 0);
    }
    
    #[test]
    fn test_stat_key() {
        assert_eq!(stat_key("mined", "minecraft", "diamond_ore"), "minecraft:mined:minecraft:diamond_ore");
        assert_eq!(stat_key("crafted", "minecraft", "diamond_sword"), "minecraft:crafted:minecraft:diamond_sword");
        assert_eq!(stat_key("used", "minecraft", "diamond_pickaxe"), "minecraft:used:minecraft:diamond_pickaxe");
    }
}
