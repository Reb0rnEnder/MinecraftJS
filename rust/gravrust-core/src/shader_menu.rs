//! Port of `client/js/render/shader-menu.js`.
//!
//! Parses OptiFine / Iris custom shader pack `shaders.properties` menus and localization.
//! Organizes options into screens, columns, and submenus.

use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq)]
pub enum ShaderMenuEntry {
    Empty,
    Option(String),
    Submenu(ShaderMenuScreen),
}

#[derive(Debug, Clone, PartialEq)]
pub struct ShaderMenuScreen {
    pub name: String,
    pub label: String,
    pub columns: usize,
    pub entries: Vec<ShaderMenuEntry>,
}

/// Parses key-value properties with `\` continuation support.
pub fn parse_properties_text(text: &str) -> HashMap<String, String> {
    let mut props = HashMap::new();
    // JS: .replace(/\\\r?\n\s*/g, ' ') — collapse backslash-continuation + leading ws.
    let re = regex::Regex::new(r"\\\r?\n\s*").unwrap();
    let unwrapped = re.replace_all(text, " ");
    for line in unwrapped.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.starts_with('!') || trimmed.is_empty() {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            props.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    props
}

/// Parses `.lang` localization file.
pub fn parse_lang_text(text: &str) -> HashMap<String, String> {
    let mut lang = HashMap::new();
    for line in text.lines() {
        if let Some((k, v)) = line.split_once('=') {
            lang.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    lang
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_properties_with_continuation() {
        let input = "screen.main = OPTION_A \\\n  OPTION_B\nscreen.main.columns = 2\n# comment\n";
        let props = parse_properties_text(input);
        assert_eq!(props.get("screen.main"), Some(&"OPTION_A  OPTION_B".to_string()));
        assert_eq!(props.get("screen.main.columns"), Some(&"2".to_string()));
    }

    #[test]
    fn test_parse_lang_text() {
        let input = "screen.main=Main Shaders\nscreen.water=Water Options\n";
        let lang = parse_lang_text(input);
        assert_eq!(lang.get("screen.main"), Some(&"Main Shaders".to_string()));
    }
}
