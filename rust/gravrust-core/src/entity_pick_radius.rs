//! Port of `client/js/game/entity-pick-radius.js` (upstream MinecraftJS 1.8.9).
//!
//! Exact target `Entity.getPickRadius` (old `getCollisionBorderSize`)
//! overrides.

/// JS: `const DEFAULT_RADIUS = Math.fround(.1)`.
pub const DEFAULT_RADIUS: f64 = 0.1f32 as f64;

/// JS: `const FIREBALLS = new Set([...])`.
fn is_fireball(entity_name: Option<&str>) -> bool {
    matches!(
        entity_name,
        Some("fireball") | Some("small_fireball") | Some("dragon_fireball") | Some("wither_skull")
    )
}

/// The entity surface this module reads.
#[derive(Debug, Clone, Default)]
pub struct PickEntity {
    /// JS: `entity.pickRadius !== undefined` — an explicit override.
    pub pick_radius: Option<f64>,
    /// JS: `entity.kind` (client-side classification, e.g. 'itemframe',
    /// 'projectile').
    pub kind: Option<String>,
    /// JS: `entity.entityName` (server entity id string).
    pub entity_name: Option<String>,
    /// JS: `entity.type` (numeric server type id).
    pub entity_type: i64,
}

/// JS: `entityPickRadius(entity)` — 1:1, including the vanilla projectile
/// type-id list (63 = fireball, 64 = small fireball, 66 = wither skull,
/// 93 = dragon fireball on the 1.8.9 wire).
pub fn entity_pick_radius(entity: &PickEntity) -> f64 {
    if let Some(r) = entity.pick_radius {
        return r;
    }
    let frame = entity.kind.as_deref() == Some("itemframe")
        || entity.entity_name.as_deref() == Some("item_frame")
        || entity.entity_name.as_deref() == Some("glow_item_frame");
    if frame {
        return 0.0;
    }
    if is_fireball(entity.entity_name.as_deref())
        || (entity.kind.as_deref() == Some("projectile") && [63, 64, 66, 93].contains(&entity.entity_type))
    {
        return 1.0;
    }
    DEFAULT_RADIUS
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explicit_override_wins() {
        let e = PickEntity { pick_radius: Some(0.5), ..Default::default() };
        assert_eq!(entity_pick_radius(&e), 0.5);
    }

    #[test]
    fn item_frames_have_zero_pick_radius() {
        let e = PickEntity { entity_name: Some("item_frame".into()), ..Default::default() };
        assert_eq!(entity_pick_radius(&e), 0.0);
        let e = PickEntity { kind: Some("itemframe".into()), ..Default::default() };
        assert_eq!(entity_pick_radius(&e), 0.0);
    }

    #[test]
    fn fireballs_get_radius_one() {
        let e = PickEntity { entity_name: Some("fireball".into()), ..Default::default() };
        assert_eq!(entity_pick_radius(&e), 1.0);
        let e = PickEntity { kind: Some("projectile".into()), entity_type: 63, ..Default::default() };
        assert_eq!(entity_pick_radius(&e), 1.0);
        let e = PickEntity { kind: Some("projectile".into()), entity_type: 42, ..Default::default() };
        assert_eq!(entity_pick_radius(&e), DEFAULT_RADIUS);
    }
}
