//! Port of the pure algorithmic helpers from `client/js/audio/sound.js`.
//!
//! The previous draft in this file invented a `SoundState`/volume-fade API that
//! sound.js does not have (sound.js never fades and has no paused state); that
//! content was fabricated and has been removed. What lives here now is every
//! self-contained algorithm the sound engine uses:
//!
//! - the `Math.random` source abstraction,
//! - `soundAssetName` (1.13.2 protocol name -> flattened asset name, with the
//!   alias tables),
//! - `CATEGORY_OF` and the hostile type set,
//! - the `RenderGlobal.playEvent` / `broadcastSound` event tables with their
//!   random pitch distributions,
//! - the exact volume / pitch / max-distance formulas applied to platform
//!   voices,
//! - the cave-mood LCG step and position extraction.
//!
//! The AudioContext/GainNode/PannerNode operations themselves are
//! browser-bound and stay behind the `SoundAudio` contract in `sound.rs`.

use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------- RNG source

/// JS: `Math.random` — injected so ports and tests can pin the draw sequence.
pub trait RandomSource {
    /// One uniform draw in [0, 1) — JS: `Math.random()`.
    fn random(&mut self) -> f64;
}

/// Default [`RandomSource`] backed by `fastrand` (the Math.random stand-in).
pub struct SystemRandom {
    rng: fastrand::Rng,
}

impl SystemRandom {
    pub fn new() -> Self {
        Self { rng: fastrand::Rng::new() }
    }

    pub fn with_seed(seed: u64) -> Self {
        Self { rng: fastrand::Rng::with_seed(seed) }
    }
}

impl Default for SystemRandom {
    fn default() -> Self {
        Self::new()
    }
}

impl RandomSource for SystemRandom {
    fn random(&mut self) -> f64 {
        self.rng.f64()
    }
}

/// Test helper: replays a pinned draw sequence (extra draws read 0.0).
pub struct SeqRandom {
    values: Vec<f64>,
    index: usize,
}

impl SeqRandom {
    pub fn new(values: &[f64]) -> Self {
        Self { values: values.to_vec(), index: 0 }
    }
}

impl RandomSource for SeqRandom {
    fn random(&mut self) -> f64 {
        let v = self.values.get(self.index).copied().unwrap_or(0.0);
        self.index += 1;
        v
    }
}

// ------------------------------------------------------- soundAssetName

// JS: const SOUND_EVENT_PREFIX_ALIASES = [ ... ] — pre-flattening protocol names
// mapped onto the flattened resource-pack asset names (1.13.2 registry vs pack).
pub const SOUND_EVENT_PREFIX_ALIASES: [(&str, &str); 35] = [
    ("block.cloth.", "block.wool."),
    ("block.enderchest.", "block.ender_chest."),
    ("block.metal_pressureplate.", "block.metal_pressure_plate."),
    ("block.note.", "block.note_block."),
    ("block.slime.", "block.slime_block."),
    ("block.stone_pressureplate.", "block.stone_pressure_plate."),
    ("block.waterlily.", "block.lily_pad."),
    ("block.wood_button.", "block.wooden_button."),
    ("block.wood_pressureplate.", "block.wooden_pressure_plate."),
    ("entity.armorstand.", "entity.armor_stand."),
    ("entity.bobber.", "entity.fishing_bobber."),
    ("entity.enderdragon_fireball.", "entity.dragon_fireball."),
    ("entity.enderdragon.", "entity.ender_dragon."),
    ("entity.endereye.", "entity.ender_eye."),
    ("entity.endermen.", "entity.enderman."),
    ("entity.enderpearl.", "entity.ender_pearl."),
    ("entity.evocation_fangs.", "entity.evoker_fangs."),
    ("entity.evocation_illager.", "entity.evoker."),
    ("entity.firework.", "entity.firework_rocket."),
    ("entity.illusion_illager.", "entity.illusioner."),
    ("entity.irongolem.", "entity.iron_golem."),
    ("entity.itemframe.", "entity.item_frame."),
    ("entity.leashknot.", "entity.leash_knot."),
    ("entity.lightning.", "entity.lightning_bolt."),
    ("entity.lingeringpotion.", "entity.lingering_potion."),
    ("entity.magmacube.", "entity.magma_cube."),
    ("entity.parrot.imitate.enderdragon", "entity.parrot.imitate.ender_dragon"),
    ("entity.parrot.imitate.evocation_illager", "entity.parrot.imitate.evoker"),
    ("entity.parrot.imitate.illusion_illager", "entity.parrot.imitate.illusioner"),
    ("entity.parrot.imitate.magmacube", "entity.parrot.imitate.magma_cube"),
    ("entity.parrot.imitate.vindication_illager", "entity.parrot.imitate.vindicator"),
    ("entity.snowman.", "entity.snow_golem."),
    ("entity.vindication_illager.", "entity.vindicator."),
    ("entity.zombie_pig.", "entity.zombie_pigman."),
    ("record.", "music_disc."),
];

/// JS: `SOUND_EVENT_ALIASES.get(name)` — whole-name aliases.
pub fn sound_event_alias(name: &str) -> Option<&'static str> {
    // JS: const SOUND_EVENT_ALIASES = new Map([
    //   ['entity.polar_bear.baby_ambient', 'entity.polar_bear.ambient_baby'],
    //   ['entity.villager.trading', 'entity.villager.trade'],
    //   ['entity.zombie.attack_door_wood', 'entity.zombie.attack_wooden_door'],
    //   ['entity.zombie.break_door_wood', 'entity.zombie.break_wooden_door'],
    // ]);
    Some(match name {
        "entity.polar_bear.baby_ambient" => "entity.polar_bear.ambient_baby",
        "entity.villager.trading" => "entity.villager.trade",
        "entity.zombie.attack_door_wood" => "entity.zombie.attack_wooden_door",
        "entity.zombie.break_door_wood" => "entity.zombie.break_wooden_door",
        _ => return None,
    })
}

/// JS: `soundAssetName(name)` — map a (possibly namespaced, possibly
/// pre-flattening) sound event name onto the resource-pack asset name.
pub fn sound_asset_name(name: &str) -> String {
    // JS: let n = String(name || '').replace(/^minecraft:/, '');
    let mut n = name.strip_prefix("minecraft:").unwrap_or(name).to_string();
    // JS: if (SOUND_EVENT_ALIASES.has(n)) return SOUND_EVENT_ALIASES.get(n);
    if let Some(mapped) = sound_event_alias(&n) {
        return mapped.to_string();
    }
    // JS: const small = n.match(/^entity\.(small_(?:slime|magmacube))\.(death|hurt|jump|squish)$/);
    // JS: if (small) return `entity.${small[1] === 'small_slime' ? 'slime' : 'magma_cube'}.${small[2]}_small`;
    for (prefix, entity) in [("entity.small_slime.", "slime"), ("entity.small_magmacube.", "magma_cube")] {
        if let Some(rest) = n.strip_prefix(prefix) {
            if matches!(rest, "death" | "hurt" | "jump" | "squish") {
                return format!("entity.{}.{}_small", entity, rest);
            }
        }
    }
    // JS: for (const [from, to] of SOUND_EVENT_PREFIX_ALIASES) if (n.startsWith(from)) return to + n.slice(from.length);
    for (from, to) in SOUND_EVENT_PREFIX_ALIASES {
        if let Some(rest) = n.strip_prefix(from) {
            return format!("{}{}", to, rest);
        }
    }
    n
}

// --------------------------------------------------------- CATEGORY_OF

/// JS: the alternation inside `/^entity\.(zombie|husk|...|drowned)/` of
/// `CATEGORY_OF`, in source order (plain prefixes — the regex has no boundary).
const HOSTILE_PREFIXES: [&str; 30] = [
    "zombie",
    "husk",
    "skeleton",
    "stray",
    "wither",
    "spider",
    "creeper",
    "blaze",
    "ghast",
    "enderman",
    "endermite",
    "slime",
    "small_slime",
    "magma_cube",
    "small_magma_cube",
    "silverfish",
    "witch",
    "ender_dragon",
    "guardian",
    "elder_guardian",
    "shulker",
    "vex",
    "evoker",
    "vindicator",
    "illusioner",
    "zombie_pigman",
    "zombie_villager",
    "hostile",
    "phantom",
    "drowned",
];

/// JS: `CATEGORY_OF(name)` — category for client-played sounds without one,
/// derived from the event name.
pub fn category_of(name: &str) -> &'static str {
    if name.starts_with("music.") {
        return "music";
    }
    if name.starts_with("record.") {
        return "record";
    }
    if name.starts_with("weather.") {
        return "weather";
    }
    if name.starts_with("block.") {
        return "block";
    }
    if name.starts_with("entity.player.") {
        return "player";
    }
    // JS: if (/^entity\.(zombie|husk|skeleton|...|drowned)/.test(name)) return 'hostile';
    if let Some(rest) = name.strip_prefix("entity.") {
        if HOSTILE_PREFIXES.iter().any(|p| rest.starts_with(p)) {
            return "hostile";
        }
    }
    if name.starts_with("entity.") {
        return "neutral";
    }
    if name.starts_with("ambient.") {
        return "ambient";
    }
    "master"
}

/// JS: `HOSTILE_TYPES.has(e.entityName)` — the Entity.getSoundCategory 'hostile'
/// set (1.13-era names, including pre-flattening `zombie_pigman`).
pub fn is_hostile_type(name: &str) -> bool {
    matches!(
        name,
        "elder_guardian"
            | "wither_skeleton"
            | "stray"
            | "husk"
            | "zombie_villager"
            | "evoker"
            | "vex"
            | "vindicator"
            | "illusioner"
            | "creeper"
            | "skeleton"
            | "spider"
            | "giant"
            | "zombie"
            | "slime"
            | "ghast"
            | "zombie_pigman"
            | "enderman"
            | "cave_spider"
            | "silverfish"
            | "blaze"
            | "magma_cube"
            | "ender_dragon"
            | "wither"
            | "witch"
            | "endermite"
            | "guardian"
            | "shulker"
            | "drowned"
            | "phantom"
    )
}

// ------------------------------------------------- EVENT_SOUNDS / broadcast

/// JS: the pitch closure of an `EVENT_SOUNDS` entry.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EventPitch {
    /// JS: `() => 1`
    FixedOne,
    /// JS: `() => 1.2`
    FixedOnePointTwo,
    /// JS: `() => r() * 0.1 + 0.9`
    DoorCreak,
    /// JS: `() => 2.6 + (r() - r()) * 0.8`
    FireExtinguish,
    /// JS: `() => (r() - r()) * 0.2 + 1`
    Standard,
}

impl EventPitch {
    /// JS: call the entry's pitch closure — consumes exactly as many
    /// Math.random() draws as the JS closure does (0, 1 or 2).
    pub fn sample(&self, rng: &mut dyn RandomSource) -> f64 {
        match self {
            EventPitch::FixedOne => 1.0,
            EventPitch::FixedOnePointTwo => 1.2,
            EventPitch::DoorCreak => rng.random() * 0.1 + 0.9,
            EventPitch::FireExtinguish => 2.6 + (rng.random() - rng.random()) * 0.8,
            EventPitch::Standard => (rng.random() - rng.random()) * 0.2 + 1.0,
        }
    }

    /// Discriminant for wasm consumers (same order as the enum above).
    pub fn kind(&self) -> u8 {
        match self {
            EventPitch::FixedOne => 0,
            EventPitch::FixedOnePointTwo => 1,
            EventPitch::DoorCreak => 2,
            EventPitch::FireExtinguish => 3,
            EventPitch::Standard => 4,
        }
    }
}

/// JS: one `EVENT_SOUNDS` entry — `[event, volume, pitch(rand)]`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EventSound {
    pub event: &'static str,
    pub volume: f64,
    pub pitch: EventPitch,
}

/// JS: `EVENT_SOUNDS` — RenderGlobal.playEvent sounds: id -> [event, volume, pitch(rand)].
pub fn event_sound(id: i32) -> Option<EventSound> {
    let std_pitch = EventPitch::Standard;
    Some(match id {
        1000 => EventSound { event: "block.dispenser.dispense", volume: 1.0, pitch: EventPitch::FixedOne },
        1001 => EventSound { event: "block.dispenser.fail", volume: 1.0, pitch: EventPitch::FixedOnePointTwo },
        1002 => EventSound { event: "block.dispenser.launch", volume: 1.0, pitch: EventPitch::FixedOnePointTwo },
        1003 => EventSound { event: "entity.endereye.launch", volume: 1.0, pitch: EventPitch::FixedOnePointTwo },
        1004 => EventSound { event: "entity.firework.shoot", volume: 1.0, pitch: EventPitch::FixedOnePointTwo },
        1005 => EventSound { event: "block.iron_door.open", volume: 1.0, pitch: EventPitch::DoorCreak },
        1006 => EventSound { event: "block.wooden_door.open", volume: 1.0, pitch: EventPitch::DoorCreak },
        1007 => EventSound { event: "block.wooden_trapdoor.open", volume: 1.0, pitch: EventPitch::DoorCreak },
        1008 => EventSound { event: "block.fence_gate.open", volume: 1.0, pitch: EventPitch::DoorCreak },
        1009 => EventSound { event: "block.fire.extinguish", volume: 0.5, pitch: EventPitch::FireExtinguish },
        1011 => EventSound { event: "block.iron_door.close", volume: 1.0, pitch: EventPitch::DoorCreak },
        1012 => EventSound { event: "block.wooden_door.close", volume: 1.0, pitch: EventPitch::DoorCreak },
        1013 => EventSound { event: "block.wooden_trapdoor.close", volume: 1.0, pitch: EventPitch::DoorCreak },
        1014 => EventSound { event: "block.fence_gate.close", volume: 1.0, pitch: EventPitch::DoorCreak },
        1015 => EventSound { event: "entity.ghast.warn", volume: 10.0, pitch: std_pitch },
        1016 => EventSound { event: "entity.ghast.shoot", volume: 10.0, pitch: std_pitch },
        1017 => EventSound { event: "entity.enderdragon.shoot", volume: 10.0, pitch: std_pitch },
        1018 => EventSound { event: "entity.blaze.shoot", volume: 2.0, pitch: std_pitch },
        1019 => EventSound { event: "entity.zombie.attack_door_wood", volume: 2.0, pitch: std_pitch },
        1020 => EventSound { event: "entity.zombie.attack_iron_door", volume: 2.0, pitch: std_pitch },
        1021 => EventSound { event: "entity.zombie.break_door_wood", volume: 2.0, pitch: std_pitch },
        1022 => EventSound { event: "entity.wither.break_block", volume: 2.0, pitch: std_pitch },
        1024 => EventSound { event: "entity.wither.shoot", volume: 2.0, pitch: std_pitch },
        1025 => EventSound { event: "entity.bat.takeoff", volume: 0.05, pitch: std_pitch },
        1026 => EventSound { event: "entity.zombie.infect", volume: 2.0, pitch: std_pitch },
        1027 => EventSound { event: "entity.zombie_villager.converted", volume: 2.0, pitch: std_pitch },
        1029 => EventSound { event: "block.anvil.destroy", volume: 1.0, pitch: EventPitch::DoorCreak },
        1030 => EventSound { event: "block.anvil.use", volume: 1.0, pitch: EventPitch::DoorCreak },
        1031 => EventSound { event: "block.anvil.land", volume: 0.3, pitch: EventPitch::DoorCreak },
        1033 => EventSound { event: "block.chorus_flower.grow", volume: 1.0, pitch: EventPitch::FixedOne },
        1034 => EventSound { event: "block.chorus_flower.death", volume: 1.0, pitch: EventPitch::FixedOne },
        1035 => EventSound { event: "block.brewing_stand.brew", volume: 1.0, pitch: EventPitch::FixedOne },
        1036 => EventSound { event: "block.iron_trapdoor.close", volume: 1.0, pitch: EventPitch::DoorCreak },
        1037 => EventSound { event: "block.iron_trapdoor.open", volume: 1.0, pitch: EventPitch::DoorCreak },
        2002 => EventSound { event: "entity.splash_potion.break", volume: 1.0, pitch: EventPitch::DoorCreak },
        2007 => EventSound { event: "entity.splash_potion.break", volume: 1.0, pitch: EventPitch::DoorCreak },
        _ => return None,
    })
}

/// JS: `GLOBAL_EVENTS` — RenderGlobal.broadcastSound (heard from anywhere).
pub fn global_event_sound(id: i32) -> Option<&'static str> {
    Some(match id {
        1023 => "entity.wither.spawn",
        1028 => "entity.enderdragon.death",
        1038 => "block.end_portal.spawn",
        _ => return None,
    })
}

// --------------------------------------------------- voice parameter math

/// JS: `volume: Math.min(1, volume) * def.volume * catVol` — the final gain of a
/// one-shot voice. NaN propagates like JS Math.min (the Rust f64::min would
/// silently swallow it).
pub fn voice_volume(volume: f64, def_volume: f64, category_volume: f64) -> f64 {
    let clamped = if volume.is_nan() { f64::NAN } else { volume.min(1.0) };
    clamped * def_volume * category_volume
}

/// JS: `Math.max(0.5, Math.min(2, pitch * def.pitch))` — pitch clamped to [0.5, 2].
pub fn clamp_pitch(pitch: f64) -> f64 {
    if pitch.is_nan() {
        // JS: Math.min(2, NaN) is NaN and Math.max(0.5, NaN) is NaN.
        return f64::NAN;
    }
    pitch.max(0.5).min(2.0)
}

/// JS: `maxDistance: Math.max(16, volume * 16)` — the PannerNode reference
/// distance derived from the requested volume (WebAudio's inverse attenuation
/// curve itself is browser-bound).
pub fn max_distance(volume: f64) -> f64 {
    if (volume * 16.0).is_nan() {
        // JS: Math.max(16, NaN) is NaN.
        return f64::NAN;
    }
    (volume * 16.0).max(16.0)
}

// ------------------------------------------------------------- mood tick

/// JS: `this.lcg = (Math.imul(this.lcg, 3) + 1013904223) | 0;` — the cave-mood
/// LCG step (wrapping 32-bit multiply-add).
pub fn mood_lcg_next(lcg: i32) -> i32 {
    lcg.wrapping_mul(3).wrapping_add(1013904223)
}

/// JS: `const i = this.lcg >> 2;` and
/// `const x = (cx << 4) + (i & 15), z = (cz << 4) + ((i >> 8) & 15), y = (i >> 16) & 255;`
/// Returns `[x, y, z]` (JS declares x, z, y in that order).
pub fn mood_position(i: i32, cx: i32, cz: i32) -> [i32; 3] {
    let x = cx.wrapping_shl(4).wrapping_add(i & 15);
    let z = cz.wrapping_shl(4).wrapping_add((i >> 8) & 15);
    let y = (i >> 16) & 255;
    [x, y, z]
}

// -------------------------------------------------------------- exports

/// JS: `export { soundAssetName, soundTypeOf }` (soundAssetName half, for wasm).
#[wasm_bindgen]
pub fn js_sound_asset_name(name: String) -> String {
    sound_asset_name(&name)
}

/// JS: `CATEGORY_OF` (internal in JS, exported here for wasm glue).
#[wasm_bindgen]
pub fn js_category_of(name: String) -> String {
    category_of(&name).to_string()
}

/// JS: `HOSTILE_TYPES.has(name)` (internal in JS, exported here for wasm glue).
#[wasm_bindgen]
pub fn js_is_hostile_type(name: String) -> bool {
    is_hostile_type(&name)
}

/// JS: `GLOBAL_EVENTS[effectId]` (internal in JS, exported here for wasm glue).
#[wasm_bindgen]
pub fn js_global_event_sound(id: i32) -> Option<String> {
    global_event_sound(id).map(str::to_string)
}

/// JS: an `EVENT_SOUNDS` entry for wasm consumers. `pitch_kind`:
/// 0 = `() => 1`, 1 = `() => 1.2`, 2 = `r()*0.1+0.9`, 3 = `2.6+(r-r)*0.8`,
/// 4 = `(r-r)*0.2+1`.
#[wasm_bindgen(getter_with_clone)]
pub struct EventSoundInfo {
    pub found: bool,
    pub event: String,
    pub volume: f64,
    pub pitch_kind: u8,
}

/// JS: `EVENT_SOUNDS[effectId]` (internal in JS, exported here for wasm glue).
#[wasm_bindgen]
pub fn js_event_sound(id: i32) -> EventSoundInfo {
    match event_sound(id) {
        Some(e) => EventSoundInfo { found: true, event: e.event.to_string(), volume: e.volume, pitch_kind: e.pitch.kind() },
        None => EventSoundInfo { found: false, event: String::new(), volume: 0.0, pitch_kind: 0 },
    }
}

#[wasm_bindgen]
pub fn js_max_distance(volume: f64) -> f64 {
    max_distance(volume)
}

#[wasm_bindgen]
pub fn js_clamp_pitch(pitch: f64) -> f64 {
    clamp_pitch(pitch)
}

#[wasm_bindgen]
pub fn js_voice_volume(volume: f64, def_volume: f64, category_volume: f64) -> f64 {
    voice_volume(volume, def_volume, category_volume)
}

#[wasm_bindgen]
pub fn js_mood_lcg_next(lcg: i32) -> i32 {
    mood_lcg_next(lcg)
}

// ---------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sound_asset_name_strips_namespace() {
        assert_eq!(sound_asset_name("minecraft:block.stone.break"), "block.stone.break");
        assert_eq!(sound_asset_name("block.stone.break"), "block.stone.break");
    }

    #[test]
    fn sound_asset_name_maps_exact_aliases() {
        assert_eq!(sound_asset_name("entity.polar_bear.baby_ambient"), "entity.polar_bear.ambient_baby");
        assert_eq!(sound_asset_name("entity.villager.trading"), "entity.villager.trade");
        assert_eq!(sound_asset_name("entity.zombie.attack_door_wood"), "entity.zombie.attack_wooden_door");
        assert_eq!(sound_asset_name("entity.zombie.break_door_wood"), "entity.zombie.break_wooden_door");
    }

    #[test]
    fn sound_asset_name_maps_small_slime_and_magmacube() {
        // JS: entity.small_slime.<death|hurt|jump|squish> -> entity.slime.<x>_small
        assert_eq!(sound_asset_name("entity.small_slime.squish"), "entity.slime.squish_small");
        assert_eq!(sound_asset_name("entity.small_magmacube.hurt"), "entity.magma_cube.hurt_small");
        // Suffixes outside the regex keep the original name.
        assert_eq!(sound_asset_name("entity.small_slime.ambient"), "entity.small_slime.ambient");
    }

    #[test]
    fn sound_asset_name_maps_prefix_aliases_in_order() {
        assert_eq!(sound_asset_name("block.note.harp"), "block.note_block.harp");
        assert_eq!(sound_asset_name("block.cloth.break"), "block.wool.break");
        assert_eq!(sound_asset_name("entity.magmacube.hurt"), "entity.magma_cube.hurt");
        assert_eq!(sound_asset_name("entity.enderdragon.death"), "entity.ender_dragon.death");
        assert_eq!(sound_asset_name("record.13"), "music_disc.13");
        assert_eq!(sound_asset_name("entity.parrot.imitate.magmacube"), "entity.parrot.imitate.magma_cube");
        // The exact-name parrot aliases do not catch other parrot imitations.
        assert_eq!(sound_asset_name("entity.parrot.imitate.slime"), "entity.parrot.imitate.slime");
    }

    #[test]
    fn category_of_matches_the_js_chain() {
        assert_eq!(category_of("music.game"), "music");
        assert_eq!(category_of("record.11"), "record");
        assert_eq!(category_of("weather.rain.above"), "weather");
        assert_eq!(category_of("block.stone.break"), "block");
        assert_eq!(category_of("entity.player.hurt"), "player");
        assert_eq!(category_of("entity.zombie.ambient"), "hostile");
        // The regex has no boundary after the alternatives: "zombie_pig..." matches "zombie".
        assert_eq!(category_of("entity.zombie_pigman.ambient"), "hostile");
        assert_eq!(category_of("entity.small_slime.squish"), "hostile");
        assert_eq!(category_of("entity.cow.ambient"), "neutral");
        assert_eq!(category_of("ambient.cave"), "ambient");
        assert_eq!(category_of("ui.button.click"), "master");
    }

    #[test]
    fn hostile_types_match_the_js_set() {
        assert!(is_hostile_type("creeper"));
        assert!(is_hostile_type("zombie_pigman"));
        assert!(is_hostile_type("phantom"));
        assert!(!is_hostile_type("cow"));
        assert!(!is_hostile_type("armor_stand"));
    }

    #[test]
    fn event_sound_table_values() {
        let e = event_sound(1009).expect("1009 present");
        assert_eq!(e.event, "block.fire.extinguish");
        assert_eq!(e.volume, 0.5);
        assert_eq!(e.pitch, EventPitch::FireExtinguish);

        let e = event_sound(1015).expect("1015 present");
        assert_eq!(e.event, "entity.ghast.warn");
        assert_eq!(e.volume, 10.0);
        assert_eq!(e.pitch, EventPitch::Standard);

        let e = event_sound(2007).expect("2007 present");
        assert_eq!(e.event, "entity.splash_potion.break");
        assert_eq!(e.pitch, EventPitch::DoorCreak);

        assert_eq!(event_sound(1000).unwrap().pitch, EventPitch::FixedOne);
        assert_eq!(event_sound(1001).unwrap().pitch, EventPitch::FixedOnePointTwo);
        // Handled by special cases / global events / playRecord, not this table:
        assert_eq!(event_sound(1010), None);
        assert_eq!(event_sound(1032), None);
        assert_eq!(event_sound(1038), None);
        assert_eq!(event_sound(1023), None);
        assert_eq!(event_sound(1028), None);
        assert_eq!(event_sound(999), None);
    }

    #[test]
    fn global_event_sound_values() {
        assert_eq!(global_event_sound(1023), Some("entity.wither.spawn"));
        assert_eq!(global_event_sound(1028), Some("entity.enderdragon.death"));
        assert_eq!(global_event_sound(1038), Some("block.end_portal.spawn"));
        assert_eq!(global_event_sound(1027), None);
    }

    #[test]
    fn event_pitch_draw_counts_match_the_js_closures() {
        // A counting rng proves fixed variants draw 0, DoorCreak 1, the rest 2.
        struct Counting(usize);
        impl RandomSource for Counting {
            fn random(&mut self) -> f64 {
                self.0 += 1;
                0.5
            }
        }
        let mut rng = Counting(0);
        assert_eq!(EventPitch::FixedOne.sample(&mut rng), 1.0);
        assert_eq!(rng.0, 0);
        assert_eq!(EventPitch::FixedOnePointTwo.sample(&mut rng), 1.2);
        assert_eq!(rng.0, 0);
        assert_eq!(EventPitch::DoorCreak.sample(&mut rng), 0.5 * 0.1 + 0.9);
        assert_eq!(rng.0, 1);
        // (0.5 - 0.5) * 0.8 + 2.6
        assert_eq!(EventPitch::FireExtinguish.sample(&mut rng), 2.6);
        assert_eq!(rng.0, 3);
        // (0.5 - 0.5) * 0.2 + 1
        assert_eq!(EventPitch::Standard.sample(&mut rng), 1.0);
        assert_eq!(rng.0, 5);
    }

    #[test]
    fn event_pitch_hand_checked_samples() {
        let mut rng = SeqRandom::new(&[0.7, 0.2]);
        // JS: (0.7 - 0.2) * 0.2 + 1
        assert!((EventPitch::Standard.sample(&mut rng) - 1.1).abs() < 1e-12);
        let mut rng = SeqRandom::new(&[1.0, 0.0]);
        // JS: 2.6 + (1.0 - 0.0) * 0.8 (f64: 3.4000000000000004)
        assert!((EventPitch::FireExtinguish.sample(&mut rng) - 3.4).abs() < 1e-12);
        let mut rng = SeqRandom::new(&[0.5]);
        // JS: 0.5 * 0.1 + 0.9
        assert!((EventPitch::DoorCreak.sample(&mut rng) - 0.95).abs() < 1e-12);
    }

    #[test]
    fn voice_formulas_hand_checked() {
        // JS: Math.min(1, volume) * def.volume * catVol
        assert_eq!(voice_volume(2.0, 0.8, 0.5), 0.4);
        assert_eq!(voice_volume(0.25, 1.0, 1.0), 0.25);
        assert_eq!(voice_volume(1.0, 1.0, 1.0), 1.0);
        // JS: Math.max(0.5, Math.min(2, pitch))
        assert_eq!(clamp_pitch(0.1), 0.5);
        assert_eq!(clamp_pitch(1.5), 1.5);
        assert_eq!(clamp_pitch(3.0), 2.0);
        // JS: Math.max(16, volume * 16)
        assert_eq!(max_distance(1.0), 16.0);
        assert_eq!(max_distance(0.25), 16.0);
        assert_eq!(max_distance(2.0), 32.0);
    }

    #[test]
    fn mood_lcg_step_hand_checked() {
        assert_eq!(mood_lcg_next(0), 1013904223);
        // 1013904223 * 3 wraps to -1253254627, + 1013904223 = -239350404
        assert_eq!(mood_lcg_next(1013904223), -239350404);
        // -1073741824 * 3 wraps to 1073741824, + 1013904223 = 2087646047
        assert_eq!(mood_lcg_next(-1073741824), 2087646047);
    }

    #[test]
    fn mood_position_hand_checked() {
        // i = 0x0F1BBCD7: & 15 = 7, (>>8) & 15 = 12, (>>16) & 255 = 27.
        let i = 0x0F1BBCD7u32 as i32;
        // cx = -7, cz = -2: x = -112 + 7 = -105, z = -32 + 12 = -20, y = 27.
        assert_eq!(mood_position(i, -7, -2), [-105, 27, -20]);
        assert_eq!(mood_position(0, 3, 4), [48, 0, 64]);
    }
}
