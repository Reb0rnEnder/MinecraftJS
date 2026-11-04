//! Port of `client/js/gui/screens/options.js` — the option-definition layer.
//!
//! options.js mixes two halves. This module ports the *pure* half:
//! `nativeOption` (the accessibility/mouse option switch), `makeOption`
//! (widget geometry), the video option table from `VideoScreen.init`,
//! `KEY_BINDINGS` and the `VANILLA_UI` option-key lists it reads
//! (client/js/gui/vanilla-layout.js), plus the settings defaults those
//! screens read and write (client/js/game/settings.js).
//!
//! The screen classes themselves (rendering, widget instances, DOM events)
//! live in [`crate::options_screen`]; the shared maths (slider mapping,
//! labels, list geometry) in [`crate::options_alg`].

use std::collections::HashMap;

use wasm_bindgen::prelude::*;

use crate::options_alg::{
    chat_opacity_label_value, difficulty_name, mouse_wheel_label_value, mouse_wheel_set,
    mouse_wheel_value, narrator_cycle, narrator_label, on_off, percent_label_value,
    sensitivity_label_value, strip_error_prefix, tr, tr_option, GraphicsApi, WidgetRect,
};

// -------------------------------------------------------------- option ids

// JS: const GameOptionsIds = { REALMS_NOTIFICATIONS: 30 };
pub mod game_options_ids {
    pub const REALMS_NOTIFICATIONS: i32 = 30;
}

// --------------------------------------------------- VANILLA_UI option lists

// JS: VANILLA_UI.accessibilityOptions (client/js/gui/vanilla-layout.js).
pub const ACCESSIBILITY_OPTIONS: [&str; 8] = [
    "options.narrator",
    "options.showSubtitles",
    "options.accessibility.text_background_opacity",
    "options.accessibility.text_background",
    "options.chat.opacity",
    "options.autoJump",
    "key.sneak",
    "key.sprint",
];

// JS: VANILLA_UI.mouseOptions.
pub const MOUSE_OPTIONS: [&str; 5] = [
    "options.sensitivity",
    "options.invertMouse",
    "options.mouseWheelSensitivity",
    "options.discrete_mouse_scroll",
    "options.touchscreen",
];

// JS: VANILLA_UI.chatOptions (resolved through chatOption, client/js/gui/chat-options.js).
pub const CHAT_OPTIONS: [&str; 13] = [
    "options.chat.visibility",
    "options.chat.color",
    "options.chat.links",
    "options.chat.links.prompt",
    "options.chat.opacity",
    "options.accessibility.text_background_opacity",
    "options.chat.scale",
    "options.chat.width",
    "options.chat.height.focused",
    "options.chat.height.unfocused",
    "options.reducedDebugInfo",
    "options.autoSuggestCommands",
    "options.narrator",
];

// JS: VANILLA_UI.videoOptions — GameSettings.Options in 1.14.4 order.
pub const VIDEO_OPTION_KEYS: [&str; 15] = [
    "options.biomeBlendRadius",
    "options.graphics",
    "options.renderDistance",
    "options.ao",
    "options.framerateLimit",
    "options.vsync",
    "options.viewBobbing",
    "options.guiScale",
    "options.attackIndicator",
    "options.gamma",
    "options.renderClouds",
    "options.fullscreen",
    "options.particles",
    "options.mipmapLevels",
    "options.entityShadows",
];

// JS: VANILLA_UI.categoryOrder.
pub const CATEGORY_ORDER: [&str; 7] = [
    "key.categories.movement",
    "key.categories.gameplay",
    "key.categories.inventory",
    "key.categories.creative",
    "key.categories.multiplayer",
    "key.categories.ui",
    "key.categories.misc",
];

// --------------------------------------------------------- native settings

/// JS: `screen.s` — the `game.settings` fields read or written by the option
/// screens, with the defaults from `client/js/game/settings.js` (`DEFAULTS`).
/// Narrator availability and difficulty stay game-side (browser-bound); the
/// screens take them as call arguments.
#[derive(Clone, Debug)]
pub struct Settings {
    pub fov: i32,
    pub sensitivity: f64,
    pub mouse_wheel_sensitivity: f64,
    pub discrete_mouse_scroll: bool,
    pub text_background_opacity: f64,
    pub text_background_only_chat: bool,
    pub invert_mouse: bool,
    pub touchscreen: bool,
    pub toggle_crouch: bool,
    pub toggle_sprint: bool,
    pub auto_jump: bool,
    pub show_subtitles: bool,
    /// JS: s.realmsNotifications — `init` also defaults `undefined` to true
    /// on the title screen; the Rust field always exists.
    pub realms_notifications: bool,
    pub snooper_enabled: bool,
    pub force_unicode_font: bool,
    pub render_distance: i32,
    pub biome_blend_radius: i32,
    pub gui_scale: i32,
    pub gamma: f64,
    pub view_bobbing: bool,
    pub clouds: i32,
    pub fancy_graphics: bool,
    pub smooth_lighting: i32,
    pub enable_vsync: bool,
    pub mipmap_levels: i32,
    pub max_fps: i32,
    pub particles: i32,
    pub attack_indicator: i32,
    pub entity_shadows: bool,
    pub lod_distance: i32,
    pub super_potato: bool,
    pub graphics_api: GraphicsApi,
    pub master_volume: f64,
    pub sound_volumes: HashMap<String, f64>,
    pub chat_opacity: f64,
    pub chat_scale: f64,
    pub chat_width: f64,
    pub chat_height_focused: f64,
    pub chat_height_unfocused: f64,
    pub chat_visibility: i32,
    pub chat_colors: bool,
    pub chat_links: bool,
    pub chat_links_prompt: bool,
    pub auto_suggest_commands: bool,
    pub reduced_debug_info: bool,
    pub narrator: i32,
    pub skin_parts: u32,
    pub main_hand: String,
    pub keys: Vec<(String, String)>,
}

impl Default for Settings {
    // JS: const DEFAULTS = { ... } (client/js/game/settings.js).
    fn default() -> Settings {
        Settings {
            fov: 70,
            sensitivity: 0.5,
            mouse_wheel_sensitivity: 1.0,
            discrete_mouse_scroll: false,
            text_background_opacity: 0.5,
            text_background_only_chat: true,
            invert_mouse: false,
            touchscreen: false,
            toggle_crouch: false,
            toggle_sprint: false,
            auto_jump: true,
            show_subtitles: false,
            realms_notifications: true,
            snooper_enabled: true,
            force_unicode_font: false,
            render_distance: 8,
            biome_blend_radius: 2,
            gui_scale: 0,
            gamma: 0.5,
            view_bobbing: true,
            clouds: 2,
            fancy_graphics: true,
            smooth_lighting: 2,
            enable_vsync: true,
            mipmap_levels: 4,
            max_fps: 0,
            particles: 0,
            attack_indicator: 1,
            entity_shadows: true,
            lod_distance: 128,
            super_potato: false,
            graphics_api: GraphicsApi::Webgl2,
            master_volume: 1.0,
            sound_volumes: DEFAULT_SOUND_VOLUMES.iter().map(|(k, v)| (k.to_string(), *v)).collect(),
            chat_opacity: 1.0,
            chat_scale: 1.0,
            chat_width: 1.0,
            chat_height_focused: 1.0,
            chat_height_unfocused: 0.44366196,
            chat_visibility: 0,
            chat_colors: true,
            chat_links: true,
            chat_links_prompt: true,
            auto_suggest_commands: true,
            reduced_debug_info: false,
            narrator: 0,
            skin_parts: 0x7f,
            main_hand: "right".to_string(),
            keys: DEFAULT_KEYS.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
        }
    }
}

// JS: DEFAULTS.soundVolumes = { music: 0, record: 1, weather: 1, block: 1, hostile: 1, neutral: 1, player: 1, ambient: 1, voice: 1 }
const DEFAULT_SOUND_VOLUMES: [(&str, f64); 9] = [
    ("music", 0.0),
    ("record", 1.0),
    ("weather", 1.0),
    ("block", 1.0),
    ("hostile", 1.0),
    ("neutral", 1.0),
    ("player", 1.0),
    ("ambient", 1.0),
    ("voice", 1.0),
];

// JS: for (const k of ['music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient', 'voice'])
pub const SOUND_CATEGORIES: [&str; 9] = [
    "music", "record", "weather", "block", "hostile", "neutral", "player", "ambient", "voice",
];

impl Settings {
    // JS: s.soundVolumes[k] !== undefined ? s.soundVolumes[k] : 1
    pub fn sound_volume(&self, category: &str) -> f64 {
        self.sound_volumes.get(category).copied().unwrap_or(1.0)
    }

    // JS: s.soundVolumes[k] = v
    pub fn set_sound_volume(&mut self, category: &str, v: f64) {
        self.sound_volumes.insert(category.to_string(), v);
    }

    // JS: s.keys[k]
    pub fn key(&self, binding: &str) -> Option<&str> {
        self.keys.iter().find(|(k, _)| k == binding).map(|(_, v)| v.as_str())
    }

    // JS: s.keys[k] = code (assignment creates the entry)
    pub fn set_key(&mut self, binding: &str, code: &str) {
        match self.keys.iter_mut().find(|(k, _)| k == binding) {
            Some(entry) => entry.1 = code.to_string(),
            None => self.keys.push((binding.to_string(), code.to_string())),
        }
    }

    // JS: s.keys = { ...DEFAULT_KEYS }
    pub fn reset_keys(&mut self) {
        self.keys = DEFAULT_KEYS.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
    }

    // JS: s.keys[e.key] !== DEFAULT_KEYS[e.key] — a missing entry counts as changed
    // (undefined !== value), so it is NOT the default.
    pub fn key_is_default(&self, binding: &str) -> bool {
        match self.key(binding) {
            Some(code) => code == default_key(binding),
            None => false,
        }
    }
}

// ------------------------------------------------------- native option kinds

/// JS: the settings boolean fields the toggle arms of `nativeOption` flip.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BoolField {
    ShowSubtitles,
    AutoJump,
    InvertMouse,
    Touchscreen,
    DiscreteMouseScroll,
    ToggleCrouch,
    ToggleSprint,
}

/// JS: the 0..1 settings float fields the generic `slider(name, field)` arm drives.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UnitField {
    TextBackgroundOpacity,
}

/// Port of the descriptor objects `nativeOption(screen, key)` returns, as data.
/// Each variant names the JS switch arm it mirrors; the label/click/value/set
/// methods below reproduce the arrow functions.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OptionType {
    // JS: case 'options.narrator': return { label: g.narrator.label(), enabled: g.narrator.active, click: g.narrator.cycle() };
    Narrator,
    // JS: const toggle = (name, field) => ({ label: () => trOption(name, onOff(s[field])), click: () => { s[field] = !s[field]; } });
    Toggle { name: &'static str, field: BoolField },
    // JS: case 'key.sneak': case 'key.sprint' — toggle/hold switch over toggleCrouch/toggleSprint.
    KeyToggle { name: &'static str, field: BoolField },
    // JS: const slider = (name, field) => ({ slider: true, label: v => trOption(name, Math.round(v * 100) + '%'), value: () => s[field], set: v => { s[field] = v; } });
    PercentSlider { name: &'static str, field: UnitField },
    // JS: case 'options.sensitivity' — min/max/percent(×200) label, raw 0..1 value.
    Sensitivity,
    // JS: case 'options.mouseWheelSensitivity' — 10 ** (v * 2 - 1) mapping.
    MouseWheelSensitivity,
    // JS: case 'options.accessibility.text_background' — chat vs everywhere.
    TextBackground,
    // JS: case 'options.chat.opacity' — label Math.round((v * .9 + .1) * 100) + '%'.
    ChatOpacity,
}

impl OptionType {
    // JS: it.slider
    pub fn is_slider(&self) -> bool {
        matches!(
            self,
            OptionType::PercentSlider { .. }
                | OptionType::Sensitivity
                | OptionType::MouseWheelSensitivity
                | OptionType::ChatOpacity
        )
    }

    // JS: it.enabled — only the narrator option can be disabled (g.narrator.active).
    pub fn enabled(&self, narrator_active: bool) -> bool {
        match self {
            OptionType::Narrator => narrator_active,
            _ => true,
        }
    }

    // JS: it.label() for buttons — narrator_mode/active stand in for g.narrator.
    pub fn label(&self, s: &Settings, narrator_mode: i32, narrator_active: bool) -> String {
        match self {
            OptionType::Narrator => narrator_label(narrator_mode, narrator_active),
            OptionType::Toggle { name, field } => tr_option(name, &on_off(s.bool_field(*field))),
            OptionType::KeyToggle { name, field } => tr_option(
                name,
                &tr(if s.bool_field(*field) { "options.key.toggle" } else { "options.key.hold" }),
            ),
            OptionType::TextBackground => tr_option(
                "options.accessibility.text_background",
                &tr(if s.text_background_only_chat {
                    "options.accessibility.text_background.chat"
                } else {
                    "options.accessibility.text_background.everywhere"
                }),
            ),
            // Buttons never read slider values; mirror the current-value label.
            _ => {
                let v = self.value(s);
                self.slider_label(v)
            }
        }
    }

    // JS: it.label(v) for sliders — v is the slider position (0..1), not the setting.
    pub fn slider_label(&self, v: f64) -> String {
        match self {
            OptionType::PercentSlider { name, .. } => tr_option(name, &percent_label_value(v)),
            OptionType::Sensitivity => tr_option("options.sensitivity", &sensitivity_label_value(v)),
            OptionType::MouseWheelSensitivity => {
                tr_option("options.mouseWheelSensitivity", &mouse_wheel_label_value(v))
            }
            OptionType::ChatOpacity => tr_option("options.chat.opacity", &chat_opacity_label_value(v)),
            _ => String::new(),
        }
    }

    // JS: it.value() — slider position from the settings.
    pub fn value(&self, s: &Settings) -> f64 {
        match self {
            OptionType::PercentSlider { field, .. } => s.unit_field(*field),
            OptionType::Sensitivity => s.sensitivity,
            OptionType::MouseWheelSensitivity => mouse_wheel_value(s.mouse_wheel_sensitivity),
            OptionType::ChatOpacity => s.chat_opacity,
            _ => 0.0,
        }
    }

    // JS: it.set(v) — settings from the slider position.
    pub fn set(&self, s: &mut Settings, v: f64) {
        match self {
            OptionType::PercentSlider { field, .. } => s.set_unit_field(*field, v),
            OptionType::Sensitivity => s.sensitivity = v,
            OptionType::MouseWheelSensitivity => s.mouse_wheel_sensitivity = mouse_wheel_set(v),
            OptionType::ChatOpacity => s.chat_opacity = v,
            _ => {}
        }
    }

    // JS: it.click() — applies the state change. Returns the new narrator mode
    // (only meaningful for [`OptionType::Narrator`]; `narrator_cycle` keeps the
    // mode when speech is unavailable).
    pub fn click(&self, s: &mut Settings, narrator_mode: i32, narrator_active: bool) -> i32 {
        match self {
            OptionType::Narrator => {
                let next = narrator_cycle(narrator_mode, narrator_active);
                s.narrator = next;
                next
            }
            OptionType::Toggle { field, .. } | OptionType::KeyToggle { field, .. } => {
                let v = s.bool_field(*field);
                s.set_bool_field(*field, !v);
                narrator_mode
            }
            OptionType::TextBackground => {
                s.text_background_only_chat = !s.text_background_only_chat;
                narrator_mode
            }
            _ => narrator_mode,
        }
    }
}

impl Settings {
    pub fn bool_field(&self, field: BoolField) -> bool {
        match field {
            BoolField::ShowSubtitles => self.show_subtitles,
            BoolField::AutoJump => self.auto_jump,
            BoolField::InvertMouse => self.invert_mouse,
            BoolField::Touchscreen => self.touchscreen,
            BoolField::DiscreteMouseScroll => self.discrete_mouse_scroll,
            BoolField::ToggleCrouch => self.toggle_crouch,
            BoolField::ToggleSprint => self.toggle_sprint,
        }
    }

    pub fn set_bool_field(&mut self, field: BoolField, v: bool) {
        match field {
            BoolField::ShowSubtitles => self.show_subtitles = v,
            BoolField::AutoJump => self.auto_jump = v,
            BoolField::InvertMouse => self.invert_mouse = v,
            BoolField::Touchscreen => self.touchscreen = v,
            BoolField::DiscreteMouseScroll => self.discrete_mouse_scroll = v,
            BoolField::ToggleCrouch => self.toggle_crouch = v,
            BoolField::ToggleSprint => self.toggle_sprint = v,
        }
    }

    pub fn unit_field(&self, field: UnitField) -> f64 {
        match field {
            UnitField::TextBackgroundOpacity => self.text_background_opacity,
        }
    }

    pub fn set_unit_field(&mut self, field: UnitField, v: f64) {
        match field {
            UnitField::TextBackgroundOpacity => self.text_background_opacity = v,
        }
    }
}

// JS: function nativeOption(screen, key) { switch (key) { ... default: throw Error('Missing native option ' + key); } }
// `None` marks the JS throw site.
pub fn native_option(key: &str) -> Option<OptionType> {
    match key {
        "options.narrator" => Some(OptionType::Narrator),
        "options.showSubtitles" => {
            Some(OptionType::Toggle { name: "options.showSubtitles", field: BoolField::ShowSubtitles })
        }
        "options.autoJump" => Some(OptionType::Toggle { name: "options.autoJump", field: BoolField::AutoJump }),
        "key.sneak" => Some(OptionType::KeyToggle { name: "key.sneak", field: BoolField::ToggleCrouch }),
        "key.sprint" => Some(OptionType::KeyToggle { name: "key.sprint", field: BoolField::ToggleSprint }),
        "options.invertMouse" => {
            Some(OptionType::Toggle { name: "options.invertMouse", field: BoolField::InvertMouse })
        }
        "options.touchscreen" => {
            Some(OptionType::Toggle { name: "options.touchscreen", field: BoolField::Touchscreen })
        }
        "options.discrete_mouse_scroll" => Some(OptionType::Toggle {
            name: "options.discrete_mouse_scroll",
            field: BoolField::DiscreteMouseScroll,
        }),
        "options.sensitivity" => Some(OptionType::Sensitivity),
        "options.mouseWheelSensitivity" => Some(OptionType::MouseWheelSensitivity),
        "options.accessibility.text_background_opacity" => Some(OptionType::PercentSlider {
            name: "options.accessibility.text_background_opacity",
            field: UnitField::TextBackgroundOpacity,
        }),
        "options.accessibility.text_background" => Some(OptionType::TextBackground),
        "options.chat.opacity" => Some(OptionType::ChatOpacity),
        _ => None,
    }
}

// ------------------------------------------------------- makeOption geometry

/// JS: the widget `makeOption` returns (client/js/gui/widgets.js Button/Slider).
/// Labels, click handlers and tooltips stay browser-bound; this is the
/// geometry + state the screens lay out.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct OptionWidget {
    pub id: usize,
    pub rect: WidgetRect,
    pub slider: bool,
    pub wide: bool,
    pub enabled: bool,
}

// JS: function makeOption(id, x, y, it) {
//   const w = it.wide ? 310 : 150; // wide controls span both columns (e.g. master volume)
//   const b = it.slider ? new Slider(...) : new Button(...);
//   b.tip = it.tip; if (it.enabled === false) b.enabled = false; return b; }
pub fn make_option(id: usize, x: f64, y: f64, slider: bool, wide: bool, enabled: bool) -> OptionWidget {
    let w = if wide { 310.0 } else { 150.0 };
    OptionWidget { id, rect: WidgetRect::new(id as i32, x, y, w, 20.0), slider, wide, enabled }
}

// ------------------------------------------------------------ video options

/// JS: one entry of the `items` array in `VideoScreen.init` (key/slider/wide only).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct VideoOptionDef {
    /// JS: it.key — None for the four unkeyed Gravrust extras.
    pub key: Option<&'static str>,
    pub slider: bool,
    pub wide: bool,
}

// JS: const items = [ ... ] in VideoScreen.init, in definition order.
pub const VIDEO_ITEMS: [VideoOptionDef; 20] = [
    VideoOptionDef { key: Some("options.graphics"), slider: false, wide: false },
    VideoOptionDef { key: Some("options.renderDistance"), slider: true, wide: false },
    VideoOptionDef { key: Some("options.ao"), slider: false, wide: false },
    VideoOptionDef { key: Some("options.framerateLimit"), slider: true, wide: false },
    VideoOptionDef { key: Some("options.anaglyph"), slider: false, wide: false },
    VideoOptionDef { key: Some("options.viewBobbing"), slider: false, wide: false },
    VideoOptionDef { key: Some("options.guiScale"), slider: false, wide: false },
    VideoOptionDef { key: Some("options.attackIndicator"), slider: false, wide: false },
    VideoOptionDef { key: Some("options.gamma"), slider: true, wide: false },
    VideoOptionDef { key: Some("options.renderClouds"), slider: false, wide: false },
    VideoOptionDef { key: Some("options.particles"), slider: false, wide: false },
    VideoOptionDef { key: Some("options.fullscreen"), slider: false, wide: false },
    VideoOptionDef { key: Some("options.vsync"), slider: false, wide: false },
    VideoOptionDef { key: Some("options.mipmapLevels"), slider: true, wide: false },
    VideoOptionDef { key: Some("options.entityShadows"), slider: false, wide: false },
    // JS: Distance from the camera in world blocks; the slider's maximum disables LOD.
    VideoOptionDef { key: None, slider: true, wide: false },
    // JS: { label: () => 'Shader Packs…', click: ... }
    VideoOptionDef { key: None, slider: false, wide: false },
    // JS: Gravrust: which graphics API the renderer uses
    VideoOptionDef { key: None, slider: false, wide: false },
    // JS: Gravrust: Super Potato Mode
    VideoOptionDef { key: None, slider: false, wide: false },
    // JS: options.biomeBlendRadius (wide — spans both columns)
    VideoOptionDef { key: Some("options.biomeBlendRadius"), slider: true, wide: true },
];

// JS: const vanillaItems = VANILLA_UI.videoOptions.map(key => { const item = items.find(it => it.key === key);
//   if (!item) throw new Error('Missing video option: ' + key); return item; });
// JS: const orderedItems = [...vanillaItems, ...items.filter(it => !it.key)];
pub fn ordered_video_items() -> Vec<VideoOptionDef> {
    let mut out = Vec::new();
    for key in VIDEO_OPTION_KEYS {
        match VIDEO_ITEMS.iter().find(|it| it.key == Some(key)) {
            Some(it) => out.push(*it),
            // JS: throw new Error('Missing video option: ' + key)
            None => panic!("Missing video option: {}", key),
        }
    }
    out.extend(VIDEO_ITEMS.iter().filter(|it| it.key.is_none()).copied());
    out
}

// ------------------------------------------------- video toggle label/cycle

// JS: trOption('options.graphics', tr(s.fancyGraphics ? 'options.graphics.fancy' : 'options.graphics.fast'))
pub fn graphics_label_value(fancy_graphics: bool) -> String {
    tr(if fancy_graphics { "options.graphics.fancy" } else { "options.graphics.fast" })
}

// JS: trOption('options.ao', tr('options.ao.' + ['off', 'min', 'max'][s.smoothLighting | 0]))
pub fn ao_label_value(smooth_lighting: i32) -> String {
    let name = match smooth_lighting {
        0 => "off",
        1 => "min",
        2 => "max",
        // JS: out-of-range indexes read `undefined` from the array and stringify.
        _ => "undefined",
    };
    tr(&format!("options.ao.{}", name))
}

// JS: click: () => { s.smoothLighting = ((s.smoothLighting | 0) + 1) % 3; }
pub fn cycle_smooth_lighting(smooth_lighting: i32) -> i32 {
    (smooth_lighting + 1) % 3
}

// JS: trOption('options.guiScale', s.guiScale === 0 ? tr('options.guiScale.auto') : String(s.guiScale))
pub fn gui_scale_label_value(gui_scale: i32) -> String {
    if gui_scale == 0 {
        tr("options.guiScale.auto")
    } else {
        format!("{}", gui_scale)
    }
}

// JS: click: () => { s.guiScale = (s.guiScale + 1) % 4; g.gui.guiScaleSetting = s.guiScale; g.gui.resize(); }
// (the gui resize side effect is browser-bound)
pub fn cycle_gui_scale(gui_scale: i32) -> i32 {
    (gui_scale + 1) % 4
}

// JS: trOption('options.attackIndicator', tr(['options.off', 'options.attack.crosshair', 'options.attack.hotbar'][s.attackIndicator | 0]))
pub fn attack_indicator_label_value(attack_indicator: i32) -> String {
    tr(match attack_indicator {
        0 => "options.off",
        1 => "options.attack.crosshair",
        2 => "options.attack.hotbar",
        _ => "undefined",
    })
}

// JS: click: () => { s.attackIndicator = ((s.attackIndicator | 0) + 1) % 3; }
pub fn cycle_attack_indicator(attack_indicator: i32) -> i32 {
    (attack_indicator + 1) % 3
}

// JS: trOption('options.renderClouds', s.clouds === 0 ? tr('options.off') : tr(s.clouds === 1 ? 'options.graphics.fast' : 'options.graphics.fancy'))
pub fn clouds_label_value(clouds: i32) -> String {
    if clouds == 0 {
        tr("options.off")
    } else {
        tr(if clouds == 1 { "options.graphics.fast" } else { "options.graphics.fancy" })
    }
}

// JS: click: () => { s.clouds = ((s.clouds | 0) + 2) % 3; }
pub fn cycle_clouds(clouds: i32) -> i32 {
    (clouds + 2) % 3
}

// JS: trOption('options.particles', tr('options.particles.' + ['all', 'decreased', 'minimal'][s.particles]))
pub fn particles_label_value(particles: i32) -> String {
    let name = match particles {
        0 => "all",
        1 => "decreased",
        2 => "minimal",
        _ => "undefined",
    };
    tr(&format!("options.particles.{}", name))
}

// JS: click: () => { s.particles = (s.particles + 1) % 3; }
pub fn cycle_particles(particles: i32) -> i32 {
    (particles + 1) % 3
}

// JS: { key: 'options.anaglyph', label: () => trOption('options.anaglyph', onOff(false)), click: () => {} }
// 3D anaglyph stays off in the browser port; the button is inert.
pub fn anaglyph_label_value() -> String {
    tr_option("options.anaglyph", &on_off(false))
}

// JS: trOption('options.difficulty', tr(g.hardcore ? 'options.difficulty.hardcore' : 'options.difficulty.' + diff))
pub fn difficulty_label_value(difficulty: i32, hardcore: bool) -> String {
    if hardcore {
        tr("options.difficulty.hardcore")
    } else {
        tr(&format!("options.difficulty.{}", difficulty_name(difficulty)))
    }
}

// JS: tip: () => g.device.graphicsSelection?.requested === s.graphicsApi
//   ? g.device.graphicsSelection.errors.map(error => '§c' + error.replace(/^[a-z0-9_-]+:\s*/i, '')).join('\n') : ''
pub fn graphics_api_tip(requested_matches: bool, errors: &[String]) -> String {
    if !requested_matches {
        return String::new();
    }
    errors.iter().map(|e| format!("§c{}", strip_error_prefix(e))).collect::<Vec<_>>().join("\n")
}

// -------------------------------------------------------------- skin screen

// JS: const parts = [['cape', 0x01], ['jacket', 0x02], ['left_sleeve', 0x04], ['right_sleeve', 0x08], ['left_pants_leg', 0x10], ['right_pants_leg', 0x20], ['hat', 0x40]];
pub const SKIN_PARTS: [(&str, u32); 7] = [
    ("cape", 0x01),
    ("jacket", 0x02),
    ("left_sleeve", 0x04),
    ("right_sleeve", 0x08),
    ("left_pants_leg", 0x10),
    ("right_pants_leg", 0x20),
    ("hat", 0x40),
];

// JS: trOption('options.modelPart.' + n, onOff(s.skinParts & bit))
pub fn skin_part_label_value(name: &str, skin_parts: u32, bit: u32) -> String {
    tr_option(&format!("options.modelPart.{}", name), &on_off(skin_parts & bit != 0))
}

// JS: click: () => { s.skinParts ^= bit; }
pub fn toggle_skin_part(skin_parts: &mut u32, bit: u32) {
    *skin_parts ^= bit;
}

// JS: trOption('options.mainHand', tr(s.mainHand === 'left' ? 'options.mainHand.left' : 'options.mainHand.right'))
pub fn main_hand_label_value(main_hand: &str) -> String {
    tr_option(
        "options.mainHand",
        &tr(if main_hand == "left" { "options.mainHand.left" } else { "options.mainHand.right" }),
    )
}

// JS: click: () => { s.mainHand = s.mainHand === 'left' ? 'right' : 'left'; }
pub fn toggle_main_hand(main_hand: &mut String) {
    *main_hand = if main_hand == "left" { "right".to_string() } else { "left".to_string() };
}

// ------------------------------------------------------------- key bindings

/// JS: one `KEY_BINDINGS` entry — `binding: [descriptionKey, categoryKey]`
/// after `binding[1] = VANILLA_UI.bindingCategories[binding[0]] || binding[1]`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct KeyBinding {
    /// JS: the object key — also the settings `keys` field name.
    pub binding: &'static str,
    /// JS: binding[0] — the description translation key.
    pub description_key: &'static str,
    /// JS: binding[1] — the category key (bindingCategories applied).
    pub category_key: &'static str,
}

// JS: const KEY_BINDINGS = { attack: ['key.attack', 'key.categories.gameplay'], ... };
// The only entry whose fallback category differs from bindingCategories is
// `drop` (gameplay -> inventory override).
pub const KEY_BINDINGS: [KeyBinding; 34] = [
    KeyBinding { binding: "attack", description_key: "key.attack", category_key: "key.categories.gameplay" },
    KeyBinding { binding: "use", description_key: "key.use", category_key: "key.categories.gameplay" },
    KeyBinding { binding: "forward", description_key: "key.forward", category_key: "key.categories.movement" },
    KeyBinding { binding: "left", description_key: "key.left", category_key: "key.categories.movement" },
    KeyBinding { binding: "back", description_key: "key.back", category_key: "key.categories.movement" },
    KeyBinding { binding: "right", description_key: "key.right", category_key: "key.categories.movement" },
    KeyBinding { binding: "jump", description_key: "key.jump", category_key: "key.categories.movement" },
    KeyBinding { binding: "sneak", description_key: "key.sneak", category_key: "key.categories.movement" },
    KeyBinding { binding: "sprint", description_key: "key.sprint", category_key: "key.categories.movement" },
    // drop: fallback 'key.categories.gameplay', overridden to inventory by bindingCategories.
    KeyBinding { binding: "drop", description_key: "key.drop", category_key: "key.categories.inventory" },
    KeyBinding { binding: "inventory", description_key: "key.inventory", category_key: "key.categories.inventory" },
    KeyBinding { binding: "chat", description_key: "key.chat", category_key: "key.categories.multiplayer" },
    KeyBinding { binding: "playerlist", description_key: "key.playerlist", category_key: "key.categories.multiplayer" },
    KeyBinding { binding: "pickItem", description_key: "key.pickItem", category_key: "key.categories.gameplay" },
    KeyBinding { binding: "command", description_key: "key.command", category_key: "key.categories.multiplayer" },
    KeyBinding { binding: "screenshot", description_key: "key.screenshot", category_key: "key.categories.misc" },
    KeyBinding { binding: "perspective", description_key: "key.togglePerspective", category_key: "key.categories.misc" },
    KeyBinding { binding: "zoom", description_key: "Gravrust.key.zoom", category_key: "key.categories.misc" },
    KeyBinding { binding: "smoothCamera", description_key: "key.smoothCamera", category_key: "key.categories.misc" },
    KeyBinding { binding: "swapHands", description_key: "key.swapHands", category_key: "key.categories.inventory" },
    KeyBinding { binding: "advancements", description_key: "key.advancements", category_key: "key.categories.misc" },
    KeyBinding { binding: "saveToolbarActivator", description_key: "key.saveToolbarActivator", category_key: "key.categories.creative" },
    KeyBinding { binding: "loadToolbarActivator", description_key: "key.loadToolbarActivator", category_key: "key.categories.creative" },
    KeyBinding { binding: "fullscreen", description_key: "key.fullscreen", category_key: "key.categories.misc" },
    KeyBinding { binding: "spectatorOutlines", description_key: "key.spectatorOutlines", category_key: "key.categories.misc" },
    // JS: for (let i = 1; i <= 9; i++) KEY_BINDINGS['hotbar' + i] = ['key.hotbar.' + i, 'key.categories.inventory'];
    KeyBinding { binding: "hotbar1", description_key: "key.hotbar.1", category_key: "key.categories.inventory" },
    KeyBinding { binding: "hotbar2", description_key: "key.hotbar.2", category_key: "key.categories.inventory" },
    KeyBinding { binding: "hotbar3", description_key: "key.hotbar.3", category_key: "key.categories.inventory" },
    KeyBinding { binding: "hotbar4", description_key: "key.hotbar.4", category_key: "key.categories.inventory" },
    KeyBinding { binding: "hotbar5", description_key: "key.hotbar.5", category_key: "key.categories.inventory" },
    KeyBinding { binding: "hotbar6", description_key: "key.hotbar.6", category_key: "key.categories.inventory" },
    KeyBinding { binding: "hotbar7", description_key: "key.hotbar.7", category_key: "key.categories.inventory" },
    KeyBinding { binding: "hotbar8", description_key: "key.hotbar.8", category_key: "key.categories.inventory" },
    KeyBinding { binding: "hotbar9", description_key: "key.hotbar.9", category_key: "key.categories.inventory" },
];

// JS: export const DEFAULT_KEYS (client/js/game/settings.js). `hideGui` is in
// DEFAULT_KEYS but not in KEY_BINDINGS.
pub const DEFAULT_KEYS: [(&str, &str); 35] = [
    ("forward", "KeyW"),
    ("left", "KeyA"),
    ("back", "KeyS"),
    ("right", "KeyD"),
    ("jump", "Space"),
    ("sneak", "ShiftLeft"),
    ("sprint", "ControlLeft"),
    ("inventory", "KeyE"),
    ("drop", "KeyQ"),
    ("chat", "KeyT"),
    ("command", "Slash"),
    ("playerlist", "Tab"),
    ("pickItem", "mouse1"),
    ("attack", "mouse0"),
    ("use", "mouse2"),
    ("perspective", "F5"),
    ("zoom", "KeyC"),
    ("smoothCamera", ""),
    ("screenshot", "F2"),
    ("hideGui", "F1"),
    ("hotbar1", "Digit1"),
    ("hotbar2", "Digit2"),
    ("hotbar3", "Digit3"),
    ("hotbar4", "Digit4"),
    ("hotbar5", "Digit5"),
    ("hotbar6", "Digit6"),
    ("hotbar7", "Digit7"),
    ("hotbar8", "Digit8"),
    ("hotbar9", "Digit9"),
    ("fullscreen", "F11"),
    ("spectatorOutlines", ""),
    ("swapHands", "KeyF"),
    ("advancements", "KeyL"),
    ("saveToolbarActivator", "KeyC"),
    ("loadToolbarActivator", "KeyX"),
];

// JS: DEFAULT_KEYS[binding] — undefined only for names outside the table.
pub fn default_key(binding: &str) -> &'static str {
    DEFAULT_KEYS.iter().find(|(k, _)| *k == binding).map(|(_, v)| *v).unwrap_or("")
}

// --------------------------------------------------------- minimal exports

// JS glue draft: enumerate the binding table (options_alg keeps the other
// js_options_* exports). Indexes follow KEY_BINDINGS order.
#[wasm_bindgen]
pub fn js_options_key_binding_description(index: usize) -> String {
    KEY_BINDINGS.get(index).map(|k| k.description_key).unwrap_or("").to_string()
}

#[wasm_bindgen]
pub fn js_options_key_binding_category(index: usize) -> String {
    KEY_BINDINGS.get(index).map(|k| k.category_key).unwrap_or("").to_string()
}

#[wasm_bindgen]
pub fn js_options_default_key(binding: &str) -> String {
    default_key(binding).to_string()
}

// ------------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;
    use crate::options_alg::js_floor;

    #[test]
    fn native_option_covers_the_vanilla_lists() {
        // Every accessibility and mouse option resolves; unknown keys are None
        // (the JS throw site).
        for key in ACCESSIBILITY_OPTIONS.iter().chain(MOUSE_OPTIONS.iter()) {
            assert!(native_option(key).is_some(), "missing native option {}", key);
        }
        assert!(native_option("options.nonexistent").is_none());
    }

    #[test]
    fn native_option_kinds() {
        assert_eq!(native_option("options.narrator"), Some(OptionType::Narrator));
        assert_eq!(
            native_option("key.sneak"),
            Some(OptionType::KeyToggle { name: "key.sneak", field: BoolField::ToggleCrouch })
        );
        assert_eq!(
            native_option("key.sprint"),
            Some(OptionType::KeyToggle { name: "key.sprint", field: BoolField::ToggleSprint })
        );
        assert!(native_option("options.sensitivity").unwrap().is_slider());
        assert!(native_option("options.chat.opacity").unwrap().is_slider());
        assert!(!native_option("options.autoJump").unwrap().is_slider());
    }

    #[test]
    fn toggle_labels_and_clicks() {
        let mut s = Settings::default();
        let ot = native_option("options.showSubtitles").unwrap();
        assert_eq!(ot.label(&s, 0, true), "options.showSubtitles: options.off");
        ot.click(&mut s, 0, true);
        assert_eq!(ot.label(&s, 0, true), "options.showSubtitles: options.on");

        let ot = native_option("key.sprint").unwrap();
        assert_eq!(ot.label(&s, 0, true), "key.sprint: options.key.hold");
        ot.click(&mut s, 0, true);
        assert_eq!(ot.label(&s, 0, true), "key.sprint: options.key.toggle");

        let ot = native_option("options.accessibility.text_background").unwrap();
        assert_eq!(
            ot.label(&s, 0, true),
            "options.accessibility.text_background: options.accessibility.text_background.chat"
        );
        ot.click(&mut s, 0, true);
        assert_eq!(
            ot.label(&s, 0, true),
            "options.accessibility.text_background: options.accessibility.text_background.everywhere"
        );
    }

    #[test]
    fn slider_mapping_hand_checked() {
        let mut s = Settings::default();
        // JS: sensitivity value is the raw setting; label Math.round(v * 200) + '%'.
        let ot = native_option("options.sensitivity").unwrap();
        s.sensitivity = 0.5;
        assert_eq!(ot.value(&s), 0.5);
        assert_eq!(ot.slider_label(0.5), "options.sensitivity: 100%");
        assert_eq!(ot.slider_label(0.0), "options.sensitivity: options.sensitivity.min");
        ot.set(&mut s, 0.75);
        assert_eq!(ot.slider_label(ot.value(&s)), "options.sensitivity: 150%");

        // JS: mouseWheelSensitivity — value (log10(s) + 1) / 2, set 10 ** (v*2-1).
        let ot = native_option("options.mouseWheelSensitivity").unwrap();
        s.mouse_wheel_sensitivity = 1.0;
        assert_eq!(ot.value(&s), 0.5);
        assert_eq!(ot.slider_label(0.5), "options.mouseWheelSensitivity: 1.00");
        ot.set(&mut s, 0.0);
        assert_eq!(s.mouse_wheel_sensitivity, 0.1);
        assert_eq!(ot.slider_label(1.0), "options.mouseWheelSensitivity: 10.00");

        // JS: chat.opacity label Math.round((v * .9 + .1) * 100) + '%'.
        let ot = native_option("options.chat.opacity").unwrap();
        s.chat_opacity = 0.0;
        assert_eq!(ot.value(&s), 0.0);
        assert_eq!(ot.slider_label(0.0), "options.chat.opacity: 10%");
        ot.set(&mut s, 1.0);
        assert_eq!(s.chat_opacity, 1.0);
        assert_eq!(ot.slider_label(1.0), "options.chat.opacity: 100%");

        // JS: text_background_opacity — the generic percent slider.
        let ot = native_option("options.accessibility.text_background_opacity").unwrap();
        s.text_background_opacity = 0.5;
        assert_eq!(ot.slider_label(0.5), "options.accessibility.text_background_opacity: 50%");
        ot.set(&mut s, 0.25);
        assert_eq!(s.text_background_opacity, 0.25);
    }

    #[test]
    fn narrator_option_uses_the_runtime_flags() {
        let mut s = Settings::default();
        let ot = native_option("options.narrator").unwrap();
        assert!(!ot.enabled(false));
        assert!(ot.enabled(true));
        assert_eq!(ot.label(&s, 2, true), "options.narrator: options.narrator.chat");
        assert_eq!(ot.click(&mut s, 2, true), 3);
        assert_eq!(s.narrator, 3);
        // JS: cycle keeps the mode off when speech is unavailable.
        assert_eq!(ot.click(&mut s, 2, false), 0);
        assert_eq!(s.narrator, 0);
    }

    #[test]
    fn ordered_video_items_match_the_js_list() {
        let items = ordered_video_items();
        // 15 vanilla + 4 unkeyed extras; anaglyph is defined but dropped.
        assert_eq!(items.len(), 19);
        assert_eq!(items[0].key, Some("options.biomeBlendRadius"));
        assert!(items[0].wide && items[0].slider);
        assert_eq!(items[1].key, Some("options.graphics"));
        // JS (vanilla-layout.js videoOptions): renderDistance 2, ao 3, framerateLimit 4.
        assert_eq!(items[3].key, Some("options.ao"));
        assert_eq!(items[4].key, Some("options.framerateLimit"));
        assert!(items.iter().all(|it| it.key != Some("options.anaglyph")));
        assert!(items[15..].iter().all(|it| it.key.is_none()));
        assert!(items[15].slider); // LOD distance
        assert!(!items[18].slider); // Super Potato
    }

    #[test]
    fn video_toggle_labels_and_cycles() {
        assert_eq!(graphics_label_value(true), "options.graphics.fancy");
        assert_eq!(graphics_label_value(false), "options.graphics.fast");
        assert_eq!(ao_label_value(0), "options.ao.off");
        assert_eq!(ao_label_value(1), "options.ao.min");
        assert_eq!(ao_label_value(2), "options.ao.max");
        assert_eq!(cycle_smooth_lighting(2), 0);

        assert_eq!(gui_scale_label_value(0), "options.guiScale.auto");
        assert_eq!(gui_scale_label_value(2), "2");
        assert_eq!(cycle_gui_scale(3), 0);

        assert_eq!(attack_indicator_label_value(0), "options.off");
        assert_eq!(attack_indicator_label_value(1), "options.attack.crosshair");
        assert_eq!(attack_indicator_label_value(2), "options.attack.hotbar");
        assert_eq!(cycle_attack_indicator(2), 0);

        assert_eq!(clouds_label_value(0), "options.off");
        assert_eq!(clouds_label_value(1), "options.graphics.fast");
        assert_eq!(clouds_label_value(2), "options.graphics.fancy");
        assert_eq!(cycle_clouds(2), 1); // (2 + 2) % 3

        assert_eq!(particles_label_value(0), "options.particles.all");
        assert_eq!(particles_label_value(2), "options.particles.minimal");
        assert_eq!(cycle_particles(2), 0);

        assert_eq!(anaglyph_label_value(), "options.anaglyph: options.off");
        assert_eq!(
            difficulty_label_value(3, false),
            "options.difficulty.hard"
        );
        assert_eq!(difficulty_label_value(0, true), "options.difficulty.hardcore");
    }

    #[test]
    fn graphics_api_tip_strips_error_prefixes() {
        assert_eq!(graphics_api_tip(false, &["webgpu: lost".to_string()]), "");
        assert_eq!(
            graphics_api_tip(true, &["webgpu: device lost".to_string(), "bad prefix".to_string()]),
            "§cdevice lost\n§cbad prefix"
        );
    }

    #[test]
    fn key_bindings_table_is_faithful() {
        assert_eq!(KEY_BINDINGS.len(), 34);
        // Insertion order starts attack, use and ends with the hotbar row.
        assert_eq!(KEY_BINDINGS[0].binding, "attack");
        assert_eq!(KEY_BINDINGS[1].binding, "use");
        assert_eq!(KEY_BINDINGS[33].binding, "hotbar9");
        // bindingCategories overrides drop from gameplay to inventory.
        let drop = KEY_BINDINGS.iter().find(|k| k.binding == "drop").unwrap();
        assert_eq!(drop.category_key, "key.categories.inventory");
        // zoom keeps its fallback (Gravrust.key.zoom is not in bindingCategories).
        let zoom = KEY_BINDINGS.iter().find(|k| k.binding == "zoom").unwrap();
        assert_eq!(zoom.description_key, "Gravrust.key.zoom");
        assert_eq!(zoom.category_key, "key.categories.misc");
        // Every binding has a default key; smoothCamera/spectatorOutlines bind to "".
        for k in KEY_BINDINGS {
            assert!(DEFAULT_KEYS.iter().any(|(name, _)| *name == k.binding), "{} has no default", k.binding);
        }
        assert_eq!(default_key("forward"), "KeyW");
        assert_eq!(default_key("attack"), "mouse0");
        assert_eq!(default_key("hotbar9"), "Digit9");
        assert_eq!(default_key("smoothCamera"), "");
        assert_eq!(default_key("hideGui"), "F1"); // in DEFAULT_KEYS, not KEY_BINDINGS
        assert_eq!(default_key("nonexistent"), "");
    }

    #[test]
    fn settings_keys_behave_like_the_js_object() {
        let mut s = Settings::default();
        assert_eq!(s.key("forward"), Some("KeyW"));
        s.set_key("forward", "KeyJ");
        assert_eq!(s.key("forward"), Some("KeyJ"));
        assert!(!s.key_is_default("forward"));
        assert!(s.key_is_default("left"));
        s.reset_keys();
        assert_eq!(s.key("forward"), Some("KeyW"));
        assert!(s.key_is_default("forward"));
    }

    #[test]
    fn sound_volumes_default_like_the_js_object() {
        let mut s = Settings::default();
        assert_eq!(s.sound_volume("music"), 0.0); // explicit 0 is kept (JS !== undefined)
        assert_eq!(s.sound_volume("unknown"), 1.0); // JS: undefined -> 1
        s.set_sound_volume("voice", 0.4);
        assert_eq!(s.sound_volume("voice"), 0.4);
    }

    #[test]
    fn skin_and_main_hand_helpers() {
        let mut parts = 0x7fu32;
        assert_eq!(skin_part_label_value("cape", parts, 0x01), "options.modelPart.cape: options.on");
        toggle_skin_part(&mut parts, 0x01);
        assert_eq!(parts, 0x7e);
        assert_eq!(skin_part_label_value("cape", parts, 0x01), "options.modelPart.cape: options.off");
        assert_eq!(skin_part_label_value("hat", parts, 0x40), "options.modelPart.hat: options.on");

        let mut hand = "right".to_string();
        assert_eq!(main_hand_label_value(&hand), "options.mainHand: options.mainHand.right");
        toggle_main_hand(&mut hand);
        assert_eq!(hand, "left");
        assert_eq!(main_hand_label_value(&hand), "options.mainHand: options.mainHand.left");
    }

    #[test]
    fn make_option_geometry() {
        // JS: const w = it.wide ? 310 : 150; height always 20; Button floors x/y.
        let wide = make_option(0, 165.5, 67.9, true, true, true);
        assert_eq!((wide.rect.x, wide.rect.y, wide.rect.w, wide.rect.h), (165.0, 67.0, 310.0, 20.0));
        let normal = make_option(1, 165.5, 67.9, false, false, true);
        assert_eq!(normal.rect.w, 150.0);
        let disabled = make_option(2, 0.0, 0.0, false, false, false);
        assert!(!disabled.enabled);
    }

    #[test]
    fn js_floor_helper_smoke() {
        assert_eq!(js_floor(2.9), 2.0);
    }
}
