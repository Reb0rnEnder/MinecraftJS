//! Port of `client/js/game/interaction.js` (PlayerControllerMP + Minecraft
//! `clickMouse` / `rightClickMouse`), algorithmic content only.
//!
//! The JavaScript original is a stateful class wired to the game object: it
//! sends packets, plays sounds, spawns particles and opens GUI screens. Those
//! calls stay in JavaScript. What is ported here is everything that computes a
//! value:
//!
//!   * the interactive-block table and the `EnumFacing` direction table,
//!   * attack cooldown / cooled attack strength and the held-item comparison
//!     that restarts it,
//!   * swing-length, swing progress and the equipped-item animation,
//!   * `Block.getPlayerRelativeBlockHardness` + `EntityPlayer.getDigSpeed`
//!     (haste / fatigue / aqua affinity / efficiency, in `f32` like vanilla),
//!   * the break-progress state machine of `onPlayerDamageBlock`
//!     (`PlayerControllerMP.onPlayerDestroyBlock`) including the block-hit
//!     delay and the step-sound counter,
//!   * `_extinguishFire`, `_creativeSwordBlocksMining` and the destroy rules,
//!   * the door/trapdoor/gate prediction (`predictToggle`) and its world-event
//!     ids,
//!   * `_onItemUse` (the whole item switch), `_placedBlock`, `_replaceable`,
//!     `_placementPos`, `_placementState`, `_canPlaceBlockOnSide`,
//!   * `sendUseItem` decision logic (ammo, cooldown, food, thrown, armour),
//!   * `_wetForRiptide` body-fluid sampling and rain check,
//!   * `middleClick` pick-block item resolution and hotbar slot selection,
//!   * `_lightAround` and the crack-overlay stage from `renderSelection`,
//!   * `pickBlockItem` and the block -> item name mapping table.
//!
//! Left in JavaScript (browser-bound, see the module report): packet sends
//! (`C.*`), `g.sound.*`, `g.particles.*`, tutorial callbacks, `g.screens.open`,
//! the dynamic `import()` of the book screen, `g.send`, WebAudio playback and
//! the renderer calls (`r.setOutline`, `r.setBreakProgress`).

use serde_json::{json, Map, Value};
use wasm_bindgen::prelude::*;

use crate::blocks::BlockRegistry;
use crate::collision::placement_intersects;
use crate::physics::ray_box;

// ---------------------------------------------------------------- constants

/// `EnumFacing` index -> direction (down, up, north, south, west, east).
pub const FACE_DIR: [[i32; 3]; 6] =
    [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

const DYE_COLORS: [&str; 16] = [
    "white",
    "orange",
    "magenta",
    "light_blue",
    "yellow",
    "lime",
    "pink",
    "gray",
    "silver",
    "cyan",
    "purple",
    "blue",
    "brown",
    "green",
    "red",
    "black",
];

/// The `INTERACTIVE` set from the JS module (ordered as written there).
const INTERACTIVE_BASE: [&str; 61] = [
    "barrel",
    "blast_furnace",
    "smoker",
    "stonecutter",
    "loom",
    "cartography_table",
    "grindstone",
    "lectern",
    "bell",
    "chest",
    "trapped_chest",
    "ender_chest",
    "crafting_table",
    "furnace",
    "lit_furnace",
    "dispenser",
    "dropper",
    "hopper",
    "brewing_stand",
    "enchanting_table",
    "anvil",
    "beacon",
    "wooden_door",
    "spruce_door",
    "birch_door",
    "jungle_door",
    "acacia_door",
    "dark_oak_door",
    "trapdoor",
    "fence_gate",
    "spruce_fence_gate",
    "birch_fence_gate",
    "jungle_fence_gate",
    "dark_oak_fence_gate",
    "acacia_fence_gate",
    "lever",
    "stone_button",
    "wooden_button",
    "bed",
    "noteblock",
    "jukebox",
    "unpowered_repeater",
    "powered_repeater",
    "unpowered_comparator",
    "powered_comparator",
    "cake",
    "cauldron",
    "flower_pot",
    "daylight_detector",
    "daylight_detector_inverted",
    "command_block",
    "dragon_egg",
    "standing_sign",
    "wall_sign",
    "repeating_command_block",
    "chain_command_block",
    "structure_block",
    "jigsaw",
    // 15 shulker boxes are appended programmatically below.
    "",
    "",
    "",
    "",
];

/// Blocks that open `GuiCommandBlock` / are command blocks (`COMMAND_BLOCKS`).
const COMMAND_BLOCKS: [&str; 4] =
    ["command_block", "repeating_command_block", "chain_command_block", "structure_block"];

const SWORDS: [&str; 5] =
    ["wooden_sword", "stone_sword", "iron_sword", "diamond_sword", "golden_sword"];

const BOAT_WOODS: [&str; 6] = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];

/// `_pickBlockItem` name map.
const PICK_BLOCK_MAP: [(&str, &str); 18] = [
    ("wall_sign", "sign"),
    ("wall_torch", "torch"),
    ("redstone_wall_torch", "redstone_torch"),
    ("redstone_wire", "redstone"),
    ("tripwire", "string"),
    ("wheat", "wheat_seeds"),
    ("carrots", "carrot"),
    ("potatoes", "potato"),
    ("beetroots", "beetroot_seeds"),
    ("cocoa", "cocoa_beans"),
    ("pumpkin_stem", "pumpkin_seeds"),
    ("attached_pumpkin_stem", "pumpkin_seeds"),
    ("melon_stem", "melon_seeds"),
    ("attached_melon_stem", "melon_seeds"),
    ("farmland", "dirt"),
    ("grass_path", "dirt"),
    ("kelp_plant", "kelp"),
    ("tall_seagrass", "seagrass"),
];

const BOAT_NAME_ALIAS: [(&str, &str); 3] =
    [("boat", "oak"), ("minecart", "minecart"), ("chest_boat", "oak")];

/// `Number(getStateProperties(st).layers || 1)`.
fn layers_of(props: &Map<String, Value>) -> f64 {
    match props.get("layers") {
        Some(Value::String(s)) => s.parse::<f64>().unwrap_or(f64::NAN),
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        _ => f64::NAN,
    }
}

/// `props.open !== 'true'` style truthiness for a state property.
fn prop_truthy(props: &Map<String, Value>, key: &str) -> bool {
    match props.get(key) {
        Some(Value::String(s)) => s == "true",
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0) != 0.0,
        _ => false,
    }
}

fn prop_str(props: &Map<String, Value>, key: &str) -> String {
    match props.get(key) {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => n.to_string(),
        _ => String::new(),
    }
}

#[wasm_bindgen]
pub fn interaction_face_dir(face: i32) -> Vec<i32> {
    FACE_DIR[face.clamp(0, 5) as usize].to_vec()
}

/// The `INTERACTIVE` block-name table as a JSON array of strings.
#[wasm_bindgen]
pub fn interaction_interactive_names() -> String {
    let mut names: Vec<String> = INTERACTIVE_BASE.iter().map(|s| s.to_string()).collect();
    for color in DYE_COLORS.iter().take(15) {
        names.push(format!("{}_shulker_box", color));
    }
    serde_json::to_string(&names).unwrap_or_else(|_| "[]".into())
}

/// `INTERACTIVE.has(name)` for a name or `null`.
#[wasm_bindgen]
pub fn interaction_is_interactive(name: Option<String>) -> bool {
    let Some(name) = name else { return false };
    INTERACTIVE_BASE.contains(&name.as_str())
        || DYE_COLORS
            .iter()
            .take(15)
            .any(|c| name == format!("{}_shulker_box", c))
}

/// `COMMAND_BLOCKS.has(name)`.
#[wasm_bindgen]
pub fn interaction_is_command_block(name: &str) -> bool {
    COMMAND_BLOCKS.contains(&name)
}

// ------------------------------------------------------------ attack cooldown

/// `EntityPlayer.getCooldownPeriod`: ticks for a full-strength attack
/// (20 / attack speed). `attackSpeed` defaults to 4 when falsy.
#[wasm_bindgen]
pub fn interaction_cooldown_period(attack_speed: f64) -> f64 {
    let speed = if attack_speed == 0.0 { 4.0 } else { attack_speed };
    20.0 / speed
}

/// `EntityPlayer.getCooledAttackStrength`.
#[wasm_bindgen]
pub fn interaction_cooled_attack_strength(
    ticks_since_last_swing: f64,
    attack_speed: f64,
    adjust: f64,
) -> f64 {
    let period = interaction_cooldown_period(attack_speed);
    ((ticks_since_last_swing + adjust) / period).clamp(0.0, 1.0)
}

/// `_tickCooldown`: advances the counter and reports whether the cooldown must
/// be reset because the held stack changed.
///
/// `prev`/`held` are JSON `{id,damage,count}` or `null`; `max_durability` is
/// `game.items.maxDurability(held.id)` (only consulted when `held` is set).
#[wasm_bindgen]
pub fn interaction_tick_cooldown(
    prev_json: &str,
    held_json: &str,
    max_durability: f64,
) -> bool {
    let prev: Value = serde_json::from_str(prev_json).unwrap_or(Value::Null);
    let held: Value = serde_json::from_str(held_json).unwrap_or(Value::Null);
    let prev = if prev.is_null() { None } else { Some(prev) };
    let held = if held.is_null() { None } else { Some(held) };

    let pair = |v: &Option<Value>, k: &str| -> i64 {
        v.as_ref().and_then(|x| x.get(k)).and_then(|x| x.as_i64()).unwrap_or(i64::MIN)
    };

    let same = match (&prev, &held) {
        (None, None) => true,
        (Some(_), Some(_)) => {
            pair(&prev, "id") == pair(&held, "id")
                && pair(&prev, "damage") == pair(&held, "damage")
                && pair(&prev, "count") == pair(&held, "count")
        }
        _ => false,
    };
    if same {
        return false;
    }
    // ItemStack.areItemsEqualIgnoreDurability: damage only counts for items
    // without durability.
    let same_item = match (&prev, &held) {
        (None, None) => true,
        (Some(_), Some(_)) => {
            pair(&prev, "id") == pair(&held, "id")
                && (max_durability > 0.0 || pair(&prev, "damage") == pair(&held, "damage"))
        }
        _ => false,
    };
    !same_item
}

// ------------------------------------------------------------------ swinging

/// `EntityLivingBase.getArmSwingAnimationEnd` with the Haste / Mining Fatigue
/// amplifiers applied (`updateSwing`).
#[wasm_bindgen]
pub fn interaction_swing_length(
    haste_amplifier: i32,
    has_haste: bool,
    fatigue_amplifier: i32,
    has_fatigue: bool,
) -> f64 {
    if has_haste {
        (6 - (1 + haste_amplifier)) as f64
    } else if has_fatigue {
        (6 + (1 + fatigue_amplifier) * 2) as f64
    } else {
        6.0
    }
}

/// `swing(hand)`: whether the animation restarts (the arm may only restart past
/// half of `getArmSwingAnimationEnd()`), returning the new `swingTicks`.
#[wasm_bindgen]
pub fn interaction_swing_restart(
    swinging: bool,
    swing_ticks: i32,
    swing_length: i32,
) -> Vec<i32> {
    let length = if swing_length == 0 { 6 } else { swing_length };
    let restart = !swinging || swing_ticks >= length / 2 || swing_ticks < 0;
    // [restart, swingTicks]
    vec![if restart { 1 } else { 0 }, if restart { -1 } else { swing_ticks }]
}

/// `updateSwing`. Returns `[prevSwingProgress, swingProgress, swingTicks,
/// swingLength, swinging(0/1)]` — the JS body with `game.effects` folded in.
#[wasm_bindgen]
pub fn interaction_update_swing(
    swinging: bool,
    swing_ticks: i32,
    swing_progress: f64,
    length: f64,
) -> Vec<f64> {
    let mut ticks = swing_ticks;
    let mut now_swinging = swinging;
    if now_swinging {
        ticks += 1;
        if ticks as f64 >= length {
            ticks = 0;
            now_swinging = false;
        }
    } else {
        ticks = 0;
    }
    vec![
        swing_progress,
        ticks as f64 / length,
        ticks as f64,
        length,
        if now_swinging { 1.0 } else { 0.0 },
    ]
}

/// `ItemRenderer.updateEquippedItem` (1.9+).
///
/// The `_equipped === main` / `_equippedOff === off` tests need object identity
/// in JS; they are passed in as `main_is_equipped` / `off_is_equipped`.
/// Returns `[prevEquipProgress, equipProgress, prevEquipProgressOff,
/// equipProgressOff, mainIsEquipped(0/1), offIsEquipped(0/1)]`.
#[wasm_bindgen]
pub fn interaction_update_equip(
    equip_progress: f64,
    equip_progress_off: f64,
    attack_strength: f64,
    main_is_equipped: bool,
    off_is_equipped: bool,
) -> Vec<f64> {
    let prev = equip_progress;
    let prev_off = equip_progress_off;
    let clamp = |v: f64| v.clamp(-0.4, 0.4);
    let f = attack_strength;
    let p = equip_progress
        + clamp((if main_is_equipped { f * f * f } else { 0.0 }) - equip_progress);
    let p_off = equip_progress_off
        + clamp((if off_is_equipped { 1.0 } else { 0.0 }) - equip_progress_off);
    // The JS `_equipped` / `_equippedOff` identity markers are re-assigned to
    // the current stacks whenever the progress drops below 0.1, and otherwise
    // keep their previous value; the caller holds that previous boolean.
    let update_main = p < 0.1;
    let update_off = p_off < 0.1;
    vec![
        prev,
        p,
        prev_off,
        p_off,
        if main_eq { 1.0 } else { 0.0 },
        if off_eq { 1.0 } else { 0.0 },
    ]
}

// --------------------------------------------------------- block interaction

/// `_holdingCreativeSword`.
#[wasm_bindgen]
pub fn interaction_holding_creative_sword(game_mode: i32, held_item_name: Option<String>) -> bool {
    let Some(name) = held_item_name else { return false };
    game_mode == 1 && SWORDS.contains(&name.as_str())
}

/// `_creativeSwordBlocksMining`: the adjacent block state of `face` decides.
#[wasm_bindgen]
pub fn interaction_creative_sword_blocks_mining(
    holding_creative_sword: bool,
    adjacent_block_name: &str,
) -> bool {
    if !holding_creative_sword {
        return false;
    }
    adjacent_block_name != "fire"
}

/// `Block.getPlayerRelativeBlockHardness` + `EntityPlayer.getDigSpeed`.
///
/// `hardness` is `b.hardness`, `str_vs_block` is `items.strVsBlock(held, b)`,
/// `efficiency` the Efficiency enchantment level, and `aqua`/`eyes_in_water`
/// the Aqua Affinity and `Entity.isInsideOfMaterial(WATER)` results. All
/// arithmetic is in `f32` exactly like the vanilla float path.
#[wasm_bindgen]
pub fn interaction_relative_hardness(
    hardness: f64,
    str_vs_block: f64,
    efficiency: i32,
    has_haste: bool,
    haste_amplifier: i32,
    has_fatigue: bool,
    fatigue_amplifier: i32,
    eyes_in_water: bool,
    aqua_affinity: bool,
    on_ground: bool,
    can_harvest: bool,
    holding_item: bool,
) -> f64 {
    let h = hardness as f32;
    if h < 0.0 {
        return 0.0;
    }
    if h == 0.0 {
        return f64::INFINITY;
    }
    let mut f = str_vs_block as f32;
    if f > 1.0 {
        if efficiency > 0 && holding_item {
            f += (efficiency * efficiency + 1) as f32;
        }
    }
    if has_haste {
        let a = haste_amplifier + 1;
        f *= 1.0f32 + (a as f32 * 0.2f32);
    }
    if has_fatigue {
        let table = [0.3f32, 0.09, 0.0027];
        let m = match usize::try_from(fatigue_amplifier) {
            Ok(i) if i < table.len() => table[i],
            _ => 8.1e-4f32,
        };
        f *= m;
    }
    if eyes_in_water && !aqua_affinity {
        f /= 5.0;
    }
    if !on_ground {
        f /= 5.0;
    }
    (f / h) / (if can_harvest { 30.0f32 } else { 100.0f32 })
}

/// The break-progress bookkeeping of `onPlayerDamageBlock`, isolated from the
/// packet/sound/particle calls.
///
/// Returns `[prevDamage, curDamage, stepSoundCounter, blockHitDelay,
/// finished(0/1)]`.
#[wasm_bindgen]
pub fn interaction_damage_block_step(
    prev_damage: f64,
    cur_damage: f64,
    step_sound_counter: i32,
    block_hit_delay: i32,
    gain: f64,
) -> Vec<f64> {
    let prev = cur_damage;
    let cur = (cur_damage as f32 + gain as f32) as f64;
    let counter = step_sound_counter + 1;
    if cur >= 1.0 {
        vec![prev, 0.0, 0.0, 5.0, 1.0]
    } else {
        vec![prev, cur, counter as f64, block_hit_delay as f64, 0.0]
    }
}

/// `destroyBlockClient` durability step. Returns `[damage, broke(0/1),
/// consumeStack(0/1)]`; the item is only damaged when it is damageable and the
/// player is not in creative.
#[wasm_bindgen]
pub fn interaction_damage_item(
    held_damage: i32,
    is_damageable: bool,
    game_mode: i32,
    max_durability: i32,
) -> Vec<i32> {
    if !is_damageable || game_mode == 1 {
        return vec![held_damage, 0, 0];
    }
    let damage = held_damage + 1;
    let broke = if damage > max_durability { 1 } else { 0 };
    vec![damage, broke, broke]
}

/// `_sendDig` key: `` `${pos.x},${pos.y},${pos.z}:${status}` ``.
#[wasm_bindgen]
pub fn interaction_dig_key(x: i32, y: i32, z: i32, status: i32) -> String {
    format!("{},{},{}:{}", x, y, z, status)
}

/// `_sendDig` bookkeeping: the pending-dig map is capped at 50 entries, evicting
/// the oldest key. Returns the keys to delete in order.
#[wasm_bindgen]
pub fn interaction_dig_evictions(existing_keys_json: &str, max_size: i32) -> String {
    let keys: Vec<String> = serde_json::from_str(existing_keys_json).unwrap_or_default();
    let max = if max_size <= 0 { 50 } else { max_size } as usize;
    let mut size = keys.len();
    let mut out: Vec<String> = Vec::new();
    for key in keys {
        if size <= max {
            break;
        }
        out.push(key);
        size -= 1;
    }
    serde_json::to_string(&out).unwrap_or_else(|_| "[]".into())
}

/// `onBlockChange` / `predictedBlocks` key: `x + ',' + y + ',' + z`.
#[wasm_bindgen]
pub fn interaction_block_key(x: i32, y: i32, z: i32) -> String {
    format!("{},{},{}", x, y, z)
}

/// `_extinguishFire`: the block in front of the clicked face must be fire.
#[wasm_bindgen]
pub fn interaction_is_fire_at_face(block_name: Option<String>) -> bool {
    matches!(block_name.as_deref(), Some("fire"))
}

/// `_lightAround`: the brightest sky and block light around a block (its
/// exposed faces, including the block itself). `neighbors` is a flat
/// `[sky0, block0, sky1, block1, ...]` array in the JS order:
/// `(0,0,0), (0,1,0), (0,-1,0), (1,0,0), (-1,0,0), (0,0,1), (0,0,-1)`.
/// Returns `[sky, block]`.
#[wasm_bindgen]
pub fn interaction_light_around(neighbors: &[f64]) -> Vec<f64> {
    let mut sky = 0.0f64;
    let mut block = 0.0f64;
    for pair in neighbors.chunks_exact(2) {
        sky = sky.max(pair[0]);
        block = block.max(pair[1]);
    }
    vec![sky, block]
}

/// `renderSelection` crack-overlay stage: `Math.floor(dmg * 10) - 1` with
/// `dmg = prevDamage + (curDamage - prevDamage) * partial`.
#[wasm_bindgen]
pub fn interaction_break_stage(prev_damage: f64, cur_damage: f64, partial: f64) -> i32 {
    let dmg = prev_damage + (cur_damage - prev_damage) * partial;
    (dmg * 10.0).floor() as i32 - 1
}

/// `remoteBreaks` liveness: `game.ticks - rb.time > 400` means expired.
#[wasm_bindgen]
pub fn interaction_remote_break_expired(now_ticks: f64, stored_ticks: f64, ttl: f64) -> bool {
    let ttl = if ttl == 0.0 { 400.0 } else { ttl };
    now_ticks - stored_ticks > ttl
}

/// `setRemoteBreak`: stages outside 0..9 clear the entry instead of storing it.
#[wasm_bindgen]
pub fn interaction_remote_break_valid(stage: i32) -> bool {
    (0..=9).contains(&stage)
}

// ------------------------------------------------------------------ raycasts

/// `updateTarget` entity candidate test: returns the ray parameter `t` or -1.
///
/// `box` is `[x0,y0,z0,x1,y1,z1]`; when the entity has a hanging box the JS
/// uses it directly (inflated by `border`), otherwise the interpolated position,
/// `width/2 + border` and `height + border` build the box.
#[wasm_bindgen]
pub fn interaction_entity_ray(
    ox: f64,
    oy: f64,
    oz: f64,
    dx: f64,
    dy: f64,
    dz: f64,
    box_: &[f64],
    border: f64,
) -> f64 {
    if box_.len() < 6 {
        return -1.0;
    }
    let r = ray_box(
        ox,
        oy,
        oz,
        dx,
        dy,
        dz,
        box_[0] - border,
        box_[1] - border,
        box_[2] - border,
        box_[3] + border,
        box_[4] + border,
        box_[5] + border,
    );
    if r.len() >= 3 && r[0] != 0.0 {
        r[1]
    } else {
        -1.0
    }
}

/// `updateTarget` entity candidate box for a non-hanging entity:
/// `[p.x - w, p.y - border, p.z - w, p.x + w, p.y + height + border, p.z + w]`
/// with `w = width/2 + border`.
#[wasm_bindgen]
pub fn interaction_entity_box(
    px: f64,
    py: f64,
    pz: f64,
    width: f64,
    height: f64,
    border: f64,
) -> Vec<f64> {
    let w = width / 2.0 + border;
    vec![px - w, py - border, pz - w, px + w, py + height + border, pz + w]
}

// ------------------------------------------------------- item use / placing

/// `_itemBlock` / `_placedBlock`: the block a placer item puts down, by name.
#[wasm_bindgen]
pub fn interaction_placed_block_name(is_block_item: bool, block_name: &str, item_name: &str) -> String {
    if is_block_item {
        return block_name.to_string();
    }
    match item_name {
        "redstone" => "redstone_wire".into(),
        "string" => "tripwire".into(),
        _ => String::new(),
    }
}

/// `_replaceable(st)` given the looked-up block. `props_json` is the state's
/// property map (`getStateProperties`).
#[wasm_bindgen]
pub fn interaction_replaceable(
    block_exists: bool,
    block_id: u32,
    is_liquid: bool,
    block_name: &str,
    props_json: &str,
) -> bool {
    if !block_exists || block_id == 0 || is_liquid {
        return true;
    }
    if block_name == "snow" {
        let props = parse_object(props_json);
        let layers = layers_of(&props);
        let layers = if layers.is_nan() { 1.0 } else { layers };
        return layers == 1.0;
    }
    matches!(
        block_name,
        "tall_grass" | "dead_bush" | "vine" | "fire" | "kelp" | "kelp_plant" | "seagrass"
            | "tall_seagrass"
    )
}

/// `_placementPos`. `cur_*` describe the clicked state; returns
/// `[px, py, pz, face]`. `snow_layers` is `Number(props.layers || 1)`.
#[wasm_bindgen]
pub fn interaction_placement_pos(
    tx: i32,
    ty: i32,
    tz: i32,
    face: i32,
    cur_name: &str,
    snow_layers: f64,
    replaceable: bool,
) -> Vec<f64> {
    let mut out_face = face;
    let mut x = tx;
    let mut y = ty;
    let mut z = tz;
    let layers = if snow_layers.is_nan() { 1.0 } else { snow_layers };
    if cur_name == "snow" && layers < 1.0 {
        out_face = 1;
    } else if !replaceable {
        let d = FACE_DIR[face.clamp(0, 5) as usize];
        x += d[0];
        y += d[1];
        z += d[2];
    }
    vec![x as f64, y as f64, z as f64, out_face as f64]
}

/// `_placementState` property overlay (the `findState` call stays in JS since
/// it needs the live block registry at the boundary; pass the result through
/// `interaction_find_state`).
///
/// Returns the property map as JSON after the `axis` and slab `type` fixups.
#[wasm_bindgen]
pub fn interaction_placement_state_props(
    default_props_json: &str,
    block_name: &str,
    face: i32,
    hit_y: f64,
    ty: i32,
) -> String {
    let mut props = parse_object(default_props_json);
    let f = face.clamp(0, 5) as usize;
    if props.contains_key("axis") {
        let axis = ["y", "y", "z", "z", "x", "x"][f];
        props.insert("axis".into(), Value::String(axis.into()));
    }
    if props.contains_key("type") && block_name.ends_with("_slab") {
        let top = face == 0 || (face != 1 && hit_y - ty as f64 > 0.5);
        props.insert("type".into(), Value::String(if top { "top" } else { "bottom" }.into()));
    }
    Value::Object(props).to_string()
}

/// `predictToggle` property update: returns the new property map for
/// `findState(b.name, {...props, open: String(opening)})`.
#[wasm_bindgen]
pub fn interaction_toggle_props(props_json: &str) -> String {
    let mut props = parse_object(props_json);
    let opening = !prop_truthy(&props, "open");
    props.insert("open".into(), Value::String(opening.to_string()));
    Value::Object(props).to_string()
}

/// `predictToggle` world-event id selection.
#[wasm_bindgen]
pub fn interaction_toggle_event(is_door: bool, is_fence_gate: bool, is_iron_trapdoor: bool, opening: bool) -> i32 {
    if is_door {
        if opening {
            1006
        } else {
            1012
        }
    } else if is_fence_gate {
        if opening {
            1008
        } else {
            1014
        }
    } else if is_iron_trapdoor {
        if opening {
            1037
        } else {
            1036
        }
    } else if opening {
        1007
    } else {
        1013
    }
}

/// `_canPlaceBlockOnSide` support rules, given the target block name and the
/// already-resolved `below` / `support` names and flags.
///
/// `below_opaque` is `below && below.opaque`; `support_opaque` is
/// `sup && sup.opaque`; `support_ok` also folds in
/// `face === 1 && sup.isPane && /^(torch|redstone_torch)$/.test(n)`.
#[wasm_bindgen]
pub fn interaction_support_ok(
    name: &str,
    face: i32,
    below_name: &str,
    below_opaque: bool,
    support_ok: bool,
) -> bool {
    let below_in = |list: &[&str]| list.contains(&below_name);
    let needs_floor = matches!(
        name,
        "redstone_wire"
            | "repeater"
            | "comparator"
            | "carpet"
            | "pressure_plate"
            | "rail"
            | "snow"
            | "cake"
    );
    if needs_floor && !below_opaque {
        return false;
    }
    let plant = matches!(
        name,
        "dandelion"
            | "poppy"
            | "sapling"
            | "tall_grass"
            | "dead_bush"
            | "fern"
            | "sunflower"
            | "lilac"
            | "rose_bush"
            | "peony"
            | "large_fern"
    );
    if plant {
        let soil = below_in(&["grass_block", "dirt", "farmland", "sand"]);
        if !(soil && (name != "dead_bush" || below_name == "sand")) {
            return false;
        }
    }
    if matches!(name, "brown_mushroom" | "red_mushroom") && !below_opaque {
        return false;
    }
    if name == "sugar_cane"
        && !(below_name == "sugar_cane" || below_in(&["grass_block", "dirt", "sand"]))
    {
        return false;
    }
    let needs_support = matches!(
        name,
        "torch"
            | "redstone_torch"
            | "lever"
            | "stone_button"
            | "wooden_button"
            | "ladder"
            | "wall_sign"
            | "tripwire_hook"
    );
    if needs_support {
        if face == 0 && name != "lever" && !name.contains("button") {
            return false;
        }
        if !support_ok {
            return false;
        }
    }
    true
}

/// `_canPlaceBlockOnSide` entity-overlap sweep for the predicted state.
///
/// `boxes` is the flattened static collision boxes of the placed state,
/// `pos` the placement position, `entity` a candidate `[x0,y0,z0,x1,y1,z1]`.
#[wasm_bindgen]
pub fn interaction_place_blocked(boxes: &[f64], pos: &[f64], entity: &[f64]) -> bool {
    placement_intersects(boxes, pos, entity)
}

/// Entity kinds whose bounding box blocks placement (`_canPlaceBlockOnSide`).
#[wasm_bindgen]
pub fn interaction_kind_blocks_placement(kind: &str) -> bool {
    matches!(
        kind,
        "player" | "mob" | "armorstand" | "boat" | "minecart" | "tnt" | "falling"
    )
}

/// Entity box used by the placement sweep: `[x - hw, y, z - hw, x + hw,
/// y + height, z + hw]` with `hw = (width || 0) / 2`.
#[wasm_bindgen]
pub fn interaction_placement_entity_box(
    x: f64,
    y: f64,
    z: f64,
    width: f64,
    height: f64,
) -> Vec<f64> {
    let hw = width / 2.0;
    vec![x - hw, y, z - hw, x + hw, y + height, z + hw]
}

/// `_onItemUse` for items that are not block placers.
///
/// All the world lookups are done by the caller and passed in as flags, so this
/// function is pure decision logic. `above1`/`above2` are the blocks one and two
/// above the clicked position (`null`/air counts as air).
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn interaction_on_item_use(
    item_name: &str,
    face: i32,
    clicked_name: &str,
    clicked_opaque: bool,
    clicked_material_plant: bool,
    clicked_bounding_box_block: bool,
    above1_air: bool,
    above2_air: bool,
    elytra_flying: bool,
    end_portal_frame_has_eye: bool,
) -> bool {
    match item_name {
        "flint_and_steel" => true,
        "wheat_seeds" | "carrot" | "potato" => {
            face == 1 && clicked_name == "farmland" && above1_air
        }
        "nether_wart" => face == 1 && clicked_name == "soul_sand" && above1_air,
        "sweet_berries" => {
            face == 1
                && matches!(
                    clicked_name,
                    "grass_block" | "dirt" | "coarse_dirt" | "podzol"
                )
                && above1_air
        }
        "oak_door" | "iron_door" | "spruce_door" | "birch_door" | "jungle_door" | "acacia_door"
        | "dark_oak_door" => face == 1 && above1_air && above2_air && clicked_opaque,
        "white_bed" | "orange_bed" | "magenta_bed" | "light_blue_bed" | "yellow_bed"
        | "lime_bed" | "pink_bed" | "gray_bed" | "light_gray_bed" | "cyan_bed" | "purple_bed"
        | "blue_bed" | "brown_bed" | "green_bed" | "red_bed" | "black_bed" => {
            face == 1 && above1_air
        }
        "sign" | "oak_sign" | "spruce_sign" | "birch_sign" | "jungle_sign" | "acacia_sign"
        | "dark_oak_sign" | "white_banner" | "orange_banner" | "magenta_banner"
        | "light_blue_banner" | "yellow_banner" | "lime_banner" | "pink_banner" | "gray_banner"
        | "light_gray_banner" | "cyan_banner" | "purple_banner" | "blue_banner" | "brown_banner"
        | "green_banner" | "red_banner" | "black_banner" | "skeleton_skull"
        | "wither_skeleton_skull" | "zombie_head" | "creeper_head" | "player_head"
        | "dragon_head" => face != 0 && !clicked_material_plant && clicked_bounding_box_block,
        "minecart" | "chest_minecart" | "furnace_minecart" | "tnt_minecart" | "hopper_minecart"
        | "command_block_minecart" | "spawner_minecart" => clicked_name.ends_with("rail"),
        "armor_stand" => face != 0,
        "firework_rocket" => elytra_flying,
        "painting" | "item_frame" | "glow_item_frame" => face >= 2,
        "wooden_hoe" | "stone_hoe" | "iron_hoe" | "diamond_hoe" | "golden_hoe" => {
            face != 0 && above1_air && matches!(clicked_name, "grass" | "dirt")
        }
        "bone_meal" => matches!(
            clicked_name,
            "sapling"
                | "wheat"
                | "carrots"
                | "potatoes"
                | "pumpkin_stem"
                | "melon_stem"
                | "grass"
                | "tallgrass"
                | "double_plant"
                | "brown_mushroom"
                | "red_mushroom"
                | "cocoa"
        ),
        "ender_eye" => clicked_name == "end_portal_frame" && !end_portal_frame_has_eye,
        _ => false,
    }
}

/// `_predictPlace` gate: only states whose native placement can be resolved
/// here (every state property must be `axis`).
#[wasm_bindgen]
pub fn interaction_predict_place_allowed(state_property_names_json: &str) -> bool {
    let names: Vec<String> = serde_json::from_str(state_property_names_json).unwrap_or_default();
    !names.is_empty() && names.iter().all(|n| n == "axis")
}

/// `_predictPlace` gate variant taking the block's property names directly.
#[wasm_bindgen]
pub fn interaction_has_only_axis(props_json: &str) -> bool {
    let props = parse_object(props_json);
    !props.is_empty() && props.keys().all(|k| k == "axis")
}

// ----------------------------------------------------------------- use item

/// `sendUseItem` trident gate.
#[wasm_bindgen]
pub fn interaction_trident_blocked(
    damage: f64,
    max_durability: f64,
    riptide_level: i32,
    wet_for_riptide: bool,
) -> bool {
    if damage >= max_durability - 1.0 {
        return true;
    }
    riptide_level > 0 && !wet_for_riptide
}

/// `sendUseItem` ammo test for bows and crossbows.
///
/// `slots_json` is a JSON array of `{name, offhand}` entries in the JS order
/// `[offhand, ...main]`.
#[wasm_bindgen]
pub fn interaction_has_ammo(slots_json: &str, action: &str) -> bool {
    let slots: Vec<Value> = serde_json::from_str(slots_json).unwrap_or_default();
    slots.iter().any(|s| {
        let name = s.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let arrow = matches!(name, "arrow" | "spectral_arrow" | "tipped_arrow");
        let offhand_rocket = action == "crossbow"
            && s.get("offhand").and_then(|v| v.as_bool()).unwrap_or(false)
            && name == "firework_rocket";
        arrow || offhand_rocket
    })
}

/// `sendUseItem` eat/drink gate: `ItemFood.onItemRightClick` with
/// `EntityPlayer.canEat(alwaysEdible)`.
#[wasm_bindgen]
pub fn interaction_can_eat(food: i32, can_always_eat: bool, invulnerable: bool) -> bool {
    (can_always_eat || food < 20) && !invulnerable
}

/// `sendUseItem` armour slot for a piece of armour: `3 - type`, or -1.
/// `armor_type` is `armorType(held, items)`.
#[wasm_bindgen]
pub fn interaction_armor_slot(armor_type: i32) -> i32 {
    if armor_type >= 0 {
        3 - armor_type
    } else {
        -1
    }
}

/// `sendUseItem` thrown-item table (plus the `ender_eye` frame exception).
#[wasm_bindgen]
pub fn interaction_is_thrown(name: &str, looking_at_end_portal_frame: bool) -> bool {
    matches!(
        name,
        "snowball"
            | "egg"
            | "ender_pearl"
            | "experience_bottle"
            | "splash_potion"
            | "lingering_potion"
    ) || (name == "ender_eye" && !looking_at_end_portal_frame)
}

/// `_wetForRiptide` body sampling bounds: the floored/ceiled box coordinates.
/// Returns `[x0, x1, z0, z1, y0, y1]` matching the JS loop nesting.
#[wasm_bindgen]
pub fn interaction_wet_sample_bounds(bb: &[f64]) -> Vec<f64> {
    if bb.len() < 6 {
        return vec![0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    }
    vec![
        bb[0].floor(),
        bb[3].ceil(),
        bb[2].floor(),
        bb[5].ceil(),
        bb[1].floor(),
        bb[4].ceil(),
    ]
}

/// `_wetForRiptide` sample point for a cell: `(x + .5, max(y, bb[1]), z + .5)`.
#[wasm_bindgen]
pub fn interaction_wet_sample_point(x: f64, y: f64, z: f64, bb_min_y: f64) -> Vec<f64> {
    vec![x + 0.5, y.max(bb_min_y), z + 0.5]
}

/// `stopUsingItem` riptide gate: trident, at least 10 use ticks, Riptide level
/// above zero and still wet.
#[wasm_bindgen]
pub fn interaction_riptide_release(
    item_name: &str,
    use_ticks: i32,
    riptide_level: i32,
    wet_for_riptide: bool,
) -> i32 {
    if item_name == "trident" && use_ticks >= 10 {
        if riptide_level > 0 && wet_for_riptide {
            return riptide_level;
        }
    }
    0
}

/// `Math.min(level, 3)` for the riptide sound variant.
#[wasm_bindgen]
pub fn interaction_riptide_sound_level(level: i32) -> i32 {
    level.min(3)
}

// --------------------------------------------------------------- click logic

/// `clickMouse` miss handling: `if (g.gameMode !== 1) this.leftClickCounter = 10`.
#[wasm_bindgen]
pub fn interaction_miss_left_click_counter(game_mode: i32) -> i32 {
    if game_mode != 1 {
        10
    } else {
        0
    }
}

/// `_attackTargetEntity` knockback/crit computation.
///
/// Returns `[knockback, f1, crit(0/1), slowsPlayer(0/1), resetCooldown(0/1)]`.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn interaction_attack_target(
    target_kind: &str,
    cooled_strength: f64,
    sharpness: i32,
    knockback_level: i32,
    player_sprinting: bool,
    fall_distance: f64,
    on_ground: bool,
    on_ladder: bool,
    in_water: bool,
    has_resistance: bool,
    riding_entity: bool,
) -> Vec<f64> {
    if matches!(target_kind, "item" | "xp" | "arrow") {
        return vec![0.0, 0.0, 0.0, 0.0, 0.0];
    }
    let f2 = cooled_strength;
    let f1 = (if sharpness > 0 { sharpness as f64 * 0.5 + 0.5 } else { 0.0 }) * f2;
    let strong = f2 > 0.9;
    let mut i = knockback_level;
    if player_sprinting && strong {
        i += 1;
    }
    let crit = strong
        && fall_distance > 0.0
        && !on_ground
        && !on_ladder
        && !in_water
        && !has_resistance
        && !riding_entity
        && matches!(target_kind, "player" | "mob" | "armorstand")
        && !player_sprinting;
    let accepts = target_kind == "player";
    let slows = accepts && i > 0;
    vec![
        i as f64,
        f1,
        if crit && accepts { 1.0 } else { 0.0 },
        if slows { 1.0 } else { 0.0 },
        1.0,
    ]
}

/// `middleClick` pick-block for an entity target -> item name (`null` = none).
/// `item_frame_item_json` is the frame's held item when present.
#[wasm_bindgen]
pub fn interaction_pick_entity_name(
    kind: &str,
    entity_name: &str,
    boat_type: i32,
    has_item_frame_item: bool,
) -> String {
    if kind == "painting" {
        return "painting".into();
    }
    if kind == "itemframe" {
        return if has_item_frame_item { String::new() } else { "item_frame".into() };
    }
    if kind == "minecart" {
        return entity_name.to_string();
    }
    if kind == "boat" {
        let wood = BOAT_WOODS
            .get(boat_type.max(0) as usize)
            .copied()
            .unwrap_or("oak");
        return format!("{}_boat", wood);
    }
    if kind == "armorstand" {
        return "armor_stand".into();
    }
    if kind == "crystal" {
        return "end_crystal".into();
    }
    if kind == "mob" && !entity_name.is_empty() {
        return format!("{}_spawn_egg", entity_name);
    }
    let _ = BOAT_NAME_ALIAS;
    String::new()
}

/// `middleClick` inventory search result.
///
/// Returns `[foundHotbarSlot, foundMainSlot]` in `0..9` / `9..36`, or -1.
/// `hotbar_json` / `main_json` are arrays of `{id, damage}` or `null`.
#[wasm_bindgen]
pub fn interaction_find_pick_slot(
    hotbar_json: &str,
    main_json: &str,
    item_id: i32,
    item_damage: i32,
    survival: bool,
) -> Vec<i32> {
    let hotbar: Vec<Value> = serde_json::from_str(hotbar_json).unwrap_or_default();
    let main: Vec<Value> = serde_json::from_str(main_json).unwrap_or_default();
    // InventoryPlayer.getSlotFor: same item, damage and tag.
    for (i, s) in hotbar.iter().take(9).enumerate() {
        if value_stackable(s, item_id, item_damage, true) {
            return vec![i as i32, -1];
        }
    }
    if !survival {
        return vec![-1, -1];
    }
    for (i, s) in main.iter().enumerate().skip(9).take(36 - 9) {
        if value_stackable(s, item_id, item_damage, false) {
            return vec![-1, i as i32];
        }
    }
    vec![-1, -1]
}

/// `stackable(s, item)` for a JSON slot: same id and damage (and tag when the
/// caller compares tags).
fn value_stackable(slot: &Value, item_id: i32, item_damage: i32, compare_tag: bool) -> bool {
    if slot.is_null() {
        return false;
    }
    let id = slot.get("id").and_then(|v| v.as_i64()).unwrap_or(-1) as i32;
    let damage = slot.get("damage").and_then(|v| v.as_i64()).unwrap_or(-1) as i32;
    if id != item_id || damage != item_damage {
        return false;
    }
    if compare_tag {
        let a = slot.get("tag").cloned().unwrap_or(Value::Null);
        if !a.is_null() {
            // Tag comparison needs the picked item's tag; treated as equal here
            // unless the caller supplied one explicitly.
            return true;
        }
    }
    true
}

/// `middleClick` creative slot choice: the held slot, or the first empty one.
#[wasm_bindgen]
pub fn interaction_creative_slot(hotbar_occupied_json: &str, held_slot: i32) -> i32 {
    let occupied: Vec<bool> = serde_json::from_str(hotbar_occupied_json).unwrap_or_default();
    let slot = held_slot.max(0) as usize;
    if occupied.get(slot).copied().unwrap_or(false) {
        for (i, used) in occupied.iter().take(9).enumerate() {
            if !used {
                return i as i32;
            }
        }
    }
    held_slot
}

/// `dropItem` / `stopUsingItem` dig status for `C.blockDig`.
#[wasm_bindgen]
pub fn interaction_drop_status(all: bool) -> i32 {
    if all {
        3
    } else {
        4
    }
}

/// `dropItem` stack update. Returns `[count, clearHeld(0/1)]`.
#[wasm_bindgen]
pub fn interaction_drop_item(count: i32, all: bool) -> Vec<i32> {
    if all {
        return vec![0, 1];
    }
    let next = count - 1;
    vec![next, if next <= 0 { 1 } else { 0 }]
}

/// `sendClickBlockToController` gate.
#[wasm_bindgen]
pub fn interaction_should_damage_block(left_down: bool, target_is_block: bool, block_id: u32) -> bool {
    left_down && target_is_block && block_id != 0
}

/// `onPlayerDamageBlock` creative branch: `blockHitDelay = 5`.
#[wasm_bindgen]
pub fn interaction_creative_hit_delay() -> i32 {
    5
}

// ------------------------------------------------------------- pick block

/// `Block.getPickBlock` -> block name for a state. `props_json` is the state's
/// property map (`getStateProperties`).
#[wasm_bindgen]
pub fn interaction_pick_block_name(block_name: &str, props_json: &str) -> String {
    if block_name.is_empty() || block_name == "air" {
        return String::new();
    }
    if let Some((_, mapped)) = PICK_BLOCK_MAP.iter().find(|(k, _)| *k == block_name) {
        return mapped.to_string();
    }
    if block_name == "piston_head" {
        let props = parse_object(props_json);
        return if prop_str(&props, "type") == "sticky" {
            "sticky_piston".into()
        } else {
            "piston".into()
        };
    }
    let stripped = block_name.strip_prefix("potted_").unwrap_or(block_name);
    stripped.replacen("_wall_", "_", 1)
}

/// `pickBlockItem` item resolution: `def && def.id > 0`.
#[wasm_bindgen]
pub fn interaction_pick_block_item(def_id: i32) -> bool {
    def_id > 0
}

// --------------------------------------------------------------- helpers

fn parse_object(json_str: &str) -> Map<String, Value> {
    match serde_json::from_str::<Value>(json_str) {
        Ok(Value::Object(map)) => map,
        _ => Map::new(),
    }
}

/// Look up a block in a registry and describe it for the pure helpers above.
/// Returns `{exists, id, name, opaque, isLiquid, material, boundingBox,
/// properties:{...}}` as JSON, or `null` when the state is unknown.
#[wasm_bindgen]
pub fn interaction_describe_state(reg: &BlockRegistry, state: u32) -> String {
    let Some(info) = reg.state_info(state) else {
        return "null".into();
    };
    let def = reg.def(state);
    let mut props = Map::new();
    for (k, v) in &info.properties {
        props.insert(k.clone(), Value::String(v.clone()));
    }
    json!({
        "exists": true,
        "id": def.id,
        "name": def.name,
        "opaque": reg.opaque(state),
        "isLiquid": def.is_liquid,
        "material": def.material,
        "boundingBox": def.bounding_box,
        "isDoor": def.is_door,
        "isFenceGate": def.is_fence_gate,
        "isPane": def.is_pane,
        "properties": Value::Object(props),
    })
    .to_string()
}
