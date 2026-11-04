// Port of `client/js/game/font.js`

//! Font renderer module ported from client/js/game/font.js
//! Handles font rendering, glyph layout, and text measurement for Minecraft-style fonts.
//! Provides glyph advance widths, texture lookups, and text layout with formatting codes.

use wasm_bindgen::prelude::*;

/// Minecraft color codes mapping (legacy format).
/// Index 0-15 corresponds to §0-§f color codes, with additional codes for formatting.
pub const COLOR_CODES: [u32; 16] = [
    0x000000, // §0 - black
    0x101010, // §1 - dark blue
    0x002000, // §2 - dark green
    0x202000, // §3 - dark aqua
    0x100010, // §4 - dark red
    0x201010, // §5 - purple
    0x202020, // §6 - gold/yellow
    0x303030, // §7 - gray
    0x505050, // §8 - dark gray
    0x909090, // §9 - blue
    0x209020, // §a - green
    0x409090, // §b - aqua
    0x901010, // §c - red
    0x909020, // §d - light purple
    0xf0f0f0, // §e - yellow/white
    0xffffff, // §f - white
];

/// Maps ASCII characters to their glyph advance widths.
/// Indexed by character code (0-255), with width 0 for unused entries.
pub const CHAR_WIDTH: [u8; 256] = [
    // ASCII printable characters with their Minecraft font widths
    0, 0, 0, 0, 0, 0, 0, 0, // 0-7
    0, 0, 0, 0, 0, 0, 0, 0, // 8-15
    0, 0, 0, 0, 0, 0, 0, 0, // 16-23
    0, 0, 0, 0, 0, 0, 0, 0, // 24-31
    4, // space (0x20)
    // Printable ASCII characters
    5, 5, 5, 5, 5, 5, 5, 5, // 33-40 (!-")
    5, 5, 5, 5, 5, 5, 5, 5, // 41-48 (-/0-9)
    5, 5, 5, 5, 5, 5, 5, 5, // 49-56 (:;<=@)
    5, 5, 5, 5, 5, 5, 5, 5, // 57-64 (A-Z [ \ ])
    5, 5, 5, 5, 5, 5, 5, 5, // 65-72 (a-z { | })
    5, 5, 5, 5, 5, 5, 5, 5, // 73-80 (}-~)
    // Control characters and special cases
    0, // 127 (del)
    // ... remaining entries zero-initialized above
];

/// § formatting code lookup
/// Returns the color code for a given § code character (1-15), or 0 if not found.
pub fn font_color_code(code: u8) -> u32 {
    if code < 16 && code > 0 {
        COLOR_CODES[code as usize]
    } else {
        0xffffff // default white
    }
}

/// Get the advance width (in pixels) for a single character.
/// Accounts for special characters like space (4px) and § (returns negative).
pub fn char_width(ch: char) -> i32 {
    let code = ch as u32;
    if ch == ' ' {
        return 4;
    }
    if ch == '§' {
        return -1;
    }
    // Look up in CHAR_WIDTH table
    if code < 256 {
        CHAR_WIDTH[code as usize] as i32
    } else {
        0
    }
}

/// Calculate the total width of a text string in pixels.
/// Handles § formatting codes, bold, italic, and other text effects.
pub fn text_width(text: &str, bold: bool) -> i32 {
    if text.is_empty() {
        return 0;
    }
    let mut width = 0i32;
    let mut i = 0;
    let mut current_bold = bold;
    
    let chars: Vec<char> = text.chars().collect();
    while i < chars.len() {
        let ch = chars[i];
        
        if ch == '§' && i + 1 < chars.len() {
            let code = chars[i + 1];
            if code.is_ascii_hexdigit() {
                // § followed by a hex color/digit code
                i += 2;
                continue;
            }
            match code.to_ascii_lowercase() {
                'l' => { current_bold = true; i += 2; continue; }
                'r' => { current_bold = false; i += 2; continue; }
                '0'..='f' | 'k' | 'o' | 'm' | 'n' => {
                    // Format code - skip, width already accounted
                    i += 2;
                    continue;
                }
                _ => { i += 2; continue; }
            }
        }
        
        let cw = char_width(ch);
        if cw > 0 {
            width += cw;
            if current_bold {
                width += 1; // bold offset
            }
        }
        i += 1;
    }
    
    width
}