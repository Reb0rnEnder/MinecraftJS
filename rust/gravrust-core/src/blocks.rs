//! Port of `client/js/world/blocks.js`: the 1.13.2 block registry.
//!
//! The JavaScript registry flattens `blocks.json` into per-block definitions
//! and per-state property maps, then overlays the native 1.15.2 render
//! properties from `blockCollisionShapes.json`. This module reproduces that
//! construction exactly, including the light-opacity fixups and the
//! per-state render overrides, and exposes the shape table used by collision
//! and ray tracing.

use std::collections::HashMap;

use serde_json::Value;
use wasm_bindgen::prelude::*;

pub const DIR_OFFSETS: [[i32; 3]; 6] = [
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
    [-1, 0, 0],
    [1, 0, 0],
];
pub const DIR_NAMES: [&str; 6] = ["down", "up", "north", "south", "west", "east"];
pub const OPPOSITE: [usize; 6] = [1, 0, 3, 2, 5, 4];

const NOT_OPAQUE: &[&str] = &[
    "glass", "ice", "chest", "trapped_chest", "ender_chest", "cactus", "cake", "snow", "farmland",
    "enchanting_table", "end_portal_frame", "brewing_stand", "cauldron", "hopper", "anvil",
    "daylight_detector", "carpet", "skull", "flower_pot", "trapdoor", "iron_trapdoor", "ladder",
    "piston_head", "dragon_egg", "cocoa", "repeater", "comparator", "waterlily", "cobweb",
    "end_portal", "nether_portal", "tripwire", "tripwire_hook", "vine", "redstone_wire", "piston",
    "sticky_piston", "end_rod", "chorus_plant", "chorus_flower", "grass_path", "frosted_ice",
    "structure_void", "end_gateway", "slime_block", "barrier", "beacon", "mob_spawner",
    "redstone_torch", "torch", "fire", "kelp", "kelp_plant", "seagrass", "tall_seagrass",
    "dead_bush", "dandelion", "poppy", "brown_mushroom", "red_mushroom", "sunflower", "lilac",
    "rose_bush", "peony", "tall_grass", "large_fern", "turtle_egg", "snow", "white_bed",
    "white_banner", "white_wall_banner",
];

const TRANSLUCENT: &[&str] = &["water", "lava", "ice", "frosted_ice", "slime_block", "nether_portal"];

const COLORS: [&str; 16] = [
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray",
    "cyan", "purple", "blue", "brown", "green", "red", "black",
];

fn head_blocks() -> Vec<String> {
    let mut out = Vec::new();
    for base in ["skeleton", "wither_skeleton", "zombie", "player", "creeper", "dragon"] {
        let suffix = if base == "skeleton" || base == "wither_skeleton" { "skull" } else { "head" };
        out.push(format!("{}_{}", base, suffix));
        out.push(format!("{}_wall_{}", base, suffix));
    }
    out
}

fn shulker_boxes() -> Vec<String> {
    COLORS.iter().map(|c| format!("{}_shulker_box", c)).collect()
}

fn replaceable() -> Vec<&'static str> {
    vec![
        "air", "water", "lava", "tall_grass", "dead_bush", "vine", "fire", "snow", "kelp",
        "kelp_plant", "seagrass", "tall_seagrass", "dandelion", "poppy", "blue_orchid", "allium",
        "azure_bluet", "red_tulip", "orange_tulip", "white_tulip", "pink_tulip", "oxeye_daisy",
        "brown_mushroom", "red_mushroom", "sunflower", "lilac", "rose_bush", "peony", "large_fern",
        "wheat", "carrots", "potatoes", "beetroots", "sweet_berry_bush",
    ]
}

#[derive(Clone, Debug)]
pub struct StateInfo {
    pub id: u32,
    pub block_id: u32,
    pub name: String,
    pub properties: Vec<(String, String)>,
}

#[derive(Clone, Debug)]
pub struct BlockDef {
    pub id: u32,
    pub name: String,
    pub is_air: bool,
    pub material: Option<String>,
    pub min_state_id: u32,
    pub max_state_id: u32,
    pub default_state: u32,
    pub emit_light: u8,
    pub filter_light: u8,
    pub bounding_box: String,
    pub opaque: bool,
    pub suffocates: bool,
    pub translucent: bool,
    pub has_model: bool,
    pub is_stairs: bool,
    pub is_fence: bool,
    pub is_fence_gate: bool,
    pub is_pane: bool,
    pub is_wall: bool,
    pub is_door: bool,
    pub is_liquid: bool,
    pub is_water: bool,
    pub is_lava: bool,
    pub replaceable: bool,
    pub slipperiness: f64,
    pub shape: Option<Value>,
    pub use_neighbor_brightness: bool,
    pub ao_light: f64,
}

#[derive(Clone, Debug, Default)]
pub struct RenderProps {
    pub render_type: i64,
    pub solid: bool,
    pub suffocates: bool,
    pub occludes: bool,
    pub light_block: u8,
    pub shade: f64,
    pub emission: u8,
    pub collision_full: bool,
    pub use_neighbor_brightness: bool,
}

#[derive(Clone, Debug)]
pub struct BlockRegistry {
    pub blocks: Vec<BlockDef>,
    pub by_name: HashMap<String, usize>,
    pub states: Vec<StateInfo>,
    pub render: Vec<Option<RenderProps>>,
    pub shapes: HashMap<String, Vec<[f64; 6]>>,
    /// Per-state override for the default state only, matching `Object.assign(def, overrides)`.
    pub default_render: Vec<Option<RenderProps>>,
}

impl BlockRegistry {
    pub fn new(blocks_json: &str, shapes_json: &str) -> Result<BlockRegistry, String> {
        let blocks_value: Value =
            serde_json::from_str(blocks_json).map_err(|e| format!("blocks.json: {e}"))?;
        let shapes_value: Value =
            serde_json::from_str(shapes_json).map_err(|e| format!("shapes: {e}"))?;
        let list = blocks_value.as_array().ok_or("blocks.json is not an array")?;

        let not_opaque: Vec<&str> = NOT_OPAQUE.to_vec();
        let translucent: Vec<&str> = TRANSLUCENT.to_vec();
        let heads = head_blocks();
        let shulkers = shulker_boxes();
        let repl = replaceable();

        let mut blocks: Vec<BlockDef> = Vec::with_capacity(list.len());
        let mut by_name = HashMap::new();
        let mut states: Vec<StateInfo> = Vec::new();

        for item in list {
            let name = item["name"].as_str().ok_or("block without name")?.to_string();
            let id = item["id"].as_u64().ok_or("block without id")? as u32;
            let material = item["material"].as_str().map(|s| s.to_string());
            let min_state = item["minStateId"].as_u64().unwrap_or(id as u64) as u32;
            let max_state = item["maxStateId"].as_u64().unwrap_or(id as u64) as u32;
            let default_state = item["defaultState"].as_u64().unwrap_or(id as u64) as u32;
            let bounding_box = item["boundingBox"].as_str().unwrap_or("block").to_string();
            let transparent = item["transparent"].as_bool().unwrap_or(false);
            let emit_light = item["emitLight"].as_u64().unwrap_or(0) as u8;
            let filter_light = item["filterLight"].as_u64().unwrap_or(15) as u8;

            let is_air = matches!(name.as_str(), "air" | "cave_air" | "void_air");
            let is_stairs = name.ends_with("_stairs");
            let is_fence = name.ends_with("_fence");
            let is_fence_gate = name.ends_with("_fence_gate");
            let is_pane = name.ends_with("_pane") || name == "iron_bars";
            let is_door = name.ends_with("_door");
            let is_liquid = matches!(name.as_str(), "water" | "lava" | "bubble_column");
            let is_water = matches!(name.as_str(), "water" | "bubble_column");
            let opaque = bounding_box == "block"
                && !transparent
                && !not_opaque.contains(&name.as_str())
                && id != 0;

            let mut has_model = !matches!(
                name.as_str(),
                "air" | "water" | "lava" | "chest" | "trapped_chest" | "ender_chest" | "sign"
                    | "wall_sign" | "skull" | "white_bed" | "white_banner" | "white_wall_banner"
                    | "moving_piston" | "barrier" | "end_portal" | "structure_void" | "end_gateway"
                    | "conduit" | "bubble_column" | "void_air" | "cave_air"
            );
            if name.ends_with("_bed")
                || name.ends_with("_banner")
                || name.ends_with("_wall_banner")
                || name.ends_with("_shulker_box")
                || heads.contains(&name)
                || shulkers.contains(&name)
            {
                has_model = false;
            }

            let replaceable = repl.contains(&name.as_str())
                || (material.as_deref() == Some("plant") && bounding_box == "empty" && {
                    let re = ["sapling", "wheat", "carrots", "potatoes", "stem", "wart", "flower", "mushroom"];
                    !re.iter().any(|p| name.contains(p))
                });

            let slipperiness = if name == "blue_ice" {
                0.989
            } else if matches!(name.as_str(), "ice" | "packed_ice" | "frosted_ice") {
                0.98
            } else if name == "slime_block" {
                0.8
            } else {
                0.6
            };

            let shape = shapes_value["blocks"].get(name.as_str()).cloned();
            let def = BlockDef {
                id,
                name: name.clone(),
                is_air,
                material,
                min_state_id: min_state,
                max_state_id: max_state,
                default_state,
                emit_light,
                filter_light,
                bounding_box,
                opaque,
                suffocates: false,
                translucent: translucent.contains(&name.as_str())
                    || name.ends_with("_stained_glass")
                    || name.ends_with("_stained_glass_pane"),
                has_model,
                is_stairs,
                is_fence,
                is_fence_gate,
                is_pane,
                is_wall: name == "cobblestone_wall",
                is_door,
                is_liquid,
                is_water,
                is_lava: name == "lava",
                replaceable,
                slipperiness,
                shape,
                use_neighbor_brightness: false,
                ao_light: if opaque { 0.2 } else { 1.0 },
            };

            let state_props = item["states"].as_array().cloned().unwrap_or_default();
            for state in min_state..=max_state {
                let mut index = (state - min_state) as i64;
                let mut props: Vec<(String, String)> = Vec::new();
                for prop in state_props.iter().rev() {
                    let pname = prop["name"].as_str().unwrap_or("").to_string();
                    let values: Vec<String> = state_property_values(prop);
                    let value = if values.is_empty() { None } else { Some(values[index as usize % values.len()].clone()) };
                    if let Some(v) = value {
                        props.push((pname, v));
                    }
                    if !values.is_empty() {
                        index /= values.len() as i64;
                    }
                }
                states.push(StateInfo { id: state, block_id: id, name: name.clone(), properties: props });
            }

            by_name.insert(name.clone(), blocks.len());
            blocks.push(def);
        }

        // Light opacity fixups, in the same order as initBlocks.
        for def in blocks.iter_mut() {
            if !def.opaque && def.bounding_box == "empty" && !def.is_liquid {
                def.filter_light = 0;
            }
        }
        for def in blocks.iter_mut() {
            if def.name.ends_with("_leaves") || def.name == "cobweb" {
                def.filter_light = 1;
            }
        }
        for def in blocks.iter_mut() {
            if matches!(def.name.as_str(), "water" | "bubble_column" | "ice") {
                def.filter_light = 3;
            }
        }
        if let Some(def) = blocks.iter_mut().find(|b| b.name == "turtle_egg") {
            def.filter_light = 0;
        }
        for def in blocks.iter_mut() {
            if def.name.ends_with("_slab") || def.is_stairs || def.name == "farmland" {
                def.filter_light = 15;
                def.use_neighbor_brightness = true;
            }
        }
        if let Some(def) = blocks.iter_mut().find(|b| b.name == "grass_path") {
            def.filter_light = 15;
            def.use_neighbor_brightness = true;
        }

        // Native render property overrides (one entry per state).
        let mut render: Vec<Option<RenderProps>> = vec![None; states.len()];
        let mut default_render: Vec<Option<RenderProps>> = vec![None; blocks.len()];
        if let Some(rendering) = shapes_value.get("render") {
            if let (Some(state_index), Some(values)) =
                (rendering["states"].as_array(), rendering["values"].as_array())
            {
                if state_index.len() != states.len() {
                    return Err("Incomplete native block render properties; regenerate runtime data".into());
                }
                for (i, entry) in state_index.iter().enumerate() {
                    let idx = entry.as_u64().ok_or("bad render index")? as usize;
                    let value = values.get(idx).ok_or("bad render value")?;
                    let def = &blocks[states[i].block_id as usize];
                    let props = RenderProps {
                        render_type: value["renderType"].as_i64().unwrap_or(0),
                        solid: value["solid"].as_bool().unwrap_or(false),
                        suffocates: value["suffocates"]
                            .as_bool()
                            .or_else(|| value["viewBlocking"].as_bool())
                            .unwrap_or(false),
                        occludes: value["occludes"].as_bool().unwrap_or(false),
                        light_block: value["lightBlock"].as_u64().unwrap_or(0) as u8,
                        shade: value["shade"].as_f64().unwrap_or(1.0),
                        emission: value["emission"].as_u64().unwrap_or(0) as u8,
                        collision_full: value["collisionFull"].as_bool().unwrap_or(false),
                        use_neighbor_brightness: !value["solid"].as_bool().unwrap_or(false)
                            && !value["collisionFull"].as_bool().unwrap_or(false)
                            && !def.is_liquid,
                    };
                    if states[i].id == def.default_state {
                        default_render[states[i].block_id as usize] = Some(props.clone());
                    }
                    render[i] = Some(props);
                }
                for (i, def) in blocks.iter_mut().enumerate() {
                    if let Some(props) = default_render[i].clone() {
                        def.opaque = props.solid;
                        def.suffocates = props.suffocates;
                        def.filter_light = props.light_block;
                        def.emit_light = props.emission;
                        def.ao_light = props.shade;
                        def.use_neighbor_brightness = props.use_neighbor_brightness;
                    }
                }
            }
        }

        // Shapes from the data file, indexed by shape id.
        let mut shapes: HashMap<String, Vec<[f64; 6]>> = HashMap::new();
        if let Some(map) = shapes_value["shapes"].as_object() {
            for (key, list) in map {
                let mut boxes = Vec::new();
                if let Some(items) = list.as_array() {
                    for b in items {
                        if let Some(coords) = b.as_array() {
                            if coords.len() == 6 {
                                boxes.push([
                                    coords[0].as_f64().unwrap_or(0.0),
                                    coords[1].as_f64().unwrap_or(0.0),
                                    coords[2].as_f64().unwrap_or(0.0),
                                    coords[3].as_f64().unwrap_or(0.0),
                                    coords[4].as_f64().unwrap_or(0.0),
                                    coords[5].as_f64().unwrap_or(0.0),
                                ]);
                            }
                        }
                    }
                }
                shapes.insert(key.clone(), boxes);
            }
        }

        Ok(BlockRegistry { blocks, by_name, states, render, shapes, default_render })
    }

    pub fn state(&self, state: u32) -> &StateInfo {
        &self.states[state as usize]
    }

    pub fn state_info(&self, state: u32) -> Option<&StateInfo> {
        self.states.get(state as usize)
    }

    pub fn def(&self, state: u32) -> &BlockDef {
        match self.states.get(state as usize) {
            Some(info) => &self.blocks[info.block_id as usize],
            None => &self.blocks[0],
        }
    }

    pub fn property(&self, state: u32, key: &str) -> Option<&str> {
        self.state_info(state).and_then(|s| {
            s.properties.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str())
        })
    }

    pub fn opaque(&self, state: u32) -> bool {
        match self.render.get(state as usize).and_then(|r| r.as_ref()) {
            Some(props) => props.solid,
            None => self.def(state).opaque,
        }
    }

    pub fn filter_light(&self, state: u32) -> u8 {
        match self.render.get(state as usize).and_then(|r| r.as_ref()) {
            Some(props) => props.light_block,
            None => self.def(state).filter_light,
        }
    }

    pub fn emit_light(&self, state: u32) -> u8 {
        match self.render.get(state as usize).and_then(|r| r.as_ref()) {
            Some(props) => props.emission,
            None => self.def(state).emit_light,
        }
    }

    pub fn has_model(&self, state: u32) -> bool {
        match self.render.get(state as usize).and_then(|r| r.as_ref()) {
            Some(props) => props.render_type == 2,
            None => self.def(state).has_model,
        }
    }

    pub fn name(&self, state: u32) -> &str {
        self.state_info(state).map(|s| s.name.as_str()).unwrap_or("air")
    }

    pub fn find_state(&self, name: &str, props_json: &str) -> u32 {
        let Some(&index) = self.by_name.get(name) else { return 0 };
        let def = &self.blocks[index];
        let wanted: Value = serde_json::from_str(props_json).unwrap_or(Value::Null);
        let wanted_obj = wanted.as_object();
        for state in def.min_state_id..=def.max_state_id {
            if let Some(info) = self.state_info(state) {
                let mut ok = true;
                if let Some(map) = wanted_obj {
                    for (key, value) in map {
                        let textual = match value {
                            Value::String(s) => s.clone(),
                            Value::Bool(b) => b.to_string(),
                            Value::Number(n) => n.to_string(),
                            _ => value.to_string(),
                        };
                        let actual = info
                            .properties
                            .iter()
                            .find(|(k, _)| k == key)
                            .map(|(_, v)| v.as_str())
                            .unwrap_or("");
                        if actual != textual {
                            ok = false;
                            break;
                        }
                    }
                }
                if ok {
                    return state;
                }
            }
        }
        def.default_state
    }

    /// Static collision boxes for a state, in block-local 0..1 coordinates.
    pub fn static_collision_boxes(&self, state: u32) -> Vec<[f64; 6]> {
        let def = self.def(state);
        let Some(shape) = &def.shape else { return Vec::new() };
        let key = if let Some(array) = shape.as_array() {
            let meta = state.saturating_sub(def.min_state_id) as usize;
            array
                .get(meta)
                .or_else(|| array.first())
                .cloned()
                .unwrap_or(Value::Null)
        } else {
            shape.clone()
        };
        let key = match key {
            Value::Number(n) => n.to_string(),
            Value::String(s) => s,
            _ => return Vec::new(),
        };
        self.shapes.get(&key).cloned().unwrap_or_default()
    }

    pub fn props_json(&self, state: u32) -> String {
        let mut map = serde_json::Map::new();
        if let Some(info) = self.state_info(state) {
            for (k, v) in &info.properties {
                map.insert(k.clone(), Value::String(v.clone()));
            }
        }
        Value::Object(map).to_string()
    }
}

fn state_property_values(prop: &Value) -> Vec<String> {
    match prop["type"].as_str().unwrap_or("") {
        "bool" => vec!["true".into(), "false".into()],
        "int" => (0..prop["num_values"].as_u64().unwrap_or(0))
            .map(|i| i.to_string())
            .collect(),
        _ => prop["values"]
            .as_array()
            .map(|values| values.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
    }
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub struct BlockRegistryCore {
    inner: BlockRegistry,
}

impl BlockRegistryCore {
    pub fn registry(&self) -> &BlockRegistry {
        &self.inner
    }

    /// Wrap an existing registry (used by Rust-side renderers that hold one).
    pub fn from_registry(inner: BlockRegistry) -> Self {
        BlockRegistryCore { inner }
    }
}

#[wasm_bindgen]
impl BlockRegistryCore {
    #[wasm_bindgen(constructor)]
    pub fn new(blocks_json: &str, shapes_json: &str) -> Result<BlockRegistryCore, JsValue> {
        BlockRegistry::new(blocks_json, shapes_json)
            .map(|inner| BlockRegistryCore { inner })
            .map_err(|e| JsValue::from_str(&e))
    }

    pub fn state_count(&self) -> u32 {
        self.inner.states.len() as u32
    }

    pub fn state_name(&self, state: u32) -> String {
        self.inner.name(state).to_string()
    }

    pub fn block_name(&self, state: u32) -> String {
        self.inner.def(state).name.clone()
    }

    pub fn block_id(&self, state: u32) -> u32 {
        self.inner.def(state).id
    }

    pub fn properties_json(&self, state: u32) -> String {
        self.inner.props_json(state)
    }

    pub fn find_state(&self, name: &str, props_json: &str) -> u32 {
        self.inner.find_state(name, props_json)
    }

    pub fn collision_boxes(&self, state: u32) -> Vec<f64> {
        let mut out = Vec::new();
        for b in self.inner.static_collision_boxes(state) {
            out.extend_from_slice(&b);
        }
        out
    }

    pub fn opaque(&self, state: u32) -> bool {
        self.inner.opaque(state)
    }

    pub fn filter_light(&self, state: u32) -> u32 {
        self.inner.filter_light(state) as u32
    }

    pub fn emit_light(&self, state: u32) -> u32 {
        self.inner.emit_light(state) as u32
    }

    pub fn has_model(&self, state: u32) -> bool {
        self.inner.has_model(state)
    }

    pub fn is_stairs(&self, state: u32) -> bool {
        self.inner.def(state).is_stairs
    }

    pub fn is_liquid(&self, state: u32) -> bool {
        self.inner.def(state).is_liquid
    }

    pub fn slipperiness(&self, state: u32) -> f64 {
        self.inner.def(state).slipperiness
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn load() -> BlockRegistry {
        let blocks = fs::read_to_string("../../client/data/blocks.json").unwrap();
        let shapes = fs::read_to_string("../../client/data/blockCollisionShapes.json").unwrap();
        BlockRegistry::new(&blocks, &shapes).unwrap()
    }

    #[test]
    fn builds_the_flattened_state_table() {
        let reg = load();
        assert_eq!(reg.states.len(), 11337);
        assert_eq!(reg.blocks.len(), 680);
        assert_eq!(reg.name(0), "air");
        assert_eq!(reg.name(1), "stone");
        assert_eq!(reg.def(1).id, 1);
    }

    #[test]
    fn decodes_state_properties() {
        let reg = load();
        let state = reg.find_state("oak_stairs", r#"{"facing":"north","half":"bottom"}"#);
        assert_eq!(reg.property(state, "facing"), Some("north"));
        assert_eq!(reg.property(state, "half"), Some("bottom"));
        assert_eq!(reg.property(state, "shape"), Some("straight"));
        assert!(reg.def(state).is_stairs);
    }

    #[test]
    fn reproduces_collision_boxes() {
        let reg = load();
        let stone = reg.find_state("stone", "{}");
        assert_eq!(reg.static_collision_boxes(stone), vec![[0.0, 0.0, 0.0, 1.0, 1.0, 1.0]]);
        let slab = reg.find_state("oak_slab", r#"{"type":"bottom"}"#);
        let boxes = reg.static_collision_boxes(slab);
        assert!(boxes[0][4] < 1.0);
    }

    #[test]
    fn applies_light_fixups() {
        let reg = load();
        let water = reg.find_state("water", "{}");
        assert_eq!(reg.filter_light(water), 1); // render properties override the 1.8 fixup, as in JS
        let leaves = reg.find_state("oak_leaves", "{}");
        assert_eq!(reg.filter_light(leaves), 1);
        let grass = reg.find_state("grass_block", "{}");
        assert_eq!(reg.filter_light(grass), 15);
    }
}
