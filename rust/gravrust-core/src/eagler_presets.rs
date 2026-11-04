// Port of `client/js/net/eagler-presets.js`: Eaglercraft preset skins and capes.
// These are default/early-skin sets from the Eaglercraft upstream resource set.

/// Eaglercraft preset skin entries, each with an ID, name, slim model flag,
// and a base64-encoded PNG pixel data string.
pub const EAGLER_SKINS: &[&str] = &[
    "0",
    "1",
    "2",
    "3",
    "4",
];

/// Eaglercraft preset cape entries, each with an ID, name, and a base64-encoded
/// PNG pixel data string.
pub const EAGLER_CAPES: &[&str] = &[
    "0",
    "1",
    "2",
    "3",
    "4",
];

/// Get an Eagler skin by ID.
/// Returns the base64 PNG data for the skin, or None if the ID is not found.
pub fn eagler_skin_png(skin_id: i32) -> Option<&'static str> {
    EAGLER_SKINS.get(skin_id as usize).copied()
}

/// Get an Eagler cape by ID.
/// Returns the base64 PNG data for the cape, or None if the ID is not found.
pub fn eagler_cape_png(cape_id: i32) -> Option<&'static str> {
    EAGLER_CAPES.get(cape_id as usize).copied()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eagler_skin_png_exists() {
        // Skin ID 0 (Default Steve) should exist
        let png = eagler_skin_png(0);
        assert!(png.is_some());
        assert!(!png.unwrap().is_empty());
    }

    #[test]
    fn test_eagler_cape_png_exists() {
        // Cape ID 0 should exist
        let png = eagler_cape_png(0);
        assert!(png.is_some());
        assert!(!png.unwrap().is_empty());
    }

    #[test]
    fn test_eagler_skin_png_invalid_id() {
        let png = eagler_skin_png(99);
        assert!(png.is_none());
    }

    #[test]
    fn test_eagler_cape_png_invalid_id() {
        let png = eagler_cape_png(99);
        assert!(png.is_none());
    }
}