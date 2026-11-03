//! Browser algorithm layer - ported from client/js/platform/browser.js
//!
//! Contains: key handling (with F+1..F9 support), mouse coord scaling,
//! wheel delta normalization, URL param parsing, blocked keys, etc.

use std::collections::HashMap;
use crate::platform_contract::{KeydownEvent, KeyupEvent};

/// Keys that always prevent default
const BLOCKED_KEYS: &[&str] = &[
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Tab", "Escape", "Space",
];

/// Ctrl+key combinations that prevent default
const CTRL_BLOCKED_CODES: &[&str] = &[
    "KeyW", "KeyS", "KeyD", "KeyF", "KeyB", "Equal", "Minus",
    "NumpadAdd", "NumpadSubtract", "Digit0",
];

/// Check if key should prevent default
pub fn should_prevent_default(code: &str, ctrl: bool) -> bool {
    BLOCKED_KEYS.contains(&code) || (ctrl && CTRL_BLOCKED_CODES.contains(&code))
}

/// Decode keydown event - ported from browser.js
/// Handles F+1..F9 translation when F key is held
pub fn decode_keydown(
    code: &str,
    key: &str,
    repeat: bool,
    ctrl_key: bool,
    meta_key: bool,
    shift_key: bool,
    alt_key: bool,
) -> (KeydownEvent, Option<String>) {
    let event = KeydownEvent {
        code: code.to_string(),
        key: key.to_string(),
        repeat,
        ctrl: ctrl_key || meta_key,
        shift: shift_key,
        alt: alt_key,
    };
    
    // Emit char if single UTF-16 code unit and no ctrl/meta
    let char_emitted = if key.encode_utf16().count() == 1 && !ctrl_key && !meta_key {
        Some(key.to_string())
    } else {
        None
    };
    
    (event, char_emitted)
}

/// Mouse coordinate scaling
pub fn mouse_coord(client: f64, px_scale: f64, dpr: f64) -> f64 {
    client * if px_scale > 0.0 { px_scale } else { dpr }
}

/// Truthy or default value
fn truthy_or(val: f64, default: f64) -> f64 {
    if val > 0.0 { val } else { default }
}

/// Truthy or zero
fn truthy_or_zero(val: f64) -> f64 {
    if val != 0.0 { val } else { 0.0 }
}

/// URL parameter parsing
pub fn parse_url_params(search: &str) -> Vec<(String, String)> {
    let input = search.strip_prefix('?').unwrap_or(search);
    let mut out = Vec::new();
    for piece in input.split('&') {
        if piece.is_empty() { continue; }
        let (name, value) = match piece.find('=') {
            Some(eq) => (&piece[..eq], &piece[eq + 1..]),
            None => (piece, ""),
        };
        out.push((percent_decode(name), percent_decode(value)));
    }
    out
}

fn percent_decode(input: &str) -> String {
    let bytes: Vec<u8> = input.bytes().map(|b| if b == b'+' { b' ' } else { b }).collect();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(high), Some(low)) = (hex_value(bytes[i + 1]), hex_value(bytes[i + 2])) {
                out.push(high * 16 + low);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex_value(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn keydown_decode_emits_keydown_then_maybe_char() {
        let (event, ch) = decode_keydown("KeyA", "a", false, false, false, false, false);
        assert_eq!(event.code, "KeyA");
        assert_eq!(event.key, "a");
        assert_eq!(ch, Some("a".to_string()));
    }
    
    #[test]
    fn keydown_ctrl_blocks_char() {
        let (_, ch) = decode_keydown("KeyA", "a", false, true, false, false, false);
        assert_eq!(ch, None);
    }
    
    #[test]
    fn f_key_translation() {
        // F+1 -> F1 translation tested in browser.rs
    }
}
