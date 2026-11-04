// Port of `client/js/game/items.js`
//! Port of `client/js/game/items.js`: stack/durability, item registry,
//! tool speeds, harvest checks, potion effects/colours, spawn-egg data,
//! enchantment gating, tooltip rarity and the map colour blit.
//!
//! What stays JavaScript is the part that needs the loaded language file:
//! `assets.translate(...)` and therefore every display name and tooltip line.
//! The decisions that feed those strings are here.

use std::collections::HashMap;

use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

const FOOD_NAMES: &[&str] = &[
    "apple", "mushroom_stew", "bread", "porkchop", "cooked_porkchop", "golden_apple",
    "enchanted_golden_apple", "cod", "salmon", "tropical_fish", "pufferfish", "cooked_cod",
    "cooked_salmon", "cookie", "melon_slice", "beef", "cooked_beef", "chicken", "cooked_chicken",
    "rotten_flesh", "spider_eye", "carrot", "potato", "baked_potato", "poisonous_potato",
    "golden_carrot", "pumpkin_pie", "rabbit", "cooked_rabbit", "rabbit_stew", "mutton",
    "cooked_mutton", "chorus_fruit", "beetroot", "beetroot_soup", "dried_kelp", "honey_bottle",
];

const SWORDS: &[&str] = &["iron_sword", "wooden_sword", "stone_sword", "diamond_sword", "golden_sword"];

const RARITY_UNCOMMON: &[&str] = &[
    "experience_bottle", "nether_star", "enchanted_book", "elytra", "dragon_breath",
    "totem_of_undying", "heart_of_the_sea", "skeleton_skull", "wither_skeleton_skull",
    "player_head", "zombie_head", "creeper_head", "dragon_head",
];
const RARITY_RARE: &[&str] = &["golden_apple", "end_crystal", "beacon", "conduit"];
const RARITY_EPIC: &[&str] = &[
    "enchanted_golden_apple", "dragon_egg", "command_block", "chain_command_block",
    "repeating_command_block", "structure_block",
];
const SINGLE_LEVEL: &[&str] = &[
    "aqua_affinity", "binding_curse", "silk_touch", "flame", "infinity", "channeling", "mending",
    "vanishing_curse",
];

/// Spawn-egg colours the 1.13 flattening dropped from `creative.json`.
const EGG_ADDITIONS: &[(&str, [i64; 3])] = &[
    ("cod", [12691306, 15058059, 0]),
    ("dolphin", [2243405, 16382457, 0]),
    ("drowned", [9433559, 7969893, 0]),
    ("phantom", [4411786, 8978176, 0]),
    ("pufferfish", [16167425, 3654642, 0]),
    ("salmon", [10489616, 951412, 0]),
    ("tropical_fish", [15690005, 16775663, 0]),
    ("turtle", [15198183, 44975, 0]),
];

pub fn resource(name: &str) -> String {
    if name.contains(':') {
        name.to_string()
    } else {
        format!("minecraft:{}", name)
    }
}

fn translated_key(kind: &str, name: &str) -> String {
    format!("{}.{}", kind, resource(name).replace(':', "."))
}

#[derive(Clone, Debug)]
pub struct ItemDef {
    pub id: i32,
    pub name: String,
    pub stack_size: i32,
    pub max_durability: i32,
}

#[derive(Clone, Debug)]
pub struct EffectDef {
    pub key: String,
    pub color: i64,
    pub bad: bool,
    pub modifiers: Vec<(String, f64, i32)>,
}

#[derive(Clone, Debug)]
pub struct PotionDef {
    pub name: String,
    pub effects: Vec<(i32, i32, i32)>,
}

fn potion_additions(name: &str) -> Option<PotionDef> {
    let effects: &[(i32, i32, i32)] = match name {
        "strong_slowness" => &[(2, 400, 3)],
        "turtle_master" => &[(2, 400, 3), (11, 400, 2)],
        "long_turtle_master" => &[(2, 800, 3), (11, 800, 2)],
        "strong_turtle_master" => &[(2, 400, 3), (11, 400, 3)],
        "slow_falling" => &[(28, 1800, 0)],
        "long_slow_falling" => &[(28, 4800, 0)],
        _ => return None,
    };
    let display = match name {
        "strong_slowness" => "slowness",
        "turtle_master" | "long_turtle_master" | "strong_turtle_master" => "turtle_master",
        _ => "slow_falling",
    };
    Some(PotionDef { name: display.to_string(), effects: effects.to_vec() })
}

fn effect_additions(id: i32) -> Option<EffectDef> {
    let (key, color) = match id {
        28 => ("minecraft:slow_falling", 16773073),
        29 => ("minecraft:conduit_power", 1950417),
        30 => ("minecraft:dolphins_grace", 8954814),
        _ => return None,
    };
    Some(EffectDef { key: key.to_string(), color, bad: false, modifiers: Vec::new() })
}

pub struct ItemTable {
    by_id: HashMap<i32, ItemDef>,
    mechanics: HashMap<i32, Value>,
    effects: HashMap<i32, EffectDef>,
    potions: HashMap<String, PotionDef>,
    eggs: HashMap<String, Value>,
    enchantments: Vec<Value>,
}

fn parse_item(value: &Value) -> Option<ItemDef> {
    Some(ItemDef {
        id: value.get("id")?.as_i64()? as i32,
        name: value.get("name")?.as_str()?.to_string(),
        stack_size: value.get("stackSize").and_then(|v| v.as_i64()).unwrap_or(64) as i32,
        max_durability: value.get("maxDurability").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
    })
}

impl ItemTable {
    pub fn new(json_text: &str) -> Result<ItemTable, String> {
        let value: Value = serde_json::from_str(json_text).map_err(|e| e.to_string())?;
        let mut by_id = HashMap::new();
        if let Some(items) = value.get("items").and_then(|v| v.as_array()) {
            for item in items {
                if let Some(def) = parse_item(item) {
                    by_id.insert(def.id, def);
                }
            }
        }
        let mut mechanics = HashMap::new();
        if let Some(map) = value.get("itemMechanics").and_then(|v| v.as_object()) {
            for (key, entry) in map {
                if let Ok(id) = key.parse::<i32>() {
                    mechanics.insert(id, entry.clone());
                }
            }
        }
        let mut effects = HashMap::new();
        if let Some(map) = value.get("effects").and_then(|v| v.as_object()) {
            for (key, entry) in map {
                let Ok(id) = key.parse::<i32>() else { continue };
                let mut modifiers = Vec::new();
                if let Some(list) = entry.get("modifiers").and_then(|v| v.as_array()) {
                    for modifier in list {
                        if let Some(parts) = modifier.as_array() {
                            if parts.len() >= 3 {
                                modifiers.push((
                                    parts[0].as_str().unwrap_or("").to_string(),
                                    parts[1].as_f64().unwrap_or(0.0),
                                    parts[2].as_i64().unwrap_or(0) as i32,
                                ));
                            }
                        }
                    }
                }
                effects.insert(
                    id,
                    EffectDef {
                        key: entry.get("key").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        color: entry.get("color").and_then(|v| v.as_i64()).unwrap_or(0),
                        bad: entry.get("bad").and_then(|v| v.as_bool()).unwrap_or(false),
                        modifiers,
                    },
                );
            }
        }
        for id in [28, 29, 30] {
            if let Some(def) = effect_additions(id) {
                effects.entry(id).or_insert(def);
            }
        }
        let mut potions = HashMap::new();
        if let Some(map) = value.get("potions").and_then(|v| v.as_object()) {
            for (key, entry) in map {
                let name = entry.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let mut list = Vec::new();
                if let Some(effects) = entry.get("effects").and_then(|v| v.as_array()) {
                    for effect in effects {
                        if let Some(parts) = effect.as_array() {
                            if parts.len() >= 3 {
                                list.push((
                                    parts[0].as_i64().unwrap_or(0) as i32,
                                    parts[1].as_i64().unwrap_or(0) as i32,
                                    parts[2].as_i64().unwrap_or(0) as i32,
                                ));
                            }
                        }
                    }
                }
                potions.insert(key.clone(), PotionDef { name, effects: list });
            }
        }
        let mut eggs = HashMap::new();
        if let Some(map) = value.get("eggs").and_then(|v| v.as_object()) {
            for (key, entry) in map {
                eggs.insert(key.clone(), entry.clone());
            }
        }
        let enchantments = value
            .get("enchantments")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        Ok(ItemTable { by_id, mechanics, effects, potions, eggs, enchantments })
    }

    pub fn def(&self, id: i32) -> Option<&ItemDef> {
        self.by_id.get(&id)
    }

    pub fn name(&self, id: i32) -> String {
        self.def(id).map(|d| d.name.clone()).unwrap_or_else(|| "unknown".into())
    }

    pub fn max_stack(&self, id: i32) -> i32 {
        self.def(id).map(|d| d.stack_size).unwrap_or(64)
    }

    pub fn max_durability(&self, id: i32) -> i32 {
        self.def(id).map(|d| d.max_durability).unwrap_or(0)
    }

    fn is_block_item(&self, name: &str) -> bool {
        // Blocks whose registry name matches; `air` and the `wheat` item/crop split
        // are the same exceptions as `items.js`.
        !matches!(name, "air" | "wheat")
    }

    pub fn use_action(&self, id: i32) -> String {
        if let Some(entry) = self.mechanics.get(&id) {
            if let Some(action) = entry.get("action").and_then(|v| v.as_str()) {
                return action.to_string();
            }
        }
        let name = self.name(id);
        if name == "potion" || name == "milk_bucket" {
            return "drink".into();
        }
        if FOOD_NAMES.contains(&name.as_str()) {
            return "eat".into();
        }
        match name.as_str() {
            "shield" => "block".into(),
            "bow" => "bow".into(),
            "trident" => "spear".into(),
            _ => "none".into(),
        }
    }

    pub fn enchant_level(&self, tag: &Value, id: &str) -> i32 {
        let name = if id.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
            self.enchantments
                .iter()
                .find(|e| e.get("id").and_then(|v| v.as_i64()) == id.parse::<i64>().ok())
                .and_then(|e| e.get("name"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        } else {
            Some(id.to_string())
        };
        let Some(name) = name else { return 0 };
        self.enchantments_of(tag, false)
            .into_iter()
            .find(|(key, _)| *key == resource(&name))
            .map(|(_, level)| level)
            .unwrap_or(0)
    }

    pub fn crossbow_charge_duration(&self, tag: &Value) -> i32 {
        25 - 5 * self.enchant_level(tag, "quick_charge")
    }

    pub fn use_duration(&self, id: i32, tag: &Value) -> i32 {
        if self.name(id) == "crossbow" {
            return self.crossbow_charge_duration(tag) + 3;
        }
        if let Some(entry) = self.mechanics.get(&id) {
            if let Some(duration) = entry.get("duration").and_then(|v| v.as_i64()) {
                return duration as i32;
            }
        }
        let action = self.use_action(id);
        if action == "eat" || action == "drink" {
            return if self.name(id) == "dried_kelp" { 16 } else { 32 };
        }
        if action == "block" || action == "bow" || action == "spear" {
            return 72000;
        }
        0
    }

    pub fn is_food(&self, id: i32) -> bool {
        if let Some(food) = self.mechanics.get(&id).and_then(|e| e.get("food")) {
            if let Some(flag) = food.as_bool() {
                return flag;
            }
        }
        FOOD_NAMES.contains(&self.name(id).as_str())
    }

    pub fn can_always_eat(&self, id: i32) -> bool {
        self.mechanics
            .get(&id)
            .and_then(|e| e.get("alwaysEat"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }

    pub fn str_vs_block(&self, id: i32, block_name: &str, material: &str) -> f64 {
        if self.def(id).is_none() {
            return 1.0;
        }
        let name = self.name(id);
        if name == "shears" {
            if block_name == "cobweb" || material == "leaves" {
                return 15.0;
            }
            if material == "wool" {
                return 5.0;
            }
            return 1.0;
        }
        if SWORDS.contains(&name.as_str()) {
            if block_name == "cobweb" {
                return 15.0;
            }
            if material == "plant"
                || material == "leaves"
                || matches!(block_name, "vine" | "pumpkin" | "melon")
            {
                return 1.5;
            }
            return 1.0;
        }
        let parts: Vec<&str> = name.split('_').collect();
        if parts.len() == 2 && ["wooden", "stone", "iron", "diamond", "golden"].contains(&parts[0]) {
            let kind = parts[1];
            let wanted: &[&str] = match kind {
                "pickaxe" => &["rock"],
                "axe" => &["wood", "plant"],
                "shovel" => &["dirt"],
                _ => &[],
            };
            if wanted.contains(&material) {
                return match parts[0] {
                    "wooden" => 2.0,
                    "stone" => 4.0,
                    "iron" => 6.0,
                    "diamond" => 8.0,
                    "golden" => 12.0,
                    _ => 1.0,
                };
            }
        }
        1.0
    }

    pub fn can_harvest(&self, id: Option<i32>, harvest_tools: Option<&Value>) -> bool {
        let Some(tools) = harvest_tools else { return true };
        let Some(id) = id else { return false };
        tools
            .get(id.to_string())
            .map(|v| v.as_bool().unwrap_or(false))
            .unwrap_or(false)
    }

    pub fn egg_entity(&self, id: i32, tag: &Value) -> Option<String> {
        let mut entity = tag
            .get("EntityTag")
            .and_then(|e| e.get("id"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        if let Some(ref mut name) = entity {
            if !name.contains(':') {
                *name = format!("minecraft:{}", name);
            }
        }
        let name = self.name(id);
        entity.or_else(|| {
            name.strip_suffix("_spawn_egg").map(|base| format!("minecraft:{}", base))
        })
    }

    pub fn egg_info(&self, id: i32) -> Option<Value> {
        let name = self
            .name(id)
            .strip_suffix("_spawn_egg")
            .unwrap_or(&self.name(id))
            .to_string();
        let old_name = match name.as_str() {
            "evoker" => "evocation_illager".to_string(),
            "vindicator" => "vindication_illager".to_string(),
            other => other.to_string(),
        };
        if let Some(value) = self.eggs.get(&format!("minecraft:{}", name)) {
            return Some(value.clone());
        }
        if let Some((_, colors)) = EGG_ADDITIONS.iter().find(|(key, _)| *key == name) {
            return Some(json!(colors));
        }
        self.eggs.get(&format!("minecraft:{}", old_name)).cloned()
    }

    fn enchantments_of(&self, tag: &Value, book: bool) -> Vec<(String, i32)> {
        let list = if book {
            tag.get("StoredEnchantments")
        } else {
            tag.get("Enchantments")
        };
        let Some(list) = list.and_then(|v| v.as_array()) else { return Vec::new() };
        list.iter()
            .filter_map(|entry| {
                let id = entry.get("id")?.as_str()?;
                Some((resource(id), entry.get("lvl").and_then(|v| v.as_i64()).unwrap_or(0) as i32))
            })
            .collect()
    }

    pub fn enchantments(&self, id: i32, tag: &Value) -> Vec<(String, i32)> {
        self.enchantments_of(tag, self.name(id) == "enchanted_book")
    }

    pub fn is_enchanted(&self, id: i32, tag: &Value) -> bool {
        let name = self.name(id);
        if matches!(
            name.as_str(),
            "enchanted_book" | "enchanted_golden_apple" | "experience_bottle" | "nether_star"
        ) {
            return true;
        }
        !self.enchantments(id, tag).is_empty()
    }

    pub fn has_effect(&self, id: i32, tag: &Value) -> bool {
        let name = self.name(id);
        if matches!(name.as_str(), "potion" | "splash_potion" | "lingering_potion")
            && !self.potion_effects(id, tag).is_empty()
        {
            return true;
        }
        self.is_enchanted(id, tag)
    }

    pub fn potion_type(&self, tag: &Value) -> PotionDef {
        let mut key = tag.get("Potion").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if !key.is_empty() && !key.contains(':') {
            key = format!("minecraft:{}", key);
        }
        let short = key.strip_prefix("minecraft:").unwrap_or(&key).to_string();
        if let Some(def) = potion_additions(&short) {
            return def;
        }
        if let Some(def) = self.potions.get(&key) {
            return def.clone();
        }
        self.potions
            .get("minecraft:empty")
            .cloned()
            .unwrap_or(PotionDef { name: "empty".into(), effects: Vec::new() })
    }

    /// `[{id, duration, amplifier, particles}]`, as `potionEffects` returns.
    pub fn potion_effects(&self, id: i32, tag: &Value) -> Vec<Value> {
        let potion = self.potion_type(tag);
        let mut out: Vec<Value> = potion
            .effects
            .iter()
            .map(|(effect, duration, amplifier)| {
                json!({ "id": effect, "duration": duration, "amplifier": amplifier, "particles": true })
            })
            .collect();
        if let Some(list) = tag.get("CustomPotionEffects").and_then(|v| v.as_array()) {
            for entry in list {
                let effect = entry.get("Id").and_then(|v| v.as_i64()).unwrap_or(0) as i32 & 255;
                if !self.effects.contains_key(&effect) {
                    continue;
                }
                let particles = match entry.get("ShowParticles") {
                    None => true,
                    Some(value) => value.as_bool().unwrap_or(false),
                };
                out.push(json!({
                    "id": effect,
                    "amplifier": entry.get("Amplifier").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    "duration": entry.get("Duration").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    "particles": particles,
                }));
            }
        }
        let _ = id;
        out
    }

    /// `PotionUtils.getColor`.
    pub fn potion_color(&self, id: i32, tag: &Value) -> i64 {
        if let Some(color) = tag.get("CustomPotionColor").and_then(|v| v.as_i64()) {
            return color;
        }
        if self.potion_type(tag).name == "empty" {
            return 0xf800f8;
        }
        self.effects_color(&self.potion_effects(id, tag))
    }

    /// `PotionUtils.getPotionColorFromEffectList`, in float32 like the JS.
    pub fn effects_color(&self, effects: &[Value]) -> i64 {
        if effects.is_empty() {
            return 3694022;
        }
        let f32 = |v: f64| v as f32 as f64;
        let mut r = 0.0f64;
        let mut g = 0.0f64;
        let mut b = 0.0f64;
        let mut n = 0i64;
        for entry in effects {
            if !entry.get("particles").and_then(|v| v.as_bool()).unwrap_or(false) {
                continue;
            }
            let effect = entry.get("id").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let color = self.effects.get(&effect).map(|e| e.color).unwrap_or(0);
            let level = entry.get("amplifier").and_then(|v| v.as_i64()).unwrap_or(0) + 1;
            r = f32(r + f32(f32((level * ((color >> 16) & 255)) as f64) / 255.0));
            g = f32(g + f32(f32((level * ((color >> 8) & 255)) as f64) / 255.0));
            b = f32(b + f32(f32((level * (color & 255)) as f64) / 255.0));
            n += level;
        }
        if n == 0 {
            return 0;
        }
        let channel = |v: f64| (f32(f32(v / n as f64) * 255.0)).trunc() as i64;
        (channel(r) << 16) | (channel(g) << 8) | channel(b)
    }

    /// `Item.getRarity` plus the enchantment bump from `tooltip`.
    pub fn rarity(&self, id: i32, tag: &Value) -> i32 {
        let name = self.name(id);
        let mut rarity = if RARITY_EPIC.contains(&name.as_str()) {
            3
        } else if RARITY_RARE.contains(&name.as_str()) || name.starts_with("music_disc_") {
            2
        } else if RARITY_UNCOMMON.contains(&name.as_str()) {
            1
        } else {
            0
        };
        if !self.enchantments(id, tag).is_empty() {
            rarity = if rarity < 2 { 2 } else { 3 };
        }
        rarity
    }

    /// `Enchantment.getTranslatedName` without the translated level suffix.
    pub fn enchantment_color(&self, id: &str) -> Option<&'static str> {
        let short = id.strip_prefix("minecraft:").unwrap_or(id);
        if short == "binding_curse" || short == "vanishing_curse" {
            Some("§c")
        } else {
            None
        }
    }

    pub fn enchantment_is_single_level(&self, id: &str) -> bool {
        let short = id.strip_prefix("minecraft:").unwrap_or(id);
        if let Some(entry) = self
            .enchantments
            .iter()
            .find(|e| resource(e.get("name").and_then(|v| v.as_str()).unwrap_or("")) == resource(short))
        {
            return entry.get("maxLevel").and_then(|v| v.as_i64()) == Some(1);
        }
        SINGLE_LEVEL.contains(&short)
    }

    pub fn enchantment_key(&self, id: &str) -> String {
        translated_key("enchantment", id)
    }

    pub fn item_key(&self, id: i32) -> String {
        let name = self.name(id);
        let kind = if self.is_block_item(&name) { "block" } else { "item" };
        translated_key(kind, &name)
    }
}

/// `Items.updateMap`: blit a rectangle of columns into a 128×128 colour buffer.
pub fn map_apply_columns(
    colors: &mut [u8],
    x: i32,
    y: i32,
    columns: i32,
    rows: i32,
    data: &[u8],
) {
    if columns <= 0 {
        return;
    }
    for column in 0..columns {
        for row in 0..rows {
            let source = (row * columns + column) as usize;
            if source >= data.len() {
                continue;
            }
            let index = (y + row) * 128 + x + column;
            if index >= 0 && (index as usize) < colors.len() {
                colors[index as usize] = data[source];
            }
        }
    }
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub struct ItemTableCore {
    inner: ItemTable,
}

fn parse_tag(tag_json: &str) -> Value {
    serde_json::from_str(tag_json).unwrap_or(Value::Null)
}

fn parse_json_or_null(text: &str) -> Value {
    serde_json::from_str(text).unwrap_or(Value::Null)
}

#[wasm_bindgen]
impl ItemTableCore {
    #[wasm_bindgen(constructor)]
    pub fn new(json_text: &str) -> Result<ItemTableCore, JsValue> {
        ItemTable::new(json_text)
            .map(|inner| ItemTableCore { inner })
            .map_err(|e| JsValue::from_str(&e))
    }

    pub fn name(&self, id: i32) -> String {
        self.inner.name(id)
    }

    pub fn max_stack(&self, id: i32) -> i32 {
        self.inner.max_stack(id)
    }

    pub fn max_durability(&self, id: i32) -> i32 {
        self.inner.max_durability(id)
    }

    pub fn use_action(&self, id: i32) -> String {
        self.inner.use_action(id)
    }

    pub fn use_duration(&self, id: i32, tag_json: &str) -> i32 {
        self.inner.use_duration(id, &parse_tag(tag_json))
    }

    pub fn is_food(&self, id: i32) -> bool {
        self.inner.is_food(id)
    }

    pub fn can_always_eat(&self, id: i32) -> bool {
        self.inner.can_always_eat(id)
    }

    pub fn str_vs_block(&self, id: i32, block_name: &str, material: &str) -> f64 {
        self.inner.str_vs_block(id, block_name, material)
    }

    pub fn can_harvest(&self, id: i32, harvest_tools_json: &str) -> bool {
        let tools = parse_json_or_null(harvest_tools_json);
        let tools = if tools.is_null() { None } else { Some(&tools) };
        self.inner.can_harvest(Some(id), tools)
    }

    pub fn egg_entity(&self, id: i32, tag_json: &str) -> String {
        self.inner.egg_entity(id, &parse_tag(tag_json)).unwrap_or_default()
    }

    pub fn egg_info(&self, id: i32) -> String {
        match self.inner.egg_info(id) {
            None => "null".into(),
            Some(value) => value.to_string(),
        }
    }

    pub fn enchantments(&self, id: i32, tag_json: &str) -> String {
        json!(self.inner.enchantments(id, &parse_tag(tag_json))).to_string()
    }

    pub fn is_enchanted(&self, id: i32, tag_json: &str) -> bool {
        self.inner.is_enchanted(id, &parse_tag(tag_json))
    }

    pub fn has_effect(&self, id: i32, tag_json: &str) -> bool {
        self.inner.has_effect(id, &parse_tag(tag_json))
    }

    pub fn potion_effects(&self, id: i32, tag_json: &str) -> String {
        json!(self.inner.potion_effects(id, &parse_tag(tag_json))).to_string()
    }

    pub fn potion_color(&self, id: i32, tag_json: &str) -> i64 {
        self.inner.potion_color(id, &parse_tag(tag_json))
    }

    pub fn rarity(&self, id: i32, tag_json: &str) -> i32 {
        self.inner.rarity(id, &parse_tag(tag_json))
    }

    pub fn is_single_level(&self, id: &str) -> bool {
        self.inner.enchantment_is_single_level(id)
    }

    pub fn cursor_color(&self, id: &str) -> String {
        self.inner.enchantment_color(id).unwrap_or("").to_string()
    }

    pub fn item_key(&self, id: i32) -> String {
        self.inner.item_key(id)
    }

    pub fn enchantment_key(&self, id: &str) -> String {
        self.inner.enchantment_key(id)
    }
}

#[wasm_bindgen]
pub fn map_apply_columns_wasm(
    colors: &mut [u8],
    x: i32,
    y: i32,
    columns: i32,
    rows: i32,
    data: &[u8],
) {
    map_apply_columns(colors, x, y, columns, rows, data);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table() -> ItemTable {
        ItemTable::new(
            r#"{
              "items": [
                {"id": 1, "name": "stone"},
                {"id": 2, "name": "iron_pickaxe"},
                {"id": 3, "name": "potion"},
                {"id": 4, "name": "cow_spawn_egg"},
                {"id": 5, "name": "apple"},
                {"id": 6, "name": "crossbow"}
              ],
              "effects": {"1": {"key": "minecraft:speed", "color": 3402751, "bad": false, "modifiers": []}},
              "potions": {
                "minecraft:empty": {"name": "empty", "effects": []},
                "minecraft:swiftness": {"name": "swiftness", "effects": [[1, 3600, 0]]}
              },
              "eggs": {"minecraft:cow": [4470310, 10592673, "cow"]},
              "itemMechanics": {"5": {"action": "eat", "duration": 32, "food": true}},
              "enchantments": [{"id": 0, "name": "minecraft:protection", "maxLevel": 4}]
            }"#,
        )
        .unwrap()
    }

    #[test]
    fn food_and_tool_rules() {
        let items = table();
        assert_eq!(items.use_action(5), "eat");
        assert_eq!(items.use_action(3), "drink");
        assert_eq!(items.use_duration(5, &Value::Null), 32);
        assert_eq!(items.str_vs_block(2, "stone", "rock"), 6.0);
        assert_eq!(items.str_vs_block(1, "stone", "rock"), 1.0);
        assert!(items.is_food(5));
    }

    #[test]
    fn spawn_egg_data_falls_back_to_the_table() {
        let items = table();
        assert_eq!(items.egg_entity(4, &Value::Null).as_deref(), Some("minecraft:cow"));
        assert_eq!(items.egg_info(4), Some(json!([4470310, 10592673, "cow"])));
        let tagged: Value = serde_json::from_str(r#"{"EntityTag":{"id":"minecraft:pig"}}"#).unwrap();
        assert_eq!(items.egg_entity(4, &tagged).as_deref(), Some("minecraft:pig"));
    }

    #[test]
    fn potion_colour_uses_effect_colours() {
        let items = table();
        let tag: Value = serde_json::from_str(r#"{"Potion":"swiftness"}"#).unwrap();
        let effects = items.potion_effects(3, &tag);
        assert_eq!(effects.len(), 1);
        let color = items.effects_color(&effects);
        assert_eq!(color, 3402751);
        assert_eq!(items.potion_color(3, &tag), 3402751);
    }

    #[test]
    fn map_columns_are_blitted() {
        let mut colors = vec![0u8; 128 * 128];
        map_apply_columns(&mut colors, 1, 2, 2, 2, &[9, 8, 7, 6]);
        assert_eq!(colors[2 * 128 + 1], 9);
        assert_eq!(colors[2 * 128 + 2], 8);
        assert_eq!(colors[3 * 128 + 1], 7);
        assert_eq!(colors[3 * 128 + 2], 6);
    }
}
