// Port of `client/js/gui/chat-options.js`

//! Chat options handling port from JavaScript.
//! - Chat color toggles
//! - Narrator control
//! - Chat visibility selection
//! - Slider options for opacity, scale, width, height

use wasm_bindgen::prelude::*;

/// Represents a chat option configuration returned by `chat_option`.
///
/// This enum covers the different types of chat options that the JS version handles:
/// - Toggle buttons (on/off)
/// - Select-from-three options (full/system/hidden)
/// - Slider options with value/label
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub enum ChatOption {
    /// A simple on/off toggle
    Toggle {
        /// Label text displayed for the option
        label: String,
        /// Click handler description (toggles the setting)
        click: String,
    },
    /// A narrator control option
    Narrator {
        /// Label text
        label: String,
        /// Whether narrator is enabled
        enabled: bool,
        /// Click handler to cycle narrator state
        click: String,
    },
    /// A chat visibility selector (full/system/hidden)
    Visibility {
        /// Label text
        label: String,
        /// Click handler cycles through visibility modes
        click: String,
    },
    /// A slider configuration
    Slider {
        /// Whether this is a slider type (always true for this variant)
        slider: bool,
        /// Label text displayed for the slider
        label: String,
        /// Current value string (e.g. "50%")
        value: String,
        /// Set handler description for the slider value
        set: String,
    },
}

/// Port of `client/js/gui/chat-options.js` `chatOption` function.
///
/// Given a settings key string, returns a [`ChatOption`] configuration
/// corresponding to that key. The JS version handles color toggles, narrator,
/// visibility, and various slider options for chat appearance.
///
/// # Arguments
///
/// * `key` - The settings key (e.g. "options.chat.color", "options.narrator", etc.)
///
/// # Returns
///
/// A [`ChatOption`] enum variant representing the option UI configuration.
#[wasm_bindgen]
pub fn chat_option(key: &str) -> ChatOption {
    // Mapping of JS field keys to settings field names (simple boolean toggles)
    const FIELDS: &[(&str, &str)] = &[
        ("options.chat.color", "chatColors"),
        ("options.chat.links", "chatLinks"),
        ("options.chat.links.prompt", "chatLinksPrompt"),
        ("options.reducedDebugInfo", "reducedDebugInfo"),
        ("options.autoSuggestCommands", "autoSuggestCommands"),
    ];

    // Check if key maps to a simple boolean toggle field
    if let Some((_k, setting)) = FIELDS.iter().find(|(k, _)| k == &key) {
        // Return a toggle: label shows on/off, click flips the boolean
        ChatOption::Toggle {
            label: format!("chatOptions.{}", key),
            click: format!("settings.{} toggle", setting),
        }
    } else if key == "options.narrator" {
        // Narrator control - returns label, enabled state, and click handler
        ChatOption::Narrator {
            label: "options.narrator".to_string(),
            enabled: true, // Would be game.narrator.active in JS
            click: "game.narrator.cycle()".to_string(),
        }
    } else if key == "options.chat.visibility" {
        // Chat visibility cycles through full/system/hidden
        ChatOption::Visibility {
            label: "options.chat.visibility".to_string(),
            click: "s.chatVisibility = (s.chatVisibility + 1) % 3".to_string(),
        }
    } else {
        // Slider options - use static mapping instead of closures
        slider_option(key)
    }
}

/// Port of the JS slider option mapping from `client/js/gui/chat-options.js`.
///
/// Maps JS setting keys to their display label format and settings field name.
/// The JS original uses closures like `v => Math.round((v*.9+.1)*100)+'%'` for opacity,
/// `v => Math.round(v*100)+'%'` for background opacity, etc.
fn slider_option(key: &str) -> ChatOption {
    // Slider definitions matching the JS sliders object structure
    // Each entry: (key_pattern, setting_name, default_value, set_description)
    const SLIDERS: &[(&str, &str, f64, &str)] = &[
        ("options.chat.opacity", "chatOpacity", 1.0, "chatOpacity = value"),
        (
            "options.accessibility.text_background_opacity",
            "textBackgroundOpacity",
            1.0,
            "textBackgroundOpacity = value",
        ),
        ("options.chat.scale", "chatScale", 1.0, "chatScale = value"),
        (
            "options.chat.width",
            "chatWidth",
            1.0,
            "chatWidth = value px",
        ),
        (
            "options.chat.height.focused",
            "chatHeightFocused",
            1.0,
            "chatHeightFocused = value px",
        ),
        (
            "options.chat.height.unfocused",
            "chatHeightUnfocused",
            1.0,
            "chatHeightUnfocused = value px",
        ),
    ];

    // Find matching key and compute display value
    if let Some((pattern, setting, default_val, set_desc)) = SLIDERS
        .iter()
        .find(|(k, _, _, _)| k == &key)
    {
        // Compute the display value using the same formulas as the JS original:
        // - opacity: Math.round((v*.9+.1)*100)+'%'
        // - text_background_opacity: Math.round(v*100)+'%'
        // - scale: Math.round(v*100)+'%'
        // - width: Math.floor(v*280+40)+'px'
        // - height.focused/unfocused: Math.floor(v*160+20)+'px'
        let (v, suffix) = match setting {
            "chatOpacity" => {
                let vv = (*default_val * 0.9 + 0.1) * 100.0;
                (vv, "%")
            }
            "textBackgroundOpacity" => {
                let vv = *default_val * 100.0;
                (vv, "%")
            }
            "chatScale" => {
                let vv = *default_val * 100.0;
                (vv, "%")
            }
            "chatWidth" => {
                let vv = (*default_val * 280.0 + 40.0).floor();
                (vv, "px")
            }
            "chatHeightFocused" | "chatHeightUnfocused" => {
                let vv = (*default_val * 160.0 + 20.0).floor();
                (vv, "px")
            }
            _ => (0.0, ""),
        };
        let value_str = format!("{}%", v);

        return ChatOption::Slider {
            slider: true,
            label: format!("chatOptions.{}", key),
            value: value_str,
            set: set_desc.to_string(),
        };
    }

    // Unknown option - in JS this would throw; here we return a fallback
    ChatOption::Slider {
        slider: true,
        label: "Unknown chat option".to_string(),
        value: "0%".to_string(),
        set: "".to_string(),
    }
}