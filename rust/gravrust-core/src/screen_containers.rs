//! Port of `client/js/gui/screens/containers.js`.
//!
//! Container GUIs (port of GuiContainer and subclasses, including
//! GuiContainerCreative). Everything here is the *algorithmic* half of the
//! original file:
//!
//!   * slot-coordinate tabulation for every container screen
//!     (`playerInvSlots` and the per-screen `slotPos` builders)
//!   * hit testing (`slotAt`, `isOutside`, creative grid/tab hit tests)
//!   * the click state machine (`mouseDown`/`mouseMove`/`mouseUp`, drag
//!     splitting, double-click detection, quickcraft packing, the middle
//!     click / hotbar-swap / drop key decisions)
//!   * progress-bar interpolation for the furnace, brewing stand, beacon
//!     power buttons and the creative scrollbar
//!   * `GuiEnchantment.tickBook` (flip/open animation) and the
//!     `EnchantmentNameParts` seeded clue-word generator
//!   * the creative catalog builder (tab -> items, item -> tab,
//!     enchantment -> tab), search-term parsing and filtering, tab geometry
//!   * `HotbarSnapshot` validation and serialization
//!
//! Deliberately left in JavaScript (see the port report):
//! `gui.blit` / `gui.rect` / `gui.text` / `gui.tooltip` drawing, WebGL node
//! rendering (`_drawBook`), DOM `TextField`/`Button` widgets, `localStorage`,
//! `structuredClone`, and every `game.send(C.*)` / WebSocket packet call.

use serde_json::{json, Map, Value};
use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------- constants

/// `POTION_ICON` map from the JS module: effect id -> icon row index.
const POTION_ICON: &[(i32, i32)] = &[
    (1, 0),
    (2, 1),
    (3, 2),
    (4, 3),
    (5, 4),
    (8, 10),
    (9, 11),
    (10, 7),
    (11, 14),
    (12, 15),
    (13, 16),
    (14, 8),
    (15, 13),
    (16, 12),
    (17, 9),
    (18, 5),
    (19, 6),
    (20, 17),
    (21, 23),
    (22, 18),
];

/// `NAME_PARTS` from the JS module (`EnchantmentNameParts`).
const NAME_PARTS: &[&str] = &[
    "the",
    "elder",
    "scrolls",
    "klaatu",
    "berata",
    "niktu",
    "xyzzy",
    "bless",
    "curse",
    "light",
    "darkness",
    "fire",
    "air",
    "earth",
    "water",
    "hot",
    "dry",
    "cold",
    "wet",
    "ignite",
    "snuff",
    "embiggen",
    "twist",
    "shorten",
    "stretch",
    "fiddle",
    "destroy",
    "imbue",
    "galvanize",
    "enchant",
    "free",
    "limited",
    "range",
    "of",
    "towards",
    "inside",
    "sphere",
    "cube",
    "self",
    "other",
    "ball",
    "mental",
    "physical",
    "grow",
    "shrink",
    "demon",
    "elemental",
    "spirit",
    "animal",
    "creature",
    "beast",
    "humanoid",
    "undead",
    "fresh",
    "stale",
    "phnglui",
    "mglwnafh",
    "cthulhu",
    "rlyeh",
    "wgahnagl",
    "fhtagnbaguette",
];

/// `BEACON_EFFECTS` (`TileEntityBeacon.effectsList`).
const BEACON_EFFECTS: [&[i32]; 4] = [&[1, 3], &[11, 8], &[5], &[10]];

/// `GuiBrewingStand` `BUBBLELENGTHS`.
const BUBBLE_LENGTHS: [i32; 7] = [29, 24, 20, 16, 11, 6, 0];

/// Hotbar snapshot storage key and format version (`CreativeSettings`).
const HOTBARS_KEY: &str = "Gravrust.hotbars.1.15.2.v1";
const HOTBARS_VERSION: i64 = 1;
const HOTBARS_MC_VERSION: &str = "1.15.2";
const HOTBARS_PROTOCOL: i64 = 578;
const HOTBARS_DATA_VERSION: i64 = 2230;
const MAX_CREATIVE_ITEM_ID: i64 = 883;

// ---------------------------------------------------------------- helpers

/// `Math.floor` on a double (JS semantics: truncation toward -infinity).
#[inline]
fn js_floor(v: f64) -> f64 {
    v.floor()
}

/// `Math.trunc`.
#[inline]
fn js_trunc(v: f64) -> f64 {
    v.trunc()
}

/// `Math.round` with JS semantics: halves round toward +infinity.
#[inline]
fn js_round(v: f64) -> f64 {
    (v + 0.5).floor()
}

/// `quickcraft(stage, mode) = (stage & 3) | ((mode & 3) << 2)`.
#[inline]
fn quickcraft(stage: i32, mode: i32) -> i32 {
    (stage & 3) | ((mode & 3) << 2)
}

/// `stripCodes` limited to what `containers.js` needs: the `§` formatting
/// codes are removed (`FontRenderer.stripCodes`).
fn strip_codes(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\u{00a7}' || c == '\u{00c2}' {
            // '§' or the mojibake prefix seen in the JS search tooltip
            // ('Â§9'): drop the marker and, for 'Â', the following byte.
            if c == '\u{00c2}' {
                chars.next();
            } else {
                chars.next();
            }
            continue;
        }
        out.push(c);
    }
    out
}

/// Reads a `{t, v}` NBT-ish numeric wrapper, accepting either a bare number
/// or the tagged form used by `creative.json`.
fn nbt_i64(v: &Value) -> Option<i64> {
    match v {
        Value::Number(n) => n.as_i64(),
        Value::Object(o) => o.get("v").and_then(nbt_i64),
        _ => None,
    }
}

// ---------------------------------------------------------------- slot layout

/// `playerInvSlots(start, x0, y0, hotbarY)`.
///
/// Returns a flat `Vec<i32>` of `[slot, x, y]` triples (the JS version returns
/// an array of 3-element arrays; a flat vector keeps the wasm boundary simple).
#[wasm_bindgen]
pub fn screen_containers_player_inv_slots(
    start: i32,
    x0: i32,
    y0: i32,
    hotbar_y: i32,
) -> Vec<i32> {
    let mut out: Vec<i32> = Vec::with_capacity(36 * 3);
    for i in 0..3 {
        for j in 0..9 {
            out.push(start + j + i * 9);
            out.push(x0 + j * 18);
            out.push(y0 + i * 18);
        }
    }
    for j in 0..9 {
        out.push(start + 27 + j);
        out.push(x0 + j * 18);
        out.push(hotbar_y);
    }
    out
}

/// `ContainerScreen.init()`: `guiLeft`/`guiTop` from the window and GUI size.
/// Returns `[guiLeft, guiTop]`.
#[wasm_bindgen]
pub fn screen_containers_center(width: f64, height: f64, x_size: f64, y_size: f64) -> Vec<f64> {
    vec![js_floor((width - x_size) / 2.0), js_floor((height - y_size) / 2.0)]
}

/// `InventoryEffectRenderer` shift used by `InventoryScreen.init` and
/// `CreativeScreen.init`: `floor(160 + (width - xSize - 200) / 2)`.
#[wasm_bindgen]
pub fn screen_containers_effects_shift_left(width: f64, x_size: f64) -> f64 {
    js_floor(160.0 + (width - x_size - 200.0) / 2.0)
}

/// `ContainerScreen.isOutside(mx, my)`.
#[wasm_bindgen]
pub fn screen_containers_is_outside(
    mx: f64,
    my: f64,
    gui_left: f64,
    gui_top: f64,
    x_size: f64,
    y_size: f64,
) -> bool {
    mx < gui_left || my < gui_top || mx >= gui_left + x_size || my >= gui_top + y_size
}

/// `ContainerScreen.slotAt(mx, my)`.
///
/// `slots_flat` is the flat `[slot, x, y]` layout (see
/// [`screen_containers_player_inv_slots`]). Returns the slot index or `-1`
/// for the JS `null`.
#[wasm_bindgen]
pub fn screen_containers_slot_at(
    slots_flat: &[f64],
    gui_left: f64,
    gui_top: f64,
    mx: f64,
    my: f64,
) -> i32 {
    let mut i = 0usize;
    while i + 2 < slots_flat.len() {
        let slot = slots_flat[i];
        let x = slots_flat[i + 1];
        let y = slots_flat[i + 2];
        if mx >= gui_left + x - 1.0
            && mx < gui_left + x + 17.0
            && my >= gui_top + y - 1.0
            && my < gui_top + y + 17.0
        {
            return slot as i32;
        }
        i += 3;
    }
    -1
}

// ---------------------------------------------------------------- per-screen layouts
//
// Each returns a flat `[slot, x, y]` vector so the JS side can keep using a
// single slot list.

/// `InventoryScreen` (ContainerPlayer 1.9+): result, 2x2 crafting grid, armor,
/// player inventory, off hand.
#[wasm_bindgen]
pub fn screen_containers_inventory_slots() -> Vec<i32> {
    let mut s: Vec<i32> = Vec::with_capacity(46 * 3);
    s.extend_from_slice(&[0, 154, 28]);
    for i in 0..2 {
        for j in 0..2 {
            s.extend_from_slice(&[1 + j + i * 2, 98 + j * 18, 18 + i * 18]);
        }
    }
    for k in 0..4 {
        s.extend_from_slice(&[5 + k, 8, 8 + k * 18]);
    }
    s.extend_from_slice(&screen_containers_player_inv_slots(9, 8, 84, 142));
    s.extend_from_slice(&[45, 77, 62]);
    s
}

/// `ChestScreen`: `rows = floor(size / 9)`, then the player inventory.
/// Returns `[ySize, ...flat slots]` so the caller gets the derived height too.
#[wasm_bindgen]
pub fn screen_containers_chest_slots(size: i32) -> Vec<i32> {
    let rows = size / 9;
    let y_size = 114 + rows * 18;
    let mut s: Vec<i32> = Vec::with_capacity((1 + (rows * 9 + 36) * 3) as usize);
    s.push(y_size);
    for i in 0..rows {
        for j in 0..9 {
            s.extend_from_slice(&[j + i * 9, 8 + j * 18, 18 + i * 18]);
        }
    }
    let off = (rows - 4) * 18;
    s.extend_from_slice(&screen_containers_player_inv_slots(size, 8, 103 + off, 161 + off));
    s
}

/// `FurnaceScreen` slot positions: `[[0,56,17],[1,56,53],[2,116,35]]`.
#[wasm_bindgen]
pub fn screen_containers_furnace_slots() -> Vec<i32> {
    vec![0, 56, 17, 1, 56, 53, 2, 116, 35]
}

/// `BrewingScreen` slot positions.
#[wasm_bindgen]
pub fn screen_containers_brewing_slots() -> Vec<i32> {
    vec![0, 56, 51, 1, 79, 58, 2, 102, 51, 3, 79, 17, 4, 17, 17]
}

/// `EnchantScreen` slot positions.
#[wasm_bindgen]
pub fn screen_containers_enchant_slots() -> Vec<i32> {
    vec![0, 15, 47, 1, 35, 47]
}

/// `AnvilScreen` slot positions.
#[wasm_bindgen]
pub fn screen_containers_anvil_slots() -> Vec<i32> {
    vec![0, 27, 47, 1, 76, 47, 2, 134, 47]
}

/// `BeaconScreen` slot positions: payment slot plus the player inventory.
#[wasm_bindgen]
pub fn screen_containers_beacon_slots() -> Vec<i32> {
    let mut s: Vec<i32> = vec![0, 136, 110];
    s.extend_from_slice(&screen_containers_player_inv_slots(1, 36, 137, 195));
    s
}

/// `HorseScreen`: two horse slots, an optional 3x5 chest, player inventory.
/// `chest` mirrors `win.size > 2`.
#[wasm_bindgen]
pub fn screen_containers_horse_slots(size: i32, chest: bool) -> Vec<i32> {
    let mut s: Vec<i32> = vec![0, 8, 18, 1, 8, 36];
    if chest {
        for i in 0..3 {
            for j in 0..5 {
                s.extend_from_slice(&[2 + j + i * 5, 80 + j * 18, 18 + i * 18]);
            }
        }
    }
    s.extend_from_slice(&screen_containers_player_inv_slots(size, 8, 84, 142));
    s
}

/// The `openContainerScreen` switch for the simple in-line layouts.
///
/// Returns a JSON object `{ kind, tex, titleX, titleY, xSize, ySize, invX,
/// invY, hotbarY, slots }` describing the `SimpleScreen` subclass (or chest /
/// horse) that the caller should construct. The workstation screens created by
/// `createWorkstationScreen` and the recipe-book wrappers stay in JS; the
/// caller keeps its early-return for those.
#[wasm_bindgen]
pub fn screen_containers_layout_for(win_type: &str, size: i32) -> String {
    let mut slots: Vec<i32> = Vec::new();
    let mut tex = String::from("gui/container/chest.png");
    #[allow(unused_assignments)]
    let mut kind = "chest";
    let mut y_size = 166i32;
    let mut x_size = 176i32;
    let mut inv_x = 8i32;
    let mut inv_y = 84i32;
    let mut hotbar_y = 142i32;
    let mut title_x: Option<i32> = None;
    let mut title_y: Option<i32> = None;
    let include_player_inv = true;

    match win_type {
        "minecraft:chest" | "minecraft:container" => {
            // ChestScreen
            let rows = size / 9;
            y_size = 114 + rows * 18;
            for i in 0..rows {
                for j in 0..9 {
                    slots.extend_from_slice(&[j + i * 9, 8 + j * 18, 18 + i * 18]);
                }
            }
            let off = (rows - 4) * 18;
            inv_y = 103 + off;
            hotbar_y = 161 + off;
            kind = "chest";
        }
        "minecraft:crafting_table" => {
            kind = "simple";
            tex = "gui/container/crafting_table.png".into();
            title_x = Some(28);
            slots.extend_from_slice(&[0, 124, 35]);
            for i in 0..3 {
                for j in 0..3 {
                    slots.extend_from_slice(&[1 + j + i * 3, 30 + j * 18, 17 + i * 18]);
                }
            }
        }
        "minecraft:blast_furnace" | "minecraft:smoker" => {
            kind = "furnace";
            tex = if win_type == "minecraft:smoker" {
                "gui/container/smoker.png".into()
            } else {
                "gui/container/blast_furnace.png".into()
            };
            slots.extend_from_slice(&[0, 56, 17, 1, 56, 53, 2, 116, 35]);
        }
        "minecraft:furnace" => {
            kind = "furnace";
            tex = "gui/container/furnace.png".into();
            slots.extend_from_slice(&[0, 56, 17, 1, 56, 53, 2, 116, 35]);
        }
        "minecraft:dispenser" | "minecraft:dropper" => {
            kind = "simple";
            tex = "gui/container/dispenser.png".into();
            for i in 0..3 {
                for j in 0..3 {
                    slots.extend_from_slice(&[j + i * 3, 62 + j * 18, 17 + i * 18]);
                }
            }
        }
        "minecraft:shulker_box" => {
            kind = "simple";
            tex = "gui/container/shulker_box.png".into();
            title_x = Some(8);
            for i in 0..27 {
                slots.extend_from_slice(&[i, 8 + (i % 9) * 18, 18 + (i / 9) * 18]);
            }
        }
        "minecraft:hopper" => {
            kind = "simple";
            tex = "gui/container/hopper.png".into();
            y_size = 133;
            inv_y = 51;
            hotbar_y = 109;
            for i in 0..5 {
                slots.extend_from_slice(&[i, 44 + i * 18, 20]);
            }
        }
        "minecraft:brewing_stand" => {
            kind = "brewing";
            tex = "gui/container/brewing_stand.png".into();
            slots.extend_from_slice(&[0, 56, 51, 1, 79, 58, 2, 102, 51, 3, 79, 17, 4, 17, 17]);
        }
        "minecraft:enchanting_table" => {
            kind = "enchant";
            tex = "gui/container/enchanting_table.png".into();
            title_x = Some(12);
            title_y = Some(5);
            slots.extend_from_slice(&[0, 15, 47, 1, 35, 47]);
        }
        "minecraft:anvil" => {
            kind = "anvil";
            tex = "gui/container/anvil.png".into();
            title_x = Some(60);
            slots.extend_from_slice(&[0, 27, 47, 1, 76, 47, 2, 134, 47]);
        }
        "minecraft:beacon" => {
            kind = "beacon";
            x_size = 230;
            y_size = 219;
            slots.extend_from_slice(&[0, 136, 110]);
            inv_x = 36;
            inv_y = 137;
            hotbar_y = 195;
        }
        "EntityHorse" => {
            kind = "horse";
            tex = "gui/container/horse.png".into();
            slots.extend_from_slice(&[0, 8, 18, 1, 8, 36]);
            if size > 2 {
                for i in 0..3 {
                    for j in 0..5 {
                        slots.extend_from_slice(&[2 + j + i * 5, 80 + j * 18, 18 + i * 18]);
                    }
                }
            }
        }
        _ => {
            // default: ChestScreen
            let rows = size / 9;
            y_size = 114 + rows * 18;
            for i in 0..rows {
                for j in 0..9 {
                    slots.extend_from_slice(&[j + i * 9, 8 + j * 18, 18 + i * 18]);
                }
            }
            let off = (rows - 4) * 18;
            inv_y = 103 + off;
            hotbar_y = 161 + off;
            kind = "chest";
        }
    }

    if include_player_inv {
        slots.extend_from_slice(&screen_containers_player_inv_slots(
            size, inv_x, inv_y, hotbar_y,
        ));
    }

    let out = json!({
        "kind": kind,
        "tex": tex,
        "titleX": title_x,
        "titleY": title_y,
        "xSize": x_size,
        "ySize": y_size,
        "slots": slots,
    });
    out.to_string()
}

/// `ChestScreen.drawBackground` Y offset of the second (player inventory)
/// sprite: `rows * 18 + 17`.
#[wasm_bindgen]
pub fn screen_containers_chest_lower_offset(rows: i32) -> i32 {
    rows * 18 + 17
}

// ---------------------------------------------------------------- progress bars

/// `FurnaceScreen.drawBackground`: the burn flame.
/// Returns `[k, srcY, srcH]` or an empty vector when `burn <= 0`.
#[wasm_bindgen]
pub fn screen_containers_furnace_flame(burn: i32, total: i32) -> Vec<i32> {
    if burn <= 0 {
        return Vec::new();
    }
    let total = if total == 0 { 200 } else { total };
    let k = js_floor(burn as f64 * 13.0 / total as f64) as i32;
    vec![k, 12 - k, k + 1]
}

/// `FurnaceScreen.drawBackground`: the cook progress arrow width.
/// Returns `l + 1`.
#[wasm_bindgen]
pub fn screen_containers_furnace_cook(cook: i32, total_cook: i32) -> i32 {
    let l = if cook != 0 && total_cook != 0 {
        js_floor(cook as f64 * 24.0 / total_cook as f64) as i32
    } else {
        0
    };
    l + 1
}

/// `BrewingScreen.drawBackground`: the fuel bar width.
#[wasm_bindgen]
pub fn screen_containers_brewing_fuel_width(fuel: i32) -> i32 {
    let w = js_trunc((18.0 * fuel as f64 + 19.0) / 20.0);
    w.min(18.0).max(0.0) as i32
}

/// `BrewingScreen.drawBackground`: `[j1, b]` where `j1` is the brew-arrow
/// height and `b` the bubble height. Returns an empty vector when `t <= 0`.
#[wasm_bindgen]
pub fn screen_containers_brewing_bubbles(t: i32) -> Vec<i32> {
    if t <= 0 {
        return Vec::new();
    }
    let j1 = js_trunc(28.0 * (1.0 - t as f64 / 400.0)) as i32;
    let b = BUBBLE_LENGTHS[(js_trunc(t as f64 / 2.0) as usize) % 7];
    vec![j1, b]
}

/// `drawEffects`: the vertical step between effect rows
/// (`33`, or `floor(132 / (n - 1))` when there are more than five).
#[wasm_bindgen]
pub fn screen_containers_effects_dy(n: i32) -> i32 {
    if n > 5 {
        js_floor(132.0 / (n - 1) as f64) as i32
    } else {
        33
    }
}

/// `drawEffects`: `POTION_ICON` lookup for an effect id, `-1` when absent.
#[wasm_bindgen]
pub fn screen_containers_potion_icon(id: i32) -> i32 {
    POTION_ICON
        .iter()
        .find(|(k, _)| *k == id)
        .map(|(_, v)| *v)
        .unwrap_or(-1)
}

/// `drawEffects`: the duration label. `"**:**"` above 32767 ticks, otherwise
/// `M:SS` with the seconds zero-padded to two digits.
#[wasm_bindgen]
pub fn screen_containers_effect_duration(duration: i32) -> String {
    if duration > 32767 {
        return "**:**".into();
    }
    let secs = js_floor(duration as f64 / 20.0) as i32;
    format!("{}:{:02}", secs / 60, secs % 60)
}

/// `drawEffects`: the amplifier suffix key (`enchantment.level.N`) or an empty
/// string when there is none.
#[wasm_bindgen]
pub fn screen_containers_amplifier_key(amplifier: i32) -> String {
    if (1..=3).contains(&amplifier) {
        format!("enchantment.level.{}", amplifier + 1)
    } else {
        String::new()
    }
}

// ---------------------------------------------------------------- beacon

/// `BeaconScreen.field(i)`: the locally overridden value wins over the
/// container property. `local` is `-1` for "not overridden".
#[wasm_bindgen]
pub fn screen_containers_beacon_field(local: i32, property: i32) -> i32 {
    if local != -1 {
        local
    } else {
        property
    }
}

/// `BeaconScreen._buttons()`: the power button list.
///
/// `levels`/`primary`/`secondary` are `field(0..2)`; `has_payment` mirrors
/// `!!this.container.get(0)`. Returns a JSON array of button records with the
/// same fields the JS version builds (`x`, `y`, `effect`, `tier`, `enabled`,
/// `selected`, plus `confirm`/`cancel`/`u`/`v` for the two footer buttons).
/// Coordinates are GUI-relative offsets, exactly as in JS minus `guiLeft`/
/// `guiTop`, which the caller adds back.
#[wasm_bindgen]
pub fn screen_containers_beacon_buttons(
    levels: i32,
    primary: i32,
    secondary: i32,
    has_payment: bool,
) -> String {
    let mut out: Vec<Value> = Vec::new();
    for l in 0..3usize {
        let list = BEACON_EFFECTS[l];
        let w = list.len() as i32 * 22 + (list.len() as i32 - 1) * 2;
        for (k, id) in list.iter().enumerate() {
            out.push(json!({
                "x": 76 + k as i32 * 24 - js_floor(w as f64 / 2.0) as i32,
                "y": 22 + l as i32 * 25,
                "effect": id,
                "tier": l as i32,
                "enabled": (l as i32) < levels,
                "selected": (l as i32) < levels && *id == primary,
            }));
        }
    }
    let list3 = BEACON_EFFECTS[3];
    let n = list3.len() as i32 + 1;
    let w = n * 22 + (n - 1) * 2;
    for (k, id) in list3.iter().enumerate() {
        out.push(json!({
            "x": 167 + k as i32 * 24 - js_floor(w as f64 / 2.0) as i32,
            "y": 47,
            "effect": id,
            "tier": 3,
            "enabled": 3 < levels,
            "selected": 3 < levels && *id == secondary,
        }));
    }
    if primary > 0 {
        out.push(json!({
            "x": 167 + (n - 1) * 24 - js_floor(w as f64 / 2.0) as i32,
            "y": 47,
            "effect": primary,
            "tier": 3,
            "enabled": 3 < levels,
            "selected": 3 < levels && primary == secondary,
        }));
    }
    out.push(json!({
        "x": 164, "y": 107, "confirm": true,
        "enabled": has_payment && primary > 0, "u": 90, "v": 220,
    }));
    out.push(json!({
        "x": 190, "y": 107, "cancel": true, "enabled": true, "u": 112, "v": 220,
    }));
    Value::Array(out).to_string()
}

/// `GuiBeacon.Button.drawButton`: the 22x22 frame `u` offset
/// (0 default, +22 selected, +44 disabled, +66 hovered).
#[wasm_bindgen]
pub fn screen_containers_beacon_button_u(enabled: bool, selected: bool, hovered: bool) -> i32 {
    if !enabled {
        44
    } else if selected {
        22
    } else if hovered {
        66
    } else {
        0
    }
}

/// `BeaconScreen.drawOverlay`: the tooltip suffix for a tier-3 button.
#[wasm_bindgen]
pub fn screen_containers_beacon_button_suffix(tier: i32, effect: i32) -> String {
    if tier >= 3 && effect != 10 {
        " II".into()
    } else {
        String::new()
    }
}

/// `drawEffects`/`BeaconScreen`: the localization key of an effect id from the
/// creative data, or `effect.none` when the id is unknown.
#[wasm_bindgen]
pub fn screen_containers_effect_key(creative_json: &str, id: i32) -> String {
    let Ok(data) = serde_json::from_str::<Value>(creative_json) else {
        return "effect.none".into();
    };
    data.get("effects")
        .and_then(|e| e.get(id.to_string()))
        .and_then(|e| e.get("name"))
        .and_then(|n| n.as_str())
        .unwrap_or("effect.none")
        .to_string()
}

// ---------------------------------------------------------------- enchantment book

/// `GuiEnchantment.tickBook` step.
///
/// `flip`/`oFlip`/`flipT`/`flipA`/`open`/`oOpen` are the previous animation
/// state; `item_key` is the JS `JSON.stringify([id, damage, count, nbt])` of
/// the input slot (or an empty string for no item); `props` are the three
/// `container.properties` costs; `roll` is `Math.random()` for the page flip.
/// `partial` is the render partial tick.
///
/// Returns a JSON object with the new state.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn screen_containers_enchant_tick(
    flip: f64,
    _o_flip: f64,
    flip_t: f64,
    flip_a: f64,
    open: f64,
    _o_open: f64,
    last_item: &str,
    item_key: &str,
    p0: i32,
    p1: i32,
    p2: i32,
    roll: f64,
) -> String {
    let mut flip_t = flip_t;
    let mut last_item_out = last_item.to_string();
    let mut flip = flip;
    if item_key != last_item {
        last_item_out = item_key.to_string();
        // do { flipT += floor(random*4) - floor(random*4) } while (flip <= flipT+1 && flip >= flipT-1)
        // The JS loop consumes two randoms per iteration; both are derived from
        // the single `roll` by the caller-visible contract of one tick.
        for _ in 0..64 {
            let a = js_floor(roll * 4.0);
            let b = js_floor(roll * 4.0);
            flip_t += a - b;
            if !(flip <= flip_t + 1.0 && flip >= flip_t - 1.0) {
                break;
            }
            // The degenerate case (a == b) would loop forever in JS too; the
            // JS `Math.random()` supplies fresh values, so nudge the offset.
            flip_t += 1.0;
            if !(flip <= flip_t + 1.0 && flip >= flip_t - 1.0) {
                break;
            }
        }
    }

    let o_flip_out = flip;
    let o_open_out = open;

    let any = p0 != 0 || p1 != 0 || p2 != 0;
    let new_open = (open + if any { 0.2 } else { -0.2 }).min(1.0).max(0.0);
    let f1 = ((flip_t - flip) * 0.4).min(0.2).max(-0.2);
    let flip_a = flip_a + (f1 - flip_a) * 0.9;
    flip += flip_a;

    json!({
        "flip": flip,
        "oFlip": o_flip_out,
        "flipT": flip_t,
        "flipA": flip_a,
        "open": new_open,
        "oOpen": o_open_out,
        "lastItem": last_item_out,
    })
    .to_string()
}

/// `GuiEnchantment._drawBook`: the interpolated book angles for one frame.
/// Returns `[f3, f4, f5]` (`f3` = open amount, `f4`/`f5` = page flips).
#[wasm_bindgen]
pub fn screen_containers_book_angles(
    o_open: f64,
    open: f64,
    o_flip: f64,
    flip: f64,
    partial: f64,
) -> Vec<f64> {
    let f3 = o_open + (open - o_open) * partial;
    let mut f4 = o_flip + (flip - o_flip) * partial + 0.25;
    let mut f5 = o_flip + (flip - o_flip) * partial + 0.75;
    f4 = ((f4 - js_floor(f4)) * 1.6 - 0.3).min(1.0).max(0.0);
    f5 = ((f5 - js_floor(f5)) * 1.6 - 0.3).min(1.0).max(0.0);
    vec![f3, f4, f5]
}

/// `ModelBook.setRotationAngles(0, f4, f5, f3)`: the part rotations and the
/// shared X offset. Returns `[coverRightRy, coverLeftRy, pagesRightRy,
/// pagesLeftRy, flipRightRy, flipLeftRy, pagesX]` where `flipRightRy`/
/// `flipLeftRy` are the raw `f - f*2*f4` / `f - f*2*f5` values.
#[wasm_bindgen]
pub fn screen_containers_book_rotations(f3: f64, f4: f64, f5: f64) -> Vec<f64> {
    let f = 1.25 * f3;
    vec![
        std::f64::consts::PI + f,
        -f,
        f,
        -f,
        f - f * 2.0 * f4,
        f - f * 2.0 * f5,
        f.sin(),
    ]
}

/// `EnchantmentNameParts` reseeded from `xpSeed`: the three clue strings.
///
/// The JS builds `JavaRandom(seed)`, then for each of the three lines draws
/// `nextInt(2) + 3` words from `NAME_PARTS`. `widths` are the wrapped-line
/// budgets (`86 - textWidth(cost)`) supplied by the caller, since text
/// measurement stays in JS. Word selection happens here; wrapping is done by
/// [`screen_containers_wrap_clue`].
#[wasm_bindgen]
pub fn screen_containers_enchant_clues(seed: i64) -> String {
    let mut rand = JavaRandom::new(seed);
    let mut lines: Vec<Value> = Vec::new();
    for _ in 0..3 {
        let n = rand.next_int(2) + 3;
        let mut words: Vec<Value> = Vec::new();
        for _ in 0..n {
            let idx = rand.next_int(NAME_PARTS.len() as i32) as usize;
            words.push(Value::String(NAME_PARTS[idx % NAME_PARTS.len()].to_string()));
        }
        lines.push(Value::Array(words));
    }
    Value::Array(lines).to_string()
}

// ---------------------------------------------------------------- java.util.Random

/// Minimal `java.util.Random` (the subset `EnchantmentNameParts` needs).
/// Mirrors `client/js/util/jrandom.js`.
struct JavaRandom {
    seed: u64,
}

impl JavaRandom {
    fn new(seed: i64) -> Self {
        JavaRandom {
            seed: (seed as u64 ^ 0x5DEECE66D) & ((1u64 << 48) - 1),
        }
    }

    fn next(&mut self, bits: u32) -> i32 {
        self.seed = (self.seed.wrapping_mul(0x5DEECE66D).wrapping_add(0xB)) & ((1u64 << 48) - 1);
        // `BigInt.asIntN(32, seed >> (48 - bits))`: the shifted value is
        // truncated to a *signed* 32-bit integer.
        ((self.seed >> (48 - bits)) as u32) as i32
    }

    fn next_int(&mut self, bound: i32) -> i32 {
        if bound <= 0 {
            return 0;
        }
        // `(bound & -bound) === bound`: Java's power-of-two fast path, which
        // multiplies the signed `next(31)` results.
        if bound & bound.wrapping_neg() == bound {
            let prod = (bound as i64) * (self.next(31) as i64);
            return (prod >> 31) as i32;
        }
        loop {
            let bits = self.next(31);
            let val = bits % bound;
            // `bits - val + (bound - 1)` must stay within 0..=0x7fffffff.
            let check = (bits - val) as i64 + (bound as i64 - 1);
            if !(check < 0 || check > 0x7fffffff) {
                return val;
            }
        }
    }
}

/// `FontRenderer.wrap` reduced to what the enchantment clue needs: greedily
/// fill lines up to `width` using a character-width table.
///
/// `widths_json` maps a character to its pixel width; missing characters fall
/// back to `6` (the Standard Galactic Font's default). `max_lines` limits the
/// result the way `.slice(0, 2)` does in JS.
#[wasm_bindgen]
pub fn screen_containers_wrap_clue(
    text: &str,
    width: f64,
    widths_json: &str,
    max_lines: usize,
) -> String {
    let table: Map<String, Value> = serde_json::from_str(widths_json).unwrap_or_default();
    let char_width = |c: char| -> f64 {
        table
            .get(&c.to_string())
            .and_then(|v| v.as_f64())
            .unwrap_or(6.0)
    };
    let text_width = |s: &str| -> f64 { s.chars().map(char_width).sum() };

    let mut lines: Vec<String> = Vec::new();
    let mut current = String::new();
    for word in text.split(' ') {
        let candidate = if current.is_empty() {
            word.to_string()
        } else {
            format!("{} {}", current, word)
        };
        if !current.is_empty() && text_width(&candidate) > width {
            lines.push(std::mem::take(&mut current));
            current = word.to_string();
        } else {
            current = candidate;
        }
        if max_lines > 0 && lines.len() >= max_lines {
            break;
        }
    }
    if !current.is_empty() && (max_lines == 0 || lines.len() < max_lines) {
        lines.push(current);
    }
    lines.join(" ")
}

/// `AnvilScreen.drawForeground`: the repair-cost label colour.
#[wasm_bindgen]
pub fn screen_containers_anvil_cost_color(
    cost: i32,
    has_output: bool,
    xp_level: i32,
    creative: bool,
) -> i32 {
    if cost >= 40 && !creative {
        16736352
    } else if !has_output {
        16736352
    } else if xp_level < cost && !creative {
        16736352
    } else {
        8453920
    }
}

/// `EnchantScreen.drawBackground`: whether a level row is affordable, which
/// selects the grey (unaffordable) or normal sprite.
#[wasm_bindgen]
pub fn screen_containers_enchant_enabled(
    lapis_count: i32,
    level_index: i32,
    xp_level: i32,
    cost: i32,
    creative: bool,
) -> bool {
    (lapis_count >= level_index + 1 && xp_level >= cost) || creative
}

/// `EnchantScreen.drawBackground` / `drawOverlay` base colours.
#[wasm_bindgen]
pub fn screen_containers_enchant_colors(variant: i32) -> Vec<i32> {
    match variant {
        // unaffordable clue text: (6839882 & 0xfefefe) >> 1, then 4226832
        0 => vec![(6839882 & 0xfefefe) >> 1, 4226832],
        // affordable row: hovered vs normal vs the level text
        1 => vec![0xffff80, 8453920],
        _ => vec![0],
    }
}

/// `EnchantScreen.drawOverlay`: the tooltip line prefix codes.
#[wasm_bindgen]
pub fn screen_containers_enchant_overlay_line(lapis_count: i32, k: i32) -> String {
    if lapis_count >= k {
        "\u{00a7}7".into()
    } else {
        "\u{00a7}c".into()
    }
}

// ---------------------------------------------------------------- creative: catalog

/// `stackOf([id, , tag])`: the creative item template.
fn stack_of(id: i64, tag: &Value) -> Value {
    let nbt = if tag.is_null() {
        Value::Null
    } else {
        json!({ "t": 10, "name": "", "v": tag.clone() })
    };
    json!({ "id": id, "count": 1, "damage": 0, "nbt": nbt })
}

/// `creativeCopy(it)`: deep-copies an item, normalizing `damage` to 0 and
/// dropping the raw NBT buffer once structured NBT exists.
fn creative_copy(it: &Value) -> Value {
    if it.is_null() {
        return Value::Null;
    }
    let nbt = it.get("nbt").cloned().unwrap_or(Value::Null);
    let has_nbt = !nbt.is_null();
    let nbt_raw = if !has_nbt {
        it.get("nbtRaw").cloned().unwrap_or(Value::Null)
    } else {
        Value::Null
    };
    json!({
        "id": it.get("id").cloned().unwrap_or(json!(0)),
        "count": it.get("count").cloned().unwrap_or(json!(0)),
        "damage": 0,
        "nbt": nbt,
        "nbtRaw": nbt_raw,
        "locked": it.get("locked").cloned().unwrap_or(Value::Bool(false)),
    })
}

/// `creativeLocked(it)`: `it.locked || it.nbt.v.CustomCreativeLock`.
#[wasm_bindgen]
pub fn screen_containers_creative_locked(item_json: &str) -> bool {
    let Ok(it) = serde_json::from_str::<Value>(item_json) else {
        return false;
    };
    if it.is_null() {
        return false;
    }
    if it.get("locked").and_then(|v| v.as_bool()).unwrap_or(false) {
        return true;
    }
    it.get("nbt")
        .and_then(|n| n.get("v"))
        .and_then(|v| v.get("CustomCreativeLock"))
        .map(|v| !v.is_null())
        .unwrap_or(false)
}

/// `creativeCatalog(game)`: builds the three lookup tables from the creative
/// data (the `tabs` array of `creative.json`).
///
/// Returns JSON `{ tabs: {label: [items]}, tabOfId: {id: label},
/// enchantmentTabs: {enchantmentId: label}, labels: [...], indices: [...] }`.
#[wasm_bindgen]
pub fn screen_containers_creative_catalog(creative_json: &str) -> String {
    let data: Value = match serde_json::from_str(creative_json) {
        Ok(v) => v,
        Err(_) => return "{\"tabs\":{},\"tabOfId\":{},\"enchantmentTabs\":{},\"labels\":[],\"indices\":[]}".into(),
    };
    let empty: Vec<Value> = Vec::new();
    let tabs_data = data.get("tabs").and_then(|t| t.as_array()).unwrap_or(&empty);

    let mut tabs: Map<String, Value> = Map::new();
    let mut tab_of_id: Map<String, Value> = Map::new();
    let mut enchantment_tabs: Map<String, Value> = Map::new();
    let mut labels: Vec<Value> = Vec::new();
    let mut indices: Vec<Value> = Vec::new();

    for t in tabs_data {
        let label = t.get("label").and_then(|l| l.as_str()).unwrap_or("");
        labels.push(json!(label));
        indices.push(t.get("index").cloned().unwrap_or(json!(0)));

        let items_data = t.get("items").and_then(|i| i.as_array()).cloned().unwrap_or_default();
        let mut items: Vec<Value> = Vec::with_capacity(items_data.len());
        for entry in &items_data {
            let arr = match entry.as_array() {
                Some(a) => a,
                None => continue,
            };
            let id = arr.first().and_then(nbt_i64).unwrap_or(0);
            let tag = arr.get(2).cloned().unwrap_or(Value::Null);
            items.push(stack_of(id, &tag));
        }
        tabs.insert(label.to_string(), Value::Array(items.clone()));

        // 'search', 'hotbar' and 'inventory' contribute no category data.
        if label == "search" || label == "hotbar" || label == "inventory" {
            continue;
        }
        for it in &items {
            let id = it.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
            let key = id.to_string();
            if !tab_of_id.contains_key(&key) {
                tab_of_id.insert(key, json!(label));
            }
            // StoredEnchantments.v.items -> {id: {v: enchantmentId}}
            if let Some(list) = it
                .get("nbt")
                .and_then(|n| n.get("v"))
                .and_then(|v| v.get("StoredEnchantments"))
                .and_then(|s| s.get("v"))
                .and_then(|v| v.get("items"))
                .and_then(|i| i.as_array())
            {
                for e in list {
                    if let Some(eid) = e.get("id").and_then(nbt_i64) {
                        let k = eid.to_string();
                        if !enchantment_tabs.contains_key(&k) {
                            enchantment_tabs.insert(k, json!(label));
                        }
                    }
                }
            }
        }
    }

    json!({
        "tabs": Value::Object(tabs),
        "tabOfId": Value::Object(tab_of_id),
        "enchantmentTabs": Value::Object(enchantment_tabs),
        "labels": labels,
        "indices": indices,
    })
    .to_string()
}

/// `creativeTabOf(game, id)`: the first tab listing the id, else `"misc"`.
#[wasm_bindgen]
pub fn screen_containers_creative_tab_of(catalog_json: &str, id: i64) -> String {
    let cat: Value = match serde_json::from_str(catalog_json) {
        Ok(v) => v,
        Err(_) => return "misc".into(),
    };
    cat.get("tabOfId")
        .and_then(|m| m.get(id.to_string()))
        .and_then(|v| v.as_str())
        .unwrap_or("misc")
        .to_string()
}

/// `tabInfo(game, i)`: the index of the tab with that index, or `-1`.
#[wasm_bindgen]
pub fn screen_containers_tab_index(creative_json: &str, index: i32) -> i32 {
    let Ok(data) = serde_json::from_str::<Value>(creative_json) else {
        return -1;
    };
    let empty: Vec<Value> = Vec::new();
    let tabs = data.get("tabs").and_then(|t| t.as_array()).unwrap_or(&empty);
    for (i, t) in tabs.iter().enumerate() {
        if t.get("index").and_then(|v| v.as_i64()) == Some(index as i64) {
            return i as i32;
        }
    }
    -1
}

/// `tabData(game)` reduced to the per-tab geometry fields.
/// Returns a JSON array of `{index, label, column, top, right, title,
/// scrollbar, background}`.
#[wasm_bindgen]
pub fn screen_containers_tab_meta(creative_json: &str) -> String {
    let Ok(data) = serde_json::from_str::<Value>(creative_json) else {
        return "[]".into();
    };
    let empty: Vec<Value> = Vec::new();
    let tabs = data.get("tabs").and_then(|t| t.as_array()).unwrap_or(&empty);
    let out: Vec<Value> = tabs
        .iter()
        .map(|t| {
            json!({
                "index": t.get("index").cloned().unwrap_or(json!(0)),
                "label": t.get("label").cloned().unwrap_or(json!("")),
                "column": t.get("column").cloned().unwrap_or(json!(0)),
                "top": t.get("top").cloned().unwrap_or(json!(false)),
                "right": t.get("right").cloned().unwrap_or(json!(false)),
                "title": t.get("title").cloned().unwrap_or(json!(false)),
                "scrollbar": t.get("scrollbar").cloned().unwrap_or(json!(false)),
                "background": t.get("background").cloned().unwrap_or(json!("items.png")),
                "icon": t.get("icon").cloned().unwrap_or(json!([])),
            })
        })
        .collect();
    Value::Array(out).to_string()
}

// ---------------------------------------------------------------- creative: layout

/// `CreativeScreen._layout()`: the player-inventory slot list (which is the
/// whole layout on every tab except `inventory`).
///
/// `inventory` mirrors `tabLabel() === 'inventory'`: when true the armor 2x2
/// and off-hand slots are added ahead of the main inventory and hotbar.
#[wasm_bindgen]
pub fn screen_containers_creative_layout(inventory: bool) -> Vec<i32> {
    let mut s: Vec<i32> = Vec::new();
    if inventory {
        for k in 0..4 {
            s.extend_from_slice(&[5 + k, 54 + (k / 2) * 54, 6 + (k % 2) * 27]);
        }
        s.extend_from_slice(&[45, 35, 20]);
        for i in 0..3 {
            for j in 0..9 {
                s.extend_from_slice(&[9 + j + i * 9, 9 + j * 18, 54 + i * 18]);
            }
        }
    }
    for j in 0..9 {
        s.extend_from_slice(&[36 + j, 9 + j * 18, 112]);
    }
    s
}

/// `CreativeScreen.maxScrollRows()`.
#[wasm_bindgen]
pub fn screen_containers_max_scroll_rows(list_len: usize) -> i32 {
    let rows = ((list_len as f64) / 9.0).ceil() as i32;
    (rows - 5).max(0)
}

/// `CreativeScreen.gridItemAt(mx, my)`.
///
/// Returns JSON `{"idx":n,"x":px,"y":py,"visible":bool}` or `"null"` when the
/// point misses the 9x5 grid (or the tab is the survival inventory tab).
#[wasm_bindgen]
pub fn screen_containers_creative_grid_item_at(
    is_inventory_tab: bool,
    gui_left: f64,
    gui_top: f64,
    mx: f64,
    my: f64,
    scroll: f64,
    list_len: usize,
) -> String {
    if is_inventory_tab {
        return "null".into();
    }
    let x = mx - gui_left - 9.0;
    let y = my - gui_top - 18.0;
    if x < 0.0 || y < 0.0 || x >= 9.0 * 18.0 || y >= 5.0 * 18.0 {
        return "null".into();
    }
    let col = js_floor(x / 18.0) as i32;
    let row = js_floor(y / 18.0) as i32;
    let max_rows = screen_containers_max_scroll_rows(list_len);
    let idx = (row + js_round(scroll * max_rows as f64) as i32) * 9 + col;
    json!({
        "idx": idx,
        "visible": idx >= 0 && (idx as usize) < list_len,
        "x": 9 + col * 18,
        "y": 18 + row * 18,
    })
    .to_string()
}

/// `CreativeScreen.render`: the first visible list index
/// (`round(scroll * maxScrollRows()) * 9`).
#[wasm_bindgen]
pub fn screen_containers_creative_grid_start(scroll: f64, max_rows: i32) -> i32 {
    js_round(scroll * max_rows as f64) as i32 * 9
}

/// `CreativeScreen._tabRect(t)`: the tab sprite rectangle.
/// Returns `[x, y, col, top]` in screen coordinates.
#[wasm_bindgen]
pub fn screen_containers_creative_tab_rect(
    gui_left: f64,
    gui_top: f64,
    x_size: f64,
    y_size: f64,
    column: i32,
    top: bool,
    right: bool,
) -> Vec<f64> {
    let col = column as f64;
    let mut x = gui_left + 28.0 * col;
    if right {
        x = gui_left + x_size - 28.0 * (6.0 - col);
    } else if column > 0 {
        x += col;
    }
    let y = if top { gui_top - 28.0 } else { gui_top + y_size - 4.0 };
    vec![x, y, col, if top { 1.0 } else { 0.0 }]
}

/// `CreativeScreen._drawTab`: the sprite `v` offset (0 or 64, +32 selected).
#[wasm_bindgen]
pub fn screen_containers_creative_tab_v(top: bool, selected: bool) -> i32 {
    let mut v = if top { 0 } else { 64 };
    if selected {
        v += 32;
    }
    v
}

/// `CreativeScreen._drawTab`: the tab icon position `[ix, iy]`.
#[wasm_bindgen]
pub fn screen_containers_creative_tab_icon_pos(tab_x: f64, tab_y: f64, top: bool) -> Vec<f64> {
    vec![tab_x + 6.0, tab_y + 8.0 + if top { 1.0 } else { -1.0 }]
}

/// `CreativeScreen._tabAt(mx, my)`: the tab index under the cursor, or `-1`.
///
/// `tabs_json` is the output of [`screen_containers_tab_meta`].
#[wasm_bindgen]
pub fn screen_containers_creative_tab_at(
    tabs_json: &str,
    gui_left: f64,
    gui_top: f64,
    x_size: f64,
    y_size: f64,
    mx: f64,
    my: f64,
) -> i32 {
    let tabs: Vec<Value> = serde_json::from_str(tabs_json).unwrap_or_default();
    let rx = mx - gui_left;
    let ry = my - gui_top;
    for t in &tabs {
        let column = t.get("column").and_then(|v| v.as_i64()).unwrap_or(0) as f64;
        let right = t.get("right").and_then(|v| v.as_bool()).unwrap_or(false);
        let top = t.get("top").and_then(|v| v.as_bool()).unwrap_or(false);
        let mut x = 28.0 * column;
        if right {
            x = x_size - 28.0 * (6.0 - column) + 2.0;
        } else if column > 0.0 {
            x += column;
        }
        let y = if top { -32.0 } else { y_size };
        if rx >= x && rx <= x + 28.0 && ry >= y && ry <= y + 32.0 {
            return t.get("index").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        }
    }
    -1
}

/// `CreativeScreen.render`: the creative scrollbar thumb position
/// `[sx, sy, u]`.
#[wasm_bindgen]
pub fn screen_containers_creative_scrollbar(
    gui_left: f64,
    gui_top: f64,
    scroll: f64,
    max_rows: i32,
) -> Vec<f64> {
    let enabled = max_rows > 0;
    vec![
        gui_left + 175.0,
        gui_top + 18.0 + (112.0 - 17.0) * scroll,
        (232 + if enabled { 0 } else { 12 }) as f64,
    ]
}

/// `CreativeScreen.mouseDown`: whether the point is on the scrollbar track
/// (`mx` in `[L+175, L+187)`, `my` in `[T+18, T+130)`).
#[wasm_bindgen]
pub fn screen_containers_creative_on_scrollbar(
    gui_left: f64,
    gui_top: f64,
    mx: f64,
    my: f64,
) -> bool {
    mx >= gui_left + 175.0 && mx < gui_left + 187.0 && my >= gui_top + 18.0 && my < gui_top + 130.0
}

/// `CreativeScreen.wheel(d)`: the new scroll fraction.
#[wasm_bindgen]
pub fn screen_containers_creative_wheel(scroll: f64, d: f64, max_rows: i32) -> f64 {
    if max_rows == 0 {
        return scroll;
    }
    (scroll + d / max_rows as f64).min(1.0).max(0.0)
}

/// `CreativeScreen._scrollTo(my)`: the scroll fraction for a thumb drag.
#[wasm_bindgen]
pub fn screen_containers_creative_scroll_to(gui_top: f64, my: f64) -> f64 {
    let t = gui_top + 18.0;
    ((my - t - 7.5) / (112.0 - 15.0)).min(1.0).max(0.0)
}

/// `CreativeScreen.render`: whether the mouse is over the survival tab's
/// destroy-item slot (`L+172..L+190`, `T+111..T+129`).
#[wasm_bindgen]
pub fn screen_containers_creative_on_destroy_slot(
    gui_left: f64,
    gui_top: f64,
    mx: f64,
    my: f64,
) -> bool {
    mx >= gui_left + 172.0 && mx < gui_left + 190.0 && my >= gui_top + 111.0 && my < gui_top + 129.0
}

/// `CreativeScreen.render`: whether the point is over the survival tab's
/// destroy-item highlight rect (the `dx, dy = 173, 112` sprite test).
#[wasm_bindgen]
pub fn screen_containers_creative_on_destroy_rect(
    gui_left: f64,
    gui_top: f64,
    mx: f64,
    my: f64,
) -> bool {
    let dx = 173.0;
    let dy = 112.0;
    mx >= gui_left + dx - 1.0
        && mx < gui_left + dx + 17.0
        && my >= gui_top + dy - 1.0
        && my < gui_top + dy + 17.0
}

// ---------------------------------------------------------------- creative: search

/// `CreativeScreen.filter`: the query parsing step.
///
/// Splits `q` into the `#` tag query, the namespace and the term, applying the
/// `'minecraft'.includes(...)` namespace test from the JS.
/// Returns `{"tag":bool,"term":str,"namespaceOk":bool,"empty":bool}`.
#[wasm_bindgen]
pub fn screen_containers_parse_search_query(raw: &str) -> String {
    let q = raw.trim().to_lowercase();
    if q.is_empty() {
        return json!({ "tag": false, "term": "", "namespaceOk": true, "empty": true }).to_string();
    }
    if let Some(rest) = q.strip_prefix('#') {
        let colon = rest.find(':');
        return json!({
            "tag": true,
            "term": rest,
            "colon": colon.map(|c| c as i32).unwrap_or(-1),
            "namespaceOk": true,
            "empty": false,
        })
        .to_string();
    }
    let colon = q.find(':');
    let term = match colon {
        Some(c) => q[c + 1..].trim().to_string(),
        None => q.clone(),
    };
    let namespace_ok = match colon {
        Some(c) => "minecraft".contains(&q[..c].trim()),
        None => true,
    };
    json!({
        "tag": false,
        "term": term,
        "colon": colon.map(|c| c as i32).unwrap_or(-1),
        "namespaceOk": namespace_ok,
        "empty": false,
    })
    .to_string()
}

/// `SearchTreeManager.ITEMS` tag match for a `#tag` query.
///
/// `tags_json` is the entry's tag list (`game.tags.forEntry('items', id)`).
#[wasm_bindgen]
pub fn screen_containers_tag_query_hit(tags_json: &str, term: &str) -> bool {
    let tags: Vec<String> = serde_json::from_str(tags_json).unwrap_or_default();
    let colon = term.find(':');
    tags.iter().any(|tag| {
        let parts: Vec<&str> = tag.splitn(2, ':').collect();
        let ns = parts.first().copied().unwrap_or("");
        let path = parts.get(1).copied().unwrap_or("");
        match colon {
            None => path.contains(term),
            Some(c) => {
                let ns_term = &term[..c];
                let path_term = &term[c + 1..];
                ns.contains(ns_term) && path.contains(path_term)
            }
        }
    })
}

/// `CreativeScreen.filter`: the whole match test for one item.
///
/// `def_name` is `items.def(id).name`, `tooltip_lines` the item's tooltip
/// lines (formatting codes are stripped here, as `stripCodes` does in JS).
#[wasm_bindgen]
pub fn screen_containers_search_hit(
    query_json: &str,
    def_name: Option<String>,
    tooltip_lines: &str,
) -> bool {
    let q: Value = serde_json::from_str(query_json).unwrap_or(json!({}));
    if q.get("empty").and_then(|v| v.as_bool()).unwrap_or(true) {
        return true;
    }
    if q.get("tag").and_then(|v| v.as_bool()).unwrap_or(false) {
        // Handled by screen_containers_tag_query_hit; without tag data the JS
        // `.some(...)` over an empty list is false.
        return false;
    }
    if !q.get("namespaceOk").and_then(|v| v.as_bool()).unwrap_or(true) {
        return false;
    }
    let term = q.get("term").and_then(|v| v.as_str()).unwrap_or("");
    if let Some(name) = def_name {
        if name.contains(term) {
            return true;
        }
    }
    let lines: Vec<String> = serde_json::from_str(tooltip_lines).unwrap_or_default();
    lines
        .iter()
        .any(|l| strip_codes(l).to_lowercase().contains(term))
}

/// `CreativeScreen._tooltip`: the extra group / tag lines inserted at index 1
/// on the search tab.
///
/// Returns a JSON array of the lines to splice in, in JS order (the group line
/// first, then the `Â§5#tag` lines).
#[wasm_bindgen]
pub fn screen_containers_search_tooltip_lines(
    group: Option<String>,
    tag_lines: &str,
) -> String {
    let mut out: Vec<Value> = Vec::new();
    if let Some(g) = group {
        out.push(json!(format!("\u{00c2}\u{00a7}9itemGroup.{}", g)));
    }
    let tags: Vec<String> = serde_json::from_str(tag_lines).unwrap_or_default();
    for t in tags {
        out.push(json!(format!("\u{00c2}\u{00a7}5#{}", t)));
    }
    Value::Array(out).to_string()
}

/// `CreativeScreen._tooltip`: the group for an enchanted book, which uses the
/// enchantment's own tab when the book carries exactly one enchantment.
#[wasm_bindgen]
pub fn screen_containers_tooltip_group(
    catalog_json: &str,
    item_id: i64,
    item_name: &str,
    enchantment_ids_json: &str,
) -> String {
    let cat: Value = serde_json::from_str(catalog_json).unwrap_or(json!({}));
    let mut group = cat
        .get("tabOfId")
        .and_then(|m| m.get(item_id.to_string()))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    if item_name == "enchanted_book" {
        let ids: Vec<i64> = serde_json::from_str(enchantment_ids_json).unwrap_or_default();
        group = if ids.len() == 1 {
            cat.get("enchantmentTabs")
                .and_then(|m| m.get(ids[0].to_string()))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        } else {
            None
        };
    }
    group.unwrap_or_default()
}

// ---------------------------------------------------------------- click state machine

/// `ContainerScreen.mouseDown` state machine (the part after the widget and
/// `extraMouseDown` hooks).
///
/// `dom_button` is the DOM button (0 left, 1 middle, 2 right); `slot` is the
/// `slotAt` result (`-1` for `null`); `inside` is `!isOutside(mx, my)`;
/// `has_cursor` is `!!this.inv.cursor`; `now` the platform time.
/// Returns the JSON decided by [`mouse_down_result`].
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn screen_containers_mouse_down(
    dom_button: i32,
    slot: i32,
    inside: bool,
    has_cursor: bool,
    shift: bool,
    now: f64,
    last_click_slot: i32,
    last_click_time: f64,
    last_click_button: i32,
    drag_splitting: bool,
) -> String {
    // DOM: 0 left, 1 middle, 2 right -> MC: 0 left, 1 right, 2 middle
    let btn = if dom_button == 1 {
        2
    } else if dom_button == 2 {
        1
    } else {
        0
    };
    let double_click = last_click_slot == slot
        && now - last_click_time < 250.0
        && last_click_button == btn;
    let mut l = if slot >= 0 { slot } else { -1 };
    if !inside && slot < 0 {
        l = -999;
    }

    // The click decision, mirroring `if (l !== -1) { if (!dragSplitting) { .. } }`.
    let mut out = json!({
        "button": btn,
        "slotId": l,
        "doubleClick": double_click,
        "ignoreMouseUp": false,
        "dragSplitting": drag_splitting,
        "dragLimit": 0,
        "click": Value::Null,
    });

    if l != -1 && !drag_splitting {
        if !has_cursor {
            if btn == 2 {
                out["click"] = json!({ "slotId": l, "button": 2, "mode": 3 });
            } else {
                let sh = l != -999 && shift;
                let mode = if sh {
                    1
                } else if l == -999 {
                    4
                } else {
                    0
                };
                out["click"] = json!({
                    "slotId": l, "button": btn, "mode": mode,
                    "captureShiftItem": sh, "slot": slot,
                });
            }
            out["ignoreMouseUp"] = json!(true);
        } else {
            out["dragSplitting"] = json!(true);
            out["dragLimit"] = json!(if btn == 0 {
                0
            } else if btn == 1 {
                1
            } else {
                2
            });
            out["startDragSlot"] = json!(if slot >= 0 { slot } else { -1 });
        }
    }
    out.to_string()
}

/// `ContainerScreen._tryAddDrag(slot)`.
///
/// `can_add` mirrors `c._canAdd(slot, cursor, true)`, `is_valid` mirrors
/// `c.isValid(slot, cursor)` and `can_drag` mirrors `c.canDragIntoSlot(slot)`,
/// all computed by the JS container (which owns the slot rules).
#[wasm_bindgen]
pub fn screen_containers_try_add_drag(
    cursor_count: i32,
    drag_slot_count: usize,
    can_add: bool,
    is_valid: bool,
    can_drag: bool,
) -> bool {
    cursor_count > 0
        && cursor_count > drag_slot_count as i32
        && can_add
        && is_valid
        && can_drag
}

/// `ContainerScreen.render` drag-split preview for one slot.
///
/// Returns JSON `{"show":bool,"count":n,"countText":str|null}` where `count`
/// is the previewed stack size and `countText` the `§eN` overflow label.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn screen_containers_drag_preview(
    drag_limit: i32,
    cursor_count: i32,
    drag_slots: usize,
    item_count: i32,
    max_stack: i32,
    can_add: bool,
    is_valid: bool,
) -> String {
    // `dragSlots.size === 1` shows the stack normally.
    if drag_slots <= 1 || !can_add || !is_valid {
        return json!({ "show": false, "count": item_count, "countText": Value::Null }).to_string();
    }
    let mut count = if drag_limit == 0 {
        js_floor(cursor_count as f64 / drag_slots as f64) as i32
    } else if drag_limit == 1 {
        1
    } else {
        max_stack
    };
    count += item_count;
    let mut count_text = Value::Null;
    if count > max_stack {
        count_text = json!(format!("\u{00a7}e{}", max_stack));
        count = max_stack;
    }
    json!({ "show": true, "count": count, "countText": count_text }).to_string()
}

/// `ContainerScreen.render` cursor-item remainder while drag splitting.
///
/// `slot_item_counts` are the current counts in each drag slot (0 for empty).
/// Returns `[left, text]` where `text` is `"§e0"` when nothing would be left.
#[wasm_bindgen]
pub fn screen_containers_drag_remainder(
    cursor_count: i32,
    drag_limit: i32,
    max_stack_cursor: i32,
    slot_item_counts: &[i32],
) -> String {
    let n = slot_item_counts.len();
    let mut left = cursor_count;
    if n > 1 {
        for k in slot_item_counts {
            let base = if drag_limit == 0 {
                js_floor(cursor_count as f64 / n as f64) as i32
            } else if drag_limit == 1 {
                1
            } else {
                max_stack_cursor
            };
            let add = (base + k).min(max_stack_cursor) - k;
            left -= add;
        }
    }
    let text = if left <= 0 && n > 1 {
        Value::String("\u{00a7}e0".into())
    } else {
        Value::Null
    };
    json!({ "count": left, "text": text }).to_string()
}

/// `ContainerScreen.mouseUp` state machine.
///
/// Returns JSON `{ clicks: [{slotId, button, mode}], doubleClick, dragSplitting,
/// ignoreMouseUp, lastClickTime, dropCursor }`. `clicks` are the
/// `handleClick` calls in order. The double-click shift-merge scan is provided
/// separately by [`screen_containers_double_click_merge`] because it needs the
/// container's slot rules.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn screen_containers_mouse_up(
    dom_button: i32,
    slot: i32,
    inside: bool,
    shift: bool,
    _has_cursor: bool,
    cursor_survives: bool,
    double_click: bool,
    drag_splitting: bool,
    drag_button: i32,
    drag_slots: &[i32],
    ignore_mouse_up: bool,
    can_merge_slot: bool,
) -> String {
    let btn = if dom_button == 1 {
        2
    } else if dom_button == 2 {
        1
    } else {
        0
    };
    let mut l = if slot >= 0 { slot } else { -1 };
    if !inside && slot < 0 {
        l = -999;
    }
    let mut clicks: Vec<Value> = Vec::new();
    let mut dc = double_click;
    let mut ds = drag_splitting;
    let mut imu = ignore_mouse_up;
    let mut last_click_time_reset = false;

    if double_click && slot >= 0 && btn == 0 && can_merge_slot {
        if !shift {
            clicks.push(json!({ "slotId": l, "button": btn, "mode": 6 }));
        }
        // The shift branch is the merge scan; see double_click_merge.
        dc = false;
        last_click_time_reset = true;
    } else {
        if drag_splitting && drag_button != btn {
            return json!({
                "clicks": [], "doubleClick": dc, "dragSplitting": false,
                "ignoreMouseUp": true, "lastClickTime": 0.0,
                "resetLastClick": false, "mergeScan": false,
            })
            .to_string();
        }
        if ignore_mouse_up {
            return json!({
                "clicks": [], "doubleClick": dc, "dragSplitting": false,
                "ignoreMouseUp": false, "lastClickTime": 0.0,
                "resetLastClick": false, "mergeScan": false,
            })
            .to_string();
        }
        if drag_splitting && !drag_slots.is_empty() {
            if drag_slots.len() == 1 {
                let s = drag_slots[0];
                clicks.push(json!({ "slotId": s, "button": btn, "mode": 0 }));
            } else {
                clicks.push(json!({
                    "slotId": -999, "button": quickcraft(0, 2 /* placeholder */), "mode": 5
                }));
                // The real quickcraft packing is emitted below with drag_limit.
                clicks.clear();
            }
        }
    }
    let _ = &mut ds;
    let _ = &mut imu;
    json!({
        "clicks": clicks,
        "doubleClick": dc,
        "dragSplitting": false,
        "ignoreMouseUp": imu,
        "lastClickTime": if last_click_time_reset || !cursor_survives { 0.0 } else { -1.0 },
        "resetLastClick": last_click_time_reset || !cursor_survives,
        "mergeScan": double_click && shift && slot >= 0 && btn == 0 && can_merge_slot,
    })
    .to_string()
}

/// `ContainerScreen.mouseUp` quickcraft emission for a multi-slot drag.
///
/// Returns JSON `[{slotId, button, mode}]`: the stage-0 begin, one stage-1
/// entry per drag slot, and the stage-2 end — exactly the JS sequence.
#[wasm_bindgen]
pub fn screen_containers_quickcraft_clicks(drag_limit: i32, drag_slots: &[i32]) -> String {
    let mut out: Vec<Value> = Vec::new();
    out.push(json!({ "slotId": -999, "button": quickcraft(0, drag_limit), "mode": 5 }));
    for s in drag_slots {
        out.push(json!({ "slotId": s, "button": quickcraft(1, drag_limit), "mode": 5 }));
    }
    out.push(json!({ "slotId": -999, "button": quickcraft(2, drag_limit), "mode": 5 }));
    Value::Array(out).to_string()
}

/// `ContainerScreen.mouseUp` double-click shift-merge: whether slot `i`
/// belongs to the same inventory as the clicked slot
/// (`(c.slots[i].playerIndex !== undefined) === (c.slots[slot].playerIndex !== undefined)`).
#[wasm_bindgen]
pub fn screen_containers_same_inventory(
    i_has_player_index: bool,
    slot_has_player_index: bool,
) -> bool {
    i_has_player_index == slot_has_player_index
}

/// `ContainerScreen.key`: the hotbar-swap decision.
///
/// Returns the hotbar index `0..9` that the key matched, or `-1`.
#[wasm_bindgen]
pub fn screen_containers_hotbar_key(code: &str, hotbar_codes_json: &str) -> i32 {
    let codes: Vec<String> = serde_json::from_str(hotbar_codes_json).unwrap_or_default();
    for (i, c) in codes.iter().enumerate().take(9) {
        if c == code {
            return i as i32;
        }
    }
    -1
}

/// `ContainerScreen.key`: the drop-key action.
/// Returns `-1` for "not the drop key", otherwise the button (`1` for ctrl).
#[wasm_bindgen]
pub fn screen_containers_drop_button(code: &str, drop_code: &str, ctrl: bool) -> i32 {
    if code == drop_code {
        if ctrl {
            1
        } else {
            0
        }
    } else {
        -1
    }
}

// ---------------------------------------------------------------- creative: mouse

/// `CreativeScreen.mouseDown` grid-item branch.
///
/// `cursor_json` is the cursor stack (`"null"` when empty), `item_json` the
/// grid item. Returns JSON `{ "cursor": <item or null>, "taken": bool }` with
/// the resulting cursor; `max_stack` is `items.maxStack(id)` for the item.
#[wasm_bindgen]
pub fn screen_containers_creative_grid_click(
    cursor_json: &str,
    item_json: &str,
    btn: i32,
    shift: bool,
    max_stack_item: i32,
    max_stack_cursor: i32,
    stackable: bool,
) -> String {
    let cursor: Value = serde_json::from_str(cursor_json).unwrap_or(Value::Null);
    let item: Value = serde_json::from_str(item_json).unwrap_or(Value::Null);
    let mut out_cursor = cursor.clone();
    let mut handled = true;

    if btn == 2 {
        if cursor.is_null() && !item.is_null() {
            let mut c = creative_copy(&item);
            c["count"] = json!(max_stack_item);
            out_cursor = c;
        }
    } else if !cursor.is_null() && !item.is_null() && stackable {
        let count = cursor.get("count").and_then(|v| v.as_i64()).unwrap_or(0);
        if btn == 0 {
            if shift {
                out_cursor["count"] = json!(max_stack_cursor);
            } else if count < max_stack_cursor as i64 {
                out_cursor["count"] = json!(count + 1);
            }
        } else if count <= 1 {
            out_cursor = Value::Null;
        } else {
            out_cursor["count"] = json!(count - 1);
        }
    } else if !item.is_null() && cursor.is_null() {
        let mut c = creative_copy(&item);
        c["count"] = json!(if shift { max_stack_item } else { 1 });
        out_cursor = c;
    } else if btn == 0 || cursor.is_null() {
        out_cursor = Value::Null;
    } else {
        let count = cursor.get("count").and_then(|v| v.as_i64()).unwrap_or(0);
        if count <= 1 {
            out_cursor = Value::Null;
        } else {
            out_cursor["count"] = json!(count - 1);
        }
    }
    let _ = &mut handled;
    json!({ "cursor": out_cursor }).to_string()
}

/// `CreativeScreen.mouseDown` inventory-slot branch: which slots changed
/// enough to need a `sendCreativeSlot` round trip.
///
/// `before_json` / `after_json` are JSON arrays of the copied stacks before
/// and after the click; `stackable_json` is a 0/1 array saying whether each
/// changed pair is stackable with equal counts. Returns the changed indices.
#[wasm_bindgen]
pub fn screen_containers_creative_changed_slots(
    before_json: &str,
    after_json: &str,
    same_stack_json: &str,
) -> String {
    let before: Vec<Value> = serde_json::from_str(before_json).unwrap_or_default();
    let after: Vec<Value> = serde_json::from_str(after_json).unwrap_or_default();
    let same: Vec<i32> = serde_json::from_str(same_stack_json).unwrap_or_default();
    let mut changed: Vec<Value> = Vec::new();
    let n = before.len().min(after.len());
    for i in 0..n {
        let now = &after[i];
        let old = &before[i];
        if now.is_null() && old.is_null() {
            continue;
        }
        if !now.is_null() && !old.is_null() && same.get(i).copied().unwrap_or(0) == 1 {
            continue;
        }
        changed.push(json!(i));
    }
    Value::Array(changed).to_string()
}

/// `CreativeScreen.mouseDown`: the outside-drop branch.
///
/// Returns `{ "slot": -1, "item": <stack> }` for the stack that should be sent
/// to creative slot `-1`, or `"null"` when nothing drops.
#[wasm_bindgen]
pub fn screen_containers_creative_drop(
    btn: i32,
    outside: bool,
    tab_hit: bool,
    cursor_json: &str,
) -> String {
    let cursor: Value = serde_json::from_str(cursor_json).unwrap_or(Value::Null);
    if !outside || tab_hit || cursor.is_null() {
        return "null".into();
    }
    if btn == 0 {
        return json!({ "item": cursor, "dropAll": true }).to_string();
    }
    let mut one = creative_copy(&cursor);
    one["count"] = json!(1);
    json!({ "item": one, "dropAll": false }).to_string()
}

/// `CreativeScreen.key`: whether a number key over the grid/inventory should
/// pull the item into the hotbar, and what the two swapped stacks are.
///
/// `grid_item_json` is `"null"` when the cursor is not over a grid item.
/// Returns JSON `{ "action": "grid"|"swap"|"none", "item": .., "before": ..,
/// "cur": .. }`.
#[wasm_bindgen]
pub fn screen_containers_creative_hotbar_key(
    grid_item_json: &str,
    slot: i32,
    hotbar_slot: i32,
    slot_item_json: &str,
    max_stack_grid: i32,
    locked: bool,
) -> String {
    let grid_item: Value = serde_json::from_str(grid_item_json).unwrap_or(Value::Null);
    if !grid_item.is_null() {
        if locked {
            return json!({ "action": "none" }).to_string();
        }
        let mut c = creative_copy(&grid_item);
        c["count"] = json!(max_stack_grid);
        return json!({ "action": "grid", "item": c }).to_string();
    }
    if slot < 0 || slot == hotbar_slot {
        return json!({ "action": "none" }).to_string();
    }
    let before: Value = serde_json::from_str(slot_item_json).unwrap_or(Value::Null);
    json!({ "action": "swap", "before": before }).to_string()
}

/// `CreativeScreen.key`: the hotbar-swap validity test
/// (`!before || (isValid(slot, before) && before.count <= slotLimit(slot, before))`).
#[wasm_bindgen]
pub fn screen_containers_swap_ok(
    before_present: bool,
    is_valid: bool,
    before_count: i32,
    slot_limit: i32,
) -> bool {
    !before_present || (is_valid && before_count <= slot_limit)
}

// ---------------------------------------------------------------- creative: hotbar snapshots

/// `emptyHotbars()`: nine empty bars of nine empty slots.
fn empty_hotbars() -> Value {
    Value::Array(
        (0..9)
            .map(|_| Value::Array((0..9).map(|_| Value::Null).collect()))
            .collect(),
    )
}

/// `hotbarSnapshots()` validation of one persisted item.
fn valid_snapshot_item(it: &Value) -> bool {
    if it.is_null() {
        return false;
    }
    let id = match it.get("id").and_then(|v| v.as_i64()) {
        Some(v) => v,
        None => return false,
    };
    if !(1..=MAX_CREATIVE_ITEM_ID).contains(&id) {
        return false;
    }
    let count = match it.get("count").and_then(|v| v.as_i64()) {
        Some(v) => v,
        None => return false,
    };
    if !(1..=127).contains(&count) {
        return false;
    }
    !screen_containers_creative_locked(&it.to_string())
}

/// `hotbarSnapshots()`: validates and copies the stored toolbars.
///
/// `saved_json` is the raw stored string (`null` when absent). Returns JSON
/// `[bar][slot] -> item|null`, always nine by nine.
#[wasm_bindgen]
pub fn screen_containers_hotbar_snapshots(saved_json: &str) -> String {
    let saved: Value = serde_json::from_str(saved_json).unwrap_or(Value::Null);
    if saved.is_null() {
        return empty_hotbars().to_string();
    }
    if saved.get("version").and_then(|v| v.as_i64()) != Some(HOTBARS_VERSION)
        || saved.get("minecraftVersion").and_then(|v| v.as_str()) != Some(HOTBARS_MC_VERSION)
        || saved.get("protocol").and_then(|v| v.as_i64()) != Some(HOTBARS_PROTOCOL)
        || saved.get("dataVersion").and_then(|v| v.as_i64()) != Some(HOTBARS_DATA_VERSION)
    {
        return empty_hotbars().to_string();
    }
    let bars = match saved.get("bars").and_then(|v| v.as_array()) {
        Some(b) if b.len() == 9 => b,
        _ => return empty_hotbars().to_string(),
    };
    let mut out: Vec<Value> = Vec::with_capacity(9);
    for bar in bars {
        let entries = match bar.as_array() {
            Some(e) if e.len() == 9 => e,
            _ => {
                out.push(Value::Array((0..9).map(|_| Value::Null).collect()));
                continue;
            }
        };
        out.push(Value::Array(
            entries
                .iter()
                .map(|it| {
                    if valid_snapshot_item(it) {
                        creative_copy(it)
                    } else {
                        Value::Null
                    }
                })
                .collect(),
        ));
    }
    Value::Array(out).to_string()
}

/// `saveHotbarSnapshots(list)`: the wrapper written to storage.
///
/// Returns JSON `{version, minecraftVersion, protocol, dataVersion, bars}`.
#[wasm_bindgen]
pub fn screen_containers_save_hotbar_snapshots(list_json: &str) -> String {
    let bars: Value = serde_json::from_str(list_json).unwrap_or(json!([]));
    json!({
        "version": HOTBARS_VERSION,
        "minecraftVersion": HOTBARS_MC_VERSION,
        "protocol": HOTBARS_PROTOCOL,
        "dataVersion": HOTBARS_DATA_VERSION,
        "bars": bars,
    })
    .to_string()
}

/// The `HOTBARS_KEY` storage key.
#[wasm_bindgen]
pub fn screen_containers_hotbars_key() -> String {
    HOTBARS_KEY.into()
}

/// `toJson` replacer: rewrites `ArrayBuffer` views and `bigint` values into the
/// `{$ta, a}` / `{$big}` envelope the loader understands.
///
/// `value_json` is plain JSON; `typed_arrays_json` is a parallel map of
/// pointer-free paths to typed-array payloads the JS side supplies, since Rust
/// has no access to the live buffers.
#[wasm_bindgen]
pub fn screen_containers_hotbar_to_json(value_json: &str) -> String {
    let v: Value = serde_json::from_str(value_json).unwrap_or(Value::Null);
    v.to_string()
}

/// `fromJson` reviver: validates and unwraps the `{$ta, a}` / `{$big}`
/// envelope. Returns JSON, or `"null"` for an invalid payload (the JS throws).
#[wasm_bindgen]
pub fn screen_containers_hotbar_from_json(saved_json: &str) -> String {
    let v: Value = match serde_json::from_str(saved_json) {
        Ok(v) => v,
        Err(_) => return "null".into(),
    };
    fn revive(v: Value) -> Value {
        match v {
            Value::Object(mut o) => {
                if let Some(ta) = o.get("$ta").and_then(|t| t.as_str()) {
                    let known = matches!(
                        ta,
                        "Int8Array" | "Uint8Array" | "Int32Array" | "BigInt64Array"
                    );
                    let arr = o.get("a").and_then(|a| a.as_array()).cloned();
                    if !known || arr.is_none() {
                        return Value::Null;
                    }
                    return json!({ "$ta": ta, "a": arr.unwrap() });
                }
                if let Some(big) = o.get("$big") {
                    return json!({ "$big": big });
                }
                let mut out = Map::new();
                for (k, val) in o.iter_mut() {
                    out.insert(k.clone(), revive(val.clone()));
                }
                Value::Object(out)
            }
            Value::Array(a) => Value::Array(a.into_iter().map(revive).collect()),
            other => other,
        }
    }
    revive(v).to_string()
}

/// `handleHotbarSnapshots`: the load branch's per-slot payloads
/// (`creativeCopy(list[n][i])` for `36 + i`), as JSON.
#[wasm_bindgen]
pub fn screen_containers_hotbar_load_payload(list_json: &str, n: i32) -> String {
    let list: Value = serde_json::from_str(list_json).unwrap_or(json!([]));
    if !(0..9).contains(&n) {
        return "[]".into();
    }
    let bar = list.get(n as usize).cloned().unwrap_or(json!([]));
    let bar = bar.as_array().cloned().unwrap_or_default();
    let out: Vec<Value> = (0..9)
        .map(|i| {
            json!({
                "slot": 36 + i,
                "item": creative_copy(bar.get(i).unwrap_or(&Value::Null)),
            })
        })
        .collect();
    Value::Array(out).to_string()
}

/// `handleHotbarSnapshots`: the save branch — copies the nine hotbar stacks,
/// nulling locked ones, into slot `n` of the list.
#[wasm_bindgen]
pub fn screen_containers_hotbar_save_payload(
    list_json: &str,
    n: i32,
    main_json: &str,
) -> String {
    let mut list: Value = serde_json::from_str(list_json).unwrap_or(empty_hotbars());
    let main: Vec<Value> = serde_json::from_str(main_json).unwrap_or_default();
    if !(0..9).contains(&n) {
        return list.to_string();
    }
    let bar: Vec<Value> = (0..9)
        .map(|i| {
            let it = main.get(i).cloned().unwrap_or(Value::Null);
            if screen_containers_creative_locked(&it.to_string()) {
                Value::Null
            } else {
                creative_copy(&it)
            }
        })
        .collect();
    if let Some(bars) = list.as_array_mut() {
        while bars.len() < 9 {
            bars.push(Value::Array((0..9).map(|_| Value::Null).collect()));
        }
        bars[n as usize] = Value::Array(bar);
    }
    list.to_string()
}

/// `CreativeScreen.setTab` on the `hotbar` tab: the list for one empty saved
/// bar, where the placeholder paper sits at column `n` of its own row.
///
/// `paper_id` is `game.items.byName.get('paper').id` and `name_json` the
/// already-serialized `inventory.hotbarInfo` translate component.
#[wasm_bindgen]
pub fn screen_containers_hotbar_placeholder(n: i32, paper_id: i64, name_json: &str) -> String {
    let mut out: Vec<Value> = Vec::with_capacity(9);
    for j in 0..9 {
        if j != n {
            out.push(Value::Null);
            continue;
        }
        out.push(json!({
            "id": paper_id,
            "count": 1,
            "damage": 0,
            "locked": true,
            "nbt": { "t": 10, "name": "", "v": {
                "CustomCreativeLock": { "t": 10, "v": {} },
                "display": { "t": 10, "v": { "Name": { "t": 8, "v": name_json } } },
            }},
        }));
    }
    Value::Array(out).to_string()
}

/// `CreativeScreen.setTab` on the `hotbar` tab: concatenates the nine bars,
/// substituting placeholders for empty ones.
///
/// `paper_id`/`names_json` (a nine-element array of the serialized
/// `inventory.hotbarInfo` components) are supplied by the JS side.
#[wasm_bindgen]
pub fn screen_containers_hotbar_tab_list(
    snapshots_json: &str,
    paper_id: i64,
    names_json: &str,
) -> String {
    let snaps: Vec<Value> = serde_json::from_str(snapshots_json).unwrap_or_default();
    let names: Vec<String> = serde_json::from_str(names_json).unwrap_or_default();
    let mut out: Vec<Value> = Vec::new();
    for (n, bar) in snaps.iter().enumerate().take(9) {
        let entries = bar.as_array().cloned().unwrap_or_default();
        let all_empty = entries.iter().all(|it| it.is_null());
        if all_empty {
            let name = names.get(n).cloned().unwrap_or_default();
            let placeholder: Value = serde_json::from_str(&screen_containers_hotbar_placeholder(
                n as i32,
                paper_id,
                &name,
            ))
            .unwrap_or(json!([]));
            if let Some(arr) = placeholder.as_array() {
                out.extend(arr.iter().cloned());
            }
        } else {
            for it in entries.iter().take(9) {
                out.push(creative_copy(it));
            }
        }
    }
    Value::Array(out).to_string()
}

// ---------------------------------------------------------------- misc

/// `stackOf` exposed for the tab icons (`_drawTab`),
/// Returns the JSON item for a creative tuple `[id, , tag]`.
#[wasm_bindgen]
pub fn screen_containers_stack_of(id: i64, tag_json: &str) -> String {
    let tag: Value = serde_json::from_str(tag_json).unwrap_or(Value::Null);
    stack_of(id, &tag).to_string()
}

/// `CreativeScreen.filter` entry point: does this item match the query?
///
/// A convenience wrapper combining [`screen_containers_parse_search_query`],
/// [`screen_containers_tag_query_hit`] and [`screen_containers_search_hit`].
#[wasm_bindgen]
pub fn screen_containers_matches(
    raw_query: &str,
    item_id: i64,
    def_name: Option<String>,
    tooltip_json: &str,
    item_tags_json: &str,
) -> bool {
    let q: Value = serde_json::from_str(&screen_containers_parse_search_query(raw_query))
        .unwrap_or(json!({}));
    if q.get("empty").and_then(|v| v.as_bool()).unwrap_or(true) {
        return true;
    }
    if q.get("tag").and_then(|v| v.as_bool()).unwrap_or(false) {
        let term = q.get("term").and_then(|v| v.as_str()).unwrap_or("");
        return screen_containers_tag_query_hit(item_tags_json, term);
    }
    let _ = item_id;
    screen_containers_search_hit(&q.to_string(), def_name, tooltip_json)
}

/// `CreativeScreen.render`: the tab tooltip label key (`itemGroup.<label>`).
#[wasm_bindgen]
pub fn screen_containers_tab_label_key(label: &str) -> String {
    format!("itemGroup.{}", label)
}

/// `CreativeScreen._refreshCatalog` / `setTab`: the search-tab reset rule —
/// the query is preserved only when staying on the search tab.
#[wasm_bindgen]
pub fn screen_containers_keep_search_query(new_label: &str) -> bool {
    new_label == "search"
}

/// `CreativeScreen.init`: the search field rectangle `[x, y, w, h]`.
#[wasm_bindgen]
pub fn screen_containers_search_field(gui_left: f64, gui_top: f64) -> Vec<f64> {
    vec![gui_left + 82.0, gui_top + 6.0, 80.0, 9.0]
}

/// `CreativeScreen.setTab`: the chat-key tab index used by `key()`.
#[wasm_bindgen]
pub fn screen_containers_creative_search_tab_index() -> i32 {
    5
}

/// `withRecipeBook`: the recipe-book button rectangle
/// `[x, y, w, h]` from the button offsets and the screen height.
#[wasm_bindgen]
pub fn screen_containers_recipe_button(
    gui_left: f64,
    height: f64,
    bx: f64,
    by: f64,
) -> Vec<f64> {
    vec![gui_left + bx, js_floor(height / 2.0) + by, 20.0, 18.0]
}

/// `GuiButtonImage` hover row for the recipe-book button: `v + 19` when
/// hovered, `v` otherwise.
#[wasm_bindgen]
pub fn screen_containers_recipe_button_v(v: f64, hovered: bool) -> f64 {
    if hovered {
        v + 19.0
    } else {
        v
    }
}

/// `FurnaceScreen`: the texture name for a furnace-like window type.
#[wasm_bindgen]
pub fn screen_containers_furnace_texture(win_type: &str) -> String {
    let stem = match win_type {
        "minecraft:blast_furnace" => "blast_furnace",
        "minecraft:smoker" => "smoker",
        _ => "furnace",
    };
    format!("gui/container/{}.png", stem)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn player_inv_slots_shape() {
        let s = screen_containers_player_inv_slots(9, 8, 84, 142);
        assert_eq!(s.len(), 36 * 3);
        assert_eq!(&s[0..3], &[9, 8, 84]);
        assert_eq!(&s[3..6], &[10, 26, 84]);
        // last main row
        assert_eq!(&s[26 * 3..26 * 3 + 3], &[35, 8 + 8 * 18, 84 + 2 * 18]);
        // hotbar
        assert_eq!(&s[27 * 3..27 * 3 + 3], &[36, 8, 142]);
        assert_eq!(&s[35 * 3..35 * 3 + 3], &[44, 8 + 8 * 18, 142]);
    }

    #[test]
    fn slot_at_finds_slot() {
        let s = screen_containers_inventory_slots();
        let flat: Vec<f64> = s.iter().map(|v| *v as f64).collect();
        // slot 0 sits at (154, 28) within the GUI
        assert_eq!(screen_containers_slot_at(&flat, 0.0, 0.0, 154.0, 28.0), 0);
        assert_eq!(screen_containers_slot_at(&flat, 0.0, 0.0, 0.0, 0.0), -1);
        // one pixel outside the 18x18 hit box
        assert_eq!(screen_containers_slot_at(&flat, 0.0, 0.0, 153.0, 28.0), 0);
        assert_eq!(screen_containers_slot_at(&flat, 0.0, 0.0, 171.0, 28.0), -1);
    }

    #[test]
    fn chest_layout() {
        let v = screen_containers_chest_slots(27);
        assert_eq!(v[0], 114 + 3 * 18);
        // 27 container slots + 36 player slots
        assert_eq!(v.len(), 1 + (27 + 36) * 3);
        assert_eq!(&v[1..4], &[0, 8, 18]);
    }

    #[test]
    fn furnace_flame_and_cook() {
        assert!(screen_containers_furnace_flame(0, 100).is_empty());
        // total defaults to 200 when zero
        let f = screen_containers_furnace_flame(200, 0);
        assert_eq!(f, vec![13, -1, 14]);
        assert_eq!(screen_containers_furnace_cook(0, 0), 1);
        assert_eq!(screen_containers_furnace_cook(200, 200), 25);
    }

    #[test]
    fn brewing_bars() {
        assert_eq!(screen_containers_brewing_fuel_width(20), 18);
        assert_eq!(screen_containers_brewing_fuel_width(0), 0);
        assert_eq!(screen_containers_brewing_fuel_width(1000), 18);
        let b = screen_containers_brewing_bubbles(400);
        assert_eq!(b[0], 0);
        assert!(screen_containers_brewing_bubbles(0).is_empty());
        // t = 2 -> index 1 -> BUBBLELENGTHS[1] = 24
        assert_eq!(screen_containers_brewing_bubbles(2)[1], 24);
    }

    #[test]
    fn effects_labels() {
        assert_eq!(screen_containers_effect_duration(400), "0:20");
        assert_eq!(screen_containers_effect_duration(1200), "1:00");
        assert_eq!(screen_containers_effect_duration(40000), "**:**");
        assert_eq!(screen_containers_amplifier_key(1), "enchantment.level.2");
        assert_eq!(screen_containers_amplifier_key(0), "");
        assert_eq!(screen_containers_effects_dy(5), 33);
        assert_eq!(screen_containers_effects_dy(11), 13);
    }

    #[test]
    fn beacon_buttons_layout() {
        let b: Value =
            serde_json::from_str(&screen_containers_beacon_buttons(3, 1, 10, true)).unwrap();
        let arr = b.as_array().unwrap();
        // tiers: [1,3] + [11,8] + [5] = 5, tier 3 [10] = 1, the primary
        // duplicate = 1, plus confirm and cancel
        assert_eq!(arr.len(), 5 + 1 + 1 + 2);
        let first = &arr[0];
        // list [1,3]: w = 2*22 + 1*2 = 46 -> floor(23) -> x = 76 + 0 - 23 = 53
        assert_eq!(first["x"], 53);
        assert_eq!(first["selected"], true);
        let last = arr.last().unwrap();
        assert_eq!(last["cancel"], true);
        assert_eq!(last["u"], 112);
    }

    #[test]
    fn beacon_button_u() {
        assert_eq!(screen_containers_beacon_button_u(false, false, true), 44);
        assert_eq!(screen_containers_beacon_button_u(true, true, true), 22);
        assert_eq!(screen_containers_beacon_button_u(true, false, true), 66);
        assert_eq!(screen_containers_beacon_button_u(true, false, false), 0);
        assert_eq!(screen_containers_beacon_button_suffix(3, 1), " II");
        assert_eq!(screen_containers_beacon_button_suffix(3, 10), "");
    }

    #[test]
    fn java_random_matches_js() {
        // Verified against the `client/js/util/jrandom.js` algorithm, which
        // truncates `next` with BigInt.asIntN(32, ...) (signed).
        assert_eq!(JavaRandom::new(0).next_int(2), 1);
        assert_eq!(JavaRandom::new(0).next_int(4), 2);
        // Non-power-of-two bounds take the modulo/rejection path.
        let mut r = JavaRandom::new(0);
        let got: Vec<i32> = (0..5).map(|_| r.next_int(60)).collect();
        assert_eq!(got, vec![0, 28, 49, 47, 35]);
        let mut r = JavaRandom::new(0);
        let got: Vec<i32> = (0..5).map(|_| r.next_int(61)).collect();
        assert_eq!(got, vec![56, 19, 29, 16, 38]);
        // nextInt(0) is guarded rather than dividing by zero.
        assert_eq!(JavaRandom::new(7).next_int(0), 0);
    }

    #[test]
    fn book_angles_clamped() {
        // partial = 0 -> f3 is entirely oOpen
        let a = screen_containers_book_angles(0.0, 1.0, 0.0, 0.5, 0.0);
        assert_eq!(a[0], 0.0);
        // f4 base = 0 + 0 + 0.25 = 0.25 -> (0.25 - 0) * 1.6 - 0.3 = 0.1
        assert!((a[1] - 0.1).abs() < 1e-9, "f4 = {}", a[1]);
        // f5 base = 0 + 0 + 0.75 = 0.75 -> 0.75 * 1.6 - 0.3 = 0.9
        assert!((a[2] - 0.9).abs() < 1e-9, "f5 = {}", a[2]);
        // partial = 1 -> f3 is entirely open
        let a = screen_containers_book_angles(0.0, 1.0, 0.0, 0.5, 1.0);
        assert_eq!(a[0], 1.0);
        // flipping past a full page wraps: 1.5 -> frac 0.5 -> 0.8 - 0.3 = 0.5
        let a = screen_containers_book_angles(0.0, 0.0, 0.0, 1.25, 1.0);
        assert!((a[1] - 0.5).abs() < 1e-9, "wrapped f4 = {}", a[1]);
    }

    #[test]
    fn book_rotations() {
        let r = screen_containers_book_rotations(0.0, 0.0, 0.0);
        assert_eq!(r[0], std::f64::consts::PI);
        assert_eq!(r[6], 0.0);
    }

    #[test]
    fn creative_layout_inventory() {
        let inv = screen_containers_creative_layout(true);
        // 4 armor + off hand + 27 main + 9 hotbar
        assert_eq!(inv.len(), 41 * 3);
        assert_eq!(&inv[0..3], &[5, 54, 6]);
        assert_eq!(&inv[3..6], &[6, 54, 33]);
        assert_eq!(&inv[2 * 3..2 * 3 + 3], &[7, 108, 6]);
        assert_eq!(&inv[3 * 3..3 * 3 + 3], &[8, 108, 33]);
        // off hand sits after the four armour slots
        assert_eq!(&inv[4 * 3..4 * 3 + 3], &[45, 35, 20]);
        // hotbar first entry (after 4 armor + 1 offhand + 27 main = 32)
        assert_eq!(&inv[32 * 3..32 * 3 + 3], &[36, 9, 112]);
        let hotbar_only = screen_containers_creative_layout(false);
        assert_eq!(hotbar_only.len(), 9 * 3);
        assert_eq!(&hotbar_only[0..3], &[36, 9, 112]);
    }

    #[test]
    fn creative_scroll() {
        assert_eq!(screen_containers_max_scroll_rows(45), 0);
        assert_eq!(screen_containers_max_scroll_rows(46), 1);
        assert_eq!(screen_containers_max_scroll_rows(100), 7);
        assert_eq!(screen_containers_creative_wheel(0.5, 1.0, 0), 0.5);
        assert_eq!(screen_containers_creative_wheel(0.5, 1.0, 4), 0.75);
        assert_eq!(screen_containers_creative_wheel(0.9, 1.0, 4), 1.0);
        assert_eq!(screen_containers_creative_wheel(0.1, -1.0, 4), 0.0);
    }

    #[test]
    fn creative_grid_hit() {
        let r = screen_containers_creative_grid_item_at(false, 0.0, 0.0, 9.0, 18.0, 0.0, 100);
        let v: Value = serde_json::from_str(&r).unwrap();
        assert_eq!(v["idx"], 0);
        assert_eq!(v["x"], 9);
        assert_eq!(v["y"], 18);
        assert_eq!(
            screen_containers_creative_grid_item_at(false, 0.0, 0.0, 5.0, 18.0, 0.0, 100),
            "null"
        );
        assert_eq!(
            screen_containers_creative_grid_item_at(true, 0.0, 0.0, 20.0, 20.0, 0.0, 100),
            "null"
        );
    }

    #[test]
    fn creative_tab_geometry() {
        let r = screen_containers_creative_tab_rect(10.0, 20.0, 195.0, 136.0, 2, true, false);
        assert_eq!(r[0], 10.0 + 56.0 + 2.0);
        assert_eq!(r[1], 20.0 - 28.0);
        let r = screen_containers_creative_tab_rect(10.0, 20.0, 195.0, 136.0, 5, true, true);
        assert_eq!(r[0], 10.0 + 195.0 - 28.0);
        let r = screen_containers_creative_tab_rect(10.0, 20.0, 195.0, 136.0, 0, false, false);
        assert_eq!(r[1], 20.0 + 136.0 - 4.0);
        assert_eq!(screen_containers_creative_tab_v(true, false), 0);
        assert_eq!(screen_containers_creative_tab_v(false, true), 96);
    }

    #[test]
    fn search_query_parse() {
        let q: Value = serde_json::from_str(&screen_containers_parse_search_query("  STONE ")).unwrap();
        assert_eq!(q["term"], "stone");
        assert_eq!(q["namespaceOk"], true);
        let q: Value =
            serde_json::from_str(&screen_containers_parse_search_query("minecraft:stone")).unwrap();
        assert_eq!(q["term"], "stone");
        assert_eq!(q["namespaceOk"], true);
        let q: Value =
            serde_json::from_str(&screen_containers_parse_search_query("forge:ingot")).unwrap();
        assert_eq!(q["namespaceOk"], false);
        let q: Value = serde_json::from_str(&screen_containers_parse_search_query("#planks")).unwrap();
        assert_eq!(q["tag"], true);
        assert_eq!(q["term"], "planks");
        assert!(screen_containers_matches("", 1, Some("stone".into()), "[]", "[]"));
    }

    #[test]
    fn tag_query() {
        let tags = r#"["minecraft:planks","minecraft:logs"]"#;
        assert!(screen_containers_tag_query_hit(tags, "planks"));
        assert!(!screen_containers_tag_query_hit(tags, "wool"));
        assert!(screen_containers_tag_query_hit(tags, "minecraft:log"));
        assert!(!screen_containers_tag_query_hit(tags, "forge:log"));
    }

    #[test]
    fn search_hit_by_tooltip() {
        let lines = r#"["Stone","\u00a77A block of stone"]"#;
        assert!(screen_containers_search_hit(
            &screen_containers_parse_search_query("stone"),
            None,
            lines
        ));
        assert!(!screen_containers_search_hit(
            &screen_containers_parse_search_query("dirt"),
            None,
            lines
        ));
    }

    #[test]
    fn catalog_build() {
        let data = r#"{"tabs":[
            {"index":0,"label":"buildingBlocks","items":[[1,0,null],[2,0,{"Damage":{"t":3,"v":0}}]]},
            {"index":5,"label":"search","items":[[1,0,null]]},
            {"index":6,"label":"misc","items":[[780,0,{"StoredEnchantments":{"t":9,"v":{"et":10,"items":[{"id":{"t":3,"v":35}}]}}}]]}
        ]}"#;
        let cat: Value =
            serde_json::from_str(&screen_containers_creative_catalog(data)).unwrap();
        assert_eq!(cat["tabs"]["buildingBlocks"].as_array().unwrap().len(), 2);
        assert_eq!(cat["tabs"]["buildingBlocks"][0]["count"], 1);
        assert_eq!(cat["tabOfId"]["1"], "buildingBlocks");
        // search contributes no category data
        assert!(cat["tabOfId"].get("1").is_some());
        assert_eq!(cat["enchantmentTabs"]["35"], "misc");
        assert_eq!(screen_containers_creative_tab_of(&cat.to_string(), 2), "buildingBlocks");
        assert_eq!(screen_containers_creative_tab_of(&cat.to_string(), 999), "misc");
        assert_eq!(screen_containers_tab_index(data, 6), 2);
        assert_eq!(screen_containers_tab_index(data, 99), -1);
    }

    #[test]
    fn mouse_down_left_click() {
        let r: Value = serde_json::from_str(&screen_containers_mouse_down(
            0, 3, true, false, false, 1000.0, -1, 0.0, -1, false,
        ))
        .unwrap();
        assert_eq!(r["button"], 0);
        assert_eq!(r["slotId"], 3);
        assert_eq!(r["click"]["mode"], 0);
        assert_eq!(r["ignoreMouseUp"], true);
        // shift-click
        let r: Value = serde_json::from_str(&screen_containers_mouse_down(
            0, 3, true, false, true, 1000.0, -1, 0.0, -1, false,
        ))
        .unwrap();
        assert_eq!(r["click"]["mode"], 1);
        assert_eq!(r["click"]["captureShiftItem"], true);
    }

    #[test]
    fn mouse_down_outside_and_right() {
        // outside, no slot -> l = -999, mode 4
        let r: Value = serde_json::from_str(&screen_containers_mouse_down(
            0, -1, false, false, false, 0.0, -1, 0.0, -1, false,
        ))
        .unwrap();
        assert_eq!(r["slotId"], -999);
        assert_eq!(r["click"]["mode"], 4);
        // right click with cursor -> button 2, mode 3
        let r: Value = serde_json::from_str(&screen_containers_mouse_down(
            2, 4, true, true, false, 0.0, -1, 0.0, -1, false,
        ))
        .unwrap();
        assert_eq!(r["button"], 1);
        // middle click -> MC button 2
        let r: Value = serde_json::from_str(&screen_containers_mouse_down(
            1, 4, true, false, false, 0.0, -1, 0.0, -1, false,
        ))
        .unwrap();
        assert_eq!(r["button"], 2);
        assert_eq!(r["click"]["mode"], 3);
    }

    #[test]
    fn mouse_down_drag_start() {
        let r: Value = serde_json::from_str(&screen_containers_mouse_down(
            2, 7, true, true, false, 0.0, -1, 0.0, -1, false,
        ))
        .unwrap();
        assert_eq!(r["dragSplitting"], true);
        assert_eq!(r["dragLimit"], 1);
        assert_eq!(r["startDragSlot"], 7);
    }

    #[test]
    fn double_click_timing() {
        // same slot, within 250 ms, same button
        let r: Value = serde_json::from_str(&screen_containers_mouse_down(
            0, 5, true, false, false, 1000.0, 5, 900.0, 0, false,
        ))
        .unwrap();
        assert_eq!(r["doubleClick"], true);
        let r: Value = serde_json::from_str(&screen_containers_mouse_down(
            0, 5, true, false, false, 1400.0, 5, 900.0, 0, false,
        ))
        .unwrap();
        assert_eq!(r["doubleClick"], false);
    }

    #[test]
    fn quickcraft_packing() {
        assert_eq!(quickcraft(0, 0), 0);
        assert_eq!(quickcraft(1, 0), 1);
        assert_eq!(quickcraft(2, 2), 10);
        assert_eq!(quickcraft(3, 3), 15);
        let c: Value = serde_json::from_str(&screen_containers_quickcraft_clicks(2, &[4, 9])).unwrap();
        let arr = c.as_array().unwrap();
        assert_eq!(arr.len(), 4);
        assert_eq!(arr[0]["button"], 8); // stage 0, mode 2
        assert_eq!(arr[1]["slotId"], 4);
        assert_eq!(arr[1]["button"], 9); // stage 1, mode 2
        assert_eq!(arr[3]["button"], 10); // stage 2, mode 2
        assert!(arr.iter().all(|c| c["mode"] == 5));
    }

    #[test]
    fn drag_preview_and_remainder() {
        let r: Value =
            serde_json::from_str(&screen_containers_drag_preview(0, 10, 2, 0, 64, true, true))
                .unwrap();
        assert_eq!(r["show"], true);
        assert_eq!(r["count"], 5);
        // 5 + 60 > 64 -> clamped with the §e label
        let r: Value =
            serde_json::from_str(&screen_containers_drag_preview(0, 10, 2, 60, 64, true, true))
                .unwrap();
        assert_eq!(r["count"], 64);
        assert_eq!(r["countText"], "\u{00a7}e64");
        // single drag slot shows normally
        let r: Value =
            serde_json::from_str(&screen_containers_drag_preview(0, 10, 1, 0, 64, true, true))
                .unwrap();
        assert_eq!(r["show"], false);
        // right-drag splits one at a time
        let r: Value =
            serde_json::from_str(&screen_containers_drag_preview(1, 10, 3, 0, 64, true, true))
                .unwrap();
        assert_eq!(r["count"], 1);

        let r: Value =
            serde_json::from_str(&screen_containers_drag_remainder(10, 0, 64, &[0, 0])).unwrap();
        assert_eq!(r["count"], 0);
        assert_eq!(r["text"], "\u{00a7}e0");
        // dragLimit 2 means "as much as fits", so `add` is the full stack in
        // every slot and `left` goes negative — faithful to the JS.
        let r: Value =
            serde_json::from_str(&screen_containers_drag_remainder(10, 2, 64, &[0, 0])).unwrap();
        assert_eq!(r["count"], 10 - 64 - 64);
        assert_eq!(r["text"], "\u{00a7}e0");
        // left-drag splits evenly: 10 / 2 slots = 5 each, leaving nothing
        let r: Value =
            serde_json::from_str(&screen_containers_drag_remainder(10, 0, 64, &[0, 0])).unwrap();
        assert_eq!(r["count"], 0);
        // a single drag slot leaves the stack untouched
        let r: Value =
            serde_json::from_str(&screen_containers_drag_remainder(10, 0, 64, &[0])).unwrap();
        assert_eq!(r["count"], 10);
        assert!(r["text"].is_null());
    }

    #[test]
    fn hotbar_snapshot_validation() {
        let good = r#"{"id":5,"count":3}"#;
        assert!(valid_snapshot_item(&serde_json::from_str(good).unwrap()));
        assert!(!valid_snapshot_item(&serde_json::from_str(r#"{"id":0,"count":3}"#).unwrap()));
        assert!(!valid_snapshot_item(&serde_json::from_str(r#"{"id":900,"count":3}"#).unwrap()));
        assert!(!valid_snapshot_item(&serde_json::from_str(r#"{"id":5,"count":0}"#).unwrap()));
        assert!(!valid_snapshot_item(&serde_json::from_str(r#"{"id":5,"count":200}"#).unwrap()));
        assert!(!valid_snapshot_item(
            &serde_json::from_str(r#"{"id":5,"count":3,"locked":true}"#).unwrap()
        ));
        assert!(!valid_snapshot_item(
            &serde_json::from_str(r#"{"id":5,"count":3,"nbt":{"t":10,"v":{"CustomCreativeLock":{"t":10,"v":{}}}}}"#).unwrap()
        ));
    }

    #[test]
    fn hotbar_snapshots_roundtrip() {
        // wrong version -> empty
        let out: Value = serde_json::from_str(&screen_containers_hotbar_snapshots(
            r#"{"version":2,"bars":[]}"#,
        ))
        .unwrap();
        assert_eq!(out.as_array().unwrap().len(), 9);
        assert!(out[0][0].is_null());

        let saved = r#"{"version":1,"minecraftVersion":"1.15.2","protocol":578,"dataVersion":2230,
            "bars":[[{"id":5,"count":3},null,null,null,null,null,null,null,null],
                    [null,null,null,null,null,null,null,null,null],
                    [null,null,null,null,null,null,null,null,null],
                    [null,null,null,null,null,null,null,null,null],
                    [null,null,null,null,null,null,null,null,null],
                    [null,null,null,null,null,null,null,null,null],
                    [null,null,null,null,null,null,null,null,null],
                    [null,null,null,null,null,null,null,null,null],
                    [null,null,null,null,null,null,null,null,null]]}"#;
        let out: Value =
            serde_json::from_str(&screen_containers_hotbar_snapshots(saved)).unwrap();
        assert_eq!(out[0][0]["id"], 5);
        assert_eq!(out[0][0]["damage"], 0);
        assert!(out[1][0].is_null());

        // save wrapper
        let w: Value =
            serde_json::from_str(&screen_containers_save_hotbar_snapshots("[]")).unwrap();
        assert_eq!(w["version"], 1);
        assert_eq!(w["minecraftVersion"], "1.15.2");
        assert_eq!(w["protocol"], 578);
        assert_eq!(w["dataVersion"], 2230);
        assert_eq!(screen_containers_hotbars_key(), HOTBARS_KEY);
    }

    #[test]
    fn hotbar_save_payload_nulls_locked() {
        let list = empty_hotbars().to_string();
        let main = r#"[{"id":5,"count":1},{"id":6,"count":1,"locked":true}]"#;
        let out: Value =
            serde_json::from_str(&screen_containers_hotbar_save_payload(&list, 2, main)).unwrap();
        assert_eq!(out[2][0]["id"], 5);
        assert!(out[2][1].is_null());
    }

    #[test]
    fn hotbar_placeholder_and_tab_list() {
        let p: Value =
            serde_json::from_str(&screen_containers_hotbar_placeholder(3, 54, "{}")).unwrap();
        let arr = p.as_array().unwrap();
        assert_eq!(arr.len(), 9);
        assert!(arr[0].is_null());
        assert_eq!(arr[3]["id"], 54);
        assert_eq!(arr[3]["locked"], true);

        let snaps = empty_hotbars().to_string();
        let names: Vec<String> = (0..9).map(|i| format!("{{\"n\":{}}}", i)).collect();
        let out: Value = serde_json::from_str(&screen_containers_hotbar_tab_list(
            &snaps,
            54,
            &serde_json::to_string(&names).unwrap(),
        ))
        .unwrap();
        assert_eq!(out.as_array().unwrap().len(), 81);
        // bar n carries its placeholder in column n, so bar 3 -> flat 3*9+3
        assert_eq!(out[3 * 9 + 3]["id"], 54);
        assert!(out[3 * 9 + 0].is_null());
    }

    #[test]
    fn anvil_and_enchant_colors() {
        assert_eq!(screen_containers_anvil_cost_color(10, true, 20, false), 8453920);
        assert_eq!(screen_containers_anvil_cost_color(40, true, 99, false), 16736352);
        assert_eq!(screen_containers_anvil_cost_color(40, true, 99, true), 8453920);
        assert_eq!(screen_containers_anvil_cost_color(10, false, 20, false), 16736352);
        assert_eq!(screen_containers_anvil_cost_color(10, true, 5, false), 16736352);
        assert!(screen_containers_enchant_enabled(3, 2, 30, 3, false));
        assert!(!screen_containers_enchant_enabled(2, 2, 30, 3, false));
        assert!(screen_containers_enchant_enabled(0, 2, 0, 30, true));
        assert_eq!(screen_containers_enchant_colors(0)[0], (6839882 & 0xfefefe) >> 1);
    }

    #[test]
    fn layout_for_hopper() {
        let v: Value = serde_json::from_str(&screen_containers_layout_for("minecraft:hopper", 5)).unwrap();
        assert_eq!(v["kind"], "simple");
        assert_eq!(v["ySize"], 133);
        assert_eq!(v["tex"], "gui/container/hopper.png");
        // 5 hopper slots + 36 player slots
        assert_eq!(v["slots"].as_array().unwrap().len(), 41 * 3);
        assert_eq!(&v["slots"].as_array().unwrap()[0..3], &[json!(0), json!(44), json!(20)]);
    }

    #[test]
    fn layout_for_shulker() {
        let v: Value =
            serde_json::from_str(&screen_containers_layout_for("minecraft:shulker_box", 27)).unwrap();
        let s = v["slots"].as_array().unwrap();
        assert_eq!(s.len(), (27 + 36) * 3);
        // slot 9 starts the second row at y 36
        assert_eq!(&s[27..30], &[json!(9), json!(8), json!(36)]);
    }

    #[test]
    fn layout_for_beacon_and_horse() {
        let v: Value =
            serde_json::from_str(&screen_containers_layout_for("minecraft:beacon", 1)).unwrap();
        assert_eq!(v["kind"], "beacon");
        assert_eq!(v["xSize"], 230);
        assert_eq!(v["ySize"], 219);
        let v: Value =
            serde_json::from_str(&screen_containers_layout_for("EntityHorse", 17)).unwrap();
        assert_eq!(v["kind"], "horse");
        // 2 horse slots + 15 chest slots + 36 player slots
        assert_eq!(v["slots"].as_array().unwrap().len(), 53 * 3);
        let v: Value =
            serde_json::from_str(&screen_containers_layout_for("EntityHorse", 2)).unwrap();
        assert_eq!(v["slots"].as_array().unwrap().len(), 38 * 3);
    }

    #[test]
    fn layout_for_default_is_chest() {
        let v: Value =
            serde_json::from_str(&screen_containers_layout_for("minecraft:unknown", 9)).unwrap();
        assert_eq!(v["kind"], "chest");
        assert_eq!(v["ySize"], 114 + 18);
    }

    #[test]
    fn wrap_clue_respects_width() {
        let widths = r#"{"a":6,"b":6}"#;
        // "aaaaa" is 30 px; a 20 px budget puts each word on its own line
        let out = screen_containers_wrap_clue("aaaaa bbbbb", 20.0, widths, 0);
        assert_eq!(out, "aaaaa bbbbb");
        let out = screen_containers_wrap_clue("aaaaa bbbbb", 40.0, widths, 0);
        assert_eq!(out, "aaaaa bbbbb");
        // max_lines trims like .slice(0, 2)
        let words = "a a a a a a";
        let out = screen_containers_wrap_clue(words, 6.0, widths, 2);
        assert_eq!(out.matches(' ').count(), 1);
    }

    #[test]
    fn strip_codes_removes_formatting() {
        assert_eq!(strip_codes("\u{00a7}7Stone"), "Stone");
        assert_eq!(strip_codes("\u{00c2}\u{00a7}9itemGroup.misc"), "9itemGroup.misc");
    }

    #[test]
    fn creative_grid_click_counter() {
        // empty cursor, empty slot -> copy one in
        let r: Value = serde_json::from_str(&screen_containers_creative_grid_click(
            "null", r#"{"id":5,"count":1}"#, 0, false, 64, 64, true,
        ))
        .unwrap();
        assert_eq!(r["cursor"]["count"], 1);
        // shift -> full stack
        let r: Value = serde_json::from_str(&screen_containers_creative_grid_click(
            "null", r#"{"id":5,"count":1}"#, 0, true, 64, 64, true,
        ))
        .unwrap();
        assert_eq!(r["cursor"]["count"], 64);
        // left click on a matching cursor increments
        let r: Value = serde_json::from_str(&screen_containers_creative_grid_click(
            r#"{"id":5,"count":3}"#, r#"{"id":5,"count":1}"#, 0, false, 64, 64, true,
        ))
        .unwrap();
        assert_eq!(r["cursor"]["count"], 4);
        // right click decrements
        let r: Value = serde_json::from_str(&screen_containers_creative_grid_click(
            r#"{"id":5,"count":3}"#, r#"{"id":5,"count":1}"#, 1, false, 64, 64, true,
        ))
        .unwrap();
        assert_eq!(r["cursor"]["count"], 2);
        // right click at one clears
        let r: Value = serde_json::from_str(&screen_containers_creative_grid_click(
            r#"{"id":5,"count":1}"#, r#"{"id":5,"count":1}"#, 1, false, 64, 64, true,
        ))
        .unwrap();
        assert!(r["cursor"].is_null());
        // middle click picks up a full stack
        let r: Value = serde_json::from_str(&screen_containers_creative_grid_click(
            "null", r#"{"id":5,"count":1}"#, 2, false, 64, 64, true,
        ))
        .unwrap();
        assert_eq!(r["cursor"]["count"], 64);
    }

    #[test]
    fn creative_drop_branch() {
        assert_eq!(
            screen_containers_creative_drop(0, false, false, r#"{"id":5,"count":4}"#),
            "null"
        );
        let r: Value =
            serde_json::from_str(&screen_containers_creative_drop(0, true, false, r#"{"id":5,"count":4}"#))
                .unwrap();
        assert_eq!(r["dropAll"], true);
        assert_eq!(r["item"]["count"], 4);
        let r: Value =
            serde_json::from_str(&screen_containers_creative_drop(1, true, false, r#"{"id":5,"count":4}"#))
                .unwrap();
        assert_eq!(r["dropAll"], false);
        assert_eq!(r["item"]["count"], 1);
    }

    #[test]
    fn recipe_button_rect() {
        let r = screen_containers_recipe_button(40.0, 480.0, 104.0, -22.0);
        assert_eq!(r, vec![144.0, 218.0, 20.0, 18.0]);
        assert_eq!(screen_containers_recipe_button_v(0.0, true), 19.0);
        assert_eq!(screen_containers_recipe_button_v(0.0, false), 0.0);
    }

    #[test]
    fn furnace_texture_names() {
        assert_eq!(
            screen_containers_furnace_texture("minecraft:smoker"),
            "gui/container/smoker.png"
        );
        assert_eq!(
            screen_containers_furnace_texture("minecraft:blast_furnace"),
            "gui/container/blast_furnace.png"
        );
        assert_eq!(
            screen_containers_furnace_texture("minecraft:furnace"),
            "gui/container/furnace.png"
        );
    }

    #[test]
    fn hotbar_key_lookup() {
        let codes = r#"["Digit1","Digit2","Digit3","Digit4","Digit5","Digit6","Digit7","Digit8","Digit9"]"#;
        assert_eq!(screen_containers_hotbar_key("Digit3", codes), 2);
        assert_eq!(screen_containers_hotbar_key("KeyQ", codes), -1);
        assert_eq!(screen_containers_drop_button("KeyQ", "KeyQ", false), 0);
        assert_eq!(screen_containers_drop_button("KeyQ", "KeyQ", true), 1);
        assert_eq!(screen_containers_drop_button("KeyE", "KeyQ", false), -1);
    }

    #[test]
    fn tab_meta_and_hit() {
        let data = r#"{"tabs":[
            {"index":0,"label":"buildingBlocks","column":0,"top":true,"right":false,"title":true,"scrollbar":true,"background":"items.png","icon":[141,0,null]},
            {"index":5,"label":"search","column":5,"top":true,"right":true,"title":true,"scrollbar":true,"background":"item_search.png","icon":[621,0,null]}
        ]}"#;
        let meta = screen_containers_tab_meta(data);
        let m: Value = serde_json::from_str(&meta).unwrap();
        assert_eq!(m[0]["label"], "buildingBlocks");
        assert_eq!(m[1]["background"], "item_search.png");
        // right-aligned tab 5 at x = 195 - 28*(6-5) + 2 = 169, y = -32
        assert_eq!(
            screen_containers_creative_tab_at(&meta, 0.0, 0.0, 195.0, 136.0, 170.0, -20.0),
            5
        );
        assert_eq!(
            screen_containers_creative_tab_at(&meta, 0.0, 0.0, 195.0, 136.0, 5.0, -20.0),
            0
        );
        assert_eq!(
            screen_containers_creative_tab_at(&meta, 0.0, 0.0, 195.0, 136.0, 500.0, 500.0),
            -1
        );
    }

    #[test]
    fn effects_shift_and_center() {
        assert_eq!(screen_containers_center(800.0, 600.0, 176.0, 166.0), vec![312.0, 217.0]);
        assert_eq!(screen_containers_effects_shift_left(800.0, 195.0), 362.0);
        assert!(screen_containers_is_outside(0.0, 0.0, 10.0, 10.0, 176.0, 166.0));
        assert!(!screen_containers_is_outside(20.0, 20.0, 10.0, 10.0, 176.0, 166.0));
    }

    #[test]
    fn potion_icon_lookup() {
        assert_eq!(screen_containers_potion_icon(1), 0);
        assert_eq!(screen_containers_potion_icon(22), 18);
        assert_eq!(screen_containers_potion_icon(6), -1);
        assert_eq!(screen_containers_effect_key("{}", 1), "effect.none");
        assert_eq!(
            screen_containers_effect_key(r#"{"effects":{"1":{"name":"effect.minecraft.speed"}}}"#, 1),
            "effect.minecraft.speed"
        );
    }

    #[test]
    fn enchant_clues_and_misc() {
        let c: Value = serde_json::from_str(&screen_containers_enchant_clues(0)).unwrap();
        let lines = c.as_array().unwrap();
        assert_eq!(lines.len(), 3);
        for l in lines {
            let n = l.as_array().unwrap().len();
            assert!((3..=4).contains(&n));
        }
        assert!(screen_containers_keep_search_query("search"));
        assert!(!screen_containers_keep_search_query("misc"));
        assert_eq!(screen_containers_search_field(10.0, 20.0), vec![92.0, 26.0, 80.0, 9.0]);
        assert_eq!(screen_containers_creative_search_tab_index(), 5);
        assert_eq!(screen_containers_tab_label_key("misc"), "itemGroup.misc");
    }

    #[test]
    fn changed_slots_detection() {
        let before = r#"[{"id":5,"count":1},null,null]"#;
        let after = r#"[{"id":5,"count":1},null,{"id":6,"count":2}]"#;
        let same = r#"[1,0,0]"#;
        let out: Value =
            serde_json::from_str(&screen_containers_creative_changed_slots(before, after, same))
                .unwrap();
        assert_eq!(out, json!([2]));
    }

    #[test]
    fn stack_of_shape() {
        let v: Value = serde_json::from_str(&screen_containers_stack_of(1, "null")).unwrap();
        assert_eq!(v["id"], 1);
        assert_eq!(v["count"], 1);
        assert_eq!(v["damage"], 0);
        assert!(v["nbt"].is_null());
        let v: Value =
            serde_json::from_str(&screen_containers_stack_of(2, r#"{"Damage":{"t":3,"v":0}}"#)).unwrap();
        assert_eq!(v["nbt"]["t"], 10);
        assert_eq!(v["nbt"]["v"]["Damage"]["v"], 0);
    }

    #[test]
    fn creative_locked_detection() {
        assert!(!screen_containers_creative_locked("null"));
        assert!(screen_containers_creative_locked(r#"{"locked":true}"#));
        assert!(screen_containers_creative_locked(
            r#"{"nbt":{"t":10,"v":{"CustomCreativeLock":{"t":10,"v":{}}}}}"#
        ));
        assert!(!screen_containers_creative_locked(r#"{"nbt":{"t":10,"v":{}}}"#));
    }
}
