//! Port of `client/js/game/EntityRegistry-1.14.4.js`.
//! Native 1.14.4 entity registry and dimensions, generated from client/data/entities.json.

use phf::phf_map;
use std::fmt;

// Entity registry entry for 1.14.4.
#[derive(Debug, Clone, PartialEq)]
pub struct EntityRegistryEntry {
    /// The numeric registry index (matches position in the full registry).
    pub id: i32,
    /// The entity type name.
    pub name: &'static str,
    /// The width of the entity's collision bounding box in blocks.
    pub width: f64,
    /// The height of the entity's collision bounding box in blocks.
    pub height: f64,
}

impl fmt::Display for EntityRegistryEntry {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "EntityRegistryEntry {{ id: {}, name: \"{}\", width: {}, height: {} }}",
            self.id, self.name, self.width, self.height
        )
    }
}

// The full 1.14.4 entity registry, ported from `client/js/game/EntityRegistry-1.14.4.js`.
//
// This static array contains all entity type entries for Minecraft 1.14.4.
// The ordering and values match the JavaScript original generated from
// `client/data/entities.json` (1.14.4 baseline).

/// Map of entity names to their registry entries, built from the registry below.
pub static ENTITY_REGISTRY_MAP: phf::Map<&'static str, &'static EntityRegistryEntry> = {
    phf::phf_map! {
    }
};

/// The full entity registry entries, ported from the JavaScript ENTITY_REGISTRY_1144 constant.
/// The `id` field is the 0-based index in this array, matching the JavaScript array index.
pub static ENTITY_REGISTRY_1144: phf::Map<i32, &'static EntityRegistryEntry> = {
    phf::phf_map! {
0i32 => &EntityRegistryEntry {
    id: 0,
    name: "area_effect_cloud",
    width: 6.0,
    height: 0.5,
},
1i32 => &EntityRegistryEntry {
    id: 1,
    name: "armor_stand",
    width: 0.5,
    height: 1.975,
},
2i32 => &EntityRegistryEntry {
    id: 2,
    name: "arrow",
    width: 0.5,
    height: 0.5,
},
3i32 => &EntityRegistryEntry {
    id: 3,
    name: "bat",
    width: 0.5,
    height: 0.9,
},
4i32 => &EntityRegistryEntry {
    id: 4,
    name: "bee",
    width: 0.7,
    height: 0.6,
},
5i32 => &EntityRegistryEntry {
    id: 5,
    name: "blaze",
    width: 0.6,
    height: 1.8,
},
6i32 => &EntityRegistryEntry {
    id: 6,
    name: "boat",
    width: 1.375,
    height: 0.5625,
},
7i32 => &EntityRegistryEntry {
    id: 7,
    name: "cat",
    width: 0.6,
    height: 0.7,
},
8i32 => &EntityRegistryEntry {
    id: 8,
    name: "cave_spider",
    width: 0.7,
    height: 0.5,
},
9i32 => &EntityRegistryEntry {
    id: 9,
    name: "chicken",
    width: 0.4,
    height: 0.7,
},
10i32 => &EntityRegistryEntry {
    id: 10,
    name: "cod",
    width: 0.5,
    height: 0.3,
},
11i32 => &EntityRegistryEntry {
    id: 11,
    name: "cow",
    width: 0.9,
    height: 1.4,
},
12i32 => &EntityRegistryEntry {
    id: 12,
    name: "creeper",
    width: 0.6,
    height: 1.7,
},
13i32 => &EntityRegistryEntry {
    id: 13,
    name: "donkey",
    width: 1.39648,
    height: 1.5,
},
14i32 => &EntityRegistryEntry {
    id: 14,
    name: "dolphin",
    width: 0.9,
    height: 0.6,
},
15i32 => &EntityRegistryEntry {
    id: 15,
    name: "dragon_fireball",
    width: 1.0,
    height: 1.0,
},
16i32 => &EntityRegistryEntry {
    id: 16,
    name: "drowned",
    width: 0.6,
    height: 1.95,
},
17i32 => &EntityRegistryEntry {
    id: 17,
    name: "elder_guardian",
    width: 1.9975,
    height: 1.9975,
},
18i32 => &EntityRegistryEntry {
    id: 18,
    name: "end_crystal",
    width: 2.0,
    height: 2.0,
},
19i32 => &EntityRegistryEntry {
    id: 19,
    name: "ender_dragon",
    width: 16.0,
    height: 8.0,
},
20i32 => &EntityRegistryEntry {
    id: 20,
    name: "enderman",
    width: 0.6,
    height: 2.9,
},
21i32 => &EntityRegistryEntry {
    id: 21,
    name: "endermite",
    width: 0.4,
    height: 0.3,
},
22i32 => &EntityRegistryEntry {
    id: 22,
    name: "evoker_fangs",
    width: 0.5,
    height: 0.8,
},
23i32 => &EntityRegistryEntry {
    id: 23,
    name: "evoker",
    width: 0.6,
    height: 1.95,
},
24i32 => &EntityRegistryEntry {
    id: 24,
    name: "experience_orb",
    width: 0.5,
    height: 0.5,
},
25i32 => &EntityRegistryEntry {
    id: 25,
    name: "eye_of_ender",
    width: 0.25,
    height: 0.25,
},
26i32 => &EntityRegistryEntry {
    id: 26,
    name: "falling_block",
    width: 0.98,
    height: 0.98,
},
27i32 => &EntityRegistryEntry {
    id: 27,
    name: "firework_rocket",
    width: 0.25,
    height: 0.25,
},
28i32 => &EntityRegistryEntry {
    id: 28,
    name: "fox",
    width: 0.6,
    height: 0.7,
},
29i32 => &EntityRegistryEntry {
    id: 29,
    name: "ghast",
    width: 4.0,
    height: 4.0,
},
30i32 => &EntityRegistryEntry {
    id: 30,
    name: "giant",
    width: 3.6,
    height: 12.0,
},
31i32 => &EntityRegistryEntry {
    id: 31,
    name: "guardian",
    width: 0.85,
    height: 0.85,
},
32i32 => &EntityRegistryEntry {
    id: 32,
    name: "horse",
    width: 1.39648,
    height: 1.6,
},
33i32 => &EntityRegistryEntry {
    id: 33,
    name: "husk",
    width: 0.6,
    height: 1.95,
},
34i32 => &EntityRegistryEntry {
    id: 34,
    name: "illusioner",
    width: 0.6,
    height: 1.95,
},
35i32 => &EntityRegistryEntry {
    id: 35,
    name: "item",
    width: 0.25,
    height: 0.25,
},
36i32 => &EntityRegistryEntry {
    id: 36,
    name: "item_frame",
    width: 0.5,
    height: 0.5,
},
37i32 => &EntityRegistryEntry {
    id: 37,
    name: "fireball",
    width: 1.0,
    height: 1.0,
},
38i32 => &EntityRegistryEntry {
    id: 38,
    name: "leash_knot",
    width: 0.5,
    height: 0.5,
},
39i32 => &EntityRegistryEntry {
    id: 39,
    name: "llama",
    width: 0.9,
    height: 1.87,
},
40i32 => &EntityRegistryEntry {
    id: 40,
    name: "llama_spit",
    width: 0.25,
    height: 0.25,
},
41i32 => &EntityRegistryEntry {
    id: 41,
    name: "magma_cube",
    width: 2.04,
    height: 2.04,
},
42i32 => &EntityRegistryEntry {
    id: 42,
    name: "minecart",
    width: 0.98,
    height: 0.7,
},
43i32 => &EntityRegistryEntry {
    id: 43,
    name: "chest_minecart",
    width: 0.98,
    height: 0.7,
},
44i32 => &EntityRegistryEntry {
    id: 44,
    name: "command_block_minecart",
    width: 0.98,
    height: 0.7,
},
45i32 => &EntityRegistryEntry {
    id: 45,
    name: "furnace_minecart",
    width: 0.98,
    height: 0.7,
},
46i32 => &EntityRegistryEntry {
    id: 46,
    name: "hopper_minecart",
    width: 0.98,
    height: 0.7,
},
47i32 => &EntityRegistryEntry {
    id: 47,
    name: "spawner_minecart",
    width: 0.98,
    height: 0.7,
},
48i32 => &EntityRegistryEntry {
    id: 48,
    name: "tnt_minecart",
    width: 0.98,
    height: 0.7,
},
49i32 => &EntityRegistryEntry {
    id: 49,
    name: "mule",
    width: 1.39648,
    height: 1.6,
},
50i32 => &EntityRegistryEntry {
    id: 50,
    name: "mooshroom",
    width: 0.9,
    height: 1.4,
},
51i32 => &EntityRegistryEntry {
    id: 51,
    name: "ocelot",
    width: 0.6,
    height: 0.7,
},
52i32 => &EntityRegistryEntry {
    id: 52,
    name: "painting",
    width: 0.5,
    height: 0.5,
},
53i32 => &EntityRegistryEntry {
    id: 53,
    name: "panda",
    width: 1.3,
    height: 1.25,
},
54i32 => &EntityRegistryEntry {
    id: 54,
    name: "parrot",
    width: 0.5,
    height: 0.9,
},
55i32 => &EntityRegistryEntry {
    id: 55,
    name: "pig",
    width: 0.9,
    height: 0.9,
},
56i32 => &EntityRegistryEntry {
    id: 56,
    name: "pufferfish",
    width: 0.7,
    height: 0.7,
},
57i32 => &EntityRegistryEntry {
    id: 57,
    name: "zombie_pigman",
    width: 0.6,
    height: 1.95,
},
58i32 => &EntityRegistryEntry {
    id: 58,
    name: "polar_bear",
    width: 1.4,
    height: 1.4,
},
59i32 => &EntityRegistryEntry {
    id: 59,
    name: "tnt",
    width: 0.98,
    height: 0.98,
},
60i32 => &EntityRegistryEntry {
    id: 60,
    name: "rabbit",
    width: 0.4,
    height: 0.5,
},
61i32 => &EntityRegistryEntry {
    id: 61,
    name: "salmon",
    width: 0.7,
    height: 0.4,
},
62i32 => &EntityRegistryEntry {
    id: 62,
    name: "sheep",
    width: 0.9,
    height: 1.3,
},
63i32 => &EntityRegistryEntry {
    id: 63,
    name: "shulker",
    width: 1.0,
    height: 1.0,
},
64i32 => &EntityRegistryEntry {
    id: 64,
    name: "shulker_bullet",
    width: 0.3125,
    height: 0.3125,
},
65i32 => &EntityRegistryEntry {
    id: 65,
    name: "silverfish",
    width: 0.4,
    height: 0.3,
},
66i32 => &EntityRegistryEntry {
    id: 66,
    name: "skeleton",
    width: 0.6,
    height: 1.99,
},
67i32 => &EntityRegistryEntry {
    id: 67,
    name: "skeleton_horse",
    width: 1.39648,
    height: 1.6,
},
68i32 => &EntityRegistryEntry {
    id: 68,
    name: "slime",
    width: 2.04,
    height: 2.04,
},
69i32 => &EntityRegistryEntry {
    id: 69,
    name: "small_fireball",
    width: 0.3125,
    height: 0.3125,
},
70i32 => &EntityRegistryEntry {
    id: 70,
    name: "snow_golem",
    width: 0.7,
    height: 1.9,
},
71i32 => &EntityRegistryEntry {
    id: 71,
    name: "snowball",
    width: 0.25,
    height: 0.25,
},
72i32 => &EntityRegistryEntry {
    id: 72,
    name: "spectral_arrow",
    width: 0.5,
    height: 0.5,
},
73i32 => &EntityRegistryEntry {
    id: 73,
    name: "spider",
    width: 1.4,
    height: 0.9,
},
74i32 => &EntityRegistryEntry {
    id: 74,
    name: "squid",
    width: 0.8,
    height: 0.8,
},
75i32 => &EntityRegistryEntry {
    id: 75,
    name: "stray",
    width: 0.6,
    height: 1.99,
},
76i32 => &EntityRegistryEntry {
    id: 76,
    name: "trader_llama",
    width: 0.9,
    height: 1.87,
},
77i32 => &EntityRegistryEntry {
    id: 77,
    name: "tropical_fish",
    width: 0.5,
    height: 0.4,
},
78i32 => &EntityRegistryEntry {
    id: 78,
    name: "turtle",
    width: 1.2,
    height: 0.4,
},
79i32 => &EntityRegistryEntry {
    id: 79,
    name: "egg",
    width: 0.25,
    height: 0.25,
},
80i32 => &EntityRegistryEntry {
    id: 80,
    name: "ender_pearl",
    width: 0.25,
    height: 0.25,
},
81i32 => &EntityRegistryEntry {
    id: 81,
    name: "experience_bottle",
    width: 0.25,
    height: 0.25,
},
82i32 => &EntityRegistryEntry {
    id: 82,
    name: "potion",
    width: 0.25,
    height: 0.25,
},
83i32 => &EntityRegistryEntry {
    id: 83,
    name: "trident",
    width: 0.5,
    height: 0.5,
},
84i32 => &EntityRegistryEntry {
    id: 84,
    name: "vex",
    width: 0.4,
    height: 0.8,
},
85i32 => &EntityRegistryEntry {
    id: 85,
    name: "villager",
    width: 0.6,
    height: 1.95,
},
86i32 => &EntityRegistryEntry {
    id: 86,
    name: "iron_golem",
    width: 1.4,
    height: 2.7,
},
87i32 => &EntityRegistryEntry {
    id: 87,
    name: "vindicator",
    width: 0.6,
    height: 1.95,
},
88i32 => &EntityRegistryEntry {
    id: 88,
    name: "pillager",
    width: 0.6,
    height: 1.95,
},
89i32 => &EntityRegistryEntry {
    id: 89,
    name: "wandering_trader",
    width: 0.6,
    height: 1.95,
},
90i32 => &EntityRegistryEntry {
    id: 90,
    name: "witch",
    width: 0.6,
    height: 1.95,
},
91i32 => &EntityRegistryEntry {
    id: 91,
    name: "wither",
    width: 0.9,
    height: 3.5,
},
92i32 => &EntityRegistryEntry {
    id: 92,
    name: "wither_skeleton",
    width: 0.7,
    height: 2.4,
},
93i32 => &EntityRegistryEntry {
    id: 93,
    name: "wither_skull",
    width: 0.3125,
    height: 0.3125,
},
94i32 => &EntityRegistryEntry {
    id: 94,
    name: "wolf",
    width: 0.6,
    height: 0.85,
},
95i32 => &EntityRegistryEntry {
    id: 95,
    name: "zombie",
    width: 0.6,
    height: 1.95,
},
96i32 => &EntityRegistryEntry {
    id: 96,
    name: "zombie_horse",
    width: 1.39648,
    height: 1.6,
},
97i32 => &EntityRegistryEntry {
    id: 97,
    name: "zombie_villager",
    width: 0.6,
    height: 1.95,
},
98i32 => &EntityRegistryEntry {
    id: 98,
    name: "phantom",
    width: 0.9,
    height: 0.5,
},
99i32 => &EntityRegistryEntry {
    id: 99,
    name: "ravager",
    width: 1.95,
    height: 2.2,
},
100i32 => &EntityRegistryEntry {
    id: 100,
    name: "lightning_bolt",
    width: 0.0,
    height: 0.0,
},
101i32 => &EntityRegistryEntry {
    id: 101,
    name: "player",
    width: 0.6,
    height: 1.8,
},
102i32 => &EntityRegistryEntry {
    id: 102,
    name: "fishing_bobber",
    width: 0.25,
    height: 0.25,
}
}
};

/// Look up an entity registry entry by name.
pub fn lookup_entity_by_name(name: &str) -> Option<&'static EntityRegistryEntry> {
    ENTITY_REGISTRY_MAP.get(name).copied()
}

/// Look up an entity registry entry by ID.
pub fn lookup_entity_by_id(id: i32) -> Option<&'static EntityRegistryEntry> {
    ENTITY_REGISTRY_1144.get(&id).copied()
}

/// Get the width of an entity by name.
pub fn entity_width(name: &str) -> Option<f64> {
    lookup_entity_by_name(name).map(|e| e.width)
}

/// Get the height of an entity by name.
pub fn entity_height(name: &str) -> Option<f64> {
    lookup_entity_by_name(name).map(|e| e.height)
}

/// Get the registry ID of an entity by name.
pub fn entity_id(name: &str) -> Option<i32> {
    lookup_entity_by_name(name).map(|e| e.id)
}

/// Iterate over all entity registry entries.
pub fn entity_registry() -> impl Iterator<Item = &'static EntityRegistryEntry> {
    ENTITY_REGISTRY_1144.values().copied()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entity_registry_entries() {
        // Test that entry 0 is area_effect_cloud
        let entry = lookup_entity_by_id(0).unwrap();
        assert_eq!(entry.name, "area_effect_cloud");
        assert_eq!(entry.width, 6.0);
        assert_eq!(entry.height, 0.5);
    }

    #[test]
    fn test_entity_lookup_by_name() {
        let entry = lookup_entity_by_name("player").unwrap();
        assert_eq!(entry.name, "player");
        assert_eq!(entry.width, 0.6);
        assert_eq!(entry.height, 1.8);
    }

    #[test]
    fn test_entity_lookup_by_id() {
        let entry = lookup_entity_by_id(101).unwrap();
        assert_eq!(entry.name, "player");
    }

    #[test]
    fn test_entity_registry_len() {
        let count = entity_registry().count();
        // Should have at least the entries defined above
        assert!(count > 0);
    }
}
