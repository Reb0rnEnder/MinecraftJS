//! Port of `client/js/game/death.js`
//! Death and respawn functionality ported from Minecraft JavaScript.

use wasm_bindgen::prelude::*;

/// Death reason for tracking how the player died.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[wasm_bindgen]
pub enum DeathReason {
    Unknown = 0,
    Suffocation = 1,
    Fall = 2,
    Lava = 3,
    Drowning = 4,
    Fire = 5,
    Void = 6,
    Attack = 7,
    Lightning = 8,
    FallingBlock = 9,
    GameTick = 10,
    // JS original has more reasons; add as needed.
}

/// Player death state, mirroring the JS death tracking.
#[derive(Clone, Debug, Default)]
#[wasm_bindgen]
pub struct DeathState {
    /// Whether the player is currently dead.
    dead: bool,
    /// Ticks since death (deathTime in vanilla).
    death_ticks: i32,
    /// Reason for death.
    reason: DeathReason,
    /// Respawn location (x, y, z).
    respawn_x: f64,
    respawn_y: f64,
    respawn_z: f64,
}

#[wasm_bindgen]
impl DeathState {
    #[wasm_bindgen(constructor)]
    pub fn new(dead: bool, reason: DeathReason) -> DeathState {
        DeathState {
            dead,
            death_ticks: 0,
            reason,
            respawn_x: 0.0,
            respawn_y: 0.0,
            respawn_z: 0.0,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn is_dead(&self) -> bool { self.dead }

    #[wasm_bindgen(setter)]
    pub fn set_dead(&mut self, dead: bool) { self.dead = dead; }

    #[wasm_bindgen(getter)]
    pub fn death_ticks(&self) -> i32 { self.death_ticks }

    // Not a `#[wasm_bindgen(setter)]`: the attribute requires a `set_` prefix,
    // and this is a mutator rather than a property assignment.
    pub fn increment_death_ticks(&mut self) { self.death_ticks += 1; }

    #[wasm_bindgen(getter)]
    pub fn reason(&self) -> DeathReason { self.reason }

    #[wasm_bindgen(setter)]
    pub fn set_reason(&mut self, reason: DeathReason) { self.reason = reason; }

    #[wasm_bindgen(getter)]
    pub fn respawn_x(&self) -> f64 { self.respawn_x }

    #[wasm_bindgen(setter)]
    pub fn set_respawn_x(&mut self, x: f64) { self.respawn_x = x; }

    #[wasm_bindgen(getter)]
    pub fn respawn_y(&self) -> f64 { self.respawn_y }

    #[wasm_bindgen(setter)]
    pub fn set_respawn_y(&mut self, y: f64) { self.respawn_y = y; }

    #[wasm_bindgen(getter)]
    pub fn respawn_z(&self) -> f64 { self.respawn_z }

    #[wasm_bindgen(setter)]
    pub fn set_respawn_z(&mut self, z: f64) { self.respawn_z = z; }
}

/// Reset the player to spawn (respawn).
#[wasm_bindgen]
pub fn respawn_player() -> DeathState {
    DeathState {
        dead: false,
        death_ticks: 0,
        reason: DeathReason::Unknown,
        respawn_x: 0.0,
        respawn_y: 0.0,
        respawn_z: 0.0,
    }
}

/// Check if the player is dead based on health.
/// This mirrors the health check logic from client/js/game/game.js.
#[wasm_bindgen]
pub fn check_death(health: f32) -> bool {
    health <= 0.0
}