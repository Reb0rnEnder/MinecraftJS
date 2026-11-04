// Port of `client/js/game/workstations-1.14.4.js`
//!

use std::collections::HashMap;

use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

/// Workstation definition: texture name, input/output slot positions, and title Y offset.
#[derive(Clone, Debug)]
pub struct WorkstationDef {
    pub texture: String,
    /// Slots as [[input0_x, input0_y, input0_z], [input1_x, input1_y, input1_z], ...]
    pub slots: Vec<[i32; 3]>,
    pub title_y: i32,
}

/// Workstation definitions mapped by registry name.
/// Corresponds to `WORKSTATIONS_498` from the JS port.
pub static WORKSTATIONS_498: once_cell::sync::Lazy<HashMap<String, WorkstationDef>> = once_cell::sync::Lazy::new(|| HashMap::from([
    (
        "minecraft:grindstone".into(),
        WorkstationDef {
            texture: "grindstone".into(),
            slots: vec![[0, 49, 19], [1, 49, 40], [2, 129, 34]],
            title_y: 6,
        },
    ),
    (
        "minecraft:cartography".into(),
        WorkstationDef {
            texture: "cartography_table".into(),
            slots: vec![[0, 15, 15], [1, 15, 52], [2, 145, 39]],
            title_y: 4,
        },
    ),
    (
        "minecraft:stonecutter".into(),
        WorkstationDef {
            texture: "stonecutter".into(),
            slots: vec![[0, 20, 33], [1, 143, 33]],
            title_y: 4,
        },
    ),
    (
        "minecraft:loom".into(),
        WorkstationDef {
            texture: "loom".into(),
            slots: vec![[0, 13, 26], [1, 33, 26], [2, 23, 45], [3, 143, 58]],
            title_y: 4,
        },
    ),
]));

/// Loom pattern characters, verified from the 1.14.4 client.
/// Corresponds to `LOOM_PATTERNS` from the JS port.
pub const LOOM_PATTERNS: &str = "b bl br tl tr bs ts ls rs cs ms drs dls ss cr sc bt tt bts tts ld rd lud rud mc mr vh hh vhr hhb bo cbo gru bri glb cre sku flo moj";

/// Filter stonecutting recipes for a given input item.
/// Corresponds to `stonecutterRecipes(game, input)` from the JS port.
pub fn stonecutter_recipes(input: &Value) -> Vec<Value> {
    if input.is_null() {
        return Vec::new();
    }
    // This is a simplified port - full filtering requires game state
    Vec::new()
}

/// Calculate trade cost, corresponding to `tradeCost(trade, maxStack)` from the JS port.
pub fn trade_cost(trade: &Value, max_stack: i32) -> Value {
    if trade.is_null() {
        return json!(null);
    }
    let a_count = trade["a"]["count"].as_i64().unwrap_or(0) as i32;
    let demand = trade["d"].as_f64().unwrap_or(1.0);
    let price_multiplier = trade["priceMultiplier"].as_f64().unwrap_or(1.0);

    let extra = (0.0f64.max(f64::floor(((a_count as f64 * demand * price_multiplier) as f32) as f64)) as i32);
    let new_count = a_count.saturating_add(extra).saturating_add(price_multiplier.max(1.0).round() as i32);

    json!({
        "a": {"count": new_count.max(1).min(max_stack)},
        "d": trade["d"],
        "priceMultiplier": trade["priceMultiplier"],
    })
}