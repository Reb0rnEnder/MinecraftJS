// Port of `client/js/game/interaction.js`:
//
// Player interaction (clickMouse, rightClickMouse, block mining, etc.)
//! - Attack cooldown (1.9+)
//! - Swing progress
//! - Block mining speed / relative hardness
//! - Critical hit detection
//! - Aqua affinity / haste / fatigue effects
//! - Equipment progress animation
//! - Block placement and right-click logic
//! - Block breaking and destruction
//! - Creative mode inventory management
//! - Entity targeting and raycasting

use crate::blocks::{BlockRegistry, BlockRegistryCore};
use crate::items::ItemTable;
use crate::fluids::is_point_in_fluid;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::*;

// ------------------------------------------------------------ constants

// EnumFacing index -> direction (down, up, north, south, west, east)
const FACE_DIR: [[i32; 3]; 6] = [
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
    [-1, 0, 0],
    [1, 0, 0],
];

// Items whose onBlockActivated places/acts on the clicked block (returns true in vanilla)
const INTERACTIVE: once_cell::sync::Lazy<HashSet<&'static str>> = once_cell::sync::Lazy::new(|| HashSet::from([
    "barrel", "blast_furnace", "smoker", "stonecutter", "loom", "cartography_table", "grindstone", "lectern", "bell", "chest", "trapped_chest", "ender_chest", "crafting_table", "furnace", "lit_furnace", "dispenser", "dropper",
    "hopper", "brewing_stand", "enchanting_table", "anvil", "beacon", "wooden_door", "spruce_door", "birch_door", "jungle_door",
    "acacia_door", "dark_oak_door", "trapdoor", "fence_gate", "spruce_fence_gate", "birch_fence_gate", "jungle_fence_gate",
    "dark_oak_fence_gate", "acacia_fence_gate", "lever", "stone_button", "wooden_button", "bed", "noteblock", "jukebox",
    "unpowered_repeater", "powered_repeater", "unpowered_comparator", "powered_comparator", "cake", "cauldron", "flower_pot",
    "daylight_detector", "daylight_detector_inverted", "command_block", "dragon_egg", "standing_sign", "wall_sign",
    // 1.9+: their onBlockActivated succeeds too, so the off hand must not click again
    "repeating_command_block", "chain_command_block", "structure_block", "jigsaw",
    "white_shulker_box", "orange_shulker_box", "magenta_shulker_box", "light_blue_shulker_box",
    "yellow_shulker_box", "lime_shulker_box", "pink_shulker_box", "gray_shulker_box",
    "silver_shulker_box", "cyan_shulker_box", "purple_shulker_box", "blue_shulker_box",
    "brown_shulker_box", "green_shulker_box", "red_shulker_box", "black_shulker_box",
]));

// ------------------------------------------------------------ cooldown

/// `EntityPlayer.getCooldownPeriod`: ticks for a full-strength attack (20 / attack speed).
pub fn cooldown_period(attack_speed: f32) -> f32 {
    20.0 / attack_speed.max(1.0)
}

/// `EntityPlayer.getCooledAttackStrength`: attack strength 0..1 based on cooldown progress.
pub fn cooled_attack_strength(ticks_since_last_swing: i32, attack_speed: f32, adjust: f32) -> f32 {
    let period = cooldown_period(attack_speed);
    let v = (ticks_since_last_swing as f32 + adjust) / period;
    v.clamp(0.0, 1.0)
}

/// `EntityPlayer.resetCooldown`
pub fn reset_cooldown(ticks_since_last_swing: &mut i32) {
    *ticks_since_last_swing = 0;
}

/// `_tickCooldown`: called each tick to update cooldown state.
/// Returns true if the cooldown was reset due to item change.
pub fn tick_cooldown(
    ticks_since_last_swing: &mut i32,
    cooldown_item: &mut Option<(i32, i32, i32)>, // (id, damage, count)
    held_item: Option<&Value>,
    items: &ItemTable,
) -> bool {
    *ticks_since_last_swing += 1;

    let held = held_item;
    let prev = *cooldown_item;
    let same = prev.is_none() && held.is_none()
        || (prev.is_some() && held.is_some() && {
            let p = prev.unwrap();
            let h = held.unwrap();
            p.0 == h.get("id").and_then(|v| v.as_i64()).unwrap_or(-1) as i32
                && p.1 == h.get("damage").and_then(|v| v.as_i64()).unwrap_or(-1) as i32
                && p.2 == h.get("count").and_then(|v| v.as_i64()).unwrap_or(-1) as i32
        });

    if !same {
        let same_item = prev.is_none() && held.is_none()
            || (prev.is_some() && held.is_some() && {
                let p = prev.unwrap();
                let h = held.unwrap();
                let hid = h.get("id").and_then(|v| v.as_i64()).unwrap_or(-1) as i32;
                let max_dur = items.max_durability(hid);
                p.0 == hid
                    && (max_dur <= 0 || p.1 == h.get("damage").and_then(|v| v.as_i64()).unwrap_or(-1) as i32)
            });

        if !same_item {
            *ticks_since_last_swing = 0;
        }

        *cooldown_item = held.map(|h| (
            h.get("id").and_then(|v| v.as_i64()).unwrap_or(-1) as i32,
            h.get("damage").and_then(|v| v.as_i64()).unwrap_or(-1) as i32,
            h.get("count").and_then(|v| v.as_i64()).unwrap_or(-1) as i32,
        ));
        true
    } else {
        false
    }
}

// ------------------------------------------------------------ swing progress

/// `updateSwing`: updates swing progress based on haste/fatigue effects.
/// Returns (swing_progress, swing_length).
pub fn update_swing(
    swinging: &mut bool,
    swing_ticks: &mut i32,
    haste_amplifier: Option<i32>,
    fatigue_amplifier: Option<i32>,
) -> (f32, i32) {
    // haste: 6 - (1 + amplifier); fatigue: 6 + (1 + amplifier) * 2
    let len = if let Some(amp) = haste_amplifier {
        6 - (1 + amp)
    } else if let Some(amp) = fatigue_amplifier {
        6 + (1 + amp) * 2
    } else {
        6
    }.max(1);

    if *swinging {
        *swing_ticks += 1;
        let progress = *swing_ticks as f32 / len as f32;
        if *swing_ticks >= len {
            *swing_ticks = 0;
            *swinging = false;
        }
        (progress, len)
    } else {
        *swing_ticks = 0;
        (0.0, len)
    }
}

// ------------------------------------------------------------ equipment progress

/// `updateEquip`: equipment animation progress for main hand and off-hand.
pub fn update_equip(
    equip_progress: &mut f32,
    equip_progress_off: &mut f32,
    _equipped: Option<i32>, // main hand item id
    _equipped_off: Option<i32>, // off hand item id
    main_item: Option<i32>,
    off_item: Option<i32>,
    cooled_strength: f32,
) {
    let f = cooled_strength;
    let clamp = |v: f32| v.max(-0.4).min(0.4);

    let main_target = if main_item.is_some() { f * f * f } else { 0.0 };
    *equip_progress += clamp(main_target - *equip_progress);

    let off_target = if off_item.is_some() { 1.0 } else { 0.0 };
    *equip_progress_off += clamp(off_target - *equip_progress_off);
}

// `resetEquip`: reset equipment progress for a hand.
pub fn reset_equip(hand: i32, equip_progress: &mut f32, equip_progress_off: &mut f32) {
    if hand == 1 {
        *equip_progress_off = 0.0;
    } else {
        *equip_progress = 0.0;
    }
}

// ------------------------------------------------------------ block mining speed

/// `relativeHardness`: mining speed relative to block hardness.
/// Returns progress per tick (float like vanilla).
pub fn relative_hardness(
    reg: &BlockRegistry,
    items: &ItemTable,
    block_state: u32,
    held_item: Option<&Value>,
    effects: &HashMap<i32, Value>,
    on_ground: bool,
    in_water: bool,
    eyes_in_water: bool,
    aqua_affinity: bool,
) -> f32 {
    let b = reg.def(block_state);
    // BlockDef doesn't have hardness field, use a default based on block type
    let hardness = if b.is_liquid { 100.0_f32 } else if b.opaque { 1.5_f32 } else { 0.5_f32 };

    if hardness < 0.0 { return 0.0; }
    if hardness == 0.0 { return f32::INFINITY; }

    let held = held_item;
    let mut f = if let Some(h) = held {
        items.str_vs_block(h.get("id").and_then(|v| v.as_i64()).unwrap_or(-1) as i32, &b.name, &b.material.clone().unwrap_or_default()) as f32
    } else {
        1.0_f32
    };

    if f > 1.0 {
        let id = held.and_then(|h| h.get("id")).and_then(|v| v.as_i64()).unwrap_or(-1) as i32;
        let eff = effects.get(&id).and_then(|e| e.get("amplifier")).and_then(|v| v.as_i64()).unwrap_or(0) as f32;
        if eff > 0.0 {
            f += (eff * eff + 1.0);
        }
    }

    // Haste (effect 3)
    if let Some(e) = effects.get(&3) {
        let amp = e.get("amplifier").and_then(|v| v.as_i64()).unwrap_or(0) as f32;
        f *= 1.0 + (amp + 1.0) * 0.2;
    }

    // Fatigue (effect 4)
    if let Some(e) = effects.get(&4) {
        let amp = e.get("amplifier").and_then(|v| v.as_i64()).unwrap_or(0);
        let mult = match amp {
            0 => 0.3,
            1 => 0.09,
            2 => 0.0027,
            _ => 8.1e-4,
        } as f32;
        f *= mult;
    }

    // Underwater penalty
    if eyes_in_water && !aqua_affinity {
        f /= 5.0;
    }

    // Not on ground penalty
    if !on_ground {
        f /= 5.0;
    }

    // BlockDef doesn't have harvest_tools, use simplified check
    let can_harvest = if let Some(h) = held {
        items.can_harvest(Some(h.get("id").and_then(|v| v.as_i64()).unwrap_or(-1) as i32), None)
    } else {
        false
    };

    let denom = if can_harvest { 30.0_f32 } else { 100.0_f32 };
    (f / hardness / denom) as f32
}

// ------------------------------------------------------------ critical hit

/// Check if an attack is a critical hit (1.9+).
/// Returns (is_critical, damage_multiplier, knockback_bonus).
pub fn critical_hit(
    cooled_strength: f32,
    fall_distance: f32,
    on_ground: bool,
    is_on_ladder: bool,
    in_water: bool,
    riding_entity: bool,
    is_sprinting: bool,
    target_kind: &str, // "player", "mob", "armorstand"
) -> (bool, f32, i32) {
    let strong = cooled_strength > 0.9;
    let crit = strong
        && fall_distance > 0.0
        && !on_ground
        && !is_on_ladder
        && !in_water
        && !riding_entity
        && (target_kind == "player" || target_kind == "mob" || target_kind == "armorstand")
        && !is_sprinting;

    (crit, 0.0, 0)
}

// ------------------------------------------------------------ block breaking progress

/// Block breaking progress per tick.
/// Returns (new_damage, block_broken).
pub fn block_break_progress(
    cur_damage: f32,
    rel_hardness: f32,
) -> (f32, bool) {
    let new_damage = cur_damage + rel_hardness;
    let broken = new_damage >= 1.0;
    (new_damage, broken)
}

// ------------------------------------------------------------ aqua affinity

/// Check if player has Aqua Affinity on any armor piece.
pub fn has_aqua_affinity(armor: &[Option<Value>], items: &ItemTable) -> bool {
    armor.iter().any(|it| {
        it.as_ref().and_then(|i| i.get("id")).and_then(|v| v.as_i64()).map_or(false, |id| {
            let tag = Value::Object(serde_json::Map::new());
            items.enchant_level(&tag, "aqua_affinity") > 0
        })
    })
}

// ------------------------------------------------------------ eyes in water

/// Check if player's eyes are in water (not while in a boat).
pub fn eyes_in_water(
    reg: &BlockRegistry,
    world_get_state: impl Fn(i32, i32, i32) -> u32,
    x: f64,
    y: f64,
    z: f64,
    eye_height: f64,
    riding_boat: bool,
) -> bool {
    if riding_boat { return false; }
    is_point_in_fluid(reg, world_get_state, x, y + eye_height, z)
}

// ------------------------------------------------------------ entity targeting

/// Targetable entity for raycasting.
#[derive(Clone, Debug)]
pub struct EntityTarget {
    pub id: i32,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub width: f64,
    pub height: f64,
    pub pickable: bool,
    pub has_box: bool,
    pub box_min_x: f64,
    pub box_min_y: f64,
    pub box_min_z: f64,
    pub box_max_x: f64,
    pub box_max_y: f64,
    pub box_max_z: f64,
}

// Simple entity raycast for targeting.
/// Returns hit distance and entity if hit.
pub fn raycast_entities(
    eye: [f64; 3],
    look: [f64; 3],
    reach: f64,
    entities: &[EntityTarget],
    game_mode: i32,
    entity_id: i32,
    riding_entity_id: i32,
) -> Option<(f64, EntityTarget)> {
    let entity_reach = if game_mode == 1 { 6.0 } else { reach };
    let mut best_dist = reach;
    let mut best = None;

    for e in entities {
        if !e.pickable || e.id == entity_id || e.id == riding_entity_id { continue; }

        let border = 0.1;
        let (x, y, z, w, h) = if e.has_box {
            (e.box_min_x, e.box_min_y, e.box_min_z, e.box_max_x - e.box_min_x, e.box_max_y - e.box_min_y)
        } else {
            let w = e.width / 2.0 + border;
            (e.x - w, e.y - border, e.z - w, w * 2.0, e.height + border * 2.0)
        };

        if let Some(t) = ray_box(eye[0], eye[1], eye[2], look[0], look[1], look[2], x, y, z, x + w, y + h, z + w) {
            if t < best_dist && (game_mode == 1 || t <= 3.0) {
                best_dist = t;
                best = Some((t, e.clone()));
            }
        }
    }

    best
}

// Ray-box intersection (from physics)
fn ray_box(
    ox: f64, oy: f64, oz: f64,
    dx: f64, dy: f64, dz: f64,
    min_x: f64, min_y: f64, min_z: f64,
    max_x: f64, max_y: f64, max_z: f64,
) -> Option<f64> {
    let inv_dx = if dx != 0.0 { 1.0 / dx } else { 0.0 };
    let inv_dy = if dy != 0.0 { 1.0 / dy } else { 0.0 };
    let inv_dz = if dz != 0.0 { 1.0 / dz } else { 0.0 };

    let tx1 = (min_x - ox) * inv_dx;
    let tx2 = (max_x - ox) * inv_dx;
    let tmin = tx1.min(tx2);
    let tmax = tx1.max(tx2);

    let ty1 = (min_y - oy) * inv_dy;
    let ty2 = (max_y - oy) * inv_dy;
    let tmin = tmin.max(ty1.min(ty2));
    let tmax = tmax.min(ty1.max(ty2));

    let tz1 = (min_z - oz) * inv_dz;
    let tz2 = (max_z - oz) * inv_dz;
    let tmin = tmin.max(tz1.min(tz2));
    let tmax = tmax.min(tz1.max(tz2));

    if tmax >= tmin && tmax >= 0.0 {
        Some(tmin.max(0.0))
    } else {
        None
    }
}

// ------------------------------------------------------------ interaction state

/// Holds the state for player interaction, ported from `client/js/game/interaction.js`.
/// Holds per-tick state that persists across ticks (cooldown, swing, breaking, etc.).
#[derive(Clone, Debug)]
pub struct Interaction {
    /// PlayerControllerMP.currentBlock
    pub cur_block: [i32; 3],
    /// PlayerControllerMP.currentBlockFace
    pub cur_face: i32,
    /// PlayerControllerMP.blockDamageMP
    pub cur_damage: f32,
    /// PlayerControllerMP.prevBlockDamageMP
    pub prev_damage: f32,
    /// Block hit delay counter
    pub block_hit_delay: i32,
    /// Right click delay counter
    pub right_click_delay: i32,
    /// Left click counter
    pub left_click_counter: i32,
    /// Use ticks counter
    pub use_ticks: i32,
    /// Swing progress
    pub swing_progress: f32,
    /// Previous swing progress
    pub prev_swing_progress: f32,
    /// Swing ticks
    pub swing_ticks: i32,
    /// Currently swinging
    pub swinging: bool,
    /// Equipment progress (main hand)
    pub equip_progress: f32,
    /// Previous equipment progress (main hand)
    pub prev_equip_progress: f32,
    /// Equipment progress (off-hand)
    pub equip_progress_off: f32,
    /// Previous equipment progress (off-hand)
    pub prev_equip_progress_off: f32,
    /// Swing hand (0 = main, 1 = off)
    pub swing_hand: i32,
    /// Active hand (0 = main, 1 = off)
    pub active_hand: i32,
    /// Ticks since last swing
    pub ticks_since_last_swing: i32,
    /// Last held item id
    pub last_held: Option<i32>,
    /// Predicted blocks for placement preview
    pub predicted_blocks: HashMap<String, PredictedBlockEntry>,
    /// Tick counter
    pub tick_number: i32,
    /// Whether currently hitting a block
    pub is_hitting: bool,
    /// Remote breaks map (entityId -> break info)
    pub remote_breaks: HashMap<i32, RemoteBreakEntry>,
}

/// Entry for a predicted block placement.
#[derive(Clone, Debug)]
pub struct PredictedBlockEntry {
    /// Previous state before prediction
    pub previous: Option<u32>,
    /// Predicted state
    pub predicted: u32,
    /// Dimension the prediction was made in
    pub dimension: String,
}

/// Entry for a remote break.
#[derive(Clone, Debug)]
pub struct RemoteBreakEntry {
    /// Position being broken
    pub pos: [i32; 3],
    /// Break stage (0-9)
    pub stage: i32,
    /// Time the break started (tick)
    pub time: i32,
}

// ------------------------------------------------------------ player interaction

/// Hit target alias: the JS controller passes block-or-entity targets; the
/// entity form is `EntityTarget`. Placeholder methods currently treat them alike.
pub type Target = EntityTarget;

/// Minimal block info for prediction toggling (packed state id + registry name).
#[derive(Debug, Clone)]
pub struct BlockInfo {
    pub id: u32,
    pub name: String,
}

/// Minimal world access contract for prediction helpers. The live world
/// remains browser-side JS; hosts implement this trait to bridge it.
pub trait WorldInterface {
    fn get_state(&self, x: i32, y: i32, z: i32) -> u32;
    fn get_light(&self, x: i32, y: i32, z: i32) -> (i32, i32);
    fn is_point_in_fluid(&self, x: f64, y: f64, z: f64) -> bool;
}

impl Interaction {
    /// Create a new Interaction state.
    pub fn new() -> Self {
        Self {
            cur_block: [-1, -1, -1],
            cur_face: 0,
            cur_damage: 0.0,
            prev_damage: 0.0,
            block_hit_delay: 0,
            right_click_delay: 0,
            left_click_counter: 0,
            use_ticks: 0,
            swing_progress: 0.0,
            prev_swing_progress: 0.0,
            swing_ticks: -1,
            swinging: false,
            equip_progress: 0.0,
            prev_equip_progress: 0.0,
            equip_progress_off: 0.0,
            prev_equip_progress_off: 0.0,
            swing_hand: 0,
            active_hand: 0,
            ticks_since_last_swing: 0,
            last_held: None,
            predicted_blocks: HashMap::new(),
            tick_number: 0,
            is_hitting: false,
            remote_breaks: HashMap::new(),
        }
    }

    /// `updateTarget`: like Minecraft.getMouseOver - update the target block/entity the player is looking at.
    /// Returns the target if something was hit, None otherwise.
    pub fn update_target(&mut self, _eye: [f64; 3], _look: [f64; 3], _reach: f64, _game_mode: i32) -> Option<Target> {
        // Full implementation would raycast against world and entities
        // For now, return None as a placeholder
        None
    }

    /// `clickMouse`: like Minecraft.clickMouse (1.9+).
    /// Returns true if a click was processed.
    pub fn click_mouse(&mut self, _target: Option<&Target>, _game: &crate::game::Game) -> bool {
        if self.left_click_counter > 0 { return false; }
        // if player.ridingEntity && player.ridingEntity.kind === 'boat' return;
        // let t = this.target;
        // let miss = !t;
        // if t && t.type === 'entity' this.attackEntity(t.entity);
        // else if t && t.type === 'block' {
        //   const b = getBlock(t.state);
        //   if (b && b.id !== 0) this.clickBlock(t, t.face); else miss = true;
        // }
        // if miss {
        //   if game.gameMode !== 1 this.leftClickCounter = 10;
        //   this.resetCooldown();
        // }
        // this.swing(0);
        false
    }

    /// `attackEntity`: like the JS method.
    pub fn attack_entity(&mut self, _entity_id: i32) {
        // g.send(C.useEntity(e.id, 1));
        // if (g.gameMode === 3) return;
        // this._attackTargetEntity(e);
        // this.resetCooldown();
    }

    /// `_attackTargetEntity`: like the JS method.
    fn _attack_target_entity(&mut self, _entity_kind: &str) {
        // const g = this.game, pl = this.player;
        // if (e.kind === 'item' || e.kind === 'xp' || e.kind === 'arrow') return;
        // const held = g.inventory.held();
        // const f2 = this.cooledAttackStrength(0.5);
        // const sharpness = g.items.enchantLevel(held, 'sharpness');
        // const f1 = (sharpness > 0 ? sharpness * .5 + .5 : 0) * f2;
        // this.resetCooldown();
        // const strong = f2 > 0.9;
        // let i = g.items.enchantLevel(held, 'knockback');
        // if (pl.sprinting && strong) i++;
        // const crit = strong && pl.fallDistance > 0 && !pl.onGround && !pl.isOnLadder(g.world) && !pl.inWater && !g.effects.has(15) &&
        //   !pl.ridingEntity && (e.kind === 'player' || e.kind === 'mob' || e.kind === 'armorstand') && !pl.sprinting;
        // if (e.kind !== 'player') return;
        // if (i > 0) {
        //   pl.motionX *= 0.6;
        //   pl.motionZ *= 0.6;
        //   pl.sprinting = false;
        // }
        // if (crit) g.particles.crit(e);
        // if (f1 > 0) g.particles.magicCrit(e);
    }

    /// `clickBlock`: like PlayerControllerMP.clickBlock.
    pub fn click_block(&mut self, _pos: [i32; 3], _face: i32, _game_mode: i32, _is_hitting: bool, _cur_block: [i32; 3]) {
        // Full implementation would handle block breaking logic
        // See JS: PlayerControllerMP.clickBlock
    }

    /// `_isHittingPos`: check if the position is the same as the current hitting position.
    fn _is_hitting_pos(&self, _pos: [i32; 3]) -> bool {
        let c = self.cur_block;
        // const held = this.game.inventory.held();
        // const sameItem = (!held && !this._hitItem) || (held && this._hitItem && held.id === this._hitItem.id && held.damage === this._hitItem.damage);
        // return c && c.x === pos.x && c.y === pos.y && c.z === pos.z && sameItem;
        false // placeholder
    }

    /// `relativeHardness`: delegate to the module function.
    pub fn relative_hardness_call(&self, reg: &BlockRegistry, items: &ItemTable, block_state: u32, held_item: Option<&Value>, effects: &HashMap<i32, Value>, on_ground: bool, in_water: bool, eyes_in_water: bool, aqua_affinity: bool) -> f32 {
        relative_hardness(reg, items, block_state, held_item, effects, on_ground, in_water, eyes_in_water, aqua_affinity)
    }

    /// `_eyesInWater`: check if player's eyes are in water (not while in a boat).
    fn _eyes_in_water(&self, _world_get_state: impl Fn(i32, i32, i32) -> u32, _x: f64, _y: f64, _z: f64, _eye_height: f64) -> bool {
        // let g = this.game, pl = this.player;
        // if (pl.ridingEntity && pl.ridingBoat) return false;
        // return isPointInFluid(g.world, pl.x, pl.y + pl.eyeHeight(), pl.z);
        false // placeholder
    }

    /// `_aquaAffinity`: check if player has Aqua Affinity.
    fn _aqua_affinity(&self, _inventory_armor: &[Option<Value>], _items: &ItemTable) -> bool {
        // let g = this.game;
        // return g.inventory.armor.some((it) => it && g.items.enchantLevel(it, 'aqua_affinity') > 0);
        false // placeholder
    }

    /// `sendClickBlockToController`: send block clicking to controller.
    pub fn send_click_block_to_controller(&mut self, _left_down: bool) {
        // let g = this.game;
        // if (!leftDown) this.leftClickCounter = 0;
        // if (this.leftClickCounter <= 0 && !this.player.usingItem) {
        //   const t = this.target;
        //   if (leftDown && t && t.type === 'block') {
        //     const b = getBlock(g.world.getState(t.x, t.y, t.z));
        //     if (b && b.id !== 0 && this.onPlayerDamageBlock(t, t.face)) {
        //       g.particles.blockHit(t.x, t.y, t.z, t.face);
        //       this.swing();
        //     }
        //   } else this.resetBreaking();
        // }
    }

    /// `onPlayerDamageBlock`: handle player damaging a block.
    /// Returns true if the block was damaged.
    pub fn on_player_damage_block(&mut self, _t: &Target, _face: i32) -> bool {
        // let g = this.game;
        // const pos = { x: t.x, y: t.y, z: t.z };
        // if (this.blockHitDelay > 0) { this.blockHitDelay--; return true; }
        // if(this._creativeSwordBlocksMining(pos,face)){this.resetBreaking();return false;}
        // if (g.gameMode === 1) {
        //   this.blockHitDelay = 5;
        //   g.tutorial.onHitBlock(g.world.getState(pos.x, pos.y, pos.z), 1);
        //   this._sendDig(0, pos, face);
        //   if (!this._extinguishFire(pos, face)) this.destroyBlockClient(pos);
        //   return true;
        // }
        // if (g.gameMode === 3) return false;
        // if (this._isHittingPos(pos)) {
        //   const state = g.world.getState(pos.x, pos.y, pos.z);
        //   const b = getBlock(state);
        //   if (!b || b.id === 0) { this.isHitting = false; return false; }
        //   this.prevDamage = this.curDamage;
        //   this.curDamage = Math.fround(this.curDamage + this.relativeHardness(b));
        //   if (this.stepSoundCounter % 4 === 0) g.sound.playBlockHit(pos.x, pos.y, pos.z, state);
        //   this.stepSoundCounter++;
        //   g.tutorial.onHitBlock(state, Math.max(0, Math.min(1, this.curDamage)));
        //   if (this.curDamage >= 1) {
        //     this.isHitting = false;
        //     this._sendDig(2, pos, face);
        //     this.destroyBlockClient(pos);
        //     this.curDamage = 0;
        //     this.prevDamage = 0;
        //     this.stepSoundCounter = 0;
        //     this.blockHitDelay = 5;
        //   }
        //   return true;
        // }
        // this.clickBlock(t, face);
        // return true;
        false // placeholder
    }

    /// `resetBreaking`: reset breaking state.
    pub fn reset_breaking(&mut self) {
        // if (this.isHitting && this.curBlock) {
        //   const c = this.curBlock;
        //   this.game.tutorial.onHitBlock(this.game.world.getState(c.x, c.y, c.z), -1);
        //   this._sendDig(1, this.curBlock, this.curFace || 0);
        // }
        self.is_hitting = false;
        self.cur_damage = 0.0;
        self.prev_damage = 0.0;
    }

    /// `destroyBlockClient`: destroy a block client-side.
    pub fn destroy_block_client(&mut self, _pos: [i32; 3]) {
        // let g = this.game;
        // const held = g.inventory.held();
        // if (self._holding_creative_sword()) return false;
        // const state = g.world.getState(pos.x, pos.y, pos.z);
        // const b = getBlock(state);
        // if (!b || b.id === 0) return false;
        // g.particles.blockBreak(pos.x, pos.y, pos.z, state);
        // g.sound.playBlockBreak(pos.x, pos.y, pos.z, state);
        // g.world.setState(pos.x, pos.y, pos.z, 0);
        // // Doors/double plants/beds: the other half goes too (server will confirm)
        // if (b.isDoor) {
        //   const other = getStateProperties(state).half === 'upper' ? pos.y - 1 : pos.y + 1;
        //   const otherState = g.world.getState(pos.x, other, pos.z);
        //   if (getBlock(otherState)?.name === b.name) g.world.setState(pos.x, other, pos.z, 0);
        // }
        // if (g.gameMode !== 1 && held && g.items.isDamageable(held)) {
        //   held.damage++;
        //   if (held.damage > g.items.maxDurability(held.id)) {
        //     g.inventory.setHeld(null);
        //     g.sound.playAtPlayer('entity.item.break', 0.8, 0.8 + Math.random() * 0.4);
        //   }
        // }
        // // vanilla moves currentBlock below the world instead of clearing it; isHitting may still be true here (an
        // // insta-broken block while another was being hit), and the next click aborts that position
        // this.curBlock = { x: this.curBlock.x, y: -1, z: this.curBlock.z };
        // return true;
    }

    /// `_sendDig`: send digging packet.
    fn _send_dig(&mut self, _status: i32, _pos: [i32; 3], _face: i32) {
        // this.pendingDigs ||= new Map();
        // const p=this.player;
        // this.pendingDigs.set(`${pos.x},${pos.y},${pos.z}:${status}`,{x:p.x,y:p.y,z:p.z});
        // while(this.pendingDigs.size>50)this.pendingDigs.delete(this.pendingDigs.keys().next().value);
        // this.game.send(C.blockDig(status,pos.x,pos.y,pos.z,face));
    }

    /// `acknowledgeDigging`: acknowledge digging response from server.
    pub fn acknowledge_digging(&mut self, _x: i32, _y: i32, _z: i32, _status: i32) {
        // const {x,y,z}=p.location,key=`${x},${y},${z}:${p.status}`,before=this.pendingDigs?.get(key);
        // this.pendingDigs?.delete(key);
        // const g=this.game;
        // if(g.world.getState(x,y,z)!==p.block && (!p.successful || p.status!==0 || !before)) {
        //   g.world.setState(x,y,z,p.block);
        //   if(before && g.world.getCollisions(this.player.bb(),this.player).length)this.player.setPosition(before.x,before.y,before.z);
        // }
    }

    /// `onBlockChange`: called when the server sends a block change.
    pub fn on_block_change(&mut self, pos: [i32; 3]) {
        self.predicted_blocks.remove(&format!("{}, {}, {}", pos[0], pos[1], pos[2]));
    }

    /// `_extinguishFire`: extinguish fire when right-clicking.
    fn _extinguish_fire(&mut self, _pos: [i32; 3], _face: i32) -> bool {
        // let g = this.game;
        // const d = FACE_DIR[face] || [0, 1, 0];
        // const x = pos.x + d[0], y = pos.y + d[1], z = pos.z + d[2];
        // const b = getBlock(g.world.getState(x, y, z));
        // if (!b || b.name !== 'fire') return false;
        // g.sound.onWorldEvent({ effectId: 1004, location: { x, y, z }, data: 0 });
        // g.world.setState(x, y, z, 0);
        // return true;
        false // placeholder
    }

    /// `swing`: start arm swing animation.
    pub fn swing(&mut self, _hand: i32) {
        // let g = this.game;
        // g.send(C.armAnimation(hand));
        // this.swingHand = hand;
        // // EntityLivingBase.swingItem: restart only past half of getArmSwingAnimationEnd()
        // if (!this.swinging || this.swingTicks >= Math.floor((this.swingLength || 6) / 2) || this.swingTicks < 0) {
        //   this.swingTicks = -1;
        //   this.swinging = true;
        // }
    }

    /// `rightClickMouse`: like Minecraft.rightClickMouse (1.9+).
    /// Returns true if right click was processed.
    pub fn right_click_mouse(&mut self, _target: Option<&Target>, _game: &crate::game::Game) -> bool {
        // let g = game;
        // if (this.isHitting) return;
        // this.rightClickDelay = 4;
        // if (g.player.ridingEntity && g.player.ridingEntity.kind === 'boat') return;
        // const t = this.target;
        // for (let hand = 0; hand < 2; hand++) {
        //   const stack = g.inventory.getHand(hand);
        //   if (t && t.type === 'entity') {
        //     const e = t.entity;
        //     const p = g.entities.interp(e, 1);
        //     g.send(C.useEntity(e.id, 2, t.hit[0] - p.x, t.hit[1] - p.y, t.hit[2] - p.z, hand));
        //     if (e.kind === 'armorstand' && !((e.armorFlags || 0) & 16)) return;
        //     g.send(C.useEntity(e.id, 0, 0, 0, 0, hand)); // interactWithEntity (INTERACT)
        //     if (e.kind === 'minecart' && e.cartType === 6 && g.canUseCommandBlock()) { g.screens.open(new CommandMinecartScreen(g, e, 12, 13)); return; }
        //     if (g.entities.isInteractive(e, stack)) return;
        //   } else if (t && t.type === 'block') {
        //     if (stack && g.items.name(stack.id) === 'firework_rocket' && this.player.elytraFlying) {
        //       if (this.sendUseItem(stack, hand)) { this.resetEquipped(hand); return; }
        //     }
        //     const b = getBlock(g.world.getState(t.x, t.y, t.z));
        //     if (b && b.id !== 0) {
        //       const before = stack ? stack.count : 0;
        //       if (this.onPlayerRightClick(t, hand)) {
        //         this.swing(hand);
        //         if (stack) {
        //           if (stack.count <= 0) g.inventory.setHand(hand, null);
        //           if (stack.count !== before || g.gameMode === 1) this.resetEquipped(hand);
        //         }
        //         return;
        //       }
        //     }
        //   }
        //   if (stack && this.sendUseItem(stack, hand)) { this.resetEquipped(hand); return; }
        // }
        false // placeholder
    }

    /// `onPlayerRightClick`: like PlayerControllerMP.processRightClickBlock.
    /// Returns true if the right click was successful.
    pub fn on_player_right_click(&mut self, _t: &Target, _hand: i32) -> bool {
        // let g = this.game;
        // const held = g.inventory.getHand(hand);
        // const fx = t.hit[0] - t.x, fy = t.hit[1] - t.y, fz = t.hit[2] - t.z;
        //     const b = getBlock(g.world.getState(t.x, t.y, t.z));
        // let activated = false;
        // if (g.gameMode !== 3) {
        //   const mainAndOffEmpty = !g.inventory.held() && !g.inventory.offhand;
        //   if ((!this.player.sneaking || mainAndOffEmpty) && b && INTERACTIVE.has(b.name) && b.name !== 'iron_door' && b.name !== 'iron_trapdoor') activated = true;
        //   if (activated && (COMMAND_BLOCKS.has(b.name) || b.name === 'structure_block' || b.name==='jigsaw') && !g.canUseCommandBlock()) activated = false;
        //   if (!activated && held && this._itemBlock(held) && g.items.name(held.id)!=='scaffolding' && !this._canPlaceBlockOnSide(t, held)) return false;
        // }
        // // CPacketPlayerTryUseItemOnBlock (cursor position on the face)
        // g.send(C.blockPlace(t.x, t.y, t.z, t.face, hand, fx, fy, fz));
        // if (activated) {
        //   if (COMMAND_BLOCKS.has(b.name)) g.screens.open(new CommandBlockScreen(g, { x: t.x, y: t.y, z: t.z }));
        //   if (b.name === 'structure_block') g.screens.open(new StructureBlockScreen(g, { x: t.x, y: t.y, z: t.z }, g.structureBlocks.get(t.x + ',' + t.y + ',' + t.z)));
        //   if (b.name === 'jigsaw') g.screens.open(new JigsawScreen(g,{x:t.x,y:t.y,z:t.z},g.jigsawBlocks.get(t.x+','+t.y+','+t.z)));
        //   if (b.isDoor || b.name === 'trapdoor' || b.isFenceGate) this.predictToggle(t, b);
        //   return true;
        // }
        // if (g.gameMode === 3) return true;
        // if (held && g.items.name(held.id)==='scaffolding') return true; // authoritative extension/support/falling rules
        // if (!held) return false;
        // if (g.gameMode === 1) {
        //   // creative: onItemUse runs but the stack is restored
        //   const c = held.count, d = held.damage;
        //   const r = this._onItemUse(t, held);
        //   held.count = c; held.damage = d;
        //   return r;
        // }
        // return this._onItemUse(t, held);
        false // placeholder
    }

    /// `_itemBlock`: check if held item is a block item.
    fn _item_block(&self, _held: &Value) -> bool {
        // return !!held && this.game.items.isBlockItem(held.id);
        false // placeholder
    }

    /// `_placedBlock`: get the block type placed by the item.
    fn _placed_block(&self, _held: &Value) -> Option<String> {
        // if (this._itemBlock(held)) return this.game.items.blockFor(held.id);
        // const n = { redstone: 'redstone_wire', string: 'tripwire' }[this.game.items.name(held.id)];
        // return n ? blocksByName[n] || null : null;
        None // placeholder
    }

    /// `_replaceable`: check if a block state is replaceable.
    fn _replaceable(&self, _st: u32) -> bool {
        // let b = getBlock(st);
        // if (!b || b.id === 0 || b.isLiquid) return true;
        // if (b.name === 'snow') return Number(getStateProperties(st).layers || 1) === 1;
        // return /^(tall_grass|dead_bush|vine|fire|kelp|kelp_plant|seagrass|tall_seagrass)$/.test(b.name);
        false // placeholder
    }

    /// `_placementPos`: calculate placement position.
    fn _placement_pos(&self, _t: &Target, _held: &Value) -> ([i32; 3], i32) {
        // let g = this.game;
        // let cur = getBlock(g.world.getState(t.x, t.y, t.z));
        // let face = t.face;
        // let p = { x: t.x, y: t.y, z: t.z };
        // if (cur && cur.name === 'snow' && Number(getStateProperties(g.world.getState(t.x, t.y, t.z)).layers || 1) < 1) face = 1;
        // else if (!this._replaceable(g.world.getState(t.x, t.y, t.z))) {
        //   const d = FACE_DIR[t.face] || [0, 1, 0];
        //   p = { x: t.x + d[0], y: t.y + d[1], z: t.z + d[2] };
        // }
        // return { p, face };
        ([0, 0, 0], 0) // placeholder
    }

    /// `_placementState`: get block state properties for placement.
    fn _placement_state(&self, _t: &Target, _held: &Value, _block: &str) -> u32 {
        // let props={...getStateProperties(block.defaultState)};
        // if('axis' in props)props.axis=['y','y','z','z','x','x'][t.face]||'y';
        // if('type' in props&&block.name.endsWith('_slab'))props.type=t.face===0||t.face!==1&&t.hit[1]-t.y>.5?'top':'bottom';
        // return findState(block.name,props);
        0u32 // placeholder
    }

    /// `_canPlaceBlockOnSide`: check if block can be placed on side.
    fn _can_place_block_on_side(&self, _t: &Target, _held: &Value) -> bool {
        // let g = this.game, w = g.world;
        // const nb = this._placedBlock(held);
        // if (!nb) return false;
        // const { p, face } = this._placementPos(t, held);
        // if (p.y < 0 || p.y > 255) return false;
        // if (!this._replaceable(w.getState(p.x, p.y, p.z))) return false;
        // // entities in the way...
        // // support for blocks that need something under them / beside them
        // const below = getBlock(w.getState(p.x, p.y - 1, p.z));
        // const solidBelow = !!(below && below.opaque);
        // const n = nb.name;
        // if (/^(redstone_wire|repeater|comparator|carpet|pressure_plate|rail|snow|cake)$/.test(n) && !solidBelow) return false;
        // if (/^(dandelion|poppy|sapling|tall_grass|dead_bush|fern|sunflower|lilac|rose_bush|peony|large_fern)$/.test(n) && !(below && /^(grass_block|dirt|farmland|sand)$/.test(below.name) && (n !== 'dead_bush' || below.name === 'sand'))) return false;
        // if (/^(brown_mushroom|red_mushroom)$/.test(n) && !(below && below.opaque)) return false;
        // if (n === 'sugar_cane' && !(below && (below.name === 'sugar_cane' || /^(grass_block|dirt|sand)$/.test(below.name)))) return false;
        // if (/^(torch|redstone_torch|lever|stone_button|wooden_button|ladder|wall_sign|tripwire_hook)$/.test(n)) {
        //    if (face === 0 && n !== 'lever' && !/button/.test(n)) return false;
        //   const d = FACE_DIR[face] || [0, 1, 0];
        //   const sup = getBlock(w.getState(p.x - d[0], p.y - d[1], p.z - d[2]));
        //   if (!(sup && (sup.opaque||face===1&&sup.isPane&&/^(torch|redstone_torch)$/.test(n)))) return false;
        // }
        // true
        false // placeholder
    }

    /// `_onItemUse`: like Item.onItemUse on the client.
    fn _on_item_use(&self, _t: &Target, _held: &Value) -> bool {
        // let g = this.game, w = g.world, id = held.id, name = g.items.name(id);
        // const st = w.getState(t.x, t.y, t.z), b = getBlock(st);
        // const above = (y) => w.getState(t.x, y, t.z);
        // const air = (bb) => !bb || bb.id === 0;
        // const placer = this._placedBlock(held);
        // if (placer) {
        //   if (!this._canPlaceBlockOnSide(t, held)) return false;
        //   if (held.count <= 0) return false;
        //   const { p } = this._placementPos(t, held);
        //   this._predictPlace(p, held, placer);
        //   held.count--; // the server's slot update follows
        //   return true;
        // }
        // switch (name) {
        //   case 'flint_and_steel': return true;
        //   case 'wheat_seeds': case 'carrot': case 'potato':
        //     return t.face === 1 && b && b.name === 'farmland' && air(above(t.y + 1));
        //   case 'nether_wart': return t.face === 1 && b && b.name === 'soul_sand' && air(above(t.y + 1));
        //   case 'sweet_berries':return t.face===1&&/^(grass_block|dirt|coarse_dirt|podzol)$/.test(b?.name||'')&&air(above(t.y+1));
        //   case 'oak_door': case 'iron_door': case 'spruce_door': case 'birch_door': case 'jungle_door': case 'acacia_door': case 'dark_oak_door':
        //     return t.face === 1 && air(above(t.y + 1)) && air(above(t.y + 2)) && !!(b && b.opaque);
        //   case 'white_bed': case 'orange_bed': case 'magenta_bed': case 'light_blue_bed': case 'yellow_bed': case 'lime_bed': case 'pink_bed': case 'gray_bed':
        //     case 'light_gray_bed': case 'cyan_bed': case 'purple_bed': case 'blue_bed': case 'brown_bed': case 'green_bed': case 'red_bed': case 'black_bed':
        //       return t.face === 1 && air(above(t.y + 1));
        //   case 'sign': case 'oak_sign': case 'spruce_sign': case 'birch_sign': case 'jungle_sign': case 'acacia_sign': case 'dark_oak_sign':
        //     case 'white_banner': case 'orange_banner': case 'magenta_banner': case 'light_blue_banner': case 'yellow_banner': case 'lime_banner': case 'pink_banner': case 'gray_banner':
        //     case 'light_gray_banner': case 'cyan_banner': case 'purple_banner': case 'blue_banner': case 'brown_banner': case 'green_banner': case 'red_banner': case 'black_banner':
        //       case 'skeleton_skull': case 'wither_skeleton_skull': case 'zombie_head': case 'creeper_head': case 'player_head': case 'dragon_head':
        //         return t.face !== 0 && !!(b && b.material !== 'plant' && b.boundingBox === 'block');
        //   case 'minecart': case 'chest_minecart': case 'furnace_minecart': case 'tnt_minecart': case 'hopper_minecart': case 'command_block_minecart': case 'spawner_minecart':
        //     return !!(b && /rail$/.test(b.name));
        //   case 'armor_stand': return t.face !== 0;
        //   case 'firework_rocket': return !!this.player.elytraFlying;
        //   case 'painting': case 'item_frame': case 'glow_item_frame': return t.face >= 2;
        //   case 'wooden_hoe': case 'stone_hoe': case 'iron_hoe': case 'diamond_hoe': case 'golden_hoe':
        //     return t.face !== 0 && air(above(t.y + 1)) && !!(b && (b.name === 'grass' || b.name === 'dirt'));
        //   case 'bone_meal': return !!(b && /^(sapling|wheat|carrots|potatoes|pumpkin_stem|melon_stem|grass|tallgrass|double_plant|brown_mushroom|red_mushroom|cocoa)$/.test(b.name));
        //   default: return false;
        // }
        false // placeholder
    }

    /// `_predictPlace`: predict block placement state.
    fn _predict_place(&mut self, _p: [i32; 3], _held: &Value, _nb: &str) {
        // Only predict states whose native placement can be resolved here.
        // ...
    }

    /// `predictToggle`: toggle door/trapdoor/gate client-side.
    pub fn predict_toggle(&mut self, _t: &Target, _b: &BlockInfo) {
        // let g = this.game;
        // let { x, y, z } = t;
        // let st = g.world.getState(x, y, z);
        // let props = getStateProperties(st);
        // if (b.isDoor && props.half === 'upper') { y -= 1; st = g.world.getState(x, y, z); props = getStateProperties(st); }
        // let opening = props.open !== 'true';
        // g.world.setState(x, y, z, findState(b.name, { ...props, open: String(opening) }));
        // // BlockDoor / BlockTrapDoor / BlockFenceGate.onBlockActivated: World.playEvent for the player's own client
        // const iron = b.name === 'iron_trapdoor';
        // let ev = b.isDoor ? (opening ? 1006 : 1012) : b.isFenceGate ? (opening ? 1008 : 1014) : iron ? (opening ? 1037 : 1036) : (opening ? 1007 : 1013);
        // g.sound.onWorldEvent({ effectId: ev, location: { x, y, z }, data: 0 });
    }

    /// `sendUseItem`: like sending use item packet.
    pub fn send_use_item(&mut self, _held: &Value, _hand: i32) -> bool {
        // let g = this.game;
        // if (g.gameMode === 3) return false;
        // const name = g.items.name(held.id);
        // if (name === 'writable_book') {
        //   import('../gui/screens/book.js').then((m) => g.screens.open(new m.BookScreen(g, held, true, hand)));
        // }
        // g.send(C.useItem(hand)); // CPacketPlayerTryUseItem
        // if (g.cooldownFraction(held.id, 0) > 0) return false;
        // if (name === 'trident') {
        //   if (g.items.damage(held) >= g.items.maxDurability(held.id)-1) return false;
        //   if (g.items.enchantLevel(held, 'riptide') > 0 && !this._wetForRiptide()) return false;
        // }
        // if (name === 'firework_rocket' && this.player.elytraFlying) return true;
        // const action = g.items.useAction(held);
        // if (name === 'crossbow' && g.items.crossbowCharged(held)) return true;
        // if (action === 'bow' || action === 'crossbow') {
        //   const ammo = [g.inventory.offhand, ...g.inventory.main].some(s => s && (/^(arrow|spectral_arrow|tipped_arrow)$/.test(g.items.name(s.id)) || action === 'crossbow' && s === g.inventory.offhand && g.items.name(s.id) === 'firework_rocket'));
        //   if (!this.player.creative && !ammo) return false;
        // }
        // if (action !== 'none') {
        //   const canEat = (g.items.canAlwaysEat(held) || g.food < 20) && !this.player.invulnerable;
        //   const food = action === 'eat' && !canEat;
        //   if (!food) {
        //     this.player.usingItem = true;
        //     this.activeHand = hand;
        //     this.useTicks = 0;
        //     return true;
        //   }
        //   return false;
        // }
        // if (name === 'fishing_rod') { this.swing(hand); return true; }
        // const survival = g.gameMode !== 1;
        // const t = this.target;
        // const lookingAtFrame = t && t.type === 'block' && getBlock(t.state).name === 'end_portal_frame';
        // const thrown = ['snowball', 'egg', 'ender_pearl', 'experience_bottle', 'splash_potion', 'lingering_potion'].includes(name) || (name === 'ender_eye' && !lookingAtFrame);
        // if (thrown) {
        //   if (survival) {
        //     held.count--;
        //     if (held.count <= 0) g.inventory.setHand(hand, null);
        //   }
        //   return true;
        // }
        // const type = armorType(held, g.items);
        // if (type >= 0) {
        //   const slot = 3 - type;
        //   if (!g.inventory.armor[slot]) return true;
        // }
        // return false;
        false // placeholder
    }

    /// `_wetForRiptide`: check if player is wet for riptide enchant.
    fn _wet_for_riptide(&self, _world: &dyn WorldInterface) -> bool {
        // let bodyWet=!!p.inWater;
        // if(w&&typeof w.getState==='function'&&typeof p.bb==='function'&&!(p.ridingEntity&&p.ridingBoat)){
        //   const bb=p.bb();
        //   for(let x=Math.floor(bb[0]);!bodyWet&&x<Math.ceil(bb[3]);x++)for(let z=Math.floor(bb[2]);!bodyWet&&z<Math.ceil(bb[5]);z++)for(let y=Math.floor(bb[1]);!bodyWet&&y<Math.ceil(bb[4]);y++)bodyWet=isPointInFluid(w,x+.5,Math.max(y,bb[1]),z+.5);
        // }
        // return bodyWet||!!(w?.isRainingAt?.(p.x,p.y,p.z)||w?.isRainingAt?.(p.x,p.y+p.height,p.z));
        false // placeholder
    }

    /// `stopUsingItem`: stop using the current item.
    pub fn stop_using_item(&mut self, _game: &crate::game::Game) {
        // let g = game;
        // g.send(C.blockDig(5, 0, 0, 0, 0));
        // if (held && g.items.name(held.id) === 'trident' && this.useTicks >= 10) {
        //   let level = g.items.enchantLevel(held, 'riptide');
        //   if (level > 0 && this._wetForRiptide()) {
        //     this.player.startRiptide(level, g.world);
        //     g.sound?.playAtPlayer('item.trident.riptide_' + Math.min(level, 3), 1, 1);
        //   }
        // }
        // this.player.usingItem = false;
        // this.useTicks = 0;
    }

    /// `middleClick`: like middleClick from JS.
    pub fn middle_click(&mut self, _game: &crate::game::Game) {
        // let g = game;
        // const t = this.target;
        // if (!t) return;
        // let item = null;
        // if (t.type === 'block') {
        //   const st = t.state;
        //   item = pickBlockItem(st, g);
        // } else if (t.type === 'entity') {
        //   const e = t.entity;
        //   let name = null;
        //   if (e.kind === 'painting') name = 'painting';
        //   else if (e.kind === 'itemframe') { if (e.item) item = copy(e.item); else name = 'item_frame'; }
        //   else if (e.kind === 'minecart') name = e.entityName;
        //   else if (e.kind === 'boat') name = (['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'][e.boatType || 0] || 'oak') + '_boat';
        //   else if (e.kind === 'armorstand') name = 'armor_stand';
        //   else if (e.kind === 'crystal') name = 'end_crystal';
        //   else if (e.kind === 'mob' && e.entityName) name = e.entityName + '_spawn_egg';
        //   const def = name && g.items.byName.get(name);
        //   if (def) item = { id: def.id, count: 1, damage: 0 };
        // }
        // if (!item) return;
        // let inv = g.inventory;
        // // Already in hotbar?
        // for (let i = 0; i < 9; i++) {
        //   const s = inv.main[i];
        //   if (s && stackable(s, item)) { g.selectSlot(i); return; }
        // }
        // if (g.gameMode !== 1) {
        //   // Survival: swap from main inventory if present
        //   for (let i = 9; i < 36; i++) {
        //     const s = inv.main[i];
        //     if (s && s.id === item.id && s.damage === item.damage) {
        //       inv.click.call(inv, i, g.heldSlot, 2);
        //       return;
        //     }
        //   }
        //   return;
        // }
        // // Creative: put the item into the current hotbar slot (or the first empty one)
        // let slot = g.heldSlot;
        // if (inv.main[slot]) {
        //   for (let i = 0; i < 9; i++) if (!inv.main[i]) { slot = i; break; }
        // }
        // item.count = 1;
        // inv.main[slot] = item;
        // g.selectSlot(slot);
        // g.send(C.creativeSlot(36 + slot, item));
    }

    /// `dropItem`: drop the held item.
    pub fn drop_item(&mut self, _all: bool, _game: &crate::game::Game) {
        // let g = game;
        // const held = g.inventory.held();
        // if (!held || g.gameMode === 3) return;
        // g.send(C.blockDig(if all then 3 else 4, 0, 0, 0, 0));
        // if (all) g.inventory.setHeld(null);
        // else { held.count--; if (held.count <= 0) g.inventory.setHeld(null); }
        // this.swing();
    }

    /// `setRemoteBreak`: set a remote break for an entity.
    pub fn set_remote_break(&mut self, _entity_id: i32, _pos: [i32; 3], _stage: i32) {
        // if (stage < 0 || stage > 9) this.remoteBreaks.delete(entityId);
        // else this.remoteBreaks.set(entityId, { pos, stage, time: this.game.ticks });
    }

    /// `_lightAround`: get light levels around a block.
    fn _light_around(&self, _world: &dyn WorldInterface, _p: [i32; 3]) -> (i32, i32) {
        // let w = this.game.world;
        // let mut sky = 0, block = 0;
        // for (const [dx, dy, dz] of [[0, 0, 0], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
        //   sky = Math.max(sky, w.getSkyLight(p.x + dx, p.y + dy, p.z + dz));
        //   block = Math.max(block, w.getBlockLight(p.x + dx, p.y + dy, p.z + dz));
        // }
        // return { sky, block };
        (0, 0) // placeholder
    }

    /// `renderSelection`: render the selection highlight.
    pub fn render_selection(&mut self, _partial: f64, _game: &crate::game::Game) {
        // let g = game;
        // g.renderer.setOutline(null);
        // if (this.isHitting && this.curBlock.y >= 0) {
        //   const dmg = this.prevDamage + (this.curDamage - this.prevDamage) * partial;
        //   const stage = Math.floor(dmg * 10) - 1;
        //   const st = g.world.getState(this.curBlock.x, this.curBlock.y, this.curBlock.z);
        //   g.renderer.setBreakProgress(this.curBlock, stage, st, this._lightAround(this.curBlock));
        // } else {
        //   let shown = false;
        //   for (const rb of this.remoteBreaks.values()) {
        //     if (g.ticks - rb.time > 400) continue;
        //     let st = g.world.getState(rb.pos.x, rb.pos.y, rb.pos.z);
        //     g.renderer.setBreakProgress(rb.pos, rb.stage, st, this._lightAround(rb.pos));
        //     shown = true;
        //     break;
        //   }
        //   if (!shown) g.renderer.setBreakProgress(null, -1);
        // }
    }
}

// ------------------------------------------------------------ pickBlockItem

/// Block.getPickBlock -> item for a block state
pub fn pick_block_item(state: u32, _items: &ItemTable) -> Option<(i32, i32)> {
    // let b = getBlock(state);
    // if (!b || b.name === 'air') return null;
    // let map = {
    //   wall_sign: 'sign', wall_torch: 'torch', redstone_wall_torch: 'redstone_torch',
    //   redstone_wire: 'redstone', tripwire: 'string', wheat: 'wheat_seeds', carrots: 'carrot', potatoes: 'potato',
    //   beetroots: 'beetroot_seeds', cocoa: 'cocoa_beans', pumpkin_stem: 'pumpkin_seeds', attached_pumpkin_stem: 'pumpkin_seeds',
    //   melon_stem: 'melon_seeds', attached_melon_stem: 'melon_seeds', farmland: 'dirt', grass_path: 'dirt',
    //   kelp_plant: 'kelp', tall_seagrass: 'seagrass',
    // };
    // let name = map[b.name] || b.name.replace(/^potted_/, '').replace('_wall_', '_');
    // if (b.name === 'piston_head') name = getStateProperties(state).type === 'sticky' ? 'sticky_piston' : 'piston';
    // let def = items.byName.get(name);
    // return def && def.id > 0 ? { id: def.id, count: 1, damage: 0 } : null;
    None // placeholder - full impl needs BlockDef access
}

// ------------------------------------------------------------ WASM bindings

#[wasm_bindgen]
pub fn interaction_cooldown_period(attack_speed: f32) -> f32 {
    cooldown_period(attack_speed)
}

#[wasm_bindgen]
pub fn interaction_cooled_attack_strength(ticks: i32, attack_speed: f32, adjust: f32) -> f32 {
    cooled_attack_strength(ticks, attack_speed, adjust)
}

#[wasm_bindgen]
pub fn interaction_block_break_progress(cur_damage: f32, rel_hardness: f32) -> f32 {
    let (new_damage, _) = block_break_progress(cur_damage, rel_hardness);
    new_damage
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cooldown_period_calculates_correctly() {
        assert!((cooldown_period(4.0) - 5.0).abs() < 0.001); // default sword
        assert!((cooldown_period(1.6) - 12.5).abs() < 0.001); // axe
    }

    #[test]
    fn cooled_attack_strength_scales_correctly() {
        assert!((cooled_attack_strength(0, 4.0, 0.0) - 0.0).abs() < 0.001);
        assert!((cooled_attack_strength(5, 4.0, 0.0) - 1.0).abs() < 0.001);
        assert!((cooled_attack_strength(2, 4.0, 0.0) - 0.4).abs() < 0.001);
    }

    #[test]
    fn swing_progress_updates_correctly() {
        let mut ticks = 0;
        let mut swinging = true;
        // Simulate 6 ticks to reach full swing (progress = 1.0)
        let mut p6 = 0.0;
        for _ in 0..6 {
            let (p, _) = update_swing(&mut swinging, &mut ticks, None, None);
            p6 = p;
        }
        assert!((p6 - 1.0).abs() < 0.001);
        // 7th tick should wrap to 0
        let (p7, _) = update_swing(&mut swinging, &mut ticks, None, None);
        assert!((p7 - 0.0).abs() < 0.001);
    }

    #[test]
    fn critical_hit_conditions() {
        // Strong attack, falling, not on ground, not in water, not on ladder
        let (crit, _, _) = critical_hit(1.0, 1.0, false, false, false, false, false, "mob");
        assert!(crit);
        
        // Not critical if on ground
        let (crit, _, _) = critical_hit(1.0, 1.0, true, false, false, false, false, "mob");
        assert!(!crit);
        
        // Not critical if in water
        let (crit, _, _) = critical_hit(1.0, 1.0, false, false, true, false, false, "mob");
        assert!(!crit);
        
        // Not critical if riding
        let (crit, _, _) = critical_hit(1.0, 1.0, false, false, false, true, false, "mob");
        assert!(!crit);
        
        // Not critical for items/xp/arrows
        let (crit, _, _) = critical_hit(1.0, 1.0, false, false, false, false, false, "item");
        assert!(!crit);
    }
}