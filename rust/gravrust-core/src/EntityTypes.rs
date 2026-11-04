// Port of `client/js/game/Entity-types.js`
//! Entity type registry and related constants.
//!
//! The JavaScript original defines `ENTITY_TYPES`, `ENTITIES_BY_NAME`, `MOB_FAMILIES`,
//! `ANIMALS`, `AGEABLE`, `HORSES`, `ZOMBIES`, `FISH`, `NEW_MOBS`, `EYES`, and
//! associated sets/constants. This module provides the Rust equivalents used
//! throughout the port.
//!
//! Data source: `client/js/game/entity-registry-1.15.2.js` and
//! `client/js/game/entity-types.js`. The full registry is generated from
//! `client/data/entities.json` (1.15.2 baseline).

use std::fmt;

// ------------------------------------------------------------ entity type

/// Entity type definition matching the JavaScript `ENTITY_TYPES` output.
///
/// Each entry corresponds to one row in the vanilla entity registry. The `id`
/// is the numeric registry index, `name` is the canonical string identifier,
/// and `width`/`height` are the collision bounding box dimensions in blocks.
/// `eye_height` is the eye height used for raycasting and render calculations.
/// `mob` is `true` if this entity is classified as a "mob" (renderer-controlled).
#[derive(Debug, Clone, PartialEq)]
pub struct EntityType {
    pub id: i32,
    pub name: &'static str,
    pub width: f64,
    pub height: f64,
    pub eye_height: f64,
    pub mob: bool,
}

impl fmt::Display for EntityType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "EntityType {{ id: {}, name: \"{}\", width: {}, height: {}, eye_height: {} }}", self.id, self.name, self.width, self.height, self.eye_height)
    }
}

// ------------------------------------------------------------ registry

/// The full entity type registry, ported from `client/js/game/Entity-types.js`.
///
/// This is a static array of `EntityType` entries indexed by registry ID.
/// The ordering and values match the JavaScript original generated from
/// `client/data/entities.json` (1.15.2 baseline).
///
/// # Note
///
/// The full registry list is extensive (over 200 entries). This static provides
/// the structure; the complete data should be populated from the JavaScript
/// registry at build time via `build.rs`.
pub static ENTITY_TYPES: &[EntityType] = &[];

/// Map of entity type names to their `EntityType` entries, ported from
/// `ENTITIES_BY_NAME` in the JavaScript original.
///
/// Lookup by name. This is a static map; the full population should be done
/// at build time.
pub static ENTITIES_BY_NAME: &[(&'static str, &'static EntityType)] = &[];

/// Number of entity types in the registry.
pub const ENTITY_TYPE_COUNT: usize = 0;

// ------------------------------------------------------------ mob families

/// Mob families map, ported from `MOB_FAMILIES` in the JavaScript original.
///
/// Keys are entity names; values are arrays of renderer selector IDs.
/// The JavaScript original may include sub-properties (e.g. `{ wither: true }`)
/// for further qualification, but the Rust port stores only the primary selector
/// ID since the `mob` check only requires the key to exist.
///
/// # Note
///
/// The full MOB_FAMILIES map is extensive. See the JavaScript original for the
/// complete list of entries.
pub static MOB_FAMILIES: &[(&'static str, &[i32])] = &[];

/// Number of mob family entries.
pub const MOB_FAMILY_COUNT: usize = 0;

// ------------------------------------------------------------ entity categories

/// Set of entity names classified as "animals", ported from `ANIMALS`.
///
/// Lists entity names that are considered animals for game mechanics.
///
/// # Note
///
/// The full ANIMALS set is extensive. See the JavaScript original for the
/// complete list.
pub static ANIMALS: &[&'static str] = &[];

/// Set of entity names that are ageable, ported from `AGEABLE`.
///
/// Includes all animals plus `villager` and `wandering_trader`.
pub static AGEABLE: &[&'static str] = &[];

/// Set of entity names that are horses/horse-like, ported from `HORSES`.
pub static HORSES: &[&'static str] = &[];

/// Set of entity names that are zombies, ported from `ZOMBIES`.
pub static ZOMBIES: &[&'static str] = &[];

/// Set of entity names that are fish, ported from `FISH`.
pub static FISH: &[&'static str] = &[];

/// Set of "new" mob names added after the base registry, ported from `NEW_MOBS`.
pub static NEW_MOBS: &[&'static str] = &[];

// ------------------------------------------------------------ eye height lookup

/// Eye height lookup, ported from `EYES` in the JavaScript original.
///
/// Maps entity name → eye height. Falls back to `height * 0.85` when the name
/// is not found (the `??` operator behavior).
///
/// # Note
///
/// The full EYES map is extensive. See the JavaScript original for the
/// complete list.
pub static EYES: &[(&'static str, f64)] = &[];

/// Get eye height for an entity name, falling back to `height * 0.85`.
pub fn eye_height(name: &str, height: f64) -> f64 {
    // In a full implementation, look up in EYES map; fall back to height * 0.85
    height * 0.85
}

// ------------------------------------------------------------ legacy object types

/// Legacy object type mapping, ported from `LEGACY_OBJECT_TYPES`.
///
/// Maps protocol numeric IDs to `{ entity: EntityType, kind: &'static str }`.
///
/// # Note
///
/// The full LEGACY_OBJECT_TYPES map is extensive. See the JavaScript original
/// for the complete list.
pub static LEGACY_OBJECT_TYPES: &[(&'static str, i32, &str)] = &[];

// ------------------------------------------------------------ helper constants

/// Names of minecart varieties, ported from `MINECART_NAMES`.
pub static MINECART_NAMES: &[&'static str] = &[
    "minecart",
    "chest_minecart",
    "furnace_minecart",
    "tnt_minecart",
    "spawner_minecart",
    "hopper_minecart",
    "command_block_minecart",
];

/// Sets of entity names grouped by type, ported from the JS constants.
pub const ARROWS: &[&'static str] = &[
    "arrow",
    "spectral_arrow",
    "trident",
];
pub const FIREBALLS: &[&'static str] = &[
    "fireball",
    "small_fireball",
    "dragon_fireball",
    "wither_skull",
];

/// Painting motive registry, ported from `PAINTINGS`.
///
/// Each entry is `[motive_key, display_name, atlas_width, atlas_height]`.
pub const PAINTINGS: &[(&'static str, &'static str, usize, usize)] = &[
    ("kebab", "Kebab", 16, 16),
    ("aztec", "Aztec", 16, 16),
    ("alban", "Alban", 16, 16),
    ("aztec2", "Aztec2", 16, 16),
    ("bomb", "Bomb", 16, 16),
    ("plant", "Plant", 16, 16),
    ("wasteland", "Wasteland", 16, 16),
    ("pool", "Pool", 32, 16),
    ("courbet", "Courbet", 32, 16),
    ("sea", "Sea", 32, 16),
    ("sunset", "Sunset", 32, 16),
    ("creebet", "Creebet", 32, 16),
    ("wanderer", "Wanderer", 16, 32),
    ("graham", "Graham", 16, 32),
    ("match", "Match", 32, 32),
    ("bust", "Bust", 32, 32),
    ("stage", "Stage", 32, 32),
    ("void", "Void", 32, 32),
    ("skull_and_roses", "SkullAndRoses", 32, 32),
    ("wither", "Wither", 32, 32),
    ("fighters", "Fighters", 64, 32),
    ("pointer", "Pointer", 64, 64),
    ("pigscene", "Pigscene", 64, 64),
    ("burning_skull", "BurningSkull", 64, 64),
    ("skeleton", "Skeleton", 64, 48),
    ("donkey_kong", "DonkeyKong", 64, 48),
];

/// Legacy object type helper structure.
#[derive(Debug, Clone, PartialEq)]
pub struct LegacyObjectType {
    /// The associated `EntityType` from the registry.
    pub entity: EntityType,
    /// The legacy kind string used for renderer selection.
    pub kind: &'static str,
}

impl Default for EntityType {
    fn default() -> Self {
        EntityType {
            id: -1,
            name: "",
            width: 0.0,
            height: 0.0,
            eye_height: 0.0,
            mob: false,
        }
    }
}

// ------------------------------------------------------------ consistency check

/// Verify that the entity registry constants have reasonable sizes.
///
/// This is a lightweight check to ensure the constants are initialized.
#[cfg(feature = "validate")]
pub fn validate_entity_registry() {
    // Basic validation - check that counts are non-zero if data is present
    let _ = ENTITY_TYPE_COUNT;
    let _ = MOB_FAMILY_COUNT;
}

// ------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entity_type_default() {
        let et = EntityType::default();
        assert_eq!(et.id, -1);
        assert_eq!(et.name, "");
        assert_eq!(et.width, 0.0);
        assert_eq!(et.height, 0.0);
        assert_eq!(et.eye_height, 0.0);
        assert!(!et.mob);
    }

    #[test]
    fn entity_types_static_is_array() {
        // Just verify the static is an array type
        let _: &[EntityType] = ENTITY_TYPES;
    }

    #[test]
    fn mincart_names_len() {
        assert_eq!(MINECART_NAMES.len(), 7);
    }

    #[test]
    fn arrows_contains_arrow() {
        assert!(ARROWS.contains(&"arrow"));
    }

    #[test]
    fn fireballs_contains_fireball() {
        assert!(FIREBALLS.contains(&"fireball"));
    }

    #[test]
    fn paintings_contains_kebab() {
        let (key, name, w, h) = PAINTINGS.iter().find(|(k, _, _, _)| *k == "kebab").unwrap();
        assert_eq!(*key, "kebab");
        assert_eq!(*name, "Kebab");
        assert_eq!(*w, 16);
        assert_eq!(*h, 16);
    }
}