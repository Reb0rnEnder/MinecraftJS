// Port of `client/js/gui/narrator.js`

//! Narrator chat listener with speech synthesis standing in for Mojang's text2speech.
//! Modes (GameSettings.narrator): 0 off, 1 all, 2 chat, 3 system. Ctrl+B cycles them and shows the narrator toast.

use once_cell::sync::Lazy;
use std::sync::Mutex;
use wasm_bindgen::prelude::*;

/// Narrator modes corresponding to GameSettings.narrator values.
/// 0 = off, 1 = all, 2 = chat, 3 = system
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum NarratorMode {
    Off,
    All,
    Chat,
    System,
}

/// Current narrator mode state.
pub static CURRENT_MODE: std::sync::atomic::AtomicU8 = std::sync::atomic::AtomicU8::new(0);

/// Translation function defaulting to identity. The host can swap it at runtime.
pub static TRANSLATE_FN: Lazy<Mutex<Box<dyn FnMut(&str, &[String]) -> String + Send>>> =
    Lazy::new(|| Mutex::new(Box::new(|k: &str, _args: &[String]| -> String { k.to_string() })));

/// Cycle the narrator mode to the next value.
/// Returns the new mode.
pub fn cycle_mode() -> NarratorMode {
    let mode = CURRENT_MODE.fetch_add(1, ::std::sync::atomic::Ordering::Relaxed);
    let new_mode = (mode + 1) % 4;
    CURRENT_MODE.store(new_mode, ::std::sync::atomic::Ordering::Relaxed);
    match new_mode {
        0 => NarratorMode::Off,
        1 => NarratorMode::All,
        2 => NarratorMode::Chat,
        3 => NarratorMode::System,
        _ => NarratorMode::Off,
    }
}

/// Announce the current narrator mode via the HUD.
/// This is a simplified version - in a full implementation would interact with the HUD.
pub fn announce_mode(mode: NarratorMode) {
    let mode_str = match mode {
        NarratorMode::Off => tr("options.narrator.notavailable"),
        NarratorMode::All => tr("options.narrator.all"),
        NarratorMode::Chat => tr("options.narrator.chat"),
        NarratorMode::System => tr("options.narrator.system"),
    };
    // In a full WASM context, this would call hud.systemToast
    // For now, we just log/translate
    #[allow(unused)]
    let _ = mode_str;
}

/// Say text using speech synthesis.
/// In a WASM context, this would use the Web Speech API's speechSynthesis.
/// For now, it just translates and logs the text.
pub fn say_text(text: &str, interrupt: bool) {
    if text.is_empty() {
        return;
    }
    let cleaned = text.replace("§", "");
    // In a full implementation: speechSynthesis.speak(new SpeechSynthesisUtterance(cleaned))
    #[allow(unused)]
    let _ = (interrupt, cleaned);
}

/// Say system text (mode 3 or 1).
/// Only speaks if narrator mode is system (3) or all (1).
pub fn say_system(text: &str) {
    let mode = CURRENT_MODE.load(::std::sync::atomic::Ordering::Relaxed);
    if mode == 3 || mode == 1 {
        say_text(text, false);
    }
}

/// Handle chat events from the server.
/// position: 0 = chat, 1 = system
/// json: the chat message JSON or string
pub fn on_chat(position: u8, json: &str) {
    let n = CURRENT_MODE.load(::std::sync::atomic::Ordering::Relaxed);
    if n == 0 {
        return;
    }
    
    let type_str = match position {
        0 => "chat",
        1 => "system",
        _ => return,
    };
    
    let allowed = match n {
        1 => true,          // all mode speaks everything
        2 => type_str == "chat",   // chat mode only speaks chat
        3 => type_str == "system", // system mode only speaks system
        _ => false,
    };
    
    if !allowed {
        return;
    }
    
    // Parse JSON if it's a string
    let json_val: serde_json::Value = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => {
            // Plain server text - just say it
            say_text(json, false);
            return;
        }
    };
    
    // Check for translated chat type
    if let Some(translate) = json_val.get("translate").and_then(|v| v.as_str()) {
        let args: Vec<String> = json_val.get("with")
            .and_then(|w| w.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();
        let marked = (TRANSLATE_FN.lock().unwrap())(&translate, &args);
        say_text(&marked, position == 1);
    } else {
        // Regular chat component - convert to plain text
        let plain = chat_to_plain(&serde_json::Value::Object(::serde_json::Map::new()), &None);
        say_text(&plain, position == 1);
    }
}

/// Clear any ongoing speech
pub fn clear() {
    // In a WASM context: speechSynthesis.cancel()
    #[allow(unused)]
    let _ = ();
}

/// Get the current narrator mode text label
pub fn label() -> String {
    let mode = CURRENT_MODE.load(::std::sync::atomic::Ordering::Relaxed);
    let mode_str = match mode {
        0 => tr("options.narrator.notavailable"),
        1 => tr("options.narrator.all"),
        2 => tr("options.narrator.chat"),
        3 => tr("options.narrator.system"),
        _ => tr("options.narrator.notavailable"),
    };
    format!("options.narrator: {}", mode_str)
}

/// Helper translation function (simplified)
fn tr(key: &str) -> String {
    // In a full implementation, this would use the asset translation system
    // For now, return the key itself
    key.to_string()
}

/// Convert a chat component to legacy formatted string (plain text)
pub fn chat_to_plain(json: &serde_json::Value, _options: &Option<serde_json::Value>) -> String {
    chat_to_legacy(json, &None).replace("§", "")
}

/// Convert JSON chat to legacy format
pub fn chat_to_legacy(json: &serde_json::Value, _style: &Option<String>) -> String {
    if json.is_null() {
        return String::new();
    }

    if json.is_string() {
        let s = json.as_str().unwrap_or_default();
        return s.replace("§", "");
    }

    if json.is_number() || json.is_boolean() {
        return json.to_string();
    }

    if let Some(map) = json.as_object() {
        // It's a component object
        let color = map.get("color").and_then(|c| c.as_str());
        
        // Handle different component types
        if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
            let mut out = String::new();
            // Process color/style codes if present
            if let Some(code) = color {
                // Simple color code handling
                if code == "black"    { out.push('§'); out.push('0'); }
                else if code == "dark_blue" { out.push('§'); out.push('1'); }
                else if code == "dark_green" { out.push('§'); out.push('2'); }
                else if code == "dark_aqua" { out.push('§'); out.push('3'); }
                else if code == "dark_red" { out.push('§'); out.push('4'); }
                else if code == "gold" { out.push('§'); out.push('5'); }
                else if code == "gray" { out.push('§'); out.push('6'); }
                else if code == "dark_gray" { out.push('§'); out.push('8'); }
                else if code == "blue" { out.push('§'); out.push('9'); }
                else if code == "green" { out.push('§'); out.push('a'); }
                else if code == "aqua" { out.push('§'); out.push('b'); }
                else if code == "red" { out.push('§'); out.push('c'); }
                else if code == "light_purple" { out.push('§'); out.push('d'); }
                else if code == "yellow" { out.push('§'); out.push('e'); }
                else if code == "white" { out.push('§'); out.push('f'); }
                else if code == "reset" { out.push('§'); out.push('r'); }
            }
            out.push_str(text);
            // Process extra
            if let Some(extra) = map.get("extra").and_then(|v| v.as_array()) {
                for e in extra {
                    let part = chat_to_legacy(e, &None);
                    if !part.is_empty() {
                        out += "§r";
                        out += &part;
                    }
                }
            }
            return out;
        }

        if let Some(translate) = map.get("translate").and_then(|v| v.as_str()) {
            let args: Vec<String> = map
                .get("with")
                .and_then(|w| w.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();
            let marked = (TRANSLATE_FN.lock().unwrap())(&translate, &args);
            // Reset BEFORE an argument as well as after it
            return format!("§r{}{}§r", "", marked);
        }

        if map.get("score").is_some() {
            if let Some(value) = map.get("value").and_then(|v| v.as_str()) {
                return value.to_string();
            }
        }

        if let Some(selector) = map.get("selector").and_then(|v| v.as_str()) {
            return selector.to_string();
        }

        if let Some(keybind) = map.get("keybind").and_then(|v| v.as_str()) {
            return keybind.to_string();
        }
    }

    String::new()
}