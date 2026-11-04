//! Port of `client/js/game/villager-data.js`: villager type and profession constants.
//!
//! The JavaScript original exports villager type names and profession lists
//! extracted from the pinned native registries and texture metadata.

/// Villager type names (biomes/variants).
pub const VILLAGER_TYPES: &[&str] = &[
    "desert",
    "jungle",
    "plains",
    "savanna",
    "snow",
    "swamp",
    "taiga",
];

/// Villager profession names.
pub const VILLAGER_PROFESSIONS: &[&str] = &[
    "none",
    "armorer",
    "butcher",
    "cartographer",
    "cleric",
    "farmer",
    "fisherman",
    "fletcher",
    "leatherworker",
    "librarian",
    "mason",
    "nitwit",
    "shepherd",
    "toolsmith",
    "weaponsmith",
];

/// Villager hat texture mappings.
/// Keys are texture path patterns, values are hat display mode ("partial" or "full").
pub const VILLAGER_HATS: &[(&'static str, &'static str)] = &[
    ("entity/zombie_villager/profession/butcher.png", "partial"),
    ("entity/zombie_villager/profession/farmer.png", "full"),
    ("entity/zombie_villager/profession/shepherd.png", "full"),
    ("entity/zombie_villager/profession/fletcher.png", "full"),
    ("entity/zombie_villager/profession/librarian.png", "full"),
    ("entity/zombie_villager/profession/fisherman.png", "full"),
    ("entity/villager/profession/butcher.png", "partial"),
    ("entity/villager/profession/farmer.png", "full"),
    ("entity/villager/profession/shepherd.png", "full"),
    ("entity/villager/profession/fletcher.png", "full"),
    ("entity/villager/profession/librarian.png", "full"),
    ("entity/villager/profession/fisherman.png", "full"),
    ("entity/villager/type/desert.png", "full"),
    ("entity/villager/type/snow.png", "full"),
];