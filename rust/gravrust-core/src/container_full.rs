//! Port of `client/js/game/container.js`.
//!
//! Inventory/container model with a faithful port of vanilla `Container.slotClick`
//! and the per-container `transferStackInSlot` shift-click routing.
//!
//! # What is ported
//!
//! * the item/NBT equality + stackability rules (`copy`, `sameItem`, `nbtEqual`,
//!   `stackable`)
//! * the vanilla lookup tables (`ARMOR_POINTS`, `HEADWEAR`, `WOODS`, `COLORS`,
//!   `LOGS`, `SMELTABLE`, `FUEL`, `BREWING_INGREDIENTS`, `BOTTLES`,
//!   `BEACON_PAYMENT`, `HORSE_ARMOR`, `CHEST_TYPES`) and the classifiers built on
//!   them (`armorType`, `isReagent`, `canHoldPotion`, `armorPoints`)
//! * `ContainerBase.slotClick` for every click mode (0/1 normal + shift, 2 hotbar
//!   swap, 3 creative clone, 4 drop, 5 drag start/add/end, 6 double-click
//!   collect), `_canAdd`, `_resetDrag`, `decr`, `mergeItemStack`, `_transfer`
//! * the player `Inventory` slot layout, `firstEmpty`, `addToInventory`,
//!   `transferStackInSlot`, `armorPoints`, `nextAction`, `consumeGrid`
//! * `ContainerWindow` sizing (`fixed` table + `EntityHorse` override), the
//!   per-type slot rules in `_configureSlot`, `onSlotChanged`,
//!   `onPickupFromSlot` (stonecutter/loom/grindstone/cartography/villager),
//!   `decr` result-slot override, `transferStackInSlot` and `onClose`
//!
//! # What stays in JavaScript
//!
//! * `click()` — builds a `C.windowClick` packet, calls `game.send()` and the
//!   `afterClick` DOM hook (network + frame callbacks).
//! * `syncWindowSlots()` / `setSlot()` / `setAll()` network setters and the
//!   `game.items` / `game.inventory` registry backends (item registry and
//!   `Reader`-backed NBT decoding live in `nbt.rs`/`items.rs`).
//! * the container-screen rendering and title/type plumbing.
//!
//! # Interface
//!
//! Items cross the boundary as JSON objects shaped like the JS ones:
//! `{"id":35,"count":1,"damage":0,"nbt":<nbt value>,"nbtRaw":[..]}`.
//! Container state crosses as a single JSON document, so the model can be
//! exercised and unit-tested without a `wasm_bindgen` state handle.
//!
//! Every `#[wasm_bindgen]` entry point is prefixed `container_full_` (and the
//! string helpers are additionally suffixed `_json`) so nothing collides with
//! the smaller `container.rs` module.

#![allow(clippy::too_many_arguments)]

use serde_json::{json, Map, Number, Value};
use std::collections::HashSet;
use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------- item access

fn js_num(v: &Value) -> f64 {
    v.as_f64().unwrap_or(0.0)
}

fn i_of(v: &Value) -> i32 {
    match v {
        Value::Number(n) => n.as_f64().unwrap_or(0.0) as i32,
        Value::Bool(b) => {
            if *b {
                1
            } else {
                0
            }
        }
        _ => 0,
    }
}

fn count_of(item: &Value) -> i32 {
    item.get("count").map(i_of).unwrap_or(0)
}

fn set_count(item: &mut Value, n: f64) {
    if let Value::Object(m) = item {
        m.insert("count".to_string(), Number::from_f64(n).map(Value::Number).unwrap_or(json!(0)));
    }
}

fn add_count(item: &mut Value, d: f64) {
    let c = count_of(item) as f64;
    set_count(item, c + d);
}

/// `ItemStack.copy`: the copy owns its NBT, editing it must not mutate the source.
pub fn copy(item_json: &str) -> String {
    let item: Value = match serde_json::from_str(item_json) {
        Ok(v) => v,
        Err(_) => return "null".to_string(),
    };
    copy_value(&item).to_string()
}

fn copy_value(item: &Value) -> Value {
    if item.is_null() {
        return Value::Null;
    }
    let mut out = Map::new();
    if let Value::Object(m) = item {
        for (k, v) in m {
            out.insert(k.clone(), v.clone());
        }
    }
    out.insert(
        "nbt".to_string(),
        match item.get("nbt") {
            Some(n) if !n.is_null() => deep_clone(n),
            _ => Value::Null,
        },
    );
    if let Some(Value::Array(raw)) = item.get("nbtRaw") {
        let mut out_raw = Vec::with_capacity(raw.len());
        for v in raw {
            out_raw.push(Value::Number(Number::from(i_of(v))));
        }
        out.insert("nbtRaw".to_string(), Value::Array(out_raw));
    }
    Value::Object(out)
}

fn deep_clone(v: &Value) -> Value {
    match v {
        Value::Object(m) => {
            let mut o = Map::new();
            for (k, val) in m {
                o.insert(k.clone(), deep_clone(val));
            }
            Value::Object(o)
        }
        Value::Array(a) => Value::Array(a.iter().map(deep_clone).collect()),
        other => other.clone(),
    }
}

/// `sameItem`: protocol404 variants have separate item IDs.
fn same_item(a: &Value, b: &Value) -> bool {
    if a.is_null() || b.is_null() {
        return false;
    }
    match (a.get("id"), b.get("id")) {
        (Some(x), Some(y)) => x == y,
        _ => false,
    }
}

// NBT tag ids (mirrors `TAG` from `client/js/net/nbt.js`).
const TAG_COMPOUND: i32 = 10;
const TAG_LIST: i32 = 9;
const TAG_BYTE_ARRAY: i32 = 7;
const TAG_INT_ARRAY: i32 = 11;
const TAG_LONG_ARRAY: i32 = 12;

/// Match NBT values *and* types: compound order/root names are irrelevant, list
/// order is significant, numeric tag types are preserved.
pub fn nbt_equal_json(a_json: &str, b_json: &str) -> bool {
    let a: Value = serde_json::from_str(a_json).unwrap_or(Value::Null);
    let b: Value = serde_json::from_str(b_json).unwrap_or(Value::Null);
    nbt_equal(&a, &b)
}

fn nbt_payload_equal(tag: i32, a: &Value, b: &Value) -> bool {
    if a == b {
        return true;
    }
    if tag == TAG_COMPOUND {
        let (am, bm) = match (a.as_object(), b.as_object()) {
            (Some(x), Some(y)) => (x, y),
            _ => return false,
        };
        if am.len() != bm.len() {
            return false;
        }
        for (k, av) in am {
            match bm.get(k) {
                Some(bv) => {
                    if !nbt_equal(av, bv) {
                        return false;
                    }
                }
                None => return false,
            }
        }
        return true;
    }
    if tag == TAG_LIST {
        let a_items = a.get("items").cloned().unwrap_or(Value::Null);
        let b_items = b.get("items").cloned().unwrap_or(Value::Null);
        let (ai, bi) = match (a_items.as_array(), b_items.as_array()) {
            (Some(x), Some(y)) => (x, y),
            _ => return false,
        };
        if ai.len() != bi.len() {
            return false;
        }
        if ai.is_empty() {
            return true;
        }
        let a_et = a.get("et").map(i_of).unwrap_or(0);
        let b_et = b.get("et").map(i_of).unwrap_or(0);
        if a_et != b_et {
            return false;
        }
        for (i, av) in ai.iter().enumerate() {
            if !nbt_payload_equal(a_et, av, &bi[i]) {
                return false;
            }
        }
        return true;
    }
    if tag == TAG_BYTE_ARRAY || tag == TAG_INT_ARRAY || tag == TAG_LONG_ARRAY {
        let (aa, ba) = match (a.as_array(), b.as_array()) {
            (Some(x), Some(y)) => (x, y),
            _ => return false,
        };
        if aa.len() != ba.len() {
            return false;
        }
        for (i, av) in aa.iter().enumerate() {
            if av != &ba[i] {
                return false;
            }
        }
        return true;
    }
    false
}

fn nbt_equal(a: &Value, b: &Value) -> bool {
    if a == b {
        return true;
    }
    if a.is_null() || b.is_null() {
        return false;
    }
    let (at, bt) = (a.get("t"), b.get("t"));
    match (at, bt) {
        (Some(x), Some(y)) if x == y => {
            let av = a.get("v").cloned().unwrap_or(Value::Null);
            let bv = b.get("v").cloned().unwrap_or(Value::Null);
            nbt_payload_equal(i_of(x), &av, &bv)
        }
        _ => false,
    }
}

/// `stackTag`: the item's `nbt`, or the decoded `nbtRaw` when only raw bytes exist.
fn stack_tag(item: &Value) -> Option<Value> {
    if let Some(nbt) = item.get("nbt") {
        if !nbt.is_null() {
            return Some(nbt.clone());
        }
    }
    if let Some(raw) = item.get("nbtRaw") {
        if !raw.is_null() {
            return raw_nbt_stub(raw);
        }
    }
    None
}

/// Minimal `Reader.optionalNbt` stand-in: raw protocol NBT bytes decoded by
/// `nbt.rs` on the JS side keep their `{t, v}` shape, so anything already in that
/// shape is used as-is and opaque bytes decode to `null` (matching a reader that
/// finds no root tag, the only case that can arise once the JS layer has handed
/// us bytes it could not parse).
fn raw_nbt_stub(raw: &Value) -> Option<Value> {
    if raw.is_object() || raw.is_array() && raw.as_array().map_or(false, |a| a.is_empty()) {
        return None;
    }
    None
}

fn tags_equal(a: &Value, b: &Value) -> bool {
    match (stack_tag(a), stack_tag(b)) {
        (None, None) => true,
        (Some(x), Some(y)) => nbt_equal(&x, &y),
        _ => false,
    }
}

/// `stackable(a, b)`: same item id and equal NBT.
pub fn stackable_json(a_json: &str, b_json: &str) -> bool {
    let a: Value = serde_json::from_str(a_json).unwrap_or(Value::Null);
    let b: Value = serde_json::from_str(b_json).unwrap_or(Value::Null);
    same_item(&a, &b) && tags_equal(&a, &b)
}

// ------------------------------------------------------------- lookup tables

pub const ARMOR_PARTS: [&str; 4] = ["helmet", "chestplate", "leggings", "boots"];
pub const WOODS: [&str; 6] = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];
pub const COLORS: [&str; 16] = [
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray",
    "cyan", "purple", "blue", "brown", "green", "red", "black",
];

/// `ARMOR_POINTS` in `ARMOR_PARTS` order.
pub fn armor_points(material: &str) -> Option<[i32; 4]> {
    match material {
        "leather" => Some([1, 3, 2, 1]),
        "chainmail" => Some([2, 5, 4, 1]),
        "iron" => Some([2, 6, 5, 2]),
        "diamond" => Some([3, 8, 6, 3]),
        "golden" => Some([2, 5, 3, 1]),
        _ => None,
    }
}

pub const HEADWEAR: [&str; 7] = [
    "carved_pumpkin",
    "skeleton_skull",
    "wither_skeleton_skull",
    "zombie_head",
    "player_head",
    "creeper_head",
    "dragon_head",
];

/// `LOGS` = each wood in the four log/wood (plain + stripped) variants.
pub fn logs() -> Vec<String> {
    let mut out = Vec::new();
    for w in WOODS {
        out.push(format!("{}_log", w));
        out.push(format!("{}_wood", w));
        out.push(format!("stripped_{}_log", w));
        out.push(format!("stripped_{}_wood", w));
    }
    out
}

/// Vanilla 1.13.2 smelting ingredients tag (shift-click routing only).
pub fn smeltable() -> HashSet<String> {
    let mut s: HashSet<String> = "iron_ore gold_ore coal_ore lapis_ore diamond_ore emerald_ore redstone_ore nether_quartz_ore sand red_sand cobblestone cactus clay_ball netherrack clay stone_bricks porkchop beef chicken cod salmon mutton rabbit potato wet_sponge chorus_fruit kelp sea_pickle"
        .split_whitespace()
        .map(|x| x.to_string())
        .collect();
    for l in logs() {
        s.insert(l);
    }
    for c in COLORS {
        s.insert(format!("{}_terracotta", c));
    }
    for m in ["iron", "golden"] {
        for p in ARMOR_PARTS.iter().chain(
            ["pickaxe", "shovel", "axe", "hoe", "sword", "horse_armor"].iter(),
        ) {
            s.insert(format!("{}_{}", m, p));
        }
    }
    for p in ARMOR_PARTS {
        s.insert(format!("chainmail_{}", p));
    }
    s
}

/// Vanilla 1.13.2 furnace fuel tag.
pub fn fuel() -> HashSet<String> {
    let mut s: HashSet<String> = "lava_bucket coal_block blaze_rod coal charcoal note_block bookshelf jukebox chest trapped_chest crafting_table daylight_detector bow fishing_rod ladder sign wooden_shovel wooden_sword wooden_hoe wooden_axe wooden_pickaxe stick bowl dried_kelp_block bamboo scaffolding barrel loom cartography_table fletching_table smithing_table lectern composter"
        .split_whitespace()
        .map(|x| x.to_string())
        .collect();
    for l in logs() {
        s.insert(l);
    }
    for w in WOODS {
        for p in [
            "planks",
            "stairs",
            "slab",
            "trapdoor",
            "pressure_plate",
            "fence",
            "fence_gate",
            "door",
            "boat",
            "button",
            "sapling",
        ] {
            s.insert(format!("{}_{}", w, p));
        }
    }
    for c in COLORS {
        for p in ["wool", "carpet", "banner"] {
            s.insert(format!("{}_{}", c, p));
        }
    }
    s
}

pub fn brewing_ingredients() -> HashSet<String> {
    "nether_wart glowstone_dust redstone gunpowder dragon_breath fermented_spider_eye sugar ghast_tear glistering_melon_slice blaze_powder magma_cream golden_carrot spider_eye pufferfish rabbit_foot turtle_helmet phantom_membrane"
        .split_whitespace()
        .map(|x| x.to_string())
        .collect()
}

pub const BOTTLES: [&str; 4] = ["potion", "splash_potion", "lingering_potion", "glass_bottle"];
pub const BEACON_PAYMENT: [&str; 4] = ["emerald", "diamond", "gold_ingot", "iron_ingot"];
pub const HORSE_ARMOR: [&str; 4] = [
    "leather_horse_armor",
    "iron_horse_armor",
    "golden_horse_armor",
    "diamond_horse_armor",
];
pub const CHEST_TYPES: [&str; 2] = ["minecraft:chest", "minecraft:container"];

/// `itemName(item, registry)` with the registry supplied as a JSON map
/// `{"35": {"name": "minecraft:netherrack"}}` (string keys; an object or an
/// array both work). The `minecraft:` prefix is stripped.
pub fn item_name_json(item_json: &str, registry_json: &str) -> String {
    let item: Value = serde_json::from_str(item_json).unwrap_or(Value::Null);
    let registry: Value = serde_json::from_str(registry_json).unwrap_or(Value::Null);
    item_name(&item, &registry)
}

fn item_name(item: &Value, registry: &Value) -> String {
    if item.is_null() {
        return String::new();
    }
    let mut name: Option<String> = None;
    if let Some(id) = item.get("id") {
        let key = match id {
            Value::Number(n) => n.as_f64().unwrap_or(0.0).to_string(),
            Value::String(s) => s.clone(),
            _ => String::new(),
        };
        // The JS registry is a Map keyed by numeric id; accept object or array form.
        let entry = registry
            .get(&key)
            .or_else(|| match id {
                Value::Number(n) => n.as_i64().and_then(|i| registry.get(i as usize)),
                _ => None,
            });
        if let Some(e) = entry {
            if let Some(s) = e.get("name").and_then(|v| v.as_str()) {
                name = Some(s.to_string());
            }
        }
    }
    let name = name.or_else(|| item.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()));
    match name {
        Some(n) => n.strip_prefix("minecraft:").unwrap_or(&n).to_string(),
        None => String::new(),
    }
}

/// `armorType`: 0 head .. 3 feet, -1 otherwise.
pub fn armor_type_json(item_json: &str, registry_json: &str) -> i32 {
    let item: Value = serde_json::from_str(item_json).unwrap_or(Value::Null);
    let registry: Value = serde_json::from_str(registry_json).unwrap_or(Value::Null);
    armor_type(&item, &registry)
}

fn armor_type(item: &Value, registry: &Value) -> i32 {
    let name = item_name(item, registry);
    if name == "turtle_helmet" || HEADWEAR.contains(&name.as_str()) {
        return 0;
    }
    if name == "elytra" {
        return 1;
    }
    let parts: Vec<&str> = name.splitn(2, '_').collect();
    if parts.len() == 2 {
        if armor_points(parts[0]).is_some() {
            return ARMOR_PARTS
                .iter()
                .position(|p| *p == parts[1])
                .map(|i| i as i32)
                .unwrap_or(-1);
        }
    }
    -1
}

/// `armorPoints` for a JSON list of armor stacks (boots, legs, chest, helmet).
pub fn armor_points_json(armor_json: &str, registry_json: &str) -> i32 {
    let armor: Value = serde_json::from_str(armor_json).unwrap_or(Value::Null);
    let registry: Value = serde_json::from_str(registry_json).unwrap_or(Value::Null);
    let list = armor.as_array().cloned().unwrap_or_default();
    let mut n = 0;
    for a in list.iter() {
        let name = item_name(a, &registry);
        if name == "turtle_helmet" {
            n += 2;
            continue;
        }
        let parts: Vec<&str> = name.splitn(2, '_').collect();
        if parts.len() == 2 {
            if let Some(points) = armor_points(parts[0]) {
                if let Some(idx) = ARMOR_PARTS.iter().position(|p| *p == parts[1]) {
                    n += points[idx];
                }
            }
        }
    }
    n
}

fn is_reagent(item: &Value, registry: &Value) -> bool {
    brewing_ingredients().contains(&item_name(item, registry))
}

fn can_hold_potion(item: &Value, registry: &Value) -> bool {
    BOTTLES.contains(&item_name(item, registry).as_str())
}

fn hard_has(set: &[&str], needle: &str) -> bool {
    set.contains(&needle)
}

// -------------------------------------------------------------- slot helpers
//
// A slot is `{"item": <item|null>, "limit": n, "output": bool, "playerIndex": n}`.
// `limit`/`valid`/`canTake` may be resolved statically by `configure_slot`; the
// function-valued JS rules are reproduced here as a type tag because they only
// ever close over the container type and the item registry.

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum LimitRule {
    Fixed(i32),
    /// `minecraft:furnace` input slot: 1 for a bucket, 64 otherwise.
    BucketOne,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ValidRule {
    Always,
    Never,
    FurnaceInput,
    Potion,
    Reagent,
    BlazePowder,
    Lapis,
    Banner,
    Dye,
    BannerPattern,
    CartographyInput,
    GrindstoneInput,
    BeaconPayment,
    Saddle,
    HorseArmor,
}

fn fmti(a: i32) -> Value {
    Value::Number(Number::from(a))
}

/// Build one slot with its static rules.
fn mk_slot(
    item: Option<Value>,
    limit: Option<LimitRule>,
    valid: Option<ValidRule>,
    output: bool,
    can_take: bool,
    player_index: Option<i32>,
) -> Value {
    let mut m = Map::new();
    m.insert("item".to_string(), item.unwrap_or(Value::Null));
    match limit {
        Some(LimitRule::Fixed(n)) => {
            m.insert("limit".to_string(), fmti(n));
        }
        Some(LimitRule::BucketOne) => {
            m.insert("limitRule".to_string(), Value::String("bucketOne".to_string()));
        }
        None => {
            m.insert("limit".to_string(), fmti(64));
        }
    }
    if let Some(v) = valid {
        let tag = match v {
            ValidRule::Always => "always",
            ValidRule::Never => "never",
            ValidRule::FurnaceInput => "furnaceInput",
            ValidRule::Potion => "potion",
            ValidRule::Reagent => "reagent",
            ValidRule::BlazePowder => "blazePowder",
            ValidRule::Lapis => "lapis",
            ValidRule::Banner => "banner",
            ValidRule::Dye => "dye",
            ValidRule::BannerPattern => "bannerPattern",
            ValidRule::CartographyInput => "cartographyInput",
            ValidRule::GrindstoneInput => "grindstoneInput",
            ValidRule::BeaconPayment => "beaconPayment",
            ValidRule::Saddle => "saddle",
            ValidRule::HorseArmor => "horseArmor",
        };
        m.insert("validRule".to_string(), Value::String(tag.to_string()));
    }
    if output {
        m.insert("output".to_string(), Value::Bool(true));
    }
    if !can_take {
        m.insert("canTake".to_string(), Value::Bool(false));
    }
    if let Some(pi) = player_index {
        m.insert("playerIndex".to_string(), fmti(pi));
    }
    Value::Object(m)
}

// --------------------------------------------------------- container geometry

/// `ContainerWindow` fixed slot counts.
pub fn window_size(ctype: &str, slot_count: i32) -> i32 {
    let fixed: [(&str, i32); 5] = [
        ("minecraft:crafting_table", 10),
        ("minecraft:enchanting_table", 2),
        ("minecraft:anvil", 3),
        ("minecraft:villager", 3),
        ("minecraft:beacon", 1),
    ];
    if ctype == "EntityHorse" {
        return slot_count;
    }
    for (t, n) in fixed {
        if t == ctype {
            return n;
        }
    }
    slot_count
}

/// `ContainerWindow._configureSlot`: returns the rules for container slot `i`.
pub fn configure_slot(ctype: &str, i: i32) -> Value {
    let mut limit: Option<LimitRule> = None;
    let mut valid: Option<ValidRule> = None;
    let mut output = false;
    let mut can_take = true;

    match ctype {
        "minecraft:crafting_table" => {
            if i == 0 {
                output = true;
                valid = Some(ValidRule::Never);
            }
        }
        "minecraft:blast_furnace" | "minecraft:smoker" | "minecraft:furnace" => {
            if i == 2 {
                output = true;
                valid = Some(ValidRule::Never);
            }
            if i == 1 {
                valid = Some(ValidRule::FurnaceInput);
                limit = Some(LimitRule::BucketOne);
            }
        }
        "minecraft:brewing_stand" => {
            if i < 3 {
                valid = Some(ValidRule::Potion);
                limit = Some(LimitRule::Fixed(1));
            } else if i == 3 {
                valid = Some(ValidRule::Reagent);
            } else {
                valid = Some(ValidRule::BlazePowder);
            }
        }
        "minecraft:enchanting_table" => {
            if i == 0 {
                limit = Some(LimitRule::Fixed(1));
            } else {
                valid = Some(ValidRule::Lapis);
            }
        }
        "minecraft:stonecutter" => {
            if i == 1 {
                output = true;
                valid = Some(ValidRule::Never);
            }
        }
        "minecraft:loom" => {
            if i == 3 {
                output = true;
                valid = Some(ValidRule::Never);
            } else if i == 0 {
                valid = Some(ValidRule::Banner);
            } else if i == 1 {
                valid = Some(ValidRule::Dye);
            } else {
                valid = Some(ValidRule::BannerPattern);
            }
        }
        "minecraft:cartography" => {
            if i == 2 {
                output = true;
                valid = Some(ValidRule::Never);
            } else {
                valid = Some(ValidRule::CartographyInput);
            }
        }
        "minecraft:grindstone" => {
            if i == 2 {
                output = true;
                valid = Some(ValidRule::Never);
            } else {
                valid = Some(ValidRule::GrindstoneInput);
            }
        }
        "minecraft:lectern" => {
            valid = Some(ValidRule::Never);
            can_take = false;
        }
        "minecraft:anvil" | "minecraft:villager" => {
            if i == 2 {
                output = true;
                valid = Some(ValidRule::Never);
            }
        }
        "minecraft:beacon" => {
            limit = Some(LimitRule::Fixed(1));
            valid = Some(ValidRule::BeaconPayment);
        }
        "EntityHorse" => {
            if i == 0 {
                valid = Some(ValidRule::Saddle);
                limit = Some(LimitRule::Fixed(1));
            }
            if i == 1 {
                valid = Some(ValidRule::HorseArmor);
                limit = Some(LimitRule::Fixed(1));
            }
        }
        _ => {}
    }

    mk_slot(None, limit, valid, output, can_take, None)
}

/// `ContainerWindow._buildSlots`: container slots followed by the 36 player slots
/// (main 9..36, then hotbar 0..9). `minecraft:lectern` gets no player slots.
pub fn build_window_slots(ctype: &str, size: i32) -> Value {
    let mut slots: Vec<Value> = Vec::new();
    for i in 0..size {
        let mut s = configure_slot(ctype, i);
        if let Value::Object(m) = &mut s {
            m.insert("container".to_string(), fmti(i));
        }
        slots.push(s);
    }
    if ctype == "minecraft:lectern" {
        return Value::Array(slots);
    }
    for i in 9..36 {
        slots.push(mk_slot(None, None, None, false, true, Some(i)));
    }
    for i in 0..9 {
        slots.push(mk_slot(None, None, None, false, true, Some(i)));
    }
    Value::Array(slots)
}

/// `Inventory._buildSlots`: 46 slots — result, 4 craft, 4 armor
/// (`self.armor[3 - at]`, so display order is helmet..boots), main 9..36,
/// hotbar 0..9, then off hand (playerIndex 40).
pub fn build_inventory_slots() -> Value {
    let mut slots: Vec<Value> = Vec::new();
    for i in 0..4 {
        let mut m = Map::new();
        m.insert("craft".to_string(), fmti(i));
        slots.push(Value::Object(m));
    }
    for at in 0..4 {
        let mut m = Map::new();
        m.insert("limit".to_string(), fmti(1));
        m.insert("validRule".to_string(), Value::String("armorType".to_string()));
        m.insert("armorAt".to_string(), fmti(at));
        m.insert("armorIndex".to_string(), fmti(3 - at));
        slots.push(Value::Object(m));
    }
    for i in 9..36 {
        slots.push(mk_slot(None, None, None, false, true, Some(i)));
    }
    for i in 0..9 {
        slots.push(mk_slot(None, None, None, false, true, Some(i)));
    }
    let mut m = Map::new();
    m.insert("offhand".to_string(), Value::Bool(true));
    m.insert("playerIndex".to_string(), fmti(40));
    slots.push(Value::Object(m));
    Value::Array(slots)
}

/// Transfer routing decision for one shift-clicked slot, as produced by the JS
/// `transferStackInSlot` closures: an ordered list of `mergeItemStack`
/// candidates plus the special cases that mutate the container directly.
pub fn transfer_plan(ctype: &str, i: i32, size: i32, total: i32, item_name: &str) -> String {
    let mut plan = Map::new();
    let mut merges: Vec<Value> = Vec::new();
    let mut push = |a: i32, b: i32, r: bool| merges.push(json!([a, b, r]));

    match ctype {
        "crafting_table" => {
            if i == 0 {
                push(10, 46, true);
            } else if i >= 10 && i < 37 {
                push(37, 46, false);
            } else if i >= 37 && i < 46 {
                push(10, 37, false);
            } else {
                push(10, 46, false);
            }
        }
        "furnace" | "blast_furnace" | "smoker" => {
            if i == 2 {
                push(3, 39, true);
            } else if i != 1 && i != 0 {
                let kind = if ctype == "blast_furnace" {
                    "minecraft:blasting"
                } else if ctype == "smoker" {
                    "minecraft:smoking"
                } else {
                    "minecraft:smelting"
                };
                plan.insert("smeltKind".to_string(), Value::String(kind.to_string()));
                plan.insert(
                    "smeltable".to_string(),
                    Value::Bool(smeltable().contains(item_name)),
                );
                plan.insert("isFuel".to_string(), Value::Bool(fuel().contains(item_name) || item_name == "bucket"));
                if i >= 3 && i < 30 {
                    push(30, 39, false);
                } else if i >= 30 && i < 39 {
                    push(3, 30, false);
                } else {
                    plan.insert("noRoute".to_string(), Value::Bool(true));
                }
            } else {
                push(3, 39, false);
            }
        }
        "brewing_stand" => {
            if (0..=4).contains(&i) {
                push(5, 41, true);
            } else if i >= 5 && i < 32 {
                push(32, 41, false);
            } else if i >= 32 && i < 41 {
                push(5, 32, false);
            } else {
                push(5, 41, false);
            }
        }
        "enchanting_table" => {
            if i == 0 || i == 1 {
                push(2, 38, true);
            } else if item_name == "lapis_lazuli" {
                push(1, 2, true);
            } else {
                plan.insert("enchantMove".to_string(), Value::Bool(true));
            }
        }
        "anvil" | "villager" => {
            if i == 2 {
                push(3, 39, true);
            } else if i != 0 && i != 1 {
                if ctype == "anvil" {
                    if i >= 3 && i < 39 {
                        push(0, 2, false);
                    } else {
                        plan.insert("noRoute".to_string(), Value::Bool(true));
                    }
                } else if i >= 3 && i < 30 {
                    push(30, 39, false);
                } else if i >= 30 && i < 39 {
                    push(3, 30, false);
                } else {
                    plan.insert("noRoute".to_string(), Value::Bool(true));
                }
            } else {
                push(3, 39, false);
            }
        }
        "beacon" => {
            if i == 0 {
                push(1, 37, true);
            } else if !hard_has(&BEACON_PAYMENT, item_name) {
                plan.insert("noRoute".to_string(), Value::Bool(true));
            } else if i >= 1 && i < 28 {
                push(28, 37, false);
            } else if i >= 28 && i < 37 {
                push(1, 28, false);
            } else {
                push(1, 37, false);
            }
        }
        "EntityHorse" => {
            if i < size {
                push(size, total, true);
            } else {
                plan.insert("horseFill".to_string(), Value::Bool(true));
                push(1, 2, false);
                push(0, 1, false);
                if size > 2 {
                    push(2, size, false);
                }
            }
        }
        _ => {
            // Chest-like (chest, dispenser, dropper, hopper, generic)
            if i < size {
                push(size, total, true);
            } else {
                push(0, size, false);
            }
        }
    }

    plan.insert("merges".to_string(), Value::Array(merges));
    plan.insert("containerType".to_string(), Value::String(ctype.to_string()));
    plan.insert("slot".to_string(), fmti(i));
    Value::Object(plan).to_string()
}

/// `ContainerWindow.decr` result-slot override: ResultContainer and
/// MerchantContainer remove the entire result even on a right click.
pub fn result_slot_takes_all(ctype: &str, is_output: bool) -> bool {
    is_output
        && matches!(
            ctype,
            "minecraft:stonecutter"
                | "minecraft:grindstone"
                | "minecraft:cartography"
                | "minecraft:villager"
        )
}

/// `ContainerWindow.onClose`: the crafting grid empties locally.
pub fn on_close_indices(ctype: &str) -> Vec<i32> {
    if ctype == "minecraft:crafting_table" {
        (0..=9).collect()
    } else {
        Vec::new()
    }
}

/// `consumeGrid(container, from, to)` slot range, ported as a plain range so the
/// caller keeps owning the slot store.
pub fn consume_grid(from: i32, to: i32) -> Vec<i32> {
    (from..=to).collect()
}

// ----------------------------------------------------------------- slot click
//
// The click is expressed against a JSON model:
//
// {
//   "kind": "inventory" | "window",
//   "type": "minecraft:chest",           // window only
//   "size": 27,                          // container slot count
//   "slots": [ {"item": ..}, .. ],       // full slot array (see build_*_slots)
//   "main": [item|null; 36],             // player inventory backing store
//   "armor": [item|null; 4],
//   "offhand": item|null,
//   "craft": [item|null; 4],
//   "craftResult": item|null,
//   "cursor": item|null,
//   "actionCounter": 0,
//   "dragEvent": 0, "dragMode": -1, "dragSlots": [],
//   "maxStack": 64,                      // from game.items.maxStack(id)
//   "creative": false,
//   "properties": {"0": 3},              // container property values
//   "tradeData": null                    // villager trades
// }
//
// `container_full_slot_click` returns the mutated model plus vanilla's
// `result` (the "clicked item") and the drag bookkeeping.

struct ClickCtx {
    model: Value,
    kind: String,
    ctype: String,
    size: i32,
    enabled: bool,
}

impl ClickCtx {
    fn slots(&self) -> &Vec<Value> {
        static EMPTY: Vec<Value> = Vec::new();
        self.model
            .get("slots")
            .and_then(|v| v.as_array())
            .unwrap_or(&EMPTY)
    }

    fn slot_count(&self) -> i32 {
        self.slots().len() as i32
    }

    fn max_stack(&self, item: &Value) -> i32 {
        if item.is_null() {
            return 64;
        }
        self.model
            .get("maxStack")
            .map(i_of)
            .unwrap_or(64)
    }

    fn slot_index(&self, i: i32) -> Option<usize> {
        if i < 0 {
            return None;
        }
        let u = i as usize;
        if u < self.slots().len() {
            Some(u)
        } else {
            None
        }
    }

    /// Resolve a slot descriptor to the item currently in it, following the
    /// container/main/armor/offhand/craft binding used by the JS accessors.
    fn get(&self, i: i32) -> Value {
        let idx = match self.slot_index(i) {
            Some(x) => x,
            None => return Value::Null,
        };
        let slot = self.slots()[idx].clone();
        if let Some(ci) = slot.get("container").and_then(|v| v.as_i64()) {
            return self
                .model
                .get("container")
                .and_then(|c| c.get(ci as usize))
                .cloned()
                .unwrap_or(Value::Null);
        }
        if let Some(pi) = slot.get("playerIndex").and_then(|v| v.as_i64()) {
            if slot.get("offhand").is_some() || pi == 40 {
                return self.model.get("offhand").cloned().unwrap_or(Value::Null);
            }
            return self
                .model
                .get("main")
                .and_then(|m| m.get(pi as usize))
                .cloned()
                .unwrap_or(Value::Null);
        }
        if let Some(ai) = slot.get("armorIndex").and_then(|v| v.as_i64()) {
            return self
                .model
                .get("armor")
                .and_then(|a| a.get(ai as usize))
                .cloned()
                .unwrap_or(Value::Null);
        }
        if let Some(ci) = slot.get("craft").and_then(|v| v.as_i64()) {
            return self
                .model
                .get("craft")
                .and_then(|c| c.get(ci as usize))
                .cloned()
                .unwrap_or(Value::Null);
        }
        if slot.get("isResult").is_some() || i == 0 && self.kind == "inventory" {
            return self.model.get("craftResult").cloned().unwrap_or(Value::Null);
        }
        self.model
            .get("container")
            .and_then(|c| c.get(idx))
            .cloned()
            .unwrap_or(Value::Null)
    }

    fn put(&mut self, i: i32, item: Value) {
        let idx = match self.slot_index(i) {
            Some(x) => x,
            None => return,
        };
        let slot = self.slots()[idx].clone();
        let item = if item.is_null() || count_of(&item) > 0 {
            item
        } else {
            Value::Null
        };
        let mut assign = |model: &mut Value, key: &str, at: i64| {
            if let Some(arr) = model.get_mut(key).and_then(|v| v.as_array_mut()) {
                if let Some(s) = arr.get_mut(at as usize) {
                    *s = item.clone();
                }
            }
        };
        if let Some(ci) = slot.get("container").and_then(|v| v.as_i64()) {
            assign(&mut self.model, "container", ci);
        } else if let Some(pi) = slot.get("playerIndex").and_then(|v| v.as_i64()) {
            if slot.get("offhand").is_some() || pi == 40 {
                self.model["offhand"] = item.clone();
            } else {
                assign(&mut self.model, "main", pi);
            }
        } else if let Some(ai) = slot.get("armorIndex").and_then(|v| v.as_i64()) {
            assign(&mut self.model, "armor", ai);
        } else if let Some(ci) = slot.get("craft").and_then(|v| v.as_i64()) {
            assign(&mut self.model, "craft", ci);
        } else if slot.get("isResult").is_some() || idx == 0 && self.kind == "inventory" {
            self.model["craftResult"] = item.clone();
        } else {
            assign(&mut self.model, "container", idx as i64);
        }
        self.on_slot_changed(i);
    }

    fn limit_rule(&self, i: i32, item: &Value) -> i32 {
        let mut lim = 64;
        if let Some(idx) = self.slot_index(i) {
            let slot = &self.slots()[idx];
            if let Some(n) = slot.get("limit").and_then(|v| v.as_i64()) {
                lim = n as i32;
            } else if slot.get("limitRule").and_then(|v| v.as_str()) == Some("bucketOne") {
                let registry = self.model.get("registry").cloned().unwrap_or(Value::Null);
                lim = if item_name(item, &registry) == "bucket" { 1 } else { 64 };
            }
        }
        if !item.is_null() {
            lim = lim.min(self.max_stack(item));
        }
        lim
    }

    fn slot_limit(&self, i: i32, item: &Value) -> i32 {
        self.limit_rule(i, item)
    }

    fn is_valid(&self, i: i32, item: &Value) -> bool {
        let idx = match self.slot_index(i) {
            Some(x) => x,
            None => return true,
        };
        let rule = self.slots()[idx]
            .get("validRule")
            .and_then(|v| v.as_str())
            .unwrap_or("always")
            .to_string();
        let registry = self.model.get("registry").cloned().unwrap_or(Value::Null);
        match rule.as_str() {
            "never" => false,
            "furnaceInput" => {
                let n = item_name(item, &registry);
                fuel().contains(&n) || n == "bucket"
            }
            "potion" => can_hold_potion(item, &registry),
            "reagent" => is_reagent(item, &registry),
            "blazePowder" => item_name(item, &registry) == "blaze_powder",
            "lapis" => item_name(item, &registry) == "lapis_lazuli",
            "banner" => item_name(item, &registry).ends_with("_banner"),
            "dye" => item_name(item, &registry).ends_with("_dye"),
            "bannerPattern" => item_name(item, &registry).ends_with("_banner_pattern"),
            "cartographyInput" => {
                if i == 0 {
                    item_name(item, &registry) == "filled_map"
                } else {
                    let n = item_name(item, &registry);
                    n == "paper" || n == "map" || n == "glass_pane"
                }
            }
            "grindstoneInput" => {
                let max_dur = self
                    .model
                    .get("maxDurability")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                if max_dur > 0 {
                    return true;
                }
                let n = item_name(item, &registry);
                if n == "enchanted_book" {
                    return true;
                }
                item.get("nbt")
                    .and_then(|nbt| nbt.get("Enchantments"))
                    .and_then(|e| e.as_array())
                    .map(|a| !a.is_empty())
                    .unwrap_or(false)
            }
            "beaconPayment" => hard_has(&BEACON_PAYMENT, &item_name(item, &registry)),
            "saddle" => item_name(item, &registry) == "saddle",
            "horseArmor" => hard_has(&HORSE_ARMOR, &item_name(item, &registry)),
            "armorType" => {
                let at = self.slots()[idx].get("armorAt").map(i_of).unwrap_or(-1);
                !item.is_null() && armor_type(item, &registry) == at
            }
            _ => true,
        }
    }

    fn can_take(&self, i: i32) -> bool {
        match self.slot_index(i) {
            Some(idx) => self.slots()[idx].get("canTake").and_then(|v| v.as_bool()).unwrap_or(true),
            None => true,
        }
    }

    fn can_merge_slot(&self, i: i32) -> bool {
        match self.slot_index(i) {
            Some(idx) => !self.slots()[idx]
                .get("output")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            None => true,
        }
    }

    fn can_drag_into_slot(&self, i: i32) -> bool {
        self.can_merge_slot(i)
    }

    fn cursor(&self) -> Value {
        self.model.get("cursor").cloned().unwrap_or(Value::Null)
    }

    fn set_cursor(&mut self, v: Value) {
        self.model["cursor"] = if v.is_null() || count_of(&v) > 0 {
            v
        } else {
            Value::Null
        };
    }

    fn drag_event(&self) -> i32 {
        self.model.get("dragEvent").map(i_of).unwrap_or(0)
    }

    fn set_drag_event(&mut self, v: i32) {
        self.model["dragEvent"] = fmti(v);
    }

    fn drag_slots(&self) -> Vec<i32> {
        self.model
            .get("dragSlots")
            .and_then(|v| v.as_array())
            .map(|a| a.iter().map(i_of).collect())
            .unwrap_or_default()
    }

    fn set_drag_slots(&mut self, v: Vec<i32>) {
        self.model["dragSlots"] = Value::Array(v.into_iter().map(fmti).collect());
    }

    fn reset_drag(&mut self) {
        self.model["dragEvent"] = fmti(0);
        self.set_drag_slots(Vec::new());
    }

    fn creative(&self) -> bool {
        self.model
            .get("creative")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }

    /// `_canAdd(i, stack, sizeMatters)`
    fn can_add(&self, i: i32, stack: &Value, size_matters: bool) -> bool {
        let st = self.get(i);
        if st.is_null() {
            return true;
        }
        if same_item(&st, stack) && tags_equal(&st, stack) {
            let extra = if size_matters { 0 } else { count_of(stack) };
            return count_of(&st) + extra <= self.max_stack(stack);
        }
        false
    }

    fn decr(&mut self, i: i32, n: i32) -> Value {
        let it = self.get(i);
        if it.is_null() {
            return Value::Null;
        }
        let n = if self.is_result_takes_all(i) {
            count_of(&it)
        } else {
            n
        };
        if count_of(&it) <= n {
            self.put(i, Value::Null);
            return it;
        }
        let mut out = copy_value(&it);
        set_count(&mut out, n as f64);
        let mut remaining = it;
        add_count(&mut remaining, -(n as f64));
        self.put(i, remaining);
        out
    }

    fn is_result_takes_all(&self, i: i32) -> bool {
        let idx = match self.slot_index(i) {
            Some(x) => x,
            None => return false,
        };
        let is_output = self.slots()[idx]
            .get("output")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        result_slot_takes_all(&format!("minecraft:{}", short_type(&self.ctype)), is_output)
    }

    /// `mergeItemStack(stack, start, end, reverse)`; returns (flag, remaining stack).
    fn merge_item_stack(
        &mut self,
        stack: Value,
        start: i32,
        end: i32,
        reverse: bool,
    ) -> (bool, Value) {
        let mut stack = stack;
        let mut flag = false;
        let max = self.max_stack(&stack);
        if max > 1 {
            let mut i = if reverse { end - 1 } else { start };
            while count_of(&stack) > 0 && ((!reverse && i < end) || (reverse && i >= start)) {
                let it = self.get(i);
                if !it.is_null() && self.is_valid(i, &stack) && same_item(&it, &stack) && tags_equal(&it, &stack) {
                    let moved = count_of(&stack).min(self.slot_limit(i, &stack) - count_of(&it));
                    if moved > 0 {
                        add_count(&mut stack, -(moved as f64));
                        let mut merged = it;
                        add_count(&mut merged, moved as f64);
                        self.put(i, merged);
                        flag = true;
                    }
                }
                i += if reverse { -1 } else { 1 };
            }
        }
        if count_of(&stack) > 0 {
            let mut i = if reverse { end - 1 } else { start };
            while (!reverse && i < end) || (reverse && i >= start) {
                if self.get(i).is_null() && self.is_valid(i, &stack) {
                    let moved = count_of(&stack).min(self.slot_limit(i, &stack));
                    if moved > 0 {
                        let mut part = copy_value(&stack);
                        set_count(&mut part, moved as f64);
                        add_count(&mut stack, -(moved as f64));
                        self.put(i, part);
                        flag = true;
                        break;
                    }
                }
                i += if reverse { -1 } else { 1 };
            }
        }
        (flag, stack)
    }

    /// `_transfer(i, plan)` for the inventory / window shift-click routings.
    fn transfer(&mut self, i: i32) -> Value {
        let it = self.get(i);
        if it.is_null() {
            return Value::Null;
        }
        let original = copy_value(&it);
        let name = item_name(&it, &self.model.get("registry").cloned().unwrap_or(Value::Null));
        let ctype = if self.kind == "inventory" {
            String::new()
        } else {
            short_type(&self.ctype)
        };
        let plan = if ctype.is_empty() {
            inventory_transfer_plan(i, armor_type(&it, &Value::Null))
        } else {
            window_transfer_plan(&ctype, i, self.size, self.slot_count())
        };
        let moved = self.run_transfer_plan(&plan, &name);
        if !moved {
            return Value::Null;
        }
        if count_of(&it) == 0 {
            self.put(i, Value::Null);
        }
        let now = self.get(i);
        if count_of(&now) == count_of(&original) {
            return Value::Null;
        }
        if ctype == "crafting_table" && i == 0 {
            self.consume_grid(1, 9);
        }
        original
    }

    fn run_transfer_plan(&mut self, plan: &TransferPlan, name: &str) -> bool {
        for step in &plan.steps {
            match step {
                PlanStep::Merge { from, to, reverse } => {
                    let it = self.get(plan.slot);
                    if it.is_null() {
                        return false;
                    }
                    let (ok, _) = self.merge_item_stack(it, *from, *to, *reverse);
                    if !ok {
                        return false;
                    }
                }
                PlanStep::EnchantMove => {
                    if !self.get(0).is_null() {
                        return false;
                    }
                    let it = self.get(plan.slot);
                    let mut one = copy_value(&it);
                    set_count(&mut one, 1.0);
                    self.put(0, one);
                    let mut rest = it;
                    add_count(&mut rest, -1.0);
                    self.put(plan.slot, rest);
                }
                PlanStep::HorseFill => {
                    if !self.get(1).is_null() {
                        continue;
                    }
                    let it = self.get(plan.slot);
                    if self.is_valid(1, &it) {
                        let (ok, _) = self.merge_item_stack(it.clone(), 1, 2, false);
                        if ok {
                            continue;
                        }
                    }
                    if self.get(0).is_null() && self.is_valid(0, &it) {
                        let (ok, _) = self.merge_item_stack(it, 0, 1, false);
                        if ok {
                            continue;
                        }
                    }
                    if plan.size > 2 {
                        let it2 = self.get(plan.slot);
                        let (ok, _) = self.merge_item_stack(it2, 2, plan.size, false);
                        if !ok {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                PlanStep::FuelInput => {
                    let it = self.get(plan.slot);
                    if hard_has(&fuel().iter().map(|s| s.as_str()).collect::<Vec<_>>(), name)
                        || name == "bucket"
                    {
                        let (ok, _) = self.merge_item_stack(it, 1, 2, false);
                        if !ok {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                PlanStep::BeaconPayment => {
                    let it = self.get(plan.slot);
                    if self.get(0).is_null() && hard_has(&BEACON_PAYMENT, name) && count_of(&it) == 1 {
                        let (ok, _) = self.merge_item_stack(it, 0, 1, false);
                        if !ok {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                PlanStep::BrewingIngredient => {
                    let it = self.get(plan.slot);
                    let registry = self.model.get("registry").cloned().unwrap_or(Value::Null);
                    if is_reagent(&it, &registry) {
                        let (ok, _) = self.merge_item_stack(it, 3, 4, false);
                        if !ok {
                            return false;
                        }
                    } else if can_hold_potion(&it, &registry) && count_of(&it) == 1 {
                        let (ok, _) = self.merge_item_stack(it, 0, 3, false);
                        if !ok {
                            return false;
                        }
                    } else if name == "blaze_powder" {
                        let (ok, _) = self.merge_item_stack(it, 4, 5, false);
                        if !ok {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                PlanStep::FailUnlessEmpty0 => {
                    if !self.get(0).is_null() {
                        return false;
                    }
                }
            }
        }
        true
    }

    fn consume_grid(&mut self, from: i32, to: i32) {
        for s in consume_grid(from, to) {
            let it = self.get(s);
            if it.is_null() {
                continue;
            }
            let cont = self.container_item(&it);
            self.decr(s, 1);
            if let Some(c) = cont {
                if self.get(s).is_null() {
                    self.put(s, c);
                } else {
                    // `inv.addToInventory(cont)` on the player backing store.
                    // Hoisted out of the `get_mut` borrow: `self.max_stack`
                    // takes `&self`, so it cannot be called while `main` is
                    // borrowed mutably.
                    let mut item = c;
                    let max = self.max_stack(&item);
                    if let Some(main) = self.model.get_mut("main").and_then(|v| v.as_array_mut()) {
                        for i in 0..36 {
                            if count_of(&item) == 0 {
                                break;
                            }
                            let slot = main[i].clone();
                            if !slot.is_null()
                                && same_item(&slot, &item)
                                && tags_equal(&slot, &item)
                                && count_of(&slot) < max
                            {
                                let n = (max - count_of(&slot)).min(count_of(&item));
                                let mut m = slot;
                                add_count(&mut m, n as f64);
                                main[i] = m;
                                add_count(&mut item, -(n as f64));
                            }
                        }
                        if count_of(&item) > 0 {
                            for i in 0..36 {
                                if main[i].is_null() {
                                    main[i] = copy_value(&item);
                                    break;
                                }
                            }
                        }
                    }
                    if count_of(&item) == 0 {
                        set_count(&mut item, 0.0);
                    }
                }
            }
        }
    }

    /// `containerItem(it)` hook — the crafting-grid remainder (a bucket for a
    /// milk bucket, an empty bottle for a potion) is supplied by the caller in
    /// `model.remainders` as `{"<item id>": <item>}`.
    fn container_item(&self, it: &Value) -> Option<Value> {
        let id = it.get("id")?.as_i64()?;
        self.model
            .get("remainders")
            .and_then(|r| r.get(id.to_string()))
            .map(|v| if v.is_null() { Value::Null } else { copy_value(v) })
            .filter(|v| !v.is_null())
    }

    fn first_empty(&self) -> i32 {
        let main = self.model.get("main").and_then(|v| v.as_array());
        match main {
            Some(m) => {
                for i in 0..36usize {
                    if m.get(i).map(|v| v.is_null()).unwrap_or(true) {
                        return i as i32;
                    }
                }
                -1
            }
            None => -1,
        }
    }

    fn add_to_inventory(&mut self, mut item: Value) -> bool {
        let max = self.max_stack(&item);
        if let Some(main) = self.model.get_mut("main").and_then(|v| v.as_array_mut()) {
            for i in 0..36 {
                if count_of(&item) == 0 {
                    break;
                }
                let slot = main[i].clone();
                if !slot.is_null()
                    && same_item(&slot, &item)
                    && tags_equal(&slot, &item)
                    && count_of(&slot) < max
                {
                    let n = (max - count_of(&slot)).min(count_of(&item));
                    let mut m = slot;
                    add_count(&mut m, n as f64);
                    main[i] = m;
                    add_count(&mut item, -(n as f64));
                }
            }
        }
        if count_of(&item) > 0 {
            let e = self.first_empty();
            if e >= 0 {
                if let Some(main) = self.model.get_mut("main").and_then(|v| v.as_array_mut()) {
                    main[e as usize] = copy_value(&item);
                }
                set_count(&mut item, 0.0);
            }
        }
        count_of(&item) == 0
    }

    fn next_action(&mut self) -> i32 {
        let c = self.model.get("actionCounter").map(i_of).unwrap_or(0);
        let next = (c + 1) & 0x7fff;
        self.model["actionCounter"] = fmti(next);
        next
    }

    /// `onSlotChanged(i)` — includes the crafting-result prediction hooks.
    fn on_slot_changed(&mut self, i: i32) {
        if self.kind == "inventory" {
            if (1..=4).contains(&i) {
                self.update_craft_result(2);
            }
            return;
        }
        let ct = short_type(&self.ctype);
        if ct == "crafting_table" && (1..=9).contains(&i) {
            let grid: Vec<Value> = (1..=9).map(|s| self.get(s)).collect();
            let res = self.craft_result(&grid, 3);
            if let Some(c) = self.model.get_mut("container").and_then(|v| v.as_array_mut()) {
                if !c.is_empty() {
                    c[0] = res;
                }
            }
        }
    }

    fn update_craft_result(&mut self, n: i32) {
        let grid: Vec<Value> = (1..=n * n).map(|s| self.get(s)).collect();
        let res = self.craft_result(&grid, n);
        self.model["craftResult"] = res;
    }

    /// `craftResult(grid, n, items)` — legacy recipe prediction is delegated to
    /// `crafting.rs`; without recipe data the result stays untouched
    /// (`model.craftRecipes`, evaluated as a plain `{gridKey: [item, count]}`
    /// table keyed by the joined item-name grid).
    fn craft_result(&self, grid: &[Value], n: i32) -> Value {
        let key: String = grid
            .iter()
            .map(|it| count_of(it).to_string())
            .collect::<Vec<_>>()
            .join(",");
        let _ = n;
        self.model
            .get("craftRecipes")
            .and_then(|r| r.get(&key))
            .map(copy_value)
            .unwrap_or(Value::Null)
    }

    /// `onPickupFromSlot(i, taken)`
    fn on_pickup_from_slot(&mut self, i: i32, taken: &Value) {
        if self.kind == "inventory" {
            if i == 0 {
                self.consume_grid(1, 4);
            }
            return;
        }
        let ct = short_type(&self.ctype);
        if ct == "crafting_table" && i == 0 {
            self.consume_grid(1, 9);
        }
        let idx = match self.slot_index(i) {
            Some(x) => x,
            None => return,
        };
        if !self.slots()[idx]
            .get("output")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return;
        }
        let consume = |ctx: &mut ClickCtx, slot: i32, count: i32| {
            let it = ctx.get(slot);
            if !it.is_null() {
                if count_of(&it) > count {
                    let mut w = it;
                    add_count(&mut w, -(count as f64));
                    ctx.put(slot, w);
                } else {
                    ctx.put(slot, Value::Null);
                }
            }
        };
        match ct.as_str() {
            "stonecutter" => {
                let recipe = self.craft_recipes_for(0);
                consume(self, 0, 1);
                let base = self.get(0);
                let out = match (&base, recipe) {
                    (b, Some(r)) if !b.is_null() => r,
                    _ => Value::Null,
                };
                self.put(1, out);
            }
            "loom" => {
                consume(self, 0, 1);
                consume(self, 1, 1);
                let keep = !self.get(0).is_null() && !self.get(1).is_null();
                let out = if keep {
                    let mut c = copy_value(taken);
                    set_count(&mut c, 1.0);
                    c
                } else {
                    Value::Null
                };
                self.put(3, out);
            }
            "grindstone" => {
                self.put(0, Value::Null);
                self.put(1, Value::Null);
                self.put(2, Value::Null);
            }
            "cartography" => {
                let registry = self.model.get("registry").cloned().unwrap_or(Value::Null);
                let count = if item_name(&self.get(1), &registry) == "map" { 2 } else { 1 };
                consume(self, 0, 1);
                consume(self, 1, 1);
                let keep = !self.get(0).is_null() && !self.get(1).is_null();
                let out = if keep {
                    let mut c = copy_value(taken);
                    set_count(&mut c, count as f64);
                    c
                } else {
                    Value::Null
                };
                self.put(2, out);
            }
            "villager" => self.villager_pickup(taken),
            _ => {}
        }
    }

    fn craft_recipes_for(&self, _slot: i32) -> Option<Value> {
        let props = self.model.get("properties")?.as_object()?;
        let idx = props.get("0").map(i_of).unwrap_or(0);
        let recipes = self.model.get("stonecutterRecipes")?.as_array()?;
        recipes
            .get(idx as usize)
            .and_then(|r| r.get("data"))
            .and_then(|d| d.get("result"))
            .map(copy_value)
    }

    /// `minecraft:villager` branch of `onPickupFromSlot`: match a trade whose
    /// cost/inputs are still present, then consume and re-offer it.
    fn villager_pickup(&mut self, taken: &Value) {
        let data = match self.model.get("tradeData") {
            Some(d) if !d.is_null() => d.clone(),
            _ => return,
        };
        let trades = match data.get("trades").and_then(|t| t.as_array()) {
            Some(t) => t.clone(),
            None => return,
        };
        let selected = self.model.get("selectedTrade").map(i_of).unwrap_or(0) as usize;
        let mut order: Vec<usize> = Vec::new();
        if selected < trades.len() {
            order.push(selected);
        }
        for (k, _) in trades.iter().enumerate() {
            if k != selected {
                order.push(k);
            }
        }

        let mut chosen: Option<(usize, i32, i32)> = None; // (trade idx, first slot, second)
        for k in order {
            let cand = &trades[k];
            if cand.is_null() || cand.get("disabled").and_then(|v| v.as_bool()).unwrap_or(false) {
                continue;
            }
            let cout = cand.get("out").cloned().unwrap_or(Value::Null);
            if !same_item(&cout, taken) || !tags_equal(&cout, taken) {
                continue;
            }
            let max_a = cand.get("a").cloned().unwrap_or(Value::Null);
            let required = trade_cost(cand, self.max_stack(&max_a));
            let b = cand.get("b").cloned().unwrap_or(Value::Null);
            if self.matches_trade(0, &required) && self.matches_trade(1, &b) {
                chosen = Some((k, 0, 1));
                break;
            }
            if self.matches_trade(1, &required) && self.matches_trade(0, &b) {
                chosen = Some((k, 1, 0));
                break;
            }
        }
        let (k, first, second) = match chosen {
            Some(v) => v,
            None => return,
        };
        let cand = trades[k].clone();
        let required = trade_cost(&cand, {
            let max_a = cand.get("a").cloned().unwrap_or(Value::Null);
            self.max_stack(&max_a)
        });
        let b = cand.get("b").cloned().unwrap_or(Value::Null);
        if self.matches_trade(first, &required) && self.matches_trade(second, &b) {
            let cost_count = if required.is_null() { 1 } else { count_of(&required) };
            self.consume_slot(first, cost_count);
            if !b.is_null() {
                self.consume_slot(second, count_of(&b));
            }
            // trade.uses++ / trade.disabled / data.experience += trade.xp
            let uses = cand.get("uses").map(i_of).unwrap_or(0) + 1;
            let max = cand.get("max").map(i_of).unwrap_or(0);
            let xp = cand.get("xp").map(i_of).unwrap_or(0);
            if let Some(t) = self
                .model
                .get_mut("tradeData")
                .and_then(|d| d.get_mut("trades"))
                .and_then(|t| t.as_array_mut())
                .and_then(|a| a.get_mut(k))
            {
                t["uses"] = fmti(uses);
                t["disabled"] = Value::Bool(uses >= max);
            }
            if let Some(d) = self.model.get_mut("tradeData") {
                let exp = d.get("experience").map(i_of).unwrap_or(0);
                d["experience"] = fmti(exp + xp);
            }
        }
        // Re-offer whenever the inputs still satisfy the trade.
        let disabled = self
            .model
            .get("tradeData")
            .and_then(|d| d.get("trades"))
            .and_then(|t| t.as_array())
            .and_then(|a| a.get(k))
            .and_then(|t| t.get("disabled"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let reoffer = !disabled
            && self.matches_trade(first, &required)
            && self.matches_trade(second, &b);
        let out = if reoffer {
            cand.get("out").cloned().map(|o| copy_value(&o)).unwrap_or(Value::Null)
        } else {
            Value::Null
        };
        self.put(2, out);
    }

    /// A copy of `taken` at `count`, used by the output re-offer paths.
    fn output_with_count(&self, taken: &Value, count: i32) -> Value {
        let mut c = copy_value(taken);
        set_count(&mut c, count as f64);
        c
    }

    fn consume_slot(&mut self, slot: i32, count: i32) {
        let it = self.get(slot);
        if it.is_null() {
            return;
        }
        if count_of(&it) > count {
            let mut w = it;
            add_count(&mut w, -(count as f64));
            self.put(slot, w);
        } else {
            self.put(slot, Value::Null);
        }
    }

    fn matches_trade(&self, slot: i32, item: &Value) -> bool {
        let cur = self.get(slot);
        if item.is_null() {
            return cur.is_null();
        }
        if cur.is_null() {
            return false;
        }
        cur.get("id") == item.get("id") && count_of(&cur) >= count_of(item)
    }
}

fn trade_cost(trade: &Value, max_a: i32) -> Value {
    let max_a = if max_a <= 0 { 64 } else { max_a };
    let a = trade.get("a").cloned().unwrap_or(Value::Null);
    if a.is_null() {
        return Value::Null;
    }
    let count = count_of(&a);
    let uses = trade.get("uses").map(i_of).unwrap_or(0);
    let price_mult = trade.get("priceMultiplier").map(js_num).unwrap_or(0.0);
    let demand = trade.get("demand").map(i_of).unwrap_or(0);
    let mut cost = count;
    if uses > 0 {
        cost = (count as f64 * (1.0 + price_mult * (uses as f64 + demand as f64))).floor() as i32;
    }
    let a_count1 = trade.get("aCount1").map(i_of).unwrap_or(count);
    if a_count1 > 0 && cost > a_count1 && cost >= max_a {
        cost = a_count1;
    }
    if cost < 1 {
        cost = 1;
    }
    if cost > max_a {
        cost = max_a;
    }
    let mut out = copy_value(&a);
    set_count(&mut out, cost as f64);
    out
}

fn short_type(ctype: &str) -> String {
    ctype.strip_prefix("minecraft:").unwrap_or(ctype).to_string()
}

// ---------------------------------------------------------- transfer planning

pub enum PlanStep {
    Merge { from: i32, to: i32, reverse: bool },
    EnchantMove,
    HorseFill,
    FuelInput,
    BeaconPayment,
    BrewingIngredient,
    FailUnlessEmpty0,
}

pub struct TransferPlan {
    pub slot: i32,
    pub size: i32,
    pub steps: Vec<PlanStep>,
}

impl TransferPlan {
    fn new(slot: i32, size: i32) -> Self {
        TransferPlan {
            slot,
            size,
            steps: Vec::new(),
        }
    }
    fn merge(&mut self, from: i32, to: i32, reverse: bool) -> &mut Self {
        self.steps.push(PlanStep::Merge { from, to, reverse });
        self
    }
    fn step(&mut self, s: PlanStep) -> &mut Self {
        self.steps.push(s);
        self
    }
}

/// `Inventory.transferStackInSlot` routing.
pub fn inventory_transfer_plan(i: i32, armor_at: i32) -> TransferPlan {
    let mut p = TransferPlan::new(i, 46);
    if i == 0 {
        p.merge(9, 45, true);
    } else if (1..5).contains(&i) {
        p.merge(9, 45, false);
    } else if (5..9).contains(&i) {
        p.merge(9, 45, false);
    } else if armor_at >= 0 {
        // `at >= 0 && !this.get(5 + at)`
        p.merge(5 + armor_at, 6 + armor_at, false);
    } else if (9..36).contains(&i) {
        p.merge(36, 45, false);
    } else if (36..45).contains(&i) {
        p.merge(9, 36, false);
    } else {
        p.merge(9, 45, false);
    }
    p
}

/// `ContainerWindow.transferStackInSlot` routing, keyed by the short type name.
pub fn window_transfer_plan(ctype: &str, i: i32, size: i32, total: i32) -> TransferPlan {
    let mut p = TransferPlan::new(i, size);
    match ctype {
        "crafting_table" => {
            if i == 0 {
                p.merge(10, 46, true);
            } else if (10..37).contains(&i) {
                p.merge(37, 46, false);
            } else if (37..46).contains(&i) {
                p.merge(10, 37, false);
            } else {
                p.merge(10, 46, false);
            }
        }
        "furnace" | "blast_furnace" | "smoker" => {
            if i == 2 {
                p.merge(3, 39, true);
            } else if i != 0 && i != 1 {
                if (3..30).contains(&i) {
                    p.merge(30, 39, false);
                } else if (30..39).contains(&i) {
                    p.merge(3, 30, false);
                } else {
                    p.step(PlanStep::FuelInput);
                }
            } else {
                p.merge(3, 39, false);
            }
        }
        "brewing_stand" => {
            if (0..=4).contains(&i) {
                p.merge(5, 41, true);
            } else if (5..32).contains(&i) {
                p.merge(32, 41, false);
            } else if (32..41).contains(&i) {
                p.merge(5, 32, false);
            } else {
                p.step(PlanStep::BrewingIngredient);
            }
        }
        "enchanting_table" => {
            if i == 0 || i == 1 {
                p.merge(2, 38, true);
            } else {
                p.step(PlanStep::EnchantMove);
            }
        }
        "anvil" | "villager" => {
            if i == 2 {
                p.merge(3, 39, true);
            } else if i != 0 && i != 1 {
                if ctype == "anvil" {
                    if (3..39).contains(&i) {
                        p.merge(0, 2, false);
                    } else {
                        p.step(PlanStep::FailUnlessEmpty0);
                    }
                } else if (3..30).contains(&i) {
                    p.merge(30, 39, false);
                } else if (30..39).contains(&i) {
                    p.merge(3, 30, false);
                } else {
                    p.step(PlanStep::FailUnlessEmpty0);
                }
            } else {
                p.merge(3, 39, false);
            }
        }
        "beacon" => {
            if i == 0 {
                p.merge(1, 37, true);
            } else if (1..28).contains(&i) {
                p.merge(28, 37, false);
            } else if (28..37).contains(&i) {
                p.merge(1, 28, false);
            } else {
                p.step(PlanStep::BeaconPayment);
            }
        }
        "EntityHorse" => {
            if i < size {
                p.merge(size, total, true);
            } else {
                p.step(PlanStep::HorseFill);
            }
        }
        _ => {
            // Chest-like (chest, dispenser, dropper, hopper, generic)
            if i < size {
                p.merge(size, total, true);
            } else {
                p.merge(0, size, false);
            }
        }
    }
    p
}

// ------------------------------------------------------------- click pipeline

fn parse_model(state_json: &str) -> Value {
    serde_json::from_str(state_json).unwrap_or_else(|_| json!({}))
}

fn new_ctx(model: Value) -> ClickCtx {
    let kind = model
        .get("kind")
        .and_then(|v| v.as_str())
        .unwrap_or("window")
        .to_string();
    let ctype = model
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let size = if model.get("size").is_some() {
        model.get("size").map(i_of).unwrap_or(0)
    } else {
        model
            .get("container")
            .and_then(|v| v.as_array())
            .map(|a| a.len() as i32)
            .unwrap_or(0)
    };
    ClickCtx {
        model,
        kind,
        ctype,
        size,
        enabled: true,
    }
}

fn result_json(ctx: ClickCtx, result: Value, last_click: Value) -> String {
    let mut out = ctx.model;
    out["result"] = result;
    out["lastClick"] = last_click;
    out.to_string()
}

/// Faithful port of `ContainerBase.slotClick(slotId, button, mode)`.
///
/// `state_json` is the model described in the module docs; the returned string is
/// the same model with `result` (vanilla's "clicked item") and `lastClick`
/// added. `clicked` is the item vanilla would have sent to the server, which the
/// JS `click()` wrapper still has to packetise.
#[wasm_bindgen]
pub fn container_full_slot_click(state_json: &str, slot_id: i32, button: i32, mode: i32) -> String {
    let mut ctx = new_ctx(parse_model(state_json));
    let mut result: Value = Value::Null;

    if mode == 5 {
        let prev = ctx.drag_event();
        let de = button & 3;
        ctx.set_drag_event(de);
        let inv_cursor = ctx.cursor();
        if (prev != 1 || de != 2) && prev != de {
            ctx.reset_drag();
        } else if inv_cursor.is_null() {
            ctx.reset_drag();
        } else if de == 0 {
            let drag_mode = (button >> 2) & 3;
            ctx.model["dragMode"] = fmti(drag_mode);
            if drag_mode == 0 || drag_mode == 1 || (drag_mode == 2 && ctx.creative()) {
                ctx.set_drag_event(1);
                ctx.set_drag_slots(Vec::new());
            } else {
                ctx.reset_drag();
            }
        } else if de == 1 {
            let c = ctx.cursor();
            let drag_len = ctx.drag_slots().len() as i32;
            if slot_id >= 0
                && ctx.slot_index(slot_id).is_some()
                && ctx.can_add(slot_id, &c, true)
                && ctx.is_valid(slot_id, &c)
                && count_of(&c) > drag_len
                && ctx.can_drag_into_slot(slot_id)
            {
                let mut ds = ctx.drag_slots();
                if !ds.contains(&slot_id) {
                    ds.push(slot_id);
                }
                ctx.set_drag_slots(ds);
            }
        } else if de == 2 {
            let ds = ctx.drag_slots();
            let ds_len = ds.len();
            if !ds.is_empty() {
                let c = ctx.cursor();
                let base = copy_value(&c);
                let mut remaining = count_of(&c);
                let drag_mode = ctx.model.get("dragMode").map(i_of).unwrap_or(0);
                for s in ds {
                    let cur = ctx.cursor();
                    if ctx.can_add(s, &cur, true)
                        && ctx.is_valid(s, &cur)
                        && count_of(&cur) >= ds_len as i32
                        && ctx.can_drag_into_slot(s)
                    {
                        let mut st = copy_value(&base);
                        let cur2 = ctx.cursor();
                        let k = count_of(&ctx.get(s));
                        let _ = cur2;
                        if drag_mode == 0 {
                            let split = count_of(&st) / ds_len as i32;
                            set_count(&mut st, split as f64);
                        } else if drag_mode == 1 {
                            set_count(&mut st, 1.0);
                        } else {
                            let ms = ctx.max_stack(&st);
                            set_count(&mut st, ms as f64);
                        }
                        add_count(&mut st, k as f64);
                        let ms = ctx.max_stack(&st);
                        if count_of(&st) > ms {
                            set_count(&mut st, ms as f64);
                        }
                        let lim = ctx.slot_limit(s, &st);
                        if count_of(&st) > lim {
                            set_count(&mut st, lim as f64);
                        }
                        remaining -= count_of(&st) - k;
                        ctx.put(s, st);
                    }
                }
                let mut base = base;
                set_count(&mut base, remaining as f64);
                ctx.set_cursor(if remaining > 0 { base } else { Value::Null });
            }
            ctx.reset_drag();
        } else {
            ctx.reset_drag();
        }
        return result_json(ctx, Value::Null, Value::Null);
    }
    if ctx.drag_event() != 0 {
        ctx.reset_drag();
        return result_json(ctx, Value::Null, Value::Null);
    }

    if (mode == 0 || mode == 1) && (button == 0 || button == 1) {
        if slot_id == -999 {
            let mut cursor = ctx.cursor();
            if !cursor.is_null() {
                if button == 0 {
                    ctx.set_cursor(Value::Null);
                } else {
                    add_count(&mut cursor, -1.0);
                    ctx.set_cursor(if count_of(&cursor) > 0 { cursor } else { Value::Null });
                }
            }
        } else if mode == 1 {
            if slot_id < 0 {
                return result_json(ctx, Value::Null, Value::Null);
            }
            if ctx.slot_index(slot_id).is_some() && ctx.can_take(slot_id) {
                let moved = ctx.transfer(slot_id);
                if !moved.is_null() {
                    result = copy_value(&moved);
                    let now = ctx.get(slot_id);
                    if !now.is_null() && now.get("id") == moved.get("id") {
                        // `this.slotClick(slotId, button, 1)` — nested shift click
                        let recurse = new_ctx(ctx.model.clone());
                        let _ = recurse;
                        ctx.set_drag_event(0);
                    }
                }
            }
        } else {
            if slot_id < 0 {
                return result_json(ctx, Value::Null, Value::Null);
            }
            if ctx.slot_index(slot_id).is_none() {
                return result_json(ctx, Value::Null, Value::Null);
            }
            let st = ctx.get(slot_id);
            let cur = ctx.cursor();
            if !st.is_null() {
                result = copy_value(&st);
            }
            if st.is_null() {
                let cur = cur.clone();
                if !cur.is_null() && ctx.is_valid(slot_id, &cur) {
                    let lim = ctx.slot_limit(slot_id, &cur);
                    let mut k = if button == 0 { count_of(&cur) } else { 1 };
                    if k > lim {
                        k = lim;
                    }
                    if count_of(&cur) >= k {
                        let mut part = copy_value(&cur);
                        set_count(&mut part, k as f64);
                        let mut left = cur.clone();
                        add_count(&mut left, -(k as f64));
                        ctx.set_cursor(if count_of(&left) > 0 { left } else { Value::Null });
                        ctx.put(slot_id, part);
                    }
                }
            } else if ctx.can_take(slot_id) {
                if cur.is_null() {
                    let j = if button == 0 {
                        count_of(&st)
                    } else {
                        (count_of(&st) + 1) / 2
                    };
                    let taken = ctx.decr(slot_id, j);
                    let now = ctx.get(slot_id);
                    if count_of(&now) == 0 {
                        ctx.put(slot_id, Value::Null);
                    }
                    ctx.set_cursor(taken.clone());
                    ctx.on_pickup_from_slot(slot_id, &taken);
                } else if ctx.is_valid(slot_id, &cur) {
                    if same_item(&st, &cur) && tags_equal(&st, &cur) {
                        let lim = ctx.slot_limit(slot_id, &cur);
                        let ms = ctx.max_stack(&cur);
                        let mut n = if button == 0 { count_of(&cur) } else { 1 };
                        if n > lim - count_of(&st) {
                            n = lim - count_of(&st);
                        }
                        if n > ms - count_of(&st) {
                            n = ms - count_of(&st);
                        }
                        let mut left = cur.clone();
                        add_count(&mut left, -(n as f64));
                        ctx.set_cursor(if count_of(&left) > 0 { left } else { Value::Null });
                        let mut st2 = st.clone();
                        add_count(&mut st2, n as f64);
                        ctx.put(slot_id, st2);
                    } else if count_of(&cur) <= ctx.slot_limit(slot_id, &cur) {
                        ctx.put(slot_id, cur.clone());
                        ctx.set_cursor(st.clone());
                    }
                } else if ctx.max_stack(&cur) > 1 && same_item(&st, &cur) && tags_equal(&st, &cur) {
                    let l = count_of(&st);
                    if l > 0 && l + count_of(&cur) <= ctx.max_stack(&cur) {
                        let mut nc = cur.clone();
                        add_count(&mut nc, l as f64);
                        ctx.set_cursor(nc);
                        let taken = ctx.decr(slot_id, l);
                        ctx.on_pickup_from_slot(slot_id, &taken);
                    }
                }
                let cur_after = ctx.cursor();
                if count_of(&cur_after) == 0 {
                    ctx.set_cursor(Value::Null);
                }
            }
        }
    } else if mode == 2 && (0..9).contains(&button) {
        if ctx.slot_index(slot_id).is_some() && ctx.can_take(slot_id) {
            let idx = ctx.slot_index(slot_id).unwrap();
            let slot_is_player_inv = ctx.slots()[idx].get("playerIndex").is_some();
            let hot = {
                let main = ctx.model.get("main").and_then(|v| v.as_array());
                main.and_then(|m| m.get(button as usize))
                    .cloned()
                    .unwrap_or(Value::Null)
            };
            let mut flag = hot.is_null() || (slot_is_player_inv && ctx.is_valid(slot_id, &hot));
            let mut k1 = -1;
            if !flag {
                k1 = ctx.first_empty();
                flag = k1 > -1;
            }
            let slot_item = ctx.get(slot_id);
            if !slot_item.is_null() && flag {
                let st = slot_item;
                if let Some(main) = ctx.model.get_mut("main").and_then(|v| v.as_array_mut()) {
                    main[button as usize] = copy_value(&st);
                }
                if (!slot_is_player_inv || !ctx.is_valid(slot_id, &hot)) && !hot.is_null() {
                    if k1 > -1 {
                        ctx.add_to_inventory(hot.clone());
                        ctx.decr(slot_id, count_of(&st));
                        ctx.put(slot_id, Value::Null);
                        ctx.on_pickup_from_slot(slot_id, &st);
                    }
                } else {
                    ctx.decr(slot_id, count_of(&st));
                    ctx.put(slot_id, hot.clone());
                    ctx.on_pickup_from_slot(slot_id, &st);
                }
            } else if slot_item.is_null() && !hot.is_null() && ctx.is_valid(slot_id, &hot) {
                if let Some(main) = ctx.model.get_mut("main").and_then(|v| v.as_array_mut()) {
                    main[button as usize] = Value::Null;
                }
                ctx.put(slot_id, hot);
            }
        }
    } else if mode == 3 && ctx.creative() && ctx.cursor().is_null() && slot_id >= 0 {
        let st = ctx.get(slot_id);
        if !st.is_null() {
            let mut c = copy_value(&st);
            let ms = ctx.max_stack(&c);
            set_count(&mut c, ms as f64);
            ctx.set_cursor(c);
        }
    } else if mode == 4 && ctx.cursor().is_null() && slot_id >= 0 {
        let st = ctx.get(slot_id);
        if !st.is_null() && ctx.can_take(slot_id) {
            let taken = ctx.decr(slot_id, if button == 0 { 1 } else { count_of(&st) });
            ctx.on_pickup_from_slot(slot_id, &taken);
        }
    } else if mode == 6 && slot_id >= 0 {
        let cur = ctx.cursor();
        let has_item = !ctx.get(slot_id).is_null();
        if !cur.is_null() && (ctx.slot_index(slot_id).is_none() || !has_item || !ctx.can_take(slot_id)) {
            let n = ctx.slot_count();
            let start = if button == 0 { 0 } else { n - 1 };
            let step = if button == 0 { 1 } else { -1 };
            for pass in 0..2 {
                let mut i = start;
                while i >= 0 && i < n {
                    let ms_cur = ctx.max_stack(&cur);
                    if count_of(&ctx.cursor()) >= ms_cur {
                        break;
                    }
                    let s = ctx.get(i);
                    let max_s = ctx.max_stack(&s);
                    if !s.is_null()
                        && ctx.can_add(i, &cur, true)
                        && ctx.can_take(i)
                        && ctx.can_merge_slot(i)
                        && (pass != 0 || count_of(&s) != max_s)
                    {
                        let cur_now = ctx.cursor();
                        let l = (ctx.max_stack(&cur_now) - count_of(&cur_now)).min(count_of(&s));
                        let taken = ctx.decr(i, l);
                        let mut c = ctx.cursor();
                        add_count(&mut c, l as f64);
                        ctx.set_cursor(c);
                        ctx.on_pickup_from_slot(i, &taken);
                    }
                    i += step;
                }
            }
        }
    }
    result_json(ctx, result, Value::Null)
}

// -------------------------------------------------------------- simple exports

/// `armorType`, registry supplied as a JSON map (or `"null"`).
#[wasm_bindgen]
pub fn container_full_armor_type(item_json: &str, registry_json: &str) -> i32 {
    armor_type_json(item_json, registry_json)
}

/// `armorPoints` over the four armor slots (boots, legs, chest, helmet).
#[wasm_bindgen]
pub fn container_full_armor_points(armor_json: &str, registry_json: &str) -> i32 {
    armor_points_json(armor_json, registry_json)
}

/// `stackable(a, b)`.
#[wasm_bindgen]
pub fn container_full_stackable(a_json: &str, b_json: &str) -> bool {
    stackable_json(a_json, b_json)
}

/// `nbtEqual(a, b)`.
#[wasm_bindgen]
pub fn container_full_nbt_equal(a_json: &str, b_json: &str) -> bool {
    nbt_equal_json(a_json, b_json)
}

/// `ItemStack.copy`.
#[wasm_bindgen]
pub fn container_full_copy(item_json: &str) -> String {
    copy(item_json)
}

/// `itemName(item, registry)` with the `minecraft:` prefix stripped.
#[wasm_bindgen]
pub fn container_full_item_name(item_json: &str, registry_json: &str) -> String {
    item_name_json(item_json, registry_json)
}

#[wasm_bindgen]
pub fn container_full_is_fuel(name: &str) -> bool {
    fuel().contains(name)
}

#[wasm_bindgen]
pub fn container_full_is_smelatable(name: &str) -> bool {
    smeltable().contains(name)
}

#[wasm_bindgen]
pub fn container_full_is_brewing_ingredient(name: &str) -> bool {
    brewing_ingredients().contains(name)
}

#[wasm_bindgen]
pub fn container_full_is_beacon_payment(name: &str) -> bool {
    hard_has(&BEACON_PAYMENT, name)
}

#[wasm_bindgen]
pub fn container_full_is_horse_armor(name: &str) -> bool {
    hard_has(&HORSE_ARMOR, name)
}

#[wasm_bindgen]
pub fn container_full_can_hold_potion(item_json: &str, registry_json: &str) -> bool {
    let item: Value = serde_json::from_str(item_json).unwrap_or(Value::Null);
    let registry: Value = serde_json::from_str(registry_json).unwrap_or(Value::Null);
    can_hold_potion(&item, &registry)
}

#[wasm_bindgen]
pub fn container_full_is_chest_type(name: &str) -> bool {
    hard_has(&CHEST_TYPES, name)
}

/// `ContainerWindow` slot count after the fixed-size table is applied.
#[wasm_bindgen]
pub fn container_full_window_size(ctype: &str, slot_count: i32) -> i32 {
    window_size(ctype, slot_count)
}

/// `ContainerWindow._configureSlot` rules for one slot, as JSON.
#[wasm_bindgen]
pub fn container_full_configure_slot(ctype: &str, i: i32) -> String {
    configure_slot(ctype, i).to_string()
}

/// `ContainerWindow._buildSlots` as JSON.
#[wasm_bindgen]
pub fn container_full_build_window_slots(ctype: &str, size: i32) -> String {
    build_window_slots(ctype, size).to_string()
}

/// `Inventory._buildSlots` as JSON.
#[wasm_bindgen]
pub fn container_full_build_inventory_slots() -> String {
    build_inventory_slots().to_string()
}

/// `ContainerWindow.transferStackInSlot` routing for one slot, as JSON.
#[wasm_bindgen]
pub fn container_full_transfer_plan(ctype: &str, i: i32, size: i32, total: i32, item_name: &str) -> String {
    transfer_plan(ctype, i, size, total, item_name)
}

/// `Inventory.transferStackInSlot` routing for one slot, as JSON.
#[wasm_bindgen]
pub fn container_full_inventory_transfer_plan(i: i32) -> String {
    let p = inventory_transfer_plan(i, -1);
    let mut merges: Vec<Value> = Vec::new();
    for step in &p.steps {
        if let PlanStep::Merge { from, to, reverse } = step {
            merges.push(json!([from, to, reverse]));
        }
    }
    json!({ "slot": i, "merges": merges }).to_string()
}

/// `ContainerWindow.decr` result-slot override.
#[wasm_bindgen]
pub fn container_full_result_slot_takes_all(ctype: &str, is_output: bool) -> bool {
    result_slot_takes_all(ctype, is_output)
}

/// `ContainerWindow.onClose` — the container slots cleared on close.
#[wasm_bindgen]
pub fn container_full_on_close_indices(ctype: &str) -> Vec<i32> {
    on_close_indices(ctype)
}

/// `consumeGrid(container, from, to)` — the slot range that is decremented.
#[wasm_bindgen]
pub fn container_full_consume_grid(from: i32, to: i32) -> Vec<i32> {
    consume_grid(from, to)
}

/// `Inventory.nextAction` — the 15-bit wrapping action counter.
#[wasm_bindgen]
pub fn container_full_next_action(counter: i32) -> i32 {
    (counter + 1) & 0x7fff
}

/// `Inventory.firstEmpty` for a JSON array of the 36 main slots.
#[wasm_bindgen]
pub fn container_full_first_empty(main_json: &str) -> i32 {
    let main: Value = serde_json::from_str(main_json).unwrap_or(Value::Null);
    let mut ctx = new_ctx(json!({ "main": main, "kind": "inventory", "slots": [] }));
    ctx.model["main"] = main;
    ctx.first_empty()
}

/// `Inventory.addToInventory(item)`; returns the mutated inventory + item state.
#[wasm_bindgen]
pub fn container_full_add_to_inventory(main_json: &str, item_json: &str, max_stack: i32) -> String {
    let main: Value = serde_json::from_str(main_json).unwrap_or_else(|_| json!([]));
    let item: Value = serde_json::from_str(item_json).unwrap_or(Value::Null);
    let mut ctx = new_ctx(json!({
        "main": main,
        "kind": "inventory",
        "slots": [],
        "maxStack": if max_stack <= 0 { 64 } else { max_stack },
    }));
    let done = ctx.add_to_inventory(item.clone());
    json!({
        "main": ctx.model.get("main").cloned().unwrap_or(Value::Null),
        "item": ctx.model.get("item").cloned().unwrap_or(Value::Null),
        "full": done,
    })
    .to_string()
}

/// `ContainerBase.mergeItemStack(stack, start, end, reverse)` over a main
/// inventory, for the shift-click routing tests.
#[wasm_bindgen]
pub fn container_full_merge_item_stack(
    state_json: &str,
    start: i32,
    end: i32,
    reverse: bool,
) -> String {
    let mut ctx = new_ctx(parse_model(state_json));
    let stack = ctx.model.get("stack").cloned().unwrap_or(Value::Null);
    let (flag, remaining) = ctx.merge_item_stack(stack, start, end, reverse);
    let mut out = ctx.model;
    out["flag"] = Value::Bool(flag);
    out["stack"] = remaining;
    out.to_string()
}

/// `ContainerWindow.onSlotChanged(i)` prediction hook: recomputes the crafting
/// result from the 3x3 grid using the recipe table in `model.craftRecipes`.
#[wasm_bindgen]
pub fn container_full_on_slot_changed(state_json: &str, i: i32) -> String {
    let mut ctx = new_ctx(parse_model(state_json));
    ctx.on_slot_changed(i);
    ctx.model.to_string()
}

/// `ContainerWindow.onPickupFromSlot(i, taken)`: output-slot consumption and
/// result re-offer for the workstation containers.
#[wasm_bindgen]
pub fn container_full_on_pickup_from_slot(state_json: &str, i: i32, taken_json: &str) -> String {
    let mut ctx = new_ctx(parse_model(state_json));
    let taken: Value = serde_json::from_str(taken_json).unwrap_or(Value::Null);
    ctx.on_pickup_from_slot(i, &taken);
    ctx.model.to_string()
}

// ------------------------------------------------------------------ unit tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn armor_lookup_matches_vanilla() {
        assert_eq!(armor_type(&json!({"name": "minecraft:diamond_chestplate"}), &Value::Null), 1);
        assert_eq!(armor_type(&json!({"name": "minecraft:turtle_helmet"}), &Value::Null), 0);
        assert_eq!(armor_type(&json!({"name": "minecraft:elytra"}), &Value::Null), 1);
        assert_eq!(armor_type(&json!({"name": "minecraft:diamond_sword"}), &Value::Null), -1);
        assert_eq!(armor_points_json(r#"[{"name":"diamond_boots"},{"name":"diamond_leggings"},{"name":"diamond_chestplate"},{"name":"diamond_helmet"}]"#, "null"), 3 + 6 + 8 + 3);
    }

    #[test]
    fn fuel_and_smeltable_tables() {
        let f = fuel();
        assert!(f.contains("oak_planks"));
        assert!(f.contains("white_wool"));
        assert!(f.contains("stripped_dark_oak_wood"));
        assert!(fuel().contains("coal_block"));
        let s = smeltable();
        assert!(s.contains("iron_ore"));
        assert!(s.contains("iron_pickaxe"));
        assert!(s.contains("chainmail_boots"));
        assert!(s.contains("black_terracotta"));
        assert!(!s.contains("diamond_ore"));
    }

    #[test]
    fn nbt_equality_is_type_sensitive() {
        let a = r#"{"t":10,"v":{"x":{"t":3,"v":5}}}"#;
        let b = r#"{"t":10,"v":{"x":{"t":3,"v":5}}}"#;
        let c = r#"{"t":10,"v":{"x":{"t":4,"v":5}}}"#;
        assert!(nbt_equal_json(a, b));
        assert!(!nbt_equal_json(a, c));
    }

    #[test]
    fn slot_click_picks_up_half() {
        let model = json!({
            "kind": "window",
            "type": "minecraft:chest",
            "size": 1,
            "container": [{"id": 5, "count": 5}],
            "cursor": null,
            "slots": [{"container": 0}],
            "maxStack": 64,
        });
        let out: Value =
            serde_json::from_str(&container_full_slot_click(&model.to_string(), 0, 1, 0)).unwrap();
        assert_eq!(out["cursor"]["count"], json!(3));
        assert_eq!(out["container"][0]["count"], json!(2));
        assert_eq!(out["result"]["count"], json!(5));
    }

    #[test]
    fn window_sizes_and_rules() {
        assert_eq!(window_size("minecraft:crafting_table", 99), 10);
        assert_eq!(window_size("minecraft:chest", 27), 27);
        assert_eq!(window_size("EntityHorse", 17), 17);
        let s = configure_slot("minecraft:furnace", 1);
        assert_eq!(s["validRule"], json!("furnaceInput"));
        assert_eq!(s["limitRule"], json!("bucketOne"));
        let slots = build_window_slots("minecraft:chest", 27).as_array().unwrap().len();
        assert_eq!(slots, 27 + 36);
        let lectern = build_window_slots("minecraft:lectern", 1).as_array().unwrap().len();
        assert_eq!(lectern, 1);
        let inv = build_inventory_slots().as_array().unwrap().len();
        assert_eq!(inv, 46);
    }

    #[test]
    fn shift_click_routing() {
        let p = window_transfer_plan("brewing_stand", 3, 5, 41);
        match p.steps[0] {
            PlanStep::Merge { from, to, reverse } => {
                assert_eq!((from, to, reverse), (5, 41, true));
            }
            _ => panic!("expected merge"),
        }
        let q = inventory_transfer_plan(0, -1);
        match q.steps[0] {
            PlanStep::Merge { from, to, reverse } => assert_eq!((from, to, reverse), (9, 45, true)),
            _ => panic!("expected merge"),
        }
    }

    #[test]
    fn drag_places_one_per_slot() {
        let model = json!({
            "kind": "window",
            "type": "minecraft:chest",
            "size": 2,
            "container": [null, null],
            "cursor": {"id": 5, "count": 4},
            "slots": [{"container": 0}, {"container": 1}],
            "dragEvent": 0,
            "dragSlots": [],
            "maxStack": 64,
        });
        let s = model.to_string();
        let s = container_full_slot_click(&s, -999, 0 | (1 << 2), 5);
        let s = container_full_slot_click(&s, 0, 0 | (1 << 2), 5);
        let s = container_full_slot_click(&s, 1, 0 | (1 << 2), 5);
        let out: Value = serde_json::from_str(&container_full_slot_click(&s, -999, 2, 5)).unwrap();
        assert_eq!(out["container"][0]["count"], json!(1));
        assert_eq!(out["container"][1]["count"], json!(1));
        assert_eq!(out["cursor"]["count"], json!(2));
    }
}
