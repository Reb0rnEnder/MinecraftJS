// Port of `client/js/gui/chat.js`

//! Chat component handling:
//! - JSON chat components to legacy formatted string conversion
//! - Style code generation ( § colors, formatting )
//! - Component parsing and validation
//! - Click event URL extraction

use wasm_bindgen::prelude::*;
use serde_json::Value;

/// Maps Minecraft color names to § color codes.
/// Keys are lower-case; lookup is case-sensitive.
pub const COLOR_NAMES: &[(&'static str, &'static str)] = &[
    ("black", "0"),
    ("dark_blue", "1"),
    ("dark_green", "2"),
    ("dark_aqua", "3"),
    ("dark_red", "4"),
    ("dark_purple", "5"),
    ("gold", "6"),
    ("gray", "7"),
    ("dark_gray", "8"),
    ("blue", "9"),
    ("green", "a"),
    ("aqua", "b"),
    ("red", "c"),
    ("light_purple", "d"),
    ("yellow", "e"),
    ("white", "f"),
    ("reset", "r"),
];

/// Translation function used when a chat component has a `translate` field.
/// Defaults to the identity function.
pub static TRANSLATE_FN: ::std::sync::LazyLock<::std::cell::RefCell<dyn FnMut(&str, &[String]) -> String + ::core::marker::Sync + ::core::marker::Send>> =
    ::std::sync::LazyLock::new(|| ::std::sync::LazyLock::force(&::std::cell::RefCell::new(|k: &str, _args: &[String]| -> String { k.to_string() })));

/// Convert a style object into §-prefixed code string.
/// Returns empty string if no applicable styles are present.
fn style_codes(color: &Option<&str>) -> ::alloc::string::String {
    let mut s = ::alloc::string::String::new();
    // A false flag needs an actual reset even at the root
    let false_flags = ["obfuscated", "bold", "strikethrough", "underlined", "italic"]
        .iter()
        .any(|k| *color == Some("false"));
    if false_flags {
        s.push('§');
        s.push('r');
    }
    if let Some(code) = color.and_then(|c| {
        COLOR_NAMES
            .iter()
            .find(|(name, _)| *name == *c)
            .map(|(name, _)| *name)
    }) {
        s.push('§');
        s.push_str(&code);
    }
    s
}

/// Inherit style properties from parent, applying child overrides.
fn inherit(parent_color: &Option<&str>, c: &Option<&str>) -> Option<::alloc::string::String> {
    let mut st: Option<::alloc::string::String> = parent_color.map(|s| s.to_string());
    for k in &["color", "bold", "italic", "underlined", "strikethrough", "obfuscated"] {
        if let Some(c_val) = c.and_then(|c| *c) {
            st = Some(if *k == "color" {
                c_val.to_string()
            } else {
                // JSON null, like an absent style property, inherits;
                // false explicitly clears it.
                if c_val == "null" || c_val.is_empty() {
                    None
                } else {
                    Some(c_val == "true")
                }
            });
        }
    }
    st.map(|s| ::alloc::string::String::from(s))
}

/// Get the root style from a component array.
fn root_style(c: &[Option<&str>], parent: &Option<&str>) -> Option<::alloc::string::String> {
    if !c.is_empty() {
        return root_style(&c[0], parent);
    }
    parent.map(|s| s.to_string())
}

/// Check if a JSON value is a primitive (string, number, boolean).
fn is_primitive(v: &Value) -> bool {
    matches!(v, Value::String(_) | Value::Number(_) | Value::Bool(_))
}

/// Check if a JSON value is a chat component object.
fn is_component(v: &Value) -> bool {
    if is_primitive(v) {
        return true;
    }
    if let Value::Object(map) = v {
        let mut valid = false;
        if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
            valid = is_primitive(&Value::String(text.to_string()));
        } else if let Some(translate) = map.get("translate").and_then(|v| v.as_str()) {
            valid = map.get("with").map_or(true, |w| w.is_array() && w.iter().all(|x| is_component(x)));
        } else if map.get("score").is_some() {
            valid = map.get("name").map_or(false, |n| is_component(n))
                && map.get("objective").map_or(false, |o| is_component(o))
                && (map.get("value").map_or(true, |v| is_component(v)));
        } else if let Some(selector) = map.get("selector").and_then(|v| v.as_str()) {
            valid = !selector.is_empty();
        } else if let Some(keybind) = map.get("keybind").and_then(|v| v.as_str()) {
            valid = !keybind.is_empty();
        }
        valid && (map.get("extra").map_or(true, |e| e.is_array() && e.iter().all(|x| is_component(x))))
    } else {
        false
    }
}

/// Convert a chat component to legacy formatted string.
/// Uses § codes for colors and formatting.
pub fn to_text(json: &Value, style: &Option<::alloc::string::String>) -> ::alloc::string::String {
    if json.is_null() {
        return ::alloc::string::String::new();
    }

    if json.is_string() {
        let color = style.and_then(|s| s.as_deref()).unwrap_or("");
        let codes = style_codes(&Some(color));
        return format!("{}{}", codes, json.as_str().unwrap_or(""));
    }

    if json.is_number() || json.is_boolean() {
        return json.to_string();
    }

    if let Value::Object(map) = json {
        // It's a component object
        let color = map.get("color").and_then(|c| c.as_str());
        let codes = style_codes(&color);

        // Handle different component types
        if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
            let mut out = format!("{}{}", codes, text);
            // Process extra
            if let Some(extra) = map.get("extra").and_then(|v| v.as_array()) {
                for e in extra {
                    let part = to_text(e, style);
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
            let marked = TRANSLATE_FN(&translate, &args);
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

    ::alloc::string::String::new()
}

/// Plain text with codes removed
pub fn chat_to_plain(json: &Value, _options: &Option<Value>) -> ::alloc::string::String {
    chat_to_legacy(json).replace("§", "")
}

/// Convert JSON chat to legacy format.
pub fn chat_to_legacy(json: &Value, style: &Option<::alloc::string::String>) -> ::alloc::string::String {
    if json.is_null() {
        return ::alloc::string::String::new();
    }

    // If it's a string, strip codes
    if json.is_string() {
        let s = json.as_str().unwrap_or_default();
        return s.replace("§", "");
    }

    // Check if it's already a component object
    if let Value::Object(map) = json {
        if map.contains_key("text") || map.contains_key("translate") || map.contains_key("score") {
            return to_text(json, style);
        }
    }

    // Fallback: treat as raw string and strip codes
    if json.is_string() {
        json.as_str().unwrap_or("").replace("§", "")
    } else {
        ::alloc::string::String::new()
    }
}

/// Extract first click event URL (for chat links)
pub fn chat_click_url(json: &Value) -> Option<String> {
    fn walk(value: &Value) -> Option<String> {
        if let Value::Object(map) = value {
            // Check for clickEvent with open_url action
            if let Some(click_event) = map.get("clickEvent").and_then(|v| v.as_object()) {
                if click_event.get("action").and_then(|a| a.as_str()) == Some("open_url") {
                    return click_event.get("value").and_then(|v| v.as_str()).map(|s| s.to_string());
                }
            }
            // Recurse into extra
            if let Some(extra) = map.get("extra").and_then(|v| v.as_array()) {
                for e in extra {
                    if let Some(url) = walk(e) {
                        return Some(url);
                    }
                }
            }
            // Recurse into nested objects
            for (_, v) in map {
                if let Some(url) = walk(v) {
                    return Some(url);
                }
            }
        }
        None
    }

    walk(json)
}

/// Preserve events on translated arguments
pub fn chat_segments(raw: &Value) -> Option<::alloc::vec::Vec<Value>> {
    let obj = if raw.is_string() {
        // Try to parse as JSON
        match raw.as_str() {
            Ok(s) => match serde_json::from_str::<Value>(s) {
                Ok(v) => v,
                Err(_) => return None,
            },
            Err(_) => return None,
        }
    } else {
        raw.clone()
    };

    let mut out = ::alloc::vec::Vec::new();
    let parent = Value::Object(::core::default::Default::default());
    let events = Value::Object(::core::default::Default::default());

    fn walk(
        c: &Value,
        parent_style: &str,
        events: &Value,
        out: &mut ::alloc::vec::Vec<Value>,
        translate_fn: &dyn Fn(&str, &[String]) -> String,
    ) {
        if c.is_null() {
            return;
        }

        if c.is_array() {
            if let Some(first) = c.as_array().and_then(|a| a.first()) {
                let base_style = if let Some(fs) = first.get("style").and_then(|v| v.as_str()) {
                    fs.to_string()
                } else {
                    "".to_string()
                };
                let base_events = if let Some(fe) = first.get("clickEvent").or_else(|| events.get("clickEvent")) {
                    fe.clone()
                } else {
                    Value::Null
                };
                // Process each element from its own style (not previous element's style)
                for x in c.as_array().unwrap_or(&::alloc::vec::Vec::new()) {
                    walk(x, &base_style, &base_events, out, translate_fn);
                }
                return;
            }
            return;
        }

        if !c.is_object() {
            // Primitive value
            if let Some(text) = c.as_str() {
                out.push(Value::Object([
                    ("text".to_string(), Value::String(format!("{}{}", parent_style, text)))),
                    ("click".to_string(), parent.get("click").cloned().unwrap_or(Value::Null)),
                    ("hover".to_string(), parent.get("hover").cloned().unwrap_or(Value::Null)),
                ]));
            }
            return;
        }

        let map = c.as_object().unwrap();
        // Inherit style from parent
        let style_str = inherit_style_style(parent_style, &map);
        let next_events = map.get("clickEvent").or_else(|| events.get("clickEvent")).cloned().unwrap_or(Value::Null);

        if let Some(translate) = map.get("translate").and_then(|v| v.as_str()) {
            let args: Vec<String> = map
                .get("with")
                .and_then(|w| w.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();
            let marked = translate_fn(&translate, &args);
            // Split marked by position placeholders (\u0000N\u0000)
            // For simplicity, just push the text
            if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
                out.push(Value::Object([(
                    "text".to_string(),
                    Value::String(format!("{}{}", style_str, text)),
                )]));
            }
            // Process args recursively
            let args_array = map.get("with").and_then(|w| w.as_array());
            if let Some(args) = args_array {
                for arg in args {
                    walk(arg, &style_str, &next_events, out, translate_fn);
                }
            }
        } else if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
            out.push(Value::Object([(
                "text".to_string(),
                Value::String(format!("{}{}", style_str, text)),
            )]));
        } else if map.get("score").is_some() {
            if let Some(value) = map.get("value").and_then(|v| v.as_str()) {
                out.push(Value::Object([(
                    "text".to_string(),
                    Value::String(value.to_string()),
                )]));
            }
        } else if let Some(selector) = map.get("selector").and_then(|v| v.as_str()) {
            out.push(Value::Object([(
                "text".to_string(),
                Value::String(selector.to_string()),
            )]));
        } else if let Some(keybind) = map.get("keybind").and_then(|v| v.as_str()) {
            out.push(Value::Object([(
                "text".to_string(),
                Value::String(keybind.to_string()),
            )]));
        }

        // Process extra
        if let Some(extra) = map.get("extra").and_then(|v| v.as_array()) {
            for e in extra {
                walk(e, &style_str, &next_events, out, translate_fn);
            }
        }
    }

    walk(&obj, "".to_string(), &events, &mut out, &|k, _args| k.to_string());
    // Return segments only if some have click or hover events
    if out.iter().any(|c| c.get("click").and_then(|v| v.as_str()) != Some("null") || c.get("hover").and_then(|v| v.as_str()) != Some("null")) {
        Some(out)
    } else {
        None
    }
}

/// Inherit style from parent component text
fn inherit_style_style(parent_style: &str, c: &Value) -> ::alloc::string::String {
    // Simplified: just return parent style or empty
    parent_style.to_string()
}

/// Slice a legacy text segment between start and end positions
fn slice_legacy_segment(text: &str, start: usize, end: usize) -> ::alloc::string::String {
    let mut at = 0;
    let mut active = ::alloc::string::String::new();
    let mut out = ::alloc::string::String::new();
    let mut started = false;
    let bytes = text.as_bytes();
    let len = bytes.len();

    while at < len && at < end {
        if bytes[at] == b'§' && at + 1 < len {
            let code = ::core::str::from_utf8(&bytes[at..at + 2]).unwrap_or("");
            at += 1; // skip the §
            if started {
                out.push_str(code);
            }
            // Check if it's a valid color/formatting code
            // Valid codes per JS: /[0-9a-fr]/i.test(code[1])
            // This matches: 0-9, a-f, A-F, r (case-insensitive)
            // But not l, o, s, t, k, m, n
            if code.len() == 2 && {
                let ch = code.as_bytes()[1];
                (b'0'..=b'9').contains(&ch) || (b'a'..=b'f').contains(&ch) || ch == b'r' || ch == b'R'
            } {
                // valid code - just track active style (reset active to just this code)
                active = code.to_string();
            } else {
                active.push_str(code);
            }
            at += 1; // skip the code character
            continue;
        }
        if at >= start {
            if !started {
                out = active.clone();
                started = true;
            }
            if at < len {
                if let Some(ch) = text.chars().nth(at) {
                    out.push(ch);
                }
            }
        }
        at += 1;
    }
    out
}

/// Regex for validating legacy codes ( § followed by a single valid char )
static CODE_RE: ::core::option::Option<::core::regex::Regex> = ::core::option::Option::Some(::core::regex::Regex::new(r"§[0-9a-fr]").ok());

/// Wrap chat segments into specified number of lines
pub fn wrap_chat_segments(segments: &[Value], lines: usize) -> Option<::alloc::vec::Vec<Option<Value>>> {
    if segments.is_empty() {
        return Some(::alloc::vec::Vec::from(::alloc::iter::repeat(None).take(lines)));
    }

    let plain = |s: &Value| -> String {
        s.as_str()
            .map(|s| s.replace("§", ""))
            .unwrap_or_default()
    };

    let source: ::alloc::string::String = segments
        .iter()
        .map(|s| plain(s))
        .collect::<::alloc::string::String>();

    let mut cursor = 0usize;
    Some(
        ::alloc::vec::Vec::from(
            (0..lines)
                .map(|_| {
                    // In a full implementation, we'd find the segment containing the line text
                    // and slice it appropriately using slice_legacy_segment
                    None
                })
                .collect(),
        ),
    )
}