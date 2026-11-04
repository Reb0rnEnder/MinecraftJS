//! Port of `client/js/game/entity-pushing.js`
//! (`EntitySelector.pushableBy` / `LivingEntity.doPush` / `Entity.push`).
//!
//! The JavaScript still owns the entity iteration, spectator/gamemode filters
//! and team lookups; the two pure decisions live here: whether two collision
//! rules allow a push, and the velocity delta applied to the local player.

use wasm_bindgen::prelude::*;

fn rule(value: Option<&str>) -> &str {
    match value {
        Some(value) if !value.is_empty() => value,
        _ => "always",
    }
}

/// `teamsCanPush(a, b)`: `same` is the JavaScript identity comparison.
#[wasm_bindgen]
pub fn teams_can_push(a: Option<String>, b: Option<String>, same: bool) -> bool {
    let a = rule(a.as_deref());
    let b = rule(b.as_deref());
    if a == "never" || b == "never" {
        return false;
    }
    if (a == "pushOwnTeam" || b == "pushOwnTeam") && same {
        return false;
    }
    (a != "pushOtherTeams" && b != "pushOtherTeams") || same
}

/// One entity's contribution to the local player's motion.
///
/// `bb` is the player's AABB `[x0, y0, z0, x1, y1, z1]`; the entity is the
/// potential pusher. Returns `[dx, dz]` to add to `motionX` / `motionZ`, or
/// `[0, 0]` when the boxes do not overlap.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn push_offset(
    bb_x0: f64,
    bb_y0: f64,
    bb_z0: f64,
    bb_x1: f64,
    bb_y1: f64,
    bb_z1: f64,
    player_x: f64,
    player_z: f64,
    entity_x: f64,
    entity_y: f64,
    entity_z: f64,
    entity_width: f64,
    entity_height: f64,
    collision_reduction: f64,
) -> Vec<f64> {
    let half = entity_width / 2.0;
    let overlaps = entity_x + half > bb_x0
        && entity_x - half < bb_x1
        && entity_y + entity_height > bb_y0
        && entity_y < bb_y1
        && entity_z + half > bb_z0
        && entity_z - half < bb_z1;
    if !overlaps {
        return vec![0.0, 0.0];
    }
    let dx = player_x - entity_x;
    let dz = player_z - entity_z;
    let distance = dx.abs().max(dz.abs());
    if distance < 0.01f32 as f64 {
        return vec![0.0, 0.0];
    }
    let length = distance.sqrt() as f32 as f64;
    let scale = 1.0f64.min(1.0 / length) * (0.05f32 as f64) * (1.0 - collision_reduction) / length;
    vec![dx * scale, dz * scale]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collision_rules_match_the_native_table() {
        assert!(teams_can_push(None, None, false));
        assert!(!teams_can_push(Some("never".into()), None, false));
        assert!(!teams_can_push(Some("pushOwnTeam".into()), None, true));
        assert!(teams_can_push(Some("pushOwnTeam".into()), None, false));
        assert!(!teams_can_push(Some("pushOtherTeams".into()), None, false));
        assert!(teams_can_push(Some("pushOtherTeams".into()), None, true));
        assert!(!teams_can_push(Some("pushOtherTeams".into()), Some("pushOwnTeam".into()), true));
    }

    #[test]
    fn only_overlapping_entities_push() {
        let bb = [0.0, 0.0, 0.0, 1.0, 1.8, 1.0];
        let mut out = push_offset(
            bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], 0.5, 0.5, 2.0, 0.0, 0.5, 0.6, 1.8, 0.0,
        );
        assert_eq!(out, [0.0, 0.0]);
        out = push_offset(
            bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], 0.5, 0.5, 0.8, 0.0, 0.5, 0.6, 1.8, 0.0,
        );
        assert!(out[0] < 0.0);
        assert!(out[1].abs() < 1e-12);
    }

    #[test]
    fn collision_reduction_scales_the_push() {
        let args = [0.0, 0.0, 0.0, 1.0, 1.8, 1.0, 0.5, 0.5, 0.8, 0.0, 0.5, 0.6, 1.8];
        let full = push_offset(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10], args[11], args[12], 0.0);
        let half = push_offset(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10], args[11], args[12], 0.5);
        assert!((half[0] * 2.0 - full[0]).abs() < 1e-12);
    }
}
