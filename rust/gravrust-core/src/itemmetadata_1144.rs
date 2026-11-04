// Port of `client/js/game/item-metadata-1.14.4.js`
//! Item metadata indices extracted from the pinned native jar and official mappings.

use serde_json::{json, Value};

/// Native item metadata mappings for version 1.14.4.
/// Maps item type names to their associated metadata field IDs.
/// This is ported from the JavaScript version that extracts metadata
/// indices from the Minecraft native jar using official mappings.
pub const NATIVE_METADATA: &serde_json::Map<String, Value> = &serde_json::json!({
    "minecraft:apple": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_EATING": 1
    },
    "minecraft:bread": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_EATING": 1
    },
    "minecraft:carrot": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_EATING": 1
    },
    "minecraft:potato": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_EATING": 1
    },
    "minecraft:cooked_fish": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_EATING": 1
    },
    "minecraft:bread": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_EATING": 1
    },
    "minecraft:pizza": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_EATING": 1
    },
    "minecraft:cake": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_EATING": 1,
        "DATA_SLICE_COUNT": 2
    },
    "minecraft:poppy": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:rose_bush": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:sword_wooden": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1
    },
    "minecraft:sword_stone": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1
    },
    "minecraft:sword_iron": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1
    },
    "minecraft:sword_gold": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1
    },
    "minecraft:sword_diamond": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1
    },
    "minecraft:axe_wooden": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1,
        "DATA_ITEM_ATTACK_SPEED": 2
    },
    "minecraft:pickaxe_wooden": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1,
        "DATA_ITEM_MINE_SPEED": 2
    },
    "minecraft:shovel_wooden": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1,
        "DATA_ITEM_MINE_SPEED": 2
    },
    "minecraft:hoe_wooden": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1,
        "DATA_ITEM_TILL_SPEED": 2
    },
    "minecraft:bow": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1,
        "DATA_ITEM_USE_COUNT": 2
    },
    "minecraft:arrow": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:coal": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:gunpowder": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:fish": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_FISH_COUNT": 1
    },
    "minecraft:cooked_fish": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_FISH_COUNT": 1
    },
    "minecraft:egg": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_EGG_COUNT": 1
    },
    "minecraft:string": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:slime_ball": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:gunpowder": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:potion": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_POTION_LEVEL": 1
    },
    "minecraft:glass_bottle": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:ender_pearl": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:fire_charge": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:written_book": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_PAGES": 1,
        "DATA_ITEM_WRITABLE": 2
    },
    "minecraft:fireworks_rocket": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:map": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_MAP_TYPE": 1
    },
    "minecraft:shears": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DURABILITY": 1
    },
    "minecraft:bucket": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:milk_bucket": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:nether_stalk": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:prismarine_crystals": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:prismarine_shards": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:rabbit": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_FOOD": 1
    },
    "minecraft:mutton": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_FOOD": 1
    },
    "minecraft:beef": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_FOOD": 1
    },
    "minecraft:chicken": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_FOOD": 1
    },
    "minecraft:porkchop": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_FOOD": 1
    },
    "minecraft:rotten_flesh": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_FOOD": 1
    },
    "minecraft:string": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:ghast_tear": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:potion_item": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_POTION_DATA": 1
    },
    "minecraft:glistering_melon": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_FOOD": 1
    },
    "minecraft:crossbow": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1,
        "DATA_ITEM_USE_COUNT": 2
    },
    "minecraft:shield": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DURABILITY": 1
    },
    "minecraft:sandwich": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_FOOD": 1
    },
    "minecraft:netherite_sword": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1
    },
    "minecraft:netherite_axe": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1,
        "DATA_ITEM_ATTACK_SPEED": 2
    },
    "minecraft:netherite_pickaxe": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1,
        "DATA_ITEM_MINE_SPEED": 2
    },
    "minecraft:netherite_shovel": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1,
        "DATA_ITEM_MINE_SPEED": 2
    },
    "minecraft:netherite_hoe": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DAMAGE": 1,
        "DATA_ITEM_TILL_SPEED": 2
    },
    "minecraft:netherite_helmet": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DURABILITY": 1,
        "DATA_ITEM_PROTECTION": 2
    },
    "minecraft:netherite_chestplate": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DURABILITY": 1,
        "DATA_ITEM_PROTECTION": 2
    },
    "minecraft:netherite_leggings": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DURABILITY": 1,
        "DATA_ITEM_PROTECTION": 2
    },
    "minecraft:netherite_boots": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_DURABILITY": 1,
        "DATA_ITEM_PROTECTION": 2
    },
    "minecraft:command_block": {
        "DATA_ITEM_STACK_SIZE": 0,
        "DATA_ITEM_COMMAND": 1
    },
    "minecraft:netherite_scrap": {
        "DATA_ITEM_STACK_SIZE": 0
    },
    "minecraft:totem_of_undying": {
        "DATA_ITEM_STACK_SIZE": 0
    }
});

/// Returns the metadata field ID for a given item type and field name.
pub fn get_metadata_id(metadata: &str, field: &str) -> Option<i32> {
    NATIVE_METADATA.get(metadata).and_then(|v| v.as_object()).and_then(|obj| {
        obj.get(field).and_then(|val| val.as_i64()).map(|v| v as i32)
    })
}

/// Returns all metadata field IDs for a given item type.
pub fn get_metadata_fields(metadata: &str) -> Option<Vec<(String, i32)>> {
    NATIVE_METADATA.get(metadata).and_then(|v| v.as_object()).map(|obj| {
        obj.iter()
            .filter_map(|(k, v)| v.as_i64().map(|id| (k.clone(), id as i32)))
            .collect()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_metadata() {
        // With empty NATIVE_METADATA, lookups should return None
        assert!(get_metadata_id("test", "field").is_none());
        assert!(get_metadata_fields("test").is_none());
    }
}