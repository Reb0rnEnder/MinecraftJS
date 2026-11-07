//! Port of `client/js/game/adventure.js` (upstream MinecraftJS 1.8.9).
//!
//! Native pre-1.13 ItemStack permissions resolve block names/IDs, not
//! predicates. NBT is stored exactly like the JS runtime: `{ t, v }` tagged
//! objects (t=10 compound, t=9 list, t=8 string), so [`serde_json::Value`]
//! mirrors it directly.

use crate::blocks::BlockRegistry;
use serde_json::Value;

/// JS: `LEGACY_UNRESTRICTED_USE` — old client item paths that bypass
/// Player.canPlayerEdit (boat, minecart, furnace minecart, etc. by item id).
pub fn is_legacy_unrestricted_use(item_id: i64) -> bool {
    matches!(item_id, 328 | 342 | 343 | 407 | 408 | 422 | 383 | 401)
}

fn nbt_tag(v: &Value) -> i64 {
    v.get("t").and_then(|t| t.as_i64()).unwrap_or(-1)
}

/// JS: `adventureAllows(game, item, key, pos)` — checks the item's NBT
/// `CanPlaceOn`-style list (tag 10 compound → `key` → tag 9 list of tag-8
/// strings) against the target block id, resolving `minecraft:` names and
/// legacy numeric ids.
pub fn adventure_allow(
    registry: &BlockRegistry,
    get_state: impl Fn(i64, i64, i64) -> u32,
    item: &Value,
    key: &str,
    pos: [i64; 3],
) -> bool {
    let count = item.get("count").and_then(|c| c.as_i64()).unwrap_or(0);
    if count <= 0 {
        return false;
    }
    let nbt = match item.get("nbt") {
        Some(n) if nbt_tag(n) == 10 => n,
        _ => return false,
    };
    let list = match nbt.get("v").and_then(|v| v.get(key)) {
        Some(l) => l,
        None => return false,
    };
    if nbt_tag(list) != 9 {
        return false;
    }
    // JS: list.v.et !== 8 → reject (list element type must be TAG_String)
    let et = list.pointer("/v/et").and_then(|e| e.as_i64()).unwrap_or(-1);
    if et != 8 {
        return false;
    }
    let state = get_state(pos[0], pos[1], pos[2]);
    let block = registry.def(state);
    let items = list.pointer("/v/items").and_then(|i| i.as_array());
    let items = match items {
        Some(i) => i,
        None => return false,
    };
    items.iter().any(|name| {
        let Some(name) = name.as_str() else { return false };
        let path = name.strip_prefix("minecraft:").unwrap_or(name).trim_start_matches(':');
        let resolved = registry
            .by_name
            .get(path)
            .map(|&idx| &registry.blocks[idx])
            .or_else(|| {
                // JS: /^[+-]?\d+$/.test(name) && blocks[Number(name)] — legacy
                // numeric block id lookup (JS array index on the id itself).
                if name.parse::<i64>().is_ok() {
                    registry.blocks.iter().find(|b| b.id.to_string() == path)
                } else {
                    None
                }
            });
        matches!(resolved, Some(b) if b.id == block.id)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const EMPTY_JSON: &str = r#"{"blocks":[]}"#;

    fn registry_with(name: &str, id: u32) -> BlockRegistry {
        let json = format!(
            r#"[{{"name":"{}","id":{},"displayName":"{}","minStateId":{},"maxStateId":{},"defaultState":{}}}]"#,
            name, id, name, id << 4, (id << 4) + 15, id << 4
        );
        BlockRegistry::new(&json, "{}").unwrap()
    }

    #[test]
    fn allows_matching_can_place_on() {
        let reg = registry_with("stone", 1);
        let item = serde_json::json!({
            "count": 1,
            "nbt": { "t": 10, "v": { "CanPlaceOn": {
                "t": 9, "v": { "et": 8, "items": ["minecraft:stone"] }
            }}}
        });
        assert!(adventure_allow(&reg, |_x, _y, _z| 1 << 4, &item, "CanPlaceOn", [0, 0, 0]));
    }

    #[test]
    fn rejects_wrong_block_or_bad_nbt() {
        let reg = registry_with("stone", 1);
        let item = serde_json::json!({
            "count": 1,
            "nbt": { "t": 10, "v": { "CanPlaceOn": {
                "t": 9, "v": { "et": 8, "items": ["minecraft:dirt"] }
            }}}
        });
        assert!(!adventure_allow(&reg, |_x, _y, _z| 1 << 4, &item, "CanPlaceOn", [0, 0, 0]));
        let empty = serde_json::json!({"count": 1});
        assert!(!adventure_allow(&reg, |_x, _y, _z| 1 << 4, &empty, "CanPlaceOn", [0, 0, 0]));
        let zero = serde_json::json!({"count": 0, "nbt": {"t": 10, "v": {}}});
        assert!(!adventure_allow(&reg, |_x, _y, _z| 1 << 4, &zero, "CanPlaceOn", [0, 0, 0]));
        let _ = EMPTY_JSON;
    }
}
