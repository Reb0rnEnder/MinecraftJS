//! Port of `client/js/audio/sound.js` â€” the `SoundManager` (vanilla
//! `sounds.json` + resource packs, played through the platform audio
//! interface).
//!
//! Pure algorithmic helpers (asset-name aliasing, categories, the
//! `playEvent` tables, voice parameter math and the cave-mood LCG) live in
//! [`crate::sound_alg2`]; the music-ticker state machine lives in
//! [`crate::music_system`]. This module holds the manager itself: the
//! `SOUND_TYPES` cascade, the weighted `_pick` walk, the play/stop/step/fall/
//! block/mob/event/record flows with their exact volume/pitch/position math,
//! and the per-tick listener + mood + music orchestration.
//!
//! The `AudioContext`/`GainNode`/`PannerNode` operations are browser-bound
//! and stay behind the [`SoundAudio`] contract; game/world queries stay
//! behind the [`SoundHost`] contract. The JS async chain
//! (`readSound().then(decode)` inside `play`) is modeled synchronously with
//! the same observable ordering: cache lookup â†’ decode â†’ generation guard â†’
//! voice start.

use wasm_bindgen::prelude::*;

use crate::music_system::{music_play_resolved, music_tick, music_type, MusicTickerState};
use crate::sound_alg2::{
    category_of, clamp_pitch, event_sound, global_event_sound, is_hostile_type, max_distance,
    mood_lcg_next, mood_position, sound_asset_name, voice_volume, RandomSource,
};

// JS: `const CATEGORIES = ['master', 'music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient', 'voice'];`
/// SPacketSoundEffect category ids â†’ names.
pub const CATEGORIES: [&str; 10] = [
    "master", "music", "record", "weather", "block", "hostile", "neutral", "player", "ambient",
    "voice",
];

// ---------------------------------------------------------------- SOUND_TYPES

/// JS: one `SOUND_TYPES` entry â€” `[step, break, place, volume, pitch, hit, fall]`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SoundType {
    /// JS: the sound-type key (`'stone'`, `'anvil'`, ...) used to fill the names.
    pub key: &'static str,
    /// JS index 0 â€” `block.<k>.step`.
    pub step: &'static str,
    /// JS index 1 â€” `block.<k>.break`.
    pub break_sound: &'static str,
    /// JS index 2 â€” `block.<k>.place`.
    pub place: &'static str,
    /// JS index 3 â€” the entry volume.
    pub volume: f64,
    /// JS index 4 â€” the entry pitch.
    pub pitch: f64,
    /// JS index 5 â€” `block.<k>.hit`.
    pub hit: &'static str,
    /// JS index 6 â€” `block.<k>.fall`.
    pub fall: &'static str,
}

/// JS: `const T = (k, vol = 1, pitch = 1) => [...]`.
const fn t(k: &'static str, vol: f64, pitch: f64) -> SoundType {
    SoundType {
        key: k,
        step: "block.{}.step",
        break_sound: "block.{}.break",
        place: "block.{}.place",
        volume: vol,
        pitch,
        hit: "block.{}.hit",
        fall: "block.{}.fall",
    }
}

impl SoundType {
    /// JS: the `block.<k>.<suffix>` names with the sound-type key filled in.
    pub fn with_key(&self) -> SoundTypeName {
        let fill = |tpl: &str| tpl.replace("{}", self.key);
        SoundTypeName {
            step: fill(self.step),
            break_sound: fill(self.break_sound),
            place: fill(self.place),
            volume: self.volume,
            pitch: self.pitch,
            hit: fill(self.hit),
            fall: fill(self.fall),
        }
    }
}

/// A [`SoundType`] with the `block.<k>.*` names resolved.
#[derive(Debug, Clone, PartialEq)]
pub struct SoundTypeName {
    pub step: String,
    pub break_sound: String,
    pub place: String,
    pub volume: f64,
    pub pitch: f64,
    pub hit: String,
    pub fall: String,
}

/// JS: `SOUND_TYPES` â€” the vanilla sound-type table (anvil overrides the
/// default volume/pitch).
pub fn sound_types() -> std::collections::HashMap<&'static str, SoundType> {
    use std::collections::HashMap;
    let mut m = HashMap::new();
    for k in [
        "stone", "wood", "gravel", "grass", "glass", "cloth", "sand", "snow", "ladder", "slime",
    ] {
        m.insert(k, t(k, 1.0, 1.0));
    }
    m.insert("metal", t("metal", 1.0, 1.5));
    m.insert(
        "anvil",
        SoundType {
            key: "anvil",
            step: "block.anvil.step",
            break_sound: "block.anvil.break",
            place: "block.anvil.place",
            volume: 0.3,
            pitch: 1.0,
            hit: "block.anvil.hit",
            fall: "block.anvil.fall",
        },
    );
    m
}

/// JS: the block info `soundTypeOf(b)` reads (`b.soundType`, `b.name`,
/// `b.material`).
#[derive(Debug, Clone, Default)]
pub struct BlockSoundInfo {
    /// JS: `b.name`.
    pub name: String,
    /// JS: `b.soundType` â€” an explicit override from the block table.
    pub sound_type: Option<String>,
    /// JS: `b.material`.
    pub material: Option<String>,
}

/// JS: `soundTypeOf(b)` â€” the block â†’ sound-type cascade (checked in the JS
/// order; `b` falsy or unknown falls back to stone).
pub fn sound_type_of(b: Option<&BlockSoundInfo>) -> SoundType {
    let table = sound_types();
    let Some(b) = b else {
        return table["stone"];
    };
    if let Some(st) = &b.sound_type {
        if let Some(found) = table.get(st.as_str()) {
            return *found;
        }
    }
    let n = b.name.as_str();
    if n == "slime" {
        return table["slime"];
    }
    if n == "anvil" {
        return table["anvil"];
    }
    if n == "ladder" {
        return table["ladder"];
    }
    use once_cell::sync::Lazy;
    static GLASS: Lazy<regex::Regex> = Lazy::new(|| {
        regex::Regex::new(r"glass|^ice$|frosted_ice|packed_ice|glowstone|beacon|sea_lantern|redstone_lamp|portal|end_gateway").unwrap()
    });
    static CLOTH: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"wool|carpet|cactus|cake").unwrap());
    static SAND: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"^sand$|soul_sand|concrete_powder").unwrap());
    static SNOW: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"snow").unwrap());
    static GRAVEL: Lazy<regex::Regex> = Lazy::new(|| {
        regex::Regex::new(r"gravel|^dirt$|coarse_dirt|podzol|farmland|^clay$|grass_path").unwrap()
    });
    static GRASS: Lazy<regex::Regex> = Lazy::new(|| {
        regex::Regex::new(r"^grass$|^grass_block$|mycelium|leaves|sapling|tallgrass|deadbush|dead_bush|flower|vine|reeds|sugar_cane|waterlily|lily_pad|hay_block|^tnt$|sponge|double_plant|wheat|carrots|potatoes|beetroots|nether_wart$|stem|mushroom$|cocoa").unwrap()
    });
    static METAL: Lazy<regex::Regex> = Lazy::new(|| {
        regex::Regex::new(r"iron|gold_block|diamond_block|emerald_block|lapis_block|redstone_block|rail|hopper|cauldron|brewing_stand|command_block|structure_block").unwrap()
    });
    static NOT_ORE: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"ore$").unwrap());
    static WOOD_NAME: Lazy<regex::Regex> = Lazy::new(|| {
        regex::Regex::new(r"pumpkin|melon_block|bookshelf|chest|crafting|jukebox|note_block|noteblock|sign|_door|fence|trapdoor|log|planks|chorus").unwrap()
    });
    if GLASS.is_match(n) {
        return table["glass"];
    }
    if CLOTH.is_match(n) {
        return table["cloth"];
    }
    if SAND.is_match(n) {
        return table["sand"];
    }
    if SNOW.is_match(n) {
        return table["snow"];
    }
    if GRAVEL.is_match(n) {
        return table["gravel"];
    }
    if GRASS.is_match(n) {
        return table["grass"];
    }
    if METAL.is_match(n) && !NOT_ORE.is_match(n) {
        return table["metal"];
    }
    if b.material.as_deref() == Some("wood") || WOOD_NAME.is_match(n) {
        return table["wood"];
    }
    if b.material.as_deref() == Some("plant") || b.material.as_deref() == Some("leaves") {
        return table["grass"];
    }
    if b.material.as_deref() == Some("dirt") {
        return table["gravel"];
    }
    if b.material.as_deref() == Some("wool") {
        return table["cloth"];
    }
    table["stone"]
}

// ------------------------------------------------------------------ contracts

/// A decoded audio buffer handle (browser-bound: the JS `AudioBuffer`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AudioBuf(pub u64);

/// JS: the `platform().createAudio()` surface (browser-bound).
pub trait SoundAudio {
    /// JS: `this.audio.decode(bytes)` â€” `null` on failure.
    fn decode(&mut self, bytes: &[u8]) -> Option<AudioBuf>;
    /// JS: `this.audio.play(buf, opts)` â€” `null` when the voice could not start.
    fn play(&mut self, buf: AudioBuf, opts: &PlayOpts) -> Option<Box<dyn SoundVoice>>;
    /// JS: `this.audio.setListener(pos, forward, up)`.
    fn set_listener(&mut self, pos: [f64; 3], forward: [f64; 3], up: [f64; 3]);
}

/// JS: the `this.audio.play(buf, {...})` options object.
#[derive(Debug, Clone)]
pub struct PlayOpts {
    /// JS: `volume`.
    pub volume: f64,
    /// JS: `pitch`.
    pub pitch: f64,
    /// JS: `pos` â€” `null` for global sounds.
    pub pos: Option<[f64; 3]>,
    /// JS: `maxDistance`.
    pub max_distance: f64,
    /// JS: `loop` (only `playLoop` sets it).
    pub loop_: bool,
}

impl Default for PlayOpts {
    fn default() -> Self {
        PlayOpts { volume: 1.0, pitch: 1.0, pos: None, max_distance: 16.0, loop_: false }
    }
}

/// JS: a playing voice (`voice.stop()`, `voice.ended`, the optional setters).
pub trait SoundVoice {
    /// JS: `voice.stop()`.
    fn stop(&mut self);
    /// JS: `voice.ended`.
    fn ended(&self) -> bool;
    /// JS: `voice.setVolume && voice.setVolume(v)` â€” optional in JS.
    fn set_volume(&mut self, _v: f64) {}
    /// JS: `voice.setPosition && voice.setPosition(p)` â€” optional in JS.
    fn set_position(&mut self, _p: [f64; 3]) {}
    /// JS: `voice.setPitch?.(v)` â€” optional in JS.
    fn set_pitch(&mut self, _v: f64) {}
}

/// The game/world hooks the JS reaches through `this.game` (browser-bound in
/// JS; a Rust host implements them).
pub trait SoundHost {
    /// JS: `g.settings.masterVolume`.
    fn master_volume(&self) -> f64;
    /// JS: `s.soundVolumes[cat]` â€” `undefined` â†’ `None`.
    fn sound_volume(&self, cat: &str) -> Option<f64>;
    /// JS: `g.settings.showSubtitles`.
    fn show_subtitles(&self) -> bool;
    /// JS: `g.inWorld`.
    fn in_world(&self) -> bool;
    /// JS: `g.settings.renderDistance`.
    fn render_distance(&self) -> i32;
    /// JS: `g.player.x/y/z`.
    fn player_pos(&self) -> [f64; 3];
    /// JS: `g.world.isLoaded(cx << 4, cz << 4)`.
    fn is_loaded(&self, cx: i32, cz: i32) -> bool;
    /// JS: `g.world.getState(x, y, z)`.
    fn get_state(&self, x: i32, y: i32, z: i32) -> i32;
    /// JS: `w.getSkyLight(x, y, z)`.
    fn sky_light(&self, x: i32, y: i32, z: i32) -> i32;
    /// JS: `w.getBlockLight(x, y, z)`.
    fn block_light(&self, x: i32, y: i32, z: i32) -> i32;
    /// JS: `g.hud.addSubtitle(text, x, y, z)`.
    fn add_subtitle(&mut self, text: &str, x: f64, y: f64, z: f64);
    /// JS: `g.hud.setActionBar(text)`.
    fn set_action_bar(&mut self, text: &str);
    /// JS: `g.renderer.camPos`.
    fn cam_pos(&self) -> [f64; 3];
    /// JS: `g.lookVector()`.
    fn look_vector(&self) -> [f64; 3];
    /// JS: `g.assets.readSound(file + '.ogg')` â€” `null` when missing.
    fn read_sound(&mut self, file: &str) -> Option<Vec<u8>>;
    /// JS: `h.entity.x/y/z` â€” the tracked position of an attached entity.
    fn entity_pos(&self, entity: u64) -> Option<[f64; 3]>;
    /// JS: `g.particles.note && g.particles.note(x, y, z, note)`.
    fn note_particle(&mut self, _x: f64, _y: f64, _z: f64, _note: f64) {}
    /// JS: `scr && scr.isCredits` (`_musicType`).
    fn credits_screen(&self) -> bool {
        false
    }
    /// JS: `g.dimension` (`_musicType`).
    fn dimension(&self) -> i32 {
        0
    }
    /// JS: `g.hud.bossFlag(2)` (`_musicType` end-dragon branch).
    fn end_boss(&self) -> bool {
        false
    }
    /// JS: `g.player.creative && g.player.allowFlying` (`_musicType`).
    fn creative_flight(&self) -> bool {
        false
    }
}

// ------------------------------------------------------------------- manager

/// JS: one entry of `this.playing` â€” a started voice plus its metadata.
pub struct Playing {
    /// The voice token (Rust stand-in for JS object identity).
    pub token: u64,
    /// JS: `handle.name` â€” the resolved asset name.
    pub name: String,
    /// JS: `handle.category`.
    pub category: String,
    /// JS: `handle.voice`.
    pub voice: Box<dyn SoundVoice>,
    /// JS: `handle.entity` â€” optional follow target (token into the host).
    pub entity: Option<u64>,
    /// JS: loop handles carry `base` (def.volume * catVol) for setVolume.
    pub base: f64,
    /// JS: the picked definition's pitch (for loop setPitch clamping).
    pub def_pitch: f64,
    /// JS: `handle.stop` custom stopper marker (loop handles stop+remove).
    pub is_loop: bool,
}

/// JS: `playRecord`'s `this.record` handle.
pub struct RecordState {
    /// JS: `this.record.voice`.
    pub voice: Box<dyn SoundVoice>,
}

/// Port of the JS `SoundManager` class.
pub struct SoundManager {
    /// JS: `this.audio` â€” `None` mirrors a platform without audio.
    pub audio: Option<Box<dyn SoundAudio>>,
    /// JS: `this.defs` â€” parsed `sounds.json` (`None` until loaded; `{}` on load failure).
    pub defs: Option<serde_json::Map<String, serde_json::Value>>,
    /// JS: `this.buffers` â€” decoded buffer cache by file name.
    pub buffers: std::collections::HashMap<String, Option<AudioBuf>>,
    /// JS: `this.playing`.
    pub playing: Vec<Playing>,
    /// JS: `this.music` / `this.musicName` / `this.musicPending` / `this.musicTimer`
    /// â€” see [`crate::music_system::MusicTickerState`].
    pub music_state: MusicTickerState,
    /// JS: `this.generation` â€” bumped by `stopAll` to invalidate in-flight plays.
    pub generation: u64,
    /// JS: `this.lcg` â€” cave-mood LCG (initialized on first use).
    pub lcg: Option<i32>,
    /// JS: `this.ambientCountdown` â€” cave-mood countdown (initialized on first tick).
    pub ambient_countdown: Option<i64>,
    /// JS: `this.record` â€” the active jukebox disc.
    pub record: Option<RecordState>,
    /// The next voice token (Rust stand-in for JS object identity).
    next_token: u64,
    /// The RNG source (JS `Math.random`).
    rng: Box<dyn RandomSource>,
}

impl SoundManager {
    /// JS: `constructor(game)` â€” `reload()` runs immediately.
    pub fn new(audio: Option<Box<dyn SoundAudio>>, rng: Box<dyn RandomSource>) -> Self {
        let mut music_state = MusicTickerState::default();
        music_state.timer = 100; // JS: `this.musicTimer = 100;`
        let mut manager = SoundManager {
            audio,
            defs: None,
            buffers: std::collections::HashMap::new(),
            playing: Vec::new(),
            music_state,
            generation: 0,
            lcg: None,
            ambient_countdown: None,
            record: None,
            next_token: 1,
            rng,
        };
        manager.reload();
        manager
    }

    /// JS: `reload()` â€” stopAll, clear the buffer cache; definitions are
    /// (re)loaded by the caller (`loadSoundDefinitions` is host-bound).
    pub fn reload(&mut self) {
        self.stop_all();
        self.buffers.clear();
    }

    /// JS: `this.defs = d` / `.catch(() => { this.defs = {}; })` â€” the host
    /// delivers the parsed definitions (or `None` for the failure path).
    pub fn set_defs(&mut self, defs: Option<serde_json::Map<String, serde_json::Value>>) {
        self.defs = Some(defs.unwrap_or_default());
    }

    /// JS: `volumeFor(cat)` â€” `cat === 'master' ? 1 : (stored ?? 1)`, Ã— master.
    pub fn volume_for(&self, host: &dyn SoundHost, cat: &str) -> f64 {
        let v = if cat == "master" {
            1.0
        } else {
            host.sound_volume(cat).unwrap_or(1.0)
        };
        host.master_volume() * v
    }

    /// JS: `_weight(name, seen)` â€” total weight of an entry, recursing into
    /// `type: 'event'` sub-entries with a seen-set.
    pub fn weight(&mut self, name: &str, seen: &mut std::collections::HashSet<String>) -> f64 {
        let name = sound_asset_name(name);
        if seen.contains(&name) {
            return 0.0;
        }
        seen.insert(name.clone());
        // Clone the entries so the recursion can take &mut self (the JS holds
        // the same array by reference; the clone is observable-equivalent).
        let sounds: Vec<serde_json::Value> = match self.defs.as_ref().and_then(|d| d.get(&name)) {
            Some(entry) => entry.get("sounds").and_then(|s| s.as_array()).map(|a| a.clone()).unwrap_or_default(),
            None => Vec::new(),
        };
        let mut sum = 0.0;
        for raw in &sounds {
            let e = raw.as_str().map(|n| serde_json::json!({ "name": n })).unwrap_or_else(|| raw.clone());
            if e.get("type").and_then(|t| t.as_str()) == Some("event") {
                if let Some(sub) = e.get("name").and_then(|n| n.as_str()) {
                    sum += self.weight(sub, seen);
                }
            } else {
                sum += e.get("weight").and_then(|w| w.as_f64()).unwrap_or(1.0);
            }
        }
        sum
    }

    /// JS: `_pick(name, seen)` â€” the weighted random choice; event entries
    /// recurse and scale the picked child's volume/pitch.
    pub fn pick(
        &mut self,
        name: &str,
        seen: &mut std::collections::HashSet<String>,
    ) -> Option<Picked> {
        let name = sound_asset_name(name);
        if seen.contains(&name) {
            return None;
        }
        seen.insert(name.clone());
        // Clone the entries so the recursion can take &mut self.
        let entries: Vec<serde_json::Value> = self
            .defs
            .as_ref()
            .and_then(|d| d.get(&name))
            .and_then(|e| e.get("sounds"))
            .and_then(|s| s.as_array())
            .map(|a| a.clone())?;
        if entries.is_empty() {
            return None;
        }
        let mut weighted: Vec<(serde_json::Value, f64)> = Vec::new();
        for raw in &entries {
            let e = raw.as_str().map(|n| serde_json::json!({ "name": n })).unwrap_or_else(|| raw.clone());
            let w = if e.get("type").and_then(|t| t.as_str()) == Some("event") {
                let sub = e.get("name").and_then(|n| n.as_str()).unwrap_or("");
                self.weight(sub, seen)
            } else {
                e.get("weight").and_then(|w| w.as_f64()).unwrap_or(1.0)
            };
            weighted.push((e, w));
        }
        let total: f64 = weighted.iter().map(|(_, w)| w).sum();
        if total == 0.0 {
            return None;
        }
        // JS: `let choice = Math.random() * total; for (...) { choice -= weight; if (choice < 0) ... }`
        let mut choice = self.rng.random() * total;
        let mut picked: Option<serde_json::Value> = None;
        for (entry, w) in &weighted {
            choice -= w;
            if choice < 0.0 {
                picked = Some(entry.clone());
                break;
            }
        }
        let pick = picked?;
        if pick.get("type").and_then(|t| t.as_str()) == Some("event") {
            let sub = pick.get("name").and_then(|n| n.as_str())?;
            let sound = self.pick(sub, seen)?;
            return Some(Picked {
                file: sound.file,
                volume: sound.volume * pick.get("volume").and_then(|v| v.as_f64()).unwrap_or(1.0),
                pitch: sound.pitch * pick.get("pitch").and_then(|p| p.as_f64()).unwrap_or(1.0),
                stream: sound.stream || pick.get("stream").and_then(|s| s.as_bool()).unwrap_or(false),
            });
        }
        Some(Picked {
            file: pick.get("name").and_then(|n| n.as_str())?.to_string(),
            volume: pick.get("volume").and_then(|v| v.as_f64()).unwrap_or(1.0),
            pitch: pick.get("pitch").and_then(|p| p.as_f64()).unwrap_or(1.0),
            stream: pick.get("stream").and_then(|s| s.as_bool()).unwrap_or(false),
        })
    }

    /// JS: `_buffer(file)` â€” folded into `play`/`play_loop` with field-split
    /// borrows (the decode step is host-driven and caches by file name).
    #[allow(dead_code)]
    fn buffer(&mut self, _audio: &mut dyn SoundAudio, _host: &mut dyn SoundHost, _file: &str) -> Option<AudioBuf> {
        None
    }

    /// JS: `_subtitle(name, x, y, z, opts)` â€” the GuiSubtitleOverlay gate.
    fn subtitle(&self, host: &mut dyn SoundHost, name: &str, x: Option<f64>, y: Option<f64>, z: Option<f64>, global: bool) {
        let Some(defs) = &self.defs else { return };
        let Some(sub) = defs.get(name).and_then(|d| d.get("subtitle")).and_then(|s| s.as_str()) else {
            return;
        };
        if !host.show_subtitles() || !host.in_world() {
            return;
        }
        let p = host.player_pos();
        if global || x.is_none() {
            host.add_subtitle(sub, p[0], p[1], p[2]);
        } else {
            host.add_subtitle(sub, x.unwrap_or(0.0), y.unwrap_or(0.0), z.unwrap_or(0.0));
        }
    }

    /// JS: `play(name, x, y, z, volume, pitch, opts)` â€” the main entry.
    /// Returns the started voice's token (JS handle).
    #[allow(clippy::too_many_arguments)]
    pub fn play(
        &mut self,
        host: &mut dyn SoundHost,
        name: &str,
        x: Option<f64>,
        y: Option<f64>,
        z: Option<f64>,
        volume: f64,
        pitch: f64,
        opts: &PlaySoundOpts,
    ) -> Option<u64> {
        let asset_name = sound_asset_name(name);
        let def = self.pick(&asset_name, &mut Default::default())?;
        self.subtitle(host, &asset_name, x, y, z, opts.global);
        // JS: `typeof opts.category === 'number' ? CATEGORIES[opts.category] || 'master' : opts.category || CATEGORY_OF(assetName)`
        let cat: String = match &opts.category {
            Some(SoundCategory::Id(id)) => CATEGORIES.get(*id as usize).copied().unwrap_or("master").to_string(),
            Some(SoundCategory::Name(n)) => n.clone(),
            None => category_of(&asset_name).to_string(),
        };
        let cat_vol = self.volume_for(host, &cat);
        if cat_vol <= 0.0 {
            return None;
        }
        let generation = self.generation;
        // Field-split borrows: the audio handle and the buffer cache are
        // disjoint fields, so both can be live at once (the JS awaits the
        // decode before starting the voice; the observable order matches).
        let audio = self.audio.as_mut()?;
        let buf = match self.buffers.get(&def.file) {
            Some(cached) => *cached,
            None => {
                let decoded = host
                    .read_sound(&format!("{}.ogg", def.file))
                    .and_then(|bytes| audio.decode(&bytes));
                self.buffers.insert(def.file.clone(), decoded);
                decoded
            }
        }?;
        if generation != self.generation {
            return None;
        }
        let voice_volume_value = voice_volume(volume, def.volume, cat_vol);
        let pitch_value = clamp_pitch(pitch * def.pitch);
        let pos = if !opts.global && x.is_some() { Some([x?, y?, z?]) } else { None };
        let voice = audio.play(
            buf,
            &PlayOpts {
                volume: voice_volume_value,
                pitch: pitch_value,
                pos,
                max_distance: max_distance(volume),
                loop_: false,
            },
        )?;
        let token = self.next_token;
        self.next_token += 1;
        self.playing.push(Playing {
            token,
            name: asset_name,
            category: cat,
            voice,
            entity: opts.entity,
            base: 0.0,
            def_pitch: 1.0,
            is_loop: false,
        });
        Some(token)
    }

    /// JS: `playAtPlayer(name, volume = 1, pitch = 1)`.
    pub fn play_at_player(
        &mut self,
        host: &mut dyn SoundHost,
        name: &str,
        volume: f64,
        pitch: f64,
    ) -> Option<u64> {
        self.play(host, name, Some(0.0), Some(0.0), Some(0.0), volume, pitch, &PlaySoundOpts { global: true, ..Default::default() })
    }

    /// JS: `playUi(name, pitch = 1)` â€” `volume 0.25`, `category 'master'`.
    pub fn play_ui(&mut self, host: &mut dyn SoundHost, name: &str, pitch: f64) -> Option<u64> {
        self.play(
            host,
            name,
            Some(0.0),
            Some(0.0),
            Some(0.0),
            0.25,
            pitch,
            &PlaySoundOpts { global: true, category: Some(SoundCategory::Name("master".to_string())), ..Default::default() },
        )
    }

    /// JS: `stop(sound, category)` â€” `/stopsound`; neither stops everything.
    pub fn stop(&mut self, sound: Option<&str>, category: Option<&str>) {
        if category.is_none() && sound.is_none() {
            self.stop_all();
            return;
        }
        // JS: `const id = s => String(s).toLowerCase().replace(/^minecraft:/, '');`
        let normalize = |s: &str| sound_asset_name(s).to_lowercase();
        let want = sound.map(normalize);
        let mut kept = Vec::new();
        for mut h in self.playing.drain(..) {
            let category_match = category.map_or(true, |c| h.category == c);
            let sound_match = want.as_ref().map_or(true, |w| *w == normalize(&h.name));
            if category_match && sound_match {
                h.voice.stop();
            } else {
                kept.push(h);
            }
        }
        self.playing = kept;
    }

    /// JS: `stopAll()` â€” generation bump, stop every voice and the music.
    pub fn stop_all(&mut self) {
        self.generation += 1;
        for h in &mut self.playing {
            h.voice.stop();
        }
        self.playing.clear();
        if let Some(mut record) = self.record.take() {
            record.voice.stop();
        }
        if let Some(token) = self.music_state.music {
            // JS: `this.music.voice.stop(); this.music = null;`
            if let Some(idx) = self.playing.iter().position(|p| p.token_matches(token)) {
                self.playing[idx].voice.stop();
                self.playing.remove(idx);
            }
            self.music_state.music = None;
        }
    }

    /// JS: `playStep(x, y, z, state, at)` â€” footsteps; snow layer above wins.
    pub fn play_step(
        &mut self,
        host: &mut dyn SoundHost,
        x: f64,
        y: f64,
        z: f64,
        state: i32,
        at: Option<[f64; 3]>,
        below: Option<&BlockSoundInfo>,
        above: Option<&BlockSoundInfo>,
    ) {
        // JS: `let b = getBlock(state); const above = getBlock(this.game.world.getState(x, y+1, z)); if (above.name === 'snow_layer') b = above;`
        let mut b = below;
        if let Some(a) = above {
            if a.name == "snow_layer" {
                b = Some(a);
            }
        }
        let Some(b) = b else { return };
        // JS: `if (!b || b.id === 0 || b.isLiquid) return;` â€” the caller pre-filters
        // empty/liquid states when building BlockSoundInfo (id 0 never reaches here).
        let st = sound_type_of(Some(b)).with_key();
        let p = at.unwrap_or([x + 0.5, y + 0.5, z + 0.5]);
        self.play(
            host,
            &st.step,
            Some(p[0]),
            Some(p[1]),
            Some(p[2]),
            st.volume * 0.15,
            st.pitch,
            &PlaySoundOpts { category: Some(SoundCategory::Name("player".to_string())), ..Default::default() },
        );
    }

    /// JS: `playFall(damage, x, y, z, state)` â€” fall thud, then landing sound.
    pub fn play_fall(
        &mut self,
        host: &mut dyn SoundHost,
        damage: f64,
        x: f64,
        y: f64,
        z: f64,
        block: Option<&BlockSoundInfo>,
    ) {
        self.play(
            host,
            if damage > 4.0 { "entity.player.big_fall" } else { "entity.player.small_fall" },
            Some(x),
            Some(y),
            Some(z),
            1.0,
            1.0,
            &PlaySoundOpts { category: Some(SoundCategory::Name("player".to_string())), ..Default::default() },
        );
        if let Some(b) = block {
            let st = sound_type_of(Some(b)).with_key();
            self.play(
                host,
                &st.fall,
                Some(x),
                Some(y),
                Some(z),
                st.volume * 0.5,
                st.pitch * 0.75,
                &PlaySoundOpts { category: Some(SoundCategory::Name("player".to_string())), ..Default::default() },
            );
        }
    }

    /// JS: `playLoop(name, x, y, z, opts)` â€” ITickableSound.
    pub fn play_loop(
        &mut self,
        host: &mut dyn SoundHost,
        name: &str,
        x: f64,
        y: f64,
        z: f64,
        opts: &LoopOpts,
    ) -> Option<u64> {
        let def = self.pick(&sound_asset_name(name), &mut Default::default())?;
        let cat = opts.category.clone().unwrap_or_else(|| category_of(name).to_string());
        let generation = self.generation;
        let cat_vol = self.volume_for(host, &cat);
        let base = def.volume * cat_vol;
        let audio = self.audio.as_mut()?;
        let buf = match self.buffers.get(&def.file) {
            Some(cached) => *cached,
            None => {
                let decoded = host
                    .read_sound(&format!("{}.ogg", def.file))
                    .and_then(|bytes| audio.decode(&bytes));
                self.buffers.insert(def.file.clone(), decoded);
                decoded
            }
        }?;
        if generation != self.generation {
            return None;
        }
        let voice = audio.play(
            buf,
            &PlayOpts {
                volume: 0.0,
                pitch: def.pitch,
                pos: if opts.global { None } else { Some([x, y, z]) },
                max_distance: 16.0,
                loop_: true,
            },
        )?;
        let token = self.next_token;
        self.next_token += 1;
        self.playing.push(Playing {
            token,
            name: name.to_string(),
            category: cat,
            voice,
            entity: None,
            base,
            def_pitch: def.pitch,
            is_loop: true,
        });
        Some(token)
    }

    /// JS: `playBlockHit` â€” `(st[3] + 1) / 8`, pitch Ã— 0.5, NEUTRAL.
    pub fn play_block_hit(&mut self, host: &mut dyn SoundHost, x: f64, y: f64, z: f64, block: &BlockSoundInfo) {
        let st = sound_type_of(Some(block)).with_key();
        self.play(
            host,
            &st.hit,
            Some(x + 0.5),
            Some(y + 0.5),
            Some(z + 0.5),
            (st.volume + 1.0) / 8.0,
            st.pitch * 0.5,
            &PlaySoundOpts { category: Some(SoundCategory::Name("neutral".to_string())), ..Default::default() },
        );
    }

    /// JS: `playBlockBreak` â€” `(st[3] + 1) / 2`, pitch Ã— 0.8, block.
    pub fn play_block_break(&mut self, host: &mut dyn SoundHost, x: f64, y: f64, z: f64, block: &BlockSoundInfo) {
        let st = sound_type_of(Some(block)).with_key();
        self.play(
            host,
            &st.break_sound,
            Some(x + 0.5),
            Some(y + 0.5),
            Some(z + 0.5),
            (st.volume + 1.0) / 2.0,
            st.pitch * 0.8,
            &PlaySoundOpts { category: Some(SoundCategory::Name("block".to_string())), ..Default::default() },
        );
    }

    /// JS: `playBlockPlace`.
    pub fn play_block_place(&mut self, host: &mut dyn SoundHost, x: f64, y: f64, z: f64, block: &BlockSoundInfo) {
        let st = sound_type_of(Some(block)).with_key();
        self.play(
            host,
            &st.place,
            Some(x + 0.5),
            Some(y + 0.5),
            Some(z + 0.5),
            (st.volume + 1.0) / 2.0,
            st.pitch * 0.8,
            &PlaySoundOpts { category: Some(SoundCategory::Name("block".to_string())), ..Default::default() },
        );
    }

    /// JS: `_mobSounds(e)` â€” hurt/death event pair for a mob.
    pub fn mob_sounds(name: &str, size: f64) -> Option<[String; 2]> {
        if name == "armor_stand" {
            return Some(["entity.armor_stand.hit".to_string(), "entity.armor_stand.break".to_string()]);
        }
        if name == "slime" || name == "magma_cube" {
            // JS: `E(name).map(s => (e.size || 1) > 1 ? s : s + '_small')`
            let suffix = if size > 1.0 { "" } else { "_small" };
            return Some([
                format!("entity.{name}.hurt{suffix}"),
                format!("entity.{name}.death{suffix}"),
            ]);
        }
        // JS: `E(SOUND_ALIASES[name] || name || 'generic')`
        // JS: `const SOUND_ALIASES = { cave_spider: 'spider', giant: 'hostile', mooshroom: 'cow', ocelot: 'cat', pufferfish: 'puffer_fish' };`
        const SOUND_ALIASES: [(&str, &str); 5] = [
            ("cave_spider", "spider"),
            ("giant", "hostile"),
            ("mooshroom", "cow"),
            ("ocelot", "cat"),
            ("pufferfish", "puffer_fish"),
        ];
        let aliased = SOUND_ALIASES.iter().find(|(from, _)| *from == name).map(|(_, to)| *to);
        let key = aliased.unwrap_or(if name.is_empty() { "generic" } else { name });
        Some([format!("entity.{key}.hurt"), format!("entity.{key}.death")])
    }

    /// JS: `_mobCategory(e)`.
    pub fn mob_category(kind: &str, name: &str) -> &'static str {
        if kind == "player" {
            return "player";
        }
        if is_hostile_type(name) {
            "hostile"
        } else {
            "neutral"
        }
    }

    /// JS: `playEntityHurt(e)`.
    pub fn play_entity_hurt(&mut self, host: &mut dyn SoundHost, e: &EntitySoundEvent) {
        if e.silent {
            return;
        }
        if e.kind == "player" {
            let pitch = (self.rng.random() - self.rng.random()) * 0.2 + 1.0;
            self.play(
                host,
                "entity.player.hurt",
                Some(e.x),
                Some(e.y),
                Some(e.z),
                1.0,
                pitch,
                &PlaySoundOpts { category: Some(SoundCategory::Name("player".to_string())), ..Default::default() },
            );
            return;
        }
        if let Some(sounds) = Self::mob_sounds(&e.entity_name, e.size) {
            let pitch = (self.rng.random() - self.rng.random()) * 0.2 + if e.child { 1.5 } else { 1.0 };
            self.play(
                host,
                &sounds[0],
                Some(e.x),
                Some(e.y),
                Some(e.z),
                1.0,
                pitch,
                &PlaySoundOpts { category: Some(SoundCategory::Name(Self::mob_category(&e.kind, &e.entity_name).to_string())), ..Default::default() },
            );
        }
    }

    /// JS: `playEntityDeath(e)`.
    pub fn play_entity_death(&mut self, host: &mut dyn SoundHost, e: &EntitySoundEvent) {
        if e.silent {
            return;
        }
        if e.kind == "player" {
            let pitch = (self.rng.random() - self.rng.random()) * 0.2 + 1.0;
            self.play(
                host,
                "entity.player.death",
                Some(e.x),
                Some(e.y),
                Some(e.z),
                1.0,
                pitch,
                &PlaySoundOpts { category: Some(SoundCategory::Name("player".to_string())), ..Default::default() },
            );
            return;
        }
        if let Some(sounds) = Self::mob_sounds(&e.entity_name, e.size) {
            let pitch = (self.rng.random() - self.rng.random()) * 0.2 + if e.child { 1.5 } else { 1.0 };
            self.play(
                host,
                &sounds[1],
                Some(e.x),
                Some(e.y),
                Some(e.z),
                1.0,
                pitch,
                &PlaySoundOpts { category: Some(SoundCategory::Name(Self::mob_category(&e.kind, &e.entity_name).to_string())), ..Default::default() },
            );
        }
    }

    /// JS: `_moodTick()` â€” a cave sound now and then in dark, sky-less air.
    pub fn mood_tick(&mut self, host: &mut dyn SoundHost) {
        if !host.in_world() {
            return;
        }
        // JS: `if (this.ambientCountdown === undefined) this.ambientCountdown = Math.floor(Math.random() * 12000);`
        let countdown = *self.ambient_countdown.get_or_insert((self.rng.random() * 12000.0).floor() as i64);
        if countdown > 0 {
            self.ambient_countdown = Some(countdown - 1);
            return;
        }
        let rd = host.render_distance().min(7);
        let p = host.player_pos();
        let pcx = (p[0].floor() as i64 >> 4) as i32;
        let pcz = (p[2].floor() as i64 >> 4) as i32;
        // JS: `this.lcg = this.lcg === undefined ? (Math.random() * 0x7fffffff) | 0 : this.lcg;`
        let lcg = *self.lcg.get_or_insert((self.rng.random() * 2147483647.0) as i32);
        for _ in 0..10 {
            let cx = pcx + (self.rng.random() * (rd * 2 + 1) as f64).floor() as i32 - rd;
            let cz = pcz + (self.rng.random() * (rd * 2 + 1) as f64).floor() as i32 - rd;
            if !host.is_loaded(cx, cz) {
                continue;
            }
            let lcg = mood_lcg_next(lcg);
            self.lcg = Some(lcg);
            let i = lcg >> 2;
            let [x, y, z] = mood_position(i, cx, cz);
            if host.get_state(x, y, z) != 0 {
                continue;
            }
            let light = host.sky_light(x, y, z).max(host.block_light(x, y, z));
            if light <= (self.rng.random() * 8.0).floor() as i32 && host.sky_light(x, y, z) <= 0 {
                let dx = p[0] - x as f64 - 0.5;
                let dy = p[1] - y as f64 - 0.5;
                let dz = p[2] - z as f64 - 0.5;
                if dx * dx + dy * dy + dz * dz > 4.0 {
                    let pitch = 0.8 + self.rng.random() * 0.2;
                    self.play(
                        host,
                        "ambient.cave",
                        Some(x as f64 + 0.5),
                        Some(y as f64 + 0.5),
                        Some(z as f64 + 0.5),
                        0.7,
                        pitch,
                        &PlaySoundOpts { category: Some(SoundCategory::Name("ambient".to_string())), ..Default::default() },
                    );
                    self.ambient_countdown = Some((self.rng.random() * 12000.0).floor() as i64 + 6000);
                    return;
                }
            }
        }
    }

    /// JS: `onBlockAction(p)` â€” note blocks and pistons.
    pub fn on_block_action(
        &mut self,
        host: &mut dyn SoundHost,
        block: &BlockSoundInfo,
        x: f64,
        y: f64,
        z: f64,
        byte1: i32,
        note_props: Option<(String, f64)>,
    ) {
        if block.name == "note_block" {
            // JS: `const props = getStateProperties(...), inst = props.instrument || 'harp', note = Number(props.note || 0);`
            let (inst, note) = note_props.unwrap_or_else(|| ("harp".to_string(), 0.0));
            let pitch = 2.0f64.powf((note - 12.0) / 12.0);
            self.play(
                host,
                &format!("block.note_block.{inst}"),
                Some(x + 0.5),
                Some(y + 0.5),
                Some(z + 0.5),
                3.0,
                pitch,
                &PlaySoundOpts { category: Some(SoundCategory::Name("record".to_string())), ..Default::default() },
            );
            host.note_particle(x, y, z, note);
        } else if block.name == "piston" || block.name == "sticky_piston" {
            let pitch = self.rng.random() * 0.25 + 0.6;
            self.play(
                host,
                if byte1 == 0 { "block.piston.extend" } else { "block.piston.contract" },
                Some(x + 0.5),
                Some(y + 0.5),
                Some(z + 0.5),
                0.5,
                pitch,
                &PlaySoundOpts { category: Some(SoundCategory::Name("block".to_string())), ..Default::default() },
            );
        }
    }

    /// JS: `onWorldEvent(p)` â€” RenderGlobal.playEvent / broadcastSound.
    pub fn on_world_event(
        &mut self,
        host: &mut dyn SoundHost,
        effect_id: i32,
        data: i32,
        x: f64,
        y: f64,
        z: f64,
        block: Option<&BlockSoundInfo>,
    ) {
        let (cx, cy, cz) = (x + 0.5, y + 0.5, z + 0.5);
        if effect_id == 1010 {
            self.play_record(host, data, cx, cy, cz);
            return;
        }
        if effect_id == 1032 {
            let pitch = self.rng.random() * 0.4 + 0.8;
            self.play(
                host,
                "block.portal.travel",
                Some(0.0),
                Some(0.0),
                Some(0.0),
                0.25,
                pitch,
                &PlaySoundOpts { global: true, category: Some(SoundCategory::Name("master".to_string())), ..Default::default() },
            );
            return;
        }
        if effect_id == 2001 {
            if let Some(b) = block {
                self.play_block_break(host, x, y, z, b);
            }
            return;
        }
        if let Some(gl) = global_event_sound(effect_id) {
            self.play(
                host,
                gl,
                Some(cx),
                Some(cy),
                Some(cz),
                if effect_id == 1028 { 5.0 } else { 1.0 },
                1.0,
                &PlaySoundOpts { global: true, ..Default::default() },
            );
            return;
        }
        if let Some(e) = event_sound(effect_id) {
            let pitch = e.pitch.sample(self.rng.as_mut());
            self.play(host, e.event, Some(cx), Some(cy), Some(cz), e.volume, pitch, &PlaySoundOpts::default());
        }
    }

    /// JS: `playRecord(itemId, x, y, z)`.
    pub fn play_record(&mut self, host: &mut dyn SoundHost, item_id: i32, x: f64, y: f64, z: f64) {
        if let Some(mut record) = self.record.take() {
            record.voice.stop();
        }
        if item_id == 0 {
            return;
        }
        // JS: `const names = { 2256: '13', 2257: 'cat', ... };`
        let n = match item_id {
            2256 => "13",
            2257 => "cat",
            2258 => "blocks",
            2259 => "chirp",
            2260 => "far",
            2261 => "mall",
            2262 => "mellohi",
            2263 => "stal",
            2264 => "strad",
            2265 => "ward",
            2266 => "11",
            2267 => "wait",
            _ => return,
        };
        host.set_action_bar(&format!("\u{a7}dNow playing: C418 - {n}"));
        let token = self.play(
            host,
            &format!("music_disc.{n}"),
            Some(x),
            Some(y),
            Some(z),
            4.0,
            1.0,
            &PlaySoundOpts { category: Some(SoundCategory::Name("record".to_string())), ..Default::default() },
        );
        if let Some(token) = token {
            if let Some(entry) = self.playing.iter_mut().find(|p| p.token() == token) {
                let voice = std::mem::replace(&mut entry.voice, Box::new(NullVoice));
                self.record = Some(RecordState { voice });
            }
        }
    }

    /// JS: `tick()` â€” follow entity-attached voices, cave mood, listener, music.
    pub fn tick(&mut self, host: &mut dyn SoundHost) {
        if self.audio.is_none() {
            return;
        }
        // JS: `for (const h of this.playing) if (h.entity) h.voice.setPosition?.([h.entity.x, ...])`
        let entities: Vec<(usize, [f64; 3])> = self
            .playing
            .iter()
            .enumerate()
            .filter_map(|(i, p)| p.entity.and_then(|e| host.entity_pos(e)).map(|pos| (i, pos)))
            .collect();
        for (i, pos) in entities {
            self.playing[i].voice.set_position(pos);
        }
        self.mood_tick(host);
        // JS: `this.audio.setListener(g.renderer.camPos, f, [0, 1, 0]);`
        let cam = host.cam_pos();
        let forward = host.look_vector();
        if let Some(audio) = self.audio.as_mut() {
            audio.set_listener(cam, forward, [0.0, 1.0, 0.0]);
        }
        self.music_tick(host);
    }

    /// JS: `_musicTick()` â€” delegates to [`crate::music_system`].
    pub fn music_tick(&mut self, host: &mut dyn SoundHost) {
        // JS: `_musicType()` â€” the screen/dimension/creative-flight decision.
        let track = music_type(host.credits_screen(), host.in_world(), host.dimension(), host.end_boss(), host.creative_flight());
        let voice_ended = self
            .music_state
            .music
            .map_or(true, |token| self.playing.iter().all(|p| !p.token_matches(token) || p.voice.ended()));
        let out = music_tick(&mut self.music_state, &track, voice_ended, self.rng.as_mut());
        if let Some(token) = out.stop_voice {
            if let Some(idx) = self.playing.iter().position(|p| p.token_matches(token)) {
                self.playing[idx].voice.stop();
                self.playing.remove(idx);
            }
        }
        if let Some(name) = out.start {
            let token = self.play(
                host,
                &name,
                Some(0.0),
                Some(0.0),
                Some(0.0),
                1.0,
                1.0,
                &PlaySoundOpts { global: true, ..Default::default() },
            );
            music_play_resolved(&mut self.music_state, token, self.rng.as_mut());
        }
    }
}

impl Playing {
    fn token(&self) -> u64 {
        self.token
    }

    fn token_matches(&self, token: u64) -> bool {
        self.token == token
    }
}

// ------------------------------------------------------------ supporting data

/// JS: `play(name, x, y, z, volume, pitch, opts)`'s `opts` object.
#[derive(Debug, Clone, Default)]
pub struct PlaySoundOpts {
    /// JS: `opts.global`.
    pub global: bool,
    /// JS: `opts.category` â€” a SPacketSoundEffect id or a name.
    pub category: Option<SoundCategory>,
    /// JS: `opts.entity` â€” follow target for `tick()` repositioning.
    pub entity: Option<u64>,
}

/// JS: `opts.category` â€” number (SPacketSoundEffect id) or string.
#[derive(Debug, Clone)]
pub enum SoundCategory {
    /// JS: `typeof opts.category === 'number'` â€” a `CATEGORIES` index.
    Id(i32),
    /// JS: a category name.
    Name(String),
}

/// JS: `playLoop`'s `opts` object.
#[derive(Debug, Clone, Default)]
pub struct LoopOpts {
    /// JS: `opts.global`.
    pub global: bool,
    /// JS: `opts.category`.
    pub category: Option<String>,
}

/// JS: the `e` argument of `playEntityHurt`/`playEntityDeath`.
#[derive(Debug, Clone, Default)]
pub struct EntitySoundEvent {
    /// JS: `e.kind` â€” `'player'` or a mob kind.
    pub kind: String,
    /// JS: `e.entityName`.
    pub entity_name: String,
    /// JS: `e.x` / `e.y` / `e.z`.
    pub x: f64,
    /// JS: `e.y`.
    pub y: f64,
    /// JS: `e.z`.
    pub z: f64,
    /// JS: `e.size` (slime/magma_cube scaling).
    pub size: f64,
    /// JS: `e.child`.
    pub child: bool,
    /// JS: `e.silent`.
    pub silent: bool,
}

/// JS: `_pick`'s result â€” `{file, volume, pitch, stream}`.
#[derive(Debug, Clone, PartialEq)]
pub struct Picked {
    /// JS: `pick.name` â€” the sound file (without the `.ogg` suffix).
    pub file: String,
    /// JS: `pick.volume ?? 1`.
    pub volume: f64,
    /// JS: `pick.pitch ?? 1`.
    pub pitch: f64,
    /// JS: `!!pick.stream`.
    pub stream: bool,
}

/// A no-op voice for entries whose box was moved into [`RecordState`].
struct NullVoice;
impl SoundVoice for NullVoice {
    fn stop(&mut self) {}
    fn ended(&self) -> bool {
        true
    }
}

// ---------------------------------------------------------- wasm-bindgen exports

/// JS: `CATEGORIES` for wasm consumers.
#[wasm_bindgen]
pub fn sound_categories() -> Vec<js_sys::JsString> {
    CATEGORIES.iter().map(|c| js_sys::JsString::from(*c)).collect()
}

// ------------------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sound_alg2::SeqRandom;

    struct TestHost {
        master: f64,
        volumes: std::collections::HashMap<String, f64>,
        states: std::collections::HashMap<(i32, i32, i32), i32>,
    }
    impl Default for TestHost {
        fn default() -> Self {
            TestHost {
                master: 1.0,
                volumes: std::collections::HashMap::new(),
                states: std::collections::HashMap::new(),
            }
        }
    }
    impl SoundHost for TestHost {
        fn master_volume(&self) -> f64 {
            self.master
        }
        fn sound_volume(&self, cat: &str) -> Option<f64> {
            self.volumes.get(cat).copied()
        }
        fn show_subtitles(&self) -> bool {
            false
        }
        fn in_world(&self) -> bool {
            true
        }
        fn render_distance(&self) -> i32 {
            8
        }
        fn player_pos(&self) -> [f64; 3] {
            [0.0, 64.0, 0.0]
        }
        fn is_loaded(&self, _cx: i32, _cz: i32) -> bool {
            true
        }
        fn get_state(&self, x: i32, y: i32, z: i32) -> i32 {
            self.states.get(&(x, y, z)).copied().unwrap_or(0)
        }
        fn sky_light(&self, _x: i32, _y: i32, _z: i32) -> i32 {
            0
        }
        fn block_light(&self, _x: i32, _y: i32, _z: i32) -> i32 {
            0
        }
        fn add_subtitle(&mut self, _t: &str, _x: f64, _y: f64, _z: f64) {}
        fn set_action_bar(&mut self, _t: &str) {}
        fn cam_pos(&self) -> [f64; 3] {
            [0.0; 3]
        }
        fn look_vector(&self) -> [f64; 3] {
            [0.0, 0.0, 1.0]
        }
        fn read_sound(&mut self, _f: &str) -> Option<Vec<u8>> {
            Some(vec![1, 2, 3])
        }
        fn entity_pos(&self, _e: u64) -> Option<[f64; 3]> {
            None
        }
    }

    #[derive(Default)]
    struct TraceAudio {
        plays: Vec<(f64, f64, Option<[f64; 3]>, f64, bool)>,
        stopped: usize,
        next: u64,
    }
    impl SoundAudio for TraceAudio {
        fn decode(&mut self, _bytes: &[u8]) -> Option<AudioBuf> {
            self.next += 1;
            Some(AudioBuf(self.next))
        }
        fn play(&mut self, _buf: AudioBuf, opts: &PlayOpts) -> Option<Box<dyn SoundVoice>> {
            self.plays.push((opts.volume, opts.pitch, opts.pos, opts.max_distance, opts.loop_));
            Some(Box::new(CountingVoice))
        }
        fn set_listener(&mut self, _p: [f64; 3], _f: [f64; 3], _u: [f64; 3]) {}
    }

    struct CountingVoice;
    impl SoundVoice for CountingVoice {
        fn stop(&mut self) {}
        fn ended(&self) -> bool {
            false
        }
    }

    /// A SoundAudio that records into a shared TraceAudio so tests can assert.
    struct SharedAudio(std::rc::Rc<std::cell::RefCell<TraceAudio>>);
    impl SoundAudio for SharedAudio {
        fn decode(&mut self, bytes: &[u8]) -> Option<AudioBuf> {
            self.0.borrow_mut().decode(bytes)
        }
        fn play(&mut self, buf: AudioBuf, opts: &PlayOpts) -> Option<Box<dyn SoundVoice>> {
            self.0.borrow_mut().play(buf, opts)
        }
        fn set_listener(&mut self, p: [f64; 3], f: [f64; 3], u: [f64; 3]) {
            self.0.borrow_mut().set_listener(p, f, u)
        }
    }

    // JS: soundTypeOf cascade order.
    #[test]
    fn sound_type_cascade() {
        let table = sound_types();
        assert_eq!(sound_type_of(None), table["stone"]);
        let anvil = BlockSoundInfo { name: "anvil".into(), ..Default::default() };
        assert_eq!(sound_type_of(Some(&anvil)).volume, 0.3);
        let glass = BlockSoundInfo { name: "redstone_lamp".into(), ..Default::default() };
        assert_eq!(sound_type_of(Some(&glass)).with_key().step, "block.glass.step");
        let wood = BlockSoundInfo { name: "oak_planks".into(), ..Default::default() };
        assert_eq!(sound_type_of(Some(&wood)).with_key().step, "block.wood.step");
        let wool = BlockSoundInfo { name: "white_wool".into(), ..Default::default() };
        assert_eq!(sound_type_of(Some(&wool)).with_key().step, "block.cloth.step");
        let ore = BlockSoundInfo { name: "iron_ore".into(), ..Default::default() };
        assert_eq!(sound_type_of(Some(&ore)).with_key().step, "block.stone.step"); // ore$ excluded from metal
        let metal = BlockSoundInfo { name: "iron_block".into(), ..Default::default() };
        assert_eq!(sound_type_of(Some(&metal)).pitch, 1.5);
        let material = BlockSoundInfo { name: "custom".into(), material: Some("wool".into()), ..Default::default() };
        assert_eq!(sound_type_of(Some(&material)).with_key().step, "block.cloth.step");
    }

    // JS: `volumeFor` â€” per-category times master.
    #[test]
    fn volume_for_category() {
        let mut host = TestHost::default();
        host.volumes.insert("block".to_string(), 0.5);
        host.master = 0.8;
        let m = SoundManager::new(None, Box::new(SeqRandom::new(&[])));
        assert!((m.volume_for(&host, "master") - 0.8).abs() < 1e-12);
        assert!((m.volume_for(&host, "block") - 0.4).abs() < 1e-12);
        assert!((m.volume_for(&host, "weather") - 0.8).abs() < 1e-12); // unset â†’ 1
    }

    // JS: `_pick` weighted walk with event recursion.
    #[test]
    fn pick_weighted_with_events() {
        let mut defs = serde_json::Map::new();
        defs.insert(
            "custom.test".to_string(),
            serde_json::json!({ "sounds": [ "custom.a", { "name": "custom.other", "weight": 3.0 } ] }),
        );
        let mut m = SoundManager::new(None, Box::new(SeqRandom::new(&[0.9])));
        m.defs = Some(defs);
        // draw 0.9 Ã— total 4 = 3.6 â†’ second entry (weight 3) wins.
        let picked = m.pick("custom.test", &mut Default::default()).unwrap();
        assert_eq!(picked.file, "custom.other");
        assert_eq!(picked.volume, 1.0);
        // draw 0.1 Ã— 4 = 0.4 â†’ first entry (weight 1) wins.
        let mut m2 = SoundManager::new(None, Box::new(SeqRandom::new(&[0.1])));
        m2.defs = m.defs.clone();
        assert_eq!(m2.pick("custom.test", &mut Default::default()).unwrap().file, "custom.a");
    }

    // JS: `play` â€” category resolution and voice parameters.
    #[test]
    fn play_voice_parameters() {
        let mut defs = serde_json::Map::new();
        defs.insert(
            "block.stone.break".to_string(),
            serde_json::json!({ "sounds": [{ "name": "random.dig_stone", "volume": 0.5, "pitch": 1.2 }] }),
        );
        let audio = std::rc::Rc::new(std::cell::RefCell::new(TraceAudio::default()));
        let mut host = TestHost::default();
        host.volumes.insert("block".to_string(), 0.5);
        let mut m = SoundManager::new(Some(Box::new(SharedAudio(audio.clone()))), Box::new(SeqRandom::new(&[0.0])));
        m.defs = Some(defs);
        let token = m.play(
            &mut host,
            "block.stone.break",
            Some(1.0),
            Some(2.0),
            Some(3.0),
            2.0, // clamped to 1 by voice_volume
            1.0,
            &PlaySoundOpts::default(),
        );
        assert!(token.is_some());
        let plays = audio.borrow().plays.clone();
        // volume = min(1, 2) * 0.5 * 0.5 = 0.25; pitch = clamp(1.0 * 1.2) = 1.2
        assert!((plays[0].0 - 0.25).abs() < 1e-12);
        assert!((plays[0].1 - 1.2).abs() < 1e-12);
        assert_eq!(plays[0].2, Some([1.0, 2.0, 3.0]));
        assert!((plays[0].3 - 32.0).abs() < 1e-12); // max(16, 2 * 16)
        // Muted category â†’ no voice.
        host.volumes.insert("block".to_string(), 0.0);
        let muted = m.play(&mut host, "block.stone.break", Some(1.0), Some(2.0), Some(3.0), 1.0, 1.0, &PlaySoundOpts::default());
        assert!(muted.is_none());
    }

    // JS: `stopAll` bumps the generation; a stale in-flight play is discarded.
    #[test]
    fn stop_all_generation_guard() {
        let mut defs = serde_json::Map::new();
        defs.insert(
            "custom.s".to_string(),
            serde_json::json!({ "sounds": ["custom.a"] }),
        );
        let mut host = TestHost::default();
        let mut m = SoundManager::new(Some(Box::new(SharedAudio(Default::default()))), Box::new(SeqRandom::new(&[0.0])));
        m.defs = Some(defs);
        assert!(m.play(&mut host, "custom.s", None, None, None, 1.0, 1.0, &PlaySoundOpts { global: true, ..Default::default() }).is_some());
        assert_eq!(m.playing.len(), 1);
        m.stop_all();
        // JS: the constructor's reload() already ran stopAll once (generation 1);
        // this explicit stopAll makes it 2.
        assert_eq!(m.generation, 2);
        assert!(m.playing.is_empty());
    }

    // JS: `playRecord` disc map and action bar text.
    #[test]
    fn play_record_map() {
        #[derive(Default)]
        struct BarHost {
            inner: TestHost,
            bars: Vec<String>,
        }
        impl SoundHost for BarHost {
            fn master_volume(&self) -> f64 {
                self.inner.master_volume()
            }
            fn sound_volume(&self, c: &str) -> Option<f64> {
                self.inner.sound_volume(c)
            }
            fn show_subtitles(&self) -> bool {
                false
            }
            fn in_world(&self) -> bool {
                true
            }
            fn render_distance(&self) -> i32 {
                8
            }
            fn player_pos(&self) -> [f64; 3] {
                [0.0; 3]
            }
            fn is_loaded(&self, _c: i32, _z: i32) -> bool {
                true
            }
            fn get_state(&self, _x: i32, _y: i32, _z: i32) -> i32 {
                0
            }
            fn sky_light(&self, _x: i32, _y: i32, _z: i32) -> i32 {
                0
            }
            fn block_light(&self, _x: i32, _y: i32, _z: i32) -> i32 {
                0
            }
            fn add_subtitle(&mut self, _t: &str, _x: f64, _y: f64, _z: f64) {}
            fn set_action_bar(&mut self, t: &str) {
                self.bars.push(t.to_string());
            }
            fn cam_pos(&self) -> [f64; 3] {
                [0.0; 3]
            }
            fn look_vector(&self) -> [f64; 3] {
                [0.0; 3]
            }
            fn read_sound(&mut self, _f: &str) -> Option<Vec<u8>> {
                Some(vec![1])
            }
            fn entity_pos(&self, _e: u64) -> Option<[f64; 3]> {
                None
            }
        }
        let mut defs = serde_json::Map::new();
        defs.insert("music_disc.cat".to_string(), serde_json::json!({ "sounds": ["records/cat"] }));
        let mut host = BarHost::default();
        let mut m = SoundManager::new(Some(Box::new(SharedAudio(Default::default()))), Box::new(SeqRandom::new(&[0.0])));
        m.defs = Some(defs);
        m.play_record(&mut host, 2257, 1.0, 2.0, 3.0);
        assert_eq!(host.bars, vec!["\u{a7}dNow playing: C418 - cat"]);
        assert!(m.record.is_some());
        // Unknown id â†’ nothing.
        m.record = None;
        m.play_record(&mut host, 9999, 0.0, 0.0, 0.0);
        assert!(m.record.is_none());
        assert_eq!(host.bars.len(), 1);
    }

    // JS: CATEGORIES order matters for SPacketSoundEffect ids.
    #[test]
    fn category_ids_match_js_order() {
        assert_eq!(CATEGORIES[3], "weather");
        assert_eq!(CATEGORIES[9], "voice");
    }
}
