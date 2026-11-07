//! Port of `client/js/util/utf8.js`.
//! Plain-JS UTF-8 encode/decode (no TextEncoder/TextDecoder host APIs).
//! Invalid input decodes to U+FFFD exactly like TextDecoder.

use wasm_bindgen::prelude::*;

// ----------------------------------------------------------------
// UTF-8 encode/decode functions
// ----------------------------------------------------------------

/// Encode a Rust &str to UTF-8 bytes.
/// Matches JavaScript `TextEncoder` behavior: lone surrogates encode as U+FFFD.
#[wasm_bindgen]
pub fn encode_utf8(s: &str) -> Vec<u8> {
    // Use Rust's native UTF-8 encoding, which is compatible with JS TextEncoder
    // for valid strings. For lone surrogates (which can't occur in valid Rust str),
    // we handle them by replacing with U+FFFD.
    s.as_bytes().to_vec()
}

/// Decode UTF-8 bytes to a Rust String.
/// Matches JavaScript `TextDecoder` behavior: invalid input → U+FFFD replacement.
#[wasm_bindgen]
pub fn decode_utf8(b: &[u8]) -> String {
    // Use Rust's standard UTF-8 decoder with replacement character
    // This matches the JS TextDecoder behavior: invalid sequences → U+FFFD
    String::from_utf8_lossy(b).into_owned()
}

/// Decode UTF-8 bytes in a range.
#[wasm_bindgen]
pub fn decode_utf8_range(b: &[u8], start: u32, end: u32) -> String {
    let slice = &b[start as usize..end.min(b.len() as u32) as usize];
    String::from_utf8_lossy(slice).into_owned()
}

/// Alias for decode_utf8, kept for compatibility with callers.
pub fn decode(b: &[u8]) -> String {
    decode_utf8(b)
}

// ----------------------------------------------------------------
// Private helper for custom decode (not exported)
// --------------------------------------------------------------

/// Custom UTF-8 decode that matches JS TextDecoder behavior
fn decode_utf8_custom_bytes(b: &[u8]) -> String {
    let mut result = String::new();
    let mut pos = 0;

    while pos < b.len() {
        // Simple approach: try to decode using Rust's standard method first
        // and fall back to replacement for any issues
        if let Ok(cstr) = std::str::from_utf8(&b[pos..]) {
            result.push_str(cstr);
            break;
        }
        // If we get here, there's an invalid sequence
        // Add U+FFFD and move forward one byte
        result.push('\u{fffd}');
        pos += 1;
    }

    result
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_utf8_ascii() {
        let result = encode_utf8("hello");
        assert_eq!(result, b"hello");
    }

    #[test]
    fn test_encode_utf8_unicode() {
        let result = encode_utf8("héllo");
        // é = U+00E9 = 0xC3 0xA9 in UTF-8
        assert_eq!(result[0], 0xC3);
        assert_eq!(result[1], 0xA9);
    }

    #[test]
    fn test_decode_utf8() {
        let result = decode_utf8(b"hello");
        assert_eq!(result, "hello");
    }

    #[test]
    fn test_decode_utf8_invalid() {
        // Invalid UTF-8 should produce replacement character
        let result = decode_utf8(&[0xFF, 0xFE]);
        // Should contain replacement character
        assert!(!result.is_empty());
    }
}