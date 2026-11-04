//! Port of `client/js/util/utf8.js` decoding.
//!
//! WHATWG UTF-8: every maximal invalid subsequence becomes one U+FFFD. This is
//! the same behavior as the browser `TextDecoder`, and the JS client relies on
//! it for packet strings, NBT names and resource-pack paths. `String::from_utf8_lossy`
//! is close but not identical on truncated/overlong sequences, so the Rust core
//! uses this decoder everywhere.

use wasm_bindgen::prelude::*;

/// Decode UTF-8 with the WHATWG replacement rules. Never fails.
pub fn decode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len());
    let mut needed = 0usize;
    let mut seen = 0usize;
    let mut codepoint = 0u32;
    let mut lower = 0x80u8;
    let mut upper = 0xbfu8;
    let mut index = 0usize;

    while index < bytes.len() {
        let byte = bytes[index];
        if needed == 0 {
            if byte < 0x80 {
                out.push(byte as char);
            } else if (0xc2..=0xdf).contains(&byte) {
                needed = 1;
                codepoint = (byte & 0x1f) as u32;
            } else if (0xe0..=0xef).contains(&byte) {
                if byte == 0xe0 {
                    lower = 0xa0;
                }
                if byte == 0xed {
                    upper = 0x9f;
                }
                needed = 2;
                codepoint = (byte & 0x0f) as u32;
            } else if (0xf0..=0xf4).contains(&byte) {
                if byte == 0xf0 {
                    lower = 0x90;
                }
                if byte == 0xf4 {
                    upper = 0x8f;
                }
                needed = 3;
                codepoint = (byte & 0x07) as u32;
            } else {
                out.push('\u{fffd}');
            }
            index += 1;
            continue;
        }

        if byte < lower || byte > upper {
            // Not a valid continuation: emit one replacement and re-read this
            // byte as a potential lead byte.
            needed = 0;
            seen = 0;
            codepoint = 0;
            lower = 0x80;
            upper = 0xbf;
            out.push('\u{fffd}');
            continue;
        }

        lower = 0x80;
        upper = 0xbf;
        codepoint = (codepoint << 6) | (byte & 0x3f) as u32;
        seen += 1;
        if seen == needed {
            out.push(char::from_u32(codepoint).unwrap_or('\u{fffd}'));
            needed = 0;
            seen = 0;
            codepoint = 0;
        }
        index += 1;
    }

    if needed != 0 {
        out.push('\u{fffd}');
    }
    out
}

/// Decode a slice of a byte array, mirroring `decodeUtf8(bytes, start, end)`.
#[wasm_bindgen]
pub fn decode_utf8(bytes: &[u8], start: usize, end: usize) -> String {
    let from = start.min(bytes.len());
    let to = end.min(bytes.len()).max(from);
    decode(&bytes[from..to])
}

/// Encode a string as UTF-8. Rust strings cannot contain lone surrogates, so
/// this is the standard UTF-8 encoding the JS `encodeUtf8` produces for every
/// well-formed JS string.
#[wasm_bindgen]
pub fn encode_utf8(value: &str) -> Vec<u8> {
    value.as_bytes().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_ascii_and_multibyte() {
        assert_eq!(decode(b"hello"), "hello");
        assert_eq!(decode("héllo".as_bytes()), "héllo");
        assert_eq!(decode("日本語".as_bytes()), "日本語");
        assert_eq!(decode("😩".as_bytes()), "😩");
    }

    #[test]
    fn replaces_each_invalid_subsequence_once() {
        assert_eq!(decode(&[0xc0, 0xaf]), "\u{fffd}\u{fffd}");
        assert_eq!(decode(&[0xe0, 0x80, 0x80]), "\u{fffd}\u{fffd}\u{fffd}");
        assert_eq!(decode(&[0xed, 0xa0, 0x80]), "\u{fffd}\u{fffd}\u{fffd}");
        assert_eq!(decode(&[0xf4, 0x90, 0x80, 0x80]), "\u{fffd}\u{fffd}\u{fffd}\u{fffd}");
        assert_eq!(decode(&[0x61, 0xff, 0x62]), "a\u{fffd}b");
    }

    #[test]
    fn truncated_sequences_are_one_replacement() {
        assert_eq!(decode(&[0xe2, 0x82]), "\u{fffd}");
        assert_eq!(decode(&[0xf0, 0x9f, 0x92]), "\u{fffd}");
    }
}
