// Port of `client/js/game/settings.js`

//! Game settings ported from Minecraft JavaScript.
//! Handles default values, key bindings, and configuration persistence.

use serde::{Serialize, Deserialize};

/// Key bindings for game controls.
/// Maps control names to JS key codes (e.g. "KeyW", "Space", "ShiftLeft").
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct Keys {
    /// Forward
    pub forward: String,
    /// Left
    pub left: String,
    /// Back
    pub back: String,
    /// Right
    pub right: String,
    /// Jump (Space)
    pub jump: String,
    /// Sneak (ShiftLeft)
    pub sneak: String,
    /// Sprint (ControlLeft)
    pub sprint: String,
    /// Inventory (KeyE)
    pub inventory: String,
    /// Drop (KeyQ)
    pub drop: String,
    /// Chat (KeyT)
    pub chat: String,
    /// Command (Slash)
    pub command: String,
    /// Player list (Tab)
    pub playerlist: String,
    /// Attack (mouse0)
    pub attack: String,
    /// Use (mouse2)
    pub use_: String,
    /// Perspective (F5)
    pub perspective: String,
    /// Zoom (KeyC)
    pub zoom: String,
    /// Smooth camera ('' if disabled)
    pub smoothCamera: String,
    /// Screenshot (F2)
    pub screenshot: String,
    /// Hide GUI (F1)
    pub hideGui: String,
    /// Hotbar 1-9
    pub hotbar1: String,
    pub hotbar2: String,
    pub hotbar3: String,
    pub hotbar4: String,
    pub hotbar5: String,
    pub hotbar6: String,
    pub hotbar7: String,
    pub hotbar8: String,
    pub hotbar9: String,
    /// Fullscreen (F11)
    pub fullscreen: String,
    /// Spectator outlines ('' if disabled)
    pub spectatorOutlines: String,
    /// Swap hands (KeyF)
    pub swapHands: String,
    /// Advancements (KeyL)
    pub advancements: String,
    /// Save toolbar activator (KeyC)
    pub saveToolbarActivator: String,
    /// Load toolbar activator (KeyX)
    pub loadToolbarActivator: String,
}

/// Global game settings matching the JavaScript `Settings` class defaults.
///
/// This struct mirrors the JavaScript `DEFAULTS` object and `Settings` class
/// from `client/js/game/settings.js`. Settings are persisted through the
/// platform settings store on the JS side; in Rust this provides the pure
/// data structure and default values.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Settings {
    /// Skip multiplayer warning on first connection
    pub skipMultiplayerWarning: bool,
    /// Field of view in degrees
    pub fov: f32,
    /// Mouse sensitivity (0.0 - 1.0)
    pub sensitivity: f32,
    /// Mouse wheel scroll sensitivity
    pub mouseWheelSensitivity: f32,
    /// Whether mouse scroll is discrete (not continuous)
    pub discreteMouseScroll: bool,
    /// Text background opacity (0.0 - 1.0)
    pub textBackgroundOpacity: f32,
    /// Whether text background is only shown in chat
    pub textBackgroundOnlyChat: bool,
    /// Whether mouse Y axis is inverted
    pub invertMouse: bool,
    /// Render distance (chunks)
    pub renderDistance: i32,
    /// Biome blend radius (1.13.2: 0=off, 1..7 average a (2r+1)^2 biome area)
    pub biomeBlendRadius: i32,
    /// GUI scale: 0 = small, 1 = normal, 2 = large, 3 = huge
    pub guiScale: i32,
    /// Gamma correction value
    pub gamma: f32,
    /// Whether view bobbing is enabled
    pub viewBobbing: bool,
    /// Clouds setting: 0=off, 1=fast, 2=fancy
    pub clouds: i32,
    /// Fancy graphics (true = fancy, false = fast)
    pub fancyGraphics: bool,
    /// Smooth lighting: 0=off, 1=minimum, 2=maximum
    pub smoothLighting: i32,
    /// Whether VSync is enabled
    pub enableVsync: bool,
    /// MIP map levels
    pub mipmapLevels: i32,
    /// Whether block alternatives are shown
    pub blockAlternatives: bool,
    /// Whether VBOs are used
    pub useVbo: bool,
    /// Whether this is a touchscreen device
    pub touchscreen: bool,
    /// Whether the F3 snooper is enabled
    pub snooperEnabled: bool,
    /// Whether the game pauses when focus is lost
    pub pauseOnLostFocus: bool,
    /// Chat height when focused (normalized fraction)
    pub chatHeightFocused: f32,
    /// Chat height when unfocused (normalized fraction)
    pub chatHeightUnfocused: f32,
    /// Particle setting: 0=all, 1=decreased, 2=minimal
    pub particles: i32,
    /// Chat opacity (0.0 - 1.0)
    pub chatOpacity: f32,
    /// Chat scale
    pub chatScale: f32,
    /// Chat width (number of columns)
    pub chatWidth: i32,
    /// Chat visibility: 0=shown, 1=commands only, 2=hidden
    pub chatVisibility: i32,
    /// Whether chat colors are enabled
    pub chatColors: bool,
    /// Whether chat links are enabled
    pub chatLinks: bool,
    /// Whether chat links prompt before opening
    pub chatLinksPrompt: bool,
    /// Whether to auto-suggest commands
    pub autoSuggestCommands: bool,
    /// Master volume (0.0 - 1.0)
    pub masterVolume: f32,
    /// Sound volume per category
    pub soundVolumes: SoundVolumes,
    /// Whether subtitles are shown
    pub showSubtitles: bool,
    /// Whether realm notifications are shown
    pub realmsNotifications: bool,
    /// Whether debug info is shown
    pub showDebugInfo: bool,
    /// Whether reduced debug info is shown
    pub reducedDebugInfo: bool,
    /// Current tutorial step ('none' once done, or a step name)
    pub tutorialStep: String,
    /// Narrator mode: 0=off, 1=all, 2=chat, 3=system
    pub narrator: i32,
    /// Whether advanced item tooltips are shown
    pub advancedItemTooltips: bool,
    /// Skin parts bitmask (0x7f = full body)
    pub skinParts: u8,
    /// Main hand: 'right' or 'left'
    pub mainHand: String,
    /// Attack indicator: 0=off, 1=crosshair, 2=hotbar (1.9)
    pub attackIndicator: i32,
    /// Whether crouch is toggled (hold vs press)
    pub toggleCrouch: bool,
    /// Whether sprint is toggled (hold vs press)
    pub toggleSprint: bool,
    /// Whether auto-jump is enabled (1.11+)
    pub autoJump: bool,
    /// Maximum FPS (0 = unlimited)
    pub maxFps: i32,
    /// Graphics API: 'webgl2' | 'webgpu' | 'software'
    pub graphicsApi: String,
    /// Lower internal resolution (single-pass menu panorama)
    pub superPotato: bool,
    /// Optional HTTP/CORS proxy template for skin URLs
    pub skinProxy: String,
    /// Active resource pack IDs (highest priority first)
    pub resourcePacks: Vec<String>,
    /// Whether entity shadows are enabled
    pub entityShadows: bool,
    /// World blocks from camera for LOD; 0 disables terrain and entity LOD
    pub lodDistance: i32,
    /// Language code (e.g. 'en_us')
    pub language: String,
    /// Whether to force Unicode font
    pub forceUnicodeFont: bool,
    /// Key bindings
    pub keys: Keys,
    /// Last connected server details
    pub lastServer: ServerAddr,
    /// Username used when connecting
    pub username: String,
    /// Known servers list
    pub servers: Vec<ServerAddr>,
    /// Proxy configuration: null until first use, then filled from config.json
    pub proxies: Option<Vec<ProxyEntry>>,
    /// Currently selected proxy index
    pub proxy: i32,
}

/// Configuration from config.json, providing initial server and proxy settings.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct Config {
    /// Site configuration servers
    pub servers: Option<Vec<ServerEntry>>,
    /// Skin proxy URL
    pub skin_proxy: Option<String>,
}

/// A server entry from config.json.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct ServerEntry {
    /// Server name
    pub name: String,
    /// Hostname or IP address
    pub host: String,
    /// Port number
    pub port: u16,
}

/// Sound volume settings per category.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct SoundVolumes {
    pub music: f32,
    pub record: f32,
    pub weather: f32,
    pub block: f32,
    pub hostile: f32,
    pub neutral: f32,
    pub player: f32,
    pub ambient: f32,
    pub voice: f32,
}

/// A server address with host and port.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct ServerAddr {
    /// Hostname or IP address
    pub host: String,
    /// Port number
    pub port: u16,
}

/// A proxy entry from config.json.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct ProxyEntry {
    /// Proxy name
    pub name: String,
    /// Proxy URL
    pub url: String,
}

impl Settings {
    /// Create a new `Settings` instance with all default values.
    ///
    /// Defaults match the JavaScript `DEFAULTS` object from
    /// `client/js/game/settings.js`.
    pub fn new() -> Self {
        Self {
            // config will be provided by the caller; use empty config-like defaults
            config: Config {
                servers: None,
                skin_proxy: None,
            },
            // Initialize all fields to match JavaScript DEFAULTS
            skipMultiplayerWarning: false,
            fov: 70.0,
            sensitivity: 0.5,
            mouseWheelSensitivity: 1.0,
            discreteMouseScroll: false,
            textBackgroundOpacity: 0.5,
            textBackgroundOnlyChat: true,
            invertMouse: false,
            renderDistance: 8,
            biomeBlendRadius: 2,
            guiScale: 0,
            gamma: 0.5,
            viewBobbing: true,
            clouds: 2,
            fancyGraphics: true,
            smoothLighting: 2,
            enableVsync: true,
            mipmapLevels: 4,
            blockAlternatives: true,
            useVbo: true,
            touchscreen: false,
            snooperEnabled: true,
            pauseOnLostFocus: true,
            chatHeightFocused: 1.0,
            chatHeightUnfocused: 0.44366196,
            particles: 0,
            chatOpacity: 1.0,
            chatScale: 1.0,
            chatWidth: 1,
            chatVisibility: 0,
            chatColors: true,
            chatLinks: true,
            chatLinksPrompt: true,
            autoSuggestCommands: true,
            masterVolume: 1.0,
            soundVolumes: SoundVolumes {
                music: 0.0,
                record: 1.0,
                weather: 1.0,
                block: 1.0,
                hostile: 1.0,
                neutral: 1.0,
                player: 1.0,
                ambient: 1.0,
                voice: 1.0,
            },
            showSubtitles: false,
            realmsNotifications: true,
            showDebugInfo: false,
            reducedDebugInfo: false,
            tutorialStep: "movement".to_string(),
            narrator: 0,
            advancedItemTooltips: false,
            skinParts: 0x7f,
            mainHand: "right".to_string(),
            attackIndicator: 1,
            toggleCrouch: false,
            toggleSprint: false,
            autoJump: true,
            maxFps: 0,
            graphicsApi: "webgl2".to_string(),
            superPotato: false,
            skinProxy: "".to_string(),
            resourcePacks: vec![],
            entityShadows: true,
            lodDistance: 128,
            language: "en_us".to_string(),
            forceUnicodeFont: false,
            keys: Keys::default(),
            lastServer: ServerAddr {
                host: "localhost".to_string(),
                port: 25565,
            },
            username: "WebPlayer".to_string(),
            servers: vec![],
            proxies: None,
            proxy: 0,
        }
    }

    /// Load settings from a saved JSON string, merging with defaults.
    ///
    /// This mirrors the JavaScript constructor logic that parses
    /// `platform().loadSetting('Gravrust.settings')` or
    /// `platform().loadSetting('minekampf.settings')`.
    pub fn from_saved(saved: &str) -> Self {
        let mut settings = Self::new();
        // Parse saved settings, falling back to empty object
        if let Ok(saved_data) = serde_json::from_str::<serde_json::Value>(saved) {
            if let Some(s) = saved_data.get("skipMultiplayerWarning").and_then(|v| v.as_bool()) {
                settings.skipMultiplayerWarning = s;
            }
            if let Some(s) = saved_data.get("fov").and_then(|v| v.as_f64()) {
                settings.fov = s as f32;
            }
            if let Some(s) = saved_data.get("sensitivity").and_then(|v| v.as_f64()) {
                settings.sensitivity = s as f32;
            }
            if let Some(s) = saved_data.get("mouseWheelSensitivity").and_then(|v| v.as_f64()) {
                settings.mouseWheelSensitivity = s as f32;
            }
            if let Some(s) = saved_data.get("discreteMouseScroll").and_then(|v| v.as_bool()) {
                settings.discreteMouseScroll = s;
            }
            if let Some(s) = saved_data.get("textBackgroundOpacity").and_then(|v| v.as_f64()) {
                settings.textBackgroundOpacity = s as f32;
            }
            if let Some(s) = saved_data.get("textBackgroundOnlyChat").and_then(|v| v.as_bool()) {
                settings.textBackgroundOnlyChat = s;
            }
            if let Some(s) = saved_data.get("invertMouse").and_then(|v| v.as_bool()) {
                settings.invertMouse = s;
            }
            if let Some(s) = saved_data.get("renderDistance").and_then(|v| v.as_i64()) {
                settings.renderDistance = s as i32;
            }
            if let Some(s) = saved_data.get("biomeBlendRadius").and_then(|v| v.as_i64()) {
                settings.biomeBlendRadius = s as i32;
            }
            if let Some(s) = saved_data.get("guiScale").and_then(|v| v.as_i64()) {
                settings.guiScale = s as i32;
            }
            if let Some(s) = saved_data.get("gamma").and_then(|v| v.as_f64()) {
                settings.gamma = s as f32;
            }
            if let Some(s) = saved_data.get("viewBobbing").and_then(|v| v.as_bool()) {
                settings.viewBobbing = s;
            }
            if let Some(s) = saved_data.get("clouds").and_then(|v| v.as_i64()) {
                settings.clouds = s as i32;
            }
            if let Some(s) = saved_data.get("fancyGraphics").and_then(|v| v.as_bool()) {
                settings.fancyGraphics = s;
            }
            if let Some(s) = saved_data.get("smoothLighting").and_then(|v| v.as_i64()) {
                settings.smoothLighting = s as i32;
            }
            if let Some(s) = saved_data.get("enableVsync").and_then(|v| v.as_bool()) {
                settings.enableVsync = s;
            }
            if let Some(s) = saved_data.get("mipmapLevels").and_then(|v| v.as_i64()) {
                settings.mipmapLevels = s as i32;
            }
            if let Some(s) = saved_data.get("blockAlternatives").and_then(|v| v.as_bool()) {
                settings.blockAlternatives = s;
            }
            if let Some(s) = saved_data.get("useVbo").and_then(|v| v.as_bool()) {
                settings.useVbo = s;
            }
            if let Some(s) = saved_data.get("touchscreen").and_then(|v| v.as_bool()) {
                settings.touchscreen = s;
            }
            if let Some(s) = saved_data.get("snooperEnabled").and_then(|v| v.as_bool()) {
                settings.snooperEnabled = s;
            }
            if let Some(s) = saved_data.get("pauseOnLostFocus").and_then(|v| v.as_bool()) {
                settings.pauseOnLostFocus = s;
            }
            if let Some(s) = saved_data.get("chatHeightFocused").and_then(|v| v.as_f64()) {
                settings.chatHeightFocused = s as f32;
            }
            if let Some(s) = saved_data.get("chatHeightUnfocused").and_then(|v| v.as_f64()) {
                settings.chatHeightUnfocused = s as f32;
            }
            if let Some(s) = saved_data.get("particles").and_then(|v| v.as_i64()) {
                settings.particles = s as i32;
            }
            if let Some(s) = saved_data.get("chatOpacity").and_then(|v| v.as_f64()) {
                settings.chatOpacity = s as f32;
            }
            if let Some(s) = saved_data.get("chatScale").and_then(|v| v.as_f64()) {
                settings.chatScale = s as f32;
            }
            if let Some(s) = saved_data.get("chatWidth").and_then(|v| v.as_i64()) {
                settings.chatWidth = s as i32;
            }
            if let Some(s) = saved_data.get("chatVisibility").and_then(|v| v.as_i64()) {
                settings.chatVisibility = s as i32;
            }
            if let Some(s) = saved_data.get("chatColors").and_then(|v| v.as_bool()) {
                settings.chatColors = s;
            }
            if let Some(s) = saved_data.get("chatLinks").and_then(|v| v.as_bool()) {
                settings.chatLinks = s;
            }
            if let Some(s) = saved_data.get("chatLinksPrompt").and_then(|v| v.as_bool()) {
                settings.chatLinksPrompt = s;
            }
            if let Some(s) = saved_data.get("autoSuggestCommands").and_then(|v| v.as_bool()) {
                settings.autoSuggestCommands = s;
            }
            if let Some(s) = saved_data.get("masterVolume").and_then(|v| v.as_f64()) {
                settings.masterVolume = s as f32;
            }
            if let Some(s) = saved_data.get("soundVolumes").and_then(|v| v.as_object()) {
                // Merge sound volumes
                if let Some(music) = v.get("music").and_then(|v| v.as_f64()) {
                    settings.soundVolumes.music = music as f32;
                }
                if let Some(record) = v.get("record").and_then(|v| v.as_f64()) {
                    settings.soundVolumes.record = record as f32;
                }
                if let Some(weather) = v.get("weather").and_then(|v| v.as_f64()) {
                    settings.soundVolumes.weather = weather as f32;
                }
                if let Some(block) = v.get("block").and_then(|v| v.as_f64()) {
                    settings.soundVolumes.block = block as f32;
                }
                if let Some(hostile) = v.get("hostile").and_then(|v| v.as_f64()) {
                    settings.soundVolumes.hostile = hostile as f32;
                }
                if let Some(neutral) = v.get("neutral").and_then(|v| v.as_f64()) {
                    settings.soundVolumes.neutral = neutral as f32;
                }
                if let Some(player) = v.get("player").and_then(|v| v.as_f64()) {
                    settings.soundVolumes.player = player as f32;
                }
                if let Some(ambient) = v.get("ambient").and_then(|v| v.as_f64()) {
                    settings.soundVolumes.ambient = ambient as f32;
                }
                if let Some(voice) = v.get("voice").and_then(|v| v.as_f64()) {
                    settings.soundVolumes.voice = voice as f32;
                }
            }
            if let Some(s) = saved_data.get("showSubtitles").and_then(|v| v.as_bool()) {
                settings.showSubtitles = s;
            }
            if let Some(s) = saved_data.get("realmsNotifications").and_then(|v| v.as_bool()) {
                settings.realmsNotifications = s;
            }
            if let Some(s) = saved_data.get("showDebugInfo").and_then(|v| v.as_bool()) {
                settings.showDebugInfo = s;
            }
            if let Some(s) = saved_data.get("reducedDebugInfo").and_then(|v| v.as_bool()) {
                settings.reducedDebugInfo = s;
            }
            if let Some(s) = saved_data.get("tutorialStep").and_then(|v| v.as_str()) {
                settings.tutorialStep = s.to_string();
            }
            if let Some(s) = saved_data.get("narrator").and_then(|v| v.as_i64()) {
                settings.narrator = s as i32;
            }
            if let Some(s) = saved_data.get("advancedItemTooltips").and_then(|v| v.as_bool()) {
                settings.advancedItemTooltips = s;
            }
            if let Some(s) = saved_data.get("skinParts").and_then(|v| v.as_i64()) {
                settings.skinParts = s as u8;
            }
            if let Some(s) = saved_data.get("mainHand").and_then(|v| v.as_str()) {
                settings.mainHand = s.to_string();
            }
            if let Some(s) = saved_data.get("attackIndicator").and_then(|v| v.as_i64()) {
                settings.attackIndicator = s as i32;
            }
            if let Some(s) = saved_data.get("toggleCrouch").and_then(|v| v.as_bool()) {
                settings.toggleCrouch = s;
            }
            if let Some(s) = saved_data.get("toggleSprint").and_then(|v| v.as_bool()) {
                settings.toggleSprint = s;
            }
            if let Some(s) = saved_data.get("autoJump").and_then(|v| v.as_bool()) {
                settings.autoJump = s;
            }
            if let Some(s) = saved_data.get("maxFps").and_then(|v| v.as_i64()) {
                settings.maxFps = s as i32;
            }
            if let Some(s) = saved_data.get("graphicsApi").and_then(|v| v.as_str()) {
                settings.graphicsApi = s.to_string();
            }
            if let Some(s) = saved_data.get("superPotato").and_then(|v| v.as_bool()) {
                settings.superPotato = s;
            }
            if let Some(s) = saved_data.get("skinProxy").and_then(|v| v.as_str()) {
                settings.skinProxy = s.to_string();
            }
            if let Some(s) = saved_data.get("resourcePacks").and_then(|v| v.as_array()) {
                settings.resourcePacks = s.iter().filter_map(|v| v.as_str().map(String::from)).collect();
            }
            if let Some(s) = saved_data.get("entityShadows").and_then(|v| v.as_bool()) {
                settings.entityShadows = s;
            }
            if let Some(s) = saved_data.get("lodDistance").and_then(|v| v.as_i64()) {
                settings.lodDistance = s as i32;
            }
            if let Some(s) = saved_data.get("language").and_then(|v| v.as_str()) {
                settings.language = s.to_string();
                // language codes are lowercase since 1.11 (older saves: en_US)
                settings.language = settings.language.to_lowercase();
            }
            if let Some(s) = saved_data.get("forceUnicodeFont").and_then(|v| v.as_bool()) {
                settings.forceUnicodeFont = s;
            }
            // keys are merged last
            if let Some(s) = saved_data.get("keys").and_then(|v| v.as_object()) {
                let default_keys = Keys::default();
                for (k, v) in s {
                    if let Some(val) = v.as_str() {
                        // Safely set key binding
                        match k.as_str() {
                            "forward" => settings.keys.forward = val.to_string(),
                            "left" => settings.keys.left = val.to_string(),
                            "back" => settings.keys.back = val.to_string(),
                            "right" => settings.keys.right = val.to_string(),
                            "jump" => settings.keys.jump = val.to_string(),
                            "sneak" => settings.keys.sneak = val.to_string(),
                            "sprint" => settings.keys.sprint = val.to_string(),
                            "inventory" => settings.keys.inventory = val.to_string(),
                            "drop" => settings.keys.drop = val.to_string(),
                            "chat" => settings.keys.chat = val.to_string(),
                            "command" => settings.keys.command = val.to_string(),
                            "playerlist" => settings.keys.playerlist = val.to_string(),
                            "pickItem" => settings.keys.pickItem = val.to_string(),
                            "attack" => settings.keys.attack = val.to_string(),
                            "use" => settings.keys.use_ = val.to_string(),
                            "perspective" => settings.keys.perspective = val.to_string(),
                            "zoom" => settings.keys.zoom = val.to_string(),
                            "smoothCamera" => settings.keys.smoothCamera = val.to_string(),
                            "screenshot" => settings.keys.screenshot = val.to_string(),
                            "hideGui" => settings.keys.hideGui = val.to_string(),
                            "fullscreen" => settings.keys.fullscreen = val.to_string(),
                            "swapHands" => settings.keys.swapHands = val.to_string(),
                            "advancements" => settings.keys.advancements = val.to_string(),
                            "saveToolbarActivator" => settings.keys.saveToolbarActivator = val.to_string(),
                            "loadToolbarActivator" => settings.keys.loadToolbarActivator = val.to_string(),
                            _ => {}
                        }
                    }
                }
            }
        }
        settings
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let s = Settings::new();
        assert_eq!(s.fov, 70.0);
        assert_eq!(s.sensitivity, 0.5);
        assert_eq!(s.renderDistance, 8);
        assert_eq!(s.clouds, 2);
        assert!(s.fancyGraphics);
        assert_eq!(s.particles, 0);
        assert_eq!(s.lodDistance, 128);
        assert_eq!(s.guiScale, 0);
        assert_eq!(s.masterVolume, 1.0);
        assert_eq!(s.narrator, 0);
        assert_eq!(s.skinParts, 0x7f);
        assert_eq!(s.attackIndicator, 1);
        assert_eq!(s.maxFps, 0);
        assert_eq!(s.graphicsApi, "webgl2");
        assert!(!s.superPotato);
        assert_eq!(s.language, "en_us");
    }

    #[test]
    fn test_keys_defaults() {
        let keys = Keys::default();
        assert_eq!(keys.forward, "KeyW");
        assert_eq!(keys.left, "KeyA");
        assert_eq!(keys.back, "KeyS");
        assert_eq!(keys.right, "KeyD");
        assert_eq!(keys.jump, "Space");
        assert_eq!(keys.sneak, "ShiftLeft");
        assert_eq!(keys.sprint, "ControlLeft");
        assert_eq!(keys.inventory, "KeyE");
        assert_eq!(keys.drop, "KeyQ");
        assert_eq!(keys.chat, "KeyT");
        assert_eq!(keys.command, "Slash");
        assert_eq!(keys.playerlist, "Tab");
        assert_eq!(keys.attack, "mouse0");
        assert_eq!(keys.use_, "mouse2");
        assert_eq!(keys.perspective, "F5");
        assert_eq!(keys.zoom, "KeyC");
        assert_eq!(keys.smoothCamera, "");
        assert_eq!(keys.screenshot, "F2");
        assert_eq!(keys.hideGui, "F1");
        for i in 1..=9 {
            assert_eq!(format!("hotbar{}", i), format!("hotbar{}", i));
        }
        assert_eq!(keys.fullscreen, "F11");
        assert_eq!(keys.swapHands, "KeyF");
        assert_eq!(keys.advancements, "KeyL");
        assert_eq!(keys.saveToolbarActivator, "KeyC");
        assert_eq!(keys.loadToolbarActivator, "KeyX");
    }

    #[test]
    fn test_sound_volumes_defaults() {
        let volumes = SoundVolumes::default();
        assert_eq!(volumes.music, 0.0);
        assert_eq!(volumes.record, 1.0);
        assert_eq!(volumes.weather, 1.0);
        assert_eq!(volumes.block, 1.0);
        assert_eq!(volumes.hostile, 1.0);
        assert_eq!(volumes.neutral, 1.0);
        assert_eq!(volumes.player, 1.0);
        assert_eq!(volumes.ambient, 1.0);
        assert_eq!(volumes.voice, 1.0);
    }

    #[test]
    fn test_server_addr_default() {
        let addr = ServerAddr::default();
        assert_eq!(addr.host, "localhost");
        assert_eq!(addr.port, 25565);
    }
}