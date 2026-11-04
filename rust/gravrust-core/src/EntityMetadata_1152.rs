// Port of `client/js/game/Entity-metadata-1.15.2.js`
//! Entity metadata indices for Minecraft 1.15.2, extracted from the pinned native jar and official mappings.

/// Native entity metadata mappings for version 1.15.2.
/// Maps entity type names to their metadata field names and IDs.
pub const NATIVE_METADATA: &[(&str, &[(&str, i32)])] = &[
    (
        "player",
        &[
            ("DATA_PLAYER_ABSORPTION_ID", 14),
            ("DATA_SCORE_ID", 15),
            ("DATA_PLAYER_MODE_CUSTOMISATION", 16),
            ("DATA_PLAYER_MAIN_HAND", 17),
            ("DATA_SHOULDER_LEFT", 18),
            ("DATA_SHOULDER_RIGHT", 19),
            ("DATA_LIVING_ENTITY_FLAGS", 7),
            ("DATA_HEALTH_ID", 8),
            ("DATA_EFFECT_COLOR_ID", 9),
            ("DATA_EFFECT_AMBIENCE_ID", 10),
            ("DATA_ARROW_COUNT_ID", 11),
            ("DATA_STINGER_COUNT_ID", 12),
            ("SLEEPING_POS_ID", 13),
            ("DATA_SHARED_FLAGS_ID", 0),
            ("DATA_AIR_SUPPLY_ID", 1),
            ("DATA_CUSTOM_NAME", 2),
            ("DATA_CUSTOM_NAME_VISIBLE", 3),
            ("DATA_SILENT", 4),
            ("DATA_NO_GRAVITY", 5),
            ("DATA_POSE", 6),
        ],
    ),
    (
        "cat",
        &[
            ("DATA_TYPE_ID", 18),
            ("IS_LYING", 19),
            ("RELAX_STATE_ONE", 20),
            ("DATA_COLLAR_COLOR", 21),
            ("DATA_FLAGS_ID", 16),
            ("DATA_OWNERUUID_ID", 17),
            ("DATA_BABY_ID", 15),
            ("DATA_MOB_FLAGS_ID", 14),
            ("DATA_LIVING_ENTITY_FLAGS", 7),
            ("DATA_HEALTH_ID", 8),
            ("DATA_EFFECT_COLOR_ID", 9),
            ("DATA_EFFECT_AMBIENCE_ID", 10),
            ("DATA_ARROW_COUNT_ID", 11),
            ("DATA_STINGER_COUNT_ID", 12),
            ("SLEEPING_POS_ID", 13),
            ("DATA_SHARED_FLAGS_ID", 0),
            ("DATA_AIR_SUPPLY_ID", 1),
            ("DATA_CUSTOM_NAME", 2),
            ("DATA_CUSTOM_NAME_VISIBLE", 3),
            ("DATA_SILENT", 4),
            ("DATA_NO_GRAVITY", 5),
            ("DATA_POSE", 6),
        ],
    ),
    (
        "fox",
        &[
            ("DATA_TYPE_ID", 16),
            ("DATA_FLAGS_ID", 17),
            ("DATA_TRUSTED_ID_0", 18),
            ("DATA_TRUSTED_ID_1", 19),
            ("DATA_BABY_ID", 15),
            ("DATA_MOB_FLAGS_ID", 14),
            ("DATA_LIVING_ENTITY_FLAGS", 7),
            ("DATA_HEALTH_ID", 8),
            ("DATA_EFFECT_COLOR_ID", 9),
            ("DATA_EFFECT_AMBIENCE_ID", 10),
            ("DATA_ARROW_COUNT_ID", 11),
            ("DATA_STINGER_COUNT_ID", 12),
            ("SLEEPING_POS_ID", 13),
            ("DATA_SHARED_FLAGS_ID", 0),
            ("DATA_AIR_SUPPLY_ID", 1),
            ("DATA_CUSTOM_NAME", 2),
            ("DATA_CUSTOM_NAME_VISIBLE", 3),
            ("DATA_SILENT", 4),
            ("DATA_NO_GRAVITY", 5),
            ("DATA_POSE", 6),
        ],
    ),
    (
        "panda",
        &[
            ("UNHAPPY_COUNTER", 16),
            ("SNEEZE_COUNTER", 17),
            ("EAT_COUNTER", 18),
            ("MAIN_GENE_ID", 19),
            ("HIDDEN_GENE_ID", 20),
            ("DATA_ID_FLAGS", 21),
            ("DATA_BABY_ID", 15),
            ("DATA_MOB_FLAGS_ID", 14),
            ("DATA_LIVING_ENTITY_FLAGS", 7),
            ("DATA_HEALTH_ID", 8),
            ("DATA_EFFECT_COLOR_ID", 9),
            ("DATA_EFFECT_AMBIENCE_ID", 10),
            ("DATA_ARROW_COUNT_ID", 11),
            ("DATA_STINGER_COUNT_ID", 12),
            ("SLEEPING_POS_ID", 13),
            ("DATA_SHARED_FLAGS_ID", 0),
            ("DATA_AIR_SUPPLY_ID", 1),
            ("DATA_CUSTOM_NAME", 2),
            ("DATA_CUSTOM_NAME_VISIBLE", 3),
            ("DATA_SILENT", 4),
            ("DATA_NO_GRAVITY", 5),
            ("DATA_POSE", 6),
        ],
    ),
    (
        "villager",
        &[
            ("DATA_VILLAGER_DATA", 17),
            ("DATA_UNHAPPY_COUNTER", 15),
            ("DATA_BABY_ID", 14),
            ("DATA_MOB_FLAGS_ID", 13),
            ("DATA_LIVING_ENTITY_FLAGS", 7),
            ("DATA_HEALTH_ID", 8),
            ("DATA_EFFECT_COLOR_ID", 9),
            ("DATA_EFFECT_AMBIENCE_ID", 10),
            ("DATA_ARROW_COUNT_ID", 11),
            ("SLEEPING_POS_ID", 12),
            ("DATA_SHARED_FLAGS_ID", 0),
            ("DATA_AIR_SUPPLY_ID", 1),
            ("DATA_CUSTOM_NAME", 2),
            ("DATA_CUSTOM_NAME_VISIBLE", 3),
            ("DATA_SILENT", 4),
            ("DATA_NO_GRAVITY", 5),
            ("DATA_POSE", 6),
        ],
    ),
    (
        "zombie_villager",
        &[
            ("DATA_CONVERTING_ID", 18),
            ("DATA_VILLAGER_DATA", 19),
            ("DATA_BABY_ID", 15),
            ("DATA_SPECIAL_TYPE_ID", 16),
            ("DATA_DROWNED_CONVERSION_ID", 17),
            ("DATA_MOB_FLAGS_ID", 14),
            ("DATA_LIVING_ENTITY_FLAGS", 7),
            ("DATA_HEALTH_ID", 8),
            ("DATA_EFFECT_COLOR_ID", 9),
            ("DATA_EFFECT_AMBIENCE_ID", 10),
            ("DATA_ARROW_COUNT_ID", 11),
            ("DATA_STINGER_COUNT_ID", 12),
            ("SLEEPING_POS_ID", 13),
            ("DATA_SHARED_FLAGS_ID", 0),
            ("DATA_AIR_SUPPLY_ID", 1),
            ("DATA_CUSTOM_NAME", 2),
            ("DATA_CUSTOM_NAME_VISIBLE", 3),
            ("DATA_SILENT", 4),
            ("DATA_NO_GRAVITY", 5),
            ("DATA_POSE", 6),
        ],
    ),
    (
        "bee",
        &[
            ("DATA_FLAGS_ID", 16),
            ("ANGER_TIME", 17),
            ("DATA_BABY_ID", 15),
            ("DATA_MOB_FLAGS_ID", 14),
            ("DATA_LIVING_ENTITY_FLAGS", 7),
            ("DATA_HEALTH_ID", 8),
            ("DATA_EFFECT_COLOR_ID", 9),
            ("DATA_EFFECT_AMBIENCE_ID", 10),
            ("DATA_ARROW_COUNT_ID", 11),
            ("DATA_STINGER_COUNT_ID", 12),
            ("SLEEPING_POS_ID", 13),
            ("DATA_SHARED_FLAGS_ID", 0),
            ("DATA_AIR_SUPPLY_ID", 1),
            ("DATA_CUSTOM_NAME", 2),
            ("DATA_CUSTOM_NAME_VISIBLE", 3),
            ("DATA_SILENT", 4),
            ("DATA_NO_GRAVITY", 5),
            ("DATA_POSE", 6),
        ],
    ),
];

/// Look up the metadata ID for a given entity type and field name.
/// Returns `None` if the entity type or field is not found.
pub fn get_metadata_id(entity_type: &str, field: &str) -> Option<i32> {
    let entity_data = NATIVE_METADATA
        .iter()
        .find(|(name, _)| *name == entity_type)
        .map(|(_, fields)| fields);

    entity_data.and_then(|fields| {
        fields
            .iter()
            .find(|(name, _)| *name == field)
            .map(|(_, id)| *id)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_player_metadata_ids() {
        assert_eq!(get_metadata_id("player", "DATA_HEALTH_ID"), Some(8));
        assert_eq!(get_metadata_id("player", "DATA_SILENT"), Some(4));
        assert_eq!(get_metadata_id("player", "NONEXISTENT"), None);
        // 1.15.2 specific
        assert_eq!(get_metadata_id("player", "DATA_PLAYER_ABSORPTION_ID"), Some(14));
        assert_eq!(get_metadata_id("player", "DATA_SCORE_ID"), Some(15));
        assert_eq!(get_metadata_id("player", "DATA_STINGER_COUNT_ID"), Some(12));
    }

    #[test]
    fn test_cat_metadata_ids() {
        assert_eq!(get_metadata_id("cat", "DATA_TYPE_ID"), Some(18));
        assert_eq!(get_metadata_id("cat", "IS_LYING"), Some(19));
        assert_eq!(get_metadata_id("cat", "NONEXISTENT"), None);
        // 1.15.2 specific
        assert_eq!(get_metadata_id("cat", "DATA_COLLAR_COLOR"), Some(21));
        assert_eq!(get_metadata_id("cat", "DATA_FLAGS_ID"), Some(16));
    }

    #[test]
    fn test_fox_metadata_ids() {
        assert_eq!(get_metadata_id("fox", "DATA_TYPE_ID"), Some(16));
        assert_eq!(get_metadata_id("fox", "DATA_FLAGS_ID"), Some(17));
        assert_eq!(get_metadata_id("fox", "DATA_TRUSTED_ID_0"), Some(18));
        assert_eq!(get_metadata_id("fox", "DATA_TRUSTED_ID_1"), Some(19));
        assert_eq!(get_metadata_id("fox", "NONEXISTENT"), None);
    }

    #[test]
    fn test_panda_metadata_ids() {
        assert_eq!(get_metadata_id("panda", "UNHAPPY_COUNTER"), Some(16));
        assert_eq!(get_metadata_id("panda", "SNEEZE_COUNTER"), Some(17));
        assert_eq!(get_metadata_id("panda", "EAT_COUNTER"), Some(18));
        assert_eq!(get_metadata_id("panda", "MAIN_GENE_ID"), Some(19));
        assert_eq!(get_metadata_id("panda", "HIDDEN_GENE_ID"), Some(20));
        assert_eq!(get_metadata_id("panda", "DATA_ID_FLAGS"), Some(21));
        assert_eq!(get_metadata_id("panda", "NONEXISTENT"), None);
    }

    #[test]
    fn test_villager_metadata_ids() {
        assert_eq!(get_metadata_id("villager", "DATA_VILLAGER_DATA"), Some(17));
        assert_eq!(get_metadata_id("villager", "DATA_UNHAPPY_COUNTER"), Some(15));
        assert_eq!(get_metadata_id("villager", "DATA_BABY_ID"), Some(14));
        assert_eq!(get_metadata_id("villager", "NONEXISTENT"), None);
    }

    #[test]
    fn test_zombie_villager_metadata_ids() {
        assert_eq!(get_metadata_id("zombie_villager", "DATA_CONVERTING_ID"), Some(18));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_VILLAGER_DATA"), Some(19));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_BABY_ID"), Some(15));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_SPECIAL_TYPE_ID"), Some(16));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_DROWNED_CONVERSION_ID"), Some(17));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_MOB_FLAGS_ID"), Some(14));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_LIVING_ENTITY_FLAGS"), Some(7));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_HEALTH_ID"), Some(8));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_EFFECT_COLOR_ID"), Some(9));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_EFFECT_AMBIENCE_ID"), Some(10));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_ARROW_COUNT_ID"), Some(11));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_STINGER_COUNT_ID"), Some(12));
        assert_eq!(get_metadata_id("zombie_villager", "SLEEPING_POS_ID"), Some(13));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_SHARED_FLAGS_ID"), Some(0));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_AIR_SUPPLY_ID"), Some(1));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_CUSTOM_NAME"), Some(2));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_CUSTOM_NAME_VISIBLE"), Some(3));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_SILENT"), Some(4));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_NO_GRAVITY"), Some(5));
        assert_eq!(get_metadata_id("zombie_villager", "DATA_POSE"), Some(6));
        assert_eq!(get_metadata_id("zombie_villager", "NONEXISTENT"), None);
    }

    #[test]
    fn test_bee_metadata_ids() {
        assert_eq!(get_metadata_id("bee", "DATA_FLAGS_ID"), Some(16));
        assert_eq!(get_metadata_id("bee", "ANGER_TIME"), Some(17));
        assert_eq!(get_metadata_id("bee", "DATA_BABY_ID"), Some(15));
        assert_eq!(get_metadata_id("bee", "DATA_MOB_FLAGS_ID"), Some(14));
        assert_eq!(get_metadata_id("bee", "DATA_LIVING_ENTITY_FLAGS"), Some(7));
        assert_eq!(get_metadata_id("bee", "DATA_HEALTH_ID"), Some(8));
        assert_eq!(get_metadata_id("bee", "DATA_EFFECT_COLOR_ID"), Some(9));
        assert_eq!(get_metadata_id("bee", "DATA_EFFECT_AMBIENCE_ID"), Some(10));
        assert_eq!(get_metadata_id("bee", "DATA_ARROW_COUNT_ID"), Some(11));
        assert_eq!(get_metadata_id("bee", "DATA_STINGER_COUNT_ID"), Some(12));
        assert_eq!(get_metadata_id("bee", "SLEEPING_POS_ID"), Some(13));
        assert_eq!(get_metadata_id("bee", "DATA_SHARED_FLAGS_ID"), Some(0));
        assert_eq!(get_metadata_id("bee", "DATA_AIR_SUPPLY_ID"), Some(1));
        assert_eq!(get_metadata_id("bee", "DATA_CUSTOM_NAME"), Some(2));
        assert_eq!(get_metadata_id("bee", "DATA_CUSTOM_NAME_VISIBLE"), Some(3));
        assert_eq!(get_metadata_id("bee", "DATA_SILENT"), Some(4));
        assert_eq!(get_metadata_id("bee", "DATA_NO_GRAVITY"), Some(5));
        assert_eq!(get_metadata_id("bee", "DATA_POSE"), Some(6));
        assert_eq!(get_metadata_id("bee", "NONEXISTENT"), None);
    }

    #[test]
    fn test_all_entity_types_have_data() {
        for &(entity_type, _) in NATIVE_METADATA {
            assert!(!entity_type.is_empty());
            let fields = &_.1;
            for (field_name, _) in fields {
                assert!(!field_name.is_empty());
            }
        }
    }
}