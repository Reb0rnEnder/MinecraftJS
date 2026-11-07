//! Port of `client/js/game/player-native.js` (upstream MinecraftJS 1.8.9).
//!
//! Exact 1.8.9 player data and native respawn retention policy.

use serde_json::Value;

/// JS: `export const PLAYER_DATA = { healthIndex:6, poseIndex:null,
/// livingFlagsIndex:null, frozenIndex:null }`.
///
/// 1.8.9 sends health in the entity metadata at index 6 and has no separate
/// pose / living-flag / frozen-tick indexes for players.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PlayerData {
    pub health_index: i64,
    pub pose_index: Option<i64>,
    pub living_flags_index: Option<i64>,
    pub frozen_index: Option<i64>,
}

pub const PLAYER_DATA: PlayerData = PlayerData {
    health_index: 6,
    pose_index: None,
    living_flags_index: None,
    frozen_index: None,
};

/// The JSON shape JS callers see (`PLAYER_DATA` spread into objects).
pub fn player_data_json() -> Value {
    serde_json::json!({
        "healthIndex": PLAYER_DATA.health_index,
        "poseIndex": PLAYER_DATA.pose_index,
        "livingFlagsIndex": PLAYER_DATA.living_flags_index,
        "frozenIndex": PLAYER_DATA.frozen_index,
    })
}

/// JS: `respawnPolicy(packet)` — `{...PLAYER_DATA, copyMetadata:true,
/// keepAttributes:false}`. The 1.8.9 native respawn always copies metadata
/// and never keeps client-side attributes (the server owns them).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RespawnPolicy {
    pub copy_metadata: bool,
    pub keep_attributes: bool,
    pub data: PlayerData,
}

pub fn respawn_policy(_packet: &Value) -> RespawnPolicy {
    RespawnPolicy {
        copy_metadata: true,
        keep_attributes: false,
        data: PLAYER_DATA,
    }
}

/// JS: `clampMaxHealth(value)` — `Math.max(0, Math.min(1024, value))`.
pub fn clamp_max_health(value: f64) -> f64 {
    value.max(0.0).min(1024.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn player_data_is_189_native() {
        assert_eq!(PLAYER_DATA.health_index, 6);
        assert_eq!(PLAYER_DATA.pose_index, None);
        assert_eq!(PLAYER_DATA.living_flags_index, None);
        assert_eq!(PLAYER_DATA.frozen_index, None);
        let p = respawn_policy(&serde_json::json!({}));
        assert!(p.copy_metadata);
        assert!(!p.keep_attributes);
    }

    #[test]
    fn clamp_max_health_bounds() {
        assert_eq!(clamp_max_health(-5.0), 0.0);
        assert_eq!(clamp_max_health(20.0), 20.0);
        assert_eq!(clamp_max_health(5000.0), 1024.0);
    }
}
