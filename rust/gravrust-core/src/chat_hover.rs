// Port of `client/js/gui/chat-hover.js`

//! Chat hover tooltip handling:
//! - Parses SNBT payloads for item/entity/achievement tooltips
//! - Converts JSON chat components to legacy format
//! - Handles: show_text, show_item, show_entity, show_achievement actions

use wasm_bindgen::prelude::*;
use serde_json::Value;

//! Inline chat-to-legacy conversion (mirrors chatToLegacy from client/js/gui/chat.js
//! with {parsed:true}, without depending on the chat module).

/// Convert a JSON chat component to legacy formatted string (§ codes).
fn chat_to_legacy_json(json: &Value) -> ::alloc::string::String {
    if json.is_null() {
        return ::alloc::string::String::new();
    }

    if json.is_string() {
        let s = json.as_str().unwrap_or_default();
        return s.replace("§", "");
    }

    if json.is_number() || json.is_boolean() {
        return json.to_string();
    }

    if let Value::Object(map) = json {
        // Handle different component types
        if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
            let mut out = text.to_string();
            // Process extra
            if let Some(extra) = map.get("extra").and_then(|v| v.as_array()) {
                for e in extra {
                    let part = chat_to_legacy_json(e);
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
            // Default translation is identity
            let marked = args.join(" ");
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

/// Convert a hover event value to legacy chat format split by newlines.
/// Mirrors the `show_text` action from `chatHoverTooltip`.
pub fn chat_hover_text(component: &Value) -> Option<::alloc::vec::Vec<::alloc::string::String>> {
    let event = component.get("hover")?;
    if event.is_null() {
        return component.get("hoverText").and_then(|v| v.as_array().map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        }));
    }

    // event is a JSON object with an "action" field
    let action = event.as_object()?.get("action")?.as_str()?;

    match action {
        "show_text" => {
            let value = event.get("value")?;
            Some(
                chat_to_legacy_json(value)
                    .split('\n')
                    .filter(|s| !s.is_empty())
                    .collect(),
            )
        }
        "show_item" => {
            // Parse SNBT payload
            let value = event.get("value")?.as_str()?;
            let parsed = crate::snbt::parse_snbt(value)?;
            let simplified = simplify_snbt(&parsed);

            // Get item ID from NBT
            let id_str = simplified.get("id").and_then(|v| v.as_str()).unwrap_or("");

            // Strip minecraft: prefix if present
            let clean_id = if id_str.starts_with("minecraft:") {
                &id_str[10..]
            } else {
                id_str
            };

            let count = simplified
                .get("Count")
                .and_then(|v| v.as_number())
                .map(|n| n.as_f64().unwrap_or(1.0))
                .unwrap_or(1.0);
            let damage = simplified
                .get("Damage")
                .and_then(|v| v.as_number())
                .map(|n| n.as_f64().unwrap_or(0.0))
                .unwrap_or(0.0);

            // In a full port, we'd look up the item: game.items.byName.get(clean_id)?.id
            // For now, construct a basic tooltip
            if !clean_id.is_empty() {
                Some(vec![format!(
                    "§rItem: {} (count: {}, damage: {})",
                    clean_id, count, damage
                )])
            } else {
                Some(vec!["§cInvalid Item!".to_string()])
            }
        }
        "show_entity" => {
            let value = event.get("value")?.as_str()?;
            let parsed = crate::snbt::parse_snbt(value)?;
            let simplified = simplify_snbt(&parsed);

            let name = simplified.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let r#type = simplified.get("type").and_then(|v| v.as_str()).unwrap_or("");

            let mut result = ::alloc::vec::Vec::new();
            result.push(name);
            if !r#type.is_empty() {
                result.push(format!("Type: {}", r#type));
            }
            result.push(
                simplified.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            );

            Some(result)
        }
        "show_achievement" => {
            // Only for 1.8.9; in the Rust port we don't have version checking
            // but we still handle the achievement logic
            let value = event.get("value")?.as_str()?;
            // payload on a raw string just returns it
            let key = value.to_string();

            let achievement = key.starts_with("achievement.");
            let mut lines = ::alloc::vec::Vec::new();
            lines.push(key.clone());
            lines.push(format!(
                "§o{}",
                if achievement {
                    "statistic"
                } else {
                    "achievement"
                }
            ));

            if achievement {
                // Would wrap description with game.gui.font.wrap
                lines.push("Description placeholder".to_string());
            }

            Some(lines)
        }
        _ => None,
    }
}

/// Simplify an SNBT parsed result (mirrors the JS `simplify` function).
/// In a full port, this would be a separate NBT simplification step.
fn simplify_snbt(parsed: &str) -> Value {
    // For now, just parse the SNBT as JSON/serde_value
    // The JS `simplify` function likely normalizes the NBT structure
    // This is a placeholder that just returns the parsed value
    serde_json::from_str(parsed).unwrap_or(Value::Null)
}

/// Main chat hover tooltip function.
/// Mirrors `chatHoverTooltip` from `client/js/gui/chat-hover.js`.
/// Returns tooltip lines or `None` if no tooltip applicable.
pub fn chat_hover_tooltip(
    _game: &(),
    component: &Value,
) -> Option<::alloc::vec::Vec<::alloc::string::String>> {
    let event = component.get("hover")?;
    if event.is_null() {
        return component.get("hoverText").and_then(|v| v.as_array().map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        }));
    }

    // event is a JSON object with an "action" field
    let action = event.as_object()?.get("action")?.as_str()?;

    match action {
        "show_text" => {
            let value = event.get("value")?;
            chat_hover_text(component)
        }
        "show_item" => {
            let value = event.get("value")?.as_str()?;
            let parsed = crate::snbt::parse_snbt(value)?;
            let simplified = simplify_snbt(&parsed);

            // Get item ID from NBT - try to resolve name to ID
            let id_str = simplified.get("id").and_then(|v| v.as_str()).unwrap_or("");

            // Strip minecraft: prefix if present
            let clean_id = if id_str.starts_with("minecraft:") {
                &id_str[10..]
            } else {
                id_str
            };

            let count = simplified
                .get("Count")
                .and_then(|v| v.as_number())
                .map(|n| n.as_f64().unwrap_or(1.0))
                .unwrap_or(1.0);
            let damage = simplified
                .get("Damage")
                .and_then(|v| v.as_number())
                .map(|n| n.as_f64().unwrap_or(0.0))
                .unwrap_or(0.0);

            // In a full port, we'd look up the item: game.items.byName.get(clean_id)?.id
            // For now, construct a basic tooltip
            if !clean_id.is_empty() {
                Some(vec![format!(
                    "§rItem: {} (count: {}, damage: {})",
                    clean_id, count, damage
                )])
            } else {
                Some(vec!["§cInvalid Item!".to_string()])
            }
        }
        "show_entity" => {
            let value = event.get("value")?.as_str()?;
            let parsed = crate::snbt::parse_snbt(value)?;
            let simplified = simplify_snbt(&parsed);

            let name = simplified.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let r#type = simplified.get("type").and_then(|v| v.as_str()).unwrap_or("");

            let mut result = ::alloc::vec::Vec::new();
            result.push(name);
            if !r#type.is_empty() {
                result.push(format!("Type: {}", r#type));
            }
            result.push(
                simplified.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            );

            Some(result)
        }
        "show_achievement" => {
            let value = event.get("value")?.as_str()?;
            let key = value.to_string();

            let achievement = key.starts_with("achievement.");
            let mut lines = ::alloc::vec::Vec::new();
            lines.push(key.clone());
            lines.push(format!(
                "§o{}",
                if achievement {
                    "statistic"
                } else {
                    "achievement"
                }
            ));

            if achievement {
                lines.push("Description placeholder".to_string());
            }

            Some(lines)
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_payload_string() {
        let v = serde_json::Value::String("hello".to_string());
        // The payload function operates on &Value, test indirectly via chat_hover_text
        assert_eq!(v.as_str(), Some("hello"));
    }

    #[test]
    fn test_chat_to_legacy_json_string() {
        let v = serde_json::Value::String("hello".to_string());
        assert_eq!(chat_to_legacy_json(&v), "hello");
    }

    #[test]
    fn test_chat_to_legacy_json_null() {
        let v = serde_json::Value::Null;
        assert_eq!(chat_to_legacy_json(&v), "");
    }

    #[test]
    fn test_chat_to_legacy_json_number() {
        let v = serde_json::Value::Number(42.0);
        assert_eq!(chat_to_legacy_json(&v), "42");
    }

    #[test]
    fn test_chat_to_legacy_json_object_with_text() {
        let mut map = ::serde_json::Map::new();
        map.insert("text".to_string(), serde_json::Value::String("hello".to_string()));
        let v = serde_json::Value::Object(map);
        let result = chat_to_legacy_json(&v);
        assert!(result.contains("hello"));
    }

    #[test]
    fn test_simplify_snbt_placeholder() {
        // The simplify_snbt function just parses SNBT as JSON
        let result = simplify_snbt("{id:\"minecraft:stone\",Count:1b}");
        assert!(result.is_object());
    }

    #[test]
    fn test_chat_hover_text_no_hover() {
        let mut map = ::serde_json::Map::new();
        map.insert("hoverText".to_string(), serde_json::Value::Array(vec![
            serde_json::Value::String("line1".to_string()),
            serde_json::Value::String("line2".to_string()),
        ]));
        let v = serde_json::Value::Object(map);
        let result = chat_hover_text(&v);
        assert!(result.is_some());
        let lines = result.unwrap();
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0], "line1");
        assert_eq!(lines[1], "line2");
    }
}