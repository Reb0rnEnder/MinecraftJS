//! Port of `client/js/game/physics.js` `LocalPlayer` (upstream MinecraftJS 1.8.9).
//!
//! Vanilla 1.8.9 player movement physics (EntityPlayerSP / EntityLivingBase /
//! Entity). Every `Math.fround` in the JS is reproduced as an explicit f32
//! round-trip; `mcSin`/`mcCos` use the vanilla 65536-entry sine table.

use crate::blocks::BlockRegistry;
use serde_json::Value;
use std::sync::OnceLock;

/// JS: `const SPRINT_UUID = '662a6b8d-da3e-4c1c-8813-96ea6097278d'`.
pub const SPRINT_UUID: &str = "662a6b8d-da3e-4c1c-8813-96ea6097278d";

/// JS: `const f32 = Math.fround`.
#[inline]
pub fn f32r(v: f64) -> f64 {
    v as f32 as f64
}

/// Vanilla MathHelper.sin/cos use a 65536-entry table; reproduce it for
/// parity with the server.
fn sin_table() -> &'static Vec<f32> {
    static TABLE: OnceLock<Vec<f32>> = OnceLock::new();
    TABLE.get_or_init(|| {
        (0..65536)
            .map(|i| (i as f64 * std::f64::consts::PI * 2.0 / 65536.0) as f32)
            .collect()
    })
}

const F_SIN_SCALE: f64 = 10430.378f32 as f64;
const F_PI: f64 = std::f32::consts::PI as f64;

/// JS: `mcSin(v)` — `(int)(value * 10430.378F) & 65535`, all float maths.
pub fn mc_sin(v: f64) -> f32 {
    let t = f32r(f32r(v) * F_SIN_SCALE);
    sin_table()[((t.trunc() as i64) & 65535) as usize]
}

/// JS: `mcCos(v)` — same index shifted by 16384.
pub fn mc_cos(v: f64) -> f32 {
    let t = f32r(f32r(f32r(v) * F_SIN_SCALE) + 16384.0);
    sin_table()[((t.trunc() as i64) & 65535) as usize]
}

/// Vanilla float constants (as the double values the JVM widens them to).
pub mod f_const {
    pub const P02: f64 = 0.02f32 as f64;
    pub const P091: f64 = 0.91f32 as f64;
    pub const P098: f64 = 0.98f32 as f64;
    pub const P08: f64 = 0.8f32 as f64;
    pub const P02B: f64 = 0.2f32 as f64;
    pub const P015: f64 = 0.15f32 as f64;
    pub const P06: f64 = 0.6f32 as f64;
    pub const P01: f64 = 0.1f32 as f64;
    pub const DEG: f64 = 0.017453292f32 as f64;
}

/// The world surface LocalPlayer needs. Block lookups go through the real
/// [`BlockRegistry`] (JS: `blocks[state >> 4]`).
pub trait PhysicsWorld {
    /// JS: `world.getState(x, y, z)`.
    fn get_state(&self, x: i64, y: i64, z: i64) -> u32;
    /// JS: `world.isLoaded(x, z)`.
    fn is_loaded(&self, x: i64, z: i64) -> bool;
    /// JS: `world.getCollisions(bb, entity)`.
    fn get_collisions(&self, bb: &[f64; 6]) -> Vec<[f64; 6]>;
    /// Block definition table (JS: `blocks`).
    fn registry(&self) -> &BlockRegistry;
    /// JS: `world.minY` / `world.maxY` (used by the respawn walk-down loop).
    fn vertical_bounds(&self) -> (i64, i64);
}

/// JS attribute modifier: `{ uuid, amount, operation }`.
#[derive(Debug, Clone)]
pub struct AttrModifier {
    pub uuid: String,
    pub amount: f64,
    pub operation: i32,
}

/// JS: `this.speedAttr = { base, modifiers }`.
#[derive(Debug, Clone)]
pub struct SpeedAttr {
    pub base: f64,
    pub modifiers: Vec<AttrModifier>,
}

impl Default for SpeedAttr {
    fn default() -> Self {
        SpeedAttr { base: f32r(0.1), modifiers: Vec::new() }
    }
}

pub type StepFn = Box<dyn FnMut(i64, i64, i64, u32)>;
pub type WaterEnterFn = Box<dyn FnMut()>;
pub type FallFn = Box<dyn FnMut(i64, u32)>;
pub type SwimFn = Box<dyn FnMut(f64)>;

/// JS: `input: { forward, back, left, right, jump, sneak, sprint }`.
#[derive(Debug, Clone, Copy, Default)]
pub struct PlayerInput {
    pub forward: bool,
    pub back: bool,
    pub left: bool,
    pub right: bool,
    pub jump: bool,
    pub sneak: bool,
    pub sprint: bool,
}

/// JS: `tick()` returns `{ abilitiesChanged }`.
#[derive(Debug, Clone, Copy, Default)]
pub struct TickResult {
    pub abilities_changed: bool,
}

/// JS: `export class LocalPlayer` — 1:1 field-for-field.
pub struct LocalPlayer {
    pub health_initialized: bool, // Native first server-health update does not flash damage.
    pub x: f64, pub y: f64, pub z: f64,
    pub prev_x: f64, pub prev_y: f64, pub prev_z: f64,
    pub motion_x: f64, pub motion_y: f64, pub motion_z: f64,
    pub yaw: f64, pub pitch: f64, pub prev_yaw: f64, pub prev_pitch: f64,
    // Entity sizes are floats in vanilla: 0.6F / 1.8F
    pub width: f64, pub height: f64, pub step_height: f64,
    // landMovementFactor / jumpMovementFactor: set *after* each move, so
    // sprint changes only affect speed from the next tick
    pub land_movement_factor: f64, pub jump_movement_factor: f64,
    pub on_ground: bool,
    pub collided_h: bool, pub collided_v: bool,
    pub in_water: bool, pub in_lava: bool, pub in_web: bool,
    pub fall_distance: f64,
    pub jump_ticks: i64,
    pub sneaking: bool, pub sprinting: bool,
    pub flying: bool, pub allow_flying: bool, pub creative: bool, pub invulnerable: bool,
    pub spectator: bool, pub no_clip: bool,
    pub fly_speed: f64, pub walk_speed: f64,
    pub speed_attr: SpeedAttr,
    pub food: i64,
    pub sprint_toggle_timer: i64, pub fly_toggle_timer: i64,
    pub prev_jump: bool, pub prev_forward_held: bool, pub prev_sneak: bool,
    pub using_item: bool,
    pub blind: bool,
    pub jump_boost: i64,
    pub depth_strider: i64,
    pub distance_walked: f64, pub prev_distance_walked: f64,
    pub next_step_distance: f64,
    pub camera_yaw: f64, pub prev_camera_yaw: f64, pub camera_pitch: f64, pub prev_camera_pitch: f64,
    pub on_step: Option<StepFn>,
    pub on_water_enter: Option<WaterEnterFn>,
    pub on_fall: Option<FallFn>,
    pub on_swim: Option<SwimFn>,
    pub ticks_existed: i64,
    pub swim_distance: f64, pub next_swim_distance: f64,
    pub riding_entity: Option<String>,
    // JS `_bb` cache — `null` until setPosition; bb() slices the cache.
    cached_bb: Option<[f64; 6]>,
    // JS `_lastX/_lastY/_lastZ`, set at the end of moveEntity.
    pub last_x: f64, pub last_y: f64, pub last_z: f64,
    // JS reads `this.health` in tick() before the first server health update,
    // where it is `undefined`; `undefined <= 0` is false, and NaN mirrors that.
    pub health: f64,
    /// JS `this.stepDistance` (created lazily via `(this.stepDistance || 0)`).
    pub step_distance: f64,
    /// JS dynamic `player.attributes` (a Map upstream; JSON object here).
    pub attributes: Value,
    /// JS dynamic `player.attackSpeed` (only present if something set it).
    pub attack_speed: Option<f64>,
}

impl Default for LocalPlayer {
    fn default() -> Self {
        Self::new()
    }
}

impl LocalPlayer {
    pub fn new() -> Self {
        LocalPlayer {
            health_initialized: false,
            x: 0.0, y: 0.0, z: 0.0,
            prev_x: 0.0, prev_y: 0.0, prev_z: 0.0,
            motion_x: 0.0, motion_y: 0.0, motion_z: 0.0,
            yaw: 0.0, pitch: 0.0, prev_yaw: 0.0, prev_pitch: 0.0,
            width: f32r(0.6), height: f32r(1.8), step_height: f32r(0.6),
            land_movement_factor: f32r(0.1), jump_movement_factor: f32r(0.02),
            on_ground: false,
            collided_h: false, collided_v: false,
            in_water: false, in_lava: false, in_web: false,
            fall_distance: 0.0,
            jump_ticks: 0,
            sneaking: false, sprinting: false,
            flying: false, allow_flying: false, creative: false, invulnerable: false,
            spectator: false, no_clip: false,
            fly_speed: 0.05, walk_speed: 0.1,
            speed_attr: SpeedAttr::default(),
            food: 20,
            sprint_toggle_timer: 0, fly_toggle_timer: 0,
            prev_jump: false, prev_forward_held: false, prev_sneak: false,
            using_item: false,
            blind: false,
            jump_boost: -1,
            depth_strider: 0,
            distance_walked: 0.0, prev_distance_walked: 0.0,
            next_step_distance: 1.0,
            camera_yaw: 0.0, prev_camera_yaw: 0.0, camera_pitch: 0.0, prev_camera_pitch: 0.0,
            on_step: None, on_water_enter: None, on_fall: None, on_swim: None,
            ticks_existed: 0,
            swim_distance: 0.0, next_swim_distance: 1.0,
            riding_entity: None,
            cached_bb: None,
            last_x: 0.0, last_y: 0.0, last_z: 0.0,
            health: f64::NAN,
            step_distance: 0.0,
            attributes: Value::Null,
            attack_speed: None,
        }
    }

    /// JS: `bb()` — cached after setPosition, sliced copy otherwise computed.
    pub fn bb(&self) -> [f64; 6] {
        if let Some(b) = &self.cached_bb {
            return *b;
        }
        let w = f32r(self.width / 2.0);
        [self.x - w, self.y, self.z - w, self.x + w, self.y + self.height, self.z + w]
    }

    /// JS: `setPosition(x, y, z)`.
    pub fn set_position(&mut self, x: f64, y: f64, z: f64) {
        self.x = x; self.y = y; self.z = z;
        let w = f32r(self.width / 2.0);
        self.cached_bb = Some([x - w, y, z - w, x + w, y + self.height, z + w]);
    }

    /// JS: `pushOutOfBlocks(world, x, y, z)` — EntityPlayerSP: only acts when
    /// this corner is inside a normal cube, then sets a fixed 0.1F sideways
    /// motion towards the nearest open neighbour. Never vertical, never random.
    pub fn push_out_of_blocks(&mut self, world: &dyn PhysicsWorld, x: f64, y: f64, z: f64) -> bool {
        if self.no_clip {
            return false;
        }
        let reg = world.registry();
        let bx = x.floor() as i64;
        let by = y.floor() as i64;
        let bz = z.floor() as i64;
        let d0 = x - bx as f64;
        let d1 = z - bz as f64;
        let is_cube = |xx: i64, yy: i64, zz: i64| -> bool {
            let b = reg.def(world.get_state(xx, yy, zz));
            b.opaque && !b.is_liquid
        };
        let is_open = |xx: i64, yy: i64, zz: i64| -> bool { !is_cube(xx, yy, zz) && !is_cube(xx, yy + 1, zz) };
        if is_open(bx, by, bz) {
            return false;
        }
        let mut i: i64 = -1;
        let mut d2 = 9999.0f64;
        if is_open(bx - 1, by, bz) && d0 < d2 { d2 = d0; i = 0; }
        if is_open(bx + 1, by, bz) && (1.0 - d0) < d2 { d2 = 1.0 - d0; i = 1; }
        if is_open(bx, by, bz - 1) && d1 < d2 { d2 = d1; i = 4; }
        if is_open(bx, by, bz + 1) && (1.0 - d1) < d2 { d2 = 1.0 - d1; i = 5; }
        let f = 0.10000000149011612; // 0.1F
        if i == 0 { self.motion_x = -f; }
        if i == 1 { self.motion_x = f; }
        if i == 4 { self.motion_z = -f; }
        if i == 5 { self.motion_z = f; }
        false
    }

    /// JS: `aiMoveSpeed()` — attribute math with the sprint modifier excluded
    /// (the client applies sprint via the 1.3 multiplier instead).
    pub fn ai_move_speed(&self) -> f64 {
        let base = self.speed_attr.base;
        let mut v = base;
        let mods: Vec<&AttrModifier> = self.speed_attr.modifiers.iter().filter(|m| m.uuid != SPRINT_UUID).collect();
        for m in &mods {
            if m.operation == 0 { v += m.amount; }
        }
        let mut v2 = v;
        for m in &mods {
            if m.operation == 1 { v2 += v * m.amount; }
        }
        for m in &mods {
            if m.operation == 2 { v2 *= 1.0 + m.amount; }
        }
        if self.sprinting {
            v2 *= 1.3;
        }
        f32r(v2)
    }

    // --- Material checks ---

    /// JS: `isMaterialInBB(world, bb, test)`.
    fn is_material_in_bb(&self, world: &dyn PhysicsWorld, bb: &[f64; 6], test: impl Fn(&crate::blocks::BlockDef) -> bool) -> bool {
        let reg = world.registry();
        let x0 = bb[0].floor() as i64;
        let x1 = (bb[3] + 1.0).floor() as i64;
        let y0 = bb[1].floor() as i64;
        let y1 = (bb[4] + 1.0).floor() as i64;
        let z0 = bb[2].floor() as i64;
        let z1 = (bb[5] + 1.0).floor() as i64;
        for x in x0..x1 {
            for y in y0..y1 {
                for z in z0..z1 {
                    let b = reg.def(world.get_state(x, y, z));
                    if test(b) {
                        return true;
                    }
                }
            }
        }
        false
    }

    /// JS: `handleWaterMovement(world)` — Entity.handleWaterMovement: the box
    /// shrunk by 0.4F top/bottom then 0.001; material walk is
    /// floor(min)..floor(max + 1) exclusive over loaded chunks.
    pub fn handle_water_movement(&mut self, world: &dyn PhysicsWorld) -> bool {
        let reg = world.registry();
        let bb0 = self.bb();
        let shrink = 0.4000000059604645f64; // 0.4F
        let bb: [f64; 6] = [
            bb0[0] + 0.001,
            bb0[1] + shrink + 0.001,
            bb0[2] + 0.001,
            bb0[3] - 0.001,
            bb0[4] - shrink - 0.001,
            bb0[5] - 0.001,
        ];
        let x0 = bb[0].floor() as i64;
        let x1 = (bb[3] + 1.0).floor() as i64;
        let y0 = bb[1].floor() as i64;
        let y1 = (bb[4] + 1.0).floor() as i64;
        let z0 = bb[2].floor() as i64;
        let z1 = (bb[5] + 1.0).floor() as i64;
        for x in x0..x1 {
            for _y in y0..y1 {
                for z in z0..z1 {
                    if !world.is_loaded(x, z) {
                        self.in_water = false;
                        return false;
                    }
                }
            }
        }
        let mut found = false;
        let mut fx = 0.0;
        let mut fy = 0.0;
        let mut fz = 0.0;
        for x in x0..x1 {
            for y in y0..y1 {
                for z in z0..z1 {
                    let s = world.get_state(x, y, z);
                    let b = reg.def(s);
                    if !b.is_water {
                        continue;
                    }
                    let lvl = (s & 15) as f64;
                    // BlockLiquid.getLiquidHeightPercent
                    let pct = f32r(((if lvl >= 8.0 { 0.0 } else { lvl }) + 1.0) / 9.0);
                    if y1 as f64 >= f32r(f32r((y + 1) as f64) - pct) {
                        found = true;
                        let v = self.flow_vector(world, x, y, z, false);
                        fx += v[0]; fy += v[1]; fz += v[2];
                    }
                }
            }
        }
        let len = (fx * fx + fy * fy + fz * fz).sqrt();
        if len > 0.0 && !self.flying {
            let d = 0.014;
            self.motion_x += fx / len * d;
            self.motion_y += fy / len * d;
            self.motion_z += fz / len * d;
        }
        // Entity.resetHeight: splash when entering water (not the first update)
        if found && !self.in_water && self.ticks_existed > 1 {
            if let Some(cb) = self.on_water_enter.as_mut() {
                cb();
            }
        }
        if found {
            self.fall_distance = 0.0;
        }
        self.in_water = found;
        found
    }

    /// JS: `flowVector(world, x, y, z, lava)` — BlockLiquid.getFlow vector.
    pub fn flow_vector(&self, world: &dyn PhysicsWorld, x: i64, y: i64, z: i64, lava: bool) -> [f64; 3] {
        let reg = world.registry();
        let decay = |xx: i64, yy: i64, zz: i64| -> i64 {
            let s = world.get_state(xx, yy, zz);
            let b = reg.def(s);
            if !b.is_liquid || b.is_lava != lava {
                return -1;
            }
            let l = (s & 15) as i64;
            if l >= 8 { 0 } else { l }
        };
        let i = decay(x, y, z);
        let mut vx = 0.0f64;
        let mut vy = 0.0f64;
        let mut vz = 0.0f64;
        for (dx, dz) in [(0i64, -1i64), (1, 0), (0, 1), (-1, 0)] {
            let mut j = decay(x + dx, y, z + dz);
            if j < 0 {
                let b = reg.def(world.get_state(x + dx, y, z + dz));
                if b.bounding_box != "block" || b.id == 0 {
                    j = decay(x + dx, y - 1, z + dz);
                    if j >= 0 {
                        let k = (j - (i - 8)) as f64;
                        vx += dx as f64 * k;
                        vz += dz as f64 * k;
                    }
                }
            } else {
                let k = (j - i) as f64;
                vx += dx as f64 * k;
                vz += dz as f64 * k;
            }
        }
        if (world.get_state(x, y, z) & 15) >= 8 {
            // Falling liquid pushes down when next to solid sides
            let mut solid_side = false;
            for (dx, dz) in [(0i64, -1i64), (1, 0), (0, 1), (-1, 0)] {
                let b = reg.def(world.get_state(x + dx, y, z + dz));
                let b2 = reg.def(world.get_state(x + dx, y + 1, z + dz));
                if b.opaque || b2.opaque {
                    solid_side = true;
                    break;
                }
            }
            if solid_side {
                let l = (vx * vx + vz * vz).sqrt();
                let l = if l == 0.0 { 1.0 } else { l };
                vx /= l;
                vz /= l;
                vy = -6.0;
            }
        }
        let l = (vx * vx + vy * vy + vz * vz).sqrt();
        if l > 0.0 {
            [vx / l, vy / l, vz / l]
        } else {
            [0.0, 0.0, 0.0]
        }
    }

    /// JS: `isInLava(world)`.
    pub fn is_in_lava(&self, world: &dyn PhysicsWorld) -> bool {
        let bb = self.bb();
        self.is_material_in_bb(
            world,
            &[bb[0] + 0.1, bb[1] + 0.4, bb[2] + 0.1, bb[3] - 0.1, bb[4] - 0.4, bb[5] - 0.1],
            |b| b.is_lava,
        )
    }

    /// JS: `isOffsetPositionInLiquid(world, dx, dy, dz)`.
    pub fn is_offset_position_in_liquid(&self, world: &dyn PhysicsWorld, dx: f64, dy: f64, dz: f64) -> bool {
        let bb0 = self.bb();
        let bb = [bb0[0] + dx, bb0[1] + dy, bb0[2] + dz, bb0[3] + dx, bb0[4] + dy, bb0[5] + dz];
        if !world.get_collisions(&bb).is_empty() {
            return false;
        }
        self.is_material_in_bb(world, &bb, |b| b.is_liquid)
    }

    /// JS: `isOnLadder(world)`.
    pub fn is_on_ladder(&self, world: &dyn PhysicsWorld) -> bool {
        let reg = world.registry();
        let b = reg.def(world.get_state(self.x.floor() as i64, self.y.floor() as i64, self.z.floor() as i64));
        (b.name == "ladder" || b.name == "vine") && !self.spectator
    }

    // --- Core movement ---

    /// JS: `moveFlying(strafe, forward, friction)` — Entity.moveFlying, all
    /// float maths added to the double motion.
    pub fn move_flying(&mut self, strafe: f64, forward: f64, friction: f64) {
        let strafe = f32r(strafe);
        let forward = f32r(forward);
        let friction = f32r(friction);
        let mut f = f32r(f32r(strafe * strafe) + f32r(forward * forward));
        if f >= f32r(1.0e-4) {
            f = f32r(f.sqrt());
            if f < 1.0 {
                f = 1.0;
            }
            f = f32r(friction / f);
            let strafe = f32r(strafe * f);
            let forward = f32r(forward * f);
            let a = f32r(f32r(f32r(self.yaw) * F_PI) / 180.0);
            let s = mc_sin(a) as f64;
            let c = mc_cos(a) as f64;
            self.motion_x += f32r(f32r(strafe * c) - f32r(forward * s));
            self.motion_z += f32r(f32r(forward * c) + f32r(strafe * s));
        }
    }

    /// JS: `moveEntity(world, x, y, z)` — the full sweep + step-height
    /// resolution, 1:1 including the vanilla variable juggling.
    pub fn move_entity(&mut self, world: &dyn PhysicsWorld, mut x: f64, mut y: f64, mut z: f64) {
        if self.no_clip {
            self.set_position(self.x + x, self.y + y, self.z + z);
            return;
        }
        if self.in_web {
            self.in_web = false;
            x *= 0.25;
            y *= 0.05000000074505806;
            z *= 0.25;
            self.motion_x = 0.0;
            self.motion_y = 0.0;
            self.motion_z = 0.0;
        }
        let d4 = y;
        let bb0 = self.bb();
        let mut bb = bb0;
        let sneak_edge = self.on_ground && self.sneaking;
        if sneak_edge {
            let d6 = 0.05;
            let empty = |bx: f64, bz: f64, bb: &[f64; 6]| -> bool {
                let o = [bb[0] + bx, bb[1] - 1.0, bb[2] + bz, bb[3] + bx, bb[4] - 1.0, bb[5] + bz];
                world.get_collisions(&o).is_empty()
            };
            while x != 0.0 && empty(x, 0.0, &bb) {
                if x < d6 && x >= -d6 { x = 0.0; } else if x > 0.0 { x -= d6; } else { x += d6; }
            }
            while z != 0.0 && empty(0.0, z, &bb) {
                if z < d6 && z >= -d6 { z = 0.0; } else if z > 0.0 { z -= d6; } else { z += d6; }
            }
            while x != 0.0 && z != 0.0 && empty(x, z, &bb) {
                if x < d6 && x >= -d6 { x = 0.0; } else if x > 0.0 { x -= d6; } else { x += d6; }
                if z < d6 && z >= -d6 { z = 0.0; } else if z > 0.0 { z -= d6; } else { z += d6; }
            }
        }
        let dx0 = x;
        let dz0 = z; // after sneak clamp
        let list1 = world.get_collisions(&add_coord(&bb, x, y, z));
        let bb_orig = bb;
        for c in &list1 {
            y = calc_y_offset_local(c, &bb, y);
        }
        bb = offset_bb(&bb, 0.0, y, 0.0);
        let flag1 = self.on_ground || (d4 != y && d4 < 0.0);
        for c in &list1 {
            x = calc_x_offset_local(c, &bb, x);
        }
        bb = offset_bb(&bb, x, 0.0, 0.0);
        for c in &list1 {
            z = calc_z_offset_local(c, &bb, z);
        }
        bb = offset_bb(&bb, 0.0, 0.0, z);

        if self.step_height > 0.0 && flag1 && (dx0 != x || dz0 != z) {
            let d11 = x;
            let d7 = y;
            let d8 = z;
            let bb3 = bb;
            bb = bb_orig;
            y = self.step_height;
            let list = world.get_collisions(&add_coord(&bb, dx0, y, dz0));
            let mut bb4 = bb;
            let bb5 = add_coord(&bb4, dx0, 0.0, dz0);
            let mut d9 = y;
            for c in &list {
                d9 = calc_y_offset_local(c, &bb5, d9);
            }
            bb4 = offset_bb(&bb4, 0.0, d9, 0.0);
            let mut d15 = dx0;
            for c in &list {
                d15 = calc_x_offset_local(c, &bb4, d15);
            }
            bb4 = offset_bb(&bb4, d15, 0.0, 0.0);
            let mut d16 = dz0;
            for c in &list {
                d16 = calc_z_offset_local(c, &bb4, d16);
            }
            bb4 = offset_bb(&bb4, 0.0, 0.0, d16);
            let mut bb14 = bb;
            let mut d17 = y;
            for c in &list {
                d17 = calc_y_offset_local(c, &bb14, d17);
            }
            bb14 = offset_bb(&bb14, 0.0, d17, 0.0);
            let mut d18 = dx0;
            for c in &list {
                d18 = calc_x_offset_local(c, &bb14, d18);
            }
            bb14 = offset_bb(&bb14, d18, 0.0, 0.0);
            let mut d19 = dz0;
            for c in &list {
                d19 = calc_z_offset_local(c, &bb14, d19);
            }
            bb14 = offset_bb(&bb14, 0.0, 0.0, d19);
            let d20 = d15 * d15 + d16 * d16;
            let d10 = d18 * d18 + d19 * d19;
            if d20 > d10 {
                x = d15; z = d16; y = -d9; bb = bb4;
            } else {
                x = d18; z = d19; y = -d17; bb = bb14;
            }
            for c in &list {
                y = calc_y_offset_local(c, &bb, y);
            }
            bb = offset_bb(&bb, 0.0, y, 0.0);
            if d11 * d11 + d8 * d8 >= x * x + z * z {
                x = d11; y = d7; z = d8; bb = bb3;
            }
        }
        self.x = (bb[0] + bb[3]) / 2.0;
        self.y = bb[1];
        self.z = (bb[2] + bb[5]) / 2.0;
        self.cached_bb = Some(bb);
        self.collided_h = dx0 != x || dz0 != z;
        self.collided_v = d4 != y;
        self.on_ground = self.collided_v && d4 < 0.0;

        // Entity.moveEntity: the block landed on / walked on, floor(y - 0.2),
        // or the fence / wall / gate below an air block
        let reg = world.registry();
        let mut lbx = self.x.floor() as i64;
        let mut lby = (self.y - 0.20000000298023224).floor() as i64;
        let lbz = self.z.floor() as i64;
        let mut lst = world.get_state(lbx, lby, lbz);
        let mut lb = reg.def(lst);
        if lb.id == 0 {
            let b2 = reg.def(world.get_state(lbx, lby - 1, lbz));
            if b2.is_fence || b2.is_wall || b2.is_fence_gate {
                lby -= 1;
                lst = world.get_state(lbx, lby, lbz);
                lb = b2;
            }
        }

        // Entity.updateFallState -> Block.onFallenUpon -> EntityPlayer.fall
        if self.on_ground {
            if self.fall_distance > 0.0 && self.on_fall.is_some() && !self.allow_flying {
                let st = lst;
                let mult = if lb.name == "slime" && !self.sneaking {
                    0.0
                } else if lb.name == "hay_block" {
                    0.2
                } else {
                    1.0
                };
                let jb = if self.jump_boost >= 0 { (self.jump_boost + 1) as f64 } else { 0.0 };
                let dmg = ((self.fall_distance - 3.0 - jb) * mult).ceil() as i64;
                if dmg > 0 {
                    if let Some(cb) = self.on_fall.as_mut() {
                        cb(dmg, st);
                    }
                }
            }
            self.fall_distance = 0.0;
        } else if y < 0.0 {
            self.fall_distance = f32r(self.fall_distance - y);
        }

        if dx0 != x {
            self.motion_x = 0.0;
        }
        if dz0 != z {
            self.motion_z = 0.0;
        }
        if d4 != y {
            // Block.onLanded: slime bounces back unless sneaking
            if lb.name != "slime" || self.sneaking {
                self.motion_y = 0.0;
            } else if self.motion_y < 0.0 {
                self.motion_y = -self.motion_y;
            }
        }

        // Walked distance (view bobbing) and step distance (sounds). Counted
        // in the air too; not while sneaking on the ground or riding.
        let x0 = (bb_orig[0] + bb_orig[3]) / 2.0;
        let y0 = bb_orig[1];
        let z0 = (bb_orig[2] + bb_orig[5]) / 2.0;
        if !(self.on_ground && self.sneaking) && self.riding_entity.is_none() {
            let bx = lbx;
            let by = lby;
            let bz = lbz;
            let st = lst;
            let blk_name = lb.name.clone();
            let blk_id = lb.id;
            let ddx = self.x - x0;
            let ddz = self.z - z0;
            let ddy = if blk_name == "ladder" { self.y - y0 } else { 0.0 };
            self.distance_walked += (ddx * ddx + ddz * ddz).sqrt() * 0.6;
            self.step_distance += (ddx * ddx + ddy * ddy + ddz * ddz).sqrt() * 0.6;
            if self.step_distance > self.next_step_distance && blk_id != 0 {
                self.next_step_distance = self.step_distance.floor() + 1.0;
                if self.in_water {
                    if let Some(cb) = self.on_swim.as_mut() {
                        let v = ((self.motion_x * self.motion_x * 0.2
                            + self.motion_y * self.motion_y
                            + self.motion_z * self.motion_z * 0.2)
                            .sqrt()
                            * 0.35)
                            .min(1.0);
                        cb(v);
                    }
                }
                if let Some(cb) = self.on_step.as_mut() {
                    cb(bx, by, bz, st); // Block.playStepSound skips liquids
                }
            }
        }
        self.last_x = self.x;
        self.last_y = self.y;
        self.last_z = self.z;

        self.do_block_collisions(world);
    }

    /// JS: `doBlockCollisions(world)`.
    pub fn do_block_collisions(&mut self, world: &dyn PhysicsWorld) {
        let reg = world.registry();
        let bb = self.bb();
        let x0 = (bb[0] + 0.001).floor() as i64;
        let x1 = (bb[3] - 0.001).floor() as i64;
        let y0 = (bb[1] + 0.001).floor() as i64;
        let y1 = (bb[4] - 0.001).floor() as i64;
        let z0 = (bb[2] + 0.001).floor() as i64;
        let z1 = (bb[5] - 0.001).floor() as i64;
        for x in x0..=x1 {
            for y in y0..=y1 {
                for z in z0..=z1 {
                    let b = reg.def(world.get_state(x, y, z));
                    if b.id == 0 {
                        continue;
                    }
                    if b.name == "web" {
                        self.in_web = true;
                    } else if b.name == "soul_sand" {
                        self.motion_x *= 0.4;
                        self.motion_z *= 0.4;
                    }
                }
            }
        }
        // Slime: walking on it slows you
        let below = reg.def(world.get_state(
            self.x.floor() as i64,
            (self.y - 0.20000000298023224).floor() as i64,
            self.z.floor() as i64,
        ));
        if below.name == "slime" && self.on_ground && self.motion_y.abs() < 0.1 && !self.sneaking {
            let d = 0.4 + self.motion_y.abs() * 0.2;
            self.motion_x *= d;
            self.motion_z *= d;
        }
    }

    /// JS: `jump()` — getJumpUpwardsMotion() = 0.42F plus jump boost, and the
    /// sprint directional boost.
    pub fn jump(&mut self) {
        self.motion_y = 0.41999998688697815; // 0.42F
        if self.jump_boost >= 0 {
            self.motion_y += f32r((self.jump_boost + 1) as f64 * f_const::P01);
        }
        if self.sprinting {
            let f = f32r(f32r(self.yaw) * f_const::DEG);
            self.motion_x -= f32r(mc_sin(f) as f64 * f_const::P02B);
            self.motion_z += f32r(mc_cos(f) as f64 * f_const::P02B);
        }
    }

    /// JS: `moveEntityWithHeading(world, strafe, forward)`.
    pub fn move_entity_with_heading(&mut self, world: &dyn PhysicsWorld, strafe: f64, forward: f64) {
        if self.flying && self.riding_entity.is_none() {
            let d3 = self.motion_y;
            let jmf = f32r(f32r(self.fly_speed) * if self.sprinting { 2.0 } else { 1.0 });
            self.move_with_heading(world, strafe, forward, jmf);
            self.motion_y = d3 * 0.6;
            self.fall_distance = 0.0;
            return;
        }
        let jmf = self.jump_movement_factor;
        self.move_with_heading(world, strafe, forward, jmf);
    }

    /// JS: `_moveWithHeading(world, strafe, forward, jumpMovementFactor)`.
    fn move_with_heading(&mut self, world: &dyn PhysicsWorld, strafe: f64, forward: f64, jump_movement_factor: f64) {
        if self.in_water && !self.flying {
            let d0 = self.y;
            let mut f1 = f_const::P08;
            let mut f2 = f_const::P02;
            let mut f3 = self.depth_strider as f64;
            if f3 > 3.0 {
                f3 = 3.0;
            }
            if !self.on_ground {
                f3 *= 0.5;
            }
            if f3 > 0.0 {
                f1 = f32r(f1 + f32r(f32r(f32r(0.54600006) - f1) * f3) / 3.0);
                f2 = f32r(f2 + f32r(f32r(self.land_movement_factor - f2) * f3) / 3.0);
            }
            self.move_flying(strafe, forward, f2);
            let mx = self.motion_x;
            let my = self.motion_y;
            let mz = self.motion_z;
            self.move_entity(world, mx, my, mz);
            self.motion_x *= f1;
            self.motion_y *= 0.800000011920929;
            self.motion_z *= f1;
            self.motion_y -= 0.02;
            if self.collided_h
                && self.is_offset_position_in_liquid(
                    world,
                    self.motion_x,
                    self.motion_y + 0.6000000238418579 - self.y + d0,
                    self.motion_z,
                )
            {
                self.motion_y = 0.30000001192092896;
            }
        } else if self.in_lava && !self.flying {
            let d1 = self.y;
            self.move_flying(strafe, forward, f_const::P02);
            let mx = self.motion_x;
            let my = self.motion_y;
            let mz = self.motion_z;
            self.move_entity(world, mx, my, mz);
            self.motion_x *= 0.5;
            self.motion_y *= 0.5;
            self.motion_z *= 0.5;
            self.motion_y -= 0.02;
            if self.collided_h
                && self.is_offset_position_in_liquid(
                    world,
                    self.motion_x,
                    self.motion_y + 0.6000000238418579 - self.y + d1,
                    self.motion_z,
                )
            {
                self.motion_y = 0.30000001192092896;
            }
        } else {
            // slipperiness of the block under the box's minY, times 0.91F
            let slip = |p: &Self, w: &dyn PhysicsWorld| -> f64 {
                let reg = w.registry();
                let b = reg.def(w.get_state(
                    p.x.floor() as i64,
                    (p.bb()[1]).floor() as i64 - 1,
                    p.z.floor() as i64,
                ));
                f32r(f32r(b.slipperiness) * f_const::P091)
            };
            let mut f4 = if self.on_ground { slip(self, world) } else { f_const::P091 };
            let f = f32r(f32r(0.16277136) / f32r(f32r(f4 * f4) * f4));
            let f5 = if self.on_ground {
                f32r(self.land_movement_factor * f)
            } else {
                jump_movement_factor
            };
            self.move_flying(strafe, forward, f5);
            f4 = if self.on_ground { slip(self, world) } else { f_const::P091 };
            let ladder = self.is_on_ladder(world);
            if ladder {
                let f6 = f_const::P015;
                self.motion_x = self.motion_x.min(f6).max(-f6);
                self.motion_z = self.motion_z.min(f6).max(-f6);
                self.fall_distance = 0.0;
                if self.motion_y < -0.15 {
                    self.motion_y = -0.15;
                }
                if self.sneaking && self.motion_y < 0.0 {
                    self.motion_y = 0.0;
                }
            }
            let mx = self.motion_x;
            let my = self.motion_y;
            let mz = self.motion_z;
            self.move_entity(world, mx, my, mz);
            if self.collided_h && ladder {
                self.motion_y = 0.2;
            }
            if !world.is_loaded(self.x.floor() as i64, self.z.floor() as i64) {
                self.motion_y = if self.y > 0.0 { -0.1 } else { 0.0 };
            } else {
                self.motion_y -= 0.08;
            }
            self.motion_y *= 0.9800000190734863;
            self.motion_x *= f4;
            self.motion_z *= f4;
        }
    }

    /// JS: `tick(world, input)` — one full EntityPlayerSP tick.
    /// Returns `{ abilitiesChanged }`.
    pub fn tick(&mut self, world: &dyn PhysicsWorld, input: &PlayerInput) -> TickResult {
        self.prev_x = self.x;
        self.prev_y = self.y;
        self.prev_z = self.z;
        self.prev_yaw = self.yaw;
        self.prev_pitch = self.pitch;
        self.prev_distance_walked = self.distance_walked;
        self.prev_camera_yaw = self.camera_yaw;
        self.prev_camera_pitch = self.camera_pitch;
        let mut result = TickResult::default();

        // Entity.onEntityUpdate: water pushes and in-water / in-lava state
        self.ticks_existed += 1;
        // Player.tick establishes spectator collision/ground state first.
        self.no_clip = self.spectator;
        if self.spectator {
            self.on_ground = false;
        }
        self.handle_water_movement(world);
        self.in_lava = self.is_in_lava(world);

        if self.sprint_toggle_timer > 0 {
            self.sprint_toggle_timer -= 1;
        }
        if self.fly_toggle_timer > 0 {
            self.fly_toggle_timer -= 1;
        }

        // MovementInputFromOptions
        let mut move_forward = 0.0f64;
        let mut move_strafe = 0.0f64;
        if input.forward {
            move_forward += 1.0;
        }
        if input.back {
            move_forward -= 1.0;
        }
        if input.left {
            move_strafe += 1.0;
        }
        if input.right {
            move_strafe -= 1.0;
        }
        let jump = input.jump;
        let sneak_key = input.sneak;
        if sneak_key {
            move_strafe = f32r(move_strafe * 0.3);
            move_forward = f32r(move_forward * 0.3);
        }
        if self.using_item && self.riding_entity.is_none() {
            move_strafe = f32r(move_strafe * f_const::P02B);
            move_forward = f32r(move_forward * f_const::P02B);
            self.sprint_toggle_timer = 0;
        }
        // vanilla: isSneaking() follows the key, even while flying
        self.sneaking = sneak_key;

        // Push out of blocks at 4 bottom corners like vanilla EntityPlayerSP
        if !self.no_clip {
            let w35 = self.width * 0.35;
            let py = self.bb()[1] + 0.5;
            let x = self.x;
            let z = self.z;
            self.push_out_of_blocks(world, x - w35, py, z + w35);
            self.push_out_of_blocks(world, x - w35, py, z - w35);
            self.push_out_of_blocks(world, x + w35, py, z - w35);
            self.push_out_of_blocks(world, x + w35, py, z + w35);
        }

        // Sprint logic
        let f = 0.8;
        let food_ok = self.food > 6 || self.allow_flying;
        if self.on_ground
            && !self.prev_sneak
            && !self.prev_forward_held
            && move_forward >= f
            && !self.sprinting
            && food_ok
            && !self.using_item
            && !self.blind
        {
            if self.sprint_toggle_timer <= 0 && !input.sprint {
                self.sprint_toggle_timer = 7;
            } else {
                self.sprinting = true;
            }
        }
        if !self.sprinting && move_forward >= f && food_ok && !self.using_item && !self.blind && input.sprint {
            self.sprinting = true;
        }
        if self.sprinting && (move_forward < f || self.collided_h || !food_ok) {
            self.sprinting = false;
        }

        // Fly toggle (double tap jump)
        if self.allow_flying {
            if self.spectator {
                if !self.flying {
                    self.flying = true;
                    result.abilities_changed = true;
                }
            } else if !self.prev_jump && jump {
                if self.fly_toggle_timer == 0 {
                    self.fly_toggle_timer = 7;
                } else {
                    self.flying = !self.flying;
                    result.abilities_changed = true;
                    self.fly_toggle_timer = 0;
                }
            }
        }
        if self.flying {
            if sneak_key {
                self.motion_y -= f32r(self.fly_speed * 3.0);
            }
            if jump {
                self.motion_y += f32r(self.fly_speed * 3.0);
            }
        }
        self.prev_jump = jump;
        self.prev_forward_held = move_forward >= f;
        self.prev_sneak = sneak_key;

        // EntityLivingBase.onLivingUpdate
        if self.jump_ticks > 0 {
            self.jump_ticks -= 1;
        }
        if self.motion_x.abs() < 0.005 {
            self.motion_x = 0.0;
        }
        if self.motion_y.abs() < 0.005 {
            self.motion_y = 0.0;
        }
        if self.motion_z.abs() < 0.005 {
            self.motion_z = 0.0;
        }

        if jump {
            if self.in_water || self.is_in_lava(world) {
                self.motion_y += 0.03999999910593033; // 0.04F swim/lava jump
            } else if self.on_ground && self.jump_ticks == 0 {
                self.jump();
                self.jump_ticks = 10;
            }
        } else {
            self.jump_ticks = 0;
        }
        move_strafe = f32r(move_strafe * f_const::P098);
        move_forward = f32r(move_forward * f_const::P098);

        self.move_entity_with_heading(world, move_strafe, move_forward);

        if self.on_ground && self.flying && !self.spectator {
            self.flying = false;
            result.abilities_changed = true;
        }

        // jumpMovementFactor and setAIMoveSpeed for the *next* tick
        self.jump_movement_factor = if self.sprinting {
            f32r(f_const::P02 + f_const::P02 * 0.3)
        } else {
            f_const::P02
        };
        self.land_movement_factor = self.ai_move_speed();

        // View bobbing values (EntityPlayer.onLivingUpdate)
        let mut f1 = (self.motion_x * self.motion_x + self.motion_z * self.motion_z).sqrt();
        let mut f2 = f32r((-self.motion_y * 0.20000000298023224).atan() * 15.0);
        f1 = f32r(f1);
        if f1 > 0.1 {
            f1 = 0.1;
        }
        if !self.on_ground || self.health <= 0.0 {
            f1 = 0.0;
        }
        if self.on_ground || self.health <= 0.0 {
            f2 = 0.0;
        }
        self.camera_yaw += (f1 - self.camera_yaw) * 0.4;
        self.camera_pitch += (f2 - self.camera_pitch) * 0.8;
        result
    }
}

/// JS: `offsetBB(bb, x, y, z)`.
fn offset_bb(bb: &[f64; 6], x: f64, y: f64, z: f64) -> [f64; 6] {
    [bb[0] + x, bb[1] + y, bb[2] + z, bb[3] + x, bb[4] + y, bb[5] + z]
}

/// JS: `addCoord(bb, x, y, z)` — only moves the leading/trailing face per axis.
fn add_coord(bb: &[f64; 6], x: f64, y: f64, z: f64) -> [f64; 6] {
    let mut r = *bb;
    if x < 0.0 { r[0] += x; } else { r[3] += x; }
    if y < 0.0 { r[1] += y; } else { r[4] += y; }
    if z < 0.0 { r[2] += z; } else { r[5] += z; }
    r
}

// The upstream calc{X,Y,Z}Offset live in crate::physics (ported 1:1 there);
// thin local aliases keep the move_entity port textually aligned with the JS.
use crate::physics::{calc_x_offset as calc_x_offset_local, calc_y_offset as calc_y_offset_local, calc_z_offset as calc_z_offset_local};
