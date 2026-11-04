//! Port of `client/js/world/blockstates.js`.
//!
//! The 1.13 client receives complete block states, so `resolveState` is a
//! direct name+property lookup. The neighbour-dependent helpers (`stairsShape`,
//! `doorProps`) are still needed by collision, the mesher and the renderer, and
//! the legacy item model table is used by the inventory renderer.

use serde_json::{Map, Value};
use wasm_bindgen::prelude::*;

use crate::blocks::{BlockRegistry, BlockRegistryCore};

pub const HORIZ: [&str; 4] = ["south", "west", "north", "east"];
pub const FACING6: [&str; 6] = ["down", "up", "north", "south", "west", "east"];

pub const COLORS: [&str; 16] = [
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "silver",
    "cyan", "purple", "blue", "brown", "green", "red", "black",
];
pub const WOODS: [&str; 6] = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];

fn dir_index(name: &str) -> Option<usize> {
    match name {
        "down" => Some(0),
        "up" => Some(1),
        "north" => Some(2),
        "south" => Some(3),
        "west" => Some(4),
        "east" => Some(5),
        _ => None,
    }
}

fn opposite_name(name: &str) -> &'static str {
    match name {
        "north" => "south",
        "south" => "north",
        "east" => "west",
        "west" => "east",
        "up" => "down",
        _ => "up",
    }
}

fn rotate_ccw(name: &str) -> &'static str {
    match name {
        "north" => "west",
        "west" => "south",
        "south" => "east",
        _ => "north",
    }
}

fn axis_of(facing: &str) -> &'static str {
    match facing {
        "north" | "south" => "z",
        "east" | "west" => "x",
        _ => "y",
    }
}

pub fn property<'a>(reg: &'a BlockRegistry, state: u32, key: &str, default: &'a str) -> &'a str {
    reg.property(state, key).unwrap_or(default)
}

pub fn stairs_facing(reg: &BlockRegistry, state: u32) -> String {
    property(reg, state, "facing", "north").to_string()
}

pub fn stairs_half(reg: &BlockRegistry, state: u32) -> String {
    property(reg, state, "half", "bottom").to_string()
}

fn is_stairs_same_half(reg: &BlockRegistry, state: u32, half: &str) -> bool {
    reg.def(state).is_stairs && stairs_half(reg, state) == half
}

fn different_stairs(
    reg: &BlockRegistry,
    state: u32,
    neighbours: &[u32],
    dir: &str,
    facing: &str,
    half: &str,
) -> bool {
    let Some(index) = dir_index(dir) else { return true };
    let s = neighbours.get(index).copied().unwrap_or(0);
    !reg.def(s).is_stairs || stairs_facing(reg, s) != facing || stairs_half(reg, s) != half
}

/// `BlockStairs.getActualState` shape selection. `neighbours` are indexed by
/// `DIR_OFFSETS`: down, up, north, south, west, east.
pub fn stairs_shape(reg: &BlockRegistry, state: u32, neighbours: &[u32]) -> String {
    if !reg.def(state).is_stairs {
        return "straight".into();
    }
    let facing = stairs_facing(reg, state);
    let half = stairs_half(reg, state);
    if let Some(back_index) = dir_index(&facing) {
        let back = neighbours.get(back_index).copied().unwrap_or(0);
        if is_stairs_same_half(reg, back, &half) {
            // The JS masks with 15 here; keep it for bit-for-bit parity.
            let f1 = stairs_facing(reg, back & 15);
            if axis_of(&f1) != axis_of(&facing)
                && different_stairs(reg, state, neighbours, opposite_name(&f1), &facing, &half)
            {
                return if f1 == rotate_ccw(&facing) { "outer_left" } else { "outer_right" }.into();
            }
        }
    }
    if let Some(front_index) = dir_index(opposite_name(&facing)) {
        let front = neighbours.get(front_index).copied().unwrap_or(0);
        if is_stairs_same_half(reg, front, &half) {
            let f2 = stairs_facing(reg, front & 15);
            if axis_of(&f2) != axis_of(&facing)
                && different_stairs(reg, state, neighbours, &f2, &facing, &half)
            {
                return if f2 == rotate_ccw(&facing) { "inner_left" } else { "inner_right" }.into();
            }
        }
    }
    "straight".into()
}

#[derive(Clone, Debug, PartialEq)]
pub struct DoorProps {
    pub facing: String,
    pub open: bool,
    pub hinge: String,
    pub powered: bool,
    pub half: String,
}

/// `BlockDoor.getActualState` / `BlockDoor.getStateFromMeta`.
pub fn door_props(reg: &BlockRegistry, state: u32, below: u32, above: u32) -> DoorProps {
    let upper_half = state & 8 != 0;
    let (lower, upper) = if upper_half { (below & 15, state) } else { (state, above & 15) };
    let faces = ["east", "south", "west", "north"];
    DoorProps {
        facing: faces[(lower & 3) as usize].to_string(),
        open: lower & 4 != 0,
        hinge: if upper & 1 != 0 { "right" } else { "left" }.to_string(),
        powered: upper & 2 != 0,
        half: if upper_half { "upper" } else { "lower" }.to_string(),
    }
}

/// Live `resolveState` path: `{file, props}` or `null`.
pub fn resolve_state(
    reg: &BlockRegistry,
    state: u32,
    neighbours: &[u32],
) -> Option<(String, Map<String, Value>)> {
    let def = reg.def(state);
    if !reg.has_model(state) {
        return None;
    }
    let mut props = Map::new();
    if let Some(info) = reg.state_info(state) {
        for (k, v) in &info.properties {
            props.insert(k.clone(), Value::String(v.clone()));
        }
    }
    if def.is_stairs && !props.contains_key("shape") {
        let shape = stairs_shape(reg, state, neighbours);
        props.insert("shape".into(), Value::String(shape));
    }
    Some((def.name.clone(), props))
}

pub fn resolve_state_json(reg: &BlockRegistry, state: u32, neighbours: &[u32]) -> String {
    match resolve_state(reg, state, neighbours) {
        None => "null".into(),
        Some((file, props)) => {
            let mut out = Map::new();
            out.insert("file".into(), Value::String(file));
            out.insert("props".into(), Value::Object(props));
            Value::Object(out).to_string()
        }
    }
}

// -------------------------------------------------------------- item models

const ITEM_RENAME: &[(&str, &str)] = &[
    ("yellow_flower", "dandelion"),
    ("deadbush", "dead_bush"),
    ("web", "web"),
    ("golden_rail", "golden_rail"),
    ("noteblock", "noteblock"),
    ("brick_block", "brick_block"),
    ("mossy_cobblestone", "mossy_cobblestone"),
    ("wooden_door", "oak_door"),
    ("fence", "oak_fence"),
    ("fence_gate", "oak_fence_gate"),
    ("stone_stairs", "stone_stairs"),
    ("oak_stairs", "oak_stairs"),
    ("reeds", "reeds"),
    ("waterlily", "waterlily"),
    ("melon_block", "melon_block"),
    ("speckled_melon", "speckled_melon"),
    ("netherbrick", "netherbrick"),
    ("potion", "bottle_drinkable"),
    ("filled_map", "filled_map"),
    ("fireworks", "fireworks"),
    ("firework_charge", "firework_charge"),
    ("repeater", "repeater"),
    ("comparator", "comparator"),
    ("golden_carrot", "golden_carrot"),
    ("cooked_porkchop", "cooked_porkchop"),
    ("mob_spawner", "mob_spawner"),
    ("red_mushroom_block", "red_mushroom_block"),
    ("brown_mushroom_block", "brown_mushroom_block"),
    ("end_portal_frame", "end_portal_frame"),
    ("trapdoor", "trapdoor"),
    ("daylight_detector", "daylight_detector"),
    ("hardened_clay", "hardened_clay"),
    ("slime", "slime"),
    ("lit_pumpkin", "lit_pumpkin"),
    ("boat", "oak_boat"),
    ("splash_potion", "bottle_splash"),
    ("lingering_potion", "bottle_lingering"),
    ("totem_of_undying", "totem"),
    ("light_gray_shulker_box", "silver_shulker_box"),
    ("light_gray_glazed_terracotta", "silver_glazed_terracotta"),
];

fn variants(item: &str) -> Option<Vec<String>> {
    let colors = || COLORS.iter().map(|c| c.to_string()).collect::<Vec<_>>();
    let woods = || WOODS.iter().map(|w| w.to_string()).collect::<Vec<_>>();
    let list = match item {
        "stone" => vec!["stone", "granite", "granite_smooth", "diorite", "diorite_smooth", "andesite", "andesite_smooth"],
        "dirt" => vec!["dirt", "coarse_dirt", "podzol"],
        "planks" => return Some(woods().iter().map(|w| format!("{}_planks", w)).collect()),
        "sapling" => return Some(woods().iter().map(|w| format!("{}_sapling", w)).collect()),
        "sand" => vec!["sand", "red_sand"],
        "log" => return Some(woods()[..4].iter().map(|w| format!("{}_log", w)).collect()),
        "log2" => return Some(vec!["acacia_log".into(), "dark_oak_log".into()]),
        "leaves" => return Some(woods()[..4].iter().map(|w| format!("{}_leaves", w)).collect()),
        "leaves2" => return Some(vec!["acacia_leaves".into(), "dark_oak_leaves".into()]),
        "sponge" => vec!["sponge", "sponge_wet"],
        "sandstone" => vec!["sandstone", "chiseled_sandstone", "smooth_sandstone"],
        "red_sandstone" => vec!["red_sandstone", "chiseled_red_sandstone", "smooth_red_sandstone"],
        "tallgrass" => vec!["dead_bush", "tall_grass", "fern"],
        "wool" => return Some(colors().iter().map(|c| format!("{}_wool", c)).collect()),
        "carpet" => return Some(colors().iter().map(|c| format!("{}_carpet", c)).collect()),
        "stained_glass" => return Some(colors().iter().map(|c| format!("{}_stained_glass", c)).collect()),
        "stained_glass_pane" => return Some(colors().iter().map(|c| format!("{}_stained_glass_pane", c)).collect()),
        "stained_hardened_clay" => return Some(colors().iter().map(|c| format!("{}_stained_hardened_clay", c)).collect()),
        "red_flower" => vec!["poppy", "blue_orchid", "allium", "houstonia", "red_tulip", "orange_tulip", "white_tulip", "pink_tulip", "oxeye_daisy"],
        "yellow_flower" => vec!["dandelion"],
        "stone_slab" => vec!["stone_slab", "sandstone_slab", "oak_slab", "cobblestone_slab", "brick_slab", "stone_brick_slab", "nether_brick_slab", "quartz_slab"],
        "stone_slab2" => vec!["red_sandstone_slab"],
        "wooden_slab" => return Some(woods().iter().map(|w| format!("{}_slab", w)).collect()),
        "monster_egg" => vec!["stone_monster_egg", "cobblestone_monster_egg", "stone_brick_monster_egg", "mossy_brick_monster_egg", "cracked_brick_monster_egg", "chiseled_brick_monster_egg"],
        "stonebrick" => vec!["stonebrick", "mossy_stonebrick", "cracked_stonebrick", "chiseled_stonebrick"],
        "cobblestone_wall" => vec!["cobblestone_wall", "mossy_cobblestone_wall"],
        "quartz_block" => vec!["quartz_block", "chiseled_quartz_block", "quartz_column"],
        "anvil" => vec!["anvil_intact", "anvil_slightly_damaged", "anvil_very_damaged"],
        "prismarine" => vec!["prismarine", "prismarine_bricks", "dark_prismarine"],
        "double_plant" => vec!["sunflower", "syringa", "double_grass", "double_fern", "double_rose", "paeonia"],
        "dye" => vec!["dye_black", "dye_red", "dye_green", "dye_brown", "dye_blue", "dye_purple", "dye_cyan", "dye_silver", "dye_gray", "dye_pink", "dye_lime", "dye_yellow", "dye_light_blue", "dye_magenta", "dye_orange", "dye_white"],
        "coal" => vec!["coal", "charcoal"],
        "golden_apple" => vec!["golden_apple", "golden_apple"],
        "fish" => vec!["cod", "salmon", "clownfish", "pufferfish"],
        "cooked_fish" => vec!["cooked_cod", "cooked_salmon"],
        "concrete" => return Some(colors().iter().map(|c| format!("{}_concrete", c)).collect()),
        "concrete_powder" => return Some(colors().iter().map(|c| format!("{}_concrete_powder", c)).collect()),
        "skull" => vec!["skull_skeleton", "skull_wither", "skull_zombie", "skull_char", "skull_creeper", "skull_dragon"],
        _ => return None,
    };
    Some(list.iter().map(|s| s.to_string()).collect())
}

pub fn item_model_name(item: &str, damage: u32) -> String {
    if let Some(list) = variants(item) {
        return list.get(damage as usize).cloned().unwrap_or_else(|| list[0].clone());
    }
    if item == "potion" {
        return "bottle_drinkable".into();
    }
    if let Some((_, renamed)) = ITEM_RENAME.iter().find(|(k, _)| *k == item) {
        return renamed.to_string();
    }
    item.to_string()
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub fn stairs_shape_wasm(reg: &BlockRegistryCore, state: u32, neighbours: &[u32]) -> String {
    stairs_shape(reg.registry(), state, neighbours)
}

#[wasm_bindgen]
pub fn door_props_wasm(reg: &BlockRegistryCore, state: u32, below: u32, above: u32) -> String {
    let p = door_props(reg.registry(), state, below, above);
    let mut out = Map::new();
    out.insert("facing".into(), Value::String(p.facing));
    out.insert("open".into(), Value::Bool(p.open));
    out.insert("hinge".into(), Value::String(p.hinge));
    out.insert("powered".into(), Value::Bool(p.powered));
    out.insert("half".into(), Value::String(p.half));
    Value::Object(out).to_string()
}

#[wasm_bindgen]
pub fn resolve_state_wasm(reg: &BlockRegistryCore, state: u32, neighbours: &[u32]) -> String {
    resolve_state_json(reg.registry(), state, neighbours)
}

#[wasm_bindgen]
pub fn item_model_name_wasm(item: &str, damage: u32) -> String {
    item_model_name(item, damage)
}


#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn registry() -> BlockRegistry {
        let blocks = fs::read_to_string("../../client/data/blocks.json").unwrap();
        let shapes = fs::read_to_string("../../client/data/blockCollisionShapes.json").unwrap();
        BlockRegistry::new(&blocks, &shapes).unwrap()
    }

    #[test]
    fn stair_shapes_depend_on_the_back_neighbour() {
        let reg = registry();
        let state = reg.find_state("oak_stairs", r#"{"facing":"north","half":"bottom","shape":"straight"}"#);
        let mut neighbours = [0u32; 6];
        assert_eq!(stairs_shape(&reg, state, &neighbours), "straight");
        // The JS masks the neighbour state with 15 before reading its facing; a
        // modern state id therefore falls back to the default "north" and the
        // shape stays straight. The differential suite pins that behaviour.
        neighbours[2] = reg.find_state("oak_stairs", r#"{"facing":"west","half":"bottom"}"#);
        assert_eq!(stairs_shape(&reg, state, &neighbours), "straight");
    }

    #[test]
    fn door_halves_merge() {
        let reg = registry();
        let lower = 0b0101; // facing east, open
        let props = door_props(&reg, lower, 0, 0b0010_0001);
        assert_eq!(props.facing, "south");
        assert!(props.open);
        assert_eq!(props.hinge, "right");
    }

    #[test]
    fn item_model_names_follow_damage() {
        assert_eq!(item_model_name("stone", 1), "granite");
        assert_eq!(item_model_name("planks", 5), "dark_oak_planks");
        assert_eq!(item_model_name("potion", 0), "bottle_drinkable");
        assert_eq!(item_model_name("boat", 0), "oak_boat");
        assert_eq!(item_model_name("apple", 0), "apple");
    }
}
