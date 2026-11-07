//! Port of `client/js/game/falling-block.js`: falling block entity physics.
//!
//! Handles sand, gravel, anvils, dragon eggs, concrete powder, etc.
//! Pure algorithmic code with no renderer or game-state dependencies.

use wasm_bindgen::prelude::*;

use crate::physics::{calc_x_offset, calc_y_offset, calc_z_offset};
use crate::world::WorldCore;
use crate::world_collision::get_collisions;
use crate::blocks::{BlockRegistry, BlockRegistryCore};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ constants

/// Falling block width/height (0.98 in vanilla).
pub const FALLING_BLOCK_SIZE: f64 = 0.98;
/// Half-size for bounding box calculations.
pub const FALLING_BLOCK_HALF: f64 = FALLING_BLOCK_SIZE / 2.0;
/// Gravity per tick (0.04 in vanilla).
pub const GRAVITY: f64 = 0.04;
/// Drag multiplier per tick (0.98 in vanilla).
pub const DRAG: f64 = 0.98;
/// Maximum entity age in ticks (600 = 30 seconds at 20 TPS).
pub const MAX_AGE: u32 = 600;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ FallingBlock struct

/// Falling block entity state.
///
/// Mirrors the JS entity fields used by `tickFallingBlock`:
/// - position (x, y, z)
/// - motion (motion_x, motion_y, motion_z)
/// - block_state: the block state ID being carried
/// - age: ticks existed
/// - falling_started: whether the first-tick source-block removal has run
/// - no_gravity: whether to skip gravity (e.g. from metadata)
/// - on_ground: whether the entity landed this tick
#[wasm_bindgen]
#[derive(Clone, Debug, Default)]
pub struct FallingBlock {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub motion_x: f64,
    pub motion_y: f64,
    pub motion_z: f64,
    pub block_state: u32,
    pub age: u32,
    pub falling_started: bool,
    pub no_gravity: bool,
    pub on_ground: bool,
    pub width: f64,
    pub height: f64,
}

#[wasm_bindgen]
impl FallingBlock {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64, z: f64, block_state: u32) -> FallingBlock {
        FallingBlock {
            x,
            y,
            z,
            motion_x: 0.0,
            motion_y: 0.0,
            motion_z: 0.0,
            block_state,
            age: 0,
            falling_started: false,
            no_gravity: false,
            on_ground: false,
            width: FALLING_BLOCK_SIZE,
            height: FALLING_BLOCK_SIZE,
        }
    }

    /// Get the entity's bounding box in world coordinates as a flat array:
    /// [minX, minY, minZ, maxX, maxY, maxZ].
    pub fn bounding_box(&self) -> Vec<f64> {
        let half_w = self.width / 2.0;
        let half_h = self.height; // height is full height in vanilla, bottom at y
        vec![
            self.x - half_w,
            self.y,
            self.z - half_w,
            self.x + half_w,
            self.y + half_h,
            self.z + half_w,
        ]
    }

    /// Tick the falling block physics for one game tick.
    ///
    /// Returns `true` if the entity should be removed (landed or expired),
    /// `false` if it should continue existing.
    ///
    /// # Arguments
    /// * `world` - WorldCore for collision queries and block state access
    /// * `registry` - BlockRegistryCore for block property lookups
    pub fn tick(&mut self, world: &mut WorldCore, registry: &BlockRegistryCore) -> bool {
        self.age += 1;
        if self.age >= MAX_AGE {
            return true; // expired
        }

        // First tick: remove the source block if it matches our block state.
        if !self.falling_started {
            self.falling_started = true;
            let bx = self.x.floor() as i32;
            let by = self.y.floor() as i32;
            let bz = self.z.floor() as i32;
            let state = world.get_state(bx, by, bz);
            let reg = registry.registry();
            if reg.def(state).id == reg.def(self.block_state).id {
                world.set_state(bx, by, bz, 0);
            }
        }

        // Check if we've landed on a block matching our state (server sync).
        // If so, stop moving to avoid obstructing the server-placed block.
        let bx = self.x.floor() as i32;
        let by = self.y.floor() as i32;
        let bz = self.z.floor() as i32;
        if world.get_state(bx, by, bz) == self.block_state {
            self.motion_x = 0.0;
            self.motion_y = 0.0;
            self.motion_z = 0.0;
            self.on_ground = true;
            return true; // landed - server will handle placement
        }

        // Apply gravity.
        if !self.no_gravity {
            self.motion_y -= GRAVITY;
        }

        let mut dx = self.motion_x;
        let mut dy = self.motion_y;
        let mut dz = self.motion_z;

        // Current bounding box.
        let mut bb = self.bounding_box();

        // Swept box for collision detection.
        let swept = [
            bb[0] + dx.min(0.0),
            bb[1] + dy.min(0.0),
            bb[2] + dz.min(0.0),
            bb[3] + dx.max(0.0),
            bb[4] + dy.max(0.0),
            bb[5] + dz.max(0.0),
        ];

        // Query world for collisions in the swept volume.
        let reg = registry.registry();
        let boxes = get_collisions(world, reg, &swept);

        // Resolve collisions in Y, X, Z order (same as vanilla).
        for box_ in &boxes {
            dy = calc_y_offset(box_, &bb, dy);
        }
        bb[1] += dy;
        bb[4] += dy;

        for box_ in &boxes {
            dx = calc_x_offset(box_, &bb, dx);
        }
        bb[0] += dx;
        bb[3] += dx;

        for box_ in &boxes {
            dz = calc_z_offset(box_, &bb, dz);
        }
        bb[2] += dz;
        bb[5] += dz;

        // Update position from resolved bounding box.
        self.x = (bb[0] + bb[3]) / 2.0;
        self.y = bb[1];
        self.z = (bb[2] + bb[5]) / 2.0;

        // onGround: we moved down and hit something.
        self.on_ground = dy != self.motion_y && self.motion_y < 0.0;

        // Zero motion on axes where collision occurred.
        if dx != self.motion_x {
            self.motion_x = 0.0;
        }
        if dy != self.motion_y {
            self.motion_y = 0.0;
        }
        if dz != self.motion_z {
            self.motion_z = 0.0;
        }

        // Apply drag.
        self.motion_x *= DRAG;
        self.motion_y *= DRAG;
        self.motion_z *= DRAG;

        // Landed if on ground and motion is negligible.
        self.on_ground && self.motion_y.abs() < 0.001 && self.motion_x.abs() < 0.001 && self.motion_z.abs() < 0.001
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Pure physics helpers

/// Core falling-block physics step without entity state mutation.
///
/// Given a position, motion, and world, returns the new position, new motion,
/// and whether the block landed.
///
/// This is the pure function form used for server-side simulation or testing.
#[wasm_bindgen]
pub fn falling_block_physics(
    x: f64,
    y: f64,
    z: f64,
    motion_x: f64,
    motion_y: f64,
    motion_z: f64,
    block_state: u32,
    no_gravity: bool,
    world: &WorldCore,
    registry: &BlockRegistryCore,
) -> Vec<f64> {
    // Apply gravity.
    let mut dy = motion_y;
    if !no_gravity {
        dy -= GRAVITY;
    }
    let mut dx = motion_x;
    let mut dz = motion_z;

    // Bounding box.
    let half_w = FALLING_BLOCK_HALF;
    let half_h = FALLING_BLOCK_SIZE;
    let mut bb = [
        x - half_w,
        y,
        z - half_w,
        x + half_w,
        y + half_h,
        z + half_w,
    ];

    // Swept box.
    let swept = [
        bb[0] + dx.min(0.0),
        bb[1] + dy.min(0.0),
        bb[2] + dz.min(0.0),
        bb[3] + dx.max(0.0),
        bb[4] + dy.max(0.0),
        bb[5] + dz.max(0.0),
    ];

    // Collisions.
    let reg = registry.registry();
    let boxes = get_collisions(world, reg, &swept);

    // Resolve Y, X, Z.
    for box_ in &boxes {
        dy = calc_y_offset(box_, &bb, dy);
    }
    bb[1] += dy;
    bb[4] += dy;

    for box_ in &boxes {
        dx = calc_x_offset(box_, &bb, dx);
    }
    bb[0] += dx;
    bb[3] += dx;

    for box_ in &boxes {
        dz = calc_z_offset(box_, &bb, dz);
    }
    bb[2] += dz;
    bb[5] += dz;

    // New position.
    let new_x = (bb[0] + bb[3]) / 2.0;
    let new_y = bb[1];
    let new_z = (bb[2] + bb[5]) / 2.0;

    // onGround detection.
    let on_ground = dy != motion_y && motion_y < 0.0;

    // Zero motion on collision axes.
    if dx != motion_x {
        dx = 0.0;
    }
    if dy != motion_y {
        dy = 0.0;
    }
    if dz != motion_z {
        dz = 0.0;
    }

    // Drag.
    dx *= DRAG;
    dy *= DRAG;
    dz *= DRAG;

    // Landed: on ground and motion nearly zero.
    let landed = on_ground && dy.abs() < 0.001 && dx.abs() < 0.001 && dz.abs() < 0.001;

    // Return [new_x, new_y, new_z, new_motion_x, new_motion_y, new_motion_z, landed_as_f64]
    vec![new_x, new_y, new_z, dx, dy, dz, if landed { 1.0 } else { 0.0 }]
}

/// Attempt to place the falling block at the given position.
///
/// Returns `true` if placement succeeded (block was air/replaceable),
/// `false` if the position is occupied by a non-replaceable block.
#[wasm_bindgen]
pub fn falling_block_land(
    world: &mut WorldCore,
    registry: &BlockRegistryCore,
    x: f64,
    y: f64,
    z: f64,
    block_state: u32,
) -> bool {
    let bx = x.floor() as i32;
    let by = y.floor() as i32;
    let bz = z.floor() as i32;

    // Check if target position is replaceable (air, water, tall grass, etc.).
    let target_state = world.get_state(bx, by, bz);
    let reg = registry.registry();
    let target_def = reg.def(target_state);
    if !target_def.replaceable && target_state != 0 {
        return false; // occupied by solid block
    }

    // Place the block.
    world.set_state(bx, by, bz, block_state);
    true
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ WASM-free internal helpers

impl FallingBlock {
    /// Internal helper: compute swept box from current bb and motion.
    fn swept_box(bb: &[f64; 6], dx: f64, dy: f64, dz: f64) -> [f64; 6] {
        [
            bb[0] + dx.min(0.0),
            bb[1] + dy.min(0.0),
            bb[2] + dz.min(0.0),
            bb[3] + dx.max(0.0),
            bb[4] + dy.max(0.0),
            bb[5] + dz.max(0.0),
        ]
    }

    /// Get the entity's bounding box as a fixed-size array (for internal use).
    fn bb_array(&self) -> [f64; 6] {
        let half_w = self.width / 2.0;
        let half_h = self.height;
        [
            self.x - half_w,
            self.y,
            self.z - half_w,
            self.x + half_w,
            self.y + half_h,
            self.z + half_w,
        ]
    }

    /// Check if the entity would collide with another entity's bounding box.
    /// Used for entity-entity collision (falling blocks can push each other).
    pub fn collides_with_entity(&self, other_bb: &[f64; 6]) -> bool {
        let bb = self.bb_array();
        bb[3] > other_bb[0]
            && bb[0] < other_bb[3]
            && bb[4] > other_bb[1]
            && bb[1] < other_bb[4]
            && bb[5] > other_bb[2]
            && bb[2] < other_bb[5]
    }

    /// Resolve collision with another entity (simple push-away).
    /// Returns adjusted motion.
    pub fn resolve_entity_collision(
        &self,
        motion: (f64, f64, f64),
        other_bb: &[f64; 6],
    ) -> (f64, f64, f64) {
        let bb = self.bb_array();
        let (mut dx, mut dy, mut dz) = motion;

        // X axis
        if bb[4] > other_bb[1] && bb[1] < other_bb[4] && bb[5] > other_bb[2] && bb[2] < other_bb[5] {
            if dx > 0.0 && bb[3] <= other_bb[0] {
                let d = other_bb[0] - bb[3];
                if d < dx { dx = d; }
            } else if dx < 0.0 && bb[0] >= other_bb[3] {
                let d = other_bb[3] - bb[0];
                if d > dx { dx = d; }
            }
        }

        // Y axis
        if bb[3] > other_bb[0] && bb[0] < other_bb[3] && bb[5] > other_bb[2] && bb[2] < other_bb[5] {
            if dy > 0.0 && bb[4] <= other_bb[1] {
                let d = other_bb[1] - bb[4];
                if d < dy { dy = d; }
            } else if dy < 0.0 && bb[1] >= other_bb[4] {
                let d = other_bb[4] - bb[1];
                if d > dy { dy = d; }
            }
        }

        // Z axis
        if bb[3] > other_bb[0] && bb[0] < other_bb[3] && bb[4] > other_bb[1] && bb[1] < other_bb[4] {
            if dz > 0.0 && bb[5] <= other_bb[2] {
                let d = other_bb[2] - bb[5];
                if d < dz { dz = d; }
            } else if dz < 0.0 && bb[2] >= other_bb[5] {
                let d = other_bb[5] - bb[2];
                if d > dz { dz = d; }
            }
        }

        (dx, dy, dz)
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ tests

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn load_registry() -> BlockRegistry {
        let blocks = fs::read_to_string("../../client/data/blocks.json").unwrap();
        let shapes = fs::read_to_string("../../client/data/blockCollisionShapes.json").unwrap();
        BlockRegistry::new(&blocks, &shapes).unwrap()
    }

    fn empty_world() -> WorldCore {
        // state 0 = air, state 1 = stone (opaque)
        WorldCore::new(&[0, 15], &[0, 0])
    }

    #[test]
    fn falling_block_falls_and_lands_on_stone() {
        let reg = load_registry();
        let mut world = empty_world();

        // Place stone at y=63.
        world.set_state(0, 63, 0, reg.find_state("stone", "{}"));

        // Spawn falling sand at y=65.
        let mut fb = FallingBlock::new(0.5, 65.0, 0.5, reg.find_state("sand", "{}"));

        // Tick until landed or max ticks.
        for _ in 0..100 {
            if fb.tick(&mut world, &BlockRegistryCore::from_registry(reg.clone())) {
                break;
            }
        }

        // Should have landed on top of stone (y=64).
        assert!(fb.on_ground);
        assert!((fb.y - 64.0).abs() < 0.1);
        assert!(fb.motion_y.abs() < 0.01);
    }

    #[test]
    fn falling_block_removes_source_block_on_first_tick() {
        let reg = load_registry();
        let mut world = empty_world();

        // Place sand at y=64.
        let sand_state = reg.find_state("sand", "{}");
        world.set_state(0, 64, 0, sand_state);

        // Spawn falling sand at same position.
        let mut fb = FallingBlock::new(0.5, 64.5, 0.5, sand_state);

        // First tick should remove the source block.
        fb.tick(&mut world, &BlockRegistryCore::from_registry(reg.clone()));
        assert_eq!(world.get_state(0, 64, 0), 0);
    }

    #[test]
    fn falling_block_stops_when_server_places_block() {
        let reg = load_registry();
        let mut world = empty_world();

        let sand_state = reg.find_state("sand", "{}");
        let mut fb = FallingBlock::new(0.5, 65.0, 0.5, sand_state);

        // Simulate server placing the block at the entity's position.
        world.set_state(0, 64, 0, sand_state);

        // Entity falls one tick.
        fb.tick(&mut world, &BlockRegistryCore::from_registry(reg.clone()));

        // Next tick: entity detects the block and stops.
        let should_remove = fb.tick(&mut world, &BlockRegistryCore::from_registry(reg.clone()));
        assert!(should_remove);
        assert!(fb.motion_x.abs() < 0.001);
        assert!(fb.motion_y.abs() < 0.001);
        assert!(fb.motion_z.abs() < 0.001);
    }

    #[test]
    fn falling_block_physics_pure_function() {
        let reg = load_registry();
        let mut world = empty_world();
        world.set_state(0, 63, 0, reg.find_state("stone", "{}"));

        let sand_state = reg.find_state("sand", "{}");
        let reg_core = BlockRegistryCore::from_registry(reg.clone());

        // Simulate multiple ticks using the pure function.
        let mut x = 0.5;
        let mut y = 65.0;
        let mut z = 0.5;
        let mut mx = 0.0;
        let mut my = 0.0;
        let mut mz = 0.0;

        for _ in 0..20 {
            let result = falling_block_physics(x, y, z, mx, my, mz, sand_state, false, &world, &reg_core);
            x = result[0];
            y = result[1];
            z = result[2];
            mx = result[3];
            my = result[4];
            mz = result[5];
            let landed = result[6] > 0.5;
            if landed {
                break;
            }
        }

        // Should land on y=64 (top of stone at y=63).
        assert!((y - 64.0).abs() < 0.1);
        assert!(my.abs() < 0.01);
    }

    #[test]
    fn falling_block_land_succeeds_on_air() {
        let reg = load_registry();
        let mut world = empty_world();
        let sand_state = reg.find_state("sand", "{}");
        let reg_core = BlockRegistryCore::from_registry(reg.clone());

        assert!(falling_block_land(&mut world, &reg_core, 0.5, 64.5, 0.5, sand_state));
        assert_eq!(world.get_state(0, 64, 0), sand_state);
    }

    #[test]
    fn falling_block_land_fails_on_solid_block() {
        let reg = load_registry();
        let mut world = empty_world();
        let stone_state = reg.find_state("stone", "{}");
        let sand_state = reg.find_state("sand", "{}");
        let reg_core = BlockRegistryCore::from_registry(reg.clone());

        world.set_state(0, 64, 0, stone_state);
        assert!(!falling_block_land(&mut world, &reg_core, 0.5, 64.5, 0.5, sand_state));
        assert_eq!(world.get_state(0, 64, 0), stone_state);
    }

    #[test]
    fn falling_block_land_succeeds_on_replaceable() {
        let reg = load_registry();
        let mut world = empty_world();
        let water_state = reg.find_state("water", "{}");
        let sand_state = reg.find_state("sand", "{}");
        let reg_core = BlockRegistryCore::from_registry(reg.clone());

        world.set_state(0, 64, 0, water_state);
        assert!(falling_block_land(&mut world, &reg_core, 0.5, 64.5, 0.5, sand_state));
        assert_eq!(world.get_state(0, 64, 0), sand_state);
    }

    #[test]
    fn falling_block_expires_after_max_age() {
        let reg = load_registry();
        let mut world = empty_world();
        let mut fb = FallingBlock::new(0.5, 200.0, 0.5, reg.find_state("sand", "{}"));

        // Tick MAX_AGE times.
        for _ in 0..MAX_AGE {
            if fb.tick(&mut world, &BlockRegistryCore::from_registry(reg.clone())) {
                break;
            }
        }
        // Should have returned true (expired).
        assert_eq!(fb.age, MAX_AGE);
    }

    #[test]
    fn falling_block_no_gravity_floats() {
        let reg = load_registry();
        let mut world = empty_world();
        let mut fb = FallingBlock::new(0.5, 65.0, 0.5, reg.find_state("sand", "{}"));
        fb.no_gravity = true;

        // Tick a few times.
        for _ in 0..10 {
            fb.tick(&mut world, &BlockRegistryCore::from_registry(reg.clone()));
        }

        // Should not have fallen.
        assert!((fb.y - 65.0).abs() < 0.1);
        assert!(fb.motion_y.abs() < 0.01);
    }

    #[test]
    fn entity_collision_resolution() {
        let reg = load_registry();
        let fb = FallingBlock::new(0.5, 64.0, 0.5, reg.find_state("sand", "{}"));

        // Another entity at (1.0, 64.0, 0.5) with size 0.6.
        let other_bb = [0.7, 64.0, 0.2, 1.3, 65.8, 0.8];

        // Moving +X towards it.
        let (dx, dy, dz) = fb.resolve_entity_collision((0.5, 0.0, 0.0), &other_bb);
        // Should be clamped to stop before intersecting.
        assert!(dx < 0.5);
        assert!(dx > 0.0);
    }
}