//! Port of `client/js/game/fox.js`: fox entity flag handling, tick interpolation, and animation.
//!
//! The JavaScript original handles fox metadata flags, per-tick interpolation for
//! crouch/interest amounts, and animation argument preparation. This module provides
//! pure WASM-exported helpers plus AI/behavior logic for fox entities.

use std::f64::consts::PI;
use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

// ------------------------------------------------------------ fox flag bitfield

/// Fox DATA_FLAGS_ID bitfield (u8):
/// bit 0 (1): sitting
/// bit 1 (2): unused
/// bit 2 (4): crouching
/// bit 3 (8): interested
/// bit 4 (16): pouncing
/// bit 5 (32): sleeping
/// bit 6 (64): faceplanted
/// bit 7 (128): defending
pub const FOX_FLAG_SITTING: u8 = 1;
pub const FOX_FLAG_CROUCHING: u8 = 4;
pub const FOX_FLAG_INTERESTED: u8 = 8;
pub const FOX_FLAG_POUNCING: u8 = 16;
pub const FOX_FLAG_SLEEPING: u8 = 32;
pub const FOX_FLAG_FACEPLANTED: u8 = 64;
pub const FOX_FLAG_DEFENDING: u8 = 128;

// ------------------------------------------------------------ Fox state struct

/// Internal fox state for AI tick (mirrors entity fields used by JS).
#[derive(Debug, Default, Clone, Copy)]
#[wasm_bindgen]
pub struct FoxState {
    pub fox_flags: u8,
    pub sitting: bool,
    pub fox_crouching: bool,
    pub fox_interested: bool,
    pub fox_pouncing: bool,
    pub fox_sleeping: bool,
    pub fox_faceplanted: bool,
    pub fox_defending: bool,
    pub fox_type: u8,
    pub fox_interest_amount: f64,
    pub prev_fox_interested: f64,
    pub fox_crouch_amount: f64,
    pub prev_fox_crouch_amount: f64,
    pub trusted_uuid_0: i64,
    pub trusted_uuid_1: i64,
    pub age: i32,
    pub child: bool,
}

#[wasm_bindgen]
impl FoxState {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    /// Apply fox flags from metadata byte (matches `applyFoxFlags`).
    #[wasm_bindgen]
    pub fn apply_flags(&mut self, flags: u8) {
        self.fox_flags = flags;
        self.sitting = (flags & FOX_FLAG_SITTING) != 0;
        self.fox_crouching = (flags & FOX_FLAG_CROUCHING) != 0;
        self.fox_interested = (flags & FOX_FLAG_INTERESTED) != 0;
        self.fox_pouncing = (flags & FOX_FLAG_POUNCING) != 0;
        self.fox_sleeping = (flags & FOX_FLAG_SLEEPING) != 0;
        self.fox_faceplanted = (flags & FOX_FLAG_FACEPLANTED) != 0;
        self.fox_defending = (flags & FOX_FLAG_DEFENDING) != 0;
    }

    /// Get current flags byte.
    #[wasm_bindgen]
    pub fn flags(&self) -> u8 {
        self.fox_flags
    }

    /// Per-tick interpolation update (matches `tickFox`).
    #[wasm_bindgen]
    pub fn tick(&mut self) {
        self.prev_fox_interested = self.fox_interest_amount;
        let target = if self.fox_interested { 1.0 } else { 0.0 };
        self.fox_interest_amount = self.prev_fox_interested + (target - self.prev_fox_interested) * 0.4;

        self.prev_fox_crouch_amount = self.fox_crouch_amount;
        if self.fox_crouching {
            self.fox_crouch_amount = (self.prev_fox_crouch_amount + 0.2).min(3.0);
        } else {
            self.fox_crouch_amount = 0.0;
        }
    }

    /// Prepare animation arguments for render (matches `foxAnimationArgs`).
    #[wasm_bindgen]
    pub fn animation_args(&self, partial: f64) -> FoxAnimationArgs {
        let interest = self.prev_fox_interested
            + (self.fox_interest_amount - self.prev_fox_interested) * partial;

        FoxAnimationArgs {
            fox_sleeping: self.fox_sleeping,
            fox_crouching: self.fox_crouching,
            fox_faceplanted: self.fox_faceplanted,
            fox_crouch_amount: self.prev_fox_crouch_amount
                + (self.fox_crouch_amount - self.prev_fox_crouch_amount) * partial,
            fox_head_roll: interest * 0.11 * PI,
        }
    }
}

// ------------------------------------------------------------ Animation args

/// Animation arguments returned to JS for fox model rendering.
#[derive(Debug, Clone, Copy)]
#[wasm_bindgen]
pub struct FoxAnimationArgs {
    pub fox_sleeping: bool,
    pub fox_crouching: bool,
    pub fox_faceplanted: bool,
    pub fox_crouch_amount: f64,
    pub fox_head_roll: f64,
}

// ------------------------------------------------------------ Pure function exports (JS-compatible)

/// Apply fox flags to a JSON entity object (standalone, matches `applyFoxFlags(e, flags)`).
#[wasm_bindgen]
pub fn apply_fox_flags(entity_json: &str, flags: u8) -> String {
    let mut entity: Value = serde_json::from_str(entity_json).unwrap_or(json!({}));
    entity["foxFlags"] = json!(flags & 255);
    entity["sitting"] = json!((flags & FOX_FLAG_SITTING) != 0);
    entity["foxCrouching"] = json!((flags & FOX_FLAG_CROUCHING) != 0);
    entity["foxInterested"] = json!((flags & FOX_FLAG_INTERESTED) != 0);
    entity["foxPouncing"] = json!((flags & FOX_FLAG_POUNCING) != 0);
    entity["foxSleeping"] = json!((flags & FOX_FLAG_SLEEPING) != 0);
    entity["foxFaceplanted"] = json!((flags & FOX_FLAG_FACEPLANTED) != 0);
    entity["foxDefending"] = json!((flags & FOX_FLAG_DEFENDING) != 0);
    entity.to_string()
}

/// Tick fox interpolation on a JSON entity object (standalone, matches `tickFox(e)`).
#[wasm_bindgen]
pub fn tick_fox(entity_json: &str) -> String {
    let mut entity: Value = serde_json::from_str(entity_json).unwrap_or(json!({}));

    let prev_interested = entity.get("foxInterestAmount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    entity["prevFoxInterested"] = json!(prev_interested);

    let interested = entity.get("foxInterested").and_then(|v| v.as_bool()).unwrap_or(false);
    let target = if interested { 1.0 } else { 0.0 };
    let interest_amount = prev_interested + (target - prev_interested) * 0.4;
    entity["foxInterestAmount"] = json!(interest_amount);

    let prev_crouch = entity.get("foxCrouchAmount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    entity["prevFoxCrouchAmount"] = json!(prev_crouch);

    let crouching = entity.get("foxCrouching").and_then(|v| v.as_bool()).unwrap_or(false);
    let crouch_amount = if crouching {
        (prev_crouch + 0.2).min(3.0)
    } else {
        0.0
    };
    entity["foxCrouchAmount"] = json!(crouch_amount);

    entity.to_string()
}

/// Get fox animation args from a JSON entity object (standalone, matches `foxAnimationArgs(e, partial)`).
#[wasm_bindgen]
pub fn fox_animation_args(entity_json: &str, partial: f64) -> String {
    let entity: Value = serde_json::from_str(entity_json).unwrap_or(json!({}));

    let prev_interested = entity.get("prevFoxInterested").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let interest_amount = entity.get("foxInterestAmount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let interest = prev_interested + (interest_amount - prev_interested) * partial;

    let prev_crouch = entity.get("prevFoxCrouchAmount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let crouch_amount = entity.get("foxCrouchAmount").and_then(|v| v.as_f64()).unwrap_or(0.0);

    let args = json!({
        "foxSleeping": entity.get("foxSleeping").and_then(|v| v.as_bool()).unwrap_or(false),
        "foxCrouching": entity.get("foxCrouching").and_then(|v| v.as_bool()).unwrap_or(false),
        "foxFaceplanted": entity.get("foxFaceplanted").and_then(|v| v.as_bool()).unwrap_or(false),
        "foxCrouchAmount": prev_crouch + (crouch_amount - prev_crouch) * partial,
        "foxHeadRoll": interest * 0.11 * PI,
    });
    args.to_string()
}

// ------------------------------------------------------------ Fox AI / Behavior (ported from server logic)

/// Fox AI behavior state machine.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[wasm_bindgen]
pub enum FoxBehavior {
    Idle = 0,
    Sleeping = 1,
    Sitting = 2,
    Wandering = 3,
    Hunting = 4,
    Fleeing = 5,
    Pouncing = 6,
    Faceplanted = 7,
    Breeding = 8,
    FollowingOwner = 9,
    Defending = 10,
    Eating = 11,
}

/// Target type for fox AI.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[wasm_bindgen]
pub enum FoxTargetType {
    None = 0,
    Prey = 1,
    Predator = 2,
    Player = 3,
    BreedingPartner = 4,
    Food = 5,
}

/// Result of target selection.
#[derive(Debug, Clone, Copy)]
#[wasm_bindgen]
pub struct FoxTargetResult {
    target_type: FoxTargetType,
    target_x: f64,
    target_y: f64,
    target_z: f64,
    target_entity_id: i32,
    distance_sq: f64,
    valid: bool,
}

#[wasm_bindgen]
impl FoxTargetResult {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            target_type: FoxTargetType::None,
            target_x: 0.0,
            target_y: 0.0,
            target_z: 0.0,
            target_entity_id: -1,
            distance_sq: f64::MAX,
            valid: false,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn target_type(&self) -> FoxTargetType { self.target_type }
    #[wasm_bindgen(getter)]
    pub fn target_x(&self) -> f64 { self.target_x }
    #[wasm_bindgen(getter)]
    pub fn target_y(&self) -> f64 { self.target_y }
    #[wasm_bindgen(getter)]
    pub fn target_z(&self) -> f64 { self.target_z }
    #[wasm_bindgen(getter)]
    pub fn target_entity_id(&self) -> i32 { self.target_entity_id }
    #[wasm_bindgen(getter)]
    pub fn distance_sq(&self) -> f64 { self.distance_sq }
    #[wasm_bindgen(getter)]
    pub fn valid(&self) -> bool { self.valid }
}

/// Trust UUID pair for wasm return.
#[derive(Debug, Clone, Copy)]
#[wasm_bindgen]
pub struct FoxTrustPair {
    pub uuid_0: i64,
    pub uuid_1: i64,
}

#[wasm_bindgen]
impl FoxTrustPair {
    #[wasm_bindgen(constructor)]
    pub fn new(uuid_0: i64, uuid_1: i64) -> Self {
        Self { uuid_0, uuid_1 }
    }
}

/// AI tick result for wasm return.
#[derive(Debug, Clone, Copy)]
#[wasm_bindgen]
pub struct FoxAITickResult {
    behavior: FoxBehavior,
    target: FoxTargetResult,
}

#[wasm_bindgen]
impl FoxAITickResult {
    #[wasm_bindgen(constructor)]
    pub fn new(behavior: FoxBehavior, target: FoxTargetResult) -> Self {
        Self { behavior, target }
    }

    #[wasm_bindgen(getter)]
    pub fn behavior(&self) -> FoxBehavior { self.behavior }
    #[wasm_bindgen(getter)]
    pub fn target(&self) -> FoxTargetResult { self.target }
}

/// Select the best target for a fox based on its state and surroundings.
/// Returns a FoxTargetResult (valid=false if no target found - JS fallback).
#[wasm_bindgen]
pub fn fox_select_target(
    fox_x: f64,
    fox_y: f64,
    fox_z: f64,
    fox_state: &FoxState,
    prey_entities: &[f64],
    predator_entities: &[f64],
    player_entities: &[f64],
    food_items: &[f64],
    breeding_partners: &[f64],
) -> FoxTargetResult {
    let mut best = FoxTargetResult::new();
    let max_prey_dist = 16.0 * 16.0;
    let max_predator_dist = 16.0 * 16.0;
    let max_player_dist = 24.0 * 24.0;
    let max_food_dist = 12.0 * 12.0;
    let max_breed_dist = 8.0 * 8.0;

    // Priority 1: Flee from predators (if not defending/trusted)
    if !fox_state.fox_defending && !fox_state.sitting && !fox_state.fox_sleeping {
        for chunk in predator_entities.chunks(4) {
            if chunk.len() < 4 { continue; }
            let id = chunk[0] as i32;
            let px = chunk[1];
            let py = chunk[2];
            let pz = chunk[3];
            let dx = px - fox_x;
            let dy = py - fox_y;
            let dz = pz - fox_z;
            let dist_sq = dx*dx + dy*dy + dz*dz;
            if dist_sq < max_predator_dist && dist_sq < best.distance_sq {
                best = FoxTargetResult {
                    target_type: FoxTargetType::Predator,
                    target_x: px, target_y: py, target_z: pz,
                    target_entity_id: id,
                    distance_sq: dist_sq,
                    valid: true,
                };
            }
        }
        if best.valid { return best; }
    }

    // Priority 2: Hunt prey (if not sitting/sleeping/fleeing)
    if !fox_state.sitting && !fox_state.fox_sleeping && !fox_state.fox_faceplanted {
        for chunk in prey_entities.chunks(5) {
            if chunk.len() < 5 { continue; }
            let id = chunk[0] as i32;
            let px = chunk[1];
            let py = chunk[2];
            let pz = chunk[3];
            let dx = px - fox_x;
            let dy = py - fox_y;
            let dz = pz - fox_z;
            let dist_sq = dx*dx + dy*dy + dz*dz;
            if dist_sq < max_prey_dist && dist_sq < best.distance_sq {
                best = FoxTargetResult {
                    target_type: FoxTargetType::Prey,
                    target_x: px, target_y: py, target_z: pz,
                    target_entity_id: id,
                    distance_sq: dist_sq,
                    valid: true,
                };
            }
        }
        if best.valid { return best; }
    }

    // Priority 3: Follow trusted player / breeding
    if !fox_state.sitting && !fox_state.fox_sleeping {
        for chunk in player_entities.chunks(5) {
            if chunk.len() < 5 { continue; }
            let id = chunk[0] as i32;
            let px = chunk[1];
            let py = chunk[2];
            let pz = chunk[3];
            let trusted = chunk[4] != 0.0;
            let dx = px - fox_x;
            let dy = py - fox_y;
            let dz = pz - fox_z;
            let dist_sq = dx*dx + dy*dy + dz*dz;

            if trusted && dist_sq < max_player_dist && dist_sq < best.distance_sq {
                best = FoxTargetResult {
                    target_type: FoxTargetType::Player,
                    target_x: px, target_y: py, target_z: pz,
                    target_entity_id: id,
                    distance_sq: dist_sq,
                    valid: true,
                };
            }
        }
        if best.valid { return best; }
    }

    // Priority 4: Pick up food items
    if !fox_state.sitting && !fox_state.fox_sleeping && !fox_state.fox_crouching {
        for chunk in food_items.chunks(4) {
            if chunk.len() < 4 { continue; }
            let px = chunk[0];
            let py = chunk[1];
            let pz = chunk[2];
            let dx = px - fox_x;
            let dy = py - fox_y;
            let dz = pz - fox_z;
            let dist_sq = dx*dx + dy*dy + dz*dz;
            if dist_sq < max_food_dist && dist_sq < best.distance_sq {
                best = FoxTargetResult {
                    target_type: FoxTargetType::Food,
                    target_x: px, target_y: py, target_z: pz,
                    target_entity_id: -1,
                    distance_sq: dist_sq,
                    valid: true,
                };
            }
        }
        if best.valid { return best; }
    }

    // Priority 5: Breeding partner
    if !fox_state.sitting && !fox_state.fox_sleeping {
        for chunk in breeding_partners.chunks(4) {
            if chunk.len() < 4 { continue; }
            let id = chunk[0] as i32;
            let px = chunk[1];
            let py = chunk[2];
            let pz = chunk[3];
            let dx = px - fox_x;
            let dy = py - fox_y;
            let dz = pz - fox_z;
            let dist_sq = dx*dx + dy*dy + dz*dz;
            if dist_sq < max_breed_dist && dist_sq < best.distance_sq {
                best = FoxTargetResult {
                    target_type: FoxTargetType::BreedingPartner,
                    target_x: px, target_y: py, target_z: pz,
                    target_entity_id: id,
                    distance_sq: dist_sq,
                    valid: true,
                };
            }
        }
        if best.valid { return best; }
    }

    best
}

/// Calculate pounce velocity for fox hunting.
/// Returns [motion_x, motion_y, motion_z] or [0,0,0] if can't pounce.
#[wasm_bindgen]
pub fn fox_pounce(
    fox_x: f64,
    fox_y: f64,
    fox_z: f64,
    target_x: f64,
    target_y: f64,
    target_z: f64,
    on_ground: bool,
) -> Vec<f64> {
    if !on_ground {
        return vec![0.0, 0.0, 0.0];
    }

    let dx = target_x - fox_x;
    let dz = target_z - fox_z;
    let dy = target_y - fox_y;
    let dist = (dx*dx + dz*dz).sqrt();

    if dist < 0.5 || dist > 5.0 {
        return vec![0.0, 0.0, 0.0];
    }

    let speed = 1.3;
    let vy = if dy > 1.0 { 1.2 } else { 0.8 };

    let vx = (dx / dist) * speed;
    let vz = (dz / dist) * speed;

    vec![vx, vy, vz]
}

/// Calculate flee velocity from a threat.
/// Returns [motion_x, motion_y, motion_z].
#[wasm_bindgen]
pub fn fox_flee(
    fox_x: f64,
    _fox_y: f64,
    fox_z: f64,
    threat_x: f64,
    _threat_y: f64,
    threat_z: f64,
    speed: f64,
) -> Vec<f64> {
    let dx = fox_x - threat_x;
    let dz = fox_z - threat_z;
    let dist = (dx*dx + dz*dz).sqrt();

    if dist < 0.01 {
        return vec![0.0, 0.0, 0.0];
    }

    let vx = (dx / dist) * speed;
    let vz = (dz / dist) * speed;

    vec![vx, 0.0, vz]
}

/// Determine if fox should sleep based on time and conditions.
/// Returns true if fox should start sleeping.
#[wasm_bindgen]
pub fn fox_should_sleep(
    time_of_day: f64,
    _fox_y: f64,
    sky_light: u8,
    block_light: u8,
    is_raining: bool,
    has_predator_nearby: bool,
    is_sitting: bool,
) -> bool {
    if is_sitting || has_predator_nearby || is_raining {
        return false;
    }
    if time_of_day < 6000.0 || time_of_day > 18000.0 {
        return false;
    }
    if sky_light > 7 || block_light > 7 {
        return false;
    }
    true
}

/// Determine if fox should wake up.
/// Returns true if fox should stop sleeping.
#[wasm_bindgen]
pub fn fox_should_wake(
    time_of_day: f64,
    sky_light: u8,
    block_light: u8,
    is_raining: bool,
    has_predator_nearby: bool,
    player_nearby: bool,
    trusted_player_nearby: bool,
) -> bool {
    if time_of_day < 6000.0 || time_of_day > 18000.0 {
        return true;
    }
    if is_raining || has_predator_nearby {
        return true;
    }
    if player_nearby && !trusted_player_nearby {
        return true;
    }
    if sky_light > 10 || block_light > 10 {
        return true;
    }
    false
}

/// Check if fox can breed with another fox.
/// Returns true if breeding conditions met.
#[wasm_bindgen]
pub fn fox_can_breed(
    fox_age: i32,
    partner_age: i32,
    fox_has_food: bool,
    partner_has_food: bool,
    distance_sq: f64,
    both_trust_player: bool,
) -> bool {
    if fox_age < 0 || partner_age < 0 { return false; }
    if !fox_has_food || !partner_has_food { return false; }
    if distance_sq > 8.0 * 8.0 { return false; }
    if !both_trust_player { return false; }
    true
}

/// Update trust/owner system for fox.
/// Returns new trust UUID pair.
#[wasm_bindgen]
pub fn fox_update_trust(
    current_trusted_0: i64,
    current_trusted_1: i64,
    player_uuid_0: i64,
    player_uuid_1: i64,
    player_fed_fox: bool,
    player_attacked_fox: bool,
) -> FoxTrustPair {
    if player_attacked_fox {
        return FoxTrustPair::new(0, 0);
    }
    if player_fed_fox && (current_trusted_0 == 0 && current_trusted_1 == 0) {
        return FoxTrustPair::new(player_uuid_0, player_uuid_1);
    }
    FoxTrustPair::new(current_trusted_0, current_trusted_1)
}

/// Check if fox is holding an item in its mouth.
/// Returns item ID or -1 if not holding.
#[wasm_bindgen]
pub fn fox_held_item(entity_json: &str) -> i32 {
    let entity: Value = serde_json::from_str(entity_json).unwrap_or(json!({}));
    entity.get("heldItem").and_then(|v| v.as_i64()).unwrap_or(-1) as i32
}

/// Set item held by fox.
#[wasm_bindgen]
pub fn fox_set_held_item(entity_json: &str, item_id: i32) -> String {
    let mut entity: Value = serde_json::from_str(entity_json).unwrap_or(json!({}));
    if item_id >= 0 {
        entity["heldItem"] = json!(item_id);
    } else {
        entity["heldItem"] = json!(null);
    }
    entity.to_string()
}

/// Fox AI tick - main behavior update.
/// Returns FoxAITickResult with new behavior state and target.
#[wasm_bindgen]
pub fn fox_ai_tick(
    fox_state: &mut FoxState,
    fox_x: f64,
    _fox_y: f64,
    fox_z: f64,
    _on_ground: bool,
    time_of_day: f64,
    sky_light: u8,
    block_light: u8,
    is_raining: bool,
    prey_entities: &[f64],
    predator_entities: &[f64],
    player_entities: &[f64],
    food_items: &[f64],
    breeding_partners: &[f64],
) -> FoxAITickResult {
    // Update interpolation first
    fox_state.tick();

    // Sleep/wake logic
    if fox_state.fox_sleeping {
        if fox_should_wake(time_of_day, sky_light, block_light, is_raining, false, false, false) {
            fox_state.fox_sleeping = false;
            fox_state.apply_flags(fox_state.fox_flags & !FOX_FLAG_SLEEPING);
            return FoxAITickResult::new(FoxBehavior::Wandering, FoxTargetResult::new());
        }
        return FoxAITickResult::new(FoxBehavior::Sleeping, FoxTargetResult::new());
    }

    if fox_should_sleep(time_of_day, 64.0, sky_light, block_light, is_raining, false, fox_state.sitting) {
        fox_state.fox_sleeping = true;
        fox_state.apply_flags(fox_state.fox_flags | FOX_FLAG_SLEEPING);
        return FoxAITickResult::new(FoxBehavior::Sleeping, FoxTargetResult::new());
    }

    // Sitting takes precedence
    if fox_state.sitting {
        return FoxAITickResult::new(FoxBehavior::Sitting, FoxTargetResult::new());
    }

    // Faceplanted (stuck after pounce miss)
    if fox_state.fox_faceplanted {
        return FoxAITickResult::new(FoxBehavior::Faceplanted, FoxTargetResult::new());
    }

    // Pouncing
    if fox_state.fox_pouncing {
        return FoxAITickResult::new(FoxBehavior::Pouncing, FoxTargetResult::new());
    }

    // Defending
    if fox_state.fox_defending {
        return FoxAITickResult::new(FoxBehavior::Defending, FoxTargetResult::new());
    }

    // Select target
    let target = fox_select_target(
        fox_x, 64.0, fox_z,
        fox_state,
        prey_entities, predator_entities,
        player_entities, food_items, breeding_partners,
    );

    let behavior = match target.target_type {
        FoxTargetType::Predator => FoxBehavior::Fleeing,
        FoxTargetType::Prey => FoxBehavior::Hunting,
        FoxTargetType::Player | FoxTargetType::BreedingPartner => FoxBehavior::FollowingOwner,
        FoxTargetType::Food => FoxBehavior::Hunting,
        _ => FoxBehavior::Wandering,
    };

    FoxAITickResult::new(behavior, target)
}

// ------------------------------------------------------------ Sound triggers

/// Fox sound event types.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[wasm_bindgen]
pub enum FoxSound {
    None = 0,
    Ambient = 1,
    Hurt = 2,
    Death = 3,
    Sleep = 4,
    Wake = 5,
    Screech = 6,
    Sniff = 7,
    Eat = 8,
    Pounce = 9,
    Faceplant = 10,
}

/// Determine if fox should play a sound this tick.
/// Returns the sound to play, or None.
#[wasm_bindgen]
pub fn fox_sound_trigger(
    fox_state: &FoxState,
    prev_state: &FoxState,
    random: f64,
) -> FoxSound {
    // State transitions
    if !prev_state.fox_sleeping && fox_state.fox_sleeping {
        return FoxSound::Sleep;
    }
    if prev_state.fox_sleeping && !fox_state.fox_sleeping {
        return FoxSound::Wake;
    }
    if !prev_state.fox_pouncing && fox_state.fox_pouncing {
        return FoxSound::Pounce;
    }
    if !prev_state.fox_faceplanted && fox_state.fox_faceplanted {
        return FoxSound::Faceplant;
    }
    if fox_state.fox_defending && !prev_state.fox_defending {
        return FoxSound::Screech;
    }

    // Ambient sounds (1/100 chance per tick when idle)
    if !fox_state.fox_sleeping
        && !fox_state.sitting
        && !fox_state.fox_pouncing
        && !fox_state.fox_faceplanted
        && random < 0.01
    {
        return FoxSound::Ambient;
    }

    // Sniff when interested
    if fox_state.fox_interested && !prev_state.fox_interested && random < 0.3 {
        return FoxSound::Sniff;
    }

    FoxSound::None
}

// ------------------------------------------------------------ Movement helpers

/// Calculate movement vector towards a target.
/// Returns [move_x, move_z] normalized * speed.
#[wasm_bindgen]
pub fn fox_move_towards(
    fox_x: f64,
    fox_z: f64,
    target_x: f64,
    target_z: f64,
    speed: f64,
) -> Vec<f64> {
    let dx = target_x - fox_x;
    let dz = target_z - fox_z;
    let dist = (dx*dx + dz*dz).sqrt();

    if dist < 0.01 {
        return vec![0.0, 0.0];
    }

    vec![(dx / dist) * speed, (dz / dist) * speed]
}

/// Check if fox can navigate to position (simplified pathfind check).
/// Returns true if path seems clear.
#[wasm_bindgen]
pub fn fox_can_navigate(
    start_x: f64,
    start_y: f64,
    start_z: f64,
    target_x: f64,
    target_y: f64,
    target_z: f64,
) -> bool {
    let dx = target_x - start_x;
    let dz = target_z - start_z;
    let dy = target_y - start_y;
    let dist = (dx*dx + dz*dz).sqrt();

    if dy > 1.5 { return false; }
    if dist > 20.0 { return false; }
    true
}

// ------------------------------------------------------------ Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_flags_decodes_all_bits() {
        let mut state = FoxState::new();
        state.apply_flags(1 | 4 | 8 | 16 | 32 | 64 | 128);
        assert!(state.sitting);
        assert!(state.fox_crouching);
        assert!(state.fox_interested);
        assert!(state.fox_pouncing);
        assert!(state.fox_sleeping);
        assert!(state.fox_faceplanted);
        assert!(state.fox_defending);
    }

    #[test]
    fn tick_interpolates_interest() {
        let mut state = FoxState::new();
        state.fox_interested = true;
        state.tick();
        assert!((state.fox_interest_amount - 0.4).abs() < 0.001);
        state.tick();
        assert!((state.fox_interest_amount - 0.64).abs() < 0.001);
    }

    #[test]
    fn tick_interpolates_crouch() {
        let mut state = FoxState::new();
        state.fox_crouching = true;
        state.tick();
        assert!((state.fox_crouch_amount - 0.2).abs() < 0.001);
        for _ in 0..20 { state.tick(); }
        assert!((state.fox_crouch_amount - 3.0).abs() < 0.001);
    }

    #[test]
    fn tick_resets_crouch_when_not_crouching() {
        let mut state = FoxState::new();
        state.fox_crouching = true;
        for _ in 0..5 { state.tick(); }
        state.fox_crouching = false;
        state.tick();
        assert_eq!(state.fox_crouch_amount, 0.0);
    }

    #[test]
    fn animation_args_interpolates() {
        let mut state = FoxState::new();
        state.fox_interested = true;
        state.fox_crouching = true;
        state.tick();
        let args = state.animation_args(0.5);
        assert!(args.fox_head_roll > 0.0);
        assert!(args.fox_crouch_amount > 0.0 && args.fox_crouch_amount < 3.0);
    }

    #[test]
    fn fox_select_target_prefers_predator() {
        let state = FoxState::new();
        let result = fox_select_target(
            0.0, 64.0, 0.0, &state,
            &[], // no prey
            &[1.0, 5.0, 64.0, 0.0], // predator at distance 5
            &[], &[], &[],
        );
        assert!(result.valid());
        assert_eq!(result.target_type(), FoxTargetType::Predator);
    }

    #[test]
    fn fox_select_target_hunts_prey() {
        let state = FoxState::new();
        let result = fox_select_target(
            0.0, 64.0, 0.0, &state,
            &[10.0, 8.0, 64.0, 0.0, 0.0], // chicken at distance 8
            &[], &[], &[], &[],
        );
        assert!(result.valid());
        assert_eq!(result.target_type(), FoxTargetType::Prey);
    }

    #[test]
    fn fox_pounce_calculates_velocity() {
        let vel = fox_pounce(0.0, 64.0, 0.0, 4.0, 64.0, 0.0, true);
        assert!(vel[0] > 0.0);
        assert!(vel[1] > 0.0);
        assert_eq!(vel[2], 0.0);

        let vel = fox_pounce(0.0, 64.0, 0.0, 10.0, 64.0, 0.0, true);
        assert_eq!(vel, vec![0.0, 0.0, 0.0]);

        let vel = fox_pounce(0.0, 64.0, 0.0, 4.0, 64.0, 0.0, false);
        assert_eq!(vel, vec![0.0, 0.0, 0.0]);
    }

    #[test]
    fn fox_flee_calculates_velocity() {
        let vel = fox_flee(0.0, 64.0, 0.0, 5.0, 64.0, 0.0, 1.0);
        assert!(vel[0] < 0.0);
        assert_eq!(vel[1], 0.0);
        assert_eq!(vel[2], 0.0);
    }

    #[test]
    fn fox_sleep_conditions() {
        assert!(fox_should_sleep(12000.0, 64.0, 5, 0, false, false, false));
        assert!(!fox_should_sleep(20000.0, 64.0, 5, 0, false, false, false));
        assert!(!fox_should_sleep(12000.0, 64.0, 10, 0, false, false, false));
        assert!(!fox_should_sleep(12000.0, 64.0, 5, 0, true, false, false));
        assert!(!fox_should_sleep(12000.0, 64.0, 5, 0, false, true, false));
        assert!(!fox_should_sleep(12000.0, 64.0, 5, 0, false, false, true));
    }

    #[test]
    fn fox_wake_conditions() {
        assert!(fox_should_wake(20000.0, 5, 0, false, false, false, false));
        assert!(fox_should_wake(12000.0, 5, 0, true, false, false, false));
        assert!(fox_should_wake(12000.0, 5, 0, false, true, false, false));
        assert!(fox_should_wake(12000.0, 5, 0, false, false, true, false));
        assert!(!fox_should_wake(12000.0, 5, 0, false, false, true, true));
    }

    #[test]
    fn fox_breed_conditions() {
        assert!(fox_can_breed(0, 0, true, true, 25.0, true));
        assert!(!fox_can_breed(-1, 0, true, true, 25.0, true));
        assert!(!fox_can_breed(0, 0, false, true, 25.0, true));
        assert!(!fox_can_breed(0, 0, true, true, 100.0, true));
        assert!(!fox_can_breed(0, 0, true, true, 25.0, false));
    }

    #[test]
    fn fox_trust_update() {
        let pair = fox_update_trust(0, 0, 123, 456, true, false);
        assert_eq!(pair.uuid_0, 123);
        assert_eq!(pair.uuid_1, 456);
        let pair = fox_update_trust(123, 456, 123, 456, false, true);
        assert_eq!(pair.uuid_0, 0);
        assert_eq!(pair.uuid_1, 0);
        let pair = fox_update_trust(123, 456, 789, 012, false, false);
        assert_eq!(pair.uuid_0, 123);
        assert_eq!(pair.uuid_1, 456);
    }

    #[test]
    fn fox_ai_tick_sleep_cycle() {
        let mut state = FoxState::new();
        let result = fox_ai_tick(&mut state, 0.0, 64.0, 0.0, true, 12000.0, 5, 0, false,
            &[], &[], &[], &[], &[]);
        assert_eq!(result.behavior(), FoxBehavior::Sleeping);
        assert!(state.fox_sleeping);

        let result = fox_ai_tick(&mut state, 0.0, 64.0, 0.0, true, 20000.0, 5, 0, false,
            &[], &[], &[], &[], &[]);
        assert_eq!(result.behavior(), FoxBehavior::Wandering);
        assert!(!state.fox_sleeping);
    }

    #[test]
    fn fox_move_towards_math() {
        let mov = fox_move_towards(0.0, 0.0, 10.0, 0.0, 1.0);
        assert!((mov[0] - 1.0).abs() < 0.001);
        assert_eq!(mov[1], 0.0);

        let mov = fox_move_towards(0.0, 0.0, 0.0, 10.0, 1.0);
        assert_eq!(mov[0], 0.0);
        assert!((mov[1] - 1.0).abs() < 0.001);
    }

    #[test]
    fn standalone_functions_work() {
        let entity = json!({});
        let result = apply_fox_flags(&entity.to_string(), 1 | 4 | 8);
        let e: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(e["sitting"], true);
        assert_eq!(e["foxCrouching"], true);
        assert_eq!(e["foxInterested"], true);

        let result = tick_fox(&result);
        let e: Value = serde_json::from_str(&result).unwrap();
        assert!(e["foxInterestAmount"].as_f64().unwrap() > 0.0);

        let args = fox_animation_args(&result, 0.5);
        let a: Value = serde_json::from_str(&args).unwrap();
        assert!(a["foxHeadRoll"].as_f64().unwrap() > 0.0);
    }
}