//! Port of `client/js/game/signs-1.14.4.js`.
//!
//! Handles sign text and functionality.

use regex::Regex;

/// Map of dye text colors from 1.14.4, extracted from the native jar.
const DYE_TEXT_COLORS: &[(&str, u32)] = &[
    ("white", 16777215),
    ("orange", 16738335),
    ("magenta", 16711935),
    ("light_blue", 10141901),
    ("yellow", 16776960),
    ("lime", 12582656),
    ("pink", 16738740),
    ("gray", 8421504),
    ("light_gray", 13882323),
    ("cyan", 65535),
    ("purple", 10494192),
    ("blue", 255),
    ("brown", 9127187),
    ("green", 65280),
    ("red", 16711680),
    ("black", 0),
];

/// Regular expression matching sign names: oak_sign, spruce_sign, etc.
/// Also matches oak_wall_sign, etc.
const SIGN_REGEX: &str = r"^(oak|spruce|birch|jungle|acacia|dark_oak)_(wall_)?sign$";

/// Returns true if the given name is a sign (oak, spruce, birch, jungle, acacia, or dark oak).
pub fn is_sign(name: &str) -> bool {
    let re = Regex::new(SIGN_REGEX).expect("Invalid sign regex");
    re.is_match(name)
}

/// Extracts the wood type name from a sign name by removing the sign suffix.
/// e.g., "oak_sign" -> "oak", "spruce_wall_sign" -> "spruce"
pub fn sign_wood(name: &str) -> &str {
    if name.ends_with("_wall_sign") {
        &name[..name.len() - 10]
    } else if name.ends_with("_sign") {
        &name[..name.len() - 5]
    } else {
        name
    }
}

/// Returns the text color for a given dye color, truncated to 40% brightness.
/// The color is encoded as an RGBA packed u32 (red in upper 8 bits, green in middle, blue in lower).
/// If the color is not found, black (0) is returned.
pub fn sign_text_color(color: &str) -> u32 {
    let rgb = DYE_TEXT_COLORS
        .iter()
        .find(|(c, _)| *c == color)
        .map(|t| t.1)
        .unwrap_or(0);
    let r = ((rgb >> 16) & 255) as f64 * 0.4f64;
    let g = ((rgb >> 8) & 255) as f64 * 0.4f64;
    let b = (rgb & 255) as f64 * 0.4f64;
    (r as u32) << 16 | (g as u32) << 8 | (b as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_sign() {
        assert!(is_sign("oak_sign"));
        assert!(is_sign("spruce_wall_sign"));
        assert!(is_sign("birch_sign"));
        assert!(is_sign("jungle_wall_sign"));
        assert!(is_sign("acacia_sign"));
        assert!(is_sign("dark_oak_wall_sign"));
        assert!(!is_sign("stone"));
        assert!(!is_sign("oak_planks"));
    }

    #[test]
    fn test_sign_wood() {
        assert_eq!(sign_wood("oak_sign"), "oak");
        assert_eq!(sign_wood("spruce_wall_sign"), "spruce");
        assert_eq!(sign_wood("birch_sign"), "birch");
        assert_eq!(sign_wood("oak_sign"), "oak");
        assert_eq!(sign_wood("not_a_sign"), "not_a_sign");
    }

    #[test]
    fn test_sign_text_color() {
        assert_eq!(sign_text_color("black"), 0);
        assert_eq!(sign_text_color("white"), 16777215);
        assert_eq!(sign_text_color("red"), 16711680);
        assert_eq!(sign_text_color("green"), 65280);
        assert_eq!(sign_text_color("blue"), 255);
        assert_eq!(sign_text_color("unknown"), 0); // falls back to black
    }
}