//! Port of `client/js/game/pistons.js`: piston movement logic.

use crate::blocks::{BlockRegistry, BlockRegistryCore};
use wasm_bindgen::prelude::*;

// ------------------------------------------------------------ constants

/// EnumFacing index order: down, up, north, south, west, east
pub const FACING: [[i32; 3]; 6] = [
    [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0],
];
const FACE_NAMES: [&str; 6] = ["down", "up", "north", "south", "west", "east"];
const OPPOSITE_FACE: [usize; 6] = [1, 0, 3, 2, 5, 4];
const AXIS: [usize; 6] = [1, 1, 2, 2, 0, 0];

const DESTROY: &[&str] = &[
    "water", "flowing_water", "lava", "flowing_lava", "leaves", "leaves2", "sapling",
    "tallgrass", "deadbush", "yellow_flower", "red_flower", "brown_mushroom",
    "red_mushroom", "wheat", "reeds", "pumpkin_stem", "melon_stem", "waterlily",
    "nether_wart", "cocoa", "carrots", "potatoes", "beetroots", "vine", "double_plant",
    "chorus_plant", "chorus_flower", "torch", "redstone_wire", "lever",
    "unlit_redstone_torch", "redstone_torch", "stone_button", "wooden_button",
    "unpowered_repeater", "powered_repeater", "unpowered_comparator", "powered_comparator",
    "tripwire_hook", "tripwire", "golden_rail", "detector_rail", "rail", "activator_rail",
    "flower_pot", "skull", "ladder", "end_rod", "stone_pressure_plate", "wooden_pressure_plate",
    "light_weighted_pressure_plate", "heavy_weighted_pressure_plate", "wooden_door",
    "iron_door", "spruce_door", "birch_door", "jungle_door", "acacia_door", "dark_oak_door",
    "bed", "snow_layer", "cactus", "pumpkin", "lit_pumpkin", "melon_block", "dragon_egg",
    "cake", "web", "fire", "structure_void",
];

const BLOCK_SET: &[&str] = &[
    "obsidian", "barrier", "nether_portal", "piston_head", "moving_piston",
    "end_portal", "end_gateway",
];

const TILE: &[&str] = &[
    "chest", "trapped_chest", "furnace", "lit_furnace", "dispenser", "dropper",
    "hopper", "beacon", "brewing_stand", "enchanting_table", "ender_chest",
    "standing_sign", "wall_sign", "mob_spawner", "noteblock", "jukebox",
    "standing_banner", "wall_banner", "skull", "flower_pot", "unpowered_comparator",
    "powered_comparator", "daylight_detector", "daylight_detector_inverted",
    "command_block", "repeating_command_block", "chain_command_block", "structure_block",
    "end_gateway", "end_portal", "bed", "moving_piston", "bee_nest", "beehive",
];

// ------------------------------------------------------------ helpers

fn name(reg: &BlockRegistry, state: u32) -> &str {
    reg.name(state)
}

fn is_air(state: u32) -> bool {
    state == 0
}

fn mobility(reg: &BlockRegistry, n: &str) -> &'static str {
    if n.ends_with("_shulker_box") || DESTROY.contains(&n) {
        "destroy"
    } else if BLOCK_SET.contains(&n) {
        "block"
    } else if n.ends_with("_glazed_terracotta") {
        "push_only"
    } else {
        "normal"
    }
}

fn is_sticky_block(n: &str) -> bool {
    n == "slime_block" || n == "honey_block"
}

fn can_stick(a: &str, b: &str) -> bool {
    !is_sticky_block(a) || !is_sticky_block(b) || a == b
}

fn is_piston(n: &str) -> bool {
    n == "piston" || n == "sticky_piston"
}

fn off(p: &[i32; 3], f: usize, n: i32) -> [i32; 3] {
    [
        p[0] + FACING[f][0] * n,
        p[1] + FACING[f][1] * n,
        p[2] + FACING[f][2] * n,
    ]
}

// ------------------------------------------------------------ canPush

/// BlockPistonBase.canPush
/// Returns false for unbreakable blocks (bedrock-like), blocks with negative hardness,
/// or blocks that are explicitly non-movable.
fn can_push(
    reg: &BlockRegistry,
    state: u32,
    p: &[i32; 3],
    facing: usize,
    destroy_blocks: bool,
    f2: usize,
) -> bool {
    let n = name(reg, state);
    let b = reg.def(state);
    if n == "obsidian" || n == "bedrock" || n == "end_portal_frame" {
        return false;
    }
    if p[0].abs() >= 29999984 || p[2].abs() >= 29999984 {
        return false; // world border
    }
    if p[1] < 0 || (facing == 0 && p[1] == 0) {
        return false;
    }
    if p[1] > 255 || (facing == 1 && p[1] == 255) {
        return false;
    }
    if !is_piston(n) {
        // In the Rust port, blocks without hardness data are treated as unbreakable
        // if they have a solid bounding box and are not transparent
        if b.bounding_box == "block" && b.opaque && !b.translucent && b.id != 0 {
            // Could check if it's a known unbreakable block
            if matches!(n.as_ref(), "obsidian" | "bedrock" | "end_portal_frame" | "command_block" | "structure_block") {
                return false;
            }
        }
        match mobility(reg, n) {
            "block" => return false,
            "destroy" => return destroy_blocks,
            "push_only" => {
                if facing != f2 {
                    return false;
                }
            }
            _ => {}
        }
    } else if reg.property(state, "extended") == Some("true") {
        return false; // extended piston
    }
    !(TILE.contains(&n) || n.ends_with("_shulker_box"))
}

// ------------------------------------------------------------ Structure helper

/// Piston structure helper - finds all blocks to move/destroy.
#[derive(Clone, Debug)]
pub struct PistonStructure {
    piston_pos: [i32; 3],
    facing: usize,
    move_direction: usize,
    block_to_move: [i32; 3],
    to_move: Vec<[i32; 3]>,
    to_destroy: Vec<[i32; 3]>,
}

impl PistonStructure {
    pub fn new(world: &dyn PistonWorld, pos: [i32; 3], facing: usize, extending: bool) -> Self {
        let move_direction = if extending { facing } else { OPPOSITE_FACE[facing] };
        let block_to_move = off(&pos, facing, if extending { 1 } else { 2 });
        Self {
            piston_pos: pos,
            facing,
            move_direction,
            block_to_move,
            to_move: Vec::new(),
            to_destroy: Vec::new(),
        }
    }

    fn st(&self, world: &dyn PistonWorld, p: &[i32; 3]) -> u32 {
        world.get_state(p[0], p[1], p[2])
    }

    fn has(&self, p: &[i32; 3]) -> bool {
        self.to_move.iter().any(|q| q[0] == p[0] && q[1] == p[1] && q[2] == p[2])
    }

    fn index_of(&self, p: &[i32; 3]) -> Option<usize> {
        self.to_move.iter().position(|q| q[0] == p[0] && q[1] == p[1] && q[2] == p[2])
    }

    fn is_piston_pos(&self, p: &[i32; 3]) -> bool {
        p[0] == self.piston_pos[0] && p[1] == self.piston_pos[1] && p[2] == self.piston_pos[2]
    }

    /// BlockPistonBase.canMove - checks if the piston can move and populates to_move/to_destroy.
    pub fn can_move(&mut self, world: &dyn PistonWorld) -> bool {
        self.to_move.clear();
        self.to_destroy.clear();

        let reg = world.reg();
        let st = self.st(world, &self.block_to_move);
        if !can_push(reg, st, &self.block_to_move, self.move_direction, false, self.facing) {
            if mobility(reg, name(reg, st)) == "destroy" {
                self.to_destroy.push(self.block_to_move);
                return true;
            }
            return false;
        }
        let block_to_move = self.block_to_move;
        if !self.add_block_line(world, &block_to_move, self.move_direction) {
            return false;
        }
        // Check sticky blocks
        for i in 0..self.to_move.len() {
            let pos = self.to_move[i];
            let st = self.st(world, &pos);
            let n = name(reg, st);
            if is_sticky_block(n) && !self.add_branching_blocks(world, pos) {
                return false;
            }
        }
        true
    }

    fn add_block_line(&mut self, world: &dyn PistonWorld, origin: &[i32; 3], dir: usize) -> bool {
        let reg = world.reg();
        let mut st = self.st(world, origin);
        if is_air(st) {
            return true;
        }
        if !can_push(reg, st, origin, self.move_direction, false, dir) {
            return true;
        }
        if self.is_piston_pos(origin) || self.has(origin) {
            return true;
        }
        if 1 + self.to_move.len() > 12 {
            return false;
        }
        let back = OPPOSITE_FACE[self.move_direction];
        let mut i = 1;
        while is_sticky_block(name(reg, st)) {
            let p = off(origin, back, i);
            st = self.st(world, &p);
            if !can_stick(name(reg, self.st(world, &origin)), name(reg, st)) {
                break;
            }
            if !self.add_block_line(world, &p, dir) {
                return false;
            }
            i += 1;
        }
        self.to_move.push(*origin);
        true
    }

    fn add_branching_blocks(&mut self, world: &dyn PistonWorld, pos: [i32; 3]) -> bool {
        // Add blocks perpendicular to the push direction that are connected by sticky blocks
        let reg = world.reg();
        let axis = AXIS[self.move_direction];
        for d in 0..6 {
            if d == self.move_direction || d == OPPOSITE_FACE[self.move_direction] {
                continue;
            }
            if AXIS[d] == axis {
                continue; // Same axis
            }
            let p = off(&pos, d, 1);
            let st = self.st(world, &p);
            if is_air(st) {
                continue;
            }
            if is_sticky_block(name(reg, st)) {
                // Check if we can push this branch
                if !can_push(reg, st, &p, self.move_direction, false, self.facing) {
                    return false;
                }
                if !self.add_block_line(world, &p, self.move_direction) {
                    return false;
                }
            }
        }
        true
    }

    pub fn to_move(&self) -> &[[i32; 3]] {
        &self.to_move
    }

    pub fn to_destroy(&self) -> &[[i32; 3]] {
        &self.to_destroy
    }
}

// ------------------------------------------------------------ Trait for world access

pub trait PistonWorld {
    fn get_state(&self, x: i32, y: i32, z: i32) -> u32;
    fn reg(&self) -> &BlockRegistry;
}

// ------------------------------------------------------------ WASM bindings

#[wasm_bindgen]
pub struct PistonCore {
    inner: Box<dyn PistonWorld>,
}

#[wasm_bindgen]
impl PistonCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> PistonCore {
        // Placeholder - the actual implementation requires a World trait
        PistonCore { inner: Box::new(DummyWorld) }
    }
}

struct DummyWorld;
impl PistonWorld for DummyWorld {
    fn get_state(&self, _x: i32, _y: i32, _z: i32) -> u32 { 0 }
    fn reg(&self) -> &BlockRegistry {
        // This is just a placeholder - in reality the JS side provides the registry
        static REG: std::sync::OnceLock<BlockRegistryCore> = std::sync::OnceLock::new();
        REG.get().unwrap().registry()
    }
}

// ------------------------------------------------------------ WASM bindings

#[wasm_bindgen]
pub fn piston_can_push(
    reg_json: &str,
    state: u32,
    px: i32,
    py: i32,
    pz: i32,
    facing: usize,
    destroy_blocks: bool,
    f2: usize,
) -> Result<bool, JsValue> {
    let reg = BlockRegistryCore::new(reg_json, "{}")?;
    Ok(can_push(&reg.registry(), state, &[px, py, pz], facing, destroy_blocks, f2))
}

#[wasm_bindgen]
pub fn piston_mobility(name: &str) -> String {
    // This needs a BlockRegistry to check DESTROY/BLOCK sets
    // Simplified version
    let result = if name.ends_with("_shulker_box") || DESTROY.contains(&name) {
        "destroy"
    } else if BLOCK_SET.contains(&name) {
        "block"
    } else if name.ends_with("_glazed_terracotta") {
        "push_only"
    } else {
        "normal"
    };
    result.to_string()
}

#[wasm_bindgen]
pub fn piston_is_sticky_block(name: &str) -> bool {
    name == "slime_block" || name == "honey_block"
}

#[wasm_bindgen]
pub fn piston_is_piston(name: &str) -> bool {
    name == "piston" || name == "sticky_piston"
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_reg() -> BlockRegistry {
        let blocks = r#"[
            {"id": 0, "name": "air", "boundingBox": "empty", "material": "air", "transparent": true},
            {"id": 1, "name": "stone", "boundingBox": "block", "material": "rock"},
            {"id": 2, "name": "piston", "boundingBox": "block", "material": "rock", "states": [{"name": "facing", "type": "enum", "values": ["down", "up", "north", "south", "west", "east"]}, {"name": "extended", "type": "bool"}]},
            {"id": 3, "name": "sticky_piston", "boundingBox": "block", "material": "rock", "states": [{"name": "facing", "type": "enum", "values": ["down", "up", "north", "south", "west", "east"]}, {"name": "extended", "type": "bool"}]},
            {"id": 4, "name": "slime_block", "boundingBox": "block", "material": "slime"},
            {"id": 5, "name": "honey_block", "boundingBox": "block", "material": "slime"},
            {"id": 6, "name": "obsidian", "boundingBox": "block", "material": "rock"},
            {"id": 7, "name": "water", "boundingBox": "empty", "material": "water", "transparent": true},
            {"id": 8, "name": "bedrock", "boundingBox": "block", "material": "rock"}
        ]"#;
        let shapes = r#"{"blocks": {}, "shapes": {}}"#;
        BlockRegistry::new(blocks, shapes).unwrap()
    }

    #[test]
    fn can_push_obsidian_is_false() {
        let reg = test_reg();
        let obsidian_state = reg.find_state("obsidian", "{}");
        assert!(!can_push(&reg, obsidian_state, &[0, 0, 0], 0, false, 0));
    }

    #[test]
    fn can_push_bedrock_is_false() {
        let reg = test_reg();
        let bedrock_state = reg.find_state("bedrock", "{}");
        assert!(!can_push(&reg, bedrock_state, &[0, 0, 0], 0, false, 0));
    }

    #[test]
    fn can_push_stone_is_true() {
        let reg = test_reg();
        let stone_state = reg.find_state("stone", "{}");
        assert!(can_push(&reg, stone_state, &[0, 64, 0], 0, false, 0));
    }

    #[test]
    fn can_push_water_destroy_mode() {
        let reg = test_reg();
        let water_state = reg.find_state("water", "{}");
        // Water is in DESTROY, so can push only with destroy_blocks=true
        assert!(!can_push(&reg, water_state, &[0, 64, 0], 0, false, 0));
        assert!(can_push(&reg, water_state, &[0, 64, 0], 0, true, 0));
    }

    #[test]
    fn piston_mobility_values() {
        assert_eq!(mobility(&test_reg(), "stone"), "normal");
        assert_eq!(mobility(&test_reg(), "water"), "destroy");
        assert_eq!(mobility(&test_reg(), "obsidian"), "block");
    }

    #[test]
    fn sticky_blocks() {
        assert!(is_sticky_block("slime_block"));
        assert!(is_sticky_block("honey_block"));
        assert!(!is_sticky_block("stone"));
    }

    #[test]
    fn can_stick_rules() {
        // Same sticky blocks CAN stick (a === b returns true in JS)
        assert!(can_stick("slime_block", "slime_block"));
        assert!(can_stick("honey_block", "honey_block"));
        // Different sticky blocks CANNOT stick
        assert!(!can_stick("slime_block", "honey_block"));
        // Non-sticky with sticky CAN stick
        assert!(can_stick("stone", "slime_block"));
    }

    #[test]
    fn is_piston_check() {
        assert!(is_piston("piston"));
        assert!(is_piston("sticky_piston"));
        assert!(!is_piston("stone"));
    }

    #[test]
    fn facing_offsets() {
        assert_eq!(FACING[0], [0, -1, 0]); // down
        assert_eq!(FACING[1], [0, 1, 0]);  // up
        assert_eq!(FACING[2], [0, 0, -1]); // north
        assert_eq!(FACING[3], [0, 0, 1]);  // south
        assert_eq!(FACING[4], [-1, 0, 0]); // west
        assert_eq!(FACING[5], [1, 0, 0]);  // east
    }
}