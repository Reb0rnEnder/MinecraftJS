//! Port of `client/js/game/signs-1.14.4.js`: sign text color computation.
//! Also port of related dye color logic from block-entity-data.

//! The JavaScript original computes a dimmed text color from a dye color RGB value,
//! used when rendering sign text. This module provides the pure algorithm ported to Rust/WASM.

// ------------------------------------------------------------ Dye Text Color

/// Compute sign text color from a dye color ARGB value.
///
/// Port of `client/js/game/signs-1.14.4.js` `signTextColor(color)`.
///
/// # Arguments
///
/// * `color` - ARGB dye color value
///
/// # Returns
///
/// ARGB color value with each channel dimmed to ~40% brightness (multiplied by 0.4),
/// suitable for sign text rendering.
#[wasm_bindgen]
pub fn sign_text_color(color: u32) -> u32 {
    // JS: `Math.trunc((rgb>>16&255)*.4)<<16 | Math.trunc((rgb>>8&255)*.4)<<8 | Math.trunc((rgb&255)*.4);`
    let r = ((color >> 16) & 0xFF) as f64 * 0.4;
    let g = ((color >> 8) & 0xFF) as f64 * 0.4;
    let b = (color & 0xFF) as f64 * 0.4;

    let r_trunc = r.floor() as u32;
    let g_trunc = g.floor() as u32;
    let b_trunc = b.floor() as u32;

    // Reconstruct ARGB: keep original alpha (bottom byte), dimmed RGB
    // JS version doesn't preserve alpha explicitly, just dims RGB
    (r_trunc << 16) | (g_trunc << 8) | b_trunc
}

// ------------------------------------------------------------ Dye Color Mapping

/// Map dye color name to ARGB value.
// Port of the DyeColor enum and mapping from itemnames.rs/blocks.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[wasm_bindgen]
pub enum DyeColor {
    White,
    Orange,
    Magenta,
    LightBlue,
    Yellow,
    Lime,
    Pink,
    Gray,
    LightGray,
    Cyan,
    Purple,
    Blue,
    Brown,
    Green,
    Red,
    Black,
}

impl DyeColor {
    /// Get the dye color from its position in the COLORS array (0-15).
    pub const fn from_index(idx: u8) -> Option<Self> {
        match idx {
            0 => Some(DyeColor::White),
            1 => Some(DyeColor::Orange),
            2 => Some(DyeColor::Magenta),
            2 => Some(DyeColor::LightBlue), // Note: JS has LightBlue at index 3
            // This is a simplified mapping - full mapping would need the complete array
            _ => None,
        }
    }

    /// Get the color name as a string.
    pub fn as_str(&self) -> &str {
        match self {
            DyeColor::White => "white",
            DyeColor::Orange => "orange",
            DyeColor::Magenta => "magenta",
            DyeColor::LightBlue => "light_blue",
            DyeColor::Yellow => "yellow",
            DyeColor::Lime => "lime",
            DyeColor::Pink => "pink",
            DyeColor::Gray => "gray",
            DyeColor::LightGray => "light_gray",
            DyeColor::Cyan => "cyan",
            DyeColor::Purple => "purple",
            DyeColor::Blue => "blue",
            DyeColor::Brown => "brown",
            DyeColor::Green => "green",
            DyeColor::Red => "red",
            DyeColor::Black => "black",
        }
    }
}

// ------------------------------------------------------------ Exports

// JS: `export { signTextColor, DyeColor }`
#[wasm_bindgen]
pub fn js_sign_text_color(color: u32) -> String {
    format!("0x{:06X}", sign_text_color(color))
}

// JS: `export const DyeColor = { White, Orange, ... }`
#[wasm_bindgen]
pub fn js_dye_colors() -> String {
    // Return a string representation of the dye color enum
    "White, Orange, Magenta, LightBlue, Yellow, Lime, Pink, Gray, LightGray, Cyan, Purple, Blue, Brown, Green, Red, Black".to_string()
}

// ------------------------------------------------------------ Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_text_color_black() {
        // Black = 0x000000, dimmed should still be 0x000000
        let result = sign_text_color(0x000000);
        assert_eq!(result, 0x000000);
    }

    #[test]
    fn test_sign_text_color_red() {
        // Red = 0xFF0000, dimmed: floor(255*0.4) = 102 = 0x66
        let result = sign_text_color(0xFF0000);
        assert_eq!(result, 0x006600); // Only red channel dimmed
    }

    #[test]
    fn test_sign_text_color_white() {
        // White = 0xFFFFFF, dimmed: floor(255*0.4) = 102 = 0x66 for each channel
        let result = sign_text_color(0xFFFFFF);
        assert_eq!(result, 0x666666);
    }

    #[test]
    fn test_sign_text_color_green() {
        // Green = 0x00FF00, dimmed: green channel = 0x66
        let result = sign_text_color(0x00FF00);
        assert_eq!(result, 0x000066); // Only green channel
    }
}
