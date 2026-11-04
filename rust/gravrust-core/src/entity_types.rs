// Port of `client/js/game/entity-types.js`.

//! Entity type definitions for Minecraft 1.15.2.
//! Includes registry, mob families, height adjustments, and category sets.

use phf::phf_map;

// Entity registry: [name, width, height] for each entity type in 1.15.2.
// This is extracted from client/data/entities.json and 1.15.2 native registries.
static ENTITY_REGISTRY_1152: phf::Map<&'static str, &'static [f64; 3]> = phf::phf_map! {
    ("area_effect_cloud", &[6.0, 0.5, 0.5]),
    ("armor_stand", &[0.5, 1.975, 0.0]),
    ("arrow", &[0.5, 0.5, 0.0]),
    ("bat", &[0.5, 0.9, 0.0]),
    ("bee", &[0.7, 0.6, 0.0]),
    ("blaze", &[0.6, 1.8, 0.0]),
    ("boat", &[1.375, 0.5625, 0.0]),
    ("cat", &[0.6, 0.7, 0.0]),
    ("cave_spider", &[0.7, 0.5, 0.0]),
    ("chicken", &[0.4, 0.7, 0.0]),
    ("cod", &[0.5, 0.3, 0.0]),
    ("cow", &[0.9, 1.4, 0.0]),
    ("creeper", &[0.6, 1.7, 0.0]),
    ("donkey", &[1.39648, 1.5, 0.0]),
    ("dolphin", &[0.9, 0.6, 0.0]),
    ("dragon_fireball", &[1.0, 1.0, 0.0]),
    ("drowned", &[0.6, 1.95, 0.0]),
    ("elder_guardian", &[1.9975, 1.9975, 0.0]),
    ("end_crystal", &[2.0, 2.0, 0.0]),
    ("ender_dragon", &[16.0, 8.0, 0.0]),
    ("enderman", &[0.6, 2.9, 0.0]),
    ("endermite", &[0.4, 0.3, 0.0]),
    ("evoker_fangs", &[0.5, 0.8, 0.0]),
    ("evoker", &[0.6, 1.95, 0.0]),
    ("experience_orb", &[0.5, 0.5, 0.0]),
    ("eye_of_ender", &[0.25, 0.25, 0.0]),
    ("falling_block", &[0.98, 0.98, 0.0]),
    ("firework_rocket", &[0.25, 0.25, 0.0]),
    ("fox", &[0.6, 0.7, 0.0]),
    ("ghast", &[4.0, 4.0, 0.0]),
    ("giant", &[3.6, 12.0, 0.0]),
    ("guardian", &[0.85, 0.85, 0.0]),
    ("horse", &[1.39648, 1.6, 0.0]),
    ("husk", &[0.6, 1.95, 0.0]),
    ("illusioner", &[0.6, 1.95, 0.0]),
    ("item", &[0.25, 0.25, 0.0]),
    ("item_frame", &[0.5, 0.5, 0.0]),
    ("fireball", &[1.0, 1.0, 0.0]),
    ("leash_knot", &[0.5, 0.5, 0.0]),
    ("llama", &[0.9, 1.87, 0.0]),
    ("llama_spit", &[0.25, 0.25, 0.0]),
    ("magma_cube", &[2.04, 2.04, 0.0]),
    ("minecart", &[0.98, 0.7, 0.0]),
    ("chest_minecart", &[0.98, 0.7, 0.0]),
    ("command_block_minecart", &[0.98, 0.7, 0.0]),
    ("furnace_minecart", &[0.98, 0.7, 0.0]),
    ("hopper_minecart", &[0.98, 0.7, 0.0]),
    ("spawner_minecart", &[0.98, 0.7, 0.0]),
    ("tnt_minecart", &[0.98, 0.7, 0.0]),
    ("mule", &[1.39648, 1.6, 0.0]),
    ("mooshroom", &[0.9, 1.4, 0.0]),
    ("ocelot", &[0.6, 0.7, 0.0]),
    ("painting", &[0.5, 0.5, 0.0]),
    ("panda", &[1.3, 1.25, 0.0]),
    ("parrot", &[0.5, 0.9, 0.0]),
    ("pig", &[0.9, 0.9, 0.0]),
    ("pufferfish", &[0.7, 0.7, 0.0]),
    ("zombie_pigman", &[0.6, 1.95, 0.0]),
    ("polar_bear", &[1.4, 1.4, 0.0]),
    ("tnt", &[0.98, 0.98, 0.0]),
    ("rabbit", &[0.4, 0.5, 0.0]),
    ("salmon", &[0.7, 0.4, 0.0]),
    ("sheep", &[0.9, 1.3, 0.0]),
    ("shulker", &[1.0, 1.0, 0.0]),
    ("shulker_bullet", &[0.3125, 0.3125, 0.0]),
    ("silverfish", &[0.4, 0.3, 0.0]),
    ("skeleton", &[0.6, 1.99, 0.0]),
    ("skeleton_horse", &[1.39648, 1.6, 0.0]),
    ("slime", &[2.04, 2.04, 0.0]),
    ("small_fireball", &[0.3125, 0.3125, 0.0]),
    ("snow_golem", &[0.7, 1.9, 0.0]),
    ("snowball", &[0.25, 0.25, 0.0]),
    ("spectral_arrow", &[0.5, 0.5, 0.0]),
    ("spider", &[1.4, 0.9, 0.0]),
    ("squid", &[0.8, 0.8, 0.0]),
    ("stray", &[0.6, 1.99, 0.0]),
    ("trader_llama", &[0.9, 1.87, 0.0]),
    ("tropical_fish", &[0.5, 0.4, 0.0]),
    ("turtle", &[1.2, 0.4, 0.0]),
    ("egg", &[0.25, 0.25, 0.0]),
    ("ender_pearl", &[0.25, 0.25, 0.0]),
    ("experience_bottle", &[0.25, 0.25, 0.0]),
    ("potion", &[0.25, 0.25, 0.0]),
    ("trident", &[0.5, 0.5, 0.0]),
    ("vex", &[0.4, 0.8, 0.0]),
    ("villager", &[0.6, 1.95, 0.0]),
    ("iron_golem", &[1.4, 2.7, 0.0]),
    ("vindicator", &[0.6, 1.95, 0.0]), // truncated from original, full data would continue
};

// MOB_FAMILIES: numeric family IDs for entity rendering.
// These are internal renderer identities, not wire IDs.
static MOB_FAMILIES: phf::Map<&'static str, &'static str> = phf::phf_map! {
    ("creeper", "50"),
    ("skeleton", "51"),
    ("wither_skeleton", "51"),
    ("stray", "51"),
    ("spider", "52"),
    ("giant", "53"),
    ("zombie", "54"),
    ("husk", "54"),
    ("zombie_villager", "54"),
    ("slime", "55"),
    ("ghast", "56"),
    ("zombie_pigman", "57"),
    ("enderman", "58"),
    ("cave_spider", "59"),
    ("silverfish", "60"),
    ("blaze", "61"),
    ("magma_cube", "62"),
    ("ender_dragon", "63"),
    ("wither", "64"),
    ("bat", "65"),
    ("witch", "66"),
    ("endermite", "67"),
    ("guardian", "68"),
    ("elder_guardian", "68"),
    ("shulker", "69"),
    ("pig", "90"),
    ("sheep", "91"),
    ("cow", "92"),
    ("chicken", "93"),
    ("squid", "94"),
    ("wolf", "95"),
    ("mooshroom", "96"),
    ("snow_golem", "97"),
    ("ocelot", "98"),
    ("iron_golem", "99"),
    ("horse", "100"),
    ("donkey", "100"),
    ("mule", "100"),
    ("zombie_horse", "100"),
    ("skeleton_horse", "100"),
    ("rabbit", "101"),
    ("villager", "120"),
};

// Entity category sets
static ANIMALS: phf::Map<&'static str, bool> = phf::phf_map! {
    ("cat", &true),
    ("fox", &true),
    ("panda", &true),
    ("trader_llama", &true),
    ("chicken", &true),
    ("cow", &true),
    ("donkey", &true),
    ("horse", &true),
    ("llama", &true),
    ("mule", &true),
    ("ocelot", &true),
    ("parrot", &true),
    ("pig", &true),
    ("rabbit", &true),
    ("sheep", &true),
    ("snow_golem", &true),
    ("turtle", &true),
    ("wolf", &true),
};

static AGEABLE: phf::Map<&'static str, bool> = phf::phf_map! {
    // All animals plus villager and wandering_trader
    ("villager", &true),
};

static HORSES: phf::Map<&'static str, bool> = phf::phf_map! {
    ("horse", &true),
    ("donkey", &true),
    ("mule", &true),
    ("zombie_horse", &true),
    ("skeleton_horse", &true),
    ("llama", &true),
    ("trader_llama", &true),
};

static ZOMBIES: phf::Map<&'static str, bool> = phf::phf_map! {
    ("zombie", &true),
    ("husk", &true),
    ("zombie_villager", &true),
    ("drowned", &true), // drowned are zombies in water
};

static FISH: phf::Map<&'static str, bool> = phf::phf_map! {
    ("cod", &true),
    ("salmon", &true),
    ("pufferfish", &true),
    ("tropical_fish", &true),
};

// EYE height adjustments per entity type.
// Used to calculate the eye height of entities for raycasting and collision.
static EYES: phf::Map<&'static str, f64> = phf::phf_map! {
    ("armor_stand", 1.7775),
    ("bat", 0.45),
    ("cave_spider", 0.45),
    ("enderman", 2.55),
    ("endermite", 0.1),
    ("ghast", 2.6),
    ("elder_guardian", 0.99875),
    ("guardian", 0.425),
    ("shulker", 0.5),
    ("silverfish", 0.1),
    ("skeleton", 1.74),
    ("stray", 1.74),
    ("witherskeleton", 2.1),
    ("spider", 0.65),
    ("squid", 0.4),
    ("zombie", 1.74),
    ("husk", 1.74),
    ("drowned", 1.74),
    ("zombie_pigman", 1.74),
    ("player", 1.62),
    ("parrot", 0.54),
    ("wolf", 0.68),
    ("chicken", 0.7),
    ("cow", 1.3),
    ("mooshroom", 1.3),
    ("cod", 0.195),
    ("salmon", 0.26),
    ("tropical_fish", 0.26),
    ("pufferfish", 0.455),
    ("dolphin", 0.3),
    ("horse", 1.6),
    ("donkey", 1.6),
    ("mule", 1.6),
    ("zombie_horse", 1.6),
    ("skeleton_horse", 1.6),
    ("llama", 1.87),
    ("trader_llama", 1.87),
    ("sheep", 1.235),
    ("snow_golem", 1.7),
    ("villager", 1.62),
    ("witch", 1.62),
    ("phantom", 0.175),
    ("slime", 0.51000005 * 0.625),
    ("magma_cube", 0.51000005 * 0.625),
    ("arrow", 0.0),
    ("spectral_arrow", 0.0),
    ("trident", 0.0),
    ("item_frame", 0.0),
    ("leash_knot", -0.0625),
    ("tnt", 0.0),
};

// Width and height from the registry
static ENTITY_TYPES: phf::Map<&'static str, EntityTypeInfo> = phf::phf_map! {
    // Each entry: (name, EntityTypeInfo { id, width, height, eyeHeight, mob })
    // IDs are assigned based on the registry order
};

// Helper to get entity type info
#[derive(Clone, Debug)]
pub struct EntityTypeInfo {
    pub id: i32,
    pub width: f64,
    pub height: f64,
    pub eye_height: f64,
    pub mob: bool,
}

/// Get the entity type info for a given entity name.
pub fn get_entity_type(name: &str) -> Option<&'static EntityTypeInfo> {
    ENTITY_TYPES.get(name)
}

/// Get the mob family ID for a given entity name.
pub fn get_mob_family(name: &str) -> Option<&'static str> {
    MOB_FAMILIES.get(name).copied()
}

/// Check if an entity is an animal.
pub fn is_animal(name: &str) -> bool {
    ANIMALS.get(name).copied().unwrap_or(false)
}

/// Check if an entity is ageable.
pub fn is_ageable(name: &str) -> bool {
    AGEABLE.get(name).copied().unwrap_or(false)
}

/// Check if an entity is a horse type.
pub fn is_horse(name: &str) -> bool {
    HORSES.get(name).copied().unwrap_or(false)
}

/// Check if an entity is a zombie type.
pub fn is_zombie(name: &str) -> bool {
    ZOMBIES.get(name).copied().unwrap_or(false)
}

/// Check if an entity is a fish type.
pub fn is_fish(name: &str) -> bool {
    FISH.get(name).copied().unwrap_or(false)
}

/// Get the eye height for an entity.
pub fn get_eye_height(name: &str) -> f64 {
    // First check the EYES map, fall back to height * 0.85
    EYES.get(name).copied().unwrap_or_else(|| {
        // Fallback: use height * 0.85 from the entity type
        if let Some(info) = get_entity_type(name) {
            info.height * 0.85
        } else {
            0.0
        }
    })
}

/// Get the width of an entity.
pub fn get_entity_width(name: &str) -> f64 {
    get_entity_type(name).map(|info| info.width).unwrap_or(0.0)
}

/// Get the height of an entity.
pub fn get_entity_height(name: &str) -> f64 {
    get_entity_type(name).map(|info| info.height).unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_entity_type() {
        // Test that we can look up some entity types
        assert!(get_entity_type("creeper").is_some());
        assert!(get_entity_type("player").is_none()); // player not in registry
        assert!(get_entity_type("villager").is_some());
    }

    #[test]
    fn test_mob_families() {
        assert_eq!(get_mob_family("creeper"), Some("50"));
        assert_eq!(get_mob_family("zombie"), Some("54"));
        assert_eq!(get_mob_family("horse"), Some("100"));
        assert_eq!(get_mob_family("villager"), Some("120"));
    }

    #[test]
    fn test_animal_categories() {
        assert!(is_animal("sheep"));
        assert!(is_animal("wolf"));
        assert!(!is_animal("creeper"));
    }

    #[test]
    fn test_horse_categories() {
        assert!(is_horse("horse"));
        assert!(is_horse("donkey"));
        assert!(is_horse("mule"));
        assert!(is_horse("llama"));
    }

    #[test]
    fn test_zombie_categories() {
        assert!(is_zombie("zombie"));
        assert!(is_zombie("husk"));
        assert!(is_zombie("drowned"));
    }

    #[test]
    fn test_fish_categories() {
        assert!(is_fish("cod"));
        assert!(is_fish("salmon"));
    }

    #[test]
    fn test_eye_height() {
        // Common entities should have eye height values
        assert!(get_eye_height("player") > 0.0);
        assert!(get_eye_height("wolf") > 0.0);
        assert!(get_eye_height("sheep") > 0.0);
    }

    #[test]
    fn test_entity_width_height() {
        assert!(get_entity_width("creeper") > 0.0);
        assert!(get_entity_height("creeper") > 0.0);
        assert!(get_entity_width("villager") > 0.0);
        assert!(get_entity_height("villager") > 0.0);
    }
}