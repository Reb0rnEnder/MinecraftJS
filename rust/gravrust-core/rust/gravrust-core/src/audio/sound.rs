// Port of `client/js/audio/sound.js`: SoundManager, sound type lookup,
// category determination, event sounds, and playback helpers.
//!
//! What stays JavaScript is the part that needs the loaded sound definitions
//! (assets.loadSoundDefinitions()) and the platform audio interface:
//! `platform().createAudio()`, `audio.play()`, `audio.decode()`, etc.
//! The decisions that feed those are here.

use std::collections::HashMap;
use std::collections::HashSet;

use serde_json::Value;
use wasm_bindgen::prelude::*;

/// Sound type constants matching `client/js/audio/sound.js` SOUND_TYPES.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SoundType {
    Stone,
    Wood,
    Gravel,
    Grass,
    Metal,
    Glass,
    Cloth,
    Sand,
    Snow,
    Ladder,
    Slime,
    Anvil,
}

/// Canonical sound type lookup from a block or entity.
/// Mirrors `soundTypeOf(b)` from sound.js.
pub fn sound_type_of(block_name: &str) -> SoundType {
    match block_name {
        "stone" => SoundType::Stone,
        "wood" => SoundType::Wood,
        "gravel" => SoundType::Gravel,
        "grass" => SoundType::Grass,
        "metal" => SoundType::Metal,
        "glass" => SoundType::Glass,
        "cloth" => SoundType::Cloth,
        "sand" => SoundType::Sand,
        "snow" => SoundType::Snow,
        "ladder" => SoundType::Ladder,
        "slime" => SoundType::Slime,
        "anvil" => SoundType::Anvil,
        _ => SoundType::Stone,
    }
}

/// Sound type alias map (e.g. trader_llama -> llama, cave_spider -> spider).
/// Mirrors `SOUND_ALIASES` from sound.js.
pub fn sound_alias(name: &str) -> Option<&str> {
    let aliases: &[(&str, &str)] = &[
        ("trader_llama", "llama"),
        ("cave_spider", "spider"),
        ("giant", "hostile"),
        ("mooshroom", "cow"),
        ("pufferfish", "puffer_fish"),
    ];
    aliases.iter().find(|(k, _)| **k == name).map(|(_, v)| *v)
}

/// Sound event category IDs matching `client/js/audio/sound.js` CATEGORIES.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SoundCategory {
    Master,
    Music,
    Record,
    Weather,
    Block,
    Hostile,
    Neutral,
    Player,
    Ambient,
    Voice,
}

/// Determine the sound category from an event name.
/// Mirrors `CATEGORY_OF(name)` from sound.js.
pub fn category_of(name: &str) -> SoundCategory {
    if name.starts_with("music.") {
        return SoundCategory::Music;
    }
    if name.starts_with("record.") {
        return SoundCategory::Record;
    }
    if name.starts_with("weather.") {
        return SoundCategory::Weather;
    }
    if name.starts_with("block.") {
        return SoundCategory::Block;
    }
    if name.starts_with("entity.player.") {
        return SoundCategory::Player;
    }
    // Hostile mob types
    if name.starts_with("entity.") {
        let hostile = HashSet::from([
            "zombie", "husk", "skeleton", "stray", "wither", "spider", "creeper",
            "blaze", "ghast", "enderman", "endermite", "slime", "small_slime",
            "magma_cube", "small_magma_cube", "silverfish", "witch", "ender_dragon",
            "guardian", "elder_guardian", "shulker", "vex", "evoker", "vindicator",
            "illusioner", "zombie_pigman", "zombie_villager", "hostile", "phantom",
            "drowned",
        ]);
        if hostile.contains(&name.trim()) {
            return SoundCategory::Hostile;
        }
        return SoundCategory::Neutral;
    }
    if name.starts_with("ambient.") {
        return SoundCategory::Ambient;
    }
    SoundCategory::Master
}

/// Sound event prefix aliases, e.g. block.cloth. -> block.wool.).
/// Mirrors `SOUND_EVENT_PREFIX_ALIASES` from sound.js.
pub fn sound_prefix_alias(name: &str) -> Option<&str> {
    let aliases: &[(&str, &str)] = &[
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
        ("entity.irongolem.", "entity.iron_golem."),
        ("entity.itemframe.", "entity.item_frame."),
        ("entity.leashknot.", "entity.leash_knot."),
        ("entity.lightning.", "entity.lightning_bolt."),
        ("entity.lingeringpotion.", "entity.lingering_potion."),
        ("entity.magmacube.", "entity.magma_cube."),
        ("entity.parrot.imitate.enderdragon", "entity.parrot.imitate.ender_dragon"),
        ("entity.parrot.imitate.evocation_illager", "entity.parrot.imitate.evoker"),
        ("entity.parrot.imitate.illusion_illager", "entity.parrot.imitate.imitationer"),
        ("entity.parrot.imitate.magmacube", "entity.parrot.imitate.magma_cube"),
        ("entity.parrot.imitate.vindication_illager", "entity.parrot.imitate.vindicator"),
    ];
    for (from, to) in aliases {
        if name.starts_with(from) {
            return to + &name[from.len()..];
        }
    }
    None
}

/// Sound event aliases map, e.g. entity.polar_bear.baby_ambient -> entity.polar_bear.ambient_baby.
/// Mirrors `SOUND_EVENT_ALIASES` from sound.js.
pub fn sound_alias_lookup(name: &str) -> Option<&str> {
    let aliases: &[(&str, &str)] = &[
        ("entity.polar_bear.baby_ambient", "entity.polar_bear.ambient_baby"),
        ("entity.villager.trading", "entity.villager.trade"),
        ("entity.zombie.attack_door_wood", "entity.zombie.attack_wooden_door"),
        ("entity.zombie.break_door_wood", "entity.zombie.break_wooden_door"),
    ];
    aliases.iter().find(|(k, _)| **k == name).map(|(_, v)| *v)
}

/// Canonical identities (not wire IDs), matching the `E(k)` helper from sound.js.
/// These are used for entity hurt/death event names.
pub fn entity_sound_ids(kind: &str) -> (String, String) {
    let kind = sound_alias(kind);
    let hurt = format!("entity.{}.hurt", kind);
    let death = format!("entity.{}.death", kind);
    (hurt, death)
}

/// Event sounds registry (excerpt matching EVENT_SOUNDS from sound.js).
/// IDs map to [event_name, volume, pitch_generator, category].
#[derive(Clone, Debug)]
pub struct EventSound {
    pub id: i32,
    pub event: String,
    pub volume: f64,
    pub pitch_func: Option<f64>, // None means fixed pitch
    pub category: SoundCategory,
}

/// Global events (GLOBAL_EVENTS from sound.js).
pub const GLOBAL_EVENTS: &[(i32, &str)] = &[
    (1023, "entity.wither.spawn"),
    (1028, "entity.enderdragon.death"),
    (1038, "block.end_portal.spawn"),
];

/// Excerpt of event sounds matching the JS EVENT_SOUNDS map.
/// Only a subset is ported; the full registry is loaded from assets at runtime.
pub const EVENT_SOUNDS: &[EventSound] = &[
    // RenderGlobal.playEvent sounds
    EventSound { id: 1000, event: "block.dispenser.dispense".into(), volume: 1.0, pitch_func: Some(1.0), category: SoundCategory::Block },
    EventSound { id: 1001, event: "block.dispenser.fail".into(), volume: 1.0, pitch_func: Some(1.2), category: SoundCategory::Block },
    EventSound { id: 1002, event: "block.dispenser.launch".into(), volume: 1.0, pitch_func: Some(1.2), category: SoundCategory::Block },
    EventSound { id: 1003, event: "entity.endereye.launch".into(), volume: 1.0, pitch_func: Some(1.2), category: SoundCategory::Neutral },
    EventSound { id: 1004, event: "entity.firework.shoot".into(), volume: 1.0, pitch_func: Some(1.2), category: SoundCategory::Neutral },
    EventSound { id: 1005, event: "block.iron_door.open".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1006, event: "block.wooden_door.open".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1007, event: "block.wooden_trapdoor.open".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1008, event: "block.fence_gate.open".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1009, event: "block.fire.extinguish".into(), volume: 0.5, pitch_func: Some(2.6 + (0.0 - 0.0) * 0.8), category: SoundCategory::Block },
    EventSound { id: 1011, event: "block.iron_door.close".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1012, event: "block.wooden_door.close".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1013, event: "block.wooden_trapdoor.close".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1014, event: "block.fence_gate.close".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    // Hostile sounds
    EventSound { id: 1015, event: "entity.ghast.warn".into(), volume: 10.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Hostile },
    EventSound { id: 1016, event: "entity.ghast.shoot".into(), volume: 10.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Hostile },
    EventSound { id: 1017, event: "entity.enderdragon.shoot".into(), volume: 10.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Hostile },
    EventSound { id: 1018, event: "entity.blaze.shoot".into(), volume: 2.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Hostile },
    EventSound { id: 1019, event: "entity.zombie.attack_door_wood".into(), volume: 2.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Hostile },
    EventSound { id: 1020, event: "entity.zombie.attack_iron_door".into(), volume: 2.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Hostile },
    EventSound { id: 1021, event: "entity.zombie.break_door_wood".into(), volume: 2.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Hostile },
    EventSound { id: 1022, event: "entity.wither.break_block".into(), volume: 2.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Hostile },
    EventSound { id: 1024, event: "entity.wither.shoot".into(), volume: 2.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Hostile },
    EventSound { id: 1025, event: "entity.bat.takeoff".into(), volume: 0.05, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Neutral },
    EventSound { id: 1026, event: "entity.zombie.infect".into(), volume: 2.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Hostile },
    EventSound { id: 1027, event: "entity.zombie_villager.converted".into(), volume: 2.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Neutral },
    EventSound { id: 1029, event: "block.anvil.destroy".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1030, event: "block.anvil.use".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1031, event: "block.anvil.land".into(), volume: 0.3, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1033, event: "block.chorus_flower.grow".into(), volume: 1.0, pitch_func: Some(1.0), category: SoundCategory::Block },
    EventSound { id: 1034, event: "block.chorus_flower.death".into(), volume: 1.0, pitch_func: Some(1.0), category: SoundCategory::Block },
    EventSound { id: 1035, event: "block.brewing_stand.brew".into(), volume: 1.0, pitch_func: Some(1.0), category: SoundCategory::Block },
    EventSound { id: 1036, event: "block.iron_trapdoor.close".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1037, event: "block.iron_trapdoor.open".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1039, event: "entity.phantom.bite".into(), volume: 0.3, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Hostile },
    EventSound { id: 1040, event: "entity.zombie.converted_to_drowned".into(), volume: 2.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Neutral },
    EventSound { id: 1041, event: "entity.husk.converted_to_zombie".into(), volume: 2.0, pitch_func: Some(0.2 + 1.0), category: SoundCategory::Neutral },
    EventSound { id: 1042, event: "block.grindstone.use".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1043, event: "item.book.page_turn".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Block },
    EventSound { id: 1501, event: "block.lava.extinguish".into(), volume: 0.5, pitch_func: Some(2.6 + (0.0 - 0.0) * 0.8), category: SoundCategory::Block },
    EventSound { id: 1502, event: "block.redstone_torch.burnout".into(), volume: 0.5, pitch_func: Some(2.6 + (0.0 - 0.0) * 0.8), category: SoundCategory::Block },
    EventSound { id: 1503, event: "block.end_portal_frame.fill".into(), volume: 1.0, pitch_func: Some(1.0), category: SoundCategory::Block },
    EventSound { id: 3000, event: "block.end_gateway.spawn".into(), volume: 10.0, pitch_func: Some((1.0 + (0.0 - 0.0) * 0.2) * 0.7), category: SoundCategory::Block },
    EventSound { id: 3001, event: "entity.ender_dragon.growl".into(), volume: 64.0, pitch_func: Some(0.8 + 0.3), category: SoundCategory::Hostile },
    // Potion break sounds
    EventSound { id: 2002, event: "entity.splash_potion.break".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Neutral },
    EventSound { id: 2007, event: "entity.splash_potion.break".into(), volume: 1.0, pitch_func: Some(0.1 + 0.9), category: SoundCategory::Neutral },
];

/// Sound manager state (mirrors JS SoundManager).
/// The platform-specific audio interface (createAudio, play, decode, etc.)
/// is provided via a trait or passed as callbacks; here we define the structure
/// and platform-agnostic helpers.
#[derive(Clone, Debug)]
pub struct SoundDef {
    pub name: String,
    pub volume: f64,
    pub pitch: f64,
    /// If true, the sound should be streamed rather than a one-shot buffer.
    pub stream: bool,
}

#[derive(Clone, Debug)]
pub struct SoundManager {
    /// Loaded sound definitions from the resource pack/assets.
    /// Keyed by sound asset name (flattened, without minecraft: prefix).
    defs: HashMap<String, Vec<SoundDef>>,
    /// Currently playing sound handles.
    playing: HashSet<String>,
    /// Generation counter for reload detection (like JS version).
    generation: u64,
    /// Music timer/tracking.
    music_timer: i32,
    /// Current music handle.
    music: Option<String>,
}

impl SoundManager {
    /// Create a new empty sound manager.
    pub fn new() -> Self {
        SoundManager {
            defs: HashMap::new(),
            playing: HashSet::new(),
            generation: 0,
            music_timer: 100,
            music: None,
        }
    }

    /// (Re)load sound definitions from the game assets.
    /// Mirrors `SoundManager.reload()` from sound.js.
    pub fn reload(&mut self, defs: HashMap<String, Vec<SoundDef>>) {
        self.defs = defs;
        self.stop_all();
        self.playing.clear();
    }

    /// Get volume for a sound category.
    pub fn volume_for(cat: SoundCategory, master_volume: f64, sound_volumes: &HashMap<String, f64>) -> f64 {
        let s = sound_volumes.get(&cat.to_string());
        let v = s.map_or(1.0, |&v| v);
        master_volume * v
    }

    /// Look up a sound by name, applying alias resolution.
    /// Mirrors `this._pick(name)` / `soundAssetName(name)` from sound.js.
    pub fn pick_sound(&self, name: &str) -> Option<&Vec<SoundDef>> {
        let resolved = crate::audio::sound::sound_alias_lookup(name).unwrap_or_else(|| name);
        self.defs.get(resolved)
    }

    /// Stop all playing sounds.
    pub fn stop_all(&mut self) {
        // In a full implementation, this would stop all audio voices.
        // For the WASM port, this is a no-op or delegates to the platform.
        self.playing.clear();
    }
}

/// Play sound events matching the JS EVENT_SOUNDS registry.
/// This is a simplified version; the full implementation would look up
/// the event by ID and play it with the correct volume/pitch/category.
pub fn play_event_sound(
    event_id: i32,
    category: SoundCategory,
    volume: f64,
    pitch: f64,
) -> Option<(&'static str, f64, f64, SoundCategory)> {
    let event = EVENT_SOUNDS.iter().find(|s| s.id == event_id)?;
    Some((&event.event, event.volume, event.pitch?.unwrap_or(pitch), event.category))
}

/// Play a block step sound (footstep).
/// Mirrors `SoundManager.playStep` from sound.js.
pub fn play_step_sound(block_name: &str, category: SoundCategory) -> (SoundType, f64, f64) {
    let st = sound_type_of(block_name);
    // Volume and pitch scaling similar to JS: volume * 0.15 for footstep
    let volume = 0.15;
    let pitch = 1.0;
    (st, volume, pitch)
}

/// Play a fall sound.
pub fn play_fall_sound(is_big: bool) -> (SoundType, f64, f64) {
    if is_big {
        (SoundType::Stone, 1.0, 1.0) // Would be entity.player.big_fall
    } else {
        (SoundType::Stone, 0.5, 0.75) // Would be entity.player.small_fall step
    }
}