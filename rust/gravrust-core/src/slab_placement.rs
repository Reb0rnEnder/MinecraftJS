//! Port of `client/js/game/slab-placement.js` (upstream MinecraftJS 1.8.9).
//!
//! ItemSlab (pre-flattening): clicked-cell merging only uses Up/Down;
//! adjacent-cell merging uses the matching material variant. No waterlogging.

use crate::blocks::{BlockDef, BlockRegistry};
use serde_json::Value;

/// JS: `const pairs = { stone_slab: 'double_stone_slab', ... }`.
fn double_of(name: &str) -> Option<&'static str> {
    match name {
        "stone_slab" => Some("double_stone_slab"),
        "wooden_slab" => Some("double_wooden_slab"),
        "stone_slab2" => Some("double_stone_slab2"),
        _ => None,
    }
}

/// JS: `isSlab(block)`.
pub fn is_slab(block: &BlockDef) -> bool {
    double_of(&block.name).is_some()
}

/// JS: `target` — `{ face, hit: [x,y,z] }` from the ray cast.
#[derive(Debug, Clone, Copy)]
pub struct PickTarget {
    pub face: i64,
    pub hit: [f64; 3],
}

/// The held item surface: JS reads `held.damage` (metadata = variant).
#[derive(Debug, Clone, Copy)]
pub struct HeldItem {
    pub damage: i64,
}

impl HeldItem {
    pub fn from_value(v: &Value) -> Self {
        HeldItem { damage: v.get("damage").and_then(|d| d.as_i64()).unwrap_or(0) }
    }
}

/// JS: `canMergeSlab(world, block, held, pos, target = null)`.
pub fn can_merge_slab(
    world_state: impl Fn(i64, i64, i64) -> u32,
    block: &BlockDef,
    held: &HeldItem,
    pos: [i64; 3],
    target: Option<&PickTarget>,
) -> bool {
    if !is_slab(block) {
        return false;
    }
    let state = world_state(pos[0], pos[1], pos[2]);
    let variant = held.damage & 7;
    // JS: (state >> 4) !== block.id || (state & 7) !== variant
    if (state >> 4) != block.id || (state & 7) != variant as u32 {
        return false;
    }
    // No target: any matching half merges. With a target: clicked-cell rule —
    // top slab (state&8) merges when the TOP face was clicked, bottom when the
    // BOTTOM face was clicked.
    match target {
        None => true,
        Some(t) => {
            if state & 8 != 0 {
                t.face == 0
            } else {
                t.face == 1
            }
        }
    }
}

/// JS: `slabPlacementState(world, block, held, pos, target)` — the block
/// state id to place (JS packs `blockId << 4 | variant | topBit`).
pub fn slab_placement_state(
    registry: &BlockRegistry,
    world_state: impl Fn(i64, i64, i64) -> u32,
    block: &BlockDef,
    held: &HeldItem,
    pos: [i64; 3],
    target: &PickTarget,
) -> Option<u32> {
    if !is_slab(block) {
        return None;
    }
    let variant = held.damage & 7;
    if can_merge_slab(world_state, block, held, pos, None) {
        let double_name = double_of(&block.name).unwrap();
        let double_id = registry.by_name.get(double_name).map(|&i| registry.blocks[i].id)?;
        return Some(((double_id << 4) | variant as u32) as u32);
    }
    // JS: top = target.face === 0 || (target.face !== 1 && target.hit[1] - pos.y > .5)
    let top = target.face == 0 || (target.face != 1 && target.hit[1] - pos[1] as f64 > 0.5);
    Some((block.id << 4) | variant as u32 | if top { 8 } else { 0 })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SLAB_NAME: &str = "stone_slab";
    const DOUBLE_NAME: &str = "double_stone_slab";

    fn registry() -> BlockRegistry {
        let json = format!(
            r#"[
                {{"name":"{s}","id":1,"displayName":"s","minStateId":16,"maxStateId":31,"defaultState":16}},
                {{"name":"{d}","id":2,"displayName":"d","minStateId":32,"maxStateId":47,"defaultState":32}}
            ]"#,
            s = SLAB_NAME,
            d = DOUBLE_NAME
        );
        BlockRegistry::new(&json, "{}").unwrap()
    }

    fn world_state(x: i64, _y: i64, _z: i64) -> u32 {
        // slab present at pos, bottom half, variant 0
        let _ = x;
        (1 << 4) | 0
    }

    #[test]
    fn merges_to_double_on_matching_face() {
        let reg = registry();
        let block = reg.blocks.iter().find(|b| b.name == SLAB_NAME).unwrap();
        let held = HeldItem { damage: 0 };
        // bottom slab, face 1 (bottom) clicked → merge
        let target = PickTarget { face: 1, hit: [0.5, 0.0, 0.5] };
        assert!(can_merge_slab(world_state, block, &held, [0, 0, 0], Some(&target)));
        let st = slab_placement_state(&reg, world_state, block, &held, [0, 0, 0], &target).unwrap();
        assert_eq!(st, (2 << 4) | 0);
    }

    #[test]
    fn places_top_half_by_hit_height() {
        let reg = registry();
        let block = reg.blocks.iter().find(|b| b.name == SLAB_NAME).unwrap();
        // JS: canMergeSlab(null target) runs FIRST — a matching variant merges
        // regardless of face. The hit-height path only applies when the held
        // variant differs from the placed slab.
        let held = HeldItem { damage: 3 };
        let target = PickTarget { face: 2, hit: [0.5, 0.9, 0.5] };
        let st = slab_placement_state(&reg, world_state, block, &held, [0, 0, 0], &target).unwrap();
        assert_eq!(st & 8, 8, "top half");
        assert_eq!(st & 7, 3, "held variant");
        // side face, hit below half → bottom slab
        let target = PickTarget { face: 2, hit: [0.5, 0.2, 0.5] };
        let st = slab_placement_state(&reg, world_state, block, &held, [0, 0, 0], &target).unwrap();
        assert_eq!(st & 8, 0, "bottom half");
        // top face (0) always places top half
        let target = PickTarget { face: 0, hit: [0.5, 1.0, 0.5] };
        let st = slab_placement_state(&reg, world_state, block, &held, [0, 0, 0], &target).unwrap();
        assert_eq!(st & 8, 8);
    }

    #[test]
    fn variant_mismatch_rejects_merge() {
        let reg = registry();
        let block = reg.blocks.iter().find(|b| b.name == SLAB_NAME).unwrap();
        let held = HeldItem { damage: 3 };
        assert!(!can_merge_slab(world_state, block, &held, [0, 0, 0], None));
    }
}
